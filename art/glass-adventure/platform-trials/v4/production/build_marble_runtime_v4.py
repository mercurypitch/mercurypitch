"""Reproduce the rejected fitted Cloudway V4 90k projection candidate.

The 90k remesh supplies runtime topology.  The immutable 1.256M-triangle donor
supplies interpolated split normals and the selected-to-active PBR bake.  Both
texture variants export the same fitted mesh and exact landing boundary; only
the base/normal map resolution differs. Direct execution is redirected into
explicit rejected/reproduction paths so it cannot overwrite canonical V4 work;
imports retain the historical constants used by shared helper functions.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import struct
import sys
from typing import Any

import bpy
from mathutils import Vector
import numpy as np
from PIL import Image as PILImage


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import marble_runtime_common as COMMON  # noqa: E402


TEXTURES = COMMON.V4 / "sources" / "marble-runtime-textures"
SOURCE_BLEND = COMMON.V4 / "sources" / "cloudway-platform-kit-v4.blend"
BUILD_REPORT = COMMON.V4 / "production" / "cloudway-marble-runtime-v4-build.json"
RAW_4K = COMMON.V4 / "exports" / "cloudway-marble-ultra-v4-4k-blender.glb"
RAW_2K = COMMON.V4 / "exports" / "cloudway-marble-ultra-v4-2k-blender.glb"
REMESH_REVIEW = COMMON.V4 / "proofs" / "marble-runtime-remesh-review.json"

ROOT_NAMES = [
    "Cloudway_Marble",
    "Cloudway_Frost",
    "Cloudway_Glide",
    "Cloudway_Crackle_Intact",
    "Cloudway_Crackle_Warning",
    "Cloudway_Crackle_Release",
]
ROOT_NAME = ROOT_NAMES[0]
SHELL_NAME = ROOT_NAME + "__DonorShell"
BOUNDARY_NAME = ROOT_NAME + "__LandingBoundary"
MATERIAL_NAME = ROOT_NAME + "__DenseBakePBR"

SOURCE_TEXTURES = {
    "baseColor": COMMON.V4 / "meshy" / "marble-ultra4k" / "textures" / "set-0-base_color.png",
    "normal": COMMON.V4 / "meshy" / "marble-ultra4k" / "textures" / "set-0-normal.png",
    "metallic": COMMON.V4 / "meshy" / "marble-ultra4k" / "textures" / "set-0-metallic.png",
    "roughness": COMMON.V4 / "meshy" / "marble-ultra4k" / "textures" / "set-0-roughness.png",
}
MAPS = {
    "base4k": TEXTURES / "cloudway-marble-v4-base-4k.png",
    "normal4k": TEXTURES / "cloudway-marble-v4-normal-4k.png",
    "ao2k": TEXTURES / "cloudway-marble-v4-ao-2k.png",
    "metallic2k": TEXTURES / "cloudway-marble-v4-metallic-2k.png",
    "roughness2k": TEXTURES / "cloudway-marble-v4-roughness-2k.png",
    "orm2k": TEXTURES / "cloudway-marble-v4-orm-2k.png",
    "base2k": TEXTURES / "cloudway-marble-v4-base-2k.png",
    "normal2k": TEXTURES / "cloudway-marble-v4-normal-2k.png",
}


def configure_rejected_reproduction_outputs() -> None:
    """Redirect direct legacy execution away from every canonical V4 output."""

    global TEXTURES, SOURCE_BLEND, BUILD_REPORT, RAW_4K, RAW_2K, MAPS
    reproduction = COMMON.V4 / "sources" / "rejected" / "reproduction-90k-projection"
    TEXTURES = reproduction / "marble-runtime-textures"
    SOURCE_BLEND = reproduction / "cloudway-platform-kit-v4-90k-projection-reproduction.blend"
    BUILD_REPORT = (
        COMMON.V4
        / "production"
        / "rejected"
        / "reproduction-90k-projection"
        / "cloudway-marble-runtime-v4-build.json"
    )
    RAW_4K = (
        COMMON.V4
        / "exports"
        / "rejected"
        / "reproduction-90k-projection"
        / "cloudway-marble-ultra-v4-4k-blender.glb"
    )
    RAW_2K = (
        COMMON.V4
        / "exports"
        / "rejected"
        / "reproduction-90k-projection"
        / "cloudway-marble-ultra-v4-2k-blender.glb"
    )
    MAPS = {
        "base4k": TEXTURES / "cloudway-marble-v4-base-4k.png",
        "normal4k": TEXTURES / "cloudway-marble-v4-normal-4k.png",
        "ao2k": TEXTURES / "cloudway-marble-v4-ao-2k.png",
        "metallic2k": TEXTURES / "cloudway-marble-v4-metallic-2k.png",
        "roughness2k": TEXTURES / "cloudway-marble-v4-roughness-2k.png",
        "orm2k": TEXTURES / "cloudway-marble-v4-orm-2k.png",
        "base2k": TEXTURES / "cloudway-marble-v4-base-2k.png",
        "normal2k": TEXTURES / "cloudway-marble-v4-normal-2k.png",
    }

BAKE_THREADS = 8
CAGE_EXTRUSION = 0.018
MAX_RAY_DISTANCE = 0.075


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    return COMMON.descendants(root)


def delete_tree(root: bpy.types.Object) -> None:
    for obj in reversed(descendants(root)):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.objects.remove(root, do_unlink=True)


def set_selected(objects: list[bpy.types.Object], active: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active


def file_record(path: Path, dimensions: list[int] | None = None) -> dict[str, object]:
    row: dict[str, object] = {
        "file": COMMON.relative(path),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
    }
    if dimensions is not None:
        row["dimensions"] = dimensions
    return row


def validate_inputs() -> dict[str, object]:
    if digest(COMMON.DENSE) != COMMON.EXPECTED_DENSE_SHA256:
        raise ValueError("Immutable dense donor hash changed")
    if digest(COMMON.REMESH) != COMMON.EXPECTED_REMESH_SHA256:
        raise ValueError("Archived 90k remesh hash changed")
    review = json.loads(REMESH_REVIEW.read_text())
    if review.get("decision") != "accepted-for-high-to-low-bake":
        raise ValueError("Matched-envelope remesh review is not accepted for the bake")
    receipt = json.loads(COMMON.REMESH_RECEIPT.read_text())
    if (
        receipt.get("state") != "archived"
        or receipt.get("file", {}).get("sha256") != COMMON.EXPECTED_REMESH_SHA256
        or int(receipt.get("file", {}).get("triangles", -1)) != COMMON.EXPECTED_REMESH_TRIANGLES
    ):
        raise ValueError("Archived remesh receipt no longer matches the candidate")
    source_maps = {}
    expected_sizes = {
        "baseColor": (4096, 4096),
        "normal": (4096, 4096),
        "metallic": (2048, 2048),
        "roughness": (2048, 2048),
    }
    for role, path in SOURCE_TEXTURES.items():
        with PILImage.open(path) as image:
            if image.size != expected_sizes[role]:
                raise ValueError(f"{role} source dimensions changed: {image.size}")
            dimensions = list(image.size)
        source_maps[role] = file_record(path, dimensions)
    return {
        "denseSha256": digest(COMMON.DENSE),
        "remeshSha256": digest(COMMON.REMESH),
        "remeshReceipt": COMMON.relative(COMMON.REMESH_RECEIPT),
        "remeshReview": COMMON.relative(REMESH_REVIEW),
        "sourceMaps": source_maps,
    }


def flatten_landing(obj: bpy.types.Object) -> dict[str, object]:
    selected: set[int] = set()
    for polygon in obj.data.polygons:
        centre = polygon.center
        if polygon.normal.z <= 0.72:
            continue
        if abs(centre.x) > COMMON.LANDING_WIDTH / 2 or abs(centre.y) > COMMON.LANDING_DEPTH / 2:
            continue
        if abs(centre.z) > 0.040:
            continue
        for vertex_index in polygon.vertices:
            vertex = obj.data.vertices[vertex_index]
            if (
                abs(vertex.co.x) <= COMMON.LANDING_WIDTH / 2 + 0.012
                and abs(vertex.co.y) <= COMMON.LANDING_DEPTH / 2 + 0.012
                and abs(vertex.co.z) <= 0.060
            ):
                selected.add(vertex_index)
    if not selected:
        raise ValueError("No broad remesh landing vertices selected")
    before = [float(obj.data.vertices[index].co.z) for index in selected]
    for index in selected:
        obj.data.vertices[index].co.z = 0.0
    obj.data.update()
    obj["landingFlattened"] = True
    obj["landingFlattenedVertexCount"] = len(selected)
    obj["landingFlattenTargetZ"] = 0.0
    return {
        "method": (
            "Flatten only vertices on broad upward-facing remesh polygons inside the exact "
            "1.70 x 1.30 metre landing and within 6cm of the sampled datum; preserve UVs, "
            "silhouette geometry, ornament and the exposed donor artwork."
        ),
        "flattenedVertices": len(selected),
        "selectedHeightRangeBeforeMetres": [round(min(before), 6), round(max(before), 6)],
        "targetBlenderZ": 0.0,
    }


def landing_contact_measurements(obj: bpy.types.Object) -> dict[str, object]:
    zones: dict[str, dict[str, object]] = {
        "all": {"heights": [], "area": 0.0},
        "center": {"heights": [], "area": 0.0},
        "edge": {"heights": [], "area": 0.0},
    }
    for polygon in obj.data.polygons:
        centre = polygon.center
        if polygon.normal.z <= 0.72:
            continue
        if abs(centre.x) > COMMON.LANDING_WIDTH / 2 or abs(centre.y) > COMMON.LANDING_DEPTH / 2:
            continue
        heights = [float(obj.data.vertices[index].co.z) for index in polygon.vertices]
        if max(abs(value) for value in heights) > 0.01:
            continue
        memberships = ["all"]
        if abs(centre.x) <= 0.55 and abs(centre.y) <= 0.40:
            memberships.append("center")
        if abs(centre.x) >= 0.70 or abs(centre.y) >= 0.50:
            memberships.append("edge")
        for zone in memberships:
            zones[zone]["heights"].extend(heights)
            zones[zone]["area"] = float(zones[zone]["area"]) + polygon.area
    result = {}
    for name, values in zones.items():
        heights = list(values["heights"])
        if not heights:
            raise ValueError(f"Runtime marble has no {name} contact samples")
        maximum = max(abs(value) for value in heights)
        if maximum > 0.01:
            raise ValueError(f"Runtime marble {name} contact misses datum by {maximum:.6f}m")
        result[name] = {
            "sampleCount": len(heights),
            "upwardAreaSquareMetres": round(float(values["area"]), 6),
            "heightRangeMetres": [round(min(heights), 6), round(max(heights), 6)],
            "maxAbsoluteErrorMetres": round(maximum, 6),
        }
    if float(zones["all"]["area"]) < 1.70:
        raise ValueError(f"Broad landing contact area is too small: {zones['all']['area']}")
    return result


def transfer_dense_normals(low: bpy.types.Object, high: bpy.types.Object) -> dict[str, object]:
    original_normals = [corner.vector.copy() for corner in low.data.corner_normals]
    for polygon in low.data.polygons:
        polygon.use_smooth = True
    modifier = low.modifiers.new("V4_DenseDonor_SplitNormalTransfer", "DATA_TRANSFER")
    modifier.object = high
    modifier.use_loop_data = True
    modifier.data_types_loops = {"CUSTOM_NORMAL"}
    modifier.loop_mapping = "POLYINTERP_NEAREST"
    modifier.mix_mode = "REPLACE"
    modifier.mix_factor = 1.0
    set_selected([low], low)
    result = bpy.ops.object.modifier_apply(modifier=modifier.name)
    if "FINISHED" not in result:
        raise RuntimeError(f"Dense normal transfer did not finish: {result}")
    low.data.update()
    transferred_normals = [corner.vector.copy() for corner in low.data.corner_normals]
    if not transferred_normals or any(
        not all(math.isfinite(value) for value in normal) for normal in transferred_normals
    ):
        raise ValueError("Dense normal transfer produced invalid corner normals")
    if len(original_normals) != len(transferred_normals):
        raise ValueError("Dense normal transfer changed the low-mesh corner count")

    # Nearest-polygon transfer alone can select a leaf, carving side or arch
    # underside where several source sheets overlap. Keep the donor direction
    # only when it agrees with the remesh corner hemisphere. On the vertices
    # already flattened for gameplay contact, the mathematically correct normal
    # is exact +Z; detail is supplied by the selected-to-active texture normal.
    loop_polygons = {
        loop_index: polygon
        for polygon in low.data.polygons
        for loop_index in polygon.loop_indices
    }
    flattened_upward_polygons = {
        polygon.index
        for polygon in low.data.polygons
        if polygon.normal.z > 0.999
        and all(abs(low.data.vertices[index].co.z) <= 1e-7 for index in polygon.vertices)
    }
    corrected: list[Vector] = []
    rejected = 0
    blended = 0
    contact_up = 0
    upward_preserved = 0
    original_face_rejected = 0
    donor_face_rejected = 0
    minimum_raw_dot = 1.0
    minimum_face_gated_dot = 1.0
    minimum_selected_face_dot = 1.0
    for loop, original, transferred in zip(
        low.data.loops, original_normals, transferred_normals, strict=True
    ):
        original.normalize()
        transferred.normalize()
        minimum_raw_dot = min(minimum_raw_dot, float(original.dot(transferred)))
        polygon = loop_polygons[loop.index]
        face = polygon.normal.copy().normalized()
        if original.dot(face) <= 0.001:
            original = face.copy()
            original_face_rejected += 1
        if transferred.dot(face) <= 0.001:
            transferred = face.copy()
            donor_face_rejected += 1
        dot = float(original.dot(transferred))
        minimum_face_gated_dot = min(minimum_face_gated_dot, dot)
        if polygon.index in flattened_upward_polygons:
            selected = Vector((0.0, 0.0, 1.0))
            contact_up += 1
        elif original.z >= 0.72:
            # The raw remesh already has stable upper-hemisphere shading. A
            # nearest dense face here can be an overlapping leaf or carving
            # wall, so preserve the remesh direction outside exact contact.
            selected = original
            upward_preserved += 1
        elif dot < 0.55:
            selected = original
            rejected += 1
        elif dot < 0.85:
            # Fade continuously from the remesh direction at the rejection
            # boundary to the donor direction once correspondence is strong.
            donor_weight = (dot - 0.55) / 0.30
            selected = original.lerp(transferred, donor_weight).normalized()
            blended += 1
        else:
            selected = transferred
        selected_face_dot = float(selected.dot(face))
        if selected_face_dot <= 0.0:
            raise ValueError(
                f"Split-normal correction retained a backwards corner at loop {loop.index}: "
                f"N.face={selected_face_dot}"
            )
        minimum_selected_face_dot = min(minimum_selected_face_dot, selected_face_dot)
        corrected.append(selected)
    low.data.normals_split_custom_set(corrected)
    low.data.update()
    return {
        "method": (
            "nearest dense-donor polygon interpolation with remesh-hemisphere compatibility; "
            "replace both remesh and donor candidates that oppose the geometric polygon normal; "
            "reject donor directions below dot 0.55, blend dot 0.55-0.85, retain strong matches, "
            "and use exact +Z for every loop of fully flattened upward gameplay polygons"
        ),
        "source": high.name,
        "target": low.name,
        "cornerCount": len(corrected),
        "exactContactUpCorners": contact_up,
        "flattenedUpwardPolygons": len(flattened_upward_polygons),
        "upwardRemeshNormalsPreserved": upward_preserved,
        "originalFaceOpposedCornersRejected": original_face_rejected,
        "donorFaceOpposedCornersRejected": donor_face_rejected,
        "orientationRejectedCorners": rejected,
        "orientationBlendedCorners": blended,
        "minimumRawOrientationDot": minimum_raw_dot,
        "minimumFaceGatedOrientationDot": minimum_face_gated_dot,
        "minimumSelectedPolygonNormalDot": minimum_selected_face_dot,
        "allFinite": True,
        "positionsIndicesAndUvsChanged": False,
    }


def validate_corner_normal_basis(mesh: bpy.types.Mesh) -> dict[str, object]:
    invalid = []
    minimum_dot = 1.0
    maximum_length_error = 0.0
    flattened_upward_corners = 0
    flattened_upward_not_exact = 0
    for polygon in mesh.polygons:
        face = polygon.normal.copy().normalized()
        flattened_upward = polygon.normal.z > 0.999 and all(
            abs(mesh.vertices[index].co.z) <= 1e-7 for index in polygon.vertices
        )
        for loop_index in polygon.loop_indices:
            normal = mesh.corner_normals[loop_index].vector.copy()
            length = normal.length
            maximum_length_error = max(maximum_length_error, abs(length - 1.0))
            if length <= 1e-12 or not all(math.isfinite(value) for value in normal):
                invalid.append({"loop": loop_index, "reason": "non-finite-or-zero"})
                continue
            normal.normalize()
            dot = float(normal.dot(face))
            minimum_dot = min(minimum_dot, dot)
            if dot <= 0.0:
                invalid.append({"loop": loop_index, "polygon": polygon.index, "normalDotFace": dot})
            if flattened_upward:
                flattened_upward_corners += 1
                if normal.dot(Vector((0.0, 0.0, 1.0))) < 0.999999:
                    flattened_upward_not_exact += 1
    if invalid or flattened_upward_not_exact:
        raise ValueError(
            "Runtime split-normal basis failed its polygon-hemisphere gate: "
            f"invalid={len(invalid)}, flattenedNotUp={flattened_upward_not_exact}"
        )
    return {
        "cornerCount": len(mesh.loops),
        "backwardsOrInvalidCorners": len(invalid),
        "minimumNormalDotGeometricFace": minimum_dot,
        "maximumNormalUnitError": maximum_length_error,
        "flattenedUpwardCorners": flattened_upward_corners,
        "flattenedUpwardCornersNotExactUp": flattened_upward_not_exact,
    }


def repair_blender_tangent_singularities(mesh: bpy.types.Mesh) -> dict[str, object]:
    uv = mesh.uv_layers.active
    if uv is None:
        raise ValueError("Runtime low mesh has no active UV0")
    mesh.calc_tangents(uvmap=uv.name)
    bad = [index for index, loop in enumerate(mesh.loops) if loop.tangent.length <= 1e-6]
    mesh.free_tangents()
    if not bad:
        return {"method": "none-needed", "repairedCorners": [], "remainingZeroTangents": 0}
    loop_polygons = {
        loop_index: polygon
        for polygon in mesh.polygons
        for loop_index in polygon.loop_indices
    }
    normals = [corner.vector.copy() for corner in mesh.corner_normals]
    repairs = []
    for loop_index in bad:
        polygon = loop_polygons[loop_index]
        before = list(normals[loop_index])
        normals[loop_index] = polygon.normal.copy().normalized()
        repairs.append(
            {
                "loop": loop_index,
                "polygon": polygon.index,
                "normalBefore": before,
                "normalAfter": list(normals[loop_index]),
            }
        )
    mesh.normals_split_custom_set(normals)
    mesh.update()
    mesh.calc_tangents(uvmap=uv.name)
    remaining = sum(loop.tangent.length <= 1e-6 for loop in mesh.loops)
    maximum_error = max(abs(loop.tangent.length - 1.0) for loop in mesh.loops)
    mesh.free_tangents()
    return {
        "method": (
            "Replace only singular corner normals with the corresponding polygon normal, then "
            "regenerate tangent space; positions, indices and UVs remain unchanged."
        ),
        "repairedCorners": repairs,
        "remainingZeroTangents": remaining,
        "maximumTangentUnitError": maximum_error,
        "postExportFallbackRequired": remaining > 0,
    }


def load_source_images() -> tuple[dict[str, bpy.types.Image], dict[str, bpy.types.Node]]:
    images = {}
    for role, path in SOURCE_TEXTURES.items():
        image = bpy.data.images.load(str(path), check_existing=False)
        image.name = f"Cloudway_Marble_V4_Source_{role}"
        image.colorspace_settings.name = "sRGB" if role == "baseColor" else "Non-Color"
        images[role] = image
    return images, {}


def high_material(images: dict[str, bpy.types.Image]) -> tuple[bpy.types.Material, dict[str, bpy.types.Node]]:
    material = bpy.data.materials.new("Cloudway_Marble_V4_DenseBakeSource")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    links = material.node_tree.links
    output = nodes.new("ShaderNodeOutputMaterial")
    output.name = "Bake Source Output"
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.name = "Bake Source Principled"
    image_nodes = {}
    for role, image in images.items():
        node = nodes.new("ShaderNodeTexImage")
        node.name = f"Bake Source {role}"
        node.image = image
        image_nodes[role] = node
    links.new(image_nodes["baseColor"].outputs["Color"], principled.inputs["Base Color"])
    links.new(image_nodes["metallic"].outputs["Color"], principled.inputs["Metallic"])
    links.new(image_nodes["roughness"].outputs["Color"], principled.inputs["Roughness"])
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.name = "Bake Source Normal Map"
    links.new(image_nodes["normal"].outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    return material, {"output": output, "principled": principled, **image_nodes}


def select_high_output(material: bpy.types.Material, nodes: dict[str, bpy.types.Node], role: str) -> None:
    links = material.node_tree.links
    output = nodes["output"]
    for link in list(output.inputs["Surface"].links):
        links.remove(link)
    if role == "normal":
        links.new(nodes["principled"].outputs["BSDF"], output.inputs["Surface"])
        return
    emission = material.node_tree.nodes.get("Bake Source Emission")
    if emission is None:
        emission = material.node_tree.nodes.new("ShaderNodeEmission")
        emission.name = "Bake Source Emission"
    for link in list(emission.inputs["Color"].links):
        links.remove(link)
    links.new(nodes[role].outputs["Color"], emission.inputs["Color"])
    links.new(emission.outputs["Emission"], output.inputs["Surface"])


def bake_map(
    low: bpy.types.Object,
    high: bpy.types.Object,
    target_material: bpy.types.Material,
    source_material: bpy.types.Material,
    source_nodes: dict[str, bpy.types.Node],
    role: str,
    bake_type: str,
    path: Path,
    size: int,
    samples: int,
) -> dict[str, object]:
    select_high_output(source_material, source_nodes, role)
    image = bpy.data.images.new(
        f"Cloudway_Marble_V4_Bake_{role}_{size}",
        width=size,
        height=size,
        alpha=False,
        float_buffer=False,
    )
    image.generated_color = (0.5, 0.5, 1.0, 1.0) if role == "normal" else (0.0, 0.0, 0.0, 1.0)
    image.colorspace_settings.name = "sRGB" if role == "baseColor" else "Non-Color"
    target = target_material.node_tree.nodes.new("ShaderNodeTexImage")
    target.name = f"Bake Target {role}"
    target.image = image
    target_material.node_tree.nodes.active = target

    high.hide_render = False
    high.hide_set(False)
    set_selected([high, low], low)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.render.threads_mode = "FIXED"
    scene.render.threads = BAKE_THREADS
    settings = scene.render.bake
    settings.use_selected_to_active = True
    settings.use_clear = True
    settings.margin = 32 if size == 4096 else 20
    settings.cage_extrusion = CAGE_EXTRUSION
    settings.max_ray_distance = MAX_RAY_DISTANCE
    if bake_type == "NORMAL":
        settings.normal_space = "TANGENT"
    result = bpy.ops.object.bake(type=bake_type)
    if "FINISHED" not in result:
        raise RuntimeError(f"Blender {role} bake did not finish: {result}")
    path.parent.mkdir(parents=True, exist_ok=True)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    image.pack()
    target_material.node_tree.nodes.remove(target)
    high.hide_render = True
    high.hide_set(True)

    with PILImage.open(path) as opened:
        rgb = opened.convert("RGB")
        pixels = np.asarray(rgb, dtype=np.uint8)
        variation = float(pixels.reshape(-1, 3).std(axis=0).max())
        channel_range = [int(pixels.min()), int(pixels.max())]
        dimensions = list(rgb.size)
    if dimensions != [size, size] or variation < 0.25:
        raise ValueError(f"{role} bake is blank or has the wrong dimensions: {dimensions}")
    return {
        **file_record(path, dimensions),
        "bakeType": bake_type,
        "samples": samples,
        "marginPixels": settings.margin,
        "channelRange": channel_range,
        "maximumChannelStandardDeviation": round(variation, 4),
    }


def resize_base(source: Path, output: Path) -> dict[str, object]:
    with PILImage.open(source) as opened:
        image = opened.convert("RGB").resize((2048, 2048), PILImage.Resampling.LANCZOS)
        image.save(output, format="PNG", optimize=True)
    return file_record(output, [2048, 2048])


def resize_normal(source: Path, output: Path) -> dict[str, object]:
    with PILImage.open(source) as opened:
        resized = opened.convert("RGB").resize((2048, 2048), PILImage.Resampling.LANCZOS)
    values = np.asarray(resized, dtype=np.float32) / 127.5 - 1.0
    values /= np.maximum(np.linalg.norm(values, axis=2, keepdims=True), 1e-8)
    encoded = np.clip(np.round((values + 1.0) * 127.5), 0, 255).astype(np.uint8)
    PILImage.fromarray(encoded, "RGB").save(output, format="PNG", optimize=True)
    return {
        **file_record(output, [2048, 2048]),
        "method": "Lanczos3 resize followed by per-texel tangent-vector renormalization",
    }


def build_orm() -> dict[str, object]:
    with PILImage.open(MAPS["ao2k"]) as ao_image:
        ao = np.asarray(ao_image.convert("L"), dtype=np.uint8)
    with PILImage.open(MAPS["roughness2k"]) as rough_image:
        roughness = np.asarray(rough_image.convert("L"), dtype=np.uint8)
    with PILImage.open(MAPS["metallic2k"]) as metal_image:
        metallic = np.asarray(metal_image.convert("L"), dtype=np.uint8)
    orm = np.stack((ao, roughness, metallic), axis=2)
    PILImage.fromarray(orm, "RGB").save(MAPS["orm2k"], format="PNG", optimize=True)
    return {
        **file_record(MAPS["orm2k"], [2048, 2048]),
        "channels": {"red": "ambient occlusion", "green": "roughness", "blue": "metallic"},
    }


def make_runtime_material(base: Path, normal: Path, orm: Path) -> bpy.types.Material:
    material = bpy.data.materials.get(MATERIAL_NAME) or bpy.data.materials.new(MATERIAL_NAME)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    links = material.node_tree.links
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Principled BSDF"
    base_node = nodes.new("ShaderNodeTexImage")
    base_node.name = "Runtime Base Color"
    base_node.image = load_runtime_image(base, base.stem, "sRGB")
    links.new(base_node.outputs["Color"], shader.inputs["Base Color"])
    orm_node = nodes.new("ShaderNodeTexImage")
    orm_node.name = "Runtime ORM"
    orm_node.image = load_runtime_image(orm, orm.stem, "Non-Color")
    separate = nodes.new("ShaderNodeSeparateColor")
    links.new(orm_node.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], shader.inputs["Roughness"])
    links.new(separate.outputs["Blue"], shader.inputs["Metallic"])
    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.name = "Runtime Dense-Bake Normal"
    normal_node.image = load_runtime_image(normal, normal.stem, "Non-Color")
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 1.0
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    material.diffuse_color = (0.72, 0.70, 0.65, 1.0)
    material["source"] = "selected-to-active dense-donor bake"
    return material


def load_runtime_image(path: Path, name: str, color_space: str) -> bpy.types.Image:
    current = bpy.data.images.get(name)
    if current is not None:
        bpy.data.images.remove(current, do_unlink=True)
    image = bpy.data.images.load(str(path), check_existing=False)
    image.name = name
    image.colorspace_settings.name = color_space
    image.pack()
    return image


def boundary_material() -> bpy.types.Material:
    material = bpy.data.materials.new("Cloudway_Shared_Gold_V4")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.76, 0.45, 0.13, 1.0)
    shader.inputs["Metallic"].default_value = 0.86
    shader.inputs["Roughness"].default_value = 0.20
    return material


def exact_boundary(root: bpy.types.Object, material: bpy.types.Material) -> bpy.types.Object:
    outer = (COMMON.LANDING_WIDTH, COMMON.LANDING_DEPTH)
    inner = (1.62, 1.22)
    top = 0.004
    bottom = -0.006

    def corners(width: float, depth: float, z: float) -> list[tuple[float, float, float]]:
        return [
            (-width / 2, -depth / 2, z),
            (width / 2, -depth / 2, z),
            (width / 2, depth / 2, z),
            (-width / 2, depth / 2, z),
        ]

    vertices = corners(*outer, top) + corners(*inner, top) + corners(*outer, bottom) + corners(*inner, bottom)
    faces = []
    for index in range(4):
        following = (index + 1) % 4
        faces.extend(
            [
                (index, following, 4 + following, 4 + index),
                (8 + following, 8 + index, 12 + index, 12 + following),
                (index, 8 + index, 8 + following, following),
                (4 + following, 12 + following, 12 + index, 4 + index),
            ]
        )
    mesh = bpy.data.meshes.new(BOUNDARY_NAME + "__Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    boundary = bpy.data.objects.new(BOUNDARY_NAME, mesh)
    bpy.context.scene.collection.objects.link(boundary)
    boundary.parent = root
    boundary.data.materials.append(material)
    boundary["purpose"] = "exact gameplay landing boundary; exposed marble artwork remains visible"
    boundary["supporting"] = False
    return boundary


def gltf_bounds(objects: list[bpy.types.Object]) -> dict[str, list[float]]:
    low, high = COMMON.object_bounds(objects)
    return {
        "min": [round(low.x, 6), round(low.z, 6), round(-high.y, 6)],
        "max": [round(high.x, 6), round(high.z, 6), round(-low.y, 6)],
    }


def configure_root(root: bpy.types.Object, low: bpy.types.Object, boundary: bpy.types.Object) -> dict[str, object]:
    triangles = COMMON.triangle_count(low.data) + COMMON.triangle_count(boundary.data)
    visual = gltf_bounds([low, boundary])
    root["assetId"] = "cloudway-platform-kit-v4-review"
    root["platformFamily"] = "marble"
    root["state"] = "static"
    root["units"] = "metres"
    root["upAxis"] = "+Y"
    root["origin"] = "top-centre of sampled donor landing datum"
    root["landingPlaneY"] = 0.0
    root["landing_json"] = json.dumps(
        {
            "min": [-0.85, 0.0, -0.65],
            "max": [0.85, 0.0, 0.65],
            "width": 1.70,
            "depth": 1.30,
            "edgeSemantics": (
                "exact gold boundary marks gameplay support; dense-baked marble surface remains "
                "visible at the landing datum"
            ),
        },
        separators=(",", ":"),
    )
    root["collider_json"] = json.dumps(
        {
            "shape": "box",
            "width": 1.70,
            "depth": 1.30,
            "height": 0.24,
            "topY": 0.0,
            "center": [0.0, -0.12, 0.0],
        },
        separators=(",", ":"),
    )
    root["visual_bounds_json"] = json.dumps(visual, separators=(",", ":"))
    root["triangles"] = triangles
    return {
        "root": root.name,
        "descendantMeshes": [low.name, boundary.name],
        "triangles": triangles,
        "landingBoundsGlTfYUpMetres": {"min": [-0.85, 0.0, -0.65], "max": [0.85, 0.0, 0.65]},
        "collider": json.loads(str(root["collider_json"])),
        "visualBoundsGlTfYUpMetres": visual,
        "opaqueReplacementSkinPresent": False,
    }


def import_v3_non_marble() -> dict[str, bpy.types.Object]:
    bpy.ops.import_scene.gltf(filepath=str(COMMON.V3_RUNTIME))
    roots = {name: bpy.data.objects.get(name) for name in ROOT_NAMES}
    if any(root is None for root in roots.values()):
        raise ValueError("V3 runtime import lost one of the six stable roots")
    delete_tree(roots[ROOT_NAME])
    return {name: root for name, root in roots.items() if name != ROOT_NAME and root is not None}


def read_glb(path: Path) -> tuple[dict[str, Any], bytes]:
    raw = path.read_bytes()
    if raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 4)[0] != 2:
        raise ValueError(f"{path.name} is not glTF 2 GLB")
    json_length, json_type = struct.unpack_from("<II", raw, 12)
    if json_type != 0x4E4F534A:
        raise ValueError("GLB JSON chunk is missing")
    document = json.loads(raw[20 : 20 + json_length].decode("utf-8").rstrip(" \t\r\n\0"))
    offset = 20 + json_length
    binary_length, binary_type = struct.unpack_from("<II", raw, offset)
    if binary_type != 0x004E4942:
        raise ValueError("GLB binary chunk is missing")
    return document, raw[offset + 8 : offset + 8 + binary_length]


def write_glb(path: Path, document: dict[str, Any], binary: bytes) -> None:
    payload = bytearray(binary)
    while len(payload) % 4:
        payload.append(0)
    document["buffers"] = [{"byteLength": len(payload)}]
    encoded = json.dumps(document, separators=(",", ":")).encode("utf-8")
    encoded += b" " * ((-len(encoded)) % 4)
    result = bytearray(struct.pack("<III", 0x46546C67, 2, 0))
    result.extend(struct.pack("<II", len(encoded), 0x4E4F534A))
    result.extend(encoded)
    result.extend(struct.pack("<II", len(payload), 0x004E4942))
    result.extend(payload)
    struct.pack_into("<I", result, 8, len(result))
    path.write_bytes(result)


def accessor_offset(document: dict[str, Any], accessor_index: int, index: int) -> int:
    accessor = document["accessors"][accessor_index]
    view = document["bufferViews"][accessor["bufferView"]]
    components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[accessor["type"]]
    stride = int(view.get("byteStride", 4 * components))
    return int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0)) + index * stride


def orthogonal(normal: tuple[float, float, float]) -> tuple[float, float, float]:
    vector = Vector(normal)
    if vector.length_squared <= 1e-16:
        return (1.0, 0.0, 0.0)
    vector.normalize()
    axis = Vector((1.0, 0.0, 0.0)) if abs(vector.x) < 0.9 else Vector((0.0, 1.0, 0.0))
    tangent = axis.cross(vector).normalized()
    return tuple(tangent)


def patch_export(path: Path) -> dict[str, object]:
    document, binary_bytes = read_glb(path)
    marble_materials = [
        material for material in document.get("materials", [])
        if material.get("name") == MATERIAL_NAME
    ]
    if len(marble_materials) != 1:
        raise ValueError(f"Export lost the one runtime marble material: {len(marble_materials)}")
    marble_material = marble_materials[0]
    packed = marble_material.get("pbrMetallicRoughness", {}).get("metallicRoughnessTexture")
    if packed is None:
        raise ValueError("Runtime marble export lost its ORM binding")
    marble_material["occlusionTexture"] = {"index": int(packed["index"]), "strength": 1.0}

    binary = bytearray(binary_bytes)
    zero_repairs = 0
    normalized = 0
    validated = 0
    maximum_normal_unit_error = 0.0
    maximum_tangent_unit_error = 0.0
    maximum_normal_tangent_dot = 0.0
    handedness_values: set[float] = set()
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            attributes = primitive.get("attributes", {})
            if "TANGENT" not in attributes:
                continue
            tangent_index = int(attributes["TANGENT"])
            normal_index = int(attributes["NORMAL"])
            tangent_accessor = document["accessors"][tangent_index]
            normal_accessor = document["accessors"][normal_index]
            if tangent_accessor.get("componentType") != 5126 or tangent_accessor.get("type") != "VEC4":
                raise ValueError("Expected float VEC4 tangents")
            if normal_accessor.get("componentType") != 5126 or normal_accessor.get("type") != "VEC3":
                raise ValueError("Expected float VEC3 normals")
            count = int(tangent_accessor["count"])
            if count != int(normal_accessor["count"]):
                raise ValueError("Tangent and normal accessor counts differ")
            for index in range(count):
                tangent_offset = accessor_offset(document, tangent_index, index)
                normal_offset = accessor_offset(document, normal_index, index)
                tx, ty, tz, tw = struct.unpack_from("<4f", binary, tangent_offset)
                nx, ny, nz = struct.unpack_from("<3f", binary, normal_offset)
                if not all(math.isfinite(value) for value in (nx, ny, nz, tx, ty, tz, tw)):
                    raise ValueError(f"Exported non-finite tangent basis at vertex {index}")
                normal_length = math.sqrt(nx * nx + ny * ny + nz * nz)
                if normal_length <= 1e-8:
                    raise ValueError(f"Exported zero normal at vertex {index}")
                maximum_normal_unit_error = max(
                    maximum_normal_unit_error, abs(normal_length - 1.0)
                )
                length = math.sqrt(tx * tx + ty * ty + tz * tz)
                if length <= 1e-8:
                    zero_repairs += 1
                    raise ValueError(
                        "Export produced a singular tangent after the normal-map bake; "
                        "post-bake fallback would invalidate the encoded tangent basis"
                    )
                elif abs(length - 1.0) > 1e-6:
                    tx, ty, tz = tx / length, ty / length, tz / length
                    normalized += 1
                handedness = -1.0 if tw < 0.0 else 1.0
                struct.pack_into("<4f", binary, tangent_offset, tx, ty, tz, handedness)
                tangent_length = math.sqrt(tx * tx + ty * ty + tz * tz)
                normal_tangent_dot = abs(nx * tx + ny * ty + nz * tz)
                maximum_tangent_unit_error = max(
                    maximum_tangent_unit_error, abs(tangent_length - 1.0)
                )
                maximum_normal_tangent_dot = max(
                    maximum_normal_tangent_dot, normal_tangent_dot
                )
                handedness_values.add(handedness)
                validated += 1
    if maximum_normal_unit_error > 1e-4:
        raise ValueError(f"Exported normals are not unit length: {maximum_normal_unit_error}")
    if maximum_tangent_unit_error > 2e-6:
        raise ValueError(f"Exported tangents are not unit length: {maximum_tangent_unit_error}")
    if maximum_normal_tangent_dot > 2e-4:
        raise ValueError(
            f"Exported normal/tangent basis is not orthogonal: {maximum_normal_tangent_dot}"
        )
    if not handedness_values.issubset({-1.0, 1.0}):
        raise ValueError(f"Exported tangent handedness is invalid: {handedness_values}")
    write_glb(path, document, bytes(binary))
    return {
        "method": (
            "Normalize exported tangent magnitudes and canonicalize handedness; singular tangents "
            "are forbidden because a post-bake fallback would invalidate the encoded basis"
        ),
        "zeroTangentsRepaired": zero_repairs,
        "nonUnitTangentsNormalized": normalized,
        "validatedTangents": validated,
        "maximumNormalUnitError": maximum_normal_unit_error,
        "maximumTangentUnitError": maximum_tangent_unit_error,
        "maximumAbsoluteNormalTangentDot": maximum_normal_tangent_dot,
        "handednessValues": sorted(handedness_values),
        "geometryPositionIndexNormalUvUnchanged": True,
        "occlusionSharesOrmTexture": True,
    }


def export_variant(
    root: bpy.types.Object,
    low: bpy.types.Object,
    base: Path,
    normal: Path,
    output: Path,
) -> dict[str, object]:
    material = make_runtime_material(base, normal, MAPS["orm2k"])
    low.data.materials.clear()
    low.data.materials.append(material)
    objects = [root, *descendants(root)]
    set_selected(objects, root)
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_materials="EXPORT",
        export_animations=False,
        export_normals=True,
        export_tangents=True,
    )
    repair = patch_export(output)
    return {**file_record(output), "tangentAndOcclusionPatch": repair}


def packed_memory(profile: str) -> dict[str, object]:
    dimensions = [4096, 4096, 2048] if profile == "4k" else [2048, 2048, 2048]
    base_level = sum(size * size * 4 for size in dimensions)
    mip_chain = round(base_level * 4 / 3)
    return {
        "assumption": "RGBA8 GPU allocation for base, normal and ORM; complete mip chain adds 1/3",
        "textureDimensions": {
            "baseColor": [dimensions[0], dimensions[0]],
            "normal": [dimensions[1], dimensions[1]],
            "orm": [dimensions[2], dimensions[2]],
        },
        "decodedBaseLevelBytes": base_level,
        "decodedBaseLevelMiB": round(base_level / 1048576, 3),
        "decodedMipChainBytes": mip_chain,
        "decodedMipChainMiB": round(mip_chain / 1048576, 3),
    }


def main() -> None:
    inputs = validate_inputs()
    for path in (TEXTURES, SOURCE_BLEND.parent, BUILD_REPORT.parent, RAW_4K.parent):
        path.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"

    low, _ = COMMON.import_single_mesh(COMMON.REMESH)
    low.name = "Cloudway_Marble_V4_RuntimeLow_Work"
    low.data.name = low.name + "__Mesh"
    low_fit = COMMON.fit_to_v3_envelope(low)
    low_topology_before = COMMON.topology(low.data)
    flatten = flatten_landing(low)
    contacts = landing_contact_measurements(low)

    high, _ = COMMON.import_single_mesh(COMMON.DENSE)
    high.name = "Cloudway_Marble__DenseBakeSource"
    high.data.name = high.name + "__Mesh"
    high_fit = COMMON.fit_to_v3_envelope(high)
    normal_transfer = transfer_dense_normals(low, high)
    tangent_repair = repair_blender_tangent_singularities(low.data)
    normal_basis_gate = validate_corner_normal_basis(low.data)

    source_images, _unused = load_source_images()
    dense_material, dense_nodes = high_material(source_images)
    high.data.materials.clear()
    high.data.materials.append(dense_material)
    bake_target = bpy.data.materials.new("Cloudway_Marble_V4_BakeTarget")
    bake_target.use_nodes = True
    low.data.materials.clear()
    low.data.materials.append(bake_target)

    baked = {
        "baseColor4k": bake_map(
            low, high, bake_target, dense_material, dense_nodes,
            "baseColor", "EMIT", MAPS["base4k"], 4096, 16,
        ),
        "normal4k": bake_map(
            low, high, bake_target, dense_material, dense_nodes,
            "normal", "NORMAL", MAPS["normal4k"], 4096, 32,
        ),
        "ambientOcclusion2k": bake_map(
            low, high, bake_target, dense_material, dense_nodes,
            "normal", "AO", MAPS["ao2k"], 2048, 32,
        ),
        "metallic2k": bake_map(
            low, high, bake_target, dense_material, dense_nodes,
            "metallic", "EMIT", MAPS["metallic2k"], 2048, 8,
        ),
        "roughness2k": bake_map(
            low, high, bake_target, dense_material, dense_nodes,
            "roughness", "EMIT", MAPS["roughness2k"], 2048, 8,
        ),
    }
    baked["orm2k"] = build_orm()
    baked["baseColor2k"] = resize_base(MAPS["base4k"], MAPS["base2k"])
    baked["normal2k"] = resize_normal(MAPS["normal4k"], MAPS["normal2k"])

    other_roots = import_v3_non_marble()
    root = bpy.data.objects.new(ROOT_NAME, None)
    bpy.context.scene.collection.objects.link(root)
    low.name = SHELL_NAME
    low.data.name = SHELL_NAME + "__Mesh"
    low.parent = root
    low["source"] = COMMON.relative(COMMON.REMESH)
    low["sourceSha256"] = COMMON.EXPECTED_REMESH_SHA256
    low["denseBakeSource"] = COMMON.relative(COMMON.DENSE)
    low["denseBakeSourceSha256"] = COMMON.EXPECTED_DENSE_SHA256
    boundary = exact_boundary(root, boundary_material())
    root_record = configure_root(root, low, boundary)
    if set(other_roots) != set(ROOT_NAMES[1:]):
        raise ValueError("V3 non-marble root contract drifted")

    authoring_collection = bpy.data.collections.new("Cloudway V4 Authoring Bake Sources")
    bpy.context.scene.collection.children.link(authoring_collection)
    for collection in list(high.users_collection):
        collection.objects.unlink(high)
    authoring_collection.objects.link(high)
    high.hide_render = True
    high.hide_set(True)
    authoring_collection.hide_render = True

    material_4k = make_runtime_material(MAPS["base4k"], MAPS["normal4k"], MAPS["orm2k"])
    low.data.materials.clear()
    low.data.materials.append(material_4k)
    for path in (MAPS["base2k"], MAPS["normal2k"]):
        image = load_runtime_image(path, path.stem + "__packed-variant", "sRGB" if "base" in path.stem else "Non-Color")
        image.use_fake_user = True

    bpy.ops.file.pack_all()
    missing = sorted(
        image.filepath
        for image in bpy.data.images
        if image.type == "IMAGE" and image.source != "GENERATED" and image.packed_file is None
    )
    if missing:
        raise ValueError(f"Packed V4 source retains external images: {missing}")
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND), compress=True, check_existing=False)

    exports = {
        "4k": export_variant(root, low, MAPS["base4k"], MAPS["normal4k"], RAW_4K),
        "2k": export_variant(root, low, MAPS["base2k"], MAPS["normal2k"], RAW_2K),
    }
    report = {
        "schema": 1,
        "assetId": "cloudway-marble-ultra-v4-review",
        "status": "rejected 90k projection reproduction; never a canonical or runtime candidate",
        "coordinates": "Blender Z-up authoring; glTF +Y up; metres",
        "inputs": inputs,
        "fit": {
            "method": low_fit["method"],
            "runtimeLow": low_fit,
            "denseBakeSource": high_fit,
            "sameTargetEnvelope": low_fit["targetBoundsBlenderZUpMetres"] == high_fit["targetBoundsBlenderZUpMetres"],
            "originalSourcesPreserved": True,
        },
        "runtimeGeometry": {
            "remeshTopologyBeforeFit": low_topology_before,
            "triangles": COMMON.triangle_count(low.data),
            "boundaryTriangles": COMMON.triangle_count(boundary.data),
            "projectedSixInstanceFrontPassTriangles": 6 * COMMON.triangle_count(low.data),
            "budgetRationale": (
                "Six marble instances project 539,904 shell triangles before the 32-triangle "
                "boundary. The 90k shell is retained because matched review shows foliage, arch "
                "cuts, medallions and the hanging ornament survive; smooth broad surfaces are "
                "restored with dense split normals and a 4K tangent-space bake."
            ),
            "landingFlatten": flatten,
            "contactMeasurements": contacts,
            "denseSplitNormalTransfer": normal_transfer,
            "preExportTangentRepair": tangent_repair,
            "postRepairCornerNormalBasisGate": normal_basis_gate,
            "uvsPreservedFromArchivedRemesh": True,
            "opaqueReplacementSlabPresent": False,
        },
        "selectedToActiveBake": {
            "engine": "Cycles CPU",
            "cpuThreads": BAKE_THREADS,
            "cageExtrusionMetres": CAGE_EXTRUSION,
            "maximumRayDistanceMetres": MAX_RAY_DISTANCE,
            "sourceNormalMapIncluded": True,
            "maps": baked,
        },
        "rootContract": root_record,
        "packedBlend": {
            **file_record(SOURCE_BLEND),
            "imagesPacked": True,
            "denseDonorRetained": True,
            "v3NonMarbleRootsRetained": sorted(other_roots),
            "missingExternalImages": missing,
        },
        "variants": {
            "4k": {**exports["4k"], "decodedTextureMemory": packed_memory("4k")},
            "2k": {**exports["2k"], "decodedTextureMemory": packed_memory("2k")},
            "sameGeometry": True,
            "selection": "rejected; reproduction output only",
        },
        "rebuild": {
            "workingDirectory": "repository root",
            "command": (
                "rtk proxy timeout 3600 env ALSOFT_DRIVERS=null blender -b --factory-startup "
                "--python-exit-code 1 --python art/glass-adventure/platform-trials/v4/production/"
                "build_marble_runtime_v4.py"
            ),
            "blender": bpy.app.version_string,
        },
    }
    BUILD_REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print("CLOUDWAY_MARBLE_V4_BUILD=" + json.dumps({
        "triangles": root_record["triangles"],
        "blend": str(SOURCE_BLEND),
        "raw4k": str(RAW_4K),
        "raw2k": str(RAW_2K),
        "report": str(BUILD_REPORT),
    }), flush=True)


if __name__ == "__main__":
    configure_rejected_reproduction_outputs()
    main()
