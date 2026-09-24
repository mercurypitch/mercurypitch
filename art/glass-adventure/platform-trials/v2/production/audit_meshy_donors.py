"""Audit and render the three archived Cloudway Meshy donor platforms."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPORT = ART / "proofs" / "meshy-donor-audit.json"
ASSETS = {
    "marble": ART / "meshy" / "marble" / "donor.glb",
    "frost": ART / "meshy" / "frost" / "donor.glb",
    "glide": ART / "meshy" / "glide" / "donor.glb",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = Vector(min(point[i] for point in points) for i in range(3))
    high = Vector(max(point[i] for point in points) for i in range(3))
    return low, high


def apply_world(obj: bpy.types.Object) -> None:
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    obj.parent = None
    obj.data.update()


def dominant_landing_height(obj: bpy.types.Object) -> dict[str, float | int]:
    mesh = obj.data
    low, high = bounds(obj)
    size = high - low
    bin_size = max(size.z / 160.0, 1e-6)
    area_by_bin: dict[int, float] = {}
    face_count_by_bin: dict[int, int] = {}
    for poly in mesh.polygons:
        center = poly.center
        if poly.normal.z < 0.88:
            continue
        if not (low.x + size.x * 0.12 <= center.x <= high.x - size.x * 0.12):
            continue
        if not (low.y + size.y * 0.12 <= center.y <= high.y - size.y * 0.12):
            continue
        if center.z < low.z + size.z * 0.45:
            continue
        key = round((center.z - low.z) / bin_size)
        area_by_bin[key] = area_by_bin.get(key, 0.0) + poly.area
        face_count_by_bin[key] = face_count_by_bin.get(key, 0) + 1
    if not area_by_bin:
        raise ValueError(f"No landing-plane candidate found for {obj.name}")
    winner = max(area_by_bin, key=area_by_bin.get)
    return {
        "z": low.z + winner * bin_size,
        "weightedArea": area_by_bin[winner],
        "faceCount": face_count_by_bin[winner],
        "binSize": bin_size,
    }


def topology(obj: bpy.types.Object) -> dict[str, int | bool]:
    mesh = obj.data
    mesh.calc_loop_triangles()
    copy = mesh.copy()
    invalid = copy.validate(verbose=False, clean_customdata=False)
    bpy.data.meshes.remove(copy)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    result = {
        "vertices": len(mesh.vertices),
        "triangles": len(mesh.loop_triangles),
        "boundaryEdges": sum(len(edge.link_faces) == 1 for edge in bm.edges),
        "nonManifoldEdges": sum(len(edge.link_faces) != 2 for edge in bm.edges),
        "looseEdges": sum(not edge.link_faces for edge in bm.edges),
        "zeroAreaFaces": sum(face.calc_area() <= 1e-12 for face in bm.faces),
        "invalid": bool(invalid),
    }
    bm.free()
    return result


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def simple_material(name: str, color: tuple[float, float, float], roughness: float) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = roughness
    return mat


def add_area(name: str, location: tuple[float, float, float], energy: float, color: tuple[float, float, float], size: float) -> None:
    light = bpy.data.lights.new(name, "AREA")
    light.energy = energy
    light.color = color
    light.shape = "DISK"
    light.size = size
    obj = bpy.data.objects.new(name, light)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    point_at(obj, Vector((0.0, 0.0, -0.15)))


def render(asset: str, obj: bpy.types.Object, landing_z: float) -> Path:
    low, high = bounds(obj)
    width = high.x - low.x
    depth = high.y - low.y
    if depth > width:
        obj.rotation_euler[2] = math.pi * 0.5
        bpy.context.view_layer.update()
        low, high = bounds(obj)
        width = high.x - low.x
    scale = 1.8 / width
    obj.scale = (scale, scale, scale)
    obj.location = (-(low.x + high.x) * 0.5 * scale, -(low.y + high.y) * 0.5 * scale, -landing_z * scale)
    bpy.context.view_layer.update()
    low, high = bounds(obj)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 820
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("Cloudway donor proof world")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.72, 0.77, 0.84, 1.0)
    bg.inputs["Strength"].default_value = 0.65
    scene.world = world

    floor_z = low.z - 0.08
    bpy.ops.mesh.primitive_plane_add(size=10.0, location=(0.0, 0.0, floor_z))
    floor = bpy.context.object
    floor.data.materials.append(simple_material("proof pearl floor", (0.72, 0.69, 0.64), 0.78))
    add_area("warm key", (-3.7, -4.8, 5.4), 950.0, (1.0, 0.79, 0.61), 4.2)
    add_area("sky fill", (4.3, -2.0, 3.8), 720.0, (0.66, 0.84, 1.0), 3.6)
    add_area("celadon rim", (0.5, 4.0, 4.4), 850.0, (0.62, 1.0, 0.84), 3.4)

    camera_data = bpy.data.cameras.new("donor proof camera")
    camera_data.lens = 62.0
    camera = bpy.data.objects.new("donor proof camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (2.65, -3.25, 2.05)
    point_at(camera, Vector((0.0, 0.0, -0.14)))
    scene.camera = camera
    output = ART / "proofs" / f"meshy-{asset}-donor.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    return output


def main() -> None:
    report: dict[str, object] = {
        "schema": 1,
        "purpose": "Raw Meshy donor audit before authored landing repair and LOD finishing.",
        "blender": bpy.app.version_string,
        "assets": {},
    }
    for asset, source in ASSETS.items():
        reset()
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(source))
        imported = [obj for obj in bpy.data.objects if obj not in before]
        meshes = [obj for obj in imported if obj.type == "MESH"]
        if len(meshes) != 1:
            raise ValueError(f"{asset} expected one mesh, got {len(meshes)}")
        obj = meshes[0]
        apply_world(obj)
        low, high = bounds(obj)
        landing = dominant_landing_height(obj)
        proof = render(asset, obj, float(landing["z"]))
        report["assets"][asset] = {
            "source": str(source.relative_to(ART)),
            "bytes": source.stat().st_size,
            "sha256": digest(source),
            "materials": [material.name for material in obj.data.materials],
            "uvLayers": [layer.name for layer in obj.data.uv_layers],
            "rawBoundsBlenderZUp": {"min": list(low), "max": list(high)},
            "rawDimensions": list(high - low),
            "landingPlaneCandidate": landing,
            "topology": topology(obj),
            "proof": {
                "file": str(proof.relative_to(ART)),
                "bytes": proof.stat().st_size,
                "sha256": digest(proof),
            },
        }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print("CLOUDWAY_DONOR_AUDIT=" + json.dumps({"report": str(REPORT), "assets": sorted(ASSETS)}), flush=True)


if __name__ == "__main__":
    main()
