"""AAC (M4A) stem output for the native Karaoke room (plan S8 section 7).

A phone decodes two whole stems to play a song, and a WAV or a FLAC stem is
far larger to fetch and to keep than it needs to be. The native app asks for
`output_format: "M4A"`: the model still writes a lossless FLAC, residual
reconciliation still works on it, and only the stems that are kept are then
encoded to AAC in an MP4 container, with the index at the front so a
player can start before the end of the file has arrived.

Needs ffmpeg and ffprobe on the PATH (the worker image installs both) and
nothing else: no GPU, no weights, no numpy.

Run:  python -m pytest runpod/test_m4a_output.py
"""

from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
import sys
import types

import pytest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
    pytest.skip("ffmpeg and ffprobe are needed", allow_module_level=True)


@pytest.fixture(scope="module")
def handler():
    # The RunPod SDK is not installed outside the worker image, and the
    # handler only needs it at __main__ time.
    sys.modules.setdefault("runpod", types.ModuleType("runpod"))
    sys.modules["runpod"].serverless = types.SimpleNamespace(
        start=lambda *a, **k: None
    )
    path = os.path.join(REPO, "runpod", "handler.py")
    spec = importlib.util.spec_from_file_location("_mp_handler_m4a", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _tone(path: str, seconds: float = 3.0) -> None:
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-y",
            "-f", "lavfi", "-i", f"sine=frequency=440:duration={seconds}",
            "-ac", "2", "-ar", "44100",
            path,
        ],
        check=True,
    )


def _probe(path: str) -> dict:
    out = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=format_name,duration:stream=codec_name",
            "-of", "json",
            path,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(out.stdout)


def test_m4a_is_an_output_format_the_handler_takes(handler):
    assert "M4A" in handler._VALID_FORMATS


def test_the_model_still_writes_lossless_for_m4a(handler):
    # Reconciliation reads and rewrites the stems as audio samples, so the
    # model writes FLAC; every other format is written as asked.
    assert handler._separation_format("M4A") == "FLAC"
    for fmt in ("WAV", "MP3", "FLAC"):
        assert handler._separation_format(fmt) == fmt


def test_a_kept_stem_becomes_aac_in_mp4_with_its_name(handler, tmp_path):
    stem = tmp_path / "Long Road North_(Vocals)_model_bs_roformer.flac"
    _tone(str(stem))

    encoded = handler._encode_m4a(str(stem))

    assert encoded == str(tmp_path / "Long Road North_(Vocals)_model_bs_roformer.m4a")
    assert not stem.exists(), "the lossless stem is not kept beside the AAC one"
    probe = _probe(encoded)
    assert [s["codec_name"] for s in probe["streams"]] == ["aac"]
    assert "mp4" in probe["format"]["format_name"]
    assert abs(float(probe["format"]["duration"]) - 3.0) < 0.1
    # The stem marker survives, so the stem is still classified.
    assert handler._classify_stem(os.path.basename(encoded)) == "vocal"


def test_the_index_comes_first(handler, tmp_path):
    stem = tmp_path / "Song_(Instrumental)_x.flac"
    _tone(str(stem))

    encoded = handler._encode_m4a(str(stem))

    with open(encoded, "rb") as fh:
        head = fh.read()
    assert head.find(b"moov") != -1
    assert head.find(b"moov") < head.find(b"mdat")


def test_an_m4a_stem_is_stored_as_audio_mp4(handler):
    assert handler._CONTENT_TYPES[".m4a"] == "audio/mp4"
    assert handler._CONTENT_TYPES[".flac"] == "audio/flac"


def test_a_failed_encode_raises_and_keeps_the_stem(handler, tmp_path):
    stem = tmp_path / "Song_(Vocals)_x.flac"
    stem.write_bytes(b"this is not audio")

    with pytest.raises(RuntimeError):
        handler._encode_m4a(str(stem))
    assert stem.exists()


class _FakeSeparator:
    """Writes two tone stems where the real model would, FLAC as asked."""

    def __init__(self, job_dir: str, output_format: str):
        self.job_dir = job_dir
        self.output_format = output_format

    def separate(self, input_path: str):
        base = os.path.splitext(os.path.basename(input_path))[0]
        written = []
        for marker in ("Vocals", "Instrumental"):
            path = os.path.join(
                self.job_dir,
                f"{base}_({marker})_model_bs_roformer.{self.output_format.lower()}",
            )
            _tone(path, seconds=14.0)
            written.append(path)
        return written


def test_a_job_asking_for_m4a_returns_aac_stems(handler, tmp_path, monkeypatch):
    import base64

    source = tmp_path / "source.mp3"
    _tone(str(source), seconds=14.0)
    asked = []

    def fake_separator(spec, job_dir, output_format, quality):
        asked.append(output_format)
        return _FakeSeparator(job_dir, output_format)

    monkeypatch.setattr(handler, "WORK_DIR", str(tmp_path / "jobs"))
    monkeypatch.setattr(handler, "_get_separator", fake_separator)
    monkeypatch.setattr(handler, "_storage_enabled", lambda: False)

    result = handler.handler(
        {
            "id": "job-m4a",
            "input": {
                "audio_base64": base64.b64encode(source.read_bytes()).decode(),
                "filename": "Long Road North.mp3",
                "output_format": "M4A",
                "declared_duration_seconds": 14,
            },
        }
    )

    assert "error" not in result, result.get("error")
    assert asked == ["FLAC"]
    assert result["output_format"] == "M4A"
    assert sorted((s["stem"], s["filename"]) for s in result["stems"]) == [
        ("instrumental", "Long Road North_(Instrumental)_model_bs_roformer.m4a"),
        ("vocal", "Long Road North_(Vocals)_model_bs_roformer.m4a"),
    ]
    encoded = tmp_path / "check.m4a"
    encoded.write_bytes(base64.b64decode(result["stems"][0]["data_base64"]))
    assert [s["codec_name"] for s in _probe(str(encoded))["streams"]] == ["aac"]
