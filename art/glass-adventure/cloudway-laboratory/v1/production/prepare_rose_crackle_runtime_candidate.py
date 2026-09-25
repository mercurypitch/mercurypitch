#!/usr/bin/env python3
"""Build the polished Rose hybrid candidate against the frozen runtime contract."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
from typing import Any

import bmesh
import bpy


HERE = Path(__file__).resolve().parent


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path.name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


PREPARE = load_module("cloudway_prepare_dense_master", HERE / "prepare_dense_master.py")
EARLIER = load_module(
    "cloudway_prepare_rose_semantic_candidate",
    HERE / "prepare_rose_crackle_semantic_candidate.py",
)
GEOMETRY = load_module(
    "cloudway_crackle_candidate_geometry", HERE / "crackle_candidate_geometry.py"
)
VISUALS = load_module(
    "cloudway_rose_runtime_visuals", HERE / "rose_crackle_runtime_visuals.py"
)


SOURCE = PREPARE.SOURCE
ASSET = "rose-quartz-crackle-fast"
ROOT_NAME = "CloudwayLab_RoseQuartzCrackleFast"
PERSISTENT_NAME = f"{ROOT_NAME}__persistent"
INTACT_NAME = f"{ROOT_NAME}__intact"
CONTACT_NAME = f"{ROOT_NAME}__contact"
SHARD_PREFIX = f"{ROOT_NAME}__shard_"
SOURCE_ROOT_NAME = "Cloudway_RoseQuartzCrackleFast_DenseMaster"
SOURCE_REVIEW_NAME = f"{ASSET}__normalized_review"
CONTACT_EXTENT = 1.64
COLLIDER_HEIGHT = 0.24
INNER_SHELL_EXTENT = 1.56
INNER_SHELL_BOTTOM = -0.20
INNER_SHELL_OFFSET_Z = -0.02
# The micro-bevel raises the evaluated cap by as much as 7.5 mm. Keep that cap
# well below the archived provider relief so the open PBR overlay never z-fights.
SHARD_TOP = -0.035
SHARD_BOTTOM = -0.24
CORNER_WORLD_THRESHOLD = 0.705
CORNER_OUTWARD_SCALE = 1.004
CORNER_UP_OFFSET = 0.003


def paths() -> dict[str, Path]:
    asset_dir = SOURCE / "blender" / ASSET
    proof_dir = SOURCE / "proofs" / "blender" / ASSET / "runtime-hybrid-candidate"
    production_dir = SOURCE / "production" / ASSET
    return {
        "baseline": asset_dir / f"{ASSET}-dense-master.blend",
        "baselineReport": HERE / "reports" / f"{ASSET}-dense-master.json",
        "feasibility": HERE / "reports" / f"{ASSET}-crackle-feasibility.json",
        "maskReport": HERE / "reports" / f"{ASSET}-gold-mask.json",
        "mask": production_dir / "rose-gold-mask-v1.png",
        "reference": SOURCE / "references" / f"{ASSET}.png",
        "candidate": asset_dir / f"{ASSET}-runtime-hybrid-candidate.blend",
        "proofDir": proof_dir,
        "report": production_dir / "runtime-hybrid-candidate-report.json",
        "mirror": HERE / "reports" / f"{ASSET}-runtime-hybrid-candidate.json",
    }


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def new_collection(name: str, parent: bpy.types.Collection | None = None) -> bpy.types.Collection:
    result = bpy.data.collections.new(name)
    (parent.children if parent is not None else bpy.context.scene.collection.children).link(result)
    return result


def empty(name: str, collection: bpy.types.Collection, parent: bpy.types.Object | None) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    collection.objects.link(obj)
    obj.parent = parent
    return obj


def provider_intact_mesh(source_review: bpy.types.Object) -> tuple[bpy.types.Mesh, dict[str, Any]]:
    mesh = source_review.data.copy()
    mesh.name = "RoseProviderIntactExteriorGeometry"
    mesh.transform(source_review.matrix_world)
    mesh.materials.clear()
    mesh.update()
    minimum, maximum = GEOMETRY.mesh_bounds(mesh)
    mesh["sourceGeometry"] = "exact dense normalized donor exterior; source object transform baked"
    mesh["collision"] = False
    return mesh, {
        "sourceVertices": len(mesh.vertices),
        "sourcePolygons": len(mesh.polygons),
        "transform": "normalized review matrix baked exactly; no visual scaling or inset",
        "boundsBlenderZUpMetres": {
            "min": [round(float(value), 9) for value in minimum],
            "max": [round(float(value), 9) for value in maximum],
        },
    }


def source_corner_mesh(source_review: bpy.types.Object) -> tuple[bpy.types.Mesh, dict[str, Any]]:
    mesh = source_review.data.copy()
    mesh.name = "RoseSourceCornerFiligreeGeometry"
    matrix = source_review.matrix_world.copy()
    edit = bmesh.new()
    edit.from_mesh(mesh)
    edit.faces.ensure_lookup_table()
    keep = []
    discard = []
    for face in edit.faces:
        centre = matrix @ face.calc_center_median()
        target = (
            abs(float(centre.x)) >= CORNER_WORLD_THRESHOLD
            and abs(float(centre.y)) >= CORNER_WORLD_THRESHOLD
        )
        (keep if target else discard).append(face)
    require(keep, "Geometry-space source corner extraction selected no faces")
    bmesh.ops.delete(edit, geom=discard, context="FACES")
    loose = [vertex for vertex in edit.verts if not vertex.link_faces]
    if loose:
        bmesh.ops.delete(edit, geom=loose, context="VERTS")
    for vertex in edit.verts:
        world = matrix @ vertex.co
        vertex.co = (
            world.x * CORNER_OUTWARD_SCALE,
            world.y * CORNER_OUTWARD_SCALE,
            world.z + CORNER_UP_OFFSET,
        )
    edit.to_mesh(mesh)
    edit.free()
    mesh.materials.clear()
    mesh.update()
    require(len(mesh.polygons) > 0, "Source corner extraction became empty")
    minimum, maximum = GEOMETRY.mesh_bounds(mesh)
    mesh["sourceGeometry"] = "dense donor geometry-space corner face extraction"
    mesh["closed"] = False
    mesh["collision"] = False
    return mesh, {
        "method": "face-centroid absolute world X/Y threshold",
        "thresholdMetres": CORNER_WORLD_THRESHOLD,
        "selectedSourceFaces": len(mesh.polygons),
        "selectedVertices": len(mesh.vertices),
        "outwardScaleAboutOrigin": CORNER_OUTWARD_SCALE,
        "upOffsetMetres": CORNER_UP_OFFSET,
        "boundsBlenderZUpMetres": {
            "min": [round(float(value), 9) for value in minimum],
            "max": [round(float(value), 9) for value in maximum],
        },
        "topology": "open static decoration by design; never fracture or collision",
    }


def contact_object(collection: bpy.types.Collection, root: bpy.types.Object) -> bpy.types.Object:
    half = CONTACT_EXTENT * 0.5
    mesh = bpy.data.meshes.new("RoseRuntimeContactRectangleGeometry")
    mesh.from_pydata(
        [(-half, -half, 0.0), (half, -half, 0.0), (half, half, 0.0), (-half, half, 0.0)],
        [],
        [[0, 1, 2, 3]],
    )
    mesh.update()
    obj = GEOMETRY.object_from_mesh(CONTACT_NAME, mesh, collection, root)
    obj["semanticRole"] = "non-rendered-contact-reference"
    obj["width"] = CONTACT_EXTENT
    obj["depth"] = CONTACT_EXTENT
    obj["topBlenderZ"] = 0.0
    obj.hide_render = True
    obj.hide_viewport = True
    obj.display_type = "WIRE"
    return obj


def platform_metadata() -> dict[str, Any]:
    return {
        "version": 1,
        "coordinates": {
            "upAxis": "+Y",
            "units": "metres",
            "origin": "top-centre-of-fully-extended-support",
        },
        "support": {
            "state": "intact",
            "topY": 0,
            "width": CONTACT_EXTENT,
            "depth": CONTACT_EXTENT,
        },
        "motion": {
            "kind": "crackle",
            "roles": {
                "persistent": [PERSISTENT_NAME],
                "intactGlass": INTACT_NAME,
                "contact": CONTACT_NAME,
                "shards": [f"{SHARD_PREFIX}{index:03d}" for index in range(18)],
            },
            "materials": {
                "glass": VISUALS.GLASS_MATERIAL,
                "framework": VISUALS.FRAMEWORK_MATERIAL,
                "internalDetail": VISUALS.DETAIL_MATERIAL,
                "ivory": VISUALS.IVORY_MATERIAL,
                "cornerDetail": VISUALS.CORNER_MATERIAL,
            },
        },
    }


def create_shards(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    glass: bpy.types.Material,
) -> tuple[list[bpy.types.Object], list[bpy.types.Object], list[dict[str, Any]]]:
    cells = GEOMETRY.voronoi_cells(GEOMETRY.deterministic_rose_seeds(), CONTACT_EXTENT)
    require(len(cells) == 18, "Rose runtime contract requires exactly 18 shards")
    roots: list[bpy.types.Object] = []
    meshes: list[bpy.types.Object] = []
    records = []
    for index, polygon in enumerate(cells):
        name = f"{SHARD_PREFIX}{index:03d}"
        geometry_name = f"RoseRuntimeShardGlass_{index:03d}"
        mesh, centre = GEOMETRY.faceted_shard_mesh(
            f"{geometry_name}Geometry", polygon, SHARD_BOTTOM, SHARD_TOP, index
        )
        shard_root = empty(name, collection, root)
        shard_root.location = centre
        shard_root["semanticRole"] = "closed-runtime-fracture-shard"
        shard_root["assembledAabbCentre"] = True
        geometry = GEOMETRY.object_from_mesh(
            geometry_name, mesh, collection, shard_root, glass
        )
        geometry["semanticRole"] = "runtime-crystal-glass"
        geometry["closed"] = True
        bpy.context.view_layer.objects.active = geometry
        geometry.select_set(True)
        bevel = geometry.modifiers.new("Closed shard micro bevel", "BEVEL")
        bevel.width = 0.0045 + 0.0005 * (index % 3)
        bevel.segments = 1
        bevel.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=bevel.name)
        geometry.select_set(False)
        minimum, maximum = GEOMETRY.mesh_bounds(mesh)
        local_correction = (minimum + maximum) * 0.5
        for vertex in mesh.vertices:
            vertex.co -= local_correction
        mesh.update()
        shard_root.location += local_correction
        centre = shard_root.location.copy()
        shard_root.hide_render = True
        shard_root.hide_viewport = True
        minimum, maximum = GEOMETRY.mesh_bounds(mesh)
        for axis in range(3):
            require(abs(minimum[axis] + maximum[axis]) < 1e-6, f"{name} origin is not its AABB centre")
        records.append(
            {
                "root": name,
                "geometry": geometry.name,
                "assembledTranslationBlenderZUp": [round(float(value), 9) for value in centre],
                "evaluatedCapMaximumWorldZMetres": round(
                    float(maximum.z + centre.z), 9
                ),
                "localBounds": {
                    "min": [round(float(value), 9) for value in minimum],
                    "max": [round(float(value), 9) for value in maximum],
                },
                "vertices": len(mesh.vertices),
                "polygons": len(mesh.polygons),
            }
        )
        roots.append(shard_root)
        meshes.append(geometry)
    return roots, meshes, records


def create_shard_surface_details(
    provider_mesh: bpy.types.Mesh,
    shard_roots: list[bpy.types.Object],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
) -> tuple[list[bpy.types.Object], list[dict[str, Any]]]:
    """Partition provider faces into open shard-mounted detail without changing UVs."""
    seeds = GEOMETRY.deterministic_rose_seeds()
    require(len(seeds) == len(shard_roots), "Shard detail seed/root count mismatch")
    groups: list[list[int]] = [[] for _seed in seeds]
    for polygon in provider_mesh.polygons:
        centre = polygon.center
        index = min(
            range(len(seeds)),
            key=lambda candidate: (
                (float(centre.x) - seeds[candidate][0]) ** 2
                + (float(centre.y) - seeds[candidate][1]) ** 2
            ),
        )
        groups[index].append(polygon.index)
    require(all(groups), "Provider face partition produced an empty shard detail")

    details: list[bpy.types.Object] = []
    records: list[dict[str, Any]] = []
    source_corner_normals = provider_mesh.corner_normals
    for index, (root, polygon_indices) in enumerate(zip(shard_roots, groups)):
        vertex_map: dict[int, int] = {}
        vertices: list[tuple[float, float, float]] = []
        faces: list[list[int]] = []
        source_polygons: list[bpy.types.MeshPolygon] = []
        for polygon_index in polygon_indices:
            source_polygon = provider_mesh.polygons[polygon_index]
            face: list[int] = []
            for source_vertex_index in source_polygon.vertices:
                mapped = vertex_map.get(source_vertex_index)
                if mapped is None:
                    mapped = len(vertices)
                    vertex_map[source_vertex_index] = mapped
                    local = provider_mesh.vertices[source_vertex_index].co - root.location
                    vertices.append(tuple(float(value) for value in local))
                face.append(mapped)
            faces.append(face)
            source_polygons.append(source_polygon)

        mesh = bpy.data.meshes.new(f"RoseRuntimeShardSurfaceDetail_{index:03d}Geometry")
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        require(not mesh.validate(verbose=False), f"Shard detail {index:03d} failed mesh validation")
        loop_normals: list[tuple[float, float, float]] = []
        for target_polygon, source_polygon in zip(mesh.polygons, source_polygons):
            target_polygon.use_smooth = source_polygon.use_smooth
            loop_normals.extend(
                tuple(float(value) for value in source_corner_normals[loop_index].vector)
                for loop_index in source_polygon.loop_indices
            )
        if len(loop_normals) == len(mesh.loops):
            mesh.normals_split_custom_set(loop_normals)
        for source_layer in provider_mesh.uv_layers:
            target_layer = mesh.uv_layers.new(name=source_layer.name)
            for target_polygon, source_polygon in zip(mesh.polygons, source_polygons):
                for target_loop, source_loop in zip(
                    target_polygon.loop_indices, source_polygon.loop_indices
                ):
                    target_layer.data[target_loop].uv = source_layer.data[source_loop].uv
        mesh["sourceGeometry"] = "deterministic nearest-seed provider face partition"
        mesh["closed"] = False
        mesh["collision"] = False
        detail = GEOMETRY.object_from_mesh(
            f"RoseRuntimeShardSurfaceDetail_{index:03d}",
            mesh,
            collection,
            root,
            material,
        )
        detail["semanticRole"] = "open-provider-pbr-shard-surface-detail"
        detail["collision"] = False
        details.append(detail)
        records.append(
            {
                "object": detail.name,
                "sourceFaces": len(polygon_indices),
                "vertices": len(mesh.vertices),
                "polygons": len(mesh.polygons),
                "uvLayers": [layer.name for layer in mesh.uv_layers],
                "closed": False,
                "collision": False,
            }
        )
    require(
        sum(record["sourceFaces"] for record in records) == len(provider_mesh.polygons),
        "Shard detail partition lost provider faces",
    )
    return details, records


def main() -> None:
    resolved = paths()
    baseline_report = json.loads(resolved["baselineReport"].read_text())
    feasibility = json.loads(resolved["feasibility"].read_text())
    mask_report = json.loads(resolved["maskReport"].read_text())
    baseline_sha = baseline_report["packedBlend"]["sha256"]
    require(PREPARE.digest(resolved["baseline"]) == baseline_sha, "Dense Rose master changed")
    require(PREPARE.digest(resolved["mask"]) == mask_report["output"]["sha256"], "Reviewed Rose mask changed")
    bpy.ops.wm.open_mainfile(filepath=str(resolved["baseline"]), load_ui=False)
    EARLIER.clear_old_proof_stage()
    source_root = bpy.data.objects.get(SOURCE_ROOT_NAME)
    source_review = bpy.data.objects.get(SOURCE_REVIEW_NAME)
    require(source_root is not None and source_review is not None, "Dense Rose hierarchy missing")
    source_root["candidateUse"] = "hidden immutable provider reference"

    collection = new_collection("Cloudway_Rose_Runtime_Hybrid_Candidate")
    root = empty(ROOT_NAME, collection, None)
    persistent = empty(PERSISTENT_NAME, collection, root)
    intact = empty(INTACT_NAME, collection, root)
    root["assetId"] = ASSET
    root["status"] = "visual checkpoint; GLB export and runtime integration pending acceptance"
    root["sourceMasterSha256"] = baseline_sha
    root["sourceDecimated"] = False
    metadata = platform_metadata()
    root["platform_adapter_json"] = json.dumps(metadata, separators=(",", ":"))
    root["collider_json"] = json.dumps(
        {
            "shape": "box",
            "width": CONTACT_EXTENT,
            "depth": CONTACT_EXTENT,
            "height": COLLIDER_HEIGHT,
            "topY": 0,
            "center": [0, -COLLIDER_HEIGHT * 0.5, 0],
        },
        separators=(",", ":"),
    )

    images = VISUALS.source_images(resolved["mask"])
    source_material = source_review.material_slots[0].material
    require(source_material is not None, "Dense Rose provider material missing")
    materials = {
        "glass": VISUALS.glass_material(),
        "framework": VISUALS.framework_material(),
        "internalDetail": VISUALS.internal_detail_material(source_material),
        "ivory": VISUALS.ivory_material(),
        "cornerDetail": VISUALS.corner_provider_material(images),
    }
    shell_mesh = GEOMETRY.rose_faceted_glass_shell(INNER_SHELL_EXTENT, INNER_SHELL_BOTTOM)
    shell = GEOMETRY.object_from_mesh(
        "RoseRuntimeCrystalShell",
        shell_mesh,
        collection,
        intact,
        materials["glass"],
    )
    shell.location.z = INNER_SHELL_OFFSET_Z
    shell["semanticRole"] = "subordinate-closed-inner-crystal-glass"
    shell["collision"] = False
    detail_mesh, detail_record = provider_intact_mesh(source_review)
    detail = GEOMETRY.object_from_mesh(
        "RoseRuntimeProviderIntactExterior",
        detail_mesh,
        collection,
        intact,
        materials["internalDetail"],
    )
    detail["semanticRole"] = "exact-provider-pbr-intact-exterior"
    detail["collision"] = False
    gold_mesh, ivory_mesh, framework_record = GEOMETRY.rose_framework_geometry()
    framework = GEOMETRY.object_from_mesh(
        "RoseRuntimeGoldFramework", gold_mesh, collection, persistent, materials["framework"]
    )
    framework["semanticRole"] = "persistent-authored-gold-framework"
    ivory = GEOMETRY.object_from_mesh(
        "RoseRuntimeIvoryInlays", ivory_mesh, collection, persistent, materials["ivory"]
    )
    ivory["semanticRole"] = "persistent-authored-ivory-inlays"
    corner_mesh, corner_record = source_corner_mesh(source_review)
    corners = GEOMETRY.object_from_mesh(
        "RoseRuntimeSourceCornerFiligree",
        corner_mesh,
        collection,
        persistent,
        materials["cornerDetail"],
    )
    corners["semanticRole"] = "persistent-reviewed-source-corner-filigree"
    corners["collision"] = False
    contact = contact_object(collection, root)
    shard_roots, shard_meshes, shard_records = create_shards(collection, root, materials["glass"])
    shard_details, shard_detail_records = create_shard_surface_details(
        detail_mesh,
        shard_roots,
        collection,
        materials["internalDetail"],
    )
    for shard_record, surface_record in zip(shard_records, shard_detail_records):
        shard_record["surfaceDetail"] = surface_record
    cap_maximum = max(
        record["evaluatedCapMaximumWorldZMetres"] for record in shard_records
    )
    relief_minimum = (
        feasibility["surface"]["verticalRayAudit"]
        ["topOffsetFromLandingPlaneMillimetres"]["min"]
        / 1000.0
    )
    cap_clearance = relief_minimum - cap_maximum
    require(cap_maximum <= -0.0274, "Evaluated shard cap lost its inward clearance")
    require(cap_clearance >= 0.0275, "Shard glass is too close to the provider top relief")
    require(
        GEOMETRY.all_finite(
            [
                shell.data,
                detail.data,
                gold_mesh,
                ivory_mesh,
                corner_mesh,
                *(obj.data for obj in shard_meshes),
                *(obj.data for obj in shard_details),
            ]
        ),
        "Candidate contains non-finite geometry",
    )

    source_review.hide_render = True
    source_review.hide_viewport = True
    source_root.hide_render = False
    candidate_objects = [shell, detail, framework, ivory, corners]
    proof_files, render_inventories = VISUALS.render_proofs(
        PREPARE,
        resolved["proofDir"],
        source_review,
        candidate_objects,
        shell,
        detail,
        framework,
        ivory,
        corners,
        shard_roots,
        shard_meshes,
        shard_details,
    )
    source_review.hide_render = True
    source_review.hide_viewport = True
    source_root.hide_render = False
    for obj in candidate_objects:
        obj.hide_render = False
        obj.hide_viewport = False
    contact.hide_render = True
    contact.hide_viewport = True
    for obj in shard_roots:
        obj.hide_render = True
        obj.hide_viewport = True
    bpy.ops.file.pack_all()
    resolved["candidate"].parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(resolved["candidate"]), check_existing=False)
    require(PREPARE.digest(resolved["baseline"]) == baseline_sha, "Dense Rose master mutated")

    report = {
        "schema": "cloudway-rose-crackle-runtime-hybrid-candidate/v1",
        "assetId": ASSET,
        "status": "visual checkpoint; GLB export and runtime integration pending root acceptance",
        "source": {
            "denseMaster": baseline_report["packedBlend"],
            "reference": PREPARE.file_record(resolved["reference"]),
            "denseMasterUnchangedAfterBuild": True,
            "fullPbrMapsPacked": True,
            "decimation": False,
        },
        "runtimeContract": {
            "logicalId": "cloudway-lab-rose-crackle-v1",
            "root": ROOT_NAME,
            "metadata": metadata,
            "collider": {
                "shape": "box",
                "width": CONTACT_EXTENT,
                "depth": CONTACT_EXTENT,
                "height": COLLIDER_HEIGHT,
                "topY": 0,
                "center": [0, -COLLIDER_HEIGHT * 0.5, 0],
            },
            "coordinateConversion": "Blender Z-up source exports to glTF +Y; origin remains contact top-centre",
        },
        "contact": {
            "node": CONTACT_NAME,
            "shape": "rectangle",
            "widthMetres": CONTACT_EXTENT,
            "depthMetres": CONTACT_EXTENT,
            "topBlenderZ": 0.0,
            "topRuntimeY": 0.0,
            "ornamentalFaces": 0,
            "sourceRayEvidence": feasibility["surface"]["verticalRayAudit"],
            "scope": "authored gameplay proxy only; decorative relief and rails are excluded",
        },
        "intact": {
            "root": INTACT_NAME,
            "shell": {
                "object": shell.name,
                "extentMetres": INNER_SHELL_EXTENT,
                "bottomBeforeOffsetMetres": INNER_SHELL_BOTTOM,
                "objectOffsetBlenderZMetres": INNER_SHELL_OFFSET_Z,
                "newClosedGeometry": True,
                "subordinateToOpaqueExterior": True,
                "material": materials["glass"].name,
            },
            "internalDetail": {
                "object": detail.name,
                "sourcePreserved": True,
                "visibleIntactExterior": True,
                "fullProviderPbr": True,
                "collision": False,
                "material": materials["internalDetail"].name,
                **detail_record,
            },
            "goldLattice": {
                "source": "exact dense provider exterior",
                "material": materials["internalDetail"].name,
                "releasePolicy": "part of intact exterior; vanishes atomically before collision is removed",
            },
        },
        "persistent": {
            "root": PERSISTENT_NAME,
            "gold": {"object": framework.name, "material": materials["framework"].name},
            "ivory": {"object": ivory.name, "material": materials["ivory"].name},
            "sourceCorners": {
                "object": corners.name,
                "material": materials["cornerDetail"].name,
                "collision": False,
                "fractures": False,
                **corner_record,
            },
            "geometry": framework_record,
            "sourceCornerDecision": (
                "Reviewed world-space corner faces preserve the dense donor's original filigree and "
                "provider PBR as open, non-collision persistent decoration. The selection is geometric, "
                "not a metallic-pixel classifier. Persistent rails and restrained ivory inlays remain "
                "separate semantic materials and are offset from the intact donor to avoid coplanar faces. "
                "The provider's own top lattice lives under intact and vanishes on release."
            ),
        },
        "fracture": {
            "prefix": SHARD_PREFIX,
            "count": len(shard_records),
            "seedLayout": "fixed irregular 18-cell Voronoi; no grid or runtime randomness",
            "closed": True,
            "material": materials["glass"].name,
            "surfaceDetailMaterial": materials["internalDetail"].name,
            "surfaceDetailPolicy": (
                "all dense provider faces partition once by deterministic nearest Voronoi seed; "
                "open UV-preserving detail rides the matching closed glass shard"
            ),
            "rootOrigin": "each assembled AABB centre",
            "verticalExtentMetres": [SHARD_BOTTOM, SHARD_TOP + 0.0075],
            "capClearance": {
                "closedVolumeMaximumAfterBevelBlenderZ": cap_maximum,
                "minimumRayAuditedProviderTopBlenderZ": relief_minimum,
                "minimumSeparationMetres": round(cap_clearance, 9),
                "policy": "closed glass remains inward of the exact provider PBR surface",
            },
            "shards": shard_records,
        },
        "candidateBlend": PREPARE.file_record(resolved["candidate"]),
        "proofMethod": {
            "views": ["matched 48-degree game camera", "orthographic top", "matched low side"],
            "beauty": "512 Eevee samples, pastel field, no post blur",
            "detailProof": "matched top and side with the exact provider exterior toggled off",
            "transmissionWitness": "separate checker render; beauty remains a lighting judgment",
            "exploded": "persistent perimeter and corners fixed; intact body absent; 18 closed glass shards and matching provider surface partitions displaced",
            "renderIsolation": render_inventories,
        },
        "proofs": VISUALS.proof_records(PREPARE, proof_files),
        "rebuild": (
            "flock -w 1200 /tmp/glass-cloudway-blender.lock timeout 1200 /usr/bin/blender "
            "--background --python-exit-code 1 --python art/glass-adventure/cloudway-laboratory/"
            "v1/production/prepare_rose_crackle_runtime_candidate.py"
        ),
    }
    PREPARE.durable_json(resolved["report"], report)
    PREPARE.durable_json(resolved["mirror"], report)
    print(
        "ROSE_RUNTIME_HYBRID_CANDIDATE="
        + json.dumps(
            {
                "candidate": report["candidateBlend"],
                "proofs": len(report["proofs"]),
                "shards": len(shard_records),
                "detailBounds": detail_record["boundsBlenderZUpMetres"],
            },
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()
