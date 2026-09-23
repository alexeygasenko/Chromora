import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';

// Exercise the page fetch hook, postMessage bridge, API cache and actual picker
// together. Tampermonkey supplies a window wrapper to the userscript, while
// injected page code and MessageEvent.source retain the document's real window.
test('seasonal pixel requests populate the picker, retain the last click after reopening, and reject stale responses', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const main = await fs.readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const hook = main.slice(main.indexOf("  if (window['__blueMarblePageHookInstalled']"), main.indexOf('\n}, {'));
  const bundle = await build({
    stdin: {contents: `export {default as ApiManager} from './src/apiManager.js';
      export {default as WindowTemplateCoordinates} from './src/WindowTemplateCoordinates.js';`, resolveDir: root},
    bundle: true, write: false, format: 'iife', globalName: 'CoordinateFixture',
    loader: {'.png': 'dataurl'}, logLevel: 'silent'
  });
  const cssNames = (await fs.readdir(new URL('../src/', import.meta.url))).filter(name => name.endsWith('.css')).sort();
  const css = (await Promise.all(cssNames.map(name => fs.readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')))).join('\n');
  const browser = await chromium.launch({headless: true, ...(process.platform === 'win32' ? {channel: 'msedge'} : {})});
  try {
    const page = await browser.newPage({reducedMotion: 'reduce'});
    page.setDefaultTimeout(5000);
    const errors = [];
    const requests = [];
    let releaseOldResponse;
    let markOldRequestStarted;
    const oldResponseGate = new Promise(resolve => {releaseOldResponse = resolve;});
    const oldRequestStarted = new Promise(resolve => {markOldRequestStarted = resolve;});
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.href === 'https://wplace.live/') return route.fulfill({contentType: 'text/html', body: '<!doctype html><html><body></body></html>'});
      if (url.hostname === 'backend.wplace.live' && /^\/s\d+\/pixel\/\d+\/\d+$/.test(url.pathname)) {
        requests.push(url.href);
        if (url.pathname === '/s0/pixel/40/50') {
          markOldRequestStarted();
          await oldResponseGate;
        }
        return route.fulfill({contentType: 'application/json', body: JSON.stringify({color: 1}),
          headers: {'Access-Control-Allow-Origin': 'https://wplace.live'}});
      }
      return route.abort();
    });
    await page.goto('https://wplace.live/');
    await page.addStyleTag({content: `*,::before,::after{box-sizing:border-box} ${css}`});
    await page.addScriptTag({content: `((paintAreaIcons) => {${hook}})({matching:'', template:''});`});
    await page.evaluate(() => {
      const pageWindow = window;
      const boundMethods = new Map();
      window.coordinateSandbox = new Proxy(pageWindow, {
        get(target, key) {
          if (key === 'window' || key === 'self' || key === 'globalThis') return coordinateSandbox;
          const value = Reflect.get(target, key, target);
          if (typeof value !== 'function' || Object.hasOwn(value, 'prototype')) return value;
          if (!boundMethods.has(value)) boundMethods.set(value, value.bind(target));
          return boundMethods.get(value);
        }
      });
    });
    await page.addScriptTag({content: `((window) => {${bundle.outputFiles[0].text}\n document.defaultView.CoordinateFixture = CoordinateFixture;})(window.coordinateSandbox);`});
    assert.equal(await page.evaluate(() => coordinateSandbox !== document.defaultView), true, 'the consumer must run with a distinct sandbox window');
    await page.evaluate(() => {
      window.api = new CoordinateFixture.ApiManager({tileSize: 1000});
      window.executor = {name: 'Chromora', version: 'test', apiManager: api};
      window.reportedErrors = [];
      api.spontaneousResponseListener({handleDisplayError: message => reportedErrors.push(message)});
      window.pixelMessages = [];
      window.addEventListener('message', event => {
        if (event.data?.source === 'blue-marble' && event.data?.endpoint?.includes('/pixel/')) pixelMessages.push(event.data.endpoint);
      });
      window.openPicker = () => {
        window.picker = new CoordinateFixture.WindowTemplateCoordinates(executor, new File([], 'test.png'));
        picker.buildWindow();
      };
      openPicker();
    });
    const fieldValues = () => page.locator('#bm-window-template-coordinates input').evaluateAll(inputs => inputs.map(input => input.value));
    await page.getByRole('button', {name: 'Use last map click', exact: true}).click();
    assert.match(await page.locator('#bm-template-coordinate-status').innerText(), /Click the desired top-left pixel/);
    assert.deepEqual(await fieldValues(), ['', '', '', '']);

    await page.evaluate(async () => {
      const response = await fetch('https://backend.wplace.live/s0/pixel/12/34?x=56&y=78');
      window.pixelResult = await response.json();
    });
    await page.waitForFunction(() => document.querySelector('#bm-template-coordinate-py')?.value === '78');
    assert.deepEqual(await fieldValues(), ['12', '34', '56', '78']);
    assert.deepEqual(await page.evaluate(() => pixelResult), {color: 1}, 'Observing coordinates must preserve the host response');
    assert.match(await page.locator('#bm-template-coordinate-status').innerText(), /Map pixel selected/);

    await page.evaluate(() => {
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      const data = {source: 'blue-marble', endpoint: 'https://backend.wplace.live/s0/pixel/90/91?x=92&y=93',
        requestSequence: 100000, jsonData: {color: 1}};
      for (const source of [iframe.contentWindow, null]) {
        window.dispatchEvent(new MessageEvent('message', {data, source, origin: location.origin}));
      }
      window.dispatchEvent(new MessageEvent('message', {data, source: window, origin: 'https://foreign.example'}));
      iframe.remove();
    });
    assert.deepEqual(await fieldValues(), ['12', '34', '56', '78'], 'foreign origin, same-origin iframe and null-source messages cannot change coordinates');
    assert.deepEqual(await page.evaluate(() => Array.from(api.coordsTilePixel)), [12, 34, 56, 78], 'rejected senders cannot poison the last-click cache');

    await page.getByRole('spinbutton', {name: 'Pixel X', exact: true}).fill('90');
    await page.getByRole('button', {name: 'Use last map click', exact: true}).click();
    assert.deepEqual(await fieldValues(), ['12', '34', '56', '78']);
    assert.match(await page.locator('#bm-template-coordinate-status').innerText(), /Latest map pixel loaded/);

    await page.getByRole('button', {name: 'Cancel', exact: true}).click();
    await page.locator('#bm-window-template-coordinates').waitFor({state: 'detached'});
    assert.equal(await page.evaluate(() => api.coordinateChangeListeners.size), 0);
    await page.evaluate(() => openPicker());
    await page.getByRole('button', {name: 'Use last map click', exact: true}).click();
    assert.deepEqual(await fieldValues(), ['12', '34', '56', '78'], 'Reopening must retain the last observed map pixel');

    await page.evaluate(async () => {
      await fetch('https://backend.wplace.live/s12/pixel/0/2047?x=0&y=999');
    });
    await page.waitForFunction(() => document.querySelector('#bm-template-coordinate-py')?.value === '999');
    assert.deepEqual(await fieldValues(), ['0', '2047', '0', '999'], 'Season numbers and zero/boundary coordinates are supported');

    await page.evaluate(() => {
      void fetch('https://backend.wplace.live/s0/pixel/40/50?x=1&y=2');
    });
    await oldRequestStarted;
    await page.evaluate(async () => {await fetch('https://backend.wplace.live/s0/pixel/41/51?x=3&y=4');});
    await page.waitForFunction(() => document.querySelector('#bm-template-coordinate-py')?.value === '4');
    assert.deepEqual(await fieldValues(), ['41', '51', '3', '4']);
    releaseOldResponse();
    await page.waitForFunction(() => pixelMessages.some(endpoint => endpoint.includes('/pixel/40/50?')));
    assert.deepEqual(await fieldValues(), ['41', '51', '3', '4'], 'A slower earlier response must not replace the most recent click');
    await page.getByRole('button', {name: 'Use last map click', exact: true}).click();
    assert.deepEqual(await fieldValues(), ['41', '51', '3', '4'], 'The last-click cache must also ignore reordered responses');
    assert.equal(requests.length, 4);
    assert.deepEqual(await page.evaluate(() => reportedErrors), []);
    assert.deepEqual(errors, []);
    await page.evaluate(() => {picker.dispose(); api.stopSpontaneousResponseListener();});
    assert.equal(await page.evaluate(() => api.coordinateChangeListeners.size), 0);
  } finally {
    await browser.close();
  }
});
