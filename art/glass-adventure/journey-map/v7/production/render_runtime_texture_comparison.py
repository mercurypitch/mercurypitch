"""Render a CPU-only close comparison of V7 review and runtime textures."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector
import numpy as np
from PIL import Image as PILImage, ImageDraw


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REVIEW_GLB = ART / "exports" / "floating-museum-twin-connector-candidate-v7.glb"
RUNTIME_GLB = ART / "exports" / "floating-museum-architecture-kit-v7.glb"
MANIFEST = ART / "exports" / "floating-museum-architecture-kit-v7.json"
PROOF = ART / "proofs" / "twin-connector-runtime-texture-comparison-v7.png"
REPORT = ART / "proofs" / "twin-connector-runtime-texture-comparison-v7.json"
REVIEW_FRAME = Path("/tmp/twin-connector-v7-review-close.png")
RUNTIME_FRAME = Path("/tmp/twin-connector-v7-runtime-close.png")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def material(name: str, color: tuple[float, float, float]) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = 0.76
    return result


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


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


def render_source(path: Path, output: Path, hide_conservatory: bool) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    connector = bpy.data.objects.get("map_twin_connector")
    if connector is None:
        raise ValueError(f"{path.name} lost the connector node")
    if hide_conservatory:
        conservatory = bpy.data.objects.get("map_conservatory")
        if conservatory is None:
            raise ValueError("Runtime comparison source lost the conservatory node")
        conservatory.hide_render = True
        for obj in descendants(conservatory):
            obj.hide_render = True

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.seed = 17
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("runtime comparison world")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.10, 0.15, 0.22, 1.0)
    background.inputs["Strength"].default_value = 0.46
    scene.world = world
    add_area("warm key", (-4.0, -5.0, 7.0), 1550.0, 4.8, (1.0, 0.75, 0.52), (0.0, 0.0, 1.45))
    add_area("cream fill", (4.5, -2.8, 6.0), 1100.0, 4.0, (0.72, 0.87, 1.0), (0.0, 0.0, 1.5))
    add_area("celadon rim", (0.0, 4.5, 6.5), 1350.0, 3.8, (0.58, 1.0, 0.82), (0.0, 0.0, 1.55))

    camera_data = bpy.data.cameras.new("runtime comparison camera")
    camera_data.lens = 72.0
    camera = bpy.data.objects.new("runtime comparison camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (0.75, -4.5, 3.4)
    camera.rotation_euler = (Vector((0.05, 0.0, 2.13)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def composite_and_measure() -> dict[str, object]:
    review = PILImage.open(REVIEW_FRAME).convert("RGBA")
    runtime = PILImage.open(RUNTIME_FRAME).convert("RGBA")
    if review.size != runtime.size:
        raise ValueError("Runtime comparison frames differ in dimensions")
    reference = np.asarray(review, dtype=np.float32)
    candidate = np.asarray(runtime, dtype=np.float32)
    mask = np.maximum(reference[:, :, 3], candidate[:, :, 3]) > 8
    if not np.any(mask):
        raise ValueError("Runtime comparison has no visible connector pixels")
    delta = reference[:, :, :3][mask] - candidate[:, :, :3][mask]
    absolute = np.abs(delta)
    mse = float(np.mean(delta * delta))
    metrics = {
        "comparedForegroundPixels": int(np.sum(mask)),
        "foregroundMeanAbsoluteChannelDelta": round(float(np.mean(absolute)), 4),
        "foregroundP95AbsoluteChannelDelta": round(float(np.percentile(absolute, 95)), 4),
        "foregroundChannelsAboveEight": round(float(np.mean(absolute > 8.0)), 6),
        "foregroundPsnrDb": round(10.0 * math.log10(255.0 * 255.0 / mse), 4),
    }

    width, height = review.size
    title_height = 54
    background = (24, 32, 43, 255)
    proof = PILImage.new("RGBA", (width * 2, height + title_height), background)
    proof.alpha_composite(review, (0, title_height))
    proof.alpha_composite(runtime, (width, title_height))
    draw = ImageDraw.Draw(proof)
    draw.text((20, 18), "V7 review source: four 2K provider maps", fill="white")
    draw.text((width + 20, 18), "V7 runtime: 2K base, 1K normal/ORM WebP", fill="white")
    PROOF.parent.mkdir(parents=True, exist_ok=True)
    proof.convert("RGB").save(PROOF, format="PNG", optimize=True)
    return metrics


def main() -> None:
    render_source(REVIEW_GLB, REVIEW_FRAME, hide_conservatory=False)
    render_source(RUNTIME_GLB, RUNTIME_FRAME, hide_conservatory=True)
    metrics = composite_and_measure()
    report = {
        "schema": 1,
        "reviewSource": {
            "file": str(REVIEW_GLB.relative_to(ART)),
            "sha256": digest(REVIEW_GLB),
        },
        "runtimeSource": {
            "file": str(RUNTIME_GLB.relative_to(ART)),
            "sha256": digest(RUNTIME_GLB),
        },
        "proof": {
            "file": str(PROOF.relative_to(ART)),
            "bytes": PROOF.stat().st_size,
            "sha256": digest(PROOF),
        },
        "metrics": metrics,
        "render": {
            "engine": "Cycles CPU",
            "samples": 24,
            "seed": 17,
            "resolution": [1000, 1000],
            "blender": bpy.app.version_string,
        },
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    manifest = json.loads(MANIFEST.read_text())
    if manifest["glb"]["sha256"] != digest(RUNTIME_GLB):
        raise ValueError("Runtime proof input differs from the validated V7 kit")
    manifest["runtimeTextureProof"] = report
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print("V7_RUNTIME_TEXTURE_PROOF=" + json.dumps(report), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
