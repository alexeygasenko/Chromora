import closeAsset from "./assets/window-close.png";
import settingsAsset from "./assets/settings.png";
import enterFullscreenAsset from "./assets/enter-fullscreen.png";
import exitFullscreenAsset from "./assets/exit-fullscreen.png";
import horizontalLayoutAsset from "./assets/layout-horizontal.png";
import verticalLayoutAsset from "./assets/layout-vertical.png";
import highlightPixelsAsset from "./assets/highlight-pixels.png";
import colorVisibleAsset from "./assets/color-visible.png";
import colorHiddenAsset from "./assets/color-hidden.png";

function iconMarkup(source, className = 'bm-button-icon') {
  return `<span class="bm-raster-icon ${className}" style="--bm-icon-image: url('${source}')" aria-hidden="true"></span>`;
}

export const closeIcon = iconMarkup(closeAsset);
export const settingsIcon = iconMarkup(settingsAsset, 'bm-button-icon bm-button-icon-settings');
export const enterFullscreenIcon = iconMarkup(enterFullscreenAsset, 'bm-button-icon bm-button-icon-fullscreen');
export const exitFullscreenIcon = iconMarkup(exitFullscreenAsset);
export const horizontalLayoutIcon = iconMarkup(horizontalLayoutAsset);
export const verticalLayoutIcon = iconMarkup(verticalLayoutAsset);
export const highlightPixelsIcon = iconMarkup(highlightPixelsAsset, 'bm-filter-highlight-icon');
export const colorVisibleIcon = iconMarkup(colorVisibleAsset, 'bm-filter-eye-icon');
export const colorHiddenIcon = iconMarkup(colorHiddenAsset, 'bm-filter-eye-icon');
