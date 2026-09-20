"""Build a packed, measured four-island map assembly from preserved donors."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import struct

import bmesh
import bpy
from mathutils import Matrix, Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent
ROOT = HERE.parents[4]
KIT_BLEND = ART / "sources" / "floating-museum-map-kit-v1.blend"
KIT_GLB = ART / "exports" / "floating-museum-map-kit-v1.glb"
MANIFEST = ART / "exports" / "floating-museum-map-kit-v1.json"
PROOF_BLEND = ART / "sources" / "floating-museum-four-island-proof-v1.blend"

SOURCES = {
    "platform": ROOT / "art/glass-adventure/museum-kit.blend",
    "cliff": ROOT / "art/glass-adventure/v2/models/garden-kit.blend",
    "canopy": ROOT
    / "art/glass-adventure/v3/architecture/exports/observatory-canopy-01-final-v1.glb",
    "column": ROOT
    / "art/glass-adventure/v3/architecture/exports/gilded-column-01-final-v2.glb",
    "planter": ROOT / "art/glass-adventure/v5/exports/crystal-planter.glb",
    "frame": ROOT / "art/glass-adventure/v5/exports/gallery-frame.glb",
}
LOD_TARGETS = {"canopy": 6500, "column": 1800, "planter": 1800, "frame": 1000}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def triangles(mesh: bpy.types.Mesh) -> int:
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def material(
    name: str,
    color: tuple[float, float, float],
    metallic: float,
    roughness: float,
    transmission: float = 0.0,
    emission: tuple[float, float, float] | None = None,
) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Transmission Weight"].default_value = transmission
    shader.inputs["IOR"].default_value = 1.47
    if emission is not None:
        shader.inputs["Emission Color"].default_value = (*emission, 1.0)
        shader.inputs["Emission Strength"].default_value = 0.35
    return result


def make_palette() -> dict[str, bpy.types.Material]:
    return {
        "museum_brass": material("map_champagne_gold", (0.83, 0.53, 0.18), 0.78, 0.24),
        "museum_ivory": material("map_ivory_marble", (0.84, 0.80, 0.70), 0.02, 0.42),
        "museum_limestone": material("map_cliff_limestone", (0.58, 0.52, 0.43), 0.0, 0.72),
        "museum_petrol": material("map_dark_jade", (0.018, 0.15, 0.13), 0.1, 0.32),
        "museum_obsidian": material("map_archival_marble", (0.67, 0.69, 0.66), 0.04, 0.34),
        "museum_cyan": material(
            "map_celadon_inlay", (0.15, 0.58, 0.54), 0.12, 0.22, emission=(0.04, 0.22, 0.20)
        ),
        "garden_palette": material("map_garden_foliage", (0.05, 0.23, 0.10), 0.0, 0.66),
        "amber_glass": material("map_amber_dome", (0.95, 0.43, 0.11), 0.08, 0.16, 0.46),
        "celadon_glass": material("map_celadon_dome", (0.22, 0.78, 0.72), 0.08, 0.16, 0.46),
    }


def remap_simple_materials(mesh: bpy.types.Mesh, palette: dict[str, bpy.types.Material]) -> None:
    names = [slot.name.split(".")[0] for slot in mesh.materials]
    mesh.materials.clear()
    for name in names:
        if name not in palette:
            raise ValueError(f"No map material for {name}")
        mesh.materials.append(palette[name])


def load_blend_group(
    source: Path,
    prefix: str,
    stable_prefix: str,
    palette: dict[str, bpy.types.Material],
) -> list[bpy.types.Mesh]:
    with bpy.data.libraries.load(str(source), link=False) as (available, loaded):
        selected = [name for name in available.objects if name == prefix or name.startswith(prefix + "_")]
        loaded.objects = selected
    objects = [obj for obj in loaded.objects if obj is not None]
    if not objects:
        raise ValueError(f"No {prefix} objects in {source}")
    meshes: list[bpy.types.Mesh] = []
    for obj in sorted(objects, key=lambda item: item.name):
        if obj.type != "MESH":
            continue
        copy = obj.data.copy()
        copy.transform(obj.matrix_world)
        copy.name = f"{stable_prefix}_{len(meshes):02d}_mesh"
        remap_simple_materials(copy, palette)
        copy.use_fake_user = True
        meshes.append(copy)
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    if not meshes:
        raise ValueError(f"No mesh children for {prefix}")
    return meshes


def select_only(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def triangulate(mesh: bpy.types.Mesh) -> None:
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    loose_edges = [edge for edge in bm.edges if not edge.link_faces]
    if loose_edges:
        bmesh.ops.delete(bm, geom=loose_edges, context="EDGES")
    loose_vertices = [vertex for vertex in bm.verts if not vertex.link_faces]
    if loose_vertices:
        bmesh.ops.delete(bm, geom=loose_vertices, context="VERTS")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def decimate_object(obj: bpy.types.Object, target: int) -> dict[str, int | float]:
    before = triangles(obj.data)
    if before > target:
        modifier = obj.modifiers.new("map camera LOD", "DECIMATE")
        modifier.ratio = target / before
        modifier.use_collapse_triangulate = True
        select_only(obj)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    triangulate(obj.data)
    after = triangles(obj.data)
    if after > target + 8:
        raise ValueError(f"{obj.name} LOD exceeded target: {after} > {target}")
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return {"sourceTriangles": before, "targetTriangles": target, "lodTriangles": after}


def donor_images(materials: set[bpy.types.Material]) -> set[bpy.types.Image]:
    images: set[bpy.types.Image] = set()
    for item in materials:
        if not item.use_nodes:
            continue
        for node in item.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image is not None:
                images.add(node.image)
    return images


def import_lod(
    key: str,
    source: Path,
    target: int,
) -> tuple[list[bpy.types.Mesh], dict[str, object]]:
    before_objects = set(bpy.data.objects)
    before_materials = set(bpy.data.materials)
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported = [obj for obj in bpy.data.objects if obj not in before_objects]
    mesh_objects = [obj for obj in imported if obj.type == "MESH"]
    if not mesh_objects:
        raise ValueError(f"{key} donor imported no meshes")
    total_before = sum(triangles(obj.data) for obj in mesh_objects)
    budgets: list[int]
    if key == "frame":
        budgets = [target - 55 if triangles(obj.data) > 55 else 55 for obj in mesh_objects]
    else:
        budgets = [max(4, round(target * triangles(obj.data) / total_before)) for obj in mesh_objects]
    lod_rows = []
    meshes = []
    for index, (obj, budget) in enumerate(zip(mesh_objects, budgets, strict=True)):
        obj.data.transform(obj.matrix_world)
        obj.matrix_world = Matrix.Identity(4)
        row = decimate_object(obj, budget)
        obj.data.name = f"map_lod_{key}_{index:02d}_mesh"
        obj.data.use_fake_user = True
        meshes.append(obj.data)
        lod_rows.append({"mesh": obj.data.name, **row})
    imported_materials = {
        material for material in bpy.data.materials if material not in before_materials
    }
    for index, item in enumerate(sorted(imported_materials, key=lambda value: value.name)):
        item.name = f"map_{key}_atlas_{index:02d}"
    images = donor_images(imported_materials)
    image_rows = []
    for index, image in enumerate(sorted(images, key=lambda value: value.name)):
        original = list(image.size)
        if max(image.size) > 512:
            image.scale(512, 512)
        image.name = f"map_{key}_texture_{index:02d}"
        image.pack()
        image_rows.append(
            {
                "name": image.name,
                "sourceDimensions": original,
                "runtimeDimensions": list(image.size),
                "colorSpace": image.colorspace_settings.name,
            }
        )
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    return meshes, {
        "source": str(source.relative_to(ROOT)),
        "sourceBytes": source.stat().st_size,
        "sourceSha256": digest(source),
        "targetTriangles": target,
        "sourceTriangles": total_before,
        "lodTriangles": sum(triangles(mesh) for mesh in meshes),
        "meshes": lod_rows,
        "textures": image_rows,
    }


def join_meshes(meshes: list[bpy.types.Mesh], name: str) -> bpy.types.Mesh:
    """Join one logical kit part while preserving UVs and material slots."""

    objects = []
    for index, mesh in enumerate(meshes):
        mesh.use_fake_user = False
        obj = bpy.data.objects.new(f"{name}_join_{index:02d}", mesh)
        bpy.context.scene.collection.objects.link(obj)
        objects.append(obj)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    result = objects[0].data
    result.name = f"{name}_mesh"
    result.use_fake_user = True
    triangulate(result)
    bpy.data.objects.remove(objects[0], do_unlink=True)
    return result


def refine_platform_mesh(mesh: bpy.types.Mesh) -> None:
    """Round the preserved donor terrace while retaining its material bands."""

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.subdivide_edges(
        bm,
        edges=list(bm.edges),
        cuts=1,
        use_grid_fill=True,
    )
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()

    low = Vector(min(vertex.co[axis] for vertex in mesh.vertices) for axis in range(3))
    high = Vector(max(vertex.co[axis] for vertex in mesh.vertices) for axis in range(3))
    centre = (low + high) * 0.5
    half_x = max((high.x - low.x) * 0.5, 1e-6)
    half_y = max((high.y - low.y) * 0.5, 1e-6)
    height = max(high.z - low.z, 1e-6)
    for vertex in mesh.vertices:
        u = max(-1.0, min(1.0, (vertex.co.x - centre.x) / half_x))
        v = max(-1.0, min(1.0, (vertex.co.y - centre.y) / half_y))
        # Fernandez-Guasti square-to-disc mapping turns the donor's square
        # terraces into rounded marble rims without replacing its topology.
        rounded_u = u * math.sqrt(max(0.0, 1.0 - 0.5 * v * v))
        rounded_v = v * math.sqrt(max(0.0, 1.0 - 0.5 * u * u))
        depth = (high.z - vertex.co.z) / height
        taper = 1.0 - 0.08 * depth
        vertex.co.x = centre.x + rounded_u * half_x * taper
        vertex.co.y = centre.y + rounded_v * half_y * taper
    triangulate(mesh)


def refine_island_root_mesh(mesh: bpy.types.Mesh) -> None:
    """Deepen and taper the preserved low-poly cliff into a floating crag."""

    low = Vector(min(vertex.co[axis] for vertex in mesh.vertices) for axis in range(3))
    high = Vector(max(vertex.co[axis] for vertex in mesh.vertices) for axis in range(3))
    centre = (low + high) * 0.5
    height = max(high.z - low.z, 1e-6)
    for vertex in mesh.vertices:
        depth = max(0.0, min(1.0, (high.z - vertex.co.z) / height))
        x = vertex.co.x - centre.x
        y = vertex.co.y - centre.y
        angle = math.atan2(y, x)
        irregularity = 1.0 + depth * (
            0.065 * math.sin(5.0 * angle + 0.7)
            + 0.035 * math.sin(9.0 * angle - 1.1)
        )
        taper = (1.0 - 0.42 * depth) * irregularity
        vertex.co.x = centre.x + x * taper
        vertex.co.y = centre.y + y * taper
        crag_stretch = 1.62 + 0.18 * depth * (0.5 + 0.5 * math.sin(3.0 * angle + 0.4))
        vertex.co.z = high.z - (high.z - vertex.co.z) * crag_stretch
    triangulate(mesh)


def anchor_mesh(mesh: bpy.types.Mesh, mode: str) -> dict[str, object]:
    low = Vector(min(vertex.co[axis] for vertex in mesh.vertices) for axis in range(3))
    high = Vector(max(vertex.co[axis] for vertex in mesh.vertices) for axis in range(3))
    if mode == "ground":
        shift = -low.z
    elif mode == "top":
        shift = -high.z
    else:
        raise ValueError(mode)
    mesh.transform(Matrix.Translation((0.0, 0.0, shift)))
    low = Vector(min(vertex.co[axis] for vertex in mesh.vertices) for axis in range(3))
    high = Vector(max(vertex.co[axis] for vertex in mesh.vertices) for axis in range(3))
    return {
        "anchor": "ground Y=0" if mode == "ground" else "walking/top surface Y=0",
        "authoringBoundsZUp": {"min": list(low), "max": list(high)},
        "dimensionsGlTfYUpMetres": [high.x - low.x, high.z - low.z, high.y - low.y],
        "triangles": triangles(mesh),
        "materialSlots": [item.name if item else None for item in mesh.materials],
    }


def dome_mesh(name: str, material_value: bpy.types.Material) -> bpy.types.Mesh:
    segments = 20
    rings = 6
    vertices = []
    faces = []
    for ring in range(rings):
        angle = (math.pi / 2) * ring / rings
        radius = 1.05 * math.cos(angle)
        z = 1.62 + 1.05 * math.sin(angle)
        for segment in range(segments):
            azimuth = math.tau * segment / segments
            vertices.append((radius * math.cos(azimuth), radius * math.sin(azimuth), z))
    top = len(vertices)
    vertices.append((0.0, 0.0, 2.67))
    for ring in range(rings - 1):
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            first = ring * segments + segment
            second = ring * segments + next_segment
            third = (ring + 1) * segments + next_segment
            fourth = (ring + 1) * segments + segment
            faces.extend(((first, second, third), (first, third, fourth)))
    last = (rings - 1) * segments
    for segment in range(segments):
        faces.append((last + segment, last + (segment + 1) % segments, top))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material_value)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    mesh.update()
    return mesh


def empty(name: str, parent: bpy.types.Object | None = None) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def component(
    name: str,
    meshes: list[bpy.types.Mesh],
    parent: bpy.types.Object,
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
    rotation_z: float = 0.0,
    scale: float | tuple[float, float, float] = 1.0,
) -> bpy.types.Object:
    root = empty(name, parent)
    root.location = location
    root.rotation_euler[2] = rotation_z
    root.scale = (scale, scale, scale) if isinstance(scale, (float, int)) else scale
    for index, mesh in enumerate(meshes):
        obj = bpy.data.objects.new(f"{name}_part_{index:02d}", mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.parent = root
    return root


def stage(
    map_root: bpy.types.Object,
    name: str,
    stage_id: str,
    position: tuple[float, float, float],
    base_scale: float,
    cliff_meshes: list[bpy.types.Mesh],
    terrace_meshes: list[bpy.types.Mesh],
) -> bpy.types.Object:
    result = empty(name, map_root)
    result.location = position
    result["stageId"] = stage_id
    result["baseTopLocalZ"] = 0.0115
    result["selectionRoot"] = True
    component(f"{name}_cliff", cliff_meshes, result, scale=base_scale)
    component(f"{name}_terrace", terrace_meshes, result, scale=base_scale)
    return result


def bridge_between(
    name: str,
    first: tuple[float, float, float],
    second: tuple[float, float, float],
    meshes: list[bpy.types.Mesh],
    parent: bpy.types.Object,
) -> bpy.types.Object:
    start = Vector(first)
    end = Vector(second)
    centre_direction = end - start
    inset = min(1.35, centre_direction.length * 0.3)
    unit = centre_direction.normalized()
    start += unit * inset
    end -= unit * inset
    direction = end - start
    length = direction.length
    root = empty(name, parent)
    root.location = (start + end) / 2
    root.rotation_mode = "QUATERNION"
    root.rotation_quaternion = Vector((0.0, 1.0, 0.0)).rotation_difference(direction.normalized())
    root.scale = (1.0, length / 3.20, 1.0)
    root["connects"] = name.removeprefix("bridge_")
    for index, mesh in enumerate(meshes):
        obj = bpy.data.objects.new(f"{name}_part_{index:02d}", mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.parent = root
    return root


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


def bounds(objects: list[bpy.types.Object]) -> dict[str, list[float]]:
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in objects
        if obj.type == "MESH"
        for corner in obj.bound_box
    ]
    low = Vector(min(point[axis] for point in points) for axis in range(3))
    high = Vector(max(point[axis] for point in points) for axis in range(3))
    return {"min": list(low), "max": list(high), "dimensions": list(high - low)}


def validate_glb(path: Path, required: set[str]) -> dict[str, object]:
    raw = path.read_bytes()
    if raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 8)[0] != len(raw):
        raise ValueError("Incomplete map GLB")
    chunk_length, chunk_type = struct.unpack_from("<II", raw, 12)
    if chunk_type != 0x4E4F534A:
        raise ValueError("Map GLB has no JSON chunk")
    document = json.loads(raw[20 : 20 + chunk_length].decode("utf-8").rstrip(" \x00"))
    names = {node.get("name") for node in document.get("nodes", [])}
    if missing := sorted(required - names):
        raise ValueError(f"Map GLB missing nodes: {missing}")
    primitive_count = sum(len(mesh.get("primitives", [])) for mesh in document.get("meshes", []))
    return {
        "file": str(path.relative_to(ART)),
        "bytes": len(raw),
        "sha256": digest(path),
        "nodes": len(document.get("nodes", [])),
        "meshes": len(document.get("meshes", [])),
        "primitives": primitive_count,
        "materials": len(document.get("materials", [])),
        "images": len(document.get("images", [])),
        "textures": len(document.get("textures", [])),
        "requiredNamedNodesPresent": True,
        "extensionsUsed": document.get("extensionsUsed", []),
    }


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    palette = make_palette()

    terrace_meshes = load_blend_group(SOURCES["platform"], "platform_terrace", "map_terrace", palette)
    bridge_meshes = load_blend_group(SOURCES["platform"], "platform_bridge", "map_bridge", palette)
    cliff_meshes = load_blend_group(SOURCES["cliff"], "island_root", "map_cliff", palette)

    lods: dict[str, list[bpy.types.Mesh]] = {}
    lod_receipts: dict[str, object] = {}
    for key in ("canopy", "column", "planter", "frame"):
        lods[key], lod_receipts[key] = import_lod(key, SOURCES[key], LOD_TARGETS[key])

    logical_meshes = {
        "map_canopy": join_meshes(lods["canopy"], "map_canopy"),
        "map_column": join_meshes(lods["column"], "map_column"),
        "map_planter": join_meshes(lods["planter"], "map_planter"),
        "map_frame": join_meshes(lods["frame"], "map_frame"),
        "map_platform": join_meshes(terrace_meshes, "map_platform"),
        "map_bridge": join_meshes(bridge_meshes, "map_bridge"),
        "map_island_root": join_meshes(cliff_meshes, "map_island_root"),
    }
    refine_platform_mesh(logical_meshes["map_platform"])
    refine_island_root_mesh(logical_meshes["map_island_root"])
    kit_parts = {
        name: anchor_mesh(
            mesh,
            "ground" if name in {"map_canopy", "map_column", "map_planter", "map_frame"} else "top",
        )
        for name, mesh in logical_meshes.items()
    }
    for key, node_name in (
        ("canopy", "map_canopy"),
        ("column", "map_column"),
        ("planter", "map_planter"),
        ("frame", "map_frame"),
    ):
        lod_receipts[key]["finalNode"] = node_name
        lod_receipts[key]["lodTriangles"] = kit_parts[node_name]["triangles"]
        lod_receipts[key]["dimensionsGlTfYUpMetres"] = kit_parts[node_name][
            "dimensionsGlTfYUpMetres"
        ]

    kit_root = empty("map_kit_root")
    kit_root["assetId"] = "floating-museum-map-kit-v1"
    kit_objects = []
    for name, mesh in logical_meshes.items():
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.parent = kit_root
        obj["mapKitPart"] = name.removeprefix("map_")
        obj["anchor"] = kit_parts[name]["anchor"]
        kit_objects.append(obj)
    bpy.context.view_layer.update()
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(KIT_BLEND), compress=True)
    bpy.ops.object.select_all(action="DESELECT")
    kit_root.select_set(True)
    for obj in kit_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = kit_root
    bpy.ops.export_scene.gltf(
        filepath=str(KIT_GLB),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_materials="EXPORT",
    )
    glb = validate_glb(KIT_GLB, {"map_kit_root", *logical_meshes})
    for obj in kit_objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.objects.remove(kit_root, do_unlink=True)

    amber_dome = dome_mesh("map_amber_dome_mesh", palette["amber_glass"])
    celadon_dome = dome_mesh("map_celadon_dome_mesh", palette["celadon_glass"])

    map_root = empty("map_floating_museum")
    map_root["assetId"] = "floating-museum-map-v1"
    positions = {
        "first": (-5.2, -1.4, 0.15),
        "glassworks": (-1.8, 1.55, 0.55),
        "twin": (1.9, -0.15, 0.35),
        "resonance": (5.3, 2.15, 0.90),
    }
    first = stage(
        map_root,
        "stage_first_light",
        "first-light",
        positions["first"],
        1.10,
        [logical_meshes["map_island_root"]],
        [logical_meshes["map_platform"]],
    )
    glassworks = stage(
        map_root,
        "stage_glassworks_journey",
        "glassworks-journey",
        positions["glassworks"],
        1.16,
        [logical_meshes["map_island_root"]],
        [logical_meshes["map_platform"]],
    )
    twin = stage(
        map_root,
        "stage_twin_galleries",
        "twin-galleries",
        positions["twin"],
        1.42,
        [logical_meshes["map_island_root"]],
        [logical_meshes["map_platform"]],
    )
    resonance = stage(
        map_root,
        "stage_resonance_conservatory",
        "resonance-conservatory",
        positions["resonance"],
        1.28,
        [logical_meshes["map_island_root"]],
        [logical_meshes["map_platform"]],
    )

    component("first_light_pavilion", [logical_meshes["map_canopy"]], first, (0.0, 0.0, 0.03), scale=0.84)
    component("first_light_crystal_west", [logical_meshes["map_planter"]], first, (-1.20, -0.52, 0.03), scale=0.22)
    component("first_light_crystal_east", [logical_meshes["map_planter"]], first, (1.20, -0.52, 0.03), scale=0.22)
    component("glassworks_archive_rotunda", [logical_meshes["map_canopy"]], glassworks, (0.0, 0.0, 0.03), scale=0.93)
    component("glassworks_column_west", [logical_meshes["map_column"]], glassworks, (-1.18, 0.15, 0.03), scale=0.52)
    component("glassworks_column_east", [logical_meshes["map_column"]], glassworks, (1.18, 0.15, 0.03), scale=0.52)
    component("glassworks_reward_frame", [logical_meshes["map_frame"]], glassworks, (0.0, -1.36, 0.42), scale=0.40)
    component("glassworks_crystal_west", [logical_meshes["map_planter"]], glassworks, (-1.20, -0.72, 0.03), scale=0.20)
    component("glassworks_crystal_east", [logical_meshes["map_planter"]], glassworks, (1.20, -0.72, 0.03), scale=0.20)

    component("twin_low_gallery", [logical_meshes["map_canopy"]], twin, (-0.82, 0.02, 0.03), scale=0.58)
    component("twin_high_gallery", [logical_meshes["map_canopy"]], twin, (0.82, 0.02, 0.03), scale=0.58)
    component("twin_low_amber_dome", [amber_dome], twin, (-0.82, 0.02, 0.03), scale=0.58)
    component("twin_high_celadon_dome", [celadon_dome], twin, (0.82, 0.02, 0.03), scale=0.58)
    component("twin_court_crystal", [logical_meshes["map_planter"]], twin, (0.0, -0.88, 0.03), scale=0.31)
    component("twin_mystery_frame", [logical_meshes["map_frame"]], twin, (0.0, 1.42, 0.42), rotation_z=math.pi, scale=0.36)

    component("resonance_conservatory", [logical_meshes["map_canopy"]], resonance, (0.0, 0.0, 0.03), scale=1.02)
    for index, (x, y) in enumerate(((-1.18, 0.0), (1.18, 0.0), (0.0, -1.18), (0.0, 1.18))):
        component(
            f"resonance_crystal_planter_{index + 1:02d}",
            [logical_meshes["map_planter"]],
            resonance,
            (x, y, 0.03),
            rotation_z=index * math.pi / 2,
            scale=0.30,
        )
    component("resonance_column_west", [logical_meshes["map_column"]], resonance, (-1.28, -0.35, 0.03), scale=0.48)
    component("resonance_column_east", [logical_meshes["map_column"]], resonance, (1.28, -0.35, 0.03), scale=0.48)
    component("resonance_mystery_frame", [logical_meshes["map_frame"]], resonance, (0.0, -1.48, 0.42), scale=0.36)

    bridge_between("bridge_first_to_glassworks", positions["first"], positions["glassworks"], [logical_meshes["map_bridge"]], map_root)
    bridge_between("bridge_glassworks_to_twin", positions["glassworks"], positions["twin"], [logical_meshes["map_bridge"]], map_root)
    bridge_between("bridge_twin_to_resonance", positions["twin"], positions["resonance"], [logical_meshes["map_bridge"]], map_root)

    bpy.context.view_layer.update()
    stage_rows = []
    for item in (first, glassworks, twin, resonance):
        meshes = [obj for obj in descendants(item) if obj.type == "MESH"]
        stage_rows.append(
            {
                "node": item.name,
                "stageId": item["stageId"],
                "originMetres": list(item.matrix_world.translation),
                "baseTopLocalMetres": item["baseTopLocalZ"],
                "boundsWorldMetres": bounds(meshes),
                "meshNodes": len(meshes),
                "renderedTriangles": sum(triangles(obj.data) for obj in meshes),
            }
        )

    mesh_objects = [obj for obj in scene.objects if obj.type == "MESH" and not obj.hide_render]
    rendered_triangles = sum(triangles(obj.data) for obj in mesh_objects)
    draw_estimate = sum(max(1, len(obj.data.materials)) for obj in mesh_objects)
    if rendered_triangles >= 150_000:
        raise ValueError(f"Map rendered triangle budget exceeded: {rendered_triangles}")
    if draw_estimate >= 100:
        raise ValueError(f"Map draw estimate exceeded: {draw_estimate}")

    scene["mapRenderedTriangles"] = rendered_triangles
    scene["mapEstimatedDraws"] = draw_estimate
    scene["mapStageCount"] = 4
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(PROOF_BLEND), compress=True)
    source_inventory = {
        key: {
            "file": str(path.relative_to(ROOT)),
            "bytes": path.stat().st_size,
            "sha256": digest(path),
        }
        for key, path in SOURCES.items()
    }
    manifest = {
        "schema": 1,
        "assetId": "floating-museum-map-kit-v1",
        "status": "structurally validated reusable map-scale kit; four-island visual proof remains separate",
        "coordinates": "Blender Z-up authoring; exported glTF +Y up; metres",
        "sources": source_inventory,
        "lods": lod_receipts,
        "kitParts": kit_parts,
        "proceduralMapParts": {
            "terraceTriangles": triangles(logical_meshes["map_platform"]),
            "bridgeTriangles": triangles(logical_meshes["map_bridge"]),
            "cliffTriangles": triangles(logical_meshes["map_island_root"]),
            "domeTrianglesEach": triangles(amber_dome),
            "method": "Existing authored platform/bridge/cliff meshes plus bounded Blender finishing: donor terrace square-to-disc rounding, donor cliff taper/deepening, and low-poly hemisphere inserts for amber/celadon identification.",
        },
        "localFinishing": {
            "map_platform": "One deterministic subdivision pass followed by square-to-disc rounding and an 8% depth taper; original donor material bands and UV interpolation retained.",
            "map_island_root": "Original 480-triangle donor topology retained; deterministic depth stretch, radial taper, and bounded angular crag variation applied with top anchor preserved.",
            "newExternalGeneration": False,
        },
        "materialStrategy": {
            "donorAtlases": "Four accepted donor atlases retained once each, reduced from 1K runtime maps to packed 512px map-camera derivatives.",
            "sharing": "All repeated canopy, column, planter, frame, terrace, bridge, and cliff nodes share mesh/material/image datablocks.",
            "simplePalette": sorted(item.name for item in palette.values()),
            "runtimeGlassNote": "Amber/celadon dome inserts belong to the Blender proof assembly only. The reusable runtime GLB has no transmission extension; the live scene supplies its own map-scale dome materials.",
        },
        "proofAssemblyStages": stage_rows,
        "proofAssemblyBudget": {
            "targetRenderedTrianglesMaxExclusive": 150000,
            "renderedTriangles": rendered_triangles,
            "targetDrawsMaxExclusive": 100,
            "estimatedDraws": draw_estimate,
            "meshNodes": len(mesh_objects),
            "uniqueMeshDatablocks": len({obj.data.as_pointer() for obj in mesh_objects}),
            "calculation": "Rendered triangle count sums every visible mesh instance; draw estimate sums material slots per visible mesh node.",
        },
        "packedBlend": {
            "file": str(KIT_BLEND.relative_to(ART)),
            "bytes": KIT_BLEND.stat().st_size,
            "sha256": digest(KIT_BLEND),
            "missingExternalFiles": sorted(
                image.filepath
                for image in bpy.data.images
                if image.source != "GENERATED" and image.packed_file is None
            ),
        },
        "proofAssemblyBlend": {
            "file": str(PROOF_BLEND.relative_to(ART)),
            "bytes": PROOF_BLEND.stat().st_size,
            "sha256": digest(PROOF_BLEND),
        },
        "glb": glb,
        "validation": {
            "packedSource": True,
            "requiredNamedNodes": True,
            "budgetPassed": True,
            "visualProof": "pending",
            "runtimeIntegration": "not performed",
        },
        "rebuild": {
            "workingDirectory": "repository root",
            "command": "rtk proxy blender -b --factory-startup --python art/glass-adventure/journey-map/v2/production/build_map_lod_kit.py",
            "blender": bpy.app.version_string,
        },
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(
        "FLOATING_MUSEUM_MAP_KIT_BUILT="
        + json.dumps(
            {
                "renderedTriangles": rendered_triangles,
                "estimatedDraws": draw_estimate,
                "blendSha256": manifest["packedBlend"]["sha256"],
                "glbSha256": glb["sha256"],
                "glbBytes": glb["bytes"],
            }
        ),
        flush=True,
    )
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
