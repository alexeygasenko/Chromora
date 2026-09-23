// Local, isolated browser diagnostic. Never connects to Wplace or a user profile.
// Usage: node audit/2026-09-23/browser-smoke.mjs <temporary-build-directory>
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
const root = process.cwd();
const runtime = process.argv[2];
if (!runtime) throw new Error('Pass the clean temporary build directory containing playwright.');
const {chromium} = await import(pathToFileURL(path.join(runtime, 'node_modules/playwright/index.mjs')));
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*,::before,::after{box-sizing:border-box}</style></head><body style="margin:0"></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({channel: 'msedge', headless: true});
const results = {browser: browser.version(), scope: 'Local fixture; real browser DOM/CSS; mocked GM and /me; no Wplace runtime', runs: []};
try {
  for (const [flavor, file] of [
    ['working-dist', path.join(root, 'dist/Chromora.user.js')],
    ['clean-local', path.join(runtime, 'dist/Chromora.local.user.js')],
    ['clean-ci', path.join(runtime, 'dist/Chromora.user.js')],
  ]) {
    const script = await fs.readFile(file, 'utf8');
    for (const width of [1280, 375, 320]) {
      const context = await browser.newContext({viewport: {width, height: 900}, reducedMotion: 'reduce', locale: 'ru-RU'});
      await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
      const page = await context.newPage();
      page.setDefaultTimeout(4000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {if (message.type() === 'error') errors.push(message.text().slice(0, 1500));});
      await page.goto(origin);
      await page.evaluate(() => {
        const storage = new Map();
        globalThis.auditStorage = storage;
        globalThis.GM_info = {script: {name: 'Chromora', version: '1.3.0'}};
        globalThis.GM_getValue = (key, fallback) => storage.get(key) ?? fallback;
        globalThis.GM_deleteValue = key => storage.delete(key);
        globalThis.GM_getResourceText = () => '';
        globalThis.GM_addStyle = css => {
          const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style); return style;
        };
        globalThis.GM = {setValue: async (key, value) => storage.set(key, value), download: async () => {}};
        globalThis.fetch = async () => new Response(JSON.stringify({id: 42, level: 5, pixelsPainted: 100, droplets: 60, charges: {count: 10, max: 20, cooldownMs: 30000}}), {headers: {'Content-Type': 'application/json'}});
      });
      const run = {flavor, width, errors};
      results.runs.push(run);
      try {
        await page.addScriptTag({content: script});
        await page.waitForFunction(() => document.querySelector('meta[data-blue-marble-runtime]')?.dataset.runtimeState === 'ready', null, {timeout: 5000});
        const main = page.getByRole('heading', {name: 'Chromora', exact: true}).locator('xpath=ancestor::div[@id][1]');
        run.mainRect = await main.boundingBox();
        run.mainClipped = run.mainRect.x < 0 || run.mainRect.x + run.mainRect.width > width;
        if (width === 1280) {
          await page.getByRole('button', {name: 'Open templates', exact: true}).click();
          run.templatesOpened = await page.getByRole('button', {name: 'Add template', exact: true}).count() > 0;
          await page.getByRole('button', {name: 'Open settings', exact: true}).click();
          run.settingsOpened = await page.getByText('Glass', {exact: true}).count() > 0;
        }
        // Programmatic activation isolates layout from any unrelated overlapping fixture windows.
        run.filterInitiallyPresent = await page.getByRole('heading', {name: 'Color Filter', exact: true}).count() > 0;
        if (!run.filterInitiallyPresent) await page.getByRole('button', {name: 'Filter', exact: true}).evaluate(button => button.click());
        run.filterRect = await page.getByRole('heading', {name: 'Color Filter', exact: true}).locator('xpath=ancestor::div[@id][1]').boundingBox();
        run.filterClipped = run.filterRect.x < 0 || run.filterRect.x + run.filterRect.width > width;
        if (flavor === 'clean-ci' && width === 1280) {
          const filter = page.getByRole('heading', {name: 'Color Filter', exact: true}).locator('xpath=ancestor::div[@id][1]');
          await filter.evaluate(element => {element.style.width = '600px'; element.style.height = '500px'; element.style.transform = 'translate(220px, 140px)';});
          await page.waitForTimeout(350);
          run.beforeCoordinateMode = await filter.boundingBox();
          const mapping = JSON.parse(await fs.readFile(path.join(runtime, 'dist/Chromora.user.css.map.json'), 'utf8'));
          const coordinateClass = mapping['bm-template-coordinate-mode'] ?? 'bm-template-coordinate-mode';
          await page.evaluate(className => document.body.classList.add(className), coordinateClass);
          await page.waitForTimeout(350);
          await page.evaluate(className => document.body.classList.remove(className), coordinateClass);
          await page.waitForTimeout(350);
          run.afterCoordinateMode = await filter.boundingBox();
          run.persistedSettings = await page.evaluate(() => Object.fromEntries(auditStorage));
        }
        run.runtimeReady = true;
      } catch (error) {run.diagnosticError = error.message; run.bodyText = await page.locator('body').innerText(); run.meta = await page.locator('meta[data-blue-marble-runtime]').evaluateAll(elements => elements.map(element => element.outerHTML));}
      console.log(JSON.stringify(run));
      await fs.writeFile(path.join(root, 'audit/2026-09-23/evidence/browser-smoke.json'), JSON.stringify(results, null, 2) + '\n');
      await context.close();
    }
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
await fs.writeFile(path.join(root, 'audit/2026-09-23/evidence/browser-smoke.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
