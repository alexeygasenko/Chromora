// Focused storage verification using actual manager methods and mocked image/GM APIs.
// Run from repository root: node audit/2026-09-23/storage-checks.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {build} from 'esbuild';
const built = await build({stdin: {contents: "export {default as Manager} from './src/templateManager.js'; export {default as Template} from './src/Template.js';", resolveDir: process.cwd()}, bundle: true, format: 'esm', write: false, loader: {'.png': 'dataurl'}, plugins: [{name: 'exclude-unused-window-ui', setup(builder) {builder.onLoad({filter: /[/\\](WindowMain|WindowWizard|settingsManager)\.js$/}, () => ({contents: 'export default class UnusedUIStub {}', loader: 'js'}));}}]});
const {Manager, Template} = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const originalLog = console.log;
console.log = () => {};
const results = {scope: 'Actual storage methods, mocked asynchronous GM storage and image processing; not a real userscript-manager cross-tab test', checks: []};
let stored = '{}';
let lockTail = Promise.resolve();
let writes = 0;
Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {locks: {request(_name, cb) {const next = lockTail.then(cb); lockTail = next.catch(() => {}); return next;}}}});
globalThis.GM_getValue = () => stored;
globalThis.GM = {setValue: async (_key, value) => {await new Promise(resolve => setTimeout(resolve, 5)); stored = value; writes++;}};
Template.prototype.createTemplateTiles = async function() {
  this.pixelCount = {total: 1, colors: new Map([[1, 1]])};
  return {templateTiles: {'0000,0000,000,000': {width: 3, height: 3}}, templateTilesBuffers: {'0000,0000,000,000': 'Z29vZA=='}};
};
function manager() {const instance = new Manager('Chromora', '1.3.0'); instance.requestCanvasRefresh = async () => {}; return instance;}
async function check(name, body) {try {const detail = await body(); results.checks.push({name, status: 'passed', detail});} catch(error) {results.checks.push({name, status: 'failed', error: error.message}); process.exitCode = 1;}}
try {
  await check('Same-runtime creates are serialized without lost records', async () => {
    stored = '{}'; const instance = manager();
    const templates = await Promise.all([instance.createTemplate(null, 'one', [0,0,0,0]), instance.createTemplate(null, 'two', [0,0,0,0])]);
    assert.equal(Object.keys(JSON.parse(stored).templates).length, 2);
    assert.deepEqual(templates.map(t => t.sortID), [0,1]);
    return {keys: Object.keys(JSON.parse(stored).templates)};
  });
  await check('Two runtimes with shared Web Lock preserve both writes', async () => {
    stored = '{}'; const first = manager(), second = manager();
    await Promise.all([first.createTemplate(null, 'one', [0,0,0,0]), second.createTemplate(null, 'two', [0,0,0,0])]);
    assert.equal(Object.keys(JSON.parse(stored).templates).length, 2);
    return {persistentCount: 2, runtimeCounts: [first.templatesArray.length, second.templatesArray.length]};
  });
  await check('Invalid persisted JSON is not overwritten on create', async () => {
    stored = '{invalid'; const before = writes;
    await assert.rejects(manager().createTemplate(null, 'one', [0,0,0,0]), /invalid/);
    assert.equal(stored, '{invalid'); assert.equal(writes, before);
  });
  await check('Failed GM save does not append a runtime template', async () => {
    stored = '{}'; const instance = manager(), save = GM.setValue;
    GM.setValue = async () => {throw new Error('simulated storage failure');};
    try {await assert.rejects(instance.createTemplate(null, 'one', [0,0,0,0]), /simulated storage failure/); assert.equal(instance.templatesArray.length, 0); assert.equal(stored, '{}');}
    finally {GM.setValue = save;}
  });
  await check('Create then toggle then delete persist the intended state', async () => {
    stored = '{}'; const instance = manager(); const template = await instance.createTemplate(null, 'one', [0,0,0,0]);
    await instance.setTemplateEnabled(template, false); assert.equal(JSON.parse(stored).templates[template.storageKey].enabled, false);
    await instance.deleteTemplate(template); assert.equal(Object.keys(JSON.parse(stored).templates).length, 0); assert.equal(instance.templatesArray.length, 0);
  });
  await check('Conditional defect: concurrent writes lose a record when Web Locks are unavailable', async () => {
    stored = '{}'; const locks = navigator.locks; navigator.locks = undefined;
    try {
      await Promise.all([manager().createTemplate(null, 'one', [0,0,0,0]), manager().createTemplate(null, 'two', [0,0,0,0])]);
      const names = Object.values(JSON.parse(stored).templates).map(t => t.name);
      assert.equal(names.length, 1);
      return {expectedCount: 2, actualCount: names.length, remainingNames: names, interpretation: 'Reproduction of a conditional defect, not a passing product requirement'};
    } finally {navigator.locks = locks;}
  });
} finally {console.log = originalLog;}
await fs.writeFile('audit/2026-09-23/evidence/storage-checks.json', JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
