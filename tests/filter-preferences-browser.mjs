import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const modulePath = process.env.PLAYWRIGHT_MODULE || process.env.AUDIT_PLAYWRIGHT_MODULE;
const {chromium} = modulePath ? await import(pathToFileURL(modulePath)) : await import('playwright');
const bundle = await build({
  stdin: {contents: "export {default as WindowFilter} from './src/WindowFilter.js';", resolveDir: root},
  bundle: true, write: false, format: 'iife', globalName: 'UI', loader: {'.png': 'dataurl'}, logLevel: 'silent'
});

test('Color Filter restores applied preferences without saving unchanged refreshes', async () => {
  const browser = await chromium.launch({headless: true, ...(process.platform === 'win32' ? {channel: 'msedge'} : {})});
  try {
    const page = await browser.newPage({reducedMotion: 'reduce'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({content: bundle.outputFiles[0].text});
    await page.evaluate(() => {
      window.savedSnapshots = [];
      window.settings = {
        userSettings: {flags: [], windowFilter: {mode: 'fullscreen', isOpen: true, width: 600,
          sortPrimary: 'name', sortSecondary: 'ascending', showUnused: true}},
        saveUserStorageNow: async () => {savedSnapshots.push(structuredClone(settings.userSettings));}
      };
      window.manager = {
        shouldFilterColor: new Map(), getTemplateStatisticsState: () => 'ready',
        onTemplatesChanged: () => () => {}, templatesArray: [],
        paletteBM: {palette: [
          {id: 1, name: 'Zulu', rgb: [0, 255, 0], premium: false},
          {id: 2, name: 'Alpha', rgb: [255, 0, 0], premium: true}
        ]}
      };
      window.createFilter = () => new UI.WindowFilter({name: 'Chromora', version: 'test',
        settingsManager: settings, apiManager: {templateManager: manager}});
      window.filter = createFilter();
      window.preferences = () => ({sortPrimary: filter.sortPrimary, sortSecondary: filter.sortSecondary, showUnused: filter.showUnused});
      window.applySort = (primary, secondary, unused) => {
        document.getElementById('bm-filter-sort-primary').value = primary;
        document.getElementById('bm-filter-sort-secondary').value = secondary;
        document.getElementById('bm-filter-show-unused').checked = unused;
        document.querySelector('#bm-window-filter button[type="submit"]').click();
      };
    });
    assert.deepEqual(await page.evaluate(() => preferences()), {sortPrimary: 'name', sortSecondary: 'ascending', showUnused: true});
    assert.equal(await page.evaluate(() => savedSnapshots.length), 0, 'restoring constructor preferences does not write storage');
    await page.evaluate(() => filter.buildWindow());
    assert.deepEqual(await page.evaluate(() => ({
      primary: document.getElementById('bm-filter-sort-primary').value,
      secondary: document.getElementById('bm-filter-sort-secondary').value,
      unused: document.getElementById('bm-filter-show-unused').checked,
      ids: [...document.querySelectorAll('#bm-filter-flex > [data-id]')].map(card => Number(card.dataset.id))
    })), {primary: 'name', secondary: 'ascending', unused: true, ids: [2, 1]});
    const initialWrites = await page.evaluate(() => savedSnapshots.length);
    await page.evaluate(() => {
      filter.refreshColorList(); filter.refreshColorList();
      applySort('name', 'ascending', true);
    });
    assert.equal(await page.evaluate(() => savedSnapshots.length), initialWrites, 'refreshing or reapplying the same preferences does not write');

    const choices = [['id', 'ascending', true], ['id', 'descending', true], ['id', 'descending', false]];
    for (const [index, choice] of choices.entries()) {
      await page.evaluate(choice => applySort(...choice), choice);
      assert.equal(await page.evaluate(() => savedSnapshots.length), initialWrites + index + 1, 'each actual preference change writes once');
    }
    const saved = await page.evaluate(() => savedSnapshots.at(-1));
    assert.equal(saved.windowFilter.width, 600, 'sorting preserves window geometry');
    assert.deepEqual({sortPrimary: saved.windowFilter.sortPrimary, sortSecondary: saved.windowFilter.sortSecondary,
      showUnused: saved.windowFilter.showUnused}, {sortPrimary: 'id', sortSecondary: 'descending', showUnused: false});
    await page.evaluate(() => {
      filter.dispose();
      settings.userSettings = structuredClone(savedSnapshots.at(-1));
      filter = createFilter(); filter.buildWindow(); filter.refreshColorList();
    });
    assert.deepEqual(await page.evaluate(() => preferences()), {sortPrimary: 'id', sortSecondary: 'descending', showUnused: false},
      'a fresh filter instance restores the saved preferences');

    assert.deepEqual(await page.evaluate(() => {
      filter.dispose();
      settings.userSettings.windowFilter = {mode: 'fullscreen', sortPrimary: 'unknown', sortSecondary: null, showUnused: 'false'};
      const before = savedSnapshots.length;
      filter = createFilter();
      return {preferences: preferences(), writes: savedSnapshots.length - before};
    }), {preferences: {sortPrimary: 'total', sortSecondary: 'descending', showUnused: false}, writes: 0},
    'invalid persisted values fall back safely without triggering a save');
    await page.evaluate(() => filter.buildWindow());
    const beforeInvalid = await page.evaluate(() => savedSnapshots.length);
    await page.evaluate(() => applySort('unknown', 'unknown', false));
    assert.equal(await page.evaluate(() => savedSnapshots.length), beforeInvalid, 'invalid form values normalize to the unchanged defaults');
    assert.deepEqual(await page.evaluate(() => preferences()), {sortPrimary: 'total', sortSecondary: 'descending', showUnused: false});
    await page.evaluate(() => filter.dispose());
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
