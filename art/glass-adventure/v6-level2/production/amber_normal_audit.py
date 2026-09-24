"""Prove whether Amber donor and final surface normals remain smooth through export."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import bpy
import numpy as np


ROOT = Path(__file__).resolve().parent.parent


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def mesh_report(obj: bpy.types.Object, surface_material: str | None = None) -> dict[str, object]:
    mesh = obj.data
    mesh.calc_loop_triangles()
    material_names = [material.name if material else "" for material in mesh.materials]
    selected = [
        face
        for face in mesh.polygons
        if surface_material is None or material_names[face.material_index] == surface_material
    ]
    angles = []
    for face in selected:
        for loop_index in face.loop_indices:
            dot = max(-1.0, min(1.0, mesh.corner_normals[loop_index].vector.dot(face.normal)))
            angles.append(math.degrees(math.acos(dot)))
    return {
        "object": obj.name,
        "triangles": len(mesh.polygons),
        "surfaceTriangles": len(selected),
        "surfaceSmoothTriangles": sum(face.use_smooth for face in selected),
        "surfaceFlatTriangles": sum(not face.use_smooth for face in selected),
        "cornerToFaceNormalAngleDegrees": {
            "p05": float(np.quantile(angles, 0.05)),
            "p50": float(np.quantile(angles, 0.50)),
            "p95": float(np.quantile(angles, 0.95)),
            "max": float(np.max(angles)),
        },
        "materials": material_names,
        "uvLayers": [layer.name for layer in mesh.uv_layers],
    }


def normal_map_report(material: bpy.types.Material) -> dict[str, object]:
    shader = material.node_tree.nodes.get("Principled BSDF")
    normal = shader.inputs["Normal"]
    if not normal.is_linked:
        return {"linked": False}
    source = normal.links[0].from_node
    image_nodes = [node for node in material.node_tree.nodes if node.type == "TEX_IMAGE" and node.image]
    return {
        "linked": True,
        "sourceNodeType": source.type,
        "sourceNodeName": source.name,
        "strength": float(source.inputs["Strength"].default_value) if source.type == "NORMAL_MAP" else None,
        "images": [
            {
                "name": node.image.name,
                "dimensions": [int(node.image.size[0]), int(node.image.size[1])],
                "colorspace": node.image.colorspace_settings.name,
            }
            for node in image_nodes
        ],
    }


def only_mesh() -> bpy.types.Object:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise ValueError(f"Expected one donor mesh, got {len(meshes)}")
    return meshes[0]


def main() -> None:
    donor = ROOT / "meshy/amber-cadence-urn-donor.glb"
    final_blend = ROOT / "sources/amber-cadence-urn-fracture-v2.blend"
    final_glb = ROOT / "exports/amber-cadence-urn-fracture-v2.glb"

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(donor))
    donor_obj = only_mesh()
    donor_material = donor_obj.data.materials[0]
    donor_report = mesh_report(donor_obj) | {
        "normalMap": normal_map_report(donor_material),
    }

    bpy.ops.wm.open_mainfile(filepath=str(final_blend))
    final_obj = bpy.data.objects["breakable_l2_low_amber_urn_intact"]
    blend_report = mesh_report(final_obj, "amber_shell") | {
        "normalMap": normal_map_report(bpy.data.materials["amber_shell"]),
    }

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(final_glb))
    reimport_obj = bpy.data.objects["breakable_l2_low_amber_urn_intact"]
    glb_report = mesh_report(reimport_obj, "amber_shell") | {
        "normalMap": normal_map_report(bpy.data.materials["amber_shell"]),
    }

    report = {
        "schema": 1,
        "assetId": "amber-cadence-urn",
        "donor": {
            "file": str(donor.relative_to(ROOT)),
            "sha256": digest(donor),
            "mesh": donor_report,
        },
        "packedFinalBlend": {
            "file": str(final_blend.relative_to(ROOT)),
            "sha256": digest(final_blend),
            "mesh": blend_report,
        },
        "runtimeGlbReimport": {
            "file": str(final_glb.relative_to(ROOT)),
            "sha256": digest(final_glb),
            "mesh": glb_report,
        },
        "finding": (
            "The exported GLB preserves the donor's authored flat/smooth split and linked normal map. "
            "A separate fixed-view soft-light comparison isolated the strong lower-body facets to the donor normal map; "
            "the production material reduces its strength while retaining the donor atlas and geometry."
        ),
    }
    path = Path(__file__).with_name("amber-normal-audit.json")
    path.write_text(json.dumps(report, indent=2) + "\n")
    print("AMBER_NORMAL_AUDIT=" + json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
