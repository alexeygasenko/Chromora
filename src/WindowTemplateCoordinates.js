import Overlay from "./Overlay";

/**
 * Focused coordinate picker used while adding a template.
 * All other Chromora windows remain mounted, but are temporarily hidden.
 */
export default class WindowTemplateCoordinates extends Overlay {

  /**
   * @param {*} executor - WindowMain instance that owns the API manager
   * @param {File} file - Image selected for the new template
   * @param {Object} callbacks
   * @param {function(Array<number>):Promise<void>} callbacks.onConfirm
   * @param {function({created:boolean}):void} callbacks.onDismiss
   */
  constructor(executor, file, {onConfirm, onDismiss} = {}) {
    super(executor.name, executor.version);
    this.executor = executor;
    this.file = file;
    this.onConfirm = onConfirm ?? (async () => {});
    this.onDismiss = onDismiss ?? (() => {});
    this.windowID = 'bm-window-template-coordinates';
    this.windowParent = document.body;
    this.windowElement = null;
    this.unsubscribeCoordinates = null;
    this.coordinatePollInterval = null;
    this.escapeHandler = null;
    this.lastObservedCoordinates = '';
    this.isSubmitting = false;
    this.isClosing = false;
  }

  /** Builds the coordinate-only modal window. */
  buildWindow() {
    const existingWindow = document.getElementById(this.windowID);
    if (existingWindow) {
      existingWindow.focus?.();
      return;
    }

    const tileMaximum = 2047;
    const pixelMaximum = Math.max(0, Number(this.executor.apiManager?.templateManager?.tileSize) - 1 || 999);

    this.addDiv({
      'id': this.windowID,
      'class': 'bm-window bm-template-coordinate-window',
      'role': 'dialog',
      'aria-labelledby': 'bm-template-coordinate-title',
      'aria-describedby': 'bm-template-coordinate-help',
      'tabIndex': -1
    })
      .addDragbar()
        .addDiv({'class': 'bm-template-coordinate-drag-spacer'}).buildElement()
        .addHeader(1, {
          'id': 'bm-template-coordinate-title',
          'class': 'bm-dragbar-title-persistent',
          'textContent': 'Template coordinates'
        }).buildElement()
        .addSpan({'class': 'bm-template-coordinate-step', 'textContent': 'Step 2 of 2'}).buildElement()
      .buildElement()
      .addDiv({'class': 'bm-window-content'})
        .addHr({'class': 'bm-window-divider-top'}).buildElement()
        .addDiv({'class': 'bm-container bm-template-coordinate-file'})
          .addSmall({'textContent': 'Template'}).buildElement()
          .addSpan({'textContent': this.file?.name || 'Selected image'}).buildElement()
        .buildElement()
        .addP({
          'id': 'bm-template-coordinate-help',
          'class': 'bm-template-coordinate-help',
          'textContent': 'Choose the top-left pixel. Click it on the map to fill the fields automatically, or enter the coordinates manually.'
        }).buildElement()
        .addButton({
          'class': 'bm-button-secondary bm-template-coordinate-pick',
          'data-coordinate-action': 'pick',
          'innerHTML': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.1 7 13 7 13s7-7.9 7-13a7 7 0 0 0-7-7Zm0 10.2A3.2 3.2 0 1 1 12 5.8a3.2 3.2 0 0 1 0 6.4Z"/></svg><span>Use last map click</span>'
        }, (instance, button) => {
          button.onclick = () => this.#useLatestMapCoordinates(true);
        }).buildElement()
        .addDiv({'class': 'bm-container bm-template-coordinate-grid'})
          .addDiv({'class': 'bm-template-coordinate-field'})
            .addSpan({'textContent': 'Tile X'}).buildElement()
            .addInput({'type': 'number', 'id': 'bm-template-coordinate-tx', 'class': 'bm-input-coords', 'aria-label': 'Tile X', 'min': 0, 'max': tileMaximum, 'step': 1, 'required': true, 'inputMode': 'numeric'}).buildElement()
          .buildElement()
          .addDiv({'class': 'bm-template-coordinate-field'})
            .addSpan({'textContent': 'Tile Y'}).buildElement()
            .addInput({'type': 'number', 'id': 'bm-template-coordinate-ty', 'class': 'bm-input-coords', 'aria-label': 'Tile Y', 'min': 0, 'max': tileMaximum, 'step': 1, 'required': true, 'inputMode': 'numeric'}).buildElement()
          .buildElement()
          .addDiv({'class': 'bm-template-coordinate-field'})
            .addSpan({'textContent': 'Pixel X'}).buildElement()
            .addInput({'type': 'number', 'id': 'bm-template-coordinate-px', 'class': 'bm-input-coords', 'aria-label': 'Pixel X', 'min': 0, 'max': pixelMaximum, 'step': 1, 'required': true, 'inputMode': 'numeric'}).buildElement()
          .buildElement()
          .addDiv({'class': 'bm-template-coordinate-field'})
            .addSpan({'textContent': 'Pixel Y'}).buildElement()
            .addInput({'type': 'number', 'id': 'bm-template-coordinate-py', 'class': 'bm-input-coords', 'aria-label': 'Pixel Y', 'min': 0, 'max': pixelMaximum, 'step': 1, 'required': true, 'inputMode': 'numeric'}).buildElement()
          .buildElement()
        .buildElement()
        .addP({
          'id': 'bm-template-coordinate-status',
          'class': 'bm-template-coordinate-status',
          'role': 'status',
          'aria-live': 'polite',
          'textContent': 'Waiting for a map click or manual coordinates.'
        }).buildElement()
        .addDiv({'class': 'bm-container bm-flex-between bm-template-coordinate-actions'})
          .addButton({'class': 'bm-button-secondary', 'textContent': 'Cancel'}, (instance, button) => {
            button.dataset['coordinateAction'] = 'cancel';
            button.onclick = () => void this.#finish(false);
          }).buildElement()
          .addButton({'class': 'bm-button-primary', 'textContent': 'Create'}, (instance, button) => {
            button.dataset['coordinateAction'] = 'confirm';
            button.onclick = () => void this.#submit(button);
          }).buildElement()
        .buildElement()
      .buildElement()
    .buildElement().buildOverlay(this.windowParent);

    this.windowElement = document.getElementById(this.windowID);
    if (!this.windowElement) {return;}

    document.body.classList.add('bm-template-coordinate-mode');
    this.handleDrag(`#${this.windowID}`, `#${this.windowID} .bm-dragbar`);
    this.#bindCoordinateInputs();
    this.#startCoordinateUpdates();
    this.#bindEscapeKey();
    this.windowElement.focus();
  }

  /** Removes the picker and always restores the other windows. */
  dispose() {
    this.#stopCoordinateUpdates();
    this.#unbindEscapeKey();
    document.body?.classList.remove('bm-template-coordinate-mode');
    this.windowElement?.remove();
    this.windowElement = null;
  }

  /** Hooks manual input and four-coordinate paste handling. */
  #bindCoordinateInputs() {
    const inputs = this.#getInputs();
    for (const input of inputs) {
      input?.addEventListener('input', () => {
        this.#setStatus('Using manually entered coordinates.', 'info');
      });
      input?.addEventListener('paste', event => {
        const pastedText = event.clipboardData?.getData('text/plain') ?? '';
        const coordinates = this.#parseCoordinates(pastedText);
        if (coordinates.length != 4) {return;}
        event.preventDefault();
        this.#applyCoordinates(coordinates, 'Pasted coordinates are ready.');
      });
    }
  }

  /** Subscribes to map coordinate changes, with a compatibility polling fallback. */
  #startCoordinateUpdates() {
    this.#stopCoordinateUpdates();
    const apiManager = this.executor.apiManager;
    if (typeof apiManager?.onCoordinatesChanged == 'function') {
      this.unsubscribeCoordinates = apiManager.onCoordinatesChanged(coordinates => {
        this.#observeCoordinates(coordinates);
      });
      return;
    }

    this.coordinatePollInterval = setInterval(() => {
      this.#observeCoordinates(apiManager?.coordsTilePixel);
    }, 250);
  }

  /** Stops coordinate subscriptions and fallback polling. */
  #stopCoordinateUpdates() {
    this.unsubscribeCoordinates?.();
    this.unsubscribeCoordinates = null;
    if (this.coordinatePollInterval != null) {
      clearInterval(this.coordinatePollInterval);
      this.coordinatePollInterval = null;
    }
  }

  /** Applies a fresh coordinate emitted after a map click. */
  #observeCoordinates(coordinates) {
    const normalizedCoordinates = this.#normalizeCoordinates(coordinates);
    if (!this.#coordinatesAreValid(normalizedCoordinates)) {return;}
    const coordinateKey = normalizedCoordinates.join(',');
    const currentCoordinates = this.#getInputs().map(input => {
      const value = input?.value?.trim() ?? '';
      return value === '' ? NaN : Number(value);
    });
    const fieldsAlreadyMatch = currentCoordinates.every((coordinate, index) => coordinate === normalizedCoordinates[index]);
    if ((coordinateKey == this.lastObservedCoordinates) && fieldsAlreadyMatch) {return;}
    this.lastObservedCoordinates = coordinateKey;
    this.#applyCoordinates(normalizedCoordinates, 'Map pixel selected. Confirm to create the template.');
  }

  /** Copies the latest map coordinate into the fields. */
  #useLatestMapCoordinates(reportMissing) {
    const coordinates = this.#normalizeCoordinates(this.executor.apiManager?.coordsTilePixel);
    if (!this.#coordinatesAreValid(coordinates)) {
      if (reportMissing) {
        this.#setStatus('Click the desired top-left pixel on the map first.', 'error');
      }
      return false;
    }

    this.lastObservedCoordinates = coordinates.join(',');
    this.#applyCoordinates(coordinates, 'Latest map pixel loaded. Confirm it or click another pixel.');
    return true;
  }

  /** Writes four coordinates without treating zero as an empty value. */
  #applyCoordinates(coordinates, message) {
    const inputs = this.#getInputs();
    coordinates.forEach((coordinate, index) => {
      if (inputs[index]) {inputs[index].value = String(coordinate ?? '');}
    });
    this.#setStatus(message, 'success');
  }

  /** Validates and creates the pending template. */
  async #submit(button) {
    if (this.isSubmitting || this.isClosing) {return;}
    const inputs = this.#getInputs();
    if (inputs.some(input => !input)) {
      this.#setStatus('Coordinate inputs are unavailable. Reopen the picker and try again.', 'error');
      return;
    }
    const invalidInput = inputs.find(input => !input.checkValidity());
    if (invalidInput) {
      invalidInput?.reportValidity();
      this.#setStatus('Enter four valid integer coordinates.', 'error');
      return;
    }

    const coordinates = inputs.map(input => Number(input.value));
    if (!this.#coordinatesAreValid(coordinates)) {
      this.#setStatus('Enter four valid integer coordinates.', 'error');
      return;
    }

    this.isSubmitting = true;
    this.#stopCoordinateUpdates();
    this.#setCoordinateControlsDisabled(true);
    this.#setStatus('Creating and saving the template…', 'loading');

    try {
      await this.onConfirm(coordinates);
      this.#setStatus('Template created.', 'success');
      await this.#finish(true);
    } catch (error) {
      console.error('Chromora: Template creation failed.', error);
      this.#setStatus(`Could not create the template: ${error instanceof Error ? error.message : String(error)}`, 'error');
      this.isSubmitting = false;
      this.#setCoordinateControlsDisabled(false);
      this.#startCoordinateUpdates();
    }
  }

  /** Closes the picker and reports whether a template was created. */
  async #finish(created) {
    if (this.isClosing || (this.isSubmitting && !created)) {return;}
    this.isClosing = true;
    this.#stopCoordinateUpdates();
    this.#unbindEscapeKey();

    try {
      const windowElement = this.windowElement;
      if (windowElement?.isConnected) {
        await this.handleWindowClose(windowElement);
      }
    } finally {
      this.windowElement = null;
      document.body?.classList.remove('bm-template-coordinate-mode');
      this.onDismiss({created: !!created});
    }
  }

  /** Adds Escape as an accessible Cancel shortcut. */
  #bindEscapeKey() {
    this.#unbindEscapeKey();
    this.escapeHandler = event => {
      if ((event.key != 'Escape') || this.isSubmitting) {return;}
      event.preventDefault();
      void this.#finish(false);
    };
    document.addEventListener('keydown', this.escapeHandler);
  }

  /** Removes the Escape shortcut. */
  #unbindEscapeKey() {
    if (!this.escapeHandler) {return;}
    document.removeEventListener('keydown', this.escapeHandler);
    this.escapeHandler = null;
  }

  /** Returns the coordinate inputs in storage order. */
  #getInputs() {
    return [
      this.windowElement?.querySelector('#bm-template-coordinate-tx'),
      this.windowElement?.querySelector('#bm-template-coordinate-ty'),
      this.windowElement?.querySelector('#bm-template-coordinate-px'),
      this.windowElement?.querySelector('#bm-template-coordinate-py')
    ];
  }

  /** Prevents map updates and manual edits from changing the submitted coordinates. */
  #setCoordinateControlsDisabled(disabled) {
    for (const input of this.#getInputs()) {
      if (input) {input.disabled = disabled;}
    }
    for (const control of this.windowElement?.querySelectorAll('[data-coordinate-action]') ?? []) {
      control.disabled = disabled;
    }
  }

  /** Extracts numeric coordinates from Wplace-style clipboard text. */
  #parseCoordinates(text) {
    return String(text)
      .split(/[^0-9-]+/)
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);
  }

  /** Converts API string values to the numeric coordinate contract. */
  #normalizeCoordinates(coordinates) {
    return Array.isArray(coordinates) ? coordinates.map(Number) : [];
  }

  /** Checks shape, integer values, and the actual input bounds. */
  #coordinatesAreValid(coordinates) {
    if (!Array.isArray(coordinates) || (coordinates.length != 4)) {return false;}
    const normalizedCoordinates = this.#normalizeCoordinates(coordinates);
    if (!normalizedCoordinates.every(Number.isInteger)) {return false;}
    const inputs = this.#getInputs();
    if (inputs.some(Boolean)) {
      return normalizedCoordinates.every((coordinate, index) => {
        const input = inputs[index];
        if (!input) {return false;}
        const minimum = Number(input.min);
        const maximum = Number(input.max);
        return coordinate >= minimum && coordinate <= maximum;
      });
    }

    const pixelMaximum = Math.max(0, Number(this.executor.apiManager?.templateManager?.tileSize) - 1 || 999);
    return normalizedCoordinates[0] >= 0 && normalizedCoordinates[0] <= 2047
      && normalizedCoordinates[1] >= 0 && normalizedCoordinates[1] <= 2047
      && normalizedCoordinates[2] >= 0 && normalizedCoordinates[2] <= pixelMaximum
      && normalizedCoordinates[3] >= 0 && normalizedCoordinates[3] <= pixelMaximum;
  }

  /** Updates the visible, screen-reader-announced picker status. */
  #setStatus(message, tone) {
    const status = this.windowElement?.querySelector('#bm-template-coordinate-status');
    if (!status) {return;}
    status.textContent = message;
    status.dataset['tone'] = tone;
    status.setAttribute('role', tone == 'error' ? 'alert' : 'status');
  }
}
