/** @file The main file. Everything in the userscript is executed from here.
 * @since 0.0.0
 */

import Observers from './observers.js';
import ApiManager from './apiManager.js';
import TemplateManager from './templateManager.js';
import { consoleLog, consoleWarn } from './utils.js';
import WindowMain from './WindowMain.js';
import WindowTelemetry from './WindowTelemetry.js';
import SettingsManager from './settingsManager.js';

const name = GM_info.script.name.toString(); // Name of userscript
const version = GM_info.script.version.toString(); // Version of userscript
const consoleStyle = 'color: cornflowerblue;'; // The styling for the console logs

/** Injects code into the client
 * This code will execute outside of TamperMonkey's sandbox
 * @param {*} callback - The code to execute
 * @since 0.11.15
 */
function inject(callback) {
    const script = document.createElement('script');
    script.setAttribute('bm-name', name); // Passes in the name value
    script.setAttribute('bm-cStyle', consoleStyle); // Passes in the console style value
    script.textContent = `(${callback})();`;
    document.documentElement?.appendChild(script);
    script.remove();
}

/** What code to execute instantly in the client (webpage) to spy on fetch calls.
 * This code will execute outside of TamperMonkey's sandbox.
 * @since 0.11.15
 */
inject(() => {

  if (window['__blueMarblePageHookInstalled']) {return;}
  Object.defineProperty(window, '__blueMarblePageHookInstalled', {
    value: true,
    configurable: false,
    writable: false
  });

  const script = document.currentScript; // Gets the current script HTML Script Element
  const name = script?.getAttribute('bm-name') || 'Blue Marble'; // Gets the name value that was passed in. Defaults to "Blue Marble" if nothing was found
  const consoleStyle = script?.getAttribute('bm-cStyle') || ''; // Gets the console style value that was passed in. Defaults to no styling if nothing was found
  const fetchedBlobQueue = new Map(); // Blobs being processed
  let tileRefreshRevision = 0;

  window.addEventListener('message', (event) => {
    const { source, action, revision, endpoint, blobID, blobData, blink } = event.data;

    if ((source == 'blue-marble') && (action == 'refresh-tiles')) {
      tileRefreshRevision = Math.max(tileRefreshRevision + 1, Number(revision) || 0);
      window.dispatchEvent(new Event('online'));
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      return;
    }
    if ((source == 'blue-marble') && (action == 'refresh-progress')) {return;}

    const elapsed = Date.now() - blink;

    // Since this code does not run in the userscript, we can't use consoleLog().
    console.groupCollapsed(`%c${name}%c: ${fetchedBlobQueue.size} Recieved IMAGE message about blob "${blobID}"`, consoleStyle, '');
    console.log(`Blob fetch took %c${String(Math.floor(elapsed/60000)).padStart(2,'0')}:${String(Math.floor(elapsed/1000) % 60).padStart(2,'0')}.${String(elapsed % 1000).padStart(3,'0')}%c MM:SS.mmm`, consoleStyle, '');
    console.log(fetchedBlobQueue);
    console.groupEnd();

    // The modified blob won't have an endpoint, so we ignore any message without one.
    if ((source == 'blue-marble') && !!blobID && !!blobData && !endpoint) {

      const callback = fetchedBlobQueue.get(blobID); // Retrieves the blob based on the UUID

      // If the blobID is a valid function...
      if (typeof callback === 'function') {

        callback(blobData); // ...Retrieve the blob data from the blobID function
      } else {
        // ...else the blobID is unexpected. We don't know what it is, but we know for sure it is not a blob. This means we ignore it.

        consoleWarn(`%c${name}%c: Attempted to retrieve a blob (%s) from queue, but the blobID was not a function! Skipping...`, consoleStyle, '', blobID);
      }

      fetchedBlobQueue.delete(blobID); // Delete the blob from the queue, because we don't need to process it again
    }
  });

  /** Bridges a trusted drag gesture to Wplace's local paint draft without submitting it. */
  function setupPaintAreaBridge() {
    const tileSize = 1000;
    const scannedModuleURLs = new Set();
    const state = {
      runtimeStore: null,
      userStore: null,
      active: false,
      manualActive: false,
      hotkeyHeld: false,
      hotkeyCode: 'AltLeft',
      busy: false,
      dragging: false,
      pointerID: null,
      dragStart: null,
      dragEnd: null,
      trustedEvent: null,
      pendingRequestID: null,
      fillRevision: 0,
      queuedDraftPixels: new Set(),
      lastChargeSnapshot: null,
      suppressClickUntil: 0,
      toggleButton: null,
      marquee: null,
      alert: null,
      alertTimer: null,
      syncFrame: null
    };

    const selectAreaIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path class="bm-paint-area-cursor" d="m9 8 7.15 7.15-3.05.55-1.55 3.05z"/></svg>';

    const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

    function setButtonState(buttonState, title) {
      const button = state.toggleButton;
      if (!button) {return;}
      button.dataset['state'] = buttonState;
      button.title = title;
      button.setAttribute('aria-label', title);
      button.setAttribute('aria-pressed', state.active ? 'true' : 'false');
      button.disabled = state.busy;
    }

    function removeMarquee() {
      state.marquee?.remove();
      state.marquee = null;
    }

    function removeAreaAlert() {
      clearTimeout(state.alertTimer);
      state.alertTimer = null;
      state.alert?.remove();
      state.alert = null;
    }

    function showAreaAlert(message) {
      removeAreaAlert();
      const alert = document.createElement('div');
      alert.className = 'bm-paint-area-alert';
      alert.setAttribute('role', 'alert');
      alert.textContent = message;
      document.body?.appendChild(alert);
      state.alert = alert;
      setButtonState('error', message);
      state.alertTimer = setTimeout(() => {
        removeAreaAlert();
        if (!state.busy) {
          setButtonState(state.active ? 'active' : 'idle', state.active
            ? 'Stop selecting matching template areas'
            : 'Select matching template area');
        }
      }, 4200);
    }

    function resetQueuedDraftPixels() {
      state.queuedDraftPixels.clear();
      state.lastChargeSnapshot = null;
    }

    function getAvailableDraftPixels() {
      const charges = Number(state.userStore?.['charges']);
      if (!Number.isFinite(charges)) {return {charges: null, available: null};}
      const normalizedCharges = Math.max(0, Math.floor(charges));
      if ((state.lastChargeSnapshot != null) && (normalizedCharges < state.lastChargeSnapshot)) {
        resetQueuedDraftPixels();
      }
      state.lastChargeSnapshot = normalizedCharges;
      return {
        charges: normalizedCharges,
        available: Math.max(0, normalizedCharges - state.queuedDraftPixels.size)
      };
    }

    function prepareDraftRuns(runs, availablePixels) {
      const preparedRuns = [];
      let pixelCount = 0;

      for (const run of runs) {
        const worldY = Number(run?.[0]);
        const startX = Number(run?.[1]);
        const endX = Number(run?.[2]);
        if (![worldY, startX, endX].every(Number.isFinite)) {continue;}

        let preparedRunStart = null;
        for (let worldX = startX; worldX <= endX; worldX++) {
          const alreadyQueued = state.queuedDraftPixels.has(`${worldX},${worldY}`);
          if (!alreadyQueued && (preparedRunStart == null)) {preparedRunStart = worldX;}

          if (!alreadyQueued) {
            pixelCount++;
            if (pixelCount > availablePixels) {
              return {exceeded: true, runs: [], pixelCount};
            }
          }

          const closesRun = (preparedRunStart != null) && (alreadyQueued || (worldX == endX));
          if (!closesRun) {continue;}
          preparedRuns.push([worldY, preparedRunStart, alreadyQueued ? worldX - 1 : worldX]);
          preparedRunStart = null;
        }
      }

      return {exceeded: false, runs: preparedRuns, pixelCount};
    }

    function updateSelectionActive({cancelWork = false} = {}) {
      state.active = state.manualActive || state.hotkeyHeld;
      document.body?.classList.toggle('bm-paint-area-active', state.active);
      if (!state.active) {
        state.dragging = false;
        state.pointerID = null;
        removeMarquee();
        if (cancelWork) {
          state.fillRevision++;
          state.busy = false;
          state.pendingRequestID = null;
        }
      }
      if (!state.busy) {
        setButtonState(state.active ? 'active' : 'idle', state.active
          ? 'Stop selecting matching template areas'
          : 'Select matching template area');
      }
    }

    function isEditableTarget(target) {
      return (target instanceof Element) && !!target.closest('input, textarea, select, [contenteditable="true"]');
    }

    function handleHotkeyDown(event) {
      if ((event.code != state.hotkeyCode) || event.repeat || state.hotkeyHeld || !state.toggleButton || state.toggleButton.hidden) {return;}
      if (document.body?.classList.contains('bm-hotkey-recording') || isEditableTarget(event.target)) {return;}
      event.preventDefault();
      event.stopImmediatePropagation();
      state.hotkeyHeld = true;
      updateSelectionActive();
    }

    function releaseHotkey(event = null) {
      if (!state.hotkeyHeld || (event && (event.code != state.hotkeyCode))) {return;}
      event?.preventDefault();
      event?.stopImmediatePropagation();
      state.hotkeyHeld = false;
      updateSelectionActive();
    }

    function ensureToggleButton() {
      if (state.toggleButton?.isConnected) {return state.toggleButton;}
      const button = document.createElement('button');
      button.id = 'bm-paint-area-toggle';
      button.type = 'button';
      button.className = 'bm-paint-area-toggle';
      button.innerHTML = selectAreaIcon;
      button.hidden = true;
      button.onclick = async event => {
        event.preventDefault();
        event.stopPropagation();
        if (state.busy) {return;}
        if (!state.runtimeStore?.['map']) {await discoverWplaceRuntime();}
        if (!state.runtimeStore?.['map']) {
          setButtonState('error', 'Wplace paint runtime is unavailable');
          return;
        }
        state.manualActive = !state.active;
        updateSelectionActive();
      };
      document.body?.appendChild(button);
      state.toggleButton = button;
      setButtonState('idle', 'Select matching template area');
      return button;
    }

    async function discoverWplaceRuntime() {
      if (state.runtimeStore?.['map']) {return state.runtimeStore['map'];}
      const resourceURLs = performance.getEntriesByType('resource').map(entry => entry.name);
      const preloadURLs = Array.from(document.querySelectorAll('link[rel="modulepreload"][href]'), link => link.href);
      const moduleURLs = Array.from(new Set([...resourceURLs, ...preloadURLs].filter(url => {
        try {
          const parsedURL = new URL(url, window.location.href);
          return (parsedURL.origin == window.location.origin)
            && parsedURL.pathname.includes('/_app/immutable/chunks/')
            && parsedURL.pathname.endsWith('.js');
        } catch {
          return false;
        }
      })));

      for (const moduleURL of moduleURLs) {
        if (scannedModuleURLs.has(moduleURL)) {continue;}
        scannedModuleURLs.add(moduleURL);
        try {
          const module = await import(moduleURL);
          for (const candidate of Object.values(module)) {
            if (!candidate || ((typeof candidate != 'object') && (typeof candidate != 'function'))) {continue;}
            try {
              if (!state.runtimeStore && ('automatedClicks' in candidate) && ('map' in candidate)) {
                state.runtimeStore = candidate;
              }
              if (!state.userStore && ('charges' in candidate) && ('data' in candidate) && (typeof candidate['refresh'] == 'function')) {
                state.userStore = candidate;
              }
            } catch {}
          }
          if (state.runtimeStore?.['map'] && state.userStore) {break;}
        } catch {}
      }
      return state.runtimeStore?.['map'] ?? null;
    }

    function getPaintClickListener(map) {
      const listeners = map?.['_listeners']?.['click'];
      if (!Array.isArray(listeners)) {return null;}
      return listeners.slice().reverse().find(listener => {
        try {
          const source = Function.prototype.toString.call(listener);
          return source.includes('automatedClicks') && source.includes('originalEvent');
        } catch {
          return false;
        }
      }) ?? null;
    }

    function getTileZoom(map) {
      const pixelSource = map?.['getSource']?.('pixel-art-layer');
      const tileZoom = Number(pixelSource?.['maxzoom'] ?? pixelSource?.['_options']?.['maxzoom']);
      return Number.isFinite(tileZoom) ? tileZoom : 11;
    }

    function latLonToWorldPixel(lat, lng, tileZoom) {
      const halfWorldMeters = Math.PI * 6378137;
      const initialResolution = (2 * halfWorldMeters) / tileSize;
      const metersX = (lng / 180) * halfWorldMeters;
      const metersY = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180) * halfWorldMeters / 180;
      const resolution = initialResolution / (2 ** tileZoom);
      return [
        Math.floor((metersX + halfWorldMeters) / resolution),
        Math.floor((halfWorldMeters - metersY) / resolution)
      ];
    }

    function worldPixelToLatLon(pixelX, pixelY, tileZoom) {
      const halfWorldMeters = Math.PI * 6378137;
      const initialResolution = (2 * halfWorldMeters) / tileSize;
      const resolution = initialResolution / (2 ** tileZoom);
      const metersX = (pixelX * resolution) - halfWorldMeters;
      const metersY = halfWorldMeters - (pixelY * resolution);
      const lng = (metersX / halfWorldMeters) * 180;
      let lat = (metersY / halfWorldMeters) * 180;
      lat = (180 / Math.PI) * ((2 * Math.atan(Math.exp((lat * Math.PI) / 180))) - (Math.PI / 2));
      return {'lat': lat, 'lng': lng};
    }

    function clientPointToWorldPixel(map, clientX, clientY) {
      const canvas = map['getCanvas']();
      const rect = canvas.getBoundingClientRect();
      const lngLat = map['unproject']([clientX - rect.left, clientY - rect.top]);
      return latLonToWorldPixel(lngLat['lat'], lngLat['lng'], getTileZoom(map));
    }

    function updateMarquee() {
      if (!state.dragStart || !state.dragEnd) {return;}
      if (!state.marquee) {
        state.marquee = document.createElement('div');
        state.marquee.className = 'bm-paint-area-marquee';
        document.body.appendChild(state.marquee);
      }
      const left = Math.min(state.dragStart.x, state.dragEnd.x);
      const top = Math.min(state.dragStart.y, state.dragEnd.y);
      const width = Math.abs(state.dragStart.x - state.dragEnd.x);
      const height = Math.abs(state.dragStart.y - state.dragEnd.y);
      state.marquee.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      state.marquee.style.width = `${Math.max(1, width)}px`;
      state.marquee.style.height = `${Math.max(1, height)}px`;
    }

    function isMapCanvasTarget(target, map) {
      return (target instanceof Node) && !!map?.['getCanvasContainer']?.().contains(target);
    }

    function handlePointerDown(event) {
      const map = state.runtimeStore?.['map'];
      if (!state.active || state.busy || !map || (event.button != 0) || !event.isTrusted || !isMapCanvasTarget(event.target, map)) {return;}
      event.preventDefault();
      event.stopImmediatePropagation();
      state.dragging = true;
      state.pointerID = event.pointerId;
      state.dragStart = {x: event.clientX, y: event.clientY};
      state.dragEnd = {...state.dragStart};
      state.trustedEvent = event;
      state.suppressClickUntil = Date.now() + 750;
      setButtonState('selecting', 'Selecting template area');
      updateMarquee();
    }

    function handlePointerMove(event) {
      if (!state.dragging || (event.pointerId != state.pointerID)) {return;}
      event.preventDefault();
      event.stopImmediatePropagation();
      state.dragEnd = {x: event.clientX, y: event.clientY};
      state.trustedEvent = event;
      updateMarquee();
    }

    function handlePointerUp(event) {
      const map = state.runtimeStore?.['map'];
      if (!state.dragging || !map || (event.pointerId != state.pointerID)) {return;}
      event.preventDefault();
      event.stopImmediatePropagation();
      state.dragging = false;
      state.pointerID = null;
      state.dragEnd = {x: event.clientX, y: event.clientY};
      state.trustedEvent = event;
      state.suppressClickUntil = Date.now() + 750;
      removeMarquee();

      const colorID = Number(localStorage.getItem('selected-color'));
      if (!Number.isInteger(colorID) || (colorID <= 0)) {
        setButtonState('error', 'Select a non-transparent Wplace color first');
        return;
      }

      const startPixel = clientPointToWorldPixel(map, state.dragStart.x, state.dragStart.y);
      const endPixel = clientPointToWorldPixel(map, state.dragEnd.x, state.dragEnd.y);
      const budget = getAvailableDraftPixels();
      if (budget.charges == null) {
        showAreaAlert('Could not determine available Wplace pixels. Try again after the charge counter loads.');
        return;
      }
      if (budget.available <= 0) {
        showAreaAlert('No Wplace pixels are available. Paint or clear the current draft before selecting another area.');
        return;
      }
      const requestID = crypto.randomUUID();
      state.pendingRequestID = requestID;
      state.busy = true;
      setButtonState('loading', 'Finding matching template pixels');
      window.postMessage({
        source: 'blue-marble',
        action: 'paint-area-selected',
        requestID,
        colorID,
        maxPixels: Math.min(100001, budget.charges + 1),
        bounds: {
          minX: Math.min(startPixel[0], endPixel[0]),
          minY: Math.min(startPixel[1], endPixel[1]),
          maxX: Math.max(startPixel[0], endPixel[0]),
          maxY: Math.max(startPixel[1], endPixel[1])
        }
      }, '*');
    }

    function handleClickCapture(event) {
      const map = state.runtimeStore?.['map'];
      if (!state.active || !map || !isMapCanvasTarget(event.target, map)) {return;}
      if (state.dragging || (Date.now() <= state.suppressClickUntil)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    function handleDraftActionCapture(event) {
      const button = (event.target instanceof Element) ? event.target.closest('button') : null;
      if (!button || (button == state.toggleButton)) {return;}
      const label = String(button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase();
      if ((label == 'clear') || (label == 'clear draft')) {
        queueMicrotask(resetQueuedDraftPixels);
      }
    }

    function beginPreviewCoalescing(map) {
      const serviceWorkers = navigator.serviceWorker;
      const controller = serviceWorkers?.controller;
      const originalPostMessage = controller?.postMessage;
      const originalRefreshTiles = map?.['refreshTiles'];
      let latestPreviewMessage = null;
      let pendingSourceID = null;
      let postMessagePatched = false;
      let refreshPatched = false;

      try {
        if (controller && (typeof originalPostMessage == 'function')) {
          controller.postMessage = function(message, ...args) {
            if (message?.['type'] == 'previewPixels') {
              latestPreviewMessage = message;
              queueMicrotask(() => serviceWorkers.dispatchEvent(new MessageEvent('message', {'data': {'id': message['id']}})));
              return;
            }
            return originalPostMessage.call(this, message, ...args);
          };
          postMessagePatched = true;
        }
      } catch {}

      try {
        if (map && (typeof originalRefreshTiles == 'function')) {
          map['refreshTiles'] = function(sourceID) {
            pendingSourceID = sourceID ?? pendingSourceID;
            return this;
          };
          refreshPatched = true;
        }
      } catch {}

      const restore = () => {
        if (postMessagePatched) {controller.postMessage = originalPostMessage;}
        if (refreshPatched) {map['refreshTiles'] = originalRefreshTiles;}
      };

      const flush = async () => {
        restore();
        if (latestPreviewMessage && controller && (typeof originalPostMessage == 'function')) {
          await new Promise(resolve => {
            const finish = () => {
              clearTimeout(timeoutID);
              serviceWorkers.removeEventListener('message', responseHandler);
              resolve();
            };
            const responseHandler = event => {
              if (event.data?.['id'] == latestPreviewMessage['id']) {finish();}
            };
            const timeoutID = setTimeout(finish, 1200);
            serviceWorkers.addEventListener('message', responseHandler);
            originalPostMessage.call(controller, latestPreviewMessage);
          });
        }
        if (map && (typeof originalRefreshTiles == 'function')) {
          originalRefreshTiles.call(map, pendingSourceID ?? 'pixel-art-layer');
        }
      };

      return {flush, restore};
    }

    async function fillPaintDraft(data) {
      if (data.requestID != state.pendingRequestID) {return;}
      const map = state.runtimeStore?.['map'] ?? await discoverWplaceRuntime();
      const paintClickListener = getPaintClickListener(map);
      if (!map || !paintClickListener) {throw new Error('Wplace paint handler is unavailable.');}

      const selectedColorID = Number(localStorage.getItem('selected-color'));
      if (selectedColorID != Number(data.colorID)) {throw new Error('Selected Wplace color changed during area scan.');}

      const budget = getAvailableDraftPixels();
      if (budget.charges == null) {
        state.pendingRequestID = null;
        state.busy = false;
        showAreaAlert('Could not determine available Wplace pixels. Nothing was added.');
        return;
      }

      const prepared = prepareDraftRuns(Array.isArray(data.runs) ? data.runs : [], budget.available);
      if (prepared.exceeded) {
        state.pendingRequestID = null;
        state.busy = false;
        showAreaAlert(`Selected area exceeds the available pixel limit (${budget.available}). Nothing was added.`);
        return;
      }

      const runs = prepared.runs;
      const fillRevision = ++state.fillRevision;
      const previousMuted = state.runtimeStore['muted'];
      const preview = beginPreviewCoalescing(map);
      state.runtimeStore['muted'] = true;
      state.busy = true;
      setButtonState('filling', `Adding ${Number(data.pixelCount) || 0} pixels to Wplace draft`);
      let queuedPixels = 0;
      let workSliceStarted = performance.now();

      try {
        for (const run of runs) {
          const worldY = Number(run?.[0]);
          const startX = Number(run?.[1]);
          const endX = Number(run?.[2]);
          if (![worldY, startX, endX].every(Number.isFinite)) {continue;}

          for (let worldX = startX; worldX <= endX; worldX++) {
            if (fillRevision != state.fillRevision) {return;}
            const lngLat = worldPixelToLatLon(worldX + 0.5, worldY + 0.5, getTileZoom(map));
            const point = map['project']({'lng': lngLat['lng'], 'lat': lngLat['lat']});
            paintClickListener.call(map, {
              'type': 'click',
              'target': map,
              'originalEvent': state.trustedEvent,
              'lngLat': lngLat,
              'point': point
            });
            state.queuedDraftPixels.add(`${worldX},${worldY}`);
            queuedPixels++;

            if ((performance.now() - workSliceStarted) >= 5) {
              await nextFrame();
              workSliceStarted = performance.now();
            }
          }
        }

        await Promise.resolve();
        await nextFrame();
        await preview.flush();
        state.pendingRequestID = null;
        state.busy = false;
        setButtonState('success', queuedPixels
          ? `Processed ${queuedPixels} matching pixels in Wplace draft`
          : 'No matching template pixels in selected area');
        setTimeout(() => {
          if (!state.busy) {
            setButtonState(state.active ? 'active' : 'idle', state.active
              ? 'Stop selecting matching template areas'
              : 'Select matching template area');
          }
        }, 1600);
      } finally {
        preview.restore();
        state.runtimeStore['muted'] = previousMuted;
        if (fillRevision == state.fillRevision) {state.busy = false;}
      }
    }

    window.addEventListener('message', event => {
      const data = event.data;
      if (data?.source != 'blue-marble') {return;}
      if (data.action == 'paint-area-hotkey-setting') {
        const hotkeyCode = String(data.code ?? '');
        if (!/^[A-Za-z][A-Za-z0-9]{1,31}$/.test(hotkeyCode)) {return;}
        state.hotkeyHeld = false;
        state.hotkeyCode = hotkeyCode;
        updateSelectionActive();
      } else if (data.action == 'paint-area-fill') {
        void fillPaintDraft(data).catch(error => {
          if (data.requestID != state.pendingRequestID) {return;}
          state.pendingRequestID = null;
          state.busy = false;
          setButtonState('error', error instanceof Error ? error.message : String(error));
        });
      } else if ((data.action == 'paint-area-error') && (data.requestID == state.pendingRequestID)) {
        state.pendingRequestID = null;
        state.busy = false;
        setButtonState('error', data.message || 'Could not fill selected area');
      }
    });

    async function syncPaintMode() {
      state.syncFrame = null;
      const paintModeVisible = !!document.querySelector('#color-1');
      if (paintModeVisible) {await discoverWplaceRuntime();}
      const button = ensureToggleButton();
      button.hidden = !paintModeVisible;
      if (!paintModeVisible && (state.active || state.busy)) {
        state.manualActive = false;
        state.hotkeyHeld = false;
        updateSelectionActive({cancelWork: true});
        resetQueuedDraftPixels();
        removeAreaAlert();
      }
    }

    const schedulePaintModeSync = () => {
      if (state.syncFrame != null) {return;}
      state.syncFrame = requestAnimationFrame(() => void syncPaintMode());
    };
    const paintModeObserver = new MutationObserver(schedulePaintModeSync);
    paintModeObserver.observe(document.documentElement, {childList: true, subtree: true});
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('pointerup', handlePointerUp, true);
    window.addEventListener('pointercancel', handlePointerUp, true);
    window.addEventListener('click', handleClickCapture, true);
    window.addEventListener('click', handleDraftActionCapture, true);
    window.addEventListener('keydown', handleHotkeyDown, true);
    window.addEventListener('keyup', releaseHotkey, true);
    window.addEventListener('blur', () => releaseHotkey());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState == 'hidden') {releaseHotkey();}
    });
    schedulePaintModeSync();
  }

  setupPaintAreaBridge();

  // Spys on "spontaneous" fetch requests made by the client
  const originalFetch = window.fetch; // Saves a copy of the original fetch

  // Overrides fetch
  window.fetch = async function(...args) {

    const endpointName = ((args[0] instanceof Request) ? args[0]?.url : args[0])?.toString() || 'ignore';
    let fetchArgs = args;
    let requestRefreshRevision = 0;

    if (tileRefreshRevision && endpointName.includes('/tiles/') && !endpointName.includes('openfreemap') && !endpointName.includes('maps')) {
      try {
        const refreshedURL = new URL(endpointName, window.location.href);
        refreshedURL.searchParams.set('bm-revision', tileRefreshRevision.toString());
        const refreshedInput = args[0] instanceof Request
          ? new Request(refreshedURL.toString(), args[0])
          : refreshedURL.toString();
        fetchArgs = [refreshedInput, ...args.slice(1)];
        requestRefreshRevision = tileRefreshRevision;
      } catch (error) {
        console.warn(`%c${name}%c: Failed to revise tile URL`, consoleStyle, '', error);
      }
    }

    if (requestRefreshRevision) {
      window.postMessage({
        source: 'blue-marble',
        action: 'refresh-progress',
        revision: requestRefreshRevision,
        state: 'started'
      }, '*');
    }

    let refreshCompletionSent = false;
    const completeRefreshRequest = () => {
      if (!requestRefreshRevision || refreshCompletionSent) {return;}
      refreshCompletionSent = true;
      window.postMessage({
        source: 'blue-marble',
        action: 'refresh-progress',
        revision: requestRefreshRevision,
        state: 'completed'
      }, '*');
    };

    let response;
    try {
      response = await originalFetch.apply(this, fetchArgs); // Sends a fetch
    } catch (error) {
      completeRefreshRequest();
      throw error;
    }
    const cloned = response.clone(); // Makes a copy of the response

    // Check Content-Type to only process JSON
    const contentType = cloned.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {


      // Since this code does not run in the userscript, we can't use consoleLog().
      console.log(`%c${name}%c: Sending JSON message about endpoint "${endpointName}"`, consoleStyle, '');

      // Sends a message about the endpoint it spied on
      cloned.json()
        .then(jsonData => {
          const endpointText = endpointName?.split('?')[0].split('/').filter(s => s && isNaN(Number(s))).filter(s => s && !s.includes('.')).pop();

          // Cache the latest /me payload so the userscript can hydrate its UI
          // even if the first response arrives before listeners are attached.
          if (endpointText == 'me') {
            try {
              sessionStorage.setItem('bm-last-me', JSON.stringify(jsonData));
            } catch (error) {
              console.warn(`%c${name}%c: Failed to cache "/me" payload`, consoleStyle, '', error);
            }
          }

          window.postMessage({
            source: 'blue-marble',
            endpoint: endpointName,
            jsonData: jsonData
          }, '*');
        })
        .catch(err => {
          console.error(`%c${name}%c: Failed to parse JSON: `, consoleStyle, '', err);
        });
    } else if (contentType.includes('image/') && (!endpointName.includes('openfreemap') && !endpointName.includes('maps'))) {
      // Fetch custom for all images but opensourcemap

      const blink = Date.now(); // Current time

      const blob = await cloned.blob(); // The original blob

      // Since this code does not run in the userscript, we can't use consoleLog().
      console.log(`%c${name}%c: ${fetchedBlobQueue.size} Sending IMAGE message about endpoint "${endpointName}"`, consoleStyle, '');

      // Returns the manipulated blob
      return new Promise((resolve) => {
        const blobUUID = crypto.randomUUID(); // Generates a random UUID

        // Store the blob while we wait for processing
        fetchedBlobQueue.set(blobUUID, (blobProcessed) => {
          // The response that triggers when the blob is finished processing

          // Creates a new response
          resolve(new Response(blobProcessed, {
            headers: cloned.headers,
            status: cloned.status,
            statusText: cloned.statusText
          }));

          // Since this code does not run in the userscript, we can't use consoleLog().
          console.log(`%c${name}%c: ${fetchedBlobQueue.size} Processed blob "${blobUUID}"`, consoleStyle, '');
          completeRefreshRequest();
        });

        window.postMessage({
          source: 'blue-marble',
          endpoint: endpointName,
          blobID: blobUUID,
          blobData: blob,
          blink: blink
        });
      }).catch(exception => {
        completeRefreshRequest();
        const elapsed = Date.now();
        console.error(`%c${name}%c: Failed to Promise blob!`, consoleStyle, '');
        console.groupCollapsed(`%c${name}%c: Details of failed blob Promise:`, consoleStyle, '');
        console.log(`Endpoint: ${endpointName}\nThere are ${fetchedBlobQueue.size} blobs processing...\nBlink: ${blink.toLocaleString()}\nTime Since Blink: ${String(Math.floor(elapsed/60000)).padStart(2,'0')}:${String(Math.floor(elapsed/1000) % 60).padStart(2,'0')}.${String(elapsed % 1000).padStart(3,'0')} MM:SS.mmm`);
        console.error(`Exception stack:`, exception);
        console.groupEnd();
      });

      // cloned.blob().then(blob => {
      //   window.postMessage({
      //     source: 'blue-marble',
      //     endpoint: endpointName,
      //     blobData: blob
      //   }, '*');
      // });
    }

    completeRefreshRequest();
    return response; // Returns the original response
  };
});

// Imports the CSS file from dist folder on github
const cssOverlay = GM_getResourceText("CSS-BM-File");
GM_addStyle(cssOverlay);

function appendFontStylesheet(href) {
  const stylesheetLink = document.createElement('link');
  stylesheetLink.href = href;
  stylesheetLink.rel = 'preload';
  stylesheetLink.as = 'style';
  stylesheetLink.onload = function () {
    this.onload = null;
    this.rel = 'stylesheet';
  };
  document.head?.appendChild(stylesheetLink);
}

// Injection point for the Roboto Mono font file (only if this is the Standalone version)
const robotoMonoInjectionPoint = 'robotoMonoInjectionPoint';

appendFontStylesheet('https://fonts.googleapis.com/css2?family=Michroma&family=Rajdhani:wght@400;500;600;700&display=swap');

// If the Roboto Mono injection point contains '@font-face'...
if (!!(robotoMonoInjectionPoint.indexOf('@font-face') + 1)) {
  // A very hacky way of doing truthy/falsy logic
  
  console.log(`Loading Roboto Mono as a file...`);
  GM_addStyle(robotoMonoInjectionPoint); // Add the Roboto Mono font-faces that were injected.
} else {
  // Else, no Roboto Mono was found. We need to use a stylesheet.
  
  // Imports the Roboto Mono font family as a stylesheet
  appendFontStylesheet('https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,100..700;1,100..700&display=swap');
}

function readStoredJSON(key, fallback = {}) {
  try {
    const storedValue = GM_getValue(key, JSON.stringify(fallback));
    const parsedValue = typeof storedValue == 'string' ? JSON.parse(storedValue) : storedValue;
    return parsedValue && typeof parsedValue == 'object' ? parsedValue : structuredClone(fallback);
  } catch (error) {
    consoleWarn(`Could not parse userscript storage "${key}".`, error);
    return structuredClone(fallback);
  }
}

const userSettings = readStoredJSON('bmUserSettings'); // Loads the user settings
const runtimeMarkerID = 'bm-userscript-runtime';
const existingRuntimeMarker = document.querySelector('meta[data-blue-marble-runtime]');
const shouldInitializeRuntime = !existingRuntimeMarker;

if (!shouldInitializeRuntime) {
  consoleWarn(`%c${name}%c: A userscript runtime is already active; skipping duplicate initialization.`, consoleStyle, '');
}

if (shouldInitializeRuntime) {
void (async () => {
let runtimeMarker = null;
let heartbeatInterval = null;
let activeWindowMain = null;
let activeTelemetryWindow = null;
let stopSpontaneousResponseListener = null;
let stopBlackObserver = null;
let stopPaintAreaSelectionBridge = null;

try {

// CONSTRUCTORS
const observers = new Observers(); // Constructs a new Observers object
const windowMain = new WindowMain(name, version); // Constructs a new Overlay object for the main overlay
activeWindowMain = windowMain;
const templateManager = new TemplateManager(name, version); // Constructs a new TemplateManager object
const apiManager = new ApiManager(templateManager); // Constructs a new ApiManager object
const settingsManager = new SettingsManager(name, version, userSettings); // Constructs a new SettingsManager

windowMain.setSettingsManager(settingsManager); // Sets the settings manager
windowMain.setApiManager(apiManager); // Sets the API manager

templateManager.setWindowMain(windowMain);
templateManager.setSettingsManager(settingsManager); // Sets the settings manager
stopPaintAreaSelectionBridge = templateManager.startPaintAreaSelectionBridge();

const storageTemplates = readStoredJSON('bmTemplates');
console.log(storageTemplates);

runtimeMarker = document.createElement('meta');
runtimeMarker.id = runtimeMarkerID;
runtimeMarker.dataset['version'] = version;
runtimeMarker.dataset['blueMarbleRuntime'] = 'true';
runtimeMarker.dataset['runtimeState'] = 'initializing';
document.documentElement.appendChild(runtimeMarker);


console.log(userSettings);
console.log(Object.keys(userSettings).length);

// If the user does not have a UUID yet, make a new one.
if (Object.keys(userSettings).length == 0) {
  const uuid = crypto.randomUUID(); // Generates a random UUID
  console.log(uuid);
  await GM.setValue('bmUserSettings', JSON.stringify({
    'uuid': uuid
  }));
}

heartbeatInterval = setInterval(() => apiManager.sendHeartbeat(version), 1000 * 60 * 30); // Sends a heartbeat every 30 minutes

// The current "version" of the data collection agreement
// Increment by 1 to retrigger the telemetry window
const currentTelemetryVersion = 1;

// The last "version" of the data collection agreement that the user agreed too
const previousTelemetryVersion = userSettings?.telemetry;
console.log(`Telemetry is ${!(previousTelemetryVersion == undefined)}`);

// If the user has not agreed to the current data collection terms, we need to show the Telemetry window.
if ((previousTelemetryVersion == undefined) || (previousTelemetryVersion > currentTelemetryVersion)) {
  const windowTelemetry = new WindowTelemetry(name, version, currentTelemetryVersion, userSettings?.uuid);
  activeTelemetryWindow = windowTelemetry;
  windowTelemetry.setApiManager(apiManager);
  await windowTelemetry.buildWindow(); // Asks the user if they want to enable telemetry
}

await initializeBlueMarble();
runtimeMarker.dataset['runtimeState'] = 'ready';

async function initializeBlueMarble() {
  let templateImportError = null;
  let templateImportWarning = null;
  try {
    await templateManager.importJSON(storageTemplates); // Loads the templates
    if (templateManager.getTemplateStatisticsState() == 'degraded') {
      templateImportWarning = 'Some stored templates were damaged and could not be loaded.';
    }
  } catch (error) {
    templateImportError = error;
    console.error('Blue Marble: Could not import stored templates.', error);
  }

  stopSpontaneousResponseListener = apiManager.spontaneousResponseListener(windowMain); // Reads spontaneous fetch responces

  windowMain.buildWindow(); // Builds the main Blue Marble window
  windowMain.buildWindowFilter({'respectSavedVisibility': true}); // Restores the Color Filter window only if it was open before reload

  if (templateImportError) {
    windowMain.handleDisplayError(`Stored templates could not be loaded: ${templateImportError instanceof Error ? templateImportError.message : String(templateImportError)}`);
  } else if (templateImportWarning) {
    windowMain.handleDisplayError(templateImportWarning);
  }

  apiManager.applyCachedUserData(windowMain); // Hydrates the UI from the earliest cached /me response if it exists
  void apiManager.requestCurrentUserData(windowMain); // Ensures the main window gets current /me data even if startup missed it

  stopBlackObserver = observeBlack(); // Observes the black palette color

  consoleLog(`%c${name}%c (${version}) userscript has loaded!`, 'color: cornflowerblue;', '');
}

/** Observe the black color, and add the "Move" button.
 * @since 0.66.3
 */
function observeBlack() {
  const observer = new MutationObserver((mutations, observer) => {

    const black = document.querySelector('#color-1'); // Attempt to retrieve the black color element for anchoring

    if (!black) {return;} // Black color does not exist yet. Kills iteself

    let move = document.querySelector('#bm-button-move'); // Tries to find the move button

    // If the move button does not exist, we make a new one
    if (!move) {
      move = document.createElement('button');
      move.id = 'bm-button-move';
      move.textContent = 'Move ↑';
      move.className = 'btn btn-soft';
      move.onclick = function() {
        const roundedBox = this.parentNode.parentNode.parentNode.parentNode; // Obtains the rounded box
        const shouldMoveUp = (this.textContent == 'Move ↑');
        roundedBox.parentNode.className = roundedBox.parentNode.className.replace(shouldMoveUp ? 'bottom' : 'top', shouldMoveUp ? 'top' : 'bottom'); // Moves the rounded box to the top
        roundedBox.style.borderTopLeftRadius = shouldMoveUp ? '0px' : 'var(--radius-box)';
        roundedBox.style.borderTopRightRadius = shouldMoveUp ? '0px' : 'var(--radius-box)';
        roundedBox.style.borderBottomLeftRadius = shouldMoveUp ? 'var(--radius-box)' : '0px';
        roundedBox.style.borderBottomRightRadius = shouldMoveUp ? 'var(--radius-box)' : '0px';
        this.textContent = shouldMoveUp ? 'Move ↓' : 'Move ↑';
      }

      // Attempts to find the "Paint Pixel" element for anchoring
      const paintPixelContainer = black.parentNode?.parentNode?.parentNode?.parentNode;
      const paintPixel = paintPixelContainer?.querySelector('h2');

      paintPixel?.parentNode?.appendChild(move); // Adds the move button
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

} catch (error) {
  if (heartbeatInterval != null) {clearInterval(heartbeatInterval);}
  stopBlackObserver?.();
  stopSpontaneousResponseListener?.();
  stopPaintAreaSelectionBridge?.();
  activeWindowMain?.windowFilter?.dispose();
  document.getElementById(activeWindowMain?.windowID)?.remove();
  document.getElementById(activeTelemetryWindow?.windowID)?.remove();
  runtimeMarker?.remove();
  console.error('Blue Marble: Runtime initialization failed.', error);
}
})();
}
