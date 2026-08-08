# Exporting joint motion for the CAD viewer

STEP files (what `js/viewer.js` parses) don't carry joint or motion
data — only static geometry. To get a real, draggable joint on the
website, `export_joints_for_web.py` reads each joint's axis, pivot,
and limits directly out of the Fusion API and writes them to a small
JSON file that sits next to your STEP export. The site discovers it
automatically by filename, no other setup needed.

Covers both ways of creating a joint in Fusion — the regular
Assemble > Joint tool, and Assemble > As-built Joint (for when the
components were already positioned correctly and you defined the
joint afterward) — since both show up under different collections in
Fusion's own API.

## Running it

1. Open your assembly in Fusion 360.
2. **Scripts and Add-ins** (Shift+S) → **Scripts** tab → the green
   **+** → **Create**.
3. Choose **Python**, give it any name, hit Create — Fusion opens its
   script editor.
4. Delete the placeholder code, paste in the contents of
   `export_joints_for_web.py`, save (Cmd+S).
5. Back in the Scripts and Add-ins dialog, select it and hit **Run**.
6. A **Text Commands** panel opens at the bottom of the Fusion window
   listing every joint it found — what it's exporting, its axis/pivot/
   range, and anything it skipped and why. **Check this before
   continuing** — it's your one chance to catch something looking
   obviously wrong (a flipped axis, a joint that got skipped) before
   it reaches the website.
7. A save dialog appears — save the JSON **with the same base name
   you'll use for the STEP export**, e.g. `model.joints.json` next to
   `model.step`.
8. Export the STEP as you normally would (File → Export).
9. Drop both files into `assets/cad/<project-slug>/` and reference the
   STEP file from that project's `cad` field in `js/data.js` exactly
   like you already do — the `.joints.json` file needs no mention
   anywhere; the viewer finds it on its own next to the STEP file.

## If a joint looks wrong on the site

- **Moves the wrong part entirely**: open the `.joints.json` file,
  find that joint, and change its `"components"` array to the correct
  part name (matching what shows up in that model's Bill of Materials
  panel on the site). No need to re-run the script.
- **Rotates around the wrong point, or the wrong direction**: this
  script assumes `joint.origin` and the joint motion's axis vector are
  both already in the assembly's root/world space, which should be
  the normal case. If it's off, flip the sign of the three `"axis"`
  numbers by hand and refresh — that covers the most common case
  (right-hand-rule direction guessed backwards).
- **Doesn't show up at all**: open the browser console on that
  project's page — every joint that got skipped or failed to match a
  part logs a `console.warn` explaining exactly why (wrong type, no
  matching part name, etc.), along with the list of part names the
  model actually has, so a naming mismatch is easy to spot.

## What's out of scope (on purpose)

- **Motion Links** — if you used Assemble > Motion Link to couple two
  joints with a ratio (gears, rack-and-pinion, a cam follower, etc.),
  that coupling isn't exported. Both linked joints still export and
  work individually on the site, but dragging one won't move the
  other the way it does in Fusion — the script tells you the count of
  Motion Links it found so this isn't a silent surprise.
- **Ball / planar / cylindrical joints** — anything with more than one
  degree of freedom doesn't fit a single slider, so these are left out
  and listed in the JSON's `"skipped"` array instead of guessed at.
- **Nested sub-assemblies** — only joints directly on
  `design.rootComponent` are read (both regular Joints and As-built
  Joints). A joint created inside a sub-component won't be found.

## JSON schema (for reference — you shouldn't need to hand-edit this
beyond the fixes above)

```json
{
  "units": "mm",
  "joints": [
    {
      "name": "Lid Hinge",
      "type": "revolute",
      "components": ["Lid:1"],
      "origin": [12.5, 0, 40.2],
      "axis": [0, 0, 1],
      "min": 0,
      "max": 110,
      "value": 0
    }
  ],
  "skipped": [
    { "name": "BallJoint1", "reason": "unsupported joint type: BallJointMotion" }
  ]
}
```

`min`/`max`/`value` are degrees for `revolute`, millimeters for
`slider`. `value` is wherever the joint was posed in Fusion at export
time — the site opens showing that same pose.
