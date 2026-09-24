"""Build a semantic hollow Celadon decanter and its matched fracture bundle.

The clean 404k-triangle donor is treated as an immutable projection master, not
as runtime topology.  Its visible radial envelope and scalloped mouth are
sampled into one sealed, UV-authored solid.  The authored 2K material is baked
from the textured donor before the shared measured-cavity and Manifold3D
fracture stages run.  The packed Blender source keeps the 2K maps; the runtime
GLB receives the shared 1K export downsample.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import shutil
import sys
import tempfile

import bmesh
import bpy
from mathutils import Matrix, Vector
import numpy as np
from PIL import Image as PILImage


HERE = Path(__file__).resolve().parent
LEVEL = HERE.parent
PIPELINE_PATH = LEVEL / "finalize_vessels.py"
ATTRIBUTE_REPAIR_PATH = HERE.parents[1] / "production" / "repair_export_attributes.py"
CLEAN_DONOR = LEVEL / "meshy" / "celadon-lark-decanter-regenerated-v2-pre-remesh.glb"
TEXTURED_DONOR = LEVEL / "meshy" / "celadon-lark-decanter-regenerated-v2.glb"
SOURCE_TEXTURES = {
    "baseColor": LEVEL / "meshy" / "celadon-lark-decanter-regenerated-v2_textures" / "base_color.png",
    "normal": LEVEL / "meshy" / "celadon-lark-decanter-regenerated-v2_textures" / "normal.png",
    "metallic": LEVEL / "meshy" / "celadon-lark-decanter-regenerated-v2_textures" / "metallic.png",
    "roughness": LEVEL / "meshy" / "celadon-lark-decanter-regenerated-v2_textures" / "roughness.png",
}
TRANSFER_DIR = HERE / "sources" / "celadon-transfer-textures"
TRANSFER_MAPS = {
    "baseColor": TRANSFER_DIR / "celadon-lark-decanter-base-color-2k.png",
    "normal": TRANSFER_DIR / "celadon-lark-decanter-normal-2k.png",
    "roughness": TRANSFER_DIR / "celadon-lark-decanter-roughness-2k.tmp.png",
    "metallic": TRANSFER_DIR / "celadon-lark-decanter-metallic-2k.tmp.png",
    "orm": TRANSFER_DIR / "celadon-lark-decanter-orm-2k.png",
}
TRANSFER_REPORT = HERE / "semantic-transfer-report.json"
ORIGINAL_RUNTIME_EXPORT = HERE / "sources" / "celadon-lark-decanter-fracture-v4-pre-attribute-repair.glb"
ATTRIBUTE_REPAIR_REPORT = HERE / "exports" / "celadon-lark-decanter-fracture-attribute-repair-v4.json"

SLUG = "celadon-lark-decanter"
ROOT_NAME = "breakable_l2_high_celadon_decanter"
HEIGHT = 1.15
ANGULAR_SEGMENTS = 96
BODY_RINGS = 128
RIM_SAMPLE_FLOOR = 1.105
BAKE_SIZE = 2048
BAKE_THREADS = 8
CAGE_EXTRUSION = 0.012
MAX_RAY_DISTANCE = 0.035

CLEAN_SHA256 = "fb84bd6270f49e65c08dc5024b2e89b074de751529984a73eb502ce31bdffe45"
TEXTURED_SHA256 = "04f6d35af846a10609c72e5fd11437ca7523f99e31fda8ca26e0302728e8b2e2"

CONFIG = {
    "donor": "../meshy/celadon-lark-decanter-regenerated-v2-pre-remesh.glb",
    "donorSha256": CLEAN_SHA256,
    "root": ROOT_NAME,
    "height": HEIGHT,
    "floorFraction": 0.16,
    "wallMetres": 0.012,
    "exteriorTriangleTarget": 30000,
    "cavitySegments": 48,
    "shards": 18,
    "seed": 20260924,
    "bodyTransmission": 0.0,
    "bodyColor": (0.72, 0.84, 0.74),
    "cavityColor": (0.53, 0.66, 0.57),
    "cutColor": (0.64, 0.76, 0.67),
    "repair": "semantic-envelope-solid",
    "surfaceMaterial": "celadon_shell",
    "materialStrategy": "opaque-donor-atlas",
    "normalMapStrength": 0.72,
}


def load_pipeline():
    spec = importlib.util.spec_from_file_location("celadon_v4_pipeline", PIPELINE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {PIPELINE_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_attribute_repair():
    spec = importlib.util.spec_from_file_location("celadon_v4_attribute_repair", ATTRIBUTE_REPAIR_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {ATTRIBUTE_REPAIR_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pipeline = load_pipeline()


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def file_record(path: Path, dimensions: list[int] | None = None) -> dict[str, object]:
    result: dict[str, object] = {
        "file": str(path.relative_to(HERE)),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
    }
    if dimensions is not None:
        result["dimensions"] = dimensions
    return result


def select_only(objects: list[bpy.types.Object], active: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active


def import_normalized(path: Path, expected_sha256: str, name: str) -> tuple[bpy.types.Object, dict[str, object]]:
    if digest(path) != expected_sha256:
        raise ValueError(f"Donor bytes changed: {path}")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [obj for obj in bpy.data.objects if obj not in before and obj.type == "MESH"]
    if len(meshes) != 1:
        raise ValueError(f"Expected one mesh from {path.name}, got {len(meshes)}")
    obj = meshes[0]
    low, high = pipeline.mesh_bounds([obj])
    scale = HEIGHT / (high.z - low.z)
    centre = Vector(((low.x + high.x) / 2.0, (low.y + high.y) / 2.0, low.z))
    obj.data.transform(Matrix.Scale(scale, 4) @ Matrix.Translation(-centre) @ obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    obj.name = name
    obj.data.name = name + "_geometry"
    obj.data.update()
    bpy.context.view_layer.update()
    low, high = pipeline.mesh_bounds([obj])
    return obj, {
        "uniformScale": scale,
        "sourceFootCentre": list(centre),
        "boundsMetres": {"min": list(low), "max": list(high)},
        "dimensionsMetres": list(high - low),
    }


def radial_hits(tree, z: float, angle: float) -> list[float]:
    direction = Vector((math.cos(angle), math.sin(angle), 0.0))
    cursor = Vector((0.0, 0.0, z))
    travelled = 0.0
    hits: list[float] = []
    while travelled < 0.5 and len(hits) < 16:
        location, _normal, _face, distance = tree.ray_cast(cursor, direction, 0.5 - travelled)
        if location is None or distance is None:
            break
        radial = math.hypot(location.x, location.y)
        if not hits or radial - hits[-1] > 1e-5:
            hits.append(radial)
        cursor = location + direction * 2e-6
        travelled = math.hypot(cursor.x, cursor.y)
    return hits


def outer_radius(tree, z: float, angle: float) -> float:
    hits = radial_hits(tree, z, angle)
    if not hits:
        raise ValueError(f"Clean donor has no radial surface at z={z:.6f}, angle={angle:.6f}")
    return max(hits)


def scallop_samples(master: bpy.types.Object) -> list[dict[str, float]]:
    buckets: list[list[Vector]] = [[] for _ in range(ANGULAR_SEGMENTS)]
    for vertex in master.data.vertices:
        point = master.matrix_world @ vertex.co
        if point.z < RIM_SAMPLE_FLOOR:
            continue
        angle = math.atan2(point.y, point.x) % math.tau
        index = min(ANGULAR_SEGMENTS - 1, int(angle / math.tau * ANGULAR_SEGMENTS))
        buckets[index].append(point)
    rows = []
    for index, bucket in enumerate(buckets):
        if not bucket:
            raise ValueError(f"Rim sector {index} contains no donor vertices")
        top = max(point.z for point in bucket)
        candidates = [point for point in bucket if point.z >= top - 0.0035]
        point = max(candidates, key=lambda item: math.hypot(item.x, item.y))
        rows.append({"z": float(top), "radius": float(math.hypot(point.x, point.y))})
    return rows


def build_semantic_solid(master: bpy.types.Object) -> tuple[bpy.types.Object, dict[str, object]]:
    tree = pipeline.mesh_tree(master)
    scallops = scallop_samples(master)
    body_z = np.linspace(0.002, RIM_SAMPLE_FLOOR, BODY_RINGS)
    rings: list[list[tuple[float, float, float]]] = []
    for z in body_z:
        ring = []
        for index in range(ANGULAR_SEGMENTS):
            angle = math.tau * index / ANGULAR_SEGMENTS
            radius = outer_radius(tree, float(z), angle)
            ring.append((radius * math.cos(angle), radius * math.sin(angle), float(z)))
        rings.append(ring)
    rings.insert(0, [(x, y, 0.0) for x, y, _z in rings[0]])
    rings.append(
        [
            (
                scallops[index]["radius"] * math.cos(math.tau * index / ANGULAR_SEGMENTS),
                scallops[index]["radius"] * math.sin(math.tau * index / ANGULAR_SEGMENTS),
                scallops[index]["z"],
            )
            for index in range(ANGULAR_SEGMENTS)
        ]
    )

    vertices = [point for ring in rings for point in ring]
    bottom_centre = len(vertices)
    vertices.append((0.0, 0.0, 0.0))
    top_centre = len(vertices)
    top_centre_z = min(row["z"] for row in scallops) - 0.001
    vertices.append((0.0, 0.0, top_centre_z))
    faces: list[tuple[int, int, int]] = []
    face_uvs: list[list[tuple[float, float]]] = []
    face_groups: list[str] = []
    ring_count = len(rings)
    for ring in range(ring_count - 1):
        lower_v = 0.08 + 0.84 * ring / (ring_count - 1)
        upper_v = 0.08 + 0.84 * (ring + 1) / (ring_count - 1)
        for index in range(ANGULAR_SEGMENTS):
            following = (index + 1) % ANGULAR_SEGMENTS
            a = ring * ANGULAR_SEGMENTS + index
            b = ring * ANGULAR_SEGMENTS + following
            c = (ring + 1) * ANGULAR_SEGMENTS + following
            d = (ring + 1) * ANGULAR_SEGMENTS + index
            u0 = index / ANGULAR_SEGMENTS
            u1 = (index + 1) / ANGULAR_SEGMENTS
            faces.extend(((a, b, c), (a, c, d)))
            face_uvs.extend(
                (
                    [(u0, lower_v), (u1, lower_v), (u1, upper_v)],
                    [(u0, lower_v), (u1, upper_v), (u0, upper_v)],
                )
            )
            face_groups.extend(("side", "side"))
    bottom_ring = 0
    top_ring = (ring_count - 1) * ANGULAR_SEGMENTS
    maximum_radius = max(math.hypot(x, y) for ring in rings for x, y, _z in ring)
    for index in range(ANGULAR_SEGMENTS):
        following = (index + 1) % ANGULAR_SEGMENTS
        faces.append((bottom_centre, bottom_ring + following, bottom_ring + index))
        points = [vertices[vertex] for vertex in faces[-1]]
        face_uvs.append(
            [
                (0.25 + x / maximum_radius * 0.20, 0.035 + y / maximum_radius * 0.028)
                for x, y, _z in points
            ]
        )
        face_groups.append("bottom")
        faces.append((top_centre, top_ring + index, top_ring + following))
        points = [vertices[vertex] for vertex in faces[-1]]
        face_uvs.append(
            [
                (0.75 + x / maximum_radius * 0.20, 0.965 + y / maximum_radius * 0.028)
                for x, y, _z in points
            ]
        )
        face_groups.append("top")

    mesh = bpy.data.meshes.new("celadon_semantic_exterior_geometry")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("celadon_semantic_exterior", mesh)
    bpy.context.scene.collection.objects.link(obj)
    uv = mesh.uv_layers.new(name="UVMap")
    for face, coordinates, group in zip(mesh.polygons, face_uvs, face_groups):
        face.use_smooth = group == "side"
        for loop_index, coordinate in zip(face.loop_indices, coordinates):
            uv.data[loop_index].uv = coordinate
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    check = pipeline.topology(obj)
    if not pipeline.topology_passes(check):
        raise ValueError("Semantic exterior failed solid topology gate: " + json.dumps(check))
    fidelity = pipeline.fidelity(obj, pipeline.geometry_snapshot(master))
    low, high = pipeline.mesh_bounds([obj])
    uv_values = [coordinate for face in face_uvs for coordinate in face]
    uv_areas = [
        abs(
            (coordinates[1][0] - coordinates[0][0])
            * (coordinates[2][1] - coordinates[0][1])
            - (coordinates[1][1] - coordinates[0][1])
            * (coordinates[2][0] - coordinates[0][0])
        )
        * 0.5
        for coordinates in face_uvs
    ]
    ground_vertices = [vertex.co for vertex in mesh.vertices if abs(vertex.co.z) <= 1e-8]
    report = {
        "method": (
            "Single connected solid authored from the outermost clean-donor radial hit at "
            "96 angles and 128 body elevations; donor sector maxima directly preserve the "
            "scalloped mouth. A planar sealed foot replaces the donor's axial tunnel."
        ),
        "angularSegments": ANGULAR_SEGMENTS,
        "bodyElevationSamples": BODY_RINGS,
        "ringCountIncludingFootAndScallop": ring_count,
        "topology": check,
        "boundsMetres": {"min": list(low), "max": list(high)},
        "dimensionsMetres": list(high - low),
        "groundContact": {
            "minimumZMetres": low.z,
            "verticesAtZ0": len(ground_vertices),
            "maximumContactRadiusMetres": max(math.hypot(point.x, point.y) for point in ground_vertices),
            "sealedPlanarUnderside": True,
        },
        "rim": {
            "minimumSectorMaximumZMetres": min(row["z"] for row in scallops),
            "maximumSectorMaximumZMetres": max(row["z"] for row in scallops),
            "heightRangeMetres": max(row["z"] for row in scallops) - min(row["z"] for row in scallops),
            "sectorMaximums": scallops,
        },
        "uv0": {
            "method": "non-overlapping cylindrical side band plus separate planar foot and mouth islands",
            "minimum": [min(value[0] for value in uv_values), min(value[1] for value in uv_values)],
            "maximum": [max(value[0] for value in uv_values), max(value[1] for value in uv_values)],
            "loopCount": len(uv_values),
            "triangleCount": len(uv_areas),
            "zeroAreaTriangles": sum(area <= 1e-10 for area in uv_areas),
            "minimumTriangleArea": min(uv_areas),
        },
        "donorEnvelopeFidelity": fidelity,
    }
    return obj, report


def load_source_images() -> dict[str, bpy.types.Image]:
    images = {}
    for role, path in SOURCE_TEXTURES.items():
        image = bpy.data.images.load(str(path), check_existing=False)
        image.name = f"Celadon_V4_Source_{role}"
        image.colorspace_settings.name = "sRGB" if role == "baseColor" else "Non-Color"
        images[role] = image
    return images


def make_source_material(images: dict[str, bpy.types.Image]) -> tuple[bpy.types.Material, dict[str, bpy.types.Node]]:
    material = bpy.data.materials.new("Celadon_V4_DenseBakeSource")
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


def select_source_output(material: bpy.types.Material, nodes: dict[str, bpy.types.Node], role: str) -> None:
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


def make_bake_target_material() -> bpy.types.Material:
    material = bpy.data.materials.new("Celadon_V4_BakeTarget")
    material.use_nodes = True
    return material


def bake_map(
    low: bpy.types.Object,
    high: bpy.types.Object,
    target_material: bpy.types.Material,
    source_material: bpy.types.Material,
    source_nodes: dict[str, bpy.types.Node],
    role: str,
    bake_type: str,
    path: Path,
) -> dict[str, object]:
    select_source_output(source_material, source_nodes, role)
    image = bpy.data.images.new(
        f"Celadon_V4_Bake_{role}_2K",
        width=BAKE_SIZE,
        height=BAKE_SIZE,
        alpha=False,
        float_buffer=False,
    )
    image.generated_color = (0.5, 0.5, 1.0, 1.0) if role == "normal" else (0.0, 0.0, 0.0, 1.0)
    image.colorspace_settings.name = "sRGB" if role == "baseColor" else "Non-Color"
    target = target_material.node_tree.nodes.new("ShaderNodeTexImage")
    target.name = f"Bake Target {role}"
    target.image = image
    target_material.node_tree.nodes.active = target
    select_only([high, low], low)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 8
    scene.render.threads_mode = "FIXED"
    scene.render.threads = BAKE_THREADS
    settings = scene.render.bake
    settings.use_selected_to_active = True
    settings.use_clear = True
    settings.margin = 20
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
    target_material.node_tree.nodes.remove(target)
    with PILImage.open(path) as opened:
        pixels = np.asarray(opened.convert("RGB"), dtype=np.uint8)
        variation = float(pixels.reshape(-1, 3).std(axis=0).max())
        channel_range = [int(pixels.min()), int(pixels.max())]
        dimensions = list(opened.size)
    if dimensions != [BAKE_SIZE, BAKE_SIZE] or variation < 0.25:
        raise ValueError(f"{role} bake is blank or has wrong dimensions: {dimensions}, {variation}")
    bpy.data.images.remove(image, do_unlink=True)
    return {
        **file_record(path, dimensions),
        "bakeType": bake_type,
        "samples": 8,
        "marginPixels": 20,
        "cageExtrusionMetres": CAGE_EXTRUSION,
        "maximumRayDistanceMetres": MAX_RAY_DISTANCE,
        "channelRange": channel_range,
        "maximumChannelStandardDeviation": round(variation, 4),
    }


def build_orm() -> dict[str, object]:
    with PILImage.open(TRANSFER_MAPS["roughness"]) as rough_image:
        roughness = np.asarray(rough_image.convert("L"), dtype=np.uint8)
    with PILImage.open(TRANSFER_MAPS["metallic"]) as metal_image:
        metallic = np.asarray(metal_image.convert("L"), dtype=np.uint8)
    ao = np.full_like(roughness, 255)
    orm = np.stack((ao, roughness, metallic), axis=2)
    PILImage.fromarray(orm, "RGB").save(TRANSFER_MAPS["orm"], format="PNG", optimize=True)
    return {
        **file_record(TRANSFER_MAPS["orm"], [BAKE_SIZE, BAKE_SIZE]),
        "channels": {"red": "constant ambient occlusion 1.0", "green": "baked roughness", "blue": "baked metallic"},
    }


def load_packed_image(path: Path, name: str, color_space: str) -> bpy.types.Image:
    image = bpy.data.images.load(str(path), check_existing=False)
    image.name = name
    image.colorspace_settings.name = color_space
    image.pack()
    return image


def make_runtime_material() -> bpy.types.Material:
    material = bpy.data.materials.new("celadon_transfer_surface")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    links = material.node_tree.links
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Principled BSDF"
    shader.inputs["Transmission Weight"].default_value = 0.0
    shader.inputs["IOR"].default_value = 1.47
    base = nodes.new("ShaderNodeTexImage")
    base.name = "Celadon Baked Base Color 2K"
    base.image = load_packed_image(TRANSFER_MAPS["baseColor"], "celadon_base_color_2k", "sRGB")
    links.new(base.outputs["Color"], shader.inputs["Base Color"])
    orm = nodes.new("ShaderNodeTexImage")
    orm.name = "Celadon Baked ORM 2K"
    orm.image = load_packed_image(TRANSFER_MAPS["orm"], "celadon_orm_2k", "Non-Color")
    separate = nodes.new("ShaderNodeSeparateColor")
    links.new(orm.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], shader.inputs["Roughness"])
    links.new(separate.outputs["Blue"], shader.inputs["Metallic"])
    normal = nodes.new("ShaderNodeTexImage")
    normal.name = "Celadon Baked Normal 2K"
    normal.image = load_packed_image(TRANSFER_MAPS["normal"], "celadon_normal_2k", "Non-Color")
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = float(CONFIG["normalMapStrength"])
    links.new(normal.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def semantic_import(_config: dict[str, object]) -> tuple[bpy.types.Object, dict[str, object]]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.length_unit = "METERS"
    master, source_normalization = import_normalized(CLEAN_DONOR, CLEAN_SHA256, "Celadon_Clean_Projection_Master")
    pipeline.weld_and_triangulate(master)
    semantic, semantic_report = build_semantic_solid(master)
    master_mesh = master.data
    bpy.data.objects.remove(master, do_unlink=True)
    bpy.data.meshes.remove(master_mesh)

    high, textured_normalization = import_normalized(TEXTURED_DONOR, TEXTURED_SHA256, "Celadon_Textured_Transfer_Source")
    images = load_source_images()
    source_material, source_nodes = make_source_material(images)
    high.data.materials.clear()
    high.data.materials.append(source_material)
    for face in high.data.polygons:
        face.material_index = 0
    target_material = make_bake_target_material()
    semantic.data.materials.append(target_material)
    bake_reports = {
        "baseColor": bake_map(semantic, high, target_material, source_material, source_nodes, "baseColor", "EMIT", TRANSFER_MAPS["baseColor"]),
        "roughness": bake_map(semantic, high, target_material, source_material, source_nodes, "roughness", "EMIT", TRANSFER_MAPS["roughness"]),
        "metallic": bake_map(semantic, high, target_material, source_material, source_nodes, "metallic", "EMIT", TRANSFER_MAPS["metallic"]),
        "normal": bake_map(semantic, high, target_material, source_material, source_nodes, "normal", "NORMAL", TRANSFER_MAPS["normal"]),
    }
    bake_reports["orm"] = build_orm()
    semantic.data.materials.clear()
    semantic.data.materials.append(make_runtime_material())
    high_mesh = high.data
    bpy.data.objects.remove(high, do_unlink=True)
    bpy.data.meshes.remove(high_mesh)
    for material in list(bpy.data.materials):
        if material.users == 0:
            bpy.data.materials.remove(material)
    for image in list(bpy.data.images):
        if image.users == 0:
            bpy.data.images.remove(image)

    low, high_bound = pipeline.mesh_bounds([semantic])
    normalization = {
        "method": "semantic donor-envelope retopology with selected-to-active PBR transfer",
        "uniformScale": source_normalization["uniformScale"],
        "sourceFootCentre": source_normalization["sourceFootCentre"],
        "boundsMetres": {"min": list(low), "max": list(high_bound)},
        "dimensionsMetres": list(high_bound - low),
        "cleanProjectionMaster": {
            "file": str(CLEAN_DONOR.relative_to(LEVEL)),
            "bytes": CLEAN_DONOR.stat().st_size,
            "sha256": CLEAN_SHA256,
            "normalization": source_normalization,
        },
        "texturedTransferSource": {
            "file": str(TEXTURED_DONOR.relative_to(LEVEL)),
            "bytes": TEXTURED_DONOR.stat().st_size,
            "sha256": TEXTURED_SHA256,
            "normalization": textured_normalization,
        },
        "semanticExterior": semantic_report,
        "textureTransfer": {
            "method": "Cycles CPU selected-to-active bake from authored textured donor onto semantic UV0",
            "maps": bake_reports,
            "packedSourceResolution": BAKE_SIZE,
            "runtimeExportMaximumResolution": 1024,
        },
    }
    TRANSFER_REPORT.write_text(json.dumps({"schema": 1, "assetId": SLUG, **normalization}, indent=2) + "\n")
    return semantic, normalization


def semantic_repair(obj: bpy.types.Object) -> dict[str, object]:
    check = pipeline.topology(obj)
    if not pipeline.topology_passes(check):
        raise ValueError("Semantic exterior changed before the cavity stage: " + json.dumps(check))
    return {
        "method": "no repair applied; exterior was authored as one checked oriented solid",
        "before": check,
        "after": check,
    }


base_classify_materials = pipeline.classify_materials


def classify_celadon_materials(
    obj: bpy.types.Object, slug: str, config: dict[str, object]
) -> tuple[dict[str, bpy.types.Material], dict[str, object]]:
    materials, report = base_classify_materials(obj, slug, config)
    report["reason"] = (
        "Preserves the authored pale-celadon ceramic, ivory foot, gold trim, and jewel cues "
        "as one coherent opaque PBR atlas without triangle-level material boundaries."
    )
    report["transfer"] = "selected-to-active 2K bake from the textured regenerated-v2 donor"
    return materials, report


def production_receipt(slug: str) -> dict[str, object]:
    script = "art/glass-adventure/v6-level2/celadon-production-v4/build_celadon_v4.py"
    commands = {
        phase: f"rtk proxy blender -b --factory-startup --python {script} -- --phase {phase}"
        for phase in ("prepare", "fracture", "validate", "render", "compare")
    }
    return {
        "workingDirectory": "repository root",
        "toolchain": {
            "blender": pipeline.BLENDER_VERSION,
            "backendPython": pipeline.BACKEND_PYTHON_VERSION,
            "manifold3d": pipeline.MANIFOLD_VERSION,
            "backendNumpy": pipeline.BACKEND_NUMPY_VERSION,
            "scratchPythonPath": pipeline.MANIFOLD_PATH,
            "scratchPathCommitted": False,
            "buildScript": {"file": script, "sha256": digest(Path(__file__))},
            "sharedPipeline": {
                "file": str(PIPELINE_PATH.relative_to(LEVEL.parent.parent.parent)),
                "sha256": digest(PIPELINE_PATH),
            },
            "attributeRepair": {
                "file": str(ATTRIBUTE_REPAIR_PATH.relative_to(LEVEL.parent.parent.parent)),
                "sha256": digest(ATTRIBUTE_REPAIR_PATH),
            },
        },
        "commands": commands,
        "paidProviderRequest": None,
        "providerSpend": "No new provider request; reuses the receipted regenerated-v2 donors.",
    }


def configure_pipeline() -> None:
    pipeline.HERE = HERE
    pipeline.VERSION = "v4"
    pipeline.ASSETS = {SLUG: CONFIG}
    pipeline.normalized_import = semantic_import
    pipeline.exact_self_union = semantic_repair
    pipeline.classify_materials = classify_celadon_materials
    pipeline.production_receipt = production_receipt


def update_fracture_report(report: dict[str, object]) -> dict[str, object]:
    report["fracture"]["method"] = (
        "Manifold3D convex Voronoi clipping of the measured semantic cavity shell; every shard is an independently closed solid."
    )
    report["sourceStrategy"] = (
        "Clean dense donor supplied measured exterior relief and scallops; authored textured donor supplied the PBR transfer; neither donor topology ships."
    )
    export = HERE / str(report["bundle"]["file"])
    if ORIGINAL_RUNTIME_EXPORT.is_file():
        if digest(ORIGINAL_RUNTIME_EXPORT) != digest(export):
            raise ValueError("Fresh Blender export differs from the archived pre-attribute-repair bundle")
    else:
        ORIGINAL_RUNTIME_EXPORT.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(export, ORIGINAL_RUNTIME_EXPORT)
    repair_module = load_attribute_repair()
    document, binary = repair_module.read(ORIGINAL_RUNTIME_EXPORT)
    repair = repair_module.repair(document, binary)
    repair_module.write(export, document, binary)
    fresh_document, fresh_binary = repair_module.read(export)
    if repair_module.repair(fresh_document, fresh_binary)["edits"]:
        raise ValueError("Celadon attribute repair is not idempotent")
    repair.update(
        tool={
            "file": str(ATTRIBUTE_REPAIR_PATH.relative_to(HERE.parents[3])),
            "sha256": digest(ATTRIBUTE_REPAIR_PATH),
        },
        source=str(ORIGINAL_RUNTIME_EXPORT.relative_to(HERE.parents[3])),
        output=str(export.relative_to(HERE.parents[3])),
        sourceSha256=digest(ORIGINAL_RUNTIME_EXPORT),
        outputSha256=digest(export),
        bytes=export.stat().st_size,
    )
    ATTRIBUTE_REPAIR_REPORT.write_text(json.dumps(repair, indent=2) + "\n")
    report["bundle"] = file_record(export)
    report["attributeRepair"] = {
        "file": str(ATTRIBUTE_REPAIR_REPORT.relative_to(HERE)),
        "source": str(ORIGINAL_RUNTIME_EXPORT.relative_to(HERE)),
        "removedUnusedTangentAccessors": repair["removedUnusedTangentAccessors"],
        "protectedStreams": repair["protectedStreams"],
        "geometrySignatureUnchanged": repair["geometrySignatureUnchanged"],
    }
    report["reproduction"] = production_receipt(SLUG)
    path = HERE / "exports" / f"{SLUG}-fracture-v4.json"
    path.write_text(json.dumps(report, indent=2) + "\n")
    return report


def fracture_with_rollback() -> dict[str, object]:
    """Preserve the accepted source, bundle, and receipt if regeneration drifts."""
    protected = (
        HERE / "sources" / f"{SLUG}-fracture-v4.blend",
        HERE / "exports" / f"{SLUG}-fracture-v4.glb",
        HERE / "exports" / f"{SLUG}-fracture-v4.json",
    )
    with tempfile.TemporaryDirectory(prefix="celadon-v4-fracture-") as temporary:
        backup = Path(temporary)
        existing = {path: path.is_file() for path in protected}
        for index, path in enumerate(protected):
            if existing[path]:
                shutil.copyfile(path, backup / str(index))
        try:
            return update_fracture_report(pipeline.fracture(SLUG, CONFIG))
        except Exception:
            for index, path in enumerate(protected):
                if existing[path]:
                    shutil.copyfile(backup / str(index), path)
                else:
                    path.unlink(missing_ok=True)
            raise


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def render_runtime_comparison() -> dict[str, object]:
    manifest_path = HERE / "exports" / f"{SLUG}-fracture-v4.json"
    manifest = json.loads(manifest_path.read_text())
    export = HERE / manifest["bundle"]["file"]
    if digest(export) != manifest["bundle"]["sha256"]:
        raise ValueError("Runtime bundle changed before comparison render")
    source_path = HERE / "proofs" / f"{SLUG}-intact-v4.png"
    if not source_path.is_file():
        raise ValueError("Render the packed 2K proof before the runtime comparison")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(export))
    intact = bpy.data.objects.get(str(manifest["intact"]))
    if intact is None:
        raise ValueError("Runtime comparison import lost the intact vessel")
    intact.hide_render = False
    for name in manifest["shards"]:
        bpy.data.objects[name].hide_render = True
    bpy.data.objects[manifest["collider"]].hide_render = True

    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        scene.view_settings.look = "Medium High Contrast"
    world = scene.world or bpy.data.worlds.new("runtime_comparison_world")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.012, 0.020, 0.032, 1.0)
    background.inputs["Strength"].default_value = 0.35
    bpy.ops.mesh.primitive_plane_add(size=HEIGHT * 20, location=(0.0, 0.0, -0.004))
    floor = bpy.context.object
    floor.name = "runtime_comparison_floor"
    floor.data.materials.append(
        pipeline.proof_material("runtime_comparison_floor_material", (0.035, 0.050, 0.065), 0.62)
    )
    target = Vector((0.0, 0.0, HEIGHT * 0.52))
    for name, location, energy, size, color in (
        ("runtime_key", (HEIGHT * 1.7, -HEIGHT * 2.0, HEIGHT * 2.2), 820.0, HEIGHT * 1.5, (1.0, 0.78, 0.58)),
        ("runtime_fill", (-HEIGHT * 1.8, -HEIGHT * 0.7, HEIGHT * 1.35), 540.0, HEIGHT * 1.9, (0.55, 0.78, 1.0)),
        ("runtime_rim", (HEIGHT * 0.5, HEIGHT * 1.8, HEIGHT * 1.65), 680.0, HEIGHT * 1.3, (0.60, 1.0, 0.88)),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        light = bpy.data.objects.new(name, data)
        scene.collection.objects.link(light)
        light.location = location
        point_at(light, target)
    camera_data = bpy.data.cameras.new("runtime_comparison_camera")
    camera_data.lens = 62
    camera = bpy.data.objects.new("runtime_comparison_camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (HEIGHT * 1.25, -HEIGHT * 2.25, HEIGHT * 1.12)
    point_at(camera, target)
    scene.camera = camera
    runtime_path = HERE / "proofs" / f"{SLUG}-intact-runtime-1k-v4.png"
    scene.render.filepath = str(runtime_path)
    bpy.ops.render.render(write_still=True)

    with PILImage.open(source_path) as opened:
        source = np.asarray(opened.convert("RGB"), dtype=np.float32)
    with PILImage.open(runtime_path) as opened:
        runtime = np.asarray(opened.convert("RGB"), dtype=np.float32)
    if source.shape != runtime.shape:
        raise ValueError(f"Comparison render dimensions differ: {source.shape}, {runtime.shape}")
    delta = np.abs(source - runtime)
    crop = (180, 50, 720, 860)
    central = delta[crop[1] : crop[3], crop[0] : crop[2]]
    mse = float(np.mean(np.square(source - runtime)))
    comparison_path = HERE / "proofs" / f"{SLUG}-2k-left-1k-right-v4.png"
    with PILImage.open(source_path) as source_image, PILImage.open(runtime_path) as runtime_image:
        side_by_side = PILImage.new("RGB", (1800, 900))
        side_by_side.paste(source_image.convert("RGB"), (0, 0))
        side_by_side.paste(runtime_image.convert("RGB"), (900, 0))
        side_by_side.save(comparison_path, format="PNG", optimize=True)
    report = {
        "schema": 1,
        "assetId": SLUG,
        "purpose": "Compare the packed 2K Blender master against the exported 1K runtime GLB under identical camera, light, floor, and color-management settings.",
        "packed2K": file_record(source_path, [900, 900]),
        "runtime1K": file_record(runtime_path, [900, 900]),
        "sideBySide": {
            **file_record(comparison_path, [1800, 900]),
            "layout": "packed 2K source at left; exported 1K runtime at right",
        },
        "pixelDifference": {
            "fullFrameMeanAbsolute8Bit": float(np.mean(delta)),
            "fullFrameP95Absolute8Bit": float(np.quantile(delta, 0.95)),
            "fullFramePeakSignalToNoiseDb": float(20.0 * math.log10(255.0 / math.sqrt(mse))) if mse else None,
            "centralVesselCropPixels": list(crop),
            "centralCropMeanAbsolute8Bit": float(np.mean(central)),
            "centralCropP95Absolute8Bit": float(np.quantile(central, 0.95)),
        },
        "decision": "The 1K runtime atlas is retained only if visual review preserves the donor silhouette, celadon/ivory/gold separation, relief, and scalloped mouth at the intended view distance.",
    }
    path = HERE / "proofs" / f"{SLUG}-texture-comparison-v4.json"
    path.write_text(json.dumps(report, indent=2) + "\n")
    print("CELADON_RUNTIME_COMPARISON=" + json.dumps(report["pixelDifference"]), flush=True)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--phase",
        choices=("prepare", "fracture", "validate", "render", "compare"),
        required=True,
    )
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    configure_pipeline()
    if args.phase == "prepare":
        pipeline.prepare(SLUG, CONFIG)
    elif args.phase == "fracture":
        fracture_with_rollback()
    elif args.phase == "validate":
        pipeline.validate(SLUG, CONFIG)
    elif args.phase == "render":
        pipeline.render(SLUG, CONFIG)
    else:
        render_runtime_comparison()


if __name__ == "__main__":
    main()
