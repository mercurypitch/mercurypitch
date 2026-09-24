"""Protect accepted asset repairs from destructive replay and tangent loss."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import subprocess
import tempfile
import unittest


HERE = Path(__file__).resolve().parent


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


repair_attributes = load_module("repair_export_attributes", "repair_export_attributes.py")
repair_current = load_module("repair_current_assets", "repair_current_assets.py")


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def tangent_fixture(material):
    binary = bytearray()
    buffer_views = []
    accessors = []

    def add_accessor(data, component_type, count, kind):
        offset = len(binary)
        binary.extend(data)
        buffer_views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(data)})
        accessors.append(
            {
                "bufferView": len(buffer_views) - 1,
                "componentType": component_type,
                "count": count,
                "type": kind,
            }
        )
        return len(accessors) - 1

    attributes = {
        "POSITION": add_accessor(struct.pack("<3f", 0, 0, 0), 5126, 1, "VEC3"),
        "NORMAL": add_accessor(struct.pack("<3f", 0, 1, 0), 5126, 1, "VEC3"),
        "TEXCOORD_0": add_accessor(struct.pack("<2f", 0, 0), 5126, 1, "VEC2"),
        "TANGENT": add_accessor(struct.pack("<4f", 1, 0, 0, 1), 5126, 1, "VEC4"),
    }
    indices = add_accessor(struct.pack("<H", 0), 5123, 1, "SCALAR")
    return {
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(binary)}],
        "materials": [material],
        "meshes": [
            {
                "name": "tangent_fixture",
                "primitives": [
                    {"attributes": attributes, "indices": indices, "material": 0}
                ],
            }
        ],
        "nodes": [{"mesh": 0}],
    }, binary


class TangentRetentionTest(unittest.TestCase):
    def test_only_proven_unused_tangents_are_removed(self):
        cases = (
            ("plain material", {}, False),
            (
                "known tangent-independent extension",
                {
                    "extensions": {
                        "KHR_materials_transmission": {"transmissionFactor": 0.8}
                    },
                },
                False,
            ),
            ("base normal map", {"normalTexture": {"index": 0}}, True),
            (
                "extension normal map",
                {
                    "extensions": {
                        "KHR_materials_clearcoat": {
                            "clearcoatNormalTexture": {"index": 0}
                        }
                    },
                },
                True,
            ),
            (
                "anisotropy without texture",
                {
                    "extensions": {
                        "KHR_materials_anisotropy": {"anisotropyStrength": 0.7}
                    },
                },
                True,
            ),
            (
                "unknown extension",
                {"extensions": {"EXT_future_tangent_shader": {"factor": 1}}},
                True,
            ),
        )
        for label, material, should_retain in cases:
            with self.subTest(label=label):
                repaired_doc, binary = tangent_fixture(material)
                result = repair_attributes.repair(repaired_doc, binary)
                has_tangent = (
                    "TANGENT"
                    in repaired_doc["meshes"][0]["primitives"][0]["attributes"]
                )
                self.assertEqual(has_tangent, should_retain)
                self.assertEqual(
                    result["removedUnusedTangentAccessors"],
                    0 if should_retain else 1,
                )


class StagedReplayTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.repo = Path(self.temporary.name)
        self.source_bytes = b"immutable source"
        self.accepted_output = b"accepted repaired output"
        self.source = self.repo / "sources/source.glb"
        self.target = self.repo / "public/accepted.glb"
        self.receipt_path = self.repo / "reports/accepted.json"
        self.source.parent.mkdir(parents=True)
        self.target.parent.mkdir(parents=True)
        self.receipt_path.parent.mkdir(parents=True)
        self.source.write_bytes(self.source_bytes)
        self.target.write_bytes(self.accepted_output)
        self.receipt = {
            "edits": [{"change": "accepted repair"}],
            "source": "sources/source.glb",
            "output": "public/accepted.glb",
            "sourceSha256": sha256(self.source_bytes),
            "outputSha256": sha256(self.accepted_output),
            "bytes": len(self.accepted_output),
        }
        self.receipt_path.write_text(json.dumps(self.receipt, indent=2) + "\n")

    def tearDown(self):
        self.temporary.cleanup()

    def runner_for(self, output_bytes, extra_report=None):
        def runner(command, **kwargs):
            self.assertEqual(kwargs["cwd"], self.repo)
            candidate_output = Path(command[3])
            candidate_report = Path(command[5])
            candidate_output.write_bytes(output_bytes)
            report = dict(self.receipt)
            report["output"] = str(candidate_output)
            report["outputSha256"] = sha256(output_bytes)
            report["bytes"] = len(output_bytes)
            report.update(extra_report or {})
            candidate_report.write_text(json.dumps(report, indent=2) + "\n")
            return subprocess.CompletedProcess(command, 0)

        return runner

    def test_hash_drift_cannot_overwrite_accepted_artifacts(self):
        target_before = self.target.read_bytes()
        receipt_before = self.receipt_path.read_bytes()

        with self.assertRaisesRegex(AssertionError, "Candidate output hash drifted"):
            repair_current.reproduce_receipt(
                self.receipt_path,
                repo=self.repo,
                runner=self.runner_for(b"different repair output"),
            )

        self.assertEqual(self.target.read_bytes(), target_before)
        self.assertEqual(self.receipt_path.read_bytes(), receipt_before)

    def test_new_diagnostics_do_not_rewrite_accepted_receipt(self):
        target_inode = self.target.stat().st_ino
        receipt_inode = self.receipt_path.stat().st_ino
        receipt_before = self.receipt_path.read_bytes()

        promoted = repair_current.reproduce_receipt(
            self.receipt_path,
            repo=self.repo,
            runner=self.runner_for(self.accepted_output, {"repairToolVersion": 2}),
        )

        self.assertFalse(promoted)
        self.assertEqual(self.target.stat().st_ino, target_inode)
        self.assertEqual(self.receipt_path.stat().st_ino, receipt_inode)
        self.assertEqual(self.receipt_path.read_bytes(), receipt_before)

    def test_verified_candidate_atomically_restores_drifted_target(self):
        self.target.write_bytes(b"locally drifted target")
        target_inode = self.target.stat().st_ino
        receipt_before = self.receipt_path.read_bytes()

        promoted = repair_current.reproduce_receipt(
            self.receipt_path,
            repo=self.repo,
            runner=self.runner_for(self.accepted_output),
        )

        self.assertTrue(promoted)
        self.assertEqual(self.target.read_bytes(), self.accepted_output)
        self.assertNotEqual(self.target.stat().st_ino, target_inode)
        self.assertEqual(self.receipt_path.read_bytes(), receipt_before)


if __name__ == "__main__":
    unittest.main()
