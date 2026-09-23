"""Audit and render the preserved dense conservatory donor before any V8 provider work."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent
V6 = ART.parent / "v6"
PROOFS = ART / "proofs"
MANIFEST = PROOFS / "conservatory-source-audit-v8.json"
TARGET_DIMENSIONS = (2.30, 2.65, 2.30)
ASSETS = (
    (
        "preserved-pre-remesh",
        V6 / "meshy" / "conservatory-pre-remesh.glb",
        "conservatory-preserved-pre-remesh",
    ),
    (
        "v6-22k-remesh",
        V6 / "meshy" / "conservatory-final.glb",
        "conservatory-v6-remesh",
    ),
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def mesh_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [
        obj.matrix_world @ vertex.co
        for obj in objects
        for vertex in obj.data.vertices
    ]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def normalize(objects: list[bpy.types.Object]) -> dict[str, object]:
    low, high = mesh_bounds(objects)
    source_dimensions = Vector((high.x - low.x, high.z - low.z, high.y - low.y))
    scales = Vector(
        (
            TARGET_DIMENSIONS[0] / source_dimensions.x,
            TARGET_DIMENSIONS[2] / source_dimensions.z,
            TARGET_DIMENSIONS[1] / source_dimensions.y,
        )
    )
    center_x = (low.x + high.x) * 0.5
    center_y = (low.y + high.y) * 0.5
    for obj in objects:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.data = obj.data.copy()
        obj.data.transform(world)
        obj.matrix_world = Matrix.Identity(4)
        for vertex in obj.data.vertices:
            vertex.co.x = (vertex.co.x - center_x) * scales.x
            vertex.co.y = (vertex.co.y - center_y) * scales.y
            vertex.co.z = (vertex.co.z - low.z) * scales.z
        obj.data.update()
    final_low, final_high = mesh_bounds(objects)
    return {
        "sourceDimensionsGlTfYUp": list(source_dimensions),
        "scaleBlenderXYZ": list(scales),
        "dimensionsGlTfYUpMetres": [
            final_high.x - final_low.x,
            final_high.z - final_low.z,
            final_high.y - final_low.y,
        ],
        "anchorErrorMetres": abs(final_low.z),
    }


def add_area(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
    target: tuple[float, float, float],
) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def proof_material() -> bpy.types.Material:
    material = bpy.data.materials.new("neutral geometry proof")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.67, 0.74, 0.68, 1.0)
    shader.inputs["Roughness"].default_value = 0.62
    return material


def render_asset(label: str, source: Path, proof_stem: str) -> dict[str, object]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    if not meshes:
        raise ValueError(f"{source.name} has no mesh")
    material_names = sorted(
        {
            material.name
            for obj in meshes
            for material in obj.data.materials
            if material is not None
        }
    )
    image_rows = [
        {
            "name": image.name,
            "dimensions": list(image.size),
            "packed": image.packed_file is not None,
        }
        for image in bpy.data.images
        if image.type == "IMAGE"
    ]
    triangles = 0
    vertices = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        vertices += len(obj.data.vertices)
    normalization = normalize(meshes)
    clay = proof_material()
    for obj in meshes:
        obj.data.materials.clear()
        obj.data.materials.append(clay)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 10
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("conservatory audit world")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.08, 0.12, 0.17, 1.0)
    background.inputs["Strength"].default_value = 0.42
    scene.world = world

    bpy.ops.mesh.primitive_plane_add(size=14.0, location=(0.0, 0.0, -0.012))
    ground = bpy.context.object
    ground.data.materials.append(proof_material())
    ground.active_material.node_tree.nodes["Principled BSDF"].inputs[
        "Base Color"
    ].default_value = (0.10, 0.13, 0.17, 1.0)
    add_area("warm key", (-4.5, -4.8, 6.5), 1450.0, 4.2, (1.0, 0.78, 0.58), (0.0, 0.0, 1.35))
    add_area("cool fill", (4.0, -2.8, 5.5), 950.0, 3.8, (0.67, 0.84, 1.0), (0.0, 0.0, 1.35))
    add_area("rim", (0.0, 4.2, 5.8), 1200.0, 3.6, (0.68, 1.0, 0.84), (0.0, 0.0, 1.45))

    camera_data = bpy.data.cameras.new("conservatory audit camera")
    camera_data.lens = 62.0
    camera = bpy.data.objects.new("conservatory audit camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    scene.camera = camera
    PROOFS.mkdir(parents=True, exist_ok=True)
    proof_rows = []
    for suffix, location, target in (
        ("front", (0.0, -6.4, 3.15), (0.0, 0.0, 1.36)),
        ("angle", (3.35, -5.8, 3.65), (0.0, 0.0, 1.38)),
    ):
        camera.location = location
        camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
        output = PROOFS / f"{proof_stem}-{suffix}-v8.png"
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        proof_rows.append(
            {
                "view": suffix,
                "file": str(output.relative_to(ART)),
                "bytes": output.stat().st_size,
                "sha256": digest(output),
            }
        )
    return {
        "label": label,
        "file": str(source.relative_to(ART.parent.parent.parent)),
        "bytes": source.stat().st_size,
        "sha256": digest(source),
        "triangles": triangles,
        "vertices": vertices,
        "materials": material_names,
        "images": image_rows,
        "normalization": normalization,
        "proofs": proof_rows,
    }


def main() -> None:
    rows = [render_asset(label, source, stem) for label, source, stem in ASSETS]
    dense = rows[0]
    remesh = rows[1]
    result = {
        "schema": 1,
        "purpose": "Source suitability gate before any V8 Meshy remesh request.",
        "assessment": {
            "triangleRetentionFractionV6": remesh["triangles"] / dense["triangles"],
            "candidateGate": (
                "The preserved donor is structurally usable only if its ribs, bays, foliage silhouette, "
                "and circular plinth remain coherent in both recorded views."
            ),
        },
        "assets": rows,
        "render": {
            "engine": "CYCLES CPU",
            "samples": 10,
            "blender": bpy.app.version_string,
            "cameraContract": "Same normalized dimensions, lens, front view, and angle view for both assets.",
            "command": (
                "rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup "
                "--python-exit-code 1 --python "
                "art/glass-adventure/journey-map/v8/production/audit_conservatory_source.py"
            ),
        },
    }
    MANIFEST.write_text(json.dumps(result, indent=2) + "\n")
    print("CONSERVATORY_SOURCE_AUDIT=" + json.dumps(result), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
