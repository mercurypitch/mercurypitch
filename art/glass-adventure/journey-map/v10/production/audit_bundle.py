"""Assert non-botanical museum meshes, transforms and image payloads survive packaging."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[3]
spec = importlib.util.spec_from_file_location("repair", REPO / "art/glass-adventure/production/repair_export_attributes.py")
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)


def signature(path):
    doc, binary = repair.read(path)

    def image(index):
        item = doc["images"][index]
        view = doc["bufferViews"][item["bufferView"]]
        offset = view.get("byteOffset", 0)
        return hashlib.sha256(binary[offset:offset + view["byteLength"]]).hexdigest()

    def material(index):
        item = copy.deepcopy(doc["materials"][index])

        def walk(value):
            if isinstance(value, dict):
                for key, child in value.items():
                    if key.endswith("Texture") and isinstance(child, dict) and "index" in child:
                        texture = doc["textures"][child["index"]]
                        source = texture.get("source")
                        if source is None:
                            source = texture["extensions"]["EXT_texture_webp"]["source"]
                        child["index"] = image(source)
                        child["sampler"] = {"wrapS": 10497, "wrapT": 10497, **(doc.get("samplers", [])[texture["sampler"]] if "sampler" in texture else {})}
                        if key == "occlusionTexture":
                            child.setdefault("strength", 1)
                    else:
                        walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)
        walk(item)
        return item

    def attribute(index):
        item = doc["accessors"][index]
        return {
            "sha256": hashlib.sha256(repair.accessor_bytes(doc, binary, index)).hexdigest(),
            "type": item["type"], "componentType": item["componentType"],
            "normalized": item.get("normalized", False), "count": item["count"],
            "min": item.get("min"), "max": item.get("max"),
            "extensions": item.get("extensions", {}),
        }

    results = {}

    def visit(index, parents=()):
        node = doc["nodes"][index]
        name = node.get("name", "unnamed")
        if name == "map_flower_cluster":
            return
        path = "/".join((*parents, name))
        value = {key: node[key] for key in ("translation", "rotation", "scale", "matrix") if key in node}
        # Explicit identity and omitted transforms mean the same thing.
        value.setdefault("translation", [0, 0, 0])
        value.setdefault("rotation", [0, 0, 0, 1])
        value.setdefault("scale", [1, 1, 1])
        if "mesh" in node:
            value["primitives"] = []
            for primitive in doc["meshes"][node["mesh"]]["primitives"]:
                value["primitives"].append({
                    "mode": primitive.get("mode", 4),
                    "extensions": primitive.get("extensions", {}),
                    "attributes": {key: attribute(item) for key, item in primitive["attributes"].items()},
                    "indices": attribute(primitive["indices"]),
                    "material": material(primitive["material"]),
                })
        results[path] = value
        for child in node.get("children", []):
            visit(child, (*parents, name))

    for node in doc["scenes"][doc.get("scene", 0)]["nodes"]:
        visit(node)
    return results


source = signature(ROOT / "sources/floating-museum-twin-finish-kit-v9.glb")
delivery = signature(ROOT / "delivery/floating-museum-botanical-kit-v10-1k.glb")
if source != delivery:
    def diff(a, b, key=""):
        if isinstance(a, dict) and isinstance(b, dict):
            for k in a.keys() | b.keys():
                diff(a.get(k), b.get(k), key + "/" + str(k))
        elif isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
            for i, (left, right) in enumerate(zip(a, b)):
                diff(left, right, key + "/" + str(i))
        elif a != b:
            print(key, str(a)[:240], "=>", str(b)[:240])
    diff(source, delivery)
    raise AssertionError("An unrelated museum geometry, texture, material or transform changed.")
result = {"unchangedNonBotanicalNodes": len(source), "allProtectedPayloadsAndTransformsIdentical": True, "source": source}
(ROOT / "proofs/bundle-preservation.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({key: value for key, value in result.items() if key != "source"}))
