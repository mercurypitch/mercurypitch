"""Audit the archived floating-museum Meshy donors before map-scale finishing."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPORT = ART / "production" / "meshy-source-audit.json"
SOURCES = {
    "temple": ART / "meshy" / "floating-museum-temple-v3.glb",
    "cliff": ART / "meshy" / "floating-museum-cliff-v3.glb",
    "cypress": ART / "meshy" / "floating-museum-cypress-v3.glb",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def triangles(mesh: bpy.types.Mesh) -> int:
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def mesh_topology(mesh: bpy.types.Mesh) -> dict[str, int | bool]:
    copy = mesh.copy()
    invalid = copy.validate(verbose=False, clean_customdata=False)
    bpy.data.meshes.remove(copy)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    row = {
        "vertices": len(bm.verts),
        "triangles": triangles(mesh),
        "boundaryEdges": sum(len(edge.link_faces) == 1 for edge in bm.edges),
        "nonManifoldEdges": sum(len(edge.link_faces) != 2 for edge in bm.edges),
        "looseEdges": sum(not edge.link_faces for edge in bm.edges),
        "zeroAreaFaces": sum(face.calc_area() <= 1e-12 for face in bm.faces),
        "blenderMeshInvalid": bool(invalid),
    }
    bm.free()
    return row


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rows: dict[str, object] = {}
    for asset, source in SOURCES.items():
        before_objects = set(bpy.data.objects)
        before_images = set(bpy.data.images)
        bpy.ops.import_scene.gltf(filepath=str(source))
        imported = [obj for obj in bpy.data.objects if obj not in before_objects]
        meshes = [obj for obj in imported if obj.type == "MESH"]
        if not meshes:
            raise ValueError(f"{asset} imported no mesh objects")
        points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
        low = Vector(min(point[axis] for point in points) for axis in range(3))
        high = Vector(max(point[axis] for point in points) for axis in range(3))
        imported_images = [image for image in bpy.data.images if image not in before_images]
        rows[asset] = {
            "file": str(source.relative_to(ART)),
            "bytes": source.stat().st_size,
            "sha256": digest(source),
            "meshObjects": len(meshes),
            "objectNames": [obj.name for obj in meshes],
            "boundsBlenderZUp": {"min": list(low), "max": list(high)},
            "dimensions": list(high - low),
            "triangles": sum(triangles(obj.data) for obj in meshes),
            "topology": [
                {"object": obj.name, **mesh_topology(obj.data)} for obj in meshes
            ],
            "negativeScaleObjects": [
                obj.name for obj in meshes if obj.matrix_world.to_3x3().determinant() < 0
            ],
            "materials": sorted(
                {
                    material.name
                    for obj in meshes
                    for material in obj.data.materials
                    if material is not None
                }
            ),
            "uvLayers": {
                obj.name: [layer.name for layer in obj.data.uv_layers] for obj in meshes
            },
            "images": [
                {
                    "name": image.name,
                    "dimensions": [int(image.size[0]), int(image.size[1])],
                    "colorSpace": image.colorspace_settings.name,
                }
                for image in sorted(imported_images, key=lambda item: item.name)
            ],
        }
        for obj in imported:
            bpy.data.objects.remove(obj, do_unlink=True)
    report = {
        "schema": 1,
        "status": "source inspection only; LOD and visual proof pending",
        "coordinates": "Blender Z-up after glTF import; raw source units",
        "sources": rows,
        "rebuild": {
            "workingDirectory": "repository root",
            "command": (
                "rtk proxy blender -b --factory-startup --python "
                "art/glass-adventure/journey-map/v3/production/audit_meshy_sources.py"
            ),
            "blender": bpy.app.version_string,
        },
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(
        "JOURNEY_MAP_V3_SOURCES_AUDITED="
        + json.dumps(
            {
                asset: {
                    "triangles": row["triangles"],
                    "dimensions": row["dimensions"],
                    "meshObjects": row["meshObjects"],
                }
                for asset, row in rows.items()
            }
        ),
        flush=True,
    )
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
