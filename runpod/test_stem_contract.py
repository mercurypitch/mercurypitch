"""Stem-contract tests for the separation servers — no GPU, no weights.

runpod/handler.py and uvr-api/api.py are deliberate mirrors: the same model
registry, the same stem names, the same output-filename classification. That
only holds if something checks it, so this covers the parts that are pure
logic and easy to get subtly wrong:

  * stem classification, including song titles that collide with stem names
  * the registry's declared stems, and KNOWN_STEMS derived from them
  * residual reconciliation — the kept stems must sum back to the input
    across WAV/FLAC and 16/24-bit/float, without integer wraparound
  * handler.py <-> api.py parity

Run:  python -m pytest runpod/test_stem_contract.py
  or: python runpod/test_stem_contract.py

Needs numpy + soundfile + librosa (already required by both servers).
Skips cleanly when they, or fastapi, are absent.
"""

from __future__ import annotations

import importlib.util
import os
import sys
import types

import pytest

np = pytest.importorskip("numpy")
sf = pytest.importorskip("soundfile")
pytest.importorskip("librosa")

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100

# Song titles that contain a stem word must not beat the parenthesised
# marker audio-separator writes — these are the real-world traps.
CLASSIFY_CASES = [
    ("Song_(Vocals)_htdemucs_6s.flac", "vocal"),
    ("Song_(Drums)_htdemucs_6s.flac", "drums"),
    ("Song_(Bass)_htdemucs_6s.flac", "bass"),
    ("Song_(Guitar)_htdemucs_6s.flac", "guitar"),
    ("Song_(Piano)_htdemucs_6s.flac", "piano"),
    ("Song_(Other)_htdemucs_6s.flac", "other"),
    ("Song_(Instrumental)_bs_roformer.flac", "instrumental"),
    # Karaoke models label music-plus-backing-vocals "(Karaoke)"; for the
    # app's contract that IS the instrumental.
    ("Song_(Karaoke)_mel_band.flac", "instrumental"),
    ("Piano Man_(Drums)_htdemucs.flac", "drums"),
    ("Vocal Coach_(Instrumental)_x.flac", "instrumental"),
    ("Bass Guitar Hero_(Vocals)_x.flac", "vocal"),
    # Second-pass splits feed a FIRST pass's stem back in, so its own marker
    # survives in the base name and audio-separator APPENDS the new one —
    # the LAST marker names the stem. Matching the first classified every
    # split part as 'instrumental' (the 2026-08-01 "split produced no part
    # stems" failure).
    ("Song_(Instrumental)_bs_roformer_(Drums)_htdemucs_6s.flac", "drums"),
    ("Song_(Instrumental)_bs_roformer_(Guitar)_htdemucs_6s.flac", "guitar"),
    ("Song_(Instrumental)_bs_roformer_(Piano)_htdemucs_6s.flac", "piano"),
    ("Empire of the Clouds_(Instrumental)_x_(Other)_htdemucs_6s.wav", "other"),
]


def _load(rel_path: str, name: str):
    path = os.path.join(REPO, rel_path)
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def handler():
    # The RunPod SDK is not installed outside the worker image, and the
    # handler only needs it at __main__ time.
    sys.modules.setdefault("runpod", types.ModuleType("runpod"))
    sys.modules["runpod"].serverless = types.SimpleNamespace(
        start=lambda *a, **k: None
    )
    return _load("runpod/handler.py", "_mp_handler")


@pytest.fixture(scope="module")
def api():
    try:
        import fastapi  # noqa: F401
        import multipart  # noqa: F401
    except ImportError as exc:
        pytest.skip(f"uvr-api deps unavailable: {exc}")
    return _load("uvr-api/api.py", "_mp_api")


def _stereo(mono):
    return np.stack([mono, mono], axis=1)


# ── Classification ───────────────────────────────────────────────


@pytest.mark.parametrize("filename,expected", CLASSIFY_CASES)
def test_handler_classifies_stems(handler, filename, expected):
    assert handler._classify_stem(filename) == expected


@pytest.mark.parametrize("filename,expected", CLASSIFY_CASES)
def test_api_classifies_stems(api, filename, expected):
    assert api._classify_stem(filename) == expected


# ── Registry ─────────────────────────────────────────────────────


def test_registry_declares_stems_for_every_model(handler):
    for key, spec in handler.MODEL_REGISTRY.items():
        assert spec["stems"], f"{key} declares no stems"
        assert spec["files"], f"{key} declares no weight files"


def test_six_stem_model_declares_guitar_and_piano(handler):
    stems = handler.MODEL_REGISTRY["demucs-6s"]["stems"]
    assert {"guitar", "piano", "drums", "bass", "other"} <= set(stems)


def test_known_stems_derives_from_the_registry(handler):
    assert set(handler.KNOWN_STEMS) == {
        s for spec in handler.MODEL_REGISTRY.values() for s in spec["stems"]
    }


def test_every_declared_stem_is_classifiable(handler):
    """A model can't declare a stem the filename parser cannot recognise."""
    for stem in handler.KNOWN_STEMS:
        assert handler._classify_stem(f"Song_({stem})_model.flac") == stem


def test_api_registry_mirrors_handler(api, handler):
    assert api.MODEL_REGISTRY.keys() == handler.MODEL_REGISTRY.keys()
    for key in handler.MODEL_REGISTRY:
        assert api.MODEL_REGISTRY[key]["stems"] == handler.MODEL_REGISTRY[key]["stems"]
        assert api.MODEL_REGISTRY[key]["files"] == handler.MODEL_REGISTRY[key]["files"]
    assert api.KNOWN_STEMS == handler.KNOWN_STEMS


# ── Residual reconciliation ──────────────────────────────────────


@pytest.mark.parametrize(
    "subtype,fmt,ext,tol",
    [
        # Tolerance is the format's quantisation floor, not slack.
        ("PCM_16", "WAV", ".wav", 1e-4),
        ("PCM_24", "WAV", ".wav", 1e-6),
        ("PCM_24", "FLAC", ".flac", 1e-6),
        ("FLOAT", "WAV", ".wav", 1e-6),
    ],
)
def test_reconciled_stems_sum_back_to_the_input(
    handler, tmp_path, subtype, fmt, ext, tol
):
    """The whole point: after reconciliation the kept stems reconstruct the
    input, so muting every part in the mixer silences the whole."""
    t = np.linspace(0, 3, SR * 3, endpoint=False)
    drums = 0.30 * np.sin(2 * np.pi * 110 * t)
    bass = 0.25 * np.sin(2 * np.pi * 55 * t)
    guitar = 0.15 * np.sin(2 * np.pi * 440 * t)
    # Energy the model put in a stem we drop (e.g. the near-silent vocal of
    # a second pass). It must end up in the residual, not vanish.
    stray = 0.20 * np.sin(2 * np.pi * 880 * t)
    mix = drums + bass + guitar + stray

    mix_path = str(tmp_path / f"mix{ext}")
    sf.write(mix_path, _stereo(mix), SR, subtype=subtype, format=fmt)

    paths = {}
    for name, wave in (
        ("drums", drums),
        ("bass", bass),
        ("guitar", guitar),
        ("other", np.zeros_like(mix)),  # as produced: missing `stray`
    ):
        p = str(tmp_path / f"{name}{ext}")
        sf.write(p, _stereo(wave), SR, subtype=subtype, format=fmt)
        paths[name] = p

    def stem_sum():
        return sum(sf.read(p, always_2d=True)[0] for p in paths.values())

    assert np.abs(stem_sum() - _stereo(mix)).max() > 0.1, "fixture must start broken"

    assert handler._reconcile_residual(mix_path, paths, "other") is True

    assert np.abs(stem_sum() - _stereo(mix)).max() < tol


def test_reconciliation_clips_instead_of_wrapping(handler, tmp_path):
    """Subtraction can push past full scale; an integer subtype would wrap a
    sample to the opposite rail, which is audible as a click."""
    t = np.linspace(0, 1, SR, endpoint=False)
    loud = 0.9 * np.sin(2 * np.pi * 100 * t)

    mix_path = str(tmp_path / "mix.wav")
    drums_path = str(tmp_path / "drums.wav")
    other_path = str(tmp_path / "other.wav")
    sf.write(mix_path, _stereo(loud), SR, subtype="PCM_16")
    sf.write(drums_path, _stereo(-0.9 * loud), SR, subtype="PCM_16")
    sf.write(other_path, _stereo(np.zeros_like(loud)), SR, subtype="PCM_16")

    handler._reconcile_residual(
        mix_path, {"drums": drums_path, "other": other_path}, "other"
    )

    residual = sf.read(other_path, always_2d=True)[0]
    assert np.abs(residual).max() <= 1.0
    assert residual.max() > 0.99, "expected the residual to ride the rail"


def test_reconciliation_matches_mono_input_to_stereo_stems(handler, tmp_path):
    """A mono source against stereo stems must not blow up on the shapes."""
    t = np.linspace(0, 1, SR, endpoint=False)
    loud = 0.9 * np.sin(2 * np.pi * 100 * t)

    mix_path = str(tmp_path / "mix.wav")
    drums_path = str(tmp_path / "drums.wav")
    other_path = str(tmp_path / "other.wav")
    sf.write(mix_path, loud, SR, subtype="PCM_24")  # mono
    sf.write(drums_path, _stereo(0.4 * loud), SR, subtype="PCM_24")
    sf.write(other_path, _stereo(np.zeros_like(loud)), SR, subtype="PCM_24")

    handler._reconcile_residual(
        mix_path, {"drums": drums_path, "other": other_path}, "other"
    )

    other = sf.read(other_path, always_2d=True)[0]
    drums = sf.read(drums_path, always_2d=True)[0]
    assert other.shape[1] == 2
    assert np.abs((other + drums) - _stereo(loud)).max() < 1e-6


# ── audio_s3_key allowlist ───────────────────────────────────────


def test_s3_key_allowlist_accepts_staged_inputs_and_own_stems(handler):
    ok = handler._is_allowed_s3_key
    assert ok("input/abc-123.mp3")
    prefix = handler.S3_KEY_PREFIX
    assert ok(f"{prefix}/job-1/Song_(Instrumental)_model.wav")
    # Real stem names carry spaces — the 2026-07-31 reuse failure.
    assert ok(f"{prefix}/job-1/Empire of the Clouds_(Instrumental)_model.wav")


def test_s3_key_allowlist_rejects_everything_else(handler):
    ok = handler._is_allowed_s3_key
    prefix = handler.S3_KEY_PREFIX
    assert not ok("some-other-prefix/job/file.wav")
    assert not ok(f"{prefix}-evil/job/file.wav")
    assert not ok(f"{prefix}/../secrets.txt")
    assert not ok("input/../../etc/passwd")
    assert not ok("input/has space.mp3")  # staged inputs stay strict
    assert not ok(f"{prefix}/job/back\\slash.wav")


# ── Long-song billing blocks (mirror of billing-core.ts uvrLengthFactor) ──


def test_billing_blocks_base_window(handler):
    assert handler._billing_blocks(0) == 1
    assert handler._billing_blocks(-5) == 1
    assert handler._billing_blocks(3.5 * 60) == 1
    assert handler._billing_blocks(handler.BILLING_BASE_MINUTES * 60) == 1


def test_billing_blocks_started_blocks(handler):
    base = handler.BILLING_BASE_MINUTES * 60
    block = handler.BILLING_BLOCK_MINUTES * 60
    assert handler._billing_blocks(base + 1) == 2
    assert handler._billing_blocks(base + block) == 2
    assert handler._billing_blocks(base + block + 1) == 3
    assert handler._billing_blocks(base + 3 * block) == 4


def test_billing_constants_match_worker_defaults(handler):
    # billing-core.ts: UVR_BASE_MINUTES = 12, UVR_SURCHARGE_BLOCK_MINUTES = 6.
    # The worker debits on these numbers; the handler must reject on the
    # SAME block boundaries or honest jobs get refused / cheap jobs slip by.
    assert handler.BILLING_BASE_MINUTES == 12
    assert handler.BILLING_BLOCK_MINUTES == 6


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
