import assert from 'node:assert/strict';
import test from 'node:test';
import {DEFAULT_HIGHLIGHT, INTERFACE_THEMES, normalizeHighlight, normalizeUserSettings} from '../src/settingsSchema.js';

test('malformed persisted records recover without losing valid settings', () => {
  for (const value of [null, [], 4, 'broken', {flags: 4, highlight: [[3, 1, 1]], filter: 'red', windowSettings: []}]) {
    const settings = normalizeUserSettings(value);
    assert.deepEqual(settings.highlight, [[2, 0, 0]]);
    assert.ok(Array.isArray(settings.flags));
    assert.ok(Array.isArray(settings.filter));
    assert.equal(settings.hotkeys.paintArea, 'AltLeft');
  }
  const original = {flags: ['hl-noTrans', null, 'hl-noTrans'], filter: [1, 1, -2, NaN],
    windowSettings: {x: 15, y: Infinity}, windowFilter: {width: -50}, customPreference: 'keep'};
  const normalized = normalizeUserSettings(original);
  assert.deepEqual(normalized.flags, ['hl-noTrans']);
  assert.deepEqual(normalized.filter, [1, -2]);
  assert.deepEqual(normalized.windowSettings, {x: 15});
  assert.equal(normalized.windowFilter.width, undefined);
  assert.equal(normalized.customPreference, 'keep');
  assert.equal(original.windowSettings.y, Infinity);
});

test('legacy release geometry migrates only verified mangled fields', () => {
  const value = normalizeUserSettings({windowFilter: {xi: 'horizontal', Ci: {horizontal: {width: 640, height: 300, x: 22}}}, xi: 'unrelated'});
  assert.equal(value.windowFilter.colorLayout, 'horizontal');
  assert.deepEqual(value.windowFilter.layoutSizes.horizontal, {width: 640, height: 300, x: 22});
  assert.equal(value.windowFilter.xi, undefined);
  assert.equal(value.windowFilter.Ci, undefined);
  assert.equal(value.xi, 'unrelated');
});

test('highlight normalization preserves intentional empty patterns and isolates defaults', () => {
  assert.deepEqual(normalizeHighlight([]), []);
  assert.deepEqual(normalizeHighlight([[1, -1, 0], [2, -1, 0], [0, 0, 1]]), [[2, -1, 0]]);
  assert.deepEqual(normalizeHighlight([[1, 2, 0]]), [[2, 0, 0]]);
  const settings = normalizeUserSettings({});
  settings.highlight[0][0] = 1;
  assert.deepEqual(DEFAULT_HIGHLIGHT, [[2, 0, 0]]);
});

test('legacy duplicate shortcuts become two usable distinct actions', () => {
  for (const code of ['ControlLeft', 'AltLeft', 'KeyQ']) {
    const {hotkeys} = normalizeUserSettings({hotkeys: {paintArea: code, paintAllArea: code}});
    assert.equal(hotkeys.paintArea, code);
    assert.notEqual(hotkeys.paintArea, hotkeys.paintAllArea);
  }
  assert.deepEqual(INTERFACE_THEMES.map(theme => theme.id), ['glass', 'light', 'dark', 'aero']);
});
