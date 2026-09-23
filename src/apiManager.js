/** ApiManager class for handling API requests, responses, and interactions.
 * Note: Fetch spying is done in main.js, not here.
 * @class ApiManager
 * @since 0.11.1
 */

import TemplateManager from "./templateManager.js";
import { consoleError, localizeNumber, serverTPtoDisplayTP } from "./utils.js";

export default class ApiManager {

  /** Constructor for ApiManager class
   * @param {TemplateManager} templateManager 
   * @since 0.11.34
   */
  constructor(templateManager) {
    this.templateManager = templateManager;
    this.disableAll = false; // Should the entire userscript be disabled?
    this.chargeRefillTimerID = ''; // Contains the Charge refill timer element ID attribute so we can update the timer.
    this.coordsTilePixel = []; // Contains the last detected tile/pixel coordinate pair requested
    this.lastCoordinateRequestSequence = 0;
    this.templateCoordsTilePixel = []; // Contains the last "enabled" template coords
    this.coordinateChangeListeners = new Set(); // Subscribers waiting for a valid map coordinate selection
    this.spontaneousMessageHandler = null;
    this.pendingTiles = new Map();
  }

  /** Subscribes to valid tile/pixel coordinate changes.
   * Each listener receives its own copy of [tileX, tileY, pixelX, pixelY].
   * @param {function(Array<number>):void} listener - Coordinate change listener
   * @returns {function():void} Unsubscribe callback
   * @since 1.3.0
   */
  onCoordinatesChanged(listener) {
    if (typeof listener != 'function') {return () => {};}
    this.coordinateChangeListeners.add(listener);
    return () => this.coordinateChangeListeners.delete(listener);
  }

  /** Notifies coordinate subscribers without sharing mutable coordinate arrays.
   * @param {Array<number>} coords - Valid tile/pixel coordinates
   * @since 1.3.0
   */
  #emitCoordinatesChanged(coords) {
    for (const listener of this.coordinateChangeListeners) {
      try {
        listener(coords.slice());
      } catch (error) {
        consoleError('A coordinate-change listener failed.', error);
      }
    }
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

    // Triggers whenever a message is sent
    const messageHandler = async (event) => {

      const data = event.data;
      // Tampermonkey wraps the lexical window; message.source is the document's
      // actual Window. Keep the same-page check without rejecting that wrapper.
      if (event.source !== (document.defaultView || window) || event.origin !== window.location.origin || !data || typeof data != 'object' || Array.isArray(data) || data['source'] !== 'blue-marble') {return;}
      if (data['action'] === 'cancel-tile' && typeof data['blobID'] == 'string') {
        this.pendingTiles.get(data['blobID'])?.abort();
        this.pendingTiles.delete(data['blobID']);
        return;
      }
      if (data['action'] || typeof data['endpoint'] != 'string') {return;}
      let endpointURL;
      try {endpointURL = new URL(data['endpoint'], window.location.href);} catch {return;}
      if (endpointURL.protocol != 'https:' || !['wplace.live', 'backend.wplace.live'].includes(endpointURL.hostname) || endpointURL.port || endpointURL.username || endpointURL.password) {return;}
      const tileMatch = endpointURL.pathname.match(/^\/(?:api\/)?(?:files\/s\d+\/)?tiles?\/(?:\d+\/)?(\d+)\/(\d+)\.png$/);
      const apiMatch = endpointURL.pathname.match(endpointURL.hostname === 'backend.wplace.live'
        ? /^\/(?:api\/)?(?:(me|robots)|(?:s\d+\/)?(pixel)\/\d+\/\d+)$/
        : /^\/api\/(?:(me|robots)|(?:s\d+\/)?(pixel)\/\d+\/\d+)$/);
      const endpointText = tileMatch ? 'tile' : (apiMatch?.[1] ?? apiMatch?.[2]);
      if (!endpointText) {return;}
      const dataJSON = data['jsonData'];
      if (!tileMatch && (!dataJSON || typeof dataJSON != 'object' || Array.isArray(dataJSON))) {return;}

      console.log(`%cBlue Marble%c: Recieved message about "%s"`, 'color: cornflowerblue;', '', endpointText);

      // Each case is something that Blue Marble can use from the fetch.
      // For instance, if the fetch was for "me", we can update the overlay stats
      switch (endpointText) {

        case 'me': // Request to retrieve user data
          this.applyUserDataToOverlay(overlay, dataJSON);
          break;

        case 'pixel': // Request to retrieve pixel data
          // Keep the most recent selection when earlier HTTP responses arrive late.
          if (data.requestSequence != null && (!Number.isSafeInteger(data.requestSequence)
            || data.requestSequence <= this.lastCoordinateRequestSequence)) {return;}
          const coordsTile = endpointURL.pathname.split('/').slice(-2).map(Number);
          const payloadExtractor = endpointURL.searchParams;
          const coordsPixel = [payloadExtractor.get('x'), payloadExtractor.get('y')]
            .map(value => (value === null || value.trim() === '') ? NaN : Number(value)); // Retrieves the deconstructed pixel coords from the payload
          const coordsCombined = [...coordsTile, ...coordsPixel];
          const tileSize = Number(this.templateManager?.tileSize) || 1000;
          const coordsAreValid = (coordsCombined.length == 4)
            && coordsCombined.every(coord => Number.isSafeInteger(coord) && (coord >= 0))
            && (coordsPixel[0] < tileSize)
            && (coordsPixel[1] < tileSize);
          
          // Keep the last valid coordinates when an incomplete pixel endpoint is received.
          if (!coordsAreValid) {
            overlay?.handleDisplayError?.(`Coordinates are malformed!\nDid you try clicking the canvas first?`);
            return; // Kills itself
          }
          
          this.coordsTilePixel = coordsCombined; // Combines the two arrays such that [x, y, x, y]
          if (data.requestSequence != null) {this.lastCoordinateRequestSequence = data.requestSequence;}
          this.#emitCoordinatesChanged(this.coordsTilePixel);
          
          const displayTP = serverTPtoDisplayTP(coordsTile, coordsPixel); // Retrieves the coordinates that Wplace displays for this region

          const spanElements = document.querySelectorAll('span'); // Retrieves all span elements

          // For every span element, find the one we want (pixel numbers when canvas clicked)
          for (const element of spanElements) {
            // We use the pixel numbers to find this element because it is the only identifiable piece of information, assuming the website can load in non-Engligh languages.

            const elementTextTrimmed = element.textContent.trim(); // Stores the text of the span element, without leading or trailing spaces

            // If the text content of the element includes both coordinates seperatly (avoids failure when the comma seperator changes due to localization)
            if (elementTextTrimmed.includes(displayTP[0]) && elementTextTrimmed.includes(displayTP[1])) {

              let displayCoords = document.querySelector('#bm-display-coords'); // Find the additional pixel coords span

              const text = `(Tl X: ${coordsTile[0]}, Tl Y: ${coordsTile[1]}, Px X: ${coordsPixel[0]}, Px Y: ${coordsPixel[1]})`;
              
              // All 4 coordinate labels, IDs, and values
              const coordsLabel = ['Tl X:', 'Tl Y:', 'Px X:', 'Px Y:'];
              const coordsID = ['bm-tile-x', 'bm-tile-y', 'bm-pixel-x', 'bm-pixel-y'];
              // If we could not find the addition coord span, we make it then update the textContent with the new coords
              if (!displayCoords) {
                displayCoords = document.createElement('span');
                displayCoords.id = 'bm-display-coords';
                displayCoords.style = 'display: flex; flex-wrap: wrap; gap: 0 1ch; font-size: small;';

                // For each of the 4 coordinates...
                for (const [coordIndex, coordValue] of coordsCombined.entries()) {

                  const coordElement = document.createElement('span'); // Creates a `<span>` element

                  coordElement.id = coordsID[coordIndex] ?? ''; // Applys the ID to the coord element

                  // Outputs something like "Tl X: 483"
                  coordElement.textContent = `${coordsLabel[coordIndex] ?? '??:'} ${coordValue}`;
                  // Or if the amount of labels is less than the provided values, it outputs something like "??: 483" instead of failing

                  displayCoords.appendChild(coordElement); // Adds the span coordinate as a child for the flexbox container
                }

                // Adds the display coordinate flexbox container to the pixel info menu
                element.parentNode.parentNode.parentNode.insertAdjacentElement('afterend', displayCoords);
              } else {
                
                // For each of the 4 coordinates...
                for (const [coordIndex, coordID] of coordsID.entries()) {

                  const coordElement = document.getElementById(coordID); // Obtains the coordinate element

                  // Outputs something like "Tl X: 483"
                  coordElement.textContent = `${coordsLabel[coordIndex] ?? '??:'} ${coordsCombined[coordIndex]}`;
                  // Or if the amount of labels is less than the provided values, it outputs something like "??: 483" instead of failing
                }
              }
            }
          }
          break;
        
        case 'tile': {
          const tileCoordsTile = tileMatch.slice(1).map(Number);
          const blobUUID = data['blobID'];
          const blobData = data['blobData'];
          const requestSequence = data['requestSequence'];
          const revision = data['revision'];
          if (typeof blobUUID != 'string' || blobUUID.length > 128 || !blobUUID || !(blobData instanceof Blob)
            || !tileCoordsTile.every(value => Number.isSafeInteger(value) && value >= 0)
            || !Number.isSafeInteger(requestSequence) || requestSequence < 1
            || !Number.isSafeInteger(revision) || revision < 0 || this.pendingTiles.has(blobUUID)) {return;}
          const controller = new AbortController();
          let templateBlob = blobData;
          const shouldProcess = this.pendingTiles.size < 128;
          let fallback = !shouldProcess;
          if (shouldProcess) {this.pendingTiles.set(blobUUID, controller);}
          try {
            if (shouldProcess) {
              const rendered = await this.templateManager.drawTemplateOnTile(blobData, tileCoordsTile, {requestSequence, revision, signal: controller.signal});
              if (rendered instanceof Blob) {templateBlob = rendered;} else {fallback = true;}
            }
          } catch (error) {
            fallback = true;
            if (!controller.signal.aborted) {consoleError('Could not render a tile; using the original image.', error);}
          } finally {
            this.pendingTiles.delete(blobUUID);
            if (!controller.signal.aborted) {
              window.postMessage({source: 'blue-marble', blobID: blobUUID, blobData: templateBlob, requestSequence, revision, fallback}, window.location.origin);
            }
          }
          break;
        }

        case 'robots': // Request to retrieve what script types are allowed
          if (typeof dataJSON['userscript'] != 'boolean' && typeof dataJSON['userscript'] != 'string') {return;}
          this.disableAll = String(dataJSON['userscript']).toLowerCase() == 'false';
          break;
      }
    };

    this.spontaneousMessageHandler = messageHandler;
    window.addEventListener('message', messageHandler);
    return () => this.stopSpontaneousResponseListener();
  }

  /** Stops the active spontaneous response listener, if one exists.
   * @since 0.99.0
   */
  stopSpontaneousResponseListener() {
    if (this.spontaneousMessageHandler) {window.removeEventListener('message', this.spontaneousMessageHandler);}
    this.spontaneousMessageHandler = null;
    for (const controller of this.pendingTiles.values()) {controller.abort();}
    this.pendingTiles.clear();
  }

  /** Applies user data from the /me endpoint to the current overlay.
   * @param {Overlay} overlay
   * @param {Object.<string, any>} dataJSON
   * @since 0.92.1
   */
  applyUserDataToOverlay(overlay, dataJSON) {
    if (!dataJSON || typeof dataJSON != 'object' || Array.isArray(dataJSON)) {return false;}

    // If the game can not retrieve the userdata...
    if (dataJSON['status'] != null && typeof dataJSON['status'] != 'string' && typeof dataJSON['status'] != 'number') {return false;}
    if (dataJSON['status'] && String(dataJSON['status'])[0] != '2') {
      overlay.handleDisplayError(`You are not logged in or Wplace is offline!\nCould not fetch userdata.`);
      return false;
    }

    if (!Number.isSafeInteger(dataJSON['id']) || dataJSON['id'] < 0
      || !['level', 'pixelsPainted', 'droplets'].every(key => Number.isFinite(dataJSON[key]) && dataJSON[key] >= 0)) {return false;}

    const nextLevelPixels = Math.ceil(Math.pow(Math.floor(dataJSON['level']) * Math.pow(30, 0.65), (1 / 0.65)) - dataJSON['pixelsPainted']);
    if (!Number.isFinite(nextLevelPixels)) {return false;}
    this.templateManager.userID = dataJSON['id'];

    // Obtains the refill timer for charges
    if (this.chargeRefillTimerID.length != 0) {
      const chargeRefillTimer = document.querySelector('#' + this.chargeRefillTimerID);
      
      // If the refill timer exists...
      if (chargeRefillTimer) {
        /** Obtains the information about the user's charges @type {{cooldownMs: number, count: number, max: number}} */
        const chargeData = dataJSON['charges'];

        // Date that the user's charges will be refilled
        if (chargeData && ['max', 'count', 'cooldownMs'].every(key => Number.isFinite(chargeData[key]) && chargeData[key] >= 0)) {
          const endDate = Date.now() + (Math.max(0, chargeData['max'] - chargeData['count']) * chargeData['cooldownMs']);
          if (Number.isFinite(endDate)) {chargeRefillTimer.dataset['endDate'] = endDate;}
        }
      }
    }

    overlay.updateInnerHTML('bm-user-droplets', `<b>${localizeNumber(dataJSON['droplets'])}</b>`);
    overlay.updateInnerHTML('bm-user-nextlevel', `<b>${localizeNumber(nextLevelPixels)}</b> px`);
    return true;
  }

  /** Requests the current /me payload directly so the overlay has initial user data
   * even if the first network response was missed during startup.
   * @param {Overlay} overlay
   * @since 0.92.1
   */
  async requestCurrentUserData(overlay) {
    try {
      // The public Wplace API lives on the backend origin; the frontend /api/me
      // path returns 404. Keep credentials scoped to this fixed trusted origin.
      const response = await fetch('https://backend.wplace.live/me', {
        credentials: 'include'
      });

      if (response.status === 401) {return;} // Wplace supports signed-out visitors.
      if (!response.ok) {
        overlay.handleDisplayError(`Could not fetch userdata.\nHTTP ${response.status}`);
        return;
      }

      const dataJSON = await response.json();
      this.applyUserDataToOverlay(overlay, dataJSON);
    } catch (error) {
      consoleError('Failed to fetch current user data:', error);
    }
  }

  /** Applies cached /me data from sessionStorage if it was captured during early startup.
   * @param {Overlay} overlay
   * @returns {boolean}
   * @since 0.92.1
   */
  applyCachedUserData(overlay) {
    try {
      const cached = sessionStorage.getItem('bm-last-me');
      if (!cached) {return false;}

      const dataJSON = JSON.parse(cached);
      return this.applyUserDataToOverlay(overlay, dataJSON);
    } catch (error) {
      consoleError('Failed to apply cached user data:', error);
      return false;
    }
  }

}
