# Chromora website

A static landing page. Open `index.html`, or serve this directory with a local HTTP server. No framework, build step, analytics, remote fonts, or API key is needed.

```sh
python -m http.server 4173 --directory website
```

The existing GitHub Pages workflow uploads this directory as its complete artifact. Publishing is manual through the `Deploy Chromora website` workflow.

## Assets

- `assets/art/` contains lossless WebP versions of the project mascot and banner from `docs/assets/`.
- `assets/examples/` contains lossless WebP versions of the real Glass screenshots listed in `docs/assets/examples-manifest.json`. Screenshots retain their native dimensions and decoded pixels. The page displays complete images; clicking opens a larger preview.
- `assets/fonts/` contains local Latin subsets of Exo 2 and PT Sans, plus their OFL licenses. The original font sources and provenance are in `build/assets/aero/`.

The interface screenshots were captured live on Wplace in the Glass theme. Download links open the latest published GitHub release, where `Chromora.user.js` is available.

The stylesheet, script, and recaptured highlight/area-button images use content-hash query strings in `index.html`. Refresh those strings when replacing the corresponding files, so an already-open preview cannot reuse an older cached image.

## Interaction and accessibility

The Color Filter gallery supports Left/Right arrows and Home/End. Image previews support Escape, native dialog focus handling, and return focus to the image link. Without JavaScript, image links still open the full image and the page remains readable. Native disclosure elements provide the FAQ; no data is stored by the website.

The layout supports narrow screens and reduced motion. Important text and controls are real HTML, including the heading over the mascot.
