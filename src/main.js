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
      const paintPixel = black.parentNode.parentNode.parentNode.parentNode.querySelector('h2');

      paintPixel.parentNode?.appendChild(move); // Adds the move button
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

} catch (error) {
  if (heartbeatInterval != null) {clearInterval(heartbeatInterval);}
  stopBlackObserver?.();
  stopSpontaneousResponseListener?.();
  activeWindowMain?.windowFilter?.dispose();
  document.getElementById(activeWindowMain?.windowID)?.remove();
  document.getElementById(activeTelemetryWindow?.windowID)?.remove();
  runtimeMarker?.remove();
  console.error('Blue Marble: Runtime initialization failed.', error);
}
})();
}
