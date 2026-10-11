# View the sheet and download the drawing

## Keep the page centered on the drawing

Give the sheet most of the viewport. Place a compact title, sheet size and controls above it, keeping interface chrome outside the artwork.

Provide these controls:

| Control | Behavior |
| --- | --- |
| Zoom out and Zoom in | Change viewing magnification without changing the drawing |
| Fit | Restore the whole-sheet view and recalculate it when the viewport changes |
| Download SVG | Save the editable vector source |
| Download PNG | Save the full sheet at the stated pixel dimensions |
| Download PDF | Save the full vector sheet at its physical page size |

Show the zoom percentage and bound its range. A useful starting range is 25–400% of fitted size, with `Fit` labeled separately from physical scale.

Keep oversized sheets inside a scrollable viewport so every edge remains reachable with a keyboard or touch. Let controls wrap above that viewport on narrow screens.

`better-layout` owns responsive arrangement, `better-accessibility` owns control semantics and keyboard behavior, and `better-writing` owns control copy.

## Build every download before presenting it

Generate the files from the finished drawing using **Export from the same source** in [sheet-and-svg.md](sheet-and-svg.md). Give them consistent filenames, such as `microphone.svg`, `microphone.png` and `microphone.pdf`.

Preserve a canonical SVG string or byte array independently of the viewer DOM. Use it for the displayed sheet and the exported SVG.

Viewing zoom and scrolling must never change the download. Rasterize the complete SVG at the chosen resolution, excluding the toolbar and surrounding page.

Create the PDF before wiring its download. Browser printing can generate it during authoring, with the drawing isolated on a page of the correct physical size.

`window.print()` opens a dialog; it does not produce a downloadable PDF by itself. If printing is offered separately, label it `Print`.

If a renderer is unavailable, explain which format could not be produced and expose the available downloads. Never attach another format to a misleading extension.

## Make the standalone page work from disk

Package `index.html` beside the exports and generator. Keep runtime scripts, styles and preview assets local, using the existing project setup only when the user requested integration.

For a self-contained page, embed export bytes in its build output and create Blob URLs at runtime. This avoids fetching neighboring files from an opaque `file:` origin.

An embedded base64 payload can supply an ordinary download link:

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

Open the generated page from disk and exercise zoom, Fit and every download. Test a wide viewport and a narrow one, including keyboard access to the controls.

Download again after zooming and scrolling. Confirm that each saved file still contains the entire sheet, and that the SVG matches the canonical source.

Check PNG pixel dimensions and PDF page count, size and vector content. Render the downloaded PDF independently and inspect its labels, fine lines and sheet edges.

Verify that the page works offline without failed requests. If browser testing is unavailable, state that limitation and provide the standalone files for inspection.
