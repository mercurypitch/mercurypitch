"""Repair zero/denormalized float tangents in a GLB without changing topology.

Meshy donor meshes occasionally contain UV-degenerate vertices for which both
Blender and MikkTSpace emit a zero tangent.  glTF requires the tangent xyz
vector to have unit length.  For those isolated vertices, derive a stable
orthogonal tangent from the corresponding normal; normalize every other
tangent while preserving its handedness component.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
import shutil
import struct
import sys


def chunks(raw: bytearray) -> tuple[dict[str, object], int, int]:
    if raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 4)[0] != 2:
        raise ValueError("Input is not a glTF 2 GLB")
    json_length, json_type = struct.unpack_from("<II", raw, 12)
    if json_type != 0x4E4F534A:
        raise ValueError("First chunk is not GLB JSON")
    document = json.loads(bytes(raw[20 : 20 + json_length]).decode("utf-8").rstrip(" \t\r\n\0"))
    header = 20 + json_length
    binary_length, binary_type = struct.unpack_from("<II", raw, header)
    if binary_type != 0x004E4942:
        raise ValueError("Second chunk is not GLB BIN")
    return document, header + 8, binary_length


def element_offset(document: dict[str, object], accessor_index: int, index: int) -> int:
    accessor = document["accessors"][accessor_index]
    view = document["bufferViews"][accessor["bufferView"]]
    component_bytes = 4
    components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[accessor["type"]]
    stride = int(view.get("byteStride", component_bytes * components))
    return int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0)) + index * stride


def orthogonal(normal: tuple[float, float, float]) -> tuple[float, float, float]:
    nx, ny, nz = normal
    n_length = math.sqrt(nx * nx + ny * ny + nz * nz)
    if n_length <= 1e-12:
        return (1.0, 0.0, 0.0)
    nx, ny, nz = nx / n_length, ny / n_length, nz / n_length
    axis = (1.0, 0.0, 0.0) if abs(nx) < 0.9 else (0.0, 1.0, 0.0)
    tx = axis[1] * nz - axis[2] * ny
    ty = axis[2] * nx - axis[0] * nz
    tz = axis[0] * ny - axis[1] * nx
    length = math.sqrt(tx * tx + ty * ty + tz * tz)
    return (tx / length, ty / length, tz / length)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: repair_invalid_tangents.py INPUT.glb OUTPUT.glb")
    source, output = map(Path, sys.argv[1:])
    shutil.copyfile(source, output)
    raw = bytearray(output.read_bytes())
    document, binary_start, binary_length = chunks(raw)
    repaired = 0
    normalized = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            attributes = primitive.get("attributes", {})
            if "TANGENT" not in attributes:
                continue
            tangent_index = int(attributes["TANGENT"])
            normal_index = int(attributes["NORMAL"])
            tangent_accessor = document["accessors"][tangent_index]
            normal_accessor = document["accessors"][normal_index]
            if tangent_accessor["componentType"] != 5126 or tangent_accessor["type"] != "VEC4":
                raise ValueError("Expected float VEC4 tangents")
            if normal_accessor["componentType"] != 5126 or normal_accessor["type"] != "VEC3":
                raise ValueError("Expected float VEC3 normals")
            if int(tangent_accessor["count"]) != int(normal_accessor["count"]):
                raise ValueError("Tangent/normal accessor counts differ")
            for index in range(int(tangent_accessor["count"])):
                tangent_offset = binary_start + element_offset(document, tangent_index, index)
                normal_offset = binary_start + element_offset(document, normal_index, index)
                tx, ty, tz, tw = struct.unpack_from("<4f", raw, tangent_offset)
                length = math.sqrt(tx * tx + ty * ty + tz * tz)
                if length <= 1e-8 or not math.isfinite(length):
                    normal = struct.unpack_from("<3f", raw, normal_offset)
                    tx, ty, tz = orthogonal(normal)
                    repaired += 1
                elif abs(length - 1.0) > 1e-6:
                    tx, ty, tz = tx / length, ty / length, tz / length
                    normalized += 1
                handedness = -1.0 if tw < 0.0 else 1.0
                struct.pack_into("<4f", raw, tangent_offset, tx, ty, tz, handedness)
    if binary_start + binary_length > len(raw):
        raise ValueError("GLB binary chunk exceeds file length")
    output.write_bytes(raw)
    print(json.dumps({"zeroTangentsRepaired": repaired, "tangentsNormalized": normalized}))


if __name__ == "__main__":
    main()
