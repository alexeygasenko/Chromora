import Overlay, { minimizeIconExpanded } from "./Overlay";
import { closeIcon } from "./uiIcons";
import { localizeNumber, localizePercent } from "./utils";
import WindowTemplateCoordinates from "./WindowTemplateCoordinates";

/** Separate window for browsing templates and starting the add-template flow. */
export default class WindowTemplates extends Overlay {

  /**
   * @param {*} executor - WindowMain instance
   */
  constructor(executor) {
    super(executor.name, executor.version);
    this.executor = executor;
    this.templateManager = executor.apiManager?.templateManager;
    this.windowID = 'bm-window-templates';
    this.windowParent = document.body;
    this.windowElement = null;
    this.coordinateWindow = null;
    this.progressRefreshInterval = null;
    this.progressRefreshIntervalMS = 5000;
    this.renderGeneration = 0;
    this.lifecycleGeneration = 0;
    this.isChoosingFile = false;
    this.fileSelectionToken = 0;
    this.templateCardIDs = new WeakMap();
    this.nextTemplateCardID = 1;
    this.pendingTemplateActions = new Map();
    this.confirmingTemplate = null;
    this.deferredTemplateRender = false;
    this.unsubscribeTemplateChanges = this.templateManager?.onTemplatesChanged?.(detail => {
      if (detail?.reason == 'statistics-updated') {
        this.#updateProgress();
      } else if (this.pendingTemplateActions.size || this.confirmingTemplate) {
        // The action handler performs one final render after clearing its busy state.
        this.deferredTemplateRender = true;
        return;
      } else {
        this.#renderTemplateList();
      }
    }) ?? null;
  }

  /** Opens or closes the single Templates window. */
  buildWindow() {
    const existingWindow = document.getElementById(this.windowID);
    if (existingWindow) {
      if (!this.coordinateWindow) {void this.#closeWindow();}
      return;
    }

    this.addDiv({
      'id': this.windowID,
      'class': 'bm-window bm-windowed',
      'style': 'top: 50%; left: 50%; right: unset; transform: translate(-50%, -50%);'
    })
      .addDragbar()
        .addButton({'class': 'bm-button-circle', 'innerHTML': minimizeIconExpanded, 'aria-label': 'Minimize window "Templates"', 'data-button-status': 'expanded'}, (instance, button) => {
          button.onclick = () => instance.handleMinimization(button);
        }).buildElement()
        .addDiv({'class': 'bm-templates-drag-title-slot'})
          .addHeader(1, {'class': 'bm-dragbar-title-persistent', 'textContent': 'Templates'}).buildElement()
        .buildElement()
        .addDiv({'class': 'bm-flex-center'})
          .addButton({'class': 'bm-button-circle', 'innerHTML': closeIcon, 'aria-label': 'Close window "Templates"'}, (instance, button) => {
            button.onclick = () => void this.#closeWindow();
          }).buildElement()
        .buildElement()
      .buildElement()
      .addDiv({'class': 'bm-window-content'})
        .addHr({'class': 'bm-window-divider-top'}).buildElement()
        .addDiv({'class': 'bm-container bm-templates-toolbar'})
          .addDiv({'class': 'bm-templates-toolbar-copy'})
            .addSmall({'textContent': 'Template library'}).buildElement()
            .addSpan({'textContent': 'Manage every active overlay in one place.'}).buildElement()
          .buildElement()
          .addButton({'class': 'bm-button-primary', 'textContent': 'Add template'}, (instance, button) => {
            button.dataset['templateAction'] = 'add';
            button.onclick = () => this.windowElement?.querySelector('#bm-template-file-input')?.click();
          }).buildElement()
          .addInput({
            'type': 'file',
            'id': 'bm-template-file-input',
            'accept': 'image/png, image/jpeg, image/webp, image/bmp, image/gif',
            'tabindex': -1,
            'aria-hidden': 'true'
          }, (instance, input) => {
            input.onchange = () => void this.#handleFileSelection(input);
          }).buildElement()
        .buildElement()
        .addP({
          'id': 'bm-templates-message',
          'class': 'bm-templates-message',
          'role': 'status',
          'aria-live': 'polite',
          'hidden': true
        }).buildElement()
        .addDiv({'id': 'bm-templates-list', 'class': 'bm-container bm-scrollable bm-templates-list'}).buildElement()
      .buildElement()
    .buildElement().buildOverlay(this.windowParent);

    this.windowElement = document.getElementById(this.windowID);
    this.handleDrag(`#${this.windowID}`, `#${this.windowID} .bm-dragbar`);
    this.#renderTemplateList();
    if (this.pendingTemplateActions.size || this.confirmingTemplate) {
      this.#setTemplateInteractionLocked(true);
    }
    this.#startProgressRefresh();

    const state = this.templateManager?.getTemplateStatisticsState?.();
    if (state == 'degraded') {
      this.#setMessage('Some damaged stored templates were skipped.', 'warning');
    } else if (state == 'error') {
      this.#setMessage('Stored templates could not be loaded.', 'error');
    }
  }

  /** Releases every timer, subscription, modal, and owned DOM element. */
  dispose() {
    this.#stopProgressRefresh();
    this.unsubscribeTemplateChanges?.();
    this.unsubscribeTemplateChanges = null;
    this.coordinateWindow?.dispose();
    this.coordinateWindow = null;
    this.confirmingTemplate = null;
    this.isChoosingFile = false;
    this.fileSelectionToken++;
    this.lifecycleGeneration++;
    this.renderGeneration++;
    this.windowElement?.remove();
    this.windowElement = null;
  }

  /** Animates the list window closed while preserving the reusable owner. */
  async #closeWindow() {
    const windowElement = this.windowElement ?? document.getElementById(this.windowID);
    this.#stopProgressRefresh();
    this.confirmingTemplate = null;
    this.isChoosingFile = false;
    this.fileSelectionToken++;
    this.lifecycleGeneration++;
    this.renderGeneration++;
    if (windowElement?.isConnected) {await this.handleWindowClose(windowElement);}
    if (this.windowElement == windowElement) {this.windowElement = null;}
  }

  /** Validates the selected image before hiding the rest of the UI. */
  async #handleFileSelection(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.isChoosingFile || this.coordinateWindow) {return;}

    this.isChoosingFile = true;
    const selectionToken = ++this.fileSelectionToken;
    const selectionGeneration = this.lifecycleGeneration;
    const ownerWindow = this.windowElement;
    const addButton = this.windowElement?.querySelector('[data-template-action="add"]');
    if (addButton) {addButton.disabled = true;}
    this.#setMessage('Checking the selected image…', 'loading');

    try {
      if (file.type && !file.type.startsWith('image/')) {
        throw new TypeError('Choose an image file.');
      }
      const bitmap = await createImageBitmap(file);
      const hasPixels = bitmap.width > 0 && bitmap.height > 0;
      bitmap.close?.();
      if (!hasPixels) {throw new TypeError('The selected image is empty.');}
      if ((selectionGeneration != this.lifecycleGeneration) || (this.windowElement != ownerWindow) || !ownerWindow?.isConnected) {
        return;
      }
      this.#openCoordinatePicker(file);
    } catch (error) {
      if ((selectionGeneration != this.lifecycleGeneration) || (this.windowElement != ownerWindow)) {return;}
      console.error('Chromora: Could not load the selected template image.', error);
      this.#setMessage(`Could not load that image: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      if (selectionToken == this.fileSelectionToken) {
        this.isChoosingFile = false;
        if (addButton) {addButton.disabled = this.pendingTemplateActions.size > 0 || !!this.confirmingTemplate;}
      }
    }
  }

  /** Starts the isolated second step of template creation. */
  #openCoordinatePicker(file) {
    if (this.coordinateWindow || !this.windowElement?.isConnected) {return;}
    const templateName = file.name.replace(/\.[^/.]+$/, '') || 'My template';

    this.coordinateWindow = new WindowTemplateCoordinates(this.executor, file, {
      onConfirm: async coordinates => {
        if (!this.templateManager) {throw new Error('Template manager is unavailable.');}
        await this.templateManager.createTemplate(file, templateName, coordinates);
        this.#setMessage(`Added “${templateName}”.`, 'success');
        void this.templateManager.requestCanvasRefresh?.();
      },
      onDismiss: ({created}) => {
        this.coordinateWindow = null;
        if (created) {
          this.#renderTemplateList();
          this.#updateProgress();
        } else {
          this.#setMessage('Template addition cancelled.', 'info');
        }
        this.windowElement?.querySelector('[data-template-action="add"]')?.focus();
      }
    });
    this.coordinateWindow.buildWindow();
  }

  /** Rebuilds cards only for structural template changes. */
  #renderTemplateList() {
    const list = this.windowElement?.querySelector('#bm-templates-list');
    if (!list) {return;}

    this.deferredTemplateRender = false;
    const generation = ++this.renderGeneration;
    list.replaceChildren();
    const templates = this.#getTemplates();

    if (!templates.length) {
      const emptyState = document.createElement('div');
      emptyState.className = 'bm-templates-empty';
      const icon = document.createElement('span');
      icon.className = 'bm-templates-empty-icon';
      icon.textContent = '◇';
      const title = document.createElement('strong');
      title.textContent = 'No templates yet';
      const description = document.createElement('span');
      description.textContent = 'Add an image, then choose its top-left map pixel.';
      emptyState.append(icon, title, description);
      list.appendChild(emptyState);
      this.#updateProgress();
      return;
    }

    templates.forEach((template, index) => {
      const templateEnabled = template?.enabled !== false;
      const card = document.createElement('article');
      card.className = 'bm-template-card';
      card.dataset['templateId'] = this.#getTemplateCardID(template);
      card.dataset['templateEnabled'] = String(templateEnabled);
      if (this.pendingTemplateActions.has(template)) {card.setAttribute('aria-busy', 'true');}

      const preview = document.createElement('div');
      preview.className = 'bm-template-preview';
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 100;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `Preview of ${template.displayName || `Template ${index + 1}`}`);
      const previewPlaceholder = document.createElement('span');
      previewPlaceholder.textContent = 'Loading preview…';
      preview.append(canvas, previewPlaceholder);

      const body = document.createElement('div');
      body.className = 'bm-template-card-body';
      const heading = document.createElement('div');
      heading.className = 'bm-template-card-heading';
      const name = document.createElement('strong');
      name.textContent = template.displayName || `Template ${index + 1}`;
      const pixelTotal = document.createElement('small');
      pixelTotal.textContent = `${localizeNumber(Math.max(0, Number(template.pixelCount?.total) || 0))} pixels`;
      heading.append(name, pixelTotal);

      const templateCoordinates = this.#getTemplateCoordinates(template);
      const location = document.createElement('div');
      location.className = 'bm-template-location';
      const coordinates = document.createElement('span');
      coordinates.className = 'bm-template-coordinates';
      coordinates.textContent = this.#formatCoordinates(templateCoordinates);
      const teleport = document.createElement('button');
      const teleportPending = this.pendingTemplateActions.get(template) == 'teleport';
      const templateInteractionsLocked = this.pendingTemplateActions.size > 0 || !!this.confirmingTemplate;
      teleport.className = 'bm-button-secondary bm-template-teleport';
      teleport.type = 'button';
      teleport.dataset['templateAction'] = 'teleport';
      teleport.dataset['templateActionAvailable'] = String(!!templateCoordinates);
      teleport.textContent = teleportPending ? 'Moving…' : 'Go to';
      teleport.disabled = !templateCoordinates || templateInteractionsLocked;
      teleport.setAttribute('aria-label', teleportPending
        ? `Moving to template “${template.displayName || `Template ${index + 1}`}”`
        : templateCoordinates
          ? `Go to template “${template.displayName || `Template ${index + 1}`}” on map`
          : `Template “${template.displayName || `Template ${index + 1}`}” has no valid map coordinates`);
      teleport.title = teleport.getAttribute('aria-label');
      teleport.onclick = () => void this.#handleTemplateTeleport(template, index, card, teleport);
      location.append(coordinates, teleport);

      const actions = document.createElement('div');
      actions.className = 'bm-template-actions';
      this.#renderTemplateActions(actions, card, template, index);

      const progressHeading = document.createElement('div');
      progressHeading.className = 'bm-template-progress-heading';
      const progressLabel = document.createElement('small');
      progressLabel.textContent = 'Progress';
      const progressPercent = document.createElement('strong');
      progressPercent.dataset['progressRole'] = 'percent';
      progressPercent.textContent = '—';
      progressHeading.append(progressLabel, progressPercent);

      const progress = document.createElement('progress');
      progress.max = 1;
      progress.dataset['progressRole'] = 'bar';
      progress.setAttribute('aria-label', `Progress for ${template.displayName || `Template ${index + 1}`}: not available`);
      const progressDetails = document.createElement('small');
      progressDetails.dataset['progressRole'] = 'details';

      body.append(heading, location, actions, progressHeading, progress, progressDetails);
      card.append(preview, body);
      list.appendChild(card);
      void this.#renderPreview(template, canvas, previewPlaceholder, generation);
    });

    this.#updateProgress();
  }

  /** Builds the enabled switch and delete action for one template card. */
  #renderTemplateActions(actions, card, template, index) {
    const templateName = template.displayName || `Template ${index + 1}`;
    const templateEnabled = template.enabled !== false;
    const pendingAction = this.pendingTemplateActions.get(template);
    const interactionsLocked = this.pendingTemplateActions.size > 0
      || (this.confirmingTemplate && this.confirmingTemplate !== template);
    actions.classList.remove('bm-template-actions-confirming');
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', `Actions for template “${templateName}”`);
    actions.onkeydown = null;
    actions.replaceChildren();

    const toggle = document.createElement('button');
    toggle.className = 'bm-button-secondary bm-template-toggle';
    toggle.type = 'button';
    toggle.dataset['templateAction'] = 'toggle';
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', String(templateEnabled));
    toggle.setAttribute('aria-label', pendingAction == 'toggle'
      ? `Saving visibility for template “${templateName}”`
      : `Show on map: template “${templateName}”`);
    toggle.textContent = pendingAction == 'toggle'
      ? 'Saving…'
      : 'Show on map';
    toggle.disabled = !!pendingAction || !!interactionsLocked;
    toggle.onclick = () => void this.#handleTemplateToggle(template, index, card);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'bm-button-secondary bm-template-delete';
    deleteButton.type = 'button';
    deleteButton.dataset['templateAction'] = 'delete';
    deleteButton.setAttribute('aria-label', `Delete template “${templateName}”`);
    deleteButton.title = `Delete template “${templateName}”`;
    deleteButton.textContent = pendingAction == 'delete' ? 'Deleting…' : 'Delete';
    deleteButton.disabled = !!pendingAction || !!interactionsLocked;
    deleteButton.onclick = () => this.#showDeleteConfirmation(actions, card, template, index);

    actions.append(toggle, deleteButton);
  }

  /** Replaces card actions with an inline destructive confirmation. */
  #showDeleteConfirmation(actions, card, template, index) {
    if (this.pendingTemplateActions.size || this.confirmingTemplate) {return;}
    const templateName = template.displayName || `Template ${index + 1}`;
    this.confirmingTemplate = template;
    actions.classList.add('bm-template-actions-confirming');
    actions.setAttribute('aria-label', `Confirm deletion of template “${templateName}”`);

    const prompt = document.createElement('span');
    prompt.className = 'bm-template-delete-prompt';
    prompt.textContent = 'Delete permanently?';

    const cancel = document.createElement('button');
    cancel.className = 'bm-button-secondary';
    cancel.type = 'button';
    cancel.textContent = 'Cancel';

    const confirm = document.createElement('button');
    confirm.className = 'bm-button-secondary bm-template-delete bm-template-delete-confirm';
    confirm.type = 'button';
    confirm.textContent = 'Delete';
    confirm.setAttribute('aria-label', `Permanently delete template “${templateName}”`);

    const restoreActions = () => {
      this.confirmingTemplate = null;
      if (this.deferredTemplateRender) {
        this.#renderTemplateList();
      } else {
        this.#renderTemplateActions(actions, card, template, index);
      }
      this.#setTemplateInteractionLocked(false);
      this.#focusTemplateAction(template, 'delete');
    };
    cancel.onclick = restoreActions;
    confirm.onclick = () => void this.#handleTemplateDelete(template, index, card, confirm);
    actions.onkeydown = event => {
      if (event.key != 'Escape') {return;}
      event.preventDefault();
      restoreActions();
    };
    actions.replaceChildren(prompt, cancel, confirm);
    this.#setTemplateInteractionLocked(true, actions);
    cancel.focus();
  }

  /** Moves the map to the visual center of one template. */
  async #handleTemplateTeleport(template, index, card, button) {
    if (!this.templateManager?.teleportToTemplate
      || this.pendingTemplateActions.size
      || this.confirmingTemplate
      || button.disabled
      || button.getAttribute('aria-disabled') == 'true') {
      return;
    }

    const templateName = template.displayName || `Template ${index + 1}`;
    const ownerWindow = this.windowElement;
    this.pendingTemplateActions.set(template, 'teleport');
    card.setAttribute('aria-busy', 'true');
    const actionOwnedFocus = card.contains(document.activeElement);
    this.#setTemplateInteractionLocked(true, null, button);
    button.textContent = 'Moving…';
    button.setAttribute('aria-label', `Moving to template “${templateName}”`);

    try {
      await this.templateManager.teleportToTemplate(template);
      this.#setMessage(`Moved map to “${templateName}”.`, 'success');
      if ((this.windowElement === ownerWindow) && ownerWindow?.isConnected) {
        try {
          await this.#closeWindow();
          const templatesTrigger = document.querySelector('#bm-window-main button[aria-label="Open templates"]');
          if (templatesTrigger?.getClientRects().length && !templatesTrigger.disabled) {
            templatesTrigger.focus();
          }
        } catch (error) {
          console.warn('Chromora: Could not close the template list after moving the map.', error);
        }
      }
    } catch (error) {
      console.error('Chromora: Could not move to the template.', error);
      this.#setMessage(`Could not move to “${templateName}”: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      const shouldRestoreFocus = actionOwnedFocus && card.contains(document.activeElement);
      this.pendingTemplateActions.delete(template);
      if (this.windowElement?.isConnected) {
        this.#renderTemplateList();
        this.#setTemplateInteractionLocked(false);
        if (shouldRestoreFocus) {this.#focusTemplateAction(template, 'teleport');}
      }
    }
  }

  /** Persists one template visibility change and restores focus after rerender. */
  async #handleTemplateToggle(template, index, card) {
    if (!this.templateManager?.setTemplateEnabled || this.pendingTemplateActions.size || this.confirmingTemplate) {return;}
    const shouldEnable = template.enabled === false;
    const templateName = template.displayName || `Template ${index + 1}`;
    this.pendingTemplateActions.set(template, 'toggle');
    card.setAttribute('aria-busy', 'true');
    const toggle = card.querySelector('[data-template-action="toggle"]');
    const actionOwnedFocus = card.contains(document.activeElement);
    this.#setTemplateInteractionLocked(true, null, toggle);
    if (toggle) {toggle.textContent = 'Saving…';}

    try {
      await this.templateManager.setTemplateEnabled(template, shouldEnable);
      this.#setMessage(`${shouldEnable ? 'Enabled' : 'Disabled'} “${templateName}”.`, 'success');
    } catch (error) {
      console.error('Chromora: Could not update the template.', error);
      this.#setMessage(`Could not update “${templateName}”: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      const shouldRestoreFocus = actionOwnedFocus && card.contains(document.activeElement);
      this.pendingTemplateActions.delete(template);
      this.#renderTemplateList();
      this.#setTemplateInteractionLocked(false);
      if (shouldRestoreFocus) {this.#focusTemplateAction(template, 'toggle');}
    }
  }

  /** Deletes one template after inline confirmation and focuses the nearest remaining card. */
  async #handleTemplateDelete(template, index, card, confirmButton) {
    if (!this.templateManager?.deleteTemplate || this.pendingTemplateActions.size || this.confirmingTemplate !== template) {return;}
    const templateName = template.displayName || `Template ${index + 1}`;
    this.confirmingTemplate = null;
    this.pendingTemplateActions.set(template, 'delete');
    card.setAttribute('aria-busy', 'true');
    const actionOwnedFocus = card.contains(document.activeElement);
    this.#setTemplateInteractionLocked(true, null, confirmButton);
    confirmButton.textContent = 'Deleting…';

    let deleted = false;
    try {
      await this.templateManager.deleteTemplate(template);
      deleted = true;
      this.#setMessage(`Deleted “${templateName}”.`, 'success');
    } catch (error) {
      console.error('Chromora: Could not delete the template.', error);
      this.#setMessage(`Could not delete “${templateName}”: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      const shouldRestoreFocus = actionOwnedFocus && card.contains(document.activeElement);
      this.pendingTemplateActions.delete(template);
      this.#renderTemplateList();
      this.#setTemplateInteractionLocked(false);
      if (deleted && shouldRestoreFocus) {
        const remainingTemplates = this.#getTemplates();
        const focusTemplate = remainingTemplates[Math.min(index, Math.max(0, remainingTemplates.length - 1))];
        if (focusTemplate) {
          this.#focusTemplateAction(focusTemplate, 'toggle');
        } else {
          this.windowElement?.querySelector('[data-template-action="add"]')?.focus();
        }
      } else if (!deleted && shouldRestoreFocus) {
        this.#focusTemplateAction(template, 'delete');
      }
    }
  }

  /** Locks template mutations while an action or destructive confirmation is active. */
  #setTemplateInteractionLocked(locked, activeActions = null, focusKeeper = null) {
    const addButton = this.windowElement?.querySelector('[data-template-action="add"]');
    if (addButton) {addButton.disabled = locked || this.isChoosingFile;}
    for (const actions of this.windowElement?.querySelectorAll('.bm-template-actions') ?? []) {
      const keepActive = locked && actions === activeActions;
      for (const button of actions.querySelectorAll('button')) {
        if (locked && button === focusKeeper) {
          button.disabled = false;
          button.setAttribute('aria-disabled', 'true');
        } else {
          button.removeAttribute('aria-disabled');
          button.disabled = locked ? !keepActive : false;
        }
      }
    }
    for (const button of this.windowElement?.querySelectorAll('[data-template-action="teleport"]') ?? []) {
      if (locked && button === focusKeeper) {
        button.disabled = false;
        button.setAttribute('aria-disabled', 'true');
      } else {
        button.removeAttribute('aria-disabled');
        const isAvailable = button.dataset['templateActionAvailable'] !== 'false';
        button.disabled = locked || !isAvailable;
      }
    }
  }

  /** Focuses an action on the current card for a runtime template. */
  #focusTemplateAction(template, action) {
    const templateID = this.#getTemplateCardID(template);
    this.windowElement
      ?.querySelector(`.bm-template-card[data-template-id="${templateID}"] [data-template-action="${action}"]`)
      ?.focus();
  }

  /** Updates each card's progress without regenerating thumbnails. */
  #updateProgress() {
    const templates = this.#getTemplates();

    templates.forEach(template => {
      const progressState = this.#calculateProgress(template);
      const templateID = this.#getTemplateCardID(template);
      const card = this.windowElement?.querySelector(`.bm-template-card[data-template-id="${templateID}"]`);
      const percent = card?.querySelector('[data-progress-role="percent"]');
      const progress = card?.querySelector('[data-progress-role="bar"]');
      const details = card?.querySelector('[data-progress-role="details"]');
      if (percent) {percent.textContent = this.#formatProgressPercent(progressState);}
      this.#updateProgressElement(progress, progressState, `Progress for ${template.displayName || 'template'}`);
      if (details) {
        const progressDetails = this.#formatProgressDetails(progressState);
        details.textContent = template?.enabled === false ? `Paused · ${progressDetails}` : progressDetails;
      }
    });
  }

  /** Calculates a conservative per-template progress summary. */
  #calculateProgress(template) {
    const total = Math.max(0, Number(template?.pixelCount?.total) || 0);
    const expectedTiles = new Set(
      Object.keys(template?.chunked ?? {}).map(key => this.#normalizeTileKey(key)).filter(Boolean)
    );
    const correctByTile = template?.pixelCount?.correct;
    const correctEntries = correctByTile instanceof Map
      ? correctByTile.entries()
      : Object.entries(correctByTile ?? {});
    const scannedTiles = new Set();
    let correct = 0;

    for (const [tileKey, colorMap] of correctEntries) {
      const normalizedTileKey = this.#normalizeTileKey(tileKey);
      if (!normalizedTileKey || !expectedTiles.has(normalizedTileKey)) {continue;}
      scannedTiles.add(normalizedTileKey);
      const colorEntries = colorMap instanceof Map ? colorMap.entries() : Object.entries(colorMap ?? {});
      for (const [colorID, pixelCount] of colorEntries) {
        if (Number(colorID) == 0) {continue;}
        const normalizedPixelCount = Number(pixelCount);
        if (Number.isFinite(normalizedPixelCount) && normalizedPixelCount > 0) {
          correct += normalizedPixelCount;
        }
      }
    }

    correct = Math.min(Math.max(0, correct), total);
    const expectedTileCount = expectedTiles.size;
    const scannedTileCount = scannedTiles.size;
    return {
      correct: correct,
      total: total,
      scannedTiles: scannedTileCount,
      expectedTiles: expectedTileCount,
      coverageComplete: expectedTileCount > 0 && scannedTileCount >= expectedTileCount,
      ratio: total > 0 ? correct / total : 0
    };
  }

  /** Builds a bounded thumbnail directly from runtime chunk buffers. */
  async #renderPreview(template, canvas, placeholder, generation) {
    try {
      const drawMultiplier = Math.max(1, Number(this.templateManager?.drawMult) || 3);
      const tileSize = Math.max(1, Number(this.templateManager?.tileSize) || 1000);
      const chunks = [];

      for (const [key, bitmap] of Object.entries(template?.chunked ?? {})) {
        const coordinates = key.split(',').map(Number);
        if (coordinates.length < 4 || !coordinates.every(Number.isFinite)) {continue;}
        const sourceWidth = Number(bitmap?.width);
        const sourceHeight = Number(bitmap?.height);
        if (!(sourceWidth > 0) || !(sourceHeight > 0)) {continue;}
        chunks.push({
          key: key,
          bitmap: bitmap,
          sourceWidth: sourceWidth,
          sourceHeight: sourceHeight,
          width: sourceWidth / drawMultiplier,
          height: sourceHeight / drawMultiplier,
          x: (coordinates[0] * tileSize) + coordinates[2],
          y: (coordinates[1] * tileSize) + coordinates[3]
        });
      }

      if (!chunks.length) {throw new Error('Template has no drawable chunks.');}
      const minimumX = Math.min(...chunks.map(chunk => chunk.x));
      const minimumY = Math.min(...chunks.map(chunk => chunk.y));
      const maximumX = Math.max(...chunks.map(chunk => chunk.x + chunk.width));
      const maximumY = Math.max(...chunks.map(chunk => chunk.y + chunk.height));
      const templateWidth = Math.max(1, maximumX - minimumX);
      const templateHeight = Math.max(1, maximumY - minimumY);
      const scale = Math.min(160 / templateWidth, 100 / templateHeight);
      const previewWidth = Math.max(1, Math.round(templateWidth * scale));
      const previewHeight = Math.max(1, Math.round(templateHeight * scale));
      canvas.width = previewWidth;
      canvas.height = previewHeight;

      const context = canvas.getContext('2d');
      const previewImage = context.createImageData(previewWidth, previewHeight);
      const preview32 = new Uint32Array(previewImage.data.buffer);

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        if ((generation != this.renderGeneration) || !canvas.isConnected) {return;}
        const chunk = chunks[chunkIndex];
        const source32 = await this.#getChunkPixels(template, chunk);
        const startX = Math.max(0, Math.floor(((chunk.x - minimumX) / templateWidth) * previewWidth));
        const endX = Math.min(previewWidth, Math.ceil(((chunk.x + chunk.width - minimumX) / templateWidth) * previewWidth));
        const startY = Math.max(0, Math.floor(((chunk.y - minimumY) / templateHeight) * previewHeight));
        const endY = Math.min(previewHeight, Math.ceil(((chunk.y + chunk.height - minimumY) / templateHeight) * previewHeight));

        for (let previewY = startY; previewY < endY; previewY++) {
          const worldY = minimumY + ((previewY + 0.5) / previewHeight) * templateHeight;
          const logicalY = Math.min(chunk.height - 1, Math.max(0, Math.floor(worldY - chunk.y)));
          const sourceY = Math.min(chunk.sourceHeight - 1, Math.floor(logicalY * drawMultiplier) + Math.floor(drawMultiplier / 2));
          for (let previewX = startX; previewX < endX; previewX++) {
            const worldX = minimumX + ((previewX + 0.5) / previewWidth) * templateWidth;
            const logicalX = Math.min(chunk.width - 1, Math.max(0, Math.floor(worldX - chunk.x)));
            const sourceX = Math.min(chunk.sourceWidth - 1, Math.floor(logicalX * drawMultiplier) + Math.floor(drawMultiplier / 2));
            const pixel = source32[(sourceY * chunk.sourceWidth) + sourceX];
            if (pixel) {preview32[(previewY * previewWidth) + previewX] = pixel;}
          }
        }

        if ((chunkIndex % 6) == 5) {
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
      }

      if ((generation != this.renderGeneration) || !canvas.isConnected) {return;}
      context.putImageData(previewImage, 0, 0);
      placeholder.hidden = true;
      canvas.dataset['ready'] = 'true';
    } catch (error) {
      console.warn('Chromora: Could not render a template preview.', error);
      if ((generation != this.renderGeneration) || !placeholder.isConnected) {return;}
      placeholder.textContent = 'Preview unavailable';
      canvas.hidden = true;
    }
  }

  /** Returns a chunk's existing Uint32 buffer or derives it from its bitmap. */
  async #getChunkPixels(template, chunk) {
    const cached = template?.chunked32?.[chunk.key];
    if (cached instanceof Uint32Array) {return cached;}

    const scratchCanvas = new OffscreenCanvas(chunk.sourceWidth, chunk.sourceHeight);
    const scratchContext = scratchCanvas.getContext('2d', {willReadFrequently: true});
    scratchContext.drawImage(chunk.bitmap, 0, 0);
    return new Uint32Array(scratchContext.getImageData(0, 0, chunk.sourceWidth, chunk.sourceHeight).data.buffer);
  }

  /** Reads stored origin coordinates with a chunk-key fallback. */
  #getTemplateCoordinates(template) {
    const coordinates = Array.isArray(template?.coords)
      ? template.coords.map(Number)
      : String(template?.coords ?? '').split(',').map(Number);
    if ((coordinates.length == 4) && coordinates.every(Number.isFinite)) {return coordinates;}

    const firstChunk = Object.keys(template?.chunked ?? {}).sort()[0];
    const fallback = firstChunk?.split(',').map(Number);
    return (fallback?.length >= 4 && fallback.slice(0, 4).every(Number.isFinite))
      ? fallback.slice(0, 4)
      : null;
  }

  /** Formats origin coordinates for a compact card label. */
  #formatCoordinates(coordinates) {
    if (!coordinates) {return 'Coordinates unavailable';}
    return `Tile ${coordinates[0]}, ${coordinates[1]} · Pixel ${coordinates[2]}, ${coordinates[3]}`;
  }

  /** Formats exact and lower-bound percentages differently. */
  #formatProgressPercent(progressState) {
    if (!progressState.total || (!progressState.coverageComplete && !progressState.scannedTiles)) {return '—';}
    const percentage = localizePercent(progressState.ratio);
    return progressState.coverageComplete ? percentage : `≥ ${percentage}`;
  }

  /** Formats both known pixels and scan coverage. */
  #formatProgressDetails(progressState) {
    if (!progressState.total) {return 'No paintable pixels';}
    const pixels = `${localizeNumber(progressState.correct)} / ${localizeNumber(progressState.total)} pixels`;
    if (progressState.coverageComplete) {return pixels;}
    return `${pixels} · checked ${progressState.scannedTiles}/${progressState.expectedTiles} tiles`;
  }

  /** Keeps native progress bars indeterminate until at least one tile has been checked. */
  #updateProgressElement(progress, progressState, label) {
    if (!progress) {return;}
    const hasMeasurement = !!(progressState?.total && progressState?.scannedTiles);
    if (hasMeasurement) {
      progress.value = progressState.ratio;
    } else {
      progress.removeAttribute('value');
    }
    const valueText = progressState ? this.#formatProgressPercent(progressState) : '—';
    progress.setAttribute('aria-label', `${label}: ${valueText == '—' ? 'not available' : valueText}`);
  }

  /** Normalizes padded/full chunk keys to a comparable tile key. */
  #normalizeTileKey(key) {
    const coordinates = String(key).split(',').slice(0, 2).map(Number);
    return (coordinates.length == 2 && coordinates.every(Number.isFinite))
      ? `${coordinates[0]},${coordinates[1]}`
      : null;
  }

  /** Returns a stable DOM key for a runtime Template instance. */
  #getTemplateCardID(template) {
    let templateID = this.templateCardIDs.get(template);
    if (!templateID) {
      templateID = String(this.nextTemplateCardID++);
      this.templateCardIDs.set(template, templateID);
    }
    return templateID;
  }

  /** Returns runtime templates without exposing the manager's mutable array. */
  #getTemplates() {
    return Array.isArray(this.templateManager?.templatesArray)
      ? [...this.templateManager.templatesArray]
      : [];
  }

  /** Starts fallback polling for live tile statistics. */
  #startProgressRefresh() {
    this.#stopProgressRefresh();
    this.progressRefreshInterval = setInterval(() => {
      if (!this.windowElement?.isConnected) {
        this.#stopProgressRefresh();
        return;
      }
      this.#updateProgress();
    }, this.progressRefreshIntervalMS);
  }

  /** Stops fallback progress polling. */
  #stopProgressRefresh() {
    if (this.progressRefreshInterval == null) {return;}
    clearInterval(this.progressRefreshInterval);
    this.progressRefreshInterval = null;
  }

  /** Shows an inline status instead of relying on the removed main textarea. */
  #setMessage(message, tone) {
    const status = this.windowElement?.querySelector('#bm-templates-message');
    if (!status) {return;}
    status.hidden = !message;
    status.textContent = message;
    status.dataset['tone'] = tone;
    status.setAttribute('role', tone == 'error' ? 'alert' : 'status');
  }
}
