#!/usr/bin/env python3
"""Export one dense Cloudway master with bounded runtime textures and metadata."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
from typing import Any, Iterable

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


HERE = Path(__file__).resolve().parent
KIT = HERE.parent
REPO = HERE.parents[4]
SOURCE = Path(
    os.environ.get("GLASS_SOURCE_ROOT", str(KIT / "source-assets"))
).expanduser().resolve()
CATALOGUE = (
    REPO
    / "packages/glass-game/src/render/cloudway-laboratory-assets.json"
)
REPORTS = HERE / "reports"
CONTACT_SAMPLE_COUNT = 7
CONTACT_HEIGHT_TOLERANCE = 0.035
CONTACT_ORNAMENT_RISE_LIMIT = 0.12
CONTACT_EDGE_INSET_FRACTION = 0.01
CONTACT_UP_NORMAL_MINIMUM = 0.82
MESHOPT = REPO / "apps/beside-cue/node_modules/.bin/gltf-transform"
MESHOPT_POSITION_BITS = 16
MESHOPT_NORMAL_BITS = 12
MESHOPT_TEXCOORD_BITS = 14


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


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


def load_catalogue() -> dict[str, Any]:
    value = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    require(value.get("schema") == 1, "Unsupported static runtime catalogue schema")
    assets = value.get("assets")
    require(isinstance(assets, list) and assets, "Runtime catalogue has no assets")
    return value


def asset_config(catalogue: dict[str, Any], asset_id: str) -> dict[str, Any]:
    matches = [row for row in catalogue["assets"] if row.get("id") == asset_id]
    require(len(matches) == 1, f"Expected one runtime config for {asset_id}")
    return matches[0]


def asset_paths(asset_id: str) -> dict[str, Path]:
    asset_dir = SOURCE / "blender" / asset_id
    runtime_dir = SOURCE / "runtime" / asset_id
    return {
        "master": asset_dir / f"{asset_id}-dense-master.blend",
        "masterReport": REPORTS / f"{asset_id}-dense-master.json",
        "runtime": runtime_dir / f"{asset_id}-runtime-v1.glb",
        "sourceReport": runtime_dir / f"{asset_id}-runtime-v1.json",
        "mirrorReport": REPORTS / f"{asset_id}-runtime-v1.json",
    }


def glb_json(path: Path) -> dict[str, Any]:
    payload = path.read_bytes()
    require(payload[:4] == b"glTF", f"{path.name} is not a binary glTF")
    version, total = struct.unpack_from("<II", payload, 4)
    require(version == 2 and total == len(payload), f"{path.name} has invalid GLB framing")
    chunk_length, chunk_type = struct.unpack_from("<II", payload, 12)
    require(chunk_type == 0x4E4F534A, f"{path.name} has no leading JSON chunk")
    return json.loads(payload[20 : 20 + chunk_length].decode("utf-8"))


def glb_triangle_count(document: dict[str, Any]) -> int:
    accessors = document.get("accessors", [])
    total = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            require(primitive.get("mode", 4) == 4, "Runtime geometry must use triangles")
            accessor_index = primitive.get("indices")
            require(isinstance(accessor_index, int), "Runtime triangle mesh needs indices")
            count = int(accessors[accessor_index]["count"])
            require(count % 3 == 0, "Runtime index count is not divisible by three")
            total += count // 3
    return total


def glb_resource_budget(document: dict[str, Any]) -> dict[str, int]:
    buffer_views = document.get("bufferViews", [])
    images = document.get("images", [])
    image_buffer_views = {
        int(image["bufferView"])
        for image in images
        if isinstance(image.get("bufferView"), int)
    }
    image_bytes = sum(
        int(buffer_views[image["bufferView"]]["byteLength"])
        for image in images
        if isinstance(image.get("bufferView"), int)
    )
    decoded_meshopt_bytes = 0
    other_buffer_bytes = 0
    for index, view in enumerate(buffer_views):
        extension = view.get("extensions", {}).get("EXT_meshopt_compression")
        if extension:
            decoded_meshopt_bytes += int(extension["count"]) * int(extension["byteStride"])
        elif index not in image_buffer_views:
            other_buffer_bytes += int(view.get("byteLength", 0))
    return {
        "embeddedImageBytes": image_bytes,
        "meshoptDecodedBufferBytes": decoded_meshopt_bytes,
        "otherBufferBytes": other_buffer_bytes,
    }


def descendants(root: bpy.types.Object) -> Iterable[bpy.types.Object]:
    yield root
    for child in root.children:
        yield from descendants(child)


def keep_runtime_object(review: bpy.types.Object, root: bpy.types.Object) -> None:
    keep = set(descendants(root))
    require(review in keep, "Normalized review object must remain below runtime root")
    for current in list(bpy.data.objects):
        if current not in keep:
            bpy.data.objects.remove(current, do_unlink=True)
    for collection in list(bpy.data.collections):
        if collection.users == 0:
            bpy.data.collections.remove(collection)


def provider_material(review: bpy.types.Object) -> bpy.types.Material:
    require(review.type == "MESH", "Normalized review object must be a mesh")
    materials = [slot.material for slot in review.material_slots if slot.material]
    require(len(materials) == 1, "Static donor must keep exactly one provider material")
    material = materials[0]
    require(material.use_nodes and material.node_tree is not None, "Provider material needs nodes")
    return material


def principled_node(material: bpy.types.Material) -> bpy.types.Node:
    matches = [
        node for node in material.node_tree.nodes if node.bl_idname == "ShaderNodeBsdfPrincipled"
    ]
    require(len(matches) == 1, f"Material {material.name} needs one Principled BSDF")
    return matches[0]


def resize_images(asset_id: str, policy: dict[str, Any]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for role in ("base_color", "normal", "metallic", "roughness"):
        matches = [image for image in bpy.data.images if image.name == f"{asset_id}__{role}"]
        require(len(matches) == 1, f"Missing packed {role} image for {asset_id}")
        image = matches[0]
        before = [int(image.size[0]), int(image.size[1])]
        maximum = int(policy["color" if role == "base_color" else "data"])
        scale = min(1.0, maximum / max(before))
        after = [max(1, round(before[0] * scale)), max(1, round(before[1] * scale))]
        if after != before:
            image.scale(*after)
        image.pack()
        records.append({"role": role, "sourceDimensions": before, "runtimeDimensions": after})
    return records


def apply_material_policy(
    review: bpy.types.Object,
    config: dict[str, Any],
) -> list[str]:
    material = provider_material(review)
    material.name = f"{config['rootNode']}__provider_pbr"
    policy = config["material"]
    require(
        policy["kind"] in {"provider-pbr", "mirror"},
        "Fused provider materials must stay opaque until glass regions are audited and separated",
    )
    return [material.name]


def add_mirror_surface(root: bpy.types.Object, config: dict[str, Any]) -> str:
    material_name = config["material"]["surfaceMaterial"]
    material = bpy.data.materials.new(material_name)
    material.use_nodes = True
    shader = principled_node(material)
    base_color = shader.inputs.get("Base Color")
    metallic = shader.inputs.get("Metallic")
    roughness = shader.inputs.get("Roughness")
    require(
        base_color is not None and metallic is not None and roughness is not None,
        "Installed Blender Principled sockets do not match the mirror adapter",
    )
    base_color.default_value = (0.31, 0.45, 0.5, 1.0)
    metallic.default_value = 1.0
    roughness.default_value = 0.08
    mesh = bpy.data.meshes.new(f"{config['rootNode']}__mirror_geometry")
    half_width = 0.52
    half_height = 0.72
    mesh.from_pydata(
        [
            (-half_width, -half_height, 0.0),
            (half_width, -half_height, 0.0),
            (half_width, half_height, 0.0),
            (-half_width, half_height, 0.0),
        ],
        [],
        [[0, 1, 2, 3]],
    )
    mesh.materials.append(material)
    surface = bpy.data.objects.new(f"{config['rootNode']}__mirror_surface", mesh)
    bpy.context.scene.collection.objects.link(surface)
    surface.parent = root
    surface.location = (0.0, -0.008, 1.08)
    surface.rotation_euler.x = math.pi / 2
    return material_name


def contact_rectangles(contact: dict[str, Any]) -> list[dict[str, float]]:
    kind = contact["kind"]
    if kind == "rectangle":
        return [
            {
                "x": 0.0,
                "z": 0.0,
                "width": float(contact["width"]),
                "depth": float(contact["depth"]),
                "topY": float(contact["topY"]),
            }
        ]
    if kind in {"rectangles", "stairs"}:
        common_top = float(contact.get("topY", 0.0))
        return [
            {
                "x": float(row["x"]),
                "z": float(row["z"]),
                "width": float(row["width"]),
                "depth": float(row["depth"]),
                "topY": float(row.get("topY", common_top)),
            }
            for row in contact["rectangles"]
        ]
    return []


def certify_contact(
    review: bpy.types.Object,
    contact: dict[str, Any],
) -> dict[str, Any]:
    rectangles = contact_rectangles(contact)
    if not rectangles:
        return {
            "status": "resting-base-only",
            "sampleCount": 0,
            "statement": "No walkable surface is certified for this gallery object.",
        }
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = review.evaluated_get(depsgraph)
    tree = BVHTree.FromObject(evaluated, depsgraph)
    require(tree is not None, "Could not build contact BVH")
    inverse = review.matrix_world.inverted()
    normal_matrix = review.matrix_world.to_3x3().inverted().transposed()
    samples: list[dict[str, float]] = []
    failures: list[str] = []
    for rectangle_index, rectangle in enumerate(rectangles):
        for ix in range(CONTACT_SAMPLE_COUNT):
            for iz in range(CONTACT_SAMPLE_COUNT):
                # Cover the full declaration except for a one-percent numerical
                # inset. Bevels must be excluded by shrinking the declaration.
                span = 1.0 - 2.0 * CONTACT_EDGE_INSET_FRACTION
                u = -0.5 + CONTACT_EDGE_INSET_FRACTION + ix / (CONTACT_SAMPLE_COUNT - 1) * span
                v = -0.5 + CONTACT_EDGE_INSET_FRACTION + iz / (CONTACT_SAMPLE_COUNT - 1) * span
                runtime_x = rectangle["x"] + u * rectangle["width"]
                runtime_z = rectangle["z"] + v * rectangle["depth"]
                expected = rectangle["topY"]
                world_origin = Vector((runtime_x, -runtime_z, expected + 2.0))
                local_origin = inverse @ world_origin
                local_direction = (inverse.to_3x3() @ Vector((0.0, 0.0, -1.0))).normalized()
                hits: list[tuple[Vector, Vector]] = []
                remaining = 4.0
                cursor = local_origin
                for _ in range(32):
                    location, normal, _index, distance = tree.ray_cast(
                        cursor, local_direction, remaining
                    )
                    if location is None or normal is None or distance is None:
                        break
                    hits.append(
                        (
                            review.matrix_world @ location,
                            (normal_matrix @ normal).normalized(),
                        )
                    )
                    step = float(distance) + 0.0001
                    cursor = cursor + local_direction * step
                    remaining -= step
                    if remaining <= 0:
                        break
                require(hits, f"Contact sample missed rectangle {rectangle_index}")
                candidates = [
                    (location, normal)
                    for location, normal in hits
                    if abs(location.z - expected) <= CONTACT_HEIGHT_TOLERANCE
                    and normal.z >= CONTACT_UP_NORMAL_MINIMUM
                ]
                if not candidates:
                    closest = min(hits, key=lambda row: abs(row[0].z - expected))
                    failures.append(
                        f"rectangle {rectangle_index} at ({runtime_x:.6f}, {runtime_z:.6f}) has no upward support near datum; closest error {abs(closest[0].z - expected):.6f}m, signed up normal {closest[1].z:.6f}"
                    )
                    support_location, support_normal = closest
                else:
                    support_location, support_normal = min(
                        candidates, key=lambda row: abs(row[0].z - expected)
                    )
                error = abs(support_location.z - expected)
                visible_rise = max(0.0, hits[0][0].z - expected)
                if visible_rise > CONTACT_ORNAMENT_RISE_LIMIT:
                    failures.append(
                        f"rectangle {rectangle_index} at ({runtime_x:.6f}, {runtime_z:.6f}) has {visible_rise:.6f}m ornament above contact"
                    )
                samples.append(
                    {
                        "rectangle": rectangle_index,
                        "heightErrorMetres": round(error, 9),
                        "upNormal": round(support_normal.z, 9),
                        "visibleRiseAboveContactMetres": round(visible_rise, 9),
                    }
                )
    require(
        not failures,
        "Contact certification failed:\n" + "\n".join(failures[:24]),
    )
    return {
        "status": "certified-from-dense-runtime-geometry",
        "sampleCount": len(samples),
        "gridPerRectangle": [CONTACT_SAMPLE_COUNT, CONTACT_SAMPLE_COUNT],
        "edgeInsetFraction": CONTACT_EDGE_INSET_FRACTION,
        "maximumHeightErrorMetres": max(row["heightErrorMetres"] for row in samples),
        "minimumUpNormal": min(row["upNormal"] for row in samples),
        "upNormalMinimum": CONTACT_UP_NORMAL_MINIMUM,
        "maximumVisibleRiseAboveContactMetres": max(
            row["visibleRiseAboveContactMetres"] for row in samples
        ),
        "heightToleranceMetres": CONTACT_HEIGHT_TOLERANCE,
        "maximumOrnamentRiseMetres": CONTACT_ORNAMENT_RISE_LIMIT,
        "scope": "The declared rectangle union has upward-facing dense support near its contact datum across the sampled extent. Ornament may rise above the authored gameplay collider within the reported bound; visible overhangs remain non-colliding.",
    }


def geometry_record(review: bpy.types.Object) -> dict[str, Any]:
    mesh = review.data
    mesh.calc_loop_triangles()
    runtime_vertices = [
        Vector((world.x, world.z, -world.y))
        for vertex in mesh.vertices
        for world in [review.matrix_world @ vertex.co]
    ]
    minimum = [min(vertex[axis] for vertex in runtime_vertices) for axis in range(3)]
    maximum = [max(vertex[axis] for vertex in runtime_vertices) for axis in range(3)]
    spans = [maximum[axis] - minimum[axis] for axis in range(3)]
    return {
        "vertices": len(mesh.vertices),
        "triangles": len(mesh.loop_triangles),
        "polygons": len(mesh.polygons),
        "runtimeBoundsMetres": {
            "minimum": [round(value, 9) for value in minimum],
            "maximum": [round(value, 9) for value in maximum],
        },
        "positionQuantizationStepUpperBoundMetres": round(
            max(spans) / ((1 << MESHOPT_POSITION_BITS) - 1), 9
        ),
        "decimated": False,
        "remeshed": False,
    }


def export_runtime(
    output: Path,
    roots: Iterable[bpy.types.Object],
    texture_quality: int,
) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    for current in bpy.context.selected_objects:
        current.select_set(False)
    selected: set[bpy.types.Object] = set()
    for root in roots:
        selected.update(descendants(root))
    for current in selected:
        current.hide_set(False)
        current.hide_render = False
        current.select_set(True)
    require(MESHOPT.is_file(), f"Missing pinned glTF Transform CLI at {MESHOPT}")
    temporary_directory = Path(
        tempfile.mkdtemp(prefix=f".{output.stem}-", dir=output.parent)
    )
    uncompressed = temporary_directory / "blender.glb"
    compressed = temporary_directory / "meshopt.glb"
    try:
        result = bpy.ops.export_scene.gltf(
            filepath=str(uncompressed),
            check_existing=False,
            export_format="GLB",
            use_selection=True,
            export_extras=True,
            export_yup=True,
            export_apply=False,
            export_animations=False,
            export_cameras=False,
            export_lights=False,
            export_materials="EXPORT",
            export_texcoords=True,
            export_normals=True,
            export_tangents=True,
            export_image_format="WEBP",
            export_image_quality=texture_quality,
            export_image_add_webp=False,
            export_image_webp_fallback=False,
            export_unused_images=False,
        )
        require("FINISHED" in result, "Blender glTF export did not finish")
        subprocess.run(
            [
                str(MESHOPT),
                "meshopt",
                str(uncompressed),
                str(compressed),
                "--level",
                "high",
                "--quantization-volume",
                "mesh",
                "--quantize-position",
                str(MESHOPT_POSITION_BITS),
                "--quantize-normal",
                str(MESHOPT_NORMAL_BITS),
                "--quantize-texcoord",
                str(MESHOPT_TEXCOORD_BITS),
                "--quantize-generic",
                "14",
            ],
            cwd=REPO,
            check=True,
        )
        require(compressed.is_file(), "glTF Transform did not write a runtime GLB")
        os.replace(compressed, output)
    finally:
        shutil.rmtree(temporary_directory, ignore_errors=True)


def prepare(asset_id: str, full_textures: bool = False) -> dict[str, Any]:
    catalogue = load_catalogue()
    config = asset_config(catalogue, asset_id)
    paths = asset_paths(asset_id)
    require(paths["master"].is_file(), f"Missing packed master {paths['master']}")
    require(paths["masterReport"].is_file(), f"Missing dense report {paths['masterReport']}")
    dense_report = json.loads(paths["masterReport"].read_text(encoding="utf-8"))
    bpy.ops.wm.open_mainfile(filepath=str(paths["master"]))
    review_name = f"{asset_id}__normalized_review"
    review = bpy.data.objects.get(review_name)
    require(review is not None, f"Missing normalized review object {review_name}")
    geometry = geometry_record(review)
    require(
        geometry["triangles"] == dense_report["geometry"]["triangles"],
        "Dense master triangle count differs from its report",
    )
    contact_audit = certify_contact(review, config["contact"])
    root = bpy.data.objects.new(config["rootNode"], None)
    bpy.context.scene.collection.objects.link(root)
    root.location = (0.0, 0.0, 0.0)
    root.rotation_euler = (0.0, 0.0, 0.0)
    root.scale = (1.0, 1.0, 1.0)
    review.parent = root
    review.name = f"{config['rootNode']}__provider_detail"
    review.hide_render = False
    review.hide_set(False)
    material_names = apply_material_policy(review, config)
    if config["material"]["kind"] == "mirror":
        material_names.append(add_mirror_surface(root, config))
    keep_runtime_object(review, root)
    policy = dict(config["textures"])
    if full_textures:
        policy["color"] = 8192
        policy["data"] = 4096
    texture_records = resize_images(asset_id, policy)
    metadata = {
        "schema": "cloudway-lab-static-v1",
        "assetId": asset_id,
        "kind": config["kind"],
        "coordinates": {
            "upAxis": "+Y",
            "units": "metres",
            "origin": "landing-or-resting-datum",
        },
        "contact": config["contact"],
        "material": config["material"],
        "source": {
            "denseMaster": logical_path(paths["master"]),
            "denseMasterSha256": digest(paths["master"]),
            "donorSha256": dense_report["source"]["sha256"],
        },
        "geometry": geometry,
        "textures": texture_records,
    }
    root[catalogue["metadataKey"]] = json.dumps(metadata, separators=(",", ":"))
    contact = config["contact"]
    if contact["kind"] == "rectangle":
        root["collider_json"] = json.dumps(
            {
                "shape": "box",
                "width": contact["width"],
                "depth": contact["depth"],
                "height": contact["height"],
                "topY": contact["topY"],
                "center": [0, -contact["height"] / 2, 0],
            },
            separators=(",", ":"),
        )
    output = paths["runtime"]
    if full_textures:
        output = output.with_name(f"{asset_id}-runtime-v1-full-textures.glb")
    export_runtime(output, [root], int(policy["quality"]))
    document = glb_json(output)
    required_extensions = sorted(document.get("extensionsRequired", []))
    require("EXT_meshopt_compression" in required_extensions, "Runtime export is not meshopt compressed")
    require(
        glb_triangle_count(document) == geometry["triangles"],
        "Runtime compression changed the dense triangle count",
    )
    resource_budget = glb_resource_budget(document)
    texture_by_role = {record["role"]: record for record in texture_records}
    # glTF packs metallic + roughness into one texture. The browser uploads the
    # base color, normal and packed metallic/roughness images independently.
    uploaded_texture_roles = ("base_color", "normal", "metallic")
    base_level_texture_bytes = sum(
        int(texture_by_role[role]["runtimeDimensions"][0])
        * int(texture_by_role[role]["runtimeDimensions"][1])
        * 4
        for role in uploaded_texture_roles
    )
    report = {
        "schema": 1,
        "assetId": asset_id,
        "status": "runtime export prepared; live-render acceptance pending",
        "scope": "Dense topology is preserved. Runtime textures are bounded derivatives; archived full maps and packed master remain unchanged.",
        "source": metadata["source"],
        "runtime": {
            "file": logical_path(output),
            "bytes": output.stat().st_size,
            "sha256": digest(output),
            "bundleId": config["bundleId"],
            "rootNode": config["rootNode"],
            "requiredExtensions": required_extensions,
            "materialNames": material_names,
            "resourceBudget": {
                **resource_budget,
                "estimatedRgba8BaseLevelTextureBytes": base_level_texture_bytes,
                "estimatedRgba8MipmappedTextureBytes": math.ceil(
                    base_level_texture_bytes * 4 / 3
                ),
                "scope": "Texture estimates include base color, normal and packed metallic/roughness. Browser residency is measured separately.",
            },
        },
        "geometry": geometry,
        "textures": {
            "policy": policy,
            "images": texture_records,
            "sourceMapsUnchanged": True,
        },
        "compression": {
            "method": "EXT_meshopt_compression",
            "level": "high",
            "quantizationVolume": "mesh",
            "positionBits": MESHOPT_POSITION_BITS,
            "normalBits": MESHOPT_NORMAL_BITS,
            "texcoordBits": MESHOPT_TEXCOORD_BITS,
            "triangleCountPreserved": True,
        },
        "contact": {"declaration": contact, "audit": contact_audit},
        "rebuild": (
            "rtk proxy flock -w 1200 /tmp/glass-cloudway-blender.lock timeout 1200 "
            "env ALSOFT_DRIVERS=null /usr/bin/blender --background --factory-startup "
            "--python-exit-code 1 --python art/glass-adventure/cloudway-laboratory/v1/production/prepare_static_runtime.py "
            f"-- --asset {asset_id}"
        ),
    }
    if not full_textures:
        durable_json(paths["sourceReport"], report)
        durable_json(paths["mirrorReport"], report)
    print(json.dumps(report, indent=2))
    return report


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", required=True)
    parser.add_argument("--full-textures", action="store_true")
    return parser.parse_args(os.sys.argv[os.sys.argv.index("--") + 1 :] if "--" in os.sys.argv else [])


if __name__ == "__main__":
    options = arguments()
    prepare(options.asset, options.full_textures)
