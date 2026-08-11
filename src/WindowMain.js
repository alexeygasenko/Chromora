import Overlay, { minimizeIconExpanded } from "./Overlay";
import { settingsIcon, templatesIcon } from "./uiIcons";
import WindowFilter from "./WindowFilter";
import WindowTemplates from "./WindowTemplates";

/** The overlay builder for the main Blue Marble window.
 * @description This class handles the overlay UI for the main window of the Blue Marble userscript.
 * @class WindowMain
 * @since 0.88.326
 * @see {@link Overlay} for examples
 */
export default class WindowMain extends Overlay {

  /** Constructor for the main Blue Marble window
   * @param {string} name - The name of the userscript
   * @param {string} version - The version of the userscript
   * @since 0.88.326
   * @see {@link Overlay#constructor}
   */
  constructor(name, version) {
    super(name, version); // Executes the code in the Overlay constructor
    this.window = null; // Contains the *window* DOM tree
    this.windowID = 'bm-window-main'; // The ID attribute for this window
    this.windowParent = document.body; // The parent of the window DOM tree
    this.windowFilter = null; // Single owner for Color Filter timers and DOM
    this.windowTemplates = null; // Lazily-created owner for the Templates window
  }

  /** Creates the main Blue Marble window.
   * Parent/child relationships in the DOM structure below are indicated by indentation.
   * @since 0.58.3
   */
  buildWindow() {

    // If the main window already exists, throw an error and return early
    if (document.querySelector(`#${this.windowID}`)) {
      this.handleDisplayError('Main window already exists!');
      return;
    }

    // Creates the window
    this.window = this.addDiv({'id': this.windowID, 'class': 'bm-window bm-windowed', 'style': 'top: 10px; left: unset; right: 75px;'}, (instance, div) => {
      // div.onclick = (event) => {
      //   if (event.target.closest('button, a, input, select')) {return;} // Exit-early if interactive child was clicked
      //   div.parentElement.appendChild(div); // When the window is clicked on, bring to top
      // }
    }).addDragbar()
        .addButton({'class': 'bm-button-circle', 'innerHTML': minimizeIconExpanded, 'aria-label': 'Minimize window "Chromora"', 'data-button-status': 'expanded'}, (instance, button) => {
          button.onclick = () => instance.handleMinimization(button);
        }).buildElement()
        .addDiv({'class': 'bm-main-drag-brand'})
          .addHeader(1, {'class': 'bm-dragbar-title-persistent', 'textContent': this.name}).buildElement()
        .buildElement()
        .addDiv({'class': 'bm-flex-center'})
          .addButton({'class': 'bm-button-circle', 'innerHTML': templatesIcon, 'title': 'Templates', 'aria-label': 'Open templates'}, (instance, button) => {
            button.onclick = () => instance.buildWindowTemplates();
          }).buildElement()
          .addButton({'class': 'bm-button-circle', 'innerHTML': settingsIcon, 'title': 'Settings', 'aria-label': 'Open settings'}, (instance, button) => {
            button.onclick = () => {
              instance.settingsManager.buildWindow();
            }
          }).buildElement()
        .buildElement()
      .buildElement()
      .addDiv({'class': 'bm-window-content'})
        .addHr({'class': 'bm-window-divider-top'}).buildElement()
        .addDiv({'class': 'bm-container bm-main-stats'})
          .addDiv({'class': 'bm-main-stat-card bm-main-stat-card-value'})
            .addSpan({'class': 'bm-main-stat-label', 'textContent': 'Droplets'}).buildElement()
            .addSpan({'id': 'bm-user-droplets', 'class': 'bm-main-stat-value', 'textContent': '0'}).buildElement()
          .buildElement()
          .addDiv({'class': 'bm-main-stat-card bm-main-stat-card-value'})
            .addSpan({'class': 'bm-main-stat-label', 'textContent': 'Next Level'}).buildElement()
            .addSpan({'id': 'bm-user-nextlevel', 'class': 'bm-main-stat-value', 'textContent': '0 px'}).buildElement()
          .buildElement()
          .addDiv({'class': 'bm-main-stat-card bm-main-stat-card-timer'})
            .addSpan({'class': 'bm-main-stat-label', 'textContent': 'Charges'}).buildElement()
            .addTimer(Date.now(), 1000, {'class': 'bm-main-stat-value', 'style': 'font-weight: 700;'}, (instance, timer) => {
              instance.apiManager.chargeRefillTimerID = timer.id; // Store the timer ID in apiManager so we can update the timer automatically
            }).buildElement()
          .buildElement()
        .buildElement()
        .addHr().buildElement()
        .addDiv({'class': 'bm-flex-between bm-main-actions'})
          .addButton({'class': 'bm-button-secondary', 'textContent': 'Disable', 'data-button-status': 'shown'}, (instance, button) => {
            button.onclick = () => {
              button.disabled = true; // Disables the button until the transition ends
              if (button.dataset['buttonStatus'] == 'shown') { // If templates are currently being 'shown' then hide them
                instance.apiManager?.templateManager?.setTemplatesShouldBeDrawn(false); // Disables templates from being drawn
                button.dataset['buttonStatus'] = 'hidden'; // Swap internal button status tracker
                button.textContent = 'Enable'; // Swap button text
                instance.handleDisplayStatus(`Disabled templates!`); // Inform the user
              } else { // In all other cases, we should show templates instead of hiding them
                instance.apiManager?.templateManager?.setTemplatesShouldBeDrawn(true); // Allows templates to be drawn
                button.dataset['buttonStatus'] = 'shown'; // Swap internal button status tracker
                button.textContent = 'Disable'; // Swap button text
                instance.handleDisplayStatus(`Enabled templates!`); // Inform the user
              }
              button.disabled = false; // Enables the button
            }
          }).buildElement()
          .addButton({'class': 'bm-button-secondary', 'textContent': 'Filter'}, (instance, button) => {
            button.onclick = () => this.buildWindowFilter();
          }).buildElement()
        .buildElement()
      .buildElement()
    .buildElement().buildOverlay(this.windowParent);

    // Creates dragging capability on the drag bar for dragging the window
    this.handleDrag(`#${this.windowID}.bm-window`, `#${this.windowID} .bm-dragbar`);
  }

  /** Displays the Templates window, creating its owner on first use.
   * @since 1.3.0
   */
  buildWindowTemplates() {
    this.windowTemplates ??= new WindowTemplates(this);
    this.windowTemplates.buildWindow();
  }

  /** Displays a new color filter window.
   * This is a helper function that creates a new class instance.
   * This might cause a memory leak. I pray that this is not the case...
   * @since 0.88.330
   */
  buildWindowFilter({respectSavedVisibility = false} = {}) {
    if (!this.windowFilter || (this.windowFilter.templateManager != this.apiManager?.templateManager)) {
      this.windowFilter?.dispose();
      this.windowFilter = new WindowFilter(this);
    }
    const windowFilter = this.windowFilter;
    if (respectSavedVisibility && !windowFilter.shouldAutoOpen()) {
      return;
    }
    windowFilter.buildPreferredWindow();
  }
}
