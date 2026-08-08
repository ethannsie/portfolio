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

Reads BOTH joint collections: design.rootComponent.joints (regular
Joint, positioned via drag/align) AND design.rootComponent.asBuiltJoints
(As-built Joint, defined after the components were already placed).
Both expose the same jointMotion types, so they're exported identically
— only how the pivot origin is read differs under the hood.

WHAT THIS DOES NOT DO (by design, not oversight — see the portfolio
project's plan doc for the full reasoning):
  - Motion Links (Assemble > Motion Link — the usual way to couple two
    joints with a ratio, e.g. gears, rack-and-pinion, cam followers)
    aren't exported. Each of the two linked joints still exports and
    works on its own, but they won't stay synced to each other on the
    site the way they do in Fusion — dragging one will NOT move the
    other. If the script finds any, it says so in its report.
  - Multi-DOF joint types (ball, planar, cylindrical) are skipped —
    they don't fit a single slider. They're listed in the output's
    "skipped" array so nothing silently vanishes without a reason.

ASSUMPTIONS THIS SCRIPT MAKES, WORTH KNOWING ABOUT:
  1. It only reads design.rootComponent.joints and .asBuiltJoints. If a
     joint lives inside a sub-component (a nested sub-assembly), this
     script won't see it — it's written for the common case of a flat,
     single-level assembly.
  2. For each joint, whichever component you selected FIRST when
     creating it (Fusion calls this `occurrenceOne`) is treated as the
     part that moves — falling back to `occurrenceTwo` if that raises
     an error, which happens on some As-built Joints. If a joint
     visibly drives the wrong body on the site, the fix is a one-line
     edit to the generated JSON's "components" list for that joint —
     no need to re-run this script.
  3. For an As-built Joint, there's no single `.origin` property the
     way a regular Joint has — this script falls back to reading the
     pivot off the geometry the joint was defined from. If that lookup
     fails, the joint is skipped rather than guessing a pivot that
     might be badly wrong — but the skip reason includes what the
     lookup actually found (which properties existed, what type they
     were), so a real failure can be diagnosed and fixed here without
     needing to re-run this script inside Fusion again first.
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


def _point_from_entity(entity):
    """Resolve a Point3D from a geometry entity (vertex, sketch point,
    construction point, or face) — the kind of thing a JointGeometry's
    primaryEntity commonly is."""
    if entity is None:
        return None
    for attr in ("geometry", "worldGeometry"):
        g = None
        try:
            g = getattr(entity, attr)
        except Exception:
            continue
        if g is None:
            continue
        try:
            return adsk.core.Point3D.create(g.x, g.y, g.z)
        except Exception:
            pass
        try:
            o = g.origin
            if o:
                return o
        except Exception:
            pass
    try:
        p = entity.pointOnFace
        if p:
            return p
    except Exception:
        pass
    return None


def get_joint_origin(joint):
    """Best-effort world-space pivot point (Point3D) for a joint, plus
    a short debug string describing what was actually found when the
    lookup fails — so a failure is diagnosable straight from the Text
    Commands report instead of costing another round trip through
    Fusion to add logging.

    Works directly for a regular Joint (.origin). An As-built Joint has
    no such property — as-built joints are usually created by selecting
    whole occurrences rather than reference geometry, so this tries
    several reasonable paths and gives up (returns None) rather than
    guessing, since a wrong pivot is worse than a skipped joint.

    Returns (origin_or_None, debug_string_or_None).
    """
    try:
        origin = joint.origin
        if origin:
            return origin, None
    except Exception:
        pass

    seen = []
    for attr in ("geometryOrOriginOne", "geometryOrOriginTwo"):
        geo = None
        try:
            geo = getattr(joint, attr)
        except Exception as e:
            seen.append("{}: raised {}".format(attr, type(e).__name__))
            continue
        if geo is None:
            seen.append("{}: None".format(attr))
            continue

        try:
            geo_type = geo.objectType.split("::")[-1]
        except Exception:
            geo_type = type(geo).__name__
        seen.append("{}: {}".format(attr, geo_type))

        try:
            origin = geo.origin
            if origin:
                return origin, None
        except Exception:
            pass
        try:
            origin = geo.geometry.origin
            if origin:
                return origin, None
        except Exception:
            pass
        try:
            entity = geo.primaryEntity
            origin = _point_from_entity(entity)
            if origin:
                return origin, None
            if entity is not None:
                try:
                    seen[-1] += " (primaryEntity: {})".format(entity.objectType.split("::")[-1])
                except Exception:
                    pass
        except Exception:
            pass

    return None, ("; ".join(seen) if seen else "no geometryOrOrigin properties found")


def export_revolute(origin, motion):
    axis = motion.rotationAxisVector  # Vector3D, root/world space
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


def export_slider(motion):
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


def get_moving_occurrence(joint):
    """Best-effort "moving side" occurrence for a joint. .occurrenceOne
    is Fusion's own convention for this, but on at least some As-built
    Joints it raises an internal API error instead of returning None
    (seen in practice, not just theoretical) — so this tries it, falls
    back to .occurrenceTwo, and gives up (returns None) rather than
    letting that error kill the whole export run."""
    for attr in ("occurrenceOne", "occurrenceTwo"):
        try:
            occ = getattr(joint, attr)
        except Exception:
            continue
        if occ:
            return occ
    return None


def count_motion_links(root):
    """Returns the number of Motion Links on the root component, or
    None if that collection couldn't be read (older API version, or
    the property name differs from what's expected here) — None means
    "unknown", not "zero", so callers should stay silent rather than
    report a possibly-wrong count."""
    try:
        return root.motionLinks.count
    except Exception:
        return None


def diagnostic_dump_motion_link(root, text_palette):
    """TEMPORARY: dumps every readable property on the first Motion
    Link so the real ratio/ direction fields can be identified from a
    live file instead of guessed. Actually composing motion-linked
    joints (so dragging one moves the other, matching Fusion's ratio)
    needs this ground truth first — a wrong guess here would silently
    move a part to the wrong angle rather than fail cleanly, which is
    worse than not supporting it yet. Safe to run: read-only, doesn't
    touch anything this script writes out."""
    if not text_palette:
        return
    try:
        links = root.motionLinks
    except Exception as e:
        text_palette.writeText("  (motion link diagnostic: root.motionLinks raised {})".format(type(e).__name__))
        return
    if links.count == 0:
        return

    text_palette.writeText("\n--- Motion Link diagnostic (first link, temporary — ignore for normal use) ---")
    link = links.item(0)
    for attr in sorted(dir(link)):
        if attr.startswith("_"):
            continue
        try:
            val = getattr(link, attr)
        except Exception as e:
            text_palette.writeText("  .{} -> raised {}".format(attr, type(e).__name__))
            continue
        if callable(val):
            continue
        try:
            if hasattr(val, "objectType"):
                type_name = val.objectType.split("::")[-1]
                friendly = None
                try:
                    friendly = val.name
                except Exception:
                    pass
                text_palette.writeText("  .{} = <{}{}>".format(attr, type_name, " '{}'".format(friendly) if friendly else ""))
            else:
                text_palette.writeText("  .{} = {}".format(attr, val))
        except Exception:
            text_palette.writeText("  .{} = <unprintable>".format(attr))
    text_palette.writeText("--- end diagnostic ---\n")


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

        joint_sources = []
        for j in root.joints:
            joint_sources.append(("joint", j))
        for j in root.asBuiltJoints:
            joint_sources.append(("as-built joint", j))

        if not joint_sources:
            ui.messageBox(
                "No joints or as-built joints found on the root component.\n\n"
                "This script only looks at design.rootComponent.joints and "
                ".asBuiltJoints — if yours live inside a sub-component, see the "
                "note at the top of this script's source for why, and flatten "
                "the assembly or ask for this to be extended."
            )
            return

        exported = []
        skipped = []

        for source_label, joint in joint_sources:
            motion = joint.jointMotion
            name = joint.name or "Joint"

            revolute = adsk.fusion.RevoluteJointMotion.cast(motion)
            slider = adsk.fusion.SliderJointMotion.cast(motion)

            if revolute:
                origin, debug_info = get_joint_origin(joint)
                if origin is None:
                    reason = "couldn't determine the pivot point for this {}".format(source_label)
                    if debug_info:
                        reason += " (found: {})".format(debug_info)
                    skipped.append({"name": name, "reason": reason})
                    continue
                data = export_revolute(origin, revolute)
            elif slider:
                data = export_slider(slider)
            else:
                skipped.append({"name": name, "reason": "unsupported joint type: " + joint_type_name(motion)})
                continue

            mover = get_moving_occurrence(joint)
            if not mover:
                skipped.append({"name": name, "reason": "couldn't determine which occurrence moves (occurrenceOne/occurrenceTwo both empty or inaccessible)"})
                continue

            data["name"] = name
            data["components"] = [mover.name]
            exported.append(data)

        if not exported:
            ui.messageBox(
                "Found {} joint(s), but none were exportable (only revolute and "
                "slider joints are supported right now). See the message log "
                "(Shift+Ctrl+I, or Text Commands palette) for details on each one."
                .format(len(joint_sources))
            )

        link_count = count_motion_links(root)

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
            if link_count:
                text_palette.writeText(
                    "  NOTE: {} Motion Link(s) found on the root component. These are "
                    "NOT exported — chained/dependent motion isn't supported yet, so "
                    "each linked joint above will move independently on the site "
                    "instead of following its Fusion ratio. See README.md."
                    .format(link_count)
                )
            text_palette.writeText("--- {} exported, {} skipped ---\n".format(len(exported), len(skipped)))
            diagnostic_dump_motion_link(root, text_palette)

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

        summary = (
            "Wrote {}\n\n{} joint(s) exported, {} skipped.\n\n"
            "Rename this file so it matches your STEP export exactly, e.g. "
            "\"model.step\" needs \"model.joints.json\" — same folder, same "
            "base name — then drop both into assets/cad/<project>/."
            .format(os.path.basename(filename), len(exported), len(skipped))
        )
        if link_count:
            summary += (
                "\n\nHeads up: {} Motion Link(s) were found and are not exported "
                "— linked joints will move independently on the site rather than "
                "staying synced the way they do in Fusion. See README.md."
                .format(link_count)
            )
        ui.messageBox(summary)

    except Exception:
        if ui:
            ui.messageBox("export_joints_for_web.py failed:\n{}".format(traceback.format_exc()))
