"""Check a saved donor-derived GLB and packed Blender source without changing either."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stem", required=True)
    parser.add_argument("--probe-crown", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    stem = args.stem
    if not stem.replace("-", "").isalnum():
        raise ValueError("Invalid artifact stem")
    export = HERE / "exports" / f"{stem}.glb"
    blend = HERE / "sources" / f"{stem}.blend"
    data = export.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data)
    assert (magic, version, length) == (b"glTF", 2, len(data))
    json_size, kind = struct.unpack_from("<II", data, 12)
    assert kind == 0x4e4f534a
    document = json.loads(data[20:20+json_size])
    bin_size, bin_kind = struct.unpack_from("<II", data, 20+json_size)
    assert bin_kind == 0x004e4942
    binary = data[28+json_size:28+json_size+bin_size]
    assert not any(buffer.get("uri") for buffer in document.get("buffers", []))
    images = []
    for item in document.get("images", []):
        assert not item.get("uri"), "Runtime GLB has an external texture dependency"
        view = document["bufferViews"][item["bufferView"]]
        payload = binary[view.get("byteOffset", 0):view.get("byteOffset", 0)+view["byteLength"]]
        assert payload.startswith(b"\x89PNG\r\n\x1a\n"), "Expected audited PNG runtime derivative"
        width, height = struct.unpack_from(">II", payload, 16)
        assert width == height == 1024
        images.append({"mimeType": item["mimeType"], "dimensions": [width, height], "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()})
    primitives = [p for mesh in document["meshes"] for p in mesh["primitives"]]
    for primitive in primitives:
        assert {"POSITION", "NORMAL", "TEXCOORD_0", "TANGENT"} <= primitive["attributes"].keys()
    triangles = sum(document["accessors"][p["indices"]]["count"] // 3 for p in primitives)
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    assert not bpy.data.libraries, "Linked-library dependency"
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    assert meshes
    for obj in meshes:
        assert obj.data.uv_layers, "Missing source UVs"
        assert all(math.isfinite(c) for v in obj.data.vertices for c in v.co)
        assert obj.matrix_world.determinant() > 0
    assert all(image.packed_file for image in bpy.data.images), "Unpacked source image"
    assert all(tuple(image.size) == (2048, 2048) for image in bpy.data.images)
    source_images = [{"name": image.name, "dimensions": list(image.size), "packed": bool(image.packed_file), "colorSpace": image.colorspace_settings.name} for image in bpy.data.images]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(export))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    points = [obj.matrix_world @ Vector(c) for obj in meshes for c in obj.bound_box]
    bounds = {"min": [min(p[i] for p in points) for i in range(3)], "max": [max(p[i] for p in points) for i in range(3)]}
    report = {"status": "passed", "stem": stem, "glbSha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "triangles": triangles, "primitives": len(primitives), "materials": document.get("materials", []), "runtimeImages": images, "packedSourceImages": source_images, "sourceMissingExternalDependencies": [], "reimportBlenderBounds": bounds, "note": "Structural validation and actual fresh GLB reimport. Visual comparison is a separate gate."}
    if args.probe_crown:
        vertices = []; faces = []
        for obj in meshes:
            offset = len(vertices)
            vertices.extend(obj.matrix_world @ vertex.co for vertex in obj.data.vertices)
            faces.extend(tuple(offset+i for i in face.vertices) for face in obj.data.polygons)
        tree = BVHTree.FromPolygons(vertices, faces)
        probes = []
        for x, y in [(0, 0), (.04, 0), (-.04, 0), (0, .04), (0, -.04)]:
            hit = tree.ray_cast(Vector((x,y,4)), Vector((0,0,-1)), 5)[0]
            probes.append({"xy": [x,y], "firstHitHeight": None if hit is None else hit.z})
        assert all(p["firstHitHeight"] is not None and p["firstHitHeight"] < .4 for p in probes), "Crown center is obstructed above the podium"
        report["openCrownCenterProbes"] = probes
    target = HERE / "reports" / f"{stem}-validation.json"
    target.write_text(json.dumps(report, indent=2) + "\n")
    print("V3_ARCHITECTURE_VALIDATED " + str(target))

if __name__ == "__main__":
    main()
