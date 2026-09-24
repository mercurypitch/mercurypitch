#!/usr/bin/env python3
"""Build the source-preserving V7 marble delivery baseline.

The immutable Meshy donor supplies every triangle, UV, split normal, arch,
corner connection, and ornament.  The only geometry operation is the reviewed
V4 envelope fit.  Provider maps are reduced to a 2K delivery set without
altering the donor topology.  Runtime installation is intentionally excluded.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import struct
import sys
from typing import Any, Iterable

import bpy
from mathutils import Vector
import numpy as np
from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
V7 = HERE.parent
V4_PRODUCTION = V7.parent / "v4" / "production"
sys.path.insert(0, str(V4_PRODUCTION))
import marble_runtime_common as COMMON  # noqa: E402


SOURCE = COMMON.DENSE
SOURCE_TEXTURES = SOURCE.parent / "textures"
TEXTURES = V7 / "textures" / "dense-baseline"
EXPORTS = V7 / "exports"
SOURCES = V7 / "sources"
PROOFS = V7 / "proofs" / "dense-baseline"
REPORT = HERE / "dense-baseline-build-report.json"
RAW_GLB = EXPORTS / "cloudway-marble-v7-dense-baseline-2k.glb"
PACKED_BLEND = SOURCES / "cloudway-marble-dense-baseline-v7.blend"
EXPECTED_SOURCE_SHA256 = "fa4d01900561e257be18c7190ef893aa789f178d1d4ccd13c2da22427d1033bb"
ROOT_NAME = "Cloudway_Marble"
MESH_NAME = "marble_dense_source_preserved"
RESOLUTION = (1800, 1100)
VIEWS = ("front", "three-quarter", "gameplay", "top", "side")


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def relative(path: Path) -> str:
    return str(path.relative_to(COMMON.REPO))


def file_record(path: Path, dimensions: list[int] | None = None) -> dict[str, object]:
    row: dict[str, object] = {
        "file": relative(path),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
    }
    if dimensions is not None:
        row["dimensions"] = dimensions
    return row


def mesh_fingerprints(mesh: bpy.types.Mesh) -> dict[str, object]:
    mesh.calc_loop_triangles()
    positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get("co", positions)
    indices = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
    mesh.loop_triangles.foreach_get("vertices", indices)
    return {
        "vertices": len(mesh.vertices),
        "triangles": len(mesh.loop_triangles),
        "vertexPositionsFloat32Sha256": hashlib.sha256(positions.tobytes()).hexdigest(),
        "triangleIndicesInt32Sha256": hashlib.sha256(indices.tobytes()).hexdigest(),
    }


def prepare_delivery_maps() -> dict[str, Path]:
    TEXTURES.mkdir(parents=True, exist_ok=True)
    base_path = TEXTURES / "cloudway-marble-v7-base-2k.png"
    normal_path = TEXTURES / "cloudway-marble-v7-normal-2k.png"
    orm_path = TEXTURES / "cloudway-marble-v7-orm-2k.png"

    with Image.open(SOURCE_TEXTURES / "set-0-base_color.png") as opened:
        base = opened.convert("RGB").resize((2048, 2048), Image.Resampling.LANCZOS)
        base.save(base_path, format="PNG", optimize=True)

    with Image.open(SOURCE_TEXTURES / "set-0-normal.png") as opened:
        resized = opened.convert("RGB").resize((2048, 2048), Image.Resampling.LANCZOS)
    values = np.asarray(resized, dtype=np.float32) / 127.5 - 1.0
    values /= np.maximum(np.linalg.norm(values, axis=2, keepdims=True), 1e-8)
    encoded = np.clip(np.rint((values + 1.0) * 127.5), 0, 255).astype(np.uint8)
    Image.fromarray(encoded, mode="RGB").save(normal_path, format="PNG", optimize=True)

    with Image.open(SOURCE_TEXTURES / "set-0-roughness.png") as opened:
        roughness = np.asarray(opened.convert("L"), dtype=np.uint8)
    with Image.open(SOURCE_TEXTURES / "set-0-metallic.png") as opened:
        metallic = np.asarray(opened.convert("L"), dtype=np.uint8)
    if roughness.shape != (2048, 2048) or metallic.shape != (2048, 2048):
        raise ValueError("Provider metallic/roughness maps no longer match the expected 2K source")
    orm = np.stack((np.full_like(roughness, 255), roughness, metallic), axis=2)
    Image.fromarray(orm, mode="RGB").save(orm_path, format="PNG", optimize=True)
    return {"base": base_path, "normal": normal_path, "orm": orm_path}


def load_image(path: Path, name: str, colorspace: str, pack: bool = True) -> bpy.types.Image:
    image = bpy.data.images.load(str(path), check_existing=False)
    image.name = name
    image.colorspace_settings.name = colorspace
    if pack:
        image.pack()
    return image


def marble_material(
    name: str,
    base_path: Path,
    normal_path: Path,
    orm_path: Path | None,
    metallic_path: Path | None = None,
    roughness_path: Path | None = None,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    links = material.node_tree.links
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Principled BSDF"
    base = nodes.new("ShaderNodeTexImage")
    base.name = "Provider Marble Base Color"
    base.image = load_image(base_path, name + "__base", "sRGB")
    links.new(base.outputs["Color"], shader.inputs["Base Color"])
    normal = nodes.new("ShaderNodeTexImage")
    normal.name = "Provider Marble Tangent Normal"
    normal.image = load_image(normal_path, name + "__normal", "Non-Color")
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 0.82
    links.new(normal.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
    if orm_path is not None:
        orm = nodes.new("ShaderNodeTexImage")
        orm.name = "Provider Marble ORM"
        orm.image = load_image(orm_path, name + "__orm", "Non-Color")
        separate = nodes.new("ShaderNodeSeparateColor")
        separate.name = "Separate Provider ORM"
        links.new(orm.outputs["Color"], separate.inputs["Color"])
        links.new(separate.outputs["Green"], shader.inputs["Roughness"])
        links.new(separate.outputs["Blue"], shader.inputs["Metallic"])
    else:
        if metallic_path is None or roughness_path is None:
            raise ValueError("4K review material needs the provider metallic and roughness maps")
        metallic = nodes.new("ShaderNodeTexImage")
        metallic.name = "Provider Marble Metallic"
        metallic.image = load_image(metallic_path, name + "__metallic", "Non-Color")
        roughness = nodes.new("ShaderNodeTexImage")
        roughness.name = "Provider Marble Roughness"
        roughness.image = load_image(roughness_path, name + "__roughness", "Non-Color")
        links.new(metallic.outputs["Color"], shader.inputs["Metallic"])
        links.new(roughness.outputs["Color"], shader.inputs["Roughness"])
    shader.inputs["IOR"].default_value = 1.47
    shader.inputs["Coat Weight"].default_value = 0.16
    shader.inputs["Coat Roughness"].default_value = 0.18
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    material.diffuse_color = (0.78, 0.76, 0.72, 1.0)
    material["opaqueMarble"] = True
    material["providerMapped"] = True
    return material


def clay_material() -> bpy.types.Material:
    material = bpy.data.materials.new("V7 Matched Neutral Clay")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.72, 0.72, 0.69, 1.0)
    shader.inputs["Roughness"].default_value = 0.62
    return material


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_render(scene: bpy.types.Scene) -> bpy.types.Object:
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = RESOLUTION[0]
    scene.render.resolution_y = RESOLUTION[1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("V7 marble baseline proof world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.02, 0.028, 0.04, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.32
    scene.world = world

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
        scene.collection.objects.link(obj)
        obj.location = location
        point_at(obj, Vector((0.0, 0.0, -0.10)))

    add_area("warm grazing key", (-4.5, -4.8, 4.8), 1050.0, 3.6, (1.0, 0.74, 0.54))
    add_area("cool grazing fill", (4.5, -2.8, 3.1), 620.0, 2.8, (0.62, 0.82, 1.0))
    add_area("rear rim", (0.0, 4.5, 3.2), 760.0, 2.6, (0.72, 1.0, 0.88))
    camera_data = bpy.data.cameras.new("V7 marble baseline proof camera")
    camera_data.type = "ORTHO"
    camera = bpy.data.objects.new("V7 marble baseline proof camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    return camera


def configure_view(camera: bpy.types.Object, view: str) -> None:
    target = Vector((0.0, 0.0, -0.10))
    if view == "front":
        camera.data.ortho_scale = 1.28
        camera.location = (0.0, -6.0, 0.10)
    elif view == "three-quarter":
        camera.data.ortho_scale = 2.18
        camera.location = (4.3, -6.5, 2.65)
    elif view == "gameplay":
        camera.data.ortho_scale = 2.38
        camera.location = (4.7, -7.2, 4.2)
    elif view == "top":
        camera.data.ortho_scale = 2.20
        camera.location = (0.0, 0.0, 6.0)
        target = Vector((0.0, 0.0, 0.0))
    elif view == "side":
        camera.data.ortho_scale = 1.35
        camera.location = (-6.0, 0.0, 0.10)
    else:
        raise ValueError(view)
    point_at(camera, target)


def render(scene: bpy.types.Scene, camera: bpy.types.Object, path: Path, view: str) -> None:
    configure_view(camera, view)
    scene.render.filepath = str(path)
    bpy.context.view_layer.update()
    bpy.ops.render.render(write_still=True)


def contact_sheet(first: Path, second: Path, output: Path, view: str, mode: str) -> None:
    images = []
    for path in (first, second):
        with Image.open(path) as image:
            images.append(image.convert("RGBA").resize((900, 550), Image.Resampling.LANCZOS))
    sheet = Image.new("RGBA", (1800, 612), (15, 19, 25, 255))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
    except OSError:
        font = ImageFont.load_default()
    labels = (
        "Fitted dense donor / provider 4K" if mode == "pbr" else "Fitted dense donor clay",
        "V7 exact dense baseline / delivery 2K" if mode == "pbr" else "V7 exact dense baseline clay",
    )
    for index, (image, label) in enumerate(zip(images, labels, strict=True)):
        sheet.alpha_composite(image, (index * 900, 48))
        draw.text((index * 900 + 24, 12), label, font=font, fill=(235, 239, 244, 255))
    draw.text(
        (20, 574),
        f"Matched {view} camera; {mode.upper()}; topology and fit identical",
        font=font,
        fill=(170, 182, 196, 255),
    )
    sheet.convert("RGB").save(output, format="PNG", optimize=True)


def image_delta(first: Path, second: Path) -> dict[str, object]:
    with Image.open(first) as opened:
        one = np.asarray(opened.convert("RGBA"), dtype=np.float32) / 255.0
    with Image.open(second) as opened:
        two = np.asarray(opened.convert("RGBA"), dtype=np.float32) / 255.0
    overlap = (one[:, :, 3] > 0.02) & (two[:, :, 3] > 0.02)
    union = (one[:, :, 3] > 0.02) | (two[:, :, 3] > 0.02)
    difference = np.abs(one[:, :, :3] - two[:, :, :3]).mean(axis=2)
    values = difference[overlap]
    return {
        "silhouetteIntersectionOverUnion": float(overlap.sum() / max(union.sum(), 1)),
        "overlapPixels": int(overlap.sum()),
        "meanAbsoluteRgbDeltaInOverlap": float(values.mean()) if values.size else None,
        "p95AbsoluteRgbDeltaInOverlap": float(np.percentile(values, 95)) if values.size else None,
    }


def read_glb_json(path: Path) -> dict[str, Any]:
    with path.open("rb") as handle:
        magic, version, _length = struct.unpack("<4sII", handle.read(12))
        if magic != b"glTF" or version != 2:
            raise ValueError(f"{path.name} is not glTF 2")
        json_length, chunk_type = struct.unpack("<I4s", handle.read(8))
        if chunk_type != b"JSON":
            raise ValueError(f"{path.name} has no JSON first chunk")
        return json.loads(handle.read(json_length).decode("utf-8").rstrip(" \t\r\n\x00"))


def select_tree(root: bpy.types.Object, descendants: Iterable[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in descendants:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root


def main() -> None:
    for directory in (TEXTURES, EXPORTS, SOURCES, PROOFS, REPORT.parent):
        directory.mkdir(parents=True, exist_ok=True)
    if digest(SOURCE) != EXPECTED_SOURCE_SHA256:
        raise ValueError("Immutable marble donor hash changed")
    maps = prepare_delivery_maps()

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    donor, _ = COMMON.import_single_mesh(SOURCE)
    donor.name = MESH_NAME
    donor.data.name = MESH_NAME + "__Mesh"
    before = mesh_fingerprints(donor.data)
    fit = COMMON.fit_to_v3_envelope(donor)
    after = mesh_fingerprints(donor.data)
    if before["triangleIndicesInt32Sha256"] != after["triangleIndicesInt32Sha256"]:
        raise ValueError("Envelope fit changed donor indices")
    if before["triangles"] != after["triangles"] or before["vertices"] != after["vertices"]:
        raise ValueError("Envelope fit changed donor topology")
    topology = COMMON.topology(donor.data)
    if topology["invalidTangentCorners"] != 0:
        raise ValueError("Dense donor does not provide complete tangent coverage")

    material_4k = marble_material(
        "Cloudway Marble Provider 4K Review",
        SOURCE_TEXTURES / "set-0-base_color.png",
        SOURCE_TEXTURES / "set-0-normal.png",
        None,
        SOURCE_TEXTURES / "set-0-metallic.png",
        SOURCE_TEXTURES / "set-0-roughness.png",
    )
    material_2k = marble_material(
        "Cloudway Marble V7 Delivery 2K",
        maps["base"],
        maps["normal"],
        maps["orm"],
    )
    clay = clay_material()
    donor.data.materials.clear()
    donor.data.materials.append(material_2k)
    donor["role"] = "source-preserved-dense-delivery"
    donor["sourceSha256"] = EXPECTED_SOURCE_SHA256
    donor["sourceTopologyPreserved"] = True
    donor["sourceTextureUvsPreserved"] = True
    donor["geometryReduction"] = False

    root = bpy.data.objects.new(ROOT_NAME, None)
    scene.collection.objects.link(root)
    donor.parent = root
    root["assetId"] = "cloudway-marble-v7-dense-baseline"
    root["status"] = "review-only delivery candidate"
    root["coordinates"] = "Blender Z-up; glTF +Y up; metres"
    root["landingWidthMetres"] = COMMON.LANDING_WIDTH
    root["landingDepthMetres"] = COMMON.LANDING_DEPTH
    root["landingTopGlTfYMetres"] = 0.0
    root["colliderSizeMetres"] = [COMMON.LANDING_WIDTH, COMMON.COLLIDER_HEIGHT, COMMON.LANDING_DEPTH]
    root["sourceTopologyMutation"] = False
    root["fitMethod"] = fit["method"]

    camera = setup_render(scene)
    proof: dict[str, object] = {"clay": {}, "pbr": {}}
    for mode, pair in (("clay", (clay, clay)), ("pbr", (material_4k, material_2k))):
        for view in VIEWS:
            first_path = PROOFS / f"donor-{mode}-{view}.png"
            second_path = PROOFS / f"baseline-{mode}-{view}.png"
            sheet_path = PROOFS / f"matched-{mode}-{view}.png"
            donor.data.materials[0] = pair[0]
            render(scene, camera, first_path, view)
            donor.data.materials[0] = pair[1]
            render(scene, camera, second_path, view)
            contact_sheet(first_path, second_path, sheet_path, view, mode)
            proof[mode][view] = {
                "source": file_record(first_path),
                "candidate": file_record(second_path),
                "contactSheet": file_record(sheet_path),
                "pixelComparison": image_delta(first_path, second_path),
            }

    donor.data.materials[0] = material_2k
    bpy.ops.file.pack_all()
    missing = sorted(
        image.filepath
        for image in bpy.data.images
        if image.type == "IMAGE" and image.source != "GENERATED" and image.packed_file is None
    )
    if missing:
        raise ValueError(f"Packed source still has external images: {missing}")
    bpy.ops.wm.save_as_mainfile(filepath=str(PACKED_BLEND), compress=True, check_existing=False)

    select_tree(root, [donor])
    bpy.ops.export_scene.gltf(
        filepath=str(RAW_GLB),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_materials="EXPORT",
        export_animations=False,
        export_normals=True,
        export_tangents=True,
    )
    gltf = read_glb_json(RAW_GLB)
    if len(gltf.get("meshes", [])) != 1:
        raise ValueError("Raw baseline export must contain one mesh prototype")
    report = {
        "schema": 1,
        "status": "review-only exact dense baseline; runtime integration not authorized",
        "source": {
            **file_record(SOURCE),
            "topologyBeforeFit": before,
        },
        "fit": fit,
        "geometry": {
            "method": "exact fitted donor; no decimation, remesh, flatten, face replacement, or authored shell",
            "topologyAfterFit": after,
            "integrity": topology,
            "triangleIndexShaPreserved": before["triangleIndicesInt32Sha256"] == after["triangleIndicesInt32Sha256"],
            "oneMeshPrototype": True,
        },
        "textures": {
            "method": "Lanczos3 base resize; Lanczos3 normal resize with per-texel vector renormalization; provider 2K roughness and metallic packed into ORM",
            "base": file_record(maps["base"], [2048, 2048]),
            "normal": file_record(maps["normal"], [2048, 2048]),
            "orm": file_record(maps["orm"], [2048, 2048]),
        },
        "matchedProof": {
            "geometry": "the same fitted mesh is rendered on both sides; clay differs by no inputs and PBR differs only by provider 4K versus delivery 2K maps",
            "views": proof,
            "render": {
                "engine": "Blender Eevee",
                "resolution": list(RESOLUTION),
                "blender": bpy.app.version_string,
            },
        },
        "artifacts": {
            "packedBlend": file_record(PACKED_BLEND),
            "raw2kGlb": file_record(RAW_GLB),
        },
        "rawGlb": {
            "extensionsUsed": sorted(gltf.get("extensionsUsed", [])),
            "materials": [item.get("name") for item in gltf.get("materials", [])],
            "images": len(gltf.get("images", [])),
            "textures": len(gltf.get("textures", [])),
            "meshes": len(gltf.get("meshes", [])),
            "nodes": len(gltf.get("nodes", [])),
        },
        "excluded": [
            "authored reconstruction rejected at clay review",
            "whole-shell reduction",
            "visible-surface flatten",
            "provider call or credit use",
            "runtime/public installation",
            "commit or push",
        ],
        "rebuild": (
            "rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python art/glass-adventure/platform-trials/v7/production/"
            "build_marble_dense_baseline_v7.py"
        ),
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print("V7_MARBLE_DENSE_BASELINE=" + str(REPORT), flush=True)


if __name__ == "__main__":
    main()
