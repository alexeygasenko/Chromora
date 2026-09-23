// Real DOM/CSS and ResizeObserver regressions, isolated from Wplace and userscript storage.
// PLAYWRIGHT_MODULE may point to an existing playwright/index.mjs installation.
// Run: node tests/ui-regressions.mjs (requires Playwright and Chromium/Edge).
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const playwrightModule = process.env.PLAYWRIGHT_MODULE || process.env.AUDIT_PLAYWRIGHT_MODULE;
const {chromium} = playwrightModule ? await import(pathToFileURL(playwrightModule)) : await import('playwright');
const bundle = await build({
  stdin: {contents: `export {default as Overlay} from './src/Overlay.js';
    export {default as WindowMain} from './src/WindowMain.js';
    export {default as WindowFilter} from './src/WindowFilter.js';
    export {default as WindowWizard} from './src/WindowWizard.js';
    export {default as WindowTemplateCoordinates} from './src/WindowTemplateCoordinates.js';`, resolveDir: root},
  bundle: true, write: false, format: 'iife', globalName: 'UI', loader: {'.png': 'dataurl'}, logLevel: 'silent'
});
const cssFiles = (await fs.readdir(path.join(root, 'src'))).filter(name => name.endsWith('.css')).sort();
const css = (await Promise.all(cssFiles.map(name => fs.readFile(path.join(root, 'src', name), 'utf8')))).join('\n');
const browser = await chromium.launch({headless: true, ...(process.platform == 'win32' ? {channel: 'msedge'} : {})});
let checks = 0;

async function fixture({width = 1280, height = 900, locale = 'en-US'} = {}) {
  const context = await browser.newContext({viewport: {width, height}, locale, reducedMotion: 'reduce'});
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><button id="trigger">Open</button></body></html>';
  await context.route('**/*', route => route.request().url() == 'http://127.0.0.1:8765/'
    ? route.fulfill({status: 200, contentType: 'text/html', body: html}) : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(4000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:8765/');
  await page.addStyleTag({content: `*,::before,::after{box-sizing:border-box} body{margin:0} ${css}`});
  await page.addScriptTag({content: bundle.outputFiles[0].text});
  await page.evaluate(() => {
    window.storage = new Map();
    window.GM_getValue = (key, fallback) => storage.get(key) ?? fallback;
    window.GM_deleteValue = key => storage.delete(key);
    window.GM = {setValue: async (key, value) => storage.set(key, value)};
    const setIntervalOriginal = window.setInterval;
    const clearIntervalOriginal = window.clearInterval;
    window.liveIntervals = new Set();
    window.setInterval = (...args) => {const id = setIntervalOriginal(...args); liveIntervals.add(id); return id;};
    window.clearInterval = id => {liveIntervals.delete(id); clearIntervalOriginal(id);};
    window.settings = {userSettings: {flags: [], windowFilter: {}}, saveUserStorageNow: async () => {}};
    window.manager = {
      tileSize: 1000, shouldFilterColor: new Map(), templatesArray: [],
      getTemplateStatisticsState: () => 'ready', onTemplatesChanged: () => () => {},
      paletteBM: {palette: [
        {id: 1, name: 'Lower progress', rgb: [0, 255, 0], premium: false},
        {id: 2, name: 'Higher progress', rgb: [255, 0, 0], premium: false}
      ]}
    };
    window.main = new UI.WindowMain('Chromora', 'test');
    main.apiManager = {templateManager: manager};
    main.settingsManager = settings;
  });
  return {page, errors, close: () => context.close()};
}

try {
  for (const width of [320, 375, 1280]) {
    const test = await fixture({width});
    const {page} = test;
    await page.evaluate(() => {main.buildWindow(); main.buildWindowFilter();});
    for (const selector of ['#bm-window-main', '#bm-window-filter']) {
      const rect = await page.locator(selector).boundingBox();
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1, `${selector} must fit ${width}px viewport: ${JSON.stringify(rect)}`);
      const clippedActions = await page.locator(`${selector} .bm-dragbar button, ${selector} .bm-main-actions button`).evaluateAll(buttons => buttons.filter(button => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && (rect.left < 0 || rect.right > innerWidth);
      }).map(button => button.getAttribute('aria-label') || button.textContent));
      assert.deepEqual(clippedActions, [], `all ${selector} header/actions must fit ${width}px`);
      checks++;
    }
    await page.evaluate(() => main.dispose());
    assert.equal(await page.locator('.bm-window').count(), 0);
    assert.equal(await page.evaluate(() => liveIntervals.size), 0, 'dispose must clear main/filter timers');
    assert.deepEqual(test.errors, []);
    checks += 2;
    await test.close();
  }

  {
    const test = await fixture();
    const {page} = test;
    await page.evaluate(() => {
      main.buildWindowFilter();
      const element = document.getElementById('bm-window-filter');
      Object.assign(element.style, {width: '600px', height: '500px', left: '0px', top: '0px', transform: 'translate(220px,140px)'});
    });
    await page.waitForTimeout(220);
    const before = await page.locator('#bm-window-filter').boundingBox();
    const savedBefore = await page.evaluate(() => structuredClone(settings.userSettings.windowFilter));
    await page.evaluate(() => {
      window.picker = new UI.WindowTemplateCoordinates(main, new File([], 'example.png'));
      picker.buildWindow();
    });
    await page.waitForTimeout(220);
    assert.deepEqual(await page.evaluate(() => settings.userSettings.windowFilter), savedBefore, 'hidden ResizeObserver must preserve saved geometry');
    await page.getByRole('button', {name: 'Cancel', exact: true}).click();
    await page.waitForTimeout(220);
    assert.deepEqual(await page.locator('#bm-window-filter').boundingBox(), before, 'returning from coordinates restores the same geometry');
    await page.locator('#bm-window-filter .bm-resize-corner').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    const keyboardResized = await page.locator('#bm-window-filter').boundingBox();
    assert.equal(keyboardResized.width, before.width + 10, 'keyboard resize changes width');
    assert.equal(keyboardResized.height, before.height + 10, 'keyboard resize changes height');
    await page.setViewportSize({width: 320, height: 700});
    await page.waitForTimeout(220);
    const resized = await page.locator('#bm-window-filter').boundingBox();
    assert.ok(resized.x >= 0 && resized.x + resized.width <= 320, 'viewport resize must fit the filter');
    assert.deepEqual(test.errors, []);
    checks += 5;
    await test.close();
  }

  for (const locale of ['en-US', 'ru-RU', 'de-DE', 'tr-TR', 'ar-EG']) {
    const test = await fixture({locale});
    const result = await test.page.evaluate(() => {
      manager.templatesArray = [{pixelCount: {total: 20000, colors: {1: 10000, 2: 10000}, correct: {tile: {1: 1001, 2: 1099}}}, chunked: {tile: {}}}];
      main.buildWindowFilter();
      main.windowFilter.sortPrimary = 'percent';
      main.windowFilter.sortSecondary = 'descending';
      main.windowFilter.updateColorList();
      const cards = [...document.querySelectorAll('#bm-filter-flex > [data-id]')];
      return {ids: cards.map(card => Number(card.dataset.id)), values: cards.map(card => Number(card.dataset.percent)), nestedButtons: document.querySelectorAll('[role="button"] button').length};
    });
    assert.deepEqual(result.ids, [2, 1], `${locale} percentage order`);
    assert.deepEqual(result.values, [0.1099, 0.1001]);
    assert.equal(result.nestedButtons, 0, 'color cards must not nest button roles');
    assert.deepEqual(test.errors, []);
    checks += 3;
    await test.close();
  }

  {
    const test = await fixture();
    const {page} = test;
    await page.locator('#trigger').focus();
    await page.evaluate(() => {
      main.buildWindowTemplates();
      const element = document.getElementById('bm-window-templates');
      Object.assign(element.style, {left: '0px', top: '0px', right: '', transform: 'translate(100px,100px)'});
    });
    const dragbar = await page.locator('#bm-window-templates .bm-dragbar').boundingBox();
    await page.mouse.move(dragbar.x + dragbar.width / 2, dragbar.y + dragbar.height / 2);
    await page.mouse.down();
    await page.mouse.move(-500, -600);
    await page.mouse.up();
    const rect = await page.locator('#bm-window-templates').boundingBox();
    assert.equal(rect.x, 8);
    assert.equal(rect.y, 8);
    await page.locator('#bm-window-templates .bm-dragbar').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal((await page.locator('#bm-window-templates').boundingBox()).x, 18);
    await page.keyboard.press('Home');
    assert.equal((await page.locator('#bm-window-templates').boundingBox()).x, 8);
    await page.getByRole('button', {name: 'Close window "Templates"', exact: true}).click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'trigger', 'closing window returns focus');
    assert.deepEqual(test.errors, []);
    checks += 5;
    await test.close();
  }

  {
    const test = await fixture();
    const result = await test.page.evaluate(async () => {
      const owner = new UI.Overlay('Timer', 'test');
      owner.addDiv({class: 'bm-window'}).addTimer(Date.now() + 10000, 10).buildElement().buildElement();
      await new Promise(resolve => setTimeout(resolve, 30));
      const beforeMount = liveIntervals.size;
      owner.buildOverlay(document.body);
      document.querySelector('.bm-window').remove();
      await new Promise(resolve => setTimeout(resolve, 30));
      return {beforeMount, afterDetach: liveIntervals.size, windows: owner.windowResources.size};
    });
    assert.equal(result.beforeMount, 1, 'timer must survive asynchronous pre-mount work');
    assert.equal(result.afterDetach, 0, 'external DOM removal clears timer');
    assert.equal(result.windows, 0, 'external DOM removal releases global listeners');
    assert.deepEqual(test.errors, []);
    checks += 3;
    await test.close();
  }

  {
    const test = await fixture();
    const {page} = test;
    await page.evaluate(() => {
      storage.set('bmTemplates', JSON.stringify({scriptVersion: 'old', schemaVersion: '1.0.0', templates: {}}));
      manager.templatesJSON = {schemaVersion: '1.0.0', templates: {}};
      manager.templateStatisticsState = 'ready';
      manager.templateStorageSyncActive = true;
      window.syncCalls = {stopped: 0, started: 0};
      manager.stopTemplateStorageSync = () => {syncCalls.stopped++; manager.templateStorageSyncActive = false;};
      manager.startTemplateStorageSync = () => {syncCalls.started++; manager.templateStorageSyncActive = true;};
      manager.downloadAllTemplatesFromStorage = async () => {throw new Error('Download failed');};
      manager.createJSON = async () => {throw new Error('Injected migration failure');};
      window.wizard = new UI.WindowWizard('Chromora', 'test', '2.0.0', manager);
      wizard.buildWindow();
    });
    await page.getByRole('button', {name: 'Download all templates', exact: true}).click();
    assert.equal(await page.getByRole('button', {name: 'Download all templates', exact: true}).isEnabled(), true);
    assert.match(await page.getByRole('alert').textContent(), /Download failed/);
    await page.getByRole('button', {name: 'Update template storage to 2.0.0', exact: true}).click();
    assert.match(await page.getByRole('alert').textContent(), /Injected migration failure/);
    assert.deepEqual(await page.evaluate(() => syncCalls), {stopped: 1, started: 1}, 'migration failure resumes storage synchronization');
    checks++;
    assert.equal(await page.getByRole('button', {name: 'Retry update', exact: true}).isEnabled(), true);
    await page.evaluate(() => {manager.createJSON = async () => ({scriptVersion: 'test', schemaVersion: '2.0.0', templates: {}});});
    await page.getByRole('button', {name: 'Retry update', exact: true}).click();
    await page.getByText('Healthy!', {exact: true}).waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(storage.get('bmTemplates')).schemaVersion), '2.0.0');
    assert.deepEqual(await page.evaluate(() => syncCalls), {stopped: 2, started: 2}, 'successful migration resumes storage synchronization');
    checks++;
    assert.deepEqual(test.errors, []);
    checks += 5;
    await test.close();
  }

  {
    const test = await fixture();
    const {page} = test;
    await page.evaluate(() => {
      window.wizard = new UI.WindowWizard('Chromora', 'test', '2.0.0', manager);
      wizard.buildWindow();
    });
    assert.match(await page.locator('#bm-wizard-status').textContent(), /Dead!/);
    await page.evaluate(() => {
      wizard.dispose();
      storage.set('bmTemplates', JSON.stringify({scriptVersion: 'old', schemaVersion: '1.0.0', templates: {}}));
      manager.templatesJSON = {schemaVersion: '1.0.0', templates: {}};
      manager.templateStatisticsState = 'ready';
      manager.createJSON = async () => ({scriptVersion: 'test', schemaVersion: '2.0.0', templates: {}});
      GM.setValue = async () => {throw new Error('Storage unavailable');};
      wizard = new UI.WindowWizard('Chromora', 'test', '2.0.0', manager);
      wizard.buildWindow();
    });
    await page.getByRole('button', {name: 'Update template storage to 2.0.0', exact: true}).click();
    assert.match(await page.getByRole('alert').textContent(), /Reload before continuing/);
    assert.equal(await page.getByRole('button', {name: 'Retry update', exact: true}).count(), 0);
    assert.equal(await page.evaluate(() => manager.templateStatisticsState), 'error');
    assert.deepEqual(test.errors, []);
    checks += 4;
    await test.close();
  }
  {
    const scenario = await fixture();
    const {page} = scenario;
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'locks', {value: undefined, configurable: true});
      storage.set('bmTemplates', JSON.stringify({scriptVersion: 'old', schemaVersion: '1.0.0', templates: {}}));
      storage.set('bmCoords', 'legacy coordinates');
      window.beforeMigration = storage.get('bmTemplates');
      window.wizard = new UI.WindowWizard('Chromora', 'test', '2.0.0', manager);
      wizard.buildWindow();
    });
    await page.getByRole('button', {name: 'Update template storage to 2.0.0', exact: true}).click();
    assert.match(await page.getByRole('alert').textContent(), /Web Locks/);
    assert.equal(await page.evaluate(() => storage.get('bmTemplates') === beforeMigration), true);
    assert.equal(await page.evaluate(() => storage.get('bmCoords')), 'legacy coordinates');
    assert.deepEqual(scenario.errors, []);
    checks += 3;
    await scenario.close();
  }

  console.log(`UI regressions passed: ${checks} checks in ${browser.version()} (real DOM/CSS, five locales, 320/375/1280px).`);
} finally {
  await browser.close();
}
