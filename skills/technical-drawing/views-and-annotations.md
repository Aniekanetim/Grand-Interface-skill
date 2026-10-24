# Choose the view and its annotation grammar

## Explode along the assembly paths

Keep the assembled and exploded cameras identical unless a second angle reveals something necessary. Identify any camera change in the view label.

Choose a primary disassembly axis. Translate components along it, preserving their orientation, then separate secondary hardware along its own insertion axis.

Each offset begins at the component's assembled placement. Setting all explosion offsets to zero must reconstruct the assembly.

Choose gaps in paper space after projection. Start with 8–15 mm of clear space between silhouettes, increasing it where leaders or inner surfaces need room.

Keep stacks such as screw, washer, cover and boss coaxial. Show the real locating features at both ends of an assembly trail.

Use fine chain lines for necessary trails and omit redundant ones. Stop trails at their attachment features or conceal them behind opaque parts. The renderer draws them through **Draw axes and assembly trails** in [geometry-library.md](geometry-library.md).

A part nested inside another clears it only when its travel exceeds the outer part's projected depth. Judge the gap between silhouettes in the proof, not between the parts' faces in the model.

Put small features on the side of a lifted part away from the viewer, toward the front of the page. A post behind a lever vanishes once the lever rises.

Hold fasteners just clear of their holes. A screw sent to the end of a vertical stack lands over unrelated parts and stops pointing at its hole. When the part it joins also moves, combine both motions into one diagonal vector.

An internal part at the back of an enclosure rises behind the lifted shell. Place tall internals toward the viewer's side, raise the shell further or drop a part that only obscures the others.

Coaxial discs at diameter `D` clear each other when their center spacing exceeds `D × tan(elevation)` plus their thickness. A deep stack becomes a tall column using a third of landscape A3, so lower the elevation or accept the narrow composition.

For a long object, explode along its axis and move a secondary mechanism to a parallel row joined by a trail. To set a group beside the stack without changing its depth, offset it along the camera's right vector from **Know which way the camera looks** in [geometry.md](geometry.md). When a straight trail between rows would cross parts, leave the rows unjoined with parallel axes. Fit the whole drawing before judging page use, since a long diagonal leaves empty corners.

Drop a trail that crosses an unrelated part or ends inside a cavity. A trail earns its place by connecting two visible locating features.

Each part takes one explosion vector. When members of a group separate, such as lens elements in their cell, make each a part and name it within the group, such as `Front group, element 1`.

An explosion should reveal mating surfaces, not just spread silhouettes across the page. Preserve enough assembled context to explain where each group belongs.

## Align orthographic views

Use a common scale and preserve corresponding widths, heights and hole positions between views.

Follow the supplied projection convention. Without one, select and label a convention explicitly. Third-angle places the top view above the front and the right-side view to its right.

First-angle places those views below and to the left. Never combine the two arrangements on one sheet.

Use hidden edges only where they explain features absent from the visible outlines. Draw centerlines through holes and axes rather than adding a background grid.

## Cut material, not empty space

Locate the cutting plane on a parent view, label both ends and show the viewing direction. Give the resulting section the same designation, such as `SECTION A-A`.

Hatch the solid regions intersected by the plane. Leave holes, passages and open cavities clear. Vary hatch direction or spacing between adjacent components.

For an illustrative section, start with 45° hatching at 2–3 mm spacing on paper. Enlarge narrow regions or adjust spacing before they become solid black.

For formal drafting, check the chosen standard's exceptions for ribs, shafts and fasteners. A visually plausible cutaway does not establish standards compliance.

## Attach each balloon to one item

Use sequential item IDs from the inventory, without renumbering them when the layout changes. A parts list has `ITEM`, `DESCRIPTION` and `QTY` columns.

Quantities describe the complete depicted assembly. One balloon may identify repeated identical fasteners; the parts list gives their total count.

Place balloons in loose perimeter lanes, ordered to reduce leader crossings. Start with 7 mm diameter circles and center their numbers optically.

Route a leader from its feature to one elbow, then to the balloon edge. Use a small filled dot on a surface or an arrowhead at an edge.

Keep at least 2 mm between a leader and unrelated lettering. Prefer moving a balloon over adding another elbow.

Use stable feature anchors, such as `cover.fastener[0].center`, rather than guessing a nearby screen coordinate. Reproject anchors whenever the view changes.

## Dimension only what is established

Dimension model-space features in the view that shows their true shape. An exploded gap is a layout choice, never a product dimension.

Derive dimension labels from the same parameters as the geometry. Distinguish diameter `Ø` from radius `R`, and give units once for the sheet unless values use mixed units.

Prefer an orthographic view for dimensions, with extension lines outside the part. Start the first dimension 10 mm from the silhouette and successive dimensions 7 mm farther out.

Leave a 1 mm gap before each extension line and extend it 2 mm past the dimension line. Use filled arrowheads about 2.5 mm long.

These spacing values are an illustrative sheet recipe. A supplied drafting standard or established drawing template takes precedence.

Keep numbers readable from the sheet's chosen reading direction. Put radius leaders on the actual arc.

In circular views, place diameter lines through the circle's center. In axial views or sections, span the corresponding outside or inside surfaces and retain the `Ø` prefix.

Use `NTS` for fitted illustrations. Claim a numeric scale only when model units, projection and physical page output were all checked.
