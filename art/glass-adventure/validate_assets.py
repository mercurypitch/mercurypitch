"""Independently check exported GLB hashes, transforms, fracture volumes and UVs."""

import hashlib
import json
import math
from pathlib import Path
import struct

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "apps/beside-cue/public/games/adventure"
IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]


def multiply(a, b):
    return [sum(a[k*4+r] * b[c*4+k] for k in range(4)) for c in range(4) for r in range(4)]


def transform(node):
    if "matrix" in node:
        return node["matrix"]
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    sx, sy, sz = node.get("scale", [1, 1, 1])
    tx, ty, tz = node.get("translation", [0, 0, 0])
    return [(1-2*y*y-2*z*z)*sx, (2*x*y+2*z*w)*sx, (2*x*z-2*y*w)*sx, 0,
            (2*x*y-2*z*w)*sy, (1-2*x*x-2*z*z)*sy, (2*y*z+2*x*w)*sy, 0,
            (2*x*z+2*y*w)*sz, (2*y*z-2*x*w)*sz, (1-2*x*x-2*y*y)*sz, 0,
            tx, ty, tz, 1]


def point(matrix, p):
    return tuple(sum(matrix[c*4+r] * p[c] for c in range(3)) + matrix[12+r] for r in range(3))


class Glb:
    def __init__(self, path):
        raw = path.read_bytes()
        assert raw[:4] == b"glTF" and struct.unpack_from("<I", raw, 4)[0] == 2
        assert struct.unpack_from("<I", raw, 8)[0] == len(raw)
        size = struct.unpack_from("<I", raw, 12)[0]
        self.doc = json.loads(raw[20:20+size])
        offset = 20+size
        assert raw[offset+4:offset+8] == b"BIN\x00"
        self.data = raw[offset+8:]
        self.nodes = {}

        def visit(index, parent):
            node = self.doc["nodes"][index]
            world = multiply(parent, transform(node))
            self.nodes[node["name"]] = (node, world)
            for child in node.get("children", []):
                visit(child, world)

        for index in self.doc["scenes"][self.doc.get("scene", 0)]["nodes"]:
            visit(index, IDENTITY)

    def accessor(self, index):
        data = self.doc["accessors"][index]
        view = self.doc["bufferViews"][data["bufferView"]]
        kind = {5121: "B", 5123: "H", 5125: "I", 5126: "f"}[data["componentType"]]
        width = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[data["type"]]
        pattern = "<" + kind*width
        step = view.get("byteStride", struct.calcsize(pattern))
        start = view.get("byteOffset", 0)+data.get("byteOffset", 0)
        result = [struct.unpack_from(pattern, self.data, start+i*step) for i in range(data["count"])]
        assert all(math.isfinite(v) for row in result for v in row)
        return result

    def primitives(self, name):
        node, world = self.nodes[name]
        for primitive in self.doc["meshes"][node["mesh"]]["primitives"]:
            assert primitive.get("mode", 4) == 4
            positions = [point(world, p) for p in self.accessor(primitive["attributes"]["POSITION"])]
            indices = [v[0] for v in self.accessor(primitive["indices"])]
            assert len(indices) % 3 == 0 and max(indices) < len(positions)
            yield primitive, positions, indices

    def volume(self, name):
        total = 0
        for _, positions, indices in self.primitives(name):
            for i in range(0, len(indices), 3):
                a, b, c = [positions[indices[i+j]] for j in range(3)]
                cross = (b[1]*c[2]-b[2]*c[1], b[2]*c[0]-b[0]*c[2], b[0]*c[1]-b[1]*c[0])
                total += sum(a[j]*cross[j] for j in range(3))/6
        return total


def main():
    manifest = json.loads((OUT/"manifest.json").read_text())
    models = {}
    for name, info in manifest["bundles"].items():
        data = (OUT/name).read_bytes()
        assert len(data) == info["bytes"]
        assert hashlib.sha256(data).hexdigest() == info["sha256"]
        models[name] = Glb(OUT/name)
    results = {}
    mesh_count = 0
    for name, asset in manifest["assets"].items():
        model = models[asset["bundle"]]
        assert asset["node"] in model.nodes
        for record in asset["meshes"]:
            assert record["node"] in model.nodes
            count = sum(len(indices)//3 for _, _, indices in model.primitives(record["node"]))
            assert count == record["triangles"], record["node"]
            mesh_count += 1
        if asset["role"] != "breakable":
            continue
        intact = model.volume(asset["intact"])
        shattered = sum(model.volume(shard) for shard in asset["shards"])
        relative_error = abs(intact-shattered)/abs(intact)
        assert intact > 0 and relative_error < 1e-5, name
        assert len(asset["shards"]) == 16
        results[name] = {"closedShards": 16, "exportedVolumeRelativeError": relative_error}
        if name == "legend_cash":
            samples = 0
            largest_error = 0
            for node in [asset["intact"]] + asset["shards"]:
                for primitive, positions, _ in model.primitives(node):
                    uv = model.accessor(primitive["attributes"]["TEXCOORD_0"])
                    for pos, coord in zip(positions, uv):
                        # glTF's V convention is reversed from Blender UV space.
                        expected = (pos[0]/0.72+0.5, 1-pos[1]/1.08)
                        error = max(abs(coord[j]-expected[j]) for j in range(2))
                        largest_error = max(largest_error, error)
                        samples += 1
            assert largest_error < 2e-6
            results[name]["uvSamples"] = samples
            results[name]["maxUVError"] = largest_error
    report = {"status": "passed", "bundles": len(models), "namedMeshes": mesh_count,
              "bundleBytes": sum(x["bytes"] for x in manifest["bundles"].values()), "breakables": results}
    (HERE/"validation.json").write_text(json.dumps(report, indent=2)+"\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
