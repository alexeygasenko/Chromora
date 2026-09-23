// Contracts verified against the live Wplace public bundle on 2026-09-23:
// backend.wplace.live/me and /s{season}/pixel/{tileX}/{tileY} have no /api prefix.
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const apiSource = fs.readFileSync(new URL('../src/apiManager.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default class ApiManager', 'globalThis.ApiManager = class ApiManager');
const classifyStart = main.indexOf('  function getObservedEndpoint(');
const classifier = main.slice(classifyStart, main.indexOf("  window.addEventListener('message'", classifyStart));

test('page hook recognizes real backend API paths and retains a strict origin/path allowlist', () => {
  const context = vm.createContext({URL, window: {location: {href: 'https://wplace.live/'}}});
  vm.runInContext(classifier, context);
  for (const [url, endpoint] of [
    ['https://backend.wplace.live/me', 'me'], ['https://backend.wplace.live/robots', 'robots'],
    ['https://backend.wplace.live/pixel/12/34?x=56&y=78', 'pixel'],
    ['https://backend.wplace.live/s0/pixel/12/34?x=56&y=78', 'pixel'],
    ['https://backend.wplace.live/s12/pixel/12/34?x=56&y=78', 'pixel'],
    ['https://backend.wplace.live/files/s0/tiles/0/12/34.png', 'tile'], ['/api/me', 'me']
  ]) {assert.equal(context.getObservedEndpoint(url), endpoint, url);}
  for (const url of ['https://wplace.live/me', 'https://evil.example/me', 'https://backend.wplace.live.evil.example/me',
    'https://backend.wplace.live:123/me', 'http://backend.wplace.live/me', 'https://backend.wplace.live/me/extra',
    'https://backend.wplace.live/staff/tools/s0/pixel/12/34?x=56&y=78',
    'https://backend.wplace.live/s0/pixel/12/34/extra', 'https://backend.wplace.live/sx/pixel/12/34',
    'https://backend.wplace.live/s0/me']) {
    assert.equal(context.getObservedEndpoint(url), null, url);
  }
});

function fixture(status = 200) {
  const callbacks = new Set(), requests = [], updates = [], errors = [];
  const user = {id: 42, level: 5, pixelsPainted: 100, droplets: 60};
  const window = {location: {href: 'https://wplace.live/', origin: 'https://wplace.live'},
    addEventListener(type, fn) {if (type === 'message') callbacks.add(fn);},
    removeEventListener(type, fn) {if (type === 'message') callbacks.delete(fn);}};
  const context = vm.createContext({window, URL, AbortController,
    document: {querySelectorAll: () => []},
    serverTPtoDisplayTP: () => [0, 0], localizeNumber: String,
    console: {log() {}}, consoleError: (...args) => errors.push(args),
    fetch: async (url, options) => {requests.push({url, options}); return new Response(JSON.stringify(user), {status});}});
  vm.runInContext(apiSource, context);
  const manager = new context.ApiManager({tileSize: 1000});
  manager.applyUserDataToOverlay = (_overlay, data) => updates.push(data);
  const overlay = {handleDisplayError: message => errors.push(message), updateInnerHTML() {}};
  return {manager, overlay, window, callbacks, requests, updates, errors, user};
}

test('startup requests the real credentialed backend endpoint and handles signed-out visitors', async () => {
  const f = fixture();
  await f.manager.requestCurrentUserData(f.overlay);
  assert.equal(f.requests[0].url, 'https://backend.wplace.live/me');
  assert.equal(f.requests[0].options.credentials, 'include');
  assert.deepEqual(f.updates, [f.user]);
  assert.deepEqual(f.errors, []);
  const guest = fixture(401);
  await guest.manager.requestCurrentUserData(guest.overlay);
  assert.deepEqual(guest.errors, []);
  assert.deepEqual(guest.updates, []);
});

test('consumer accepts backend user/coordinate messages without accepting frontend root lookalikes', async () => {
  const f = fixture();
  f.manager.spontaneousResponseListener(f.overlay);
  const send = async (endpoint, jsonData) => {
    for (const callback of f.callbacks) await callback({source: f.window, origin: 'https://wplace.live',
      data: {source: 'blue-marble', endpoint, jsonData}});
  };
  await send('https://backend.wplace.live/me', f.user);
  assert.deepEqual(f.updates, [f.user]);
  await send('https://backend.wplace.live/pixel/12/34?x=56&y=78', {});
  assert.deepEqual(Array.from(f.manager.coordsTilePixel), [12, 34, 56, 78]);
  await send('https://backend.wplace.live/s0/pixel/14/39?x=0&y=999', {});
  assert.deepEqual(Array.from(f.manager.coordsTilePixel), [14, 39, 0, 999]);
  await send('https://wplace.live/me', {...f.user, id: 100});
  assert.equal(f.updates.length, 1);
  f.manager.stopSpontaneousResponseListener();
  assert.equal(f.callbacks.size, 0);
});
