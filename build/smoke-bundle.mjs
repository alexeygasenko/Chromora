// Execute the actual distributed userscript in a fresh browser with isolated GM storage.
// Wplace/GM are mocked; no account, real map, remote traffic or pixel submission is involved.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const file = process.argv[2] || 'dist/Chromora.user.js';
const script = await fs.readFile(file, 'utf8');
const cssMap = JSON.parse(await fs.readFile(new URL('../dist/Chromora.user.css.map.json', import.meta.url), 'utf8'));
const idSelector = id => `#${cssMap[id] ?? id}`;
const templateImage = await fs.readFile(new URL('../src/assets/paint-selected.png', import.meta.url));
const browser = await chromium.launch({headless: true, ...(process.platform === 'win32' ? {channel: 'msedge'} : {})});
let checks = 0;
try {
  for (const width of [1280, 375, 320]) {
    const context = await browser.newContext({viewport: {width, height: 900}, reducedMotion: 'reduce', locale: 'ru-RU'});
    const page = await context.newPage();
    const errors = [], remoteRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(5000);
    await context.route('**/*', route => {
      if (route.request().url() === 'https://wplace.live/') return route.fulfill({contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*,::before,::after{box-sizing:border-box}body{margin:0}</style></head><body></body></html>'});
      remoteRequests.push(route.request().url()); return route.abort();
    });
    await page.goto('https://wplace.live/');
    await page.evaluate(() => {
      window.testStorage = new Map([['bmUserSettings', JSON.stringify({windowFilter: {isOpen: false, xi: 'horizontal', Ci: {horizontal: {width: 600, height: 350}}}})]]);
      window.GM_info = {script: {name: 'Chromora', version: '1.3.0'}};
      window.GM_getValue = (key, fallback) => testStorage.get(key) ?? fallback;
      window.GM_deleteValue = key => testStorage.delete(key);
      window.GM_getResourceText = () => '';
      window.GM_addStyle = css => {const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style); return style;};
      window.GM = {setValue: async (key, value) => testStorage.set(key, value), download: async () => {}};
      window.fetch = async input => {
        const url = new URL(input instanceof Request ? input.url : input, location.href);
        if (url.origin === 'https://backend.wplace.live' && /^\/s\d+\/pixel\/\d+\/\d+$/.test(url.pathname)) {
          return new Response(JSON.stringify({color: 1}), {headers: {'Content-Type': 'application/json'}});
        }
        if (url.href !== 'https://backend.wplace.live/me') {return new Response('Not found', {status: 404});}
        return new Response(JSON.stringify({id: 42, level: 5, pixelsPainted: 100, droplets: 60, charges: {count: 10, max: 20, cooldownMs: 30000}}), {headers: {'Content-Type': 'application/json'}});
      };
      // Tampermonkey's lexical window is a wrapper, not MessageEvent.source.
      // Scripts injected into the DOM still execute against the actual window.
      const boundMethods = new Map();
      window.testSandbox = new Proxy(window, {
        get(target, key) {
          if (key === 'window' || key === 'self' || key === 'globalThis') return testSandbox;
          const value = Reflect.get(target, key, target);
          if (typeof value !== 'function' || Object.hasOwn(value, 'prototype')) return value;
          if (!boundMethods.has(value)) boundMethods.set(value, value.bind(target));
          return boundMethods.get(value);
        }
      });
    });
    await page.addScriptTag({content: `((window, globalThis) => {${script}\n})(window.testSandbox, window.testSandbox);`});
    assert.equal(await page.evaluate(() => testSandbox !== document.defaultView), true, 'userscript and page window identities must differ');
    checks++;
    await page.waitForFunction(() => document.querySelector('meta[data-blue-marble-runtime]')?.dataset.runtimeState === 'ready');
    const main = page.getByRole('heading', {name: 'Chromora', exact: true}).locator('xpath=ancestor::div[@id][1]');
    await main.getByText('60', {exact: true}).waitFor({state: 'visible'});
    checks++;
    const fit = async (locator, name) => {
      const rect = await locator.boundingBox().catch(async error => {
        console.error({name, width, errors, body: await page.locator('body').innerText()});
        throw error;
      });
      assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width + 1, `${name} fits ${width}px: ${JSON.stringify(rect)}`);
      checks++;
    };
    await fit(main, 'Main');
    await page.getByRole('button', {name: 'Open settings', exact: true}).click();
    const settings = page.getByRole('heading', {name: 'Settings', exact: true}).locator('xpath=ancestor::div[@id][1]');
    for (const theme of ['Light: Solid light surfaces', 'Dark: Solid dark surfaces', 'Glass: Transparent & blurred', 'Frutiger Aero: Sky, glass & fresh green']) {
      await page.getByRole('radio', {name: theme, exact: true}).click();
      await page.evaluate(() => document.fonts.ready);
      // ResizeObserver applies the viewport correction on the next rendering step.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await fit(settings, theme);
      await fit(main, 'Main after theme change');
    }
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-chromora-theme')), 'aero');
    assert.ok((await settings.evaluate(el => getComputedStyle(el).fontFamily)).includes('PT Sans'));
    await page.evaluate(async () => {await document.fonts.load('600 16px "Exo 2"', 'Настройки'); await document.fonts.load('400 16px "PT Sans"', 'Привет');});
    assert.equal(await page.evaluate(() => document.fonts.check('600 16px "Exo 2"', 'Настройки') && document.fonts.check('400 16px "PT Sans"', 'Привет')), true);
    await page.getByRole('button', {name: 'Preset "Cross Shape"', exact: true}).click();
    await page.waitForFunction(() => JSON.parse(testStorage.get('bmUserSettings')).highlight?.length === 5);
    assert.equal(await page.getByRole('button', {name: 'top center sub-pixel: incorrect', exact: true}).count(), 1);
    await page.getByRole('button', {name: 'Close window "Settings"', exact: true}).click();

    // Test the shipped/minified fetch bridge through the real template-upload UI.
    await page.getByRole('button', {name: 'Open templates', exact: true}).click();
    const fileChooser = page.waitForEvent('filechooser');
    await page.getByRole('button', {name: 'Add template', exact: true}).click();
    await (await fileChooser).setFiles({name: 'smoke-template.png', mimeType: 'image/png', buffer: templateImage});
    const picker = page.getByRole('dialog', {name: 'Template coordinates', exact: true});
    await picker.waitFor({state: 'visible'});
    await fit(picker, 'Template coordinates');
    const pixelResult = await page.evaluate(async () => (await fetch('https://backend.wplace.live/s0/pixel/12/34?x=56&y=78')).json());
    assert.deepEqual(pixelResult, {color: 1}, 'the compiled bridge preserves the host pixel response');
    await page.waitForFunction(() => {
      const inputs = document.querySelectorAll('[role="dialog"] input[type="number"]');
      return inputs.length === 4 && [...inputs].every((input, index) => input.value === ['12', '34', '56', '78'][index]);
    });
    const coordinates = () => picker.getByRole('spinbutton').evaluateAll(inputs => inputs.map(input => input.value));
    assert.deepEqual(await coordinates(), ['12', '34', '56', '78'], 'seasonal pixel requests populate the actual shipped picker');
    await picker.getByRole('spinbutton', {name: 'Pixel X', exact: true}).fill('90');
    await picker.getByRole('button', {name: 'Use last map click', exact: true}).click();
    assert.deepEqual(await coordinates(), ['12', '34', '56', '78'], 'Use last map click restores the cached selection');
    checks += 3;
    await picker.getByRole('button', {name: 'Cancel', exact: true}).click();
    await picker.waitFor({state: 'detached'});
    await page.getByRole('button', {name: 'Close window "Templates"', exact: true}).click();

    if (!await page.getByRole('heading', {name: 'Color Filter', exact: true, includeHidden: true}).count()) {
      await page.getByRole('button', {name: 'Filter', exact: true}).click();
    }
    const filter = page.getByRole('heading', {name: 'Color Filter', exact: true, includeHidden: true}).locator('xpath=ancestor::div[@id][1]');
    await fit(filter, 'Filter');
    await page.evaluate(() => window.postMessage(null, window.location.origin));
    await page.waitForTimeout(30);
    assert.deepEqual(errors, [], 'compiled userscript must not throw during startup and interactions');
    assert.deepEqual(remoteRequests, [], 'fonts and startup must stay offline in the fixture');
    checks += 6;
    await context.close();
  }
  // Start the shipped bundle from persisted state, then restart it from the JSON
  // written by a real close action. Every pass gets a fresh page and runtime.
  let savedWindowSettings = JSON.stringify({
    windowMain: {x: 40, y: 55, collapsed: true},
    windowTemplates: {isOpen: true, collapsed: true, x: 80, y: 300},
    windowSettings: {isOpen: true, collapsed: true, x: 500, y: 150},
    windowFilter: {isOpen: false, mode: 'fullscreen', sortPrimary: 'name', sortSecondary: 'ascending', showUnused: true}
  });
  for (const reloaded of [false, true]) {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errors = [], remoteRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => {
      if (route.request().url() === 'https://wplace.live/') return route.fulfill({contentType: 'text/html', body: '<!doctype html><html><head><style>*,::before,::after{box-sizing:border-box}body{margin:0}</style></head><body></body></html>'});
      remoteRequests.push(route.request().url()); return route.abort();
    });
    await page.goto('https://wplace.live/');
    await page.evaluate(saved => {
      window.testStorage = new Map([['bmUserSettings', saved]]);
      window.GM_info = {script: {name: 'Chromora', version: '1.4.0'}};
      window.GM_getValue = (key, fallback) => testStorage.get(key) ?? fallback;
      window.GM_deleteValue = key => testStorage.delete(key);
      window.GM_getResourceText = () => '';
      window.GM_addStyle = css => {const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style); return style;};
      window.GM = {setValue: async (key, value) => testStorage.set(key, value), download: async () => {}};
      window.fetch = async input => {
        const url = new URL(input instanceof Request ? input.url : input, location.href);
        if (url.href !== 'https://backend.wplace.live/me') return new Response('Not found', {status: 404});
        return new Response(JSON.stringify({id: 42, level: 5, pixelsPainted: 100, droplets: 60, charges: {count: 10, max: 20, cooldownMs: 30000}}), {headers: {'Content-Type': 'application/json'}});
      };
      const boundMethods = new Map();
      window.testSandbox = new Proxy(window, {
        get(target, key) {
          if (key === 'window' || key === 'self' || key === 'globalThis') return testSandbox;
          const value = Reflect.get(target, key, target);
          if (typeof value !== 'function' || Object.hasOwn(value, 'prototype')) return value;
          if (!boundMethods.has(value)) boundMethods.set(value, value.bind(target));
          return boundMethods.get(value);
        }
      });
    }, savedWindowSettings);
    await page.addScriptTag({content: `((window, globalThis) => {${script}\n})(window.testSandbox, window.testSandbox);`});
    await page.waitForFunction(() => document.querySelector('meta[data-blue-marble-runtime]')?.dataset.runtimeState === 'ready');
    for (const [id, x, y] of [
      ['bm-window-main', 40, 55], ['bm-window-templates', 80, 300],
      ...(!reloaded ? [['bm-window-settings', 500, 150]] : [])
    ]) {
      const selector = idSelector(id);
      await page.waitForFunction(({selector, x, y}) => {
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        return element?.querySelector('button[data-button-status]')?.dataset.buttonStatus === 'collapsed'
          && Math.abs(rect.x - x) < 1 && Math.abs(rect.y - y) < 1;
      }, {selector, x, y});
      assert.equal(await page.locator(`${selector} .${cssMap['bm-window-content'] ?? 'bm-window-content'}`).isVisible(), false,
        `${id} restores its collapsed content in the distributed bundle`);
      checks += 2;
    }
    assert.equal(await page.locator(idSelector('bm-window-filter')).count(), 0, 'a saved closed filter stays closed at startup');
    checks++;
    if (!reloaded) {
      await page.getByRole('button', {name: 'Close window "Settings"', exact: true}).click();
      await page.locator(idSelector('bm-window-settings')).waitFor({state: 'detached'});
      await page.waitForFunction(() => JSON.parse(testStorage.get('bmUserSettings')).windowSettings.isOpen === false);
      savedWindowSettings = await page.evaluate(() => testStorage.get('bmUserSettings'));
      checks++;
    } else {
      assert.equal(await page.locator(idSelector('bm-window-settings')).count(), 0, 'closing Settings persists across a fresh runtime');
      await page.getByRole('button', {name: 'Unminimize window "Chromora"', exact: true}).click();
      await page.getByRole('button', {name: 'Filter', exact: true}).click();
      assert.equal(await page.locator(idSelector('bm-filter-sort-primary')).inputValue(), 'name');
      assert.equal(await page.locator(idSelector('bm-filter-sort-secondary')).inputValue(), 'ascending');
      assert.equal(await page.locator(idSelector('bm-filter-show-unused')).isChecked(), true);
      checks += 4;
    }
    assert.deepEqual(errors, [], 'persisted-window startup and reload must not throw in the shipped bundle');
    assert.deepEqual(remoteRequests, [], 'persisted-window fixtures must remain offline');
    checks += 2;
    await context.close();
  }
  console.log(`Distributed userscript smoke: ${checks} checks passed (${file}, ${browser.version()})`);
} finally {await browser.close();}
