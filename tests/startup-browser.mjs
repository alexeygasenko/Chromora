import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';

// Reproduce the host's actual startup ordering: ESM chunks are downloaded first,
// locale initialization completes later, and only then does the map mount.
test('initial template import cannot evaluate or poison preloaded host modules before locale initialization', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const main = await fs.readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const hook = main.slice(main.indexOf("  if (window['__blueMarblePageHookInstalled']"), main.indexOf('\n}, {'));
  const manager = await build({stdin: {contents: "export {default as TemplateManager} from './src/templateManager.js';", resolveDir: root},
    bundle: true, write: false, format: 'iife', globalName: 'StartupFixture', loader: {'.png': 'dataurl'}, logLevel: 'silent'});
  const browser = await chromium.launch({headless: true, ...(process.platform === 'win32' ? {channel: 'msedge'} : {})});
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/') return route.fulfill({contentType: 'text/html', body: `<!doctype html><html><head>
        <link rel="modulepreload" href="/_app/immutable/chunks/catalog.js">
        <link rel="modulepreload" href="/_app/immutable/chunks/runtime.js">
        </head><body></body></html>`});
      if (path.endsWith('/catalog.js')) return route.fulfill({contentType: 'text/javascript', body: `
        window.catalogEvaluations++;
        if (!window.localeInitialized) throw new Error('The message catalog was used before initializeLocale() completed');
        export const ready = true;`});
      if (path.endsWith('/runtime.js')) return route.fulfill({contentType: 'text/javascript', body: `
        import {ready} from './catalog.js';
        export const runtime = {automatedClicks: [], map: {refreshTiles(id) {window.refreshedSources.push(id);}}};
        export const user = {charges: 10, data: {}, refresh() {}};`});
      return route.abort();
    });
    await page.goto('https://wplace.live/');
    await page.waitForFunction(() => performance.getEntriesByType('resource').filter(entry => entry.name.endsWith('/catalog.js') || entry.name.endsWith('/runtime.js')).length === 2);
    await page.evaluate(() => {
      window.localeInitialized = false;
      window.catalogEvaluations = 0;
      window.refreshedSources = [];
      window.bridgeMessages = [];
      window.addEventListener('message', event => bridgeMessages.push(event.data));
    });
    await page.addScriptTag({content: `((paintAreaIcons) => {${hook}})({matching:'', template:''});`});
    await page.addScriptTag({content: manager.outputFiles[0].text});
    await page.evaluate(async () => {
      window.manager = new StartupFixture.TemplateManager('Chromora', '1.3.0');
      // Keep the real import -> render invalidation -> message -> discovery path.
      await manager.importJSON({});
      manager.requestCanvasRefresh();
    });
    await page.waitForFunction(() => bridgeMessages.filter(message => message?.action === 'refresh-tiles').length === 2);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => catalogEvaluations), 0, 'Downloading a chunk must not evaluate it before the host is ready');
    assert.deepEqual(await page.evaluate(() => refreshedSources), []);
    assert.equal(await page.evaluate(() => bridgeMessages.some(message => message?.action === 'refresh-unavailable')), false,
      'Normal host startup must not show an unavailable-map error');

    await page.evaluate(async () => {
      window.localeInitialized = true;
      // This would remain rejected if Chromora had poisoned the ESM cache.
      const catalog = await import('/_app/immutable/chunks/catalog.js');
      if (!catalog.ready) throw new Error('Host catalog did not initialize');
      const canvas = document.createElement('canvas');
      canvas.className = 'maplibregl-canvas';
      document.body.appendChild(canvas);
    });
    await page.waitForFunction(() => refreshedSources.length === 1);
    assert.equal(await page.evaluate(() => catalogEvaluations), 1);
    assert.deepEqual(await page.evaluate(() => refreshedSources), ['pixel-art-layer'], 'Queued startup revisions coalesce to one map refresh');

    await page.evaluate(() => {void manager.requestCanvasRefresh();});
    await page.waitForFunction(() => refreshedSources.length === 2);
    assert.equal(await page.evaluate(() => catalogEvaluations), 1, 'Later refresh reuses the captured host runtime');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
