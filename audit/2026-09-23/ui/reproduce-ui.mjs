// Audit-only diagnostics. Bundles source into memory; never invokes the release build.
// DOM shims validate callback/state behavior only; they do not validate browser layout.
import { build } from 'esbuild';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const bundle = await build({
  stdin: {
    contents: `export {default as Overlay} from './src/Overlay.js';
export {default as Template} from './src/Template.js';
export {default as TemplateManager} from './src/templateManager.js';
export {default as WindowFilter} from './src/WindowFilter.js';
export {default as SettingsManager} from './src/settingsManager.js';`,
    resolveDir: root,
  }, bundle: true, write: false, format: 'cjs', platform: 'node', logLevel: 'silent', loader: {'.png': 'dataurl'},
  // Expose private methods only in the in-memory diagnostic copy; method bodies are unchanged.
  plugins: [{name: 'audit-private-access', setup(builder) {
    builder.onLoad({filter: /WindowFilter\.js$/}, async args => ({
      contents: fs.readFileSync(args.path, 'utf8').replace(/#([A-Za-z_$][\w$]*)\s*\(/g, 'audit_$1('),
      loader: 'js', resolveDir: path.dirname(args.path),
    }));
  }}],
});
const results = [];
let timerSequence = 0;
const intervals = new Map();
const messages = [];
const writes = [];
const classList = () => {
  const values = new Set();
  return {add: (...items) => items.forEach(item => values.add(item)), remove: (...items) => items.forEach(item => values.delete(item)), contains: item => values.has(item)};
};
const makeElement = tag => ({
  tagName: tag.toUpperCase(), classList: classList(), dataset: {}, style: {}, isConnected: false,
  listeners: new Map(), attributes: {},
  setAttribute(name, value) {this.attributes[name] = value;},
  addEventListener(name, fn) {this.listeners.set(name, fn);},
  getBoundingClientRect() {return {left: 100, top: 100, width: 300, height: 180};},
  closest() {return null;},
  setPointerCapture() {}, hasPointerCapture() {return false;},
});
const document = {
  body: makeElement('body'), documentElement: makeElement('html'),
  createElement: makeElement, querySelector: () => null,
};
const sandbox = {
  module: {exports: {}}, exports: {}, console: {log() {}, warn() {}, error() {}, info() {}},
  document, window: {innerWidth: 1024, innerHeight: 768, postMessage: message => messages.push(message)},
  HTMLElement: class {}, customElements: {get() {return true;}, define() {}},
  crypto: {randomUUID: () => '01234567-89ab-cdef-0123-456789abcdef'},
  structuredClone, setTimeout, clearTimeout,
  setInterval: fn => {const id = ++timerSequence; intervals.set(id, fn); return id;},
  clearInterval: id => intervals.delete(id),
  requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  GM: {setValue: async (...args) => {writes.push(args);}},
};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(bundle.outputFiles[0].text, sandbox, {filename: 'audit-in-memory-ui.cjs'});
const {Overlay, Template, TemplateManager, WindowFilter, SettingsManager} = sandbox.module.exports;

// Sparse legacy shape: upper-right chunk and lower-left chunk.
const template = new Template({chunked: {'0011,0010,000,000': 'first', '0010,0011,000,000': 'second'}});
template.calculateCoordsFromChunked();
const expectedImageOrigin = [10, 10, 0, 0];
results.push({id: 'sparse-template-origin', actual: template.coords, expectedImageOrigin,
  migrationShiftPixels: [(template.coords[0] - 10) * 1000 + template.coords[2], (template.coords[1] - 10) * 1000 + template.coords[3]]});

// Actual setters do not invalidate already displayed tile textures.
const manager = new TemplateManager('Audit', '1.3.0');
let refreshCalls = 0;
manager.requestCanvasRefresh = () => {refreshCalls++; return Promise.resolve();};
manager.setTemplatesShouldBeDrawn(false);
manager.setColorFiltered(1, true);
manager.setColorsFiltered([2, 3], true);
results.push({id: 'visibility-setters-invalidation', refreshCalls, templatesShouldBeDrawn: manager.templatesShouldBeDrawn,
  hiddenColorIDs: [...manager.shouldFilterColor.keys()]});

// Actual settings setter permits both selection modes to use one key.
const settings = new SettingsManager('Audit', '1.3.0', {});
await settings.setPaintAreaHotkey('paintAllArea', 'AltLeft');
const lastSettingsMessages = messages.filter(message => message.action === 'paint-area-hotkey-setting').slice(-2);
const hotkeyCodes = Object.fromEntries(lastSettingsMessages.map(({mode, code}) => [mode, code]));
// This is the exact dispatch expression from src/main.js:356.
const selectedMode = ['matching', 'template'].find(mode => hotkeyCodes[mode] == 'AltLeft');
results.push({id: 'duplicate-hotkey', persisted: settings.userSettings.hotkeys, hotkeyCodes, selectedMode});

// The interval callback survives element detachment.
const overlay = new Overlay('Audit', '1.3.0');
const beforeTimers = new Set(intervals.keys());
let timer;
overlay.addTimer(Date.now(), 1000, {}, (_, element) => {timer = element;});
const timerID = [...intervals.keys()].find(id => !beforeTimers.has(id));
timer.isConnected = false;
intervals.get(timerID)();
results.push({id: 'detached-timer', timerConnected: timer.isConnected, intervalStillRegistered: intervals.has(timerID)});

// Actual drag event callbacks accept coordinates beyond the viewport.
const surface = makeElement('div');
const handle = makeElement('div');
document.querySelector = selector => selector === '#surface' ? surface : handle;
overlay.handleDrag('#surface', '#handle');
const pointer = {pointerId: 1, pointerType: 'mouse', button: 0, target: handle, preventDefault() {}};
handle.listeners.get('pointerdown')({...pointer, clientX: 120, clientY: 115});
handle.listeners.get('pointermove')({...pointer, clientX: -150, clientY: -300});
handle.listeners.get('pointerup')({...pointer, clientX: -150, clientY: -300});
results.push({id: 'offscreen-drag', viewport: [1024, 768], transform: surface.style.transform});

// display:none produces a zero DOMRect but isConnected remains true.
const filterSettings = {userSettings: {windowFilter: {width: 600, height: 500, x: 220, y: 140}}, saveUserStorageNow() {}};
const filter = new WindowFilter({name: 'Audit', version: '1.3.0', apiManager: {templateManager: manager}, settingsManager: filterSettings});
const hiddenFilter = makeElement('div');
hiddenFilter.isConnected = true;
hiddenFilter.classList.add('bm-windowed');
hiddenFilter.querySelector = () => null;
hiddenFilter.offsetWidth = hiddenFilter.offsetHeight = 0;
hiddenFilter.getBoundingClientRect = () => ({x: 0, y: 0, left: 0, top: 0, width: 0, height: 0});
const beforeHiddenSave = structuredClone(filterSettings.userSettings.windowFilter);
filter.audit_saveWindowState(hiddenFilter);
results.push({id: 'hidden-filter-geometry-save', before: beforeHiddenSave, after: filterSettings.userSettings.windowFilter, inlineStyle: hiddenFilter.style});

const invalidSettings = new SettingsManager('Audit', '1.3.0', {flags: {}});
let malformedFlagsError;
try {invalidSettings.toggleFlag('hl-noTrans', true);} catch (error) {malformedFlagsError = error.message;}
results.push({id: 'malformed-settings-flags', input: {flags: {}}, error: malformedFlagsError});

// Build the actual settings handlers with a minimal chain stub; select the visible Cross preset.
const freshSettings = new SettingsManager('Audit', '1.3.0', {});
const gridButtons = [];
const presetButtons = [];
for (const method of ['addDiv', 'addHeader', 'addHr', 'addP', 'addSpan', 'buildElement']) {
  freshSettings[method] = function() {return this;};
}
freshSettings.addCheckbox = function(properties, callback) {callback(this, makeElement('label'), makeElement('input')); return this;};
freshSettings.addButton = function(properties, callback) {
  const button = makeElement('button');
  button.dataset.status = properties['data-status'];
  button.ariaLabel = properties['aria-label'];
  button.click = () => {if (!button.disabled) {return button.onclick?.();}};
  if (properties['data-status']) {gridButtons.push(button);} else {presetButtons.push(button);}
  callback(this, button);
  return this;
};
freshSettings.buildHighlight();
document.querySelector = selector => selector === '.bm-highlight-grid' ? {childNodes: gridButtons} : null;
document.querySelectorAll = () => presetButtons;
await presetButtons.find(button => button.ariaLabel === 'Preset "Cross Shape"').click();
results.push({id: 'fresh-cross-highlight-preset', visibleGridStates: gridButtons.map(button => button.dataset.status),
  storedHighlightAfterCrossClick: freshSettings.userSettings.highlight ?? null,
  rendererEffectivePattern: freshSettings.userSettings.highlight || [[2, 0, 0]]});

// Reuse the exact data-percent assignment expression from current source.
const filterSource = fs.readFileSync(path.join(root, 'src/WindowFilter.js'), 'utf8');
const percentExpression = filterSource.match(/color\.dataset\['percent'\] = ([^;]+);/)[1];
const makeSortKey = new Function('colorPercent', `return ${percentExpression}`);
for (const locale of ['en-US', 'ru-RU', 'de-DE', 'tr-TR', 'ar-EG']) {
  const percentFormat = new Intl.NumberFormat(locale, {style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2});
  const values = [0.1099, 0.1001].map(ratio => {
    const text = percentFormat.format(ratio);
    const key = makeSortKey(text);
    return {ratio, text, key, parsedKey: parseFloat(key)};
  });
  results.push({id: 'localized-percent-sort', locale, values});
}

fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'reproduction-results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
