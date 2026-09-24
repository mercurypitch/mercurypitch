"""Repair unused tangent and legacy ramp UV export defects without changing shape.

Run on a preserved source GLB and write a separately versioned derivative. No
decimation, vertex movement, normal recalculation, material recolouring, or mesh
renaming occurs. Referenced geometry byte streams are asserted identical.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import struct


TANGENT_INDEPENDENT_MATERIAL_EXTENSIONS = frozenset(
    {
        "KHR_materials_emissive_strength",
        "KHR_materials_ior",
        "KHR_materials_transmission",
    }
)


def contains_normal_texture(value):
    """Return whether a nested material extension references a normal texture."""
    if isinstance(value, dict):
        return any(
            "normaltexture" in key.casefold() or contains_normal_texture(child)
            for key, child in value.items()
        )
    if isinstance(value, list):
        return any(contains_normal_texture(child) for child in value)
    return False


def tangent_is_provably_unused(material):
    """Only remove tangents when every material feature is known not to use them."""
    if "normalTexture" in material:
        return False
    extensions = material.get("extensions") or {}
    if contains_normal_texture(extensions):
        return False
    # KHR_materials_anisotropy consumes the tangent basis even without a texture.
    if "KHR_materials_anisotropy" in extensions:
        return False
    # An extension not reviewed here may consume TANGENT through shader behavior
    # that is not exposed as a normal-texture property. Retention is lossless.
    return set(extensions).issubset(TANGENT_INDEPENDENT_MATERIAL_EXTENSIONS)


def read(path):
    raw = path.read_bytes()
    magic, version, size = struct.unpack_from("<III", raw)
    assert magic == 0x46546C67 and version == 2 and size == len(raw)
    length, kind = struct.unpack_from("<II", raw, 12)
    assert kind == 0x4E4F534A
    doc = json.loads(raw[20:20 + length])
    binary_size, kind = struct.unpack_from("<II", raw, 20 + length)
    assert kind == 0x004E4942
    binary = bytearray(raw[28 + length:28 + length + binary_size])
    return doc, binary


def accessor_bytes(doc, binary, index):
    accessor = doc["accessors"][index]
    assert "sparse" not in accessor
    view = doc["bufferViews"][accessor["bufferView"]]
    count = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[accessor["type"]]
    width = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}[accessor["componentType"]] * count
    offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", width)
    return b"".join(binary[offset + i * stride:offset + i * stride + width] for i in range(accessor["count"]))


def geometry_signature(doc, binary):
    result = {}
    for mi, mesh in enumerate(doc["meshes"]):
        for pi, primitive in enumerate(mesh["primitives"]):
            for attr, index in primitive["attributes"].items():
                if attr not in ("POSITION", "NORMAL", "TEXCOORD_0", "COLOR_0"):
                    continue
                result[f"{mi}/{pi}/{attr}"] = hashlib.sha256(accessor_bytes(doc, binary, index)).hexdigest()
            if "indices" in primitive:
                result[f"{mi}/{pi}/indices"] = hashlib.sha256(accessor_bytes(doc, binary, primitive["indices"])).hexdigest()
    return result


def repair(doc, binary):
    assert not doc.get("skins") and not doc.get("animations"), "This static-asset repair does not rewrite skin/animation accessors."
    before = geometry_signature(doc, binary)
    original_nodes = copy.deepcopy(doc["nodes"])
    removed = set()
    edits = []
    for mi, mesh in enumerate(doc["meshes"]):
        for pi, primitive in enumerate(mesh["primitives"]):
            assert not primitive.get("targets"), "Morph streams need a separate repair."
            material = doc["materials"][primitive["material"]] if "material" in primitive else {}
            attrs = primitive["attributes"]
            if "TANGENT" in attrs and tangent_is_provably_unused(material):
                removed.add(attrs.pop("TANGENT"))
                edits.append({"mesh": mi, "primitive": pi, "change": "remove unused tangent on material without normal maps"})
            base_texture = material.get("pbrMetallicRoughness", {}).get("baseColorTexture")
            if base_texture is not None and "TEXCOORD_0" not in attrs:
                assert mesh["name"] == "platform_ramp_stone", "Unexpected missing UVs need explicit inspection."
                position = doc["accessors"][attrs["POSITION"]]
                normal = doc["accessors"][attrs["NORMAL"]]
                assert position["componentType"] == normal["componentType"] == 5126
                vertices = struct.iter_unpack("<3f", accessor_bytes(doc, binary, attrs["POSITION"]))
                normals = struct.iter_unpack("<3f", accessor_bytes(doc, binary, attrs["NORMAL"]))
                uvs = []
                for point, direction in zip(vertices, normals):
                    axis = max(range(3), key=lambda index: abs(direction[index]))
                    axes = ((2, 1), (0, 2), (0, 1))[axis]
                    uvs.append((point[axes[0]], point[axes[1]]))
                while len(binary) % 4:
                    binary.append(0)
                offset = len(binary)
                for uv in uvs:
                    binary.extend(struct.pack("<2f", *uv))
                view_index = len(doc["bufferViews"])
                doc["bufferViews"].append({"buffer": 0, "byteOffset": offset, "byteLength": len(uvs) * 8, "target": 34962})
                attrs["TEXCOORD_0"] = len(doc["accessors"])
                doc["accessors"].append({"bufferView": view_index, "componentType": 5126, "count": len(uvs), "type": "VEC2"})
                edits.append({"mesh": mi, "primitive": pi, "change": "dominant-normal metre UVs for ramp", "vertices": len(uvs)})
    for mi, material in enumerate(doc["materials"]):
        info = material.get("pbrMetallicRoughness", {}).get("baseColorTexture")
        if info is not None and info.get("texCoord", 0) < 0:
            assert material["name"] == "museum_ivory"
            info["texCoord"] = 0
            edits.append({"material": mi, "change": "replace invalid negative UV reference with authored UV0"})
    used = set()
    for mesh in doc["meshes"]:
        for primitive in mesh["primitives"]:
            used.update(primitive["attributes"].values())
            if "indices" in primitive:
                used.add(primitive["indices"])
    removed -= used
    indices = {}
    accessors = []
    for index, accessor in enumerate(doc["accessors"]):
        if index not in removed:
            indices[index] = len(accessors)
            accessors.append(accessor)
    doc["accessors"] = accessors
    for mesh in doc["meshes"]:
        for primitive in mesh["primitives"]:
            primitive["attributes"] = {name: indices[index] for name, index in primitive["attributes"].items()}
            if "indices" in primitive:
                primitive["indices"] = indices[primitive["indices"]]
    doc["buffers"][0]["byteLength"] = len(binary)
    after = geometry_signature(doc, binary)
    assert all(after[key] == value for key, value in before.items()), "A protected geometry/UV stream changed."
    assert doc["nodes"] == original_nodes, "Scene transforms, names and roles must not change."
    return {"edits": edits, "removedUnusedTangentAccessors": len(removed), "protectedStreams": len(before), "geometrySignatureUnchanged": True}


def write(path, doc, binary):
    text = json.dumps(doc, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    binary += b"\0" * (-len(binary) % 4)
    size = 28 + len(text) + len(binary)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(struct.pack("<III", 0x46546C67, 2, size) + struct.pack("<II", len(text), 0x4E4F534A) + text + struct.pack("<II", len(binary), 0x004E4942) + binary)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    assert args.source.resolve() != args.output.resolve(), "Keep the source immutable."
    doc, binary = read(args.source)
    result = repair(doc, binary)
    write(args.output, doc, binary)
    fresh_doc, fresh_binary = read(args.output)
    assert not repair(fresh_doc, fresh_binary)["edits"], "Repair must be idempotent."
    result.update(source=str(args.source), output=str(args.output), sourceSha256=hashlib.sha256(args.source.read_bytes()).hexdigest(), outputSha256=hashlib.sha256(args.output.read_bytes()).hexdigest(), bytes=args.output.stat().st_size)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({key: value for key, value in result.items() if key != "edits"}))
