import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const filename = process.argv[2] || 'dist/Chromora.user.js';
const source = fs.readFileSync(filename, 'utf8');
new vm.Script(source, {filename});
assert.ok(source.startsWith('// ==UserScript=='));
assert.ok(source.includes('// ==/UserScript=='));
assert.ok(source.includes('Build Hash:'));
assert.ok(!source.includes('chromoraFontInjectionPoint'));
assert.ok(!source.includes('GM_getResourceText("CSS-BM-File")'));
assert.ok(!source.includes('fonts.googleapis.com'));
for (const field of ['windowMain', 'windowTemplates', 'windowSettings', 'windowFilter', 'collapsed', 'isOpen',
  'sortPrimary', 'sortSecondary', 'showUnused', 'colorLayout', 'layoutSizes', 'requestSequence', 'blobID', 'automatedClicks', 'bm-last-me', 'bm-revision']) {
  assert.ok(source.includes(field), `Bundle lost the public contract ${field}`);
}
for (const directory of ['build/assets/aero', 'build/assets/interface']) {
  const fonts = JSON.parse(fs.readFileSync(`${directory}/manifest.json`, 'utf8'));
  for (const font of fonts) {
    assert.ok(source.includes(font.family), `Missing font family ${font.family}`);
    assert.ok(source.includes(fs.readFileSync(`${directory}/${font.file}`).toString('base64')), `Missing font face ${font.file}`);
  }
}
assert.ok(source.includes('SIL OPEN FONT LICENSE'));
console.log(`Bundle contracts, syntax, embedded fonts and licenses verified: ${filename}`);
