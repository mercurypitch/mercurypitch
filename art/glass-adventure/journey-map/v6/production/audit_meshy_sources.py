"""Audit the archived V6 Meshy landmarks without changing their source bytes."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import struct

import bmesh
import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent
OUTPUT = HERE / "meshy-source-audit.json"
SOURCES = {
    "twinConnector": ART / "meshy" / "twin-connector-final.glb",
    "conservatory": ART / "meshy" / "conservatory-final.glb",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require_complete_glb(path: Path) -> None:
    header = path.read_bytes()[:12]
    if len(header) != 12 or header[:4] != b"glTF":
        raise ValueError(f"{path} is not a GLB")
    declared = struct.unpack_from("<I", header, 8)[0]
    if declared != path.stat().st_size:
        raise ValueError(
            f"{path} is incomplete: header declares {declared} bytes, found {path.stat().st_size}"
        )


def triangles(mesh: bpy.types.Mesh) -> int:
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def topology(mesh: bpy.types.Mesh) -> dict[str, int | bool]:
    copy = mesh.copy()
    invalid = copy.validate(verbose=False, clean_customdata=False)
    bpy.data.meshes.remove(copy)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    result = {
        "vertices": len(bm.verts),
        "triangles": triangles(mesh),
        "boundaryEdges": sum(len(edge.link_faces) == 1 for edge in bm.edges),
        "nonManifoldEdges": sum(len(edge.link_faces) != 2 for edge in bm.edges),
        "looseEdges": sum(not edge.link_faces for edge in bm.edges),
        "zeroAreaFaces": sum(face.calc_area() <= 1e-12 for face in bm.faces),
        "blenderMeshInvalid": bool(invalid),
    }
    bm.free()
    return result


def object_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in objects
        for corner in obj.bound_box
    ]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def image_rows(materials: list[bpy.types.Material]) -> list[dict[str, object]]:
    images: set[bpy.types.Image] = set()
    for material in materials:
        if not material.use_nodes:
            continue
        images.update(
            node.image
            for node in material.node_tree.nodes
            if node.type == "TEX_IMAGE" and node.image is not None
        )
    return [
        {
            "name": image.name,
            "dimensions": [int(image.size[0]), int(image.size[1])],
            "colorSpace": image.colorspace_settings.name,
            "packed": image.packed_file is not None,
            "source": image.source,
        }
        for image in sorted(images, key=lambda item: item.name)
    ]


def audit_source(name: str, path: Path) -> dict[str, object]:
    if not path.is_file():
        raise FileNotFoundError(path)
    require_complete_glb(path)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects = list(bpy.context.scene.objects)
    meshes = [obj for obj in objects if obj.type == "MESH"]
    if not meshes:
        raise ValueError(f"{name} has no mesh objects")
    materials = sorted(
        {
            material
            for obj in meshes
            for material in obj.data.materials
            if material is not None
        },
        key=lambda item: item.name,
    )
    low, high = object_bounds(meshes)
    return {
        "file": str(path.relative_to(ART)),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "sceneObjects": len(objects),
        "meshObjects": [
            {
                "name": obj.name,
                "mesh": obj.data.name,
                "triangles": triangles(obj.data),
                "uvLayers": [layer.name for layer in obj.data.uv_layers],
                "materials": [
                    material.name
                    for material in obj.data.materials
                    if material is not None
                ],
                "topology": topology(obj.data),
                "matrixWorld": [list(row) for row in obj.matrix_world],
            }
            for obj in meshes
        ],
        "triangles": sum(triangles(obj.data) for obj in meshes),
        "boundsBlenderZUp": {"min": list(low), "max": list(high)},
        "dimensionsGlTfYUp": [high.x - low.x, high.z - low.z, high.y - low.y],
        "materials": [material.name for material in materials],
        "images": image_rows(materials),
        "checks": {
            "hasMesh": True,
            "uv0OnEveryMesh": all(obj.data.uv_layers.active is not None for obj in meshes),
            "noLooseEdges": all(topology(obj.data)["looseEdges"] == 0 for obj in meshes),
            "noZeroAreaFaces": all(topology(obj.data)["zeroAreaFaces"] == 0 for obj in meshes),
        },
    }


def main() -> None:
    result = {
        "schema": 1,
        "purpose": "Read-only topology, material, UV and bounds audit of archived Meshy inputs.",
        "assets": {name: audit_source(name, path) for name, path in SOURCES.items()},
        "blender": bpy.app.version_string,
        "command": (
            "rtk proxy blender -b --factory-startup --python "
            "art/glass-adventure/journey-map/v6/production/audit_meshy_sources.py"
        ),
    }
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n")
    print("FLOATING_MUSEUM_V6_SOURCE_AUDIT=" + json.dumps(result["assets"]), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
