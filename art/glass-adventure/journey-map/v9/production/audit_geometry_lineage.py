"""Audit museum GLB geometry lineage without Blender or network access."""

from __future__ import annotations

from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path
import struct
from typing import Iterable


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
V3 = ART.parent / "v3"
V4 = ART.parent / "v4"
REPORT = ART / "proofs" / "museum-geometry-lineage-v9.json"

V3_KIT = V3 / "exports" / "floating-museum-sculpture-kit-v3.glb"
V4_KIT = V4 / "exports" / "floating-museum-twin-finish-kit-v4.glb"
RUNTIME_V4_KIT = (
    REPO
    / "apps"
    / "beside-cue"
    / "public"
    / "games"
    / "journey-map-v4"
    / "floating-museum-twin-finish-kit-v4.glb"
)

COMPONENTS = {
    5120: ("b", 1),
    5121: ("B", 1),
    5122: ("h", 2),
    5123: ("H", 2),
    5125: ("I", 4),
    5126: ("f", 4),
}
TYPE_WIDTH = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
    "VEC4": 4,
    "MAT2": 4,
    "MAT3": 9,
    "MAT4": 16,
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class Glb:
    """Minimal GLB 2.0 accessor reader for the audit's float and index data."""

    def __init__(self, path: Path) -> None:
        self.path = path
        raw = path.read_bytes()
        if len(raw) < 20:
            raise ValueError(f"{path} is too small to be a GLB")
        magic, version, declared_length = struct.unpack_from("<III", raw, 0)
        if magic != 0x46546C67 or version != 2 or declared_length != len(raw):
            raise ValueError(f"{path} has an invalid GLB 2.0 header")
        chunks: dict[int, bytes] = {}
        cursor = 12
        while cursor < len(raw):
            length, chunk_type = struct.unpack_from("<II", raw, cursor)
            cursor += 8
            chunks[chunk_type] = raw[cursor : cursor + length]
            cursor += length
        self.document = json.loads(chunks[0x4E4F534A].decode("utf-8"))
        self.binary = chunks[0x004E4942]

    def accessor(self, index: int) -> list[tuple[float | int, ...]]:
        accessor = self.document["accessors"][index]
        if "sparse" in accessor:
            raise ValueError(f"{self.path.name} accessor {index} is sparse")
        component_type = accessor["componentType"]
        component_format, component_size = COMPONENTS[component_type]
        width = TYPE_WIDTH[accessor["type"]]
        view = self.document["bufferViews"][accessor["bufferView"]]
        packed_size = component_size * width
        stride = view.get("byteStride", packed_size)
        offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        unpack_format = "<" + component_format * width
        return [
            struct.unpack_from(unpack_format, self.binary, offset + row * stride)
            for row in range(accessor["count"])
        ]

    def primitives_for_nodes(self, names: Iterable[str]) -> list[dict[str, object]]:
        wanted = set(names)
        nodes = [node for node in self.document.get("nodes", []) if node.get("name") in wanted]
        found = {node.get("name") for node in nodes}
        if found != wanted:
            raise ValueError(f"{self.path.name} missing nodes {sorted(wanted - found)}")
        return [
            primitive
            for node in nodes
            for primitive in self.document["meshes"][node["mesh"]]["primitives"]
        ]

    def all_primitives(self) -> list[dict[str, object]]:
        return [
            primitive
            for mesh in self.document.get("meshes", [])
            for primitive in mesh["primitives"]
        ]


def primitive_summary(primitives: list[dict[str, object]], glb: Glb) -> dict[str, object]:
    positions = 0
    normals = 0
    indices = 0
    all_have_normals = True
    for primitive in primitives:
        if primitive.get("mode", 4) != 4:
            raise ValueError(f"{glb.path.name} contains a non-triangle primitive")
        position_accessor = glb.document["accessors"][primitive["attributes"]["POSITION"]]
        positions += position_accessor["count"]
        normal_index = primitive["attributes"].get("NORMAL")
        if normal_index is None:
            all_have_normals = False
        else:
            normals += glb.document["accessors"][normal_index]["count"]
        if "indices" in primitive:
            indices += glb.document["accessors"][primitive["indices"]]["count"]
        else:
            indices += position_accessor["count"]
    return {
        "positionCount": positions,
        "normalCount": normals if all_have_normals else None,
        "indexCount": indices,
        "triangles": indices // 3,
    }


def indexed_triangles(
    glb: Glb,
    node_names: Iterable[str],
) -> list[tuple[tuple[tuple[float, float, float], tuple[float, float, float]], ...]]:
    result = []
    for primitive in glb.primitives_for_nodes(node_names):
        positions = glb.accessor(primitive["attributes"]["POSITION"])
        normal_index = primitive["attributes"].get("NORMAL")
        if normal_index is None:
            raise ValueError(f"{glb.path.name} comparison primitive has no normals")
        normals = glb.accessor(normal_index)
        if "indices" in primitive:
            indices = [int(row[0]) for row in glb.accessor(primitive["indices"])]
        else:
            indices = list(range(len(positions)))
        if len(indices) % 3:
            raise ValueError(f"{glb.path.name} index count is not divisible by three")
        for start in range(0, len(indices), 3):
            result.append(
                tuple(
                    (
                        tuple(float(value) for value in positions[index]),
                        tuple(float(value) for value in normals[index]),
                    )
                    for index in indices[start : start + 3]
                )
            )
    return result


def position_triangle(
    triangle: tuple[tuple[tuple[float, float, float], tuple[float, float, float]], ...]
) -> tuple[tuple[float, float, float], ...]:
    return tuple(sorted(corner[0] for corner in triangle))


def position_normal_triangle(
    triangle: tuple[tuple[tuple[float, float, float], tuple[float, float, float]], ...]
) -> tuple[tuple[tuple[float, float, float], tuple[float, float, float]], ...]:
    return tuple(sorted(triangle, key=lambda corner: corner[0]))


def ordered_normals(
    triangle: tuple[tuple[tuple[float, float, float], tuple[float, float, float]], ...]
) -> tuple[tuple[float, float, float], ...]:
    return tuple(corner[1] for corner in sorted(triangle, key=lambda corner: corner[0]))


def angle_degrees(
    left: tuple[float, float, float],
    right: tuple[float, float, float],
) -> float:
    left_length = math.sqrt(sum(value * value for value in left))
    right_length = math.sqrt(sum(value * value for value in right))
    cosine = sum(a * b for a, b in zip(left, right)) / (left_length * right_length)
    return math.degrees(math.acos(max(-1.0, min(1.0, cosine))))


def compare_normals_by_position(
    source: list[tuple[tuple[tuple[float, float, float], tuple[float, float, float]], ...]],
    target: list[tuple[tuple[tuple[float, float, float], tuple[float, float, float]], ...]],
) -> dict[str, object]:
    source_groups: defaultdict[object, list[tuple[tuple[float, float, float], ...]]] = defaultdict(list)
    target_groups: defaultdict[object, list[tuple[tuple[float, float, float], ...]]] = defaultdict(list)
    for triangle in source:
        source_groups[position_triangle(triangle)].append(ordered_normals(triangle))
    for triangle in target:
        target_groups[position_triangle(triangle)].append(ordered_normals(triangle))
    if Counter(map(position_triangle, source)) != Counter(map(position_triangle, target)):
        raise ValueError("normal comparison requires exact indexed-triangle position parity")

    angles: list[float] = []
    for key, source_rows in source_groups.items():
        remaining = list(target_groups[key])
        for source_normals in source_rows:
            best_index = min(
                range(len(remaining)),
                key=lambda index: sum(
                    angle_degrees(left, right)
                    for left, right in zip(source_normals, remaining[index])
                ),
            )
            target_normals = remaining.pop(best_index)
            angles.extend(
                angle_degrees(left, right)
                for left, right in zip(source_normals, target_normals)
            )
    return {
        "indexedCorners": len(angles),
        "changedAbove0_01Degrees": sum(angle > 0.01 for angle in angles),
        "changedAbove1Degree": sum(angle > 1.0 for angle in angles),
        "changedAbove1DegreePercent": round(
            100.0 * sum(angle > 1.0 for angle in angles) / len(angles), 4
        ),
        "maximumAngleDegrees": round(max(angles), 6),
    }


def normal_health(glb: Glb) -> dict[str, object]:
    normal_accessors = {
        primitive["attributes"]["NORMAL"]
        for primitive in glb.all_primitives()
        if "NORMAL" in primitive["attributes"]
    }
    rows = [
        tuple(float(value) for value in row)
        for index in normal_accessors
        for row in glb.accessor(index)
    ]
    lengths = [math.sqrt(sum(value * value for value in row)) for row in rows]
    return {
        "uniqueAccessorVectors": len(rows),
        "allFinite": all(math.isfinite(value) for row in rows for value in row),
        "allNonZero": all(length > 0.0 for length in lengths),
        "minimumLength": min(lengths),
        "maximumLength": max(lengths),
        "maximumAbsoluteUnitLengthError": max(abs(length - 1.0) for length in lengths),
    }


def asset_row(path: Path, node_names: Iterable[str] | None = None) -> dict[str, object]:
    glb = Glb(path)
    primitives = (
        glb.primitives_for_nodes(node_names) if node_names is not None else glb.all_primitives()
    )
    return {
        "file": str(path.relative_to(REPO)),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        **primitive_summary(primitives, glb),
    }


def main() -> None:
    v3 = Glb(V3_KIT)
    v4 = Glb(V4_KIT)
    temple_v3 = indexed_triangles(v3, ["map_temple_geometry"])
    temple_v4 = indexed_triangles(
        v4, ["map_temple_amber_structure", "map_temple_amber_dome"]
    )
    cliff_v3 = indexed_triangles(v3, ["map_cliff_geometry"])
    cliff_v4 = indexed_triangles(v4, ["map_cliff_geometry"])
    cypress_v3 = indexed_triangles(v3, ["map_cypress_geometry"])
    cypress_v4 = indexed_triangles(v4, ["map_cypress_geometry"])

    temple_positions_v3 = Counter(map(position_triangle, temple_v3))
    temple_positions_v4 = Counter(map(position_triangle, temple_v4))
    report = {
        "schema": 1,
        "purpose": "Reproducible local audit of museum geometry and normal lineage; no network access.",
        "assets": {
            "templeDenseArchive": asset_row(
                V3 / "meshy" / "floating-museum-temple-v3-pre-remesh.glb"
            ),
            "templeTexturedDonor": asset_row(
                V3 / "meshy" / "floating-museum-temple-v3.glb"
            ),
            "templeV3Runtime": asset_row(V3_KIT, ["map_temple_geometry"]),
            "templeV4Structure": asset_row(V4_KIT, ["map_temple_amber_structure"]),
            "templeV4Dome": asset_row(V4_KIT, ["map_temple_amber_dome"]),
            "cypressDenseArchive": asset_row(
                V3 / "meshy" / "floating-museum-cypress-v3-pre-remesh.glb"
            ),
            "cypressTexturedDonor": asset_row(
                V3 / "meshy" / "floating-museum-cypress-v3.glb"
            ),
            "cypressV3Runtime": asset_row(V3_KIT, ["map_cypress_geometry"]),
            "cypressV4Runtime": asset_row(V4_KIT, ["map_cypress_geometry"]),
            "cliffDenseArchive": asset_row(
                V3 / "meshy" / "floating-museum-cliff-v3-pre-remesh.glb"
            ),
            "cliffTexturedDonor": asset_row(
                V3 / "meshy" / "floating-museum-cliff-v3.glb"
            ),
            "cliffV3Runtime": asset_row(V3_KIT, ["map_cliff_geometry"]),
            "cliffV4Runtime": asset_row(V4_KIT, ["map_cliff_geometry"]),
        },
        "runtimeFileParity": {
            "artExport": str(V4_KIT.relative_to(REPO)),
            "runtimeAsset": str(RUNTIME_V4_KIT.relative_to(REPO)),
            "artSha256": digest(V4_KIT),
            "runtimeSha256": digest(RUNTIME_V4_KIT),
            "byteIdentical": V4_KIT.read_bytes() == RUNTIME_V4_KIT.read_bytes(),
        },
        "lineage": {
            "templeV3ToV4": {
                "sourceTriangles": len(temple_v3),
                "targetTriangles": len(temple_v4),
                "exactIndexedTrianglePositionParity": temple_positions_v3
                == temple_positions_v4,
                "normalComparison": compare_normals_by_position(temple_v3, temple_v4),
            },
            "cypressV3ToV4": {
                "sourceTriangles": len(cypress_v3),
                "targetTriangles": len(cypress_v4),
                "exactIndexedPositionAndNormalParity": Counter(
                    map(position_normal_triangle, cypress_v3)
                )
                == Counter(map(position_normal_triangle, cypress_v4)),
            },
            "cliffV3ToV4": {
                "sourceTriangles": len(cliff_v3),
                "targetTriangles": len(cliff_v4),
                "exactIndexedPositionAndNormalParity": Counter(
                    map(position_normal_triangle, cliff_v3)
                )
                == Counter(map(position_normal_triangle, cliff_v4)),
            },
        },
        "v4NormalHealth": normal_health(v4),
        "command": (
            "rtk python3 "
            "art/glass-adventure/journey-map/v9/production/audit_geometry_lineage.py"
        ),
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
