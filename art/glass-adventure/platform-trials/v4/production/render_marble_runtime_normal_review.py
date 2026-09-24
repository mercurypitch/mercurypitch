"""Render matched neutral-clay proof for raw and dense-normal-corrected V4 topology."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import marble_runtime_common as COMMON  # noqa: E402


FINAL = COMMON.V4 / "exports" / "cloudway-marble-ultra-v4-4k-blender.glb"
NORMAL = COMMON.V4 / "sources" / "marble-runtime-textures" / "cloudway-marble-v4-normal-4k.png"
PROOFS = COMMON.V4 / "proofs"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render the filtered split-normal diagnostic or the final 4K normal-map gate."
    )
    parser.add_argument(
        "--mode",
        choices=("transfer-only", "normal-map"),
        default="normal-map",
        help="The exact shading input applied to the exported runtime shell.",
    )
    parser.add_argument(
        "--normal-map",
        type=Path,
        default=NORMAL,
        help="Normal map used by normal-map mode; diagnostics may pass a controlled alternate.",
    )
    parser.add_argument(
        "--slug",
        help="Write a named diagnostic proof under proofs/diagnostics instead of final proof paths.",
    )
    script_arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(script_arguments)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def material(
    name: str,
    color: tuple[float, float, float],
    normal: Path | None = None,
    normal_strength: float = 1.0,
) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    nodes = result.node_tree.nodes
    nodes.clear()
    links = result.node_tree.links
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = 0.54
    shader.inputs["Metallic"].default_value = 0.0
    if normal is not None:
        image = bpy.data.images.load(str(normal), check_existing=False)
        image.colorspace_settings.name = "Non-Color"
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = image
        normal_map = nodes.new("ShaderNodeNormalMap")
        normal_map.inputs["Strength"].default_value = normal_strength
        links.new(texture.outputs["Color"], normal_map.inputs["Color"])
        links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return result


def add_area(name: str, location: tuple[float, float, float], energy: float, size: float, color: tuple[float, float, float]) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    point_at(obj, Vector((0.0, 0.0, -0.12)))


def add_label(text: str, x: float) -> None:
    curve = bpy.data.curves.new("label", "FONT")
    curve.body = text
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = 0.20
    curve.extrude = 0.002
    obj = bpy.data.objects.new(text, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = (x, -0.84, 0.42)
    obj.rotation_euler = (1.5707963268, 0.0, 0.0)
    obj.data.materials.append(material(text + " material", (0.08, 0.10, 0.12)))


def setup() -> tuple[bpy.types.Scene, bpy.types.Object]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 2400
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("normal review world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.035, 0.05, 0.072, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.38
    scene.world = world
    floor = material("review floor", (0.15, 0.17, 0.19))
    bpy.ops.mesh.primitive_plane_add(size=14.0, location=(0.0, 0.0, -0.44))
    bpy.context.object.data.materials.append(floor)
    add_area("warm grazing key", (-4.5, -4.8, 4.8), 1050.0, 3.6, (1.0, 0.74, 0.54))
    add_area("cool grazing fill", (4.5, -2.8, 3.1), 620.0, 2.8, (0.62, 0.82, 1.0))
    add_area("arch rim", (0.0, 4.5, 3.2), 760.0, 2.6, (0.72, 1.0, 0.88))
    camera_data = bpy.data.cameras.new("normal review camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 7.45
    camera = bpy.data.objects.new("normal review camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    return scene, camera


def import_final() -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(FINAL))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    roots = [obj for obj in imported if obj.name == "Cloudway_Marble"]
    if len(roots) != 1:
        raise ValueError("Final candidate lost the Cloudway_Marble root")
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if len(meshes) != 2:
        raise ValueError(f"Final candidate should have shell and boundary, found {len(meshes)} meshes")
    return roots[0], meshes


def render(scene: bpy.types.Scene, camera: bpy.types.Object, location: tuple[float, float, float], target: tuple[float, float, float], path: Path) -> None:
    camera.location = location
    point_at(camera, Vector(target))
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def proof_record(path: Path) -> dict[str, object]:
    return {
        "file": COMMON.relative(path),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "dimensions": [2400, 900],
    }


def main() -> None:
    args = parse_args()
    if args.mode == "transfer-only":
        front = PROOFS / "marble-runtime-normal-clay-front-transfer-only.png"
        angle = PROOFS / "marble-runtime-normal-clay-three-quarter-transfer-only.png"
        report_path = PROOFS / "marble-runtime-normal-clay-review-transfer-only.json"
        candidate_normal = None
        candidate_normal_strength = 0.0
        candidate_label = "90K + filtered split normals"
        candidate_material = "neutral clay; exported split normals only; no texture normal"
        purpose = (
            "Matched neutral-clay transfer diagnostic. Left is the fitted dense donor, centre is "
            "the fitted raw 90k remesh, and right is the exact exported runtime shell using only "
            "its orientation-filtered dense split-normal transfer. No texture normal is applied."
        )
    else:
        if args.slug:
            front = PROOFS / "diagnostics" / f"marble-runtime-normal-clay-front-{args.slug}.png"
            angle = PROOFS / "diagnostics" / f"marble-runtime-normal-clay-three-quarter-{args.slug}.png"
            report_path = PROOFS / "diagnostics" / f"marble-runtime-normal-clay-review-{args.slug}.json"
        else:
            front = PROOFS / "marble-runtime-normal-clay-front.png"
            angle = PROOFS / "marble-runtime-normal-clay-three-quarter.png"
            report_path = PROOFS / "marble-runtime-normal-clay-review.json"
        candidate_normal = args.normal_map.resolve()
        candidate_normal_strength = 1.0
        candidate_label = "90K + filtered normals + 4K bake"
        candidate_material = (
            "neutral clay plus selected-to-active dense-donor 4K tangent-space normal"
        )
        purpose = (
            "Matched neutral-clay final shading gate. Left is the fitted dense donor, centre is "
            "the fitted raw 90k remesh, and right is the exact exported runtime shell with its "
            "orientation-filtered dense split normals plus the regenerated selected-to-active "
            "4K tangent-space normal map at strength 1.0."
        )

    scene, camera = setup()
    positions = (-2.35, 0.0, 2.35)
    dense, _ = COMMON.import_single_mesh(COMMON.DENSE)
    dense_fit = COMMON.fit_to_v3_envelope(dense)
    dense.location.x = positions[0]
    dense.data.materials.clear()
    dense.data.materials.append(material("dense donor neutral clay", (0.63, 0.59, 0.52)))

    raw, _ = COMMON.import_single_mesh(COMMON.REMESH)
    raw_fit = COMMON.fit_to_v3_envelope(raw)
    raw.location.x = positions[1]
    raw.data.materials.clear()
    raw.data.materials.append(material("raw 90k neutral clay", (0.72, 0.72, 0.69)))

    final_root, final_meshes = import_final()
    final_root.location.x = positions[2]
    corrected = material(
        "dense normal corrected neutral clay",
        (0.72, 0.72, 0.69),
        candidate_normal,
        candidate_normal_strength,
    )
    boundary_clay = material("boundary neutral clay", (0.52, 0.49, 0.44))
    for obj in final_meshes:
        obj.data.materials.clear()
        obj.data.materials.append(corrected if obj.name == "Cloudway_Marble__DonorShell" else boundary_clay)

    add_label("Dense donor", positions[0])
    add_label("90K raw", positions[1])
    add_label(candidate_label, positions[2])
    PROOFS.mkdir(parents=True, exist_ok=True)
    render(scene, camera, (0.0, -7.0, 1.25), (0.0, 0.0, -0.11), front)
    camera.data.ortho_scale = 7.75
    render(scene, camera, (6.0, -8.0, 3.2), (0.0, 0.0, -0.10), angle)
    report = {
        "schema": 1,
        "asset": "cloudway-marble-ultra-v4",
        "mode": args.mode,
        "purpose": purpose,
        "order": ["Dense donor", "90K raw", candidate_label],
        "decision": "pending-visual-review",
        "sameEnvelope": True,
        "fit": {"dense": dense_fit, "raw90k": raw_fit},
        "candidate": {
            "file": COMMON.relative(FINAL),
            "sha256": digest(FINAL),
            "normalMapApplied": candidate_normal is not None,
            "material": candidate_material,
            "normalStrength": candidate_normal_strength,
        },
        "proofs": [proof_record(front), proof_record(angle)],
        "render": {
            "engine": "Blender Eevee",
            "resolution": [2400, 900],
            "camera": "orthographic",
            "lighting": "matched grazing area lights",
            "blender": bpy.app.version_string,
        },
        "rebuild": (
            "rtk proxy timeout 900 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python art/glass-adventure/platform-trials/v4/production/"
            f"render_marble_runtime_normal_review.py -- --mode {args.mode}"
            + (f" --normal-map {candidate_normal}" if candidate_normal is not None else "")
            + (f" --slug {args.slug}" if args.slug else "")
        ),
    }
    if candidate_normal is not None:
        report["candidate"]["normalMap"] = COMMON.relative(candidate_normal)
        report["candidate"]["normalMapSha256"] = digest(candidate_normal)
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print("CLOUDWAY_MARBLE_NORMAL_REVIEW=" + json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
