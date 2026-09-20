"""Build, fracture, validate, and render measured Level 2 vessel derivatives."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import struct
import subprocess
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree


HERE = Path(__file__).resolve().parent
V3 = HERE.parent / "v3"
MANIFOLD_PATH = "/tmp/glass-museum-manifold"
MANIFOLD_PYTHON = "/usr/bin/python3"
VERSION = "v2"
BLENDER_VERSION = "5.2.2 LTS (d13f752e3b9c)"
BACKEND_PYTHON_VERSION = "3.14.7"
MANIFOLD_VERSION = "3.5.3"
BACKEND_NUMPY_VERSION = "2.5.3"

ASSETS = {
    "amber-cadence-urn": {
        "donor": "meshy/amber-cadence-urn-donor.glb",
        "donorSha256": "b7330a45eadbd08918be00441aa7c1f4aace0438a4b04b40eac0a1bcf3481dc2",
        "root": "breakable_l2_low_amber_urn",
        "height": 0.72,
        "floorFraction": 0.16,
        "wallMetres": 0.022,
        "exteriorTriangleTarget": 10000,
        "cavitySegments": 24,
        "shards": 16,
        "seed": 20260921,
        "bodyTransmission": 0.0,
        "bodyColor": (0.95, 0.52, 0.30),
        "cavityColor": (0.58, 0.25, 0.12),
        "cutColor": (0.94, 0.50, 0.28),
        "repair": "exact-self-union-local-residue",
        "surfaceMaterial": "amber_shell",
        "materialStrategy": "opaque-donor-atlas",
        "normalMapStrength": 0.35,
    },
    "opaline-echo-amphora": {
        "donor": "meshy/opaline-echo-amphora-donor.glb",
        "donorSha256": "dc09fcefb94170c71e54b3bbe48a2f005fa4ea7332589daa05a38ef4634381c8",
        "root": "breakable_l2_opaline_echo_amphora",
        "height": 0.92,
        "floorFraction": 0.23,
        "wallMetres": 0.018,
        "exteriorTriangleTarget": 9000,
        "cavitySegments": 24,
        "shards": 18,
        "seed": 20260922,
        "bodyTransmission": 0.48,
        "bodyColor": (0.84, 0.94, 0.93),
        "cavityColor": (0.68, 0.88, 0.84),
        "cutColor": (0.75, 0.94, 0.90),
        "repair": "remove-two-triangle-flaps",
    },
}


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


solid = load_module("v6_vessel_solid", V3 / "solid_fracture.py")
cut = solid.cut


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def production_receipt(slug: str) -> dict[str, object]:
    work = f"sources/{slug}-fracture-work-{VERSION}"
    return {
        "workingDirectory": "repository root",
        "toolchain": {
            "blender": BLENDER_VERSION,
            "backendPython": BACKEND_PYTHON_VERSION,
            "manifold3d": MANIFOLD_VERSION,
            "backendNumpy": BACKEND_NUMPY_VERSION,
            "scratchPythonPath": MANIFOLD_PATH,
            "scratchPathCommitted": False,
            "solidFractureBackend": {
                "file": "art/glass-adventure/v3/solid_fracture.py",
                "sha256": digest(V3 / "solid_fracture.py"),
            },
        },
        "commands": {
            "installScratchBackend": (
                "rtk proxy /usr/bin/python3 -m pip install --target "
                f"{MANIFOLD_PATH} manifold3d=={MANIFOLD_VERSION} "
                f"numpy=={BACKEND_NUMPY_VERSION}"
            ),
            "topologyAudit": (
                "rtk proxy blender -b --factory-startup --python "
                "art/glass-adventure/v6-level2/inspect_vessels.py"
            ),
            "prepare": (
                "rtk proxy blender -b --factory-startup --python "
                "art/glass-adventure/v6-level2/finalize_vessels.py -- "
                f"--asset {slug} --phase prepare"
            ),
            "fractureExport": (
                "rtk proxy blender -b --factory-startup --python "
                "art/glass-adventure/v6-level2/finalize_vessels.py -- "
                f"--asset {slug} --phase fracture"
            ),
            "freshGlbValidation": (
                "rtk proxy blender -b --factory-startup --python "
                "art/glass-adventure/v6-level2/finalize_vessels.py -- "
                f"--asset {slug} --phase validate"
            ),
            "proofs": (
                "rtk proxy blender -b --factory-startup --python "
                "art/glass-adventure/v6-level2/finalize_vessels.py -- "
                f"--asset {slug} --phase render"
            ),
        },
        "archivedIntermediateInputs": [
            f"{work}/cavity-input.npz",
            f"{work}/cavity-output.npz",
            f"{work}/cavity-output.json",
            f"{work}/cut-input.npz",
            f"{work}/cut-output.npz",
            f"{work}/cut-output.json",
        ],
    }


def select_only(objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def mesh_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def point_bounds(points: list[Vector]) -> tuple[Vector, Vector]:
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def mesh_tree(obj: bpy.types.Object) -> BVHTree:
    positions = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    obj.data.calc_loop_triangles()
    faces = [tuple(triangle.vertices) for triangle in obj.data.loop_triangles]
    return BVHTree.FromPolygons(positions, faces, all_triangles=True)


def topology(obj: bpy.types.Object) -> dict[str, object]:
    return solid.mesh_check(obj)


def topology_passes(report: dict[str, object]) -> bool:
    return not any(
        report[key]
        for key in (
            "nonManifoldEdges",
            "nonManifoldVertices",
            "nonContiguousEdges",
            "selfIntersectionPairs",
            "blenderMeshInvalid",
        )
    ) and report["signedVolume"] > 0


def normalized_import(config: dict[str, object]) -> tuple[bpy.types.Object, dict[str, object]]:
    donor = HERE / str(config["donor"])
    if digest(donor) != config["donorSha256"]:
        raise ValueError(f"Donor bytes changed: {donor}")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.length_unit = "METERS"
    bpy.ops.import_scene.gltf(filepath=str(donor))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise ValueError(f"Expected one donor mesh, got {len(meshes)}")
    obj = meshes[0]
    low, high = mesh_bounds([obj])
    scale = float(config["height"]) / (high.z - low.z)
    centre = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    transform = Matrix.Scale(scale, 4) @ Matrix.Translation(-centre)
    obj.data.transform(transform @ obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    obj.data.update()
    bpy.context.view_layer.update()
    low, high = point_bounds([vertex.co.copy() for vertex in obj.data.vertices])
    return obj, {
        "uniformScale": scale,
        "sourceFootCentre": list(centre),
        "boundsMetres": {"min": list(low), "max": list(high)},
        "dimensionsMetres": list(high - low),
    }


def geometry_snapshot(obj: bpy.types.Object) -> dict[str, object]:
    obj.data.calc_loop_triangles()
    positions = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    triangles = [tuple(triangle.vertices) for triangle in obj.data.loop_triangles]
    return {
        "positions": positions,
        "triangles": triangles,
        "tree": BVHTree.FromPolygons(positions, triangles, all_triangles=True),
        "bounds": point_bounds(positions),
    }


def weld_and_triangulate(obj: bpy.types.Object) -> dict[str, int]:
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    before = {"vertices": len(bm.verts), "faces": len(bm.faces)}
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    after = {"vertices": len(bm.verts), "faces": len(bm.faces)}
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return before | {f"welded{key.title()}": value for key, value in after.items()}


def remove_opaline_flaps(obj: bpy.types.Object) -> dict[str, object]:
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    boundary = {edge for edge in bm.edges if edge.is_boundary}
    flaps = [
        face
        for face in bm.faces
        if sum(edge in boundary for edge in face.edges) == 2
        and sum(len(edge.link_faces) == 3 for edge in face.edges) == 1
    ]
    if len(flaps) != 2:
        bm.free()
        raise ValueError(f"Expected two inspected flap triangles, found {len(flaps)}")
    regions = [
        {
            "centreMetres": list(face.calc_center_median()),
            "areaSquareMetres": face.calc_area(),
            "verticesMetres": [list(vertex.co) for vertex in face.verts],
        }
        for face in flaps
    ]
    bmesh.ops.delete(bm, geom=flaps, context="FACES")
    wires = [edge for edge in bm.edges if not edge.link_faces]
    if wires:
        bmesh.ops.delete(bm, geom=wires, context="EDGES")
    loose = [vertex for vertex in bm.verts if not vertex.link_edges]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return {"method": "remove inspected two-edge triangle flaps", "faces": regions}


def exact_self_union(obj: bpy.types.Object) -> dict[str, object]:
    before = topology(obj)
    select_only([obj])
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.intersect_boolean(operation="UNION", use_self=True, solver="EXACT")
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.data.update()
    after = topology(obj)
    return {"method": "Blender exact self-union", "before": before, "after": after}


def repair_amber_union_residue(obj: bpy.types.Object) -> dict[str, object]:
    """Remove two audited sub-centimetre exact-boolean residues without remeshing."""

    union = exact_self_union(obj)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bad_edges = [edge for edge in bm.edges if not edge.is_manifold or not edge.is_contiguous]
    bad_vertices = {vertex for edge in bad_edges for vertex in edge.verts}
    if len(bad_edges) != 3 or len(bad_vertices) != 4:
        bm.free()
        raise ValueError(
            "Amber exact-union residue changed: "
            + json.dumps({"edges": len(bad_edges), "vertices": len(bad_vertices)})
        )
    residue_points = [vertex.co.copy() for vertex in bad_vertices]
    residue_low, residue_high = point_bounds(residue_points)
    if max(residue_high - residue_low) > 0.04:
        bm.free()
        raise ValueError("Amber exact-union residue exceeded audited 4 cm region")
    incident_faces = {face for edge in bad_edges for face in edge.link_faces}
    bmesh.ops.delete(bm, geom=list(incident_faces), context="FACES")
    wires = [edge for edge in bm.edges if not edge.link_faces]
    if wires:
        bmesh.ops.delete(bm, geom=wires, context="EDGES")
    first_boundary = [edge for edge in bm.edges if edge.is_boundary]
    if not first_boundary:
        bm.free()
        raise ValueError("Amber local residue removal did not expose a patch boundary")
    bmesh.ops.holes_fill(bm, edges=first_boundary, sides=0)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))

    bowties = [vertex for vertex in bm.verts if not vertex.is_manifold]
    if len(bowties) != 1:
        bm.free()
        raise ValueError(f"Expected one audited Amber bow-tie vertex, found {len(bowties)}")
    vertex = bowties[0]
    remaining = set(vertex.link_faces)
    components: list[set[bmesh.types.BMFace]] = []
    while remaining:
        seed = remaining.pop()
        component = {seed}
        pending = [seed]
        while pending:
            face = pending.pop()
            for edge in face.edges:
                if vertex not in edge.verts:
                    continue
                for neighbour in edge.link_faces:
                    if neighbour in remaining:
                        remaining.remove(neighbour)
                        component.add(neighbour)
                        pending.append(neighbour)
        components.append(component)
    components.sort(key=len, reverse=True)
    fan_sizes = [len(component) for component in components]
    if fan_sizes != [5, 3]:
        bm.free()
        raise ValueError(f"Amber bow-tie face fans changed: {fan_sizes}")
    trimmed_faces = list(components[1])
    bowtie_location = list(vertex.co)
    bmesh.ops.delete(bm, geom=trimmed_faces, context="FACES")
    wires = [edge for edge in bm.edges if not edge.link_faces]
    if wires:
        bmesh.ops.delete(bm, geom=wires, context="EDGES")
    second_boundary = [edge for edge in bm.edges if edge.is_boundary]
    if not second_boundary:
        bm.free()
        raise ValueError("Amber bow-tie trim did not expose a patch boundary")
    bmesh.ops.holes_fill(bm, edges=second_boundary, sides=0)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    after = topology(obj)
    if not topology_passes(after):
        raise ValueError("Amber bounded residue repair failed: " + json.dumps(after))
    return {
        "method": "exact self-union followed by two bounded local face-fan patches",
        "exactSelfUnion": union,
        "unionResidue": {
            "nonManifoldEdges": len(bad_edges),
            "vertices": len(bad_vertices),
            "boundsMetres": {
                "min": list(residue_low),
                "max": list(residue_high),
                "dimensions": list(residue_high - residue_low),
            },
            "deletedIncidentFaces": len(incident_faces),
            "patchBoundaryEdges": len(first_boundary),
        },
        "bowTieResidue": {
            "vertexMetres": bowtie_location,
            "faceFanSizes": fan_sizes,
            "deletedSmallerFanFaces": len(trimmed_faces),
            "patchBoundaryEdges": len(second_boundary),
        },
        "after": after,
    }


def decimate(obj: bpy.types.Object, target: int) -> dict[str, object]:
    before = len(obj.data.polygons)
    if before <= target:
        return {"requested": target, "before": before, "after": before, "applied": False}
    select_only([obj])
    modifier = obj.modifiers.new("bounded exterior LOD", "DECIMATE")
    modifier.ratio = target / before
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    weld_and_triangulate(obj)
    return {
        "requested": target,
        "before": before,
        "after": len(obj.data.polygons),
        "applied": True,
    }


def quantiles(values: list[float]) -> dict[str, float]:
    array = np.asarray(values, dtype=float)
    return {
        "min": float(np.min(array)),
        "p05": float(np.quantile(array, 0.05)),
        "p50": float(np.quantile(array, 0.50)),
        "p95": float(np.quantile(array, 0.95)),
        "p99": float(np.quantile(array, 0.99)),
        "max": float(np.max(array)),
    }


def fidelity(obj: bpy.types.Object, source: dict[str, object]) -> dict[str, object]:
    source_tree = source["tree"]
    final_tree = mesh_tree(obj)
    final_points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    source_points = source["positions"]
    final_to_source = [source_tree.find_nearest(point)[3] for point in final_points]
    source_stride = max(1, len(source_points) // 10000)
    source_to_final = [
        final_tree.find_nearest(point)[3] for point in source_points[::source_stride]
    ]
    return {
        "method": "bidirectional nearest-vertex samples; source exterior retained as reference",
        "finalToSourceMetres": quantiles(final_to_source),
        "sourceToFinalMetres": quantiles(source_to_final),
        "sourceSampleCount": len(source_to_final),
    }


def linked_image(shader: bpy.types.Node, socket_name: str) -> tuple[bpy.types.Image, int | None]:
    socket = shader.inputs[socket_name]
    if not socket.is_linked:
        raise ValueError(f"Expected linked {socket_name}")
    link = socket.links[0]
    node = link.from_node
    channel = None
    if node.type == "SEPARATE_COLOR":
        channel = {"Red": 0, "Green": 1, "Blue": 2}.get(link.from_socket.name)
        color = node.inputs["Color"]
        if not color.is_linked:
            raise ValueError(f"Expected image feeding {socket_name}")
        node = color.links[0].from_node
    if node.type != "TEX_IMAGE" or node.image is None:
        raise ValueError(f"Unsupported {socket_name} texture graph")
    return node.image, channel


def image_pixels(image: bpy.types.Image) -> np.ndarray:
    width, height = image.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    return pixels.reshape(height, width, 4)


def sample_pixel(pixels: np.ndarray, uv: Vector) -> np.ndarray:
    height, width, _ = pixels.shape
    x = int(math.floor((uv.x % 1.0) * width)) % width
    y = int(math.floor((uv.y % 1.0) * height)) % height
    return pixels[y, x, :3]


def smoothstep(low: float, high: float, values: np.ndarray) -> np.ndarray:
    amount = np.clip((values - low) / (high - low), 0.0, 1.0)
    return amount * amount * (3.0 - 2.0 * amount)


def physical_material(
    name: str,
    color: tuple[float, float, float],
    roughness: float,
    transmission: float,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Transmission Weight"].default_value = transmission
    shader.inputs["IOR"].default_value = 1.48
    return material


def classify_materials(
    obj: bpy.types.Object, slug: str, config: dict[str, object]
) -> tuple[dict[str, bpy.types.Material], dict[str, object]]:
    source = obj.data.materials[0]
    if source is None or not source.use_nodes:
        raise ValueError("Expected textured Meshy material")
    shader = source.node_tree.nodes.get("Principled BSDF")
    base_image, _ = linked_image(shader, "Base Color")
    metal_image, metal_channel = linked_image(shader, "Metallic")
    if metal_channel is None:
        raise ValueError("Expected packed metallic channel")
    base_pixels = image_pixels(base_image)
    metal_pixels = image_pixels(metal_image)
    uv_layer = obj.data.uv_layers.active
    if uv_layer is None:
        raise ValueError("Expected donor UV0")
    body = source.copy()
    body_name = str(config.get("surfaceMaterial", "glass_shell"))
    body.name = body_name
    body_shader = body.node_tree.nodes.get("Principled BSDF")
    body_shader.inputs["Transmission Weight"].default_value = config["bodyTransmission"]
    body_shader.inputs["IOR"].default_value = 1.47
    cavity = physical_material("cavity_surface", config["cavityColor"], 0.22, config["bodyTransmission"])
    fracture = physical_material("glass_cut", config["cutColor"], 0.28, config["bodyTransmission"] * 0.65)
    if slug == "opaline-echo-amphora":
        trim = source.copy()
        trim.name = "opaque_trim"
        trim_shader = trim.node_tree.nodes.get("Principled BSDF")
        trim_shader.inputs["Transmission Weight"].default_value = 0.0
        materials = {
            body_name: body,
            "opaque_trim": trim,
            "cavity_surface": cavity,
            "glass_cut": fracture,
        }
        rgb = base_pixels[:, :, :3]
        metallic = metal_pixels[:, :, metal_channel]
        chroma = np.max(rgb, axis=2) - np.min(rgb, axis=2)
        green_excess = rgb[:, :, 1] - np.maximum(rgb[:, :, 0], rgb[:, :, 2])
        warm_excess = rgb[:, :, 0] - rgb[:, :, 2]
        jade_opacity = smoothstep(0.045, 0.18, green_excess) * smoothstep(
            0.06, 0.24, chroma
        )
        gold_opacity = smoothstep(0.04, 0.20, warm_excess) * smoothstep(
            0.45, 0.85, metallic
        )
        opacity = np.maximum(jade_opacity, gold_opacity)
        transmission = float(config["bodyTransmission"]) * (1.0 - opacity)
        height, width = transmission.shape
        mask_pixels = np.empty((height, width, 4), dtype=np.float32)
        mask_pixels[:, :, :3] = transmission[:, :, None]
        mask_pixels[:, :, 3] = 1.0
        mask = bpy.data.images.new(
            "opaline_transmission_mask_v2",
            width=width,
            height=height,
            alpha=True,
            float_buffer=False,
        )
        mask.colorspace_settings.name = "Non-Color"
        mask.pixels.foreach_set(mask_pixels.reshape(-1))
        mask.pack()
        mask_node = body.node_tree.nodes.new("ShaderNodeTexImage")
        mask_node.name = "Opaline Transmission Mask"
        mask_node.label = "Continuous pearl / jade-gold transmission"
        mask_node.image = mask
        body.node_tree.links.new(
            mask_node.outputs["Color"], body_shader.inputs["Transmission Weight"]
        )
        labels = [body_name] * len(obj.data.polygons)
        region_report = {
            "method": "continuous texture-space transmission mask; no per-face glass/opaque boundary",
            "maskImage": mask.name,
            "maskDimensions": [width, height],
            "maskTransmission": quantiles(transmission.reshape(-1).tolist()),
            "opaqueCuePixels": {
                "jadeAboveHalf": int(np.sum(jade_opacity > 0.5)),
                "goldAboveHalf": int(np.sum(gold_opacity > 0.5)),
                "total": int(width * height),
            },
            "thresholds": {
                "jadeGreenExcessSmoothstep": [0.045, 0.18],
                "jadeChromaSmoothstep": [0.06, 0.24],
                "goldWarmExcessSmoothstep": [0.04, 0.20],
                "goldMetallicSmoothstep": [0.45, 0.85],
            },
            "faceAssignments": {body_name: len(labels), "opaque_trim": 0},
            "geometryChanged": False,
        }
    elif config.get("materialStrategy") == "opaque-donor-atlas":
        normal_input = body_shader.inputs["Normal"]
        if not normal_input.is_linked or normal_input.links[0].from_node.type != "NORMAL_MAP":
            raise ValueError("Opaque donor surface lost its authored normal-map node")
        normal_input.links[0].from_node.inputs["Strength"].default_value = float(
            config["normalMapStrength"]
        )
        materials = {
            body_name: body,
            "cavity_surface": cavity,
            "glass_cut": fracture,
        }
        labels = [body_name] * len(obj.data.polygons)
        region_report = {
            "method": "single coherent opaque donor PBR atlas across the exterior",
            "surfaceMaterial": body_name,
            "sourceTextureDimensions": {
                "baseColor": [int(base_image.size[0]), int(base_image.size[1])],
                "metallicRoughness": [int(metal_image.size[0]), int(metal_image.size[1])],
            },
            "faceAssignments": {body_name: len(labels)},
            "transmission": 0.0,
            "normalMapStrength": float(config["normalMapStrength"]),
            "reason": "Preserves the approved peach ceramic body and donor-authored gold, ivory, and jewel cues without triangle-level material boundaries.",
            "geometryChanged": False,
        }
    else:
        raise ValueError(f"Unsupported material strategy for {slug}")
    obj.data.materials.clear()
    for material in materials.values():
        obj.data.materials.append(material)
    names = list(materials)
    for face, label in zip(obj.data.polygons, labels):
        face.material_index = names.index(label)
    for image in {base_image, metal_image}:
        image.pack()
    for material in materials.values():
        for node in material.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image:
                node.image.pack()
    return materials, region_report


def radial_profile(
    obj: bpy.types.Object, config: dict[str, object]
) -> tuple[list[tuple[float, float]], dict[str, object]]:
    tree = mesh_tree(obj)
    height = float(config["height"])
    floor = height * float(config["floorFraction"])
    wall = float(config["wallMetres"])
    first_sample = floor + height * 0.05
    last_sample = height - max(height * 0.035, wall * 1.25)
    rows = []
    for z in np.linspace(first_sample, last_sample, 12):
        radii = []
        for index in range(32):
            angle = math.tau * index / 32
            direction = Vector((math.cos(angle), math.sin(angle), 0.0))
            location, _normal, _face, distance = tree.ray_cast(
                Vector((0.0, 0.0, float(z))), direction, height * 2
            )
            if location is None or distance is None:
                raise ValueError(f"No radial donor hit at z={z:.6f}")
            radii.append(float(distance))
        safe_outer = float(np.quantile(radii, 0.05))
        inner = safe_outer - wall
        if inner <= wall:
            raise ValueError(f"No safe cavity radius at z={z:.6f}: {inner:.6f}")
        rows.append(
            {
                "zMetres": float(z),
                "outerRayMetres": quantiles(radii),
                "innerRadiusMetres": inner,
            }
        )
    raw = [row["innerRadiusMetres"] for row in rows]
    safe = []
    for index, value in enumerate(raw):
        neighbourhood = raw[max(0, index - 1) : min(len(raw), index + 2)]
        safe.append(min(value, float(np.mean(neighbourhood))))
    profile = [
        (floor, max(0.012, safe[0] * 0.16)),
        (floor + height * 0.025, safe[0] * 0.65),
    ]
    profile.extend((row["zMetres"], radius) for row, radius in zip(rows, safe))
    profile.append((height + height * 0.08, safe[-1]))
    return profile, {
        "method": "32 radial donor-surface rays at 12 elevations; fifth-percentile radius minus fixed wall allowance",
        "floorZMetres": floor,
        "targetWallMetres": wall,
        "rows": rows,
        "profileMetres": [[z, radius] for z, radius in profile],
        "segments": int(config["cavitySegments"]),
    }


def make_cutter(
    profile: list[tuple[float, float]], material: bpy.types.Material, segments: int
) -> bpy.types.Object:
    vertices = []
    for z, radius in profile:
        vertices.extend(
            (radius * math.cos(math.tau * index / segments), radius * math.sin(math.tau * index / segments), z)
            for index in range(segments)
        )
    bottom = len(vertices)
    vertices.append((0.0, 0.0, profile[0][0]))
    top = len(vertices)
    vertices.append((0.0, 0.0, profile[-1][0]))
    faces = []
    for ring in range(len(profile) - 1):
        for index in range(segments):
            following = (index + 1) % segments
            a = ring * segments + index
            b = ring * segments + following
            c = (ring + 1) * segments + following
            d = (ring + 1) * segments + index
            faces.extend(((a, b, c), (a, c, d)))
    for index in range(segments):
        following = (index + 1) % segments
        faces.append((bottom, following, index))
        last = (len(profile) - 1) * segments
        faces.append((top, last + index, last + following))
    mesh = bpy.data.meshes.new("measured_cavity_cutter_geometry")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    cutter = bpy.data.objects.new("measured_cavity_cutter", mesh)
    bpy.context.scene.collection.objects.link(cutter)
    mesh.materials.append(material)
    cut.planar_uv(cutter)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    check = topology(cutter)
    if not topology_passes(check):
        raise ValueError("Cavity cutter failed solid gate: " + json.dumps(check))
    return cutter


def packed_mesh(obj: bpy.types.Object, material_names: list[str]) -> dict[str, np.ndarray]:
    mesh = obj.data
    mesh.calc_loop_triangles()
    if any(len(face.vertices) != 3 for face in mesh.polygons):
        raise ValueError(f"{obj.name} must be triangulated")
    uv_layer = mesh.uv_layers.active
    if uv_layer is None:
        raise ValueError(f"{obj.name} needs UV0")
    order = sorted(range(len(mesh.polygons)), key=lambda index: mesh.polygons[index].material_index)
    corner_indices = np.array(
        [loop for face in order for loop in mesh.polygons[face].loop_indices]
    )
    vertex_indices = np.array([mesh.loops[int(index)].vertex_index for index in corner_indices])
    positions = np.array([tuple(vertex.co) for vertex in mesh.vertices], dtype=np.float32)
    normals = np.array(
        [tuple(mesh.corner_normals[int(index)].vector) for index in corner_indices],
        dtype=np.float32,
    )
    uv = np.array(
        [tuple(uv_layer.data[int(index)].uv) for index in corner_indices], dtype=np.float32
    )
    properties = np.column_stack((positions[vertex_indices], normals, uv))
    first: dict[int, int] = {}
    merge_from = []
    merge_to = []
    for index, vertex in enumerate(vertex_indices):
        vertex = int(vertex)
        if vertex in first:
            merge_from.append(index)
            merge_to.append(first[vertex])
        else:
            first[vertex] = index
    labels = []
    for index in order:
        material = mesh.materials[mesh.polygons[index].material_index]
        labels.append(material_names.index(material.name))
    return {
        "properties": properties,
        "triangles": np.arange(len(vertex_indices), dtype=np.uint32).reshape(-1, 3),
        "merge_from": np.asarray(merge_from, dtype=np.int32),
        "merge_to": np.asarray(merge_to, dtype=np.int32),
        "material_labels": np.asarray(labels, dtype=np.int32),
    }


def subtract_cavity(
    exterior: bpy.types.Object,
    cutter: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
    work: Path,
) -> tuple[bpy.types.Object, dict[str, object]]:
    work.mkdir(parents=True, exist_ok=True)
    source = work / "cavity-input.npz"
    output = work / "cavity-output.npz"
    names = list(materials)
    exterior_data = packed_mesh(exterior, names)
    cutter_data = packed_mesh(cutter, names)
    values = {
        "material_count": np.asarray(len(names)),
        "cavity_material": np.asarray(names.index("cavity_surface")),
    }
    for prefix, data in (("exterior", exterior_data), ("cutter", cutter_data)):
        for key, value in data.items():
            values[f"{prefix}_{key}"] = value
    np.savez_compressed(source, **values)
    environment = dict(os.environ)
    environment["PYTHONPATH"] = MANIFOLD_PATH
    subprocess.run(
        [MANIFOLD_PYTHON, str(HERE / "vessel_cavity_backend.py"), str(source), str(output)],
        check=True,
        timeout=240,
        env=environment,
    )
    result = np.load(output)
    properties = result["properties"]
    triangles = result["triangles"]
    mapping = np.arange(len(properties))
    for origin, target in zip(result["merge_from"], result["merge_to"]):
        mapping[int(origin)] = int(target)
    for index in range(len(mapping)):
        target = index
        while mapping[target] != target:
            target = int(mapping[target])
        mapping[index] = target
    used = np.unique(mapping[triangles])
    compact = {int(vertex): index for index, vertex in enumerate(used)}
    faces = [
        [compact[int(mapping[vertex])] for vertex in triangle] for triangle in triangles
    ]
    mesh = bpy.data.meshes.new(exterior.name + "_cavity_geometry")
    mesh.from_pydata(properties[used, :3].tolist(), [], faces)
    mesh.update()
    result_obj = bpy.data.objects.new(exterior.name + "_cavity", mesh)
    bpy.context.scene.collection.objects.link(result_obj)
    for material in materials.values():
        mesh.materials.append(material)
    uv_layer = mesh.uv_layers.new(name="UVMap")
    custom_normals = []
    for face, source_triangle, label in zip(mesh.polygons, triangles, result["materials"]):
        face.material_index = int(label)
        face.use_smooth = names[int(label)] != "glass_cut"
        for loop_index, source_vertex in zip(face.loop_indices, source_triangle):
            uv_layer.data[loop_index].uv = tuple(properties[int(source_vertex), 6:8])
            custom_normals.append(tuple(properties[int(source_vertex), 3:6]))
    mesh.normals_split_custom_set(custom_normals)
    report = json.loads(output.with_suffix(".json").read_text())
    return result_obj, report


def central_ray_hits(obj: bpy.types.Object) -> list[float]:
    tree = mesh_tree(obj)
    low, high = mesh_bounds([obj])
    origin = Vector((0.0, 0.0, high.z + (high.z - low.z) * 0.1))
    direction = Vector((0.0, 0.0, -1.0))
    hits = []
    cursor = origin
    travelled = 0.0
    maximum = (high.z - low.z) * 1.3
    while travelled < maximum and len(hits) < 16:
        location, _normal, _face, distance = tree.ray_cast(
            cursor, direction, maximum - travelled
        )
        if location is None or distance is None:
            break
        hits.append(location.z)
        step = max(1e-6, (high.z - low.z) * 1e-6)
        cursor = location + direction * step
        travelled = origin.z - cursor.z
    return hits


def cavity_thickness(
    shell: bpy.types.Object,
    source_tree: BVHTree,
    height: float,
) -> dict[str, object]:
    names = [material.name for material in shell.data.materials]
    cavity_index = names.index("cavity_surface")
    distances = []
    faces = 0
    for face in shell.data.polygons:
        if face.material_index != cavity_index:
            continue
        centre = shell.matrix_world @ face.center
        if centre.z > height * 0.975:
            continue
        faces += 1
        distances.append(source_tree.find_nearest(centre)[3])
    if not distances:
        raise ValueError("No measurable cavity faces")
    return {
        "sampledFaces": faces,
        "rimSeamFacesUnder3mm": sum(distance < 0.003 for distance in distances),
        "nearestExteriorDistanceMetres": quantiles(distances),
        "interpretation": "The minimum includes the intentional cavity/exterior seam at the open mouth; p05 gates the measurable inner wall away from that seam.",
    }


def make_collider(config: dict[str, object], shell: bpy.types.Object, root: bpy.types.Object) -> bpy.types.Object:
    low, high = mesh_bounds([shell])
    dimensions = high - low
    radius = min(dimensions.x, dimensions.y) * 0.40
    depth = dimensions.z * 0.70
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=radius, depth=depth, location=(0.0, 0.0, depth / 2)
    )
    collider = bpy.context.object
    collider.name = "COLLIDER_" + str(config["root"])
    collider.data.name = collider.name + "_geometry"
    collider["collision_proxy"] = True
    collider["collision_shape"] = "16-sided-cylinder"
    collider.display_type = "WIRE"
    collider.hide_render = True
    collider.parent = root
    return collider


def prepare(slug: str, config: dict[str, object]) -> dict[str, object]:
    obj, normalization = normalized_import(config)
    source = geometry_snapshot(obj)
    cleanup = {"weld": weld_and_triangulate(obj)}
    if config["repair"] == "remove-two-triangle-flaps":
        cleanup["localRepair"] = remove_opaline_flaps(obj)
    elif config["repair"] == "exact-self-union-local-residue":
        cleanup["localRepair"] = repair_amber_union_residue(obj)
    else:
        cleanup["localRepair"] = exact_self_union(obj)
        cleanup["collapsedComponents"] = solid.remove_collapsed_components(obj)
    lod = decimate(obj, int(config["exteriorTriangleTarget"]))
    exterior_check = topology(obj)
    if not topology_passes(exterior_check):
        raise ValueError("Exterior failed solid gate: " + json.dumps(exterior_check))
    exterior_fidelity = fidelity(obj, source)
    materials, regions = classify_materials(obj, slug, config)
    profile, profile_report = radial_profile(obj, config)
    cutter = make_cutter(
        profile, materials["cavity_surface"], int(config["cavitySegments"])
    )
    shell, cavity_backend = subtract_cavity(
        obj, cutter, materials, HERE / "sources" / f"{slug}-fracture-work-{VERSION}"
    )
    bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.objects.remove(cutter, do_unlink=True)
    shell.name = str(config["root"]) + "_intact"
    shell.data.name = shell.name + "_geometry"
    shell["role"] = "intact"
    shell["asset_id"] = slug
    root = bpy.data.objects.new(str(config["root"]), None)
    bpy.context.scene.collection.objects.link(root)
    root["asset_id"] = slug
    root["units"] = "metres"
    shell.parent = root
    collider = make_collider(config, shell, root)
    shell_check = topology(shell)
    if not topology_passes(shell_check):
        raise ValueError("Cavity shell failed solid gate: " + json.dumps(shell_check))
    hits = central_ray_hits(shell)
    floor = float(config["height"]) * float(config["floorFraction"])
    if len(hits) != 2 or max(hits) > floor + float(config["height"]) * 0.08:
        raise ValueError(f"Central mouth ray does not prove an open cavity: {hits}")
    thickness = cavity_thickness(shell, source["tree"], float(config["height"]))
    if (
        thickness["nearestExteriorDistanceMetres"]["p05"] < 0.004
        or thickness["nearestExteriorDistanceMetres"]["p50"] < 0.010
    ):
        raise ValueError(
            "Cavity wall does not retain a measured interior thickness: "
            + json.dumps(thickness)
        )
    source_low, source_high = source["bounds"]
    final_low, final_high = mesh_bounds([shell])
    bound_delta = max(
        abs(source_low[axis] - final_low[axis])
        for axis in range(3)
    )
    bound_delta = max(
        bound_delta,
        max(abs(source_high[axis] - final_high[axis]) for axis in range(3)),
    )
    if bound_delta > 1e-5:
        raise ValueError(
            "Cavity changed exterior bounds: "
            + json.dumps(
                {
                    "maxDeltaMetres": bound_delta,
                    "sourceMin": list(source_low),
                    "sourceMax": list(source_high),
                    "finalMin": list(final_low),
                    "finalMax": list(final_high),
                }
            )
        )
    bpy.ops.file.pack_all()
    blend = HERE / "sources" / f"{slug}-cavity-{VERSION}.blend"
    blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), check_existing=False)
    report = {
        "schema": 1,
        "status": "prepared cavity shell; fracture/export validation pending",
        "assetId": slug,
        "donor": {
            "file": config["donor"],
            "bytes": (HERE / str(config["donor"])).stat().st_size,
            "sha256": config["donorSha256"],
        },
        "normalization": normalization,
        "cleanup": cleanup,
        "lod": lod,
        "exteriorCheck": exterior_check,
        "exteriorFidelityBeforeCavity": exterior_fidelity,
        "materialRegions": regions,
        "cavityProfile": profile_report,
        "cavityBackend": cavity_backend,
        "cavityThickness": thickness,
        "centralMouthRayZMetres": hits,
        "shellCheck": shell_check,
        "exteriorBoundsMaxDeltaMetres": bound_delta,
        "nodes": {
            "root": root.name,
            "intact": shell.name,
            "collider": collider.name,
        },
        "packedBlenderSource": {
            "file": str(blend.relative_to(HERE)),
            "bytes": blend.stat().st_size,
            "sha256": digest(blend),
        },
        "reproduction": production_receipt(slug),
        "gameplayReadiness": "Prepared production shell only; matched shards and fresh GLB validation are still required.",
    }
    path = HERE / "exports" / f"{slug}-cavity-{VERSION}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2) + "\n")
    print("VESSEL_CAVITY_PREPARED=" + json.dumps({"assetId": slug, "triangles": shell_check["triangles"], "blend": str(blend)}))
    return report


def fracture(slug: str, config: dict[str, object]) -> dict[str, object]:
    prepared = HERE / "sources" / f"{slug}-cavity-{VERSION}.blend"
    preparation = json.loads((HERE / "exports" / f"{slug}-cavity-{VERSION}.json").read_text())
    if digest(prepared) != preparation["packedBlenderSource"]["sha256"]:
        raise ValueError("Prepared cavity source changed after its report")
    bpy.ops.wm.open_mainfile(filepath=str(prepared))
    bpy.context.preferences.filepaths.save_version = 0
    root = bpy.data.objects[str(config["root"])]
    intact = bpy.data.objects[str(config["root"]) + "_intact"]
    materials = {material.name: material for material in intact.data.materials}
    seeds = cut.surface_seeds(intact, int(config["shards"]), int(config["seed"]))
    shards, backend = solid.fracture(
        intact,
        root,
        seeds,
        materials,
        HERE / "sources" / f"{slug}-fracture-work-{VERSION}",
        python=MANIFOLD_PYTHON,
        library_path=MANIFOLD_PATH,
    )
    if len(shards) != int(config["shards"]):
        raise ValueError(f"Expected {config['shards']} shards, got {len(shards)}")
    checks = [topology(intact), *[topology(shard) for shard in shards]]
    if any(not topology_passes(check) for check in checks):
        raise ValueError("Fracture surface gate failed: " + json.dumps(checks))
    volume = checks[0]["signedVolume"]
    shard_volume = sum(check["signedVolume"] for check in checks[1:])
    volume_error = abs(shard_volume - volume) / volume
    if volume_error > 1e-5:
        raise ValueError(f"Fragments do not reconstruct intact volume: {volume_error}")
    intact.hide_render = False
    for shard in shards:
        shard.hide_render = True
    blend = HERE / "sources" / f"{slug}-fracture-{VERSION}.blend"
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), check_existing=False)
    blend_hash = digest(blend)
    for image in bpy.data.images:
        if image.type == "IMAGE" and max(image.size) > 1024:
            ratio = 1024 / max(image.size)
            image.scale(max(1, round(image.size[0] * ratio)), max(1, round(image.size[1] * ratio)))
    export = HERE / "exports" / f"{slug}-fracture-{VERSION}.glb"
    export.parent.mkdir(parents=True, exist_ok=True)
    select_only([root, *list(root.children_recursive)])
    bpy.ops.export_scene.gltf(
        filepath=str(export),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_extras=True,
        export_animations=False,
        export_tangents=True,
        export_image_format="AUTO",
        export_jpeg_quality=95,
    )
    if digest(blend) != blend_hash:
        raise ValueError("Packed Blender source changed during runtime export")
    report = {
        "schema": 1,
        "status": "staged; independent GLB reimport and visual proofs pending",
        "assetId": slug,
        "preparedInput": str(prepared.relative_to(HERE)),
        "preparedSha256": preparation["packedBlenderSource"]["sha256"],
        "units": "metres",
        "up": "+Y in GLB; +Z in Blender source",
        "root": root.name,
        "intact": intact.name,
        "shards": [shard.name for shard in shards],
        "collider": "COLLIDER_" + str(config["root"]),
        "meshChecks": checks,
        "fracture": {
            "method": "Manifold3D convex Voronoi clipping of the measured Meshy-derived cavity shell",
            "seedCoordinatesBlenderZUp": [list(seed) for seed in seeds],
            "volumeRelativeError": volume_error,
            "backend": backend,
        },
        "packedBlenderSource": {
            "file": str(blend.relative_to(HERE)),
            "bytes": blend.stat().st_size,
            "sha256": blend_hash,
        },
        "bundle": {
            "file": str(export.relative_to(HERE)),
            "bytes": export.stat().st_size,
            "sha256": digest(export),
        },
        "reproduction": production_receipt(slug),
        "gameplayReadiness": "Staged authored fracture bundle; fresh reimport and proof gates still pending.",
    }
    report_path = HERE / "exports" / f"{slug}-fracture-{VERSION}.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print("VESSEL_FRACTURED=" + json.dumps({"assetId": slug, "shards": len(shards), "volumeRelativeError": volume_error, "bundleBytes": export.stat().st_size}))
    return report


def glb_json(path: Path) -> dict[str, object]:
    raw = path.read_bytes()
    if raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 8)[0] != len(raw):
        raise ValueError("Incomplete GLB")
    json_length = struct.unpack_from("<I", raw, 12)[0]
    return json.loads(raw[20 : 20 + json_length])


def inspected_copy(obj: bpy.types.Object) -> tuple[bpy.types.Object, bpy.types.Mesh]:
    mesh = obj.data.copy()
    result = obj.copy()
    result.data = mesh
    bpy.context.scene.collection.objects.link(result)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-9)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return result, mesh


def validate(slug: str, config: dict[str, object]) -> dict[str, object]:
    manifest_path = HERE / "exports" / f"{slug}-fracture-{VERSION}.json"
    manifest = json.loads(manifest_path.read_text())
    export = HERE / manifest["bundle"]["file"]
    if digest(export) != manifest["bundle"]["sha256"]:
        raise ValueError("Export bytes changed after staging")
    encoded = glb_json(export)
    primitives = [primitive for mesh in encoded["meshes"] for primitive in mesh["primitives"]]
    if any(not {"POSITION", "NORMAL", "TEXCOORD_0"} <= primitive["attributes"].keys() for primitive in primitives):
        raise ValueError("GLB lost required surface attributes")
    if any("uri" in image for image in encoded.get("images", [])):
        raise ValueError("GLB unexpectedly references external images")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(export))
    bpy.context.view_layer.update()
    root = bpy.data.objects.get(manifest["root"])
    if root is None:
        raise ValueError("GLB lost stable root")
    expected = [manifest["intact"], *manifest["shards"]]
    checks = []
    volumes = {}
    for name in expected:
        obj = bpy.data.objects.get(name)
        if obj is None or obj.type != "MESH":
            raise ValueError(f"GLB lost mesh {name}")
        test, mesh = inspected_copy(obj)
        report = topology(test) | {"name": name}
        if not topology_passes(report):
            raise ValueError("Reimport surface gate failed: " + json.dumps(report))
        checks.append(report)
        volumes[name] = report["signedVolume"]
        bpy.data.objects.remove(test, do_unlink=True)
        bpy.data.meshes.remove(mesh)
    intact_volume = volumes[manifest["intact"]]
    shard_volume = sum(volumes[name] for name in manifest["shards"])
    volume_error = abs(shard_volume - intact_volume) / intact_volume
    if volume_error > 1e-5:
        raise ValueError(f"Reimported shards do not reconstruct intact: {volume_error}")
    intact = bpy.data.objects[manifest["intact"]]
    hits = central_ray_hits(intact)
    floor = float(config["height"]) * float(config["floorFraction"])
    if len(hits) != 2 or max(hits) > floor + float(config["height"]) * 0.08:
        raise ValueError(f"Reimported open cavity ray failed: {hits}")
    preparation = json.loads((HERE / "exports" / f"{slug}-cavity-{VERSION}.json").read_text())
    expected_dimensions = Vector(preparation["normalization"]["dimensionsMetres"])
    low, high = mesh_bounds([intact])
    dimension_error = max(abs((high - low)[axis] - expected_dimensions[axis]) for axis in range(3))
    if dimension_error > 1e-5:
        raise ValueError(f"Reimport changed intact dimensions: {dimension_error}")
    material_names = sorted(material.name for material in bpy.data.materials)
    surface_material = str(config.get("surfaceMaterial", "glass_shell"))
    required_materials = {surface_material, "cavity_surface", "glass_cut"}
    if not required_materials <= set(material_names):
        raise ValueError(f"Missing exported materials: {required_materials - set(material_names)}")
    encoded_materials = {material["name"]: material for material in encoded["materials"]}
    transmissions = {
        name: encoded_materials[name]
        .get("extensions", {})
        .get("KHR_materials_transmission", {})
        .get("transmissionFactor", 0.0)
        for name in required_materials
    }
    transmission_mask_report = None
    if slug == "opaline-echo-amphora":
        if (
            transmissions[surface_material] < 0.45
            or transmissions["cavity_surface"] < 0.45
            or transmissions["glass_cut"] < 0.30
        ):
            raise ValueError("GLB physical-material contract failed: " + json.dumps(transmissions))
        shell_transmission = (
            encoded_materials[surface_material]
            .get("extensions", {})
            .get("KHR_materials_transmission", {})
        )
        if "transmissionTexture" not in shell_transmission:
            raise ValueError("GLB lost the continuous opaline transmission texture")
        transmission_texture = shell_transmission["transmissionTexture"]
        texture_index = transmission_texture["index"]
        texture_definition = encoded["textures"][texture_index]
        image_index = texture_definition["source"]
        image_definition = encoded["images"][image_index]
        mask_name = preparation["materialRegions"]["maskImage"]
        if image_definition.get("name") != mask_name:
            raise ValueError(f"Transmission mask binding changed: {image_definition}")
        imported_mask = bpy.data.images.get(mask_name)
        if imported_mask is None:
            raise ValueError(f"GLB import lost transmission mask image {mask_name}")
        embedded_mask_dimensions = [int(imported_mask.size[0]), int(imported_mask.size[1])]
        if embedded_mask_dimensions != [1024, 1024]:
            raise ValueError(f"Runtime transmission mask dimensions changed: {embedded_mask_dimensions}")
        transmission_mask_report = {
            "material": surface_material,
            "textureIndex": texture_index,
            "texCoord": transmission_texture.get("texCoord", 0),
            "imageIndex": image_index,
            "imageName": mask_name,
            "mimeType": image_definition.get("mimeType"),
            "sourceDimensions": preparation["materialRegions"]["maskDimensions"],
            "embeddedRuntimeDimensions": embedded_mask_dimensions,
            "runtimeDownsampleMaximum": 1024,
        }
    elif config.get("materialStrategy") == "opaque-donor-atlas":
        if any(value > 1e-6 for value in transmissions.values()):
            raise ValueError("Opaque material contract gained transmission: " + json.dumps(transmissions))
        surface_pbr = encoded_materials[surface_material].get("pbrMetallicRoughness", {})
        if "baseColorTexture" not in surface_pbr or "metallicRoughnessTexture" not in surface_pbr:
            raise ValueError("Opaque donor surface lost its PBR atlas bindings")
        oversized = {
            image.name: [int(image.size[0]), int(image.size[1])]
            for image in bpy.data.images
            if image.type == "IMAGE" and max(image.size) > 1024
        }
        if oversized:
            raise ValueError("Runtime atlas exceeded 1K maximum: " + json.dumps(oversized))
    else:
        raise ValueError(f"No validation material contract for {slug}")
    node_mesh_indices = {
        node["name"]: node.get("mesh")
        for node in encoded["nodes"]
        if "name" in node
    }
    rendered_mesh_indices = {node_mesh_indices[name] for name in expected}
    rendered_primitives = [
        primitive
        for mesh_index in rendered_mesh_indices
        for primitive in encoded["meshes"][mesh_index]["primitives"]
    ]
    if not all("TANGENT" in primitive["attributes"] for primitive in rendered_primitives):
        raise ValueError("A rendered intact/shard primitive lost tangent data")
    collider_mesh_index = node_mesh_indices[manifest["collider"]]
    collider_primitives = encoded["meshes"][collider_mesh_index]["primitives"]
    report = {
        "schema": 1,
        "status": "passed geometry and GLB reimport gates; proof review remains separate",
        "assetId": slug,
        "bundleSha256": digest(export),
        "bundleBytes": export.stat().st_size,
        "nodes": {
            "root": manifest["root"],
            "intact": manifest["intact"],
            "shards": manifest["shards"],
            "collider": manifest["collider"],
        },
        "meshes": checks,
        "intactTriangles": checks[0]["triangles"],
        "triangleTotalIncludingShards": sum(check["triangles"] for check in checks),
        "volumeRelativeError": volume_error,
        "dimensionsMetres": list(high - low),
        "dimensionMaxErrorMetres": dimension_error,
        "centralMouthRayZMetres": hits,
        "materialSlots": material_names,
        "physicalMaterials": {
            name: {
                "transmission": transmissions[name],
                "ior": encoded_materials[name]
                .get("extensions", {})
                .get("KHR_materials_ior", {})
                .get("ior"),
                "baseColorTexture": "baseColorTexture"
                in encoded_materials[name].get("pbrMetallicRoughness", {}),
            }
            for name in sorted(required_materials)
        },
        "transmissionMask": transmission_mask_report,
        "uv0NormalsPreserved": True,
        "renderPrimitiveCount": len(rendered_primitives),
        "tangentsOnEveryRenderedPrimitive": True,
        "colliderPrimitiveCount": len(collider_primitives),
        "colliderTangentsRequired": False,
        "colliderHasTangents": all(
            "TANGENT" in primitive["attributes"] for primitive in collider_primitives
        ),
        "embeddedImages": len(encoded.get("images", [])),
        "reproduction": production_receipt(slug),
        "scope": "Closedness, orientation, self-intersection, volume reconstruction, open-mouth ray, bounds, node names, materials, and embedded GLB resources.",
    }
    path = HERE / "exports" / f"{slug}-fracture-validation-{VERSION}.json"
    path.write_text(json.dumps(report, indent=2) + "\n")
    proof_entries = manifest.get("proofs", {})
    proofs_current = all(
        key in proof_entries
        and (HERE / proof_entries[key]["file"]).is_file()
        and digest(HERE / proof_entries[key]["file"]) == proof_entries[key]["sha256"]
        for key in ("intact", "mouth", "shards")
    )
    manifest["status"] = (
        "geometry, GLB reimport, and visual proof staged; runtime integration pending"
        if proofs_current
        else "geometry and GLB reimport validated; visual proof pending"
    )
    manifest["validationReport"] = str(path.relative_to(HERE))
    manifest["gameplayReadiness"] = "Geometry-authored candidate; runtime collider/placement and gameplay fracture behavior still require integration review."
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print("VESSEL_VALIDATED=" + json.dumps({"assetId": slug, "intactTriangles": checks[0]["triangles"], "shards": len(manifest["shards"]), "volumeRelativeError": volume_error}))
    return report


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def proof_material(name: str, color: tuple[float, float, float], roughness: float) -> bpy.types.Material:
    return physical_material(name, color, roughness, 0.0)


def render(slug: str, config: dict[str, object]) -> dict[str, object]:
    blend = HERE / "sources" / f"{slug}-fracture-{VERSION}.blend"
    manifest_path = HERE / "exports" / f"{slug}-fracture-{VERSION}.json"
    manifest = json.loads(manifest_path.read_text())
    if digest(blend) != manifest["packedBlenderSource"]["sha256"]:
        raise ValueError("Final Blender source changed before proof")
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    intact = bpy.data.objects[manifest["intact"]]
    shards = [bpy.data.objects[name] for name in manifest["shards"]]
    collider = bpy.data.objects[manifest["collider"]]
    collider.hide_render = True
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
    world = scene.world or bpy.data.worlds.new("vessel_proof_world")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.012, 0.020, 0.032, 1.0)
    background.inputs["Strength"].default_value = 0.35
    height = float(config["height"])
    bpy.ops.mesh.primitive_plane_add(size=height * 20, location=(0.0, 0.0, -0.004))
    floor = bpy.context.object
    floor.name = "proof_floor"
    floor.data.materials.append(proof_material("proof_floor_material", (0.035, 0.050, 0.065), 0.62))
    target = Vector((0.0, 0.0, height * 0.52))
    for name, location, energy, size, color in (
        ("proof_key", (height * 1.7, -height * 2.0, height * 2.2), 820.0, height * 1.5, (1.0, 0.78, 0.58)),
        ("proof_fill", (-height * 1.8, -height * 0.7, height * 1.35), 540.0, height * 1.9, (0.55, 0.78, 1.0)),
        ("proof_rim", (height * 0.5, height * 1.8, height * 1.65), 680.0, height * 1.3, (0.60, 1.0, 0.88)),
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
    camera_data = bpy.data.cameras.new("proof_camera")
    camera_data.lens = 62
    camera = bpy.data.objects.new("proof_camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (height * 1.25, -height * 2.25, height * 1.12)
    point_at(camera, target)
    scene.camera = camera
    proof_dir = HERE / "proofs"
    proof_dir.mkdir(parents=True, exist_ok=True)
    intact_path = proof_dir / f"{slug}-intact-{VERSION}.png"
    mouth_path = proof_dir / f"{slug}-mouth-{VERSION}.png"
    exploded_path = proof_dir / f"{slug}-shards-{VERSION}.png"
    intact.hide_render = False
    for shard in shards:
        shard.hide_render = True
    scene.render.filepath = str(intact_path)
    bpy.ops.render.render(write_still=True)
    camera.location = (height * 0.72, -height * 1.18, height * 1.56)
    camera_data.lens = 72
    point_at(camera, Vector((0.0, 0.0, height * 0.76)))
    scene.render.filepath = str(mouth_path)
    bpy.ops.render.render(write_still=True)
    intact.hide_render = True
    for shard in shards:
        shard.hide_render = False
        centre = shard.location.copy()
        radial = Vector((centre.x, centre.y, 0.0))
        if radial.length < 1e-5:
            radial = Vector((0.15, -0.1, 0.0))
        radial.normalize()
        shard.location += radial * height * 0.055
        shard.location.z += (centre.z - height * 0.48) * 0.12
    camera.location = (height * 1.25, -height * 2.25, height * 1.12)
    camera_data.lens = 56
    point_at(camera, target)
    scene.render.filepath = str(exploded_path)
    bpy.ops.render.render(write_still=True)
    if digest(blend) != manifest["packedBlenderSource"]["sha256"]:
        raise ValueError("Proof render modified the packed source")
    proofs = {
        "status": "rendered from packed final Blender source on CPU/headless Eevee",
        "intact": {
            "file": str(intact_path.relative_to(HERE)),
            "bytes": intact_path.stat().st_size,
            "sha256": digest(intact_path),
        },
        "mouth": {
            "file": str(mouth_path.relative_to(HERE)),
            "bytes": mouth_path.stat().st_size,
            "sha256": digest(mouth_path),
        },
        "shards": {
            "file": str(exploded_path.relative_to(HERE)),
            "bytes": exploded_path.stat().st_size,
            "sha256": digest(exploded_path),
        },
    }
    manifest["proofs"] = proofs
    manifest["status"] = "geometry, GLB reimport, and visual proof staged; runtime integration pending"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print("VESSEL_PROOFS_READY=" + json.dumps({"assetId": slug, "intact": str(intact_path), "mouth": str(mouth_path), "shards": str(exploded_path)}))
    return proofs


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", choices=sorted(ASSETS), required=True)
    parser.add_argument("--phase", choices=("prepare", "fracture", "validate", "render"), required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    config = ASSETS[args.asset]
    {"prepare": prepare, "fracture": fracture, "validate": validate, "render": render}[args.phase](args.asset, config)


if __name__ == "__main__":
    main()
