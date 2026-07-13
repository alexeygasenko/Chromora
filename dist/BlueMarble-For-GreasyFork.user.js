// ==UserScript==
// @name            Chromora
// @name:en         Chromora
// @namespace       https://github.com/alexeygasenko/
// @version         1.0.0
// @description     A fluid liquid-glass template, color analysis, pixel highlighting, and assisted drafting toolkit for Wplace.live.
// @description:en  A fluid liquid-glass template, color analysis, pixel highlighting, and assisted drafting toolkit for Wplace.live.
// @author          alexeygasenko; based on Blue Marble by SwingTheVine
// @license         MPL-2.0
// @supportURL      https://github.com/alexeygasenko/Chromora/issues
// @homepageURL     https://github.com/alexeygasenko/Chromora
// @updateURL       https://raw.githubusercontent.com/alexeygasenko/Chromora/main/dist/BlueMarble-For-GreasyFork.user.js
// @downloadURL     https://raw.githubusercontent.com/alexeygasenko/Chromora/main/dist/BlueMarble-For-GreasyFork.user.js
// @match           https://wplace.live/*
// @grant           GM_getResourceText
// @grant           GM_addStyle
// @grant           GM.setValue
// @grant           GM_getValue
// @grant           GM_deleteValue
// @grant           GM_xmlhttpRequest
// @grant           GM.download
// @connect         telemetry.thebluecorner.net
// @resource        CSS-BM-File https://raw.githubusercontent.com/alexeygasenko/Chromora/2cd51bf91944ae2acb253ea5bbd76f79b7a2edd3/dist/BlueMarble-For-GreasyFork.user.css
// @antifeature     tracking Anonymous opt-in telemetry data
// @noframes
// ==/UserScript==

// Wplace  --> https://wplace.live
// License --> https://www.mozilla.org/en-US/MPL/2.0/
// Donate  --> https://ko-fi.com/swingthevine

/*!
  This script is not affiliated with Wplace.live in any way, use at your own risk.
  This script is not affiliated with any userscript manager.
  The author of this userscript is not responsible for any damages, issues, loss of data, or punishment that may occur as a result of using this script.
  This script is provided "as is" under the MPL-2.0 license.
  Chromora is based on Blue Marble by SwingTheVine.
  Original Blue Marble copyright and attribution are preserved in the repository history and credits.
*/

(() => {
  var __typeError = (msg) => {
    throw TypeError(msg);
  };
  var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
  var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
  var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

  // src/observers.js
  var Observers = class {
    /** The constructor for the observer class
     * @since 0.43.2
     */
    constructor() {
      this.observerBody = null;
      this.observerBodyTarget = null;
      this.targetDisplayCoords = "#bm-display-coords";
    }
    /** Creates the MutationObserver for document.body
     * @param {HTMLElement} target - Targeted element to watch
     * @returns {Observers} this (Observers class)
     * @since 0.43.2
     */
    createObserverBody(target) {
      this.observerBodyTarget = target;
      this.observerBody = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof HTMLElement)) {
              continue;
            }
            if (node.matches?.(this.targetDisplayCoords)) {
            }
          }
        }
      });
      return this;
    }
    /** Retrieves the MutationObserver that watches document.body
     * @returns {MutationObserver}
     * @since 0.43.2
     */
    getObserverBody() {
      return this.observerBody;
    }
    /** Observe a MutationObserver
     * @param {MutationObserver} observer - The MutationObserver
     * @param {boolean} watchChildList - (Optional) Should childList be watched? False by default
     * @param {boolean} watchSubtree - (Optional) Should childList be watched? False by default
     * @since 0.43.2
     */
    observe(observer, watchChildList = false, watchSubtree = false) {
      observer.observe(this.observerBodyTarget, {
        childList: watchChildList,
        subtree: watchSubtree
      });
    }
  };

  // src/utils.js
  function getWplaceVersion() {
    const wplaceVersionElement = [...document.querySelectorAll(`body > div > .hidden`)].filter((match) => /version:/i.test(match.textContent));
    if (wplaceVersionElement[0]) {
      const wplaceUpdateTime = wplaceVersionElement[0].textContent?.match(/\d+/);
      return wplaceUpdateTime ? new Date(Number(wplaceUpdateTime[0])) : void 0;
    }
    return void 0;
  }
  function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }
  function localizeNumber(number) {
    const numberFormat = new Intl.NumberFormat();
    return numberFormat.format(number);
  }
  function localizePercent(percent) {
    const percentFormat = new Intl.NumberFormat(void 0, {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return percentFormat.format(percent);
  }
  function localizeDate(date) {
    const options = {
      month: "long",
      // July
      day: "numeric",
      // 23
      hour: "2-digit",
      // 17
      minute: "2-digit",
      // 47
      second: "2-digit"
      // 00
    };
    return date.toLocaleString(void 0, options);
  }
  function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  function serverTPtoDisplayTP(tile, pixel) {
    return [parseInt(tile[0]) % 4 * 1e3 + parseInt(pixel[0]), parseInt(tile[1]) % 4 * 1e3 + parseInt(pixel[1])];
  }
  function consoleLog(...args) {
    ((consoleLog2) => consoleLog2(...args))(console.log);
  }
  function consoleError(...args) {
    ((consoleError2) => consoleError2(...args))(console.error);
  }
  function consoleWarn(...args) {
    ((consoleWarn2) => consoleWarn2(...args))(console.warn);
  }
  function numberToEncoded(number, encoding) {
    if (number === 0) return encoding[0];
    let result = "";
    const base = encoding.length;
    while (number > 0) {
      result = encoding[number % base] + result;
      number = Math.floor(number / base);
    }
    return result;
  }
  function encodedToNumber(encoded, encoding) {
    let decodedNumber = 0;
    const base = encoding.length;
    for (const character of encoded) {
      const decodedCharacter = encoding.indexOf(character);
      if (decodedCharacter == -1) {
        consoleError(`Invalid character '${character}' encountered whilst decoding! Is the decode alphabet/base incorrect?`);
      }
      decodedNumber = decodedNumber * base + decodedCharacter;
    }
    return decodedNumber;
  }
  function uint8ToBase64(uint8) {
    let binary = "";
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }
  function base64ToUint8(base64) {
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return array;
  }
  async function getClipboardData(event = void 0) {
    let data = "";
    if (event) {
      data = event.clipboardData.getData("text/plain");
    }
    if (data.length != 0) {
      return data;
    }
    await navigator.clipboard.readText().then((text) => {
      data = text;
    }).catch((error) => {
      consoleLog(`Failed to retrieve clipboard data using navigator! Using fallback methods...`);
    });
    if (data.length != 0) {
      return data;
    }
    data = window.clipboardData?.getData("Text");
    return data;
  }
  function calculateRelativeLuminance(array) {
    const srgb = array.map((channel) => {
      channel /= 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }
  function colorpaletteForBlueMarble(tolerance) {
    const colorpaletteBM = [
      { "id": -2, "premium": false, "name": "Other", "rgb": [0, 0, 0] },
      { "id": -1, "premium": false, "name": "Erased", "rgb": [222, 250, 206] },
      ...colorpalette.map((color) => ({ ...color, rgb: [...color.rgb] }))
    ];
    const lookupTable = /* @__PURE__ */ new Map();
    for (const color of colorpaletteBM) {
      if (color.id == 0 || color.id == -2) continue;
      const targetRed = color.rgb[0];
      const targetGreen = color.rgb[1];
      const targetBlue = color.rgb[2];
      for (let deltaRedRange = -tolerance; deltaRedRange <= tolerance; deltaRedRange++) {
        for (let deltaGreenRange = -tolerance; deltaGreenRange <= tolerance; deltaGreenRange++) {
          for (let deltaBlueRange = -tolerance; deltaBlueRange <= tolerance; deltaBlueRange++) {
            const derivativeRed = targetRed + deltaRedRange;
            const derivativeGreen = targetGreen + deltaGreenRange;
            const derivativeBlue = targetBlue + deltaBlueRange;
            if (derivativeRed < 0 || derivativeRed > 255 || derivativeGreen < 0 || derivativeGreen > 255 || derivativeBlue < 0 || derivativeBlue > 255) continue;
            const derivativeColor32 = (255 << 24 | derivativeBlue << 16 | derivativeGreen << 8 | derivativeRed) >>> 0;
            if (!lookupTable.has(derivativeColor32)) {
              lookupTable.set(derivativeColor32, color.id);
            }
          }
        }
      }
    }
    return { palette: colorpaletteBM, LUT: lookupTable };
  }
  var colorpalette = [
    { "id": 0, "premium": false, "name": "Transparent", "rgb": [0, 0, 0] },
    { "id": 1, "premium": false, "name": "Black", "rgb": [0, 0, 0] },
    { "id": 2, "premium": false, "name": "Dark Gray", "rgb": [60, 60, 60] },
    { "id": 3, "premium": false, "name": "Gray", "rgb": [120, 120, 120] },
    { "id": 4, "premium": false, "name": "Light Gray", "rgb": [210, 210, 210] },
    { "id": 5, "premium": false, "name": "White", "rgb": [255, 255, 255] },
    { "id": 6, "premium": false, "name": "Deep Red", "rgb": [96, 0, 24] },
    { "id": 7, "premium": false, "name": "Red", "rgb": [237, 28, 36] },
    { "id": 8, "premium": false, "name": "Orange", "rgb": [255, 127, 39] },
    { "id": 9, "premium": false, "name": "Gold", "rgb": [246, 170, 9] },
    { "id": 10, "premium": false, "name": "Yellow", "rgb": [249, 221, 59] },
    { "id": 11, "premium": false, "name": "Light Yellow", "rgb": [255, 250, 188] },
    { "id": 12, "premium": false, "name": "Dark Green", "rgb": [14, 185, 104] },
    { "id": 13, "premium": false, "name": "Green", "rgb": [19, 230, 123] },
    { "id": 14, "premium": false, "name": "Light Green", "rgb": [135, 255, 94] },
    { "id": 15, "premium": false, "name": "Dark Teal", "rgb": [12, 129, 110] },
    { "id": 16, "premium": false, "name": "Teal", "rgb": [16, 174, 166] },
    { "id": 17, "premium": false, "name": "Light Teal", "rgb": [19, 225, 190] },
    { "id": 18, "premium": false, "name": "Dark Blue", "rgb": [40, 80, 158] },
    { "id": 19, "premium": false, "name": "Blue", "rgb": [64, 147, 228] },
    { "id": 20, "premium": false, "name": "Cyan", "rgb": [96, 247, 242] },
    { "id": 21, "premium": false, "name": "Indigo", "rgb": [107, 80, 246] },
    { "id": 22, "premium": false, "name": "Light Indigo", "rgb": [153, 177, 251] },
    { "id": 23, "premium": false, "name": "Dark Purple", "rgb": [120, 12, 153] },
    { "id": 24, "premium": false, "name": "Purple", "rgb": [170, 56, 185] },
    { "id": 25, "premium": false, "name": "Light Purple", "rgb": [224, 159, 249] },
    { "id": 26, "premium": false, "name": "Dark Pink", "rgb": [203, 0, 122] },
    { "id": 27, "premium": false, "name": "Pink", "rgb": [236, 31, 128] },
    { "id": 28, "premium": false, "name": "Light Pink", "rgb": [243, 141, 169] },
    { "id": 29, "premium": false, "name": "Dark Brown", "rgb": [104, 70, 52] },
    { "id": 30, "premium": false, "name": "Brown", "rgb": [149, 104, 42] },
    { "id": 31, "premium": false, "name": "Beige", "rgb": [248, 178, 119] },
    { "id": 32, "premium": true, "name": "Medium Gray", "rgb": [170, 170, 170] },
    { "id": 33, "premium": true, "name": "Dark Red", "rgb": [165, 14, 30] },
    { "id": 34, "premium": true, "name": "Light Red", "rgb": [250, 128, 114] },
    { "id": 35, "premium": true, "name": "Dark Orange", "rgb": [228, 92, 26] },
    { "id": 36, "premium": true, "name": "Light Tan", "rgb": [214, 181, 148] },
    { "id": 37, "premium": true, "name": "Dark Goldenrod", "rgb": [156, 132, 49] },
    { "id": 38, "premium": true, "name": "Goldenrod", "rgb": [197, 173, 49] },
    { "id": 39, "premium": true, "name": "Light Goldenrod", "rgb": [232, 212, 95] },
    { "id": 40, "premium": true, "name": "Dark Olive", "rgb": [74, 107, 58] },
    { "id": 41, "premium": true, "name": "Olive", "rgb": [90, 148, 74] },
    { "id": 42, "premium": true, "name": "Light Olive", "rgb": [132, 197, 115] },
    { "id": 43, "premium": true, "name": "Dark Cyan", "rgb": [15, 121, 159] },
    { "id": 44, "premium": true, "name": "Light Cyan", "rgb": [187, 250, 242] },
    { "id": 45, "premium": true, "name": "Light Blue", "rgb": [125, 199, 255] },
    { "id": 46, "premium": true, "name": "Dark Indigo", "rgb": [77, 49, 184] },
    { "id": 47, "premium": true, "name": "Dark Slate Blue", "rgb": [74, 66, 132] },
    { "id": 48, "premium": true, "name": "Slate Blue", "rgb": [122, 113, 196] },
    { "id": 49, "premium": true, "name": "Light Slate Blue", "rgb": [181, 174, 241] },
    { "id": 50, "premium": true, "name": "Light Brown", "rgb": [219, 164, 99] },
    { "id": 51, "premium": true, "name": "Dark Beige", "rgb": [209, 128, 81] },
    { "id": 52, "premium": true, "name": "Light Beige", "rgb": [255, 197, 165] },
    { "id": 53, "premium": true, "name": "Dark Peach", "rgb": [155, 82, 73] },
    { "id": 54, "premium": true, "name": "Peach", "rgb": [209, 128, 120] },
    { "id": 55, "premium": true, "name": "Light Peach", "rgb": [250, 182, 164] },
    { "id": 56, "premium": true, "name": "Dark Tan", "rgb": [123, 99, 82] },
    { "id": 57, "premium": true, "name": "Tan", "rgb": [156, 132, 107] },
    { "id": 58, "premium": true, "name": "Dark Slate", "rgb": [51, 57, 65] },
    { "id": 59, "premium": true, "name": "Slate", "rgb": [109, 117, 141] },
    { "id": 60, "premium": true, "name": "Light Slate", "rgb": [179, 185, 209] },
    { "id": 61, "premium": true, "name": "Dark Stone", "rgb": [109, 100, 63] },
    { "id": 62, "premium": true, "name": "Stone", "rgb": [148, 140, 107] },
    { "id": 63, "premium": true, "name": "Light Stone", "rgb": [205, 197, 158] }
  ];

  // src/Overlay.js
  var minimizeIconExpanded = '<svg class="bm-button-icon bm-button-icon-minimize" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 9.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var minimizeIconCollapsed = '<svg class="bm-button-icon bm-button-icon-minimize" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var motionAnimations = /* @__PURE__ */ new WeakMap();
  var motionTiming = Object.freeze({
    fast: 180,
    window: 300,
    ease: "cubic-bezier(.2, .8, .2, 1)",
    spring: "cubic-bezier(.16, 1, .3, 1)"
  });
  function shouldReduceMotion() {
    return typeof window != "undefined" && typeof window.matchMedia == "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function cancelMotion(element) {
    const animations = motionAnimations.get(element);
    animations?.forEach((animation) => animation.cancel());
    motionAnimations.delete(element);
  }
  function startMotion(element, keyframes, options) {
    if (!element || shouldReduceMotion() || typeof element.animate != "function") {
      return null;
    }
    cancelMotion(element);
    const animation = element.animate(keyframes, { fill: "both", ...options });
    motionAnimations.set(element, /* @__PURE__ */ new Set([animation]));
    void animation.finished.catch(() => {
    }).finally(() => {
      const animations = motionAnimations.get(element);
      animations?.delete(animation);
      if (!animations?.size) {
        motionAnimations.delete(element);
      }
    });
    return animation;
  }
  async function waitForMotion(animations) {
    await Promise.all(animations.filter(Boolean).map((animation) => animation.finished.catch(() => {
    })));
  }
  function releaseMotion(animations) {
    animations.filter(Boolean).forEach((animation) => animation.cancel());
  }
  var _Overlay_instances, createElement_fn, applyAttribute_fn;
  var Overlay = class {
    /** Constructor for the Overlay class.
     * @param {string} name - The name of the userscript
     * @param {string} version - The version of the userscript
     * @since 0.0.2
     * @see {@link Overlay}
     */
    constructor(name2, version2) {
      __privateAdd(this, _Overlay_instances);
      this.name = name2;
      this.version = version2;
      this.apiManager = null;
      this.settingsManager = null;
      this.outputStatusId = "bm-output-status";
      this.overlay = null;
      this.currentParent = null;
      this.parentStack = [];
    }
    /** Populates the apiManager variable with the apiManager class.
     * @param {ApiManager} apiManager - The apiManager class instance
     * @since 0.41.4
     */
    setApiManager(apiManager) {
      this.apiManager = apiManager;
    }
    /** Populates the settingsManager variable with the settingsManager class.
     * @param {SettingsManager} settingsManager - The settingsManager class instance
     * @since 0.91.11
     */
    setSettingsManager(settingsManager) {
      this.settingsManager = settingsManager;
    }
    /** Finishes building an element.
     * Call this after you are finished adding children.
     * If the element will have no children, call it anyways.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.43.2
     * @example
     * overlay
     *   .addDiv()
     *     .addHeader(1).buildElement() // Breaks out of the <h1>
     *     .addP().buildElement() // Breaks out of the <p>
     *   .buildElement() // Breaks out of the <div>
     *   .addHr() // Since there are no more elements, calling buildElement() is optional
     * .buildOverlay(document.body);
     */
    buildElement() {
      if (this.parentStack.length > 0) {
        this.currentParent = this.parentStack.pop();
      }
      return this;
    }
    /** Finishes building the overlay and displays it.
     * Call this when you are done chaining methods.
     * @param {HTMLElement} parent - The parent HTMLElement this overlay should be appended to as a child.
     * @since 0.43.2
     * @example
     * overlay
     *   .addDiv()
     *     .addP().buildElement()
     *   .buildElement()
     * .buildOverlay(document.body); // Adds DOM structure to document body
     * // <div><p></p></div>
     */
    buildOverlay(parent) {
      const overlay = this.overlay;
      parent?.appendChild(overlay);
      if (overlay?.classList.contains("bm-window")) {
        this.handleWindowOpen(overlay);
      }
      this.overlay = null;
      this.currentParent = null;
      this.parentStack = [];
    }
    /** Adds a `div` to the overlay.
     * This `div` element will have properties shared between all `div` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `div` that are NOT shared between all overlay `div` elements. These should be camelCase.
     * @param {function(Overlay, HTMLDivElement):void} [callback=()=>{}] - Additional JS modification to the `div`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.43.2
     * @example
     * // Assume all <div> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addDiv({'id': 'foo'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <div id="foo" class="bar"></div>
     * </body>
     */
    addDiv(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const div = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "div", properties, additionalProperties);
      callback(this, div);
      return this;
    }
    /** Adds a `p` to the overlay.
     * This `p` element will have properties shared between all `p` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `p` that are NOT shared between all overlay `p` elements. These should be camelCase.
     * @param {function(Overlay, HTMLParagraphElement):void} [callback=()=>{}] - Additional JS modification to the `p`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.43.2
     * @example
     * // Assume all <p> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addP({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <p id="foo" class="bar">Foobar.</p>
     * </body>
     */
    addP(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const p = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "p", properties, additionalProperties);
      callback(this, p);
      return this;
    }
    /** Adds a `small` to the overlay.
     * This `small` element will have properties shared between all `small` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `small` that are NOT shared between all overlay `small` elements. These should be camelCase.
     * @param {function(Overlay, HTMLElement):void} [callback=()=>{}] - Additional JS modification to the `small`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.55.8
     * @example
     * // Assume all <small> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addSmall({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <small id="foo" class="bar">Foobar.</small>
     * </body>
     */
    addSmall(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const small = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "small", properties, additionalProperties);
      callback(this, small);
      return this;
    }
    /** Adds a `span` to the overlay.
     * This `span` element will have properties shared between all `span` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `span` that are NOT shared between all overlay `span` elements. These should be camelCase.
     * @param {function(Overlay, HTMLSpanElement):void} [callback=()=>{}] - Additional JS modification to the `span`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.55.8
     * @example
     * // Assume all <span> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addSpan({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <span id="foo" class="bar">Foobar.</span>
     * </body>
     */
    addSpan(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const span = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "span", properties, additionalProperties);
      callback(this, span);
      return this;
    }
    /** Adds a `details` to the overlay.
     * This `details` element will have properties shared between all `details` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `details` that are NOT shared between all overlay `details` elements. These should be camelCase.
     * @param {function(Overlay, HTMLDetailsElement):void} [callback=()=>{}] - Additional JS modification to the `details`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.96
     * @example
     * // Assume all <details> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addDetails({'id': 'foo'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <details id="foo" class="bar"></details>
     * </body>
     */
    addDetails(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const details = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "details", properties, additionalProperties);
      callback(this, details);
      return this;
    }
    /** Adds a `summary` to the overlay.
     * This `summary` element will have properties shared between all `summary` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `summary` that are NOT shared between all overlay `summary` elements. These should be camelCase.
     * @param {function(Overlay, HTMLElement):void} [callback=()=>{}] - Additional JS modification to the `summary`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.96
     * @example
     * // Assume all <summary> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addSummary({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <summary id="foo" class="bar">Foobar.</summary>
     * </body>
     */
    addSummary(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const summary = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "summary", properties, additionalProperties);
      callback(this, summary);
      return this;
    }
    /** Adds a `img` to the overlay.
     * This `img` element will have properties shared between all `img` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `img` that are NOT shared between all overlay `img` elements. These should be camelCase.
     * @param {function(Overlay, HTMLImageElement):void} [callback=()=>{}] - Additional JS modification to the `img`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.43.2
     * @example
     * // Assume all <img> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addimg({'id': 'foo', 'src': './img.png'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <img id="foo" src="./img.png" class="bar">
     * </body>
     */
    addImg(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const img = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "img", properties, additionalProperties);
      callback(this, img);
      return this;
    }
    /** Adds a header to the overlay.
     * This header element will have properties shared between all header elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {number} level - The header level. Must be between 1 and 6 (inclusive)
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the header that are NOT shared between all overlay header elements. These should be camelCase.
     * @param {function(Overlay, HTMLHeadingElement):void} [callback=()=>{}] - Additional JS modification to the header.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.43.7
     * @example
     * // Assume all header elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addHeader(6, {'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <h6 id="foo" class="bar">Foobar.</h6>
     * </body>
     */
    addHeader(level, additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const header = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "h" + level, properties, additionalProperties);
      callback(this, header);
      return this;
    }
    /** Adds a `hr` to the overlay.
     * This `hr` element will have properties shared between all `hr` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `hr` that are NOT shared between all overlay `hr` elements. These should be camelCase.
     * @param {function(Overlay, HTMLHRElement):void} [callback=()=>{}] - Additional JS modification to the `hr`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.43.7
     * @example
     * // Assume all <hr> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addhr({'id': 'foo'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <hr id="foo" class="bar">
     * </body>
     */
    addHr(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const hr = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "hr", properties, additionalProperties);
      callback(this, hr);
      return this;
    }
    /** Adds a `br` to the overlay.
     * This `br` element will have properties shared between all `br` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `br` that are NOT shared between all overlay `br` elements. These should be camelCase.
     * @param {function(Overlay, HTMLBRElement):void} [callback=()=>{}] - Additional JS modification to the `br`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.43.11
     * @example
     * // Assume all <br> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addbr({'id': 'foo'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <br id="foo" class="bar">
     * </body>
     */
    addBr(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const br = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "br", properties, additionalProperties);
      callback(this, br);
      return this;
    }
    /** Adds a `form` to the overlay.
     * This `form` element will have properties shared between all `form` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `form` that are NOT shared between all overlay `form` elements. These should be camelCase.
     * @param {function(Overlay, HTMLFormElement):void} [callback=()=>{}] - Additional JS modification to the `form`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.246
     * @example
     * // Assume all <form> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addForm({'id': 'foo'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <form id="foo" class="bar"></form>
     * </body>
     */
    addForm(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const form = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "form", properties, additionalProperties);
      callback(this, form);
      return this;
    }
    /** Adds a `fieldset` to the overlay.
     * This `fieldset` element will have properties shared between all `fieldset` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `fieldset` that are NOT shared between all overlay `fieldset` elements. These should be camelCase.
     * @param {function(Overlay, HTMLFieldSetElement):void} [callback=()=>{}] - Additional JS modification to the `fieldset`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.246
     * @example
     * // Assume all <fieldset> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addFieldset({'id': 'foo'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <fieldset id="foo" class="bar"></fieldset>
     * </body>
     */
    addFieldset(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const fieldset = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "fieldset", properties, additionalProperties);
      callback(this, fieldset);
      return this;
    }
    /** Adds a `legend` to the overlay.
     * This `legend` element will have properties shared between all `legend` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `legend` that are NOT shared between all overlay `legend` elements. These should be camelCase.
     * @param {function(Overlay, HTMLLegendElement):void} [callback=()=>{}] - Additional JS modification to the `legend`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.246
     * @example
     * // Assume all <legend> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addLegend({'id': 'foo', textContent: 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <legend id="foo" class="bar">
     *     "Foobar."
     *   </legend>
     * </body>
     */
    addLegend(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const legend = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "legend", properties, additionalProperties);
      callback(this, legend);
      return this;
    }
    /** Adds a checkbox to the overlay.
     * This checkbox element will have properties shared between all checkbox elements in the overlay.
     * You can override the shared properties by using a callback. Note: the checkbox element is inside a label element.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the checkbox that are NOT shared between all overlay checkbox elements. These should be camelCase.
     * @param {function(Overlay, HTMLLabelElement, HTMLInputElement):void} [callback=()=>{}] - Additional JS modification to the checkbox.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.43.10
     * @example
     * // Assume all checkbox elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addCheckbox({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <label>
     *     <input type="checkbox" id="foo" class="bar">
     *     "Foobar."
     *   </label>
     * </body>
     */
    addCheckbox(additionalProperties = {}, callback = () => {
    }) {
      const properties = { "type": "checkbox" };
      const labelContent = {};
      if (!!additionalProperties["textContent"]) {
        labelContent["textContent"] = additionalProperties["textContent"];
        delete additionalProperties["textContent"];
      } else if (!!additionalProperties["innerHTML"]) {
        labelContent["innerHTML"] = additionalProperties["innerHTML"];
        delete additionalProperties["textContent"];
      }
      const label = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "label", labelContent);
      const checkbox = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "input", properties, additionalProperties);
      label.insertBefore(checkbox, label.firstChild);
      this.buildElement();
      callback(this, label, checkbox);
      return this;
    }
    /** Adds a label & select element to the overlay.
     * This select element will have properties shared between all select elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the checkbox that are NOT shared between all overlay select elements. These should be camelCase.
     * @param {function(Overlay, HTMLLabelElement, HTMLSelectElement):void} [callback=()=>{}] - Additional JS modification to the label/select elements.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.243
     * @example
     * // Assume all select elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addSelect({'id': 'foo', 'textContent': 'Foobar: '}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <label for="foo">
     *     "Foobar: "
     *   </label>
     *   <select id="foo" class="bar"></select>
     * </body>
     */
    addSelect(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const label = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "label", { "textContent": additionalProperties["textContent"] ?? "", "for": additionalProperties["id"] ?? "" });
      delete additionalProperties["textContent"];
      this.buildElement();
      const select = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "select", properties, additionalProperties);
      callback(this, label, select);
      return this;
    }
    /** Adds an option to the overlay.
     * This `option` element will have properties shared between all `option` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `option` that are NOT shared between all overlay `option` elements. These should be camelCase.
     * @param {function(Overlay, HTMLOptionElement):void} [callback=()=>{}] - Additional JS modification to the `option`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.244
     * @example
     * // Assume all <option> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addOption({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <option id="foo" class="bar">Foobar.</option>
     * </body>
     */
    addOption(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const option = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "option", properties, additionalProperties);
      callback(this, option);
      return this;
    }
    /** Adds an ordered list to the overlay.
     * This `ol` element will have properties shared between all `ol` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `ol` that are NOT shared between all overlay `ol` elements. These should be camelCase.
     * @param {function(Overlay, HTMLOListElement):void} [callback=()=>{}] - Additional JS modification to the `ol`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.180
     * @example
     * // Assume all <ol> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addOl({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <ol id="foo" class="bar">Foobar.</ol>
     * </body>
     */
    addOl(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const ol = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "ol", properties, additionalProperties);
      callback(this, ol);
      return this;
    }
    /** Adds an unordered list to the overlay.
     * This `ul` element will have properties shared between all `ul` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `ul` that are NOT shared between all overlay `ul` elements. These should be camelCase.
     * @param {function(Overlay, HTMLUListElement):void} [callback=()=>{}] - Additional JS modification to the `ul`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.180
     * @example
     * // Assume all <ul> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addUl({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <ul id="foo" class="bar">Foobar.</ul>
     * </body>
     */
    addUl(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const ul = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "ul", properties, additionalProperties);
      callback(this, ul);
      return this;
    }
    /** Adds a `menu` to the overlay.
     * This `menu` element will have properties shared between all `menu` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `menu` that are NOT shared between all overlay `menu` elements. These should be camelCase.
     * @param {function(Overlay, HTMLMenuElement):void} [callback=()=>{}] - Additional JS modification to the `menu`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.180
     * @example
     * // Assume all <menu> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addMenu({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <menu id="foo" class="bar">Foobar.</menu>
     * </body>
     */
    addMenu(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const menu = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "menu", properties, additionalProperties);
      callback(this, menu);
      return this;
    }
    /** Adds a list item to the overlay.
     * This `li` element will have properties shared between all `li` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `li` that are NOT shared between all overlay `li` elements. These should be camelCase.
     * @param {function(Overlay, HTMLLIElement):void} [callback=()=>{}] - Additional JS modification to the `li`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.180
     * @example
     * // Assume all <li> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addLi({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <li id="foo" class="bar">Foobar.</li>
     * </body>
     */
    addLi(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const li = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "li", properties, additionalProperties);
      callback(this, li);
      return this;
    }
    /** Adds a table to the overlay.
     * This `table` element will have properties shared between all `table` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `table` that are NOT shared between all overlay `table` elements. These should be camelCase.
     * @param {function(Overlay, HTMLTableElement):void} [callback=()=>{}] - Additional JS modification to the `table`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.180
     * @example
     * // Assume all <table> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addTable({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <table id="foo" class="bar">Foobar.</table>
     * </body>
     */
    addTable(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const table = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "table", properties, additionalProperties);
      callback(this, table);
      return this;
    }
    /** Adds a table caption to the overlay.
     * This `caption` element will have properties shared between all `caption` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `caption` that are NOT shared between all overlay `caption` elements. These should be camelCase.
     * @param {function(Overlay, HTMLTableCaptionElement):void} [callback=()=>{}] - Additional JS modification to the `caption`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.180
     * @example
     * // Assume all <caption> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addCaption({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <caption id="foo" class="bar">Foobar.</caption>
     * </body>
     */
    addCaption(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const caption = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "caption", properties, additionalProperties);
      callback(this, caption);
      return this;
    }
    /** Adds a table header to the overlay.
     * This `thead` element will have properties shared between all `thead` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `thead` that are NOT shared between all overlay `thead` elements. These should be camelCase.
     * @param {function(Overlay, HTMLTableSectionElement):void} [callback=()=>{}] - Additional JS modification to the `thead`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.180
     * @example
     * // Assume all <thead> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addThead({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <thead id="foo" class="bar">Foobar.</thead>
     * </body>
     */
    addThead(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const thead = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "thead", properties, additionalProperties);
      callback(this, thead);
      return this;
    }
    /** Adds a table body to the overlay.
     * This `tbody` element will have properties shared between all `tbody` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `tbody` that are NOT shared between all overlay `tbody` elements. These should be camelCase.
     * @param {function(Overlay, HTMLTableSectionElement):void} [callback=()=>{}] - Additional JS modification to the `tbody`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.180
     * @example
     * // Assume all <tbody> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addTbody({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <tbody id="foo" class="bar">Foobar.</tbody>
     * </body>
     */
    addTbody(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const tbody = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "tbody", properties, additionalProperties);
      callback(this, tbody);
      return this;
    }
    /** Adds a table footer to the overlay.
     * This `tfoot` element will have properties shared between all `tfoot` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `tfoot` that are NOT shared between all overlay `tfoot` elements. These should be camelCase.
     * @param {function(Overlay, HTMLTableSectionElement):void} [callback=()=>{}] - Additional JS modification to the `tfoot`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.180
     * @example
     * // Assume all <tfoot> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addTfoot({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <tfoot id="foo" class="bar">Foobar.</tfoot>
     * </body>
     */
    addTfoot(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const tfoot = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "tfoot", properties, additionalProperties);
      callback(this, tfoot);
      return this;
    }
    /** Adds a table row to the overlay.
     * This `tr` element will have properties shared between all `tr` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `tr` that are NOT shared between all overlay `tr` elements. These should be camelCase.
     * @param {function(Overlay, HTMLTableRowElement):void} [callback=()=>{}] - Additional JS modification to the `tr`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.180
     * @example
     * // Assume all <tr> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addTr({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <tr id="foo" class="bar">Foobar.</tr>
     * </body>
     */
    addTr(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const tr = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "tr", properties, additionalProperties);
      callback(this, tr);
      return this;
    }
    /** Adds a table header (label) cell to the overlay.
     * This `th` element will have properties shared between all `th` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `th` that are NOT shared between all overlay `th` elements. These should be camelCase.
     * @param {function(Overlay, HTMLTableCellElement):void} [callback=()=>{}] - Additional JS modification to the `th`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.180
     * @example
     * // Assume all <th> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addTh({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <th id="foo" class="bar">Foobar.</th>
     * </body>
     */
    addTh(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const th = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "th", properties, additionalProperties);
      callback(this, th);
      return this;
    }
    /** Adds a table data cell to the overlay.
     * This `td` element will have properties shared between all `td` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `td` that are NOT shared between all overlay `td` elements. These should be camelCase.
     * @param {function(Overlay, HTMLTableCellElement):void} [callback=()=>{}] - Additional JS modification to the `td`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.180
     * @example
     * // Assume all <td> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addTd({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <td id="foo" class="bar">Foobar.</td>
     * </body>
     */
    addTd(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const td = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "td", properties, additionalProperties);
      callback(this, td);
      return this;
    }
    /** Adds a `button` to the overlay.
     * This `button` element will have properties shared between all `button` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `button` that are NOT shared between all overlay `button` elements. These should be camelCase.
     * @param {function(Overlay, HTMLButtonElement):void} [callback=()=>{}] - Additional JS modification to the `button`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.43.12
     * @example
     * // Assume all <button> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addButton({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <button id="foo" class="bar">Foobar.</button>
     * </body>
     */
    addButton(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const button = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "button", properties, additionalProperties);
      callback(this, button);
      return this;
    }
    /** Adds a help button to the overlay. It will have a "?" icon unless overridden in callback.
     * On click, the button will attempt to output the title to the output element (ID defined in Overlay constructor).
     * This `button` element will have properties shared between all `button` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `button` that are NOT shared between all overlay `button` elements. These should be camelCase.
     * @param {function(Overlay, HTMLButtonElement):void} [callback=()=>{}] - Additional JS modification to the `button`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.43.12
     * @example
     * // Assume all help button elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addButtonHelp({'id': 'foo', 'title': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <button id="foo" class="bar" title="Help: Foobar.">?</button>
     * </body>
     * @example
     * // Assume all help button elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addButtonHelp({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <button id="foo" class="bar" title="Help: Foobar.">?</button>
     * </body>
     */
    addButtonHelp(additionalProperties = {}, callback = () => {
    }) {
      const tooltip = additionalProperties["title"] ?? additionalProperties["textContent"] ?? "Help: No info";
      delete additionalProperties["textContent"];
      additionalProperties["title"] = `Help: ${tooltip}`;
      const properties = {
        "textContent": "?",
        "className": "bm-help",
        "onclick": () => {
          this.updateInnerHTML(this.outputStatusId, tooltip);
        }
      };
      const help = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "button", properties, additionalProperties);
      callback(this, help);
      return this;
    }
    /** Adds a `input` to the overlay.
     * This `input` element will have properties shared between all `input` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `input` that are NOT shared between all overlay `input` elements. These should be camelCase.
     * @param {function(Overlay, HTMLInputElement):void} [callback=()=>{}] - Additional JS modification to the `input`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.43.13
     * @example
     * // Assume all <input> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addInput({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <input id="foo" class="bar">Foobar.</input>
     * </body>
     */
    addInput(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const input = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "input", properties, additionalProperties);
      callback(this, input);
      return this;
    }
    /** Adds a file input to the overlay with enhanced visibility controls.
     * This input element will have properties shared between all file input elements in the overlay.
     * Uses multiple hiding methods to prevent browser native text from appearing during minimize/maximize.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the file input that are NOT shared between all overlay file input elements. These should be camelCase.
     * @param {function(Overlay, HTMLDivElement, HTMLInputElement, HTMLButtonElement):void} [callback=()=>{}] - Additional JS modification to the file input.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.43.17
     * @example
     * // Assume all file input elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addInputFile({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <div>
     *     <input type="file" id="foo" class="bar" style="display: none"></input>
     *     <button>Foobar.</button>
     *   </div>
     * </body>
     */
    addInputFile(additionalProperties = {}, callback = () => {
    }) {
      const properties = {
        "type": "file",
        "tabindex": "-1",
        "aria-hidden": "true"
      };
      const text = additionalProperties["textContent"] ?? "";
      delete additionalProperties["textContent"];
      const container = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "div");
      const input = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "input", properties, additionalProperties);
      this.buildElement();
      const button = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "button", { "textContent": text });
      this.buildElement();
      this.buildElement();
      button.addEventListener("click", () => {
        input.click();
      });
      input.addEventListener("change", () => {
        button.style.maxWidth = `${button.offsetWidth}px`;
        if (input.files.length > 0) {
          button.textContent = input.files[0].name;
        } else {
          button.textContent = text;
        }
      });
      callback(this, container, input, button);
      return this;
    }
    /** Adds a `textarea` to the overlay.
     * This `textarea` element will have properties shared between all `textarea` elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the `textarea` that are NOT shared between all overlay `textarea` elements. These should be camelCase.
     * @param {function(Overlay, HTMLTextAreaElement):void} [callback=()=>{}] - Additional JS modification to the `textarea`.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.43.13
     * @example
     * // Assume all <textarea> elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addTextarea({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <textarea id="foo" class="bar">Foobar.</textarea>
     * </body>
     */
    addTextarea(additionalProperties = {}, callback = () => {
    }) {
      const properties = {};
      const textarea = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "textarea", properties, additionalProperties);
      callback(this, textarea);
      return this;
    }
    /** Adds a dragbar `div` element to the overlay.
     * This dragbar element will have properties shared between all dragbar elements in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the dragbar that are NOT shared between all overlay dragbars. These should be camelCase.
     * @param {function(Overlay, HTMLDivElement):void} [callback=()=>{}] - Additional JS modification to the dragbar.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.145
     * @example
     * // Assume all dragbar elements have a shared class (e.g. {'className': 'bar'})
     * overlay.addDragbar({'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <div id="foo" class="bar">Foobar.</div>
     * </body>
     */
    addDragbar(additionalProperties = {}, callback = () => {
    }) {
      const properties = {
        "class": "bm-dragbar"
      };
      const dragbar = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "div", properties, additionalProperties);
      callback(this, dragbar);
      return this;
    }
    /** Adds a timer `time` element to the overlay.
     * This timer will countdown until it reaches the end date that was passed in.
     * Additionally, you can update the end date by changing the endDate dataset attribute on the element.
     * Timer elements are not localized. Output is HH:MM:SS with no units.
     * This timer will have properties shared between all timers in the overlay.
     * You can override the shared properties by using a callback.
     * @param {Date} [endDate=Date.now()] - The time to count down to.
     * @param {number} [updateInterval=500] - The time in milliseconds to update the display of the timer. Default is 500 milliseconds.
     * @param {Object.<string, any>} [additionalProperties={}] - The DOM properties of the timer that are NOT shared between all overlay timers. These should be camelCase.
     * @param {function(Overlay, HTMLTimeElement):void} [callback=()=>{}] - Additional JS modification to the timer.
     * @returns {Overlay} Overlay class instance (this)
     * @since 0.88.313
     * @example
     * // Assume all timers have a shared class (e.g. {'className': 'bar'})
     * overlay.addTimer(Date.now() + 2211632704000, 500, {'id': 'foo', 'textContent': 'Foobar.'}).buildOverlay(document.body);
     * // Output:
     * // (Assume <body> already exists in the webpage)
     * <body>
     *   <time id="bm-timer-dh8fhw80" class="bar" datetime="PT27H34M56S" data-end-date="1771749296000">27:34:56</div>
     * </body>
     */
    addTimer(endDate = Date.now(), updateInterval = 500, additionalProperties = {}, callback = () => {
    }) {
      const timerClass = "bm-timer";
      const timerID = additionalProperties?.["id"] || timerClass + "-" + crypto.randomUUID().slice(0, 8);
      const properties = {
        "class": timerClass
      };
      const timer = __privateMethod(this, _Overlay_instances, createElement_fn).call(this, "time", properties, additionalProperties);
      timer.id = timerID;
      timer.dataset["endDate"] = endDate;
      setInterval(() => {
        if (!timer.isConnected) {
          return;
        }
        const timeRemainingTotalMs = Math.max(timer.dataset["endDate"] - Date.now(), 0);
        const timeRemainingTotalSec = Math.floor(timeRemainingTotalMs / 1e3);
        const timeRemainingTotalHr = Math.floor(timeRemainingTotalSec / 3600);
        const timeRemainingOnlySec = Math.floor(timeRemainingTotalSec % 60);
        const timeRemainingOnlyMin = Math.floor(timeRemainingTotalSec % 3600 / 60);
        timer.setAttribute("datetime", `PT${timeRemainingTotalHr}H${timeRemainingOnlyMin}M${timeRemainingOnlySec}S`);
        timer.textContent = String(timeRemainingTotalHr).padStart(2, "0") + ":" + String(timeRemainingOnlyMin).padStart(2, "0") + ":" + String(timeRemainingOnlySec).padStart(2, "0");
      }, updateInterval);
      callback(this, timer);
      return this;
    }
    /** Updates the inner HTML of the element.
     * The element is discovered by it's id.
     * If the element is an `input`, it will modify the value attribute instead.
     * @param {string} id - The ID of the element to change
     * @param {string} html - The HTML/text to update with
     * @param {boolean} [doSafe] - (Optional) Should `textContent` be used instead of `innerHTML` to avoid XSS? False by default
     * @since 0.24.2
     */
    updateInnerHTML(id, html, doSafe = false) {
      const element = document.getElementById(id.replace(/^#/, ""));
      if (!element) {
        return;
      }
      if (element instanceof HTMLInputElement) {
        element.value = html;
        return;
      }
      if (doSafe) {
        element.textContent = html;
      } else {
        element.innerHTML = html;
      }
    }
    /** Animates a newly-mounted window without changing its final visual state.
     * @param {HTMLElement} windowElement - Window that was added to the document
     * @since 0.99.0
     */
    handleWindowOpen(windowElement) {
      if (!windowElement) {
        return;
      }
      const content = windowElement.querySelector(".bm-window-content");
      const dragbar = windowElement.querySelector(".bm-dragbar");
      windowElement.classList.add("bm-window-motion");
      const animations = [
        startMotion(windowElement, [
          { opacity: 0.32, clipPath: "inset(0 0 86% 0 round 16px)" },
          { opacity: 1, clipPath: "inset(0 0 0 0 round 16px)" }
        ], { duration: motionTiming.window, easing: motionTiming.spring }),
        startMotion(content, [
          { opacity: 0, transform: "translateY(-10px) scaleY(.97)" },
          { opacity: 1, transform: "translateY(0) scaleY(1)" }
        ], { duration: motionTiming.window, delay: 24, easing: motionTiming.spring }),
        startMotion(dragbar, [
          { opacity: 0.7, transform: "translateY(-4px) scale(.985)" },
          { opacity: 1, transform: "translateY(0) scale(1)" }
        ], { duration: 240, easing: motionTiming.spring })
      ];
      void waitForMotion(animations).then(() => {
        releaseMotion(animations);
        windowElement.classList.remove("bm-window-motion");
      });
    }
    /** Animates and removes a window.
     * @param {HTMLElement} windowElement - Window to remove
     * @returns {Promise<void>}
     * @since 0.99.0
     */
    async handleWindowClose(windowElement) {
      if (!windowElement?.isConnected) {
        return;
      }
      const content = windowElement.querySelector(".bm-window-content");
      const dragbar = windowElement.querySelector(".bm-dragbar");
      windowElement.classList.add("bm-window-motion", "bm-window-closing");
      windowElement.setAttribute("aria-hidden", "true");
      const animations = [
        startMotion(windowElement, [
          { opacity: 1, clipPath: "inset(0 0 0 0 round 16px)" },
          { opacity: 0, clipPath: "inset(0 0 88% 0 round 16px)" }
        ], { duration: 220, easing: motionTiming.ease }),
        startMotion(content, [
          { opacity: 1, transform: "translateY(0) scaleY(1)" },
          { opacity: 0, transform: "translateY(-8px) scaleY(.97)" }
        ], { duration: motionTiming.fast, easing: motionTiming.ease }),
        startMotion(dragbar, [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0.72, transform: "scale(.98)" }
        ], { duration: 200, easing: motionTiming.ease })
      ];
      await waitForMotion(animations);
      windowElement.remove();
      releaseMotion(animations);
    }
    /** Runs a compositor-only FLIP animation around a layout change.
     * @param {HTMLElement} element - Element whose bounds will change
     * @param {function():void} updateLayout - Synchronous DOM update
     * @param {{duration?: number}} [options={}]
     * @since 0.99.0
     */
    animateLayoutChange(element, updateLayout, options = {}) {
      if (!element || typeof updateLayout != "function" || shouldReduceMotion()) {
        updateLayout?.();
        return;
      }
      const first = element.getBoundingClientRect();
      updateLayout();
      const last = element.getBoundingClientRect();
      if (!first.width || !first.height || !last.width || !last.height) {
        return;
      }
      const animation = startMotion(element, [
        {
          scale: `${first.width / last.width} ${first.height / last.height}`,
          transformOrigin: "top left"
        },
        { scale: "1 1", transformOrigin: "top left" }
      ], { duration: options.duration ?? 280, easing: motionTiming.spring });
      if (!animation) {
        return;
      }
      element.classList.add("bm-window-motion");
      void waitForMotion([animation]).then(() => {
        animation.cancel();
        element.classList.remove("bm-window-motion");
      });
    }
    /** Animates visible list items from their previous positions after a reorder.
     * @param {HTMLElement[]} elements - Items being reordered
     * @param {function():void} updateList - Synchronous DOM update
     * @since 0.99.0
     */
    animateListReorder(elements, updateList) {
      if (!Array.isArray(elements) || typeof updateList != "function" || shouldReduceMotion()) {
        updateList?.();
        return;
      }
      if (elements[0]?.closest(".bm-window")?.classList.contains("bm-window-motion")) {
        updateList();
        return;
      }
      const viewport = elements[0]?.closest(".bm-scrollable")?.getBoundingClientRect() ?? elements[0]?.parentElement?.getBoundingClientRect();
      const isVisible = (rect) => rect.width > 0 && rect.height > 0 && (!viewport || rect.bottom >= viewport.top && rect.top <= viewport.bottom && rect.right >= viewport.left && rect.left <= viewport.right);
      const first = /* @__PURE__ */ new Map();
      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        if (isVisible(rect)) {
          first.set(element, rect);
        }
      }
      updateList();
      for (const element of elements) {
        const previous = first.get(element);
        if (!previous) {
          continue;
        }
        const next = element.getBoundingClientRect();
        if (!isVisible(next)) {
          continue;
        }
        const deltaX = previous.left - next.left;
        const deltaY = previous.top - next.top;
        if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
          continue;
        }
        const animation = startMotion(element, [
          { translate: `${deltaX}px ${deltaY}px` },
          { translate: "0 0" }
        ], { duration: 260, easing: motionTiming.spring });
        if (animation) {
          void animation.finished.catch(() => {
          }).then(() => animation.cancel());
        }
      }
    }
    /** Gives a changed control group a short liquid settle animation.
     * @param {HTMLElement} element - Updated group
     * @since 0.99.0
     */
    animateStateChange(element) {
      const animation = startMotion(element, [
        { opacity: 0.76, scale: ".992 .985" },
        { opacity: 1, scale: "1 1" }
      ], { duration: 220, easing: motionTiming.spring });
      if (animation) {
        void animation.finished.catch(() => {
        }).then(() => animation.cancel());
      }
    }
    /** Handles the minimization logic for windows spawned by Blue Marble
     * @param {HTMLButtonElement} button - The UI button that triggered this minimization event
     * @since 0.88.142
    */
    async handleMinimization(button) {
      if (button.disabled) {
        return;
      }
      button.disabled = true;
      button.style.textDecoration = "none";
      const window2 = button.closest(".bm-window");
      const dragbar = button.closest(".bm-dragbar");
      const windowContent = window2?.querySelector(".bm-window-content");
      const titleSlot = button.nextElementSibling;
      const persistentDragbarHeader = titleSlot?.querySelector(".bm-dragbar-title-persistent");
      const header = persistentDragbarHeader ?? windowContent?.querySelector("h1") ?? window2?.querySelector("h1");
      if (!window2 || !dragbar || !windowContent) {
        button.disabled = false;
        button.style.textDecoration = "";
        return;
      }
      const getCollapsedHeight = () => {
        const windowStyle = getComputedStyle(window2);
        const toPixels = (value) => parseFloat(value) || 0;
        const extraHeight = windowStyle.boxSizing == "border-box" ? toPixels(windowStyle.paddingTop) + toPixels(windowStyle.paddingBottom) + toPixels(windowStyle.borderTopWidth) + toPixels(windowStyle.borderBottomWidth) : 0;
        return Math.ceil(dragbar.getBoundingClientRect().height + extraHeight + 2);
      };
      window2.parentElement.append(window2);
      const animateMinimizeIcon = () => {
        const icon = button.querySelector("svg");
        const animation = startMotion(icon, [
          { opacity: 0.3, transform: "rotate(-28deg) scale(.72)" },
          { opacity: 1, transform: "rotate(0) scale(1)" }
        ], { duration: 240, easing: motionTiming.spring });
        if (animation) {
          void animation.finished.catch(() => {
          }).then(() => animation.cancel());
        }
      };
      const collapsedHeight = getCollapsedHeight();
      window2.classList.add("bm-window-motion");
      if (button.dataset["buttonStatus"] == "expanded") {
        window2.dataset["widthBeforeMinimize"] = window2.style.width;
        window2.dataset["heightBeforeMinimize"] = window2.style.height;
        window2.dataset["minHeightBeforeMinimize"] = window2.style.minHeight;
        const expandedRect = window2.getBoundingClientRect();
        if (!window2.style.width) {
          const style = getComputedStyle(window2);
          const horizontalExtras = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) + (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0);
          const width = style.boxSizing == "border-box" ? expandedRect.width : expandedRect.width - horizontalExtras;
          window2.style.width = `${Math.max(0, width)}px`;
        }
        const dragbarHeader1 = persistentDragbarHeader ?? header?.cloneNode(true) ?? document.createElement("h1");
        const dragbarHeader1Text = dragbarHeader1.textContent;
        if (!persistentDragbarHeader) {
          dragbarHeader1.classList.add("bm-dragbar-minimized-title");
          (titleSlot ?? dragbar).appendChild(dragbarHeader1);
        }
        button.innerHTML = minimizeIconCollapsed;
        animateMinimizeIcon();
        button.dataset["buttonStatus"] = "collapsed";
        button.ariaLabel = `Unminimize window "${dragbarHeader1Text}"`;
        button.title = button.ariaLabel;
        const clipBottom = Math.max(0, expandedRect.height - collapsedHeight);
        const animations = [
          startMotion(window2, [
            { clipPath: "inset(0 0 0 0 round 16px)" },
            { clipPath: `inset(0 0 ${clipBottom}px 0 round 16px)` }
          ], { duration: motionTiming.window, easing: motionTiming.spring }),
          startMotion(windowContent, [
            { opacity: 1, transform: "translateY(0) scaleY(1)" },
            { opacity: 0, transform: "translateY(-10px) scaleY(.96)" }
          ], { duration: 220, easing: motionTiming.ease })
        ];
        await waitForMotion(animations);
        windowContent.hidden = true;
        windowContent.setAttribute("aria-hidden", "true");
        window2.classList.add("bm-window-collapsed");
        window2.style.minHeight = "0px";
        if (window2.dataset["heightBeforeMinimize"] || window2.classList.contains("bm-windowed")) {
          const windowStyle = getComputedStyle(window2);
          const height = windowStyle.boxSizing == "border-box" ? collapsedHeight : Math.max(0, collapsedHeight - ((parseFloat(windowStyle.paddingTop) || 0) + (parseFloat(windowStyle.paddingBottom) || 0) + (parseFloat(windowStyle.borderTopWidth) || 0) + (parseFloat(windowStyle.borderBottomWidth) || 0)));
          window2.style.height = `${height}px`;
        } else {
          window2.style.height = "";
        }
        releaseMotion(animations);
      } else {
        const dragbarHeader1 = dragbar.querySelector(".bm-dragbar-minimized-title") ?? dragbar.querySelector(".bm-dragbar-title-persistent") ?? dragbar.querySelector("h1") ?? document.createElement("h1");
        const dragbarHeader1Text = dragbarHeader1.textContent;
        if (dragbarHeader1.classList.contains("bm-dragbar-minimized-title")) {
          dragbarHeader1.remove();
        }
        const collapsedRect = window2.getBoundingClientRect();
        windowContent.hidden = false;
        windowContent.removeAttribute("aria-hidden");
        window2.classList.remove("bm-window-collapsed");
        window2.style.width = window2.dataset["widthBeforeMinimize"] ?? "";
        window2.style.minHeight = window2.dataset["minHeightBeforeMinimize"] ?? "";
        window2.style.height = window2.dataset["heightBeforeMinimize"] ?? "";
        const expandedRect = window2.getBoundingClientRect();
        button.innerHTML = minimizeIconExpanded;
        animateMinimizeIcon();
        button.dataset["buttonStatus"] = "expanded";
        button.ariaLabel = `Minimize window "${dragbarHeader1Text}"`;
        button.title = button.ariaLabel;
        const clipBottom = Math.max(0, expandedRect.height - collapsedRect.height);
        const animations = [
          startMotion(window2, [
            { clipPath: `inset(0 0 ${clipBottom}px 0 round 16px)` },
            { clipPath: "inset(0 0 0 0 round 16px)" }
          ], { duration: motionTiming.window, easing: motionTiming.spring }),
          startMotion(windowContent, [
            { opacity: 0, transform: "translateY(-10px) scaleY(.96)" },
            { opacity: 1, transform: "translateY(0) scaleY(1)" }
          ], { duration: 260, delay: 30, easing: motionTiming.spring })
        ];
        await waitForMotion(animations);
        delete window2.dataset["widthBeforeMinimize"];
        delete window2.dataset["heightBeforeMinimize"];
        delete window2.dataset["minHeightBeforeMinimize"];
        releaseMotion(animations);
      }
      window2.classList.remove("bm-window-motion");
      button.disabled = false;
      button.style.textDecoration = "";
    }
    /** Handles dragging of the overlay.
     * Uses requestAnimationFrame for smooth animations and GPU-accelerated transforms.
     * Make sure to use the appropriate CSS selectors.
     * @param {string} moveMeSelector - The element to be moved
     * @param {string} iMoveThingsSelector - The drag handle element
     * @since 0.8.2
    */
    handleDrag(moveMeSelector, iMoveThingsSelector, options = {}) {
      const moveMe = document.querySelector(moveMeSelector);
      const iMoveThings = document.querySelector(iMoveThingsSelector);
      const onEnd = options?.onEnd ?? (() => {
      });
      if (!moveMe || !iMoveThings) {
        this.handleDisplayError(`Can not drag! ${!moveMe ? "moveMe" : ""} ${!moveMe && !iMoveThings ? "and " : ""}${!iMoveThings ? "iMoveThings " : ""}was not found!`);
        return;
      }
      let pointerID = null;
      let offsetX = 0;
      let offsetY = 0;
      let currentX = 0;
      let currentY = 0;
      let targetX = 0;
      let targetY = 0;
      let animationFrame = null;
      const updatePosition = () => {
        animationFrame = null;
        if (pointerID == null) {
          return;
        }
        if (Math.abs(currentX - targetX) < 0.5 && Math.abs(currentY - targetY) < 0.5) {
          return;
        }
        currentX = targetX;
        currentY = targetY;
        moveMe.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      };
      const schedulePositionUpdate = () => {
        if (animationFrame == null) {
          animationFrame = requestAnimationFrame(updatePosition);
        }
      };
      const endDrag = (event) => {
        if (pointerID == null || event?.pointerId != null && event.pointerId != pointerID) {
          return;
        }
        if (animationFrame != null) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
        currentX = targetX;
        currentY = targetY;
        moveMe.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        const completedPointerID = pointerID;
        pointerID = null;
        if (iMoveThings.hasPointerCapture?.(completedPointerID)) {
          iMoveThings.releasePointerCapture(completedPointerID);
        }
        document.body.style.userSelect = "";
        iMoveThings.classList.remove("bm-dragging");
        moveMe.classList.remove("bm-window-interacting");
        onEnd({ element: moveMe, x: currentX, y: currentY });
      };
      iMoveThings.addEventListener("pointerdown", (event) => {
        if (pointerID != null || event.pointerType == "mouse" && event.button != 0) {
          return;
        }
        if (event.target.closest('button, a, input, select, textarea, [role="button"]')) {
          return;
        }
        const rect = moveMe.getBoundingClientRect();
        pointerID = event.pointerId;
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
        currentX = rect.left;
        currentY = rect.top;
        targetX = currentX;
        targetY = currentY;
        moveMe.style.left = "0px";
        moveMe.style.top = "0px";
        moveMe.style.right = "";
        moveMe.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        document.body.style.userSelect = "none";
        iMoveThings.classList.add("bm-dragging");
        moveMe.classList.add("bm-window-interacting");
        iMoveThings.setPointerCapture?.(pointerID);
        event.preventDefault();
      });
      iMoveThings.addEventListener("pointermove", (event) => {
        if (event.pointerId != pointerID) {
          return;
        }
        targetX = event.clientX - offsetX;
        targetY = event.clientY - offsetY;
        schedulePositionUpdate();
      });
      iMoveThings.addEventListener("pointerup", endDrag);
      iMoveThings.addEventListener("pointercancel", endDrag);
      iMoveThings.addEventListener("lostpointercapture", endDrag);
    }
    /** Handles resizing of an overlay window from a resize handle.
     * @param {string} resizeMeSelector - The element to resize
     * @param {string} iResizeThingsSelector - The resize handle element
     * @param {{onEnd?: function({element: HTMLElement, width: number, height: number}): void, minWidth?: number | function(): number, minHeight?: number | function(): number, maxWidth?: number | function(): number, maxHeight?: number | function(): number}} [options={}]
     * @since 0.92.0
     */
    handleResize(resizeMeSelector, iResizeThingsSelector, options = {}) {
      const resizeMe = document.querySelector(resizeMeSelector);
      const iResizeThings = document.querySelector(iResizeThingsSelector);
      const onEnd = options?.onEnd ?? (() => {
      });
      if (!resizeMe || !iResizeThings) {
        this.handleDisplayError(`Can not resize! ${!resizeMe ? "resizeMe" : ""} ${!resizeMe && !iResizeThings ? "and " : ""}${!iResizeThings ? "iResizeThings " : ""}was not found!`);
        return;
      }
      let pointerID = null;
      let startX = 0;
      let startY = 0;
      let startWidth = 0;
      let startHeight = 0;
      let currentWidth = 0;
      let currentHeight = 0;
      let targetWidth = 0;
      let targetHeight = 0;
      let animationFrame = null;
      let minimumWidth = 0;
      let minimumHeight = 0;
      let maximumWidth = 0;
      let maximumHeight = 0;
      const getMaximumWidth = () => {
        const maximumWidth2 = typeof options?.maxWidth == "function" ? options.maxWidth() : options?.maxWidth;
        return Number.isFinite(maximumWidth2) ? maximumWidth2 : window.innerWidth - 16;
      };
      const getMaximumHeight = () => {
        const maximumHeight2 = typeof options?.maxHeight == "function" ? options.maxHeight() : options?.maxHeight;
        return Number.isFinite(maximumHeight2) ? maximumHeight2 : window.innerHeight - 16;
      };
      const getMinimumWidth = () => {
        const minimumWidth2 = typeof options?.minWidth == "function" ? options.minWidth() : options?.minWidth;
        return Number.isFinite(minimumWidth2) ? minimumWidth2 : 200;
      };
      const getMinimumHeight = () => {
        const minimumHeight2 = typeof options?.minHeight == "function" ? options.minHeight() : options?.minHeight;
        return Number.isFinite(minimumHeight2) ? minimumHeight2 : 160;
      };
      const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
      const updateSize = () => {
        animationFrame = null;
        if (pointerID == null) {
          return;
        }
        if (Math.abs(currentWidth - targetWidth) < 0.5 && Math.abs(currentHeight - targetHeight) < 0.5) {
          return;
        }
        currentWidth = targetWidth;
        currentHeight = targetHeight;
        resizeMe.style.width = `${currentWidth}px`;
        resizeMe.style.height = `${currentHeight}px`;
      };
      const scheduleSizeUpdate = () => {
        if (animationFrame == null) {
          animationFrame = requestAnimationFrame(updateSize);
        }
      };
      const startResize = (event) => {
        const rect = resizeMe.getBoundingClientRect();
        pointerID = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        startWidth = rect.width;
        startHeight = rect.height;
        currentWidth = startWidth;
        currentHeight = startHeight;
        targetWidth = startWidth;
        targetHeight = startHeight;
        minimumWidth = getMinimumWidth();
        minimumHeight = getMinimumHeight();
        maximumWidth = getMaximumWidth();
        maximumHeight = getMaximumHeight();
        document.body.style.userSelect = "none";
        iResizeThings.classList.add("bm-resizing");
        resizeMe.classList.add("bm-window-interacting");
        iResizeThings.setPointerCapture?.(pointerID);
      };
      const endResize = (event) => {
        if (pointerID == null || event?.pointerId != null && event.pointerId != pointerID) {
          return;
        }
        if (animationFrame != null) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
        currentWidth = targetWidth;
        currentHeight = targetHeight;
        resizeMe.style.width = `${currentWidth}px`;
        resizeMe.style.height = `${currentHeight}px`;
        const completedPointerID = pointerID;
        pointerID = null;
        if (iResizeThings.hasPointerCapture?.(completedPointerID)) {
          iResizeThings.releasePointerCapture(completedPointerID);
        }
        document.body.style.userSelect = "";
        iResizeThings.classList.remove("bm-resizing");
        resizeMe.classList.remove("bm-window-interacting");
        onEnd({
          element: resizeMe,
          width: currentWidth,
          height: currentHeight
        });
      };
      iResizeThings.addEventListener("pointerdown", (event) => {
        if (pointerID != null || resizeMe.classList.contains("bm-window-collapsed") || event.pointerType == "mouse" && event.button != 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        startResize(event);
      });
      iResizeThings.addEventListener("pointermove", (event) => {
        if (event.pointerId != pointerID) {
          return;
        }
        targetWidth = clamp(startWidth + (event.clientX - startX), minimumWidth, maximumWidth);
        targetHeight = clamp(startHeight + (event.clientY - startY), minimumHeight, maximumHeight);
        scheduleSizeUpdate();
      });
      iResizeThings.addEventListener("pointerup", endResize);
      iResizeThings.addEventListener("pointercancel", endResize);
      iResizeThings.addEventListener("lostpointercapture", endResize);
    }
    /** Handles status display.
     * This will output plain text into the output Status box.
     * Additionally, this will output an info message to the console.
     * @param {string} text - The status text to display.
     * @since 0.58.4
     */
    handleDisplayStatus(text) {
      const consoleInfo = console.info;
      consoleInfo(`${this.name}: ${text}`);
      this.updateInnerHTML(this.outputStatusId, "Status: " + text, true);
    }
    /** Handles error display.
     * This will output plain text into the output Status box.
     * Additionally, this will output an error to the console.
     * @param {string} text - The error text to display.
     * @since 0.41.6
     */
    handleDisplayError(text) {
      const consoleError2 = console.error;
      consoleError2(`${this.name}: ${text}`);
      this.updateInnerHTML(this.outputStatusId, "Error: " + text, true);
    }
  };
  _Overlay_instances = new WeakSet();
  /** Creates an element.
   * For **internal use** of the {@link Overlay} class.
   * @param {string} tag - The tag name as a string.
   * @param {Object.<string, any>} [properties={}] - The DOM properties of the element.
   * @returns {HTMLElement} HTML Element
   * @since 0.43.2
   */
  createElement_fn = function(tag, properties = {}, additionalProperties = {}) {
    const element = document.createElement(tag);
    if (!this.overlay) {
      this.overlay = element;
      this.currentParent = element;
    } else {
      this.currentParent?.appendChild(element);
      this.parentStack.push(this.currentParent);
      this.currentParent = element;
    }
    for (const [property, value] of Object.entries(properties)) {
      __privateMethod(this, _Overlay_instances, applyAttribute_fn).call(this, element, property, value);
    }
    for (const [property, value] of Object.entries(additionalProperties)) {
      __privateMethod(this, _Overlay_instances, applyAttribute_fn).call(this, element, property, value);
    }
    return element;
  };
  /** Applies an attribute to an element
   * @param {HTMLElement} element - The element to apply the attribute to
   * @param {String} property - The name of the attribute to apply
   * @param {String} value - The value of the attribute
   * @since 0.88.136
   */
  applyAttribute_fn = function(element, property, value) {
    if (property == "class") {
      element.classList.add(...value.split(/\s+/));
    } else if (property == "for") {
      element.htmlFor = value;
    } else if (property == "tabindex") {
      element.tabIndex = Number(value);
    } else if (property == "readonly") {
      element.readOnly = value == "true" || value == "1";
    } else if (property == "maxlength") {
      element.maxLength = Number(value);
    } else if (property.startsWith("data")) {
      element.dataset[property.slice(5).split("-").map(
        (part, i) => i == 0 ? part : part[0].toUpperCase() + part.slice(1)
      ).join("")] = value;
    } else if (property.startsWith("aria")) {
      element.setAttribute(property, value);
    } else {
      element[property] = value;
    }
  };

  // src/WindowSettings.js
  var closeIcon = '<svg class="bm-button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var _WindowSettings_instances, getWindowState_fn, closeWindow_fn, clampWindowPosition_fn, restoreWindowPosition_fn, saveWindowPosition_fn, initializeWindowPositionPersistence_fn, errorOverrideFailure_fn;
  var WindowSettings = class extends Overlay {
    /** Constructor for the Settings window
     * @param {string} name - The name of the userscript
     * @param {string} version - The version of the userscript
     * @since 0.91.11
     * @see {@link Overlay#constructor} for examples
     */
    constructor(name2, version2) {
      super(name2, version2);
      __privateAdd(this, _WindowSettings_instances);
      this.window = null;
      this.windowID = "bm-window-settings";
      this.windowParent = document.body;
      this.windowStateKey = "windowSettings";
    }
    /** Spawns a Settings window.
     * If another settings window already exists, we DON'T spawn another!
     * Parent/child relationships in the DOM structure below are indicated by indentation.
     * @since 0.91.11
     */
    buildWindow() {
      if (document.querySelector(`#${this.windowID}`)) {
        __privateMethod(this, _WindowSettings_instances, closeWindow_fn).call(this);
        return;
      }
      this.window = this.addDiv({ "id": this.windowID, "class": "bm-window" }).addDragbar().addButton({ "class": "bm-button-circle", "innerHTML": minimizeIconExpanded, "aria-label": 'Minimize window "Settings"', "data-button-status": "expanded" }, (instance, button) => {
        button.onclick = () => instance.handleMinimization(button);
      }).buildElement().addDiv({ "class": "bm-settings-drag-title-slot" }).addHeader(1, { "class": "bm-dragbar-title-persistent bm-settings-drag-title", "textContent": "Settings" }).buildElement().buildElement().addDiv({ "class": "bm-flex-center" }).addButton({ "class": "bm-button-circle", "innerHTML": closeIcon, "aria-label": 'Close window "Settings"' }, (instance, button) => {
        button.onclick = () => __privateMethod(this, _WindowSettings_instances, closeWindow_fn).call(this);
      }).buildElement().buildElement().buildElement().addDiv({ "class": "bm-window-content" }).addHr({ "class": "bm-window-divider-top" }).buildElement().addDiv({ "class": "bm-container bm-scrollable" }, (instance, div) => {
        this.buildHotkeys();
        this.buildHighlight();
        this.buildTemplate();
      }).buildElement().buildElement().buildElement().buildOverlay(this.windowParent);
      __privateMethod(this, _WindowSettings_instances, initializeWindowPositionPersistence_fn).call(this);
    }
    /** Builds the highlight section of the window.
     * This should be overriden by {@link SettingsManager}
     * @since 0.91.11
     */
    buildHighlight() {
      __privateMethod(this, _WindowSettings_instances, errorOverrideFailure_fn).call(this, "Pixel Highlight");
    }
    /** Builds the hotkey section of the window.
     * This should be overriden by {@link SettingsManager}
     * @since 0.99.0
     */
    buildHotkeys() {
      __privateMethod(this, _WindowSettings_instances, errorOverrideFailure_fn).call(this, "Hotkeys");
    }
    /** Builds the template section of the window.
     * This should be overriden by {@link SettingsManager}
     * @since 0.91.68
     */
    buildTemplate() {
      __privateMethod(this, _WindowSettings_instances, errorOverrideFailure_fn).call(this, "Template");
    }
  };
  _WindowSettings_instances = new WeakSet();
  /** Retrieves the persisted settings window state object.
   * @returns {Object | null}
   * @since 0.95.0
   */
  getWindowState_fn = function() {
    var _a, _b;
    if (!this.userSettings) {
      return null;
    }
    (_a = this.userSettings)[_b = this.windowStateKey] ?? (_a[_b] = {});
    return this.userSettings[this.windowStateKey];
  };
  closeWindow_fn = async function() {
    const windowElement = document.querySelector(`#${this.windowID}`);
    __privateMethod(this, _WindowSettings_instances, saveWindowPosition_fn).call(this, windowElement);
    await this.handleWindowClose(windowElement);
  };
  /** Returns a viewport-safe position for the settings window.
   * @param {HTMLElement} windowElement
   * @param {number} x
   * @param {number} y
   * @returns {{x: number, y: number}}
   * @since 0.95.0
   */
  clampWindowPosition_fn = function(windowElement, x, y) {
    const margin = 8;
    const maxX = Math.max(margin, window.innerWidth - windowElement.offsetWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - windowElement.offsetHeight - margin);
    return {
      x: Math.min(Math.max(Math.round(Number(x) || margin), margin), maxX),
      y: Math.min(Math.max(Math.round(Number(y) || margin), margin), maxY)
    };
  };
  /** Restores the persisted position for the settings window.
   * @param {HTMLElement} windowElement
   * @since 0.95.0
   */
  restoreWindowPosition_fn = function(windowElement) {
    const windowState = __privateMethod(this, _WindowSettings_instances, getWindowState_fn).call(this);
    if (!windowState || !windowElement) {
      return;
    }
    requestAnimationFrame(() => {
      if (!windowElement.isConnected) {
        return;
      }
      const x = Number(windowState.x);
      const y = Number(windowState.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return;
      }
      const clampedPosition = __privateMethod(this, _WindowSettings_instances, clampWindowPosition_fn).call(this, windowElement, x, y);
      windowElement.style.left = "0px";
      windowElement.style.top = "0px";
      windowElement.style.right = "";
      windowElement.style.transform = `translate(${clampedPosition.x}px, ${clampedPosition.y}px)`;
      if (clampedPosition.x != x || clampedPosition.y != y) {
        windowState.x = clampedPosition.x;
        windowState.y = clampedPosition.y;
        void this.saveUserStorageNow?.();
      }
    });
  };
  /** Saves the current position of the settings window.
   * @param {HTMLElement} windowElement
   * @since 0.95.0
   */
  saveWindowPosition_fn = function(windowElement) {
    const windowState = __privateMethod(this, _WindowSettings_instances, getWindowState_fn).call(this);
    if (!windowState || !windowElement?.isConnected) {
      return;
    }
    const rect = windowElement.getBoundingClientRect();
    const clampedPosition = __privateMethod(this, _WindowSettings_instances, clampWindowPosition_fn).call(this, windowElement, rect.left, rect.top);
    windowElement.style.left = "0px";
    windowElement.style.top = "0px";
    windowElement.style.right = "";
    windowElement.style.transform = `translate(${clampedPosition.x}px, ${clampedPosition.y}px)`;
    windowState.x = clampedPosition.x;
    windowState.y = clampedPosition.y;
    void this.saveUserStorageNow?.();
  };
  /** Enables position persistence for the settings window.
   * @since 0.95.0
   */
  initializeWindowPositionPersistence_fn = function() {
    const windowElement = document.querySelector(`#${this.windowID}.bm-window`);
    if (!windowElement) {
      return;
    }
    __privateMethod(this, _WindowSettings_instances, restoreWindowPosition_fn).call(this, windowElement);
    this.handleDrag(`#${this.windowID}.bm-window`, `#${this.windowID} .bm-dragbar`, {
      onEnd: ({ element }) => __privateMethod(this, _WindowSettings_instances, saveWindowPosition_fn).call(this, element)
    });
  };
  /** Displays an error when a settings category fails to load.
   * @param {string} name - The name of the category
   * @since 0.91.11
   */
  errorOverrideFailure_fn = function(name2) {
    this.window = this.addDiv({ "class": "bm-container" }).addHeader(2, { "textContent": name2 }).buildElement().addHr().buildElement().addP({ "innerHTML": `An error occured loading the ${name2} category. <code>SettingsManager</code> failed to override the ${name2} function inside <code>WindowSettings</code>.` }).buildElement().buildElement();
  };

  // src/settingsManager.js
  var _SettingsManager_instances, normalizeHotkeyCode_fn, formatHotkeyCode_fn, broadcastPaintAreaHotkey_fn, updateHighlightSettings_fn, updateHighlightToPreset_fn;
  var SettingsManager = class extends WindowSettings {
    /** Constructor for the SettingsManager class
     * @param {string} name - The name of the userscript
     * @param {string} version - The version of the userscript
     * @param {Object} userSettings - The user settings as an object
     * @since 0.91.11
     */
    constructor(name2, version2, userSettings2) {
      var _a;
      super(name2, version2);
      __privateAdd(this, _SettingsManager_instances);
      this.userSettings = userSettings2;
      (_a = this.userSettings).flags ?? (_a.flags = []);
      if (!this.userSettings.hotkeys || typeof this.userSettings.hotkeys != "object" || Array.isArray(this.userSettings.hotkeys)) {
        this.userSettings.hotkeys = {};
      }
      this.userSettings.hotkeys.paintArea = __privateMethod(this, _SettingsManager_instances, normalizeHotkeyCode_fn).call(this, this.userSettings.hotkeys.paintArea);
      this.userSettingsOld = structuredClone(this.userSettings);
      this.userSettingsSaveLocation = "bmUserSettings";
      this.updateFrequency = 5e3;
      this.lastUpdateTime = 0;
      setInterval(this.updateUserStorage.bind(this), this.updateFrequency);
      __privateMethod(this, _SettingsManager_instances, broadcastPaintAreaHotkey_fn).call(this);
    }
    /** Stores a new area-selection hotkey.
     * @param {string} code
     * @returns {Promise<void>}
     * @since 0.99.0
     */
    async setPaintAreaHotkey(code) {
      this.userSettings.hotkeys.paintArea = __privateMethod(this, _SettingsManager_instances, normalizeHotkeyCode_fn).call(this, code);
      __privateMethod(this, _SettingsManager_instances, broadcastPaintAreaHotkey_fn).call(this);
      await this.saveUserStorageNow();
    }
    /** Updates the user settings in userscript storage
     * @since 0.91.39
     */
    async updateUserStorage() {
      await this.saveUserStorage();
    }
    /** Saves the user settings in userscript storage.
     * @param {boolean} [force=false] - Should the throttle be ignored?
     * @since 0.92.0
     */
    async saveUserStorage(force = false) {
      const userSettingsCurrent = JSON.stringify(this.userSettings);
      const userSettingsOld = JSON.stringify(this.userSettingsOld);
      if (userSettingsCurrent != userSettingsOld && (force || Date.now() - this.lastUpdateTime > this.updateFrequency)) {
        await GM.setValue(this.userSettingsSaveLocation, userSettingsCurrent);
        this.userSettingsOld = structuredClone(this.userSettings);
        this.lastUpdateTime = Date.now();
        console.log(userSettingsCurrent);
      }
    }
    /** Immediately saves the user settings in userscript storage.
     * @since 0.92.0
     */
    async saveUserStorageNow() {
      await this.saveUserStorage(true);
    }
    /** Toggles a boolean flag to the state that was passed in.
     * If no state was passed in, the flag will flip to the opposite state.
     * The existence of the flag determines its state. If it exists, it is `true`.
     * @param {string} flagName - The name of the flag to toggle
     * @param {boolean} [state=undefined] - (Optional) The state to change the flag to
     * @since 0.91.60
     */
    toggleFlag(flagName, state = void 0) {
      const flagIndex = this.userSettings?.flags?.indexOf(flagName) ?? -1;
      if (flagIndex != -1 && state !== true) {
        this.userSettings?.flags?.splice(flagIndex, 1);
      } else if (flagIndex == -1 && state !== false) {
        this.userSettings?.flags?.push(flagName);
      }
    }
    // This is one of the most insane OOP setups I have ever laid my eyes on
    /** Builds the hotkey category of the settings window.
     * @since 0.99.0
     * @see WindowSettings#buildHotkeys
     */
    buildHotkeys() {
      const currentCode = this.userSettings.hotkeys.paintArea;
      this.window = this.addDiv({ "class": "bm-container" }).addHeader(2, { "textContent": "Hotkeys" }).buildElement().addHr().buildElement().addDiv({ "class": "bm-settings-hotkey-row" }).addSpan({ "textContent": "Area selection" }).buildElement().addButton({
        "class": "bm-settings-hotkey-button",
        "textContent": __privateMethod(this, _SettingsManager_instances, formatHotkeyCode_fn).call(this, currentCode),
        "title": "Change area selection hotkey",
        "aria-label": `Area selection hotkey: ${__privateMethod(this, _SettingsManager_instances, formatHotkeyCode_fn).call(this, currentCode)}`
      }, (instance, button) => {
        let recording = false;
        const stopRecording = () => {
          recording = false;
          button.dataset["recording"] = "false";
          button.textContent = __privateMethod(this, _SettingsManager_instances, formatHotkeyCode_fn).call(this, this.userSettings.hotkeys.paintArea);
          document.body?.classList.remove("bm-hotkey-recording");
        };
        button.onclick = () => {
          recording = true;
          button.dataset["recording"] = "true";
          button.textContent = "...";
          document.body?.classList.add("bm-hotkey-recording");
        };
        button.onkeydown = (event) => {
          if (!recording) {
            return;
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          if (event.code == "Escape") {
            stopRecording();
            return;
          }
          if (!/^[A-Za-z][A-Za-z0-9]{1,31}$/.test(event.code)) {
            return;
          }
          const code = __privateMethod(this, _SettingsManager_instances, normalizeHotkeyCode_fn).call(this, event.code);
          void this.setPaintAreaHotkey(code).finally(() => {
            stopRecording();
            button.setAttribute("aria-label", `Area selection hotkey: ${__privateMethod(this, _SettingsManager_instances, formatHotkeyCode_fn).call(this, code)}`);
          });
        };
        button.onblur = stopRecording;
      }).buildElement().buildElement().buildElement();
    }
    /** Builds the "highlight" category of the settings window
     * @since 0.91.18
     * @see WindowSettings#buildHighlight
     */
    buildHighlight() {
      const highlightPresetOff = '<svg viewBox="0 0 3 3"><path d="M0,0H3V3H0ZM0,1H3M0,2H3M1,0V3M2,0V3" fill="#fff"/><path d="M1,1H2V2H1Z" fill="#2f4f4f"/></svg>';
      const highlightPresetCross = '<svg viewBox="0 0 3 3"><path d="M0,0H3V3H0Z" fill="#fff"/><path d="M1,0H2V1H3V2H2V3H1V2H0V1H1Z" fill="brown"/><path d="M1,1H2V2H1Z" fill="#2f4f4f"/></svg>';
      const storedHighlight = this.userSettings?.highlight ?? [[1, 0, 1], [2, 0, 0], [1, -1, 0], [1, 1, 0], [1, 0, -1]];
      this.window = this.addDiv({ "class": "bm-container" }).addHeader(2, { "textContent": "Pixel Highlight" }).buildElement().addHr().buildElement().addDiv({ "class": "bm-container", "style": "margin-left: 1.5ch;" }).addCheckbox({ "textContent": "Highlight transparent pixels" }, (instance, label, checkbox) => {
        label.classList.add("bm-settings-checkbox");
        checkbox.checked = !this.userSettings?.flags?.includes("hl-noTrans");
        checkbox.onchange = (event) => this.toggleFlag("hl-noTrans", !event.target.checked);
      }).buildElement().addP({ "id": "bm-highlight-preset-label", "class": "bm-settings-subheading", "textContent": "Choose a preset" }).buildElement().addDiv({ "class": "bm-flex-center", "role": "group", "aria-labelledby": "bm-highlight-preset-label" }).addDiv({ "class": "bm-highlight-preset-container" }).addSpan({ "textContent": "None" }).buildElement().addButton({ "innerHTML": highlightPresetOff, "aria-label": 'Preset "None"' }, (instance, button) => {
        button.onclick = () => __privateMethod(this, _SettingsManager_instances, updateHighlightToPreset_fn).call(this, "None");
      }).buildElement().buildElement().addDiv({ "class": "bm-highlight-preset-container" }).addSpan({ "textContent": "Cross" }).buildElement().addButton({ "innerHTML": highlightPresetCross, "aria-label": 'Preset "Cross Shape"' }, (instance, button) => {
        button.onclick = () => __privateMethod(this, _SettingsManager_instances, updateHighlightToPreset_fn).call(this, "Cross");
      }).buildElement().buildElement().addDiv({ "class": "bm-highlight-preset-container" }).addSpan({ "textContent": "X" }).buildElement().addButton({ "innerHTML": highlightPresetCross.replace('d="M1,0H2V1H3V2H2V3H1V2H0V1H1Z"', 'd="M0,0V1H3V0H2V3H3V2H0V3H1V0Z"'), "aria-label": 'Preset "X Shape"' }, (instance, button) => {
        button.onclick = () => __privateMethod(this, _SettingsManager_instances, updateHighlightToPreset_fn).call(this, "X");
      }).buildElement().buildElement().addDiv({ "class": "bm-highlight-preset-container" }).addSpan({ "textContent": "Full" }).buildElement().addButton({ "innerHTML": highlightPresetOff.replace("#fff", "#2f4f4f"), "aria-label": 'Preset "Full Template"' }, (instance, button) => {
        button.onclick = () => __privateMethod(this, _SettingsManager_instances, updateHighlightToPreset_fn).call(this, "Full");
      }).buildElement().buildElement().buildElement().addP({ "id": "bm-highlight-grid-label", "class": "bm-settings-subheading", "textContent": "Create a custom pattern" }).buildElement().addDiv({ "class": "bm-highlight-grid", "role": "group", "aria-labelledby": "bm-highlight-grid-label" });
      for (let buttonY = -1; buttonY <= 1; buttonY++) {
        for (let buttonX = -1; buttonX <= 1; buttonX++) {
          const buttonState = storedHighlight[storedHighlight.findIndex(([, x, y]) => x == buttonX && y == buttonY)]?.[0] ?? 0;
          let buttonStateName = "Disabled";
          if (buttonState == 1) {
            buttonStateName = "Incorrect";
          } else if (buttonState == 2) {
            buttonStateName = "Template";
          }
          this.window = this.addButton({
            "data-status": buttonStateName,
            "aria-label": `Sub-pixel ${buttonStateName.toLowerCase()}`
          }, (instance, button) => {
            button.onclick = () => __privateMethod(this, _SettingsManager_instances, updateHighlightSettings_fn).call(this, button, [buttonX, buttonY]);
          }).buildElement();
        }
      }
      this.window = this.buildElement().buildElement().buildElement();
    }
    /** Build the "template" category of settings window
     * @since 0.91.68
     * @see WindowSettings#buildTemplate
     */
    buildTemplate() {
      this.window = this.addDiv({ "class": "bm-container" }).addHeader(2, { "textContent": "Pixel Highlight" }).buildElement().addHr().buildElement().addDiv({ "class": "bm-container", "style": "margin-left: 1.5ch;" }).addCheckbox({ "textContent": "Template creation should skip transparent tiles" }, (instance, label, checkbox) => {
        label.classList.add("bm-settings-checkbox");
        checkbox.checked = !this.userSettings?.flags?.includes("hl-noSkip");
        checkbox.onchange = (event) => this.toggleFlag("hl-noSkip", !event.target.checked);
      }).buildElement().addCheckbox({ "innerHTML": "Experimental: Template creation should <em>aggressively</em> skip transparent tiles" }, (instance, label, checkbox) => {
        label.classList.add("bm-settings-checkbox");
        checkbox.checked = this.userSettings?.flags?.includes("hl-agSkip");
        checkbox.onchange = (event) => this.toggleFlag("hl-agSkip", event.target.checked);
      }).buildElement().buildElement().buildElement();
    }
  };
  _SettingsManager_instances = new WeakSet();
  /** Normalizes a persisted KeyboardEvent.code value.
   * @param {string} code
   * @returns {string}
   * @since 0.99.0
   */
  normalizeHotkeyCode_fn = function(code) {
    const normalizedCode = String(code ?? "");
    return /^[A-Za-z][A-Za-z0-9]{1,31}$/.test(normalizedCode) ? normalizedCode : "AltLeft";
  };
  /** Converts KeyboardEvent.code to a compact label.
   * @param {string} code
   * @returns {string}
   * @since 0.99.0
   */
  formatHotkeyCode_fn = function(code) {
    const labels = {
      AltLeft: "Left Alt",
      AltRight: "Right Alt",
      ControlLeft: "Left Ctrl",
      ControlRight: "Right Ctrl",
      ShiftLeft: "Left Shift",
      ShiftRight: "Right Shift",
      MetaLeft: "Left Meta",
      MetaRight: "Right Meta",
      Space: "Space"
    };
    if (labels[code]) {
      return labels[code];
    }
    if (code.startsWith("Key")) {
      return code.slice(3);
    }
    if (code.startsWith("Digit")) {
      return code.slice(5);
    }
    return code.replace(/([a-z])([A-Z])/g, "$1 $2");
  };
  /** Sends the current hotkey into the page-context paint bridge.
   * @since 0.99.0
   */
  broadcastPaintAreaHotkey_fn = function() {
    window.postMessage({
      source: "blue-marble",
      action: "paint-area-hotkey-setting",
      code: this.userSettings.hotkeys.paintArea
    }, "*");
  };
  /** Updates the display of the highlight buttons in the settings window.
   * Additionally, it will update user settings with the new selection.
   * @param {HTMLButtonElement} button - The button that was pressed
   * @param {Array<number, number>} coords - The relative coordinates of the button
   * @since 0.91.46
   */
  updateHighlightSettings_fn = function(button, coords2) {
    button.disabled = true;
    const status = button.dataset["status"];
    const userStorageOld = this.userSettings?.highlight ?? [[1, 0, 1], [2, 0, 0], [1, -1, 0], [1, 1, 0], [1, 0, -1]];
    let userStorageChange = [2, 0, 0];
    const userStorageNew = userStorageOld;
    switch (status) {
      // If the button was in the "Disabled" state
      case "Disabled":
        button.dataset["status"] = "Incorrect";
        button.ariaLabel = "Sub-pixel incorrect";
        userStorageChange = [1, ...coords2];
        break;
      // If the button was in the "Incorrect" state
      case "Incorrect":
        button.dataset["status"] = "Template";
        button.ariaLabel = "Sub-pixel template";
        userStorageChange = [2, ...coords2];
        break;
      // If the button was in the "Template" state
      case "Template":
        button.dataset["status"] = "Disabled";
        button.ariaLabel = "Sub-pixel disabled";
        userStorageChange = [0, ...coords2];
        break;
    }
    const indexOfChange = userStorageOld.findIndex(([, x, y]) => x == userStorageChange[1] && y == userStorageChange[2]);
    if (userStorageChange[0] != 0) {
      if (indexOfChange != -1) {
        userStorageNew[indexOfChange] = userStorageChange;
      } else {
        userStorageNew.push(userStorageChange);
      }
    } else if (indexOfChange != -1) {
      userStorageNew.splice(indexOfChange, 1);
    }
    this.userSettings["highlight"] = userStorageNew;
    button.disabled = false;
  };
  updateHighlightToPreset_fn = async function(preset) {
    const presetButtons = document.querySelectorAll(".bm-highlight-preset-container button");
    for (const button of presetButtons) {
      button.disabled = true;
    }
    let presetArray = [0, 0, 0, 0, 2, 0, 0, 0, 0];
    switch (preset) {
      case "Cross":
        presetArray = [0, 1, 0, 1, 2, 1, 0, 1, 0];
        break;
      case "X":
        presetArray = [1, 0, 1, 0, 2, 0, 1, 0, 1];
        break;
      case "Full":
        presetArray = [2, 2, 2, 2, 2, 2, 2, 2, 2];
        break;
    }
    const buttons = document.querySelector(".bm-highlight-grid")?.childNodes ?? [];
    for (let buttonIndex = 0; buttonIndex < buttons.length; buttonIndex++) {
      const button = buttons[buttonIndex];
      let buttonState = button.dataset["status"];
      buttonState = buttonState != "Disabled" ? buttonState != "Incorrect" ? 2 : 1 : 0;
      let buttonStateDelta = presetArray[buttonIndex] - buttonState;
      if (buttonStateDelta == 0) {
        continue;
      }
      buttonStateDelta += buttonStateDelta < 0 ? 3 : 0;
      button.click();
      if (buttonStateDelta == 2) {
        for (let timeWaited = 0; timeWaited < 200; timeWaited += 10) {
          if (!button.disabled) {
            break;
          }
          await sleep(10);
        }
        button.click();
      }
    }
    for (const button of presetButtons) {
      button.disabled = false;
    }
  };

  // src/Template.js
  var _Template_instances, calculateTotalPixelsFromImageData_fn;
  var Template = class {
    /** The constructor for the {@link Template} class with enhanced pixel tracking.
     * @param {Object} [params={}] - Object containing all optional parameters
     * @param {string} [params.displayName='My template'] - The display name of the template
     * @param {number} [params.sortID=0] - The sort number of the template for rendering priority
     * @param {string} [params.authorID=''] - The user ID of the person who exported the template (prevents sort ID collisions)
     * @param {string} [params.url=''] - The URL to the source image
     * @param {File} [params.file=null] - The template file (pre-processed File or processed bitmap)
     * @param {Array<number, number, number, number>} [params.coords=null] - The coordinates of the top left corner as (tileX, tileY, pixelX, pixelY)
     * @param {Object} [params.chunked=null] - The affected chunks of the template, and their template for each chunk as a bitmap
     * @param {Object} [params.chunked32={}] - The affected chunks of the template, and their template for each chunk as a Uint32Array
     * @param {number} [params.tileSize=1000] - The size of a tile in pixels (assumes square tiles)
     * @param {Object} [params.pixelCount={total:0, colors:Map}] - Total number of pixels in the template (calculated automatically during processing)
     * @since 0.65.2
     */
    constructor({
      displayName = "My template",
      sortID = 0,
      authorID = "",
      url = "",
      file = null,
      coords: coords2 = null,
      chunked = null,
      chunked32 = {},
      tileSize = 1e3,
      pixelCount = null
    } = {}) {
      __privateAdd(this, _Template_instances);
      this.displayName = displayName;
      this.sortID = sortID;
      this.authorID = authorID;
      this.url = url;
      this.file = file;
      this.coords = coords2;
      this.chunked = chunked;
      this.chunked32 = chunked32;
      this.pixelStateByChunk = /* @__PURE__ */ new Map();
      this.tileSize = tileSize;
      const colorEntries = pixelCount?.colors instanceof Map ? pixelCount.colors : Object.entries(pixelCount?.colors ?? {});
      this.pixelCount = {
        total: Number(pixelCount?.total) || 0,
        colors: new Map(Array.from(colorEntries, ([colorID, total]) => [Number(colorID), Number(total) || 0]))
      };
      if (pixelCount?.correct != null) {
        this.pixelCount.correct = pixelCount.correct;
      }
      this.shouldSkipTransTiles = true;
      this.shouldAggSkipTransTiles = false;
    }
    /** Creates chunks of the template for each tile.
     * @param {Number} tileSize - Size of the tile as determined by templateManager
     * @param {Object} paletteBM - An collection of Uint32Arrays containing the palette BM uses
     * @param {boolean} shouldSkipTransTiles - Should transparent tiles be skipped over when creating the template?
     * @param {boolean} shouldAggSkipTransTiles - Should transparent tiles be aggressively skipped over when creating the template?
     * @returns {Object} Collection of template bitmaps & buffers organized by tile coordinates
     * @since 0.65.4
     */
    async createTemplateTiles(tileSize, paletteBM, shouldSkipTransTiles, shouldAggSkipTransTiles) {
      console.log("Template coordinates:", this.coords);
      this.shouldSkipTransTiles = shouldSkipTransTiles;
      this.shouldAggSkipTransTiles = shouldAggSkipTransTiles;
      const shreadSize = 3;
      const bitmap = await createImageBitmap(this.file);
      const imageWidth = bitmap.width;
      const imageHeight = bitmap.height;
      this.tileSize = tileSize;
      const templateTiles = {};
      const templateTilesBuffers = {};
      const canvas = new OffscreenCanvas(this.tileSize, this.tileSize);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const transCanvas = new OffscreenCanvas(this.tileSize, this.tileSize);
      const transContext = transCanvas.getContext("2d", { willReadFrequently: true });
      transContext.globalCompositeOperation = "destination-over";
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      context.imageSmoothingEnabled = false;
      context.drawImage(bitmap, 0, 0);
      let timer = Date.now();
      const totalPixelMap = __privateMethod(this, _Template_instances, calculateTotalPixelsFromImageData_fn).call(this, context.getImageData(0, 0, imageWidth, imageHeight), paletteBM);
      console.log(`Calculating total pixels took ${(Date.now() - timer) / 1e3} seconds`);
      let totalPixels = 0;
      const transparentColorID = 0;
      for (const [color, total] of totalPixelMap) {
        if (color == transparentColorID) {
          continue;
        }
        totalPixels += total;
      }
      this.pixelCount = { total: totalPixels, colors: totalPixelMap };
      timer = Date.now();
      const canvasMask = new OffscreenCanvas(3, 3);
      const contextMask = canvasMask.getContext("2d");
      contextMask.clearRect(0, 0, 3, 3);
      contextMask.fillStyle = "white";
      contextMask.fillRect(1, 1, 1, 1);
      for (let pixelY = this.coords[3]; pixelY < imageHeight + this.coords[3]; ) {
        const drawSizeY = Math.min(this.tileSize - pixelY % this.tileSize, imageHeight - (pixelY - this.coords[3]));
        console.log(`Math.min(${this.tileSize} - (${pixelY} % ${this.tileSize}), ${imageHeight} - (${pixelY - this.coords[3]}))`);
        for (let pixelX = this.coords[2]; pixelX < imageWidth + this.coords[2]; ) {
          console.log(`Pixel X: ${pixelX}
Pixel Y: ${pixelY}`);
          const drawSizeX = Math.min(this.tileSize - pixelX % this.tileSize, imageWidth - (pixelX - this.coords[2]));
          if (shouldSkipTransTiles) {
            const isTemplateTileTransparent = !this.calculateCanvasTransparency({
              bitmap,
              bitmapParams: [pixelX - this.coords[2], pixelY - this.coords[3], drawSizeX, drawSizeY],
              // Top left X, Top left Y, Width, Height
              transCanvas,
              transContext
            });
            console.log(`Tile contains template: ${!isTemplateTileTransparent}`);
            if (isTemplateTileTransparent) {
              pixelX += drawSizeX;
              continue;
            }
          }
          console.log(`Math.min(${this.tileSize} - (${pixelX} % ${this.tileSize}), ${imageWidth} - (${pixelX - this.coords[2]}))`);
          console.log(`Draw Size X: ${drawSizeX}
Draw Size Y: ${drawSizeY}`);
          const canvasWidth = drawSizeX * shreadSize;
          const canvasHeight = drawSizeY * shreadSize;
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          console.log(`Draw X: ${drawSizeX}
Draw Y: ${drawSizeY}
Canvas Width: ${canvasWidth}
Canvas Height: ${canvasHeight}`);
          context.imageSmoothingEnabled = false;
          console.log(`Getting X ${pixelX}-${pixelX + drawSizeX}
Getting Y ${pixelY}-${pixelY + drawSizeY}`);
          context.clearRect(0, 0, canvasWidth, canvasHeight);
          context.drawImage(
            bitmap,
            // Bitmap image to draw
            pixelX - this.coords[2],
            // Coordinate X to draw *from*
            pixelY - this.coords[3],
            // Coordinate Y to draw *from*
            drawSizeX,
            // X width to draw *from*
            drawSizeY,
            // Y height to draw *from*
            0,
            // Coordinate X to draw *at*
            0,
            // Coordinate Y to draw *at*
            drawSizeX * shreadSize,
            // X width to draw *at*
            drawSizeY * shreadSize
            // Y height to draw *at*
          );
          context.save();
          context.globalCompositeOperation = "destination-in";
          console.log(`Should Skip: ${shouldSkipTransTiles}; Should Agg Skip: ${shouldAggSkipTransTiles}`);
          context.fillStyle = context.createPattern(canvasMask, "repeat");
          context.fillRect(0, 0, canvasWidth, canvasHeight);
          context.restore();
          const imageData = context.getImageData(0, 0, canvasWidth, canvasHeight);
          console.log(`Shreaded pixels for ${pixelX}, ${pixelY}`, imageData);
          const templateTileName = `${(this.coords[0] + Math.floor(pixelX / 1e3)).toString().padStart(4, "0")},${(this.coords[1] + Math.floor(pixelY / 1e3)).toString().padStart(4, "0")},${(pixelX % 1e3).toString().padStart(3, "0")},${(pixelY % 1e3).toString().padStart(3, "0")}`;
          this.chunked32[templateTileName] = new Uint32Array(imageData.data.buffer);
          templateTiles[templateTileName] = await createImageBitmap(canvas);
          const canvasBlob = await canvas.convertToBlob();
          const canvasBuffer = await canvasBlob.arrayBuffer();
          const canvasBufferBytes = Array.from(new Uint8Array(canvasBuffer));
          templateTilesBuffers[templateTileName] = uint8ToBase64(canvasBufferBytes);
          console.log(templateTiles);
          pixelX += drawSizeX;
        }
        pixelY += drawSizeY;
      }
      console.log(`Parsing template took ${(Date.now() - timer) / 1e3} seconds`);
      console.log("Template Tiles: ", templateTiles);
      console.log("Template Tiles Buffers: ", templateTilesBuffers);
      console.log("Template Tiles Uint32Array: ", this.chunked32);
      return { templateTiles, templateTilesBuffers };
    }
    /** Detects if the canvas is transparent.
     * @param {Object} param - Object that contains the parameters for the function
     * @param {ImageBitmap} param.bitmap - The bitmap template image
     * @param {Array<number, number, number, number>} param.bitmapParams - The parameters to obtain the template tile image from the bitmap
     * @param {OffscreenCanvas | HTMLCanvasElement} param.transCanvas - The canvas to draw to in order to calculate this
     * @param {OffscreenCanvasRenderingContext2D} param.transContext - The context for the transparent canvas to draw to
     * @return {boolean} Is the canvas transparent? If transparent, then `true` is returned. Otherwise, `false`.
     * @since 0.91.75
     */
    calculateCanvasTransparency({
      bitmap,
      bitmapParams,
      transCanvas,
      transContext
    }) {
      console.log(`Calculating template tile transparency...`);
      console.log(`Should Skip: ${this.shouldSkipTransTiles}; Should Agg: ${this.shouldAggSkipTransTiles}`);
      const timer = Date.now();
      const duplicationCoordinateArray = [
        [0, 1],
        // E.g. move 0 on the x axis, and 1 down on the y axis
        [1, 0],
        [0, -2],
        // E.g. move 0 on the x axis, and 2 up on the y axis
        [-2, 0],
        [0, 4],
        [4, 0],
        [0, -8],
        [-8, 0],
        [0, 16],
        [16, 0],
        [0, -32],
        [-32, 0]
      ];
      const transCanvasWidth = bitmapParams[2];
      const transCanvasHeight = bitmapParams[3];
      transCanvas.width = transCanvasWidth;
      transCanvas.height = transCanvasHeight;
      transContext.clearRect(0, 0, transCanvasWidth, transCanvasHeight);
      if (this.shouldAggSkipTransTiles) {
        transContext.drawImage(
          bitmap,
          ...bitmapParams,
          // Bitmap image parameters (x, y, width, height)
          0,
          0,
          // The coordinate draw the output *at*
          10,
          10
          // The width and height of the output
        );
      } else {
        transContext.drawImage(
          bitmap,
          ...bitmapParams,
          // Bitmap image parameters (x, y, width, height)
          0,
          0,
          // The coordinate draw the output *at*
          transCanvasWidth,
          transCanvasHeight
          // Stretch to canvas (the canvas should already be the same size as the template image)
        );
        for (const [relativeX, relativeY] of duplicationCoordinateArray) {
          transContext.drawImage(
            transCanvas,
            // The canvas we are drawing to *is* the source image
            0,
            0,
            transCanvasWidth,
            transCanvasHeight,
            // The entire canvas (as a source image)
            relativeX,
            relativeY,
            transCanvasWidth,
            transCanvasHeight
            // The output coordinates and size on the same canvas
          );
        }
        transContext.drawImage(
          transCanvas,
          // The canvas we are drawing to *is* the source image
          0,
          0,
          transCanvasWidth,
          transCanvasHeight,
          // The entire canvas (as a source image)
          0,
          0,
          10,
          10
          // The output coordinates and size on the same canvas
        );
      }
      const shunkCanvas = transContext.getImageData(0, 0, 10, 10);
      const shunkCanvas32 = new Uint32Array(shunkCanvas.data.buffer);
      console.log(`Calculated canvas transparency in ${(Date.now() - timer) / 1e3} seconds.`);
      for (const pixel of shunkCanvas32) {
        if (!!pixel) {
          return true;
        }
      }
      return false;
    }
    /** Calculates top left coordinate of template.
     * It uses `Template.chunked` to update `Template.coords`
     * @since 0.88.504
     */
    calculateCoordsFromChunked() {
      let topLeftCoord = [Infinity, Infinity, Infinity, Infinity];
      const tileKeys = Object.keys(this.chunked).sort();
      tileKeys.forEach((key, index) => {
        const [tileX, tileY, pixelX, pixelY] = key.split(",").map(Number);
        if (tileY < topLeftCoord[1] || tileY == topLeftCoord[1] && tileX < topLeftCoord[0]) {
          topLeftCoord = [tileX, tileY, pixelX, pixelY];
        }
      });
      this.coords = topLeftCoord;
    }
  };
  _Template_instances = new WeakSet();
  /** Calculates the total pixels for each color for the image.
   * 
   * @param {ImageData} imageData - The pre-shreaded image "casted" onto a canvas
   * @param {Object} paletteBM - The palette Blue Marble uses for colors
   * @param {Number} paletteTolerance - How close an RGB color has to be in order to be considered a palette color. A tolerance of "3" means the sum of the RGB can be up to 3 away from the actual value.
   * @returns {Map<Number, Number>} A map where the key is the color ID, and the value is the total pixels for that color ID
   * @since 0.88.6
   */
  calculateTotalPixelsFromImageData_fn = function(imageData, paletteBM) {
    const buffer32Arr = new Uint32Array(imageData.data.buffer);
    const { palette: _, LUT: lookupTable } = paletteBM;
    const _colorpalette = /* @__PURE__ */ new Map();
    for (let pixelIndex = 0; pixelIndex < buffer32Arr.length; pixelIndex++) {
      const pixel = buffer32Arr[pixelIndex];
      let bestColorID = -2;
      if (pixel >>> 24 == 0) {
        bestColorID = 0;
      } else {
        bestColorID = lookupTable.get(pixel) ?? -2;
      }
      const colorIDcount = _colorpalette.get(bestColorID);
      _colorpalette.set(bestColorID, colorIDcount ? colorIDcount + 1 : 1);
    }
    console.log(_colorpalette);
    return _colorpalette;
  };

  // src/confetttiManager.js
  var ConfettiManager = class {
    /** The constructor for the confetti manager.
     * @since 0.88.356
     */
    constructor() {
      this.confettiCount = Math.ceil(80 / 1300 * window.innerWidth);
      this.colorPalette = colorpalette.slice(1);
    }
    /** Immedently creates confetti inside the parent element.
     * @param {HTMLElement} parentElement - The parent element to create confetti inside of
     * @since 0.88.356
     */
    createConfetti(parentElement) {
      const confettiContainer = document.createElement("div");
      for (let currentCount = 0; currentCount < this.confettiCount; currentCount++) {
        const confettiShard = document.createElement("confetti-piece");
        confettiShard.style.setProperty("--x", `${Math.random() * 100}vw`);
        confettiShard.style.setProperty("--delay", `${Math.random() * 2}s`);
        confettiShard.style.setProperty("--duration", `${3 + Math.random() * 3}s`);
        confettiShard.style.setProperty("--rot", `${Math.random() * 360}deg`);
        confettiShard.style.setProperty("--size", `${6 + Math.random() * 6}px`);
        confettiShard.style.backgroundColor = `rgb(${this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)].rgb.join(",")})`;
        confettiShard.onanimationend = () => {
          if (confettiShard.parentNode.childElementCount <= 1) {
            confettiShard.parentNode.remove();
          } else {
            confettiShard.remove();
          }
        };
        confettiContainer.appendChild(confettiShard);
      }
      parentElement.appendChild(confettiContainer);
    }
  };
  var BlueMarbleConfettiPiece = class extends HTMLElement {
  };
  if (!customElements.get("confetti-piece")) {
    customElements.define("confetti-piece", BlueMarbleConfettiPiece);
  }

  // src/WindowFilter.js
  var closeIcon2 = '<svg class="bm-button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var fullscreenIcon = '<svg class="bm-button-icon bm-button-icon-fullscreen" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4.5H4.5V8M16 4.5h3.5V8M19.5 16v3.5H16M8 19.5H4.5V16"/><path d="M4.8 4.8l5.1 5.1M19.2 4.8l-5.1 5.1M19.2 19.2l-5.1-5.1M4.8 19.2l5.1-5.1"/></g></svg>';
  var windowedIcon = '<svg class="bm-button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.8 4.8l5.2 5.2M19.2 4.8L14 10M19.2 19.2L14 14M4.8 19.2L10 14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M10 7.5V10H7.5M16.5 10H14V7.5M14 16.5V14h2.5M7.5 14H10v2.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var horizontalLayoutIcon = '<svg class="bm-button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7.5h15M4.5 16.5h15"/><path d="M7.5 5v5M12 5v5M16.5 5v5M7.5 14v5M12 14v5M16.5 14v5"/></g></svg>';
  var verticalLayoutIcon = '<svg class="bm-button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4.5v15M16 4.5v15"/><path d="M5.5 7.5h5M5.5 12h5M5.5 16.5h5M13.5 7.5h5M13.5 12h5M13.5 16.5h5"/></g></svg>';
  var incorrectHighlightIcon = '<svg class="bm-filter-highlight-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6.4"/><path d="M12 3.8V7M12 17v3.2M3.8 12H7M17 12h3.2"/><path d="m9.3 9.3 5.4 5.4M14.7 9.3l-5.4 5.4"/></g></svg>';
  var colorToggleAnimations = /* @__PURE__ */ new WeakMap();
  function localizeCompactDate(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hour}:${minute}`;
  }
  var _WindowFilter_instances, getOwnedWindowElement_fn, switchWindowMode_fn, getWindowState_fn2, setWindowOpenState_fn, prefersWindowedMode_fn, setWindowModePreference_fn, getWindowedColorLayout_fn, setWindowedColorLayoutPreference_fn, getActiveWindowedColorLayout_fn, getWindowedLayoutSize_fn, getWindowLayoutMaxWidth_fn, getWindowLayoutMinHeight_fn, getWindowLayoutMaxHeight_fn, saveWindowLayoutSize_fn, restoreWindowLayoutSize_fn, applyWindowedColorLayout_fn, syncWindowedColorLayoutLabels_fn, syncSortFormControls_fn, initializeCustomSortDropdowns_fn, closeCustomSortDropdowns_fn, cleanupCustomSortDropdowns_fn, closeWindow_fn2, startAutoRefresh_fn, stopAutoRefresh_fn, cleanupWindowPersistence_fn, clampWindowDimension_fn, clampWindowPosition_fn2, restoreWindowState_fn, saveWindowState_fn, scheduleWindowStateSave_fn, initializeWindowedPersistence_fn, initializeHorizontalScrollWheel_fn, createEmptyColorStatistics_fn, buildColorList_fn, sortColorList_fn, selectColorList_fn, syncColorToggleLabel_fn, toggleColorVisibility_fn, toggleIncorrectHighlightColor_fn, getIncorrectHighlightButtonLabel_fn, syncIncorrectHighlightButtons_fn, animateColorToggleIcon_fn, initializeColorBlockToggle_fn, calculatePixelStatistics_fn;
  var WindowFilter = class extends Overlay {
    /** Constructor for the color filter window
     * @param {*} executor - The executing class
     * @since 0.88.329
     * @see {@link Overlay#constructor}
     */
    constructor(executor) {
      super(executor.name, executor.version);
      __privateAdd(this, _WindowFilter_instances);
      this.window = null;
      this.windowElement = null;
      this.windowID = "bm-window-filter";
      this.colorListID = "bm-filter-flex";
      this.windowParent = document.body;
      this.settingsManager = executor.settingsManager ?? null;
      this.windowModeFlag = "ftr-oWin";
      this.windowStateKey = "windowFilter";
      this.windowResizeObserver = null;
      this.windowViewportResizeHandler = null;
      this.windowHorizontalWheelHandler = null;
      this.windowHorizontalWheelElement = null;
      this.windowSaveTimeout = null;
      this.sortDropdownPointerHandler = null;
      this.sortDropdownKeyHandler = null;
      this.colorRefreshInterval = null;
      this.highlightRefreshPending = null;
      this.colorRefreshIntervalMS = 1e4;
      this.templateWasComplete = false;
      this.ownerID = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      this.modeTransitionPending = false;
      this.windowMinWidth = 360;
      this.windowMinHeight = 220;
      this.windowHorizontalHeight = 170;
      this.windowMaxWidth = 1e3;
      this.windowMaxHeight = 1400;
      this.templateManager = executor.apiManager?.templateManager;
      this.eyeOpen = '<svg class="bm-filter-eye-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.8 12s3.1-5 8.2-5 8.2 5 8.2 5-3.1 5-8.2 5-8.2-5-8.2-5Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
      this.eyeClosed = '<svg class="bm-filter-eye-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.6 9.8C6.1 8.3 8.6 7 12 7c5.1 0 8.2 5 8.2 5a15.2 15.2 0 0 1-2.2 2.7"/><path d="M14.1 16.7a8.3 8.3 0 0 1-2.1.3c-5.1 0-8.2-5-8.2-5a14.9 14.9 0 0 1 1.8-2.3"/><path d="M5 5l14 14"/><path d="M10.4 10.7a2.5 2.5 0 0 0 2.9 2.9"/></svg>';
      const rendererPalette = this.templateManager?.paletteBM?.palette;
      this.palette = Array.isArray(rendererPalette) && rendererPalette.length ? rendererPalette : colorpaletteForBlueMarble(3).palette;
      this.unsubscribeTemplateChanges = this.templateManager?.onTemplatesChanged?.(() => this.refreshColorList()) ?? null;
      this.tilesLoadedTotal = 0;
      this.tilesTotal = 0;
      this.allPixelsColor = /* @__PURE__ */ new Map();
      this.allPixelsCorrect = /* @__PURE__ */ new Map();
      this.allPixelsCorrectTotal = 0;
      this.allPixelsTotal = 0;
      this.timeRemaining = 0;
      this.timeRemainingLocalized = "";
      this.sortPrimary = "total";
      this.sortSecondary = "descending";
      this.showUnused = false;
    }
    /** Releases timers and subscriptions owned by this Color Filter instance.
     * @since 0.99.0
     */
    dispose() {
      __privateMethod(this, _WindowFilter_instances, stopAutoRefresh_fn).call(this);
      __privateMethod(this, _WindowFilter_instances, cleanupWindowPersistence_fn).call(this);
      __privateMethod(this, _WindowFilter_instances, cleanupCustomSortDropdowns_fn).call(this);
      this.unsubscribeTemplateChanges?.();
      this.unsubscribeTemplateChanges = null;
      this.windowElement?.remove();
      this.windowElement = null;
    }
    /** Refreshes an already-mounted color list without allowing statistics errors to remove controls.
     * @since 0.99.0
     */
    refreshColorList() {
      const windowElement = __privateMethod(this, _WindowFilter_instances, getOwnedWindowElement_fn).call(this);
      const colorList = windowElement?.querySelector(`#${this.colorListID}`);
      if (!colorList) {
        return;
      }
      colorList.dataset["statisticsState"] = this.templateManager?.getTemplateStatisticsState?.() ?? "ready";
      try {
        this.updateColorList();
        delete colorList.dataset["statisticsError"];
      } catch (error) {
        colorList.dataset["statisticsState"] = "error";
        colorList.dataset["statisticsError"] = error instanceof Error ? error.message : String(error);
        console.error("Blue Marble: Could not refresh Color Filter statistics.", error);
        __privateMethod(this, _WindowFilter_instances, sortColorList_fn).call(this, this.sortPrimary, this.sortSecondary, this.showUnused);
      }
    }
    /** Builds the preferred filter window mode for the user.
     * @since 0.92.0
     */
    buildPreferredWindow() {
      if (__privateMethod(this, _WindowFilter_instances, prefersWindowedMode_fn).call(this)) {
        this.buildWindowed();
        return;
      }
      this.buildWindow();
    }
    /** Spawns a Color Filter window.
     * If another color filter window already exists, we DON'T spawn another!
     * Parent/child relationships in the DOM structure below are indicated by indentation.
     * @since 0.88.149
     */
    buildWindow() {
      const existingWindow = document.querySelector(`#${this.windowID}`);
      if (existingWindow) {
        if (existingWindow == __privateMethod(this, _WindowFilter_instances, getOwnedWindowElement_fn).call(this)) {
          void __privateMethod(this, _WindowFilter_instances, closeWindow_fn2).call(this);
          return;
        }
        existingWindow.remove();
      }
      this.window = this.addDiv({ "id": this.windowID, "class": "bm-window" }, (instance, div) => {
        div.dataset["filterOwner"] = this.ownerID;
        this.windowElement = div;
      }).addDragbar().addButton({ "class": "bm-button-circle", "innerHTML": minimizeIconExpanded, "title": 'Minimize window "Color Filter"', "aria-label": 'Minimize window "Color Filter"', "data-button-status": "expanded" }, (instance, button) => {
        button.onclick = () => instance.handleMinimization(button);
      }).buildElement().addDiv({ "class": "bm-filter-drag-title-slot" }).addHeader(1, { "class": "bm-dragbar-title-persistent bm-filter-drag-title", "textContent": "Color Filter" }).buildElement().buildElement().addDiv({ "class": "bm-flex-center" }).addButton({ "class": "bm-button-circle", "innerHTML": windowedIcon, "title": 'Switch to windowed mode for "Color Filter"', "aria-label": 'Switch to windowed mode for "Color Filter"' }, (instance, button) => {
        button.onclick = () => __privateMethod(this, _WindowFilter_instances, switchWindowMode_fn).call(this, button, () => {
          __privateMethod(this, _WindowFilter_instances, setWindowModePreference_fn).call(this, true);
          this.buildWindowed();
        });
      }).buildElement().addButton({ "class": "bm-button-circle", "innerHTML": closeIcon2, "title": 'Close window "Color Filter"', "aria-label": 'Close window "Color Filter"' }, (instance, button) => {
        button.onclick = () => __privateMethod(this, _WindowFilter_instances, closeWindow_fn2).call(this);
      }).buildElement().buildElement().buildElement().addDiv({ "class": "bm-window-content" }).addHr({ "class": "bm-window-divider-top" }).buildElement().addDiv({ "class": "bm-container bm-flex-between bm-center-vertically bm-filter-toolbar", "style": "gap: 1.5ch;" }).addButton({ "class": "bm-button-secondary", "textContent": "Hide All Colors" }, (instance, button) => {
        button.onclick = () => __privateMethod(this, _WindowFilter_instances, selectColorList_fn).call(this, false);
      }).buildElement().addButton({ "class": "bm-button-secondary", "textContent": "Show All Colors" }, (instance, button) => {
        button.onclick = () => __privateMethod(this, _WindowFilter_instances, selectColorList_fn).call(this, true);
      }).buildElement().buildElement().addHr().buildElement().addDiv({ "class": "bm-container bm-scrollable bm-filter-scrollable" }).addDiv({ "class": "bm-container bm-filter-insights" }).addDiv({ "class": "bm-filter-stat-grid" }).addDiv({ "class": "bm-filter-stat-card" }).addSpan({ "class": "bm-filter-stat-label", "textContent": "Tiles" }).buildElement().addSpan({ "id": "bm-filter-tile-load", "class": "bm-filter-stat-value", "textContent": "0 / ???" }).buildElement().buildElement().addDiv({ "class": "bm-filter-stat-card" }).addSpan({ "class": "bm-filter-stat-label", "textContent": "Correct" }).buildElement().addSpan({ "id": "bm-filter-tot-correct", "class": "bm-filter-stat-value", "textContent": "???" }).buildElement().buildElement().addDiv({ "class": "bm-filter-stat-card" }).addSpan({ "class": "bm-filter-stat-label", "textContent": "Total" }).buildElement().addSpan({ "id": "bm-filter-tot-total", "class": "bm-filter-stat-value", "textContent": "???" }).buildElement().buildElement().addDiv({ "class": "bm-filter-stat-card" }).addSpan({ "class": "bm-filter-stat-label", "textContent": "Remaining" }).buildElement().addSpan({ "id": "bm-filter-tot-remaining", "class": "bm-filter-stat-value", "textContent": "???" }).buildElement().buildElement().addDiv({ "class": "bm-filter-stat-card bm-filter-stat-card-wide" }).addSpan({ "class": "bm-filter-stat-label", "textContent": "Finish At" }).buildElement().addSpan({ "id": "bm-filter-tot-completed", "class": "bm-filter-stat-value", "textContent": "???" }).buildElement().buildElement().buildElement().addHr().buildElement().addForm({ "class": "bm-container bm-filter-sort-panel" }).addFieldset().addLegend({ "class": "bm-filter-sort-heading", "textContent": "Sort Options" }).buildElement().addDiv({ "class": "bm-container bm-filter-sort-row" }).addSelect({ "id": "bm-filter-sort-primary", "class": "bm-filter-sort-select", "name": "sortPrimary", "textContent": "Show" }, (instance, label) => {
        label.classList.add("bm-filter-sort-prefix");
      }).addOption({ "value": "id", "textContent": "color IDs" }).buildElement().addOption({ "value": "name", "textContent": "color names" }).buildElement().addOption({ "value": "premium", "textContent": "premium colors" }).buildElement().addOption({ "value": "percent", "textContent": "percentage" }).buildElement().addOption({ "value": "correct", "textContent": "correct pixels" }).buildElement().addOption({ "value": "incorrect", "textContent": "incorrect pixels" }).buildElement().addOption({ "value": "total", "textContent": "total pixels" }).buildElement().buildElement().addSelect({ "id": "bm-filter-sort-secondary", "class": "bm-filter-sort-select", "name": "sortSecondary", "textContent": "in" }, (instance, label) => {
        label.classList.add("bm-filter-sort-prefix");
      }).addOption({ "value": "ascending", "textContent": "ascending" }).buildElement().addOption({ "value": "descending", "textContent": "descending" }).buildElement().buildElement().addSpan({ "class": "bm-filter-sort-suffix", "textContent": "order" }).buildElement().buildElement().addDiv({ "class": "bm-container" }).addCheckbox({ "id": "bm-filter-show-unused", "name": "showUnused", "textContent": "Show unused colors" }, (instance, label) => {
        label.classList.add("bm-filter-sort-checkbox");
      }).buildElement().buildElement().buildElement().addDiv({ "class": "bm-container bm-filter-sort-actions" }).addButton({ "class": "bm-button-primary", "textContent": "Sort Colors", "type": "submit" }, (instance, button) => {
        button.onclick = (event) => {
          event.preventDefault();
          const formData = new FormData(document.querySelector(`#${this.windowID} form`));
          const formValues = {};
          for (const [input, value] of formData) {
            formValues[input] = value;
          }
          console.log(`Primary: ${formValues["sortPrimary"]}; Secondary: ${formValues["sortSecondary"]}; Unused: ${formValues["showUnused"] == "on"}`);
          __privateMethod(this, _WindowFilter_instances, sortColorList_fn).call(this, formValues["sortPrimary"], formValues["sortSecondary"], formValues["showUnused"] == "on");
        };
      }).buildElement().buildElement().buildElement().buildElement().buildElement().buildElement().buildElement().buildOverlay(this.windowParent);
      this.handleDrag(`#${this.windowID}.bm-window`, `#${this.windowID} .bm-dragbar`);
      const scrollableContainer = document.querySelector(`#${this.windowID} .bm-container.bm-scrollable`);
      __privateMethod(this, _WindowFilter_instances, initializeHorizontalScrollWheel_fn).call(this, scrollableContainer);
      __privateMethod(this, _WindowFilter_instances, initializeCustomSortDropdowns_fn).call(this);
      __privateMethod(this, _WindowFilter_instances, setWindowOpenState_fn).call(this, true);
      __privateMethod(this, _WindowFilter_instances, buildColorList_fn).call(this, scrollableContainer);
      __privateMethod(this, _WindowFilter_instances, syncSortFormControls_fn).call(this);
      __privateMethod(this, _WindowFilter_instances, sortColorList_fn).call(this, this.sortPrimary, this.sortSecondary, this.showUnused);
      this.updateInnerHTML("#bm-filter-tile-load", `${localizeNumber(this.tilesLoadedTotal)} / ${localizeNumber(this.tilesTotal)}`);
      this.updateInnerHTML("#bm-filter-tot-correct", localizeNumber(this.allPixelsCorrectTotal));
      this.updateInnerHTML("#bm-filter-tot-total", localizeNumber(this.allPixelsTotal));
      this.updateInnerHTML("#bm-filter-tot-remaining", `${localizeNumber((this.allPixelsTotal || 0) - (this.allPixelsCorrectTotal || 0))} (${localizePercent(((this.allPixelsTotal || 0) - (this.allPixelsCorrectTotal || 0)) / (this.allPixelsTotal || 1))})`);
      this.updateInnerHTML("#bm-filter-tot-completed", `<time datetime="${this.timeRemaining.toISOString().replace(/\.\d{3}Z$/, "Z")}">${this.timeRemainingLocalized}</time>`);
      __privateMethod(this, _WindowFilter_instances, startAutoRefresh_fn).call(this);
    }
    /** Spawns a windowed Color Filter window.
     * If another color filter window already exists, we DON'T spawn another!
     * Parent/child relationships in the DOM structure below are indicated by indentation.
     * @since 0.90.35
     */
    buildWindowed(layout = __privateMethod(this, _WindowFilter_instances, getWindowedColorLayout_fn).call(this)) {
      const normalizedLayout = layout == "horizontal" ? "horizontal" : "vertical";
      const existingWindow = document.querySelector(`#${this.windowID}`);
      if (existingWindow) {
        if (existingWindow == __privateMethod(this, _WindowFilter_instances, getOwnedWindowElement_fn).call(this)) {
          void __privateMethod(this, _WindowFilter_instances, closeWindow_fn2).call(this);
          return;
        }
        existingWindow.remove();
      }
      this.window = this.addDiv({
        "id": this.windowID,
        "class": "bm-window bm-windowed",
        "style": `width: 360px; height: min(70vh, 32rem); min-width: ${this.windowMinWidth}px; min-height: ${this.windowMinHeight}px; max-width: min(${this.windowMaxWidth}px, calc(100vw - 16px)); max-height: min(${this.windowMaxHeight}px, calc(100vh - 16px));`
      }, (instance, div) => {
        div.dataset["filterOwner"] = this.ownerID;
        this.windowElement = div;
      }).addDragbar().addButton({ "class": "bm-button-circle", "innerHTML": minimizeIconExpanded, "title": 'Minimize window "Color Filter"', "aria-label": 'Minimize window "Color Filter"', "data-button-status": "expanded" }, (instance, button) => {
        button.onclick = () => {
          const windowedColorTotals = document.querySelector("#bm-filter-windowed-color-totals-dragbar");
          if (windowedColorTotals) {
            windowedColorTotals.style.display = button.dataset["buttonStatus"] == "expanded" ? "none" : "";
          }
          instance.handleMinimization(button);
        };
      }).buildElement().addDiv().addSpan({ "id": "bm-filter-windowed-color-totals-dragbar", "class": "bm-dragbar-text", "style": "font-weight: 700;" }).buildElement().addHeader(1, { "class": "bm-dragbar-title-persistent bm-filter-drag-title bm-filter-horizontal-drag-title", "textContent": "Color Filter" }).buildElement().buildElement().addDiv({ "class": "bm-flex-center" }).addButton({ "id": "bm-filter-layout-toggle", "class": "bm-button-circle bm-filter-layout-toggle", "innerHTML": horizontalLayoutIcon, "title": "Switch color layout", "aria-label": "Switch to horizontal color layout" }, (instance, button) => {
        button.onclick = () => __privateMethod(this, _WindowFilter_instances, switchWindowMode_fn).call(this, button, () => {
          const nextLayout = normalizedLayout == "horizontal" ? "vertical" : "horizontal";
          __privateMethod(this, _WindowFilter_instances, setWindowedColorLayoutPreference_fn).call(this, nextLayout);
          this.buildWindowed(nextLayout);
        });
      }).buildElement().addButton({ "class": "bm-button-circle bm-filter-fullscreen-toggle", "innerHTML": fullscreenIcon, "title": 'Switch to fullscreen mode for "Color Filter"', "aria-label": 'Switch to fullscreen mode for "Color Filter"' }, (instance, button) => {
        button.onclick = () => __privateMethod(this, _WindowFilter_instances, switchWindowMode_fn).call(this, button, () => {
          __privateMethod(this, _WindowFilter_instances, setWindowModePreference_fn).call(this, false);
          this.buildWindow();
        });
      }).buildElement().addButton({ "class": "bm-button-circle", "innerHTML": closeIcon2, "title": 'Close window "Color Filter"', "aria-label": 'Close window "Color Filter"' }, (instance, button) => {
        button.onclick = () => __privateMethod(this, _WindowFilter_instances, closeWindow_fn2).call(this);
      }).buildElement().buildElement().buildElement().addDiv({ "class": "bm-window-content" }).addHr({ "class": "bm-window-divider-top" }).buildElement().addDiv({ "class": "bm-container bm-center-vertically bm-filter-windowed-summary-row" }).addDiv({ "class": "bm-filter-windowed-summary" }).addSpan({ "class": "bm-filter-windowed-summary-label", "textContent": "Painted" }).buildElement().addSpan({ "id": "bm-filter-windowed-color-totals-inline", "class": "bm-filter-windowed-summary-value", "textContent": "0 / ???" }).buildElement().buildElement().buildElement().addHr().buildElement().addDiv({ "class": "bm-container bm-flex-between bm-center-vertically bm-filter-toolbar bm-filter-toolbar-vertical", "style": "gap: 1.5ch;" }).addButton({ "class": "bm-button-secondary", "textContent": "None", "title": "Hide all colors", "aria-label": "Hide all colors" }, (instance, button) => {
        button.onclick = () => __privateMethod(this, _WindowFilter_instances, selectColorList_fn).call(this, false);
      }).buildElement().addButton({ "class": "bm-button-secondary", "textContent": "All", "title": "Show all colors", "aria-label": "Show all colors" }, (instance, button) => {
        button.onclick = () => __privateMethod(this, _WindowFilter_instances, selectColorList_fn).call(this, true);
      }).buildElement().buildElement().addDiv({ "class": "bm-filter-toolbar-horizontal" }).addButton({ "class": "bm-button-secondary", "textContent": "None", "title": "Hide all colors", "aria-label": "Hide all colors" }, (instance, button) => {
        button.onclick = () => __privateMethod(this, _WindowFilter_instances, selectColorList_fn).call(this, false);
      }).buildElement().addButton({ "class": "bm-button-secondary", "textContent": "All", "title": "Show all colors", "aria-label": "Show all colors" }, (instance, button) => {
        button.onclick = () => __privateMethod(this, _WindowFilter_instances, selectColorList_fn).call(this, true);
      }).buildElement().buildElement().addHr().buildElement().addDiv({ "class": "bm-container bm-scrollable bm-filter-scrollable" }).buildElement().buildElement().addDiv({
        "class": "bm-resize-corner",
        "title": "Resize Color Filter window",
        "aria-label": "Resize Color Filter window",
        "role": "presentation",
        "textContent": "\u25E2",
        "style": "position: absolute; right: 0; bottom: 0; width: 28px; height: 28px; display: flex; align-items: flex-end; justify-content: flex-end; padding-right: 4px; padding-bottom: 4px; box-sizing: border-box; z-index: 5; cursor: nwse-resize; pointer-events: auto; touch-action: none; user-select: none; font-size: 8px; line-height: 1; color: rgba(255,255,255,0.95); background: transparent; border: none; box-shadow: none;"
      }).buildElement().buildElement().buildOverlay(this.windowParent);
      __privateMethod(this, _WindowFilter_instances, applyWindowedColorLayout_fn).call(this, normalizedLayout, false);
      __privateMethod(this, _WindowFilter_instances, initializeWindowedPersistence_fn).call(this);
      const scrollableContainer = document.querySelector(`#${this.windowID} .bm-container.bm-scrollable`);
      __privateMethod(this, _WindowFilter_instances, initializeHorizontalScrollWheel_fn).call(this, scrollableContainer);
      __privateMethod(this, _WindowFilter_instances, setWindowOpenState_fn).call(this, true);
      __privateMethod(this, _WindowFilter_instances, buildColorList_fn).call(this, scrollableContainer);
      __privateMethod(this, _WindowFilter_instances, syncSortFormControls_fn).call(this);
      __privateMethod(this, _WindowFilter_instances, sortColorList_fn).call(this, this.sortPrimary, this.sortSecondary, this.showUnused);
      __privateMethod(this, _WindowFilter_instances, startAutoRefresh_fn).call(this);
    }
    /** Returns whether the filter window should be restored on page load.
     * @returns {boolean}
     * @since 0.96.0
     */
    shouldAutoOpen() {
      const windowState = __privateMethod(this, _WindowFilter_instances, getWindowState_fn2).call(this);
      return windowState?.isOpen !== false;
    }
    /** The information about a specific color on the palette.
     * @typedef {Object} ColorData
     * @property {number | string} colorTotal
     * @property {string} colorTotalLocalized
     * @property {number | string} colorCorrect
     * @property {string} colorCorrectLocalized
     * @property {string} colorPercent
     * @property {number} colorIncorrect
     */
    /** Updates the information inside the colors in the color list.
     * If the color list does not exist yet, it returns the color information instead.
     * This assumes the information inside each element is the same between fullscreen and windowed mode.
     * @since 0.90.60
     * @returns {Object.<number, ColorData>}
     */
    updateColorList() {
      __privateMethod(this, _WindowFilter_instances, calculatePixelStatistics_fn).call(this);
      const windowElement = __privateMethod(this, _WindowFilter_instances, getOwnedWindowElement_fn).call(this);
      const colorList = windowElement?.querySelector(`#${this.colorListID}`);
      const colorStatistics = {};
      for (const color of this.palette) {
        const colorTotal = this.allPixelsColor.get(color.id) ?? 0;
        const colorTotalLocalized = localizeNumber(colorTotal);
        let colorCorrect = 0;
        let colorCorrectLocalized = "0";
        let colorPercent = localizePercent(1);
        if (colorTotal != 0) {
          colorCorrect = this.allPixelsCorrect.get(color.id) ?? "???";
          if (typeof colorCorrect != "number" && this.tilesLoadedTotal == this.tilesTotal && !!color.id) {
            colorCorrect = 0;
          }
          colorCorrectLocalized = typeof colorCorrect == "string" ? colorCorrect : localizeNumber(colorCorrect);
          colorPercent = isNaN(colorCorrect / colorTotal) ? "???" : localizePercent(colorCorrect / colorTotal);
        }
        const colorIncorrect = parseInt(colorTotal) - parseInt(colorCorrect);
        colorStatistics[color.id] = {
          colorTotal,
          colorTotalLocalized,
          colorCorrect,
          colorCorrectLocalized,
          colorPercent,
          colorIncorrect
        };
      }
      const windowedDragbarTotals = windowElement?.querySelector("#bm-filter-windowed-color-totals-dragbar");
      const windowedInlineTotals = windowElement?.querySelector("#bm-filter-windowed-color-totals-inline");
      const allCorrectCompact = this.allPixelsCorrectTotal.toString().length > 7 ? this.allPixelsCorrectTotal.toString().slice(0, 2) + "\u2026" + this.allPixelsCorrectTotal.toString().slice(-3) : this.allPixelsCorrectTotal.toString();
      const allTotalCompact = this.allPixelsTotal.toString().length > 7 ? this.allPixelsTotal.toString().slice(0, 2) + "\u2026" + this.allPixelsTotal.toString().slice(-3) : this.allPixelsTotal.toString();
      if (windowedDragbarTotals) {
        this.updateInnerHTML("#bm-filter-windowed-color-totals-dragbar", `${allCorrectCompact}/${allTotalCompact}`, true);
      }
      if (windowedInlineTotals) {
        this.updateInnerHTML("#bm-filter-windowed-color-totals-inline", `${localizeNumber(this.allPixelsCorrectTotal)} / ${localizeNumber(this.allPixelsTotal)}`, true);
      }
      this.updateInnerHTML("#bm-filter-tile-load", `${localizeNumber(this.tilesLoadedTotal)} / ${localizeNumber(this.tilesTotal)}`);
      this.updateInnerHTML("#bm-filter-tot-correct", localizeNumber(this.allPixelsCorrectTotal));
      this.updateInnerHTML("#bm-filter-tot-total", localizeNumber(this.allPixelsTotal));
      this.updateInnerHTML("#bm-filter-tot-remaining", `${localizeNumber((this.allPixelsTotal || 0) - (this.allPixelsCorrectTotal || 0))} (${localizePercent(((this.allPixelsTotal || 0) - (this.allPixelsCorrectTotal || 0)) / (this.allPixelsTotal || 1))})`);
      this.updateInnerHTML("#bm-filter-tot-completed", `<time datetime="${this.timeRemaining.toISOString().replace(/\.\d{3}Z$/, "Z")}">${this.timeRemainingLocalized}</time>`);
      if (!colorList) {
        return colorStatistics;
      }
      const colors = Array.from(colorList.children);
      const emptyColorStatistics = __privateMethod(this, _WindowFilter_instances, createEmptyColorStatistics_fn).call(this);
      for (const color of colors) {
        const colorID = parseInt(color.dataset["id"]);
        const {
          colorCorrect,
          colorCorrectLocalized,
          colorPercent,
          colorTotal,
          colorTotalLocalized,
          colorIncorrect
        } = colorStatistics[colorID] ?? emptyColorStatistics[colorID];
        color.dataset["correct"] = !Number.isNaN(parseInt(colorCorrect)) ? colorCorrect : "0";
        color.dataset["total"] = colorTotal;
        color.dataset["percent"] = colorPercent.slice(-1) == "%" ? colorPercent.slice(0, -1) : "0";
        color.dataset["incorrect"] = colorIncorrect || 0;
        const pixelCount = windowElement?.querySelector(`.bm-filter-color[data-id="${colorID}"] .bm-filter-color-pxl-cnt`);
        if (pixelCount) {
          pixelCount.dataset["correctLabel"] = colorCorrectLocalized;
          pixelCount.dataset["totalLabel"] = colorTotalLocalized;
          const isWindowedPixelCount = !!pixelCount.closest(`#${this.windowID}.bm-windowed`);
          const isHorizontalWindowedPixelCount = !!pixelCount.closest(`#${this.windowID}.bm-windowed.bm-filter-layout-horizontal`);
          if (Number(colorTotal) === 0) {
            pixelCount.textContent = "-";
          } else if (isHorizontalWindowedPixelCount) {
            pixelCount.innerHTML = `${colorCorrectLocalized}<br>out of ${colorTotalLocalized}`;
          } else if (isWindowedPixelCount) {
            pixelCount.textContent = `${colorCorrectLocalized} / ${colorTotalLocalized}`;
          } else {
            pixelCount.innerHTML = `${colorCorrectLocalized} /<br>${colorTotalLocalized}`;
          }
        }
        const pixelDesc = windowElement?.querySelector(`.bm-filter-color[data-id="${colorID}"] .bm-filter-color-pxl-desc`);
        if (pixelDesc) {
          pixelDesc.innerHTML = `${colorPercent} done<br>${typeof colorIncorrect == "number" && !isNaN(colorIncorrect) ? colorIncorrect : "???"} off`;
        }
      }
      __privateMethod(this, _WindowFilter_instances, sortColorList_fn).call(this, this.sortPrimary, this.sortSecondary, this.showUnused);
    }
  };
  _WindowFilter_instances = new WeakSet();
  /** Returns the connected window owned by this instance.
   * @returns {HTMLElement | null}
   * @since 0.99.0
   */
  getOwnedWindowElement_fn = function() {
    if (this.windowElement?.isConnected && this.windowElement.dataset["filterOwner"] == this.ownerID) {
      return this.windowElement;
    }
    const windowElement = document.querySelector(`#${this.windowID}[data-filter-owner="${this.ownerID}"]`);
    this.windowElement = windowElement instanceof HTMLElement ? windowElement : null;
    return this.windowElement;
  };
  switchWindowMode_fn = async function(button, buildNext) {
    if (this.modeTransitionPending) {
      return;
    }
    this.modeTransitionPending = true;
    if (button) {
      button.disabled = true;
    }
    try {
      await __privateMethod(this, _WindowFilter_instances, closeWindow_fn2).call(this, true);
      buildNext();
    } finally {
      this.modeTransitionPending = false;
    }
  };
  /** Retrieves the persisted window state object.
   * @returns {Object | null}
   * @since 0.92.0
   */
  getWindowState_fn2 = function() {
    var _a, _b;
    if (!this.settingsManager) {
      return null;
    }
    (_a = this.settingsManager.userSettings)[_b = this.windowStateKey] ?? (_a[_b] = {});
    return this.settingsManager.userSettings[this.windowStateKey];
  };
  /** Persists whether the filter window is currently open.
   * @param {boolean} isOpen
   * @since 0.96.0
   */
  setWindowOpenState_fn = function(isOpen) {
    const windowState = __privateMethod(this, _WindowFilter_instances, getWindowState_fn2).call(this);
    if (!windowState) {
      return;
    }
    windowState.isOpen = !!isOpen;
    void this.settingsManager?.saveUserStorageNow();
  };
  /** Returns whether the filter should open in windowed mode.
   * Defaults to windowed mode when no explicit preference was stored.
   * @returns {boolean}
   * @since 0.92.1
   */
  prefersWindowedMode_fn = function() {
    const windowState = __privateMethod(this, _WindowFilter_instances, getWindowState_fn2).call(this);
    if (windowState?.mode == "windowed") {
      return true;
    }
    if (windowState?.mode == "fullscreen") {
      return false;
    }
    return true;
  };
  /** Updates the preferred window mode setting.
   * @param {boolean} shouldBeWindowed
   * @since 0.92.0
   */
  setWindowModePreference_fn = function(shouldBeWindowed) {
    const windowState = __privateMethod(this, _WindowFilter_instances, getWindowState_fn2).call(this);
    if (windowState) {
      windowState.mode = shouldBeWindowed ? "windowed" : "fullscreen";
    }
    if (!this.settingsManager) {
      return;
    }
    this.settingsManager.toggleFlag(this.windowModeFlag, shouldBeWindowed);
    void this.settingsManager.saveUserStorageNow();
  };
  /** Returns the preferred color layout for the windowed filter.
   * @returns {'vertical' | 'horizontal'}
   * @since 0.95.0
   */
  getWindowedColorLayout_fn = function() {
    const windowState = __privateMethod(this, _WindowFilter_instances, getWindowState_fn2).call(this);
    return windowState?.colorLayout == "horizontal" ? "horizontal" : "vertical";
  };
  /** Updates the preferred windowed color layout.
   * @param {'vertical' | 'horizontal'} layout
   * @since 0.98.0
   */
  setWindowedColorLayoutPreference_fn = function(layout) {
    const windowState = __privateMethod(this, _WindowFilter_instances, getWindowState_fn2).call(this);
    if (!windowState) {
      return;
    }
    windowState.colorLayout = layout == "horizontal" ? "horizontal" : "vertical";
    void this.settingsManager?.saveUserStorageNow();
  };
  /** Returns the active color layout for the rendered window.
   * @param {HTMLElement} [windowElement]
   * @returns {'vertical' | 'horizontal'}
   * @since 0.95.0
   */
  getActiveWindowedColorLayout_fn = function(windowElement = document.querySelector(`#${this.windowID}.bm-windowed`)) {
    return windowElement?.classList.contains("bm-filter-layout-horizontal") ? "horizontal" : "vertical";
  };
  /** Returns the per-layout geometry object for the windowed filter.
   * @param {'vertical' | 'horizontal'} layout
   * @returns {{x?: number, y?: number, width?: number, height?: number} | null}
   * @since 0.95.0
   */
  getWindowedLayoutSize_fn = function(layout) {
    var _a;
    const windowState = __privateMethod(this, _WindowFilter_instances, getWindowState_fn2).call(this);
    if (!windowState) {
      return null;
    }
    windowState.layoutSizes ?? (windowState.layoutSizes = {});
    (_a = windowState.layoutSizes)[layout] ?? (_a[layout] = {});
    return windowState.layoutSizes[layout];
  };
  /** Returns the maximum window width for a color layout.
   * @param {'vertical' | 'horizontal'} layout
   * @returns {number}
   * @since 0.95.0
   */
  getWindowLayoutMaxWidth_fn = function(layout) {
    const viewportMaximum = window.innerWidth - 16;
    if (layout == "horizontal") {
      return viewportMaximum;
    }
    return Math.min(this.windowMaxWidth, viewportMaximum);
  };
  /** Returns the minimum window height for a color layout.
   * @param {'vertical' | 'horizontal'} layout
   * @returns {number}
   * @since 0.95.0
   */
  getWindowLayoutMinHeight_fn = function(layout) {
    return layout == "horizontal" ? this.windowHorizontalHeight : this.windowMinHeight;
  };
  /** Returns the maximum window height for a color layout.
   * @param {'vertical' | 'horizontal'} layout
   * @returns {number}
   * @since 0.95.0
   */
  getWindowLayoutMaxHeight_fn = function(layout) {
    const viewportMaximum = window.innerHeight - 16;
    if (layout == "horizontal") {
      return Math.min(this.windowHorizontalHeight, viewportMaximum);
    }
    return Math.min(this.windowMaxHeight, viewportMaximum);
  };
  /** Persists only the size for the current color layout.
   * @param {HTMLElement} windowElement
   * @param {'vertical' | 'horizontal'} layout
   * @since 0.95.0
   */
  saveWindowLayoutSize_fn = function(windowElement, layout) {
    const layoutSize = __privateMethod(this, _WindowFilter_instances, getWindowedLayoutSize_fn).call(this, layout);
    if (!layoutSize || !windowElement?.isConnected) {
      return;
    }
    const rect = windowElement.getBoundingClientRect();
    layoutSize.width = __privateMethod(this, _WindowFilter_instances, clampWindowDimension_fn).call(this, rect.width, this.windowMinWidth, __privateMethod(this, _WindowFilter_instances, getWindowLayoutMaxWidth_fn).call(this, layout));
    layoutSize.height = layout == "horizontal" ? __privateMethod(this, _WindowFilter_instances, getWindowLayoutMaxHeight_fn).call(this, layout) : __privateMethod(this, _WindowFilter_instances, clampWindowDimension_fn).call(this, rect.height, __privateMethod(this, _WindowFilter_instances, getWindowLayoutMinHeight_fn).call(this, layout), __privateMethod(this, _WindowFilter_instances, getWindowLayoutMaxHeight_fn).call(this, layout));
  };
  /** Restores the remembered size for a color layout.
   * @param {HTMLElement} windowElement
   * @param {'vertical' | 'horizontal'} layout
   * @since 0.95.0
   */
  restoreWindowLayoutSize_fn = function(windowElement, layout) {
    const layoutSize = __privateMethod(this, _WindowFilter_instances, getWindowedLayoutSize_fn).call(this, layout);
    if (!layoutSize || !windowElement?.isConnected) {
      return;
    }
    let width = Number(layoutSize.width);
    let height = Number(layoutSize.height);
    if (!Number.isFinite(width)) {
      width = layout == "horizontal" ? Math.max(windowElement.getBoundingClientRect().width, Math.min(760, __privateMethod(this, _WindowFilter_instances, getWindowLayoutMaxWidth_fn).call(this, layout))) : Number(__privateMethod(this, _WindowFilter_instances, getWindowState_fn2).call(this)?.width) || windowElement.getBoundingClientRect().width;
    }
    if (layout == "horizontal") {
      height = __privateMethod(this, _WindowFilter_instances, getWindowLayoutMaxHeight_fn).call(this, layout);
    } else if (!Number.isFinite(height)) {
      height = Number(__privateMethod(this, _WindowFilter_instances, getWindowState_fn2).call(this)?.height) || windowElement.getBoundingClientRect().height;
    }
    width = __privateMethod(this, _WindowFilter_instances, clampWindowDimension_fn).call(this, width, this.windowMinWidth, __privateMethod(this, _WindowFilter_instances, getWindowLayoutMaxWidth_fn).call(this, layout));
    height = __privateMethod(this, _WindowFilter_instances, clampWindowDimension_fn).call(this, height, __privateMethod(this, _WindowFilter_instances, getWindowLayoutMinHeight_fn).call(this, layout), __privateMethod(this, _WindowFilter_instances, getWindowLayoutMaxHeight_fn).call(this, layout));
    layoutSize.width = width;
    layoutSize.height = height;
    windowElement.style.width = `${width}px`;
    windowElement.style.height = `${height}px`;
  };
  /** Applies the color list layout in windowed mode.
   * @param {'vertical' | 'horizontal'} layout
   * @param {boolean} [shouldPersist=true]
   * @since 0.95.0
   */
  applyWindowedColorLayout_fn = function(layout, shouldPersist = true) {
    const normalizedLayout = layout == "horizontal" ? "horizontal" : "vertical";
    const windowElement = document.querySelector(`#${this.windowID}.bm-windowed`);
    if (!windowElement) {
      return;
    }
    const previousLayout = __privateMethod(this, _WindowFilter_instances, getActiveWindowedColorLayout_fn).call(this, windowElement);
    if (shouldPersist && previousLayout != normalizedLayout) {
      __privateMethod(this, _WindowFilter_instances, saveWindowLayoutSize_fn).call(this, windowElement, previousLayout);
    }
    const applyLayout = () => {
      windowElement.classList.toggle("bm-filter-layout-horizontal", normalizedLayout == "horizontal");
      windowElement.classList.toggle("bm-filter-layout-vertical", normalizedLayout != "horizontal");
      const toggleButton = windowElement.querySelector("#bm-filter-layout-toggle");
      if (toggleButton) {
        const showsHorizontalLayout = normalizedLayout == "horizontal";
        toggleButton.innerHTML = showsHorizontalLayout ? verticalLayoutIcon : horizontalLayoutIcon;
        toggleButton.title = showsHorizontalLayout ? "Switch to vertical color layout" : "Switch to horizontal color layout";
        toggleButton.ariaLabel = toggleButton.title;
        toggleButton.setAttribute("aria-pressed", showsHorizontalLayout ? "true" : "false");
      }
      const windowState = __privateMethod(this, _WindowFilter_instances, getWindowState_fn2).call(this);
      if (windowState) {
        windowState.colorLayout = normalizedLayout;
      }
      __privateMethod(this, _WindowFilter_instances, syncWindowedColorLayoutLabels_fn).call(this, windowElement);
      __privateMethod(this, _WindowFilter_instances, restoreWindowLayoutSize_fn).call(this, windowElement, normalizedLayout);
    };
    if (shouldPersist) {
      this.animateLayoutChange(windowElement, applyLayout);
    } else {
      applyLayout();
    }
    if (shouldPersist) {
      __privateMethod(this, _WindowFilter_instances, saveWindowState_fn).call(this, windowElement);
      void this.settingsManager?.saveUserStorageNow();
    }
  };
  /** Updates only line wrapping that differs between vertical and horizontal layouts.
   * Avoids recalculating all pixel statistics during a layout-only action.
   * @param {HTMLElement} windowElement
   * @since 0.99.0
   */
  syncWindowedColorLayoutLabels_fn = function(windowElement) {
    const isHorizontal = windowElement.classList.contains("bm-filter-layout-horizontal");
    const pixelCounts = windowElement.querySelectorAll(".bm-filter-color-pxl-cnt");
    for (const pixelCount of pixelCounts) {
      const correct = pixelCount.dataset["correctLabel"];
      const total = pixelCount.dataset["totalLabel"];
      if (correct == null || total == null || Number(pixelCount.closest(".bm-filter-color")?.dataset["total"]) === 0) {
        continue;
      }
      if (isHorizontal) {
        pixelCount.innerHTML = `${correct}<br>out of ${total}`;
      } else {
        pixelCount.textContent = `${correct} / ${total}`;
      }
    }
  };
  /** Updates the visible sort controls to reflect the active sort state.
   * @since 0.92.1
   */
  syncSortFormControls_fn = function() {
    const sortPrimaryInput = document.querySelector(`#${this.windowID} #bm-filter-sort-primary`);
    const sortSecondaryInput = document.querySelector(`#${this.windowID} #bm-filter-sort-secondary`);
    const showUnusedInput = document.querySelector(`#${this.windowID} #bm-filter-show-unused`);
    if (sortPrimaryInput instanceof HTMLSelectElement) {
      sortPrimaryInput.value = this.sortPrimary;
      sortPrimaryInput.dispatchEvent(new Event("change", { "bubbles": true }));
    }
    if (sortSecondaryInput instanceof HTMLSelectElement) {
      sortSecondaryInput.value = this.sortSecondary;
      sortSecondaryInput.dispatchEvent(new Event("change", { "bubbles": true }));
    }
    if (showUnusedInput instanceof HTMLInputElement) {
      showUnusedInput.checked = this.showUnused;
    }
  };
  /** Enhances native sort selects into custom dropdowns while preserving form values.
   * @since 0.96.0
   */
  initializeCustomSortDropdowns_fn = function() {
    const sortSelects = Array.from(document.querySelectorAll(`#${this.windowID} .bm-filter-sort-select`));
    if (!sortSelects.length) {
      return;
    }
    for (const select of sortSelects) {
      if (!(select instanceof HTMLSelectElement) || select.dataset["customized"] == "true") {
        continue;
      }
      const wrapper = document.createElement("div");
      wrapper.className = "bm-filter-sort-dropdown";
      wrapper.dataset["inputId"] = select.id;
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "bm-filter-sort-dropdown-trigger";
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-controls", `${select.id}-menu`);
      const triggerText = document.createElement("span");
      triggerText.className = "bm-filter-sort-dropdown-text";
      trigger.appendChild(triggerText);
      const menu = document.createElement("div");
      menu.id = `${select.id}-menu`;
      menu.className = "bm-filter-sort-dropdown-menu";
      menu.setAttribute("role", "listbox");
      const updateDropdownState = () => {
        const selectedValue = select.value;
        const selectedOption = Array.from(select.options).find((option) => option.value == selectedValue) ?? select.options[0];
        triggerText.textContent = selectedOption?.textContent ?? "";
        for (const optionButton of menu.querySelectorAll(".bm-filter-sort-dropdown-option")) {
          const isSelected = optionButton.dataset["value"] == selectedValue;
          optionButton.classList.toggle("is-selected", isSelected);
          optionButton.setAttribute("aria-selected", isSelected ? "true" : "false");
        }
      };
      const focusDropdownOption = (direction = "selected") => {
        const optionButtons = Array.from(menu.querySelectorAll(".bm-filter-sort-dropdown-option"));
        if (!optionButtons.length) {
          return;
        }
        let targetIndex = optionButtons.findIndex((button) => button.classList.contains("is-selected"));
        if (targetIndex < 0) {
          targetIndex = 0;
        }
        if (direction === "first") {
          targetIndex = 0;
        } else if (direction === "last") {
          targetIndex = optionButtons.length - 1;
        } else if (typeof direction == "number") {
          const activeIndex = optionButtons.findIndex((button) => button === document.activeElement);
          const baseIndex = activeIndex >= 0 ? activeIndex : targetIndex;
          targetIndex = (baseIndex + direction + optionButtons.length) % optionButtons.length;
        }
        optionButtons[targetIndex]?.focus();
      };
      const setOpenState = (shouldOpen) => {
        wrapper.classList.toggle("is-open", shouldOpen);
        trigger.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
        if (shouldOpen) {
          focusDropdownOption("selected");
        }
      };
      trigger.onclick = () => {
        const shouldOpen = !wrapper.classList.contains("is-open");
        __privateMethod(this, _WindowFilter_instances, closeCustomSortDropdowns_fn).call(this, shouldOpen ? wrapper : null);
        setOpenState(shouldOpen);
      };
      trigger.onkeydown = (event) => {
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
          event.preventDefault();
          if (!wrapper.classList.contains("is-open")) {
            __privateMethod(this, _WindowFilter_instances, closeCustomSortDropdowns_fn).call(this, wrapper);
            setOpenState(true);
          }
          focusDropdownOption(event.key == "ArrowUp" ? "last" : "selected");
        } else if (event.key == "Escape") {
          setOpenState(false);
        }
      };
      for (const option of Array.from(select.options)) {
        const optionButton = document.createElement("button");
        optionButton.type = "button";
        optionButton.className = "bm-filter-sort-dropdown-option";
        optionButton.dataset["value"] = option.value;
        optionButton.textContent = option.textContent;
        optionButton.setAttribute("role", "option");
        optionButton.onclick = () => {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { "bubbles": true }));
          setOpenState(false);
          trigger.focus();
        };
        optionButton.onkeydown = (event) => {
          if (event.key == "ArrowDown") {
            event.preventDefault();
            focusDropdownOption(1);
          } else if (event.key == "ArrowUp") {
            event.preventDefault();
            focusDropdownOption(-1);
          } else if (event.key == "Home") {
            event.preventDefault();
            focusDropdownOption("first");
          } else if (event.key == "End") {
            event.preventDefault();
            focusDropdownOption("last");
          } else if (event.key == "Escape") {
            event.preventDefault();
            setOpenState(false);
            trigger.focus();
          } else if (event.key == "Enter" || event.key == " ") {
            event.preventDefault();
            optionButton.click();
          }
        };
        menu.appendChild(optionButton);
      }
      select.classList.add("bm-filter-sort-native");
      select.tabIndex = -1;
      select.setAttribute("aria-hidden", "true");
      select.dataset["customized"] = "true";
      select.addEventListener("change", updateDropdownState);
      select.parentElement?.insertBefore(wrapper, select);
      wrapper.appendChild(select);
      wrapper.appendChild(trigger);
      wrapper.appendChild(menu);
      updateDropdownState();
    }
    if (!this.sortDropdownPointerHandler) {
      this.sortDropdownPointerHandler = (event) => {
        if (!(event.target instanceof Element)) {
          __privateMethod(this, _WindowFilter_instances, closeCustomSortDropdowns_fn).call(this);
          return;
        }
        if (!event.target.closest(`#${this.windowID} .bm-filter-sort-dropdown`)) {
          __privateMethod(this, _WindowFilter_instances, closeCustomSortDropdowns_fn).call(this);
        }
      };
      document.addEventListener("pointerdown", this.sortDropdownPointerHandler);
    }
    if (!this.sortDropdownKeyHandler) {
      this.sortDropdownKeyHandler = (event) => {
        if (event.key == "Escape") {
          __privateMethod(this, _WindowFilter_instances, closeCustomSortDropdowns_fn).call(this);
        }
      };
      document.addEventListener("keydown", this.sortDropdownKeyHandler);
    }
  };
  /** Closes custom sort dropdowns, optionally leaving one open.
   * @param {HTMLElement | null} [exceptDropdown=null]
   * @since 0.96.0
   */
  closeCustomSortDropdowns_fn = function(exceptDropdown = null) {
    const dropdowns = document.querySelectorAll(`#${this.windowID} .bm-filter-sort-dropdown`);
    for (const dropdown of dropdowns) {
      const shouldStayOpen = !!exceptDropdown && dropdown === exceptDropdown;
      dropdown.classList.toggle("is-open", shouldStayOpen);
      const trigger = dropdown.querySelector(".bm-filter-sort-dropdown-trigger");
      if (trigger instanceof HTMLButtonElement) {
        trigger.setAttribute("aria-expanded", shouldStayOpen ? "true" : "false");
      }
    }
  };
  /** Removes global handlers used by custom sort dropdowns.
   * @since 0.96.0
   */
  cleanupCustomSortDropdowns_fn = function() {
    if (this.sortDropdownPointerHandler) {
      document.removeEventListener("pointerdown", this.sortDropdownPointerHandler);
      this.sortDropdownPointerHandler = null;
    }
    if (this.sortDropdownKeyHandler) {
      document.removeEventListener("keydown", this.sortDropdownKeyHandler);
      this.sortDropdownKeyHandler = null;
    }
  };
  closeWindow_fn2 = async function(preserveOpenState = false) {
    const windowElement = __privateMethod(this, _WindowFilter_instances, getOwnedWindowElement_fn).call(this);
    if (windowElement?.classList.contains("bm-windowed")) {
      __privateMethod(this, _WindowFilter_instances, saveWindowState_fn).call(this, windowElement);
    }
    if (!preserveOpenState) {
      __privateMethod(this, _WindowFilter_instances, setWindowOpenState_fn).call(this, false);
    }
    __privateMethod(this, _WindowFilter_instances, stopAutoRefresh_fn).call(this);
    __privateMethod(this, _WindowFilter_instances, cleanupWindowPersistence_fn).call(this);
    __privateMethod(this, _WindowFilter_instances, cleanupCustomSortDropdowns_fn).call(this);
    await this.handleWindowClose(windowElement);
    if (this.windowElement == windowElement) {
      this.windowElement = null;
    }
  };
  /** Starts the automatic Color Filter statistics refresh loop.
   * @since 0.92.1
   */
  startAutoRefresh_fn = function() {
    __privateMethod(this, _WindowFilter_instances, stopAutoRefresh_fn).call(this);
    this.colorRefreshInterval = setInterval(() => {
      if (!__privateMethod(this, _WindowFilter_instances, getOwnedWindowElement_fn).call(this)) {
        __privateMethod(this, _WindowFilter_instances, stopAutoRefresh_fn).call(this);
        return;
      }
      this.refreshColorList();
    }, this.colorRefreshIntervalMS);
  };
  /** Stops the automatic Color Filter statistics refresh loop.
   * @since 0.92.1
   */
  stopAutoRefresh_fn = function() {
    if (!this.colorRefreshInterval) {
      return;
    }
    clearInterval(this.colorRefreshInterval);
    this.colorRefreshInterval = null;
  };
  /** Disconnects live observers used for window persistence.
   * @since 0.92.0
   */
  cleanupWindowPersistence_fn = function() {
    if (this.windowResizeObserver) {
      this.windowResizeObserver.disconnect();
      this.windowResizeObserver = null;
    }
    if (this.windowViewportResizeHandler) {
      window.removeEventListener("resize", this.windowViewportResizeHandler);
      this.windowViewportResizeHandler = null;
    }
    if (this.windowHorizontalWheelHandler && this.windowHorizontalWheelElement) {
      this.windowHorizontalWheelElement.removeEventListener("wheel", this.windowHorizontalWheelHandler);
      this.windowHorizontalWheelHandler = null;
      this.windowHorizontalWheelElement = null;
    }
    if (this.windowSaveTimeout) {
      clearTimeout(this.windowSaveTimeout);
      this.windowSaveTimeout = null;
    }
  };
  /** Returns a clamped dimension value for the window.
   * @param {number} size - The size in pixels
   * @param {number} minimum - Minimum allowed size
   * @param {number} maximum - Maximum allowed size
   * @returns {number}
   * @since 0.92.0
   */
  clampWindowDimension_fn = function(size, minimum, maximum) {
    const resolvedMaximum = Math.max(minimum, maximum);
    return Math.min(Math.max(Math.round(Number(size) || minimum), minimum), resolvedMaximum);
  };
  /** Returns a viewport-safe position for the window.
   * @param {HTMLElement} windowElement
   * @param {number} x
   * @param {number} y
   * @returns {{x: number, y: number}}
   * @since 0.92.0
   */
  clampWindowPosition_fn2 = function(windowElement, x, y) {
    const margin = 8;
    const maxX = Math.max(margin, window.innerWidth - windowElement.offsetWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - windowElement.offsetHeight - margin);
    return {
      x: Math.min(Math.max(Math.round(Number(x) || margin), margin), maxX),
      y: Math.min(Math.max(Math.round(Number(y) || margin), margin), maxY)
    };
  };
  /** Applies the persisted size and position to the windowed filter.
   * @param {HTMLElement} windowElement
   * @since 0.92.0
   */
  restoreWindowState_fn = function(windowElement) {
    const windowState = __privateMethod(this, _WindowFilter_instances, getWindowState_fn2).call(this);
    if (!windowState || !windowElement) {
      return;
    }
    const layout = __privateMethod(this, _WindowFilter_instances, getWindowedColorLayout_fn).call(this);
    const layoutSize = __privateMethod(this, _WindowFilter_instances, getWindowedLayoutSize_fn).call(this, layout);
    const width = Number(layoutSize?.width ?? windowState.width);
    const height = Number(layoutSize?.height ?? windowState.height);
    const hasWidth = Number.isFinite(width);
    const hasHeight = Number.isFinite(height);
    if (hasWidth) {
      const nextWidth = __privateMethod(this, _WindowFilter_instances, clampWindowDimension_fn).call(this, width, this.windowMinWidth, __privateMethod(this, _WindowFilter_instances, getWindowLayoutMaxWidth_fn).call(this, layout));
      layoutSize.width = nextWidth;
      windowState.width = nextWidth;
      windowElement.style.width = `${nextWidth}px`;
    }
    if (hasHeight) {
      const nextHeight = __privateMethod(this, _WindowFilter_instances, clampWindowDimension_fn).call(this, height, __privateMethod(this, _WindowFilter_instances, getWindowLayoutMinHeight_fn).call(this, layout), __privateMethod(this, _WindowFilter_instances, getWindowLayoutMaxHeight_fn).call(this, layout));
      layoutSize.height = nextHeight;
      windowState.height = nextHeight;
      windowElement.style.height = `${nextHeight}px`;
    }
    requestAnimationFrame(() => {
      if (!windowElement.isConnected) {
        return;
      }
      const x = Number(layoutSize?.x ?? windowState.x);
      const y = Number(layoutSize?.y ?? windowState.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return;
      }
      const clampedPosition = __privateMethod(this, _WindowFilter_instances, clampWindowPosition_fn2).call(this, windowElement, x, y);
      windowElement.style.left = "0px";
      windowElement.style.top = "0px";
      windowElement.style.right = "";
      windowElement.style.transform = `translate(${clampedPosition.x}px, ${clampedPosition.y}px)`;
      if (clampedPosition.x != x || clampedPosition.y != y) {
        layoutSize.x = clampedPosition.x;
        layoutSize.y = clampedPosition.y;
        void this.settingsManager?.saveUserStorageNow();
      }
    });
  };
  /** Saves the current size and position of the windowed filter.
   * @param {HTMLElement} windowElement
   * @since 0.92.0
   */
  saveWindowState_fn = function(windowElement) {
    const windowState = __privateMethod(this, _WindowFilter_instances, getWindowState_fn2).call(this);
    if (!windowState || !windowElement?.isConnected || !windowElement.classList.contains("bm-windowed")) {
      return;
    }
    if (windowElement.querySelector('.bm-dragbar button[data-button-status="collapsed"]')) {
      return;
    }
    const layout = __privateMethod(this, _WindowFilter_instances, getActiveWindowedColorLayout_fn).call(this, windowElement);
    const rect = windowElement.getBoundingClientRect();
    const width = __privateMethod(this, _WindowFilter_instances, clampWindowDimension_fn).call(this, rect.width, this.windowMinWidth, __privateMethod(this, _WindowFilter_instances, getWindowLayoutMaxWidth_fn).call(this, layout));
    const height = layout == "horizontal" ? __privateMethod(this, _WindowFilter_instances, getWindowLayoutMaxHeight_fn).call(this, layout) : __privateMethod(this, _WindowFilter_instances, clampWindowDimension_fn).call(this, rect.height, __privateMethod(this, _WindowFilter_instances, getWindowLayoutMinHeight_fn).call(this, layout), __privateMethod(this, _WindowFilter_instances, getWindowLayoutMaxHeight_fn).call(this, layout));
    if (Math.round(rect.width) != width) {
      windowElement.style.width = `${width}px`;
    }
    if (Math.round(rect.height) != height) {
      windowElement.style.height = `${height}px`;
    }
    const clampedPosition = __privateMethod(this, _WindowFilter_instances, clampWindowPosition_fn2).call(this, windowElement, rect.left, rect.top);
    windowElement.style.left = "0px";
    windowElement.style.top = "0px";
    windowElement.style.right = "";
    windowElement.style.transform = `translate(${clampedPosition.x}px, ${clampedPosition.y}px)`;
    windowState.x = clampedPosition.x;
    windowState.y = clampedPosition.y;
    windowState.width = width;
    windowState.height = height;
    windowState.colorLayout = layout;
    const layoutSize = __privateMethod(this, _WindowFilter_instances, getWindowedLayoutSize_fn).call(this, layout);
    if (layoutSize) {
      layoutSize.x = clampedPosition.x;
      layoutSize.y = clampedPosition.y;
      layoutSize.width = width;
      layoutSize.height = height;
    }
    void this.settingsManager?.saveUserStorageNow();
  };
  /** Debounces persisting the current window size and position.
   * @param {HTMLElement} windowElement
   * @param {number} [delay=150]
   * @since 0.92.0
   */
  scheduleWindowStateSave_fn = function(windowElement, delay = 150) {
    if (this.windowSaveTimeout) {
      clearTimeout(this.windowSaveTimeout);
    }
    this.windowSaveTimeout = setTimeout(() => {
      this.windowSaveTimeout = null;
      __privateMethod(this, _WindowFilter_instances, saveWindowState_fn).call(this, windowElement);
    }, delay);
  };
  /** Enables persistence and resize handling for the windowed filter.
   * @since 0.92.0
   */
  initializeWindowedPersistence_fn = function() {
    const windowElement = document.querySelector(`#${this.windowID}.bm-window`);
    if (!windowElement) {
      return;
    }
    __privateMethod(this, _WindowFilter_instances, cleanupWindowPersistence_fn).call(this);
    __privateMethod(this, _WindowFilter_instances, restoreWindowState_fn).call(this, windowElement);
    this.handleDrag(`#${this.windowID}.bm-window`, `#${this.windowID} .bm-dragbar`, {
      onEnd: ({ element }) => __privateMethod(this, _WindowFilter_instances, saveWindowState_fn).call(this, element)
    });
    this.handleResize(`#${this.windowID}.bm-window`, `#${this.windowID} .bm-resize-corner`, {
      minWidth: this.windowMinWidth,
      minHeight: () => __privateMethod(this, _WindowFilter_instances, getWindowLayoutMinHeight_fn).call(this, __privateMethod(this, _WindowFilter_instances, getActiveWindowedColorLayout_fn).call(this, windowElement)),
      maxHeight: () => __privateMethod(this, _WindowFilter_instances, getWindowLayoutMaxHeight_fn).call(this, __privateMethod(this, _WindowFilter_instances, getActiveWindowedColorLayout_fn).call(this, windowElement)),
      onEnd: ({ element }) => __privateMethod(this, _WindowFilter_instances, saveWindowState_fn).call(this, element)
    });
    if (typeof ResizeObserver == "function") {
      this.windowResizeObserver = new ResizeObserver(() => __privateMethod(this, _WindowFilter_instances, scheduleWindowStateSave_fn).call(this, windowElement));
      this.windowResizeObserver.observe(windowElement);
    }
    this.windowViewportResizeHandler = () => __privateMethod(this, _WindowFilter_instances, scheduleWindowStateSave_fn).call(this, windowElement, 0);
    window.addEventListener("resize", this.windowViewportResizeHandler);
  };
  /** Converts vertical wheel input into horizontal scrolling for the horizontal color layout.
   * @param {HTMLElement} scrollableContainer
   * @since 0.95.0
   */
  initializeHorizontalScrollWheel_fn = function(scrollableContainer) {
    if (!scrollableContainer) {
      return;
    }
    if (this.windowHorizontalWheelHandler && this.windowHorizontalWheelElement) {
      this.windowHorizontalWheelElement.removeEventListener("wheel", this.windowHorizontalWheelHandler);
    }
    this.windowHorizontalWheelElement = scrollableContainer;
    this.windowHorizontalWheelHandler = (event) => {
      const windowElement = scrollableContainer.closest(`#${this.windowID}.bm-windowed`);
      if (!windowElement?.classList.contains("bm-filter-layout-horizontal")) {
        return;
      }
      if (scrollableContainer.scrollWidth <= scrollableContainer.clientWidth) {
        return;
      }
      const horizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!horizontalDelta) {
        return;
      }
      scrollableContainer.scrollLeft += horizontalDelta;
      event.preventDefault();
    };
    scrollableContainer.addEventListener("wheel", this.windowHorizontalWheelHandler, { passive: false });
  };
  /** Creates placeholder statistics used while template data is unavailable.
   * @returns {Object.<number, ColorData>}
   * @since 0.99.0
   */
  createEmptyColorStatistics_fn = function() {
    return Object.fromEntries(this.palette.map((color) => [color.id, {
      colorTotal: 0,
      colorTotalLocalized: "0",
      colorCorrect: 0,
      colorCorrectLocalized: "0",
      colorPercent: "???",
      colorIncorrect: 0
    }]));
  };
  /** Creates the color list container.
   * @param {HTMLElement} parentElement - Parent element to add the color list to as a child
   * @since 0.88.222
   */
  buildColorList_fn = function(parentElement) {
    if (!parentElement) {
      console.error("Blue Marble: Color Filter container is missing.");
      return;
    }
    const parentWindow = parentElement.closest(`#${this.windowID}`);
    const isWindowedMode = parentWindow?.classList.contains("bm-windowed");
    const isHorizontalWindowedMode = isWindowedMode && parentWindow?.classList.contains("bm-filter-layout-horizontal");
    console.log(`Is Windowed Mode: ${isWindowedMode}`);
    const colorList = new Overlay(this.name, this.version);
    colorList.addDiv({ "id": this.colorListID });
    const colorStatistics = __privateMethod(this, _WindowFilter_instances, createEmptyColorStatistics_fn).call(this);
    for (const color of this.palette) {
      const lumin = calculateRelativeLuminance(color.rgb);
      let textColorForPaletteColorBackground = 1.05 / (lumin + 0.05) > (lumin + 0.05) / 0.05 ? "white" : "black";
      if (!color.id) {
        textColorForPaletteColorBackground = "transparent";
      }
      const bgEffectForButtons = textColorForPaletteColorBackground == "white" ? "bm-button-hover-white" : "bm-button-hover-black";
      const colorRGB = color.rgb?.map((channel) => Number(channel) || 0).join(",");
      const colorCardText = color.id == -2 || color.id == -1 || color.id == 0 ? "white" : textColorForPaletteColorBackground;
      const colorCardStyle = `--bm-filter-card-bg: rgb(${colorRGB}); --bm-filter-card-fg: ${colorCardText};`;
      const {
        colorCorrect,
        colorCorrectLocalized,
        colorPercent,
        colorTotal,
        colorTotalLocalized,
        colorIncorrect
      } = colorStatistics[color.id];
      const isColorHidden = !!(this.templateManager.shouldFilterColor.get(color.id) || false);
      const isIncorrectHighlightActive = this.templateManager.getIncorrectHighlightColorID?.() == color.id;
      const incorrectHighlightMode = isIncorrectHighlightActive ? this.templateManager.getIncorrectHighlightMode?.() : "inactive";
      const incorrectHighlightLabel = __privateMethod(this, _WindowFilter_instances, getIncorrectHighlightButtonLabel_fn).call(this, color.name, incorrectHighlightMode);
      const hasNoPixels = Number(colorTotal) === 0;
      if (isWindowedMode) {
        const styleBackgroundStar = `background-size: auto 100%; background-repeat: repeat-x; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50,5L79,91L2,39L98,39L21,91' fill='${textColorForPaletteColorBackground}' fill-opacity='.1'/></svg>");`;
        colorList.addDiv({
          "class": "bm-container bm-filter-color bm-flex-between",
          // Dataset
          "data-id": color.id,
          "data-name": color.name,
          "data-premium": +color.premium,
          "data-state": isColorHidden ? "hidden" : "shown",
          "data-highlight": incorrectHighlightMode,
          "data-correct": !Number.isNaN(parseInt(colorCorrect)) ? colorCorrect : "0",
          "data-total": colorTotal,
          "data-percent": colorPercent.slice(-1) == "%" ? colorPercent.slice(0, -1) : "0",
          "data-incorrect": colorIncorrect || 0
        }, (instance, div) => __privateMethod(this, _WindowFilter_instances, initializeColorBlockToggle_fn).call(this, div, color)).addDiv({ "class": "bm-filter-container-rgb", "style": `background-color: rgb(${color.rgb?.map((channel) => Number(channel) || 0).join(",")});${color.premium ? styleBackgroundStar : ""}` }).addButton(
          {
            "class": "bm-button-trans bm-filter-color-visibility " + bgEffectForButtons,
            "data-state": isColorHidden ? "hidden" : "shown",
            "aria-label": isColorHidden ? `Show the color ${color.name || ""} on templates.` : `Hide the color ${color.name || ""} on templates.`,
            "innerHTML": isColorHidden ? this.eyeClosed : this.eyeOpen,
            "style": `color: ${textColorForPaletteColorBackground};`
          },
          (instance, button) => {
            button.onclick = (event) => {
              event.stopPropagation();
              __privateMethod(this, _WindowFilter_instances, toggleColorVisibility_fn).call(this, button, color);
            };
            if (!color.id) {
              button.disabled = true;
            }
            __privateMethod(this, _WindowFilter_instances, syncColorToggleLabel_fn).call(this, button, color);
          }
        ).buildElement().addButton(
          {
            "class": "bm-button-trans bm-filter-color-highlight " + bgEffectForButtons,
            "aria-label": incorrectHighlightLabel,
            "aria-pressed": isIncorrectHighlightActive ? "true" : "false",
            "title": incorrectHighlightLabel.replace(/\.$/, ""),
            "data-mode": incorrectHighlightMode,
            "innerHTML": incorrectHighlightIcon,
            "style": `color: ${textColorForPaletteColorBackground};`
          },
          (instance, button) => {
            button.onclick = (event) => {
              event.stopPropagation();
              __privateMethod(this, _WindowFilter_instances, toggleIncorrectHighlightColor_fn).call(this, button, color);
            };
            button.onkeydown = (event) => event.stopPropagation();
            if (!color.id) {
              button.disabled = true;
            }
          }
        ).buildElement().addHeader(2, { "textContent": color.name, "style": `color: ${color.id == -1 || color.id == 0 ? "white" : textColorForPaletteColorBackground}` }).buildElement().addSmall({ "class": "bm-filter-color-pxl-cnt", "data-correct-label": colorCorrectLocalized, "data-total-label": colorTotalLocalized, "innerHTML": hasNoPixels ? "-" : isHorizontalWindowedMode ? `${colorCorrectLocalized}<br>out of ${colorTotalLocalized}` : `${colorCorrectLocalized} / ${colorTotalLocalized}`, "style": `color: ${color.id == -1 || color.id == 0 ? "white" : textColorForPaletteColorBackground}; flex: 1 1 auto; text-align: right;` }).buildElement().buildElement().buildElement();
      } else {
        colorList.addDiv({
          "class": "bm-container bm-filter-color bm-flex-between",
          "style": colorCardStyle,
          "data-id": color.id,
          "data-name": color.name,
          "data-premium": +color.premium,
          "data-state": isColorHidden ? "hidden" : "shown",
          "data-highlight": incorrectHighlightMode,
          "data-correct": !Number.isNaN(parseInt(colorCorrect)) ? colorCorrect : "0",
          "data-total": colorTotal,
          "data-percent": colorPercent.slice(-1) == "%" ? colorPercent.slice(0, -1) : "0",
          "data-incorrect": colorIncorrect || 0
        }, (instance, div) => __privateMethod(this, _WindowFilter_instances, initializeColorBlockToggle_fn).call(this, div, color)).addDiv({ "class": "bm-filter-premium-star", "aria-hidden": "true" }).buildElement().addDiv({ "class": "bm-filter-color-main" }).addDiv({ "class": "bm-filter-container-rgb" }).addButton(
          {
            "class": "bm-button-trans bm-filter-color-visibility " + bgEffectForButtons,
            "data-state": isColorHidden ? "hidden" : "shown",
            "aria-label": isColorHidden ? `Show the color ${color.name || ""} on templates.` : `Hide the color ${color.name || ""} on templates.`,
            "innerHTML": isColorHidden ? this.eyeClosed : this.eyeOpen,
            "style": `color: ${colorCardText};`
          },
          (instance, button) => {
            button.onclick = (event) => {
              event.stopPropagation();
              __privateMethod(this, _WindowFilter_instances, toggleColorVisibility_fn).call(this, button, color);
            };
            if (!color.id) {
              button.disabled = true;
            }
            __privateMethod(this, _WindowFilter_instances, syncColorToggleLabel_fn).call(this, button, color);
          }
        ).buildElement().addButton(
          {
            "class": "bm-button-trans bm-filter-color-highlight",
            "aria-label": incorrectHighlightLabel,
            "aria-pressed": isIncorrectHighlightActive ? "true" : "false",
            "title": incorrectHighlightLabel.replace(/\.$/, ""),
            "data-mode": incorrectHighlightMode,
            "innerHTML": incorrectHighlightIcon
          },
          (instance, button) => {
            button.onclick = (event) => {
              event.stopPropagation();
              __privateMethod(this, _WindowFilter_instances, toggleIncorrectHighlightColor_fn).call(this, button, color);
            };
            button.onkeydown = (event) => event.stopPropagation();
            if (!color.id) {
              button.disabled = true;
            }
          }
        ).buildElement().buildElement().addDiv({ "class": "bm-filter-color-title" }).addHeader(2, { "textContent": color.name }).buildElement().buildElement().buildElement().addDiv({ "class": "bm-filter-color-meta" }).addDiv({ "class": "bm-filter-color-progress" }).addSpan({ "class": "bm-filter-color-pxl-cnt", "innerHTML": hasNoPixels ? "-" : `${colorCorrectLocalized} /<br>${colorTotalLocalized}` }).buildElement().addSmall({ "class": "bm-filter-color-pxl-desc", "innerHTML": `${colorPercent} done<br>${typeof colorIncorrect == "number" && !isNaN(colorIncorrect) ? colorIncorrect : "???"} off` }).buildElement().buildElement().buildElement().buildElement();
      }
    }
    parentElement.querySelector(`#${this.colorListID}`)?.remove();
    colorList.buildOverlay(parentElement);
    this.refreshColorList();
  };
  /** Sorts the color list & hides unused colors
   * @param {string} sortPrimary - The name of the dataset attribute to sort by.
   * @param {string} sortSecondary - Secondary sort. It can be either 'ascending' or 'descending'.
   * @param {boolean} showUnused - Should unused colors be displayed in the list to the user?
   * @since 0.88.222
   */
  sortColorList_fn = function(sortPrimary, sortSecondary, showUnused) {
    this.sortPrimary = sortPrimary;
    this.sortSecondary = sortSecondary;
    this.showUnused = showUnused;
    const colorList = __privateMethod(this, _WindowFilter_instances, getOwnedWindowElement_fn).call(this)?.querySelector(`#${this.colorListID}`);
    if (!colorList) {
      return;
    }
    const colors = Array.from(colorList.children);
    const statisticsReady = colorList.dataset["statisticsState"] == "ready";
    const hasUsedColors = colors.some((color) => Number(color.getAttribute("data-total")) > 0);
    const hiddenStates = new Map(colors.map((color) => [
      color,
      !showUnused && statisticsReady && hasUsedColors && !Number(color.getAttribute("data-total"))
    ]));
    colors.sort((index, nextIndex) => {
      const indexValue = index.getAttribute("data-" + sortPrimary);
      const nextIndexValue = nextIndex.getAttribute("data-" + sortPrimary);
      const indexValueNumber = parseFloat(indexValue);
      const nextIndexValueNumber = parseFloat(nextIndexValue);
      if (!isNaN(indexValueNumber) && !isNaN(nextIndexValueNumber)) {
        return sortSecondary === "ascending" ? indexValueNumber - nextIndexValueNumber : nextIndexValueNumber - indexValueNumber;
      }
      const indexValueString = indexValue.toLowerCase();
      const nextIndexValueString = nextIndexValue.toLowerCase();
      if (indexValueString < nextIndexValueString) {
        return sortSecondary === "ascending" ? -1 : 1;
      }
      if (indexValueString > nextIndexValueString) {
        return sortSecondary === "ascending" ? 1 : -1;
      }
      return 0;
    });
    const currentColors = Array.from(colorList.children);
    const didChange = colors.some(
      (color, index) => currentColors[index] != color || color.classList.contains("bm-color-hide") != hiddenStates.get(color)
    );
    if (!didChange) {
      return;
    }
    const updateList = () => {
      for (const color of colors) {
        color.classList.toggle("bm-color-hide", hiddenStates.get(color));
      }
      const fragment = document.createDocumentFragment();
      colors.forEach((color) => fragment.appendChild(color));
      colorList.appendChild(fragment);
    };
    this.animateListReorder(colors, updateList);
  };
  /** (Un)selects all colors in the color list that are visible to the user.
   * @param {boolean} userWantsUnselect - Does the user want to unselect colors?
   * @since 0.88.222
   */
  selectColorList_fn = function(userWantsUnselect) {
    const windowElement = __privateMethod(this, _WindowFilter_instances, getOwnedWindowElement_fn).call(this);
    const colorList = windowElement?.querySelector(`#${this.colorListID}`);
    if (!colorList) {
      return;
    }
    const colors = Array.from(colorList.children);
    const shouldHide = !userWantsUnselect;
    const changedColorIDs = [];
    for (const color of colors) {
      if (color.classList?.contains("bm-color-hide")) {
        continue;
      }
      const colorID = Number(color.dataset["id"]);
      if (!colorID) {
        continue;
      }
      const button = color.querySelector(".bm-filter-color-visibility");
      if (button.dataset["state"] == "hidden" && !userWantsUnselect) {
        continue;
      }
      if (button.dataset["state"] == "shown" && userWantsUnselect) {
        continue;
      }
      button.dataset["state"] = shouldHide ? "hidden" : "shown";
      button.innerHTML = shouldHide ? this.eyeClosed : this.eyeOpen;
      __privateMethod(this, _WindowFilter_instances, syncColorToggleLabel_fn).call(this, button, { name: color.dataset["name"] || "" });
      changedColorIDs.push(colorID);
    }
    if (!changedColorIDs.length) {
      return;
    }
    this.templateManager.setColorsFiltered(changedColorIDs, shouldHide);
    this.animateStateChange(colorList);
  };
  /** Updates the color toggle labels on the icon and the clickable color block.
   * @param {HTMLButtonElement} button - The color visibility button
   * @param {Object} color - Palette color metadata
   * @since 0.95.0
   */
  syncColorToggleLabel_fn = function(button, color) {
    const ariaLabel = button.dataset["state"] == "hidden" ? `Show the color ${color.name || ""} on templates.` : `Hide the color ${color.name || ""} on templates.`;
    button.ariaLabel = ariaLabel;
    const colorElement = button.closest(".bm-filter-color");
    colorElement?.setAttribute("aria-label", ariaLabel);
    colorElement?.setAttribute("data-state", button.dataset["state"]);
  };
  /** Toggles a color from the clickable color block or its icon.
   * @param {HTMLButtonElement} button - The color visibility button
   * @param {Object} color - Palette color metadata
   * @since 0.95.0
   */
  toggleColorVisibility_fn = function(button, color) {
    if (!button || button.disabled || !color.id) {
      return;
    }
    button.style.textDecoration = "none";
    button.disabled = true;
    if (button.dataset["state"] == "shown") {
      button.innerHTML = this.eyeClosed;
      button.dataset["state"] = "hidden";
      this.templateManager.setColorFiltered(color.id, true);
      __privateMethod(this, _WindowFilter_instances, animateColorToggleIcon_fn).call(this, button, "hide");
    } else {
      button.dataset["state"] = "shown";
      this.templateManager.setColorFiltered(color.id, false);
      __privateMethod(this, _WindowFilter_instances, animateColorToggleIcon_fn).call(this, button, "show");
    }
    __privateMethod(this, _WindowFilter_instances, syncColorToggleLabel_fn).call(this, button, color);
    button.disabled = false;
    button.style.textDecoration = "";
  };
  toggleIncorrectHighlightColor_fn = async function(button, color) {
    if (!button || button.disabled || !color.id || this.highlightRefreshPending) {
      return;
    }
    this.templateManager.toggleIncorrectHighlightColor(color.id);
    __privateMethod(this, _WindowFilter_instances, syncIncorrectHighlightButtons_fn).call(this);
    const highlightButtons = document.querySelectorAll(`#${this.windowID} .bm-filter-color-highlight`);
    for (const highlightButton of highlightButtons) {
      highlightButton.setAttribute("aria-disabled", "true");
    }
    button.disabled = true;
    button.dataset["loading"] = "true";
    button.setAttribute("aria-busy", "true");
    const refreshPromise = this.templateManager.requestCanvasRefresh();
    this.highlightRefreshPending = refreshPromise;
    try {
      await refreshPromise;
    } finally {
      if (this.highlightRefreshPending == refreshPromise) {
        this.highlightRefreshPending = null;
      }
      for (const highlightButton of highlightButtons) {
        highlightButton.removeAttribute("aria-disabled");
      }
      if (button.isConnected) {
        button.disabled = false;
        delete button.dataset["loading"];
        button.removeAttribute("aria-busy");
      }
    }
  };
  /** Returns the next-action label for the color highlight button.
   * @param {string} colorName
   * @param {'inactive' | 'incorrect' | 'missing'} mode
   * @returns {string}
   * @since 0.97.0
   */
  getIncorrectHighlightButtonLabel_fn = function(colorName, mode) {
    if (mode == "incorrect") {
      return `Show only transparent pixels that should be ${colorName || "this color"}.`;
    }
    if (mode == "missing") {
      return `Stop highlighting ${colorName || "this color"} pixels.`;
    }
    return `Highlight incorrect ${colorName || "this color"} pixels.`;
  };
  /** Updates color highlight buttons and color-card state.
   * @since 0.97.0
   */
  syncIncorrectHighlightButtons_fn = function() {
    const highlightedColorID = this.templateManager.getIncorrectHighlightColorID?.();
    const highlightedMode = this.templateManager.getIncorrectHighlightMode?.() ?? "incorrect";
    const buttons = document.querySelectorAll(`#${this.windowID} .bm-filter-color-highlight`);
    for (const button of buttons) {
      const colorElement = button.closest(".bm-filter-color");
      const colorID = Number(colorElement?.dataset["id"]);
      const isActive = Number.isFinite(colorID) && colorID == highlightedColorID;
      const colorName = colorElement?.dataset["name"] || "";
      const mode = isActive ? highlightedMode : "inactive";
      const label = __privateMethod(this, _WindowFilter_instances, getIncorrectHighlightButtonLabel_fn).call(this, colorName, mode);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      button.dataset["mode"] = mode;
      button.ariaLabel = label;
      button.title = label.replace(/\.$/, "");
      colorElement?.setAttribute("data-highlight", mode);
    }
  };
  /** Animates the eye slash only for direct visibility toggles.
   * @param {HTMLButtonElement} button - The color visibility button
   * @param {'hide' | 'show'} direction - Which slash animation to play
   * @since 0.95.0
   */
  animateColorToggleIcon_fn = function(button, direction) {
    if (!button) {
      return;
    }
    const previousAnimation = colorToggleAnimations.get(button);
    colorToggleAnimations.delete(button);
    previousAnimation?.cancel();
    const slash = button.querySelector(".bm-filter-eye-icon path:nth-of-type(3)");
    const finishAnimation = () => {
      if (direction == "show" && button.dataset["state"] == "shown") {
        button.innerHTML = this.eyeOpen;
      }
    };
    if (!slash || window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof slash.animate != "function") {
      finishAnimation();
      return;
    }
    const animation = slash.animate([
      { strokeDashoffset: direction == "hide" ? 20 : 0 },
      { strokeDashoffset: direction == "hide" ? 0 : 20 }
    ], {
      duration: 220,
      easing: direction == "hide" ? "ease-out" : "ease-in",
      fill: "forwards"
    });
    colorToggleAnimations.set(button, animation);
    void animation.finished.catch(() => {
    }).then(() => {
      if (colorToggleAnimations.get(button) != animation) {
        return;
      }
      colorToggleAnimations.delete(button);
      animation.cancel();
      finishAnimation();
    });
  };
  /** Makes a color block toggleable by pointer or keyboard.
   * @param {HTMLElement} colorElement - The color block element
   * @param {Object} color - Palette color metadata
   * @since 0.95.0
   */
  initializeColorBlockToggle_fn = function(colorElement, color) {
    if (!colorElement || !color.id) {
      return;
    }
    colorElement.classList.add("bm-filter-color-toggle");
    colorElement.tabIndex = 0;
    colorElement.setAttribute("role", "button");
    colorElement.onclick = (event) => {
      if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea")) {
        return;
      }
      const button = colorElement.querySelector(".bm-filter-color-visibility");
      __privateMethod(this, _WindowFilter_instances, toggleColorVisibility_fn).call(this, button, color);
    };
    colorElement.onkeydown = (event) => {
      if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea")) {
        return;
      }
      if (event.key != "Enter" && event.key != " ") {
        return;
      }
      event.preventDefault();
      colorElement.click();
    };
  };
  /** Calculates all pixel statistics used in the color filter.
   * @since 0.90.34
   */
  calculatePixelStatistics_fn = function() {
    this.tilesLoadedTotal = 0;
    this.tilesTotal = 0;
    this.allPixelsTotal = 0;
    this.allPixelsCorrectTotal = 0;
    this.allPixelsCorrect = /* @__PURE__ */ new Map();
    this.allPixelsColor = /* @__PURE__ */ new Map();
    const entriesOf = (value) => {
      if (value instanceof Map) {
        return value.entries();
      }
      if (Array.isArray(value)) {
        return value;
      }
      if (value && typeof value == "object") {
        return Object.entries(value);
      }
      return [];
    };
    const valuesOf = (value) => {
      if (value instanceof Map) {
        return value.values();
      }
      if (value && typeof value == "object") {
        return Object.values(value);
      }
      return [];
    };
    const sizeOf = (value) => value instanceof Map ? value.size : Object.keys(value ?? {}).length;
    const templates = Array.isArray(this.templateManager?.templatesArray) ? this.templateManager.templatesArray : [];
    for (const template of templates) {
      if (!template || typeof template != "object") {
        continue;
      }
      try {
        const pixelCount = template.pixelCount ?? template.pixels ?? {};
        this.allPixelsTotal += Number(pixelCount.total) || 0;
        for (const [colorID, colorPixels] of entriesOf(pixelCount.colors)) {
          const normalizedColorID = Number(colorID);
          if (!Number.isFinite(normalizedColorID)) {
            continue;
          }
          this.allPixelsColor.set(
            normalizedColorID,
            (this.allPixelsColor.get(normalizedColorID) ?? 0) + (Number(colorPixels) || 0)
          );
        }
        const correctObject = pixelCount.correct;
        this.tilesLoadedTotal += sizeOf(correctObject);
        this.tilesTotal += sizeOf(template.chunked ?? template.tiles);
        for (const colorMap of valuesOf(correctObject)) {
          for (const [colorID, correctPixels] of entriesOf(colorMap)) {
            const normalizedColorID = Number(colorID);
            if (!Number.isFinite(normalizedColorID)) {
              continue;
            }
            const normalizedCorrectPixels = Number(correctPixels) || 0;
            this.allPixelsCorrectTotal += normalizedCorrectPixels;
            this.allPixelsCorrect.set(
              normalizedColorID,
              (this.allPixelsCorrect.get(normalizedColorID) ?? 0) + normalizedCorrectPixels
            );
          }
        }
      } catch (error) {
        console.warn("Blue Marble: Skipping invalid template statistics.", error);
      }
    }
    console.log(`Tiles loaded: ${this.tilesLoadedTotal} / ${this.tilesTotal}`);
    const templateIsComplete = this.allPixelsCorrectTotal >= this.allPixelsTotal && !!this.allPixelsTotal && this.tilesLoadedTotal == this.tilesTotal;
    if (templateIsComplete && !this.templateWasComplete) {
      const confettiManager = new ConfettiManager();
      confettiManager.createConfetti(__privateMethod(this, _WindowFilter_instances, getOwnedWindowElement_fn).call(this));
    }
    this.templateWasComplete = templateIsComplete;
    const remainingPixels = Math.max(0, this.allPixelsTotal - this.allPixelsCorrectTotal);
    this.timeRemaining = new Date(Math.min(Date.now() + remainingPixels * 30 * 1e3, 864e13));
    this.timeRemainingLocalized = localizeCompactDate(this.timeRemaining);
  };

  // src/WindowMain.js
  var settingsIcon = '<svg class="bm-button-icon bm-button-icon-settings" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h14"/><circle cx="9" cy="7" r="1.7" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="11" cy="17" r="1.7" fill="currentColor" stroke="none"/></g></svg>';
  var _WindowMain_instances, coordinateInputPaste_fn;
  var WindowMain = class extends Overlay {
    /** Constructor for the main Blue Marble window
     * @param {string} name - The name of the userscript
     * @param {string} version - The version of the userscript
     * @since 0.88.326
     * @see {@link Overlay#constructor}
     */
    constructor(name2, version2) {
      super(name2, version2);
      __privateAdd(this, _WindowMain_instances);
      this.window = null;
      this.windowID = "bm-window-main";
      this.windowParent = document.body;
      this.windowFilter = null;
    }
    /** Creates the main Blue Marble window.
     * Parent/child relationships in the DOM structure below are indicated by indentation.
     * @since 0.58.3
     */
    buildWindow() {
      if (document.querySelector(`#${this.windowID}`)) {
        this.handleDisplayError("Main window already exists!");
        return;
      }
      this.window = this.addDiv({ "id": this.windowID, "class": "bm-window bm-windowed", "style": "top: 10px; left: unset; right: 75px;" }, (instance, div) => {
      }).addDragbar().addButton({ "class": "bm-button-circle", "innerHTML": minimizeIconExpanded, "aria-label": 'Minimize window "Chromora"', "data-button-status": "expanded" }, (instance, button) => {
        button.onclick = () => instance.handleMinimization(button);
      }).buildElement().addDiv({ "class": "bm-main-drag-brand" }).addHeader(1, { "class": "bm-dragbar-title-persistent", "textContent": this.name }).buildElement().buildElement().addDiv({ "class": "bm-flex-center" }).addButton({ "class": "bm-button-circle", "innerHTML": settingsIcon, "title": "Settings", "aria-label": "Open settings" }, (instance, button) => {
        button.onclick = () => {
          instance.settingsManager.buildWindow();
        };
      }).buildElement().buildElement().buildElement().addDiv({ "class": "bm-window-content" }).addHr({ "class": "bm-window-divider-top" }).buildElement().addDiv({ "class": "bm-container bm-main-stats" }).addDiv({ "class": "bm-main-stat-card bm-main-stat-card-value" }).addSpan({ "class": "bm-main-stat-label", "textContent": "Droplets" }).buildElement().addSpan({ "id": "bm-user-droplets", "class": "bm-main-stat-value", "textContent": "0" }).buildElement().buildElement().addDiv({ "class": "bm-main-stat-card bm-main-stat-card-value" }).addSpan({ "class": "bm-main-stat-label", "textContent": "Next Level" }).buildElement().addSpan({ "id": "bm-user-nextlevel", "class": "bm-main-stat-value", "textContent": "0 px" }).buildElement().buildElement().addDiv({ "class": "bm-main-stat-card bm-main-stat-card-timer" }).addSpan({ "class": "bm-main-stat-label", "textContent": "Charges" }).buildElement().addTimer(Date.now(), 1e3, { "class": "bm-main-stat-value", "style": "font-weight: 700;" }, (instance, timer) => {
        instance.apiManager.chargeRefillTimerID = timer.id;
      }).buildElement().buildElement().buildElement().addHr().buildElement().addDiv({ "class": "bm-container bm-main-shell" }).addDiv({ "class": "bm-container bm-main-coords" }).addButton(
        { "class": "bm-button-circle bm-button-pin", "style": "margin-top: 0;", "innerHTML": '<svg viewBox="0 0 4 6"><path d="M.5,3.4A2,2 0 1 1 3.5,3.4L2,6"/><circle cx="2" cy="2" r=".7" fill="#fff"/></svg>' },
        (instance, button) => {
          button.onclick = () => {
            const coords2 = instance.apiManager?.coordsTilePixel;
            if (!coords2?.[0]) {
              instance.handleDisplayError("Coordinates are malformed! Did you try clicking on the canvas first?");
              return;
            }
            instance.updateInnerHTML("bm-input-tx", coords2?.[0] || "");
            instance.updateInnerHTML("bm-input-ty", coords2?.[1] || "");
            instance.updateInnerHTML("bm-input-px", coords2?.[2] || "");
            instance.updateInnerHTML("bm-input-py", coords2?.[3] || "");
          };
        }
      ).buildElement().addInput({ "type": "number", "id": "bm-input-tx", "class": "bm-input-coords", "placeholder": "Tl X", "min": 0, "max": 2047, "step": 1, "required": true }, (instance, input) => {
        input.addEventListener("paste", (event) => __privateMethod(this, _WindowMain_instances, coordinateInputPaste_fn).call(this, instance, input, event));
      }).buildElement().addInput({ "type": "number", "id": "bm-input-ty", "class": "bm-input-coords", "placeholder": "Tl Y", "min": 0, "max": 2047, "step": 1, "required": true }, (instance, input) => {
        input.addEventListener("paste", (event) => __privateMethod(this, _WindowMain_instances, coordinateInputPaste_fn).call(this, instance, input, event));
      }).buildElement().addInput({ "type": "number", "id": "bm-input-px", "class": "bm-input-coords", "placeholder": "Px X", "min": 0, "max": 2047, "step": 1, "required": true }, (instance, input) => {
        input.addEventListener("paste", (event) => __privateMethod(this, _WindowMain_instances, coordinateInputPaste_fn).call(this, instance, input, event));
      }).buildElement().addInput({ "type": "number", "id": "bm-input-py", "class": "bm-input-coords", "placeholder": "Px Y", "min": 0, "max": 2047, "step": 1, "required": true }, (instance, input) => {
        input.addEventListener("paste", (event) => __privateMethod(this, _WindowMain_instances, coordinateInputPaste_fn).call(this, instance, input, event));
      }).buildElement().buildElement().addDiv({ "class": "bm-container bm-main-upload" }).addInputFile({ "class": "bm-input-file", "textContent": "Upload Template", "accept": "image/png, image/jpeg, image/webp, image/bmp, image/gif" }).buildElement().buildElement().addDiv({ "class": "bm-container bm-flex-between bm-main-actions" }).addButton({ "class": "bm-button-secondary", "textContent": "Disable", "data-button-status": "shown" }, (instance, button) => {
        button.onclick = () => {
          button.disabled = true;
          if (button.dataset["buttonStatus"] == "shown") {
            instance.apiManager?.templateManager?.setTemplatesShouldBeDrawn(false);
            button.dataset["buttonStatus"] = "hidden";
            button.textContent = "Enable";
            instance.handleDisplayStatus(`Disabled templates!`);
          } else {
            instance.apiManager?.templateManager?.setTemplatesShouldBeDrawn(true);
            button.dataset["buttonStatus"] = "shown";
            button.textContent = "Disable";
            instance.handleDisplayStatus(`Enabled templates!`);
          }
          button.disabled = false;
        };
      }).buildElement().addButton({ "class": "bm-button-primary", "textContent": "Create" }, (instance, button) => {
        button.onclick = async () => {
          const input = document.querySelector(`#${this.windowID} .bm-input-file`);
          const coordTlX = document.querySelector("#bm-input-tx");
          if (!coordTlX.checkValidity()) {
            coordTlX.reportValidity();
            instance.handleDisplayError("Coordinates are malformed! Did you try clicking on the canvas first?");
            return;
          }
          const coordTlY = document.querySelector("#bm-input-ty");
          if (!coordTlY.checkValidity()) {
            coordTlY.reportValidity();
            instance.handleDisplayError("Coordinates are malformed! Did you try clicking on the canvas first?");
            return;
          }
          const coordPxX = document.querySelector("#bm-input-px");
          if (!coordPxX.checkValidity()) {
            coordPxX.reportValidity();
            instance.handleDisplayError("Coordinates are malformed! Did you try clicking on the canvas first?");
            return;
          }
          const coordPxY = document.querySelector("#bm-input-py");
          if (!coordPxY.checkValidity()) {
            coordPxY.reportValidity();
            instance.handleDisplayError("Coordinates are malformed! Did you try clicking on the canvas first?");
            return;
          }
          if (!input?.files[0]) {
            instance.handleDisplayError(`No file selected!`);
            return;
          }
          button.disabled = true;
          try {
            await instance?.apiManager?.templateManager.createTemplate(input.files[0], input.files[0]?.name.replace(/\.[^/.]+$/, ""), [Number(coordTlX.value), Number(coordTlY.value), Number(coordPxX.value), Number(coordPxY.value)]);
            instance.handleDisplayStatus(`Drew to canvas!`);
          } catch (error) {
            console.error("Blue Marble: Template creation failed.", error);
            instance.handleDisplayError(`Template creation failed: ${error instanceof Error ? error.message : String(error)}`);
          } finally {
            button.disabled = false;
          }
        };
      }).buildElement().addButton({ "class": "bm-button-secondary", "textContent": "Filter" }, (instance, button) => {
        button.onclick = () => this.buildWindowFilter();
      }).buildElement().buildElement().addDiv({ "class": "bm-container bm-main-status" }).addTextarea({ "id": this.outputStatusId, "placeholder": `Status: Sleeping...
Version: ${this.version}`, "readOnly": true }).buildElement().buildElement().buildElement().buildElement().buildElement().buildOverlay(this.windowParent);
      this.handleDrag(`#${this.windowID}.bm-window`, `#${this.windowID} .bm-dragbar`);
    }
    /** Displays a new color filter window.
     * This is a helper function that creates a new class instance.
     * This might cause a memory leak. I pray that this is not the case...
     * @since 0.88.330
     */
    buildWindowFilter({ respectSavedVisibility = false } = {}) {
      if (!this.windowFilter || this.windowFilter.templateManager != this.apiManager?.templateManager) {
        this.windowFilter?.dispose();
        this.windowFilter = new WindowFilter(this);
      }
      const windowFilter = this.windowFilter;
      if (respectSavedVisibility && !windowFilter.shouldAutoOpen()) {
        return;
      }
      windowFilter.buildPreferredWindow();
    }
  };
  _WindowMain_instances = new WeakSet();
  coordinateInputPaste_fn = async function(instance, input, event) {
    event.preventDefault();
    const data = await getClipboardData(event);
    const coords2 = data.split(/[^a-zA-Z0-9]+/).filter((index) => index).map(Number).filter(
      (number) => !isNaN(number)
      // Removes NaN `[4]`
    );
    if (coords2.length == 2 && input.id == "bm-input-px") {
      instance.updateInnerHTML("bm-input-px", coords2?.[0] || "");
      instance.updateInnerHTML("bm-input-py", coords2?.[1] || "");
    } else if (coords2.length == 1) {
      instance.updateInnerHTML(input.id, coords2?.[0] || "");
    } else {
      instance.updateInnerHTML("bm-input-tx", coords2?.[0] || "");
      instance.updateInnerHTML("bm-input-ty", coords2?.[1] || "");
      instance.updateInnerHTML("bm-input-px", coords2?.[2] || "");
      instance.updateInnerHTML("bm-input-py", coords2?.[3] || "");
    }
  };

  // src/WindowWizard.js
  var _WindowWizard_instances, displaySchemaHealth_fn, displayTemplateList_fn, convertSchema_1_x_x_To_2_x_x_fn;
  var _WindowWizard = class _WindowWizard extends Overlay {
    /** Constructor for the Template Wizard window
     * @param {string} name - The name of the userscript
     * @param {string} version - The version of the userscript
     * @param {string} schemaVersionBleedingEdge - The bleeding edge of schema versions for Blue Marble
     * @param {TemplateManager} [templateManager=undefined] - (Optional) The TemplateManager class instance
     * @since 0.88.434
     * @see {@link Overlay#constructor} for examples
     */
    constructor(name2, version2, schemaVersionBleedingEdge, templateManager = void 0) {
      super(name2, version2);
      __privateAdd(this, _WindowWizard_instances);
      this.window = null;
      this.windowID = "bm-window-wizard";
      this.windowParent = document.body;
      this.currentJSON = JSON.parse(GM_getValue("bmTemplates", "{}"));
      this.scriptVersion = this.currentJSON?.scriptVersion;
      this.schemaVersion = this.currentJSON?.schemaVersion;
      this.schemaHealth = void 0;
      this.schemaVersionBleedingEdge = schemaVersionBleedingEdge;
      this.templateManager = templateManager;
    }
    /** Spawns a Template Wizard window.
     * If another template wizard window already exists, we DON'T spawn another!
     * Parent/child relationships in the DOM structure below are indicated by indentation.
     * @since 0.88.434
     */
    buildWindow() {
      if (document.querySelector(`#${this.windowID}`)) {
        void this.handleWindowClose(document.querySelector(`#${this.windowID}`));
        return;
      }
      let style = "";
      if (!document.querySelector(`#bm-window-main`)) {
        style = style.concat("z-index: 9001;").trim();
      }
      this.window = this.addDiv({ "id": this.windowID, "class": "bm-window", "style": style }, (instance, div) => {
      }).addDragbar().addButton({ "class": "bm-button-circle", "innerHTML": minimizeIconExpanded, "aria-label": 'Minimize window "Template Wizard"', "data-button-status": "expanded" }, (instance, button) => {
        button.onclick = () => instance.handleMinimization(button);
      }).buildElement().addDiv().buildElement().addButton({ "class": "bm-button-circle", "textContent": "\u2716", "aria-label": 'Close window "Template Wizard"' }, (instance, button) => {
        button.onclick = () => this.handleWindowClose(document.querySelector(`#${this.windowID}`));
      }).buildElement().buildElement().addDiv({ "class": "bm-window-content" }).addDiv({ "class": "bm-container bm-center-vertically" }).addHeader(1, { "textContent": "Template Wizard" }).buildElement().buildElement().addHr().buildElement().addDiv({ "class": "bm-container" }).addHeader(2, { "textContent": "Status" }).buildElement().addP({ "id": "bm-wizard-status", "textContent": "Loading template storage status..." }).buildElement().buildElement().addDiv({ "class": "bm-container bm-scrollable" }).addHeader(2, { "textContent": "Detected templates:" }).buildElement().buildElement().buildElement().buildElement().buildOverlay(this.windowParent);
      this.handleDrag(`#${this.windowID}.bm-window`, `#${this.windowID} .bm-dragbar`);
      __privateMethod(this, _WindowWizard_instances, displaySchemaHealth_fn).call(this);
      __privateMethod(this, _WindowWizard_instances, displayTemplateList_fn).call(this);
    }
  };
  _WindowWizard_instances = new WeakSet();
  /** Determines how "healthy" the template storage is.
   * @since 0.88.436
   */
  displaySchemaHealth_fn = function() {
    const schemaVersionArray = this.schemaVersion.split(/[-\.\+]/);
    const schemaVersionBleedingEdgeArray = this.schemaVersionBleedingEdge.split(/[-\.\+]/);
    let schemaHealthBanner = "";
    if (schemaVersionArray[0] == schemaVersionBleedingEdgeArray[0]) {
      if (schemaVersionArray[1] == schemaVersionBleedingEdgeArray[1]) {
        schemaHealthBanner = 'Template storage health: <b style="color:#0f0;">Healthy!</b><br>No futher action required. (Reason: Semantic version matches)';
        this.schemaHealth = "Good";
      } else {
        schemaHealthBanner = `Template storage health: <b style="color:#ff0;">Poor!</b><br>You can still use your template, but some features may not work. Update ${escapeHTML(this.name)}'s template storage. (Reason: MINOR version mismatch)`;
        this.schemaHealth = "Poor";
      }
    } else if (schemaVersionArray[0] < schemaVersionBleedingEdgeArray[0]) {
      schemaHealthBanner = `Template storage health: <b style="color:#f00;">Bad!</b><br>Some features are broken. Download all templates and update ${escapeHTML(this.name)}'s template storage before continuing. (Reason: MAJOR version mismatch)`;
      this.schemaHealth = "Bad";
    } else {
      schemaHealthBanner = `Template storage health: <b style="color:#f00">Dead!</b><br>${escapeHTML(this.name)} cannot load the template storage. (Reason: MAJOR version unknown)`;
      this.schemaHealth = "Dead";
    }
    const recoveryInstructions = `<hr style="margin:.5ch">To keep using the current templates, update the template storage schema.<br>Otherwise, downgrade ${escapeHTML(this.name)} to version <b>${escapeHTML(this.scriptVersion)}</b>.<br>You can also rebuild storage by uploading a new template.`;
    const wplaceUpdateTime = getWplaceVersion();
    let wplaceUpdateTimeLocalized = wplaceUpdateTime ? localizeDate(wplaceUpdateTime) : "???";
    this.updateInnerHTML("#bm-wizard-status", `${schemaHealthBanner}<br>Your templates were created with script version <b>${escapeHTML(this.scriptVersion)}</b> and schema version <b>${escapeHTML(this.schemaVersion)}</b>.<br>The current ${escapeHTML(this.name)} version is <b>${escapeHTML(this.version)}</b> and requires schema version <b>${escapeHTML(this.schemaVersionBleedingEdge)}</b>.<br>Wplace was last updated on <b>${wplaceUpdateTimeLocalized}</b>.${this.schemaHealth != "Good" ? recoveryInstructions : ""}`);
    const buttonOptions = new Overlay(this.name, this.version);
    if (this.schemaHealth != "Dead") {
      buttonOptions.addDiv({ "class": "bm-container bm-flex-center bm-center-vertically", "style": "gap: 1.5ch;" });
      buttonOptions.addButton({ "textContent": "Download all templates" }, (instance, button) => {
        button.onclick = () => {
          button.disabled = true;
          this.templateManager.downloadAllTemplatesFromStorage().then(() => {
            button.disabled = false;
          });
        };
      }).buildElement();
    }
    if (this.schemaHealth == "Poor" || this.schemaHealth == "Bad") {
      buttonOptions.addButton({ "textContent": `Update template storage to ${this.schemaVersionBleedingEdge}` }, (instance, button) => {
        button.onclick = () => {
          button.disabled = true;
          __privateMethod(this, _WindowWizard_instances, convertSchema_1_x_x_To_2_x_x_fn).call(this, true);
        };
      }).buildElement();
    }
    buttonOptions.buildElement().buildOverlay(document.querySelector("#bm-wizard-status").parentNode);
  };
  /** Displays loaded templates to the user.
   * @since 0.88.441
   */
  displayTemplateList_fn = function() {
    const templates = this.currentJSON?.templates;
    if (Object.keys(templates).length > 0) {
      const templateListParentElement = document.querySelector(`#${this.windowID} .bm-scrollable`);
      const templateList = new Overlay(this.name, this.version);
      templateList.addDiv({ "id": "bm-wizard-tlist", "class": "bm-container" });
      for (const template in templates) {
        const templateKey = template;
        const templateValue = templates[template];
        if (templates.hasOwnProperty(template)) {
          const templateKeyArray = templateKey.split(" ");
          const sortID = Number(templateKeyArray?.[0]);
          const authorID = encodedToNumber(templateKeyArray?.[1] || "0", this.templateManager.encodingBase);
          const displayName = templateValue.name || `Template ${sortID || ""}`;
          const coords2 = templateValue?.coords?.split(",").map(Number);
          const totalPixelCount = templateValue.pixels?.total ?? void 0;
          const templateImage = void 0;
          const sortIDLocalized = typeof sortID == "number" ? localizeNumber(sortID) : "???";
          const authorIDLocalized = typeof authorID == "number" ? localizeNumber(authorID) : "???";
          const totalPixelCountLocalized = typeof totalPixelCount == "number" ? localizeNumber(totalPixelCount) : "???";
          templateList.addDiv({ "class": "bm-container bm-flex-center" }).addDiv({ "class": "bm-flex-center", "style": "flex-direction: column; gap: 0;" }).addDiv({ "class": "bm-wizard-template-container-image", "textContent": templateImage || "\u{1F5BC}\uFE0F" }).buildElement().addSmall({ "textContent": `#${sortIDLocalized}` }).buildElement().buildElement().addDiv({ "class": "bm-flex-center bm-wizard-template-container-flavor" }).addHeader(3, { "textContent": displayName }).buildElement().addSpan({ "textContent": `Uploaded by user #${authorIDLocalized}` }).buildElement().addSpan({ "textContent": `Coordinates: ${coords2.join(", ")}` }).buildElement().addSpan({ "textContent": `Total Pixels: ${totalPixelCountLocalized}` }).buildElement().buildElement().buildElement();
        }
      }
      templateList.buildElement().buildOverlay(templateListParentElement);
    }
  };
  convertSchema_1_x_x_To_2_x_x_fn = async function(shouldWindowWizardOpen) {
    if (shouldWindowWizardOpen) {
      const windowContent = document.querySelector(`#${this.windowID} .bm-window-content`);
      windowContent.innerHTML = "";
      const loadingScreen = new Overlay(this.name, this.version);
      loadingScreen.addDiv({ "class": "bm-container" }).addDiv({ "class": "bm-container bm-center-vertically" }).addHeader(1, { "textContent": "Template Wizard" }).buildElement().buildElement().addHr().buildElement().addDiv({ "class": "bm-container" }).addHeader(2, { "textContent": "Status" }).buildElement().addP({ "textContent": "Updating template storage. Please wait..." }).buildElement().buildElement().buildElement().buildOverlay(windowContent);
    }
    GM_deleteValue("bmCoords");
    const templates = this.currentJSON?.templates;
    if (Object.keys(templates).length > 0) {
      for (const [key, template] of Object.entries(templates)) {
        if (templates.hasOwnProperty(key)) {
          const _template = new Template({
            displayName: template.name,
            chunked: template.tiles
          });
          _template.calculateCoordsFromChunked();
          const blob = await this.templateManager.convertTemplateToBlob(_template);
          await this.templateManager.createTemplate(blob, _template.displayName, _template.coords);
        }
      }
    }
    if (shouldWindowWizardOpen) {
      console.log(`Restarting Template Wizard...`);
      await this.handleWindowClose(document.querySelector(`#${this.windowID}`));
      new _WindowWizard(this.name, this.version, this.schemaVersionBleedingEdge, this.templateManager).buildWindow();
    }
  };
  var WindowWizard = _WindowWizard;

  // src/templateManager.js
  var _TemplateManager_instances, emitTemplatesChanged_fn, processPaintAreaSelection_fn, restoreFilteredColorsFromSettings_fn, persistFilteredColors_fn, loadTemplate_fn, storeTemplates_fn, parseBlueMarble_fn, parseOSU_fn, calculateCorrectPixelsOnTile_And_FilterTile_fn, yieldToBrowser_fn, buildMissingHighlightClusters_fn, drawMissingHighlightCluster_fn, getIncorrectHighlightStencil_fn, drawIncorrectHighlightMarker_fn;
  var TemplateManager = class {
    /** The constructor for the {@link TemplateManager} class.
     * @param {string} name - The name of the userscript
     * @param {string} version - The version of the userscript (SemVer as string)
     * @since 0.55.8
     */
    constructor(name2, version2) {
      __privateAdd(this, _TemplateManager_instances);
      this.name = name2;
      this.version = version2;
      this.windowMain = null;
      this.settingsManager = null;
      this.schemaVersion = "2.0.0";
      this.userID = null;
      this.encodingBase = "!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~";
      this.tileSize = 1e3;
      this.drawMult = 3;
      this.paletteTolerance = 3;
      this.paletteBM = colorpaletteForBlueMarble(this.paletteTolerance);
      this.template = null;
      this.templateState = "";
      this.templatesArray = [];
      this.templatesJSON = null;
      this.templatesShouldBeDrawn = true;
      this.templatePixelsCorrect = null;
      this.shouldFilterColor = /* @__PURE__ */ new Map();
      this.highlightIncorrectColorID = null;
      this.highlightIncorrectMode = "incorrect";
      this.incorrectHighlightStencilCache = /* @__PURE__ */ new Map();
      this.canvasRefreshRevision = 0;
      this.templateStatisticsState = "idle";
      this.templateChangeListeners = /* @__PURE__ */ new Set();
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
      __privateMethod(this, _TemplateManager_instances, restoreFilteredColorsFromSettings_fn).call(this);
    }
    /** Subscribes to template readiness changes.
     * @param {function({reason: string, state: string}):void} listener
     * @returns {function():void} Unsubscribe callback
     * @since 0.99.0
     */
    onTemplatesChanged(listener) {
      if (typeof listener != "function") {
        return () => {
        };
      }
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
    /** Starts the bridge that turns a user-selected map rectangle into Wplace draft pixels.
     * @returns {function():void} Cleanup callback
     * @since 0.99.0
     */
    startPaintAreaSelectionBridge() {
      if (this.paintAreaMessageHandler) {
        return () => this.stopPaintAreaSelectionBridge();
      }
      this.paintAreaMessageHandler = (event) => {
        const data = event.data;
        if (data?.source != "blue-marble" || data?.action != "paint-area-selected") {
          return;
        }
        this.paintAreaAbortController?.abort();
        const abortController = new AbortController();
        this.paintAreaAbortController = abortController;
        void __privateMethod(this, _TemplateManager_instances, processPaintAreaSelection_fn).call(this, data, abortController.signal);
      };
      window.addEventListener("message", this.paintAreaMessageHandler);
      return () => this.stopPaintAreaSelectionBridge();
    }
    /** Stops area-selection work and removes its message listener.
     * @since 0.99.0
     */
    stopPaintAreaSelectionBridge() {
      this.paintAreaAbortController?.abort();
      this.paintAreaAbortController = null;
      if (!this.paintAreaMessageHandler) {
        return;
      }
      window.removeEventListener("message", this.paintAreaMessageHandler);
      this.paintAreaMessageHandler = null;
    }
    /** Finds template pixels of one palette color inside inclusive world-pixel bounds.
     * Results are compact horizontal runs: [worldY, worldXStart, worldXEnd].
     * @param {{minX:number, minY:number, maxX:number, maxY:number}} bounds
     * @param {number} colorID
     * @param {{maxPixels?:number, signal?:AbortSignal}} options
     * @returns {Promise<{runs:Array<[number, number, number]>, pixelCount:number}>}
     * @since 0.99.0
     */
    async findTemplatePixelRuns(bounds, colorID, { maxPixels = 1e5, signal } = {}) {
      const normalizedColorID = Number(colorID);
      if (!Number.isInteger(normalizedColorID) || normalizedColorID <= 0) {
        throw new TypeError("Select a non-transparent Wplace color first.");
      }
      const normalizedBounds = {
        minX: Math.floor(Math.min(Number(bounds?.minX), Number(bounds?.maxX))),
        minY: Math.floor(Math.min(Number(bounds?.minY), Number(bounds?.maxY))),
        maxX: Math.floor(Math.max(Number(bounds?.minX), Number(bounds?.maxX))),
        maxY: Math.floor(Math.max(Number(bounds?.minY), Number(bounds?.maxY)))
      };
      if (!Object.values(normalizedBounds).every(Number.isFinite)) {
        throw new TypeError("Selected map area has invalid coordinates.");
      }
      const pixelLimit = Math.max(1, Math.min(Math.floor(Number(maxPixels) || 1), 100001));
      const runs = [];
      let pixelCount = 0;
      let workSliceStarted = performance.now();
      const chunkEntries = (value) => value instanceof Map ? value.entries() : Object.entries(value ?? {});
      const centerOffset = Math.floor(this.drawMult / 2);
      for (const template of this.templatesArray) {
        for (const [chunkKey, pixelBuffer] of chunkEntries(template?.chunked32)) {
          if (signal?.aborted) {
            throw new DOMException("Area selection cancelled.", "AbortError");
          }
          if (!(pixelBuffer instanceof Uint32Array)) {
            continue;
          }
          const [tileX, tileY, pixelX, pixelY] = String(chunkKey).split(",").map(Number);
          if (![tileX, tileY, pixelX, pixelY].every(Number.isFinite)) {
            continue;
          }
          const bitmap = template?.chunked instanceof Map ? template.chunked.get(chunkKey) : template?.chunked?.[chunkKey];
          const bitmapWidth = Number(bitmap?.width);
          const bitmapHeight = Number(bitmap?.height);
          if (!Number.isFinite(bitmapWidth) || !Number.isFinite(bitmapHeight) || !bitmapWidth || !bitmapHeight) {
            continue;
          }
          const chunkWidth = Math.floor(bitmapWidth / this.drawMult);
          const chunkHeight = Math.floor(bitmapHeight / this.drawMult);
          const pixelState = template?.pixelStateByChunk?.get(chunkKey);
          if (!(pixelState instanceof Uint8Array) || pixelState.length != chunkWidth * chunkHeight) {
            continue;
          }
          const chunkMinX = tileX * this.tileSize + pixelX;
          const chunkMinY = tileY * this.tileSize + pixelY;
          const localMinX = Math.max(0, normalizedBounds.minX - chunkMinX);
          const localMinY = Math.max(0, normalizedBounds.minY - chunkMinY);
          const localMaxX = Math.min(chunkWidth - 1, normalizedBounds.maxX - chunkMinX);
          const localMaxY = Math.min(chunkHeight - 1, normalizedBounds.maxY - chunkMinY);
          if (localMinX > localMaxX || localMinY > localMaxY) {
            continue;
          }
          for (let localY = localMinY; localY <= localMaxY; localY++) {
            let runStart = null;
            for (let localX = localMinX; localX <= localMaxX; localX++) {
              const bufferX = localX * this.drawMult + centerOffset;
              const bufferY = localY * this.drawMult + centerOffset;
              const packedColor = pixelBuffer[bufferY * bitmapWidth + bufferX];
              const matchesColor = this.paletteBM.LUT.get(packedColor) == normalizedColorID && pixelState[localY * chunkWidth + localX] == 2;
              if (matchesColor && runStart == null) {
                runStart = localX;
              }
              const closesRun = runStart != null && (!matchesColor || localX == localMaxX);
              if (!closesRun) {
                continue;
              }
              const localRunEnd = matchesColor && localX == localMaxX ? localX : localX - 1;
              const remaining = pixelLimit - pixelCount;
              const runEnd = Math.min(localRunEnd, runStart + remaining - 1);
              runs.push([chunkMinY + localY, chunkMinX + runStart, chunkMinX + runEnd]);
              pixelCount += runEnd - runStart + 1;
              runStart = null;
              if (pixelCount >= pixelLimit) {
                return { runs, pixelCount };
              }
            }
            if (performance.now() - workSliceStarted >= 4) {
              await __privateMethod(this, _TemplateManager_instances, yieldToBrowser_fn).call(this);
              workSliceStarted = performance.now();
            }
          }
        }
      }
      return { runs, pixelCount };
    }
    /** Updates whether a palette color should be hidden on the canvas.
     * @param {number} colorID
     * @param {boolean} shouldHide
     * @since 0.92.1
     */
    setColorFiltered(colorID, shouldHide) {
      const parsedColorID = Number(colorID);
      if (!Number.isFinite(parsedColorID)) {
        return;
      }
      if (shouldHide) {
        this.shouldFilterColor.set(parsedColorID, true);
      } else {
        this.shouldFilterColor.delete(parsedColorID);
      }
      __privateMethod(this, _TemplateManager_instances, persistFilteredColors_fn).call(this);
    }
    /** Updates many palette filters with one storage write.
     * @param {Iterable<number>} colorIDs
     * @param {boolean} shouldHide
     * @since 0.99.0
     */
    setColorsFiltered(colorIDs, shouldHide) {
      for (const colorID of colorIDs) {
        const parsedColorID = Number(colorID);
        if (!Number.isFinite(parsedColorID)) {
          continue;
        }
        if (shouldHide) {
          this.shouldFilterColor.set(parsedColorID, true);
        } else {
          this.shouldFilterColor.delete(parsedColorID);
        }
      }
      __privateMethod(this, _TemplateManager_instances, persistFilteredColors_fn).call(this);
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
    setIncorrectHighlightColor(colorID, mode = "incorrect") {
      if (colorID === null || typeof colorID == "undefined") {
        this.highlightIncorrectColorID = null;
        this.highlightIncorrectMode = "incorrect";
        return this.highlightIncorrectColorID;
      }
      const parsedColorID = Number(colorID);
      if (!Number.isFinite(parsedColorID) || parsedColorID == 0) {
        return this.highlightIncorrectColorID;
      }
      this.highlightIncorrectColorID = parsedColorID;
      this.highlightIncorrectMode = mode == "missing" ? "missing" : "incorrect";
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
      if (!Number.isFinite(parsedColorID) || parsedColorID == 0) {
        return { colorID: this.highlightIncorrectColorID, mode: this.highlightIncorrectMode };
      }
      if (this.highlightIncorrectColorID != parsedColorID) {
        this.setIncorrectHighlightColor(parsedColorID, "incorrect");
      } else if (this.highlightIncorrectMode == "incorrect") {
        this.setIncorrectHighlightColor(parsedColorID, "missing");
      } else {
        this.setIncorrectHighlightColor(null);
      }
      return { colorID: this.highlightIncorrectColorID, mode: this.highlightIncorrectMode };
    }
    /** Invalidates visible map tiles and resolves after refreshed tile rendering settles.
     * @returns {Promise<void>}
     * @since 0.98.0
     */
    requestCanvasRefresh() {
      this.canvasRefreshRevision = this.canvasRefreshRevision + 1 >>> 0;
      const revision = this.canvasRefreshRevision;
      return new Promise((resolve) => {
        let started = 0;
        let completed = 0;
        let settleTimer = null;
        let noWorkTimer = null;
        let hardTimeout = null;
        const finish = () => {
          clearTimeout(settleTimer);
          clearTimeout(noWorkTimer);
          clearTimeout(hardTimeout);
          window.removeEventListener("message", handleProgress);
          resolve();
        };
        const scheduleSettle = () => {
          if (!started || completed < started) {
            return;
          }
          clearTimeout(settleTimer);
          settleTimer = setTimeout(finish, 180);
        };
        const handleProgress = (event) => {
          const data = event.data;
          if (data?.source != "blue-marble" || data?.action != "refresh-progress" || Number(data?.revision) != revision) {
            return;
          }
          if (data.state == "started") {
            started++;
            clearTimeout(noWorkTimer);
            clearTimeout(settleTimer);
          } else if (data.state == "completed") {
            completed++;
            scheduleSettle();
          }
        };
        window.addEventListener("message", handleProgress);
        noWorkTimer = setTimeout(finish, 1200);
        hardTimeout = setTimeout(finish, 1e4);
        window.postMessage({
          source: "blue-marble",
          action: "refresh-tiles",
          revision
        }, "*");
      });
    }
    /** Creates the JSON object to store templates in
     * @returns {{ whoami: string, scriptVersion: string, schemaVersion: string, templates: Object }} The JSON object
     * @since 0.65.4
     */
    async createJSON() {
      return {
        "whoami": this.name.replace(" ", ""),
        // Name of userscript without spaces
        "scriptVersion": this.version,
        // Version of userscript
        "schemaVersion": this.schemaVersion,
        // Version of JSON schema
        "templates": {}
        // The templates
      };
    }
    /** Creates the template from the inputed file blob
     * @param {File} blob - The file blob to create a template from
     * @param {string} name - The display name of the template
     * @param {Array<number, number, number, number>} coords - The coordinates of the top left corner of the template
     * @since 0.65.77
     */
    async createTemplate(blob, name2, coords2) {
      this.templateStatisticsState = "loading";
      __privateMethod(this, _TemplateManager_instances, emitTemplatesChanged_fn).call(this, "create-started");
      try {
        const hasWritableTemplateStore = ["BlueMarble", "Chromora"].includes(this.templatesJSON?.whoami) && this.templatesJSON?.schemaVersion == this.schemaVersion && this.templatesJSON?.templates && typeof this.templatesJSON.templates == "object" && !Array.isArray(this.templatesJSON.templates);
        if (!hasWritableTemplateStore) {
          this.templatesJSON = await this.createJSON();
          console.log(`Creating JSON...`);
        }
        this.windowMain.handleDisplayStatus(`Creating template at ${coords2.join(", ")}...`);
        const template = new Template({
          displayName: name2,
          sortID: 0,
          // Object.keys(this.templatesJSON.templates).length || 0, // Uncomment this to enable multiple templates (1/2)
          authorID: numberToEncoded(this.userID || 0, this.encodingBase),
          file: blob,
          coords: coords2
        });
        const shouldSkipTransTiles = !this.settingsManager?.userSettings?.flags?.includes("hl-noSkip");
        const shouldAggSkipTransTiles = this.settingsManager?.userSettings?.flags?.includes("hl-agSkip");
        console.log(`Should Skip: ${shouldSkipTransTiles}; Should Agg Skip: ${shouldAggSkipTransTiles}`);
        const { templateTiles, templateTilesBuffers } = await template.createTemplateTiles(this.tileSize, this.paletteBM, shouldSkipTransTiles, shouldAggSkipTransTiles);
        template.chunked = templateTiles;
        const _pixels = { "total": template.pixelCount.total, "colors": Object.fromEntries(template.pixelCount.colors) };
        this.templatesJSON.templates[`${template.sortID} ${template.authorID}`] = {
          "name": template.displayName,
          // Display name of template
          "coords": coords2.join(", "),
          // The coords of the template
          "enabled": true,
          "pixels": _pixels,
          // The total pixels in the template
          "tiles": templateTilesBuffers
          // Stores the chunked tile buffers
        };
        this.templatesArray = [];
        this.templatesArray.push(template);
        this.windowMain.handleDisplayStatus(`Template created at ${coords2.join(", ")}!`);
        console.log(Object.keys(this.templatesJSON.templates).length);
        console.log(this.templatesJSON);
        console.log(this.templatesArray);
        console.log(JSON.stringify(this.templatesJSON));
        await __privateMethod(this, _TemplateManager_instances, storeTemplates_fn).call(this);
        this.templateStatisticsState = "ready";
        __privateMethod(this, _TemplateManager_instances, emitTemplatesChanged_fn).call(this, "created");
        return template;
      } catch (error) {
        this.templateStatisticsState = "error";
        __privateMethod(this, _TemplateManager_instances, emitTemplatesChanged_fn).call(this, "create-failed");
        throw error;
      }
    }
    /** Deletes a template from the JSON object.
     * Also delete's the corrosponding {@link Template} class instance
     */
    deleteTemplate() {
    }
    /** Disables the template from view
     */
    async disableTemplate() {
      if (!this.templatesJSON) {
        this.templatesJSON = await this.createJSON();
        console.log(`Creating JSON...`);
      }
    }
    /** Downloads all templates loaded.
     * @since 0.88.499
     */
    async downloadAllTemplates() {
      consoleLog(`Downloading all templates...`);
      console.log(this.templatesArray);
      for (const template of this.templatesArray) {
        await this.downloadTemplate(template);
        await sleep(500);
      }
    }
    /** Downloads all templates from Blue Marble's template storage.
     * @since 0.88.474
     */
    async downloadAllTemplatesFromStorage() {
      const templates = JSON.parse(GM_getValue("bmTemplates", "{}"))?.templates;
      console.log(templates);
      if (Object.keys(templates).length > 0) {
        for (const [key, template] of Object.entries(templates)) {
          if (templates.hasOwnProperty(key)) {
            await this.downloadTemplate(new Template({
              displayName: template.name,
              sortID: key.split(" ")?.[0],
              authorID: key.split(" ")?.[1],
              chunked: template.tiles
            }));
            await sleep(500);
          }
        }
      }
    }
    /** Downloads the template passed-in.
     * @param {Template} template - The template class instance to download
     * @since 0.88.499
     */
    async downloadTemplate(template) {
      template.calculateCoordsFromChunked();
      const templateFileName = `${template.coords.join("-")}_${template.displayName.replaceAll(" ", "-")}`;
      const blob = await this.convertTemplateToBlob(template);
      await GM.download({
        url: URL.createObjectURL(blob),
        name: templateFileName + ".png",
        conflictAction: "uniquify",
        onload: () => {
          consoleLog(`Download of template '${templateFileName}' complete!`);
        },
        onerror: (error, details) => {
          consoleError(`Download of template '${templateFileName}' failed because ${error}! Details: ${details}`);
        },
        ontimeout: () => {
          consoleWarn(`Download of template '${templateFileName}' has timed out!`);
        }
      });
    }
    /** Converts a Template class instance into a Blob. 
     * Specifically, this takes `Template.chunked` and converts it to a Blob.
     * @since 0.88.504
     * @returns {Promise<Blob>} A Promise of a Blob PNG image of the template
     */
    async convertTemplateToBlob(template) {
      console.log(template);
      const templateTiles64 = template.chunked;
      const templateTileKeysSorted = Object.keys(templateTiles64).sort();
      const templateTilesImageSorted = await Promise.all(templateTileKeysSorted.map((tileKey) => convertBase64ToImage(templateTiles64[tileKey])));
      let absoluteSmallestX = Infinity;
      let absoluteSmallestY = Infinity;
      let absoluteLargestX = 0;
      let absoluteLargestY = 0;
      templateTileKeysSorted.forEach((key, index) => {
        const [tileX, tileY, pixelX, pixelY] = key.split(",").map(Number);
        const tileImage = templateTilesImageSorted[index];
        const absoluteX = tileX * this.tileSize + pixelX;
        const absoluteY = tileY * this.tileSize + pixelY;
        absoluteSmallestX = Math.min(absoluteSmallestX, absoluteX);
        absoluteSmallestY = Math.min(absoluteSmallestY, absoluteY);
        absoluteLargestX = Math.max(absoluteLargestX, absoluteX + tileImage.width / this.drawMult);
        absoluteLargestY = Math.max(absoluteLargestY, absoluteY + tileImage.height / this.drawMult);
      });
      console.log(`Absolute coordinates: (${absoluteSmallestX}, ${absoluteSmallestY}) and (${absoluteLargestX}, ${absoluteLargestY})`);
      const templateWidth = absoluteLargestX - absoluteSmallestX;
      const templateHeight = absoluteLargestY - absoluteSmallestY;
      const canvasWidth = templateWidth * this.drawMult;
      const canvasHeight = templateHeight * this.drawMult;
      console.log(`Template Width: ${templateWidth}
Template Height: ${templateHeight}
Canvas Width: ${canvasWidth}
Canvas Height: ${canvasHeight}`);
      const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
      const context = canvas.getContext("2d");
      templateTileKeysSorted.forEach((key, index) => {
        const [tileX, tileY, pixelX, pixelY] = key.split(",").map(Number);
        const tileImage = templateTilesImageSorted[index];
        const absoluteX = tileX * this.tileSize + pixelX;
        const absoluteY = tileY * this.tileSize + pixelY;
        console.log(`Drawing tile (${tileX}, ${tileY}, ${pixelX}, ${pixelY}) (${absoluteX}, ${absoluteY}) at (${absoluteX - absoluteSmallestX}, ${absoluteY - absoluteSmallestY}) on the canvas...`);
        context.drawImage(tileImage, (absoluteX - absoluteSmallestX) * this.drawMult, (absoluteY - absoluteSmallestY) * this.drawMult, tileImage.width, tileImage.height);
      });
      context.globalCompositeOperation = "destination-over";
      context.drawImage(canvas, 0, -1);
      context.drawImage(canvas, 0, 1);
      context.drawImage(canvas, -1, 0);
      context.drawImage(canvas, 1, 0);
      const smallCanvas = new OffscreenCanvas(templateWidth, templateHeight);
      const smallContext = smallCanvas.getContext("2d");
      smallContext.imageSmoothingEnabled = false;
      smallContext.drawImage(
        canvas,
        0,
        0,
        templateWidth * this.drawMult,
        templateHeight * this.drawMult,
        // Source image size
        0,
        0,
        templateWidth,
        templateHeight
        // Small canvas size
      );
      return smallCanvas.convertToBlob({ type: "image/png" });
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
      if (!this.templatesShouldBeDrawn) {
        return tileBlob;
      }
      const drawSize = this.tileSize * this.drawMult;
      const numericTileCoords = [Number(tileCoords[0]) || 0, Number(tileCoords[1]) || 0];
      tileCoords = numericTileCoords[0].toString().padStart(4, "0") + "," + numericTileCoords[1].toString().padStart(4, "0");
      console.log(`Searching for templates in tile: "${tileCoords}"`);
      const templateArray = this.templatesArray;
      console.log(templateArray);
      templateArray.sort((a, b) => {
        return a.sortID - b.sortID;
      });
      console.log(templateArray);
      const templatesToDraw = templateArray.map((template) => {
        const matchingTiles = Object.keys(template.chunked).filter(
          (tile) => tile.startsWith(tileCoords)
        );
        if (matchingTiles.length === 0) {
          return null;
        }
        const matchingTileBlobs = matchingTiles.map((tile) => {
          const coords2 = tile.split(",");
          return {
            instance: template,
            bitmap: template.chunked[tile],
            chunked32: template.chunked32?.[tile],
            chunkKey: tile,
            tileCoords: [coords2[0], coords2[1]],
            pixelCoords: [coords2[2], coords2[3]]
          };
        });
        return matchingTileBlobs?.[0];
      }).filter(Boolean);
      console.log(templatesToDraw);
      const templateCount = templatesToDraw?.length || 0;
      console.log(`templateCount = ${templateCount}`);
      if (templateCount > 0) {
        const totalPixels = templateArray.filter((template) => {
          const matchingTiles = Object.keys(template.chunked).filter(
            (tile) => tile.startsWith(tileCoords)
          );
          return matchingTiles.length > 0;
        }).reduce((sum, template) => sum + (template.pixelCount.total || 0), 0);
        const pixelCountFormatted = localizeNumber(totalPixels);
        this.windowMain.handleDisplayStatus(
          `Displaying ${templateCount} template${templateCount == 1 ? "" : "s"}.
Total pixels: ${pixelCountFormatted}`
        );
      } else {
        this.windowMain.handleDisplayStatus(`Sleeping
Version: ${this.version}`);
        return tileBlob;
      }
      const tileBitmap = await createImageBitmap(tileBlob);
      const canvas = new OffscreenCanvas(drawSize, drawSize);
      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = false;
      context.beginPath();
      context.rect(0, 0, drawSize, drawSize);
      context.clip();
      context.clearRect(0, 0, drawSize, drawSize);
      context.drawImage(tileBitmap, 0, 0, drawSize, drawSize);
      const tileBeforeTemplates = context.getImageData(0, 0, drawSize, drawSize);
      const tileBeforeTemplates32 = new Uint32Array(tileBeforeTemplates.data.buffer);
      const highlightPattern = this.settingsManager?.userSettings?.highlight || [[2, 0, 0]];
      const highlightPatternIndexZero = highlightPattern?.[0];
      const highlightDisabled = highlightPattern?.length == 1 && highlightPatternIndexZero?.[0] == 2 && highlightPatternIndexZero?.[1] == 0 && highlightPatternIndexZero?.[2] == 0;
      const incorrectHighlightColorID = this.getIncorrectHighlightColorID();
      const hasIncorrectHighlightColor = Number.isFinite(incorrectHighlightColorID);
      const incorrectHighlightMode = this.getIncorrectHighlightMode();
      const fallbackHighlightPattern = [[1, 0, 1], [2, 0, 0], [1, -1, 0], [1, 1, 0], [1, 0, -1]];
      const effectiveHighlightPattern = highlightDisabled && hasIncorrectHighlightColor ? fallbackHighlightPattern : highlightPattern;
      for (const template of templatesToDraw) {
        console.log(`Template:`);
        console.log(template);
        const templateHasErased = !!template.instance.pixelCount?.colors?.get(-1);
        let templateBeforeFilter32 = template.chunked32.slice();
        const coordXtoDrawAt = Number(template.pixelCoords[0]) * this.drawMult;
        const coordYtoDrawAt = Number(template.pixelCoords[1]) * this.drawMult;
        const templateOrigin = Array.isArray(template.instance.coords) ? template.instance.coords.map(Number) : null;
        const highlightGridOrigin = templateOrigin?.every(Number.isFinite) ? [
          ((numericTileCoords[0] - templateOrigin[0]) * this.tileSize + Number(template.pixelCoords[0]) - templateOrigin[2]) * this.drawMult,
          ((numericTileCoords[1] - templateOrigin[1]) * this.tileSize + Number(template.pixelCoords[1]) - templateOrigin[3]) * this.drawMult
        ] : [
          numericTileCoords[0] * drawSize + coordXtoDrawAt,
          numericTileCoords[1] * drawSize + coordYtoDrawAt
        ];
        if (this.shouldFilterColor.size == 0 && !templateHasErased) {
          context.drawImage(template.bitmap, coordXtoDrawAt, coordYtoDrawAt);
        }
        if (!templateBeforeFilter32) {
          const templateBeforeFilter = context.getImageData(coordXtoDrawAt, coordYtoDrawAt, template.bitmap.width, template.bitmap.height);
          templateBeforeFilter32 = new Uint32Array(templateBeforeFilter.data.buffer);
        }
        const timer = Date.now();
        const {
          correctPixels: pixelsCorrect,
          filteredTemplate: templateAfterFilter
        } = await __privateMethod(this, _TemplateManager_instances, calculateCorrectPixelsOnTile_And_FilterTile_fn).call(this, {
          tile: tileBeforeTemplates32,
          template: templateBeforeFilter32,
          templateInfo: [coordXtoDrawAt, coordYtoDrawAt, template.bitmap.width, template.bitmap.height],
          highlightPattern: effectiveHighlightPattern,
          highlightDisabled: highlightDisabled && !hasIncorrectHighlightColor,
          highlightColorID: incorrectHighlightColorID,
          highlightMode: incorrectHighlightMode,
          highlightGridOrigin,
          pixelState: template.instance.pixelStateByChunk,
          chunkKey: template.chunkKey
        });
        let pixelsCorrectTotal = 0;
        const transparentColorID = 0;
        for (const [color, total] of pixelsCorrect) {
          if (color == transparentColorID) {
            continue;
          }
          pixelsCorrectTotal += total;
        }
        if (this.shouldFilterColor.size != 0 || templateHasErased || !highlightDisabled || hasIncorrectHighlightColor) {
          console.log("Colors to filter: ", this.shouldFilterColor);
          context.drawImage(await createImageBitmap(new ImageData(new Uint8ClampedArray(templateAfterFilter.buffer), template.bitmap.width, template.bitmap.height)), coordXtoDrawAt, coordYtoDrawAt);
        }
        console.log(`Finished calculating correct pixels & filtering colors for the tile ${tileCoords} in ${(Date.now() - timer) / 1e3} seconds!
There are ${pixelsCorrectTotal} correct pixels.`);
        if (typeof template.instance.pixelCount["correct"] == "undefined") {
          template.instance.pixelCount["correct"] = {};
        }
        template.instance.pixelCount["correct"][tileCoords] = pixelsCorrect;
      }
      return await canvas.convertToBlob({ type: "image/png" });
    }
    /** Imports the JSON object, and appends it to any JSON object already loaded
     * @param {string} json - The JSON string to parse
     */
    async importJSON(json) {
      console.log(`Importing JSON...`);
      console.log(json);
      this.templateStatisticsState = "loading";
      __privateMethod(this, _TemplateManager_instances, emitTemplatesChanged_fn).call(this, "import-started");
      const previousTemplatesJSON = this.templatesJSON;
      const previousTemplatesArray = this.templatesArray;
      try {
        if (["BlueMarble", "Chromora"].includes(json?.whoami)) {
          const { templatesArray: importedTemplates, skippedTemplates } = await __privateMethod(this, _TemplateManager_instances, parseBlueMarble_fn).call(this, json);
          if (Object.keys(json.templates).length && !importedTemplates.length) {
            throw new AggregateError(
              skippedTemplates.map(({ error }) => error),
              "None of the stored templates could be loaded."
            );
          }
          const importedJSON = skippedTemplates.length ? { ...json, templates: { ...json.templates } } : json;
          for (const { templateKey } of skippedTemplates) {
            delete importedJSON.templates[templateKey];
          }
          this.templatesJSON = importedJSON;
          this.templatesArray = importedTemplates;
          this.templateStatisticsState = skippedTemplates.length ? "degraded" : "ready";
          __privateMethod(this, _TemplateManager_instances, emitTemplatesChanged_fn).call(this, skippedTemplates.length ? "imported-with-errors" : "imported");
        } else {
          this.templatesJSON = await this.createJSON();
          this.templatesArray = [];
          this.templateStatisticsState = "ready";
          __privateMethod(this, _TemplateManager_instances, emitTemplatesChanged_fn).call(this, "imported");
        }
      } catch (error) {
        this.templatesJSON = previousTemplatesJSON;
        this.templatesArray = previousTemplatesArray;
        this.templateStatisticsState = "error";
        __privateMethod(this, _TemplateManager_instances, emitTemplatesChanged_fn).call(this, "import-failed");
        throw error;
      }
    }
    /** Sets the `templatesShouldBeDrawn` boolean to a value.
     * @param {boolean} value - The value to set the boolean to
     * @since 0.73.7
     */
    setTemplatesShouldBeDrawn(value) {
      this.templatesShouldBeDrawn = value;
    }
  };
  _TemplateManager_instances = new WeakSet();
  /** Notifies UI owners without coupling TemplateManager to a specific window.
   * @param {string} reason
   * @since 0.99.0
   */
  emitTemplatesChanged_fn = function(reason) {
    const detail = { reason, state: this.templateStatisticsState };
    for (const listener of this.templateChangeListeners) {
      try {
        listener(detail);
      } catch (error) {
        consoleWarn("A template-change listener failed.", error);
      }
    }
  };
  processPaintAreaSelection_fn = async function(data, signal) {
    try {
      const result = await this.findTemplatePixelRuns(data.bounds, data.colorID, {
        maxPixels: data.maxPixels,
        signal
      });
      if (signal.aborted) {
        return;
      }
      window.postMessage({
        source: "blue-marble",
        action: "paint-area-fill",
        requestID: data.requestID,
        colorID: Number(data.colorID),
        runs: result.runs,
        pixelCount: result.pixelCount
      }, "*");
    } catch (error) {
      if (signal.aborted || error?.name == "AbortError") {
        return;
      }
      window.postMessage({
        source: "blue-marble",
        action: "paint-area-error",
        requestID: data.requestID,
        message: error instanceof Error ? error.message : String(error)
      }, "*");
    }
  };
  /** Restores hidden colors from persisted user settings.
   * @since 0.92.1
   */
  restoreFilteredColorsFromSettings_fn = function() {
    const storedFilter = this.settingsManager?.userSettings?.filter;
    const filteredColors = Array.isArray(storedFilter) ? storedFilter : [];
    this.shouldFilterColor.clear();
    for (const colorID of filteredColors) {
      const parsedColorID = Number(colorID);
      if (!Number.isFinite(parsedColorID)) {
        continue;
      }
      this.shouldFilterColor.set(parsedColorID, true);
    }
  };
  /** Persists hidden colors to user settings storage.
   * @since 0.92.1
   */
  persistFilteredColors_fn = function() {
    if (!this.settingsManager) {
      return;
    }
    this.settingsManager.userSettings.filter = Array.from(this.shouldFilterColor.keys()).map((colorID) => Number(colorID)).filter((colorID) => Number.isFinite(colorID)).sort((a, b) => a - b);
    void this.settingsManager.saveUserStorageNow();
  };
  /** Generates a {@link Template} class instance from the JSON object template.
   * {@link createTemplate()} will create a class instance and save to template storage.
   * `#loadTemplate()` will create a class instance without saving to the template storage.
   * @param {Object} template - The template to load
   * @since 0.88.504
   */
  loadTemplate_fn = function(templateObject) {
    const pixelCount = {
      total: templateObject.pixels?.total,
      colors: new Map(Object.entries(templateObject.pixels?.colors || {}).map(([key, value]) => [Number(key), value]))
    };
    const template = new Template({
      displayName: templateObject.displayName,
      sortID: Object.keys(this.templatesJSON.templates).length || 0,
      authorID: numberToEncoded(this.userID || 0, this.encodingBase),
      pixelCount,
      chunked: templateObject.tiles
    });
    template.calculateCoordsFromChunked();
    this.templatesArray.push(template);
  };
  storeTemplates_fn = async function() {
    await GM.setValue("bmTemplates", JSON.stringify(this.templatesJSON));
  };
  parseBlueMarble_fn = async function(json) {
    console.log(`Parsing BlueMarble...`);
    const templates = json?.templates;
    if (!templates || typeof templates != "object" || Array.isArray(templates)) {
      throw new TypeError("Stored template data has no valid templates object.");
    }
    console.log(`BlueMarble length: ${Object.keys(templates).length}`);
    const schemaVersion = json?.schemaVersion;
    if (typeof schemaVersion != "string") {
      throw new TypeError("Stored template data has no valid schema version.");
    }
    const schemaVersionArray = schemaVersion.split(/[-\.\+]/);
    const schemaVersionBleedingEdge = this.schemaVersion.split(/[-\.\+]/);
    const scriptVersion = json?.scriptVersion;
    console.log(`BlueMarble Template Schema: ${schemaVersion}; Script Version: ${scriptVersion}`);
    if (schemaVersionArray[0] == schemaVersionBleedingEdge[0]) {
      if (schemaVersionArray[1] != schemaVersionBleedingEdge[1]) {
        const windowWizard = new WindowWizard(this.name, this.version, this.schemaVersion, this);
        windowWizard.buildWindow();
      }
      return await loadSchema({
        tileSize: this.tileSize,
        drawMult: this.drawMult,
        templatesArray: []
      });
    } else if (schemaVersionArray[0] < schemaVersionBleedingEdge[0]) {
      const windowWizard = new WindowWizard(this.name, this.version, this.schemaVersion, this);
      windowWizard.buildWindow();
      throw new Error(`Template schema ${schemaVersion} must be migrated before loading.`);
    } else {
      this.windowMain.handleDisplayError(`Template version ${schemaVersion} is unsupported.
Use ${this.name} version ${scriptVersion} or load a new template.`);
      throw new Error(`Template schema ${schemaVersion} is unsupported.`);
    }
    async function loadSchema({
      tileSize,
      drawMult,
      templatesArray
    }) {
      const skippedTemplates = [];
      for (const [templateKey, templateValue] of Object.entries(templates)) {
        console.log(`Template Key: ${templateKey}`);
        try {
          if (!templateValue || typeof templateValue != "object") {
            throw new TypeError(`Template "${templateKey}" is not an object.`);
          }
          const templateKeyArray = templateKey.split(" ");
          const sortID = Number(templateKeyArray?.[0]);
          const authorID = templateKeyArray?.[1] || "0";
          const displayName = templateValue.name || `Template ${sortID || ""}`;
          const pixelCount = {
            total: templateValue.pixels?.total,
            colors: new Map(Object.entries(templateValue.pixels?.colors || {}).map(([key, value]) => [Number(key), value]))
          };
          const tilesbase64 = templateValue.tiles ?? {};
          if (typeof tilesbase64 != "object" || Array.isArray(tilesbase64)) {
            throw new TypeError(`Template "${templateKey}" has no valid tiles object.`);
          }
          const templateTiles = {};
          const templateTiles32 = {};
          const actualTileSize = tileSize * drawMult;
          for (const tile of Object.keys(tilesbase64)) {
            console.log(tile);
            const encodedTemplateBase64 = tilesbase64[tile];
            const templateUint8Array = base64ToUint8(encodedTemplateBase64);
            const templateBlob = new Blob([templateUint8Array], { type: "image/png" });
            const templateBitmap = await createImageBitmap(templateBlob);
            templateTiles[tile] = templateBitmap;
            const canvas = new OffscreenCanvas(actualTileSize, actualTileSize);
            const context = canvas.getContext("2d");
            context.drawImage(templateBitmap, 0, 0);
            const imageData = context.getImageData(0, 0, templateBitmap.width, templateBitmap.height);
            templateTiles32[tile] = new Uint32Array(imageData.data.buffer);
          }
          const template = new Template({
            displayName,
            sortID: Number.isFinite(sortID) ? sortID : templatesArray.length,
            authorID: authorID || ""
            //coords: coords,
          });
          template.pixelCount = pixelCount;
          template.chunked = templateTiles;
          template.chunked32 = templateTiles32;
          templatesArray.push(template);
          console.log(templatesArray);
          console.log(`^^^ This ^^^`);
        } catch (error) {
          skippedTemplates.push({ templateKey, error });
          console.warn(`Blue Marble: Skipping damaged template "${templateKey}".`, error);
        }
      }
      return { templatesArray, skippedTemplates };
    }
  };
  /** Parses the OSU! Place JSON object
   */
  parseOSU_fn = function() {
  };
  calculateCorrectPixelsOnTile_And_FilterTile_fn = async function({
    tile: tile32,
    template: template32,
    templateInfo: templateInformation,
    highlightPattern,
    highlightDisabled,
    highlightColorID = null,
    highlightMode = "incorrect",
    highlightGridOrigin = null,
    pixelState: pixelStateByChunk = null,
    chunkKey = null
  }) {
    const pixelSize = this.drawMult;
    const tileWidth = this.tileSize * pixelSize;
    const tileHeight = tileWidth;
    const tilePixelOffsetY = -1;
    const tilePixelOffsetX = 0;
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
    const shouldTransparentTilePixelsBeHighlighted = !this.settingsManager?.userSettings?.flags?.includes("hl-noTrans");
    const hasHighlightColorFilter = Number.isFinite(highlightColorID);
    const { palette: _, LUT: lookupTable } = this.paletteBM;
    const _colorpalette = /* @__PURE__ */ new Map();
    const incorrectHighlightColors = {
      cyan: 4294961012,
      blue: 4294948481,
      yellow: 4284284927,
      coral: 4283585279,
      white: 4294967295
    };
    const incorrectHighlightPhase = Math.floor(Date.now() / 150);
    const incorrectHighlights = [];
    const maxIncorrectHighlightMarkers = 900;
    const incorrectHighlightBucketSize = pixelSize * 10;
    const incorrectHighlightBucketStride = Math.ceil(templateWidth / incorrectHighlightBucketSize) + 2;
    const incorrectHighlightBuckets = /* @__PURE__ */ new Set();
    const missingHighlightBucketSize = pixelSize * 16;
    const missingHighlightBuckets = /* @__PURE__ */ new Map();
    const getMissingBucketKey = (bucketRow, bucketColumn) => {
      if (bucketRow < 0 || bucketColumn < 0) {
        return -1;
      }
      const diagonal = bucketRow + bucketColumn;
      return diagonal * (diagonal + 1) / 2 + bucketColumn;
    };
    const queueIncorrectHighlight = ({ row, column }) => {
      if (incorrectHighlights.length >= maxIncorrectHighlightMarkers) {
        return;
      }
      const bucketKey = Math.floor(row / incorrectHighlightBucketSize) * incorrectHighlightBucketStride + Math.floor(column / incorrectHighlightBucketSize);
      if (incorrectHighlightBuckets.has(bucketKey)) {
        return;
      }
      incorrectHighlightBuckets.add(bucketKey);
      incorrectHighlights.push({
        row,
        column
      });
    };
    const queueMissingHighlight = ({ row, column }) => {
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
        bucketRow,
        bucketColumn,
        bucketKey,
        bucketSize: missingHighlightBucketSize,
        bucketTop: bucketRow * missingHighlightBucketSize - highlightGridOriginY,
        bucketLeft: bucketColumn * missingHighlightBucketSize - highlightGridOriginX,
        minRow: row,
        maxRow: row,
        minColumn: column,
        maxColumn: column,
        count: 1
      });
    };
    let workSliceStarted = performance.now();
    for (let templateRow = 1; templateRow < templateHeight; templateRow += pixelSize) {
      for (let templateColumn = 1; templateColumn < templateWidth; templateColumn += pixelSize) {
        const tileRow = templateCoordY + templateRow + tilePixelOffsetY;
        const tileColumn = templateCoordX + templateColumn + tilePixelOffsetX;
        const tilePixelAbove = tile32[tileRow * tileWidth + tileColumn];
        const templatePixel = template32[templateRow * templateWidth + templateColumn];
        const templatePixelAlpha = templatePixel >>> 24 & 255;
        const tilePixelAlpha = tilePixelAbove >>> 24 & 255;
        const bestTemplateColorID = lookupTable.get(templatePixel) ?? -2;
        const bestTileColorID = lookupTable.get(tilePixelAbove) ?? -2;
        const stateIndex = Math.floor((templateRow - 1) / pixelSize) * templatePixelWidth + Math.floor((templateColumn - 1) / pixelSize);
        if (templatePixelAlpha > tolerance && bestTemplateColorID > 0) {
          currentPixelState[stateIndex] = tilePixelAlpha <= tolerance ? 2 : bestTileColorID == bestTemplateColorID ? 1 : 3;
        }
        if (this.shouldFilterColor.get(bestTemplateColorID)) {
          template32[templateRow * templateWidth + templateColumn] = tilePixelAbove;
        }
        if (bestTemplateColorID == -1) {
          const blackTrans = 536870912;
          if (this.shouldFilterColor.get(bestTemplateColorID)) {
            template32[templateRow * templateWidth + templateColumn] = 0;
          } else {
            if ((tileRow / pixelSize & 1) == (tileColumn / pixelSize & 1)) {
              template32[templateRow * templateWidth + templateColumn] = blackTrans;
              template32[(templateRow - 1) * templateWidth + (templateColumn - 1)] = blackTrans;
              template32[(templateRow - 1) * templateWidth + (templateColumn + 1)] = blackTrans;
              template32[(templateRow + 1) * templateWidth + (templateColumn - 1)] = blackTrans;
              template32[(templateRow + 1) * templateWidth + (templateColumn + 1)] = blackTrans;
            } else {
              template32[templateRow * templateWidth + templateColumn] = 0;
              template32[(templateRow - 1) * templateWidth + templateColumn] = blackTrans;
              template32[(templateRow + 1) * templateWidth + templateColumn] = blackTrans;
              template32[templateRow * templateWidth + (templateColumn - 1)] = blackTrans;
              template32[templateRow * templateWidth + (templateColumn + 1)] = blackTrans;
            }
          }
        }
        const shouldHighlightSelectedColorMismatch = hasHighlightColorFilter && tilePixelAlpha > tolerance && highlightMode == "incorrect" && (bestTemplateColorID == highlightColorID && bestTileColorID != bestTemplateColorID || bestTileColorID == highlightColorID && bestTemplateColorID != highlightColorID);
        const shouldHighlightSelectedColorMissing = hasHighlightColorFilter && highlightMode == "missing" && bestTemplateColorID == highlightColorID && templatePixelAlpha > tolerance && tilePixelAlpha <= tolerance;
        const shouldHighlightGeneralMismatch = !hasHighlightColorFilter && templatePixelAlpha > tolerance && bestTileColorID != bestTemplateColorID;
        if (!highlightDisabled && (shouldHighlightSelectedColorMismatch || shouldHighlightSelectedColorMissing || shouldHighlightGeneralMismatch)) {
          if (hasHighlightColorFilter && (shouldHighlightSelectedColorMissing || tilePixelAlpha > tolerance) || !hasHighlightColorFilter && (shouldTransparentTilePixelsBeHighlighted || tilePixelAlpha > tolerance)) {
            if (hasHighlightColorFilter) {
              (highlightMode == "missing" ? queueMissingHighlight : queueIncorrectHighlight)({
                row: templateRow,
                column: templateColumn
              });
              continue;
            }
            const templatePixelColor = templatePixelAlpha > tolerance ? template32[templateRow * templateWidth + templateColumn] : tilePixelAbove;
            for (const subpixelPattern of highlightPattern) {
              const [subpixelState, subpixelColumnDelta, subpixelRowDelta] = subpixelPattern;
              const subpixelColor = subpixelState != 0 ? subpixelState != 1 ? templatePixelColor : 4278190335 : 0;
              template32[(templateRow + subpixelRowDelta) * templateWidth + (templateColumn + subpixelColumnDelta)] = subpixelColor;
            }
          }
        }
        if (bestTemplateColorID == -1 && tilePixelAbove <= tolerance) {
          const colorIDcount2 = _colorpalette.get(bestTemplateColorID);
          _colorpalette.set(bestTemplateColorID, colorIDcount2 ? colorIDcount2 + 1 : 1);
          continue;
        }
        if (templatePixelAlpha <= tolerance || tilePixelAlpha <= tolerance) {
          continue;
        }
        if (bestTileColorID != bestTemplateColorID) {
          continue;
        }
        const colorIDcount = _colorpalette.get(bestTemplateColorID);
        _colorpalette.set(bestTemplateColorID, colorIDcount ? colorIDcount + 1 : 1);
      }
      if (performance.now() - workSliceStarted >= 4) {
        await __privateMethod(this, _TemplateManager_instances, yieldToBrowser_fn).call(this);
        workSliceStarted = performance.now();
      }
    }
    if (hasHighlightColorFilter && highlightMode == "missing") {
      await __privateMethod(this, _TemplateManager_instances, yieldToBrowser_fn).call(this);
      const missingHighlightClusters = await __privateMethod(this, _TemplateManager_instances, buildMissingHighlightClusters_fn).call(this, missingHighlightBuckets, 96);
      await __privateMethod(this, _TemplateManager_instances, yieldToBrowser_fn).call(this);
      for (const cluster of missingHighlightClusters) {
        __privateMethod(this, _TemplateManager_instances, drawMissingHighlightCluster_fn).call(this, {
          template: template32,
          templateWidth,
          templateHeight,
          cluster,
          pixelSize
        });
        if (performance.now() - workSliceStarted >= 4) {
          await __privateMethod(this, _TemplateManager_instances, yieldToBrowser_fn).call(this);
          workSliceStarted = performance.now();
        }
      }
    } else {
      const markerStencil = __privateMethod(this, _TemplateManager_instances, getIncorrectHighlightStencil_fn).call(this, incorrectHighlightColors, incorrectHighlightPhase);
      for (const highlight of incorrectHighlights) {
        __privateMethod(this, _TemplateManager_instances, drawIncorrectHighlightMarker_fn).call(this, {
          template: template32,
          templateWidth,
          templateHeight,
          row: highlight.row,
          column: highlight.column,
          stencil: markerStencil
        });
        if (performance.now() - workSliceStarted >= 4) {
          await __privateMethod(this, _TemplateManager_instances, yieldToBrowser_fn).call(this);
          workSliceStarted = performance.now();
        }
      }
    }
    if (pixelStateByChunk instanceof Map && chunkKey) {
      pixelStateByChunk.set(chunkKey, currentPixelState);
    }
    console.log(`List of template pixels that match the tile:`);
    console.log(_colorpalette);
    return { correctPixels: _colorpalette, filteredTemplate: template32 };
  };
  yieldToBrowser_fn = async function() {
    if (typeof globalThis.scheduler?.yield === "function") {
      await globalThis.scheduler.yield();
      return;
    }
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  };
  buildMissingHighlightClusters_fn = async function(bucketMap, maxClusters) {
    if (!bucketMap?.size) {
      return [];
    }
    const visited = /* @__PURE__ */ new Set();
    const clusters = [];
    let workSliceStarted = performance.now();
    const neighborDeltas = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1]
    ];
    for (const [bucketKey, startBucket] of bucketMap) {
      if (visited.has(bucketKey)) {
        continue;
      }
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
          if (neighborRow < 0 || neighborColumn < 0) {
            continue;
          }
          const diagonal = neighborRow + neighborColumn;
          const neighborKey = diagonal * (diagonal + 1) / 2 + neighborColumn;
          if (visited.has(neighborKey)) {
            continue;
          }
          const neighbor = bucketMap.get(neighborKey);
          if (!neighbor) {
            continue;
          }
          visited.add(neighborKey);
          queue.push(neighbor);
        }
        if (performance.now() - workSliceStarted >= 4) {
          await __privateMethod(this, _TemplateManager_instances, yieldToBrowser_fn).call(this);
          workSliceStarted = performance.now();
        }
      }
      clusters.push(cluster);
    }
    return clusters.sort((a, b) => b.count - a.count).slice(0, maxClusters);
  };
  /** Draws one soft contour around a cluster of missing pixels.
   * @param {Object} params
   * @param {Uint32Array} params.template
   * @param {number} params.templateWidth
   * @param {number} params.templateHeight
   * @param {Object} params.cluster
   * @param {number} params.pixelSize
   * @since 0.97.0
   */
  drawMissingHighlightCluster_fn = function({
    template: template32,
    templateWidth,
    templateHeight,
    cluster,
    pixelSize
  }) {
    const contourColor = 3372219136;
    const logicalWidth = Math.ceil(templateWidth / pixelSize);
    const logicalHeight = Math.ceil(templateHeight / pixelSize);
    const events = /* @__PURE__ */ new Map();
    const addEvent = (row, type, rectangle) => {
      const event = events.get(row) ?? { add: [], remove: [] };
      event[type].push(rectangle);
      events.set(row, event);
    };
    const mergeIntervals = (intervals) => {
      if (!intervals.length) {
        return [];
      }
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
    const intervalsEqual = (first, second) => first.length == second.length && first.every((interval, index) => interval[0] == second[index][0] && interval[1] == second[index][1]);
    const subtractIntervals = ([start, end], blockers) => {
      const visible = [];
      let cursor = start;
      for (const [blockStart, blockEnd] of blockers) {
        if (blockEnd <= cursor) {
          continue;
        }
        if (blockStart >= end) {
          break;
        }
        if (blockStart > cursor) {
          visible.push([cursor, Math.min(end, blockStart)]);
        }
        cursor = Math.max(cursor, blockEnd);
        if (cursor >= end) {
          break;
        }
      }
      if (cursor < end) {
        visible.push([cursor, end]);
      }
      return visible;
    };
    for (const bucket of cluster.buckets) {
      const top = Math.round(bucket.bucketTop / pixelSize);
      const left = Math.round(bucket.bucketLeft / pixelSize);
      const size = Math.round(bucket.bucketSize / pixelSize);
      const rectangle = {
        top,
        bottom: top + size,
        left,
        right: left + size
      };
      addEvent(rectangle.top, "add", rectangle);
      addEvent(rectangle.bottom, "remove", rectangle);
    }
    const eventRows = Array.from(events.keys()).sort((a, b) => a - b);
    const activeRectangles = /* @__PURE__ */ new Set();
    const slabs = [];
    for (let eventIndex = 0; eventIndex < eventRows.length - 1; eventIndex++) {
      const top = eventRows[eventIndex];
      const nextTop = eventRows[eventIndex + 1];
      const event = events.get(top);
      for (const rectangle of event.remove) {
        activeRectangles.delete(rectangle);
      }
      for (const rectangle of event.add) {
        activeRectangles.add(rectangle);
      }
      if (!activeRectangles.size || nextTop <= top) {
        continue;
      }
      const intervals = mergeIntervals(Array.from(activeRectangles, (rectangle) => [rectangle.left, rectangle.right]));
      const previousSlab = slabs[slabs.length - 1];
      if (previousSlab && previousSlab.bottom == top && intervalsEqual(previousSlab.intervals, intervals)) {
        previousSlab.bottom = nextTop;
      } else {
        slabs.push({ top, bottom: nextTop, intervals });
      }
    }
    const drawHorizontal = (row, startColumn, endColumn) => {
      const start = Math.max(0, startColumn);
      const end = Math.min(logicalWidth, endColumn);
      if (row < 0 || row >= logicalHeight || start >= end) {
        return;
      }
      const firstSubpixelRow = row * pixelSize;
      const finalSubpixelRow = Math.min(templateHeight, firstSubpixelRow + pixelSize);
      const firstSubpixelColumn = start * pixelSize;
      const finalSubpixelColumn = Math.min(templateWidth, end * pixelSize);
      for (let subpixelRow = firstSubpixelRow; subpixelRow < finalSubpixelRow; subpixelRow++) {
        template32.fill(contourColor, subpixelRow * templateWidth + firstSubpixelColumn, subpixelRow * templateWidth + finalSubpixelColumn);
      }
    };
    const drawVertical = (column, startRow, endRow) => {
      const start = Math.max(0, startRow);
      const end = Math.min(logicalHeight, endRow);
      if (column < 0 || column >= logicalWidth || start >= end) {
        return;
      }
      const firstSubpixelColumn = column * pixelSize;
      const finalSubpixelColumn = Math.min(templateWidth, firstSubpixelColumn + pixelSize);
      for (let row = start; row < end; row++) {
        const firstSubpixelRow = row * pixelSize;
        const finalSubpixelRow = Math.min(templateHeight, firstSubpixelRow + pixelSize);
        for (let subpixelRow = firstSubpixelRow; subpixelRow < finalSubpixelRow; subpixelRow++) {
          template32.fill(contourColor, subpixelRow * templateWidth + firstSubpixelColumn, subpixelRow * templateWidth + finalSubpixelColumn);
        }
      }
    };
    const drawPixel = (row, column) => drawHorizontal(row, column, column + 1);
    for (let slabIndex = 0; slabIndex < slabs.length; slabIndex++) {
      const slab = slabs[slabIndex];
      const previousSlab = slabs[slabIndex - 1];
      const nextSlab = slabs[slabIndex + 1];
      const previousIntervals = previousSlab && previousSlab.bottom == slab.top ? previousSlab.intervals : [];
      const nextIntervals = nextSlab && slab.bottom == nextSlab.top ? nextSlab.intervals : [];
      for (const interval of slab.intervals) {
        const [left, right] = interval;
        drawVertical(left, slab.top, slab.bottom);
        drawVertical(right - 1, slab.top, slab.bottom);
        for (const [start, end] of subtractIntervals(interval, previousIntervals)) {
          drawHorizontal(slab.top, start, end);
          if (start > left) {
            drawPixel(slab.top, start - 1);
          }
          if (end < right) {
            drawPixel(slab.top, end);
          }
        }
        for (const [start, end] of subtractIntervals(interval, nextIntervals)) {
          const bottomRow = slab.bottom - 1;
          drawHorizontal(bottomRow, start, end);
          if (start > left) {
            drawPixel(bottomRow, start - 1);
          }
          if (end < right) {
            drawPixel(bottomRow, end);
          }
        }
      }
    }
  };
  /** Builds one reusable marker stencil for the current animation phase.
   * @param {Object} colors
   * @param {number} phase
   * @returns {Array<number>}
   * @since 0.98.0
   */
  getIncorrectHighlightStencil_fn = function(colors, phase) {
    const normalizedPhase = phase % 12;
    const cacheKey = `${this.drawMult}:${normalizedPhase}`;
    const cachedStencil = this.incorrectHighlightStencilCache.get(cacheKey);
    if (cachedStencil) {
      return cachedStencil;
    }
    const stencil = [];
    const push = (rowDelta, columnDelta, color) => {
      stencil.push(rowDelta, columnDelta, color);
    };
    const pixelSize = this.drawMult;
    const radiusPixels = 10 + normalizedPhase % 4;
    const waveRadius = radiusPixels * pixelSize;
    const innerRadius = Math.max(pixelSize * 3, waveRadius - pixelSize * 4);
    const midRadius = Math.max(pixelSize * 2, waveRadius - pixelSize * 2);
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
        const isSpoke = Math.abs(rowDelta) <= spokeHalfThickness && Math.abs(columnDelta) >= crossStart && Math.abs(columnDelta) <= waveRadius && (Math.abs(columnDelta) / pixelSize + normalizedPhase) % 5 < 1 || Math.abs(columnDelta) <= spokeHalfThickness && Math.abs(rowDelta) >= crossStart && Math.abs(rowDelta) <= waveRadius && (Math.abs(rowDelta) / pixelSize + normalizedPhase) % 5 < 1;
        if (!isOuterRing && !isMidRing && !isInnerRing && !isSpoke) {
          continue;
        }
        if (isOuterRing && (Math.floor((Math.atan2(rowDelta, columnDelta) + Math.PI) * 6) + phaseModThree) % 3 == 0) {
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
  };
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
  drawIncorrectHighlightMarker_fn = function({
    template: template32,
    templateWidth,
    templateHeight,
    row: templateRow,
    column: templateColumn,
    stencil
  }) {
    const setSubpixel = (rowDelta, columnDelta, color) => {
      const row = templateRow + rowDelta;
      const column = templateColumn + columnDelta;
      if (row < 0 || row >= templateHeight || column < 0 || column >= templateWidth) {
        return;
      }
      template32[row * templateWidth + column] = color;
    };
    for (let index = 0; index < stencil.length; index += 3) {
      setSubpixel(stencil[index], stencil[index + 1], stencil[index + 2]);
    }
  };

  // src/apiManager.js
  var ApiManager = class {
    /** Constructor for ApiManager class
     * @param {TemplateManager} templateManager 
     * @since 0.11.34
     */
    constructor(templateManager) {
      this.templateManager = templateManager;
      this.disableAll = false;
      this.chargeRefillTimerID = "";
      this.coordsTilePixel = [];
      this.templateCoordsTilePixel = [];
      this.spontaneousMessageHandler = null;
    }
    /** Determines if the spontaneously received response is something we want.
     * Otherwise, we can ignore it.
     * Note: Due to aggressive compression, make your calls like `data['jsonData']['name']` instead of `data.jsonData.name`
     * 
     * @param {Overlay} overlay - The Overlay class instance
     * @since 0.11.1
    */
    spontaneousResponseListener(overlay) {
      this.stopSpontaneousResponseListener();
      const messageHandler = async (event) => {
        const data = event.data;
        const dataJSON = data["jsonData"];
        if (!(data && data["source"] === "blue-marble")) {
          return;
        }
        if (!data["endpoint"]) {
          return;
        }
        const endpointText = data["endpoint"]?.split("?")[0].split("/").filter((s) => s && isNaN(Number(s))).filter((s) => s && !s.includes(".")).pop();
        console.log(`%cBlue Marble%c: Recieved message about "%s"`, "color: cornflowerblue;", "", endpointText);
        switch (endpointText) {
          case "me":
            this.applyUserDataToOverlay(overlay, dataJSON);
            break;
          case "pixel":
            const coordsTile = data["endpoint"].split("?")[0].split("/").filter((s) => s && !isNaN(Number(s)));
            const payloadExtractor = new URLSearchParams(data["endpoint"].split("?")[1]);
            const coordsPixel = [payloadExtractor.get("x"), payloadExtractor.get("y")];
            if (this.coordsTilePixel.length && (!coordsTile.length || !coordsPixel.length)) {
              overlay.handleDisplayError(`Coordinates are malformed!
Did you try clicking the canvas first?`);
              return;
            }
            this.coordsTilePixel = [...coordsTile, ...coordsPixel];
            const displayTP = serverTPtoDisplayTP(coordsTile, coordsPixel);
            const spanElements = document.querySelectorAll("span");
            for (const element of spanElements) {
              const elementTextTrimmed = element.textContent.trim();
              if (elementTextTrimmed.includes(displayTP[0]) && elementTextTrimmed.includes(displayTP[1])) {
                let displayCoords = document.querySelector("#bm-display-coords");
                const text = `(Tl X: ${coordsTile[0]}, Tl Y: ${coordsTile[1]}, Px X: ${coordsPixel[0]}, Px Y: ${coordsPixel[1]})`;
                const coordsLabel = ["Tl X:", "Tl Y:", "Px X:", "Px Y:"];
                const coordsID = ["bm-tile-x", "bm-tile-y", "bm-pixel-x", "bm-pixel-y"];
                const coordsCombined = [...coordsTile, ...coordsPixel];
                if (!displayCoords) {
                  displayCoords = document.createElement("span");
                  displayCoords.id = "bm-display-coords";
                  displayCoords.style = "display: flex; flex-wrap: wrap; gap: 0 1ch; font-size: small;";
                  for (const [coordIndex, coordValue] of coordsCombined.entries()) {
                    const coordElement = document.createElement("span");
                    coordElement.id = coordsID[coordsCombined.indexOf(coordValue) ?? ""];
                    coordElement.textContent = `${coordsLabel[coordIndex] ?? "??:"} ${coordValue}`;
                    displayCoords.appendChild(coordElement);
                  }
                  element.parentNode.parentNode.parentNode.insertAdjacentElement("afterend", displayCoords);
                } else {
                  for (const [coordIndex, coordID] of coordsID.entries()) {
                    const coordElement = document.getElementById(coordID);
                    coordElement.textContent = `${coordsLabel[coordIndex] ?? "??:"} ${coordsCombined[coordIndex]}`;
                  }
                }
              }
            }
            break;
          case "tile":
          case "tiles":
            let tileCoordsTile = data["endpoint"].split("/");
            tileCoordsTile = [parseInt(tileCoordsTile[tileCoordsTile.length - 2]), parseInt(tileCoordsTile[tileCoordsTile.length - 1].replace(".png", ""))];
            const blobUUID = data["blobID"];
            const blobData = data["blobData"];
            const timer = Date.now();
            const templateBlob = await this.templateManager.drawTemplateOnTile(blobData, tileCoordsTile);
            console.log(`Finished loading the tile in ${(Date.now() - timer) / 1e3} seconds!`);
            window.postMessage({
              source: "blue-marble",
              blobID: blobUUID,
              blobData: templateBlob,
              blink: data["blink"]
            });
            break;
          case "robots":
            this.disableAll = dataJSON["userscript"]?.toString().toLowerCase() == "false";
            break;
        }
      };
      this.spontaneousMessageHandler = messageHandler;
      window.addEventListener("message", messageHandler);
      return () => this.stopSpontaneousResponseListener();
    }
    /** Stops the active spontaneous response listener, if one exists.
     * @since 0.99.0
     */
    stopSpontaneousResponseListener() {
      if (!this.spontaneousMessageHandler) {
        return;
      }
      window.removeEventListener("message", this.spontaneousMessageHandler);
      this.spontaneousMessageHandler = null;
    }
    /** Applies user data from the /me endpoint to the current overlay.
     * @param {Overlay} overlay
     * @param {Object.<string, any>} dataJSON
     * @since 0.92.1
     */
    applyUserDataToOverlay(overlay, dataJSON) {
      if (dataJSON["status"] && dataJSON["status"]?.toString()[0] != "2") {
        overlay.handleDisplayError(`You are not logged in or Wplace is offline!
Could not fetch userdata.`);
        return;
      }
      const nextLevelPixels = Math.ceil(Math.pow(Math.floor(dataJSON["level"]) * Math.pow(30, 0.65), 1 / 0.65) - dataJSON["pixelsPainted"]);
      console.log(dataJSON["id"]);
      if (!!dataJSON["id"] || dataJSON["id"] === 0) {
        console.log(numberToEncoded(
          dataJSON["id"],
          "!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~"
        ));
      }
      this.templateManager.userID = dataJSON["id"];
      if (this.chargeRefillTimerID.length != 0) {
        const chargeRefillTimer = document.querySelector("#" + this.chargeRefillTimerID);
        if (chargeRefillTimer) {
          const chargeData = dataJSON["charges"];
          chargeRefillTimer.dataset["endDate"] = Date.now() + (chargeData["max"] - chargeData["count"]) * chargeData["cooldownMs"];
        }
      }
      overlay.updateInnerHTML("bm-user-droplets", `<b>${localizeNumber(dataJSON["droplets"])}</b>`);
      overlay.updateInnerHTML("bm-user-nextlevel", `<b>${localizeNumber(nextLevelPixels)}</b> px`);
    }
    /** Requests the current /me payload directly so the overlay has initial user data
     * even if the first network response was missed during startup.
     * @param {Overlay} overlay
     * @since 0.92.1
     */
    async requestCurrentUserData(overlay) {
      try {
        const response = await fetch(`${window.location.origin}/api/me`, {
          credentials: "include"
        });
        if (!response.ok) {
          overlay.handleDisplayError(`Could not fetch userdata.
HTTP ${response.status}`);
          return;
        }
        const dataJSON = await response.json();
        this.applyUserDataToOverlay(overlay, dataJSON);
      } catch (error) {
        consoleError("Failed to fetch current user data:", error);
      }
    }
    /** Applies cached /me data from sessionStorage if it was captured during early startup.
     * @param {Overlay} overlay
     * @returns {boolean}
     * @since 0.92.1
     */
    applyCachedUserData(overlay) {
      try {
        const cached = sessionStorage.getItem("bm-last-me");
        if (!cached) {
          return false;
        }
        const dataJSON = JSON.parse(cached);
        this.applyUserDataToOverlay(overlay, dataJSON);
        return true;
      } catch (error) {
        consoleError("Failed to apply cached user data:", error);
        return false;
      }
    }
    // Sends a heartbeat to the telemetry server
    async sendHeartbeat(version2) {
      console.log("Sending heartbeat to telemetry server...");
      let userSettings2 = GM_getValue("bmUserSettings", "{}");
      userSettings2 = JSON.parse(userSettings2);
      if (!userSettings2 || !userSettings2.telemetry || !userSettings2.uuid) {
        console.log("Telemetry is disabled, not sending heartbeat.");
        return;
      }
      const ua = navigator.userAgent;
      let browser = await this.getBrowserFromUA(ua);
      let os = this.getOS(ua);
      GM_xmlhttpRequest({
        method: "POST",
        url: "https://telemetry.thebluecorner.net/heartbeat",
        headers: {
          "Content-Type": "application/json"
        },
        data: JSON.stringify({
          uuid: userSettings2.uuid,
          version: version2,
          browser,
          os
        }),
        onload: (response) => {
          if (response.status !== 200) {
            consoleError("Failed to send heartbeat:", response.statusText);
          }
        },
        onerror: (error) => {
          consoleError("Error sending heartbeat:", error);
        }
      });
    }
    async getBrowserFromUA(ua = navigator.userAgent) {
      ua = ua || "";
      if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
      if (ua.includes("Edg/")) return "Edge";
      if (ua.includes("Vivaldi")) return "Vivaldi";
      if (ua.includes("YaBrowser")) return "Yandex";
      if (ua.includes("Kiwi")) return "Kiwi";
      if (ua.includes("Brave")) return "Brave";
      if (ua.includes("Firefox/")) return "Firefox";
      if (ua.includes("Chrome/")) return "Chrome";
      if (ua.includes("Safari/")) return "Safari";
      if (navigator.brave && typeof navigator.brave.isBrave === "function") {
        if (await navigator.brave.isBrave()) return "Brave";
      }
      return "Unknown";
    }
    getOS(ua = navigator.userAgent) {
      ua = ua || "";
      if (/Windows NT 11/i.test(ua)) return "Windows 11";
      if (/Windows NT 10/i.test(ua)) return "Windows 10";
      if (/Windows NT 6\.3/i.test(ua)) return "Windows 8.1";
      if (/Windows NT 6\.2/i.test(ua)) return "Windows 8";
      if (/Windows NT 6\.1/i.test(ua)) return "Windows 7";
      if (/Windows NT 6\.0/i.test(ua)) return "Windows Vista";
      if (/Windows NT 5\.1|Windows XP/i.test(ua)) return "Windows XP";
      if (/Mac OS X 10[_\.]15/i.test(ua)) return "macOS Catalina";
      if (/Mac OS X 10[_\.]14/i.test(ua)) return "macOS Mojave";
      if (/Mac OS X 10[_\.]13/i.test(ua)) return "macOS High Sierra";
      if (/Mac OS X 10[_\.]12/i.test(ua)) return "macOS Sierra";
      if (/Mac OS X 10[_\.]11/i.test(ua)) return "OS X El Capitan";
      if (/Mac OS X 10[_\.]10/i.test(ua)) return "OS X Yosemite";
      if (/Mac OS X 10[_\.]/i.test(ua)) return "macOS";
      if (/Android/i.test(ua)) return "Android";
      if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
      if (/Linux/i.test(ua)) return "Linux";
      return "Unknown";
    }
  };

  // src/WindowTelemetry.js
  var _WindowTelemetry_instances, setTelemetryValue_fn;
  var WindowTelemetry = class extends Overlay {
    /** Constructor for the telemetry window
     * @param {string} name - The name of the userscript
     * @param {string} version - The version of the userscript
     * @param {number} currentTelemetryVersion - The current "version" of the data collection agreement
     * @param {string} uuid - The UUID of the user
     * @since 0.88.339
     * @see {@link Overlay#constructor}
     */
    constructor(name2, version2, currentTelemetryVersion, uuid) {
      super(name2, version2);
      __privateAdd(this, _WindowTelemetry_instances);
      this.window = null;
      this.windowID = "bm-window-telemetry";
      this.windowParent = document.body;
      this.currentTelemetryVersion = currentTelemetryVersion;
      this.uuid = uuid;
    }
    /** Spawns a telemetry window.
     * If another telemetry window already exists, we DON'T spawn another!
     * Parent/child relationships in the DOM structure below are indicated by indentation.
     * @since 0.88.339
     */
    async buildWindow() {
      if (document.querySelector(`#${this.windowID}`)) {
        this.handleDisplayError("Telemetry window already exists!");
        return;
      }
      const browser = await this.apiManager.getBrowserFromUA(navigator.userAgent);
      const os = this.apiManager.getOS(navigator.userAgent);
      this.window = this.addDiv({ "id": this.windowID, "class": "bm-window", "style": "height: 80vh; z-index: 9998;" }).addDiv({ "class": "bm-window-content" }).addDiv({ "class": "bm-container bm-center-vertically" }).addHeader(1, { "textContent": `${this.name} Telemetry` }).buildElement().buildElement().addHr().buildElement().addDiv({ "class": "bm-container bm-flex-center", "style": "gap: 1.5ch; flex-wrap: wrap;" }).addButton({ "textContent": "Enable Telemetry" }, (instance, button) => {
        button.onclick = async () => {
          __privateMethod(this, _WindowTelemetry_instances, setTelemetryValue_fn).call(this, this.currentTelemetryVersion);
          const element = document.getElementById(this.windowID);
          await this.handleWindowClose(element);
        };
      }).buildElement().addButton({ "textContent": "Disable Telemetry" }, (instance, button) => {
        button.onclick = async () => {
          __privateMethod(this, _WindowTelemetry_instances, setTelemetryValue_fn).call(this, 0);
          const element = document.getElementById(this.windowID);
          await this.handleWindowClose(element);
        };
      }).buildElement().addButton({ "textContent": "More Information" }, (instance, button) => {
        button.onclick = () => {
          window.open("https://github.com/SwingTheVine/Wplace-TelemetryServer#telemetry-data", "_blank", "noopener noreferrer");
        };
      }).buildElement().buildElement().addDiv({ "class": "bm-container bm-scrollable" }).addDiv({ "class": "bm-container" }).addHeader(2, { "textContent": "Legal" }).buildElement().addP({ "textContent": `We collect anonymous telemetry data such as your browser, OS, and script version to make the experience better for everyone. The data is never shared personally. The data is never sold. You can turn this off by pressing the "Disable" button, but keeping it on helps us improve features and reliability faster. Thank you for supporting ${this.name}!` }).buildElement().buildElement().addHr().buildElement().addDiv({ "class": "bm-container" }).addHeader(2, { "textContent": "Non-Legal Summary" }).buildElement().addP({ "innerHTML": `You can disable telemetry by pressing the "Disable" button. If you would like to read more about what information we collect, press the "More Information" button.<br>This is the data <em>stored</em> on our servers:` }).buildElement().addUl().addLi({ "innerHTML": `A unique identifier (UUIDv4) generated by ${escapeHTML(this.name)}. This enables telemetry without tracking your actual user ID.<br>Your UUID is: <b>${escapeHTML(this.uuid)}</b>` }).buildElement().addLi({ "innerHTML": `The version of ${escapeHTML(this.name)} you are using.<br>Your version is: <b>${escapeHTML(this.version)}</b>` }).buildElement().addLi({ "innerHTML": `Your browser type, used to determine ${escapeHTML(this.name)} outages and browser popularity.<br>Your browser type is: <b>${escapeHTML(browser)}</b>` }).buildElement().addLi({ "innerHTML": `Your OS type, used to determine ${escapeHTML(this.name)} outages and platform usage.<br>Your OS type is: <b>${escapeHTML(os)}</b>` }).buildElement().addLi({ "innerHTML": `The date and time that ${escapeHTML(this.name)} sent the telemetry information.` }).buildElement().buildElement().addP({ "innerHTML": `All data above is <b>aggregated every hour</b>. Anything that could be considered personal is deleted from the server. Aggregated data means totals such as "42 people used ${escapeHTML(this.name)} on Google Chrome this hour", which cannot identify anyone.` }).buildElement().buildElement().buildElement().buildElement().buildElement().buildOverlay(this.windowParent);
    }
  };
  _WindowTelemetry_instances = new WeakSet();
  /** Enables or disables telemetry based on the value passed in.
   * A value of zero will always disable telemetry.
   * A numeric, non-zero value will enable telemetry until the telemetry agreement is changed.
   * @param {number} value - The value to set the telemetry to
   * @since 0.88.339
   */
  setTelemetryValue_fn = function(value) {
    const userSettings2 = JSON.parse(GM_getValue("bmUserSettings", "{}"));
    userSettings2.telemetry = value;
    GM.setValue("bmUserSettings", JSON.stringify(userSettings2));
  };

  // src/main.js
  var name = GM_info.script.name.toString();
  var version = GM_info.script.version.toString();
  var consoleStyle = "color: cornflowerblue;";
  function inject(callback) {
    const script = document.createElement("script");
    script.setAttribute("bm-name", name);
    script.setAttribute("bm-cStyle", consoleStyle);
    script.textContent = `(${callback})();`;
    document.documentElement?.appendChild(script);
    script.remove();
  }
  inject(() => {
    if (window["__blueMarblePageHookInstalled"]) {
      return;
    }
    Object.defineProperty(window, "__blueMarblePageHookInstalled", {
      value: true,
      configurable: false,
      writable: false
    });
    const script = document.currentScript;
    const name2 = script?.getAttribute("bm-name") || "Blue Marble";
    const consoleStyle2 = script?.getAttribute("bm-cStyle") || "";
    const fetchedBlobQueue = /* @__PURE__ */ new Map();
    let tileRefreshRevision = 0;
    window.addEventListener("message", (event) => {
      const { source, action, revision, endpoint, blobID, blobData, blink } = event.data;
      if (source == "blue-marble" && action == "refresh-tiles") {
        tileRefreshRevision = Math.max(tileRefreshRevision + 1, Number(revision) || 0);
        window.dispatchEvent(new Event("online"));
        requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
        return;
      }
      if (source == "blue-marble" && action == "refresh-progress") {
        return;
      }
      const elapsed = Date.now() - blink;
      console.groupCollapsed(`%c${name2}%c: ${fetchedBlobQueue.size} Recieved IMAGE message about blob "${blobID}"`, consoleStyle2, "");
      console.log(`Blob fetch took %c${String(Math.floor(elapsed / 6e4)).padStart(2, "0")}:${String(Math.floor(elapsed / 1e3) % 60).padStart(2, "0")}.${String(elapsed % 1e3).padStart(3, "0")}%c MM:SS.mmm`, consoleStyle2, "");
      console.log(fetchedBlobQueue);
      console.groupEnd();
      if (source == "blue-marble" && !!blobID && !!blobData && !endpoint) {
        const callback = fetchedBlobQueue.get(blobID);
        if (typeof callback === "function") {
          callback(blobData);
        } else {
          consoleWarn(`%c${name2}%c: Attempted to retrieve a blob (%s) from queue, but the blobID was not a function! Skipping...`, consoleStyle2, "", blobID);
        }
        fetchedBlobQueue.delete(blobID);
      }
    });
    function setupPaintAreaBridge() {
      const tileSize = 1e3;
      const scannedModuleURLs = /* @__PURE__ */ new Set();
      const state = {
        runtimeStore: null,
        userStore: null,
        active: false,
        manualActive: false,
        hotkeyHeld: false,
        hotkeyCode: "AltLeft",
        busy: false,
        dragging: false,
        pointerID: null,
        dragStart: null,
        dragEnd: null,
        trustedEvent: null,
        pendingRequestID: null,
        fillRevision: 0,
        queuedDraftPixels: /* @__PURE__ */ new Set(),
        lastChargeSnapshot: null,
        suppressClickUntil: 0,
        toggleButton: null,
        marquee: null,
        alert: null,
        alertTimer: null,
        syncFrame: null
      };
      const selectAreaIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path class="bm-paint-area-cursor" d="m9 8 7.15 7.15-3.05.55-1.55 3.05z"/></svg>';
      const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
      function setButtonState(buttonState, title) {
        const button = state.toggleButton;
        if (!button) {
          return;
        }
        button.dataset["state"] = buttonState;
        button.title = title;
        button.setAttribute("aria-label", title);
        button.setAttribute("aria-pressed", state.active ? "true" : "false");
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
        const alert = document.createElement("div");
        alert.className = "bm-paint-area-alert";
        alert.setAttribute("role", "alert");
        alert.textContent = message;
        document.body?.appendChild(alert);
        state.alert = alert;
        setButtonState("error", message);
        state.alertTimer = setTimeout(() => {
          removeAreaAlert();
          if (!state.busy) {
            setButtonState(state.active ? "active" : "idle", state.active ? "Stop selecting matching template areas" : "Select matching template area");
          }
        }, 4200);
      }
      function resetQueuedDraftPixels() {
        state.queuedDraftPixels.clear();
        state.lastChargeSnapshot = null;
      }
      function getAvailableDraftPixels() {
        const charges = Number(state.userStore?.["charges"]);
        if (!Number.isFinite(charges)) {
          return { charges: null, available: null };
        }
        const normalizedCharges = Math.max(0, Math.floor(charges));
        if (state.lastChargeSnapshot != null && normalizedCharges < state.lastChargeSnapshot) {
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
          if (![worldY, startX, endX].every(Number.isFinite)) {
            continue;
          }
          let preparedRunStart = null;
          for (let worldX = startX; worldX <= endX; worldX++) {
            const alreadyQueued = state.queuedDraftPixels.has(`${worldX},${worldY}`);
            if (!alreadyQueued && preparedRunStart == null) {
              preparedRunStart = worldX;
            }
            if (!alreadyQueued) {
              pixelCount++;
              if (pixelCount > availablePixels) {
                return { exceeded: true, runs: [], pixelCount };
              }
            }
            const closesRun = preparedRunStart != null && (alreadyQueued || worldX == endX);
            if (!closesRun) {
              continue;
            }
            preparedRuns.push([worldY, preparedRunStart, alreadyQueued ? worldX - 1 : worldX]);
            preparedRunStart = null;
          }
        }
        return { exceeded: false, runs: preparedRuns, pixelCount };
      }
      function updateSelectionActive({ cancelWork = false } = {}) {
        state.active = state.manualActive || state.hotkeyHeld;
        document.body?.classList.toggle("bm-paint-area-active", state.active);
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
          setButtonState(state.active ? "active" : "idle", state.active ? "Stop selecting matching template areas" : "Select matching template area");
        }
      }
      function isEditableTarget(target) {
        return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"]');
      }
      function handleHotkeyDown(event) {
        if (event.code != state.hotkeyCode || event.repeat || state.hotkeyHeld || !state.toggleButton || state.toggleButton.hidden) {
          return;
        }
        if (document.body?.classList.contains("bm-hotkey-recording") || isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        state.hotkeyHeld = true;
        updateSelectionActive();
      }
      function releaseHotkey(event = null) {
        if (!state.hotkeyHeld || event && event.code != state.hotkeyCode) {
          return;
        }
        event?.preventDefault();
        event?.stopImmediatePropagation();
        state.hotkeyHeld = false;
        updateSelectionActive();
      }
      function ensureToggleButton() {
        if (state.toggleButton?.isConnected) {
          return state.toggleButton;
        }
        const button = document.createElement("button");
        button.id = "bm-paint-area-toggle";
        button.type = "button";
        button.className = "bm-paint-area-toggle";
        button.innerHTML = selectAreaIcon;
        button.hidden = true;
        button.onclick = async (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (state.busy) {
            return;
          }
          if (!state.runtimeStore?.["map"]) {
            await discoverWplaceRuntime();
          }
          if (!state.runtimeStore?.["map"]) {
            setButtonState("error", "Wplace paint runtime is unavailable");
            return;
          }
          state.manualActive = !state.active;
          updateSelectionActive();
        };
        document.body?.appendChild(button);
        state.toggleButton = button;
        setButtonState("idle", "Select matching template area");
        return button;
      }
      async function discoverWplaceRuntime() {
        if (state.runtimeStore?.["map"]) {
          return state.runtimeStore["map"];
        }
        const resourceURLs = performance.getEntriesByType("resource").map((entry) => entry.name);
        const preloadURLs = Array.from(document.querySelectorAll('link[rel="modulepreload"][href]'), (link) => link.href);
        const moduleURLs = Array.from(new Set([...resourceURLs, ...preloadURLs].filter((url) => {
          try {
            const parsedURL = new URL(url, window.location.href);
            return parsedURL.origin == window.location.origin && parsedURL.pathname.includes("/_app/immutable/chunks/") && parsedURL.pathname.endsWith(".js");
          } catch {
            return false;
          }
        })));
        for (const moduleURL of moduleURLs) {
          if (scannedModuleURLs.has(moduleURL)) {
            continue;
          }
          scannedModuleURLs.add(moduleURL);
          try {
            const module = await import(moduleURL);
            for (const candidate of Object.values(module)) {
              if (!candidate || typeof candidate != "object" && typeof candidate != "function") {
                continue;
              }
              try {
                if (!state.runtimeStore && "automatedClicks" in candidate && "map" in candidate) {
                  state.runtimeStore = candidate;
                }
                if (!state.userStore && "charges" in candidate && "data" in candidate && typeof candidate["refresh"] == "function") {
                  state.userStore = candidate;
                }
              } catch {
              }
            }
            if (state.runtimeStore?.["map"] && state.userStore) {
              break;
            }
          } catch {
          }
        }
        return state.runtimeStore?.["map"] ?? null;
      }
      function getPaintClickListener(map) {
        const listeners = map?.["_listeners"]?.["click"];
        if (!Array.isArray(listeners)) {
          return null;
        }
        return listeners.slice().reverse().find((listener) => {
          try {
            const source = Function.prototype.toString.call(listener);
            return source.includes("automatedClicks") && source.includes("originalEvent");
          } catch {
            return false;
          }
        }) ?? null;
      }
      function getTileZoom(map) {
        const pixelSource = map?.["getSource"]?.("pixel-art-layer");
        const tileZoom = Number(pixelSource?.["maxzoom"] ?? pixelSource?.["_options"]?.["maxzoom"]);
        return Number.isFinite(tileZoom) ? tileZoom : 11;
      }
      function latLonToWorldPixel(lat, lng, tileZoom) {
        const halfWorldMeters = Math.PI * 6378137;
        const initialResolution = 2 * halfWorldMeters / tileSize;
        const metersX = lng / 180 * halfWorldMeters;
        const metersY = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180) * halfWorldMeters / 180;
        const resolution = initialResolution / 2 ** tileZoom;
        return [
          Math.floor((metersX + halfWorldMeters) / resolution),
          Math.floor((halfWorldMeters - metersY) / resolution)
        ];
      }
      function worldPixelToLatLon(pixelX, pixelY, tileZoom) {
        const halfWorldMeters = Math.PI * 6378137;
        const initialResolution = 2 * halfWorldMeters / tileSize;
        const resolution = initialResolution / 2 ** tileZoom;
        const metersX = pixelX * resolution - halfWorldMeters;
        const metersY = halfWorldMeters - pixelY * resolution;
        const lng = metersX / halfWorldMeters * 180;
        let lat = metersY / halfWorldMeters * 180;
        lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
        return { "lat": lat, "lng": lng };
      }
      function clientPointToWorldPixel(map, clientX, clientY) {
        const canvas = map["getCanvas"]();
        const rect = canvas.getBoundingClientRect();
        const lngLat = map["unproject"]([clientX - rect.left, clientY - rect.top]);
        return latLonToWorldPixel(lngLat["lat"], lngLat["lng"], getTileZoom(map));
      }
      function updateMarquee() {
        if (!state.dragStart || !state.dragEnd) {
          return;
        }
        if (!state.marquee) {
          state.marquee = document.createElement("div");
          state.marquee.className = "bm-paint-area-marquee";
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
        return target instanceof Node && !!map?.["getCanvasContainer"]?.().contains(target);
      }
      function handlePointerDown(event) {
        const map = state.runtimeStore?.["map"];
        if (!state.active || state.busy || !map || event.button != 0 || !event.isTrusted || !isMapCanvasTarget(event.target, map)) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        state.dragging = true;
        state.pointerID = event.pointerId;
        state.dragStart = { x: event.clientX, y: event.clientY };
        state.dragEnd = { ...state.dragStart };
        state.trustedEvent = event;
        state.suppressClickUntil = Date.now() + 750;
        setButtonState("selecting", "Selecting template area");
        updateMarquee();
      }
      function handlePointerMove(event) {
        if (!state.dragging || event.pointerId != state.pointerID) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        state.dragEnd = { x: event.clientX, y: event.clientY };
        state.trustedEvent = event;
        updateMarquee();
      }
      function handlePointerUp(event) {
        const map = state.runtimeStore?.["map"];
        if (!state.dragging || !map || event.pointerId != state.pointerID) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        state.dragging = false;
        state.pointerID = null;
        state.dragEnd = { x: event.clientX, y: event.clientY };
        state.trustedEvent = event;
        state.suppressClickUntil = Date.now() + 750;
        removeMarquee();
        const colorID = Number(localStorage.getItem("selected-color"));
        if (!Number.isInteger(colorID) || colorID <= 0) {
          setButtonState("error", "Select a non-transparent Wplace color first");
          return;
        }
        const startPixel = clientPointToWorldPixel(map, state.dragStart.x, state.dragStart.y);
        const endPixel = clientPointToWorldPixel(map, state.dragEnd.x, state.dragEnd.y);
        const budget = getAvailableDraftPixels();
        if (budget.charges == null) {
          showAreaAlert("Could not determine available Wplace pixels. Try again after the charge counter loads.");
          return;
        }
        if (budget.available <= 0) {
          showAreaAlert("No Wplace pixels are available. Paint or clear the current draft before selecting another area.");
          return;
        }
        const requestID = crypto.randomUUID();
        state.pendingRequestID = requestID;
        state.busy = true;
        setButtonState("loading", "Finding matching template pixels");
        window.postMessage({
          source: "blue-marble",
          action: "paint-area-selected",
          requestID,
          colorID,
          maxPixels: Math.min(100001, budget.charges + 1),
          bounds: {
            minX: Math.min(startPixel[0], endPixel[0]),
            minY: Math.min(startPixel[1], endPixel[1]),
            maxX: Math.max(startPixel[0], endPixel[0]),
            maxY: Math.max(startPixel[1], endPixel[1])
          }
        }, "*");
      }
      function handleClickCapture(event) {
        const map = state.runtimeStore?.["map"];
        if (!state.active || !map || !isMapCanvasTarget(event.target, map)) {
          return;
        }
        if (state.dragging || Date.now() <= state.suppressClickUntil) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }
      function handleDraftActionCapture(event) {
        const button = event.target instanceof Element ? event.target.closest("button") : null;
        if (!button || button == state.toggleButton) {
          return;
        }
        const label = String(button.getAttribute("aria-label") || button.textContent || "").trim().toLowerCase();
        if (label == "clear" || label == "clear draft") {
          queueMicrotask(resetQueuedDraftPixels);
        }
      }
      function beginPreviewCoalescing(map) {
        const serviceWorkers = navigator.serviceWorker;
        const controller = serviceWorkers?.controller;
        const originalPostMessage = controller?.postMessage;
        const originalRefreshTiles = map?.["refreshTiles"];
        let latestPreviewMessage = null;
        let pendingSourceID = null;
        let postMessagePatched = false;
        let refreshPatched = false;
        try {
          if (controller && typeof originalPostMessage == "function") {
            controller.postMessage = function(message, ...args) {
              if (message?.["type"] == "previewPixels") {
                latestPreviewMessage = message;
                queueMicrotask(() => serviceWorkers.dispatchEvent(new MessageEvent("message", { "data": { "id": message["id"] } })));
                return;
              }
              return originalPostMessage.call(this, message, ...args);
            };
            postMessagePatched = true;
          }
        } catch {
        }
        try {
          if (map && typeof originalRefreshTiles == "function") {
            map["refreshTiles"] = function(sourceID) {
              pendingSourceID = sourceID ?? pendingSourceID;
              return this;
            };
            refreshPatched = true;
          }
        } catch {
        }
        const restore = () => {
          if (postMessagePatched) {
            controller.postMessage = originalPostMessage;
          }
          if (refreshPatched) {
            map["refreshTiles"] = originalRefreshTiles;
          }
        };
        const flush = async () => {
          restore();
          if (latestPreviewMessage && controller && typeof originalPostMessage == "function") {
            await new Promise((resolve) => {
              const finish = () => {
                clearTimeout(timeoutID);
                serviceWorkers.removeEventListener("message", responseHandler);
                resolve();
              };
              const responseHandler = (event) => {
                if (event.data?.["id"] == latestPreviewMessage["id"]) {
                  finish();
                }
              };
              const timeoutID = setTimeout(finish, 1200);
              serviceWorkers.addEventListener("message", responseHandler);
              originalPostMessage.call(controller, latestPreviewMessage);
            });
          }
          if (map && typeof originalRefreshTiles == "function") {
            originalRefreshTiles.call(map, pendingSourceID ?? "pixel-art-layer");
          }
        };
        return { flush, restore };
      }
      async function fillPaintDraft(data) {
        if (data.requestID != state.pendingRequestID) {
          return;
        }
        const map = state.runtimeStore?.["map"] ?? await discoverWplaceRuntime();
        const paintClickListener = getPaintClickListener(map);
        if (!map || !paintClickListener) {
          throw new Error("Wplace paint handler is unavailable.");
        }
        const selectedColorID = Number(localStorage.getItem("selected-color"));
        if (selectedColorID != Number(data.colorID)) {
          throw new Error("Selected Wplace color changed during area scan.");
        }
        const budget = getAvailableDraftPixels();
        if (budget.charges == null) {
          state.pendingRequestID = null;
          state.busy = false;
          showAreaAlert("Could not determine available Wplace pixels. Nothing was added.");
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
        const previousMuted = state.runtimeStore["muted"];
        const preview = beginPreviewCoalescing(map);
        state.runtimeStore["muted"] = true;
        state.busy = true;
        setButtonState("filling", `Adding ${Number(data.pixelCount) || 0} pixels to Wplace draft`);
        let queuedPixels = 0;
        let workSliceStarted = performance.now();
        try {
          for (const run of runs) {
            const worldY = Number(run?.[0]);
            const startX = Number(run?.[1]);
            const endX = Number(run?.[2]);
            if (![worldY, startX, endX].every(Number.isFinite)) {
              continue;
            }
            for (let worldX = startX; worldX <= endX; worldX++) {
              if (fillRevision != state.fillRevision) {
                return;
              }
              const lngLat = worldPixelToLatLon(worldX + 0.5, worldY + 0.5, getTileZoom(map));
              const point = map["project"]({ "lng": lngLat["lng"], "lat": lngLat["lat"] });
              paintClickListener.call(map, {
                "type": "click",
                "target": map,
                "originalEvent": state.trustedEvent,
                "lngLat": lngLat,
                "point": point
              });
              state.queuedDraftPixels.add(`${worldX},${worldY}`);
              queuedPixels++;
              if (performance.now() - workSliceStarted >= 5) {
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
          setButtonState("success", queuedPixels ? `Processed ${queuedPixels} matching pixels in Wplace draft` : "No matching template pixels in selected area");
          setTimeout(() => {
            if (!state.busy) {
              setButtonState(state.active ? "active" : "idle", state.active ? "Stop selecting matching template areas" : "Select matching template area");
            }
          }, 1600);
        } finally {
          preview.restore();
          state.runtimeStore["muted"] = previousMuted;
          if (fillRevision == state.fillRevision) {
            state.busy = false;
          }
        }
      }
      window.addEventListener("message", (event) => {
        const data = event.data;
        if (data?.source != "blue-marble") {
          return;
        }
        if (data.action == "paint-area-hotkey-setting") {
          const hotkeyCode = String(data.code ?? "");
          if (!/^[A-Za-z][A-Za-z0-9]{1,31}$/.test(hotkeyCode)) {
            return;
          }
          state.hotkeyHeld = false;
          state.hotkeyCode = hotkeyCode;
          updateSelectionActive();
        } else if (data.action == "paint-area-fill") {
          void fillPaintDraft(data).catch((error) => {
            if (data.requestID != state.pendingRequestID) {
              return;
            }
            state.pendingRequestID = null;
            state.busy = false;
            setButtonState("error", error instanceof Error ? error.message : String(error));
          });
        } else if (data.action == "paint-area-error" && data.requestID == state.pendingRequestID) {
          state.pendingRequestID = null;
          state.busy = false;
          setButtonState("error", data.message || "Could not fill selected area");
        }
      });
      async function syncPaintMode() {
        state.syncFrame = null;
        const paintModeVisible = !!document.querySelector("#color-1");
        if (paintModeVisible) {
          await discoverWplaceRuntime();
        }
        const button = ensureToggleButton();
        button.hidden = !paintModeVisible;
        if (!paintModeVisible && (state.active || state.busy)) {
          state.manualActive = false;
          state.hotkeyHeld = false;
          updateSelectionActive({ cancelWork: true });
          resetQueuedDraftPixels();
          removeAreaAlert();
        }
      }
      const schedulePaintModeSync = () => {
        if (state.syncFrame != null) {
          return;
        }
        state.syncFrame = requestAnimationFrame(() => void syncPaintMode());
      };
      const paintModeObserver = new MutationObserver(schedulePaintModeSync);
      paintModeObserver.observe(document.documentElement, { childList: true, subtree: true });
      window.addEventListener("pointerdown", handlePointerDown, true);
      window.addEventListener("pointermove", handlePointerMove, true);
      window.addEventListener("pointerup", handlePointerUp, true);
      window.addEventListener("pointercancel", handlePointerUp, true);
      window.addEventListener("click", handleClickCapture, true);
      window.addEventListener("click", handleDraftActionCapture, true);
      window.addEventListener("keydown", handleHotkeyDown, true);
      window.addEventListener("keyup", releaseHotkey, true);
      window.addEventListener("blur", () => releaseHotkey());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState == "hidden") {
          releaseHotkey();
        }
      });
      schedulePaintModeSync();
    }
    setupPaintAreaBridge();
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const endpointName = (args[0] instanceof Request ? args[0]?.url : args[0])?.toString() || "ignore";
      let fetchArgs = args;
      let requestRefreshRevision = 0;
      if (tileRefreshRevision && endpointName.includes("/tiles/") && !endpointName.includes("openfreemap") && !endpointName.includes("maps")) {
        try {
          const refreshedURL = new URL(endpointName, window.location.href);
          refreshedURL.searchParams.set("bm-revision", tileRefreshRevision.toString());
          const refreshedInput = args[0] instanceof Request ? new Request(refreshedURL.toString(), args[0]) : refreshedURL.toString();
          fetchArgs = [refreshedInput, ...args.slice(1)];
          requestRefreshRevision = tileRefreshRevision;
        } catch (error) {
          console.warn(`%c${name2}%c: Failed to revise tile URL`, consoleStyle2, "", error);
        }
      }
      if (requestRefreshRevision) {
        window.postMessage({
          source: "blue-marble",
          action: "refresh-progress",
          revision: requestRefreshRevision,
          state: "started"
        }, "*");
      }
      let refreshCompletionSent = false;
      const completeRefreshRequest = () => {
        if (!requestRefreshRevision || refreshCompletionSent) {
          return;
        }
        refreshCompletionSent = true;
        window.postMessage({
          source: "blue-marble",
          action: "refresh-progress",
          revision: requestRefreshRevision,
          state: "completed"
        }, "*");
      };
      let response;
      try {
        response = await originalFetch.apply(this, fetchArgs);
      } catch (error) {
        completeRefreshRequest();
        throw error;
      }
      const cloned = response.clone();
      const contentType = cloned.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        console.log(`%c${name2}%c: Sending JSON message about endpoint "${endpointName}"`, consoleStyle2, "");
        cloned.json().then((jsonData) => {
          const endpointText = endpointName?.split("?")[0].split("/").filter((s) => s && isNaN(Number(s))).filter((s) => s && !s.includes(".")).pop();
          if (endpointText == "me") {
            try {
              sessionStorage.setItem("bm-last-me", JSON.stringify(jsonData));
            } catch (error) {
              console.warn(`%c${name2}%c: Failed to cache "/me" payload`, consoleStyle2, "", error);
            }
          }
          window.postMessage({
            source: "blue-marble",
            endpoint: endpointName,
            jsonData
          }, "*");
        }).catch((err) => {
          console.error(`%c${name2}%c: Failed to parse JSON: `, consoleStyle2, "", err);
        });
      } else if (contentType.includes("image/") && (!endpointName.includes("openfreemap") && !endpointName.includes("maps"))) {
        const blink = Date.now();
        const blob = await cloned.blob();
        console.log(`%c${name2}%c: ${fetchedBlobQueue.size} Sending IMAGE message about endpoint "${endpointName}"`, consoleStyle2, "");
        return new Promise((resolve) => {
          const blobUUID = crypto.randomUUID();
          fetchedBlobQueue.set(blobUUID, (blobProcessed) => {
            resolve(new Response(blobProcessed, {
              headers: cloned.headers,
              status: cloned.status,
              statusText: cloned.statusText
            }));
            console.log(`%c${name2}%c: ${fetchedBlobQueue.size} Processed blob "${blobUUID}"`, consoleStyle2, "");
            completeRefreshRequest();
          });
          window.postMessage({
            source: "blue-marble",
            endpoint: endpointName,
            blobID: blobUUID,
            blobData: blob,
            blink
          });
        }).catch((exception) => {
          completeRefreshRequest();
          const elapsed = Date.now();
          console.error(`%c${name2}%c: Failed to Promise blob!`, consoleStyle2, "");
          console.groupCollapsed(`%c${name2}%c: Details of failed blob Promise:`, consoleStyle2, "");
          console.log(`Endpoint: ${endpointName}
There are ${fetchedBlobQueue.size} blobs processing...
Blink: ${blink.toLocaleString()}
Time Since Blink: ${String(Math.floor(elapsed / 6e4)).padStart(2, "0")}:${String(Math.floor(elapsed / 1e3) % 60).padStart(2, "0")}.${String(elapsed % 1e3).padStart(3, "0")} MM:SS.mmm`);
          console.error(`Exception stack:`, exception);
          console.groupEnd();
        });
      }
      completeRefreshRequest();
      return response;
    };
  });
  var cssOverlay = GM_getResourceText("CSS-BM-File");
  GM_addStyle(cssOverlay);
  function appendFontStylesheet(href) {
    const stylesheetLink = document.createElement("link");
    stylesheetLink.href = href;
    stylesheetLink.rel = "preload";
    stylesheetLink.as = "style";
    stylesheetLink.onload = function() {
      this.onload = null;
      this.rel = "stylesheet";
    };
    document.head?.appendChild(stylesheetLink);
  }
  var robotoMonoInjectionPoint = "robotoMonoInjectionPoint";
  appendFontStylesheet("https://fonts.googleapis.com/css2?family=Michroma&family=Rajdhani:wght@400;500;600;700&display=swap");
  if (!!(robotoMonoInjectionPoint.indexOf("@font-face") + 1)) {
    console.log(`Loading Roboto Mono as a file...`);
    GM_addStyle(robotoMonoInjectionPoint);
  } else {
    appendFontStylesheet("https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,100..700;1,100..700&display=swap");
  }
  function readStoredJSON(key, fallback = {}) {
    try {
      const storedValue = GM_getValue(key, JSON.stringify(fallback));
      const parsedValue = typeof storedValue == "string" ? JSON.parse(storedValue) : storedValue;
      return parsedValue && typeof parsedValue == "object" ? parsedValue : structuredClone(fallback);
    } catch (error) {
      consoleWarn(`Could not parse userscript storage "${key}".`, error);
      return structuredClone(fallback);
    }
  }
  var userSettings = readStoredJSON("bmUserSettings");
  var runtimeMarkerID = "bm-userscript-runtime";
  var existingRuntimeMarker = document.querySelector("meta[data-blue-marble-runtime]");
  var shouldInitializeRuntime = !existingRuntimeMarker;
  if (!shouldInitializeRuntime) {
    consoleWarn(`%c${name}%c: A userscript runtime is already active; skipping duplicate initialization.`, consoleStyle, "");
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
        let observeBlack = function() {
          const observer = new MutationObserver((mutations, observer2) => {
            const black = document.querySelector("#color-1");
            if (!black) {
              return;
            }
            let move = document.querySelector("#bm-button-move");
            if (!move) {
              move = document.createElement("button");
              move.id = "bm-button-move";
              move.textContent = "Move \u2191";
              move.className = "btn btn-soft";
              move.onclick = function() {
                const roundedBox = this.parentNode.parentNode.parentNode.parentNode;
                const shouldMoveUp = this.textContent == "Move \u2191";
                roundedBox.parentNode.className = roundedBox.parentNode.className.replace(shouldMoveUp ? "bottom" : "top", shouldMoveUp ? "top" : "bottom");
                roundedBox.style.borderTopLeftRadius = shouldMoveUp ? "0px" : "var(--radius-box)";
                roundedBox.style.borderTopRightRadius = shouldMoveUp ? "0px" : "var(--radius-box)";
                roundedBox.style.borderBottomLeftRadius = shouldMoveUp ? "var(--radius-box)" : "0px";
                roundedBox.style.borderBottomRightRadius = shouldMoveUp ? "var(--radius-box)" : "0px";
                this.textContent = shouldMoveUp ? "Move \u2193" : "Move \u2191";
              };
              const paintPixelContainer = black.parentNode?.parentNode?.parentNode?.parentNode;
              const paintPixel = paintPixelContainer?.querySelector("h2");
              paintPixel?.parentNode?.appendChild(move);
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
          return () => observer.disconnect();
        };
        const observers = new Observers();
        const windowMain = new WindowMain(name, version);
        activeWindowMain = windowMain;
        const templateManager = new TemplateManager(name, version);
        const apiManager = new ApiManager(templateManager);
        const settingsManager = new SettingsManager(name, version, userSettings);
        windowMain.setSettingsManager(settingsManager);
        windowMain.setApiManager(apiManager);
        templateManager.setWindowMain(windowMain);
        templateManager.setSettingsManager(settingsManager);
        stopPaintAreaSelectionBridge = templateManager.startPaintAreaSelectionBridge();
        const storageTemplates = readStoredJSON("bmTemplates");
        console.log(storageTemplates);
        runtimeMarker = document.createElement("meta");
        runtimeMarker.id = runtimeMarkerID;
        runtimeMarker.dataset["version"] = version;
        runtimeMarker.dataset["blueMarbleRuntime"] = "true";
        runtimeMarker.dataset["runtimeState"] = "initializing";
        document.documentElement.appendChild(runtimeMarker);
        console.log(userSettings);
        console.log(Object.keys(userSettings).length);
        if (Object.keys(userSettings).length == 0) {
          const uuid = crypto.randomUUID();
          console.log(uuid);
          await GM.setValue("bmUserSettings", JSON.stringify({
            "uuid": uuid
          }));
        }
        heartbeatInterval = setInterval(() => apiManager.sendHeartbeat(version), 1e3 * 60 * 30);
        const currentTelemetryVersion = 1;
        const previousTelemetryVersion = userSettings?.telemetry;
        console.log(`Telemetry is ${!(previousTelemetryVersion == void 0)}`);
        if (previousTelemetryVersion == void 0 || previousTelemetryVersion > currentTelemetryVersion) {
          const windowTelemetry = new WindowTelemetry(name, version, currentTelemetryVersion, userSettings?.uuid);
          activeTelemetryWindow = windowTelemetry;
          windowTelemetry.setApiManager(apiManager);
          await windowTelemetry.buildWindow();
        }
        await initializeBlueMarble();
        runtimeMarker.dataset["runtimeState"] = "ready";
        async function initializeBlueMarble() {
          let templateImportError = null;
          let templateImportWarning = null;
          try {
            await templateManager.importJSON(storageTemplates);
            if (templateManager.getTemplateStatisticsState() == "degraded") {
              templateImportWarning = "Some stored templates were damaged and could not be loaded.";
            }
          } catch (error) {
            templateImportError = error;
            console.error("Blue Marble: Could not import stored templates.", error);
          }
          stopSpontaneousResponseListener = apiManager.spontaneousResponseListener(windowMain);
          windowMain.buildWindow();
          windowMain.buildWindowFilter({ "respectSavedVisibility": true });
          if (templateImportError) {
            windowMain.handleDisplayError(`Stored templates could not be loaded: ${templateImportError instanceof Error ? templateImportError.message : String(templateImportError)}`);
          } else if (templateImportWarning) {
            windowMain.handleDisplayError(templateImportWarning);
          }
          apiManager.applyCachedUserData(windowMain);
          void apiManager.requestCurrentUserData(windowMain);
          stopBlackObserver = observeBlack();
          consoleLog(`%c${name}%c (${version}) userscript has loaded!`, "color: cornflowerblue;", "");
        }
      } catch (error) {
        if (heartbeatInterval != null) {
          clearInterval(heartbeatInterval);
        }
        stopBlackObserver?.();
        stopSpontaneousResponseListener?.();
        stopPaintAreaSelectionBridge?.();
        activeWindowMain?.windowFilter?.dispose();
        document.getElementById(activeWindowMain?.windowID)?.remove();
        document.getElementById(activeTelemetryWindow?.windowID)?.remove();
        runtimeMarker?.remove();
        console.error("Blue Marble: Runtime initialization failed.", error);
      }
    })();
  }
})();

// Build Hash: 46648fa61213
