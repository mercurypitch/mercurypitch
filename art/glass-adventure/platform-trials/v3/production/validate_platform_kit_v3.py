"""Fresh-import validation for the review-only Cloudway v3 platform kit."""

from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector


sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
FINAL_GLB = ART / "exports" / "cloudway-platform-kit-v3.glb"
RUNTIME_GLB = ART / "exports" / "cloudway-platform-kit-v3-runtime.glb"
BLENDER_GLB = ART / "exports" / "cloudway-platform-kit-v3-blender.glb"
SOURCE_BLEND = ART / "sources" / "cloudway-platform-kit-v3.blend"
BUILD_REPORT = ART / "production" / "cloudway-platform-kit-v3-build.json"
VALIDATION = ART / "proofs" / "cloudway-platform-kit-v3-validation.json"
MANIFEST = ART / "exports" / "manifest.json"
PROOF_FAMILY = ART / "proofs" / "cloudway-platform-kit-v3.png"
PROOF_DETAIL = ART / "proofs" / "cloudway-platform-kit-v3-surface-detail.png"
PROOF_CRACKLE = ART / "proofs" / "cloudway-platform-kit-v3-crackle.png"
PROOF_CONTACT = ART / "proofs" / "cloudway-platform-kit-v3-contact-datum.png"
PROOF_RUNTIME_FAMILY = ART / "proofs" / "cloudway-platform-kit-v3-runtime.png"
PROOF_RUNTIME_DETAIL = ART / "proofs" / "cloudway-platform-kit-v3-runtime-surface-detail.png"
PROOF_RUNTIME_CRACKLE = ART / "proofs" / "cloudway-platform-kit-v3-runtime-crackle.png"
PROOF_RUNTIME_CONTACT = ART / "proofs" / "cloudway-platform-kit-v3-runtime-contact-datum.png"

LANDING_WIDTH = 1.70
LANDING_DEPTH = 1.30
COLLIDER_HEIGHT = 0.24
ROOT_NAMES = [
    "Cloudway_Marble",
    "Cloudway_Frost",
    "Cloudway_Glide",
    "Cloudway_Crackle_Intact",
    "Cloudway_Crackle_Warning",
    "Cloudway_Crackle_Release",
]
EXPECTED_TRIANGLES = {
    "Cloudway_Marble": (38_000, 41_000),
    "Cloudway_Frost": (33_000, 36_000),
    "Cloudway_Glide": (33_000, 36_000),
    "Cloudway_Crackle_Intact": (2_472, 2_472),
    "Cloudway_Crackle_Warning": (2_616, 2_616),
    "Cloudway_Crackle_Release": (308, 308),
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        obj = pending.pop(0)
        result.append(obj)
        pending.extend(obj.children)
    return result


def bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in objects:
        if obj.type == "MESH":
            points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise ValueError("No mesh bounds")
    return (
        Vector(min(point[index] for point in points) for index in range(3)),
        Vector(max(point[index] for point in points) for index in range(3)),
    )


def gltf_bounds(low: Vector, high: Vector) -> dict[str, list[float]]:
    return {
        "min": [round(float(low.x), 6), round(float(low.z), 6), round(float(-high.y), 6)],
        "max": [round(float(high.x), 6), round(float(high.z), 6), round(float(-low.y), 6)],
    }


def triangles(objects: list[bpy.types.Object]) -> int:
    total = 0
    for obj in objects:
        if obj.type == "MESH":
            obj.data.calc_loop_triangles()
            total += len(obj.data.loop_triangles)
    return total


def close(a: float, b: float, tolerance: float = 3e-4) -> bool:
    return abs(a - b) <= tolerance


def read_glb(path: Path) -> tuple[dict[str, object], bytes]:
    raw = path.read_bytes()
    if raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 4)[0] != 2:
        raise ValueError("Not a glTF 2 GLB")
    if struct.unpack_from("<I", raw, 8)[0] != len(raw):
        raise ValueError("GLB length header does not match file")
    json_length, json_type = struct.unpack_from("<II", raw, 12)
    if json_type != 0x4E4F534A:
        raise ValueError("First GLB chunk is not JSON")
    document = json.loads(raw[20 : 20 + json_length].decode("utf-8").rstrip(" \t\r\n\0"))
    offset = 20 + json_length
    binary = b""
    if offset < len(raw):
        binary_length, binary_type = struct.unpack_from("<II", raw, offset)
        if binary_type != 0x004E4942:
            raise ValueError("Second GLB chunk is not BIN")
        binary = raw[offset + 8 : offset + 8 + binary_length]
    return document, binary


def webp_dimensions(raw: bytes) -> list[int]:
    if raw[:4] != b"RIFF" or raw[8:12] != b"WEBP":
        raise ValueError("Expected embedded WebP")
    chunk = raw[12:16]
    payload = raw[20:]
    if chunk == b"VP8X":
        return [1 + int.from_bytes(payload[4:7], "little"), 1 + int.from_bytes(payload[7:10], "little")]
    if chunk == b"VP8 ":
        marker = payload.find(b"\x9d\x01\x2a")
        if marker < 0:
            raise ValueError("Malformed VP8 WebP")
        return [
            int.from_bytes(payload[marker + 3 : marker + 5], "little") & 0x3FFF,
            int.from_bytes(payload[marker + 5 : marker + 7], "little") & 0x3FFF,
        ]
    if chunk == b"VP8L" and payload[:1] == b"\x2f":
        bits = int.from_bytes(payload[1:5], "little")
        return [1 + (bits & 0x3FFF), 1 + ((bits >> 14) & 0x3FFF)]
    raise ValueError(f"Unsupported WebP chunk {chunk!r}")


def image_records(document: dict[str, object], binary: bytes, profile: str) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    views = document.get("bufferViews", [])
    for index, image in enumerate(document.get("images", [])):
        if image.get("mimeType") != "image/webp":
            raise ValueError(f"Final image {index} is not WebP")
        view = views[image["bufferView"]]
        start = int(view.get("byteOffset", 0))
        payload = binary[start : start + int(view["byteLength"])]
        dimensions = webp_dimensions(payload)
        name = str(image.get("name"))
        role = "unknown"
        expected = [2048, 2048]
        if "-atlas-01-" in name:
            role = "baseColor"
        elif "-atlas-02-" in name:
            role = "metallicRoughness"
            if profile == "runtime":
                expected = [1024, 1024]
        elif "-atlas-03-" in name:
            role = "normal"
            if profile == "runtime":
                expected = [1024, 1024]
        if role == "unknown" or dimensions != expected:
            raise ValueError(f"{profile} texture role/dimensions drifted: {name} {dimensions} expected {expected}")
        expected_suffix = "-2k" if expected == [2048, 2048] else "-1k"
        if not name.endswith(expected_suffix):
            raise ValueError(f"{profile} texture name does not match dimensions: {name} {dimensions}")
        records.append(
            {
                "index": index,
                "name": name,
                "role": role,
                "mimeType": image["mimeType"],
                "dimensions": dimensions,
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
            }
        )
    if len(records) != 9:
        raise ValueError(f"Expected nine donor PBR images, got {len(records)}")
    return records


def binary_breakdown(path: Path, document: dict[str, object], image_rows: list[dict[str, object]]) -> dict[str, int]:
    image_bytes = sum(int(row["bytes"]) for row in image_rows)
    buffer_bytes = sum(int(buffer["byteLength"]) for buffer in document.get("buffers", []))
    return {
        "fileBytes": path.stat().st_size,
        "bufferBytes": buffer_bytes,
        "embeddedImageBytes": image_bytes,
        "geometryAndAttributeBytes": buffer_bytes - image_bytes,
        "containerAndJsonBytes": path.stat().st_size - buffer_bytes,
    }


def tangent_summary(document: dict[str, object]) -> dict[str, int]:
    primitives = [primitive for mesh in document.get("meshes", []) for primitive in mesh.get("primitives", [])]
    tangent_primitives = [primitive for primitive in primitives if "TANGENT" in primitive.get("attributes", {})]
    logical_bytes = 0
    accessors = document.get("accessors", [])
    for primitive in tangent_primitives:
        accessor = accessors[primitive["attributes"]["TANGENT"]]
        logical_bytes += int(accessor["count"]) * 4 * 4
    return {"primitives": len(tangent_primitives), "logicalBytes": logical_bytes}


def geometric_topology(obj: bpy.types.Object) -> dict[str, object]:
    obj.data.calc_loop_triangles()
    vertices = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]

    def key(point: Vector) -> tuple[int, int, int]:
        return tuple(round(float(value) * 1_000_000) for value in point)

    incidence: dict[tuple[tuple[int, int, int], tuple[int, int, int]], int] = {}
    directed: dict[
        tuple[tuple[int, int, int], tuple[int, int, int]],
        list[tuple[tuple[int, int, int], tuple[int, int, int]]],
    ] = {}
    signed_volume = 0.0
    for triangle in obj.data.loop_triangles:
        points = [vertices[index] for index in triangle.vertices]
        signed_volume += points[0].dot(points[1].cross(points[2])) / 6.0
        for index in range(3):
            traversal = (key(points[index]), key(points[(index + 1) % 3]))
            edge = tuple(sorted(traversal))
            incidence[edge] = incidence.get(edge, 0) + 1
            directed.setdefault(edge, []).append(traversal)
    consistent_winding = all(
        len(traversals) == 2
        and traversals[0][0] == traversals[1][1]
        and traversals[0][1] == traversals[1][0]
        for traversals in directed.values()
    )
    return {
        "triangles": len(obj.data.loop_triangles),
        "geometricBoundaryEdges": sum(value == 1 for value in incidence.values()),
        "geometricNonManifoldEdges": sum(value != 2 for value in incidence.values()),
        "signedVolume": round(signed_volume, 9),
        "closed": bool(incidence) and all(value == 2 for value in incidence.values()),
        "consistentWinding": bool(directed) and consistent_winding,
    }


def donor_surface_record(root: bpy.types.Object) -> dict[str, object]:
    shell = bpy.data.objects.get(root.name + "__DonorShell")
    boundary = bpy.data.objects.get(root.name + "__LandingBoundary")
    if shell is None or boundary is None:
        raise ValueError(f"{root.name} lost donor shell or landing boundary")
    boundary_low, boundary_high = bounds([boundary])
    boundary_size = boundary_high - boundary_low
    if not (
        close(boundary_size.x, LANDING_WIDTH)
        and close(boundary_size.y, LANDING_DEPTH)
        and close(boundary_high.z, 0.004)
        and close((boundary_low.x + boundary_high.x) / 2, 0.0)
        and close((boundary_low.y + boundary_high.y) / 2, 0.0)
    ):
        raise ValueError(f"{root.name} exact boundary contract failed: {boundary_low}, {boundary_high}")

    if not bool(shell.get("landingFlattened", False)):
        raise ValueError(f"{root.name} lost its UV-preserving landing flatten metadata")
    zones: dict[str, dict[str, object]] = {
        "all": {"area": 0.0, "heights": []},
        "center": {"area": 0.0, "heights": []},
        "edge": {"area": 0.0, "heights": []},
    }
    normal_matrix = shell.matrix_world.to_3x3()
    for polygon in shell.data.polygons:
        centre = shell.matrix_world @ polygon.center
        normal = normal_matrix @ polygon.normal
        if normal.z <= 0.72:
            continue
        if abs(centre.x) > LANDING_WIDTH / 2 or abs(centre.y) > LANDING_DEPTH / 2:
            continue
        vertex_heights = [
            float((shell.matrix_world @ shell.data.vertices[index].co).z)
            for index in polygon.vertices
        ]
        if max(abs(value) for value in vertex_heights) > 0.01:
            continue
        memberships = ["all"]
        if abs(centre.x) <= 0.55 and abs(centre.y) <= 0.40:
            memberships.append("center")
        if abs(centre.x) >= 0.70 or abs(centre.y) >= 0.50:
            memberships.append("edge")
        for zone in memberships:
            zones[zone]["area"] = float(zones[zone]["area"]) + polygon.area
            zones[zone]["heights"].extend(vertex_heights)
    measurements: dict[str, object] = {}
    for name, zone in zones.items():
        heights = list(zone["heights"])
        if not heights:
            raise ValueError(f"{root.name} has no {name} landing contact samples")
        maximum_error = max(abs(value) for value in heights)
        if maximum_error > 0.01:
            raise ValueError(f"{root.name} {name} contact misses datum by {maximum_error:.6f}m")
        measurements[name] = {
            "sampleCount": len(heights),
            "upwardAreaSquareMetres": round(float(zone["area"]), 6),
            "heightRangeMetres": [round(min(heights), 6), round(max(heights), 6)],
            "maxAbsoluteErrorMetres": round(maximum_error, 6),
        }
    if float(zones["all"]["area"]) < 1.75:
        raise ValueError(f"{root.name} broad landing area is too small: {zones['all']['area']:.6f} m2")
    if float(zones["center"]["area"]) < 0.45 or float(zones["edge"]["area"]) < 0.25:
        raise ValueError(f"{root.name} lacks clear center/edge collider contact: {measurements}")
    return {
        "donorShell": shell.name,
        "boundary": boundary.name,
        "boundaryDimensionsMetres": [
            round(boundary_size.x, 6),
            round(boundary_size.y, 6),
            round(boundary_size.z, 6),
        ],
        "flattenedVertexCount": int(shell.get("landingFlattenedVertexCount", 0)),
        "contactMeasurements": measurements,
        "opaqueReplacementSkinPresent": False,
    }


def geometry_digest(meshes: list[bpy.types.Object]) -> str:
    """Hash rendered triangles independently of accessor/index ordering."""

    checksum = hashlib.sha256()
    for obj in sorted(meshes, key=lambda item: item.name):
        checksum.update(obj.name.encode())
        obj.data.calc_loop_triangles()
        triangle_rows: list[tuple[tuple[int, int, int], ...]] = []
        for triangle in obj.data.loop_triangles:
            points = []
            for index in triangle.vertices:
                point = obj.matrix_world @ obj.data.vertices[index].co
                points.append(tuple(round(float(value) * 1_000_000) for value in point))
            triangle_rows.append(tuple(sorted(points)))
        for triangle in sorted(triangle_rows):
            for point in triangle:
                checksum.update(struct.pack("<3q", *point))
    return checksum.hexdigest()


def root_record(root: bpy.types.Object) -> dict[str, object]:
    if root.type != "EMPTY":
        raise ValueError(f"{root.name} must be an empty transform root")
    if root.location.length > 1e-6 or any(abs(value - 1.0) > 1e-6 for value in root.scale):
        raise ValueError(f"{root.name} root transform is not identity")
    if abs(root.rotation_euler.x) + abs(root.rotation_euler.y) + abs(root.rotation_euler.z) > 1e-6:
        raise ValueError(f"{root.name} root rotation is not identity")
    meshes = [obj for obj in descendants(root) if obj.type == "MESH"]
    tri_count = triangles(meshes)
    minimum, maximum = EXPECTED_TRIANGLES[root.name]
    if not minimum <= tri_count <= maximum:
        raise ValueError(f"{root.name} triangle count changed: {tri_count}")
    low, high = bounds(meshes)
    collider = json.loads(str(root["collider_json"]))
    expected_collider = {
        "shape": "box",
        "width": LANDING_WIDTH,
        "depth": LANDING_DEPTH,
        "height": COLLIDER_HEIGHT,
        "topY": 0.0,
        "center": [0.0, -COLLIDER_HEIGHT / 2, 0.0],
    }
    if collider != expected_collider:
        raise ValueError(f"{root.name} collider_json drifted: {collider}")
    landing = json.loads(str(root["landing_json"]))
    if landing.get("width") != LANDING_WIDTH or landing.get("depth") != LANDING_DEPTH:
        raise ValueError(f"{root.name} landing_json drifted: {landing}")
    record: dict[str, object] = {
        "name": root.name,
        "descendantMeshes": [obj.name for obj in meshes],
        "triangles": tri_count,
        "landingBoundsGlTfYUpMetres": {
            "min": [-LANDING_WIDTH / 2, 0.0, -LANDING_DEPTH / 2],
            "max": [LANDING_WIDTH / 2, 0.0, LANDING_DEPTH / 2],
        },
        "collider_json": collider,
        "visualBoundsGlTfYUpMetres": gltf_bounds(low, high),
        "geometrySha256": geometry_digest(meshes),
        "materials": sorted({material.name for obj in meshes for material in obj.data.materials}),
    }
    if root.name in ROOT_NAMES[:3]:
        record["exposedDonorLanding"] = donor_surface_record(root)
    return record


def load_builder():
    path = HERE / "build_platform_kit_v3.py"
    spec = importlib.util.spec_from_file_location("cloudway_v3_builder", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load v3 builder from {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def document_record(path: Path, profile: str) -> dict[str, object]:
    document, binary = read_glb(path)
    scene_roots = [document["nodes"][index] for index in document["scenes"][document.get("scene", 0)]["nodes"]]
    root_names = [node.get("name") for node in scene_roots]
    if set(root_names) != set(ROOT_NAMES) or len(root_names) != len(ROOT_NAMES):
        raise ValueError(f"{profile} GLB roots drifted: {root_names}")
    for node in scene_roots:
        if any(key in node for key in ("matrix", "translation", "rotation", "scale")):
            raise ValueError(f"Root {node.get('name')} has a serialized transform")
        extras = node.get("extras", {})
        if "collider_json" not in extras or "landing_json" not in extras:
            raise ValueError(f"Root {node.get('name')} lost gameplay extras")
    image_rows = image_records(document, binary, profile)
    extensions = list(document.get("extensionsUsed", []))
    unsupported = sorted(set(extensions) & {"KHR_draco_mesh_compression", "EXT_meshopt_compression"})
    if unsupported:
        raise ValueError(f"{profile} introduced unsupported mesh compression: {unsupported}")
    tangents = tangent_summary(document)
    if profile == "source" and int(tangents["primitives"]) != 3:
        raise ValueError(f"Source-quality GLB lost its three donor tangent streams: {tangents}")
    if profile == "runtime" and int(tangents["primitives"]) != 0:
        raise ValueError(f"Runtime GLB retained unused tangent streams: {tangents}")
    return {
        "file": path.name,
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "generator": document.get("asset", {}).get("generator"),
        "extensionsUsed": extensions,
        "embeddedImages": image_rows,
        "byteBreakdown": binary_breakdown(path, document, image_rows),
        "tangents": tangents,
        "unsupportedMeshCompression": unsupported,
    }


def fresh_import(path: Path) -> tuple[list[dict[str, object]], dict[str, dict[str, object]]]:
    """Import one delivery artifact and check gameplay/mesh contracts."""

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.ops.import_scene.gltf(filepath=str(path))
    roots: list[bpy.types.Object] = []
    for name in ROOT_NAMES:
        root = bpy.data.objects.get(name)
        if root is None:
            raise ValueError(f"Fresh import lost root {name}")
        roots.append(root)
    descendant_names = [obj.name for root in roots for obj in descendants(root) if obj.type == "MESH"]
    if len(descendant_names) != len(set(descendant_names)):
        raise ValueError("Descendant mesh names are not globally unique")
    records = [root_record(root) for root in roots]

    shards = [bpy.data.objects[f"Cloudway_Crackle_Release__Shard_{index:02d}"] for index in range(1, 7)]
    shard_topology = {obj.name: geometric_topology(obj) for obj in shards}
    for name, row in shard_topology.items():
        if not row["closed"] or not row["consistentWinding"] or float(row["signedVolume"]) <= 1e-6:
            raise ValueError(f"Release shard is not a closed, outward-wound volume: {name} {row}")
    return records, shard_topology


def render_current_import(
    builder,
    family: Path,
    detail: Path,
    crackle: Path,
    contact: Path,
) -> None:
    builder.PROOF_FAMILY = family
    builder.PROOF_DETAIL = detail
    builder.PROOF_CRACKLE = crackle
    builder.PROOF_CONTACT = contact
    builder.render_proofs()


def assert_runtime_geometry_matches(
    source_records: list[dict[str, object]],
    runtime_records: list[dict[str, object]],
) -> None:
    source_by_name = {str(row["name"]): row for row in source_records}
    runtime_by_name = {str(row["name"]): row for row in runtime_records}
    for name in ROOT_NAMES:
        source = source_by_name[name]
        runtime = runtime_by_name[name]
        for key in (
            "triangles",
            "geometrySha256",
            "landingBoundsGlTfYUpMetres",
            "collider_json",
            "visualBoundsGlTfYUpMetres",
        ):
            if source[key] != runtime[key]:
                raise ValueError(f"Runtime {name} changed {key}: {source[key]} != {runtime[key]}")
        if source.get("exposedDonorLanding") != runtime.get("exposedDonorLanding"):
            raise ValueError(f"Runtime {name} changed measured donor landing contact")


def main() -> None:
    source_file = document_record(FINAL_GLB, "source")
    runtime_file = document_record(RUNTIME_GLB, "runtime")

    source_records, source_shard_topology = fresh_import(FINAL_GLB)

    builder = load_builder()
    render_current_import(builder, PROOF_FAMILY, PROOF_DETAIL, PROOF_CRACKLE, PROOF_CONTACT)

    runtime_records, runtime_shard_topology = fresh_import(RUNTIME_GLB)
    assert_runtime_geometry_matches(source_records, runtime_records)
    if source_shard_topology != runtime_shard_topology:
        raise ValueError("Runtime delivery changed release-shard topology")
    render_current_import(
        builder,
        PROOF_RUNTIME_FAMILY,
        PROOF_RUNTIME_DETAIL,
        PROOF_RUNTIME_CRACKLE,
        PROOF_RUNTIME_CONTACT,
    )

    saved_bytes = int(source_file["bytes"]) - int(runtime_file["bytes"])
    runtime_savings = {
        "bytes": saved_bytes,
        "percent": round(100.0 * saved_bytes / int(source_file["bytes"]), 3),
        "sourceBytes": source_file["bytes"],
        "runtimeBytes": runtime_file["bytes"],
        "geometryUnchanged": True,
    }
    manifest = {
        "version": 3,
        "assetId": "cloudway-platform-kit-v3-review",
        "status": "validated review candidate; not staged to public",
        "description": "Higher-detail Cloudway candidate retaining original Meshy donor artwork and exact existing gameplay contracts.",
        "coordinates": "glTF +Y up; metres; every root origin is the sampled donor landing datum y=0",
        "landingEdgeSemantics": "A narrow exact 1.70m x 1.30m boundary marks the authoritative box collider. The original donor PBR landing remains exposed; no opaque replacement skin is present.",
        "bundle": {
            "id": "cloudway-platform-kit-v3-review",
            "sourceQuality": {
                "file": FINAL_GLB.name,
                "source": str(FINAL_GLB.relative_to(REPO)),
                "bytes": source_file["bytes"],
                "sha256": source_file["sha256"],
            },
            "runtime": {
                "file": RUNTIME_GLB.name,
                "source": str(RUNTIME_GLB.relative_to(REPO)),
                "bytes": runtime_file["bytes"],
                "sha256": runtime_file["sha256"],
            },
        },
        "nodes": source_records,
        "materialContract": {
            "sourceQualityAtlases": "one 2K base-color, normal, and metallic-roughness map set per original textured Meshy shell",
            "runtimeAtlases": "2K base color plus 1K normal and metallic-roughness maps per donor; geometry unchanged",
            "surfaceTreatment": "original donor UV/PBR landing at datum plus narrow procedural gold boundary only",
            "sharedProceduralMaterials": ["Cloudway_Shared_Gold", "Cloudway_Shared_RoseCrystal"],
            "crackleGeometry": "unchanged v2 intact/warning slabs and six independently pivoted release shards",
        },
        "validation": {
            "freshOptimizedGlbReimport": True,
            "sixIdentityRoots": True,
            "uniqueDescendantNames": True,
            "exactLandingBoundary": True,
            "exactColliderExtras": True,
            "donorSurfaceFlattenedToDatumWithinOneCentimetre": True,
            "opaqueReplacementSkinPresent": False,
            "closedReleaseShards": True,
            "consistentReleaseShardWinding": True,
            "outwardReleaseShardWinding": True,
            "sourceTextureDimensions": "2K base color, normal, metallic-roughness",
            "runtimeTextureDimensions": "2K base color; 1K normal and metallic-roughness",
            "textureFormat": "WebP",
            "geometryPasses": ["dedup", "prune", "weld"],
            "runtimeTangentPass": "unused tangent attribute removed; Three.js derives normal-map basis",
            "runtimeGeometryMatchesSource": True,
            "noMeshCompressionDecoderRequired": True,
            "publicAssetTouched": False,
        },
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    proof_rows = [
        {"file": str(path.relative_to(ART)), "bytes": path.stat().st_size, "sha256": digest(path)}
        for path in (
            PROOF_FAMILY,
            PROOF_DETAIL,
            PROOF_CRACKLE,
            PROOF_CONTACT,
            PROOF_RUNTIME_FAMILY,
            PROOF_RUNTIME_DETAIL,
            PROOF_RUNTIME_CRACKLE,
            PROOF_RUNTIME_CONTACT,
        )
    ]
    validation = {
        "schema": 1,
        "status": "passed",
        "reviewOnly": True,
        "sourceQualityGlb": source_file,
        "runtimeGlb": runtime_file,
        "runtimeSavings": runtime_savings,
        "sourceFreshReimport": {"nodes": source_records, "releaseShardTopology": source_shard_topology},
        "runtimeFreshReimport": {"nodes": runtime_records, "releaseShardTopology": runtime_shard_topology},
        "runtimeGeometryMatchesSource": True,
        "proofs": proof_rows,
        "publicAssetTouched": False,
        "rebuild": {
            "build": "rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v3/production/build_platform_kit_v3.py",
            "optimizeSourceQuality": "rtk bash art/glass-adventure/platform-trials/v3/production/optimize_platform_kit_v3.sh",
            "optimizeRuntime": "rtk bash art/glass-adventure/platform-trials/v3/production/optimize_platform_kit_v3_runtime.sh",
            "validate": "rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v3/production/validate_platform_kit_v3.py",
            "comparison": "rtk python3 art/glass-adventure/platform-trials/v3/production/build_comparison.py",
            "blender": bpy.app.version_string,
            "gltfTransform": "4.4.2",
        },
    }
    VALIDATION.write_text(json.dumps(validation, indent=2) + "\n")

    build_report = json.loads(BUILD_REPORT.read_text())
    build_report["status"] = "source-quality and runtime review candidates validated; public integration pending visual review"
    build_report["sourceQualityExport"] = source_file
    build_report["runtimeExport"] = runtime_file
    build_report["runtimeSavings"] = runtime_savings
    build_report["validationReport"] = str(VALIDATION.relative_to(ART))
    build_report["manifest"] = str(MANIFEST.relative_to(ART))
    build_report["publicAssetTouched"] = False
    build_report["optimization"] = {
        "sourceQualityCommand": validation["rebuild"]["optimizeSourceQuality"],
        "runtimeCommand": validation["rebuild"]["optimizeRuntime"],
        "geometryPasses": ["dedup", "prune", "weld"],
        "sourceTangentPass": "MikkTSpace overwrite plus deterministic zero-tangent repair from vertex normals",
        "runtimeTangentPass": "remove unused tangent attribute",
        "sourceTexturePass": {"format": "WebP", "quality": 88, "nearLossless": True, "effort": 80},
        "runtimeTexturePass": {
            "format": "WebP",
            "baseColor": {"dimensions": 2048, "quality": 86},
            "normal": {"dimensions": 1024, "quality": 88},
            "metallicRoughness": {"dimensions": 1024, "quality": 82},
            "nearLossless": False,
            "effort": 80,
        },
    }
    BUILD_REPORT.write_text(json.dumps(build_report, indent=2) + "\n")
    print(
        "CLOUDWAY_PLATFORM_V3_VALIDATION="
        + json.dumps(
            {
                "sourceSha256": source_file["sha256"],
                "runtimeSha256": runtime_file["sha256"],
                "runtimeBytes": runtime_file["bytes"],
                "savedPercent": runtime_savings["percent"],
                "triangles": {row["name"]: row["triangles"] for row in source_records},
                "publicAssetTouched": False,
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
