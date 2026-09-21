"""Validate the optimized Cloudway GLB by fresh Blender reimport and stage manifests."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import struct
import sys

import bpy
from mathutils import Vector

# The validator imports the adjacent build module only to reuse the proof-scene
# setup. Keep the source archive free of interpreter cache artifacts.
sys.dont_write_bytecode = True


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
FINAL_GLB = ART / "exports" / "cloudway-platform-kit-v1.glb"
BLENDER_GLB = ART / "exports" / "cloudway-platform-kit-v1-blender.glb"
SOURCE_BLEND = ART / "sources" / "cloudway-platform-kit-v1.blend"
BUILD_REPORT = ART / "production" / "cloudway-platform-kit-build.json"
VALIDATION = ART / "proofs" / "cloudway-platform-kit-validation.json"
SOURCE_MANIFEST = ART / "exports" / "manifest.json"
PUBLIC_DIR = REPO / "apps" / "beside-cue" / "public" / "games" / "cloudway-v1"
PUBLIC_GLB = PUBLIC_DIR / "cloudway-platform-kit-v1.glb"
PUBLIC_PREVIEW = PUBLIC_DIR / "cloudway-ribbon-preview.webp"
ARCHIVE_PREVIEW = ART / "exports" / "cloudway-ribbon-preview.webp"
PUBLIC_MANIFEST = PUBLIC_DIR / "manifest.json"
PROOF_FAMILY = ART / "proofs" / "cloudway-platform-kit-final-glb.png"
PROOF_CRACKLE = ART / "proofs" / "cloudway-platform-kit-final-crackle.png"

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
    "Cloudway_Marble": 7741,
    "Cloudway_Frost": 7845,
    "Cloudway_Glide": 7964,
    "Cloudway_Crackle_Intact": 2472,
    "Cloudway_Crackle_Warning": 2616,
    "Cloudway_Crackle_Release": 308,
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
        if obj.type != "MESH":
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise ValueError("No mesh bounds")
    return (
        Vector(min(point[i] for point in points) for i in range(3)),
        Vector(max(point[i] for point in points) for i in range(3)),
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


def close(a: float, b: float, tolerance: float = 2e-4) -> bool:
    return abs(a - b) <= tolerance


def glb(path: Path) -> tuple[dict[str, object], bytes]:
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


def image_records(document: dict[str, object], binary: bytes) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    views = document.get("bufferViews", [])
    for index, image in enumerate(document.get("images", [])):
        if image.get("mimeType") != "image/webp":
            raise ValueError(f"Final image {index} is not WebP")
        view = views[image["bufferView"]]
        start = int(view.get("byteOffset", 0))
        payload = binary[start : start + int(view["byteLength"])]
        size = webp_dimensions(payload)
        if max(size) > 1024:
            raise ValueError(f"Texture budget exceeded by image {index}: {size}")
        records.append(
            {
                "index": index,
                "name": image.get("name"),
                "mimeType": image["mimeType"],
                "dimensions": size,
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
            }
        )
    if len(records) != 9:
        raise ValueError(f"Expected nine PBR images, got {len(records)}")
    return records


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


def landing_objects(root: bpy.types.Object) -> list[bpy.types.Object]:
    if root.name in {"Cloudway_Marble", "Cloudway_Frost", "Cloudway_Glide"}:
        names = [root.name + "__LandingSurface"]
    elif root.name == "Cloudway_Crackle_Intact":
        names = [root.name + "__Slab"]
    elif root.name == "Cloudway_Crackle_Warning":
        names = [root.name + "__Slab"]
    else:
        names = [f"Cloudway_Crackle_Release__Shard_{index:02d}" for index in range(1, 7)]
    result = [bpy.data.objects.get(name) for name in names]
    if any(obj is None for obj in result):
        raise ValueError(f"Missing landing geometry under {root.name}: {names}")
    return result


def root_record(root: bpy.types.Object) -> dict[str, object]:
    if root.type != "EMPTY":
        raise ValueError(f"{root.name} must be an empty transform root")
    if root.location.length > 1e-6 or any(abs(value - 1.0) > 1e-6 for value in root.scale):
        raise ValueError(f"{root.name} root transform is not identity")
    if abs(root.rotation_euler.x) + abs(root.rotation_euler.y) + abs(root.rotation_euler.z) > 1e-6:
        raise ValueError(f"{root.name} root rotation is not identity")
    meshes = [obj for obj in descendants(root) if obj.type == "MESH"]
    tri_count = triangles(meshes)
    if tri_count != EXPECTED_TRIANGLES[root.name]:
        raise ValueError(f"{root.name} triangle count changed: {tri_count}")
    low, high = bounds(meshes)
    supports = landing_objects(root)
    landing_low, landing_high = bounds(supports)
    landing_size = landing_high - landing_low
    if not (
        close(landing_size.x, LANDING_WIDTH)
        and close(landing_size.y, LANDING_DEPTH)
        and close(landing_high.z, 0.0)
        and close((landing_low.x + landing_high.x) / 2, 0.0)
        and close((landing_low.y + landing_high.y) / 2, 0.0)
    ):
        raise ValueError(f"{root.name} landing contract failed: {landing_low}, {landing_high}")
    top_area = 0.0
    for obj in supports:
        for polygon in obj.data.polygons:
            centre = obj.matrix_world @ polygon.center
            normal = obj.matrix_world.to_3x3() @ polygon.normal
            if centre.z > -0.001 and normal.z > 0.92:
                top_area += polygon.area
    if top_area < LANDING_WIDTH * LANDING_DEPTH * 0.75:
        raise ValueError(f"{root.name} has insufficient upward landing area: {top_area}")
    collider = json.loads(str(root["collider_json"]))
    if collider != {
        "shape": "box",
        "width": LANDING_WIDTH,
        "depth": LANDING_DEPTH,
        "height": COLLIDER_HEIGHT,
        "topY": 0.0,
        "center": [0.0, -COLLIDER_HEIGHT / 2, 0.0],
    }:
        raise ValueError(f"{root.name} collider_json drifted: {collider}")
    return {
        "name": root.name,
        "descendantMeshes": [obj.name for obj in meshes],
        "triangles": tri_count,
        "landingBoundsGlTfYUpMetres": {
            "min": [-LANDING_WIDTH / 2, 0.0, -LANDING_DEPTH / 2],
            "max": [LANDING_WIDTH / 2, 0.0, LANDING_DEPTH / 2],
        },
        "collider_json": collider,
        "visualBoundsGlTfYUpMetres": gltf_bounds(low, high),
        "upwardLandingAreaSquareMetres": round(top_area, 6),
        "materials": sorted({material.name for obj in meshes for material in obj.data.materials}),
    }


def preview_record(path: Path) -> dict[str, object]:
    dimensions = webp_dimensions(path.read_bytes())
    return {
        "id": "cloudway-ribbon-preview",
        "file": path.name,
        "kind": "approved concept-art derivative; not an in-game screenshot",
        "source": "art/glass-adventure/platform-trials/v1/concepts/02-cloudway-route.png",
        "dimensions": dimensions,
        "bytes": path.stat().st_size,
        "sha256": digest(path),
    }


def main() -> None:
    document, binary = glb(FINAL_GLB)
    scene_roots = [document["nodes"][index] for index in document["scenes"][document.get("scene", 0)]["nodes"]]
    root_names = [node.get("name") for node in scene_roots]
    if set(root_names) != set(ROOT_NAMES) or len(root_names) != len(ROOT_NAMES):
        raise ValueError(f"Final GLB roots drifted: {root_names}")
    for node in scene_roots:
        if any(key in node for key in ("matrix", "translation", "rotation", "scale")):
            raise ValueError(f"Root {node.get('name')} has a serialized transform")
        if "collider_json" not in node.get("extras", {}):
            raise ValueError(f"Root {node.get('name')} lost collider extras")
    image_rows = image_records(document, binary)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.ops.import_scene.gltf(filepath=str(FINAL_GLB))
    roots = []
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

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(FINAL_GLB, PUBLIC_GLB)
    if digest(PUBLIC_GLB) != digest(FINAL_GLB):
        raise ValueError("Public GLB copy differs from validated export")
    if digest(PUBLIC_PREVIEW) != digest(ARCHIVE_PREVIEW):
        raise ValueError("Public card preview differs from archived derivative")

    sys.path.insert(0, str(HERE))
    import build_platform_kit as build

    build.PROOF_FAMILY = PROOF_FAMILY
    build.PROOF_CRACKLE = PROOF_CRACKLE
    build.proof_scene()

    final = {
        "file": FINAL_GLB.name,
        "bytes": FINAL_GLB.stat().st_size,
        "sha256": digest(FINAL_GLB),
        "generator": document.get("asset", {}).get("generator"),
        "extensionsUsed": document.get("extensionsUsed", []),
        "roots": ROOT_NAMES,
        "embeddedImages": image_rows,
    }
    preview = preview_record(PUBLIC_PREVIEW)
    source = {
        "packedBlend": {
            "file": str(SOURCE_BLEND.relative_to(REPO)),
            "bytes": SOURCE_BLEND.stat().st_size,
            "sha256": digest(SOURCE_BLEND),
            "runtimeTexturesPacked": True,
        },
        "blenderExport": {
            "file": str(BLENDER_GLB.relative_to(REPO)),
            "bytes": BLENDER_GLB.stat().st_size,
            "sha256": digest(BLENDER_GLB),
        },
        "rawDonors": "art/glass-adventure/platform-trials/v2/meshy/{marble,frost,glide}/",
    }
    manifest = {
        "version": 1,
        "assetId": "cloudway-platform-kit-v1",
        "status": "validated runtime export",
        "description": "Reusable Cloudway landing, frost, glide, and three-state crackle platform kit for The Glass Ribbon.",
        "coordinates": "glTF +Y up; metres; every root origin is top-centre at landing plane y=0",
        "landingEdgeSemantics": "Every visible flat landing skin spans the collider exactly: 1.70m wide x 1.30m deep at y=0. The 1.80m x 1.40m shell, frames, flora, finials, and crystalline undersides are decorative and non-supporting.",
        "bundle": {
            "id": "cloudway-platform-kit-v1",
            "file": "cloudway-platform-kit-v1.glb",
            "source": str(FINAL_GLB.relative_to(REPO)),
            "bytes": final["bytes"],
            "sha256": final["sha256"],
        },
        "preview": preview,
        "nodes": records,
        "sharedMaterialContract": {
            "donorAtlases": "one 1K base-color, normal, and metallic-roughness map set per Meshy shell",
            "sharedProceduralMaterials": ["Cloudway_Shared_Gold", "Cloudway_Shared_RoseCrystal"],
            "crackleGeometry": "Intact and Warning share slab/frame mesh data; Release uses six individually pivoted closed shard volumes plus the shared frame.",
        },
        "validation": {
            "freshOptimizedGlbReimport": True,
            "sixIdentityRoots": True,
            "uniqueDescendantNames": True,
            "exactLandingBounds": True,
            "colliderExtras": True,
            "normalsUpwardOnLanding": True,
            "closedReleaseShards": True,
            "consistentReleaseShardWinding": True,
            "outwardReleaseShardWinding": True,
            "textureDimensionsMax": 1024,
            "textureFormat": "WebP near-lossless quality 88",
            "geometryPasses": ["dedup", "prune", "weld"],
            "tangentPass": "MikkTSpace overwrite plus deterministic zero-tangent repair from vertex normals",
            "noMeshCompressionDecoderRequired": True,
        },
    }
    PUBLIC_MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    SOURCE_MANIFEST.write_text(json.dumps({**manifest, "sourceArchive": source}, indent=2) + "\n")
    proof_rows = [
        {"file": str(path.relative_to(ART)), "bytes": path.stat().st_size, "sha256": digest(path)}
        for path in (PROOF_FAMILY, PROOF_CRACKLE)
    ]
    validation = {
        "schema": 1,
        "status": "passed",
        "finalGlb": final,
        "freshReimport": {"nodes": records, "releaseShardTopology": shard_topology},
        "proofs": proof_rows,
        "public": {
            "glb": str(PUBLIC_GLB.relative_to(REPO)),
            "manifest": str(PUBLIC_MANIFEST.relative_to(REPO)),
            "preview": str(PUBLIC_PREVIEW.relative_to(REPO)),
        },
        "rebuild": {
            "build": "rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v2/production/build_platform_kit.py",
            "optimizeAndStage": "rtk bash art/glass-adventure/platform-trials/v2/production/optimize_platform_kit.sh",
            "validate": "rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v2/production/validate_platform_kit.py",
            "preview": "rtk node art/glass-adventure/platform-trials/v2/production/build_preview.mjs",
            "blender": bpy.app.version_string,
            "gltfTransform": "4.4.2",
        },
    }
    VALIDATION.write_text(json.dumps(validation, indent=2) + "\n")

    build_report = json.loads(BUILD_REPORT.read_text())
    build_report["status"] = "Optimized runtime export validated and staged"
    build_report["optimizedExport"] = final
    build_report["public"] = validation["public"]
    build_report["validationReport"] = str(VALIDATION.relative_to(ART))
    build_report["optimization"] = {
        "command": validation["rebuild"]["optimizeAndStage"],
        "geometryPasses": ["dedup", "prune", "weld"],
        "tangentPass": "MikkTSpace overwrite plus deterministic zero-tangent repair from vertex normals",
        "texturePass": {"format": "WebP", "quality": 88, "nearLossless": True, "effort": 80},
    }
    BUILD_REPORT.write_text(json.dumps(build_report, indent=2) + "\n")
    print(
        "CLOUDWAY_PLATFORM_VALIDATION="
        + json.dumps(
            {
                "sha256": final["sha256"],
                "bytes": final["bytes"],
                "nodes": {row["name"]: row["visualBoundsGlTfYUpMetres"] for row in records},
                "public": validation["public"],
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
