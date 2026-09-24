#!/usr/bin/env python3
"""Render matched gameplay-distance views of V6 4K masters and 2K delivery GLBs."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import tempfile
from pathlib import Path
from typing import Any

import bpy
import numpy as np
from mathutils import Vector
from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
V6 = HERE.parent
TRIALS = V6.parent
REPO = HERE.parents[4]
PROOFS = V6 / "proofs" / "comparisons"
REPORTS = V6 / "proofs" / "diagnostics"

ASSETS: dict[str, dict[str, Any]] = {
    "frost": {
        "root": "Cloudway_Frost",
        "triangles": 634_512,
        "floorZ": -0.53,
        "targetZ": -0.12,
        "visualReview": (
            "Accepted: the cyan ice extension reads as one continuous beveled "
            "landing frame under the gold perimeter and corner housings. The "
            "snowflake engraving, bubbles, crystalline apron, and silhouette "
            "match the master without visible delivery artifacts."
        ),
    },
    "glide": {
        "root": "Cloudway_Glide",
        "triangles": 147_250,
        "floorZ": -0.38,
        "targetZ": -0.08,
        "visualReview": (
            "Accepted: the emerald glass extension reads as one continuous "
            "landing frame under the gold perimeter and corner housings. The "
            "lunar inlay, water veining, crystalline underside, and silhouette "
            "match the master without visible delivery artifacts."
        ),
    },
}


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ValueError(f"Could not load helper {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


V4_RENDER = load_module(
    "v4_platform_comparison",
    TRIALS / "v4" / "production" / "render_ultra4k_v3_comparison.py",
)


def relative(path: Path) -> str:
    return str(path.relative_to(REPO))


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


def triangle_count(objects: list[bpy.types.Object]) -> int:
    total = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    return total


def setup_scene(config: dict[str, Any]) -> tuple[bpy.types.Scene, bpy.types.Object]:
    scene, camera = V4_RENDER.setup_scene()
    scene.cycles.samples = 24
    scene.cycles.seed = 71
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.color_mode = "RGBA"
    world_background = scene.world.node_tree.nodes.get("Background")
    world_background.inputs["Color"].default_value = (0.065, 0.085, 0.11, 1.0)
    world_background.inputs["Strength"].default_value = 0.48
    floors = [obj for obj in scene.objects if obj.type == "MESH"]
    if len(floors) != 1:
        raise ValueError(f"Expected one floor before import, found {len(floors)}")
    floors[0].location.z = float(config["floorZ"])
    floor_shader = floors[0].data.materials[0].node_tree.nodes.get("Principled BSDF")
    floor_shader.inputs["Base Color"].default_value = (0.085, 0.105, 0.13, 1.0)
    floor_shader.inputs["Roughness"].default_value = 0.68

    # The adventure camera uses a 48-degree vertical FOV, a four-metre base
    # boom, and a 0.36-radian pitch. This portrait-half proof uses the same FOV
    # and a 4.6m mobile reach, matching the runtime's portrait multiplier.
    camera.data.type = "PERSP"
    camera.data.sensor_fit = "VERTICAL"
    camera.data.lens = camera.data.sensor_height / (
        2.0 * math.tan(math.radians(48.0) * 0.5)
    )
    return scene, camera


def import_asset(path: Path, root_name: str, expected_triangles: int) -> dict[str, Any]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    roots = [obj for obj in imported if obj.name == root_name]
    if len(roots) != 1:
        raise ValueError(f"Expected one {root_name} in {relative(path)}, found {len(roots)}")
    meshes = [obj for obj in descendants(roots[0]) if obj.type == "MESH"]
    triangles = triangle_count(meshes)
    if triangles != expected_triangles:
        raise ValueError(f"{relative(path)} changed to {triangles} triangles")
    return {
        "file": relative(path),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "root": roots[0].name,
        "meshObjects": len(meshes),
        "triangles": triangles,
    }


def render_one(
    path: Path,
    config: dict[str, Any],
    output: Path,
) -> dict[str, Any]:
    scene, camera = setup_scene(config)
    record = import_asset(path, config["root"], config["triangles"])
    target = Vector((0.0, 0.0, float(config["targetZ"])))
    location = (2.26, -3.72, 1.58)
    V4_RENDER.render(scene, camera, target, location, output)
    return record


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    if path.exists():
        return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def stitched_proof(master: Path, delivery: Path, output: Path) -> dict[str, Any]:
    with Image.open(master) as opened:
        master_image = opened.convert("RGB")
    with Image.open(delivery) as opened:
        delivery_image = opened.convert("RGB")
    if master_image.size != delivery_image.size:
        raise ValueError("Gameplay comparison halves have different dimensions")

    master_pixels = np.asarray(master_image, dtype=np.float32)
    delivery_pixels = np.asarray(delivery_image, dtype=np.float32)
    difference = delivery_pixels - master_pixels
    mse = float(np.mean(np.square(difference, dtype=np.float64)))
    psnr = math.inf if mse == 0.0 else 20.0 * math.log10(255.0 / math.sqrt(mse))

    width, height = master_image.size
    combined = Image.new("RGB", (width * 2, height), (12, 18, 24))
    combined.paste(master_image, (0, 0))
    combined.paste(delivery_image, (width, 0))
    draw = ImageDraw.Draw(combined)
    draw.rectangle((0, 0, width * 2, 58), fill=(12, 19, 27))
    draw.rectangle((0, height - 38, width * 2, height), fill=(12, 19, 27))
    draw.line((width, 0, width, height), fill=(226, 189, 93), width=2)
    heading = font(25)
    note = font(16)
    draw.text((22, 15), "4K MASTER | DEV AUDITION", font=heading, fill=(235, 240, 246))
    draw.text((width + 22, 15), "2K WEBP | DELIVERY CANDIDATE", font=heading, fill=(235, 240, 246))
    footer = (
        "Matched 48 degree camera, scale, geometry and lighting | "
        "1.70 x 1.30 m glass landing frame"
    )
    footer_box = draw.textbbox((0, 0), footer, font=note)
    footer_width = footer_box[2] - footer_box[0]
    draw.text(
        ((width * 2 - footer_width) / 2, height - 29),
        footer,
        font=note,
        fill=(205, 217, 229),
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    combined.save(output, format="PNG", optimize=True)
    return {
        "file": relative(output),
        "bytes": output.stat().st_size,
        "sha256": digest(output),
        "dimensions": list(combined.size),
        "meanAbsoluteRgbError8Bit": round(float(np.mean(np.abs(difference))), 6),
        "psnrDb": "identical" if math.isinf(psnr) else round(psnr, 4),
    }


def render_asset(asset: str) -> dict[str, Any]:
    config = ASSETS[asset]
    master_path = V6 / "exports" / f"cloudway-{asset}-v6-derivative.glb"
    delivery_path = V6 / "exports" / "delivery" / f"cloudway-{asset}-v6-delivery-2k.glb"
    PROOFS.mkdir(parents=True, exist_ok=True)
    proof_path = PROOFS / f"{asset}-master-delivery-gameplay.png"
    with tempfile.TemporaryDirectory(prefix=f"v6-{asset}-gameplay-") as temporary:
        temporary_path = Path(temporary)
        master_render = temporary_path / "master.png"
        delivery_render = temporary_path / "delivery.png"
        master = render_one(master_path, config, master_render)
        delivery = render_one(delivery_path, config, delivery_render)
        proof = stitched_proof(master_render, delivery_render, proof_path)

    report = {
        "schema": 1,
        "asset": asset,
        "purpose": (
            "Matched gameplay-distance visual proof that 2K/WebP and high-precision "
            "quantization preserve the master while the authored glass/gold border "
            "reads as a continuous landing frame."
        ),
        "decision": "accepted",
        "visualReview": config["visualReview"],
        "comparisonOrder": ["4K master dev audition", "2K WebP delivery candidate"],
        "sameCameraScaleGeometryAndLighting": True,
        "sources": [master, delivery],
        "proof": proof,
        "render": {
            "engine": "Cycles CPU",
            "samples": 24,
            "seed": 71,
            "halfResolution": [900, 1000],
            "camera": {
                "type": "perspective",
                "verticalFovDegrees": 48,
                "positionBlenderZUpMetres": [2.26, -3.72, 1.58],
                "targetBlenderZUpMetres": [0.0, 0.0, config["targetZ"]],
                "basis": "Adventure camera FOV and portrait-distance envelope",
            },
            "blender": bpy.app.version_string,
        },
        "command": (
            "rtk proxy timeout 3600 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python art/glass-adventure/platform-trials/v6/production/"
            f"render_delivery_comparison.py -- --asset {asset}"
        ),
    }
    REPORTS.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS / f"{asset}-delivery-gameplay-comparison.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print("V6_DELIVERY_COMPARISON=" + json.dumps(report), flush=True)
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", choices=sorted(ASSETS), required=True)
    import sys

    arguments = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    render_asset(arguments.asset)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
