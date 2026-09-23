import WindowSettings from "./WindowSettings";
import {DEFAULT_HIGHLIGHT, INTERFACE_THEMES, normalizeHighlight, normalizeUserSettings} from './settingsSchema.js';

const interfaceThemes = INTERFACE_THEMES;
const interfaceThemeIDs = new Set(interfaceThemes.map(({id}) => id));

/** SettingsManager class for handling user settings and making them persist between sessions.
 * Logic for {@link WindowSettings} is managed here.
 * "Flags" should follow the same styling as `.classList()` and should not contain spaces.
 * A flag should always be false by default.
 * When a flag is false, it will not exist in the "flags" Array.
 * (Therefore, "flags" should be `[]` by default)
 * If it exists in the "flags" Array, then the flag is `true`.
 * @class SettingsManager
 * @since 0.91.11
 * @example
 * {
 *   "theme": "dark",
 *   "flags": ["hl-noTrans", "ftr-oWin", "te-noSkip"],
 *   "highlight": [[1,0,-1],[1,-1,0],[2,1,0],[1,0,1]],
 *   "filter": [-2,0,4,5,6,29,63],
 *   "windowFilter": {"x": 60, "y": 75, "width": 300, "height": 420},
 *   "windowSettings": {"x": 60, "y": 75}
 * }
 */
export default class SettingsManager extends WindowSettings {

  /** Constructor for the SettingsManager class
   * @param {string} name - The name of the userscript
   * @param {string} version - The version of the userscript
   * @param {Object} userSettings - The user settings as an object
   * @since 0.91.11
   */
  constructor(name, version, userSettings) {
    super(name, version); // Executes WindowSettings constructor
    
    this.userSettings = normalizeUserSettings(userSettings);
    this.renderingSettingsListeners = new Set();
    this.hotkeyRecordingCleanups = new Set();
    this.settingsDisposed = false;
    if (!this.userSettings.hotkeys || (typeof this.userSettings.hotkeys != 'object') || Array.isArray(this.userSettings.hotkeys)) {
      this.userSettings.hotkeys = {};
    }
    this.userSettings.hotkeys['paintArea'] = this.#normalizeHotkeyCode(this.userSettings.hotkeys['paintArea'], 'AltLeft');
    this.userSettings.hotkeys['paintAllArea'] = this.#normalizeHotkeyCode(this.userSettings.hotkeys['paintAllArea'], 'ControlLeft');
    delete this.userSettings.hotkeys['clearPaintArea'];
    this.userSettings['theme'] = this.#normalizeTheme(this.userSettings['theme']);
    this.#applyTheme(this.userSettings['theme']);
    // Compare against the actual persisted input so repaired settings are saved too.
    this.userSettingsOld = structuredClone(userSettings ?? {});
    this.userSettingsSaveLocation = 'bmUserSettings'; // Storage save location
    this.userSettingsSavePromise = Promise.resolve(); // Keeps storage writes in the order they were requested

    this.updateFrequency = 5000; // Cooldown between saving to storage (throttle)
    this.lastUpdateTime = 0; // When this unix timestamp is within the last 5 seconds, we should save this.userSettings to storage

    this.userStorageInterval = setInterval(() => {
      void this.updateUserStorage().catch(error => this.#reportSettingsError(error));
    }, this.updateFrequency);
    this.#broadcastPaintAreaHotkeys();
  }

  /** Release storage polling and any active keyboard recording when the runtime is disposed. */
  dispose() {
    this.settingsDisposed = true;
    clearInterval(this.userStorageInterval);
    for (const cleanup of this.hotkeyRecordingCleanups) {cleanup();}
    this.hotkeyRecordingCleanups.clear();
    this.renderingSettingsListeners.clear();
    super.dispose();
  }

  onRenderingSettingsChanged(listener) {
    if (typeof listener !== 'function') {return () => {};}
    this.renderingSettingsListeners.add(listener);
    return () => this.renderingSettingsListeners.delete(listener);
  }

  #renderingSettingsChanged() {
    for (const listener of this.renderingSettingsListeners) {
      try {listener();} catch (error) {console.error('Chromora: Could not refresh rendering settings.', error);}
    }
  }

  #reportSettingsError(error) {
    console.error('Chromora: Could not apply settings.', error);
    const status = document.querySelector('#bm-settings-status');
    if (status) {status.textContent = error instanceof Error ? error.message : String(error);}
  }

  #persistSettingsChange() {
    void this.saveUserStorageNow().catch(error => this.#reportSettingsError(error));
  }

  /** Normalizes a persisted interface theme.
   * @param {string} theme
   * @returns {'glass'|'light'|'dark'|'aero'}
   * @since 1.1.0
   */
  #normalizeTheme(theme) {
    const normalizedTheme = typeof theme === 'string' ? theme.toLowerCase() : 'glass';
    return interfaceThemeIDs.has(normalizedTheme) ? normalizedTheme : 'glass';
  }

  /** Applies an interface theme to every Chromora surface in the page.
   * @param {string} theme
   * @since 1.1.0
   */
  #applyTheme(theme) {
    document.documentElement?.setAttribute('data-chromora-theme', this.#normalizeTheme(theme));
  }

  /** Applies and immediately persists a new interface theme.
   * @param {string} theme
   * @returns {Promise<string>}
   * @since 1.1.0
   */
  async setTheme(theme) {
    const normalizedTheme = this.#normalizeTheme(theme);
    const themeChanged = this.userSettings['theme'] != normalizedTheme;
    this.userSettings['theme'] = normalizedTheme;
    this.#applyTheme(normalizedTheme);
    if (themeChanged) {
      await this.saveUserStorageNow();
    }
    return normalizedTheme;
  }

  /** Normalizes a persisted KeyboardEvent.code value.
   * @param {string} code
   * @param {string} fallbackCode
   * @returns {string}
   * @since 0.99.0
   */
  #normalizeHotkeyCode(code, fallbackCode) {
    const normalizedCode = String(code ?? '');
    return /^[A-Za-z][A-Za-z0-9]{1,31}$/.test(normalizedCode) ? normalizedCode : fallbackCode;
  }

  /** Converts KeyboardEvent.code to a compact label.
   * @param {string} code
   * @returns {string}
   * @since 0.99.0
   */
  #formatHotkeyCode(code) {
    const labels = {
      AltLeft: 'Left Alt',
      AltRight: 'Right Alt',
      ControlLeft: 'Left Ctrl',
      ControlRight: 'Right Ctrl',
      ShiftLeft: 'Left Shift',
      ShiftRight: 'Right Shift',
      MetaLeft: 'Left Meta',
      MetaRight: 'Right Meta',
      Space: 'Space'
    };
    if (labels[code]) {return labels[code];}
    if (code.startsWith('Key')) {return code.slice(3);}
    if (code.startsWith('Digit')) {return code.slice(5);}
    return code.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  /** Sends the current hotkey into the page-context paint bridge.
   * @since 0.99.0
   */
  #broadcastPaintAreaHotkeys() {
    const hotkeys = [
      ['matching', this.userSettings.hotkeys['paintArea']],
      ['template', this.userSettings.hotkeys['paintAllArea']]
    ];
    for (const [mode, code] of hotkeys) {
      window.postMessage({
        source: 'blue-marble',
        action: 'paint-area-hotkey-setting',
        mode: mode,
        code: code
      }, window.location.origin);
    }
  }

  /** Stores a new area-selection hotkey.
   * @param {'paintArea'|'paintAllArea'} settingKey
   * @param {string} code
   * @returns {Promise<void>}
   * @since 0.99.0
   */
  async setPaintAreaHotkey(settingKey, code) {
    const hotkeyDefaults = new Map([
      ['paintArea', 'AltLeft'],
      ['paintAllArea', 'ControlLeft']
    ]);
    if (!hotkeyDefaults.has(settingKey) || typeof code !== 'string' || !/^[A-Za-z][A-Za-z0-9]{1,31}$/.test(code)) {
      throw new TypeError('Choose a valid keyboard key.');
    }
    const otherSettingKey = settingKey === 'paintArea' ? 'paintAllArea' : 'paintArea';
    if (this.userSettings.hotkeys[otherSettingKey] === code) {
      throw new Error(`This key is already used for ${otherSettingKey === 'paintArea' ? 'Selected color area' : 'All template colors'}. Choose a different key.`);
    }
    this.userSettings.hotkeys[settingKey] = code;
    this.#broadcastPaintAreaHotkeys();
    await this.saveUserStorageNow();
  }

  /** Updates the user settings in userscript storage
   * @since 0.91.39
   */
  async updateUserStorage() {
    if (this.settingsDisposed) {return;}
    await this.saveUserStorage();
  }

  /** Saves the user settings in userscript storage.
   * @param {boolean} [force=false] - Should the throttle be ignored?
   * @since 0.92.0
   */
  async saveUserStorage(force = false) {
    const saveTask = async () => {
      const userSettingsSnapshot = structuredClone(this.userSettings);
      const userSettingsCurrent = JSON.stringify(userSettingsSnapshot);
      const userSettingsOld = JSON.stringify(this.userSettingsOld);

      // If the user settings have changed, AND the last update to user storage was over 5 seconds ago (5sec throttle)...
      if ((userSettingsCurrent != userSettingsOld) && (force || ((Date.now() - this.lastUpdateTime) > this.updateFrequency))) {
        await GM.setValue(this.userSettingsSaveLocation, userSettingsCurrent); // Updates user storage
        this.userSettingsOld = userSettingsSnapshot; // Tracks exactly the snapshot that was written
        this.lastUpdateTime = Date.now(); // Updates the variable that contains the last time updated
      }
    };

    this.userSettingsSavePromise = this.userSettingsSavePromise
      .catch(() => {})
      .then(saveTask);
    await this.userSettingsSavePromise;
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
  toggleFlag(flagName, state = undefined) {

    if (typeof flagName !== 'string' || !flagName) {return;}

    const flagIndex = this.userSettings?.flags?.indexOf(flagName) ?? -1; // Is the flag `true`?

    // If the flag is enabled, AND the user does not want to force the flag to be true...
    if ((flagIndex != -1) && (state !== true)) {

      this.userSettings?.flags?.splice(flagIndex, 1); // Remove the flag (makes it false)
    } else if ((flagIndex == -1) && (state !== false)) {
      // Else if the flag is disabled, AND the user does not want to force the flag to be false...
      this.userSettings?.flags?.push(flagName); // Add the flag (makes it true)
    }
    if ((flagIndex !== -1) !== this.userSettings.flags.includes(flagName)) {
      if (flagName === 'hl-noTrans') {this.#renderingSettingsChanged();}
      this.#persistSettingsChange();
    }
  }

  // This is one of the most insane OOP setups I have ever laid my eyes on

  /** Builds the appearance category of the settings window.
   * @since 1.1.0
   * @see WindowSettings#buildAppearance
   */
  buildAppearance() {
    const syncButtons = (group, selectedTheme) => {
      for (const button of group.querySelectorAll('.bm-settings-theme-option')) {
        const isSelected = button.dataset['theme'] == selectedTheme;
        button.setAttribute('aria-checked', String(isSelected));
        button.tabIndex = isSelected ? 0 : -1;
      }
    };

    this.window = this.addDiv({'class': 'bm-container'})
      .addHeader(2, {'textContent': 'Appearance'}).buildElement()
      .addHr().buildElement()
      .addDiv({
        'class': 'bm-settings-theme-grid',
        'role': 'radiogroup',
        'aria-label': 'Interface theme'
      }, (instance, group) => {
        const selectButton = button => {
          const selectedTheme = this.#normalizeTheme(button.dataset['theme']);
          syncButtons(group, selectedTheme);
          void this.setTheme(selectedTheme).catch(error => {
            this.#reportSettingsError(error);
          });
        };

        for (const theme of interfaceThemes) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'bm-settings-theme-option';
          button.dataset['theme'] = theme.id;
          button.setAttribute('role', 'radio');
          button.setAttribute('aria-label', `${theme.label}: ${theme.description}`);

          const preview = document.createElement('span');
          preview.className = 'bm-settings-theme-preview';
          preview.dataset['themePreview'] = theme.id;
          preview.setAttribute('aria-hidden', 'true');
          for (let previewLineIndex = 0; previewLineIndex < 3; previewLineIndex++) {
            preview.appendChild(document.createElement('span'));
          }

          const label = document.createElement('span');
          label.className = 'bm-settings-theme-label';
          label.textContent = theme.label;

          const description = document.createElement('span');
          description.className = 'bm-settings-theme-description';
          description.textContent = theme.description;

          button.append(preview, label, description);
          button.onclick = () => selectButton(button);
          button.onkeydown = event => {
            const buttons = Array.from(group.querySelectorAll('.bm-settings-theme-option'));
            const currentIndex = buttons.indexOf(button);
            let nextIndex = currentIndex;
            if (['ArrowRight', 'ArrowDown'].includes(event['key'])) {
              nextIndex = (currentIndex + 1) % buttons.length;
            } else if (['ArrowLeft', 'ArrowUp'].includes(event['key'])) {
              nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
            } else if (event['key'] == 'Home') {
              nextIndex = 0;
            } else if (event['key'] == 'End') {
              nextIndex = buttons.length - 1;
            } else {
              return;
            }
            event.preventDefault();
            const nextButton = buttons[nextIndex];
            nextButton.focus({'preventScroll': true});
            selectButton(nextButton);
          };
          group.appendChild(button);
        }

        syncButtons(group, this.userSettings['theme']);
      }).buildElement()
    .buildElement();
  }

  /** Builds the hotkey category of the settings window.
   * @since 0.99.0
   * @see WindowSettings#buildHotkeys
   */
  buildHotkeys() {
    for (const cleanup of this.hotkeyRecordingCleanups) {cleanup();}
    this.hotkeyRecordingCleanups.clear();
    const configureHotkeyButton = (button, settingKey, label) => {
      let recording = false;
      const handleRecordingKeyDown = event => {
        if (!recording) {return;}
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.repeat) {return;}
        if (event.code == 'Escape') {
          stopRecording();
          return;
        }
        if (!/^[A-Za-z][A-Za-z0-9]{1,31}$/.test(event.code)) {return;}
        const status = document.querySelector('#bm-settings-status');
        if (status) {status.textContent = '';}
        const save = this.setPaintAreaHotkey(settingKey, event.code);
        // One keypress finishes capture, even while asynchronous storage is busy.
        stopRecording();
        const formattedCode = this.#formatHotkeyCode(this.userSettings.hotkeys[settingKey]);
        button.setAttribute('aria-label', `${label} hotkey: ${formattedCode}`);
        void save.catch(error => this.#reportSettingsError(error));
      };
      const stopRecording = () => {
        if (!recording) {return;}
        recording = false;
        window.removeEventListener('keydown', handleRecordingKeyDown, true);
        button.dataset['recording'] = 'false';
        button.textContent = this.#formatHotkeyCode(this.userSettings.hotkeys[settingKey]);
        if (!document.querySelector('.bm-settings-hotkey-button[data-recording="true"]')) {
          document.body?.classList.remove('bm-hotkey-recording');
        }
      };

      button.onclick = event => {
        event.preventDefault();
        if (recording) {return;}
        recording = true;
        button.dataset['recording'] = 'true';
        button.textContent = '...';
        document.body?.classList.add('bm-hotkey-recording');
        button.focus({'preventScroll': true});
        window.addEventListener('keydown', handleRecordingKeyDown, true);
      };
      button.onblur = stopRecording;
      this.hotkeyRecordingCleanups.add(stopRecording);
    };

    const matchingCode = this.userSettings.hotkeys['paintArea'];
    const templateCode = this.userSettings.hotkeys['paintAllArea'];

    this.window = this.addDiv({'class': 'bm-container'})
      .addHeader(2, {'textContent': 'Hotkeys'}).buildElement()
      .addHr().buildElement()
      .addDiv({'class': 'bm-settings-hotkey-row'})
        .addSpan({'textContent': 'Selected color area'}).buildElement()
        .addButton({
          'class': 'bm-settings-hotkey-button',
          'textContent': this.#formatHotkeyCode(matchingCode),
          'title': 'Change selected color area hotkey',
          'aria-label': `Selected color area hotkey: ${this.#formatHotkeyCode(matchingCode)}`
        }, (instance, button) => {
          configureHotkeyButton(button, 'paintArea', 'Selected color area');
        }).buildElement()
      .buildElement()
      .addDiv({'class': 'bm-settings-hotkey-row'})
        .addSpan({'textContent': 'All template colors'}).buildElement()
        .addButton({
          'class': 'bm-settings-hotkey-button',
          'textContent': this.#formatHotkeyCode(templateCode),
          'title': 'Change all template colors hotkey',
          'aria-label': `All template colors hotkey: ${this.#formatHotkeyCode(templateCode)}`
        }, (instance, button) => {
          configureHotkeyButton(button, 'paintAllArea', 'All template colors');
        }).buildElement()
      .buildElement()
    .buildElement();
  }

  /** Builds the "highlight" category of the settings window
   * @since 0.91.18
   * @see WindowSettings#buildHighlight
   */
  buildHighlight() {

    const highlightPresetOff = '<svg viewBox="0 0 3 3"><path d="M0,0H3V3H0ZM0,1H3M0,2H3M1,0V3M2,0V3" fill="#fff"/><path d="M1,1H2V2H1Z" fill="#2f4f4f"/></svg>';
    const highlightPresetCross = '<svg viewBox="0 0 3 3"><path d="M0,0H3V3H0Z" fill="#fff"/><path d="M1,0H2V1H3V2H2V3H1V2H0V1H1Z" fill="brown"/><path d="M1,1H2V2H1Z" fill="#2f4f4f"/></svg>';
    
    // Obtains user settings for highlight from storage, or the default array if nothing was found
    const storedHighlight = this.userSettings?.highlight ?? DEFAULT_HIGHLIGHT;

    // Constructs the category and adds it to the window
    this.window = this.addDiv({'class': 'bm-container'})
      .addHeader(2, {'textContent': 'Pixel Highlight'}).buildElement()
      .addHr().buildElement()
      .addDiv({'class': 'bm-container', 'style': 'margin-left: 1.5ch;'})
        .addCheckbox({'textContent': 'Highlight transparent pixels'}, (instance, label, checkbox) => {
          label.classList.add('bm-settings-checkbox');
          checkbox.checked = !this.userSettings?.flags?.includes('hl-noTrans'); // Makes the checkbox match the last stored user setting
          checkbox.onchange = (event) => this.toggleFlag('hl-noTrans', !event.target.checked); // Forces the flag to be the opposite state as the checkbox. E.g. "Checked" means 'hl-noTrans' is false (does not exist).
        }).buildElement()
        .addP({'id': 'bm-highlight-preset-label', 'class': 'bm-settings-subheading', 'textContent': 'Choose a preset'}).buildElement()
        .addDiv({'class': 'bm-flex-center', 'role': 'group', 'aria-labelledby': 'bm-highlight-preset-label'})
          .addDiv({'class': 'bm-highlight-preset-container'})
            .addSpan({'textContent': 'None'}).buildElement()
            .addButton({'innerHTML': highlightPresetOff, 'aria-label': 'Preset "None"'}, (instance, button) => {button.onclick = () => this.#updateHighlightToPreset('None')}).buildElement()
          .buildElement()
          .addDiv({'class': 'bm-highlight-preset-container'})
            .addSpan({'textContent': 'Cross'}).buildElement()
            .addButton({'innerHTML': highlightPresetCross, 'aria-label': 'Preset "Cross Shape"'}, (instance, button) => {button.onclick = () => this.#updateHighlightToPreset('Cross')}).buildElement()
          .buildElement()
          .addDiv({'class': 'bm-highlight-preset-container'})
            .addSpan({'textContent': 'X'}).buildElement()
            .addButton({'innerHTML': highlightPresetCross.replace('d="M1,0H2V1H3V2H2V3H1V2H0V1H1Z"', 'd="M0,0V1H3V0H2V3H3V2H0V3H1V0Z"'), 'aria-label': 'Preset "X Shape"'}, (instance, button) => {button.onclick = () => this.#updateHighlightToPreset('X')}).buildElement()
          .buildElement()
          .addDiv({'class': 'bm-highlight-preset-container'})
            .addSpan({'textContent': 'Full'}).buildElement()
            .addButton({'innerHTML': highlightPresetOff.replace('#fff', '#2f4f4f'), 'aria-label': 'Preset "Full Template"'}, (instance, button) => {button.onclick = () => this.#updateHighlightToPreset('Full')}).buildElement()
          .buildElement()
        .buildElement()
        .addP({'id': 'bm-highlight-grid-label', 'class': 'bm-settings-subheading', 'textContent': 'Create a custom pattern'}).buildElement()
        .addDiv({'class': 'bm-highlight-grid', 'role': 'group', 'aria-labelledby': 'bm-highlight-grid-label'});
          // We leave this open so we can add buttons

          // For each of the 9 buttons...
          for (let buttonY = -1; buttonY <= 1; buttonY++) {
            for (let buttonX = -1; buttonX <= 1; buttonX++) {
              const buttonState = storedHighlight[storedHighlight.findIndex(([, x, y]) => ((x == buttonX) && (y == buttonY)))]?.[0] ?? 0;
              let buttonStateName = 'Disabled';
              if (buttonState == 1) {
                buttonStateName = 'Incorrect';
              } else if (buttonState == 2) {
                buttonStateName = 'Template';
              }
              this.window = this.addButton({
                'data-status': buttonStateName,
                'data-x': buttonX,
                'data-y': buttonY,
                'aria-label': this.#highlightCellLabel(buttonStateName, buttonX, buttonY)
              }, (instance, button) => {
                button.onclick = () => this.#updateHighlightSettings(button, [buttonX, buttonY])
              }).buildElement();
            }
          }

          // Resumes from where we left off before we added buttons
        this.window = this.buildElement()
      .buildElement()
    .buildElement();
  }

  /** Updates the display of the highlight buttons in the settings window.
   * Additionally, it will update user settings with the new selection.
   * @param {HTMLButtonElement} button - The button that was pressed
   * @param {Array<number, number>} coords - The relative coordinates of the button
   * @since 0.91.46
   */
  #highlightCellLabel(state, x, y) {
    const vertical = ['top', 'middle', 'bottom'][y + 1];
    const horizontal = ['left', 'center', 'right'][x + 1];
    const position = x === 0 && y === 0 ? 'center' : vertical + ' ' + horizontal;
    return position + ' sub-pixel: ' + state.toLowerCase();
  }

  #syncHighlightGrid() {
    const windowElement = document.querySelector('#' + this.windowID);
    const pattern = this.userSettings.highlight;
    for (const button of windowElement?.querySelectorAll('.bm-highlight-grid button') ?? []) {
      const x = Number(button.dataset['x']), y = Number(button.dataset['y']);
      const state = pattern.find(([, cellX, cellY]) => cellX === x && cellY === y)?.[0] ?? 0;
      const name = ['Disabled', 'Incorrect', 'Template'][state];
      button.dataset['status'] = name;
      button.setAttribute('aria-label', this.#highlightCellLabel(name, x, y));
    }
  }

  /** Store the model directly; the rendered grid is only a view of this pattern. */
  async setHighlightPattern(pattern) {
    this.userSettings.highlight = normalizeHighlight(pattern);
    this.#syncHighlightGrid();
    this.#renderingSettingsChanged();
    await this.saveUserStorageNow();
  }

  #updateHighlightSettings(button, [x, y]) {
    const states = ['Disabled', 'Incorrect', 'Template'];
    const nextState = (Math.max(0, states.indexOf(button.dataset['status'])) + 1) % 3;
    const pattern = this.userSettings.highlight.filter(([, cellX, cellY]) => cellX !== x || cellY !== y);
    if (nextState) {pattern.push([nextState, x, y]);}
    void this.setHighlightPattern(pattern).catch(error => this.#reportSettingsError(error));
  }

  /** Apply a preset even when its visual grid already matches the selected value. */
  #updateHighlightToPreset(preset) {
    const presets = {
      None: [0,0,0,0,2,0,0,0,0],
      Cross: [0,1,0,1,2,1,0,1,0],
      X: [1,0,1,0,2,0,1,0,1],
      Full: [2,2,2,2,2,2,2,2,2]
    };
    const values = presets[preset] ?? presets.None;
    const pattern = values.flatMap((state, index) => state ? [[state, index % 3 - 1, Math.floor(index / 3) - 1]] : []);
    void this.setHighlightPattern(pattern).catch(error => this.#reportSettingsError(error));
  }

  /** Build the "template" category of settings window
   * @since 0.91.68
   * @see WindowSettings#buildTemplate
   */
  buildTemplate() {

    this.window = this.addDiv({'class': 'bm-container'})
      .addHeader(2, {'textContent': 'Templates'}).buildElement()
      .addHr().buildElement()
      .addDiv({'class': 'bm-container', 'style': 'margin-left: 1.5ch;'})
        .addCheckbox({'textContent': 'Template creation should skip transparent tiles'}, (instance, label, checkbox) => {
          label.classList.add('bm-settings-checkbox');
          checkbox.checked = !this.userSettings?.flags?.includes('hl-noSkip'); // Makes the checkbox match the last stored user setting
          checkbox.onchange = (event) => this.toggleFlag('hl-noSkip', !event.target.checked); // If the user wants to skip, then the checkbox is NOT checked
        }).buildElement()
        .addCheckbox({'innerHTML': '<span>Experimental: Template creation should <em>aggressively</em> skip transparent tiles</span>'}, (instance, label, checkbox) => {
          label.classList.add('bm-settings-checkbox');
          checkbox.checked = this.userSettings?.flags?.includes('hl-agSkip'); // Makes the checkbox match the last stored user setting
          checkbox.onchange = (event) => this.toggleFlag('hl-agSkip', event.target.checked); // If the user wants to aggressively skip, then the checkbox is checked
        }).buildElement()
      .buildElement()
    .buildElement()
  }
}
