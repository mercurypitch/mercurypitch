#!/usr/bin/env python3
"""Network-free regressions for Cloudway paid-job receipts and archive evidence."""

from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import threading
import time
from types import SimpleNamespace
import unittest

from PIL import Image


sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
SCRIPT = HERE / "produce.py"


def load_producer(name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def png(path: Path, size: tuple[int, int] = (16, 16)) -> bytes:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", size, (120, 170, 210)).save(path, format="PNG")
    return path.read_bytes()


class FakeMeshy:
    def __init__(self) -> None:
        self.posts = 0
        self.gets: list[str] = []
        self.task: dict[str, object] | None = None
        self._lock = threading.Lock()

    def api_json(self, method, url, _key, body=None):
        if method == "POST":
            with self._lock:
                self.posts += 1
                task_id = f"task-{self.posts}"
            self.assert_max_request(body)
            time.sleep(0.05)
            return {"result": task_id}
        if method == "GET":
            self.gets.append(url)
            if self.task is None:
                raise AssertionError("GET task fixture is absent")
            return self.task
        raise AssertionError((method, url))

    @staticmethod
    def assert_max_request(body):
        assert body["ai_model"] == "meshy-7.1"
        assert body["geometry_resolution"] == "4k"
        assert body["texture_resolution"] == "8k"
        assert body["enable_pbr"] is True
        assert body["should_remesh"] is False
        assert body["image_url"].startswith("data:image/png;base64,")


class ProductionFixture:
    def __init__(self, root: Path, module_name: str, fake: FakeMeshy) -> None:
        self.root = root
        self.source = root / "shared-source"
        self.kit = root / module_name
        self.guide = self.source / "references/test-platform.png"
        contents = png(self.guide)
        self.asset = {
            "id": "test-platform",
            "reference": "references/test-platform.png",
            "referenceSha256": hashlib.sha256(contents).hexdigest(),
            "texturePrompt": "Ivory stone and clear glass, clean PBR materials.",
        }
        self.producer = load_producer(module_name)
        self.producer.SOURCE = self.source.resolve()
        self.producer.KIT = self.kit
        original_backend = self.producer.backend

        def backend():
            module = original_backend()
            module.api_key = lambda: "offline-test-key"
            module.api_json = fake.api_json
            module.read_balance = lambda _key: 1_000
            return module

        self.producer.backend = backend

    @property
    def authority(self) -> Path:
        return self.source / "meshy/test-platform/receipt.json"

    @property
    def mirror(self) -> Path:
        return self.kit / "meshy/test-platform/receipt.json"


class ReceiptSafetyTest(unittest.TestCase):
    def test_shared_lock_allows_only_one_paid_post_across_worktrees(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fake = FakeMeshy()
            first = ProductionFixture(root, "worktree_one", fake)
            second = ProductionFixture(root, "worktree_two", fake)
            first.producer.run_asset("prepare", first.asset)

            start = threading.Barrier(2)
            failures: list[Exception] = []

            def submit(fixture: ProductionFixture) -> None:
                try:
                    start.wait()
                    fixture.producer.run_asset("submit", fixture.asset)
                except Exception as exc:  # expected for the serialized duplicate
                    failures.append(exc)

            workers = [
                threading.Thread(target=submit, args=(first,)),
                threading.Thread(target=submit, args=(second,)),
            ]
            for worker in workers:
                worker.start()
            for worker in workers:
                worker.join(timeout=5)

            self.assertTrue(all(not worker.is_alive() for worker in workers))
            self.assertEqual(fake.posts, 1)
            self.assertEqual(len(failures), 1)
            self.assertRegex(
                str(failures[0]),
                "already has a task ID|not safely submit-ready",
            )
            authority = json.loads(first.authority.read_text())
            self.assertEqual(authority["state"], "submitted")
            self.assertEqual(authority["taskId"], "task-1")
            self.assertEqual(json.loads(first.mirror.read_text()), authority)
            self.assertEqual(json.loads(second.mirror.read_text()), authority)
            self.assertIn("conversation", authority["authorization"]["source"])
            self.assertNotIn("requiredFlags", authority["authorization"])

    def test_pristine_git_receipt_migrates_to_shared_authority(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            fake = FakeMeshy()
            fixture = ProductionFixture(Path(directory), "migration", fake)
            fixture.producer.run_asset("prepare", fixture.asset)
            mirror_before = fixture.mirror.read_bytes()
            fixture.authority.unlink()

            fixture.producer.run_asset("prepare", fixture.asset)

            self.assertEqual(fixture.authority.read_bytes(), mirror_before)
            self.assertEqual(fake.posts, 0)

    def test_source_drift_after_configuration_stops_before_post(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            fake = FakeMeshy()
            fixture = ProductionFixture(Path(directory), "source_drift", fake)
            with fixture.producer.asset_lock(fixture.asset):
                module, receipt = fixture.producer.configure(fixture.asset)
                png(fixture.guide, (17, 16))
                with self.assertRaisesRegex(RuntimeError, "changed after receipt"):
                    fixture.producer.submit_receipt(
                        module, receipt, "offline-test-key"
                    )
            self.assertEqual(fake.posts, 0)
            self.assertEqual(json.loads(fixture.authority.read_text())["state"], "not-submitted")


class ResumeAndQualityTest(unittest.TestCase):
    def _submitted_fixture(self, root: Path, fake: FakeMeshy):
        fixture = ProductionFixture(root, "resume_fixture", fake)
        fixture.producer.run_asset("prepare", fixture.asset)
        receipt = json.loads(fixture.authority.read_text())
        receipt.update({"state": "submitted", "taskId": "opaque/id ?"})
        fixture.producer.durable_json(fixture.authority, receipt)
        fixture.producer.durable_json(fixture.mirror, receipt)
        return fixture

    @staticmethod
    def _archive_backend(fixture: ProductionFixture, texture_size: list[int]):
        original_backend = fixture.producer.backend

        def backend():
            module = original_backend()

            def download(_url, target, _maximum):
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.suffix == ".glb":
                    target.write_bytes(b"offline-glb")
                else:
                    png(target, (16, 16))

            def glb_report(path):
                return {
                    "file": module.relative(path),
                    "bytes": path.stat().st_size,
                    "sha256": module.digest(path),
                    "meshes": 1,
                    "triangles": 12,
                }

            def image_report(path, role, set_index):
                dimensions = [16, 16] if role == "preview" else texture_size
                return {
                    "role": role,
                    "setIndex": set_index,
                    "file": module.relative(path),
                    "bytes": path.stat().st_size,
                    "sha256": module.digest(path),
                    "format": "PNG",
                    "dimensions": dimensions,
                    "mode": "RGB",
                }

            module.download = download
            module.glb_report = glb_report
            module.image_report = image_report
            return module

        fixture.producer.backend = backend

    def test_resume_archives_but_marks_missing_quality_evidence_for_review(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            fake = FakeMeshy()
            fixture = self._submitted_fixture(Path(directory), fake)
            self._archive_backend(fixture, [4096, 4096])
            fake.task = {
                "id": "opaque/id ?",
                "status": "SUCCEEDED",
                "model_urls": {"glb": "https://assets.meshy.ai/model.glb"},
                "texture_urls": [
                    {
                        role: f"https://assets.meshy.ai/{role}.png"
                        for role in ("base_color", "normal", "metallic", "roughness")
                    }
                ],
                "thumbnail_url": "https://assets.meshy.ai/preview.png",
            }

            receipt = fixture.producer.run_asset("resume", fixture.asset)

            self.assertEqual(receipt["state"], "archived")
            self.assertEqual(receipt["providerQuality"]["status"], "needs-review")
            self.assertIn(
                "Provider did not confirm requested 4K geometry.",
                receipt["providerQuality"]["issues"],
            )
            self.assertIn(
                "At least one base-color texture is not 8192 x 8192.",
                receipt["providerQuality"]["issues"],
            )
            preview = receipt["archiveDownload"]["preview"]
            self.assertEqual(
                preview["sha256"],
                hashlib.sha256((fixture.source / "meshy/test-platform/preview.png").read_bytes()).hexdigest(),
            )
            self.assertTrue(fake.gets[0].endswith("opaque%2Fid%20%3F"))
            mirror_text = fixture.mirror.read_text()
            self.assertNotIn("https://assets.meshy.ai/model.glb", mirror_text)
            self.assertNotIn("thumbnail_url", mirror_text)

    def test_archived_resume_repairs_and_hashes_missing_preview(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            fake = FakeMeshy()
            fixture = self._submitted_fixture(Path(directory), fake)
            self._archive_backend(fixture, [8192, 8192])
            receipt = json.loads(fixture.authority.read_text())
            receipt.update(
                {
                    "state": "archived",
                    "archiveDownload": {
                        "model": {"meshes": 1, "triangles": 12},
                        "textures": [
                            {
                                "role": role,
                                "setIndex": 0,
                                "dimensions": [8192, 8192],
                            }
                            for role in ("base_color", "normal", "metallic", "roughness")
                        ],
                    },
                    "providerQuality": {"status": "confirmed", "issues": []},
                }
            )
            fixture.producer.durable_json(fixture.authority, receipt)
            fixture.producer.durable_json(fixture.mirror, receipt)
            fake.task = {
                "id": "opaque/id ?",
                "status": "SUCCEEDED",
                "thumbnail_url": "https://assets.meshy.ai/preview.png",
                "ai_model": "meshy-7.1",
                "geometry_resolution": "4k",
            }

            repaired = fixture.producer.run_asset("resume", fixture.asset)

            self.assertIn("sha256", repaired["archiveDownload"]["preview"])
            self.assertEqual(len(fake.gets), 1)

    def test_complete_provider_evidence_is_confirmed(self) -> None:
        producer = load_producer("quality_direct")
        receipt = {
            "request": {
                "ai_model": "meshy-7.1",
                "geometry_resolution": "4k",
                "texture_resolution": "8k",
                "enable_pbr": True,
                "should_remesh": False,
            },
            "archiveDownload": {
                "model": {"meshes": 1, "triangles": 42},
                "textures": [
                    {
                        "role": role,
                        "setIndex": 0,
                        "dimensions": [8192, 8192],
                    }
                    for role in ("base_color", "normal", "metallic", "roughness")
                ],
            },
        }
        task = {"ai_model": "meshy-7.1", "geometry_resolution": "4k"}

        report = producer.provider_quality(SimpleNamespace(), receipt, task)

        self.assertEqual(report["status"], "confirmed")
        self.assertEqual(report["issues"], [])

    def test_missing_maps_in_a_second_texture_set_need_review(self) -> None:
        producer = load_producer("quality_per_set")
        receipt = {
            "request": {
                "ai_model": "meshy-7.1",
                "geometry_resolution": "4k",
                "texture_resolution": "8k",
                "enable_pbr": True,
                "should_remesh": False,
            },
            "archiveDownload": {
                "model": {"meshes": 1, "triangles": 42},
                "textures": [
                    {
                        "role": role,
                        "setIndex": 0,
                        "dimensions": [8192, 8192],
                    }
                    for role in ("base_color", "normal", "metallic", "roughness")
                ],
                "missingRequestedPbrMapsBySet": [
                    {"setIndex": 1, "roles": ["normal", "roughness"]}
                ],
            },
        }
        task = {"ai_model": "meshy-7.1", "geometry_resolution": "4k"}

        report = producer.provider_quality(SimpleNamespace(), receipt, task)

        self.assertEqual(report["status"], "needs-review")
        self.assertIn(
            "Texture set 1 omitted requested PBR maps.", report["issues"]
        )

    def test_task_identity_mismatch_is_rejected(self) -> None:
        producer = load_producer("task_identity")
        seen = []
        module = SimpleNamespace(
            TASK_ENDPOINT="https://api.meshy.ai/openapi/v1/image-to-3d",
            api_json=lambda method, url, key: seen.append(url) or {"id": "other"},
        )
        with self.assertRaisesRegex(RuntimeError, "did not match"):
            producer.retrieve_task(module, "opaque/id ?", "offline-key")
        self.assertTrue(seen[0].endswith("opaque%2Fid%20%3F"))


if __name__ == "__main__":
    unittest.main()
