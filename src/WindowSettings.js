import Overlay, { minimizeIconExpanded } from "./Overlay";
import { closeIcon } from "./uiIcons";

/** The overlay builder for the settings window in Blue Marble.
 * The logic for this window is managed in {@link SettingsManager}
 * @description This class handles the overlay UI for the settings window of the Blue Marble userscript.
 * @class WindowSettings
 * @since 0.91.11
 * @see {@link Overlay} for examples
 */
export default class WindowSettings extends Overlay {

  /** Constructor for the Settings window
   * @param {string} name - The name of the userscript
   * @param {string} version - The version of the userscript
   * @since 0.91.11
   * @see {@link Overlay#constructor} for examples
   */
  constructor(name, version) {
    super(name, version); // Executes the code in the Overlay constructor
    this.window = null; // Contains the *window* DOM tree
    this.windowID = 'bm-window-settings'; // The ID attribute for this window
    this.windowParent = document.body; // The parent of the window DOM tree
    this.windowStateKey = 'windowSettings'; // User setting key for the persisted window position
  }

  /** Spawns a Settings window.
   * If another settings window already exists, we DON'T spawn another!
   * Parent/child relationships in the DOM structure below are indicated by indentation.
   * @since 0.91.11
   */
  buildWindow({respectSavedVisibility = false} = {}) {
    if (respectSavedVisibility && this.userSettings?.windowSettings?.isOpen !== true) {return;}

    // If a settings window already exists, close it
    if (document.querySelector(`#${this.windowID}`)) {
      this.#closeWindow();
      return;
    }

    this.window = this.addDiv({'id': this.windowID, 'class': 'bm-window'})
      .addDragbar()
        .addButton({'class': 'bm-button-circle', 'innerHTML': minimizeIconExpanded, 'aria-label': 'Minimize window "Settings"', 'data-button-status': 'expanded'}, (instance, button) => {
          button.onclick = () => instance.handleMinimization(button);
        }).buildElement()
        .addDiv({'class': 'bm-settings-drag-title-slot'})
          .addHeader(1, {'class': 'bm-dragbar-title-persistent bm-settings-drag-title', 'textContent': 'Settings'}).buildElement()
        .buildElement()
        .addDiv({'class': 'bm-flex-center'})
          .addButton({'class': 'bm-button-circle', 'innerHTML': closeIcon, 'aria-label': 'Close window "Settings"'}, (instance, button) => {
            button.onclick = () => this.#closeWindow();
          }).buildElement()
        .buildElement()
      .buildElement()
      .addDiv({'class': 'bm-window-content'})
        .addHr({'class': 'bm-window-divider-top'}).buildElement()
        .addP({'id': 'bm-settings-status', 'role': 'status', 'aria-live': 'polite', 'class': 'bm-settings-status'}).buildElement()
        .addDiv({'class': 'bm-container bm-scrollable'}, (instance, div) => {
          // Each category in the settings window
          this.buildAppearance();
          this.buildHotkeys();
          this.buildHighlight();
          this.buildTemplate();
        }).buildElement()
        .addSmall({'class': 'bm-settings-version', 'textContent': `${this.name} v${this.version}`}).buildElement()
      .buildElement()
    .buildElement().buildOverlay(this.windowParent);

    this.handleDrag(`#${this.windowID}.bm-window`, `#${this.windowID} .bm-dragbar`);
    this.initializeWindowState(document.getElementById(this.windowID), {position: true});
  }

  /** Closes the settings window, preserving its position and collapsed state. */
  async #closeWindow() {
    await this.handleWindowClose(document.getElementById(this.windowID));
  }

  /** Displays an error when a settings category fails to load.
   * @param {string} name - The name of the category
   * @since 0.91.11
   */
  #errorOverrideFailure(name) {
    this.window = this.addDiv({'class': 'bm-container'})
      .addHeader(2, {'textContent': name}).buildElement()
      .addHr().buildElement()
      .addP({'innerHTML': `An error occured loading the ${name} category. <code>SettingsManager</code> failed to override the ${name} function inside <code>WindowSettings</code>.`}).buildElement()
    .buildElement();
  }

  /** Builds the highlight section of the window.
   * This should be overriden by {@link SettingsManager}
   * @since 0.91.11
   */
  buildHighlight() {
    this.#errorOverrideFailure('Pixel Highlight');
  }

  /** Builds the appearance section of the window.
   * This should be overriden by {@link SettingsManager}
   * @since 1.1.0
   */
  buildAppearance() {
    this.#errorOverrideFailure('Appearance');
  }

  /** Builds the hotkey section of the window.
   * This should be overriden by {@link SettingsManager}
   * @since 0.99.0
   */
  buildHotkeys() {
    this.#errorOverrideFailure('Hotkeys');
  }

  /** Builds the template section of the window.
   * This should be overriden by {@link SettingsManager}
   * @since 0.91.68
   */
  buildTemplate() {
    this.#errorOverrideFailure('Template');
  }
}
