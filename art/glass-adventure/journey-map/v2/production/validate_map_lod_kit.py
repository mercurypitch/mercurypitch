"""Freshly reimport and verify the reusable floating-museum map kit."""

from __future__ import annotations

import json
from pathlib import Path

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent
GLB = ART / "exports" / "floating-museum-map-kit-v1.glb"
MANIFEST = ART / "exports" / "floating-museum-map-kit-v1.json"
GROUND_NODES = {"map_canopy", "map_column", "map_planter", "map_frame"}
TOP_NODES = {"map_platform", "map_bridge", "map_island_root"}
REQUIRED = GROUND_NODES | TOP_NODES


def triangles(mesh: bpy.types.Mesh) -> int:
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def object_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def main() -> None:
    manifest = json.loads(MANIFEST.read_text())
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(GLB))
    objects = {obj.name: obj for obj in bpy.context.scene.objects}
    if "map_kit_root" not in objects:
        raise ValueError("Fresh import omitted map_kit_root")
    missing = sorted(REQUIRED - objects.keys())
    if missing:
        raise ValueError(f"Fresh import omitted kit nodes: {missing}")
    rows = {}
    for name in sorted(REQUIRED):
        obj = objects[name]
        if obj.type != "MESH":
            raise ValueError(f"{name} is not a mesh after fresh import")
        low, high = object_bounds(obj)
        anchor_error = abs(low.z) if name in GROUND_NODES else abs(high.z)
        if anchor_error > 1e-5:
            raise ValueError(f"{name} anchor error {anchor_error}")
        expected = manifest["kitParts"][name]["triangles"]
        actual = triangles(obj.data)
        if actual != expected:
            raise ValueError(f"{name} triangle mismatch {actual} != {expected}")
        rows[name] = {
            "triangles": actual,
            "materials": [item.name if item else None for item in obj.data.materials],
            "boundsBlenderZUpMetres": {"min": list(low), "max": list(high)},
            "dimensionsGlTfYUpMetres": [high.x - low.x, high.z - low.z, high.y - low.y],
            "anchorErrorMetres": anchor_error,
            "uvLayers": [layer.name for layer in obj.data.uv_layers],
        }
    images = []
    for image in sorted(bpy.data.images, key=lambda item: item.name):
        if image.source == "VIEWER":
            continue
        if max(image.size) > 512:
            raise ValueError(f"Fresh import image exceeds 512px: {image.name} {list(image.size)}")
        images.append(
            {
                "name": image.name,
                "dimensions": list(image.size),
                "packed": image.packed_file is not None,
                "colorSpace": image.colorspace_settings.name,
            }
        )
    if len(images) != manifest["glb"]["images"]:
        raise ValueError(f"Image count mismatch {len(images)} != {manifest['glb']['images']}")
    manifest["freshReimport"] = {
        "blender": bpy.app.version_string,
        "nodes": rows,
        "images": images,
        "root": "map_kit_root",
        "coordinates": "Fresh GLB reimport into Blender Z-up; dimensions listed in glTF X/Y/Z order.",
    }
    manifest["validation"].update(
        {
            "freshGlbReimport": True,
            "exactTriangleParity": True,
            "anchorsPassed": True,
            "embeddedImagesAtOrBelow512": True,
        }
    )
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(
        "FLOATING_MUSEUM_MAP_KIT_VALIDATED="
        + json.dumps(
            {
                "nodes": len(rows),
                "images": len(images),
                "triangles": {name: row["triangles"] for name, row in rows.items()},
                "anchorMaxErrorMetres": max(row["anchorErrorMetres"] for row in rows.values()),
            }
        ),
        flush=True,
    )
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
