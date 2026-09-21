"""Build the Cloudway platform kit from archived Meshy donors in isolated Blender.

The generated scene is the editable production source. It keeps the detailed Meshy
shells, adds exact flat landing skins, authors the three crackle states, packs all
runtime textures, exports an uncompressed GLB, and renders isolated review sheets.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
SOURCE_BLEND = ART / "sources" / "cloudway-platform-kit-v1.blend"
BLENDER_GLB = ART / "exports" / "cloudway-platform-kit-v1-blender.glb"
BUILD_REPORT = ART / "production" / "cloudway-platform-kit-build.json"
PROOF_FAMILY = ART / "proofs" / "cloudway-platform-kit-family.png"
PROOF_CRACKLE = ART / "proofs" / "cloudway-platform-kit-crackle-states.png"
RUNTIME_TEXTURE_DIR = ART / "sources" / "runtime-textures"

SHELL_WIDTH = 1.80
SHELL_DEPTH = 1.40
LANDING_WIDTH = 1.70
LANDING_DEPTH = 1.30
LANDING_SKIN_THICKNESS = 0.018
COLLIDER_HEIGHT = 0.24

DONORS = {
    "marble": {
        "root": "Cloudway_Marble",
        "source": ART / "meshy" / "marble" / "runtime-remesh.glb",
    },
    "frost": {
        "root": "Cloudway_Frost",
        "source": ART / "meshy" / "frost" / "runtime-remesh.glb",
    },
    "glide": {
        "root": "Cloudway_Glide",
        "source": ART / "meshy" / "glide" / "runtime-remesh.glb",
    },
}

ROOT_NAMES = [
    "Cloudway_Marble",
    "Cloudway_Frost",
    "Cloudway_Glide",
    "Cloudway_Crackle_Intact",
    "Cloudway_Crackle_Warning",
    "Cloudway_Crackle_Release",
]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def select_only(objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    if objects:
        bpy.context.view_layer.objects.active = objects[0]


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        obj = pending.pop(0)
        result.append(obj)
        pending.extend(obj.children)
    return result


def object_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise ValueError("Cannot measure an empty platform")
    return (
        Vector(min(point[i] for point in points) for i in range(3)),
        Vector(max(point[i] for point in points) for i in range(3)),
    )


def gltf_bounds(low: Vector, high: Vector) -> dict[str, list[float]]:
    # Blender export_yup maps Blender (x, y, z) to glTF (x, z, -y).
    return {
        "min": [float(low.x), float(low.z), float(-high.y)],
        "max": [float(high.x), float(high.z), float(-low.y)],
    }


def triangle_count(objects: list[bpy.types.Object]) -> int:
    total = 0
    for obj in objects:
        if obj.type == "MESH":
            obj.data.calc_loop_triangles()
            total += len(obj.data.loop_triangles)
    return total


def dominant_landing_height(obj: bpy.types.Object) -> float:
    low, high = object_bounds([obj])
    size = high - low
    bin_size = max(size.z / 160.0, 1e-6)
    area_by_bin: dict[int, float] = {}
    for polygon in obj.data.polygons:
        center = polygon.center
        if polygon.normal.z < 0.88:
            continue
        if not (low.x + size.x * 0.12 <= center.x <= high.x - size.x * 0.12):
            continue
        if not (low.y + size.y * 0.12 <= center.y <= high.y - size.y * 0.12):
            continue
        if center.z < low.z + size.z * 0.45:
            continue
        key = round((center.z - low.z) / bin_size)
        area_by_bin[key] = area_by_bin.get(key, 0.0) + polygon.area
    if not area_by_bin:
        raise ValueError(f"No landing plane found for {obj.name}")
    winner = max(area_by_bin, key=area_by_bin.get)
    return float(low.z + winner * bin_size)


def material(
    name: str,
    color: tuple[float, float, float],
    metallic: float,
    roughness: float,
    transmission: float = 0.0,
    emission: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if "Transmission Weight" in shader.inputs:
        shader.inputs["Transmission Weight"].default_value = transmission
    if "IOR" in shader.inputs:
        shader.inputs["IOR"].default_value = 1.46
    if emission and "Emission Color" in shader.inputs:
        shader.inputs["Emission Color"].default_value = (*emission, 1.0)
        shader.inputs["Emission Strength"].default_value = emission_strength
    return mat


def apply_bevel(obj: bpy.types.Object, width: float, segments: int = 2) -> None:
    modifier = obj.modifiers.new("authored_edge_bevel", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    select_only([obj])
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def create_mesh(
    name: str,
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    parent: bpy.types.Object,
    mat: bpy.types.Material,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name + "__Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def box(
    name: str,
    dimensions: tuple[float, float, float],
    location: tuple[float, float, float],
    parent: bpy.types.Object,
    mat: bpy.types.Material,
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "__Mesh"
    obj.dimensions = dimensions
    select_only([obj])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.parent = parent
    obj.data.materials.append(mat)
    if bevel:
        apply_bevel(obj, bevel)
    return obj


def ring(
    name: str,
    outer: tuple[float, float],
    inner: tuple[float, float],
    top: float,
    bottom: float,
    parent: bpy.types.Object,
    mat: bpy.types.Material,
    bevel: float,
) -> bpy.types.Object:
    def corners(width: float, depth: float, z: float) -> list[tuple[float, float, float]]:
        return [
            (-width / 2, -depth / 2, z),
            (width / 2, -depth / 2, z),
            (width / 2, depth / 2, z),
            (-width / 2, depth / 2, z),
        ]

    vertices = corners(*outer, top) + corners(*inner, top) + corners(*outer, bottom) + corners(*inner, bottom)
    faces: list[tuple[int, ...]] = []
    for i in range(4):
        n = (i + 1) % 4
        faces.extend(
            [
                (i, n, 4 + n, 4 + i),
                (8 + n, 8 + i, 12 + i, 12 + n),
                (i, 8 + i, 8 + n, n),
                (4 + n, 12 + n, 12 + i, 4 + i),
            ]
        )
    obj = create_mesh(name, vertices, faces, parent, mat)
    apply_bevel(obj, bevel, 2)
    return obj


def grid_prism(
    name: str,
    width: float,
    depth: float,
    thickness: float,
    nx: int,
    ny: int,
    parent: bpy.types.Object,
    mat: bpy.types.Material,
    bevel: float = 0.0,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    for z in (0.0, -thickness):
        for iy in range(ny + 1):
            y = -depth / 2 + depth * iy / ny
            for ix in range(nx + 1):
                x = -width / 2 + width * ix / nx
                vertices.append((x, y, z))
    stride = nx + 1
    layer = stride * (ny + 1)
    faces: list[tuple[int, ...]] = []
    for iy in range(ny):
        for ix in range(nx):
            a = iy * stride + ix
            faces.append((a, a + 1, a + 1 + stride, a + stride))
            b = layer + a
            faces.append((b + stride, b + 1 + stride, b + 1, b))
    for ix in range(nx):
        a = ix
        faces.append((a, layer + a, layer + a + 1, a + 1))
        a = ny * stride + ix
        faces.append((a + 1, layer + a + 1, layer + a, a))
    for iy in range(ny):
        a = iy * stride
        faces.append((a + stride, layer + a + stride, layer + a, a))
        a = iy * stride + nx
        faces.append((a, layer + a, layer + a + stride, a + stride))
    obj = create_mesh(name, vertices, faces, parent, mat)
    if bevel:
        apply_bevel(obj, bevel, 1)
    return obj


def multi_tube(
    name: str,
    lines: list[tuple[list[tuple[float, float, float]], bool]],
    radius: float,
    parent: bpy.types.Object,
    mat: bpy.types.Material,
    sides: int = 6,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(name + "__Curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.bevel_resolution = 0
    curve.resolution_v = sides
    for points, cyclic in lines:
        spline = curve.splines.new("POLY")
        spline.points.add(len(points) - 1)
        for item, point in zip(spline.points, points):
            item.co = (*point, 1.0)
        spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    select_only([obj])
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "__Mesh"
    obj.data.materials.append(mat)
    return obj


def root_metadata(root: bpy.types.Object, state: str, visual: dict[str, list[float]], triangles: int) -> None:
    root["assetId"] = "cloudway-platform-kit-v1"
    root["platformFamily"] = root.name.removeprefix("Cloudway_").lower()
    root["state"] = state
    root["units"] = "metres"
    root["upAxis"] = "+Y"
    root["origin"] = "top-centre of exact authored landing skin"
    root["landingPlaneY"] = 0.0
    root["landing_json"] = json.dumps(
        {
            "min": [-LANDING_WIDTH / 2, 0.0, -LANDING_DEPTH / 2],
            "max": [LANDING_WIDTH / 2, 0.0, LANDING_DEPTH / 2],
            "width": LANDING_WIDTH,
            "depth": LANDING_DEPTH,
            "edgeSemantics": "visible flat landing skin spans the collider exactly; outer decoration is non-supporting",
        },
        separators=(",", ":"),
    )
    root["collider_json"] = json.dumps(
        {
            "shape": "box",
            "width": LANDING_WIDTH,
            "depth": LANDING_DEPTH,
            "height": COLLIDER_HEIGHT,
            "topY": 0.0,
            "center": [0.0, -COLLIDER_HEIGHT / 2, 0.0],
        },
        separators=(",", ":"),
    )
    root["visual_bounds_json"] = json.dumps(visual, separators=(",", ":"))
    root["triangles"] = triangles


def create_root(name: str) -> bpy.types.Object:
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    return root


def downscale_and_pack(images: list[bpy.types.Image], prefix: str, limit: int = 1024) -> list[dict[str, object]]:
    report = []
    for index, image in enumerate(images):
        if image.type != "IMAGE":
            continue
        width, height = int(image.size[0]), int(image.size[1])
        if max(width, height) <= 0:
            continue
        source_size = [width, height]
        if max(width, height) > limit:
            scale = limit / max(width, height)
            image.scale(max(1, round(width * scale)), max(1, round(height * scale)))
        image.name = f"{prefix}__Atlas_{index + 1:02d}_1K"
        runtime_path = RUNTIME_TEXTURE_DIR / f"{prefix.lower()}-atlas-{index + 1:02d}-1k.png"
        image.filepath_raw = str(runtime_path)
        image.file_format = "PNG"
        image.save()
        if image.packed_file is not None:
            image.unpack(method="REMOVE")
        image.filepath_raw = str(runtime_path)
        image.reload()
        if max(int(image.size[0]), int(image.size[1])) > limit:
            raise ValueError(f"Runtime texture relink kept an oversized image: {image.name} {list(image.size)}")
        image.pack()
        report.append(
            {
                "image": image.name,
                "sourceDimensions": source_size,
                "runtimeDimensions": [int(image.size[0]), int(image.size[1])],
                "runtimeFile": str(runtime_path.relative_to(ART)),
                "runtimeBytes": runtime_path.stat().st_size,
                "runtimeSha256": digest(runtime_path),
                "packed": bool(image.packed_file),
            }
        )
    return report


def normalize_donor(asset: str, config: dict[str, object], root: bpy.types.Object) -> dict[str, object]:
    source = Path(config["source"])
    before_objects = set(bpy.data.objects)
    before_images = set(bpy.data.images)
    before_materials = set(bpy.data.materials)
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported = [obj for obj in bpy.data.objects if obj not in before_objects]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if len(meshes) != 1:
        raise ValueError(f"{asset} expected one runtime donor mesh, got {len(meshes)}")
    obj = meshes[0]
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    obj.parent = None
    obj.data.update()
    low, high = object_bounds([obj])
    landing = dominant_landing_height(obj)
    size = high - low
    transform = Matrix.Translation(
        Vector((-(low.x + high.x) * 0.5, -(low.y + high.y) * 0.5, -landing - LANDING_SKIN_THICKNESS))
    ) @ Matrix.Diagonal((SHELL_WIDTH / size.x, SHELL_DEPTH / size.y, SHELL_WIDTH / size.x, 1.0))
    obj.data.transform(transform)
    obj.data.update()
    obj.name = str(config["root"]) + "__Shell"
    obj.data.name = obj.name + "__Mesh"
    obj.parent = root
    for other in imported:
        if other is obj:
            continue
        bpy.data.objects.remove(other, do_unlink=True)
    new_materials = [mat for mat in bpy.data.materials if mat not in before_materials]
    for index, mat in enumerate(new_materials):
        mat.name = f"{config['root']}__DonorAtlas_{index + 1:02d}_1K"
    texture_report = downscale_and_pack(
        [image for image in bpy.data.images if image not in before_images], str(config["root"])
    )
    return {
        "source": str(source.relative_to(ART)),
        "sourceSha256": digest(source),
        "rawLandingPlaneBlenderZ": landing,
        "normalization": {
            "shellWidth": SHELL_WIDTH,
            "shellDepth": SHELL_DEPTH,
            "landingSkinTopZ": 0.0,
            "donorLandingShiftedToZ": -LANDING_SKIN_THICKNESS,
        },
        "runtimeTextures": texture_report,
    }


def surface_inlays(root: bpy.types.Object, kind: str, mats: dict[str, bpy.types.Material]) -> None:
    base_material = {
        "marble": mats["ivory"],
        "frost": mats["frost"],
        "glide": mats["celadon"],
    }[kind]
    grid_prism(
        f"{root.name}__LandingSurface",
        LANDING_WIDTH,
        LANDING_DEPTH,
        LANDING_SKIN_THICKNESS,
        8,
        6,
        root,
        base_material,
        0.012,
    )
    z = 0.004
    if kind == "marble":
        box(f"{root.name}__TealInlay", (1.23, 0.76, 0.004), (0, 0, 0.002), root, mats["teal"], 0.018)
        ring(f"{root.name}__InlayGold", (1.31, 0.84), (1.27, 0.80), z + 0.003, z, root, mats["gold"], 0.003)
        lines: list[tuple[list[tuple[float, float, float]], bool]] = []
        for i in range(8):
            a = math.tau * i / 8
            lines.append(([(0, 0, z + 0.006), (0.18 * math.cos(a), 0.18 * math.sin(a), z + 0.006)], False))
        multi_tube(f"{root.name}__CompassRose", lines, 0.006, root, mats["gold"], 5)
    elif kind == "frost":
        lines = []
        for i in range(8):
            a = math.tau * i / 8
            end = (0.31 * math.cos(a), 0.31 * math.sin(a), z)
            lines.append(([(0, 0, z), end], False))
            for t, side in ((0.62, 1), (0.62, -1), (0.82, 1), (0.82, -1)):
                px, py = end[0] * t, end[1] * t
                branch_a = a + side * math.pi * 0.27
                lines.append(([(px, py, z), (px + 0.07 * math.cos(branch_a), py + 0.07 * math.sin(branch_a), z)], False))
        multi_tube(f"{root.name}__LandingEtch", lines, 0.0045, root, mats["frost_etch"], 5)
    else:
        orbit_lines: list[tuple[list[tuple[float, float, float]], bool]] = []
        for radius in (0.16, 0.29):
            orbit_lines.append(([(radius * math.cos(math.tau * i / 32), radius * math.sin(math.tau * i / 32), z) for i in range(32)], True))
        orbit_lines.append(([(-0.48, 0, z), (0.48, 0, z)], False))
        multi_tube(f"{root.name}__MoonOrbitInlay", orbit_lines, 0.0055, root, mats["gold"], 5)


def crackle_slab_data(parent: bpy.types.Object, mat: bpy.types.Material, name: str) -> bpy.types.Object:
    return grid_prism(name, LANDING_WIDTH, LANDING_DEPTH, 0.085, 24, 18, parent, mat, 0.006)


def crackle_frame(parent: bpy.types.Object, mat: bpy.types.Material, name: str) -> bpy.types.Object:
    return ring(name, (SHELL_WIDTH, SHELL_DEPTH), (LANDING_WIDTH, LANDING_DEPTH), 0.026, -0.095, parent, mat, 0.012)


def crack_lines(z: float) -> list[tuple[list[tuple[float, float, float]], bool]]:
    centre = (0.08, 0.03, z)
    tips = [(-0.78, -0.48), (-0.25, -0.63), (0.62, -0.60), (0.82, 0.14), (0.45, 0.62), (-0.62, 0.58), (-0.83, 0.02)]
    lines: list[tuple[list[tuple[float, float, float]], bool]] = []
    for index, (tx, ty) in enumerate(tips):
        bend = ((centre[0] + tx) * 0.52 + (0.035 if index % 2 else -0.025), (centre[1] + ty) * 0.48, z)
        lines.append(([centre, bend, (tx, ty, z)], False))
        if index % 2 == 0:
            bx = bend[0] + (0.15 if tx < centre[0] else -0.13)
            by = bend[1] + (0.10 if ty < centre[1] else -0.11)
            lines.append(([bend, (bx, by, z)], False))
    return lines


def shard(
    name: str,
    polygon: list[tuple[float, float]],
    parent: bpy.types.Object,
    mat: bpy.types.Material,
) -> bpy.types.Object:
    cx = sum(point[0] for point in polygon) / len(polygon)
    cy = sum(point[1] for point in polygon) / len(polygon)
    local = [(x - cx, y - cy) for x, y in polygon]
    # Keep the authored top footprint exact so the six aligned fragments fill
    # the 1.70 x 1.30 m landing contract without a lip or gap.  A conventional
    # Bevel modifier can push acute triangular corners outside that footprint,
    # so form the edge treatment below the landing plane instead: the full-size
    # top ring rolls into a slightly inset shoulder and vertical lower wall.
    inset = 0.97
    shoulder = [(x * inset, y * inset) for x, y in local]
    vertices = (
        [(x, y, 0.0) for x, y in local]
        + [(x, y, -0.012) for x, y in shoulder]
        + [(x, y, -0.085) for x, y in shoulder]
    )
    n = len(local)
    faces: list[tuple[int, ...]] = [tuple(range(n)), tuple(range(3 * n - 1, 2 * n - 1, -1))]
    for i in range(n):
        j = (i + 1) % n
        # Polygon points are counter-clockwise from above.  Walk down before
        # moving to the next point so the side loops face outwards as well.
        faces.append((i, n + i, n + j, j))
        faces.append((n + i, 2 * n + i, 2 * n + j, n + j))
    obj = create_mesh(name, vertices, faces, parent, mat)
    obj.location = (cx, cy, 0.0)
    obj["pivot"] = "fragment-centroid"
    obj["releaseOrder"] = int(name.rsplit("_", 1)[-1])
    return obj


def build_crackle(mats: dict[str, bpy.types.Material]) -> dict[str, bpy.types.Object]:
    roots = {
        "intact": create_root("Cloudway_Crackle_Intact"),
        "warning": create_root("Cloudway_Crackle_Warning"),
        "release": create_root("Cloudway_Crackle_Release"),
    }
    intact_slab = crackle_slab_data(roots["intact"], mats["rose"], "Cloudway_Crackle_Intact__Slab")
    intact_frame = crackle_frame(roots["intact"], mats["gold"], "Cloudway_Crackle_Intact__FrameGold")

    warning_slab = bpy.data.objects.new("Cloudway_Crackle_Warning__Slab", intact_slab.data)
    bpy.context.scene.collection.objects.link(warning_slab)
    warning_slab.parent = roots["warning"]
    warning_frame = bpy.data.objects.new("Cloudway_Crackle_Warning__FrameGold", intact_frame.data)
    bpy.context.scene.collection.objects.link(warning_frame)
    warning_frame.parent = roots["warning"]
    multi_tube(
        "Cloudway_Crackle_Warning__CrackGlow",
        crack_lines(0.009),
        0.0065,
        roots["warning"],
        mats["crack"],
        5,
    )

    release_frame = bpy.data.objects.new("Cloudway_Crackle_Release__FrameGold", intact_frame.data)
    bpy.context.scene.collection.objects.link(release_frame)
    release_frame.parent = roots["release"]
    c = (0.08, 0.03)
    boundary = [
        (-LANDING_WIDTH / 2, -LANDING_DEPTH / 2),
        (0.16, -LANDING_DEPTH / 2),
        (LANDING_WIDTH / 2, -LANDING_DEPTH / 2),
        (LANDING_WIDTH / 2, LANDING_DEPTH / 2),
        (-0.18, LANDING_DEPTH / 2),
        (-LANDING_WIDTH / 2, LANDING_DEPTH / 2),
    ]
    for index in range(6):
        shard(
            f"Cloudway_Crackle_Release__Shard_{index + 1:02d}",
            [c, boundary[index], boundary[(index + 1) % len(boundary)]],
            roots["release"],
            mats["rose"],
        )
    return roots


def configure_root_records(roots: dict[str, bpy.types.Object]) -> dict[str, object]:
    result: dict[str, object] = {}
    for name in ROOT_NAMES:
        root = roots[name]
        meshes = [obj for obj in descendants(root) if obj.type == "MESH"]
        low, high = object_bounds(meshes)
        visual = gltf_bounds(low, high)
        triangles = triangle_count(meshes)
        state = "static"
        if name.endswith("_Intact"):
            state = "intact"
        elif name.endswith("_Warning"):
            state = "warning"
        elif name.endswith("_Release"):
            state = "release"
        root_metadata(root, state, visual, triangles)
        result[name] = {
            "descendantMeshes": [obj.name for obj in meshes],
            "triangles": triangles,
            "landingBoundsGlTfYUpMetres": {
                "min": [-LANDING_WIDTH / 2, 0.0, -LANDING_DEPTH / 2],
                "max": [LANDING_WIDTH / 2, 0.0, LANDING_DEPTH / 2],
            },
            "collider": {
                "shape": "box",
                "width": LANDING_WIDTH,
                "depth": LANDING_DEPTH,
                "height": COLLIDER_HEIGHT,
                "topY": 0.0,
                "center": [0.0, -COLLIDER_HEIGHT / 2, 0.0],
            },
            "visualBoundsGlTfYUpMetres": visual,
            "materials": sorted({material.name for obj in meshes for material in obj.data.materials}),
        }
    return result


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def proof_scene() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1440
    scene.render.resolution_y = 840
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("Cloudway proof world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.52, 0.63, 0.72, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
    scene.world = world
    floor_mat = material("Cloudway__ProofFloor", (0.76, 0.73, 0.68), 0.0, 0.82)
    bpy.ops.mesh.primitive_plane_add(size=30.0, location=(0.0, 0.0, -0.58))
    floor = bpy.context.object
    floor.name = "Cloudway__ProofFloor"
    floor.data.materials.append(floor_mat)
    for name, position, energy, color, size in (
        ("Cloudway__ProofKey", (-4.2, -5.0, 6.0), 1300.0, (1.0, 0.78, 0.58), 5.0),
        ("Cloudway__ProofFill", (5.0, -2.5, 4.5), 1050.0, (0.58, 0.82, 1.0), 4.5),
        ("Cloudway__ProofRim", (1.0, 5.0, 5.5), 1200.0, (0.65, 1.0, 0.86), 4.0),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.color = color
        data.shape = "DISK"
        data.size = size
        light = bpy.data.objects.new(name, data)
        scene.collection.objects.link(light)
        light.location = position
        point_at(light, Vector((0.0, 0.0, -0.1)))
    camera_data = bpy.data.cameras.new("Cloudway__ProofCamera")
    camera_data.type = "ORTHO"
    camera = bpy.data.objects.new("Cloudway__ProofCamera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (5.2, -7.6, 5.6)
    point_at(camera, Vector((0.0, 0.0, -0.08)))
    scene.camera = camera

    def set_visible(root: bpy.types.Object, visible: bool) -> None:
        for obj in [root, *descendants(root)]:
            obj.hide_render = not visible

    roots = [bpy.data.objects[name] for name in ROOT_NAMES]
    for root in roots:
        set_visible(root, False)
    family = [
        bpy.data.objects["Cloudway_Marble"],
        bpy.data.objects["Cloudway_Frost"],
        bpy.data.objects["Cloudway_Glide"],
        bpy.data.objects["Cloudway_Crackle_Intact"],
    ]
    for root, x in zip(family, (-3.15, -1.05, 1.05, 3.15)):
        set_visible(root, True)
        root.location.x = x
    camera_data.ortho_scale = 8.6
    scene.render.filepath = str(PROOF_FAMILY)
    bpy.ops.render.render(write_still=True)

    for root in roots:
        set_visible(root, False)
        root.location = (0.0, 0.0, 0.0)
    crackle = [
        bpy.data.objects["Cloudway_Crackle_Intact"],
        bpy.data.objects["Cloudway_Crackle_Warning"],
        bpy.data.objects["Cloudway_Crackle_Release"],
    ]
    for root, x in zip(crackle, (-2.1, 0.0, 2.1)):
        set_visible(root, True)
        root.location.x = x
    release = bpy.data.objects["Cloudway_Crackle_Release"]
    for obj in descendants(release):
        if "__Shard_" not in obj.name:
            continue
        direction = Vector((obj.location.x, obj.location.y, 0.0))
        if direction.length:
            direction.normalize()
            obj.location += direction * 0.055
        obj.location.z -= 0.035 + 0.012 * int(obj.name.rsplit("_", 1)[-1])
    camera_data.ortho_scale = 7.2
    scene.render.filepath = str(PROOF_CRACKLE)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    for path in (SOURCE_BLEND.parent, BLENDER_GLB.parent, PROOF_FAMILY.parent, RUNTIME_TEXTURE_DIR):
        path.mkdir(parents=True, exist_ok=True)

    mats = {
        "ivory": material("Cloudway_Surface_Ivory", (0.91, 0.88, 0.80), 0.03, 0.28),
        "teal": material("Cloudway_Surface_Teal", (0.025, 0.22, 0.24), 0.12, 0.22),
        "gold": material("Cloudway_Shared_Gold", (0.76, 0.45, 0.13), 0.86, 0.20),
        "frost": material("Cloudway_Surface_Frost", (0.66, 0.90, 0.95), 0.02, 0.30, 0.16),
        "frost_etch": material("Cloudway_Frost_Etch", (0.93, 0.99, 1.0), 0.0, 0.22, 0.0, (0.63, 0.88, 1.0), 0.22),
        "celadon": material("Cloudway_Surface_Celadon", (0.025, 0.26, 0.28), 0.10, 0.20, 0.10),
        "rose": material("Cloudway_Shared_RoseCrystal", (0.46, 0.055, 0.105), 0.04, 0.22, 0.0),
        "crack": material("Cloudway_Crackle_Glow", (1.0, 0.50, 0.24), 0.05, 0.18, 0.0, (1.0, 0.16, 0.04), 1.4),
    }

    roots: dict[str, bpy.types.Object] = {}
    donors: dict[str, object] = {}
    for asset, config in DONORS.items():
        root = create_root(str(config["root"]))
        roots[root.name] = root
        donors[asset] = normalize_donor(asset, config, root)
        surface_inlays(root, asset, mats)
    crackle_roots = build_crackle(mats)
    for root in crackle_roots.values():
        roots[root.name] = root
    bpy.context.view_layer.update()

    records = configure_root_records(roots)
    if set(records) != set(ROOT_NAMES):
        raise ValueError("The final root contract drifted")
    for name, record in records.items():
        triangles = int(record["triangles"])
        if name in {"Cloudway_Marble", "Cloudway_Frost", "Cloudway_Glide"} and not (2000 <= triangles <= 8000):
            raise ValueError(f"{name} missed the primary 2k-8k triangle target: {triangles}")

    bpy.ops.file.pack_all()
    missing = sorted(
        image.filepath
        for image in bpy.data.images
        if image.type == "IMAGE" and image.source != "GENERATED" and image.packed_file is None
    )
    if missing:
        raise ValueError(f"Packed source still has external images: {missing}")
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND), compress=True, check_existing=False)

    export_objects = [roots[name] for name in ROOT_NAMES]
    for root in list(export_objects):
        export_objects.extend(descendants(root))
    select_only(export_objects)
    bpy.ops.export_scene.gltf(
        filepath=str(BLENDER_GLB),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_materials="EXPORT",
        export_animations=False,
        export_tangents=True,
    )
    report = {
        "schema": 1,
        "assetId": "cloudway-platform-kit-v1",
        "status": "Blender source and uncompressed export built; optimized export validation pending",
        "coordinates": "Blender Z-up authoring; glTF +Y up; metres",
        "landingEdgeSemantics": "Every visible flat landing skin spans the 1.70 x 1.30 metre collider exactly at y=0; the 1.80 x 1.40 outer shell and all flora, frames, finials, crystals, and undersides are decorative non-supporting geometry.",
        "donors": donors,
        "nodes": records,
        "packedBlend": {
            "file": str(SOURCE_BLEND.relative_to(ART)),
            "bytes": SOURCE_BLEND.stat().st_size,
            "sha256": digest(SOURCE_BLEND),
            "missingExternalImages": missing,
        },
        "blenderExport": {
            "file": str(BLENDER_GLB.relative_to(ART)),
            "bytes": BLENDER_GLB.stat().st_size,
            "sha256": digest(BLENDER_GLB),
        },
        "rebuild": {
            "workingDirectory": "repository root",
            "command": "rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v2/production/build_platform_kit.py",
            "blender": bpy.app.version_string,
        },
    }
    BUILD_REPORT.write_text(json.dumps(report, indent=2) + "\n")
    proof_scene()
    print(
        "CLOUDWAY_PLATFORM_BUILD="
        + json.dumps(
            {
                "blend": str(SOURCE_BLEND),
                "glb": str(BLENDER_GLB),
                "triangles": {name: row["triangles"] for name, row in records.items()},
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
