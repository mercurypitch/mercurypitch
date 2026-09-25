#!/usr/bin/env python3
"""Build a source-preserving packed Blender master and matched review renders."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import tempfile
from typing import Any, Iterable

import bpy
from mathutils import Matrix, Vector
import numpy as np


HERE = Path(__file__).resolve().parent
KIT = HERE.parent
REPO = HERE.parents[4]
SOURCE = Path(
    os.environ.get("GLASS_SOURCE_ROOT", str(KIT / "source-assets"))
).expanduser().resolve()
MIRRORS = HERE / "reports"

VIEWS = ("three-quarter", "top", "side")
RESOLUTION = (1100, 820)
ASSETS: dict[str, dict[str, Any]] = {
    "gilt-scroll-bridge": {
        "label": "Gilt Scroll Bridge",
        "root": "Cloudway_GiltScrollBridge_DenseMaster",
        "targetLongDimensionMetres": 2.40,
        "expectedRegions": ["retracting deck", "left roller", "right roller"],
        "sourceLimitation": (
            "The provider source is one opaque exported mesh and one material, "
            "with many unlabeled loose geometry components. "
            "Deck and roller separation remains unproved until deliberate authoring."
        ),
    },
    "rose-quartz-crackle-fast": {
        "label": "Rose Quartz Crackle Fast",
        "root": "Cloudway_RoseQuartzCrackleFast_DenseMaster",
        "targetLongDimensionMetres": 1.70,
        "expectedRegions": ["crystal body", "gold clasps"],
        "sourceLimitation": (
            "The provider source is one opaque exported mesh and one material, "
            "with many unlabeled loose geometry components. "
            "Crystal, clasps, and any future shards are not authoring-separated."
        ),
    },
    "amethyst-crackle-slow": {
        "label": "Amethyst Crackle Slow",
        "root": "Cloudway_AmethystCrackleSlow_DenseMaster",
        "targetLongDimensionMetres": 1.70,
        "expectedRegions": ["crystal body", "gold clasps"],
        "sourceLimitation": (
            "The provider source is one opaque exported mesh and one material, "
            "with many unlabeled loose geometry components. "
            "Crystal, clasps, and any future shards are not authoring-separated."
        ),
    },
}
PBR_ROLES = ("base_color", "normal", "metallic", "roughness")


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def digest_bytes(payload: bytes | memoryview) -> str:
    return hashlib.sha256(payload).hexdigest()


def logical_path(path: Path) -> str:
    resolved = path.resolve()
    if resolved.is_relative_to(SOURCE):
        return "source-assets/" + resolved.relative_to(SOURCE).as_posix()
    return resolved.relative_to(REPO).as_posix()


def durable_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def file_record(path: Path, dimensions: Iterable[int] | None = None) -> dict[str, Any]:
    row: dict[str, Any] = {
        "file": logical_path(path),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
    }
    if dimensions is not None:
        row["dimensions"] = [int(value) for value in dimensions]
    return row


def paths_for(asset: str) -> dict[str, Path]:
    archive = SOURCE / "meshy" / asset
    master_dir = SOURCE / "blender" / asset
    proof_dir = SOURCE / "proofs" / "blender" / asset
    report_dir = SOURCE / "production" / asset
    return {
        "archive": archive,
        "receipt": archive / "receipt.json",
        "donor": archive / "dense-donor.glb",
        "textures": archive / "textures",
        "masterDir": master_dir,
        "master": master_dir / f"{asset}-dense-master.blend",
        "proofDir": proof_dir,
        "reportDir": report_dir,
        "report": report_dir / "dense-master-report.json",
        "audit": report_dir / "dense-master-audit.json",
        "mirror": MIRRORS / f"{asset}-dense-master.json",
        "auditMirror": MIRRORS / f"{asset}-dense-master-audit.json",
    }


def load_receipt(asset: str, paths: dict[str, Path]) -> dict[str, Any]:
    receipt = json.loads(paths["receipt"].read_text())
    if receipt.get("assetId") != asset or receipt.get("state") != "archived":
        raise ValueError(f"{asset}: source receipt is not an archived matching task")
    archive = receipt.get("archiveDownload")
    model = archive.get("model") if isinstance(archive, dict) else None
    if not isinstance(model, dict):
        raise ValueError(f"{asset}: source receipt has no archived model")
    if (
        model.get("sha256") != digest(paths["donor"])
        or int(model.get("bytes", -1)) != paths["donor"].stat().st_size
    ):
        raise ValueError(f"{asset}: dense donor differs from its receipt")
    texture_rows = archive.get("textures", [])
    rows_by_role = {
        row.get("role"): row for row in texture_rows if isinstance(row, dict)
    }
    if set(rows_by_role) != set(PBR_ROLES):
        raise ValueError(f"{asset}: expected one complete four-map PBR set")
    for role in PBR_ROLES:
        row = rows_by_role[role]
        texture = SOURCE / str(row["file"]).removeprefix("source-assets/")
        expected_dimensions = [8192, 8192] if role == "base_color" else [4096, 4096]
        if (
            texture.parent != paths["textures"]
            or texture.name != f"set-0-{role}.png"
            or not texture.is_file()
            or digest(texture) != row.get("sha256")
            or int(row.get("bytes", -1)) != texture.stat().st_size
            or row.get("dimensions") != expected_dimensions
        ):
            raise ValueError(f"{asset}: {role} map differs from its receipt")
    return receipt


def mesh_arrays(mesh: bpy.types.Mesh) -> tuple[np.ndarray, np.ndarray]:
    mesh.calc_loop_triangles()
    positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get("co", positions)
    triangles = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
    mesh.loop_triangles.foreach_get("vertices", triangles)
    return positions.reshape((-1, 3)), triangles.reshape((-1, 3))


def matrix_array(matrix: Matrix) -> np.ndarray:
    return np.asarray([list(row) for row in matrix], dtype=np.float64)


def matrix_record(matrix: Matrix) -> list[list[float]]:
    return [[round(float(value), 12) for value in row] for row in matrix]


def world_positions(positions: np.ndarray, matrix: Matrix) -> np.ndarray:
    transform = matrix_array(matrix)
    return positions.astype(np.float64) @ transform[:3, :3].T + transform[:3, 3]


def topology_record(positions: np.ndarray, triangles: np.ndarray) -> dict[str, Any]:
    nonfinite = int((~np.isfinite(positions)).sum())
    degenerate = 0
    for start in range(0, len(triangles), 250_000):
        chunk = triangles[start : start + 250_000]
        first = positions[chunk[:, 0]]
        second = positions[chunk[:, 1]]
        third = positions[chunk[:, 2]]
        twice_area = np.linalg.norm(np.cross(second - first, third - first), axis=1)
        degenerate += int((twice_area <= 1e-12).sum())
    return {
        "vertices": int(len(positions)),
        "triangles": int(len(triangles)),
        "nonFinitePositionValues": nonfinite,
        "degenerateTriangles": degenerate,
        "vertexPositionsFloat32Sha256": digest_bytes(positions.tobytes()),
        "triangleIndicesInt32Sha256": digest_bytes(triangles.tobytes()),
    }


def connected_components(mesh: bpy.types.Mesh) -> dict[str, Any]:
    edge_vertices = np.empty(len(mesh.edges) * 2, dtype=np.int32)
    mesh.edges.foreach_get("vertices", edge_vertices)
    parent = list(range(len(mesh.vertices)))
    sizes = [1] * len(parent)

    def root(value: int) -> int:
        while parent[value] != value:
            parent[value] = parent[parent[value]]
            value = parent[value]
        return value

    for index in range(0, len(edge_vertices), 2):
        first = root(int(edge_vertices[index]))
        second = root(int(edge_vertices[index + 1]))
        if first == second:
            continue
        if sizes[first] < sizes[second]:
            first, second = second, first
        parent[second] = first
        sizes[first] += sizes[second]
    counts: dict[int, int] = {}
    for vertex in range(len(parent)):
        component = root(vertex)
        counts[component] = counts.get(component, 0) + 1
    ordered = sorted(counts.values(), reverse=True)
    total = max(1, len(parent))
    return {
        "count": len(ordered),
        "largestVertexCounts": ordered[:12],
        "largestVertexFractions": [round(value / total, 9) for value in ordered[:12]],
        "interpretation": (
            "Connectivity measures loose geometry only; it does not assign semantic "
            "labels or prove safe part separation."
        ),
    }


def triangle_geometry(
    points: np.ndarray, triangles: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    first = points[triangles[:, 0]]
    second = points[triangles[:, 1]]
    third = points[triangles[:, 2]]
    cross = np.cross(second - first, third - first)
    twice_area = np.linalg.norm(cross, axis=1)
    normal_z = np.divide(
        cross[:, 2],
        twice_area,
        out=np.zeros_like(twice_area),
        where=twice_area > 1e-15,
    )
    centres_z = (first[:, 2] + second[:, 2] + third[:, 2]) / 3.0
    return twice_area * 0.5, normal_z, centres_z


def contact_candidate(points: np.ndarray, triangles: np.ndarray) -> dict[str, Any]:
    low = points.min(axis=0)
    high = points.max(axis=0)
    dimensions = high - low
    if not np.all(np.isfinite(dimensions)) or np.any(dimensions <= 0):
        raise ValueError("Dense donor has invalid world-space bounds")
    bin_size = max(float(dimensions[2]) / 320.0, 1e-7)
    area_by_bin = np.zeros(321, dtype=np.float64)
    for start in range(0, len(triangles), 250_000):
        chunk = triangles[start : start + 250_000]
        area, normal_z, centres_z = triangle_geometry(points, chunk)
        candidate = (normal_z > 0.82) & (
            centres_z > float(low[2] + dimensions[2] * 0.35)
        )
        bins = np.clip(
            np.rint((centres_z[candidate] - low[2]) / bin_size).astype(np.int32),
            0,
            320,
        )
        area_by_bin += np.bincount(
            bins, weights=area[candidate], minlength=len(area_by_bin)
        )
    if not np.any(area_by_bin > 0):
        raise ValueError("Dense donor has no upward-facing landing candidate")
    winning_bin = int(np.argmax(area_by_bin))
    landing = float(low[2] + winning_bin * bin_size)
    tolerance = max(bin_size * 2.5, float(dimensions[2]) * 0.003)
    patch_low = np.full(3, np.inf)
    patch_high = np.full(3, -np.inf)
    patch_area = 0.0
    patch_triangles = 0
    for start in range(0, len(triangles), 250_000):
        chunk = triangles[start : start + 250_000]
        area, normal_z, centres_z = triangle_geometry(points, chunk)
        selected = (normal_z > 0.80) & (np.abs(centres_z - landing) <= tolerance)
        if not np.any(selected):
            continue
        selected_triangles = chunk[selected]
        selected_points = points[selected_triangles.reshape(-1)]
        patch_low = np.minimum(patch_low, selected_points.min(axis=0))
        patch_high = np.maximum(patch_high, selected_points.max(axis=0))
        patch_area += float(area[selected].sum())
        patch_triangles += int(selected.sum())
    if patch_triangles == 0:
        raise ValueError("Dense donor landing candidate has no measurable patch")
    patch_dimensions = patch_high - patch_low
    coverage = [
        float(patch_dimensions[0] / dimensions[0]),
        float(patch_dimensions[1] / dimensions[1]),
    ]
    relative_flatness = float(patch_dimensions[2] / dimensions[2])
    looks_broad = coverage[0] >= 0.35 and coverage[1] >= 0.30
    looks_flat = relative_flatness <= 0.035
    return {
        "method": (
            "Largest upper upward-facing area bin, followed by a bounded local "
            "height patch. This is geometric screening, not a certified collider."
        ),
        "rawBoundsBlenderZUp": {
            "min": [round(float(value), 9) for value in low],
            "max": [round(float(value), 9) for value in high],
        },
        "rawDimensionsBlenderZUp": [round(float(value), 9) for value in dimensions],
        "landingRawZ": round(landing, 9),
        "heightToleranceRaw": round(tolerance, 9),
        "patchTriangles": patch_triangles,
        "patchAreaRawSquareUnits": round(patch_area, 9),
        "patchBoundsRaw": {
            "min": [round(float(value), 9) for value in patch_low],
            "max": [round(float(value), 9) for value in patch_high],
        },
        "patchDimensionsRaw": [round(float(value), 9) for value in patch_dimensions],
        "horizontalCoverage": [round(value, 9) for value in coverage],
        "relativePatchHeightSpread": round(relative_flatness, 9),
        "broadCandidate": looks_broad,
        "flatCandidate": looks_flat,
        "screeningStatus": (
            "broad-flat-candidate" if looks_broad and looks_flat else "needs-review"
        ),
    }


def clear_provider_materials(mesh: bpy.types.Mesh) -> None:
    mesh.materials.clear()
    for material in list(bpy.data.materials):
        bpy.data.materials.remove(material, do_unlink=True)
    for image in list(bpy.data.images):
        if image.type == "IMAGE":
            bpy.data.images.remove(image, do_unlink=True)


def load_map(asset: str, role: str, path: Path, receipt_row: dict[str, Any]) -> bpy.types.Image:
    image = bpy.data.images.load(str(path), check_existing=False)
    image.name = f"{asset}__{role}"
    image.colorspace_settings.name = "sRGB" if role == "base_color" else "Non-Color"
    image["role"] = role
    image["sourceFile"] = logical_path(path)
    image["sourceSha256"] = receipt_row["sha256"]
    image["sourceDimensions"] = receipt_row["dimensions"]
    return image


def provider_material(
    asset: str, receipt: dict[str, Any], paths: dict[str, Path]
) -> tuple[bpy.types.Material, list[dict[str, Any]]]:
    rows = {
        row["role"]: row for row in receipt["archiveDownload"]["textures"]
    }
    images = {
        role: load_map(
            asset,
            role,
            paths["textures"] / f"set-0-{role}.png",
            rows[role],
        )
        for role in PBR_ROLES
    }
    material = bpy.data.materials.new(f"{asset}__provider_full_pbr")
    material.use_nodes = True
    material["sourceAppearance"] = "provider opaque PBR"
    material["glassTransmissionAuthored"] = False
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (760, 80)
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.location = (460, 80)
    shader.inputs["IOR"].default_value = 1.45
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])

    texture_nodes: dict[str, bpy.types.Node] = {}
    for row, role in enumerate(PBR_ROLES):
        texture = nodes.new("ShaderNodeTexImage")
        texture.name = f"Provider {role}"
        texture.label = role
        texture.image = images[role]
        texture.location = (-640, 320 - row * 220)
        texture.interpolation = "Linear"
        texture.extension = "REPEAT"
        texture_nodes[role] = texture
    links.new(texture_nodes["base_color"].outputs["Color"], shader.inputs["Base Color"])
    links.new(texture_nodes["metallic"].outputs["Color"], shader.inputs["Metallic"])
    links.new(texture_nodes["roughness"].outputs["Color"], shader.inputs["Roughness"])
    normal = nodes.new("ShaderNodeNormalMap")
    normal.location = (170, -140)
    normal.inputs["Strength"].default_value = 1.0
    links.new(texture_nodes["normal"].outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], shader.inputs["Normal"])
    report = [
        {
            **file_record(paths["textures"] / f"set-0-{role}.png", rows[role]["dimensions"]),
            "role": role,
            "colorSpace": images[role].colorspace_settings.name,
        }
        for role in PBR_ROLES
    ]
    return material, report


def clay_material() -> bpy.types.Material:
    material = bpy.data.materials.new("Cloudway neutral inspection clay")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.46, 0.56, 0.62, 1.0)
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Roughness"].default_value = 0.58
    return material


def link_only(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area(
    collection: bpy.types.Collection,
    name: str,
    location: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
    target: Vector,
) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    collection.objects.link(light)
    light.location = location
    point_at(light, target)


def setup_proof_scene(
    review_collection: bpy.types.Collection,
    review_bounds: tuple[np.ndarray, np.ndarray],
) -> tuple[bpy.types.Scene, bpy.types.Object, bpy.types.Object]:
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = RESOLUTION[0]
    scene.render.resolution_y = RESOLUTION[1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.render.dither_intensity = 0.0
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.0
    scene.world = scene.world or bpy.data.worlds.new("Cloudway proof world")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.018, 0.028, 0.045, 1.0)
    background.inputs["Strength"].default_value = 0.32

    low, high = review_bounds
    dimensions = high - low
    radius = float(max(dimensions[0], dimensions[1], dimensions[2] * 1.8))
    target = Vector((0.0, 0.0, float((low[2] + high[2]) * 0.42)))

    floor_material = bpy.data.materials.new("Cloudway proof floor")
    floor_material.use_nodes = True
    floor_shader = floor_material.node_tree.nodes.get("Principled BSDF")
    floor_shader.inputs["Base Color"].default_value = (0.025, 0.044, 0.064, 1.0)
    floor_shader.inputs["Roughness"].default_value = 0.72
    bpy.ops.mesh.primitive_plane_add(size=max(radius * 4.0, 4.0))
    floor = bpy.context.object
    floor.name = "Cloudway_Proof_Floor"
    link_only(floor, review_collection)
    floor.location.z = float(low[2] - max(0.035, dimensions[2] * 0.04))
    floor.data.materials.append(floor_material)

    camera_data = bpy.data.cameras.new("Cloudway proof camera")
    camera_data.lens = 56
    camera_data.sensor_width = 36
    camera_data.clip_start = 0.01
    camera_data.clip_end = 200
    camera = bpy.data.objects.new("Cloudway_Proof_Camera", camera_data)
    review_collection.objects.link(camera)
    scene.camera = camera

    add_area(
        review_collection,
        "Cloudway proof key",
        (radius * 1.5, -radius * 1.7, radius * 2.3),
        980.0,
        radius * 1.15,
        (1.0, 0.78, 0.58),
        target,
    )
    add_area(
        review_collection,
        "Cloudway proof fill",
        (-radius * 1.8, -radius * 0.3, radius * 1.25),
        720.0,
        radius * 1.45,
        (0.50, 0.72, 1.0),
        target,
    )
    add_area(
        review_collection,
        "Cloudway proof rim",
        (radius * 0.2, radius * 1.9, radius * 1.75),
        900.0,
        radius * 1.05,
        (0.55, 1.0, 0.88),
        target,
    )
    return scene, camera, floor


def configure_view(
    camera: bpy.types.Object,
    view: str,
    bounds: tuple[np.ndarray, np.ndarray],
) -> None:
    low, high = bounds
    dimensions = high - low
    radius = float(max(dimensions[0], dimensions[1], dimensions[2] * 1.8))
    target = Vector((0.0, 0.0, float((low[2] + high[2]) * 0.42)))
    major_x = dimensions[0] >= dimensions[1]
    if view == "top":
        camera.data.type = "ORTHO"
        camera.data.ortho_scale = float(max(dimensions[0], dimensions[1]) * 1.22)
        camera.location = (0.0, 0.0, float(high[2] + radius * 3.0))
        point_at(camera, Vector((0.0, 0.0, 0.0)))
        return
    camera.data.type = "PERSP"
    camera.data.lens = 56
    if view == "three-quarter":
        camera.location = (
            (radius * 1.75 if major_x else -radius * 2.25),
            (-radius * 2.25 if major_x else radius * 1.75),
            float(target.z + radius * 1.35),
        )
    elif view == "side":
        camera.location = (
            0.0 if major_x else -radius * 2.75,
            -radius * 2.75 if major_x else 0.0,
            float(target.z + radius * 0.62),
        )
    else:
        raise ValueError(f"Unknown proof view {view}")
    point_at(camera, target)


def render_atomic(scene: bpy.types.Scene, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f".{target.stem}.tmp{target.suffix}")
    temporary.unlink(missing_ok=True)
    scene.render.filepath = str(temporary)
    bpy.ops.render.render(write_still=True)
    if not temporary.is_file():
        raise RuntimeError(f"Blender did not write {temporary}")
    os.replace(temporary, target)


def render_proofs(
    asset: str,
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    review: bpy.types.Object,
    pbr: bpy.types.Material,
    clay: bpy.types.Material,
    bounds: tuple[np.ndarray, np.ndarray],
    proof_dir: Path,
) -> dict[str, Any]:
    proofs: dict[str, Any] = {"clay": {}, "pbr": {}}
    review.material_slots[0].link = "OBJECT"
    for view in VIEWS:
        configure_view(camera, view, bounds)
        for mode, material in (("clay", clay), ("pbr", pbr)):
            review.material_slots[0].material = material
            target = proof_dir / f"matched-{mode}-{view}.png"
            render_atomic(scene, target)
            proofs[mode][view] = file_record(target, RESOLUTION)
    review.material_slots[0].material = pbr
    return proofs


def build(asset: str) -> dict[str, Any]:
    config = ASSETS[asset]
    paths = paths_for(asset)
    receipt = load_receipt(asset, paths)
    for key in ("masterDir", "proofDir", "reportDir"):
        paths[key].mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(paths["donor"]))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if len(meshes) != 1:
        raise ValueError(f"{asset}: expected one source mesh, found {len(meshes)}")
    raw = meshes[0]
    raw.name = f"{asset}__raw_import"
    raw.data.name = f"{asset}__dense_mesh"

    positions, triangles = mesh_arrays(raw.data)
    topology = topology_record(positions, triangles)
    expected_model = receipt["archiveDownload"]["model"]
    if (
        topology["vertices"] != int(expected_model["referencedVertices"])
        or topology["triangles"] != int(expected_model["triangles"])
        or topology["nonFinitePositionValues"]
        or topology["degenerateTriangles"]
    ):
        raise ValueError(f"{asset}: imported topology differs from archived evidence")
    world = world_positions(positions, raw.matrix_world)
    contact = contact_candidate(world, triangles)
    components = connected_components(raw.data)

    raw_collection = bpy.data.collections.new(f"{asset}__raw_source")
    scene.collection.children.link(raw_collection)
    for obj in imported:
        link_only(obj, raw_collection)
        obj.hide_render = True
        obj.hide_viewport = True
    raw["role"] = "immutable-dense-import"
    raw["sourceSha256"] = expected_model["sha256"]
    raw["topologyPreserved"] = True
    raw_collection.hide_render = True
    raw_collection.hide_viewport = True

    clear_provider_materials(raw.data)
    pbr, texture_report = provider_material(asset, receipt, paths)
    raw.data.materials.append(pbr)
    clay = clay_material()

    bounds_low = world.min(axis=0)
    bounds_high = world.max(axis=0)
    dimensions = bounds_high - bounds_low
    scale = float(config["targetLongDimensionMetres"] / max(dimensions[0], dimensions[1]))
    centre = Vector(
        (
            float((bounds_low[0] + bounds_high[0]) * 0.5),
            float((bounds_low[1] + bounds_high[1]) * 0.5),
            float(contact["landingRawZ"]),
        )
    )
    normalization = Matrix.Scale(scale, 4) @ Matrix.Translation(-centre)

    review_collection = bpy.data.collections.new(f"{asset}__review")
    scene.collection.children.link(review_collection)
    root = bpy.data.objects.new(config["root"], None)
    review_collection.objects.link(root)
    root["assetId"] = asset
    root["status"] = "dense source review master; runtime adaptation pending"
    root["sourceSha256"] = expected_model["sha256"]
    root["sourceTopologyMutation"] = False
    root["sourceAppearance"] = "opaque provider PBR"
    root["glassTransmissionAuthored"] = False
    root["coordinates"] = "Blender Z-up; review landing candidate at Z=0"

    review = raw.copy()
    review.name = f"{asset}__normalized_review"
    review.data = raw.data
    review.parent = root
    review.matrix_world = normalization @ raw.matrix_world
    review.hide_render = False
    review.hide_viewport = False
    review["role"] = "normalized-dense-review"
    review["uniformScale"] = scale
    review["landingCandidateBlenderZ"] = 0.0
    review_collection.objects.link(review)

    normalized_world = world_positions(positions, review.matrix_world)
    review_low = normalized_world.min(axis=0)
    review_high = normalized_world.max(axis=0)
    scene, camera, _floor = setup_proof_scene(
        review_collection, (review_low, review_high)
    )
    proofs = render_proofs(
        asset,
        scene,
        camera,
        review,
        pbr,
        clay,
        (review_low, review_high),
        paths["proofDir"],
    )

    bpy.ops.file.pack_all()
    unpacked = sorted(
        image.name
        for image in bpy.data.images
        if image.type == "IMAGE"
        and image.source != "GENERATED"
        and image.packed_file is None
    )
    if unpacked:
        raise ValueError(f"{asset}: packed master retains external images: {unpacked}")
    temporary_master = paths["master"].with_name(f".{asset}.tmp.blend")
    temporary_master.unlink(missing_ok=True)
    bpy.ops.wm.save_as_mainfile(
        filepath=str(temporary_master), compress=True, check_existing=False
    )
    os.replace(temporary_master, paths["master"])

    report = {
        "schema": 1,
        "assetId": asset,
        "status": "packed dense source review master; runtime adaptation pending",
        "scope": (
            "Immutable dense-source preservation, geometric screening, and matched "
            "clay/provider-PBR renders. This does not certify gameplay collision, "
            "motion, fracture, transparent glass, runtime cost, or final materials."
        ),
        "source": {
            **file_record(paths["donor"]),
            "taskId": receipt["taskId"],
            "receipt": file_record(paths["receipt"]),
            "providerQuality": receipt.get("providerQuality"),
        },
        "geometry": {
            **topology,
            "meshObjects": 1,
            "primitives": 1,
            "materialSlots": 1,
            "connectedComponents": components,
            "rawObjectMatrix": matrix_record(raw.matrix_world),
            "normalizationMatrix": matrix_record(normalization),
            "reviewObjectMatrix": matrix_record(review.matrix_world),
            "reviewBoundsBlenderZUpMetres": {
                "min": [round(float(value), 9) for value in review_low],
                "max": [round(float(value), 9) for value in review_high],
            },
            "reviewDimensionsBlenderZUpMetres": [
                round(float(value), 9) for value in review_high - review_low
            ],
            "uniformScaleOnly": True,
            "decimation": False,
            "remesh": False,
            "sourceAndReviewShareMeshData": raw.data is review.data,
        },
        "contactCandidate": {
            **contact,
            "landingReviewZMetres": 0.0,
            "warning": (
                "The measured patch is a review candidate. It is not a collider or "
                "proof that a player can stand on every visible upper surface."
            ),
        },
        "semanticRegions": {
            "expectedVisibleRegions": config["expectedRegions"],
            "providerOrganization": (
                "one exported mesh, one primitive, one material; loose geometry "
                "components have no semantic labels"
            ),
            "separationStatus": "not-established",
            "limitation": config["sourceLimitation"],
        },
        "appearance": {
            "sourceMode": "opaque provider PBR reconstructed from full archived maps",
            "alphaMode": "OPAQUE",
            "doubleSidedSource": True,
            "glassTransmissionAuthored": False,
            "maps": texture_report,
            "limitation": (
                "The source proof intentionally preserves opaque provider appearance. "
                "True refractive/transmissive glass and region-specific shaders require "
                "a separate reviewed finalization pass."
            ),
        },
        "proofs": {
            "method": (
                "Clay and provider PBR use the same dense geometry, normalization, "
                "camera, lighting, exposure, resolution, and view per matched pair."
            ),
            "resolution": list(RESOLUTION),
            "views": proofs,
        },
        "packedBlend": {
            **file_record(paths["master"]),
            "allFileImagesPacked": True,
            "rawAndReviewCollectionsRetained": True,
        },
        "tool": {
            "blender": bpy.app.version_string,
            "blenderExecutable": "/usr/bin/blender",
            "numpy": np.__version__,
        },
        "rebuild": (
            "rtk proxy timeout 1200 env ALSOFT_DRIVERS=null /usr/bin/blender "
            "--background --factory-startup --python-exit-code 1 --python "
            "art/glass-adventure/cloudway-laboratory/v1/production/"
            f"prepare_dense_master.py -- --asset {asset}"
        ),
    }
    durable_json(paths["report"], report)
    durable_json(paths["mirror"], report)
    print("CLOUDWAY_DENSE_MASTER=" + json.dumps(report), flush=True)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", choices=sorted(ASSETS), required=True)
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    args = parser.parse_args(arguments)
    build(args.asset)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
