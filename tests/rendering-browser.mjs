import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {pathToFileURL} from 'node:url';

const modulePath = process.env.RENDER_PLAYWRIGHT_MODULE || process.env.AUDIT_PLAYWRIGHT_MODULE;
let chromium;
try {({chromium} = await import(modulePath ? pathToFileURL(modulePath) : 'playwright'));} catch {}

test('real Canvas sparse round-trip, native readback, compositing, and throughput', {skip: !chromium}, async () => {
  const executablePath = process.env.CHROMORA_BROWSER_PATH || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined);
  const browser = await chromium.launch({headless: true, executablePath});
  try {
    const page = await browser.newPage();
    const sources = ['src/settingsSchema.js', 'src/utils.js', 'src/Template.js', 'src/templateManager.js'].map(path =>
      fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replace(/^export default /gm, '').replace(/^export /gm, '')
    ).join('\n');
    await page.addScriptTag({content: `${sources}\nglobalThis.RenderingTemplate = Template; globalThis.RenderingManager = TemplateManager;`});
    const results = await page.evaluate(async () => {
      console.log = () => {};
      const require = (condition, message) => {if (!condition) {throw new Error(message);}};
      const manager = () => {
        const value = new RenderingManager('test', '1.3.0');
        value.windowMain = {handleDisplayStatus() {}};
        value.settingsManager = {userSettings: {highlight: [[2, 0, 0]], flags: []}};
        value.requestCanvasRefresh = async () => {};
        return value;
      };
      const packedAt = async (blob, x, y) => {
        const bitmap = await createImageBitmap(blob);
        try {
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
          const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
          return new Uint32Array(ctx.getImageData(x, y, 1, 1).data.buffer)[0];
        } finally {bitmap.close();}
      };
      const makeTemplate = async (mgr, width, height, coords = [0, 0, 0, 0], fill = '#fff') => {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d'); ctx.fillStyle = fill; ctx.fillRect(0, 0, width, height);
        const value = new RenderingTemplate({file: await canvas.convertToBlob(), coords});
        const {templateTiles} = await value.createTemplateTiles(mgr.tileSize, mgr.paletteBM, true, false);
        value.chunked = templateTiles; mgr.templatesArray.push(value); return value;
      };
      const output = {userAgent: navigator.userAgent, checks: [], benchmarks: []};
      const sparseManager = manager();
      const source = new OffscreenCanvas(1000, 1000);
      const sourceContext = source.getContext('2d');
      const points = [[0, 0], [100, 100], [500, 500], [999, 999]];
      for (const [x, y] of points) {
        sourceContext.clearRect(0, 0, 1000, 1000);
        sourceContext.fillStyle = '#fff'; sourceContext.fillRect(x, y, 1, 1);
        const sparse = new RenderingTemplate({file: await source.convertToBlob(), coords: [0, 0, 0, 0]});
        const {templateTiles} = await sparse.createTemplateTiles(1000, sparseManager.paletteBM, true, false);
        sparse.chunked = templateTiles;
        require(Object.keys(templateTiles).length === 1, `Sparse pixel (${x},${y}) lost`);
        require(sparse.chunked32['0000,0000,000,000'][(y * 3 + 1) * 3000 + x * 3 + 1] === 0xffffffff, 'Sparse pixel changed');
        sparse.dispose();
      }
      output.checks.push('four sparse source positions survive PNG creation');
      // L-shaped legacy chunks with a skipped upper-left tile, plus intra-tile offsets.
      const chunk = new OffscreenCanvas(3, 3);
      const chunkContext = chunk.getContext('2d'); chunkContext.fillStyle = '#fff'; chunkContext.fillRect(1, 1, 1, 1);
      const legacyBytes = new Uint8Array(await (await chunk.convertToBlob()).arrayBuffer());
      let binary = ''; for (const byte of legacyBytes) {binary += String.fromCharCode(byte);}
      const encoded = btoa(binary);
      const legacy = new RenderingTemplate({chunked: {'0011,0010,005,020': encoded, '0010,0011,030,010': encoded}});
      const reconstructed = await sparseManager.convertTemplateToImage(legacy);
      require(JSON.stringify(reconstructed.coords) === '[10,10,30,20]', 'Sparse migration origin mismatch');
      require(await packedAt(reconstructed.blob, 975, 0) === 0xffffffff, 'Upper sparse pixel shifted');
      require(await packedAt(reconstructed.blob, 0, 990) === 0xffffffff, 'Lower sparse pixel shifted');
      require(await packedAt(reconstructed.blob, 0, 0) === 0, 'Sparse transparency changed');
      const migrated = new RenderingTemplate({file: reconstructed.blob, coords: reconstructed.coords});
      const {templateTiles: migratedTiles} = await migrated.createTemplateTiles(1000, sparseManager.paletteBM, true, false);
      migrated.chunked = migratedTiles;
      const worldPixels = [];
      for (const [key, bitmap] of Object.entries(migrated.chunked)) {
        const [tileX, tileY, px, py] = key.split(',').map(Number);
        const data = migrated.chunked32[key];
        for (let row = 1; row < bitmap.height; row += 3) for (let column = 1; column < bitmap.width; column += 3) {
          if (data[row * bitmap.width + column] >>> 24) {worldPixels.push([tileX * 1000 + px + (column - 1) / 3, tileY * 1000 + py + (row - 1) / 3]);}
        }
      }
      require(JSON.stringify(worldPixels.sort()) === JSON.stringify([[11005, 10020], [10030, 11010]].sort()), 'World pixels changed during complete migration');
      migrated.dispose(); output.checks.push('sparse legacy reconstruction/recreation preserves every world pixel');

      // Compare complete output bytes with independently composed nearest-neighbor reference.
      const composition = manager(); composition.tileSize = 4;
      const lower = await makeTemplate(composition, 2, 2, [0, 0, 1, 1], '#ff0000'); lower.sortID = 1;
      const upper = await makeTemplate(composition, 1, 1, [0, 0, 2, 2], '#00ff00'); upper.sortID = 2;
      composition.templatesArray.reverse();
      const board = new OffscreenCanvas(4, 4); const boardContext = board.getContext('2d');
      boardContext.fillStyle = '#fff'; boardContext.fillRect(0, 0, 4, 4);
      const boardBlob = await board.convertToBlob();
      const rendered = await composition.drawTemplateOnTile(boardBlob, [0, 0]);
      const expected = new OffscreenCanvas(12, 12); const expectedContext = expected.getContext('2d');
      expectedContext.imageSmoothingEnabled = false; expectedContext.drawImage(board, 0, 0, 12, 12);
      expectedContext.drawImage(lower.chunked['0000,0000,001,001'], 3, 3);
      expectedContext.drawImage(upper.chunked['0000,0000,002,002'], 6, 6);
      const actualBitmap = await createImageBitmap(rendered);
      const actual = new OffscreenCanvas(12, 12); const actualContext = actual.getContext('2d'); actualContext.drawImage(actualBitmap, 0, 0);
      const actualBytes = actualContext.getImageData(0, 0, 12, 12).data;
      const expectedBytes = expectedContext.getImageData(0, 0, 12, 12).data;
      require(actualBytes.every((value, index) => value === expectedBytes[index]), 'Compositing differs from reference');
      actualBitmap.close(); lower.dispose(); upper.dispose();
      output.checks.push('overlapping colored output is pixel-identical to independent reference');

      const originalReadback = OffscreenCanvasRenderingContext2D.prototype.getImageData;
      let readbackBytes = 0;
      OffscreenCanvasRenderingContext2D.prototype.getImageData = function(x, y, width, height, ...rest) {
        readbackBytes += width * height * 4;
        return originalReadback.call(this, x, y, width, height, ...rest);
      };
      try {
        const fullBoard = new OffscreenCanvas(1000, 1000); const ctx = fullBoard.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1000, 1000);
        const blob = await fullBoard.convertToBlob();
        for (const side of [1, 1000]) {
          const mgr = manager(); const value = await makeTemplate(mgr, side, side);
          const samplesMs = []; let pngBytes;
          for (let run = 0; run < 4; run++) {
            readbackBytes = 0; const start = performance.now();
            const outputBlob = await mgr.drawTemplateOnTile(blob, [0, 0]);
            samplesMs.push(Number((performance.now() - start).toFixed(2))); pngBytes = outputBlob.size;
            require(readbackBytes === side * side * 4, 'Unexpected board readback allocation');
          }
          output.benchmarks.push({side, readbackBytes, samplesMs, pngBytes});
          value.dispose();
        }
      } finally {OffscreenCanvasRenderingContext2D.prototype.getImageData = originalReadback;}
      output.checks.push('native-scale readbacks are exactly 4 B and 4 MB');
      return output;
    });
    assert.equal(results.checks.length, 4);
    console.log(JSON.stringify(results, null, 2));
    if (process.env.RENDER_EVIDENCE_PATH) {fs.writeFileSync(process.env.RENDER_EVIDENCE_PATH, JSON.stringify(results, null, 2) + '\n');}
  } finally {await browser.close();}
});
