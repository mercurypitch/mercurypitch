#!/usr/bin/env python3
"""Fresh-reopen audit and matched visual proof for Cloudway material splits."""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from typing import Any, Iterable

import bpy
from mathutils import Vector
import numpy as np


HERE = Path(__file__).resolve().parent


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


PREP = load_module(
    "cloudway_prepare_static_material_split_runtime",
    HERE / "prepare_static_material_split_runtime.py",
)
STATIC = PREP.STATIC
DENSE = PREP.DENSE


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def descendants(root: bpy.types.Object) -> Iterable[bpy.types.Object]:
    yield root
    for child in root.children:
        yield from descendants(child)


def mesh_objects(root: bpy.types.Object) -> list[bpy.types.Object]:
    return [obj for obj in descendants(root) if obj.type == "MESH"]


def bounds_for(objects: Iterable[bpy.types.Object]) -> tuple[np.ndarray, np.ndarray]:
    low = np.full(3, np.inf, dtype=np.float64)
    high = np.full(3, -np.inf, dtype=np.float64)
    found = False
    for obj in objects:
        mesh = obj.data
        values = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
        mesh.vertices.foreach_get("co", values)
        world = DENSE.world_positions(values.reshape((-1, 3)), obj.matrix_world)
        low = np.minimum(low, world.min(axis=0))
        high = np.maximum(high, world.max(axis=0))
        found = True
    require(found and bool(np.all(np.isfinite(low))) and bool(np.all(high > low)), "Invalid bounds")
    return low, high


def expected_blender_bounds(geometry: dict[str, Any]) -> tuple[np.ndarray, np.ndarray]:
    runtime = geometry["runtimeBoundsMetres"]
    low = np.asarray(runtime["minimum"], dtype=np.float64)
    high = np.asarray(runtime["maximum"], dtype=np.float64)
    return (
        np.asarray((low[0], -high[2], low[1]), dtype=np.float64),
        np.asarray((high[0], -low[2], high[1]), dtype=np.float64),
    )


def raw_glb_audit(asset: str, report: dict[str, Any], runtime: Path) -> dict[str, Any]:
    config = PREP.ASSETS[asset]
    document = STATIC.glb_json(runtime)
    root_matches = [node for node in document.get("nodes", []) if node.get("name") == config["rootNode"]]
    require(len(root_matches) == 1, "Runtime GLB has no unique stable root")
    root = root_matches[0]
    for transform in ("matrix", "translation", "rotation", "scale"):
        require(transform not in root, f"Runtime root has a non-identity {transform}")
    extras = root.get("extras", {})
    metadata = json.loads(extras["cloudway_lab_asset_json"])
    collider = json.loads(extras["collider_json"])
    require(metadata["schema"] == "cloudway-lab-static-v1", "Static schema changed")
    require(metadata["assetId"] == asset, "Static asset ID changed")
    require(metadata["material"] == report["material"], "Material metadata differs from report")
    require(metadata["geometry"]["triangles"] == PREP.ASSETS[asset]["triangles"], "Metadata triangle count changed")
    require(collider["shape"] == "box", "Static collider shape changed")
    require(STATIC.glb_triangle_count(document) == PREP.ASSETS[asset]["triangles"], "GLB triangle count changed")
    material_rows = document.get("materials", [])
    materials = [row.get("name") for row in material_rows]
    require(set(materials) == set(config["materials"].values()), "GLB material names changed")
    transmission_metadata: list[dict[str, Any]] = []
    for role in ("opaque", "glass"):
        name = config["materials"][role]
        matches = [row for row in material_rows if row.get("name") == name]
        require(len(matches) == 1, f"GLB has no unique {role} material")
        authored = matches[0].get("extras", {}).get("glassTransmissionAuthored")
        require(
            authored is (role == "glass"),
            f"GLB {role} transmission-authoring metadata is inaccurate",
        )
        transmission_metadata.append(
            {
                "name": name,
                "role": role,
                "glassTransmissionAuthored": authored,
            }
        )
    primitive_rows: list[dict[str, Any]] = []
    for mesh_index, mesh in enumerate(document.get("meshes", [])):
        require(len(mesh.get("primitives", [])) == 1, "Runtime mesh must have one material primitive")
        primitive = mesh["primitives"][0]
        attributes = primitive.get("attributes", {})
        require({"POSITION", "NORMAL", "TEXCOORD_0"}.issubset(attributes), "Runtime primitive lacks vertex attributes")
        primitive_rows.append(
            {
                "mesh": mesh_index,
                "name": mesh.get("name"),
                "material": materials[int(primitive["material"])],
                "triangles": int(document["accessors"][int(primitive["indices"])]["count"]) // 3,
            }
        )
    require(len(primitive_rows) == 2, "Runtime GLB must expose two single-material meshes")
    return {
        "rootNode": config["rootNode"],
        "rootIdentity": True,
        "metadata": metadata,
        "collider": collider,
        "materials": transmission_metadata,
        "primitives": primitive_rows,
        "requiredExtensions": sorted(document.get("extensionsRequired", [])),
    }


def validate_glb(runtime: Path) -> dict[str, Any]:
    result = subprocess.run(
        [str(STATIC.MESHOPT), "validate", str(runtime)],
        cwd=STATIC.REPO,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    require(result.returncode == 0, "glTF validator rejected runtime v2")
    output = result.stdout
    require("No errors found" in output and "No warnings found" in output, "glTF validator reported errors or warnings")
    return {
        "command": (
            "apps/beside-cue/node_modules/.bin/gltf-transform validate "
            f"{STATIC.logical_path(runtime)}"
        ),
        "exitCode": result.returncode,
        "errors": 0,
        "warnings": 0,
        "informational": ["EXT_meshopt_compression is unsupported by the validator itself"],
    }


def working_blend_audit(asset: str, report: dict[str, Any], working: Path) -> dict[str, Any]:
    bpy.ops.wm.open_mainfile(filepath=str(working), load_ui=False)
    config = PREP.ASSETS[asset]
    root = bpy.data.objects.get(config["rootNode"])
    require(root is not None, "Packed working blend lost stable root")
    require(root.matrix_world.is_identity, "Packed working root is not identity")
    meshes = mesh_objects(root)
    require(len(meshes) == 1, "Packed working blend needs one source-preserving mesh")
    review = meshes[0]
    require(len(review.data.polygons) == config["triangles"], "Working triangle count changed")
    material_names = [slot.material.name for slot in review.material_slots if slot.material]
    require(set(material_names) == set(config["materials"].values()), "Working materials differ")
    indices = {"opaque": [], "glass": []}
    name_to_role = {value: key for key, value in config["materials"].items()}
    for polygon in review.data.polygons:
        material = review.data.materials[polygon.material_index]
        indices[name_to_role[material.name]].append(polygon.index)
    for role in ("opaque", "glass"):
        values = np.asarray(indices[role], dtype=np.uint32)
        expected = report["geometry"]["partitionAudit"]["roles"][role]
        require(len(values) == expected["triangles"], f"Working {role} count changed")
        require(PREP.uint_hash(values) == expected["sourceFaceIndexSha256"], f"Working {role} face assignment changed")
    metadata = json.loads(root["cloudway_lab_asset_json"])
    require(metadata["material"] == report["material"], "Working material metadata changed")
    image_rows = []
    for role in ("base_color", "normal", "metallic", "roughness"):
        image = bpy.data.images.get(f"{asset}__{role}")
        require(image is not None and image.packed_file is not None, f"Working {role} image is not packed")
        image_rows.append({"role": role, "dimensions": [int(image.size[0]), int(image.size[1])], "packed": True})
    return {
        "file": STATIC.logical_path(working),
        "bytes": working.stat().st_size,
        "sha256": STATIC.digest(working),
        "rootIdentity": True,
        "triangles": len(review.data.polygons),
        "materialNames": sorted(material_names),
        "images": image_rows,
        "faceAssignmentsMatchReport": True,
    }


def decode_glb(source: Path, target: Path) -> None:
    result = subprocess.run(
        [str(STATIC.MESHOPT), "copy", str(source), str(target)],
        cwd=STATIC.REPO,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    require(result.returncode == 0 and target.is_file(), f"Could not decode {source.name}: {result.stdout}")


def imported_metrics(
    root: bpy.types.Object,
    expected_materials: set[str] | None,
) -> dict[str, Any]:
    meshes = mesh_objects(root)
    require(meshes, "Fresh import has no meshes")
    triangles = 0
    normal_count = 0
    short_normals = 0
    minimum_normal = math.inf
    maximum_normal = 0.0
    material_names: list[str] = []
    mesh_rows: list[dict[str, Any]] = []
    for obj in meshes:
        mesh = obj.data
        require(len(obj.material_slots) == 1 and obj.material_slots[0].material is not None, "Fresh runtime mesh is not single-material")
        require(mesh.uv_layers.active is not None, "Fresh runtime mesh lost UV0")
        positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
        mesh.vertices.foreach_get("co", positions)
        require(bool(np.all(np.isfinite(positions))), "Fresh runtime mesh has non-finite positions")
        normals = np.empty(len(mesh.corner_normals) * 3, dtype=np.float32)
        mesh.corner_normals.foreach_get("vector", normals)
        lengths = np.linalg.norm(normals.reshape((-1, 3)), axis=1)
        require(bool(np.all(np.isfinite(lengths))), "Fresh runtime mesh has non-finite normals")
        material_name = obj.material_slots[0].material.name
        material_names.append(material_name)
        triangles += len(mesh.polygons)
        normal_count += len(lengths)
        short_normals += int(np.count_nonzero(lengths < 0.5))
        minimum_normal = min(minimum_normal, float(lengths.min()))
        maximum_normal = max(maximum_normal, float(lengths.max()))
        mesh_rows.append({"name": obj.name, "triangles": len(mesh.polygons), "material": material_name})
    if expected_materials is not None:
        require(set(material_names) == expected_materials, "Fresh import material set differs")
        require(len(meshes) == len(expected_materials), "Fresh import did not retain role meshes")
    low, high = bounds_for(meshes)
    return {
        "triangles": triangles,
        "normalCorners": normal_count,
        "shortNormalCorners": short_normals,
        "minimumNormalLength": minimum_normal,
        "maximumNormalLength": maximum_normal,
        "materialNames": sorted(material_names),
        "meshes": mesh_rows,
        "boundsBlenderZUp": {
            "minimum": [float(value) for value in low],
            "maximum": [float(value) for value in high],
        },
    }


def isolate_donor(asset: str, master: Path) -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    bpy.ops.wm.open_mainfile(filepath=str(master), load_ui=False)
    review = bpy.data.objects.get(f"{asset}__normalized_review")
    require(review is not None, "Dense donor lost normalized review")
    world = review.matrix_world.copy()
    review.parent = None
    review.matrix_world = world
    for obj in list(bpy.data.objects):
        if obj != review:
            bpy.data.objects.remove(obj, do_unlink=True)
    return review, [review]


def import_runtime(runtime: Path, decoded: Path, root_name: str) -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    decode_glb(runtime, decoded)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    result = bpy.ops.import_scene.gltf(filepath=str(decoded))
    require("FINISHED" in result, f"Blender could not import {runtime.name}")
    root = bpy.data.objects.get(root_name)
    require(root is not None, f"Fresh import lost root {root_name}")
    return root, mesh_objects(root)


def set_nearest_view(asset: str, camera: bpy.types.Object, bounds: tuple[np.ndarray, np.ndarray]) -> None:
    low, high = bounds
    dimensions = high - low
    if asset == "frost-lily-step":
        target = Vector((high[0] - dimensions[0] * 0.13, low[1] + dimensions[1] * 0.12, low[2] + dimensions[2] * 0.56))
    else:
        target = Vector((high[0] - dimensions[0] * 0.13, low[1] + dimensions[1] * 0.16, low[2] + dimensions[2] * 0.58))
    distance = float(max(dimensions[0], dimensions[1]) * 0.43)
    camera.data.type = "PERSP"
    camera.data.lens = 62
    camera.location = target + Vector((distance * 0.92, -distance, distance * 0.68))
    DENSE.point_at(camera, target)


def emission_material(name: str, color: tuple[float, float, float]) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeEmission")
    shader.inputs["Color"].default_value = (*color, 1.0)
    material.node_tree.links.new(shader.outputs["Emission"], output.inputs["Surface"])
    return material


def render_loaded(
    asset: str,
    label: str,
    meshes: list[bpy.types.Object],
    proof_dir: Path,
    semantic: bool = False,
) -> list[dict[str, Any]]:
    bounds = bounds_for(meshes)
    scene, camera, _floor = DENSE.setup_proof_scene(bpy.context.scene.collection, bounds)
    if semantic:
        config = PREP.ASSETS[asset]
        mask_materials = {
            config["materials"]["glass"]: emission_material("MASK__glass", (0.0, 0.52, 0.85)),
            config["materials"]["opaque"]: emission_material("MASK__opaque_trim", (1.0, 0.12, 0.015)),
        }
        for obj in meshes:
            source = obj.material_slots[0].material
            require(source is not None and source.name in mask_materials, "Fresh mask found unknown material")
            obj.data.materials.clear()
            obj.data.materials.append(mask_materials[source.name])
    records: list[dict[str, Any]] = []
    for view in ("gameplay", "nearest"):
        if view == "gameplay":
            DENSE.configure_view(camera, "three-quarter", bounds)
        else:
            set_nearest_view(asset, camera, bounds)
        target = proof_dir / f"matched-{label}-{view}.png"
        DENSE.render_atomic(scene, target)
        records.append(
            {
                "variant": label,
                "view": view,
                "file": STATIC.logical_path(target),
                "bytes": target.stat().st_size,
                "sha256": STATIC.digest(target),
                "resolution": list(DENSE.RESOLUTION),
            }
        )
    return records


def comparison_images(proof_dir: Path) -> list[dict[str, Any]]:
    magick = os.environ.get("MAGICK_BIN") or shutil.which("magick")
    require(magick is not None, "ImageMagick is required to build comparison proofs")
    records: list[dict[str, Any]] = []
    for view in ("gameplay", "nearest"):
        target = proof_dir / f"comparison-donor-current-v1-split-v2-{view}.png"
        inputs = [
            proof_dir / f"matched-{variant}-{view}.png"
            for variant in ("donor", "current-v1", "split-v2")
        ]
        result = subprocess.run(
            [magick, *map(str, inputs), "+append", str(target)],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
        require(result.returncode == 0 and target.is_file(), f"Could not build comparison: {result.stdout}")
        records.append(
            {
                "view": view,
                "file": STATIC.logical_path(target),
                "bytes": target.stat().st_size,
                "sha256": STATIC.digest(target),
                "resolution": [DENSE.RESOLUTION[0] * 3, DENSE.RESOLUTION[1]],
            }
        )
    return records


def audit(asset: str) -> dict[str, Any]:
    config = PREP.ASSETS[asset]
    paths = PREP.paths_for(asset)
    audit_source = paths["runtime"].with_name(f"{asset}-runtime-v2-audit.json")
    audit_mirror = HERE / "reports" / f"{asset}-runtime-v2-audit.json"
    report = json.loads(paths["sourceReport"].read_text(encoding="utf-8"))
    require(report["runtime"]["sha256"] == STATIC.digest(paths["runtime"]), "Runtime report hash is stale")
    require(report["lineage"]["packedWorkingBlend"]["sha256"] == STATIC.digest(paths["working"]), "Working report hash is stale")
    raw = raw_glb_audit(asset, report, paths["runtime"])
    validator = validate_glb(paths["runtime"])
    working = working_blend_audit(asset, report, paths["working"])
    proofs: list[dict[str, Any]] = []
    with tempfile.TemporaryDirectory(prefix=f"{asset}-runtime-v2-audit-") as temporary_name:
        temporary = Path(temporary_name)
        _donor_root, donor_meshes = isolate_donor(asset, paths["master"])
        proofs.extend(render_loaded(asset, "donor", donor_meshes, paths["proofs"]))

        current_root, current_meshes = import_runtime(
            paths["runtimeV1"], temporary / "runtime-v1.glb", config["rootNode"]
        )
        current_metrics = imported_metrics(current_root, None)
        proofs.extend(render_loaded(asset, "current-v1", current_meshes, paths["proofs"]))

        split_root, split_meshes = import_runtime(
            paths["runtime"], temporary / "runtime-v2.glb", config["rootNode"]
        )
        split_metrics = imported_metrics(split_root, set(config["materials"].values()))
        require(split_metrics["triangles"] == config["triangles"], "Fresh split triangle count changed")
        expected_low, expected_high = expected_blender_bounds(report["geometry"])
        actual_low = np.asarray(split_metrics["boundsBlenderZUp"]["minimum"])
        actual_high = np.asarray(split_metrics["boundsBlenderZUp"]["maximum"])
        tolerance = float(report["geometry"]["positionQuantizationStepUpperBoundMetres"]) * 3.0
        require(
            bool(np.all(np.abs(actual_low - expected_low) <= tolerance))
            and bool(np.all(np.abs(actual_high - expected_high) <= tolerance)),
            "Fresh split bounds differ beyond position quantization",
        )
        require(
            split_metrics["normalCorners"] == current_metrics["normalCorners"]
            and split_metrics["shortNormalCorners"] == current_metrics["shortNormalCorners"]
            and abs(split_metrics["minimumNormalLength"] - current_metrics["minimumNormalLength"]) <= 1e-6,
            "Fresh split normal inventory differs from accepted runtime v1",
        )
        proofs.extend(render_loaded(asset, "split-v2", split_meshes, paths["proofs"]))

        split_root, split_meshes = import_runtime(
            paths["runtime"], temporary / "runtime-v2-mask.glb", config["rootNode"]
        )
        proofs.extend(
            render_loaded(asset, "split-v2-semantic-mask", split_meshes, paths["proofs"], semantic=True)
        )
    comparisons = comparison_images(paths["proofs"])
    visual_finding = {
        "frost-lily-step": (
            "Matched authoring review passed: the broad ice slab and lily field remain one "
            "coherent glass region, all four ornate pearl/gold corner cages remain opaque, "
            "and matched gameplay-framed/nearest authoring masks show no material bleed."
        ),
        "aurora-glide-raft": (
            "Matched authoring review passed: the turquoise body remains one coherent "
            "glass region, all four gold corner caps and the thin top inlay/rim remain "
            "opaque and continuous, and matched gameplay-framed/nearest authoring masks "
            "show no bleed."
        ),
    }[asset]
    result = {
        "schema": 1,
        "assetId": asset,
        "status": (
            "fresh Blender reopen and matched headless authoring proof passed; "
            "browser and live-game validation pending"
        ),
        "runtime": {
            "file": STATIC.logical_path(paths["runtime"]),
            "bytes": paths["runtime"].stat().st_size,
            "sha256": STATIC.digest(paths["runtime"]),
        },
        "workingBlend": working,
        "rawGlb": raw,
        "validator": validator,
        "freshImport": {
            "currentV1": current_metrics,
            "splitV2": split_metrics,
            "boundsToleranceMetres": tolerance,
            "normalInventoryMatchesCurrentV1": True,
        },
        "visualProof": {
            "renderer": f"Blender {bpy.app.version_string} EEVEE Next headless",
            "scope": "Matched authoring proof only; it is not browser, tablet, or in-game GPU evidence.",
            "finding": visual_finding,
            "renders": proofs,
            "comparisons": comparisons,
        },
        "immutableMaster": {
            "file": STATIC.logical_path(paths["master"]),
            "sha256": STATIC.digest(paths["master"]),
            "matchesExpected": STATIC.digest(paths["master"]) == config["masterSha256"],
        },
        "rebuild": (
            "timeout 1200 flock -w 1200 "
            '"${GLASS_BLENDER_LOCK:-/tmp/glass-cloudway-blender.lock}" '
            'env ALSOFT_DRIVERS=null "${BLENDER_BIN:-blender}" '
            "--background --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/cloudway-laboratory/v1/production/"
            f"audit_static_material_split_runtime.py -- --asset {asset}"
        ),
    }
    require(result["immutableMaster"]["matchesExpected"], "Immutable master hash changed")
    STATIC.durable_json(audit_source, result)
    STATIC.durable_json(audit_mirror, result)
    report["status"] = (
        "runtime material-region derivative prepared; fresh reopen audit and matched "
        "headless authoring proof passed; browser and live-game validation pending"
    )
    report["freshReopenAudit"] = {
        "status": result["status"],
        "file": STATIC.logical_path(audit_source),
        "mirror": STATIC.logical_path(audit_mirror),
        "bytes": audit_source.stat().st_size,
        "sha256": STATIC.digest(audit_source),
    }
    STATIC.durable_json(paths["sourceReport"], report)
    STATIC.durable_json(paths["mirrorReport"], report)
    print("RUNTIME_V2_AUDIT=" + json.dumps(result, separators=(",", ":")))
    return result


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", required=True, choices=sorted(PREP.ASSETS))
    values = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(values)


if __name__ == "__main__":
    audit(arguments().asset)
