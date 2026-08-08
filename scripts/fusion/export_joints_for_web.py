"""
export_joints_for_web.py

Run this INSIDE Fusion 360 (Scripts & Add-ins > Scripts > "+" > Create,
paste this in, Run) against the same design you're about to export as
STEP for the portfolio site. It reads every joint's axis, pivot, and
limits straight from the Fusion API and writes them to a JSON sidecar
file the site's CAD viewer (js/viewer.js) reads automatically, based
on filename: point it at "model.step" and it'll also look for
"model.joints.json" right next to it.

See scripts/fusion/README.md for the full setup/run instructions and
the JSON schema this produces.

WHAT THIS DOES NOT DO (by design, not oversight — see the portfolio
project's plan doc for the full reasoning):
  - Chained/dependent joints (a robot-arm-style joint whose motion
    should carry a second joint's parts along with it) are exported as
    independent joints. Each moves correctly on its own; a downstream
    joint will NOT visually follow its parent's rotation on the site.
  - Multi-DOF joint types (ball, planar, cylindrical) are skipped —
    they don't fit a single slider. They're listed in the output's
    "skipped" array so nothing silently vanishes without a reason.

TWO ASSUMPTIONS THIS SCRIPT MAKES, WORTH KNOWING ABOUT:
  1. It only reads design.rootComponent.joints. If a joint lives inside
     a sub-component (a nested sub-assembly), this script won't see
     it — it's written for the common case of a flat, single-level
     assembly (which is where Fusion puts a joint by default when you
     create it between two top-level components).
  2. For each joint, whichever component you selected FIRST when
     creating it (Fusion calls this `occurrenceOne`) is treated as the
     part that moves. This is Fusion's own convention, but if a joint
     visibly drives the wrong body on the site, the fix is a one-line
     edit to the generated JSON's "components" list for that joint —
     no need to re-run this script.
"""

import adsk.core
import adsk.fusion
import json
import math
import os
import traceback


def joint_type_name(joint_motion):
    """Human-readable type name for an unsupported joint, from its
    internal object type string (e.g. "adsk::fusion::BallJointMotion"
    -> "BallJointMotion"), used only for the "skipped" report."""
    raw = joint_motion.objectType if joint_motion else "unknown"
    return raw.split("::")[-1] if raw else "unknown"


def export_revolute(joint, motion):
    origin = joint.origin  # Point3D, root/world space, Fusion's internal unit = cm
    axis = motion.rotationAxisVector  # Vector3D, same space
    limits = motion.rotationLimits

    min_deg = math.degrees(limits.minimumValue) if limits.isMinimumValueEnabled else -180.0
    max_deg = math.degrees(limits.maximumValue) if limits.isMaximumValueEnabled else 180.0
    value_deg = math.degrees(motion.rotationValue)

    return {
        "type": "revolute",
        "origin": [origin.x * 10, origin.y * 10, origin.z * 10],  # cm -> mm
        "axis": [axis.x, axis.y, axis.z],
        "min": round(min_deg, 3),
        "max": round(max_deg, 3),
        "value": round(value_deg, 3),
    }


def export_slider(joint, motion):
    axis = motion.slideDirectionVector  # Vector3D
    limits = motion.slideLimits

    min_mm = (limits.minimumValue * 10) if limits.isMinimumValueEnabled else -100.0
    max_mm = (limits.maximumValue * 10) if limits.isMaximumValueEnabled else 100.0
    value_mm = motion.slideValue * 10  # cm -> mm

    return {
        "type": "slider",
        "axis": [axis.x, axis.y, axis.z],
        "min": round(min_mm, 3),
        "max": round(max_mm, 3),
        "value": round(value_mm, 3),
    }


def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface

        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            ui.messageBox("No active Fusion design found. Open your assembly first, then run this script.")
            return

        root = design.rootComponent
        joints = root.joints
        if joints.count == 0:
            ui.messageBox(
                "No joints found on the root component.\n\n"
                "This script only looks at design.rootComponent.joints — if your "
                "joints live inside a sub-component, see the note at the top of "
                "this script's source for why, and flatten the assembly or ask "
                "for this to be extended."
            )
            return

        exported = []
        skipped = []

        for joint in joints:
            motion = joint.jointMotion
            name = joint.name or "Joint"

            revolute = adsk.fusion.RevoluteJointMotion.cast(motion)
            slider = adsk.fusion.SliderJointMotion.cast(motion)

            if revolute:
                data = export_revolute(joint, revolute)
            elif slider:
                data = export_slider(joint, slider)
            else:
                skipped.append({"name": name, "reason": "unsupported joint type: " + joint_type_name(motion)})
                continue

            mover = joint.occurrenceOne
            if not mover:
                skipped.append({"name": name, "reason": "couldn't determine which occurrence moves (occurrenceOne is empty)"})
                continue

            data["name"] = name
            data["components"] = [mover.name]
            exported.append(data)

        if not exported:
            ui.messageBox(
                "Found {} joint(s), but none were exportable (only revolute and "
                "slider joints are supported right now). See the message log "
                "(Shift+Ctrl+I, or Text Commands palette) for details on each one."
                .format(joints.count)
            )

        # Self-report to the Text Commands palette BEFORE writing anything,
        # so you can sanity-check the numbers against what you expect in
        # Fusion before this ever reaches the website.
        text_palette = ui.palettes.itemById("TextCommands")
        if text_palette:
            text_palette.isVisible = True
            text_palette.writeText("\n--- export_joints_for_web.py ---")
            for j in exported:
                if j["type"] == "revolute":
                    text_palette.writeText(
                        "  [revolute] {}  ->  moves \"{}\"  axis={}  origin={}  range=[{}, {}] deg  current={} deg"
                        .format(j["name"], j["components"][0], j["axis"], j["origin"], j["min"], j["max"], j["value"])
                    )
                else:
                    text_palette.writeText(
                        "  [slider]   {}  ->  moves \"{}\"  axis={}  range=[{}, {}] mm  current={} mm"
                        .format(j["name"], j["components"][0], j["axis"], j["min"], j["max"], j["value"])
                    )
            for s in skipped:
                text_palette.writeText("  [skipped]  {} — {}".format(s["name"], s["reason"]))
            text_palette.writeText("--- {} exported, {} skipped ---\n".format(len(exported), len(skipped)))

        if not exported:
            return

        file_dialog = ui.createFileDialog()
        file_dialog.isMultiSelectEnabled = False
        file_dialog.title = "Save joints JSON — use the SAME name as your STEP export"
        file_dialog.filter = "JSON files (*.json)"
        file_dialog.filenameList = [design.rootComponent.name + ".joints.json"]
        result = file_dialog.showSave()
        if result != adsk.core.DialogResults.DialogOK:
            return

        filename = file_dialog.filename
        if not filename.lower().endswith(".json"):
            filename += ".json"

        output = {"units": "mm", "joints": exported, "skipped": skipped}
        with open(filename, "w") as f:
            json.dump(output, f, indent=2)

        ui.messageBox(
            "Wrote {}\n\n{} joint(s) exported, {} skipped.\n\n"
            "Rename this file so it matches your STEP export exactly, e.g. "
            "\"model.step\" needs \"model.joints.json\" — same folder, same "
            "base name — then drop both into assets/cad/<project>/."
            .format(os.path.basename(filename), len(exported), len(skipped))
        )

    except Exception:
        if ui:
            ui.messageBox("export_joints_for_web.py failed:\n{}".format(traceback.format_exc()))
