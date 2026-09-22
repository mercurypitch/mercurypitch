"""Build the review-only Cloudway v3 kit from the original textured Meshy donors.

V2 covered aggressively remeshed donor tops with opaque procedural slabs. This
build keeps the donor UV/PBR surface at the gameplay landing datum, reduces the
original shells only as far as needed for a practical runtime candidate, and
adds a narrow exact-size boundary instead of replacing the donor artwork.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector


sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ART = HERE.parent
PLATFORM_TRIALS = ART.parent
V2 = PLATFORM_TRIALS / "v2"
REPO = HERE.parents[4]

SOURCE_BLEND = ART / "sources" / "cloudway-platform-kit-v3.blend"
BLENDER_GLB = ART / "exports" / "cloudway-platform-kit-v3-blender.glb"
BUILD_REPORT = ART / "production" / "cloudway-platform-kit-v3-build.json"
PROOF_FAMILY = ART / "proofs" / "cloudway-platform-kit-v3.png"
PROOF_DETAIL = ART / "proofs" / "cloudway-platform-kit-v3-surface-detail.png"
PROOF_CRACKLE = ART / "proofs" / "cloudway-platform-kit-v3-crackle.png"
PROOF_CONTACT = ART / "proofs" / "cloudway-platform-kit-v3-contact-datum.png"
RUNTIME_TEXTURE_DIR = ART / "sources" / "runtime-textures"

SHELL_WIDTH = 1.80
SHELL_DEPTH = 1.40
LANDING_WIDTH = 1.70
LANDING_DEPTH = 1.30
COLLIDER_HEIGHT = 0.24
TEXTURE_LIMIT = 2048

DONORS = {
    "marble": {
        "root": "Cloudway_Marble",
        "source": V2 / "meshy" / "marble" / "donor.glb",
        "targetTriangles": 40_000,
    },
    "frost": {
        "root": "Cloudway_Frost",
        "source": V2 / "meshy" / "frost" / "donor.glb",
        "targetTriangles": 35_000,
    },
    "glide": {
        "root": "Cloudway_Glide",
        "source": V2 / "meshy" / "glide" / "donor.glb",
        "targetTriangles": 35_000,
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


def load_v2_builder():
    module_path = V2 / "production" / "build_platform_kit.py"
    spec = importlib.util.spec_from_file_location("cloudway_v2_builder", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load v2 build helpers from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.RUNTIME_TEXTURE_DIR = RUNTIME_TEXTURE_DIR
    module.PROOF_FAMILY = PROOF_FAMILY
    module.PROOF_CRACKLE = PROOF_CRACKLE
    return module


V2_BUILD = load_v2_builder()


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def exact_boundary(root: bpy.types.Object, mat: bpy.types.Material) -> bpy.types.Object:
    """Create an exact 1.70 x 1.30 m marker without covering the donor top."""

    outer = (LANDING_WIDTH, LANDING_DEPTH)
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
    faces: list[tuple[int, ...]] = []
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
    boundary = V2_BUILD.create_mesh(root.name + "__LandingBoundary", vertices, faces, root, mat)
    boundary["purpose"] = "visual marker for the exact gameplay collider; donor PBR landing remains exposed"
    boundary["supporting"] = False
    return boundary


def pack_runtime_images(images: list[bpy.types.Image], prefix: str) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for index, image in enumerate(images):
        if image.type != "IMAGE":
            continue
        width, height = int(image.size[0]), int(image.size[1])
        if max(width, height) <= 0:
            continue
        source_dimensions = [width, height]
        if max(width, height) > TEXTURE_LIMIT:
            factor = TEXTURE_LIMIT / max(width, height)
            image.scale(max(1, round(width * factor)), max(1, round(height * factor)))
        image.name = f"{prefix}__Atlas_{index + 1:02d}_2K"
        runtime_path = RUNTIME_TEXTURE_DIR / f"{prefix.lower()}-atlas-{index + 1:02d}-2k.png"
        image.filepath_raw = str(runtime_path)
        image.file_format = "PNG"
        image.save()
        if image.packed_file is not None:
            image.unpack(method="REMOVE")
        image.filepath_raw = str(runtime_path)
        image.reload()
        if max(int(image.size[0]), int(image.size[1])) > TEXTURE_LIMIT:
            raise ValueError(f"Texture limit failed for {image.name}: {list(image.size)}")
        image.pack()
        rows.append(
            {
                "image": image.name,
                "sourceDimensions": source_dimensions,
                "runtimeDimensions": [int(image.size[0]), int(image.size[1])],
                "runtimeFile": str(runtime_path.relative_to(ART)),
                "runtimeBytes": runtime_path.stat().st_size,
                "runtimeSha256": digest(runtime_path),
                "packed": bool(image.packed_file),
            }
        )
    return rows


def landing_contact_measurements(obj: bpy.types.Object) -> dict[str, object]:
    """Measure the broad upward donor surface close to the flat collider datum."""

    zones: dict[str, dict[str, object]] = {
        "all": {"heights": [], "area": 0.0},
        "center": {"heights": [], "area": 0.0},
        "edge": {"heights": [], "area": 0.0},
    }
    for polygon in obj.data.polygons:
        centre = polygon.center
        if polygon.normal.z <= 0.72:
            continue
        if abs(centre.x) > LANDING_WIDTH / 2 or abs(centre.y) > LANDING_DEPTH / 2:
            continue
        vertex_heights = [float(obj.data.vertices[index].co.z) for index in polygon.vertices]
        # Only classify a face as supported walkable surface when every corner
        # is within the gameplay tolerance. This excludes gold trim, foliage,
        # and small decorative ledges inside the XY footprint.
        if max(abs(value) for value in vertex_heights) > 0.01:
            continue
        memberships = ["all"]
        if abs(centre.x) <= 0.55 and abs(centre.y) <= 0.40:
            memberships.append("center")
        if abs(centre.x) >= 0.70 or abs(centre.y) >= 0.50:
            memberships.append("edge")
        for zone in memberships:
            zones[zone]["heights"].extend(vertex_heights)
            zones[zone]["area"] = float(zones[zone]["area"]) + polygon.area

    result: dict[str, object] = {}
    for name, zone in zones.items():
        heights = list(zone["heights"])
        if not heights:
            raise ValueError(f"{obj.name} has no {name} landing contact samples")
        result[name] = {
            "sampleCount": len(heights),
            "upwardAreaSquareMetres": round(float(zone["area"]), 6),
            "heightRangeMetres": [round(min(heights), 6), round(max(heights), 6)],
            "maxAbsoluteErrorMetres": round(max(abs(value) for value in heights), 6),
        }
    return result


def flatten_donor_landing(obj: bpy.types.Object) -> dict[str, object]:
    """Flatten only the broad donor landing; UVs, textures, and silhouette stay intact."""

    selected: set[int] = set()
    for polygon in obj.data.polygons:
        centre = polygon.center
        if polygon.normal.z <= 0.72:
            continue
        if abs(centre.x) > LANDING_WIDTH / 2 or abs(centre.y) > LANDING_DEPTH / 2:
            continue
        if abs(centre.z) > 0.035:
            continue
        for vertex_index in polygon.vertices:
            vertex = obj.data.vertices[vertex_index]
            if (
                abs(vertex.co.x) <= LANDING_WIDTH / 2 + 0.01
                and abs(vertex.co.y) <= LANDING_DEPTH / 2 + 0.01
                and abs(vertex.co.z) <= 0.055
            ):
                selected.add(vertex_index)
    if not selected:
        raise ValueError(f"No donor landing vertices selected for {obj.name}")
    before = [float(obj.data.vertices[index].co.z) for index in selected]
    for index in selected:
        obj.data.vertices[index].co.z = 0.0
    obj.data.update()
    measurements = landing_contact_measurements(obj)
    maximum_error = max(
        float(zone["maxAbsoluteErrorMetres"])
        for zone in measurements.values()
    )
    if maximum_error > 0.01:
        raise ValueError(f"{obj.name} landing remains {maximum_error:.6f}m from collider datum")
    obj["landingFlattened"] = True
    obj["landingFlattenedVertexCount"] = len(selected)
    obj["landingFlattenTargetZ"] = 0.0
    obj["landingContactMaxErrorMetres"] = maximum_error
    return {
        "method": "flatten vertices on broad upward-facing donor polygons within 3.5cm of the sampled landing datum; preserve UV/PBR and all silhouette geometry",
        "flattenedVertices": len(selected),
        "selectedHeightRangeBeforeMetres": [round(min(before), 6), round(max(before), 6)],
        "targetBlenderZ": 0.0,
        "measurementsAfter": measurements,
    }


def normalize_and_reduce(asset: str, config: dict[str, object], root: bpy.types.Object) -> dict[str, object]:
    source = Path(config["source"])
    before_objects = set(bpy.data.objects)
    before_images = set(bpy.data.images)
    before_materials = set(bpy.data.materials)
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported = [obj for obj in bpy.data.objects if obj not in before_objects]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if len(meshes) != 1:
        raise ValueError(f"{asset} expected one original donor mesh, got {len(meshes)}")
    obj = meshes[0]
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    obj.parent = None
    obj.data.update()

    source_triangles = V2_BUILD.triangle_count([obj])
    low, high = V2_BUILD.object_bounds([obj])
    landing = V2_BUILD.dominant_landing_height(obj)
    size = high - low
    scale_x = SHELL_WIDTH / size.x
    scale_y = SHELL_DEPTH / size.y
    # Translate first in donor space, then scale. This puts the sampled donor
    # landing exactly at z=0 instead of scaling around the file origin.
    transform = Matrix.Diagonal((scale_x, scale_y, scale_x, 1.0)) @ Matrix.Translation(
        Vector((-(low.x + high.x) * 0.5, -(low.y + high.y) * 0.5, -landing))
    )
    obj.data.transform(transform)
    obj.data.update()

    target_triangles = int(config["targetTriangles"])
    ratio = min(1.0, target_triangles / source_triangles)
    if ratio < 1.0:
        modifier = obj.modifiers.new("v3_selective_shell_reduction", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        V2_BUILD.select_only([obj])
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.validate(clean_customdata=False)
    obj.data.update()
    reduced_triangles = V2_BUILD.triangle_count([obj])
    landing_flatten = flatten_donor_landing(obj)
    obj.name = str(config["root"]) + "__DonorShell"
    obj.data.name = obj.name + "__Mesh"
    obj.parent = root
    obj["source"] = str(source.relative_to(REPO))
    obj["sourceSha256"] = digest(source)
    obj["sourceTriangles"] = source_triangles
    obj["targetTriangles"] = target_triangles
    obj["reducedTriangles"] = reduced_triangles

    for other in imported:
        if other is not obj:
            bpy.data.objects.remove(other, do_unlink=True)
    for index, mat in enumerate(mat for mat in bpy.data.materials if mat not in before_materials):
        mat.name = f"{config['root']}__DonorAtlas_{index + 1:02d}_2K"
    textures = pack_runtime_images(
        [image for image in bpy.data.images if image not in before_images],
        str(config["root"]),
    )
    normalized_low, normalized_high = V2_BUILD.object_bounds([obj])
    normalized_landing = V2_BUILD.dominant_landing_height(obj)
    return {
        "source": str(source.relative_to(REPO)),
        "sourceSha256": digest(source),
        "sourceBytes": source.stat().st_size,
        "sourceTriangles": source_triangles,
        "targetTriangles": target_triangles,
        "reducedTriangles": reduced_triangles,
        "retainedPercent": round(100.0 * reduced_triangles / source_triangles, 3),
        "rawLandingPlaneBlenderZ": landing,
        "normalization": {
            "shellWidth": round(normalized_high.x - normalized_low.x, 6),
            "shellDepth": round(normalized_high.y - normalized_low.y, 6),
            "donorLandingBlenderZ": round(normalized_landing, 6),
            "method": "donor landing sampled before reduction, translated to z=0, nonuniform XY fit with X scale retained vertically",
        },
        "landingFlatten": landing_flatten,
        "runtimeTextures": textures,
    }


def root_metadata(root: bpy.types.Object, state: str, visual: dict[str, list[float]], triangles: int) -> None:
    root["assetId"] = "cloudway-platform-kit-v3-review"
    root["platformFamily"] = root.name.removeprefix("Cloudway_").lower()
    root["state"] = state
    root["units"] = "metres"
    root["upAxis"] = "+Y"
    root["origin"] = "top-centre of sampled donor landing datum"
    root["landingPlaneY"] = 0.0
    root["landing_json"] = json.dumps(
        {
            "min": [-LANDING_WIDTH / 2, 0.0, -LANDING_DEPTH / 2],
            "max": [LANDING_WIDTH / 2, 0.0, LANDING_DEPTH / 2],
            "width": LANDING_WIDTH,
            "depth": LANDING_DEPTH,
            "edgeSemantics": "exact gold boundary marks gameplay support; original donor UV/PBR surface remains visible at the landing datum",
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


def configure_root_records(roots: dict[str, bpy.types.Object]) -> dict[str, object]:
    result: dict[str, object] = {}
    for name in ROOT_NAMES:
        root = roots[name]
        meshes = [obj for obj in V2_BUILD.descendants(root) if obj.type == "MESH"]
        low, high = V2_BUILD.object_bounds(meshes)
        visual = V2_BUILD.gltf_bounds(low, high)
        triangles = V2_BUILD.triangle_count(meshes)
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
            "collider": json.loads(str(root["collider_json"])),
            "visualBoundsGlTfYUpMetres": visual,
            "materials": sorted({material.name for obj in meshes for material in obj.data.materials}),
        }
    return result


def render_proofs() -> None:
    V2_BUILD.PROOF_FAMILY = PROOF_FAMILY
    V2_BUILD.PROOF_CRACKLE = PROOF_CRACKLE
    V2_BUILD.proof_scene()
    scene = bpy.context.scene
    camera = bpy.data.objects["Cloudway__ProofCamera"]
    camera_data = camera.data

    def set_visible(root: bpy.types.Object, visible: bool) -> None:
        for obj in [root, *V2_BUILD.descendants(root)]:
            obj.hide_render = not visible

    roots = [bpy.data.objects[name] for name in ROOT_NAMES]
    for root in roots:
        set_visible(root, False)
        root.location = (0.0, 0.0, 0.0)
    for root, x in zip((bpy.data.objects[name] for name in ROOT_NAMES[:3]), (-2.0, 0.0, 2.0)):
        set_visible(root, True)
        root.location.x = x
    camera.location = (3.9, -5.2, 6.5)
    V2_BUILD.point_at(camera, Vector((0.0, 0.0, -0.02)))
    camera_data.ortho_scale = 6.35
    scene.render.filepath = str(PROOF_DETAIL)
    bpy.ops.render.render(write_still=True)

    datum_material = V2_BUILD.material(
        "Cloudway__ContactDatumProof",
        (0.02, 0.76, 0.86),
        0.0,
        0.25,
        0.0,
        (0.02, 0.76, 0.86),
        2.4,
    )
    proof_root = V2_BUILD.create_root("Cloudway__ContactProofRoot")
    for index, x in enumerate((-2.0, 0.0, 2.0), start=1):
        V2_BUILD.box(
            f"Cloudway__ContactDatumX_{index}",
            (LANDING_WIDTH, 0.010, 0.004),
            (x, 0.0, 0.002),
            proof_root,
            datum_material,
        )
        V2_BUILD.box(
            f"Cloudway__ContactDatumY_{index}",
            (0.010, LANDING_DEPTH, 0.004),
            (x, 0.0, 0.002),
            proof_root,
            datum_material,
        )
    camera.location = (4.8, -7.4, 1.55)
    V2_BUILD.point_at(camera, Vector((0.0, 0.0, -0.02)))
    camera_data.ortho_scale = 6.6
    scene.render.filepath = str(PROOF_CONTACT)
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
        "gold": V2_BUILD.material("Cloudway_Shared_Gold", (0.76, 0.45, 0.13), 0.86, 0.20),
        "rose": V2_BUILD.material("Cloudway_Shared_RoseCrystal", (0.46, 0.055, 0.105), 0.04, 0.22),
        "crack": V2_BUILD.material(
            "Cloudway_Crackle_Glow",
            (1.0, 0.50, 0.24),
            0.05,
            0.18,
            0.0,
            (1.0, 0.16, 0.04),
            1.4,
        ),
    }

    roots: dict[str, bpy.types.Object] = {}
    donors: dict[str, object] = {}
    for asset, config in DONORS.items():
        root = V2_BUILD.create_root(str(config["root"]))
        roots[root.name] = root
        donors[asset] = normalize_and_reduce(asset, config, root)
        exact_boundary(root, mats["gold"])
    for root in V2_BUILD.build_crackle(mats).values():
        roots[root.name] = root
    bpy.context.view_layer.update()

    records = configure_root_records(roots)
    if set(records) != set(ROOT_NAMES):
        raise ValueError("The v3 root contract drifted")
    for asset, config in DONORS.items():
        count = int(records[str(config["root"])]["triangles"])
        target = int(config["targetTriangles"])
        if not (target * 0.92 <= count <= target * 1.04):
            raise ValueError(f"{asset} missed selective triangle target: {count} vs {target}")

    bpy.ops.file.pack_all()
    missing = sorted(
        image.filepath
        for image in bpy.data.images
        if image.type == "IMAGE" and image.source != "GENERATED" and image.packed_file is None
    )
    if missing:
        raise ValueError(f"Packed v3 source still has external images: {missing}")
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND), compress=True, check_existing=False)

    export_objects = [roots[name] for name in ROOT_NAMES]
    for root in list(export_objects):
        export_objects.extend(V2_BUILD.descendants(root))
    V2_BUILD.select_only(export_objects)
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
        "assetId": "cloudway-platform-kit-v3-review",
        "status": "review-only Blender source and uncompressed export built; optimized validation pending",
        "coordinates": "Blender Z-up authoring; glTF +Y up; metres",
        "landingEdgeSemantics": "The sampled original donor landing is at y=0 and remains exposed. A narrow exact 1.70 x 1.30 metre gold boundary marks the authoritative gameplay collider without replacing the donor marble, celadon, inlay, foliage, or crystalline surface.",
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
            "command": "rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v3/production/build_platform_kit_v3.py",
            "blender": bpy.app.version_string,
        },
    }
    BUILD_REPORT.write_text(json.dumps(report, indent=2) + "\n")
    render_proofs()
    print(
        "CLOUDWAY_PLATFORM_V3_BUILD="
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
