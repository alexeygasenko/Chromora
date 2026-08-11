# Chromora

[Website](https://alexeygasenko.github.io/Chromora/) · [Latest release](https://github.com/alexeygasenko/Chromora/releases/latest)

Chromora is a feature-focused fork of [Blue Marble](https://github.com/SwingTheVine/Wplace-BlueMarble) for [wplace.live](https://wplace.live/).

The project started with Blue Marble, then grew into a separate toolkit for checking artwork, finding unfinished areas, and preparing pixels faster.

## Features

### Smooth interface

- New Y2K look across every window.
- Choose between Glass, Light, and Dark themes; Light and Dark use solid surfaces without background blur.
- Windows open, close, minimize, expand, and change shape smoothly.
- Large templates stay responsive while Chromora works in the background.
- Windows remember where you placed them and how large they were.

### Template library

- Open the template list from the main window to see previews, coordinates, and progress for each template.
- Add several templates without replacing the ones that are already loaded.
- Enable, disable, or remove individual templates directly from their cards.
- Jump straight to any template from its card.
- Choose each template's top-left pixel in a focused coordinate picker, either by clicking the map or entering coordinates manually.

### Color Filter

- Switch between horizontal, vertical, and fullscreen views.
- Horizontal and vertical views remember their own positions.
- Hide colors you do not need and arrange the list your way.
- See how many pixels each color needs, how many are already correct, and how much work remains.
- A loader stays visible until the color information is actually ready.

### Find unfinished areas

- Pick a color and immediately see pixels painted with the wrong color.
- Show empty pixels that still need the selected color.
- Mark unfinished areas with clean outlines, without crosses or broken corners.
- Keep highlighted zones even and consistent across the whole artwork.
- Work with large artworks without the regular freezes older versions had.

### Prepare an area for painting

- Hold `Left Alt` and drag to add empty pixels that use your currently selected Wplace color.
- Hold `Left Ctrl` and drag to add every empty pixel in the area using its color from the template.
- Check the result, then press Wplace's **Paint** button yourself.
- Pixels erased from the draft can be selected and added again.
- If the whole area needs more droplets than you have, Chromora fills as much as possible from left to right.
- A warning appears only when no droplets are available at all.
- Change either hotkey in Settings whenever you need.

## What's new

### [Chromora 1.3.0](https://github.com/alexeygasenko/Chromora/releases/tag/v1.3.0)

- Keep multiple templates in one library, with a preview, coordinates, and progress for each template.
- Enable, disable, remove, or jump to any template from its card. Disabled templates stay out of map rendering, area drafting, and color statistics.
- Add templates in two steps: choose an image, then click the map or enter and confirm its top-left coordinate in a focused picker.
- Work from a cleaner main window, with version information moved to Settings and simpler window controls throughout Chromora.
- Template storage and map navigation now handle multiple tabs, legacy data, stale requests, and late responses more safely.

### [Chromora 1.2.0](https://github.com/alexeygasenko/Chromora/releases/tag/v1.2.0)

- Choose between Glass, Light, and Dark themes in Settings, with Glass kept as the default.
- Use solid, blur-free surfaces in Light and Dark while retaining the original translucent Glass appearance.
- Apply theme changes immediately and keep them after page reloads across every Chromora window and area-selection control.
- Use adaptive icons, controls, focus states, and a keyboard-accessible theme selector in every theme.
- Keep rapid settings changes and area-drafting hotkeys reliably persisted.

## Screenshots

The gallery uses the real Chromora interface rendered over an isolated Wplace-style map sandbox in Glass, Light, and Dark themes.

### Main window

<img src="./docs/assets/chromora-main.png" alt="Chromora main window in the Glass theme" width="640">

Check droplets and charges, open the template library or Settings, and keep the map visible behind the compact controls.

### Template library

<img src="./docs/assets/chromora-templates.png" alt="Chromora template library in the Dark theme with two template cards" width="700">

Review each template's preview, coordinates, and progress, then enable, disable, remove, or jump to it from the same card.

### Template coordinates

<img src="./docs/assets/chromora-template-coordinates.png" alt="Chromora template coordinate picker in the Light theme" width="640">

Choose the template's top-left pixel from the map or enter its tile and pixel coordinates manually before creating it.

### Settings and themes

<img src="./docs/assets/chromora-settings.png" alt="Chromora Settings in the Light theme with Glass, Light, and Dark choices" width="640">

Switch themes, customize hotkeys and highlights, and find the installed Chromora version at the bottom of Settings.

### Color Filter: horizontal

<img src="./docs/assets/chromora-filter-horizontal.png" alt="Chromora Color Filter in horizontal mode" width="900">

Scan many colors while keeping the filter close to the edge of the canvas.

### Color Filter: vertical

<img src="./docs/assets/chromora-filter-vertical.png" alt="Chromora Color Filter in vertical mode" width="420">

Keep a compact color checklist open beside your artwork.

### Color Filter: fullscreen

<img src="./docs/assets/chromora-filter-fullscreen.png" alt="Chromora Color Filter in fullscreen mode with artwork statistics and color cards" width="700">

See artwork progress, sort colors, and compare every color's remaining pixels in one view.

## Installation

Install the latest userscript release:

[Download latest release](https://github.com/alexeygasenko/Chromora/releases/latest)

Use `Chromora.user.js` with a userscript manager such as Tampermonkey, then refresh [wplace.live](https://wplace.live/).

## Fork and upstream

Chromora is based on [SwingTheVine/Wplace-BlueMarble](https://github.com/SwingTheVine/Wplace-BlueMarble). Original architecture, license notices, and contributor credits remain preserved.

Chromora is maintained independently and is not an official Blue Marble or Wplace project.

## License

Chromora is distributed under the Mozilla Public License 2.0 inherited from Blue Marble. See [LICENSE.txt](./LICENSE.txt).
