"""Isolate V4 selected-to-active normal-bake failures without rebuilding the asset.

This diagnostic opens the packed authoring file so the low mesh, custom normals,
UVs and dense bake source are identical to the exported candidate.  It removes
only the provider texture normal from the dense source, then repeats the normal
bake with the production cage settings.  A positive-hemisphere result would
implicate provider-normal composition; negative tangent Z on used UVs instead
implicates a wrong dense sheet/ray hit.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy
import numpy as np
from PIL import Image as PILImage


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import marble_runtime_common as COMMON  # noqa: E402


SOURCE_BLEND = COMMON.V4 / "sources" / "cloudway-platform-kit-v4.blend"
LOW_NAME = "Cloudway_Marble__DonorShell"
HIGH_NAME = "Cloudway_Marble__DenseBakeSource"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bake one controlled geometry-only normal diagnostic.")
    parser.add_argument("--cage-extrusion", type=float, default=0.018)
    parser.add_argument("--max-ray-distance", type=float, default=0.075)
    parser.add_argument("--slug", default="production-cage")
    values = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(values)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def set_selected(objects: list[bpy.types.Object], active: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active


def main() -> None:
    args = parse_args()
    output = COMMON.V4 / "proofs" / "diagnostics" / f"marble-normal-geometry-only-2k-{args.slug}.png"
    report_path = COMMON.V4 / "proofs" / "diagnostics" / f"marble-normal-geometry-only-2k-{args.slug}.json"
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE_BLEND), load_ui=False)
    low = bpy.data.objects.get(LOW_NAME)
    high = bpy.data.objects.get(HIGH_NAME)
    if low is None or high is None:
        raise ValueError(f"Packed source lost diagnostic meshes: low={low}, high={high}")
    for collection in high.users_collection:
        collection.hide_render = False
        collection.hide_viewport = False
    high.hide_render = False
    low.hide_render = False

    source_material = bpy.data.materials.new("V4 geometry-only diagnostic source")
    source_material.use_nodes = True
    source_nodes = source_material.node_tree.nodes
    source_links = source_material.node_tree.links
    source_shader = source_nodes.get("Principled BSDF")
    source_output = source_nodes.get("Material Output")
    source_shader.inputs["Base Color"].default_value = (0.7, 0.7, 0.7, 1.0)
    source_shader.inputs["Roughness"].default_value = 0.5
    if not source_output.inputs["Surface"].is_linked:
        source_links.new(source_shader.outputs["BSDF"], source_output.inputs["Surface"])
    high.data.materials.clear()
    high.data.materials.append(source_material)

    target_material = bpy.data.materials.new("V4 geometry-only diagnostic target")
    target_material.use_nodes = True
    image = bpy.data.images.new(
        "V4 geometry-only diagnostic normal",
        width=2048,
        height=2048,
        alpha=False,
        float_buffer=False,
    )
    image.generated_color = (0.5, 0.5, 1.0, 1.0)
    image.colorspace_settings.name = "Non-Color"
    target = target_material.node_tree.nodes.new("ShaderNodeTexImage")
    target.image = image
    target_material.node_tree.nodes.active = target
    low.data.materials.clear()
    low.data.materials.append(target_material)

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 8
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 8
    settings = scene.render.bake
    settings.use_selected_to_active = True
    settings.use_clear = True
    settings.margin = 20
    settings.cage_extrusion = args.cage_extrusion
    settings.max_ray_distance = args.max_ray_distance
    settings.normal_space = "TANGENT"
    set_selected([high, low], low)
    result = bpy.ops.object.bake(type="NORMAL")
    if "FINISHED" not in result:
        raise RuntimeError(f"Geometry-only diagnostic bake failed: {result}")

    output.parent.mkdir(parents=True, exist_ok=True)
    image.filepath_raw = str(output)
    image.file_format = "PNG"
    image.save()
    with PILImage.open(output) as opened:
        pixels = np.asarray(opened.convert("RGB"), dtype=np.uint8)
    decoded_z = pixels[:, :, 2].astype(np.float32) / 127.5 - 1.0
    lengths = np.linalg.norm(pixels.astype(np.float32) / 127.5 - 1.0, axis=2)
    report = {
        "schema": 1,
        "hypothesis": (
            "The automatic cage origin determines which overlapping dense sheet is hit first. "
            "Changing only cage extrusion and inward ray reach should sharply reduce negative "
            "tangent Z when the production cage begins outside an unrelated sheet."
        ),
        "sourceBlend": {
            "file": COMMON.relative(SOURCE_BLEND),
            "sha256": digest(SOURCE_BLEND),
        },
        "output": {
            "file": COMMON.relative(output),
            "sha256": digest(output),
            "bytes": output.stat().st_size,
            "dimensions": [2048, 2048],
        },
        "controlledInputs": {
            "low": LOW_NAME,
            "high": HIGH_NAME,
            "providerNormalConnected": False,
            "cageExtrusionMetres": args.cage_extrusion,
            "maximumRayDistanceMetres": args.max_ray_distance,
            "normalSpace": "TANGENT",
        },
        "allTexelStatistics": {
            "negativeTangentZ": int(np.count_nonzero(decoded_z < 0.0)),
            "tangentZBelowPointOne": int(np.count_nonzero(decoded_z < 0.1)),
            "vectorLengthBelowPointFive": int(np.count_nonzero(lengths < 0.5)),
            "minimumTangentZ": float(decoded_z.min()),
            "medianTangentZ": float(np.median(decoded_z)),
        },
        "interpretation": "pending used-UV centroid sampling",
        "blender": bpy.app.version_string,
        "rebuild": (
            "rtk proxy timeout 900 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python art/glass-adventure/platform-trials/v4/production/"
            f"diagnose_marble_normal_bake.py -- --cage-extrusion {args.cage_extrusion} "
            f"--max-ray-distance {args.max_ray_distance} --slug {args.slug}"
        ),
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print("CLOUDWAY_MARBLE_GEOMETRY_NORMAL_DIAGNOSTIC=" + json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
