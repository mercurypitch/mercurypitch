"""The separation worker's `audio_url` allowlist -- no GPU, no audio stack.

The app's worker never sends `audio_url` (uploads travel as inline base64 or
an R2 key), so a URL input only ever means somebody is asking THIS GPU worker
to fetch a host of their choosing (SSRF). `_materialize_input` refuses it
unless an operator has explicitly allowlisted the host in
RUNPOD_AUDIO_URL_ALLOWED_HOSTS and the scheme is https. These pin that the
default is "refused, before any network call", and that an allowlisted https
host is fetched and written.

Run:  python -m pytest runpod/test_url_guard.py
"""

from __future__ import annotations

import importlib.util
import os
import sys
import types

import pytest
import requests

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ALLOWLIST_VAR = "RUNPOD_AUDIO_URL_ALLOWED_HOSTS"


@pytest.fixture(scope="module")
def handler():
    # The RunPod SDK is not installed outside the worker image, and the
    # handler only needs it at __main__ time.
    sys.modules.setdefault("runpod", types.ModuleType("runpod"))
    sys.modules["runpod"].serverless = types.SimpleNamespace(
        start=lambda *a, **k: None
    )
    path = os.path.join(REPO, "runpod", "handler.py")
    spec = importlib.util.spec_from_file_location("_mp_handler_url_guard", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _FakeResponse:
    """What `requests.get(..., stream=True)` hands back, as a context manager."""

    def __init__(self, chunks):
        self._chunks = chunks

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def raise_for_status(self):
        return None

    def iter_content(self, chunk_size):
        yield from self._chunks


@pytest.fixture
def fake_get(monkeypatch):
    """A `requests.get` that records its calls and never touches the network."""
    calls = []

    def fake(url, *args, **kwargs):
        calls.append(url)
        return _FakeResponse([b"RIFF", b"fake", b"-audio"])

    monkeypatch.setattr(requests, "get", fake)
    return calls


def _materialize(handler, url, job_dir):
    return handler._materialize_input({"audio_url": url, "filename": "song.mp3"}, job_dir)


def _written(tmp_path):
    return sorted(p.name for p in tmp_path.iterdir())


def test_refused_by_default_with_no_allowlist(handler, monkeypatch, fake_get, tmp_path):
    monkeypatch.delenv(ALLOWLIST_VAR, raising=False)

    with pytest.raises(ValueError, match="audio_url is not permitted"):
        _materialize(handler, "https://cdn.example.com/a.mp3", str(tmp_path))

    assert fake_get == []
    assert _written(tmp_path) == []


def test_refused_when_host_is_not_allowlisted(handler, monkeypatch, fake_get, tmp_path):
    monkeypatch.setenv(ALLOWLIST_VAR, "cdn.example.com")

    with pytest.raises(ValueError, match="audio_url is not permitted"):
        _materialize(handler, "https://evil.example.com/a.mp3", str(tmp_path))

    assert fake_get == []
    assert _written(tmp_path) == []


def test_refused_when_scheme_is_not_https(handler, monkeypatch, fake_get, tmp_path):
    monkeypatch.setenv(ALLOWLIST_VAR, "cdn.example.com")

    with pytest.raises(ValueError, match="audio_url is not permitted"):
        _materialize(handler, "http://cdn.example.com/a.mp3", str(tmp_path))

    assert fake_get == []
    assert _written(tmp_path) == []


def test_allowlisted_https_host_is_fetched_and_written(
    handler, monkeypatch, fake_get, tmp_path
):
    # Spaces around entries and a differently-cased host must both be fine:
    # the allowlist is trimmed and compared case-insensitively.
    monkeypatch.setenv(ALLOWLIST_VAR, " cdn.example.com , other.example ")
    url = "https://CDN.Example.com/a.mp3"

    path = _materialize(handler, url, str(tmp_path))

    assert fake_get == [url]
    assert os.path.dirname(path) == str(tmp_path)
    assert os.path.exists(path)
    with open(path, "rb") as fh:
        assert fh.read() == b"RIFFfake-audio"


def test_missing_or_empty_audio_url_falls_through(handler, monkeypatch, fake_get, tmp_path):
    monkeypatch.setenv(ALLOWLIST_VAR, "cdn.example.com")

    for job_input in (
        {"audio_url": "", "filename": "song.mp3"},
        {"filename": "song.mp3"},
    ):
        with pytest.raises(
            ValueError, match="Job input requires 'audio_base64' or 'audio_s3_key'"
        ):
            handler._materialize_input(job_input, str(tmp_path))

    assert fake_get == []
    assert _written(tmp_path) == []
