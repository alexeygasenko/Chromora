// Real-browser settings interactions and offline theme/font verification.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const root = fileURLToPath(new URL('../', import.meta.url));
const modulePath = process.env.PLAYWRIGHT_MODULE;
const {chromium} = modulePath ? await import(pathToFileURL(modulePath)) : await import('playwright');
const bundle = await build({stdin: {contents: `export {default as SettingsManager} from './src/settingsManager.js';
  export {default as WindowMain} from './src/WindowMain.js';`, resolveDir: root},
  bundle: true, write: false, format: 'iife', globalName: 'UI', loader: {'.png': 'dataurl'}, logLevel: 'silent'});
const css = (await Promise.all((await fs.readdir(path.join(root, 'src'))).filter(file => file.endsWith('.css')).sort()
  .map(file => fs.readFile(path.join(root, 'src', file), 'utf8')))).join('\n');
let fonts = '';
for (const directory of ['aero', 'interface']) {
  const fontRoot = path.join(root, 'build/assets', directory);
  for (const face of JSON.parse(await fs.readFile(path.join(fontRoot, 'manifest.json'), 'utf8'))) {
    const data = await fs.readFile(path.join(fontRoot, face.file));
    fonts += `@font-face{font-family:'${face.family}';font-style:normal;font-weight:${face.weight};font-display:swap;src:url(data:font/woff2;base64,${data.toString('base64')}) format('woff2');unicode-range:${face.unicodeRange}}`;
  }
}
const browser = await chromium.launch({headless: true, ...(process.platform === 'win32' ? {channel: 'msedge'} : {})});
let checks = 0;
try {
  for (const width of [1280, 375, 320]) {
    const context = await browser.newContext({viewport: {width, height: 980}, reducedMotion: 'reduce'});
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errors = [], remoteRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (route.request().url() === 'http://127.0.0.1:8766/') return route.fulfill({contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>'});
      remoteRequests.push(route.request().url()); return route.abort();
    });
    await page.goto('http://127.0.0.1:8766/');
    await page.addStyleTag({content: `*,::before,::after{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(155deg,#d4eddf,#ecf3dc 45%,#d1e7ea);font-family:sans-serif} ${css} ${fonts}`});
    await page.addScriptTag({content: bundle.outputFiles[0].text});
    await page.evaluate(() => {
      window.storage = new Map(); window.failStorage = false; window.deferStorage = null;
      window.GM_getValue = (key, fallback) => storage.get(key) ?? fallback;
      window.GM = {setValue: async (key, value) => {if (failStorage) throw new Error('Storage unavailable'); if (deferStorage) await deferStorage; storage.set(key, value);}};
      window.settings = new UI.SettingsManager('Chromora', '1.3.0', {theme: {toString: null, valueOf: null}, flags: {}});
      window.changes = 0; settings.onRenderingSettingsChanged(() => changes++);
      settings.buildWindow();
    });
    await page.evaluate(() => settings.saveUserStorageNow());
    assert.equal(await page.evaluate(() => JSON.parse(storage.get('bmUserSettings')).theme), 'glass');
    checks++;
    assert.deepEqual(await page.evaluate(() => settings.userSettings.highlight), [[2, 0, 0]]);
    assert.equal(await page.locator('.bm-highlight-grid button[data-status="Incorrect"]').count(), 0);
    await page.getByRole('button', {name: 'Preset "Cross Shape"', exact: true}).click();
    await page.waitForFunction(() => storage.has('bmUserSettings'));
    assert.equal(await page.locator('.bm-highlight-grid button[data-status="Incorrect"]').count(), 4);
    assert.equal(await page.evaluate(() => JSON.parse(storage.get('bmUserSettings')).highlight.length), 5);
    await page.getByRole('button', {name: 'top left sub-pixel: disabled', exact: true}).click();
    assert.equal(await page.getByRole('button', {name: 'top left sub-pixel: incorrect', exact: true}).count(), 1);
    assert.equal(await page.evaluate(() => changes), 2);
    checks += 6;

    await page.getByRole('button', {name: 'Selected color area hotkey: Left Alt', exact: true}).click();
    await page.keyboard.press('Control');
    await page.waitForFunction(() => document.getElementById('bm-settings-status').textContent.includes('already used'));
    assert.equal(await page.evaluate(() => settings.userSettings.hotkeys.paintArea), 'AltLeft');
    assert.equal(await page.evaluate(() => document.body.classList.contains('bm-hotkey-recording')), false);
    await page.getByRole('button', {name: 'Selected color area hotkey: Left Alt', exact: true}).click();
    await page.evaluate(() => {window.deferStorage = new Promise(resolve => {window.releaseStorage = resolve;});});
    await page.keyboard.press('q');
    await page.waitForFunction(() => settings.userSettings.hotkeys.paintArea === 'KeyQ');
    await page.keyboard.press('w');
    assert.equal(await page.evaluate(() => settings.userSettings.hotkeys.paintArea), 'KeyQ', 'a slow save must not capture another key');
    assert.equal(await page.evaluate(() => document.body.classList.contains('bm-hotkey-recording')), false);
    await page.evaluate(() => {releaseStorage(); window.deferStorage = null;});
    checks += 5;

    await page.getByRole('radio', {name: 'Frutiger Aero: Sky, glass & fresh green', exact: true}).click();
    await page.waitForFunction(() => JSON.parse(storage.get('bmUserSettings')).theme === 'aero');
    await page.evaluate(async () => {await document.fonts.load('700 16px "PT Sans"', 'Привет'); await document.fonts.load('600 16px "Exo 2"', 'Настройки'); await document.fonts.ready;});
    assert.equal(await page.evaluate(() => document.documentElement.dataset.chromoraTheme), 'aero');
    assert.ok((await page.locator('#bm-window-settings').evaluate(el => getComputedStyle(el).fontFamily)).startsWith('"PT Sans"'));
    assert.ok((await page.locator('#bm-window-settings h1').evaluate(el => getComputedStyle(el).fontFamily)).startsWith('"Exo 2"'));
    assert.equal(await page.evaluate(() => document.fonts.check('700 16px "PT Sans"', 'Привет') && document.fonts.check('600 16px "Exo 2"', 'Настройки')), true);
    const rect = await page.locator('#bm-window-settings').boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1, `settings fits ${width}px: ${JSON.stringify(rect)}`);
    assert.deepEqual(remoteRequests, []);
    checks += 6;

    if (width === 1280) {
      await page.evaluate(() => {
        window.main = new UI.WindowMain('Chromora', '1.3.0'); main.apiManager = {}; main.settingsManager = settings; main.buildWindow();
        const mainElement = document.getElementById('bm-window-main'); Object.assign(mainElement.style, {top: '100px', left: '60px', transform: 'none'});
        const settingsElement = document.getElementById('bm-window-settings'); Object.assign(settingsElement.style, {top: '70px', left: '560px', transform: 'none'});
        document.getElementById('bm-user-droplets').textContent = '2,480'; document.getElementById('bm-user-nextlevel').textContent = '180 px';
        mainElement.querySelector('time').textContent = '24 / 60';
      });
      await fs.mkdir(path.join(root, 'tests/evidence'), {recursive: true});
      await page.screenshot({path: path.join(root, 'tests/evidence/frutiger-aero-desktop.png')});
      await page.evaluate(() => main.dispose());
    } else if (width === 375) {
      await page.screenshot({path: path.join(root, 'tests/evidence/frutiger-aero-mobile.png')});
    }

    // Roving keyboard selection reaches all themes and immediately persists.
    await page.getByRole('radio', {name: 'Frutiger Aero: Sky, glass & fresh green', exact: true}).focus();
    await page.keyboard.press('Home');
    await page.waitForFunction(() => document.documentElement.dataset.chromoraTheme === 'glass');
    for (const theme of ['light', 'dark', 'aero']) {
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(() => document.documentElement.dataset.chromoraTheme), theme);
      checks++;
    }
    await page.evaluate(() => {failStorage = true;});
    await page.getByRole('button', {name: 'Preset "None"', exact: true}).click();
    await page.waitForFunction(() => document.getElementById('bm-settings-status').textContent === 'Storage unavailable');
    await page.getByLabel('Move window with arrow keys; Home resets its position', {exact: true}).focus();
    await page.keyboard.press('ArrowLeft');
    await page.evaluate(() => settings.userSettingsSavePromise.catch(() => {}));
    assert.deepEqual(errors, [], 'storage failure must be handled');
    await page.evaluate(() => {failStorage = false; settings.dispose();});
    assert.equal(await page.locator('#bm-window-settings').count(), 0);
    assert.equal(await page.evaluate(() => settings.renderingSettingsListeners.size), 0);
    checks += 4;
    await context.close();
  }
  console.log(`Settings/Aero browser regression: ${checks} checks passed`);
} finally {await browser.close();}
