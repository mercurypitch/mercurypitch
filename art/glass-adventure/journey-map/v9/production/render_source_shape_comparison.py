"""Render CPU-only, same-camera temple and cypress source comparisons."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
V3 = ART.parent / "v3"
V4 = ART.parent / "v4"
PROOFS = ART / "proofs"
MANIFEST = PROOFS / "museum-source-shape-comparison-v9.json"

ASSETS = {
    "temple": {
        "height": 3.10,
        "claySpacing": 3.35,
        "textureSpacing": 1.75,
        "clayOrtho": 10.5,
        "textureOrtho": 7.2,
        "dense": V3 / "meshy" / "floating-museum-temple-v3-pre-remesh.glb",
        "donor": V3 / "meshy" / "floating-museum-temple-v3.glb",
        "current": V4 / "exports" / "floating-museum-twin-finish-kit-v4.glb",
        "currentNode": "map_temple_amber",
    },
    "cypress": {
        "height": 3.10,
        "claySpacing": 1.20,
        "textureSpacing": 0.75,
        "clayOrtho": 5.8,
        "textureOrtho": 5.8,
        "dense": V3 / "meshy" / "floating-museum-cypress-v3-pre-remesh.glb",
        "donor": V3 / "meshy" / "floating-museum-cypress-v3.glb",
        "current": V4 / "exports" / "floating-museum-twin-finish-kit-v4.glb",
        "currentNode": "map_cypress",
    },
}

CLAY_COLORS = {
    "dense-pre-remesh": (0.76, 0.72, 0.64, 1.0),
    "textured-donor-as-clay": (0.78, 0.57, 0.34, 1.0),
    "current-v4-as-clay": (0.42, 0.70, 0.61, 1.0),
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [
        obj.matrix_world @ vertex.co
        for obj in objects
        for vertex in obj.data.vertices
    ]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def descendants(root: bpy.types.Object) -> set[bpy.types.Object]:
    result: set[bpy.types.Object] = {root}
    pending = list(root.children)
    while pending:
        item = pending.pop()
        if item in result:
            continue
        result.add(item)
        pending.extend(item.children)
    return result


def clay_material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = 0.52
    shader.inputs["Metallic"].default_value = 0.0
    return result


def add_area(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
    target: tuple[float, float, float],
) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def point_camera(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def setup_scene() -> tuple[bpy.types.Scene, bpy.types.Object]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 8
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("museum source comparison world")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.075, 0.095, 0.125, 1.0)
    background.inputs["Strength"].default_value = 0.42
    scene.world = world

    bpy.ops.mesh.primitive_plane_add(size=30.0, location=(0.0, 0.0, -0.015))
    ground = bpy.context.object
    ground.name = "comparison-ground"
    ground.data.materials.append(
        clay_material("comparison-ground-material", (0.10, 0.12, 0.15, 1.0))
    )
    add_area("warm-key", (-6.0, -6.5, 8.5), 1450.0, 5.0, (1.0, 0.78, 0.58), (0.0, 0.0, 1.5))
    add_area("cool-fill", (6.0, -3.0, 7.0), 1050.0, 4.5, (0.68, 0.84, 1.0), (0.0, 0.0, 1.5))
    add_area("mint-rim", (0.0, 5.0, 7.5), 1250.0, 4.0, (0.70, 1.0, 0.86), (0.0, 0.0, 1.6))

    camera_data = bpy.data.cameras.new("comparison-camera")
    camera_data.type = "ORTHO"
    camera = bpy.data.objects.new("comparison-camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    scene.camera = camera
    return scene, camera


def import_normalized(
    name: str,
    path: Path,
    node_name: str | None,
    offset_x: float,
    target_height: float,
    clay: bpy.types.Material | None,
) -> dict[str, object]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    if node_name is None:
        selected = [obj for obj in imported if obj.type == "MESH"]
    else:
        roots = [obj for obj in imported if obj.name == node_name]
        if len(roots) != 1:
            raise ValueError(f"{path.name} has {len(roots)} nodes named {node_name}")
        owned = descendants(roots[0])
        selected = [obj for obj in imported if obj.type == "MESH" and obj in owned]
    if not selected:
        raise ValueError(f"{path.name} selection has no mesh")

    low, high = bounds(selected)
    scale = target_height / (high.z - low.z)
    center_x = (low.x + high.x) * 0.5
    center_y = (low.y + high.y) * 0.5
    triangles = 0
    vertices = 0
    for index, obj in enumerate(selected):
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.data = obj.data.copy()
        obj.data.transform(world)
        obj.matrix_world = Matrix.Identity(4)
        for vertex in obj.data.vertices:
            vertex.co.x = (vertex.co.x - center_x) * scale + offset_x
            vertex.co.y = (vertex.co.y - center_y) * scale
            vertex.co.z = (vertex.co.z - low.z) * scale
        if clay is not None:
            obj.data.materials.clear()
            obj.data.materials.append(clay)
            for polygon in obj.data.polygons:
                polygon.use_smooth = True
        obj.name = f"{name}-{index:02d}"
        obj.data.name = f"{name}-{index:02d}-mesh"
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        vertices += len(obj.data.vertices)
        obj.data.update()
    for obj in imported:
        if obj not in selected:
            bpy.data.objects.remove(obj, do_unlink=True)
    return {
        "name": name,
        "file": str(path.relative_to(REPO)),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "selectedNode": node_name,
        "meshObjects": len(selected),
        "verticesAfterImport": vertices,
        "trianglesAfterImport": triangles,
        "displayHeightMetres": target_height,
        "displayX": offset_x,
    }


def render(scene: bpy.types.Scene, camera: bpy.types.Object, path: Path) -> None:
    scene.camera = camera
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def render_pair(
    asset_name: str,
    mode: str,
    config: dict[str, object],
) -> tuple[list[dict[str, object]], list[Path]]:
    scene, camera = setup_scene()
    height = float(config["height"])
    if mode == "clay":
        spacing = float(config["claySpacing"])
        camera.data.ortho_scale = float(config["clayOrtho"])
        sources = [
            ("dense-pre-remesh", config["dense"], None, -spacing),
            ("textured-donor-as-clay", config["donor"], None, 0.0),
            ("current-v4-as-clay", config["current"], config["currentNode"], spacing),
        ]
    else:
        spacing = float(config["textureSpacing"])
        camera.data.ortho_scale = float(config["textureOrtho"])
        sources = [
            ("textured-donor", config["donor"], None, -spacing),
            ("current-v4", config["current"], config["currentNode"], spacing),
        ]

    rows = []
    for name, path, node, offset in sources:
        clay = (
            clay_material(f"{asset_name}-{name}-clay", CLAY_COLORS[name])
            if mode == "clay"
            else None
        )
        rows.append(
            import_normalized(
                f"{asset_name}-{name}", Path(path), node, offset, height, clay
            )
        )

    target = Vector((0.0, 0.0, height * 0.49))
    front = PROOFS / f"{asset_name}-{mode}-front-v9.png"
    angle = PROOFS / f"{asset_name}-{mode}-angle-v9.png"
    PROOFS.mkdir(parents=True, exist_ok=True)
    camera.location = (0.0, -12.0, height * 1.45)
    point_camera(camera, target)
    render(scene, camera, front)
    camera.location = (7.5, -11.5, height * 1.75)
    point_camera(camera, target)
    render(scene, camera, angle)
    return rows, [front, angle]


def main() -> None:
    groups = []
    all_proofs: list[Path] = []
    for asset_name, config in ASSETS.items():
        for mode in ("clay", "textured"):
            rows, proofs = render_pair(asset_name, mode, config)
            groups.append(
                {
                    "asset": asset_name,
                    "mode": mode,
                    "order": [row["name"] for row in rows],
                    "assets": rows,
                    "proofs": [str(path.relative_to(ART)) for path in proofs],
                }
            )
            all_proofs.extend(proofs)

    result = {
        "schema": 1,
        "purpose": (
            "Same-scale, same-camera local source comparison. Clay proofs test silhouette; "
            "textured proofs compare the accepted donor with the current V4 runtime source."
        ),
        "groups": groups,
        "proofFiles": [
            {
                "file": str(path.relative_to(ART)),
                "bytes": path.stat().st_size,
                "sha256": digest(path),
            }
            for path in all_proofs
        ],
        "renderEngine": "CYCLES CPU",
        "samples": 8,
        "blender": bpy.app.version_string,
        "command": (
            "rtk proxy timeout 7200 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/journey-map/v9/production/render_source_shape_comparison.py"
        ),
    }
    MANIFEST.write_text(json.dumps(result, indent=2) + "\n")
    print("MUSEUM_SOURCE_SHAPE_PROOF=" + json.dumps(result), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
