#!/usr/bin/env python3
"""Network-free regressions for receipt-safe V5 artifact downloads."""

from __future__ import annotations

from io import BytesIO
import importlib.util
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest import mock

from PIL import Image


sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location(
    "run_meshy71_ultra4k_audition", HERE / "run_meshy71_ultra4k_audition.py"
)
assert SPEC is not None and SPEC.loader is not None
producer = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = producer
SPEC.loader.exec_module(producer)


ARTIFACT_URL = "https://assets.meshy.ai/test-artifact"


class FakeResponse:
    def __init__(self, body: bytes, declared_bytes: int, content_type: str) -> None:
        self.stream = BytesIO(body)
        self.headers = {
            "Content-Length": str(declared_bytes),
            "Content-Type": content_type,
        }
        self.status = 200

    def __enter__(self) -> FakeResponse:
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def geturl(self) -> str:
        return ARTIFACT_URL

    def read(self, size: int) -> bytes:
        return self.stream.read(size)


def minimal_glb() -> bytes:
    document = json.dumps(
        {"asset": {"version": "2.0"}, "scene": 0, "scenes": [{}]},
        separators=(",", ":"),
    ).encode()
    document += b" " * (-len(document) % 4)
    length = 12 + 8 + len(document)
    return (
        struct.pack("<4sII", b"glTF", 2, length)
        + struct.pack("<II", len(document), 0x4E4F534A)
        + document
    )


def png_bytes() -> bytes:
    output = BytesIO()
    Image.new("RGB", (4, 4), (100, 150, 200)).save(output, format="PNG")
    return output.getvalue()


class DownloadRegressionTest(unittest.TestCase):
    def test_truncated_glb_is_rejected_then_complete_glb_is_promoted(self) -> None:
        complete = minimal_glb()
        truncated = complete[:24]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "archive" / "dense-donor.glb"
            rejected = root / "archive" / "rejected-downloads"
            responses = [
                FakeResponse(truncated, len(complete), "application/octet-stream"),
                FakeResponse(complete, len(complete), "application/octet-stream"),
            ]
            with (
                mock.patch.object(producer, "REPO", root),
                mock.patch.object(
                    producer.urllib.request, "urlopen", side_effect=responses
                ) as urlopen,
            ):
                failures = producer.download(
                    ARTIFACT_URL,
                    target,
                    1024 * 1024,
                    producer.validate_glb,
                    rejected,
                    "dense-donor",
                )

            self.assertEqual(target.read_bytes(), complete)
            self.assertEqual(urlopen.call_count, 2)
            self.assertEqual(len(failures), 1)
            self.assertEqual(failures[0]["reasonCode"], "content-length-mismatch")
            self.assertEqual(failures[0]["expectedBytes"], len(complete))
            self.assertEqual(failures[0]["receivedBytes"], len(truncated))
            self.assertNotIn(ARTIFACT_URL, json.dumps(failures[0]))

    def test_three_truncated_glb_attempts_stop_without_promotion(self) -> None:
        complete = minimal_glb()
        truncated = complete[:24]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "archive" / "dense-donor.glb"
            rejected = root / "archive" / "rejected-downloads"
            responses = [
                FakeResponse(truncated, len(complete), "application/octet-stream")
                for _ in range(producer.MAX_DOWNLOAD_ATTEMPTS)
            ]
            with (
                mock.patch.object(producer, "REPO", root),
                mock.patch.object(
                    producer.urllib.request, "urlopen", side_effect=responses
                ) as urlopen,
                self.assertRaisesRegex(RuntimeError, "after 3 attempts"),
            ):
                producer.download(
                    ARTIFACT_URL,
                    target,
                    1024 * 1024,
                    producer.validate_glb,
                    rejected,
                    "dense-donor",
                )

            self.assertFalse(target.exists())
            self.assertEqual(urlopen.call_count, producer.MAX_DOWNLOAD_ATTEMPTS)
            self.assertEqual(len(list(rejected.glob("*.json"))), 3)

    def test_complete_length_invalid_glb_retries_format_validation(self) -> None:
        complete = minimal_glb()
        invalid = b"bad!" + complete[4:]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "archive" / "dense-donor.glb"
            rejected = root / "archive" / "rejected-downloads"
            responses = [
                FakeResponse(invalid, len(invalid), "application/octet-stream"),
                FakeResponse(complete, len(complete), "application/octet-stream"),
            ]
            with (
                mock.patch.object(producer, "REPO", root),
                mock.patch.object(
                    producer.urllib.request, "urlopen", side_effect=responses
                ),
            ):
                failures = producer.download(
                    ARTIFACT_URL,
                    target,
                    1024 * 1024,
                    producer.validate_glb,
                    rejected,
                    "dense-donor",
                )

            self.assertEqual(target.read_bytes(), complete)
            self.assertEqual(failures[0]["reasonCode"], "format-validation-failed")

    def test_invalid_normal_map_is_rejected_before_promotion(self) -> None:
        complete = png_bytes()
        invalid = b"not-an-image".ljust(len(complete), b"\0")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "archive" / "textures" / "set-0-normal.png"
            rejected = root / "archive" / "rejected-downloads"
            responses = [
                FakeResponse(invalid, len(invalid), "image/png"),
                FakeResponse(complete, len(complete), "image/png"),
            ]
            with (
                mock.patch.object(producer, "REPO", root),
                mock.patch.object(
                    producer.urllib.request, "urlopen", side_effect=responses
                ),
            ):
                producer.download(
                    ARTIFACT_URL,
                    target,
                    1024 * 1024,
                    producer.validate_image,
                    rejected,
                    "set-0-normal",
                )

            producer.validate_image(target)
            self.assertEqual(target.read_bytes(), complete)

    def test_resume_quarantines_same_task_invalid_model_then_redownloads(self) -> None:
        complete = minimal_glb()
        truncated = complete[:24]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with (
                mock.patch.object(producer, "REPO", root),
                mock.patch.object(producer, "V5", root / "v5"),
            ):
                asset = producer.Asset(
                    name="frost",
                    asset_id="test-frost",
                    guide=root / "guide.png",
                    guide_bytes=0,
                    guide_sha256="unused",
                    guide_dimensions=(1, 1),
                    authority_receipt=root / "authority.json",
                    authority_receipt_sha256="unused",
                    texture_prompt="test",
                )
                asset.archive.mkdir(parents=True)
                asset.model.write_bytes(truncated)
                receipt = {
                    "taskId": "task-1",
                    "state": "succeeded",
                    "archiveDownloadTaskId": "task-1",
                    "balanceBefore": 35,
                }
                producer.atomic_json(asset.receipt, receipt)
                task = {
                    "id": "task-1",
                    "status": "SUCCEEDED",
                    "model_urls": {"glb": ARTIFACT_URL},
                    "texture_urls": [],
                    "ai_model": "meshy-7.1",
                    "geometry_resolution": "4k",
                }
                request = {"ai_model": "meshy-7.1", "geometry_resolution": "4k"}
                with (
                    mock.patch.object(
                        producer.urllib.request,
                        "urlopen",
                        return_value=FakeResponse(
                            complete, len(complete), "application/octet-stream"
                        ),
                    ) as urlopen,
                    mock.patch.object(producer, "read_balance", return_value=0),
                ):
                    archived = producer.archive_outputs(
                        asset, receipt, task, request, "unused-key"
                    )

                self.assertEqual(urlopen.call_count, 1)
                self.assertEqual(asset.model.read_bytes(), complete)
                self.assertEqual(archived["state"], "archived")
                rejected_models = list(
                    (asset.archive / "rejected-downloads").glob(
                        "dense-donor-existing-*.glb"
                    )
                )
                self.assertEqual(len(rejected_models), 1)
                self.assertEqual(rejected_models[0].read_bytes(), truncated)
                self.assertEqual(len(archived["rejectedDownloads"]), 1)
                self.assertTrue(archived["rejectedDownloads"][0]["bytesPersisted"])

    def test_existing_task_id_cannot_be_submitted_again(self) -> None:
        asset = mock.Mock()
        with (
            mock.patch.object(producer, "reconcile_provider") as reconcile,
            self.assertRaisesRegex(RuntimeError, "use --resume"),
        ):
            producer.submit(
                asset,
                {"taskId": "task-1", "state": "succeeded"},
                {},
                "unused-key",
            )
        reconcile.assert_not_called()


if __name__ == "__main__":
    unittest.main()
