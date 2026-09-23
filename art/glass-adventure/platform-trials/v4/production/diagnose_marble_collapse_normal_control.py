"""Render a geometry-identical smooth-normal control for the collapsed marble stage."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import marble_runtime_common as COMMON  # noqa: E402
import diagnose_marble_stage_boundary as STAGE  # noqa: E402


SOURCE_RUN = STAGE.DIAGNOSTIC_ROOT / "02-through-collapse"
SOURCE_BLEND = SOURCE_RUN / "marble-stage-isolation.blend"
OUTPUT = STAGE.DIAGNOSTIC_ROOT / "03-collapse-normal-control"
ANGLE_DEGREES = 30.0


def hash_chunks(chunks: list[bytes]) -> str:
    result = hashlib.sha256()
    for chunk in chunks:
        result.update(chunk)
    return result.hexdigest()


def invariant_payload(obj: bpy.types.Object) -> dict[str, object]:
    mesh = obj.data
    if any(len(polygon.vertices) != 3 for polygon in mesh.polygons):
        raise ValueError("Normal control requires the exact triangulated collapsed mesh")
    uv = mesh.uv_layers.active
    if uv is None or len(uv.data) != len(mesh.loops):
        raise ValueError("Normal control lost UV0")
    positions = [
        struct.pack("<3f", float(vertex.co.x), float(vertex.co.y), float(vertex.co.z))
        for vertex in mesh.vertices
    ]
    indices = [
        struct.pack("<3I", *(int(index) for index in polygon.vertices))
        for polygon in mesh.polygons
    ]
    uvs = [
        struct.pack("<2f", float(item.uv.x), float(item.uv.y))
        for item in uv.data
    ]
    material_indices = [
        struct.pack("<I", int(polygon.material_index)) for polygon in mesh.polygons
    ]
    return {
        "positionsFloat32Sha256": hash_chunks(positions),
        "triangleIndicesUint32Sha256": hash_chunks(indices),
        "uv0Float32Sha256": hash_chunks(uvs),
        "polygonMaterialIndicesUint32Sha256": hash_chunks(material_indices),
        "vertices": len(mesh.vertices),
        "triangles": len(mesh.polygons),
        "loops": len(mesh.loops),
        "uvCorners": len(uv.data),
        "materialSlots": [material.name if material else None for material in mesh.materials],
    }


def normal_payload(obj: bpy.types.Object) -> dict[str, object]:
    mesh = obj.data
    chunks: list[bytes] = []
    dots: list[float] = []
    for polygon in mesh.polygons:
        face = polygon.normal.normalized()
        for loop_index in polygon.loop_indices:
            normal = mesh.corner_normals[loop_index].vector.normalized()
            chunks.append(struct.pack("<3f", float(normal.x), float(normal.y), float(normal.z)))
            dots.append(float(normal.dot(face)))
    return {
        "cornerNormalsFloat32Sha256": hash_chunks(chunks),
        "hasCustomNormals": bool(getattr(mesh, "has_custom_normals", False)),
        "sharpEdges": sum(bool(edge.use_edge_sharp) for edge in mesh.edges),
        "minimumCornerNormalDotFace": min(dots),
        "p01CornerNormalDotFace": STAGE.percentile(dots, 1),
        "p05CornerNormalDotFace": STAGE.percentile(dots, 5),
        "medianCornerNormalDotFace": STAGE.percentile(dots, 50),
        "nonPositiveCornerNormals": sum(value <= 0.0 for value in dots),
    }


def select_only(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.hide_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_smooth_control(obj: bpy.types.Object) -> dict[str, object]:
    select_only(obj)
    before_custom = bool(getattr(obj.data, "has_custom_normals", False))
    clear_result = bpy.ops.mesh.customdata_custom_splitnormals_clear()
    if "FINISHED" not in clear_result:
        raise RuntimeError(f"Could not clear collapsed custom normals: {clear_result}")
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    for edge in obj.data.edges:
        edge.use_edge_sharp = False
    shade_result = bpy.ops.object.shade_smooth_by_angle(
        angle=math.radians(ANGLE_DEGREES), keep_sharp_edges=False
    )
    if "FINISHED" not in shade_result:
        raise RuntimeError(f"Smooth-by-angle control failed: {shade_result}")
    obj.data.update()
    bpy.context.view_layer.update()
    return {
        "method": (
            "Clear the collapsed mesh custom split-normal layer, mark every polygon smooth, "
            "clear pre-existing sharp-edge flags, then run Blender shade_smooth_by_angle with "
            f"a {ANGLE_DEGREES:g}-degree hard-edge threshold."
        ),
        "angleDegrees": ANGLE_DEGREES,
        "keepExistingSharpEdges": False,
        "customNormalsExistedBeforeClear": before_custom,
        "positionsIndicesUvAndMaterialsIntentionallyChanged": False,
    }


def render_pair(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    original: bpy.types.Object,
    control: bpy.types.Object,
) -> tuple[dict[str, dict[str, Path]], dict[str, Path]]:
    views = {
        "front": ((0.0, -6.0, 0.46), (0.0, 0.0, -0.10), 1.50),
        "three-quarter": ((4.3, -6.5, 2.65), (0.0, 0.0, -0.10), 2.20),
    }
    renders: dict[str, dict[str, Path]] = {}
    sheets: dict[str, Path] = {}
    for view, (location, target, scale) in views.items():
        renders[view] = {}
        for key, visible in (("collapse-carried-normals", original), ("collapse-smooth30", control)):
            original.hide_render = visible is not original
            original.hide_set(visible is not original)
            control.hide_render = visible is not control
            control.hide_set(visible is not control)
            camera.data.ortho_scale = scale
            camera.location = location
            STAGE.point_at(camera, Vector(target))
            path = OUTPUT / f"{key}-{view}.png"
            scene.render.filepath = str(path)
            bpy.context.view_layer.update()
            bpy.ops.render.render(write_still=True)
            renders[view][key] = path
        sheet = OUTPUT / f"matched-{view}-normal-control.png"
        STAGE.contact_sheet(
            list(renders[view].values()),
            sheet,
            ["Collapse: carried normals", f"Collapse: smooth {ANGLE_DEGREES:g} degree"],
        )
        sheets[view] = sheet
    return renders, sheets


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    if COMMON.digest(SOURCE_BLEND) != "64b53250c34ddbd7cbf526c5f4ec1ae63435e95433d6f235993eb8bb4d50c34a":
        raise ValueError("Collapsed-stage source Blend no longer matches frozen diagnosis")
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE_BLEND))
    scene = bpy.context.scene
    camera = bpy.data.objects.get("V4 stage isolation camera")
    original = bpy.data.objects.get("V4_Stage_collapse")
    if camera is None or original is None or original.type != "MESH":
        raise ValueError("Frozen collapse diagnosis is missing its camera or collapsed stage")
    original_invariants = invariant_payload(original)
    original_normals = normal_payload(original)
    control = original.copy()
    control.data = original.data.copy()
    control.name = "V4_Stage_collapse_smooth30_control"
    control.data.name = control.name + "__Mesh"
    original.users_collection[0].objects.link(control)
    method = apply_smooth_control(control)
    control_invariants = invariant_payload(control)
    control_normals = normal_payload(control)
    if original_invariants != control_invariants:
        raise ValueError(
            "Smooth-normal control changed protected geometry/attribute payloads: "
            f"before={original_invariants}, after={control_invariants}"
        )
    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj not in (original, control):
            obj.hide_render = True
            obj.hide_set(True)
    renders, sheets = render_pair(scene, camera, original, control)
    original.hide_render = False
    original.hide_set(False)
    control.hide_render = False
    control.hide_set(False)
    blend = OUTPUT / "collapse-normal-control.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True, check_existing=False)
    report = {
        "schema": 1,
        "purpose": (
            "Distinguish topology damage from carried custom-normal interpolation on an exact "
            "copy of the first failing collapsed geometry. No geometry, UV, material, bake, "
            "provider, runtime, or public change."
        ),
        "status": "diagnostic control; visual conclusion recorded separately",
        "source": {
            "file": COMMON.relative(SOURCE_BLEND),
            "sha256": COMMON.digest(SOURCE_BLEND),
            "object": original.name,
        },
        "control": method,
        "protectedPayload": {
            "before": original_invariants,
            "after": control_invariants,
            "exactlyEqual": original_invariants == control_invariants,
        },
        "normalBasis": {"before": original_normals, "after": control_normals},
        "matchedClay": {
            "materialUnchanged": original_invariants["materialSlots"],
            "views": {
                view: {
                    "proofs": [STAGE.proof_record(path) for path in paths.values()],
                    "contactSheet": STAGE.proof_record(sheets[view]),
                    "pixelDelta": STAGE.image_delta(*paths.values()),
                }
                for view, paths in renders.items()
            },
            "render": {
                "engine": scene.render.engine,
                "resolution": [scene.render.resolution_x, scene.render.resolution_y],
                "blender": bpy.app.version_string,
            },
        },
        "editableSource": {
            "file": COMMON.relative(blend),
            "bytes": blend.stat().st_size,
            "sha256": COMMON.digest(blend),
        },
        "rebuild": (
            "rtk proxy timeout 300 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python art/glass-adventure/platform-trials/v4/production/"
            "diagnose_marble_collapse_normal_control.py"
        ),
    }
    report_path = OUTPUT / "report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print("COLLAPSE_NORMAL_CONTROL_REPORT=" + str(report_path), flush=True)


if __name__ == "__main__":
    main()
