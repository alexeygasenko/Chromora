import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {performance} from 'node:perf_hooks';

// Execute production class bodies with controlled browser scheduling and Canvas metrics.
// Pixel-perfect PNG and sampling assertions live in rendering-browser.mjs.
const root = new URL('../', import.meta.url);
function runtime({clock = performance, scheduler, locks} = {}) {
  const metrics = {readbacks: [], created: 0, closed: 0, draws: [], clones: 0, refreshes: 0};
  const palette = {LUT: new Map([[0xff0000ff, 1], [0xff00ff00, 2]]), palette: []};
  class Canvas {
    constructor(width, height) {
      this.width = width; this.height = height;
      this.context = {
        drawImage: image => {metrics.draws.push(image); if ('packed' in image) this.packed = image.packed;},
        getImageData: (x, y, width, height) => {
          metrics.readbacks.push({x, y, width, height, bytes: width * height * 4});
          const data = new Uint8ClampedArray(width * height * 4);
          new Uint32Array(data.buffer).fill(this.packed ?? 0);
          return {data, width, height};
        },
      };
    }
    getContext() {return this.context;}
    async convertToBlob() {return new Blob();}
  }
  const context = vm.createContext({
    Map, Set, WeakMap, Uint32Array, Uint8Array, Uint8ClampedArray, Blob, DOMException,
    AbortController, Number, Object, performance: clock, scheduler, queueMicrotask,
    requestAnimationFrame() {throw new Error('Rendering must not require an animation frame.');},
    setTimeout, clearTimeout, navigator: {locks}, DEFAULT_HIGHLIGHT: [[2, 0, 0]],
    console: {log() {}, warn() {}, error() {}}, consoleLog() {}, consoleWarn() {}, consoleError() {},
    localizeNumber: String, colorpaletteForBlueMarble: () => palette,
    base64ToUint8: value => Uint8Array.from(Buffer.from(value, 'base64')),
    OffscreenCanvas: Canvas,
    ImageData: class {constructor(data, width, height) {Object.assign(this, {data, width, height});}},
    createImageBitmap: async input => {
      metrics.created++;
      if (input.wait) {await input.wait;}
      return {width: 1000, height: 1000, ...input, close() {metrics.closed++;}};
    }
  });
  for (const [path, name] of [['src/Template.js', 'Template'], ['src/templateManager.js', 'TemplateManager']]) {
    const source = fs.readFileSync(new URL(path, root), 'utf8')
      .replace(/^import .*;\r?\n/gm, '')
      .replace(`export default class ${name}`, `globalThis.${name} = class ${name}`);
    vm.runInContext(source, context, {filename: path});
  }
  const manager = new context.TemplateManager('Chromora', '1.3.0');
  manager.windowMain = {handleDisplayStatus() {}};
  manager.settingsManager = {userSettings: {highlight: [[2, 0, 0]], flags: []}, saveUserStorageNow: async () => {}};
  manager.requestCanvasRefresh = async () => {metrics.refreshes++;};
  return {context, manager, metrics, palette};
}
function template(rt, {color = 0xff0000ff, side = 1, key = '0000,0000,000,000', sortID = 0} = {}) {
  const width = side * 3;
  const pixels = new Uint32Array(width * width);
  for (let y = 1; y < width; y += 3) for (let x = 1; x < width; x += 3) {pixels[y * width + x] = color;}
  pixels.slice = function() {rt.metrics.clones++; return Uint32Array.prototype.slice.call(this);};
  const bitmap = {width, height: width, closeCount: 0, close() {this.closeCount++;}};
  const value = new rt.context.Template({
    sortID, coords: [0, 0, 0, 0], chunked: {[key]: bitmap}, chunked32: {[key]: pixels},
    pixelCount: {total: side * side, colors: new Map([[rt.palette.LUT.get(color) ?? -2, side * side]])}
  });
  rt.manager.templatesArray.push(value);
  return value;
}
const bounds = {minX: 0, maxX: 0, minY: 0, maxY: 0};
const key = '0000,0000,000,000';
const gate = () => {let release; const wait = new Promise(resolve => {release = resolve;}); return {wait, release};};

for (const [x, y, alpha] of [[0, 0, 255], [100, 100, 255], [500, 500, 255], [999, 999, 1]]) {
  test(`exact transparency retains sparse pixel (${x},${y}) alpha=${alpha}`, () => {
    const rt = runtime();
    const image = {width: 1000, height: 1000, data: new Uint8ClampedArray(4_000_000)};
    image.data[(y * 1000 + x) * 4 + 3] = alpha;
    const value = new rt.context.Template();
    assert.equal(value.calculateCanvasTransparency({bitmapParams: [0, 0, 1000, 1000], sourceImageData: image}), true);
    assert.equal(value.calculateCanvasTransparency({bitmapParams: [0, 0, 0, 0], sourceImageData: image}), false);
    assert.equal(rt.metrics.readbacks.length, 0);
  });
}
test('transparency ignores hidden RGB with zero alpha and respects source rectangle', () => {
  const rt = runtime();
  const image = {width: 3, height: 3, data: new Uint8ClampedArray(36)};
  image.data[0] = 255;
  image.data[35] = 255;
  const value = new rt.context.Template();
  assert.equal(value.calculateCanvasTransparency({bitmapParams: [0, 0, 2, 2], sourceImageData: image}), false);
  assert.equal(value.calculateCanvasTransparency({bitmapParams: [2, 2, 1, 1], sourceImageData: image}), true);
});
test('sparse origin takes independent world minima, including intra-tile offsets', () => {
  const rt = runtime();
  const value = new rt.context.Template({chunked: {'0011,0010,005,020': {}, '0010,0011,030,010': {}}});
  assert.deepEqual(Array.from(value.calculateCoordsFromChunked()), [10, 10, 30, 20]);
});
test('one-pixel readback is 4 bytes, shared buffer is not copied and temporary bitmap closes', async () => {
  const rt = runtime();
  const value = template(rt);
  await rt.manager.drawTemplateOnTile({packed: 0xff0000ff}, [0, 0]);
  assert.equal(rt.metrics.readbacks.reduce((sum, item) => sum + item.bytes, 0), 4);
  assert.equal(rt.metrics.clones, 0);
  assert.equal(rt.metrics.closed, rt.metrics.created);
  assert.equal(value.pixelStateByChunk.get(key)[0], 1);
});
test('different off-palette RGBA do not match, identical RGBA do', async () => {
  const rt = runtime();
  const value = template(rt, {color: 0xff123456});
  await rt.manager.drawTemplateOnTile({packed: 0xffabcdef}, [0, 0]);
  assert.equal(value.pixelCount.correct['0000,0000'].get(-2) ?? 0, 0);
  await rt.manager.drawTemplateOnTile({packed: 0xff123456}, [0, 0]);
  assert.equal(value.pixelCount.correct['0000,0000'].get(-2), 1);
});
test('late decode and late response cannot replace newer pixel state', async () => {
  const rt = runtime();
  const value = template(rt);
  const old = gate();
  const pending = rt.manager.drawTemplateOnTile({packed: 0xff0000ff, wait: old.wait}, [0, 0], {requestSequence: 1, revision: 0});
  await rt.manager.drawTemplateOnTile({packed: 0}, [0, 0], {requestSequence: 2, revision: 0});
  old.release(); await pending;
  await rt.manager.drawTemplateOnTile({packed: 0xff0000ff}, [0, 0], {requestSequence: 1, revision: 0});
  assert.equal(value.pixelStateByChunk.get(key)[0], 2);
  assert.equal((await rt.manager.findTemplatePixelRuns(bounds, 1)).pixelCount, 1);
});
test('selection resolves draw order before color/state filtering, with stable sort ties', async () => {
  const rt = runtime();
  const upper = template(rt, {color: 0xff00ff00, sortID: 2});
  const lower = template(rt, {color: 0xff0000ff, sortID: 1});
  await rt.manager.drawTemplateOnTile({packed: 0}, [0, 0]);
  assert.equal((await rt.manager.findTemplatePixelRuns(bounds, null, {mode: 'template'})).runs[0][0], 2);
  assert.equal((await rt.manager.findTemplatePixelRuns(bounds, 1)).pixelCount, 0);
  upper.pixelStateByChunk.clear();
  assert.equal((await rt.manager.findTemplatePixelRuns(bounds, 1)).pixelCount, 0);
  upper.chunked32[key][4] = 0;
  assert.equal((await rt.manager.findTemplatePixelRuns(bounds, 1)).pixelCount, 1);
  upper.chunked32[key][4] = 0xff00ff00;
  upper.sortID = lower.sortID;
  await rt.manager.drawTemplateOnTile({packed: 0}, [0, 0]);
  assert.equal((await rt.manager.findTemplatePixelRuns(bounds, null, {mode: 'template'})).runs[0][0], 1);
});
test('disabled templates and unsupported top colors do not select hidden lower pixels', async () => {
  const rt = runtime();
  template(rt, {sortID: 0});
  const upper = template(rt, {sortID: 1, color: 0xff123456});
  await rt.manager.drawTemplateOnTile({packed: 0}, [0, 0]);
  assert.equal((await rt.manager.findTemplatePixelRuns(bounds, 1)).pixelCount, 0);
  upper.enabled = false;
  assert.equal((await rt.manager.findTemplatePixelRuns(bounds, 1)).pixelCount, 1);
});
test('task yielding completes without scheduler or animation frames', async () => {
  let ticks = 0;
  const rt = runtime({clock: {now: () => ticks += 5}});
  template(rt);
  await rt.manager.drawTemplateOnTile({packed: 0}, [0, 0]);
});
test('filter/toggle changes coalesce refresh and invalidate in-flight state', async () => {
  const rt = runtime();
  const value = template(rt);
  const delayed = gate();
  const pending = rt.manager.drawTemplateOnTile({packed: 0xff0000ff, wait: delayed.wait}, [0, 0]);
  await Promise.resolve();
  rt.manager.setColorFiltered(1, true);
  rt.manager.setColorsFiltered([1, 2], false);
  rt.manager.setTemplatesShouldBeDrawn(false);
  await Promise.resolve();
  assert.equal(rt.metrics.refreshes, 1);
  delayed.release(); await pending;
  assert.equal(value.pixelStateByChunk.size, 0);
});
test('filtered render copies only modified buffers and closes its temporary bitmaps', async () => {
  const rt = runtime();
  const value = template(rt);
  rt.manager.shouldFilterColor.set(1, true);
  await rt.manager.drawTemplateOnTile({packed: 0}, [0, 0]);
  assert.equal(rt.metrics.clones, 1);
  assert.equal(rt.metrics.closed, rt.metrics.created);
  assert.equal(value.chunked32[key][4], 0xff0000ff);
});
test('two-render bound holds and a queued cancellation completes without decoding', async () => {
  const rt = runtime();
  const delayed = gate();
  for (let x = 0; x < 3; x++) {template(rt, {key: `000${x},0000,000,000`});}
  const pending = [0, 1].map(x => rt.manager.drawTemplateOnTile({packed: 0, wait: delayed.wait}, [x, 0]));
  const controller = new AbortController();
  const cancelled = rt.manager.drawTemplateOnTile({packed: 0}, [2, 0], {signal: controller.signal});
  await Promise.resolve();
  assert.equal(rt.metrics.created, 2);
  controller.abort(); await cancelled;
  assert.equal(rt.metrics.created, 2);
  delayed.release(); await Promise.all(pending);
  assert.equal(rt.manager.activeTileRenders, 0);
});
test('retired template bitmap remains alive until its active render releases it', async () => {
  const rt = runtime();
  const value = template(rt);
  const bitmap = value.chunked[key];
  const delayed = gate();
  const pending = rt.manager.drawTemplateOnTile({packed: 0, wait: delayed.wait}, [0, 0]);
  await Promise.resolve();
  await rt.manager.importJSON({});
  assert.equal(bitmap.closeCount, 0);
  delayed.release(); await pending;
  assert.equal(bitmap.closeCount, 1);
  assert.equal(value.pixelStateByChunk.size, 0);
});
test('no Web Locks fails safely before image creation or storage mutation', async () => {
  const rt = runtime();
  const value = template(rt);
  await assert.rejects(rt.manager.createTemplate(new Blob(), 'new', [0, 0, 0, 0]), /Web Locks/);
  assert.equal(rt.manager.templatesArray.length, 1);
  assert.equal(rt.manager.templatesArray[0], value);
  assert.equal(rt.metrics.created, 0);
});

test('unused filters avoid copies and incomplete Erased metadata cannot mutate stored pixels', async () => {
  const rt = runtime();
  const value = template(rt);
  rt.manager.shouldFilterColor.set(2, true);
  await rt.manager.drawTemplateOnTile({packed: 0}, [0, 0]);
  assert.equal(rt.metrics.clones, 0);
  rt.palette.LUT.set(0xffcefade, -1);
  value.chunked32[key][4] = 0xffcefade;
  value.pixelCount.colors = new Map();
  await rt.manager.drawTemplateOnTile({packed: 0}, [0, 0]);
  assert.equal(rt.metrics.clones, 1);
  assert.equal(value.chunked32[key][4], 0xffcefade);
});

function bridgeSurface(rt) {
  const window = new EventTarget();
  window.location = {origin: 'https://wplace.live'};
  const messages = [];
  window.postMessage = (data, origin) => {messages.push({data, origin});};
  // Tampermonkey's lexical window wrapper is not the message's source Window.
  rt.context.window = {
    location: window.location,
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    postMessage: window.postMessage.bind(window)
  };
  rt.context.document = {defaultView: window};
  const emit = (data, {source = window, origin = window.location.origin} = {}) => {
    const event = Object.assign(new Event('message'), {data, source, origin});
    window.dispatchEvent(event);
  };
  return {window, messages, emit};
}

test('refresh progress rejects foreign sources, origins, and nonnumeric revisions', async () => {
  const rt = runtime(); const bridge = bridgeSurface(rt);
  rt.manager.requestCanvasRefresh = rt.context.TemplateManager.prototype.requestCanvasRefresh;
  let settled = false;
  const pending = rt.manager.requestCanvasRefresh().then(() => {settled = true;});
  const data = {source: 'blue-marble', action: 'refresh-unavailable', revision: rt.manager.canvasRefreshRevision};
  bridge.emit(data, {source: {}});
  bridge.emit(data, {origin: 'https://other.example'});
  bridge.emit({...data, revision: String(data.revision)});
  await Promise.resolve(); assert.equal(settled, false);
  bridge.emit(data); await pending;
  assert.equal(bridge.messages[0].origin, 'https://wplace.live');
});

test('teleport requires same-window origin and a boolean success result', async () => {
  const rt = runtime(); const bridge = bridgeSurface(rt);
  const value = template(rt); value.storageKey = '0 author';
  let settled = false;
  const pending = rt.manager.teleportToTemplate(value).then(result => {settled = true; return result;});
  const request = bridge.messages[0].data;
  const data = {source: 'blue-marble', action: 'template-teleport-result', requestID: request.requestID, success: true};
  bridge.emit(data, {source: {}});
  bridge.emit(data, {origin: 'https://other.example'});
  bridge.emit({...data, success: 'true'});
  await Promise.resolve(); assert.equal(settled, false);
  bridge.emit(data);
  assert.equal((await pending).worldX, 0.5);
});

test('area selection rejects foreign/malformed messages before starting work', async () => {
  const rt = runtime(); const bridge = bridgeSurface(rt);
  let scans = 0;
  rt.manager.findTemplatePixelRuns = async () => {scans++; return {runs: [], pixelCount: 0};};
  const stop = rt.manager.startPaintAreaSelectionBridge();
  const data = {source: 'blue-marble', action: 'paint-area-selected', requestID: 'request', mode: 'template', bounds};
  bridge.emit(data, {source: {}});
  bridge.emit(data, {origin: 'https://other.example'});
  bridge.emit({...data, requestID: null});
  assert.equal(scans, 0);
  bridge.emit(data); await new Promise(resolve => setImmediate(resolve));
  assert.equal(scans, 1);
  assert.equal(bridge.messages[0].origin, 'https://wplace.live');
  stop();
});
