"""Regression tests for equivalent GLB and safe external-buffer glTF audits."""

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import struct
from tempfile import TemporaryDirectory
import unittest

import numpy as np

import glb_geometry_audit
import glb_inventory
from gltf_document import GltfFormatError, load_gltf


def triangle_fixture() -> tuple[dict, bytes]:
    positions = np.array(
        [[0, 0, 0], [1, 0, 0], [0, 1, 0]], dtype="<f4"
    ).tobytes()
    normals = np.array([[0, 0, 1]] * 3, dtype="<f4").tobytes()
    indices = np.array([0, 1, 2], dtype="<u2").tobytes()
    binary = positions + normals + indices + b"\0\0"
    document = {
        "asset": {"version": "2.0"},
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(positions)},
            {
                "buffer": 0,
                "byteOffset": len(positions),
                "byteLength": len(normals),
            },
            {
                "buffer": 0,
                "byteOffset": len(positions) + len(normals),
                "byteLength": len(indices),
            },
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3"},
            {"bufferView": 1, "componentType": 5126, "count": 3, "type": "VEC3"},
            {"bufferView": 2, "componentType": 5123, "count": 3, "type": "SCALAR"},
        ],
        "meshes": [
            {
                "name": "triangle",
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1},
                        "indices": 2,
                    }
                ],
            }
        ],
        "nodes": [{"mesh": 0}],
    }
    return document, binary


def write_glb(path: Path, document: dict, binary: bytes) -> None:
    encoded = json.dumps(document, separators=(",", ":")).encode()
    encoded += b" " * (-len(encoded) % 4)
    padded_binary = binary + b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(encoded) + 8 + len(padded_binary)
    path.write_bytes(
        struct.pack("<4sII", b"glTF", 2, total)
        + struct.pack("<I4s", len(encoded), b"JSON")
        + encoded
        + struct.pack("<I4s", len(padded_binary), b"BIN\0")
        + padded_binary
    )


def without_provenance(record: dict) -> dict:
    return {
        key: value
        for key, value in record.items()
        if key not in {"file", "bytes", "sha256", "dependencies"}
    }


class GltfDocumentTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.document, self.binary = triangle_fixture()

    def write_external(
        self, uri: str = "triangle.bin", data: bytes | None = None
    ) -> Path:
        path = self.directory / "triangle.gltf"
        document = deepcopy(self.document)
        document["buffers"][0]["uri"] = uri
        path.write_text(json.dumps(document))
        if data is not None:
            (self.directory / uri).write_bytes(data)
        return path

    def write_split_external(self) -> tuple[Path, list[bytes]]:
        path = self.directory / "triangle.gltf"
        positions_end = self.document["bufferViews"][0]["byteLength"]
        normals_end = positions_end + self.document["bufferViews"][1]["byteLength"]
        chunks = [
            self.binary[:positions_end],
            self.binary[positions_end:normals_end],
            self.binary[normals_end:],
        ]
        document = deepcopy(self.document)
        document["buffers"] = [
            {"byteLength": len(chunk), "uri": f"triangle-part-{index}.bin"}
            for index, chunk in enumerate(chunks, start=1)
        ]
        for index, view in enumerate(document["bufferViews"]):
            view["buffer"] = index
            view["byteOffset"] = 0
        path.write_text(json.dumps(document))
        for record, chunk in zip(document["buffers"], chunks, strict=True):
            (self.directory / record["uri"]).write_bytes(chunk)
        return path, chunks

    def test_glb_and_external_gltf_produce_equivalent_audits(self) -> None:
        glb = self.directory / "triangle.glb"
        write_glb(glb, self.document, self.binary)
        gltf, chunks = self.write_split_external()

        glb_asset = load_gltf(glb)
        gltf_asset = load_gltf(gltf)
        self.assertEqual(glb_asset.buffers[0], b"".join(gltf_asset.buffers))
        self.assertEqual(
            without_provenance(glb_inventory.inspect(glb)),
            without_provenance(glb_inventory.inspect(gltf)),
        )
        self.assertEqual(
            without_provenance(glb_geometry_audit.inspect(glb)),
            without_provenance(glb_geometry_audit.inspect(gltf)),
        )
        self.assertEqual(glb_asset.dependencies, ())
        self.assertEqual(
            gltf_asset.dependencies,
            tuple(
                {
                    "buffer": index,
                    "uri": f"triangle-part-{index + 1}.bin",
                    "file": str(
                        self.directory / f"triangle-part-{index + 1}.bin"
                    ),
                    "bytes": len(chunk),
                    "sha256": hashlib.sha256(chunk).hexdigest(),
                }
                for index, chunk in enumerate(chunks)
            ),
        )

    def test_rejects_nonlocal_and_traversing_buffer_uris(self) -> None:
        for uri in [
            "../triangle.bin",
            "%2e%2e%2ftriangle.bin",
            "/tmp/triangle.bin",
            "nested/triangle.bin",
            "https://example.test/triangle.bin",
            "data:application/octet-stream;base64,AAAA",
            "triangle.bin?signature=secret",
            "nested\\triangle.bin",
        ]:
            with self.subTest(uri=uri):
                path = self.write_external(uri=uri)
                with self.assertRaises(GltfFormatError):
                    load_gltf(path)

    def test_rejects_missing_and_length_mismatched_buffers(self) -> None:
        missing = self.write_external(uri="missing.bin")
        with self.assertRaisesRegex(GltfFormatError, "Missing external buffer"):
            load_gltf(missing)

        mismatched = self.write_external(data=self.binary[:-1])
        with self.assertRaisesRegex(GltfFormatError, "length mismatch"):
            load_gltf(mismatched)

    def test_rejects_negative_bool_and_nonobject_buffer_view_references(self) -> None:
        for value in [-1, True]:
            with self.subTest(buffer=value):
                document = deepcopy(self.document)
                document["buffers"][0]["uri"] = "triangle.bin"
                document["bufferViews"][0]["buffer"] = value
                path = self.directory / "triangle.gltf"
                path.write_text(json.dumps(document))
                (self.directory / "triangle.bin").write_bytes(self.binary)
                with self.assertRaises(GltfFormatError):
                    load_gltf(path)

        document = deepcopy(self.document)
        document["buffers"][0]["uri"] = "triangle.bin"
        document["bufferViews"][0] = True
        path = self.directory / "triangle.gltf"
        path.write_text(json.dumps(document))
        with self.assertRaisesRegex(GltfFormatError, "must be an object"):
            load_gltf(path)

        valid = self.write_external(data=self.binary)
        asset = load_gltf(valid)
        with self.assertRaisesRegex(GltfFormatError, "non-negative integer"):
            asset.buffer_view(-1)

        document = deepcopy(self.document)
        document["buffers"] = True
        valid.write_text(json.dumps(document))
        with self.assertRaisesRegex(GltfFormatError, "buffers must be an array"):
            load_gltf(valid)

    def test_rejects_a_sibling_symlink_that_resolves_outside_asset_directory(
        self,
    ) -> None:
        asset_directory = self.directory / "asset"
        asset_directory.mkdir()
        outside = self.directory / "outside.bin"
        outside.write_bytes(self.binary)
        dependency = asset_directory / "triangle.bin"
        dependency.symlink_to(outside)
        document = deepcopy(self.document)
        document["buffers"][0]["uri"] = dependency.name
        path = asset_directory / "triangle.gltf"
        path.write_text(json.dumps(document))

        with self.assertRaisesRegex(GltfFormatError, "must be beside"):
            load_gltf(path)


if __name__ == "__main__":
    unittest.main()
