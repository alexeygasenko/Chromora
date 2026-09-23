import fs from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';

// Use an existing Playwright installation; do not change project dependencies.
const modulePath = process.env.AUDIT_PLAYWRIGHT_MODULE;
if (!modulePath) throw new Error('Set AUDIT_PLAYWRIGHT_MODULE to playwright/index.mjs');
const {chromium} = await import(pathToFileURL(modulePath));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const sources = ['src/utils.js', 'src/Template.js', 'src/templateManager.js'].map(path =>
  fs.readFileSync(root + path, 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export default /gm, '').replace(/^export /gm, '')
).join('\n');
const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try {
  const page = await browser.newPage();
  await page.addScriptTag({content: `${sources}\nglobalThis.AuditTemplate = Template; globalThis.AuditTemplateManager = TemplateManager;`});
  const result = await page.evaluate(async () => {
    console.log = () => {};
    const output = {userAgent: navigator.userAgent, schedulerYield: typeof globalThis.scheduler?.yield, canvas: 'real browser OffscreenCanvas', tests: []};
    const template = new AuditTemplate();
    const source = new OffscreenCanvas(1000, 1000);
    const sourceContext = source.getContext('2d');
    for (const [x, y] of [[0, 0], [5, 5], [50, 50], [100, 100], [500, 500], [999, 999]]) {
      sourceContext.clearRect(0, 0, 1000, 1000);
      sourceContext.fillStyle = '#ff0000';
      sourceContext.fillRect(x, y, 1, 1);
      const bitmap = await createImageBitmap(source);
      const transCanvas = new OffscreenCanvas(1000, 1000);
      const transContext = transCanvas.getContext('2d', {willReadFrequently: true});
      transContext.globalCompositeOperation = 'destination-over';
      const detected = template.calculateCanvasTransparency({bitmap, bitmapParams: [0, 0, 1000, 1000], transCanvas, transContext});
      output.tests.push({test: 'single-opaque-pixel-is-not-transparent', x, y, expectedDetected: true, actualDetected: detected});
      bitmap.close();
    }
    sourceContext.clearRect(0, 0, 1000, 1000);
    sourceContext.fillStyle = '#fff'; sourceContext.fillRect(500, 500, 1, 1);
    const sparse = new AuditTemplate({file: await source.convertToBlob(), coords: [0, 0, 0, 0]});
    const paletteManager = new AuditTemplateManager('audit', '1');
    const sparseResult = await sparse.createTemplateTiles(1000, paletteManager.paletteBM, true, false);
    output.tests.push({test: 'complete-sparse-template-creation', opaquePixelsCounted: sparse.pixelCount.total,
      expectedChunkCount: 1, actualChunkCount: Object.keys(sparseResult.templateTiles).length});
    for (const side of [1, 1000]) {
      const manager = new AuditTemplateManager('audit', '1');
      manager.windowMain = {handleDisplayStatus() {}};
      manager.settingsManager = {userSettings: {highlight: [[2, 0, 0]], flags: []}};
      const templateCanvas = new OffscreenCanvas(side * 3, side * 3);
      const ctx = templateCanvas.getContext('2d');
      const rgba = new Uint32Array(side * side * 9);
      // White belongs to the real palette.
      for (let y = 1; y < side * 3; y += 3) for (let x = 1; x < side * 3; x += 3) rgba[y * side * 3 + x] = 0xffffffff;
      ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer), side * 3, side * 3), 0, 0);
      const bitmap = await createImageBitmap(templateCanvas);
      const instance = new AuditTemplate({coords: [0, 0, 0, 0], chunked: {'0000,0000,000,000': bitmap}, chunked32: {'0000,0000,000,000': rgba}, pixelCount: {total: side * side, colors: new Map([[5, side * side]])}});
      manager.templatesArray.push(instance);
      const board = new OffscreenCanvas(1000, 1000);
      const boardContext = board.getContext('2d');
      boardContext.fillStyle = '#fff'; boardContext.fillRect(0, 0, 1000, 1000);
      const blob = await board.convertToBlob();
      const samplesMs = [];
      let outputPngBytes;
      for (let run = 0; run < 4; run++) {
        const start = performance.now();
        const rendered = await manager.drawTemplateOnTile(blob, [0, 0]);
        samplesMs.push(+(performance.now() - start).toFixed(2));
        outputPngBytes = rendered.size;
      }
      output.tests.push({test: 'actual-browser-render-png', templateLogicalWidth: side, templateLogicalHeight: side, boardLogicalWidth: 1000, boardLogicalHeight: 1000, outputPngBytes, samplesMs});
      bitmap.close();
    }
    return output;
  });
  fs.writeFileSync(new URL('./browser-results.json', import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
