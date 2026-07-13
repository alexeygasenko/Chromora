import SettingsManager from "./settingsManager";
import Template from "./Template";
import { base64ToUint8, colorpaletteForBlueMarble, consoleError, consoleLog, consoleWarn, localizeNumber, numberToEncoded, sleep, viewCanvasInNewTab } from "./utils";
import WindowMain from "./WindowMain";
import WindowWizard from "./WindowWizard";

/** Manages the template system.
 * This class handles all external requests for template modification, creation, and analysis.
 * It serves as the central coordinator between template instances and the user interface.
 * @class TemplateManager
 * @since 0.55.8
 * @example
 * // JSON structure for a template made in schema version 2.0.0.
 * // Note: The pixel "colors" Object contains more than 2 keys.
 * // Note: The template tiles are stored as base64 PNG images.
 * {
 *   "whoami": "BlueMarble",
 *   "scriptVersion": "1.13.0",
 *   "schemaVersion": "2.0.0",
 *   "templates": {
 *     "0 $Z": {
 *       "name": "My Template",
 *       "enabled": true,
 *       "pixels": {
 *         "total": 40399,
 *         "colors": {
 *           "-2": 40000,
 *           "0": 399
 *         }
 *       }
 *       "tiles": {
 *         "1231,0047,183,593": "iVBORw0KGgoAAAANSUhEUgAA",
 *         "1231,0048,183,000": "AAAFCAYAAACNbyblAAAAHElEQVQI12P4"
 *       }
 *     },
 *     "1 $Z": {
 *       "name": "My Template",
 *       "URL": "https://github.com/SwingTheVine/Wplace-BlueMarble/blob/main/dist/assets/Favicon.png",
 *       "URLType": "template",
 *       "enabled": false,
 *       "pixels": {
 *         "total": 40399,
 *         "colors": {
 *           "-2": 40000,
 *           "0": 399
 *         }
 *       }
 *       "tiles": {
 *         "375,1846,276,188": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",
 *         "376,1846,000,188": "data:image/png;AAAFCAYAAACNbyblAAAAHElEQVQI12P4"
 *       }
 *     }
 *   }
 * }
 * @example
 * // JSON structure for a template made in schema version 1.0.0.
 * // Note: The template tiles are stored as base64 PNG images.
 * {
 *   "whoami": "BlueMarble",
 *   "scriptVersion": "1.13.0",
 *   "schemaVersion": "1.0.0",
 *   "templates": {
 *     "0 $Z": {
 *       "name": "My Template",
 *       "enabled": true,
 *       "coords": "2000, 230, 45, 201"
 *       "palette": {
 *         "0,0,0": {
 *            "count": 123,
 *            "enabled": true
 *         },
 *         "255,255,255": {
 *            "count": 1315,
 *            "enabled": false
 *         }
 *       }
 *       "tiles": {
 *         "1231,0047,183,593": "iVBORw0KGgoAAAANSUhEUgAA",
 *         "1231,0048,183,000": "AAAFCAYAAACNbyblAAAAHElEQVQI12P4"
 *       }
 *     }
 *   }
 * }
 */
export default class TemplateManager {

  /** The constructor for the {@link TemplateManager} class.
   * @param {string} name - The name of the userscript
   * @param {string} version - The version of the userscript (SemVer as string)
   * @since 0.55.8
   */
  constructor(name, version) {

    // Meta
    this.name = name; // Name of userscript
    this.version = version; // Version of userscript
    this.windowMain = null; // The main instance of the Overlay class
    this.settingsManager = null; // The main instance of the SettingsManager class
    this.schemaVersion = '2.0.0'; // Version of JSON schema
    this.userID = null; // The ID of the current user
    this.encodingBase = '!#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~'; // Characters to use for encoding/decoding
    this.tileSize = 1000; // The number of pixels in a tile. Assumes the tile is square
    this.drawMult = 3; // The enlarged size for each pixel. E.g. when "3", a 1x1 pixel becomes a 1x1 pixel inside a 3x3 area. MUST BE ODD
    this.paletteTolerance = 3; // Tolerance for how close an RGB value has to be in order to be considered a color. A tolerance of "3" means the sum of the RGB can be up to 3 away from the actual value.
    this.paletteBM = colorpaletteForBlueMarble(this.paletteTolerance); // Retrieves the color palette BM will use as an Object containing multiple Uint32Arrays
    
    // Template
    this.template = null; // The template image.
    this.templateState = ''; // The state of the template ('blob', 'proccessing', 'template', etc.)
    /** An Array of Template classes @type {Array<Template>} */
    this.templatesArray = []; // All Template instnaces currently loaded (Template)
    this.templatesJSON = null; // All templates currently loaded (JSON)
    this.templatesShouldBeDrawn = true; // Should ALL templates be drawn to the canvas?
    this.templatePixelsCorrect = null; // An object where the keys are the tile coords, and the values are Maps (BM palette color IDs) containing the amount of correctly placed pixels for that tile in this template
    /** Will contain all color ID's to filter @type {Map<number, boolean>} */
    this.shouldFilterColor = new Map();
    this.highlightIncorrectColorID = null; // Restricts incorrect-pixel highlighting to one template color when set
    this.highlightIncorrectMode = 'incorrect'; // Either "incorrect" or "missing" when color-specific highlighting is active
    this.incorrectHighlightStencilCache = new Map();
    this.canvasRefreshRevision = 0;
    this.templateStatisticsState = 'idle';
    this.templateChangeListeners = new Set();
    this.paintAreaMessageHandler = null;
    this.paintAreaAbortController = null;
  }

  /** Updates the stored instance of the main window.
   * @param {WindowMain} windowMain - The main window instance
   * @since 0.91.54
   */
  setWindowMain(windowMain) {
    this.windowMain = windowMain;
  }

  /** Updates the stored instance of the SettingsManager.
   * @param {SettingsManager} settingsManager - The settings manager instance
   * @since 0.91.54
   */
  setSettingsManager(settingsManager) {
    this.settingsManager = settingsManager;
    this.#restoreFilteredColorsFromSettings();
  }

  /** Subscribes to template readiness changes.
   * @param {function({reason: string, state: string}):void} listener
   * @returns {function():void} Unsubscribe callback
   * @since 0.99.0
   */
  onTemplatesChanged(listener) {
    if (typeof listener != 'function') {return () => {};}
    this.templateChangeListeners.add(listener);
    return () => this.templateChangeListeners.delete(listener);
  }

  /** Returns whether template statistics are idle, loading, ready, degraded, or failed.
   * @returns {'idle' | 'loading' | 'ready' | 'degraded' | 'error'}
   * @since 0.99.0
   */
  getTemplateStatisticsState() {
    return this.templateStatisticsState;
  }

  /** Notifies UI owners without coupling TemplateManager to a specific window.
   * @param {string} reason
   * @since 0.99.0
   */
  #emitTemplatesChanged(reason) {
    const detail = {reason: reason, state: this.templateStatisticsState};
    for (const listener of this.templateChangeListeners) {
      try {
        listener(detail);
      } catch (error) {
        consoleWarn('A template-change listener failed.', error);
      }
    }
  }

  /** Starts the bridge that turns a user-selected map rectangle into Wplace draft pixels.
   * @returns {function():void} Cleanup callback
   * @since 0.99.0
   */
  startPaintAreaSelectionBridge() {
    if (this.paintAreaMessageHandler) {
      return () => this.stopPaintAreaSelectionBridge();
    }

    this.paintAreaMessageHandler = event => {
      const data = event.data;
      if ((data?.source != 'blue-marble') || (data?.action != 'paint-area-selected')) {return;}

      this.paintAreaAbortController?.abort();
      const abortController = new AbortController();
      this.paintAreaAbortController = abortController;
      void this.#processPaintAreaSelection(data, abortController.signal);
    };

    window.addEventListener('message', this.paintAreaMessageHandler);
    return () => this.stopPaintAreaSelectionBridge();
  }

  /** Stops area-selection work and removes its message listener.
   * @since 0.99.0
   */
  stopPaintAreaSelectionBridge() {
    this.paintAreaAbortController?.abort();
    this.paintAreaAbortController = null;
    if (!this.paintAreaMessageHandler) {return;}
    window.removeEventListener('message', this.paintAreaMessageHandler);
    this.paintAreaMessageHandler = null;
  }

  /** Finds unpainted template pixels inside inclusive world-pixel bounds.
   * Results are left-to-right vertical runs: [colorID, worldX, worldYStart, worldYEnd].
   * @param {{minX:number, minY:number, maxX:number, maxY:number}} bounds
   * @param {number|null} colorID
   * @param {Object} [options={}] - Scan options
   * @param {'matching'|'template'} [options.mode='matching'] - Selected color only, or every template color
   * @param {number} [options.maxPixels=100000] - Maximum number of pixels to return
   * @param {AbortSignal} [options.signal] - Optional cancellation signal
   * @returns {Promise<Object>} Compact runs and their total pixel count
   * @since 1.1.0
   */
  async findTemplatePixelRuns(bounds, colorID, {mode = 'matching', maxPixels = 100000, signal} = {}) {
    const normalizedMode = mode == 'template' ? 'template' : 'matching';
    const normalizedColorID = Number(colorID);
    if ((normalizedMode == 'matching') && (!Number.isInteger(normalizedColorID) || (normalizedColorID <= 0))) {
      throw new TypeError('Select a non-transparent Wplace color first.');
    }

    const normalizedBounds = {
      minX: Math.floor(Math.min(Number(bounds?.minX), Number(bounds?.maxX))),
      minY: Math.floor(Math.min(Number(bounds?.minY), Number(bounds?.maxY))),
      maxX: Math.floor(Math.max(Number(bounds?.minX), Number(bounds?.maxX))),
      maxY: Math.floor(Math.max(Number(bounds?.minY), Number(bounds?.maxY)))
    };
    if (!Object.values(normalizedBounds).every(Number.isFinite)) {
      throw new TypeError('Selected map area has invalid coordinates.');
    }

    const pixelLimit = Math.max(1, Math.min(Math.floor(Number(maxPixels) || 1), 100001));
    const chunkDescriptors = [];
    const runs = [];
    let pixelCount = 0;
    let workSliceStarted = performance.now();
    const chunkEntries = value => value instanceof Map
      ? value.entries()
      : Object.entries(value ?? {});
    const centerOffset = Math.floor(this.drawMult / 2);

    let chunkOrder = 0;
    for (let templateOrder = 0; templateOrder < this.templatesArray.length; templateOrder++) {
      const template = this.templatesArray[templateOrder];
      for (const [chunkKey, pixelBuffer] of chunkEntries(template?.chunked32)) {
        if (signal?.aborted) {throw new DOMException('Area selection cancelled.', 'AbortError');}
        if (!(pixelBuffer instanceof Uint32Array)) {continue;}

        const [tileX, tileY, pixelX, pixelY] = String(chunkKey).split(',').map(Number);
        if (![tileX, tileY, pixelX, pixelY].every(Number.isFinite)) {continue;}

        const bitmap = template?.chunked instanceof Map
          ? template.chunked.get(chunkKey)
          : template?.chunked?.[chunkKey];
        const bitmapWidth = Number(bitmap?.width);
        const bitmapHeight = Number(bitmap?.height);
        if (!Number.isFinite(bitmapWidth) || !Number.isFinite(bitmapHeight) || !bitmapWidth || !bitmapHeight) {continue;}

        const chunkWidth = Math.floor(bitmapWidth / this.drawMult);
        const chunkHeight = Math.floor(bitmapHeight / this.drawMult);
        const pixelState = template?.pixelStateByChunk?.get(chunkKey);
        if (!(pixelState instanceof Uint8Array) || (pixelState.length != (chunkWidth * chunkHeight))) {continue;}
        const chunkMinX = (tileX * this.tileSize) + pixelX;
        const chunkMinY = (tileY * this.tileSize) + pixelY;
        const localMinX = Math.max(0, normalizedBounds.minX - chunkMinX);
        const localMinY = Math.max(0, normalizedBounds.minY - chunkMinY);
        const localMaxX = Math.min(chunkWidth - 1, normalizedBounds.maxX - chunkMinX);
        const localMaxY = Math.min(chunkHeight - 1, normalizedBounds.maxY - chunkMinY);
        if ((localMinX > localMaxX) || (localMinY > localMaxY)) {continue;}

        chunkDescriptors.push({
          templateOrder: templateOrder,
          chunkOrder: chunkOrder++,
          pixelBuffer: pixelBuffer,
          pixelState: pixelState,
          bitmapWidth: bitmapWidth,
          chunkWidth: chunkWidth,
          chunkMinX: chunkMinX,
          chunkMinY: chunkMinY,
          localMinY: localMinY,
          localMaxY: localMaxY,
          currentWorldX: chunkMinX + localMinX,
          maxWorldX: chunkMinX + localMaxX
        });
      }
    }

    const compareDescriptors = (left, right) => (left.currentWorldX - right.currentWorldX)
      || (left.templateOrder - right.templateOrder)
      || (left.chunkOrder - right.chunkOrder);
    const pushHeap = (heap, value, compare) => {
      heap.push(value);
      let index = heap.length - 1;
      while (index > 0) {
        const parentIndex = Math.floor((index - 1) / 2);
        if (compare(heap[parentIndex], heap[index]) <= 0) {break;}
        [heap[parentIndex], heap[index]] = [heap[index], heap[parentIndex]];
        index = parentIndex;
      }
    };
    const popHeap = (heap, compare) => {
      const first = heap[0];
      const last = heap.pop();
      if (heap.length && last) {
        heap[0] = last;
        let index = 0;
        while (true) {
          const leftIndex = (index * 2) + 1;
          const rightIndex = leftIndex + 1;
          let smallestIndex = index;
          if ((leftIndex < heap.length) && (compare(heap[leftIndex], heap[smallestIndex]) < 0)) {
            smallestIndex = leftIndex;
          }
          if ((rightIndex < heap.length) && (compare(heap[rightIndex], heap[smallestIndex]) < 0)) {
            smallestIndex = rightIndex;
          }
          if (smallestIndex == index) {break;}
          [heap[index], heap[smallestIndex]] = [heap[smallestIndex], heap[index]];
          index = smallestIndex;
        }
      }
      return first;
    };

    const descriptorHeap = [];
    for (const descriptor of chunkDescriptors) {pushHeap(descriptorHeap, descriptor, compareDescriptors);}

    while (descriptorHeap.length) {
      if (signal?.aborted) {throw new DOMException('Area selection cancelled.', 'AbortError');}
      const worldX = descriptorHeap[0].currentWorldX;
      const descriptorsAtX = [];
      while (descriptorHeap.length && (descriptorHeap[0].currentWorldX == worldX)) {
        descriptorsAtX.push(popHeap(descriptorHeap, compareDescriptors));
      }

      const compareColumnPixels = (left, right) => (left.worldY - right.worldY)
        || (left.templateOrder - right.templateOrder)
        || (left.chunkOrder - right.chunkOrder);
      const columnPixelHeap = [];
      const queueNextColumnPixel = stream => {
        const descriptor = stream.descriptor;
        while (stream.localY <= descriptor.localMaxY) {
          const localY = stream.localY++;
          if (descriptor.pixelState[(localY * descriptor.chunkWidth) + stream.localX] != 2) {continue;}
          const bufferY = (localY * this.drawMult) + centerOffset;
          const packedColor = descriptor.pixelBuffer[(bufferY * descriptor.bitmapWidth) + stream.bufferX];
          const templateColorID = this.paletteBM.LUT.get(packedColor);
          if (!Number.isInteger(templateColorID) || (templateColorID <= 0)) {continue;}
          if ((normalizedMode == 'matching') && (templateColorID != normalizedColorID)) {continue;}
          pushHeap(columnPixelHeap, {
            worldY: descriptor.chunkMinY + localY,
            colorID: templateColorID,
            templateOrder: descriptor.templateOrder,
            chunkOrder: descriptor.chunkOrder,
            stream: stream
          }, compareColumnPixels);
          return;
        }
      };

      for (const descriptor of descriptorsAtX) {
        const localX = worldX - descriptor.chunkMinX;
        queueNextColumnPixel({
          descriptor: descriptor,
          localX: localX,
          localY: descriptor.localMinY,
          bufferX: (localX * this.drawMult) + centerOffset
        });
        descriptor.currentWorldX++;
        if (descriptor.currentWorldX <= descriptor.maxWorldX) {pushHeap(descriptorHeap, descriptor, compareDescriptors);}

        if ((performance.now() - workSliceStarted) >= 4) {
          await this.#yieldToBrowser();
          workSliceStarted = performance.now();
        }
      }

      let previousWorldY = null;
      while (columnPixelHeap.length) {
        const pixel = popHeap(columnPixelHeap, compareColumnPixels);
        queueNextColumnPixel(pixel.stream);
        if ((performance.now() - workSliceStarted) >= 4) {
          await this.#yieldToBrowser();
          workSliceStarted = performance.now();
        }
        if (pixel.worldY == previousWorldY) {continue;}
        previousWorldY = pixel.worldY;
        const previousRun = runs[runs.length - 1];
        if (previousRun
          && (previousRun[0] == pixel.colorID)
          && (previousRun[1] == worldX)
          && ((previousRun[3] + 1) == pixel.worldY)) {
          previousRun[3] = pixel.worldY;
        } else {
          runs.push([pixel.colorID, worldX, pixel.worldY, pixel.worldY]);
        }
        pixelCount++;
        if (pixelCount >= pixelLimit) {return {runs, pixelCount};}
      }

      if ((performance.now() - workSliceStarted) >= 4) {
        await this.#yieldToBrowser();
        workSliceStarted = performance.now();
      }
    }

    return {runs, pixelCount};
  }

  /** Resolves a map selection and sends compact matching runs back to the page bridge.
   * @param {Object} data
   * @param {AbortSignal} signal
   * @since 0.99.0
   */
  async #processPaintAreaSelection(data, signal) {
    try {
      const result = await this.findTemplatePixelRuns(data.bounds, data.colorID, {
        mode: data.mode,
        maxPixels: data.maxPixels,
        signal: signal
      });
      if (signal.aborted) {return;}
      window.postMessage({
        source: 'blue-marble',
        action: 'paint-area-fill',
        requestID: data.requestID,
        mode: data.mode == 'template' ? 'template' : 'matching',
        colorID: Number(data.colorID),
        runs: result.runs,
        pixelCount: result.pixelCount
      }, '*');
    } catch (error) {
      if (signal.aborted || (error?.name == 'AbortError')) {return;}
      window.postMessage({
        source: 'blue-marble',
        action: 'paint-area-error',
        requestID: data.requestID,
        mode: data.mode == 'template' ? 'template' : 'matching',
        message: error instanceof Error ? error.message : String(error)
      }, '*');
    }
  }

  /** Restores hidden colors from persisted user settings.
   * @since 0.92.1
   */
  #restoreFilteredColorsFromSettings() {
    const storedFilter = this.settingsManager?.userSettings?.filter;
    const filteredColors = Array.isArray(storedFilter) ? storedFilter : [];

    this.shouldFilterColor.clear();

    for (const colorID of filteredColors) {
      const parsedColorID = Number(colorID);
      if (!Number.isFinite(parsedColorID)) {continue;}
      this.shouldFilterColor.set(parsedColorID, true);
    }
  }

  /** Persists hidden colors to user settings storage.
   * @since 0.92.1
   */
  #persistFilteredColors() {
    if (!this.settingsManager) {return;}

    this.settingsManager.userSettings.filter = Array.from(this.shouldFilterColor.keys())
      .map(colorID => Number(colorID))
      .filter(colorID => Number.isFinite(colorID))
      .sort((a, b) => a - b);

    void this.settingsManager.saveUserStorageNow();
  }

  /** Updates whether a palette color should be hidden on the canvas.
   * @param {number} colorID
   * @param {boolean} shouldHide
   * @since 0.92.1
   */
  setColorFiltered(colorID, shouldHide) {
    const parsedColorID = Number(colorID);
    if (!Number.isFinite(parsedColorID)) {return;}

    if (shouldHide) {
      this.shouldFilterColor.set(parsedColorID, true);
    } else {
      this.shouldFilterColor.delete(parsedColorID);
    }

    this.#persistFilteredColors();
  }

  /** Updates many palette filters with one storage write.
   * @param {Iterable<number>} colorIDs
   * @param {boolean} shouldHide
   * @since 0.99.0
   */
  setColorsFiltered(colorIDs, shouldHide) {
    for (const colorID of colorIDs) {
      const parsedColorID = Number(colorID);
      if (!Number.isFinite(parsedColorID)) {continue;}

      if (shouldHide) {
        this.shouldFilterColor.set(parsedColorID, true);
      } else {
        this.shouldFilterColor.delete(parsedColorID);
      }
    }

    this.#persistFilteredColors();
  }

  /** Returns the color currently used to restrict incorrect-pixel highlighting.
   * @returns {number | null}
   * @since 0.97.0
   */
  getIncorrectHighlightColorID() {
    return this.highlightIncorrectColorID;
  }

  /** Returns the active color-specific highlight mode.
   * @returns {'incorrect' | 'missing'}
   * @since 0.97.0
   */
  getIncorrectHighlightMode() {
    return this.highlightIncorrectMode;
  }

  /** Restricts incorrect-pixel highlighting to one template color, or clears the restriction.
   * @param {number | null} colorID
   * @param {'incorrect' | 'missing'} [mode='incorrect']
   * @returns {number | null}
   * @since 0.97.0
   */
  setIncorrectHighlightColor(colorID, mode = 'incorrect') {
    if ((colorID === null) || (typeof colorID == 'undefined')) {
      this.highlightIncorrectColorID = null;
      this.highlightIncorrectMode = 'incorrect';
      return this.highlightIncorrectColorID;
    }

    const parsedColorID = Number(colorID);
    if (!Number.isFinite(parsedColorID) || (parsedColorID == 0)) {return this.highlightIncorrectColorID;}

    this.highlightIncorrectColorID = parsedColorID;
    this.highlightIncorrectMode = mode == 'missing' ? 'missing' : 'incorrect';
    return this.highlightIncorrectColorID;
  }

  /** Cycles the color currently used to restrict incorrect-pixel highlighting.
   * The cycle is: off -> all incorrect pixels -> missing transparent pixels -> off.
   * @param {number} colorID
   * @returns {{colorID: number | null, mode: 'incorrect' | 'missing'}}
   * @since 0.97.0
   */
  toggleIncorrectHighlightColor(colorID) {
    const parsedColorID = Number(colorID);
    if (!Number.isFinite(parsedColorID) || (parsedColorID == 0)) {
      return {colorID: this.highlightIncorrectColorID, mode: this.highlightIncorrectMode};
    }

    if (this.highlightIncorrectColorID != parsedColorID) {
      this.setIncorrectHighlightColor(parsedColorID, 'incorrect');
    } else if (this.highlightIncorrectMode == 'incorrect') {
      this.setIncorrectHighlightColor(parsedColorID, 'missing');
    } else {
      this.setIncorrectHighlightColor(null);
    }

    return {colorID: this.highlightIncorrectColorID, mode: this.highlightIncorrectMode};
  }

  /** Invalidates visible map tiles and resolves after refreshed tile rendering settles.
   * @returns {Promise<void>}
   * @since 0.98.0
   */
  requestCanvasRefresh() {
    this.canvasRefreshRevision = (this.canvasRefreshRevision + 1) >>> 0;
    const revision = this.canvasRefreshRevision;

    return new Promise(resolve => {
      let started = 0;
      let completed = 0;
      let settleTimer = null;
      let noWorkTimer = null;
      let hardTimeout = null;

      const finish = () => {
        clearTimeout(settleTimer);
        clearTimeout(noWorkTimer);
        clearTimeout(hardTimeout);
        window.removeEventListener('message', handleProgress);
        resolve();
      };
      const scheduleSettle = () => {
        if (!started || (completed < started)) {return;}
        clearTimeout(settleTimer);
        settleTimer = setTimeout(finish, 180);
      };
      const handleProgress = event => {
        const data = event.data;
        if ((data?.source != 'blue-marble') || (data?.action != 'refresh-progress') || (Number(data?.revision) != revision)) {return;}

        if (data.state == 'started') {
          started++;
          clearTimeout(noWorkTimer);
          clearTimeout(settleTimer);
        } else if (data.state == 'completed') {
          completed++;
          scheduleSettle();
        }
      };

      window.addEventListener('message', handleProgress);
      noWorkTimer = setTimeout(finish, 1200);
      hardTimeout = setTimeout(finish, 10000);
      window.postMessage({
        source: 'blue-marble',
        action: 'refresh-tiles',
        revision: revision
      }, '*');
    });
  }

  /** Creates the JSON object to store templates in
   * @returns {{ whoami: string, scriptVersion: string, schemaVersion: string, templates: Object }} The JSON object
   * @since 0.65.4
   */
  async createJSON() {
    return {
      "whoami": this.name.replace(' ', ''), // Name of userscript without spaces
      "scriptVersion": this.version, // Version of userscript
      "schemaVersion": this.schemaVersion, // Version of JSON schema
      "templates": {} // The templates
    };
  }

  /** Creates the template from the inputed file blob
   * @param {File} blob - The file blob to create a template from
   * @param {string} name - The display name of the template
   * @param {Array<number, number, number, number>} coords - The coordinates of the top left corner of the template
   * @since 0.65.77
   */
  async createTemplate(blob, name, coords) {

    this.templateStatisticsState = 'loading';
    this.#emitTemplatesChanged('create-started');

    try {
      const hasWritableTemplateStore = ['BlueMarble', 'Chromora'].includes(this.templatesJSON?.whoami)
        && this.templatesJSON?.schemaVersion == this.schemaVersion
        && this.templatesJSON?.templates
        && (typeof this.templatesJSON.templates == 'object')
        && !Array.isArray(this.templatesJSON.templates);

      // Rebuilds missing, stale, or damaged storage before writing a new template.
      if (!hasWritableTemplateStore) {this.templatesJSON = await this.createJSON(); console.log(`Creating JSON...`);}

      this.windowMain.handleDisplayStatus(`Creating template at ${coords.join(', ')}...`);

      // Creates a new template instance
      const template = new Template({
        displayName: name,
        sortID: 0, // Object.keys(this.templatesJSON.templates).length || 0, // Uncomment this to enable multiple templates (1/2)
        authorID: numberToEncoded(this.userID || 0, this.encodingBase),
        file: blob,
        coords: coords
      });

      // Does the user want to skip transparent tiles while creating templates?
      const shouldSkipTransTiles = !this.settingsManager?.userSettings?.flags?.includes('hl-noSkip');

      // Does the user want to aggressively skip transparent tiles while creating templates?
      const shouldAggSkipTransTiles = this.settingsManager?.userSettings?.flags?.includes('hl-agSkip');

      console.log(`Should Skip: ${shouldSkipTransTiles}; Should Agg Skip: ${shouldAggSkipTransTiles}`);

      const { templateTiles, templateTilesBuffers } = await template.createTemplateTiles(this.tileSize, this.paletteBM, shouldSkipTransTiles, shouldAggSkipTransTiles); // Chunks the tiles
    
      template.chunked = templateTiles; // Stores the chunked tile bitmaps

      // Converts total pixel Object/Map variables into JSON-ready format
      const _pixels = { "total": template.pixelCount.total, "colors": Object.fromEntries(template.pixelCount.colors) }

      // Appends a child into the templates object
      // The child's name is the number of templates already in the list (sort order) plus the encoded player ID
      this.templatesJSON.templates[`${template.sortID} ${template.authorID}`] = {
        "name": template.displayName, // Display name of template
        "coords": coords.join(', '), // The coords of the template
        "enabled": true,
        "pixels": _pixels, // The total pixels in the template
        "tiles": templateTilesBuffers // Stores the chunked tile buffers
      };

      this.templatesArray = []; // Remove this to enable multiple templates (2/2)
      this.templatesArray.push(template); // Pushes the Template object instance to the Template Array

      this.windowMain.handleDisplayStatus(`Template created at ${coords.join(', ')}!`);

      console.log(Object.keys(this.templatesJSON.templates).length);
      console.log(this.templatesJSON);
      console.log(this.templatesArray);
      console.log(JSON.stringify(this.templatesJSON));

      await this.#storeTemplates();
      this.templateStatisticsState = 'ready';
      this.#emitTemplatesChanged('created');
      return template;
    } catch (error) {
      this.templateStatisticsState = 'error';
      this.#emitTemplatesChanged('create-failed');
      throw error;
    }
  }

  /** Generates a {@link Template} class instance from the JSON object template.
   * {@link createTemplate()} will create a class instance and save to template storage.
   * `#loadTemplate()` will create a class instance without saving to the template storage.
   * @param {Object} template - The template to load
   * @since 0.88.504
   */
  #loadTemplate(templateObject) {

    // Calculates the pixel count
    const pixelCount = {
      total: templateObject.pixels?.total,
      colors: new Map(Object.entries(templateObject.pixels?.colors || {}).map(([key, value]) => [Number(key), value]))
    };

    // Creates the template
    const template = new Template({
      displayName: templateObject.displayName,
      sortID: Object.keys(this.templatesJSON.templates).length || 0,
      authorID: numberToEncoded(this.userID || 0, this.encodingBase),
      pixelCount: pixelCount,
      chunked: templateObject.tiles
    });

    template.calculateCoordsFromChunked(); // Updates `Template.coords`

    this.templatesArray.push(template);
  }

  /** Stores the JSON object of the loaded templates into TamperMonkey (GreaseMonkey) storage.
   * @since 0.72.7
   */
  async #storeTemplates() {
    await GM.setValue('bmTemplates', JSON.stringify(this.templatesJSON));
  }

  /** Deletes a template from the JSON object.
   * Also delete's the corrosponding {@link Template} class instance
   */
  deleteTemplate() {

  }

  /** Disables the template from view
   */
  async disableTemplate() {

    // Creates the JSON object if it does not already exist
    if (!this.templatesJSON) {this.templatesJSON = await this.createJSON(); console.log(`Creating JSON...`);}


  }

  /** Downloads all templates loaded.
   * @since 0.88.499
   */
  async downloadAllTemplates() {

    consoleLog(`Downloading all templates...`);

    console.log(this.templatesArray);

    // For each template loaded...
    for (const template of this.templatesArray) {

      await this.downloadTemplate(template); // Downloads the template

      await sleep(500); // Avoids download throttling from the browser
    }
  }

  /** Downloads all templates from Blue Marble's template storage.
   * @since 0.88.474
   */
  async downloadAllTemplatesFromStorage() {

    // Templates in user storage
    const templates = JSON.parse(GM_getValue('bmTemplates', '{}'))?.templates;

    console.log(templates);

    // If there is at least one template loaded...
    if (Object.keys(templates).length > 0) {

      // For each template loaded...
      for (const [key, template] of Object.entries(templates)) {

        // If the template is a direct child of the templates Object...
        if (templates.hasOwnProperty(key)) {
          
          // Downloads the template using a dummy Template instance
          await this.downloadTemplate(new Template({
            displayName: template.name,
            sortID: key.split(' ')?.[0],
            authorID: key.split(' ')?.[1],
            chunked: template.tiles
          }));

          await sleep(500); // Avoids download throttling from the browser
        }
      }
    }
  }

  /** Downloads the template passed-in.
   * @param {Template} template - The template class instance to download
   * @since 0.88.499
   */
  async downloadTemplate(template) {

    template.calculateCoordsFromChunked(); // Updates `Template.coords`

    // Constructs the file name to download as
    const templateFileName = `${template.coords.join('-')}_${template.displayName.replaceAll(' ', '-')}`;

    // Converts `Template.chunked` to a blob
    const blob = await this.convertTemplateToBlob(template);

    // Downloads the template
    await GM.download({
      url: URL.createObjectURL(blob),
      name: templateFileName + '.png',
      conflictAction: 'uniquify',
      onload: () => {consoleLog(`Download of template '${templateFileName}' complete!`);},
      onerror: (error, details) => {consoleError(`Download of template '${templateFileName}' failed because ${error}! Details: ${details}`);},
      ontimeout: () => {consoleWarn(`Download of template '${templateFileName}' has timed out!`);}
    });
  }

  /** Converts a Template class instance into a Blob. 
   * Specifically, this takes `Template.chunked` and converts it to a Blob.
   * @since 0.88.504
   * @returns {Promise<Blob>} A Promise of a Blob PNG image of the template
   */
  async convertTemplateToBlob(template) {

    console.log(template);

    const templateTiles64 = template.chunked; // Tiles of template image as base 64

    // Sorts the keys of the tiles (Object -> Array)
    const templateTileKeysSorted = Object.keys(templateTiles64).sort();

    // Turns the base64 tiles into Images
    const templateTilesImageSorted = await Promise.all(templateTileKeysSorted.map(tileKey => convertBase64ToImage(templateTiles64[tileKey])));

    // Absolute pixel coordinates for smallest (top left) and largest (bottom right) pixel coordinates
    let absoluteSmallestX = Infinity;
    let absoluteSmallestY = Infinity;
    let absoluteLargestX = 0;
    let absoluteLargestY = 0;

    // Calculates the minimum and maximum (X, Y) absolute coordinates
    templateTileKeysSorted.forEach((key, index) => {

      // Deconstructs the tile coordinates
      const [tileX, tileY, pixelX, pixelY] = key.split(',').map(Number);

      const tileImage = templateTilesImageSorted[index]; // Obtains the image for this tile

      // Calculates the absolute pixel coordinates for this tile
      const absoluteX = (tileX * this.tileSize) + pixelX;
      const absoluteY = (tileY * this.tileSize) + pixelY;

      // Record the smallest/largest absolute coordinates if and only if this tile is the smallest/largest. Otherwise, use previous best
      absoluteSmallestX = Math.min(absoluteSmallestX, absoluteX);
      absoluteSmallestY = Math.min(absoluteSmallestY, absoluteY);
      absoluteLargestX = Math.max(absoluteLargestX, absoluteX + (tileImage.width / this.drawMult));
      absoluteLargestY = Math.max(absoluteLargestY, absoluteY + (tileImage.height / this.drawMult));
    })

    console.log(`Absolute coordinates: (${absoluteSmallestX}, ${absoluteSmallestY}) and (${absoluteLargestX}, ${absoluteLargestY})`);

    // Calculates the template/canvas width and height
    const templateWidth = absoluteLargestX - absoluteSmallestX;
    const templateHeight = absoluteLargestY - absoluteSmallestY;
    const canvasWidth = templateWidth * this.drawMult;
    const canvasHeight = templateHeight * this.drawMult;

    console.log(`Template Width: ${templateWidth}\nTemplate Height: ${templateHeight}\nCanvas Width: ${canvasWidth}\nCanvas Height: ${canvasHeight}`);

    // Creates a new canvas the size of the template
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const context = canvas.getContext('2d');

    // For each tile...
    templateTileKeysSorted.forEach((key, index) => {

      // Deconstructs the tile coordinates
      const [tileX, tileY, pixelX, pixelY] = key.split(',').map(Number);

      const tileImage = templateTilesImageSorted[index]; // Obtains the image for this tile

      // Calculates the absolute pixel coordinates for this tile
      const absoluteX = (tileX * this.tileSize) + pixelX;
      const absoluteY = (tileY * this.tileSize) + pixelY;

      console.log(`Drawing tile (${tileX}, ${tileY}, ${pixelX}, ${pixelY}) (${absoluteX}, ${absoluteY}) at (${absoluteX - absoluteSmallestX}, ${absoluteY - absoluteSmallestY}) on the canvas...`);

      // Draws the tile to the canvas
      context.drawImage(tileImage, (absoluteX - absoluteSmallestX) * this.drawMult, (absoluteY - absoluteSmallestY) * this.drawMult, tileImage.width, tileImage.height);
    })

    // The expanded template is now on the canvas

    context.globalCompositeOperation = "destination-over"; // Draw under the canvas (new draws only show in place of transparent pixels)

    // Extends the template vertically to create columns
    context.drawImage(canvas, 0, -1);
    context.drawImage(canvas, 0, 1);

    // Extends the columns horizontally to become a solid template
    context.drawImage(canvas, -1, 0);
    context.drawImage(canvas, 1, 0);

    const smallCanvas = new OffscreenCanvas(templateWidth, templateHeight);
    const smallContext = smallCanvas.getContext("2d");

    smallContext.imageSmoothingEnabled = false; // Forces nearest neighbor scaling algorithm

    // Downscale the template
    smallContext.drawImage(
      canvas,
      0, 0, templateWidth * this.drawMult, templateHeight * this.drawMult, // Source image size
      0, 0, templateWidth, templateHeight // Small canvas size
    );

    // Returns a blob
    return smallCanvas.convertToBlob({ type: 'image/png' });

    /** Turns a chunked base 64 string template tile into an Image template tile
     * @param {string} base64 - Base64 string of image data (without URI header)
     * @since 0.88.474
     * @returns {Promise} Promise to load a new Image()
     */
    function convertBase64ToImage(base64) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = "data:image/png;base64," + base64;
      });
    }
  }

  /** Draws all templates on the specified tile.
   * This method handles the rendering of template overlays on individual tiles.
   * @param {File} tileBlob - The pixels that are placed on a tile
   * @param {Array<number>} tileCoords - The tile coordinates [x, y]
   * @since 0.65.77
   */
  async drawTemplateOnTile(tileBlob, tileCoords) {

    // Returns early if no templates should be drawn
    if (!this.templatesShouldBeDrawn) {return tileBlob;}

    const drawSize = this.tileSize * this.drawMult; // Calculate draw multiplier for scaling
    const numericTileCoords = [Number(tileCoords[0]) || 0, Number(tileCoords[1]) || 0];

    // Format tile coordinates with proper padding for consistent lookup
    tileCoords = numericTileCoords[0].toString().padStart(4, '0') + ',' + numericTileCoords[1].toString().padStart(4, '0');

    console.log(`Searching for templates in tile: "${tileCoords}"`);

    const templateArray = this.templatesArray; // Stores a copy for sorting
    console.log(templateArray);

    // Sorts the array of Template class instances. 0 = first = lowest draw priority
    templateArray.sort((a, b) => {return a.sortID - b.sortID;});

    console.log(templateArray);

    // Retrieves the relavent template tile blobs
    const templatesToDraw = templateArray
      .map(template => {
        const matchingTiles = Object.keys(template.chunked).filter(tile =>
          tile.startsWith(tileCoords)
        );

        if (matchingTiles.length === 0) {return null;} // Return null when nothing is found

        // Retrieves the blobs of the templates for this tile
        const matchingTileBlobs = matchingTiles.map(tile => {

          const coords = tile.split(','); // [x, y, x, y] Tile/pixel coordinates
          
          return {
            instance: template,
            bitmap: template.chunked[tile],
            chunked32: template.chunked32?.[tile],
            chunkKey: tile,
            tileCoords: [coords[0], coords[1]],
            pixelCoords: [coords[2], coords[3]]
          }
        });

        return matchingTileBlobs?.[0];
      })
    .filter(Boolean);

    console.log(templatesToDraw);

    const templateCount = templatesToDraw?.length || 0; // Number of templates to draw on this tile
    console.log(`templateCount = ${templateCount}`);

    if (templateCount > 0) {
      
      // Calculate total pixel count for templates actively being displayed in this tile
      const totalPixels = templateArray
        .filter(template => {
          // Filter templates to include only those with tiles matching current coordinates
          // This ensures we count pixels only for templates actually being rendered
          const matchingTiles = Object.keys(template.chunked).filter(tile =>
            tile.startsWith(tileCoords)
          );
          return matchingTiles.length > 0;
        })
        .reduce((sum, template) => sum + (template.pixelCount.total || 0), 0);
      
      // Format pixel count with locale-appropriate thousands separators for better readability
      // Examples: "1,234,567" (US), "1.234.567" (DE), "1 234 567" (FR)
      const pixelCountFormatted = localizeNumber(totalPixels);
      
      // Display status information about the templates being rendered
      this.windowMain.handleDisplayStatus(
        `Displaying ${templateCount} template${templateCount == 1 ? '' : 's'}.\nTotal pixels: ${pixelCountFormatted}`
      );
    } else {
      //this.overlay.handleDisplayStatus(`Displaying ${templateCount} templates.`);
      this.windowMain.handleDisplayStatus(`Sleeping\nVersion: ${this.version}`);
      return tileBlob; // No templates are on this tile. Return the original tile early
    }
    
    const tileBitmap = await createImageBitmap(tileBlob);

    const canvas = new OffscreenCanvas(drawSize, drawSize);
    const context = canvas.getContext('2d');

    context.imageSmoothingEnabled = false; // Nearest neighbor

    // Tells the canvas to ignore anything outside of this area
    context.beginPath();
    context.rect(0, 0, drawSize, drawSize);
    context.clip();

    context.clearRect(0, 0, drawSize, drawSize); // Draws transparent background
    context.drawImage(tileBitmap, 0, 0, drawSize, drawSize); // Draw tile to canvas

    const tileBeforeTemplates = context.getImageData(0, 0, drawSize, drawSize);
    const tileBeforeTemplates32 = new Uint32Array(tileBeforeTemplates.data.buffer);

    // Obtains the highlight pattern
    const highlightPattern = this.settingsManager?.userSettings?.highlight || [[2, 0, 0]];
    // The code demands that a highlight pattern always exists.
    // Therefore, to disable highlighting, the highlight pattern is `[[2, 0, 0]]`.
    // `[[2, 0, 0]]` is special, and will skip the highlighting code altogether.
    // As a side-effect, the template will always display while enabled.
    // You can't disable all sub-pixels in order to hide the template.

    // Contains the first index of the highlight pattern.
    const highlightPatternIndexZero = highlightPattern?.[0];
    // This is so we can later determine if the pattern is the preset "None"

    // Should highlighting be disabled?
    const highlightDisabled = (
      (highlightPattern?.length == 1)
      && (highlightPatternIndexZero?.[0] == 2)
      && (highlightPatternIndexZero?.[1] == 0)
      && (highlightPatternIndexZero?.[2] == 0)
    )
    const incorrectHighlightColorID = this.getIncorrectHighlightColorID();
    const hasIncorrectHighlightColor = Number.isFinite(incorrectHighlightColorID);
    const incorrectHighlightMode = this.getIncorrectHighlightMode();
    const fallbackHighlightPattern = [[1, 0, 1], [2, 0, 0], [1, -1, 0], [1, 1, 0], [1, 0, -1]];
    const effectiveHighlightPattern = (highlightDisabled && hasIncorrectHighlightColor) ? fallbackHighlightPattern : highlightPattern;
    
    // For each template in this tile, draw them.
    for (const template of templatesToDraw) {
      console.log(`Template:`);
      console.log(template);

      const templateHasErased = !!template.instance.pixelCount?.colors?.get(-1); // Does this template have Erased (#deface) pixels?

      // Obtains the template (for only this tile) as a Uint32Array
      let templateBeforeFilter32 = template.chunked32.slice();
      // Remove the `.slice()` and colors, once disabled, can never be re-enabled

      const coordXtoDrawAt = Number(template.pixelCoords[0]) * this.drawMult;
      const coordYtoDrawAt = Number(template.pixelCoords[1]) * this.drawMult;
      const templateOrigin = Array.isArray(template.instance.coords) ? template.instance.coords.map(Number) : null;
      const highlightGridOrigin = templateOrigin?.every(Number.isFinite)
        ? [
            (((numericTileCoords[0] - templateOrigin[0]) * this.tileSize) + Number(template.pixelCoords[0]) - templateOrigin[2]) * this.drawMult,
            (((numericTileCoords[1] - templateOrigin[1]) * this.tileSize) + Number(template.pixelCoords[1]) - templateOrigin[3]) * this.drawMult
          ]
        : [
            (numericTileCoords[0] * drawSize) + coordXtoDrawAt,
            (numericTileCoords[1] * drawSize) + coordYtoDrawAt
          ];

      // Draws the template to the tile if there are no colors to filter, and there are no Erased pixels
      if ((this.shouldFilterColor.size == 0) && !templateHasErased) {
        context.drawImage(template.bitmap, coordXtoDrawAt, coordYtoDrawAt);
      }

      // If we failed to get the template for this tile, we use a shoddy, buggy, failsafe
      if (!templateBeforeFilter32) {
        const templateBeforeFilter = context.getImageData(coordXtoDrawAt, coordYtoDrawAt, template.bitmap.width, template.bitmap.height);
        templateBeforeFilter32 = new Uint32Array(templateBeforeFilter.data.buffer);
      }

      // Take the pre-filter template ImageData + the pre-filter tile ImageData, and use that to calculate the correct pixels
      const timer = Date.now();
      const {
        correctPixels: pixelsCorrect,
        filteredTemplate: templateAfterFilter
      } = await this.#calculateCorrectPixelsOnTile_And_FilterTile({
        tile: tileBeforeTemplates32,
        template: templateBeforeFilter32,
        templateInfo: [coordXtoDrawAt, coordYtoDrawAt, template.bitmap.width, template.bitmap.height],
        highlightPattern: effectiveHighlightPattern,
        highlightDisabled: highlightDisabled && !hasIncorrectHighlightColor,
        highlightColorID: incorrectHighlightColorID,
        highlightMode: incorrectHighlightMode,
        highlightGridOrigin: highlightGridOrigin,
        pixelState: template.instance.pixelStateByChunk,
        chunkKey: template.chunkKey
      });

      let pixelsCorrectTotal = 0;
      const transparentColorID = 0;

      // For each color with correct pixels placed for this template...
      for (const [color, total] of pixelsCorrect) {

        if (color == transparentColorID) {continue;} // Skip Transparent color

        pixelsCorrectTotal += total; // Add the current total for this color to the summed total of all correct
      }

      // If there are colors to filter, then we draw the filtered template on the canvas
      // Or, if there are Erased (#deface) pixels, then we draw the modified template on the canvas
      // Or, if the user has enabled highlighting, then we draw the modified template on the canvas
      if ((this.shouldFilterColor.size != 0) || templateHasErased || !highlightDisabled || hasIncorrectHighlightColor) {
        console.log('Colors to filter: ', this.shouldFilterColor);
        //context.putImageData(new ImageData(new Uint8ClampedArray(templateAfterFilter.buffer), template.bitmap.width, template.bitmap.height), coordXtoDrawAt, coordYtoDrawAt);
        context.drawImage(await createImageBitmap(new ImageData(new Uint8ClampedArray(templateAfterFilter.buffer), template.bitmap.width, template.bitmap.height)), coordXtoDrawAt, coordYtoDrawAt);
      }

      console.log(`Finished calculating correct pixels & filtering colors for the tile ${tileCoords} in ${(Date.now() - timer) / 1000} seconds!\nThere are ${pixelsCorrectTotal} correct pixels.`);

      // If "correct" does not exist as a key of the object "pixelCount", we create it
      if (typeof template.instance.pixelCount['correct'] == 'undefined') {
        template.instance.pixelCount['correct'] = {};
      }

      // Adds the correct pixel Map to the template instance
      template.instance.pixelCount['correct'][tileCoords] = pixelsCorrect;
    }

    return await canvas.convertToBlob({ type: 'image/png' });
  }

  /** Imports the JSON object, and appends it to any JSON object already loaded
   * @param {string} json - The JSON string to parse
   */
  async importJSON(json) {

    console.log(`Importing JSON...`);
    console.log(json);

    this.templateStatisticsState = 'loading';
    this.#emitTemplatesChanged('import-started');
    const previousTemplatesJSON = this.templatesJSON;
    const previousTemplatesArray = this.templatesArray;

    try {
      // If the passed in JSON is a Blue Marble template object...
      if (['BlueMarble', 'Chromora'].includes(json?.whoami)) {
        const {templatesArray: importedTemplates, skippedTemplates} = await this.#parseBlueMarble(json); // ...parse the template object as Blue Marble
        if (Object.keys(json.templates).length && !importedTemplates.length) {
          throw new AggregateError(
            skippedTemplates.map(({error}) => error),
            'None of the stored templates could be loaded.'
          );
        }
        const importedJSON = skippedTemplates.length
          ? {...json, templates: {...json.templates}}
          : json;
        for (const {templateKey} of skippedTemplates) {
          delete importedJSON.templates[templateKey];
        }
        this.templatesJSON = importedJSON;
        this.templatesArray = importedTemplates;
        this.templateStatisticsState = skippedTemplates.length ? 'degraded' : 'ready';
        this.#emitTemplatesChanged(skippedTemplates.length ? 'imported-with-errors' : 'imported');
      } else {
        this.templatesJSON = await this.createJSON();
        this.templatesArray = [];
        this.templateStatisticsState = 'ready';
        this.#emitTemplatesChanged('imported');
      }
    } catch (error) {
      this.templatesJSON = previousTemplatesJSON;
      this.templatesArray = previousTemplatesArray;
      this.templateStatisticsState = 'error';
      this.#emitTemplatesChanged('import-failed');
      throw error;
    }
  }

  /** Parses the Blue Marble JSON object
   * @param {string} json - The JSON string to parse
   * @since 0.72.13
   */
  async #parseBlueMarble(json) {

    console.log(`Parsing BlueMarble...`);

    const templates = json?.templates;
    if (!templates || (typeof templates != 'object') || Array.isArray(templates)) {
      throw new TypeError('Stored template data has no valid templates object.');
    }

    console.log(`BlueMarble length: ${Object.keys(templates).length}`);

    const schemaVersion = json?.schemaVersion;
    if (typeof schemaVersion != 'string') {
      throw new TypeError('Stored template data has no valid schema version.');
    }
    const schemaVersionArray = schemaVersion.split(/[-\.\+]/); // SemVer -> string[]
    const schemaVersionBleedingEdge = this.schemaVersion.split(/[-\.\+]/); // SemVer -> string[]
    const scriptVersion = json?.scriptVersion;

    console.log(`BlueMarble Template Schema: ${schemaVersion}; Script Version: ${scriptVersion}`);

    // If MAJOR version is up-to-date...
    if (schemaVersionArray[0] == schemaVersionBleedingEdge[0]) {

      // If MINOR version is NOT up-to-date...
      if (schemaVersionArray[1] != schemaVersionBleedingEdge[1]) {

        // Spawns a new Template Wizard
        const windowWizard = new WindowWizard(this.name, this.version, this.schemaVersion, this);
        windowWizard.buildWindow();
      }

      // Load using the latest schema loader. It will be fine, probably...
      return await loadSchema({
        tileSize: this.tileSize,
        drawMult: this.drawMult,
        templatesArray: []
      });

    } else if (schemaVersionArray[0] < schemaVersionBleedingEdge[0]) {
      // Else if the MAJOR verison is out-of-date

      // Spawns a new Template Wizard
      const windowWizard = new WindowWizard(this.name, this.version, this.schemaVersion, this);
      windowWizard.buildWindow();
      throw new Error(`Template schema ${schemaVersion} must be migrated before loading.`);
    
    } else {
      // We don't know what the schema is. Unsupported?

      this.windowMain.handleDisplayError(`Template version ${schemaVersion} is unsupported.\nUse ${this.name} version ${scriptVersion} or load a new template.`);
      throw new Error(`Template schema ${schemaVersion} is unsupported.`);
    }

    /** Loads schema of Blue Marble template storage
     * @param {Object} params - Object containing parameters
     * @param {number} params.tileSize - Size of tile
     * @param {number} params.drawMult - Tile scale multiplier
     * @param {Array<Template>} params.templatesArray - Array of Template instances
     * @since 0.88.434
     */
    async function loadSchema({
      tileSize: tileSize,
      drawMult: drawMult,
      templatesArray: templatesArray
    }) {

      const skippedTemplates = [];

      // Each template is isolated so one damaged tile cannot block all remaining templates.
      for (const [templateKey, templateValue] of Object.entries(templates)) {
        console.log(`Template Key: ${templateKey}`);

        try {
          if (!templateValue || (typeof templateValue != 'object')) {
            throw new TypeError(`Template "${templateKey}" is not an object.`);
          }

            const templateKeyArray = templateKey.split(' '); // E.g., "0 $Z" -> ["0", "$Z"]
            const sortID = Number(templateKeyArray?.[0]); // Sort ID of the template
            const authorID = templateKeyArray?.[1] || '0'; // User ID of the person who exported the template
            const displayName = templateValue.name || `Template ${sortID || ''}`; // Display name of the template
            //const coords = templateValue?.coords?.split(',').map(Number); // "1,2,3,4" -> [1, 2, 3, 4]
  
            const pixelCount = {
              total: templateValue.pixels?.total,
              colors: new Map(Object.entries(templateValue.pixels?.colors || {}).map(([key, value]) => [Number(key), value]))
            };
  
            const tilesbase64 = templateValue.tiles ?? {};
            if ((typeof tilesbase64 != 'object') || Array.isArray(tilesbase64)) {
              throw new TypeError(`Template "${templateKey}" has no valid tiles object.`);
            }
            const templateTiles = {}; // Stores the template bitmap tiles for each tile.
            const templateTiles32 = {}; // Stores the template Uint32Array tiles for each tile.
  
            const actualTileSize = tileSize * drawMult;
  
            for (const tile of Object.keys(tilesbase64)) {
              console.log(tile);
                const encodedTemplateBase64 = tilesbase64[tile];
                const templateUint8Array = base64ToUint8(encodedTemplateBase64); // Base 64 -> Uint8Array
  
                const templateBlob = new Blob([templateUint8Array], { type: "image/png" }); // Uint8Array -> Blob
                const templateBitmap = await createImageBitmap(templateBlob) // Blob -> Bitmap
                templateTiles[tile] = templateBitmap;
  
                // Converts to Uint32Array
                const canvas = new OffscreenCanvas(actualTileSize, actualTileSize);
                const context = canvas.getContext('2d');
                context.drawImage(templateBitmap, 0, 0);
                const imageData = context.getImageData(0, 0, templateBitmap.width, templateBitmap.height);
                templateTiles32[tile] = new Uint32Array(imageData.data.buffer);
            }
  
            // Creates a new Template class instance
            const template = new Template({
              displayName: displayName,
              sortID: Number.isFinite(sortID) ? sortID : templatesArray.length,
              authorID: authorID || '',
              //coords: coords,
            });
            template.pixelCount = pixelCount;
            template.chunked = templateTiles;
            template.chunked32 = templateTiles32;
            
            templatesArray.push(template);
            console.log(templatesArray);
            console.log(`^^^ This ^^^`);
        } catch (error) {
          skippedTemplates.push({templateKey, error});
          console.warn(`Blue Marble: Skipping damaged template "${templateKey}".`, error);
        }
      }

      return {templatesArray, skippedTemplates};
    }
  }

  /** Parses the OSU! Place JSON object
   */
  #parseOSU() {

  }

  /** Sets the `templatesShouldBeDrawn` boolean to a value.
   * @param {boolean} value - The value to set the boolean to
   * @since 0.73.7
   */
  setTemplatesShouldBeDrawn(value) {
    this.templatesShouldBeDrawn = value;
  }

  /** Calculates the correct pixels on this tile.
   * In addition, this function filters colors based on user input.
   * In addition, this function modifies colors to properly display (#deface).
   * In addition, this function modifies incorrect pixels to display highlighting.
   * This function has multiple purposes only to reduce iterations of scans over every pixel on the template.
   * @param {Object} params - Object containing all parameters
   * @param {Uint32Array} params.tile - The tile without templates as a Uint32Array
   * @param {Uint32Array} params.template - The template without filtering as a Uint32Array
   * @param {Array<Number, Number, Number, Number>} params.templateInfo - Information about template location and size
   * @param {Array<number[]>} params.highlightPattern - The highlight pattern selected by the user
   * @param {boolean} params.highlightDisabled - Should highlighting be disabled?
   * @param {number | null} params.highlightColorID - Restricts highlighting to one template color when set
   * @param {'incorrect' | 'missing'} params.highlightMode - Which color-specific highlight mode to use
   * @param {Array<number>} params.highlightGridOrigin - Absolute subpixel origin used to keep 16x16 zones aligned across map tiles
   * @param {Map<string, Uint8Array>} params.pixelState - Cached current board state for each template pixel
   * @param {string} params.chunkKey - Template chunk key owning this tile fragment
   * @returns {Promise<{correctPixels: Map<number, number>, filteredTemplate: Uint32Array}>} A Map containing the color IDs (keys) and how many correct pixels there are for that color (values)
   */
  async #calculateCorrectPixelsOnTile_And_FilterTile({
    tile: tile32, 
    template: template32, 
    templateInfo: templateInformation,
    highlightPattern: highlightPattern,
    highlightDisabled: highlightDisabled,
    highlightColorID: highlightColorID = null,
    highlightMode: highlightMode = 'incorrect',
    highlightGridOrigin: highlightGridOrigin = null,
    pixelState: pixelStateByChunk = null,
    chunkKey: chunkKey = null
  }) {

    // Size of a pixel in actuality
    const pixelSize = this.drawMult;

    // Tile information
    const tileWidth = this.tileSize * pixelSize;
    const tileHeight = tileWidth;
    const tilePixelOffsetY = -1; // Shift off of target template pixel to target on tile. E.g. "-1" would be the pixel above the template pixel on the tile
    const tilePixelOffsetX = 0; // Shift off of target template pixel to target on tile. E.g. "-1" would be the pixel to the left of the template pixel on the tile

    // Template information
    const templateCoordX = templateInformation[0];
    const templateCoordY = templateInformation[1];
    const templateWidth = templateInformation[2];
    const templateHeight = templateInformation[3];
    const templatePixelWidth = Math.floor(templateWidth / pixelSize);
    const templatePixelHeight = Math.floor(templateHeight / pixelSize);
    const currentPixelState = new Uint8Array(templatePixelWidth * templatePixelHeight);
    const highlightGridOriginX = Number.isFinite(Number(highlightGridOrigin?.[0])) ? Number(highlightGridOrigin[0]) : templateCoordX;
    const highlightGridOriginY = Number.isFinite(Number(highlightGridOrigin?.[1])) ? Number(highlightGridOrigin[1]) : templateCoordY;
    const tolerance = this.paletteTolerance;

    //console.log(`TemplateX: ${templateCoordX}\nTemplateY: ${templateCoordY}\nStarting Row:${templateCoordY+tilePixelOffsetY}\nStarting Column:${templateCoordX+tilePixelOffsetX}`);

    // Obtains if the user wants to highlight tile pixels that are transparent, but the template pixel is not
    const shouldTransparentTilePixelsBeHighlighted = !this.settingsManager?.userSettings?.flags?.includes('hl-noTrans');
    // The actual logic of this boolean is "should all pixels be highlighted"
    const hasHighlightColorFilter = Number.isFinite(highlightColorID);

    const { palette: _, LUT: lookupTable } = this.paletteBM; // Obtains the palette and LUT

    // Makes a copy of the color palette Blue Marble uses, turns it into a Map, and adds data to count the amount of each color
    const _colorpalette = new Map(); // Temp color palette
    const incorrectHighlightColors = {
      cyan: 0xFFFFE774,
      blue: 0xFFFFB681,
      yellow: 0xFF5CFFFF,
      coral: 0xFF5252FF,
      white: 0xFFFFFFFF
    };
    const incorrectHighlightPhase = Math.floor(Date.now() / 150);
    const incorrectHighlights = [];
    const maxIncorrectHighlightMarkers = 900;
    const incorrectHighlightBucketSize = pixelSize * 10;
    const incorrectHighlightBucketStride = Math.ceil(templateWidth / incorrectHighlightBucketSize) + 2;
    const incorrectHighlightBuckets = new Set();
    const missingHighlightBucketSize = pixelSize * 16;
    const missingHighlightBuckets = new Map();
    const getMissingBucketKey = (bucketRow, bucketColumn) => {
      if ((bucketRow < 0) || (bucketColumn < 0)) {return -1;}
      const diagonal = bucketRow + bucketColumn;
      return ((diagonal * (diagonal + 1)) / 2) + bucketColumn;
    };
    const queueIncorrectHighlight = ({row, column}) => {
      if (incorrectHighlights.length >= maxIncorrectHighlightMarkers) {return;}

      const bucketKey = (Math.floor(row / incorrectHighlightBucketSize) * incorrectHighlightBucketStride)
        + Math.floor(column / incorrectHighlightBucketSize);
      if (incorrectHighlightBuckets.has(bucketKey)) {return;}

      incorrectHighlightBuckets.add(bucketKey);
      incorrectHighlights.push({
        row: row,
        column: column
      });
    };
    const queueMissingHighlight = ({row, column}) => {
      const bucketRow = Math.floor((highlightGridOriginY + row) / missingHighlightBucketSize);
      const bucketColumn = Math.floor((highlightGridOriginX + column) / missingHighlightBucketSize);
      const bucketKey = getMissingBucketKey(bucketRow, bucketColumn);
      const bucket = missingHighlightBuckets.get(bucketKey);

      if (bucket) {
        bucket.minRow = Math.min(bucket.minRow, row);
        bucket.maxRow = Math.max(bucket.maxRow, row);
        bucket.minColumn = Math.min(bucket.minColumn, column);
        bucket.maxColumn = Math.max(bucket.maxColumn, column);
        bucket.count++;
        return;
      }

      missingHighlightBuckets.set(bucketKey, {
        bucketRow: bucketRow,
        bucketColumn: bucketColumn,
        bucketKey: bucketKey,
        bucketSize: missingHighlightBucketSize,
        bucketTop: (bucketRow * missingHighlightBucketSize) - highlightGridOriginY,
        bucketLeft: (bucketColumn * missingHighlightBucketSize) - highlightGridOriginX,
        minRow: row,
        maxRow: row,
        minColumn: column,
        maxColumn: column,
        count: 1
      });
    };

    // For each center pixel...
    let workSliceStarted = performance.now();
    for (let templateRow = 1; templateRow < templateHeight; templateRow += pixelSize) {
      for (let templateColumn = 1; templateColumn < templateWidth; templateColumn += pixelSize) {
        // ROWS ARE VERTICAL. "ROWS" AS IN, LIKE ON A SPREADSHEET
        // COLUMNS ARE HORIZONTAL. "COLUMNS" AS IN, LIKE ON A SPREADSHEET
        // THE FIFTH ROW IS FIVE DOWN FROM THE ZEROTH ROW
        // THE THIRD COLUMN IS TO THE RIGHT OF THE FIRST COLUMN

        // The pixel on the tile to target (1 pixel above the template)
        const tileRow = (templateCoordY + templateRow) + tilePixelOffsetY; // (Template offset + current row) - 1
        const tileColumn = (templateCoordX + templateColumn) + tilePixelOffsetX; // Template offset + current column
        
        // Retrieves the targeted pixels
        const tilePixelAbove = tile32[(tileRow * tileWidth) + tileColumn];
        const templatePixel = template32[(templateRow * templateWidth) + templateColumn];

        // Obtains the alpha channel of the targeted pixels
        const templatePixelAlpha = (templatePixel >>> 24) & 0xFF;
        const tilePixelAlpha = (tilePixelAbove >>> 24) & 0xFF;

        // Finds the best matching color ID for the template pixel. If none is found, default to "-2"
        const bestTemplateColorID = lookupTable.get(templatePixel) ?? -2;

        // Finds the best matching color ID for the tile pixel. If none is found, default to "-2"
        const bestTileColorID = lookupTable.get(tilePixelAbove) ?? -2;

        const stateIndex = (Math.floor((templateRow - 1) / pixelSize) * templatePixelWidth)
          + Math.floor((templateColumn - 1) / pixelSize);
        if ((templatePixelAlpha > tolerance) && (bestTemplateColorID > 0)) {
          currentPixelState[stateIndex] = (tilePixelAlpha <= tolerance)
            ? 2
            : (bestTileColorID == bestTemplateColorID ? 1 : 3);
        }

        // -----     COLOR FILTER      -----
        // If this pixel on the template is a color the user wants to hide on the canvas...
        if (this.shouldFilterColor.get(bestTemplateColorID)) {

          // Sets template pixel to match tile background (which removes the template pixel from the user's view)
          template32[(templateRow * templateWidth) + templateColumn] = tilePixelAbove;
        }
        // -----  END OF COLOR FILTER  -----

        // -----        ERASED         -----
        // If this pixel on the template is the Erased (#deface) color...
        if (bestTemplateColorID == -1) {

          const blackTrans = 0x20000000; // Black translucent color for Erased pixels

          // If Erased color should be filtered
          if (this.shouldFilterColor.get(bestTemplateColorID)) {
            template32[(templateRow * templateWidth) + templateColumn] = 0x00000000; // Center (black, 0% opacity)
          } else {
            // Don't filter Erased color

            // If the tile row and tile column are even,
            // Or the tile row and tile column are odd...
            if (((tileRow / pixelSize) & 1) == ((tileColumn / pixelSize) & 1)) {

              // Sets the template pixels to be a semi-transparent, black grid
              template32[(templateRow * templateWidth) + templateColumn] = blackTrans; // Center
              template32[((templateRow - 1) * templateWidth) + (templateColumn - 1)] = blackTrans; // Top Left
              template32[((templateRow - 1) * templateWidth) + (templateColumn + 1)] = blackTrans; // Top Right
              template32[((templateRow + 1) * templateWidth) + (templateColumn - 1)] = blackTrans; // Bottom Left
              template32[((templateRow + 1) * templateWidth) + (templateColumn + 1)] = blackTrans; // Bottom Right
            } else {
              // Else, either the row or column is odd, and the other is even.

              // Sets the template pixels to the the inverse of a semi-transparent, black grid
              template32[(templateRow * templateWidth) + templateColumn] = 0x00000000; // Center (black, 0% opacity)
              template32[((templateRow - 1) * templateWidth) + (templateColumn)] = blackTrans; // Top Center
              template32[((templateRow + 1) * templateWidth) + (templateColumn)] = blackTrans; // Bottom Center
              template32[((templateRow) * templateWidth) + (templateColumn - 1)] = blackTrans; // Middle Left
              template32[((templateRow) * templateWidth) + (templateColumn + 1)] = blackTrans; // Middle Right
            }
          }
        }
        // -----     END OF ERASED     -----

        // -----     HIGHLIGHTING      -----

        const shouldHighlightSelectedColorMismatch = hasHighlightColorFilter
          && (tilePixelAlpha > tolerance)
          && (highlightMode == 'incorrect')
          && (
            ((bestTemplateColorID == highlightColorID) && (bestTileColorID != bestTemplateColorID))
            || ((bestTileColorID == highlightColorID) && (bestTemplateColorID != highlightColorID))
          );
        const shouldHighlightSelectedColorMissing = hasHighlightColorFilter
          && (highlightMode == 'missing')
          && (bestTemplateColorID == highlightColorID)
          && (templatePixelAlpha > tolerance)
          && (tilePixelAlpha <= tolerance);
        const shouldHighlightGeneralMismatch = !hasHighlightColorFilter
          && (templatePixelAlpha > tolerance)
          && (bestTileColorID != bestTemplateColorID);

        // If highlighting is enabled, AND the template pixel does not match the tile pixel
        if (!highlightDisabled && (shouldHighlightSelectedColorMismatch || shouldHighlightSelectedColorMissing || shouldHighlightGeneralMismatch)) {

          // If the tile pixel is NOT transparent, OR the user wants to highlight transparent pixels
          if ((hasHighlightColorFilter && (shouldHighlightSelectedColorMissing || (tilePixelAlpha > tolerance))) || (!hasHighlightColorFilter && (shouldTransparentTilePixelsBeHighlighted || (tilePixelAlpha > tolerance)))) {

            if (hasHighlightColorFilter) {
              (highlightMode == 'missing' ? queueMissingHighlight : queueIncorrectHighlight)({
                row: templateRow,
                column: templateColumn
              });
              continue;
            }

            // Obtains the template color of this pixel
            const templatePixelColor = (templatePixelAlpha > tolerance)
              ? template32[(templateRow * templateWidth) + templateColumn]
              : tilePixelAbove;
            // This will retrieve the tile background instead if the color is filtered!

            // For each of the 9 subpixels inside the pixel...
            for (const subpixelPattern of highlightPattern) {

              // Deconstructs the sub pixel
              const [subpixelState, subpixelColumnDelta, subpixelRowDelta] = subpixelPattern;
              // "Delta" because the coordinate of the sub-pixel is relative to the center of the pixel

              // Obtains the subpixel color to use
              const subpixelColor = (subpixelState != 0) ? ((subpixelState != 1) ? templatePixelColor : 0xFF0000FF) : 0x00000000;
              // 0 = Transparent (black)
              // 1 = Red (#FF0000)
              // 2 = Template (matches template or hides if filtered)

              // Sets the subpixel to match the color on the highlight pattern
              template32[((templateRow + subpixelRowDelta) * templateWidth) + (templateColumn + subpixelColumnDelta)] = subpixelColor;
            }
          }
        }

        // -----  END OF HIGHLIGHTING  -----

        // If the template pixel is Erased, and the tile pixel is transparent...
        if ((bestTemplateColorID == -1) && (tilePixelAbove <= tolerance)) {

          // Increments the count by 1 for the Erased (#deface) color.
          // If the color ID has not been counted yet, default to 1
          const colorIDcount = _colorpalette.get(bestTemplateColorID);
          _colorpalette.set(bestTemplateColorID, colorIDcount ? colorIDcount + 1 : 1);
          continue;
        }
        // If the code passes this point, the pixel is not a correct Erased color.

        // If either pixel is transparent...
        if ((templatePixelAlpha <= tolerance) || (tilePixelAlpha <= tolerance)) {
          continue; // ...we skip it. We can't match the RGB color of transparent pixels.
        }
        // If the code passes this point, both pixels are opaque & not Erased.

        // If the template pixel does not match the tile pixel, then the pixel is skipped after highlighting.
        if (bestTileColorID != bestTemplateColorID) {
          continue;
        }
        // If the code passes this point, the template pixel matches the tile pixel.

        // Increments the count by 1 for the best matching color ID (which can be negative).
        // If the color ID has not been counted yet, default to 1
        const colorIDcount = _colorpalette.get(bestTemplateColorID);
        _colorpalette.set(bestTemplateColorID, colorIDcount ? colorIDcount + 1 : 1);
      }

      if ((performance.now() - workSliceStarted) >= 4) {
        await this.#yieldToBrowser();
        workSliceStarted = performance.now();
      }
    }

    if (hasHighlightColorFilter && (highlightMode == 'missing')) {
      await this.#yieldToBrowser();
      const missingHighlightClusters = await this.#buildMissingHighlightClusters(missingHighlightBuckets, 96);
      await this.#yieldToBrowser();
      for (const cluster of missingHighlightClusters) {
        this.#drawMissingHighlightCluster({
          template: template32,
          templateWidth: templateWidth,
          templateHeight: templateHeight,
          cluster: cluster,
          pixelSize: pixelSize
        });
        if ((performance.now() - workSliceStarted) >= 4) {
          await this.#yieldToBrowser();
          workSliceStarted = performance.now();
        }
      }
    } else {
      const markerStencil = this.#getIncorrectHighlightStencil(incorrectHighlightColors, incorrectHighlightPhase);
      for (const highlight of incorrectHighlights) {
        this.#drawIncorrectHighlightMarker({
          template: template32,
          templateWidth: templateWidth,
          templateHeight: templateHeight,
          row: highlight.row,
          column: highlight.column,
          stencil: markerStencil
        });
        if ((performance.now() - workSliceStarted) >= 4) {
          await this.#yieldToBrowser();
          workSliceStarted = performance.now();
        }
      }
    }

    if ((pixelStateByChunk instanceof Map) && chunkKey) {
      pixelStateByChunk.set(chunkKey, currentPixelState);
    }

    console.log(`List of template pixels that match the tile:`);
    console.log(_colorpalette);
    return { correctPixels: _colorpalette, filteredTemplate: template32 };
  }

  /** Lets input and animation frames run between expensive tile-render slices.
   * @returns {Promise<void>}
   * @since 0.98.0
   */
  async #yieldToBrowser() {
    if (typeof globalThis.scheduler?.yield === 'function') {
      await globalThis.scheduler.yield();
      return;
    }
    await new Promise(resolve => requestAnimationFrame(() => resolve()));
  }

  /** Builds connected blob bounds for dense missing-pixel highlighting.
   * @param {Map<number, Object>} bucketMap
   * @param {number} maxClusters
   * @returns {Promise<Array<Object>>}
   * @since 0.97.0
   */
  async #buildMissingHighlightClusters(bucketMap, maxClusters) {
    if (!bucketMap?.size) {return [];}

    const visited = new Set();
    const clusters = [];
    let workSliceStarted = performance.now();
    const neighborDeltas = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1], [0, 1],
      [1, -1], [1, 0], [1, 1]
    ];

    for (const [bucketKey, startBucket] of bucketMap) {
      if (visited.has(bucketKey)) {continue;}

      const queue = [startBucket];
      const cluster = {
        minRow: startBucket.minRow,
        maxRow: startBucket.maxRow,
        minColumn: startBucket.minColumn,
        maxColumn: startBucket.maxColumn,
        count: 0,
        buckets: []
      };
      visited.add(bucketKey);

      for (let queueIndex = 0; queueIndex < queue.length; queueIndex++) {
        const bucket = queue[queueIndex];
        cluster.minRow = Math.min(cluster.minRow, bucket.minRow);
        cluster.maxRow = Math.max(cluster.maxRow, bucket.maxRow);
        cluster.minColumn = Math.min(cluster.minColumn, bucket.minColumn);
        cluster.maxColumn = Math.max(cluster.maxColumn, bucket.maxColumn);
        cluster.count += bucket.count;
        cluster.buckets.push(bucket);

        for (const [rowDelta, columnDelta] of neighborDeltas) {
          const neighborRow = bucket.bucketRow + rowDelta;
          const neighborColumn = bucket.bucketColumn + columnDelta;
          if ((neighborRow < 0) || (neighborColumn < 0)) {continue;}
          const diagonal = neighborRow + neighborColumn;
          const neighborKey = ((diagonal * (diagonal + 1)) / 2) + neighborColumn;
          if (visited.has(neighborKey)) {continue;}

          const neighbor = bucketMap.get(neighborKey);
          if (!neighbor) {continue;}

          visited.add(neighborKey);
          queue.push(neighbor);
        }

        if ((performance.now() - workSliceStarted) >= 4) {
          await this.#yieldToBrowser();
          workSliceStarted = performance.now();
        }
      }

      clusters.push(cluster);
    }

    return clusters
      .sort((a, b) => b.count - a.count)
      .slice(0, maxClusters);
  }

  /** Draws one soft contour around a cluster of missing pixels.
   * @param {Object} params
   * @param {Uint32Array} params.template
   * @param {number} params.templateWidth
   * @param {number} params.templateHeight
   * @param {Object} params.cluster
   * @param {number} params.pixelSize
   * @since 0.97.0
   */
  #drawMissingHighlightCluster({
    template: template32,
    templateWidth: templateWidth,
    templateHeight: templateHeight,
    cluster: cluster,
    pixelSize: pixelSize
  }) {
    const contourColor = 0xC8FFFB00;
    const logicalWidth = Math.ceil(templateWidth / pixelSize);
    const logicalHeight = Math.ceil(templateHeight / pixelSize);
    // Sweep half-open logical-pixel rectangles into constant-coverage horizontal slabs.
    const events = new Map();

    const addEvent = (row, type, rectangle) => {
      const event = events.get(row) ?? {add: [], remove: []};
      event[type].push(rectangle);
      events.set(row, event);
    };
    const mergeIntervals = intervals => {
      if (!intervals.length) {return [];}
      const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
      const merged = [sorted[0].slice()];

      for (let index = 1; index < sorted.length; index++) {
        const current = sorted[index];
        const previous = merged[merged.length - 1];
        if (current[0] <= previous[1]) {
          previous[1] = Math.max(previous[1], current[1]);
        } else {
          merged.push(current.slice());
        }
      }
      return merged;
    };
    const intervalsEqual = (first, second) => (
      first.length == second.length
      && first.every((interval, index) => interval[0] == second[index][0] && interval[1] == second[index][1])
    );
    const subtractIntervals = ([start, end], blockers) => {
      const visible = [];
      let cursor = start;

      for (const [blockStart, blockEnd] of blockers) {
        if (blockEnd <= cursor) {continue;}
        if (blockStart >= end) {break;}
        if (blockStart > cursor) {visible.push([cursor, Math.min(end, blockStart)]);}
        cursor = Math.max(cursor, blockEnd);
        if (cursor >= end) {break;}
      }
      if (cursor < end) {visible.push([cursor, end]);}
      return visible;
    };

    for (const bucket of cluster.buckets) {
      const top = Math.round(bucket.bucketTop / pixelSize);
      const left = Math.round(bucket.bucketLeft / pixelSize);
      const size = Math.round(bucket.bucketSize / pixelSize);
      const rectangle = {
        top: top,
        bottom: top + size,
        left: left,
        right: left + size
      };
      addEvent(rectangle.top, 'add', rectangle);
      addEvent(rectangle.bottom, 'remove', rectangle);
    }

    const eventRows = Array.from(events.keys()).sort((a, b) => a - b);
    const activeRectangles = new Set();
    const slabs = [];

    for (let eventIndex = 0; eventIndex < eventRows.length - 1; eventIndex++) {
      const top = eventRows[eventIndex];
      const nextTop = eventRows[eventIndex + 1];
      const event = events.get(top);

      for (const rectangle of event.remove) {activeRectangles.delete(rectangle);}
      for (const rectangle of event.add) {activeRectangles.add(rectangle);}
      if (!activeRectangles.size || (nextTop <= top)) {continue;}

      const intervals = mergeIntervals(Array.from(activeRectangles, rectangle => [rectangle.left, rectangle.right]));
      const previousSlab = slabs[slabs.length - 1];
      if (previousSlab && (previousSlab.bottom == top) && intervalsEqual(previousSlab.intervals, intervals)) {
        previousSlab.bottom = nextTop;
      } else {
        slabs.push({top: top, bottom: nextTop, intervals: intervals});
      }
    }

    const drawHorizontal = (row, startColumn, endColumn) => {
      const start = Math.max(0, startColumn);
      const end = Math.min(logicalWidth, endColumn);
      if ((row < 0) || (row >= logicalHeight) || (start >= end)) {return;}

      const firstSubpixelRow = row * pixelSize;
      const finalSubpixelRow = Math.min(templateHeight, firstSubpixelRow + pixelSize);
      const firstSubpixelColumn = start * pixelSize;
      const finalSubpixelColumn = Math.min(templateWidth, end * pixelSize);
      for (let subpixelRow = firstSubpixelRow; subpixelRow < finalSubpixelRow; subpixelRow++) {
        template32.fill(contourColor, (subpixelRow * templateWidth) + firstSubpixelColumn, (subpixelRow * templateWidth) + finalSubpixelColumn);
      }
    };
    const drawVertical = (column, startRow, endRow) => {
      const start = Math.max(0, startRow);
      const end = Math.min(logicalHeight, endRow);
      if ((column < 0) || (column >= logicalWidth) || (start >= end)) {return;}

      const firstSubpixelColumn = column * pixelSize;
      const finalSubpixelColumn = Math.min(templateWidth, firstSubpixelColumn + pixelSize);
      for (let row = start; row < end; row++) {
        const firstSubpixelRow = row * pixelSize;
        const finalSubpixelRow = Math.min(templateHeight, firstSubpixelRow + pixelSize);
        for (let subpixelRow = firstSubpixelRow; subpixelRow < finalSubpixelRow; subpixelRow++) {
          template32.fill(contourColor, (subpixelRow * templateWidth) + firstSubpixelColumn, (subpixelRow * templateWidth) + finalSubpixelColumn);
        }
      }
    };
    const drawPixel = (row, column) => drawHorizontal(row, column, column + 1);

    for (let slabIndex = 0; slabIndex < slabs.length; slabIndex++) {
      const slab = slabs[slabIndex];
      const previousSlab = slabs[slabIndex - 1];
      const nextSlab = slabs[slabIndex + 1];
      const previousIntervals = previousSlab && (previousSlab.bottom == slab.top) ? previousSlab.intervals : [];
      const nextIntervals = nextSlab && (slab.bottom == nextSlab.top) ? nextSlab.intervals : [];

      for (const interval of slab.intervals) {
        const [left, right] = interval;
        drawVertical(left, slab.top, slab.bottom);
        drawVertical(right - 1, slab.top, slab.bottom);

        for (const [start, end] of subtractIntervals(interval, previousIntervals)) {
          drawHorizontal(slab.top, start, end);
          if (start > left) {drawPixel(slab.top, start - 1);}
          if (end < right) {drawPixel(slab.top, end);}
        }
        for (const [start, end] of subtractIntervals(interval, nextIntervals)) {
          const bottomRow = slab.bottom - 1;
          drawHorizontal(bottomRow, start, end);
          if (start > left) {drawPixel(bottomRow, start - 1);}
          if (end < right) {drawPixel(bottomRow, end);}
        }
      }
    }
  }

  /** Builds one reusable marker stencil for the current animation phase.
   * @param {Object} colors
   * @param {number} phase
   * @returns {Array<number>}
   * @since 0.98.0
   */
  #getIncorrectHighlightStencil(colors, phase) {
    const normalizedPhase = phase % 12;
    const cacheKey = `${this.drawMult}:${normalizedPhase}`;
    const cachedStencil = this.incorrectHighlightStencilCache.get(cacheKey);
    if (cachedStencil) {return cachedStencil;}

    const stencil = [];
    const push = (rowDelta, columnDelta, color) => {
      stencil.push(rowDelta, columnDelta, color);
    };
    const pixelSize = this.drawMult;
    const radiusPixels = 10 + (normalizedPhase % 4);
    const waveRadius = radiusPixels * pixelSize;
    const innerRadius = Math.max(pixelSize * 3, waveRadius - (pixelSize * 4));
    const midRadius = Math.max(pixelSize * 2, waveRadius - (pixelSize * 2));
    const outerRingThickness = pixelSize * 0.52;
    const midRingThickness = pixelSize * 0.46;
    const innerRingThickness = pixelSize * 0.4;
    const spokeHalfThickness = Math.max(0, Math.floor(pixelSize * 0.22));
    const phaseIsEven = (normalizedPhase & 1) == 0;
    const phaseModThree = normalizedPhase % 3;
    const crossStart = Math.max(1, pixelSize);
    const crossEnd = Math.max(crossStart + 1, pixelSize * 2);

    for (let offset = crossStart; offset <= crossEnd; offset++) {
      push(-offset, 0, colors.yellow);
      push(offset, 0, colors.yellow);
      push(0, -offset, colors.yellow);
      push(0, offset, colors.yellow);
    }

    for (let rowDelta = -waveRadius; rowDelta <= waveRadius; rowDelta++) {
      for (let columnDelta = -waveRadius; columnDelta <= waveRadius; columnDelta++) {
        const distance = Math.hypot(rowDelta, columnDelta);
        const isOuterRing = Math.abs(distance - waveRadius) <= outerRingThickness;
        const isMidRing = Math.abs(distance - midRadius) <= midRingThickness;
        const isInnerRing = Math.abs(distance - innerRadius) <= innerRingThickness;
        const isSpoke = (
          ((Math.abs(rowDelta) <= spokeHalfThickness) && (Math.abs(columnDelta) >= crossStart) && (Math.abs(columnDelta) <= waveRadius) && (((Math.abs(columnDelta) / pixelSize) + normalizedPhase) % 5 < 1))
          || ((Math.abs(columnDelta) <= spokeHalfThickness) && (Math.abs(rowDelta) >= crossStart) && (Math.abs(rowDelta) <= waveRadius) && (((Math.abs(rowDelta) / pixelSize) + normalizedPhase) % 5 < 1))
        );

        if (!isOuterRing && !isMidRing && !isInnerRing && !isSpoke) {continue;}

        if (isOuterRing && (((Math.floor((Math.atan2(rowDelta, columnDelta) + Math.PI) * 6) + phaseModThree) % 3) == 0)) {
          push(rowDelta, columnDelta, colors.white);
        } else if (isOuterRing) {
          push(rowDelta, columnDelta, phaseIsEven ? colors.cyan : colors.blue);
        } else if (isMidRing) {
          push(rowDelta, columnDelta, phaseIsEven ? colors.yellow : colors.cyan);
        } else if (isInnerRing) {
          push(rowDelta, columnDelta, colors.coral);
        } else {
          push(rowDelta, columnDelta, phaseIsEven ? colors.blue : colors.yellow);
        }
      }
    }

    for (const [rowDelta, columnDelta] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
      push(rowDelta, columnDelta, colors.yellow);
    }

    this.incorrectHighlightStencilCache.set(cacheKey, stencil);
    return stencil;
  }

  /** Draws a loud marker around one incorrect pixel for color-specific highlighting.
   * @param {Object} params
   * @param {Uint32Array} params.template
   * @param {number} params.templateWidth
   * @param {number} params.templateHeight
   * @param {number} params.row
   * @param {number} params.column
   * @param {Array<number>} params.stencil
   * @since 0.97.0
   */
  #drawIncorrectHighlightMarker({
    template: template32,
    templateWidth: templateWidth,
    templateHeight: templateHeight,
    row: templateRow,
    column: templateColumn,
    stencil: stencil
  }) {
    const setSubpixel = (rowDelta, columnDelta, color) => {
      const row = templateRow + rowDelta;
      const column = templateColumn + columnDelta;
      if ((row < 0) || (row >= templateHeight) || (column < 0) || (column >= templateWidth)) {return;}
      template32[(row * templateWidth) + column] = color;
    };

    for (let index = 0; index < stencil.length; index += 3) {
      setSubpixel(stencil[index], stencil[index + 1], stencil[index + 2]);
    }
  }
}
