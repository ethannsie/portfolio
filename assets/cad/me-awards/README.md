Drop your award STEP files here (e.g. `most-unique-award.step`,
`best-teamwork-award.step`, or however you want to name each one) and
list them in the `cad` array for this project in `js/data.js`. Since
`cad` now accepts an array, each file you list shows up as its own
full exploded-view model in a horizontally scrollable strip on the
project page — no extra code needed, just add the path to the array.

Export tips:
- Export each award as its own assembly, not a single fused body — if
  a design has multiple parts (e.g. base + figure), each part should
  land as its own solid so it can explode apart in the viewer.
- Fusion 360, Onshape, and SolidWorks can all export STEP (AP214 or
  AP242) directly from a "Save As" / "Export" dialog.
