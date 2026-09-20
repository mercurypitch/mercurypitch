"""Audit preserved map-kit sources without changing their bytes."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
OUTPUT = HERE.parent / "exports" / "map-source-audit-v1.json"
SOURCES = (
    "art/glass-adventure/v2/models/museum-kit.blend",
    "art/glass-adventure/v2/models/garden-kit.blend",
    "art/glass-adventure/museum-kit.blend",
    "art/glass-adventure/v3/architecture/exports/observatory-canopy-01-final-v1.glb",
    "art/glass-adventure/v3/architecture/exports/gilded-column-01-final-v2.glb",
    "art/glass-adventure/v3/architecture/exports/garden-arcade-01-final-v1.glb",
    "art/glass-adventure/v5/exports/crystal-planter.glb",
    "art/glass-adventure/v5/exports/gallery-frame.glb",
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def mesh_triangles(mesh: bpy.types.Mesh) -> int:
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def object_bounds(obj: bpy.types.Object) -> dict[str, list[float]] | None:
    if obj.type != "MESH" or not obj.bound_box:
        return None
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = Vector(min(point[axis] for point in points) for axis in range(3))
    high = Vector(max(point[axis] for point in points) for axis in range(3))
    return {"min": list(low), "max": list(high), "dimensions": list(high - low)}


def source_report(relative: str) -> dict[str, object]:
    source = ROOT / relative
    if source.suffix == ".blend":
        bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(source))
    bpy.context.view_layer.update()
    objects = []
    unique_meshes: dict[int, bpy.types.Mesh] = {}
    for obj in sorted(bpy.context.scene.objects, key=lambda item: item.name):
        mesh = obj.data if obj.type == "MESH" else None
        if mesh is not None:
            unique_meshes[mesh.as_pointer()] = mesh
        objects.append(
            {
                "name": obj.name,
                "type": obj.type,
                "parent": obj.parent.name if obj.parent else None,
                "mesh": mesh.name if mesh else None,
                "triangles": mesh_triangles(mesh) if mesh else 0,
                "materials": [material.name if material else None for material in mesh.materials]
                if mesh
                else [],
                "bounds": object_bounds(obj),
                "hiddenRender": obj.hide_render,
            }
        )
    images = []
    for image in sorted(bpy.data.images, key=lambda item: item.name):
        if image.source == "VIEWER":
            continue
        images.append(
            {
                "name": image.name,
                "dimensions": list(image.size),
                "packed": image.packed_file is not None,
                "file": image.filepath,
                "colorSpace": image.colorspace_settings.name,
            }
        )
    return {
        "file": relative,
        "bytes": source.stat().st_size,
        "sha256": digest(source),
        "scene": bpy.context.scene.name,
        "collections": sorted(collection.name for collection in bpy.data.collections),
        "objects": objects,
        "sceneTriangles": sum(row["triangles"] for row in objects if not row["hiddenRender"]),
        "uniqueMeshTriangles": sum(mesh_triangles(mesh) for mesh in unique_meshes.values()),
        "images": images,
    }


def main() -> None:
    report = {
        "schema": 1,
        "method": "Fresh Blender open/import; read-only object, mesh, material, bounds, and image inventory.",
        "sources": [source_report(relative) for relative in SOURCES],
    }
    OUTPUT.write_text(json.dumps(report, indent=2) + "\n")
    print(
        "MAP_SOURCE_AUDIT="
        + json.dumps(
            {
                "sources": len(report["sources"]),
                "output": str(OUTPUT.relative_to(ROOT)),
                "triangles": {
                    row["file"]: row["sceneTriangles"] for row in report["sources"]
                },
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
