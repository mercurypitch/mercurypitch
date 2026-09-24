"""Normalize Level 2 Meshy donors and preserve reviewable Blender/game derivatives."""

from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector


HERE = Path(__file__).resolve().parent
SKIP_PROOFS = "--skip-proofs" in sys.argv

ASSETS = [
    {
        "slug": "amber-cadence-urn",
        "root": "breakable_l2_low_amber_urn",
        "height": 0.72,
        "kind": "breakable-vessel",
        "gallery": "lower-warm-amber",
        "intendedUse": "Low-note hero vessel; broad silhouette at a lower display height.",
        "collider": "cylinder",
    },
    {
        "slug": "celadon-lark-decanter",
        "root": "breakable_l2_high_celadon_decanter",
        "height": 1.15,
        "kind": "breakable-vessel",
        "gallery": "upper-cool-celadon",
        "intendedUse": "High-note hero vessel; tall silhouette at a raised display height.",
        "collider": "cylinder",
    },
    {
        "slug": "twin-tone-resonance-harp",
        "root": "decor_l2_twin_tone_resonance_harp",
        "height": 1.65,
        "kind": "reusable-decoration",
        "gallery": "shared-court",
        "intendedUse": "Nonblocking court landmark expressing the taught low/high pair.",
        "collider": "base-box",
    },
    {
        "slug": "opaline-echo-amphora",
        "root": "breakable_l2_opaline_echo_amphora",
        "height": 0.92,
        "kind": "breakable-vessel",
        "gallery": "optional-side-exhibit",
        "intendedUse": "Optional paired-note side-exhibit vessel.",
        "collider": "cylinder",
    },
]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def json_path(path: Path) -> str:
    return str(path.relative_to(HERE))


def scene_bounds(objects: list[bpy.types.Object]) -> dict[str, list[float]]:
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    low = [min(point[axis] for point in points) for axis in range(3)]
    high = [max(point[axis] for point in points) for axis in range(3)]
    return {
        "min": low,
        "max": high,
        "dimensions": [high[axis] - low[axis] for axis in range(3)],
    }


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result = []
    pending = list(root.children)
    while pending:
        obj = pending.pop(0)
        result.append(obj)
        pending.extend(obj.children)
    return result


def mesh_topology(objects: list[bpy.types.Object]) -> dict[str, int]:
    triangles = 0
    vertices = 0
    edges = 0
    boundary_edges = 0
    non_manifold_edges = 0
    loose_edges = 0
    for obj in objects:
        mesh = obj.data
        triangles += sum(max(1, len(polygon.vertices) - 2) for polygon in mesh.polygons)
        vertices += len(mesh.vertices)
        edges += len(mesh.edges)
        bm = bmesh.new()
        bm.from_mesh(mesh)
        boundary_edges += sum(edge.is_boundary for edge in bm.edges)
        non_manifold_edges += sum(not edge.is_manifold for edge in bm.edges)
        loose_edges += sum(not edge.link_faces for edge in bm.edges)
        bm.free()
    return {
        "meshObjects": len(objects),
        "vertices": vertices,
        "edges": edges,
        "triangles": triangles,
        "boundaryEdges": boundary_edges,
        "nonManifoldEdges": non_manifold_edges,
        "looseEdges": loose_edges,
    }


def referenced_images(materials: list[bpy.types.Material]) -> list[bpy.types.Image]:
    found = {}
    for material in materials:
        if not material or not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image is not None:
                found[node.image.name] = node.image
    return [found[name] for name in sorted(found)]


def image_inventory(images: list[bpy.types.Image]) -> list[dict[str, object]]:
    return [
        {
            "name": image.name,
            "dimensions": list(image.size),
            "colorSpace": image.colorspace_settings.name,
            "packed": image.packed_file is not None,
        }
        for image in images
    ]


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
    target: Vector,
) -> bpy.types.Object:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    point_at(obj, target)
    return obj


def render_proof(slug: str, bounds: dict[str, list[float]], root: bpy.types.Object) -> Path:
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    proof = HERE / "proofs" / f"{slug}-normalized.png"
    scene.render.filepath = str(proof)

    dimensions = bounds["dimensions"]
    height = dimensions[2]
    span = max(dimensions)
    target = Vector((0.0, 0.0, height * 0.48))

    world = scene.world or bpy.data.worlds.new("level2-proof-world")
    scene.world = world
    world.use_nodes = True
    background = next(node for node in world.node_tree.nodes if node.type == "BACKGROUND")
    background.inputs["Color"].default_value = (0.018, 0.026, 0.038, 1.0)
    background.inputs["Strength"].default_value = 0.35

    bpy.ops.mesh.primitive_plane_add(size=max(20.0, span * 12), location=(0.0, 0.0, -0.004))
    floor = bpy.context.object
    floor.name = "proof_floor"
    floor_material = bpy.data.materials.new("proof_floor_material")
    floor_material.use_nodes = True
    shader = next(node for node in floor_material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = (0.025, 0.034, 0.048, 1.0)
    shader.inputs["Roughness"].default_value = 0.76
    floor.data.materials.append(floor_material)

    camera_data = bpy.data.cameras.new("proof_camera")
    camera_data.lens = 58
    camera = bpy.data.objects.new("proof_camera", camera_data)
    scene.collection.objects.link(camera)
    distance = span * 2.45
    camera.location = (distance * 0.72, -distance, height * 0.78)
    point_at(camera, target)
    scene.camera = camera

    helpers = [floor, camera]
    helpers.append(add_area_light("proof_key", (span * 2.1, -span * 2.4, height * 2.2), 950, span * 1.7, (1.0, 0.82, 0.64), target))
    helpers.append(add_area_light("proof_fill", (-span * 2.2, -span * 0.8, height * 1.35), 620, span * 2.1, (0.52, 0.72, 1.0), target))
    helpers.append(add_area_light("proof_rim", (span * 0.6, span * 2.0, height * 1.7), 760, span * 1.4, (0.52, 0.9, 1.0), target))

    for obj in descendants(root):
        if obj.get("collision_proxy"):
            obj.hide_render = True
    proof.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)
    if not proof.is_file() or proof.stat().st_size == 0:
        raise RuntimeError(f"Proof render failed for {slug}")

    for helper in helpers:
        bpy.data.objects.remove(helper, do_unlink=True)
    bpy.data.materials.remove(floor_material, do_unlink=True)
    return proof


def make_collision_proxy(
    asset: dict[str, object], bounds: dict[str, list[float]], root: bpy.types.Object
) -> tuple[bpy.types.Object, dict[str, object]]:
    dx, dy, dz = bounds["dimensions"]
    name = f"COLLIDER_{asset['root']}"
    if asset["collider"] == "base-box":
        proxy_dimensions = (dx * 0.88, dy * 0.88, dz * 0.17)
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, proxy_dimensions[2] / 2))
        proxy = bpy.context.object
        proxy.dimensions = proxy_dimensions
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        shape = "box"
    else:
        radius = min(dx, dy) * 0.41
        depth = dz * 0.72
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=depth, location=(0.0, 0.0, depth / 2))
        proxy = bpy.context.object
        proxy_dimensions = tuple(proxy.dimensions)
        shape = "16-sided-cylinder"
    proxy.name = name
    proxy.data.name = f"{name}_mesh"
    proxy.display_type = "WIRE"
    proxy.hide_render = True
    proxy["collision_proxy"] = True
    proxy["collision_shape"] = shape
    proxy.parent = root
    return proxy, {
        "name": name,
        "shape": shape,
        "dimensionsMetres": list(proxy_dimensions),
        "locationMetres": list(proxy.location),
        "authoredForReview": True,
    }


def import_and_normalize(asset: dict[str, object]) -> tuple[dict[str, object], Path, Path, Path]:
    slug = str(asset["slug"])
    donor = HERE / "meshy" / f"{slug}-donor.glb"
    source_blend = HERE / "sources" / f"{slug}-normalized-v1.blend"
    export = HERE / "exports" / f"{slug}-game-v1.glb"
    proof = HERE / "proofs" / f"{slug}-normalized.png"

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.length_unit = "METERS"
    bpy.ops.import_scene.gltf(filepath=str(donor))
    imported = list(bpy.context.scene.objects)
    mesh_objects = [obj for obj in imported if obj.type == "MESH"]
    if not mesh_objects:
        raise RuntimeError(f"{slug}: Meshy donor contains no mesh")

    donor_topology = mesh_topology(mesh_objects)
    donor_bounds = scene_bounds(mesh_objects)
    if donor_bounds["dimensions"][2] <= 0:
        raise RuntimeError(f"{slug}: invalid donor height")

    centre_x = (donor_bounds["min"][0] + donor_bounds["max"][0]) / 2
    centre_y = (donor_bounds["min"][1] + donor_bounds["max"][1]) / 2
    min_z = donor_bounds["min"][2]
    scale = float(asset["height"]) / donor_bounds["dimensions"][2]
    normalizer = Matrix.Scale(scale, 4) @ Matrix.Translation((-centre_x, -centre_y, -min_z))
    top_level = [obj for obj in imported if obj.parent is None]
    for obj in top_level:
        obj.matrix_world = normalizer @ obj.matrix_world
    bpy.context.view_layer.update()

    root = bpy.data.objects.new(str(asset["root"]), None)
    bpy.context.scene.collection.objects.link(root)
    root["asset_id"] = slug
    root["asset_kind"] = str(asset["kind"])
    root["gallery_family"] = str(asset["gallery"])
    root["units"] = "metres"
    for obj in top_level:
        world = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_world = world

    mesh_objects = [obj for obj in descendants(root) if obj.type == "MESH"]
    for index, obj in enumerate(sorted(mesh_objects, key=lambda item: item.name), start=1):
        obj.name = f"{slug.replace('-', '_')}_mesh_{index:02d}"
        obj.data.name = f"{obj.name}_geometry"
    bpy.context.view_layer.update()

    final_bounds = scene_bounds(mesh_objects)
    if abs(final_bounds["min"][2]) > 1e-5:
        raise RuntimeError(f"{slug}: normalization did not ground the mesh")
    if abs(final_bounds["dimensions"][2] - float(asset["height"])) > 1e-5:
        raise RuntimeError(f"{slug}: normalized height mismatch")

    materials = sorted(
        {material for obj in mesh_objects for material in obj.data.materials if material},
        key=lambda material: material.name,
    )
    images = referenced_images(materials)
    for material_index, material in enumerate(materials, start=1):
        material.name = f"{slug.replace('-', '_')}_atlas_{material_index:02d}"
    for image in images:
        image.pack()

    proxy, collision = make_collision_proxy(asset, final_bounds, root)
    bpy.ops.file.pack_all()
    source_blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(source_blend), check_existing=False)
    source_hash = digest(source_blend)
    source_images = image_inventory(images)

    if not SKIP_PROOFS:
        render_proof(slug, final_bounds, root)

    for image in images:
        width, height = image.size
        if max(width, height) > 1024:
            ratio = 1024 / max(width, height)
            image.scale(max(1, round(width * ratio)), max(1, round(height * ratio)))
    runtime_images = image_inventory(images)

    bpy.ops.object.select_all(action="DESELECT")
    export_objects = [root, *descendants(root)]
    for obj in export_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    export.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(export),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_jpeg_quality=95,
    )
    if digest(source_blend) != source_hash:
        raise RuntimeError(f"{slug}: packed Blender source changed after export")

    topology = mesh_topology(mesh_objects)
    breakable = asset["kind"] == "breakable-vessel"
    inventory = {
        "schema": 1,
        "assetId": slug,
        "kind": asset["kind"],
        "galleryFamily": asset["gallery"],
        "intendedUse": asset["intendedUse"],
        "rootNode": asset["root"],
        "units": "metres",
        "origin": "bottom-centre",
        "dimensionsMetres": final_bounds["dimensions"],
        "donor": {
            "file": json_path(donor),
            "bytes": donor.stat().st_size,
            "sha256": digest(donor),
            "boundsBeforeNormalization": donor_bounds,
            "topology": donor_topology,
        },
        "packedBlenderSource": {
            "file": json_path(source_blend),
            "bytes": source_blend.stat().st_size,
            "sha256": source_hash,
            "textureImages": source_images,
        },
        "gameDerivative": {
            "file": json_path(export),
            "bytes": export.stat().st_size,
            "sha256": digest(export),
            "textureImages": runtime_images,
            "topology": topology,
            "targetTriangleRange": [3000, 10000],
        },
        "proof": (
            {
                "status": "rendered",
                "file": json_path(proof),
                "bytes": proof.stat().st_size,
                "sha256": digest(proof),
            }
            if proof.is_file()
            else {"status": "pending", "file": json_path(proof)}
        ),
        "materials": [material.name for material in materials],
        "collisionProxy": collision,
        "insetReadiness": {
            "status": "not-applicable",
            "surface": None,
            "reason": "This asset has no replaceable painting or mirror inset.",
        },
        "fractureReadiness": {
            "status": "requires-solid-and-shard-validation" if breakable else "not-applicable-decoration",
            "isBreakableCandidate": breakable,
            "boundaryEdgesObserved": topology["boundaryEdges"],
            "nonManifoldEdgesObserved": topology["nonManifoldEdges"],
            "requirementsBeforeGameplay": (
                [
                    "Inspect and repair the authored cavity and wall thickness.",
                    "Author matched intact and closed named shard geometry.",
                    "Validate reconstruction, intersections, GLB reimport, materials, and volume.",
                    "Review the collision proxy against the final mount and camera distance.",
                ]
                if breakable
                else ["Review the base-only proxy in the final court layout."]
            ),
        },
        "lodReadiness": {
            "currentDerivative": "Meshy remesh at requested art-review target",
            "additionalLods": "not-authored",
            "required": "Validate screen-space quality and add LODs only from measured need.",
        },
        "gameplayReadiness": "Art-review derivative only; not integrated or gameplay-ready.",
    }

    # Independent reimport checks the bytes that were actually exported.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(export))
    reimport_meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    reimport_bounds = scene_bounds([obj for obj in reimport_meshes if not obj.name.startswith("COLLIDER_")])
    inventory["gameDerivative"]["reimport"] = {
        "rootPresent": bpy.data.objects.get(str(asset["root"])) is not None,
        "colliderPresent": bpy.data.objects.get(str(collision["name"])) is not None,
        "dimensionsMetres": reimport_bounds["dimensions"],
        "topologyIncludingCollider": mesh_topology(reimport_meshes),
        "materialNames": sorted(material.name for material in bpy.data.materials),
    }
    if not inventory["gameDerivative"]["reimport"]["rootPresent"]:
        raise RuntimeError(f"{slug}: stable root did not survive GLB reimport")
    if not inventory["gameDerivative"]["reimport"]["colliderPresent"]:
        raise RuntimeError(f"{slug}: collider did not survive GLB reimport")
    return inventory, donor, source_blend, export


def run() -> dict[str, object]:
    inventories = []
    for asset in ASSETS:
        inventory, _, _, _ = import_and_normalize(asset)
        path = HERE / "exports" / f"{asset['slug']}-inventory.json"
        path.write_text(json.dumps(inventory, indent=2) + "\n")
        inventories.append(inventory)
    batch = {
        "schema": 1,
        "collection": "MercuryPitch Glassworks — Level 2 Twin Galleries",
        "assetCount": len(inventories),
        "assets": [
            {
                "assetId": item["assetId"],
                "kind": item["kind"],
                "galleryFamily": item["galleryFamily"],
                "dimensionsMetres": item["dimensionsMetres"],
                "triangles": item["gameDerivative"]["topology"]["triangles"],
                "fractureStatus": item["fractureReadiness"]["status"],
                "inventory": f"exports/{item['assetId']}-inventory.json",
            }
            for item in inventories
        ],
        "scope": "Source art only; no runtime/public integration.",
    }
    (HERE / "exports" / "batch-inventory.json").write_text(json.dumps(batch, indent=2) + "\n")
    return batch


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
