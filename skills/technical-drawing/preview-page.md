# View, color and download the drawing

## Keep the page centered on the drawing

Use a continuous white page with the object centered directly on it. Default to a single selected view, without a gallery, sidebar, header, sheet border or contrasting canvas.

Place compact controls near the page edge. Keep color options, downloads and explanatory text in panels that open on demand.

When several drawings are requested, use a small selector. When several views help explain one object, offer a separate view selector.

Provide these controls:

| Control | Behavior |
| --- | --- |
| Zoom out and Zoom in | Change viewing magnification without changing the drawing |
| Fit | Restore the whole-sheet view and recalculate it when the viewport changes |
| Color | Open line-color presets, a custom picker and a reset action |
| Download SVG | Save the editable vector source |
| Download PNG | Save the full sheet at the stated pixel dimensions |
| Download PDF | Save the full vector sheet at its physical page size |

Show the zoom percentage and bound its range. A useful starting range is 25–400% of fitted size, with `Fit` labeled separately from physical scale.

Keep enlarged artwork in a scrollable viewport so every edge remains reachable with a keyboard or touch. Reserve space for controls, including their wrapped height on narrow screens.

`better-layout` owns responsive arrangement, `better-accessibility` owns control semantics and keyboard behavior, and `better-writing` owns control copy.

## Give the control bar a dark pill shape

Use Inter at `13px` with a fully rounded bar and buttons. Bundle the font locally, including its license, so the page remains self-contained.

Use these values for the bar, keeping the drawing background white:

| Property | Value |
| --- | --- |
| Surface | `rgb(20 20 20 / 0.9)` |
| Bar and button radius | `9999px` |
| Default text | `rgb(255 255 255 / 0.6)` |
| Hover text | `rgb(255 255 255 / 0.85)` |
| Open control | White text on `rgb(255 255 255 / 0.14)` |
| Shadow | `inset 0 0 0 1px rgb(255 255 255 / 0.1), 0 8px 24px rgb(0 0 0 / 0.25)` |

Center the bar near the bottom edge and account for the device's safe area. Preserve its pill shape when controls wrap on narrow screens.

## Color the drawing without changing its construction

Start with dark linework on white. Apply color to the entire drawing, with individual-part overrides when the geometry has stable part IDs.

Keep matching parts the same color across views. Retain stroke widths, hidden-line patterns, hatching and white occluding faces when changing line colors.

Name the edited property explicitly, such as `Line color`. A surface-fill option requires actual closed surface geometry; open contours cannot be filled reliably.

Keep color choices in drawing state alongside the selected view. Reset restores the original appearance without changing geometry or zoom.

`better-colors` owns palette choices and rendered contrast. Decorative part colors do not imply established materials or safety classifications.

## Export the selected view and colors

Generate the files from the finished drawing using **Export from the same source** in [sheet-and-svg.md](sheet-and-svg.md). Give them consistent filenames, such as `microphone.svg`, `microphone.png` and `microphone.pdf`.

Preserve source geometry independently of the viewer layout. Serialize the selected view and current colors into one SVG, then derive every export from that representation.

Viewing zoom and scrolling must never change the download. Rasterize the complete SVG at the chosen resolution, excluding the toolbar and surrounding page.

Generate editable-color exports on demand, or refresh them after each edit. A download must reflect the visible color state rather than an earlier monochrome file.

Use a vector-capable PDF exporter that supports the drawing's paths, clipping and styles. Bundle required runtime libraries locally for offline use.

`window.print()` opens a dialog; it does not produce a downloadable PDF by itself. If printing is offered separately, label it `Print`.

If a renderer is unavailable, explain which format could not be produced and expose the available downloads. Never attach another format to a misleading extension.

## Make the standalone page work from disk

Package `index.html` beside the exports and generator. Keep runtime scripts, styles and preview assets local, using the existing project setup only when the user requested integration.

For a self-contained page, embed source SVG, scripts and required assets in its build output. This avoids fetching neighboring files from an opaque `file:` origin.

Prebuilt formats can supply an ordinary download link from embedded bytes:

```js
function attachDownload(link, { base64, type, filename }) {
  const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  link.href = url;
  link.download = filename;
  return url;
}
```

Use `image/svg+xml`, `image/png` and `application/pdf` for the corresponding MIME types. Base64-encode UTF-8 SVG bytes during generation so non-ASCII labels survive.

Retain each Blob URL while its link or preview uses it. Revoke superseded URLs when replacing a drawing, after their consumers have switched.

Encode embedded data safely for its HTML context. Treat SVG supplied by another source as document content, and remove scripts and external resources before embedding.

The standalone page should open offline without installation. Leave publication and hosting outside this workflow unless requested.

## Keep viewing scale separate from paper scale

Size the displayed sheet inside a scrollable stage. Layout dimensions must grow with zoom so scrollbars expose the enlarged artwork.

A CSS transform alone does not reserve the enlarged sheet's layout space. Resize a containing stage too, or change the image's rendered width and height directly.

`Fit` is a viewing convenience, not a claim that the drawing appears at its printed scale. Preserve physical dimensions in the SVG and PDF files.

## Test the controls and the downloaded bytes

Open the generated page from disk and exercise zoom, Fit, color selection, reset and every download. Test wide and narrow viewports, including keyboard access and panel dismissal.

Change whole-drawing and individual-part colors, then switch views where available. Download after zooming and scrolling, confirming that every format preserves the complete selected view and its colors.

Check PNG pixel dimensions and PDF page count, size and vector content. Render the downloaded PDF independently and inspect its labels, fine lines and sheet edges.

Verify that the page works offline without failed requests. If browser testing is unavailable, state that limitation and provide the standalone files for inspection.
