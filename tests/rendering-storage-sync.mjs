import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

function fixture({notifications = true} = {}) {
  const shared = {stored: '{}', listeners: new Map(), nextListener: 0, writes: 0, decodes: 0, closed: 0, decodeGate: null};
  let lockTail = Promise.resolve();
  const locks = {request: (_name, operation) => {
    const result = lockTail.then(operation);
    lockTail = result.catch(() => {});
    return result;
  }};
  const makeManager = () => {
    const window = new EventTarget(); window.location = {origin: 'https://wplace.live'};
    const document = new EventTarget(); document.visibilityState = 'visible';
    const context = vm.createContext({
      Map, Set, WeakMap, Uint32Array, Uint8Array, Uint8ClampedArray, Blob, DOMException,
      Event, AbortController, Number, Object, performance, queueMicrotask, setTimeout, clearTimeout,
      navigator: {locks}, window, document, DEFAULT_HIGHLIGHT: [[2, 0, 0]],
      console: {log() {}, warn() {}, error() {}}, consoleLog() {}, consoleWarn() {}, consoleError() {},
      localizeNumber: String, colorpaletteForBlueMarble: () => ({LUT: new Map([[0xff0000ff, 1]]), palette: []}),
      numberToEncoded: () => 'author', base64ToUint8: value => Uint8Array.from(Buffer.from(value, 'base64')),
      GM_getValue: () => shared.stored,
      GM: {setValue: async (_name, value) => {
        const old = shared.stored;
        await Promise.resolve();
        shared.stored = value; shared.writes++;
        for (const listener of shared.listeners.values()) {listener('bmTemplates', old, value, true);}
      }},
      ...(notifications ? {
        GM_addValueChangeListener: (_name, callback) => {const id = ++shared.nextListener; shared.listeners.set(id, callback); return id;},
        GM_removeValueChangeListener: id => shared.listeners.delete(id)
      } : {}),
      OffscreenCanvas: class {
        getContext() {return {drawImage() {}, getImageData: () => ({data: new Uint8ClampedArray(36)})};}
      },
      createImageBitmap: async () => {
        shared.decodes++;
        const blocked = shared.decodeGate; shared.decodeGate = null;
        if (blocked) {await blocked;}
        return {width: 3, height: 3, close() {shared.closed++;}};
      }
    });
    for (const [path, name] of [['src/Template.js', 'Template'], ['src/templateManager.js', 'TemplateManager']]) {
      const source = fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replace(`export default class ${name}`, `globalThis.${name} = class ${name}`);
      vm.runInContext(source, context, {filename: path});
    }
    // Isolate persistence/reconciliation while real image algorithms are covered by Canvas tests.
    context.Template.prototype.createTemplateTiles = async function() {
      const key = `${String(this.coords[0]).padStart(4, '0')},${String(this.coords[1]).padStart(4, '0')},000,000`;
      this.pixelCount = {total: 1, colors: new Map([[1, 1]])};
      this.chunked32 = {[key]: new Uint32Array(9)};
      return {templateTiles: {[key]: {width: 3, height: 3, close() {shared.closed++;}}}, templateTilesBuffers: {[key]: 'cG5n'}};
    };
    const manager = new context.TemplateManager('Chromora', '1.3.0');
    manager.windowMain = {handleDisplayStatus() {}, handleDisplayError() {}};
    manager.requestCanvasRefresh = async () => {};
    manager.setSettingsManager({userSettings: {filter: [], flags: []}});
    return {manager, window, document};
  };
  const first = makeManager(); const second = makeManager();
  const settle = async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
    await Promise.all([first.manager.templateMutationQueue, second.manager.templateMutationQueue]);
  };
  const stop = () => {first.manager.stopTemplateStorageSync(); second.manager.stopTemplateStorageSync();};
  return {shared, first, second, settle, stop};
}
const names = manager => Array.from(manager.templatesArray, template => template.displayName).sort();
const create = (manager, name, x = 0) => manager.createTemplate(new Blob(), name, [x, 0, 0, 0]);

test('two managers synchronize concurrent creates, toggles, and deletes without overwriting storage', async () => {
  const f = fixture();
  f.first.manager.startTemplateStorageSync(); f.second.manager.startTemplateStorageSync();
  try {
    const [one, two] = await Promise.all([create(f.first.manager, 'One'), create(f.second.manager, 'Two', 1)]);
    await f.settle();
    assert.deepEqual(names(f.first.manager), ['One', 'Two']);
    assert.deepEqual(names(f.second.manager), ['One', 'Two']);
    assert.equal(Object.keys(JSON.parse(f.shared.stored).templates).length, 2);
    assert.equal(f.shared.writes, 2, 'Synchronization must not write back snapshots');
    const beforeToggleDecodes = f.shared.decodes;
    await f.first.manager.setTemplateEnabled(one.storageKey, false); await f.settle();
    assert.equal(f.second.manager.templatesArray.find(template => template.storageKey === one.storageKey).enabled, false);
    assert.equal(f.shared.decodes, beforeToggleDecodes, 'Metadata-only changes must reuse image resources');
    await f.second.manager.deleteTemplate(two.storageKey); await f.settle();
    assert.deepEqual(names(f.first.manager), ['One']);
    assert.deepEqual(names(f.second.manager), ['One']);
    assert.equal(Object.keys(JSON.parse(f.shared.stored).templates).length, 1);
    assert.equal(f.shared.writes, 4);
  } finally {f.stop();}
  assert.equal(f.shared.listeners.size, 0);
});

test('delayed old event payload cannot resurrect a template deleted by a newer local mutation', async () => {
  const f = fixture();
  f.first.manager.startTemplateStorageSync(); f.second.manager.startTemplateStorageSync();
  try {
    const one = await create(f.first.manager, 'One'); await f.settle();
    const staleValue = f.shared.stored;
    const deletion = f.second.manager.deleteTemplate(one.storageKey);
    for (const listener of f.shared.listeners.values()) {listener('bmTemplates', '{}', staleValue, true);}
    await deletion; await f.settle();
    assert.deepEqual(names(f.first.manager), []);
    assert.deepEqual(names(f.second.manager), []);
    assert.equal(f.shared.writes, 2);
  } finally {f.stop();}
});

test('storage changes during decoding discard staged bitmaps and commit only a fresh snapshot', async () => {
  const f = fixture();
  const one = await create(f.first.manager, 'One');
  let release;
  f.shared.decodeGate = new Promise(resolve => {release = resolve;});
  const pending = f.second.manager.syncTemplatesFromStorage();
  while (!f.shared.decodes) {await Promise.resolve();}
  await f.first.manager.deleteTemplate(one.storageKey);
  release(); await pending;
  assert.deepEqual(names(f.second.manager), []);
  assert.equal(f.shared.closed, 2, 'Deleted local bitmap and obsolete decoded bitmap both close');
  assert.equal(f.shared.writes, 2);
});

test('focus/visibility fallback catches changes when value listener APIs are unavailable', async () => {
  const f = fixture({notifications: false});
  f.first.manager.startTemplateStorageSync(); f.second.manager.startTemplateStorageSync();
  try {
    await f.settle();
    const one = await create(f.first.manager, 'One');
    f.second.window.dispatchEvent(new Event('focus')); await f.settle();
    assert.deepEqual(names(f.second.manager), ['One']);
    await f.first.manager.setTemplateEnabled(one.storageKey, false);
    f.second.document.dispatchEvent(new Event('visibilitychange')); await f.settle();
    assert.equal(f.second.manager.templatesArray[0].enabled, false);
    f.second.manager.stopTemplateStorageSync();
    await f.first.manager.deleteTemplate(one.storageKey);
    f.second.window.dispatchEvent(new Event('focus')); await f.settle();
    assert.deepEqual(names(f.second.manager), ['One'], 'Stopped listeners must not mutate detached runtime');
  } finally {f.stop();}
});

test('malformed external storage leaves current runtime and persistent bytes intact', async () => {
  const f = fixture();
  await create(f.first.manager, 'One');
  await f.second.manager.syncTemplatesFromStorage();
  f.shared.stored = '{broken';
  await assert.rejects(f.second.manager.syncTemplatesFromStorage(), /JSON|property|Unexpected/i);
  assert.deepEqual(names(f.second.manager), ['One']);
  assert.equal(f.shared.stored, '{broken');
  assert.equal(f.shared.writes, 1);
});
