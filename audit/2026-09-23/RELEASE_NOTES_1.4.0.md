Chromora 1.4.0 brings Frutiger Aero, a refreshed project home, and a broad round of fixes for templates, rendering, and compatibility with the current Wplace site.

## What's new

- **Frutiger Aero:** a fourth theme with sky-blue glass, glossy controls, green accents, and its own Exo 2 and PT Sans fonts.
- **A fresh look for the project:** a new anime mascot and banner, a rebuilt website, and a simpler README and illustrated guide with 18 real Wplace screenshots in Glass.
- **Bundled interface fonts:** the userscript includes its fonts and their licenses, so the interface no longer needs an external font service.

## Fixes and improvements

- Fixed Wplace startup and account-data loading, and restored communication between Tampermonkey and the page.
- Fixed **Use last map click** for current seasonal pixel URLs. Coordinates fill correctly, and a late reply from an earlier click cannot replace a newer selection.
- Preserved isolated pixels in templates with transparent areas, corrected overlapping-template color selection, and kept older templates in the right place during migration.
- Reduced unnecessary pixel reads and copies, limited concurrent rendering, and prevented old render results from overwriting newer overlays or statistics.
- Improved storage synchronization across tabs, recovery from invalid settings, and error handling in the Template Wizard.
- Fixed percentage sorting across languages, highlight presets, conflicting hotkeys, and window placement on narrow screens.
- Centered collapse icons, simplified the resize grip, and added breathing room below the horizontal color list in Frutiger Aero.
- Hardened message validation and the build workflow, updated development dependencies, and expanded regression and browser checks for the finished userscript.

## Install or update

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/) if you do not already have one.
2. Download **Chromora.user.js** from this release's assets and open it in your userscript manager. Confirm **Install** or **Update**.
3. Refresh [wplace.live](https://wplace.live/). Pick the new theme in **Settings → Appearance**.

Area selection prepares a Wplace draft. Review it, then press **Paint** yourself.

[Website](https://alexeygasenko.github.io/Chromora/) · [Illustrated guide](https://github.com/alexeygasenko/Chromora/blob/v1.4.0/docs/FEATURES.md)
