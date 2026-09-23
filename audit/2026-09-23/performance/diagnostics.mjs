import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';

// Executes the current production class bodies with instrumented browser mocks.
// No canvas/GPU timings are implied by these tests. No production files are changed.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const results = [];
function makeRuntime({clock = performance, scheduler, raf} = {}) {
  const metrics = {canvases: [], readbacks: [], bitmapsCreated: 0, bitmapsClosed: 0, drawCalls: 0};
  const palette = {LUT: new Map([[0xff0000ff, 1], [0xff00ff00, 2]]), palette: []};
  class Canvas {
    constructor(width, height) {
      this.width = width; this.height = height;
      metrics.canvases.push([width, height]);
      this.context = {
        beginPath() {}, rect() {}, clip() {}, clearRect() {},
        drawImage: bitmap => {metrics.drawCalls++; if ('packed' in bitmap) this.packed = bitmap.packed;},
        getImageData: (x, y, width, height) => {
          metrics.readbacks.push({width, height, bytes: width * height * 4});
          const data = new Uint8ClampedArray(width * height * 4);
          new Uint32Array(data.buffer).fill(this.packed ?? 0);
          return {data};
        }
      };
    }
    getContext() {return this.context;}
    async convertToBlob() {return new Blob();}
  }
  const context = vm.createContext({
    Map, Set, Uint32Array, Uint8Array, Uint8ClampedArray, Blob, Number, Object,
    performance: clock, scheduler,
    requestAnimationFrame: raf ?? (fn => setImmediate(fn)),
    setTimeout: () => 1, clearTimeout() {},
    console: {log() {}, warn() {}, error() {}},
    consoleLog() {}, consoleWarn() {}, consoleError() {},
    localizeNumber: String, colorpaletteForBlueMarble: () => palette,
    OffscreenCanvas: Canvas,
    ImageData: class {constructor(data, width, height) {Object.assign(this, {data, width, height});}},
    createImageBitmap: async input => {
      if (input.wait) await input.wait;
      metrics.bitmapsCreated++;
      return {...input, close() {metrics.bitmapsClosed++;}};
    }
  });
  for (const [path, name] of [['src/Template.js', 'Template'], ['src/templateManager.js', 'TemplateManager']]) {
    let source = fs.readFileSync(root + path, 'utf8').replace(/^import .*;\r?\n/gm, '');
    source = source.replace(`export default class ${name}`, `globalThis.${name} = class ${name}`);
    vm.runInContext(source, context, {filename: path});
  }
  const manager = new context.TemplateManager('audit', '1');
  manager.windowMain = {handleDisplayStatus() {}};
  manager.settingsManager = {userSettings: {highlight: [[2, 0, 0]], flags: []}};
  return {context, manager, metrics, palette};
}
function addTemplate(runtime, {side = 1, color = 0xff0000ff, key = '0000,0000,000,000'} = {}) {
  const width = side * 3;
  const pixels = new Uint32Array(width * width);
  for (let y = 1; y < width; y += 3) for (let x = 1; x < width; x += 3) pixels[y * width + x] = color;
  const template = new runtime.context.Template({
    coords: [0, 0, 0, 0],
    chunked: {[key]: {width, height: width}}, chunked32: {[key]: pixels},
    pixelCount: {total: side * side, colors: new Map([[runtime.palette.LUT.get(color) ?? -2, side * side]])}
  });
  runtime.manager.templatesArray.push(template);
  return template;
}

{
  const runtime = makeRuntime();
  runtime.manager.tileSize = 1;
  const template = addTemplate(runtime, {color: 0xff123456});
  await runtime.manager.drawTemplateOnTile({packed: 0xffabcdef}, [0, 0]);
  const correctUnknown = template.pixelCount.correct['0000,0000'].get(-2);
  assert.equal(correctUnknown, 1);
  results.push({test: 'different-off-palette-colors-count-as-correct', expectedCorrect: 0, actualCorrect: correctUnknown, status: 'BUG_REPRODUCED'});
}

{
  const runtime = makeRuntime();
  addTemplate(runtime);
  const start = performance.now();
  await runtime.manager.drawTemplateOnTile({packed: 0xff0000ff}, [0, 0]);
  results.push({test: 'one-pixel-template-on-default-tile', ...runtime.metrics,
    readbackBytes: runtime.metrics.readbacks.reduce((sum, item) => sum + item.bytes, 0),
    mockElapsedMs: +(performance.now() - start).toFixed(2),
    note: 'Canvas sizes/readback requests are observed; GPU memory and browser timing are not measured.'});
}

{
  const runtime = makeRuntime();
  runtime.manager.tileSize = 1;
  const template = addTemplate(runtime);
  let releaseOld;
  const wait = new Promise(resolve => releaseOld = resolve);
  const oldDraw = runtime.manager.drawTemplateOnTile({packed: 0xff0000ff, wait}, [0, 0]);
  await runtime.manager.drawTemplateOnTile({packed: 0}, [0, 0]);
  const stateAfterNew = template.pixelStateByChunk.get('0000,0000,000,000')[0];
  releaseOld();
  await oldDraw;
  const stateAfterOld = template.pixelStateByChunk.get('0000,0000,000,000')[0];
  assert.equal(stateAfterNew, 2); assert.equal(stateAfterOld, 1);
  const selected = await runtime.manager.findTemplatePixelRuns({minX: 0, maxX: 0, minY: 0, maxY: 0}, 1);
  assert.equal(selected.pixelCount, 0);
  results.push({test: 'out-of-order-render-overwrites-fresh-board-state', stateAfterNew, stateAfterOld,
    expectedSelectablePixelsForNewBoard: 1, actualSelectablePixels: selected.pixelCount, status: 'BUG_REPRODUCED'});
}

{
  const runtime = makeRuntime();
  runtime.manager.tileSize = 1;
  const lower = addTemplate(runtime, {color: 0xff0000ff});
  const upper = addTemplate(runtime, {color: 0xff00ff00});
  lower.sortID = 0; upper.sortID = 1;
  await runtime.manager.drawTemplateOnTile({packed: 0}, [0, 0]);
  const selected = await runtime.manager.findTemplatePixelRuns({minX: 0, maxX: 0, minY: 0, maxY: 0}, null, {mode: 'template'});
  assert.equal(selected.runs[0][0], 1);
  results.push({test: 'area-selection-uses-covered-lower-template-color', visibleUpperColorID: 2,
    selectedColorID: selected.runs[0][0], status: 'BUG_REPRODUCED'});
}

{
  let ticks = 0;
  const frames = [];
  const runtime = makeRuntime({clock: {now: () => ticks += 5}, raf: fn => frames.push(fn)});
  runtime.manager.tileSize = 1;
  addTemplate(runtime);
  let settled = false;
  const draw = runtime.manager.drawTemplateOnTile({packed: 0xff0000ff}, [0, 0]).then(() => settled = true);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(settled, false); assert.equal(frames.length, 1);
  frames.shift()();
  await draw;
  results.push({test: 'no-scheduler-yield-and-withheld-animation-frame', pendingUntilAnimationFrame: true,
    completedAfterAnimationFrame: settled, status: 'BEHAVIOR_REPRODUCED'});
}

{
  const runtime = makeRuntime();
  runtime.manager.tileSize = 1;
  addTemplate(runtime);
  for (let i = 0; i < 20; i++) await runtime.manager.drawTemplateOnTile({packed: 0xff0000ff}, [0, 0]);
  assert.equal(runtime.metrics.bitmapsCreated, 20); assert.equal(runtime.metrics.bitmapsClosed, 0);
  results.push({test: 'temporary-bitmaps-not-explicitly-closed', ...runtime.metrics,
    note: 'Absence of deterministic disposal is measured. Actual GC/native memory reclamation is browser-dependent; this alone does not prove a permanent leak.'});
}

{
  const runtime = makeRuntime({scheduler: {yield: async () => {}}});
  const template = addTemplate(runtime, {side: 1000});
  const samplesMs = [];
  for (let run = 0; run < 4; run++) {
    const start = performance.now();
    await runtime.manager.drawTemplateOnTile({packed: 0xff0000ff}, [0, 0]);
    samplesMs.push(+(performance.now() - start).toFixed(2));
  }
  results.push({test: 'million-pixel-cpu-path-with-canvas-mocks', samplesMs,
    templateBufferBytes: template.chunked32['0000,0000,000,000'].byteLength,
    stateBufferBytes: template.pixelStateByChunk.get('0000,0000,000,000').byteLength,
    tileReadbackBytesPerDraw: runtime.metrics.readbacks[0].bytes,
    unconditionalTemplateCloneBytesPerDraw: template.chunked32['0000,0000,000,000'].byteLength,
    note: 'Mock drawImage/PNG encoder; real JS scan/copy and readback allocation/fill. Not a browser/FPS benchmark; scheduler waits disabled.'});
}

fs.writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify({node: process.version, generatedAt: new Date().toISOString(), results}, null, 2));
console.log(JSON.stringify(results, null, 2));
