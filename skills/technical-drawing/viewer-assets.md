# Build the reusable viewer

Use the bundled viewer for a standalone page with editable drawing state. It includes linework, spacing, parameter sliders, part selection, coloring and export panels.

## Describe the drawings and their controls

Create a JSON configuration beside the model scripts. Paths resolve relative to that configuration.

```json
{
  "dependencies": "node_modules",
  "modelScripts": ["model.js"],
  "drawings": [{
    "id": "sleeve",
    "title": "Knurled sleeve",
    "description": "Illustrative sleeve concept with a through bore.",
    "parts": [{"id": "sleeve", "name": "Knurled sleeve"}],
    "parameters": [{
      "key": "length",
      "label": "Sleeve length",
      "min": 20,
      "max": 40,
      "default": 30,
      "step": 1,
      "unit": "mm"
    }]
  }]
}
```

Use an empty `parameters` array when the object has no suitable editable dimensions. IDs stay stable, and drawing IDs use lowercase slugs.

Two optional fields shape the settings and exports. `parameterNote` replaces the line under the parameter sliders. `concept` defaults to `true` and marks exports as illustrative, so set it to `false` only for a drawing built from authoritative dimensions.

The drawing selector appears only when the configuration holds more than one drawing.

Set `initialView` to `assembled` when the object's normal form or scale is the main subject. Assemblies otherwise start exploded; single-part drawings start assembled.

Install `jspdf`, `svg2pdf.js` and `@fontsource-variable/inter` with the project's package manager, or with `npm install` in a standalone folder. Point `dependencies` at the resulting `node_modules` folder and keep the lockfile with the generator.

The builder embeds those packages, the Inter font and its license. The generated page makes no runtime network requests.

## Implement the model boundary

Each model script registers a function in `self.DrawingModels`, keyed by drawing ID. The worker already provides `TechnicalGeometry` and `TechnicalProjection`.

The worker calls each model with the parameter values and `{explosion, fitExplosion, isolated}`.

Preserve existing registrations when the viewer includes multiple model scripts.

```js
self.DrawingModels ??= {};
self.DrawingModels.sleeve = (parameters, options) => {
  const G = TechnicalGeometry;
  const p = G.part('sleeve', 'Knurled sleeve', [25, 0, 0]);
  const length = parameters.length;
  if (!Number.isFinite(length) || length < 20 || length > 40) {
    throw Error('Length must be 20–40');
  }
  G.lathe(p, [[0, 5], [length, 5], [length, 3], [0, 3]]);
  G.knurl(p, {x0: 2, x1: length - 2, radius: 5.01, starts: 12, pitch: 40});
  return TechnicalProjection.render([p], {...options, camera: {azimuth: -128, elevation: 30, roll: 0}});
};
```

Validate parameter ranges inside the model too. A different renderer may return `{markup}` with SVG geometry using the same group and line-role contract.

Group complete parts with `data-item`, a unique named `id` and a `title`. Apply `data-line-role` to every ink path, preserving explicit surface fills and opening geometry.

Mark filled ink, including engraved text and arrowheads, with `data-ink-fill`. The viewer resolves its source color before export and adapts its preview color with the linework.

Keep occluding faces unmarked and explicitly paper-colored. A filled-ink marker identifies content to recolor, not every closed surface.

Return coordinates in millimeters on the 420 × 297 mm sheet. `TechnicalProjection.render` already fits them, and the viewer draws them unscaled. `render` applies each part's explosion vector scaled by `explosion` and drops parts outside `isolated`, so models pass both options through. Handle them in the model only when spacing or isolation changes the geometry itself.

Treat model code as generator source you control. Sanitize imported SVG before it reaches this boundary, following **Make the standalone page work from disk** in [preview-page.md](preview-page.md).

## Build one portable file

Run [scripts/build-viewer.cjs](scripts/build-viewer.cjs) with the configuration and destination:

```sh
node tools/technical-drawing/scripts/build-viewer.cjs drawing.json dist/index.html
```

Deliver the resulting HTML alongside `evidence.md`, the configuration, model scripts, dependency lockfile and copies of the skill's `assets/` and `scripts/` folders kept side by side. Record the regeneration command against those copies, such as `node tools/technical-drawing/scripts/build-viewer.cjs drawing.json dist/index.html`, in `evidence.md`.

[assets/viewer.html](assets/viewer.html) owns the shell, [assets/viewer.js](assets/viewer.js) owns interaction state and [assets/export.js](assets/export.js) owns export snapshots. [assets/worker.js](assets/worker.js) runs the models away from the controls, one job at a time.

A newer preview supersedes queued and running ones, and slider input is debounced. Downloads stay disabled until the current drawing is ready.
