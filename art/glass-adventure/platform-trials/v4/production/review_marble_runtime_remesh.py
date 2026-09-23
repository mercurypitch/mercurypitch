"""Audit and render the receipt-matched 90k marble remesh before PBR baking."""

from __future__ import annotations

import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import marble_runtime_common as COMMON  # noqa: E402


PROOFS = COMMON.V4 / "proofs"
FRONT = PROOFS / "marble-runtime-remesh-clay-front.png"
ANGLE = PROOFS / "marble-runtime-remesh-clay-three-quarter.png"
REPORT = PROOFS / "marble-runtime-remesh-review.json"


def material(name: str, color: tuple[float, float, float]) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = 0.54
    shader.inputs["Metallic"].default_value = 0.0
    return result


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    point_at(obj, Vector((0.0, 0.0, -0.12)))


def setup_scene() -> tuple[bpy.types.Scene, bpy.types.Object]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    # Blender 5.2 exposes Eevee under the stable BLENDER_EEVEE identifier.
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("V4 remesh review world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.04, 0.055, 0.075, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.42
    scene.world = world

    floor_mat = material("review floor", (0.14, 0.16, 0.18))
    bpy.ops.mesh.primitive_plane_add(size=12.0, location=(0.0, 0.0, -0.44))
    bpy.context.object.data.materials.append(floor_mat)
    add_area("warm key", (-4.0, -4.2, 5.1), 950.0, 4.0, (1.0, 0.78, 0.60))
    add_area("cool fill", (4.0, -2.2, 3.8), 650.0, 3.2, (0.68, 0.84, 1.0))
    add_area("rim", (0.0, 4.0, 4.2), 800.0, 3.0, (0.72, 1.0, 0.86))

    camera_data = bpy.data.cameras.new("review camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 5.25
    camera = bpy.data.objects.new("review camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    return scene, camera


def render(scene: bpy.types.Scene, camera: bpy.types.Object, location: tuple[float, float, float], path: Path) -> None:
    camera.location = location
    point_at(camera, Vector((0.0, 0.0, -0.10)))
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def file_record(path: Path) -> dict[str, object]:
    return {
        "file": COMMON.relative(path),
        "bytes": path.stat().st_size,
        "sha256": COMMON.digest(path),
        "dimensions": [1800, 1000],
    }


def main() -> None:
    if COMMON.digest(COMMON.DENSE) != COMMON.EXPECTED_DENSE_SHA256:
        raise ValueError("Dense donor hash changed")
    if COMMON.digest(COMMON.REMESH) != COMMON.EXPECTED_REMESH_SHA256:
        raise ValueError("Runtime remesh hash changed")
    receipt = json.loads(COMMON.REMESH_RECEIPT.read_text())
    if (
        receipt.get("state") != "archived"
        or receipt.get("file", {}).get("sha256") != COMMON.EXPECTED_REMESH_SHA256
        or int(receipt.get("file", {}).get("triangles", -1)) != COMMON.EXPECTED_REMESH_TRIANGLES
    ):
        raise ValueError("Runtime remesh receipt no longer identifies the archived candidate")

    scene, camera = setup_scene()
    dense, _ = COMMON.import_single_mesh(COMMON.DENSE)
    dense_fit = COMMON.fit_to_v3_envelope(dense)
    dense_topology = COMMON.topology(dense.data)
    dense.name = "Accepted dense donor"
    dense.location.x = -1.18
    dense.data.materials.clear()
    dense.data.materials.append(material("dense source clay", (0.61, 0.57, 0.50)))

    remesh, _ = COMMON.import_single_mesh(COMMON.REMESH)
    remesh_fit = COMMON.fit_to_v3_envelope(remesh)
    remesh_topology = COMMON.topology(remesh.data)
    print("CLOUDWAY_MARBLE_REMESH_TOPOLOGY=" + json.dumps(remesh_topology), flush=True)
    if remesh_topology["triangles"] != COMMON.EXPECTED_REMESH_TRIANGLES:
        raise ValueError("Fresh Blender import changed the remesh triangle count")
    if not remesh_topology["uvFinite"]:
        raise ValueError("Runtime remesh does not have finite UV coverage")
    remesh.name = "90k runtime remesh"
    remesh.location.x = 1.18
    remesh.data.materials.clear()
    remesh.data.materials.append(material("runtime remesh clay", (0.74, 0.75, 0.72)))

    PROOFS.mkdir(parents=True, exist_ok=True)
    render(scene, camera, (0.0, -6.0, 1.35), FRONT)
    camera.data.ortho_scale = 5.55
    render(scene, camera, (4.4, -6.2, 2.25), ANGLE)
    report = {
        "schema": 1,
        "asset": "cloudway-marble-ultra4k-runtime-remesh-v4",
        "purpose": (
            "Same-envelope neutral-clay review of the immutable dense source and its receipt-"
            "matched 90k Meshy remesh before selected-to-active texture and normal/AO baking."
        ),
        "order": ["Accepted dense donor", "90k runtime remesh"],
        "decision": "accepted-for-high-to-low-bake",
        "decisionBasis": (
            "Matched-envelope front and three-quarter review preserves the platform silhouette, "
            "foliage massing, arch cut-outs, corner medallions and hanging ornament. Fine carved "
            "relief softened by remeshing is assigned to the 4K normal/base bake. Two invalid "
            "tangent corners are repaired by the runtime build before export."
        ),
        "dense": {
            "file": COMMON.relative(COMMON.DENSE),
            "sha256": COMMON.digest(COMMON.DENSE),
            "fit": dense_fit,
            "topology": dense_topology,
        },
        "candidate": {
            "file": COMMON.relative(COMMON.REMESH),
            "sha256": COMMON.digest(COMMON.REMESH),
            "receipt": COMMON.relative(COMMON.REMESH_RECEIPT),
            "fit": remesh_fit,
            "topology": remesh_topology,
        },
        "sameEnvelope": True,
        "contactPlaneBlenderZ": 0.0,
        "proofs": [file_record(FRONT), file_record(ANGLE)],
        "render": {
            "engine": "Blender Eevee Next",
            "resolution": [1800, 1000],
            "camera": "orthographic",
            "blender": bpy.app.version_string,
        },
        "rebuild": (
            "rtk proxy timeout 900 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python art/glass-adventure/platform-trials/v4/production/"
            "review_marble_runtime_remesh.py"
        ),
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print("CLOUDWAY_MARBLE_REMESH_REVIEW=" + json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
