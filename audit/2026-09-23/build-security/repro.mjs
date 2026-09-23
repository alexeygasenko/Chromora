import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const main = fs.readFileSync(path.join(repo, 'src/main.js'), 'utf8');
const api = fs.readFileSync(path.join(repo, 'src/apiManager.js'), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default class ApiManager', 'globalThis.ApiManager = class ApiManager');
// Evaluate the actual source for both the fetch hook and its blob reply listener.
// Exclude only the unrelated paint-area UI setup; no production code is edited.
const hook = main.slice(main.indexOf('  if (window[\'__blueMarblePageHookInstalled\']'), main.indexOf('  /** Bridges a trusted drag'))
  + main.slice(main.indexOf('  // Spys on "spontaneous"'), main.indexOf('\n}, {'));
const results = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function makeFixture({failDraw = false} = {}) {
  const listeners = [];
  const errors = [];
  const messages = [];
  const manager = {
    tileSize: 1000,
    drawCalls: 0,
    async drawTemplateOnTile(blob) {
      this.drawCalls++;
      if (failDraw) throw new Error('Simulated createImageBitmap decode failure');
      return blob;
    }
  };
  const window = {
    location: {origin: 'https://wplace.live', href: 'https://wplace.live/'},
    fetch: async () => new Response(new Blob(['fake-png']), {headers: {'content-type': 'image/png'}}),
    addEventListener: (type, fn) => {if (type === 'message') listeners.push(fn);},
    removeEventListener: () => {},
    postMessage(data) {
      messages.push(data);
      queueMicrotask(() => dispatch({data, source: window, origin: window.location.origin}));
    }
  };
  const dispatch = event => {
    for (const handler of listeners) {
      try {Promise.resolve(handler(event)).catch(error => errors.push(String(error)));}
      catch (error) {errors.push(String(error));}
    }
  };
  const context = vm.createContext({
    window, Request, Response, Blob, URL, URLSearchParams, crypto: globalThis.crypto,
    console: {log() {}, warn() {}, error() {}, groupCollapsed() {}, groupEnd() {}},
    document: {currentScript: null, querySelectorAll: () => []},
    consoleError() {}, localizeNumber: value => new Intl.NumberFormat().format(value),
    numberToEncoded: () => 'stub', serverTPtoDisplayTP: () => [0, 0]
  });
  vm.runInContext(`(() => {\n${hook}\n})()`, context);
  vm.runInContext(api, context);
  const apiManager = new context.ApiManager(manager);
  apiManager.spontaneousResponseListener({updateInnerHTML() {}, handleDisplayError() {}});
  return {window, manager, apiManager, dispatch, errors, messages};
}

for (const [label, url, failDraw, expected] of [
  ['healthy tile control', 'https://backend.wplace.live/files/s0/tiles/0/1/2.png', false, 'resolved'],
  ['non-tile image', 'https://wplace.live/assets/avatar.png', false, 'pending'],
  ['tile renderer rejection', 'https://backend.wplace.live/files/s0/tiles/0/1/2.png', true, 'pending']
]) {
  const fixture = makeFixture({failDraw});
  const state = await Promise.race([
    fixture.window.fetch(url).then(() => 'resolved', () => 'rejected'),
    delay(150).then(() => 'pending')
  ]);
  assert.equal(state, expected);
  results.push({case: label, observationWindowMs: 150, state, drawCalls: fixture.manager.drawCalls, errors: fixture.errors});
}

{
  const fixture = makeFixture();
  fixture.dispatch({data: null, source: {}, origin: 'https://unrelated.example'});
  await delay(0);
  assert.equal(fixture.errors.length, 2);
  results.push({case: 'unrelated null message', errors: fixture.errors});
}

{
  const fixture = makeFixture();
  fixture.dispatch({
    data: {source: 'blue-marble', endpoint: '/api/me', jsonData: {id: 123456, level: 1, pixelsPainted: 0, droplets: 1}},
    source: {}, origin: 'https://unrelated.example'
  });
  await delay(0);
  assert.equal(fixture.manager.userID, 123456);
  results.push({case: 'foreign-origin synthetic message', userIDChangedTo: fixture.manager.userID,
    scope: 'Handler validation test; real opener/iframe reachability and site COOP were not tested.'});
}

{
  const workflow = fs.readFileSync(path.join(repo, '.github/workflows/build.yml'), 'utf8');
  const line = workflow.split(/\r?\n/).find(line => line.includes('git commit -m "Bumped version;'));
  assert.ok(line);
  const title = 'Fix documentation $(printf CI_INJECTION_PROOF >&2)';
  const rendered = line.trim()
    .replace('${{ steps.get-commit-message.outputs.TITLE }}', title)
    .replace('${{ steps.get-commit-message.outputs.BODY }}', 'Benign body');
  // Harmless local shell proof: git is a function, no repository writes occur.
  const script = 'git() { printf "git stub executed\\n"; }\n' + rendered + '\n';
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
  const execution = spawnSync(bash, ['--noprofile', '--norc', '-s'], {input: script, encoding: 'utf8'});
  assert.equal(execution.status, 0, execution.stderr);
  assert.ok(execution.stderr.includes('CI_INJECTION_PROOF'));
  results.push({case: 'commit title shell injection', status: execution.status,
    stdout: execution.stdout.trim(), stderr: execution.stderr.trim(), rendered});
}

const output = JSON.stringify({createdAt: new Date().toISOString(), node: process.version, results}, null, 2);
fs.writeFileSync(path.join(repo, 'audit/2026-09-23/build-security/repro-results.json'), output + '\n');
console.log(output);
