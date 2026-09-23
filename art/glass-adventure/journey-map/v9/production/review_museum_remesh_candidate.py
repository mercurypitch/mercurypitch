"""Render and audit one receipt-matched V9 remesh candidate without modifying it."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
V3 = ART.parent / "v3"
V4 = ART.parent / "v4"

ASSETS = {
    "temple": {
        "dense": V3 / "meshy" / "floating-museum-temple-v3-pre-remesh.glb",
        "donor": V3 / "meshy" / "floating-museum-temple-v3.glb",
        "current": V4 / "exports" / "floating-museum-twin-finish-kit-v4.glb",
        "currentNode": "map_temple_amber",
        "candidate": ART / "meshy" / "temple-remesh-90k.glb",
        "receipt": ART / "meshy" / "temple-remesh-90k-receipt.json",
        "targetTriangles": 90_000,
        "height": 3.10,
        "spacing": 3.25,
        "ortho": 12.5,
        "runtimeContract": {
            "requiredNodes": [
                "map_temple_amber",
                "map_temple_amber_structure",
                "map_temple_amber_dome",
                "map_temple_teal",
                "map_temple_teal_structure",
                "map_temple_teal_dome",
            ],
            "instancing": "One finished geometry source shared by amber and teal variants.",
            "normalRule": "Preserve source loop normals through the dome material split.",
        },
    },
    "cypress": {
        "dense": V3 / "meshy" / "floating-museum-cypress-v3-pre-remesh.glb",
        "donor": V3 / "meshy" / "floating-museum-cypress-v3.glb",
        "current": V4 / "exports" / "floating-museum-twin-finish-kit-v4.glb",
        "currentNode": "map_cypress",
        "candidate": ART / "meshy" / "cypress-remesh-20k.glb",
        "receipt": ART / "meshy" / "cypress-remesh-20k-receipt.json",
        "targetTriangles": 20_000,
        "height": 3.10,
        "spacing": 1.35,
        "ortho": 7.0,
        "runtimeContract": {
            "requiredNodes": ["map_cypress", "map_cypress_geometry"],
            "instancing": "One finished cypress geometry reused by every runtime placement.",
            "normalRule": "Keep the reviewed smooth/split normal and tangent basis unchanged.",
        },
    },
}

COLORS = (
    (0.76, 0.72, 0.64, 1.0),
    (0.78, 0.57, 0.34, 1.0),
    (0.42, 0.70, 0.61, 1.0),
    (0.45, 0.63, 0.88, 1.0),
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def descendants(root: bpy.types.Object) -> set[bpy.types.Object]:
    result = {root}
    pending = list(root.children)
    while pending:
        item = pending.pop()
        if item in result:
            continue
        result.add(item)
        pending.extend(item.children)
    return result


def bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def topology(mesh: bpy.types.Mesh) -> dict[str, object]:
    copy = mesh.copy()
    invalid = copy.validate(verbose=False, clean_customdata=False)
    bpy.data.meshes.remove(copy)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    mesh.calc_loop_triangles()
    result = {
        "vertices": len(bm.verts),
        "triangles": len(mesh.loop_triangles),
        "boundaryEdges": sum(len(edge.link_faces) == 1 for edge in bm.edges),
        "nonManifoldEdges": sum(len(edge.link_faces) != 2 for edge in bm.edges),
        "looseEdges": sum(not edge.link_faces for edge in bm.edges),
        "zeroAreaFaces": sum(face.calc_area() <= 1e-12 for face in bm.faces),
        "blenderMeshInvalid": bool(invalid),
    }
    bm.free()
    return result


def shading(mesh: bpy.types.Mesh) -> dict[str, object]:
    normals = [tuple(float(value) for value in normal.vector) for normal in mesh.corner_normals]
    lengths = [math.sqrt(sum(value * value for value in normal)) for normal in normals]
    active_uv = mesh.uv_layers.active
    tangent_ready = False
    tangent_error = None
    if active_uv is not None:
        try:
            mesh.calc_tangents(uvmap=active_uv.name)
            tangent_ready = all(
                all(math.isfinite(value) for value in loop.tangent)
                and abs(loop.tangent.length - 1.0) <= 1e-4
                for loop in mesh.loops
            )
            mesh.free_tangents()
        except RuntimeError as error:
            tangent_error = str(error)
    return {
        "cornerNormals": len(normals),
        "allNormalsFinite": all(
            math.isfinite(value) for normal in normals for value in normal
        ),
        "allNormalsNonZero": all(length > 0.0 for length in lengths),
        "maximumNormalUnitError": max((abs(length - 1.0) for length in lengths), default=None),
        "smoothPolygons": sum(polygon.use_smooth for polygon in mesh.polygons),
        "totalPolygons": len(mesh.polygons),
        "uvLayers": [layer.name for layer in mesh.uv_layers],
        "activeUv": active_uv.name if active_uv is not None else None,
        "tangentBasisComputable": tangent_ready,
        "tangentError": tangent_error,
    }


def clay_material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = 0.54
    return result


def import_normalized(
    name: str,
    path: Path,
    node_name: str | None,
    offset_x: float,
    height: float,
    material: bpy.types.Material,
) -> tuple[dict[str, object], list[bpy.types.Object]]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    if node_name is None:
        meshes = [obj for obj in imported if obj.type == "MESH"]
    else:
        roots = [obj for obj in imported if obj.name == node_name]
        if len(roots) != 1:
            raise ValueError(f"{path.name} has {len(roots)} nodes named {node_name}")
        owned = descendants(roots[0])
        meshes = [obj for obj in imported if obj.type == "MESH" and obj in owned]
    if not meshes:
        raise ValueError(f"{path.name} selection has no mesh")
    low, high = bounds(meshes)
    scale = height / (high.z - low.z)
    center_x = (low.x + high.x) * 0.5
    center_y = (low.y + high.y) * 0.5
    for index, obj in enumerate(meshes):
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.data = obj.data.copy()
        obj.data.transform(world)
        obj.matrix_world = Matrix.Identity(4)
        for vertex in obj.data.vertices:
            vertex.co.x = (vertex.co.x - center_x) * scale + offset_x
            vertex.co.y = (vertex.co.y - center_y) * scale
            vertex.co.z = (vertex.co.z - low.z) * scale
        obj.data.materials.clear()
        obj.data.materials.append(material)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        obj.name = f"{name}-{index:02d}"
        obj.data.update()
    for obj in imported:
        if obj not in meshes:
            bpy.data.objects.remove(obj, do_unlink=True)
    return (
        {
            "name": name,
            "file": str(path.relative_to(REPO)),
            "bytes": path.stat().st_size,
            "sha256": digest(path),
            "meshObjects": len(meshes),
            "vertices": sum(len(obj.data.vertices) for obj in meshes),
            "triangles": sum(topology(obj.data)["triangles"] for obj in meshes),
            "displayHeightMetres": height,
            "displayX": offset_x,
        },
        meshes,
    )


def add_area(name: str, location: tuple[float, float, float], energy: float, color: tuple[float, float, float], target: Vector) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = 4.5
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def render(scene: bpy.types.Scene, camera: bpy.types.Object, target: Vector, location: tuple[float, float, float], path: Path) -> None:
    camera.location = location
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", choices=sorted(ASSETS), required=True)
    script_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(script_args)


def main() -> None:
    args = parse_args()
    config = ASSETS[args.asset]
    candidate = Path(config["candidate"])
    receipt_path = Path(config["receipt"])
    if not candidate.exists() or not receipt_path.exists():
        raise FileNotFoundError(f"No archived {args.asset} V9 remesh candidate exists")
    receipt = json.loads(receipt_path.read_text())
    if (
        receipt.get("state") != "archived"
        or receipt.get("file", {}).get("sha256") != digest(candidate)
        or receipt.get("request", {}).get("target_polycount") != config["targetTriangles"]
    ):
        raise ValueError(f"{args.asset} candidate does not match its archived receipt")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 8
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("V9 remesh review world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.075, 0.095, 0.125, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.42
    scene.world = world

    spacing = float(config["spacing"])
    sources = (
        ("dense-pre-remesh", Path(config["dense"]), None, -1.5 * spacing),
        ("textured-donor-as-clay", Path(config["donor"]), None, -0.5 * spacing),
        ("current-v4-as-clay", Path(config["current"]), config["currentNode"], 0.5 * spacing),
        ("v9-remesh-candidate", candidate, None, 1.5 * spacing),
    )
    rows = []
    candidate_meshes: list[bpy.types.Object] = []
    for index, (name, path, node, offset) in enumerate(sources):
        row, meshes = import_normalized(
            name,
            path,
            node,
            offset,
            float(config["height"]),
            clay_material(name, COLORS[index]),
        )
        rows.append(row)
        if name == "v9-remesh-candidate":
            candidate_meshes = meshes

    candidate_audit = {
        obj.name: {"topology": topology(obj.data), "shading": shading(obj.data)}
        for obj in candidate_meshes
    }
    bpy.ops.mesh.primitive_plane_add(size=30.0, location=(0.0, 0.0, -0.015))
    bpy.context.object.data.materials.append(
        clay_material("review-ground", (0.10, 0.12, 0.15, 1.0))
    )
    target = Vector((0.0, 0.0, float(config["height"]) * 0.49))
    add_area("warm-key", (-6.0, -6.5, 8.5), 1450.0, (1.0, 0.78, 0.58), target)
    add_area("cool-fill", (6.0, -3.0, 7.0), 1050.0, (0.68, 0.84, 1.0), target)
    add_area("mint-rim", (0.0, 5.0, 7.5), 1250.0, (0.70, 1.0, 0.86), target)
    camera_data = bpy.data.cameras.new("review-camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = float(config["ortho"])
    camera = bpy.data.objects.new("review-camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    scene.camera = camera
    front = ART / "proofs" / f"{args.asset}-remesh-clay-front-v9.png"
    angle = ART / "proofs" / f"{args.asset}-remesh-clay-angle-v9.png"
    front.parent.mkdir(parents=True, exist_ok=True)
    render(scene, camera, target, (0.0, -14.0, float(config["height"]) * 1.45), front)
    render(scene, camera, target, (7.5, -13.5, float(config["height"]) * 1.75), angle)

    tangent_ready = all(
        row["shading"]["tangentBasisComputable"] for row in candidate_audit.values()
    )
    manifest = {
        "schema": 1,
        "asset": args.asset,
        "purpose": "Receipt-matched same-camera clay and finish-readiness review; no runtime export.",
        "order": [row["name"] for row in rows],
        "assets": rows,
        "candidateAudit": candidate_audit,
        "proofs": [
            {"file": str(path.relative_to(ART)), "bytes": path.stat().st_size, "sha256": digest(path)}
            for path in (front, angle)
        ],
        "finishGates": {
            "silhouetteApproval": "pending-manual-review",
            "finalUvApproval": "pending" if tangent_ready else "required",
            "tangentBasisComputable": tangent_ready,
            "denseToLowTangentNormalBake": "not-performed",
            "denseToLowAmbientOcclusionBake": "not-performed",
            "pbrTextureFinish": "not-performed",
            "freshExportAndReimport": "not-performed",
            "runtimeIntegration": "not-performed",
        },
        "runtimeContract": config["runtimeContract"],
        "renderEngine": "CYCLES CPU",
        "blender": bpy.app.version_string,
        "command": (
            "rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/journey-map/v9/production/review_museum_remesh_candidate.py "
            f"-- --asset {args.asset}"
        ),
    }
    output = ART / "proofs" / f"{args.asset}-remesh-review-v9.json"
    output.write_text(json.dumps(manifest, indent=2) + "\n")
    print("MUSEUM_REMESH_REVIEW=" + json.dumps(manifest), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
