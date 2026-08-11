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
export const templatesIcon = `
  <svg class="bm-button-icon bm-button-icon-templates" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2.75" y="4" width="7.5" height="6.25" rx="1.25" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="5.25" cy="6.5" r="0.75" fill="currentColor"/>
    <path d="m4 9 1.75-1.7 1.4 1.25 1.2-1.15 1.15 1.1" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M13 5.25h8.25M13 8.75h6.25M3 14.25h18M3 18h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
export const enterFullscreenIcon = iconMarkup(enterFullscreenAsset, 'bm-button-icon bm-button-icon-fullscreen');
export const exitFullscreenIcon = iconMarkup(exitFullscreenAsset);
export const horizontalLayoutIcon = iconMarkup(horizontalLayoutAsset);
export const verticalLayoutIcon = iconMarkup(verticalLayoutAsset);
export const highlightPixelsIcon = iconMarkup(highlightPixelsAsset, 'bm-filter-highlight-icon');
export const colorVisibleIcon = iconMarkup(colorVisibleAsset, 'bm-filter-eye-icon');
export const colorHiddenIcon = iconMarkup(colorHiddenAsset, 'bm-filter-eye-icon');
