"""Give only degenerate-UV zero tangents a valid orthogonal fallback basis."""
import importlib.util
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("repair", ROOT.parents[3] / "art/glass-adventure/production/repair_export_attributes.py")
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)
source = ROOT / "baked/camellia-crescent-rebaked.glb"
output = ROOT / "baked/camellia-crescent-rebaked-valid.glb"
doc, binary = repair.read(source)
signature = repair.geometry_signature(doc, binary)
fixed = 0
for mesh in doc["meshes"]:
    for primitive in mesh["primitives"]:
        tangent = doc["accessors"][primitive["attributes"]["TANGENT"]]
        normal = doc["accessors"][primitive["attributes"]["NORMAL"]]
        assert tangent["componentType"] == normal["componentType"] == 5126
        normals = list(struct.iter_unpack("<3f", repair.accessor_bytes(doc, binary, primitive["attributes"]["NORMAL"])))
        view = doc["bufferViews"][tangent["bufferView"]]
        offset = view.get("byteOffset", 0) + tangent.get("byteOffset", 0)
        stride = view.get("byteStride", 16)
        for i, n in enumerate(normals):
            at = offset + stride * i
            x, y, z, w = struct.unpack_from("<4f", binary, at)
            if x * x + y * y + z * z > 1e-12:
                continue
            # A collapsed UV triangle has no directional derivative. Choose the
            # least parallel cardinal axis, then project it into the tangent plane.
            axis = min(range(3), key=lambda j: abs(n[j]))
            t = [(1 if j == axis else 0) - n[axis] * n[j] for j in range(3)]
            length = math.sqrt(sum(v * v for v in t))
            assert length > .5
            t = [v / length for v in t]
            assert abs(sum(a * b for a, b in zip(n, t))) < 1e-5
            struct.pack_into("<4f", binary, at, *t, 1.0)
            fixed += 1
assert fixed == 126, "The inspected source changed; review degenerate-UV corners again."
assert repair.geometry_signature(doc, binary) == signature
repair.write(output, doc, binary)
(ROOT / "proofs/tangent-repair.json").write_text(json.dumps({
    "zeroTangentsRepaired": fixed,
    "basis": "Unit tangent orthogonal to the unchanged vertex normal; w=1 on UV-degenerate corners only.",
    "geometryAndUVBytesUnchanged": True,
    "nonzeroBakedTangentsUnchanged": True,
}, indent=2) + "\n")
print(f"Repaired {fixed} zero tangent vectors; source shape, UVs and normals are unchanged.")
