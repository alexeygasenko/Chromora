import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../src/apiManager.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default class ApiManager', 'globalThis.ApiManager = class ApiManager');
const hook = main.slice(main.indexOf("  if (window['__blueMarblePageHookInstalled']"), main.indexOf('  /** Bridges a trusted drag'))
  + main.slice(main.indexOf('  // Spys on "spontaneous"'), main.indexOf('\n}, {'));
const tileURL = 'https://backend.wplace.live/files/s0/tiles/0/1/2.png';
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) {
  const deadline = Date.now() + 1000;
  while (!predicate() && Date.now() < deadline) {await new Promise(resolve => setTimeout(resolve, 1));}
  assert.ok(predicate(), 'Expected bridge event was not delivered');
}

function fixture({draw, fetch, consumer = true, map = null, discoverMap} = {}) {
  const handlers = new Set();
  const timers = new Map();
  const errors = [];
  const requests = [];
  const messages = [];
  const renders = [];
  const events = [];
  const original = new Response(new Blob(['original'], {type: 'image/png'}), {
    headers: {'content-type': 'image/png', 'content-length': '8', 'content-encoding': 'gzip'}
  });
  const window = {
    location: {origin: 'https://wplace.live', href: 'https://wplace.live/'},
    testGetMap: discoverMap ?? (async () => map),
    fetch: async (...args) => {requests.push(args); return fetch ? fetch(...args) : original;},
    addEventListener(type, callback) {if (type === 'message') handlers.add(callback);},
    removeEventListener(type, callback) {if (type === 'message') handlers.delete(callback);},
    dispatchEvent(event) {events.push(event.type);},
    postMessage(data, targetOrigin) {
      messages.push({data, targetOrigin});
      queueMicrotask(() => dispatch({data, source: window, origin: window.location.origin}));
    }
  };
  const dispatch = event => {
    for (const handler of handlers) {
      try {Promise.resolve(handler(event)).catch(error => errors.push(error));}
      catch (error) {errors.push(error);}
    }
  };
  const manager = {tileSize: 1000, async drawTemplateOnTile(...args) {
    renders.push(args);
    return draw ? draw(...args) : new Blob(['rendered'], {type: 'image/png'});
  }};
  let timerID = 0;
  const context = vm.createContext({
    window, Request, Response, Headers, Blob, URL, URLSearchParams, AbortController, DOMException, Event,
    crypto: globalThis.crypto,
    document: {currentScript: null, querySelectorAll: () => [], querySelector: selector => selector === 'canvas.maplibregl-canvas' ? {} : null},
    console: {log() {}, warn() {}, error() {}}, consoleError() {},
    localizeNumber: value => new Intl.NumberFormat().format(value), serverTPtoDisplayTP: () => [0, 0],
    requestAnimationFrame: fn => fn(),
    setTimeout(fn, delay) {timers.set(++timerID, {fn, delay}); return timerID;},
    clearTimeout(id) {timers.delete(id);},
    sessionStorage: {setItem() {}}
  });
  vm.runInContext(`(() => {${hook}\nwindow.testQueue = fetchedBlobQueue; discoverMapForRefresh = window.testGetMap;})()`, context);
  vm.runInContext(api, context);
  const apiManager = new context.ApiManager(manager);
  if (consumer) apiManager.spontaneousResponseListener({updateInnerHTML() {}, handleDisplayError() {}});
  return {window, original, manager, apiManager, dispatch, errors, messages, renders, requests, timers, events};
}

test('only approved tile URLs enter the replacement queue', async () => {
  for (const url of ['/assets/avatar.png', 'https://evil.example/files/s0/tiles/0/1/2.png',
    'https://backend.wplace.live.evil.example/tiles/1/2.png', 'https://backend.wplace.live:123/tiles/1/2.png',
    'https://backend.wplace.live/tiles/1/2.png/extra', 'http://backend.wplace.live/tiles/1/2.png']) {
    const f = fixture();
    assert.equal(await f.window.fetch(url), f.original, url);
    assert.equal(f.renders.length, 0);
    assert.equal(f.window.testQueue.size, 0);
  }
});

test('tiles resolve with rendered bytes and preserve sequence/revision across the bridge', async () => {
  const f = fixture();
  const first = await f.window.fetch(tileURL);
  assert.equal(await first.text(), 'rendered');
  assert.equal(first.headers.get('content-length'), null);
  assert.equal(first.headers.get('content-encoding'), null);
  assert.deepEqual(Array.from(f.renders[0][1]), [1, 2]);
  assert.equal(f.renders[0][2].requestSequence, 1);
  f.dispatch({source: f.window, origin: f.window.location.origin,
    data: {source: 'blue-marble', action: 'refresh-tiles', revision: 5}});
  await f.window.fetch(tileURL);
  assert.equal(f.renders[1][2].requestSequence, 2);
  assert.equal(f.renders[1][2].revision, 5);
  assert.equal(new URL(f.requests[1][0]).searchParams.get('bm-revision'), '5');
  assert.equal(f.messages.filter(({data}) => data.action === 'refresh-progress' && data.state === 'completed').length, 1);
  assert.equal(f.window.testQueue.size, 0);
  assert.equal(f.apiManager.pendingTiles.size, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.errors.length, 0);
});

test('renderer failure and invalid output return the exact original response', async () => {
  for (const draw of [() => {throw new Error('decode failed');}, () => null]) {
    const f = fixture({draw});
    assert.equal(await f.window.fetch(tileURL), f.original);
    assert.equal(f.window.testQueue.size, 0);
    assert.equal(f.apiManager.pendingTiles.size, 0);
    assert.equal(f.timers.size, 0);
    assert.equal(f.errors.length, 0);
  }
});

test('missing consumer and stalled renderer time out, cancel work and release queues', async () => {
  for (const consumer of [true, false]) {
    const f = fixture({consumer, draw: () => new Promise(() => {})});
    const result = f.window.fetch(tileURL);
    await until(() => f.messages.some(({data}) => data.endpoint === tileURL));
    assert.equal(f.window.testQueue.size, 1);
    const timer = [...f.timers.values()][0];
    assert.equal(timer.delay, 15000);
    timer.fn();
    assert.equal(await result, f.original);
    await tick();
    assert.equal(f.window.testQueue.size, 0);
    assert.equal(f.apiManager.pendingTiles.size, 0);
    if (consumer) assert.equal(f.renders[0][2].signal.aborted, true);
    assert.equal(f.timers.size, 0);
  }
});

test('abort rejects promptly and cancels renderer even after original fetch completed', async () => {
  const f = fixture({draw: () => new Promise(() => {})});
  const controller = new AbortController();
  const promise = f.window.fetch(new Request(tileURL, {signal: controller.signal}));
  await until(() => f.renders.length === 1);
  controller.abort();
  await assert.rejects(promise, error => error.name === 'AbortError');
  await tick();
  assert.equal(f.renders[0][2].signal.aborted, true);
  assert.equal(f.window.testQueue.size, 0);
  assert.equal(f.apiManager.pendingTiles.size, 0);
  assert.equal(f.timers.size, 0);
});

test('network failure completes refresh progress without queueing a blob', async () => {
  const f = fixture({fetch: async () => {throw new TypeError('network failed');}});
  f.dispatch({source: f.window, origin: f.window.location.origin,
    data: {source: 'blue-marble', action: 'refresh-tiles', revision: 2}});
  await assert.rejects(f.window.fetch(tileURL), /network failed/);
  assert.equal(f.messages.filter(({data}) => data.action === 'refresh-progress' && data.state === 'completed').length, 1);
  assert.equal(f.window.testQueue.size, 0);
});

test('null, foreign and malformed messages cannot mutate identity or coordinates', async () => {
  const f = fixture();
  const payload = {source: 'blue-marble', endpoint: '/api/me', jsonData: {id: 42, level: 1, pixelsPainted: 0, droplets: 1}};
  const valid = data => ({source: f.window, origin: f.window.location.origin, data});
  for (const data of [null, 4, [], {}, {source: 'blue-marble', endpoint: 5},
    {...payload, jsonData: {...payload.jsonData, id: Infinity}},
    {...payload, jsonData: {...payload.jsonData, id: -1}}, {...payload, jsonData: null},
    {...payload, endpoint: 'https://evil.example/api/me'},
    {source: 'blue-marble', endpoint: '/api/pixel/1/2?x=Infinity&y=0', jsonData: {}}]) f.dispatch(valid(data));
  f.dispatch({...valid(payload), origin: 'https://evil.example'});
  f.dispatch({...valid(payload), source: {}});
  await tick();
  assert.equal(f.manager.userID, undefined);
  assert.equal(f.apiManager.coordsTilePixel.length, 0);
  assert.equal(f.errors.length, 0);
  f.dispatch(valid(payload));
  assert.equal(f.manager.userID, 42);
});

test('foreign blob replies cannot settle a pending tile; listener disposal aborts pending work', async () => {
  const f = fixture({draw: () => new Promise(() => {})});
  const controller = new AbortController();
  const result = f.window.fetch(tileURL, {signal: controller.signal});
  await until(() => f.renders.length === 1);
  const request = f.messages.find(({data}) => data.endpoint === tileURL).data;
  f.dispatch({source: {}, origin: f.window.location.origin,
    data: {source: 'blue-marble', blobID: request.blobID, blobData: new Blob(['foreign'])}});
  assert.equal(f.window.testQueue.size, 1);
  f.apiManager.stopSpontaneousResponseListener();
  assert.equal(f.renders[0][2].signal.aborted, true);
  controller.abort();
  await assert.rejects(result, error => error.name === 'AbortError');
});

test('consumer is installed before asynchronous template import', () => {
  const initialize = main.slice(main.indexOf('async function initializeBlueMarble()'));
  assert.ok(initialize.indexOf('apiManager.spontaneousResponseListener(windowMain)') < initialize.indexOf('await templateManager.importJSON'));
});

test('refresh invalidates visible pixel rasters through the captured map API', async () => {
  const refreshed = [];
  const f = fixture({map: {refreshTiles(sourceID) {refreshed.push(sourceID);}}});
  f.dispatch({source: f.window, origin: f.window.location.origin,
    data: {source: 'blue-marble', action: 'refresh-tiles', revision: 1}});
  await tick();
  assert.deepEqual(refreshed, ['pixel-art-layer']);
  assert.deepEqual(f.events, []);
});

test('refresh supports raster-source setTiles fallback without changing URL templates', async () => {
  const originalTiles = ['https://backend.wplace.live/files/s0/tiles/{z}/{x}/{y}.png'];
  let updated;
  const f = fixture({map: {
    refreshTiles() {throw new Error('Older runtime');},
    getSource(sourceID) {
      assert.equal(sourceID, 'pixel-art-layer');
      return {tiles: originalTiles, setTiles(tiles) {updated = tiles;}};
    }
  }});
  f.dispatch({source: f.window, origin: f.window.location.origin,
    data: {source: 'blue-marble', action: 'refresh-tiles', revision: 1}});
  await tick();
  assert.deepEqual(updated, originalTiles);
  assert.notEqual(updated, originalTiles);
  assert.deepEqual(f.events, []);
});

test('only the newest refresh runs after deferred map discovery', async () => {
  let resolveMap;
  const discovery = new Promise(resolve => {resolveMap = resolve;});
  let refreshed = 0;
  const f = fixture({discoverMap: () => discovery});
  for (const revision of [1, 2]) f.dispatch({source: f.window, origin: f.window.location.origin,
    data: {source: 'blue-marble', action: 'refresh-tiles', revision}});
  resolveMap({refreshTiles() {refreshed++;}});
  await tick();
  assert.equal(refreshed, 1);
  assert.deepEqual(f.events, []);
});

test('missing map reports the compatibility fallback instead of claiming raster invalidation', async () => {
  const f = fixture();
  f.dispatch({source: f.window, origin: f.window.location.origin,
    data: {source: 'blue-marble', action: 'refresh-tiles', revision: 1}});
  await tick();
  assert.deepEqual(f.events, ['online', 'resize']);
  assert.ok(f.messages.some(({data}) => data.action === 'refresh-unavailable' && data.revision === 1));
  assert.equal(f.errors.length, 0);
});
