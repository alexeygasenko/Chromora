// Real layout, input events, storage snapshots, and fresh-page restoration.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const modulePath = process.env.PLAYWRIGHT_MODULE || process.env.AUDIT_PLAYWRIGHT_MODULE;
const {chromium} = modulePath ? await import(pathToFileURL(modulePath)) : await import('playwright');
const bundle = await build({stdin: {contents: `
  export {default as SettingsManager} from './src/settingsManager.js';
  export {default as WindowMain} from './src/WindowMain.js';
  export {default as WindowTemplateCoordinates} from './src/WindowTemplateCoordinates.js';`, resolveDir: root},
  bundle: true, write: false, format: 'iife', globalName: 'UI', loader: {'.png': 'dataurl'}, logLevel: 'silent'});
const css = (await Promise.all((await fs.readdir(path.join(root, 'src'))).filter(name => name.endsWith('.css')).sort()
  .map(name => fs.readFile(path.join(root, 'src', name), 'utf8')))).join('\n');
const browser = await chromium.launch({headless: true, ...(process.platform === 'win32' ? {channel: 'msedge'} : {})});
let scenarios = 0;

async function fixture(reducedMotion, {height = 1300, seed = {}} = {}) {
  const context = await browser.newContext({viewport: {width: 1600, height}, reducedMotion});
  await context.route('**/*', route => route.request().url() === 'http://127.0.0.1:8767/'
    ? route.fulfill({contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>'}) : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function settle() {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => !document.querySelector('.bm-window-motion') && !main.windowFilter?.windowSaveTimeout);
    await page.evaluate(() => settings.saveUserStorageNow());
  }
  async function snapshot() {
    await settle();
    return await page.evaluate(() => storage.get('bmUserSettings'));
  }
  async function boot(savedJSON) {
    await page.addStyleTag({content: `*,::before,::after{box-sizing:border-box}body{margin:0} ${css}`});
    await page.addScriptTag({content: bundle.outputFiles[0].text});
    await page.evaluate(saved => {
      window.storage = new Map([['bmUserSettings', saved]]);
      window.GM_getValue = (key, fallback) => storage.get(key) ?? fallback;
      window.GM = {setValue: async (key, value) => {await Promise.resolve(); storage.set(key, value);}};
      window.settings = new UI.SettingsManager('Chromora', 'test', JSON.parse(GM_getValue('bmUserSettings', '{}')));
      window.manager = {
        tileSize: 1000, templatesArray: [], shouldFilterColor: new Map(),
        getTemplateStatisticsState: () => 'ready', onTemplatesChanged: () => () => {},
        paletteBM: {palette: [{id: 1, name: 'Red', rgb: [255, 0, 0], premium: false}]}
      };
      window.main = new UI.WindowMain('Chromora', 'test');
      main.setSettingsManager(settings);
      main.setApiManager({templateManager: manager});
      main.buildWindow();
      main.buildWindowTemplates({respectSavedVisibility: true});
      settings.buildWindow({respectSavedVisibility: true});
      if (typeof settings.userSettings.windowFilter.isOpen === 'boolean') {main.buildWindowFilter({respectSavedVisibility: true});}
    }, savedJSON);
    await settle();
  }
  await page.goto('http://127.0.0.1:8767/');
  await boot(JSON.stringify(seed));
  return {page, errors, settle, snapshot,
    async reload(savedJSON) {savedJSON ??= await snapshot(); await page.reload(); await boot(savedJSON);},
    async close() {assert.deepEqual(errors, [], 'window actions must not produce browser errors'); await context.close();}};
}

function assertPosition(actual, expected, label) {
  assert.ok(Math.abs(actual.x - expected.x) < 1 && Math.abs(actual.y - expected.y) < 1,
    `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
async function keyboardMove(page, selector, steps) {
  await page.locator(`${selector} .bm-dragbar`).focus();
  await page.keyboard.press('Home');
  for (let index = 0; index < steps; index++) {await page.keyboard.press('Shift+ArrowRight');}
  await page.keyboard.press('Shift+ArrowDown');
}
async function pointerMove(page, selector, dx, dy) {
  const title = await page.locator(`${selector} .bm-dragbar h1`).boundingBox();
  const x = title.x + title.width / 2, y = title.y + title.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, {steps: 5});
  await page.mouse.up();
}
async function minimize(page, selector) {
  await page.locator(`${selector} .bm-dragbar button[data-button-status]`).click();
}

try {
  for (const reducedMotion of ['reduce', 'no-preference']) {
    {
      const test = await fixture(reducedMotion);
      const {page} = test;
      assert.equal(await page.locator('#bm-window-settings, #bm-window-templates').count(), 0,
        'missing visibility settings must not open optional windows');
      const positions = {};
      for (const [name, stateKey, steps] of [['main', 'windowMain', 1], ['templates', 'windowTemplates', 10], ['settings', 'windowSettings', 18]]) {
        if (name === 'templates') {await page.evaluate(() => main.buildWindowTemplates());}
        if (name === 'settings') {await page.evaluate(() => settings.buildWindow());}
        const selector = `#bm-window-${name}`;
        await test.settle();
        await keyboardMove(page, selector, steps);
        const beforePointer = await page.locator(selector).boundingBox();
        assertPosition(beforePointer, {x: 8 + steps * 50, y: 58}, `${name} keyboard movement`);
        assertPosition(JSON.parse(await test.snapshot())[stateKey], beforePointer, `${name} keyboard-only save`);
        await pointerMove(page, selector, 17, 23);
        await test.settle();
        positions[stateKey] = await page.locator(selector).boundingBox();
        assertPosition(positions[stateKey], {x: beforePointer.x + 17, y: beforePointer.y + 23}, `${name} pointer drag`);
        const saved = JSON.parse(await test.snapshot());
        assertPosition(saved[stateKey], positions[stateKey], `${name} saved coordinates`);
        await minimize(page, selector);
        await test.settle();
        assert.equal(JSON.parse(await test.snapshot())[stateKey].collapsed, true);
      }
      const saved = await test.snapshot();
      await page.evaluate(() => {window.picker = new UI.WindowTemplateCoordinates(main, new File([], 'template.png')); picker.buildWindow();});
      await test.settle();
      for (const stateKey of ['windowMain', 'windowTemplates', 'windowSettings']) {
        assert.deepEqual(JSON.parse(await test.snapshot())[stateKey], JSON.parse(saved)[stateKey], `${stateKey} survives coordinate mode`);
      }
      await page.getByRole('button', {name: 'Cancel', exact: true}).click();
      await test.settle();
      await page.evaluate(() => {main.dispose(); settings.dispose();});
      assert.equal(await page.evaluate(() => settings.userSettings.windowTemplates.isOpen), true);
      assert.equal(await page.evaluate(() => settings.userSettings.windowSettings.isOpen), true);
      assert.equal(JSON.parse(await page.evaluate(() => storage.get('bmUserSettings'))).windowTemplates.isOpen, true);
      assert.equal(JSON.parse(await page.evaluate(() => storage.get('bmUserSettings'))).windowSettings.isOpen, true);
      await test.reload(saved);
      for (const [name, stateKey] of [['main', 'windowMain'], ['templates', 'windowTemplates'], ['settings', 'windowSettings']]) {
        const selector = `#bm-window-${name}`;
        assert.equal(await page.locator(`${selector} .bm-dragbar button[data-button-status]`).getAttribute('data-button-status'), 'collapsed');
        assertPosition(await page.locator(selector).boundingBox(), positions[stateKey], `${name} fresh page`);
      }
      await page.getByRole('button', {name: 'Close window "Settings"', exact: true}).click();
      await page.getByRole('button', {name: 'Close window "Templates"', exact: true}).click();
      await test.settle();
      const closed = JSON.parse(await test.snapshot());
      assert.equal(closed.windowSettings.isOpen, false);
      assert.equal(closed.windowTemplates.isOpen, false);
      await test.reload();
      assert.equal(await page.locator('#bm-window-settings, #bm-window-templates').count(), 0,
        'explicitly closed optional windows must remain closed after reload');
      await test.close();
      scenarios++;
    }

    {
      const test = await fixture(reducedMotion, {seed: {windowFilter: {isOpen: true, mode: 'windowed', x: 500, y: 160, width: 520, height: 560}}});
      const {page} = test;
      const selector = '#bm-window-filter';
      const expanded = await page.locator(selector).boundingBox();
      assert.equal(await page.locator('#bm-filter-windowed-color-totals-dragbar').evaluate(element => element.style.display), '');
      await minimize(page, selector);
      await test.settle();
      assert.equal(await page.locator('#bm-filter-windowed-color-totals-dragbar').evaluate(element => element.style.display), 'none');
      await pointerMove(page, selector, 35, 40);
      await test.settle();
      const collapsed = await page.locator(selector).boundingBox();
      const saved = JSON.parse(await test.snapshot()).windowFilter;
      assertPosition(saved, collapsed, 'collapsed filter drag');
      assert.equal(saved.width, Math.round(expanded.width));
      assert.equal(saved.height, Math.round(expanded.height));
      const collapsedJSON = await test.snapshot();
      await page.evaluate(() => main.dispose());
      assert.equal(await page.evaluate(() => settings.userSettings.windowFilter.isOpen), true);
      await test.reload(collapsedJSON);
      assertPosition(await page.locator(selector).boundingBox(), collapsed, 'collapsed filter reload');
      assert.equal(await page.locator(`${selector} .bm-dragbar button[data-button-status]`).getAttribute('data-button-status'), 'collapsed');
      assert.equal(await page.locator('#bm-filter-windowed-color-totals-dragbar').evaluate(element => element.style.display), 'none',
        'restored collapse must hide the same filter totals as manual collapse');
      await minimize(page, selector);
      await test.settle();
      const restored = await page.locator(selector).boundingBox();
      assert.equal(await page.locator('#bm-filter-windowed-color-totals-dragbar').evaluate(element => element.style.display), '');
      assert.equal(restored.width, expanded.width);
      assert.equal(restored.height, expanded.height);
      const beforePicker = JSON.parse(await test.snapshot()).windowFilter;
      await page.evaluate(() => {window.picker = new UI.WindowTemplateCoordinates(main, new File([], 'template.png')); picker.buildWindow();});
      await test.settle();
      assert.deepEqual(JSON.parse(await test.snapshot()).windowFilter, beforePicker, 'hidden coordinate mode must not zero geometry');
      await page.getByRole('button', {name: 'Cancel', exact: true}).click();
      await test.settle();
      assertPosition(await page.locator(selector).boundingBox(), restored, 'filter after coordinate picker');
      await page.getByRole('button', {name: 'Close window "Color Filter"', exact: true}).click();
      await test.settle();
      assert.equal(JSON.parse(await test.snapshot()).windowFilter.isOpen, false);
      await test.reload();
      assert.equal(await page.locator(selector).count(), 0, 'an explicitly closed filter remains closed');
      await test.close();
      scenarios++;
    }

    for (const [name, stateKey] of [['main', 'windowMain'], ['templates', 'windowTemplates'], ['settings', 'windowSettings'], ['filter', 'windowFilter']]) {
      const test = await fixture(reducedMotion, {height: 900, seed: {
        [stateKey]: {isOpen: true, collapsed: true, x: 600, y: 820, mode: 'windowed', width: 520, height: 560}
      }});
      const {page} = test;
      const selector = `#bm-window-${name}`;
      const collapsed = await page.locator(selector).boundingBox();
      assertPosition(collapsed, {x: 600, y: 820}, `${name} restored using collapsed height`);
      await minimize(page, selector);
      await test.settle();
      const expanded = await page.locator(selector).boundingBox();
      assert.ok(expanded.y >= 8 && expanded.y + expanded.height <= 893,
        `${name} expands inside viewport: ${JSON.stringify(expanded)}`);
      assert.equal(JSON.parse(await test.snapshot())[stateKey].collapsed, false);
      await test.close();
      scenarios++;
    }
  }
  console.log(`Window persistence browser regression: ${scenarios} scenarios passed`);
} finally {await browser.close();}
