"""Isolate the first destructive stage in the rejected direct marble pipeline.

This diagnostic is deliberately read-only with respect to every canonical V4
source, export, report, and proof. It rebuilds matched neutral-clay stages from
the immutable dense donor and writes only beneath its dated diagnostic folder.
Run through ``flatten`` first; only extend to ``collapse`` or ``normals`` when
the earlier matched evidence remains clean.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
from typing import Any, Callable

import bpy
from mathutils import Vector
import numpy as np
from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import marble_runtime_common as COMMON  # noqa: E402
import build_marble_runtime_v4 as LEGACY  # noqa: E402
import build_marble_dense_direct_v4 as DIRECT  # noqa: E402


DIAGNOSTIC_ROOT = (
    COMMON.V4 / "proofs" / "diagnostics" / "marble-stage-isolation-2026-09-23"
)
STAGE_ORDER = ("source", "fit", "flatten", "collapse", "normals")
STAGE_LABELS = {
    "source": "Dense source",
    "fit": "Fit only",
    "flatten": "Contact flatten",
    "collapse": "238K collapse",
    "normals": "Normal finalization",
}
RESOLUTION = (1600, 1000)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--through",
        choices=("flatten", "collapse", "normals"),
        default="flatten",
        help="Last production stage to reproduce in this bounded pass.",
    )
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(arguments)


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def relative(path: Path) -> str:
    return COMMON.relative(path)


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def neutral_clay() -> bpy.types.Material:
    material = bpy.data.materials.new("V4 stage isolation neutral clay")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    links = material.node_tree.links
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = (0.72, 0.72, 0.69, 1.0)
    shader.inputs["Roughness"].default_value = 0.58
    shader.inputs["Metallic"].default_value = 0.0
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


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
    point_at(obj, Vector((0.0, 0.0, -0.10)))


def setup_scene() -> tuple[bpy.types.Scene, bpy.types.Object, bpy.types.Collection]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = RESOLUTION[0]
    scene.render.resolution_y = RESOLUTION[1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.view_settings.look = "AgX - Medium High Contrast"

    world = bpy.data.worlds.new("V4 stage isolation world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (
        0.035,
        0.05,
        0.072,
        1.0,
    )
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.38
    scene.world = world
    add_area("warm grazing key", (-4.5, -4.8, 4.8), 1050.0, 3.6, (1.0, 0.74, 0.54))
    add_area("cool grazing fill", (4.5, -2.8, 3.1), 620.0, 2.8, (0.62, 0.82, 1.0))
    add_area("arch rim", (0.0, 4.5, 3.2), 760.0, 2.6, (0.72, 1.0, 0.88))

    camera_data = bpy.data.cameras.new("V4 stage isolation camera")
    camera_data.type = "ORTHO"
    camera = bpy.data.objects.new("V4 stage isolation camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    stages = bpy.data.collections.new("V4 stage isolation meshes")
    scene.collection.children.link(stages)
    return scene, camera, stages


def snapshot(
    working: bpy.types.Object,
    key: str,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
) -> bpy.types.Object:
    mesh = working.data.copy()
    mesh.name = f"V4_Stage_{key}__Mesh"
    obj = bpy.data.objects.new(f"V4_Stage_{key}", mesh)
    collection.objects.link(obj)
    mesh.materials.clear()
    mesh.materials.append(material)
    obj.hide_render = True
    obj.hide_set(True)
    return obj


def percentile(values: list[float], level: float) -> float | None:
    if not values:
        return None
    return float(np.percentile(np.asarray(values, dtype=np.float64), level))


def region_metrics(
    obj: bpy.types.Object,
    predicate: Callable[[Vector, Vector, float, Vector, Vector], bool],
    low: Vector,
    high: Vector,
    landing: float,
) -> dict[str, object]:
    mesh = obj.data
    matching = [
        polygon
        for polygon in mesh.polygons
        if predicate(polygon.center, polygon.normal, landing, low, high)
    ]
    stride = max(1, math.ceil(len(matching) / 80_000))
    sampled = matching[::stride]
    areas: list[float] = []
    aspects: list[float] = []
    corner_dots: list[float] = []
    for polygon in sampled:
        points = [mesh.vertices[index].co for index in polygon.vertices]
        edges = [(points[(index + 1) % 3] - points[index]).length for index in range(3)]
        area = float(polygon.area)
        longest = max(edges)
        aspect = longest * longest / max(2.0 * area, 1e-20)
        areas.append(area)
        aspects.append(aspect)
        face = polygon.normal.normalized()
        for loop_index in polygon.loop_indices:
            corner = mesh.corner_normals[loop_index].vector
            corner_dots.append(float(corner.normalized().dot(face)))
    return {
        "triangles": len(matching),
        "sampleStride": stride,
        "sampledTriangles": len(sampled),
        "areaSquareMetres": {
            "median": percentile(areas, 50),
            "p95": percentile(areas, 95),
            "p99": percentile(areas, 99),
            "maximum": max(areas) if areas else None,
        },
        "triangleAspectLongestEdgeOverAltitude": {
            "median": percentile(aspects, 50),
            "p95": percentile(aspects, 95),
            "p99": percentile(aspects, 99),
            "maximum": max(aspects) if aspects else None,
        },
        "cornerNormalDotFace": {
            "minimum": min(corner_dots) if corner_dots else None,
            "p01": percentile(corner_dots, 1),
            "p05": percentile(corner_dots, 5),
            "median": percentile(corner_dots, 50),
            "nonPositive": sum(value <= 0.0 for value in corner_dots),
        },
    }


def normalized_coordinates(
    point: Vector, landing: float, low: Vector, high: Vector
) -> tuple[float, float, float]:
    center_x = (low.x + high.x) * 0.5
    center_y = (low.y + high.y) * 0.5
    half_x = max((high.x - low.x) * 0.5, 1e-12)
    half_y = max((high.y - low.y) * 0.5, 1e-12)
    height = max(high.z - low.z, 1e-12)
    return (
        (point.x - center_x) / half_x,
        (point.y - center_y) / half_y,
        (point.z - landing) / height,
    )


def broad_landing(
    center: Vector, normal: Vector, landing: float, low: Vector, high: Vector
) -> bool:
    x, y, z = normalized_coordinates(center, landing, low, high)
    return abs(x) <= 0.80 and abs(y) <= 0.68 and abs(z) <= 0.10 and normal.z >= 0.55


def front_slab_arch(
    center: Vector, _normal: Vector, landing: float, low: Vector, high: Vector
) -> bool:
    x, y, z = normalized_coordinates(center, landing, low, high)
    return abs(x) <= 0.95 and y <= -0.66 and -0.78 <= z <= 0.13


def stage_record(obj: bpy.types.Object) -> dict[str, object]:
    obj.data.update()
    low, high = COMMON.object_bounds([obj])
    landing = COMMON.dominant_landing_height(obj)
    topology = COMMON.topology(obj.data)
    return {
        "topology": topology,
        "boundsBlenderZUpMetres": {"min": COMMON.vector(low), "max": COMMON.vector(high)},
        "dimensionsBlenderZUpMetres": COMMON.vector(high - low),
        "dominantLandingBlenderZ": landing,
        "regions": {
            "broadLanding": region_metrics(obj, broad_landing, low, high, landing),
            "frontSlabAndArches": region_metrics(obj, front_slab_arch, low, high, landing),
        },
    }


def render_stage(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    stages: dict[str, bpy.types.Object],
    key: str,
    view: str,
    output: Path,
) -> None:
    for stage_key, obj in stages.items():
        visible = stage_key == key
        obj.hide_render = not visible
        obj.hide_set(not visible)
    if view == "front":
        camera.data.ortho_scale = 1.50
        camera.location = (0.0, -6.0, 0.46)
        point_at(camera, Vector((0.0, 0.0, -0.10)))
    elif view == "three-quarter":
        camera.data.ortho_scale = 2.20
        camera.location = (4.3, -6.5, 2.65)
        point_at(camera, Vector((0.0, 0.0, -0.10)))
    else:
        raise ValueError(view)
    scene.render.filepath = str(output)
    bpy.context.view_layer.update()
    bpy.ops.render.render(write_still=True)


def proof_record(path: Path) -> dict[str, object]:
    with Image.open(path) as image:
        dimensions = list(image.size)
    return {
        "file": relative(path),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "dimensions": dimensions,
    }


def erode(mask: np.ndarray, iterations: int = 3) -> np.ndarray:
    result = mask.copy()
    for _ in range(iterations):
        padded = np.pad(result, 1, mode="constant", constant_values=False)
        neighbors = [
            padded[y : y + result.shape[0], x : x + result.shape[1]]
            for y in range(3)
            for x in range(3)
        ]
        result = np.logical_and.reduce(neighbors)
    return result


def image_delta(before: Path, after: Path) -> dict[str, object]:
    with Image.open(before) as image:
        first = np.asarray(image.convert("RGBA"), dtype=np.float32) / 255.0
    with Image.open(after) as image:
        second = np.asarray(image.convert("RGBA"), dtype=np.float32) / 255.0
    first_mask = first[:, :, 3] >= 0.99
    second_mask = second[:, :, 3] >= 0.99
    intersection = erode(first_mask & second_mask)
    union = first_mask | second_mask
    if not intersection.any():
        raise ValueError(f"Matched renders have no interior overlap: {before.name}, {after.name}")
    luma_weights = np.asarray((0.2126, 0.7152, 0.0722), dtype=np.float32)
    first_luma = first[:, :, :3] @ luma_weights
    second_luma = second[:, :, :3] @ luma_weights
    delta = np.abs(first_luma - second_luma)[intersection]
    return {
        "interiorOverlapPixels": int(intersection.sum()),
        "silhouetteIntersectionOverUnion": float((first_mask & second_mask).sum() / union.sum()),
        "meanAbsoluteLumaDelta": float(delta.mean()),
        "p95AbsoluteLumaDelta": float(np.percentile(delta, 95)),
        "fractionInteriorPixelsAbove0_08": float((delta > 0.08).mean()),
    }


def contact_sheet(paths: list[Path], output: Path, labels: list[str]) -> None:
    images = []
    for path in paths:
        with Image.open(path) as image:
            images.append(image.convert("RGBA").resize((800, 500), Image.Resampling.LANCZOS))
    sheet = Image.new("RGBA", (800 * len(images), 560), (15, 19, 25, 255))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
    except OSError:
        font = ImageFont.load_default()
    for index, (image, label) in enumerate(zip(images, labels, strict=True)):
        sheet.alpha_composite(image, (index * 800, 60))
        bounds = draw.textbbox((0, 0), label, font=font)
        width = bounds[2] - bounds[0]
        draw.text((index * 800 + (800 - width) / 2, 14), label, font=font, fill=(235, 239, 244, 255))
    sheet.convert("RGB").save(output, format="PNG", optimize=True)


def main() -> None:
    args = parse_args()
    final_index = STAGE_ORDER.index(args.through)
    requested_stages = list(STAGE_ORDER[: final_index + 1])
    run = DIAGNOSTIC_ROOT / {
        "flatten": "01-source-fit-flatten",
        "collapse": "02-through-collapse",
        "normals": "03-through-normal-finalization",
    }[args.through]
    run.mkdir(parents=True, exist_ok=True)

    scene, camera, collection = setup_scene()
    clay = neutral_clay()
    working, _ = COMMON.import_single_mesh(COMMON.DENSE)
    working.name = "V4_Stage_Working"
    for owner in list(working.users_collection):
        owner.objects.unlink(working)
    collection.objects.link(working)
    working.hide_render = True
    stages: dict[str, bpy.types.Object] = {}
    operations: dict[str, object] = {}
    stages["source"] = snapshot(working, "source", collection, clay)
    operations["fit"] = COMMON.fit_to_v3_envelope(working)
    stages["fit"] = snapshot(working, "fit", collection, clay)
    operations["flatten"] = LEGACY.flatten_landing(working)
    stages["flatten"] = snapshot(working, "flatten", collection, clay)

    if final_index >= STAGE_ORDER.index("collapse"):
        protection = DIRECT.detail_protection_group(working)
        operations["collapse"] = DIRECT.decimate_direct(working, protection)
        operations["postCollapseFlatten"] = LEGACY.flatten_landing(working)
        stages["collapse"] = snapshot(working, "collapse", collection, clay)
    if final_index >= STAGE_ORDER.index("normals"):
        operations["normalFinalization"] = DIRECT.finalize_direct_normals(working.data)
        stages["normals"] = snapshot(working, "normals", collection, clay)

    bpy.data.objects.remove(working, do_unlink=True)
    stage_records = {key: stage_record(stages[key]) for key in requested_stages}
    renders: dict[str, dict[str, Path]] = {view: {} for view in ("front", "three-quarter")}
    for view in renders:
        for key in requested_stages:
            path = run / f"{key}-{view}.png"
            render_stage(scene, camera, stages, key, view, path)
            renders[view][key] = path
            print(f"STAGE_RENDER_{view.upper()}_{key.upper()}={path}", flush=True)

    sheets: dict[str, Path] = {}
    for view in renders:
        sheet = run / f"matched-{view}-stages.png"
        paths = [renders[view][key] for key in requested_stages]
        contact_sheet(paths, sheet, [STAGE_LABELS[key] for key in requested_stages])
        sheets[view] = sheet

    deltas: dict[str, object] = {}
    for view in renders:
        deltas[view] = {}
        for before, after in zip(requested_stages, requested_stages[1:]):
            deltas[view][f"{before}To{after.title()}"] = image_delta(
                renders[view][before], renders[view][after]
            )

    for obj in stages.values():
        obj.hide_render = False
        obj.hide_set(False)
    blend = run / "marble-stage-isolation.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True, check_existing=False)
    proofs = {
        view: [proof_record(renders[view][key]) for key in requested_stages]
        for view in renders
    }
    report = {
        "schema": 1,
        "purpose": (
            "Matched neutral-clay causal isolation for the rejected direct dense pipeline; "
            "no texture normal, provider call, bake, optimization, runtime assembly, or install."
        ),
        "hypothesis": (
            "Fit and contact flattening preserve the broad slab and arches; if both matched "
            "stages remain clean, collapse becomes the next bounded causal boundary."
        ),
        "status": "diagnostic evidence; independent visual review required",
        "through": args.through,
        "order": requested_stages,
        "inputs": {
            "denseDonor": {
                "file": relative(COMMON.DENSE),
                "sha256": digest(COMMON.DENSE),
            },
            "rejected238kManifest": {
                "file": relative(
                    COMMON.V4 / "proofs" / "marble-direct-238k-visual-rejection.json"
                ),
                "sha256": digest(
                    COMMON.V4 / "proofs" / "marble-direct-238k-visual-rejection.json"
                ),
            },
        },
        "operations": operations,
        "stages": stage_records,
        "matchedClay": {
            "material": "identical generated neutral clay; no image texture or normal map",
            "views": {
                "front": {
                    "camera": {
                        "type": "orthographic",
                        "location": [0.0, -6.0, 0.46],
                        "target": [0.0, 0.0, -0.10],
                        "scale": 1.50,
                    },
                    "proofs": proofs["front"],
                    "contactSheet": proof_record(sheets["front"]),
                },
                "threeQuarter": {
                    "camera": {
                        "type": "orthographic",
                        "location": [4.3, -6.5, 2.65],
                        "target": [0.0, 0.0, -0.10],
                        "scale": 2.20,
                    },
                    "proofs": proofs["three-quarter"],
                    "contactSheet": proof_record(sheets["three-quarter"]),
                },
            },
            "sequentialPixelDeltas": deltas,
            "render": {
                "engine": "Blender Eevee",
                "resolution": list(RESOLUTION),
                "look": "AgX - Medium High Contrast",
                "transparentBackground": True,
                "blender": bpy.app.version_string,
            },
        },
        "editableSource": {
            "file": relative(blend),
            "bytes": blend.stat().st_size,
            "sha256": digest(blend),
            "stages": requested_stages,
        },
        "rebuild": (
            "rtk proxy timeout 1200 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python art/glass-adventure/platform-trials/v4/production/"
            f"diagnose_marble_stage_boundary.py -- --through {args.through}"
        ),
    }
    report_path = run / "report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print("STAGE_ISOLATION_REPORT=" + str(report_path), flush=True)


if __name__ == "__main__":
    main()
