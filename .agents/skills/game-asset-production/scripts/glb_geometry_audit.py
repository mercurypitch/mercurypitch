"""Screen glTF/GLB face/normal alignment; flags need visual inspection."""

import argparse
import json
from pathlib import Path

import numpy as np

from gltf_document import load_gltf


def inspect(path):
    asset = load_gltf(path)
    doc = asset.document

    def array(index):
        accessor = doc["accessors"][index]
        assert "sparse" not in accessor, "Sparse streams need a decoder-aware audit."
        view = doc["bufferViews"][accessor["bufferView"]]
        dtype = np.dtype(
            {
                5120: "i1",
                5121: "u1",
                5122: "<i2",
                5123: "<u2",
                5125: "<u4",
                5126: "<f4",
            }[accessor["componentType"]]
        )
        width = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[accessor["type"]]
        data = np.ndarray(
            (accessor["count"], width),
            dtype=dtype,
            buffer=asset.buffer_view(accessor["bufferView"]),
            offset=accessor.get("byteOffset", 0),
            strides=(
                view.get("byteStride", dtype.itemsize * width),
                dtype.itemsize,
            ),
        )
        if accessor.get("normalized"):
            data = np.maximum(data.astype(np.float64) / np.iinfo(dtype).max, -1)
        return data

    records = []
    for mi, mesh in enumerate(doc.get("meshes", [])):
        for pi, primitive in enumerate(mesh["primitives"]):
            attrs = primitive["attributes"]
            if primitive.get("mode", 4) != 4 or "NORMAL" not in attrs:
                records.append(
                    {
                        "mesh": mi,
                        "primitive": pi,
                        "status": (
                            "Non-triangle or no-normal primitive; inspect separately."
                        ),
                    }
                )
                continue
            positions = array(attrs["POSITION"]).astype(np.float64)
            normals = array(attrs["NORMAL"]).astype(np.float64)
            indices = (
                array(primitive["indices"]).ravel()
                if "indices" in primitive
                else np.arange(len(positions))
            )
            triangles = indices.reshape(-1, 3)
            vertices = positions[triangles]
            face = np.cross(
                vertices[:, 1] - vertices[:, 0],
                vertices[:, 2] - vertices[:, 0],
            )
            area2 = np.linalg.norm(face, axis=1)
            average = normals[triangles].mean(axis=1)
            norm = np.linalg.norm(average, axis=1)
            valid = (area2 > 1e-12) & (norm > 1e-8)
            cosine = np.zeros(len(triangles))
            cosine[valid] = np.einsum(
                "ij,ij->i", face[valid], average[valid]
            ) / (area2[valid] * norm[valid])
            negative = valid & (cosine < -0.1)
            records.append(
                {
                    "mesh": mi,
                    "name": mesh.get("name"),
                    "primitive": pi,
                    "triangles": len(triangles),
                    "degenerateTriangles": int((area2 <= 1e-12).sum()),
                    "opposedFaceNormalTriangles": int(negative.sum()),
                    "opposedFraction": round(
                        float(negative.sum() / max(1, valid.sum())), 6
                    ),
                    "opposedAreaFraction": round(
                        float(area2[negative].sum() / max(1e-12, area2.sum())),
                        8,
                    ),
                    "nonFiniteVertexValues": int((~np.isfinite(positions)).sum()),
                    "nonFiniteNormalValues": int((~np.isfinite(normals)).sum()),
                }
            )
    mirrored = []
    for ni, node in enumerate(doc.get("nodes", [])):
        determinant = (
            np.linalg.det(np.array(node["matrix"]).reshape(4, 4).T[:3, :3])
            if "matrix" in node
            else np.prod(node.get("scale", [1, 1, 1]))
        )
        if determinant < 0:
            mirrored.append(
                {
                    "node": ni,
                    "name": node.get("name"),
                    "determinant": float(determinant),
                }
            )
    return {
        **asset.provenance(),
        "primitives": records,
        "mirroredTransforms": mirrored,
        "flags": [
            row
            for row in records
            if row.get("opposedFraction", 0) > 0.01
            or row.get("nonFiniteVertexValues", 0)
            or row.get("nonFiniteNormalValues", 0)
        ],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = {
        "scope": (
            "Face/normal alignment in local exported coordinates. Does not certify "
            "outward orientation, manifold topology, animated contact or appearance. "
            "Curved smooth surfaces and intentional leaf sheets need visual review."
        ),
        "assets": [inspect(path) for path in args.files],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(
        json.dumps(
            {
                "assets": len(report["assets"]),
                "flaggedPrimitives": sum(
                    len(item["flags"]) for item in report["assets"]
                ),
            }
        )
    )
