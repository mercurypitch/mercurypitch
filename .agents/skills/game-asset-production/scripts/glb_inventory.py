"""Read-only glTF/GLB structure inventory; no appearance/topology certification."""

import argparse
from collections import Counter
import io
import json
from pathlib import Path

from PIL import Image

from gltf_document import load_gltf


def inspect(path):
    asset = load_gltf(path)
    gltf = asset.document
    references = Counter(
        node["mesh"] for node in gltf.get("nodes", []) if "mesh" in node
    )
    meshes = []
    flags = []
    accessors = gltf.get("accessors", [])
    for index, mesh in enumerate(gltf.get("meshes", [])):
        triangles = vertices = 0
        attributes = set()
        for primitive in mesh["primitives"]:
            attrs = primitive.get("attributes", {})
            attributes.update(attrs)
            count = accessors[attrs["POSITION"]]["count"] if "POSITION" in attrs else 0
            vertices += count
            element_count = (
                accessors[primitive["indices"]]["count"]
                if "indices" in primitive
                else count
            )
            mode = primitive.get("mode", 4)
            if mode == 4:
                triangles += element_count // 3
            elif mode in (5, 6):
                triangles += max(0, element_count - 2)
            if "NORMAL" not in attrs:
                flags.append(
                    f"mesh {index}: primitive lacks NORMAL; inspect intended shading"
                )
            material_index = primitive.get("material")
            if material_index is not None:
                material = gltf.get("materials", [])[material_index]
                has_texture = "Texture" in json.dumps(material)
                if has_texture and "TEXCOORD_0" not in attrs:
                    flags.append(
                        f"mesh {index}: textured primitive lacks TEXCOORD_0"
                    )
        meshes.append(
            {
                "index": index,
                "name": mesh.get("name"),
                "triangles": triangles,
                "exportedVertices": vertices,
                "primitives": len(mesh["primitives"]),
                "nodeReferences": references[index],
                "attributes": sorted(attributes),
            }
        )
    images = []
    for index, image in enumerate(gltf.get("images", [])):
        record = {
            "index": index,
            "name": image.get("name"),
            "mimeType": image.get("mimeType"),
        }
        if "bufferView" in image:
            raw = asset.buffer_view(image["bufferView"])
            record["encodedBytes"] = len(raw)
            try:
                with Image.open(io.BytesIO(raw)) as decoded:
                    record.update(
                        width=decoded.width,
                        height=decoded.height,
                        estimatedRgbaMipBytes=round(
                            decoded.width * decoded.height * 4 * 4 / 3
                        ),
                    )
            except (OSError, ValueError):
                record["status"] = (
                    "compressed or unsupported image; inspect with its decoder"
                )
        elif "uri" in image:
            record["status"] = "URI resource; not fetched"
        images.append(record)
    return {
        **asset.provenance(),
        "uniqueMeshTriangles": sum(mesh["triangles"] for mesh in meshes),
        "nodeReferencedTriangles": sum(
            mesh["triangles"] * mesh["nodeReferences"] for mesh in meshes
        ),
        "meshes": meshes,
        "materials": len(gltf.get("materials", [])),
        "images": images,
        "approximateDecodedRgbaMipBytes": sum(
            image.get("estimatedRgbaMipBytes", 0) for image in images
        ),
        "animations": [
            animation.get("name") for animation in gltf.get("animations", [])
        ],
        "skins": len(gltf.get("skins", [])),
        "extensionsRequired": gltf.get("extensionsRequired", []),
        "extensionsUsed": gltf.get("extensionsUsed", []),
        "reviewFlags": sorted(set(flags)),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    report = {
        "schema": 1,
        "scope": (
            "Static glTF/GLB resource inventory, not a "
            "winding/contact/visual/performance certificate"
        ),
        "assets": [],
        "errors": [],
    }
    for path in args.files:
        try:
            report["assets"].append(inspect(path))
        except (OSError, ValueError, KeyError, IndexError) as error:
            report["errors"].append({"file": str(path), "error": str(error)})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(
        json.dumps(
            {
                "assets": len(report["assets"]),
                "errors": len(report["errors"]),
                "report": str(args.output),
            }
        )
    )
    if report["errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
