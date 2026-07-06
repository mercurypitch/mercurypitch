# ============================================================
# MercuryPitch — RunPod Serverless Vocal Separation Handler
# ============================================================
# Server-side stem separation on RunPod serverless GPUs
# (scale-to-zero). This is the "fast / quality" separation path:
# a mid-tier GPU separates a ~5 min song in ~2-3 min, billed per
# second, with no idle cost when no jobs are queued.
#
# Job contract (RunPod `input` object):
#   {
#     "audio_url":     "<https url the worker fetches>",   # preferred
#     "audio_base64":  "<base64 audio>",                   # fallback (small files)
#     "filename":      "song.mp3",
#     "model":         "roformer",                         # optional registry name
#     "output_format": "FLAC",                             # WAV | MP3 | FLAC
#     "stems":         ["vocal", "instrumental"]           # optional
#   }
#
# `model` is a REGISTRY name (roformer | mdx | karaoke | ensemble), not a
# raw weights filename — see MODEL_REGISTRY below.
#
# Returns:
#   {
#     "stems": [
#       {"stem": "vocal", "filename": "...", "url": "...",        # when S3/R2 is configured
#        "size": 1234, "duration": 201.3},
#       {"stem": "instrumental", "filename": "...", "data_base64": "..."}  # otherwise
#     ],
#     "model": "...", "output_format": "FLAC", "device": "cuda",
#     "timings": {"download": .., "load_model": .., "separate": .., "upload": .., "total": ..},
#     "cost": {"gpu_usd_per_hr": 0.69, "billed_secs": 162.0, "usd": 0.031}
#   }
#
# The `timings` + `cost` block exists so cost-per-song can be measured
# for real from day one (run test_input.json locally, or inspect a
# deployed job's output), per the go-to-market plan.
# ============================================================
from __future__ import annotations

import base64
import glob
import logging
import os
import re
import time
import uuid
from typing import Any, Optional

import runpod

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("runpod-uvr")

# audio-separator's Separator.separate() swallows per-file exceptions
# (logs "Failed to process file ...", returns []) — a real separation crash
# then surfaces to us only as "no output stems". Capture the library's ERROR
# records so the job error can carry the underlying cause.
_lib_errors: list[str] = []


class _LibErrorCapture(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            _lib_errors.append(record.getMessage())
            del _lib_errors[:-3]
        except Exception:
            pass


_lib_capture = _LibErrorCapture(level=logging.ERROR)
logging.getLogger("audio_separator").addHandler(_lib_capture)

# ── Configuration (env) ─────────────────────────────────────────
# Where audio-separator caches its ONNX/torch model weights. Bake the
# default model into the image at this path (see Dockerfile) so a cold
# worker does not re-download it — cold-start download is the one real
# cost leak on serverless.
MODEL_DIR = os.getenv("UVR_MODEL_DIR", "/models")
WORK_DIR = os.getenv("UVR_WORK_DIR", "/tmp/uvr-jobs")
DEFAULT_MODEL = os.getenv("UVR_DEFAULT_MODEL", "roformer")

# ── Model registry ──────────────────────────────────────────────
# Quality tiers a job may request, resolved server-side to exact weight
# files. This doubles as the ALLOWLIST: anything not listed is rejected,
# so a job can't make the worker download arbitrary weights on billable
# time. Every file here must be baked into the image (see Dockerfile) —
# keep the two in sync or a cold worker re-downloads at job time.
#
#   roformer  BS-RoFormer viperx 1297 — vocals SDR 12.9 vs ~10 for MDX.
#             The default; ~2-4x slower than MDX on GPU, audibly cleaner.
#   mdx       UVR-MDX-NET Inst HQ_3 — the previous default; fast tier.
#   karaoke   Mel-Band RoFormer karaoke — removes only the LEAD vocal;
#             backing vocals stay in the instrumental (karaoke-correct).
#   ensemble  BS-RoFormer + Mel-Band RoFormer Kim averaged per stem
#             (avg_wave) — max quality, roughly 2x the time of roformer;
#             ensemble members reload per job (audio-separator design).
MODEL_REGISTRY: dict[str, dict[str, Any]] = {
    "roformer": {"files": ["model_bs_roformer_ep_317_sdr_12.9755.ckpt"]},
    "mdx": {"files": ["UVR-MDX-NET-Inst_HQ_3.onnx"]},
    "karaoke": {
        "files": ["mel_band_roformer_karaoke_aufr33_viperx_sdr_10.1956.ckpt"]
    },
    "ensemble": {
        "files": [
            "model_bs_roformer_ep_317_sdr_12.9755.ckpt",
            "vocals_mel_band_roformer.ckpt",
        ],
        "algorithm": "avg_wave",
    },
}

# Older app clients send the MDX weights filename as the model — keep them
# working by mapping the legacy names onto the registry.
_MODEL_ALIASES = {
    "UVR-MDX-NET-Inst_HQ_3": "mdx",
    "UVR-MDX-NET-Inst_HQ_3.onnx": "mdx",
}


def resolve_model(name: str) -> Optional[tuple[str, dict[str, Any]]]:
    """Map a requested model name to (registry key, spec), or None."""
    key = _MODEL_ALIASES.get(name, name).lower()
    spec = MODEL_REGISTRY.get(key)
    return (key, spec) if spec is not None else None

# Load the default model once at worker startup (before serving requests)
# rather than lazily on the first job. RunPod bills per second from the moment
# a worker starts, so model-load time is billable either way — but loading at
# startup lets FlashBoot snapshot the warmed worker, so later cold starts
# restore the in-memory model in ~2s instead of reloading it. Set to "0" to
# defer loading to the first request instead.
EAGER_LOAD = os.getenv("UVR_EAGER_LOAD", "1") != "0"

# Per-second GPU price used to turn measured runtime into a cost figure.
# Defaults to an RTX-4090-class Secure-cloud rate; override per pod.
GPU_USD_PER_HR = float(os.getenv("RUNPOD_GPU_USD_PER_HR", "0.69"))

# Hard cap on decoded input size (matches the FastAPI api.py guard).
MAX_INPUT_BYTES = int(os.getenv("UVR_MAX_INPUT_BYTES", str(100 * 1024 * 1024)))

# Hard cap on input DURATION. Cost scales with song length, not file size,
# so this is the real spend guard: a small low-bitrate file can still be a
# very long (expensive) song. Reject before the expensive separation — the
# job then errors cheaply (download + probe only) and the worker auto-refunds
# the credit. 0 disables the cap.
MAX_INPUT_MINUTES = float(os.getenv("UVR_MAX_INPUT_MINUTES", "12"))

# Minimum input duration. RoFormer models process ~11 s windows; a shorter
# input yields zero chunks in audio-separator 0.44.2 and dies mid-separation
# with an opaque tensor-size error ("size of tensor a (0) must match ...").
# Reject up front with a readable message instead. 0 disables the check.
MIN_INPUT_SECONDS = float(os.getenv("UVR_MIN_INPUT_SECONDS", "12"))

# ── Separation quality knobs ────────────────────────────────────
# Env sets the endpoint default; each job may override via `input`
# (invert_using_spec / mdx_overlap / mdx_denoise / mdx_segment_size) for
# A/B testing without an endpoint change.
#
# invert_using_spec is ON by default: the vocal stem of an instrumental
# model (Inst_HQ_3 predicts the instrumental; vocal = mix - prediction)
# is derived by SPECTROGRAM-domain inversion instead of time-domain
# subtraction. Time-domain subtraction leaves phase-misalignment bleed —
# instrumental audibly leaking into the vocal stem, varying by song —
# which the in-browser separator already avoids the same way.
INVERT_USING_SPEC = os.getenv("UVR_INVERT_USING_SPEC", "1") != "0"
MDX_OVERLAP = float(os.getenv("UVR_MDX_OVERLAP", "0.25"))
MDX_DENOISE = os.getenv("UVR_MDX_DENOISE", "0") != "0"
MDX_SEGMENT_SIZE = int(os.getenv("UVR_MDX_SEGMENT_SIZE", "256"))
# MDXC/RoFormer overlap is an integer chunk-overlap count (2-50, library
# default 8) — different semantics from the MDX 0-1 fraction above.
MDXC_OVERLAP = int(os.getenv("UVR_MDXC_OVERLAP", "8"))

# Object storage (S3-compatible — Cloudflare R2 works). When set, stems
# are uploaded and returned as URLs instead of inline base64. This is the
# production path; base64 is only sane for small local-test files.
S3_BUCKET = os.getenv("S3_BUCKET", "")
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "")
S3_REGION = os.getenv("S3_REGION", "auto")
S3_ACCESS_KEY_ID = os.getenv("S3_ACCESS_KEY_ID") or os.getenv("AWS_ACCESS_KEY_ID", "")
S3_SECRET_ACCESS_KEY = os.getenv("S3_SECRET_ACCESS_KEY") or os.getenv(
    "AWS_SECRET_ACCESS_KEY", ""
)
# Public base for constructing returned URLs (e.g. an R2 public dev URL or
# CDN domain). When empty, a time-limited presigned GET URL is generated.
S3_PUBLIC_BASE_URL = os.getenv("S3_PUBLIC_BASE_URL", "").rstrip("/")
S3_URL_TTL_SECS = int(os.getenv("S3_URL_TTL_SECS", str(24 * 3600)))
# Key prefix inside the bucket — set per RunPod endpoint to separate
# environments sharing one bucket (e.g. "runpod-dev" on the dev/test
# endpoint, default "runpod" for prod). Also handy for prefix-scoped R2
# lifecycle rules (auto-expire dev stems sooner).
S3_KEY_PREFIX = os.getenv("S3_KEY_PREFIX", "runpod").strip("/") or "runpod"

_MODEL_RE = re.compile(r"^[A-Za-z0-9._-]+$")
_VALID_FORMATS = {"WAV", "MP3", "FLAC"}
_STEM_KEYS = ["vocal", "instrumental", "drums", "bass", "other"]

os.makedirs(WORK_DIR, exist_ok=True)

# Reused across warm invocations so we only pay the model-load cost once
# per container lifetime, not once per request.
_separator: Any = None
_loaded_key: Optional[tuple] = None
_s3_client: Any = None


def _s3():
    global _s3_client
    if _s3_client is None:
        import boto3
        from botocore.config import Config

        _s3_client = boto3.client(
            "s3",
            endpoint_url=S3_ENDPOINT_URL or None,
            region_name=S3_REGION,
            aws_access_key_id=S3_ACCESS_KEY_ID,
            aws_secret_access_key=S3_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4"),
        )
    return _s3_client


def _storage_enabled() -> bool:
    return bool(S3_BUCKET and S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY)


def _detect_device() -> str:
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
    except Exception:
        pass
    try:
        import onnxruntime as ort

        if "CUDAExecutionProvider" in ort.get_available_providers():
            return "cuda"
    except Exception:
        pass
    return "cpu"


def _quality_from_input(job_input: dict) -> dict:
    """Resolve separation-quality settings: env defaults, per-job overrides.

    Overrides are best-effort coerced and clamped; anything unparseable
    falls back to the env default so a malformed job can't crash or pick
    pathological settings."""

    def _as_bool(value: Any, default: bool) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        if isinstance(value, str):
            return value.strip().lower() in ("1", "true", "yes", "on")
        return default

    def _as_num(value: Any, default: float) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    overlap = _as_num(job_input.get("mdx_overlap"), MDX_OVERLAP)
    segment = int(_as_num(job_input.get("mdx_segment_size"), MDX_SEGMENT_SIZE))
    mdxc_overlap = int(_as_num(job_input.get("mdxc_overlap"), MDXC_OVERLAP))
    return {
        "invert_using_spec": _as_bool(
            job_input.get("invert_using_spec"), INVERT_USING_SPEC
        ),
        "overlap": min(0.95, max(0.1, overlap)),
        "enable_denoise": _as_bool(job_input.get("mdx_denoise"), MDX_DENOISE),
        "segment_size": min(4096, max(64, segment)),
        "mdxc_overlap": min(50, max(2, mdxc_overlap)),
    }


def _patch_invert_stem() -> None:
    """Fix the channel orientation bug that breaks invert_using_spec.

    audio-separator 0.44.2's MDX path hands spec_utils.invert_stem the
    primary source time-major (N, 2) while the match-mix is channels-first
    (2, N); librosa's STFT then sees N channels of 2 samples and the whole
    separation dies in a broadcast ValueError — swallowed by
    Separator.separate(), so every spec-inversion job reports
    "no output stems". Re-orient both waves to channels-first before the
    original function runs. Idempotent; a fixed upstream release makes the
    transpose a no-op (both args already channels-first)."""
    from audio_separator.separator.uvr_lib_v5 import spec_utils

    if getattr(spec_utils.invert_stem, "_mp_channels_first_fix", False):
        return

    import numpy as np

    orig = spec_utils.invert_stem

    def _channels_first(wave):
        if (
            isinstance(wave, np.ndarray)
            and wave.ndim == 2
            and wave.shape[0] != 2
            and wave.shape[1] == 2
        ):
            return wave.T
        return wave

    def fixed(mixture, stem):
        return orig(_channels_first(mixture), _channels_first(stem))

    fixed._mp_channels_first_fix = True  # type: ignore[attr-defined]
    spec_utils.invert_stem = fixed
    logger.info("Patched spec_utils.invert_stem for channels-first input")


def _get_separator(
    spec: dict, output_dir: str, output_format: str, quality: dict
):
    """Return a Separator with the spec's model(s) loaded, reusing the warm
    instance.

    audio-separator auto-selects CUDAExecutionProvider when onnxruntime-gpu
    sees a GPU, so no provider plumbing is needed on NVIDIA hosts. The warm
    instance is keyed on (files, quality): quality settings are baked into
    the Separator/model at load time, so a job with different settings
    rebuilds (a few seconds) — the steady state (env defaults) never does.

    A spec with multiple files runs audio-separator's built-in ensemble:
    each member separates into a temp dir and the stems are combined with
    `algorithm` (default avg_wave). Member models load during separate(),
    so ensemble jobs pay the member load time per job.
    """
    global _separator, _loaded_key
    from audio_separator.separator import Separator

    _patch_invert_stem()

    files = list(spec["files"])
    algorithm = str(spec.get("algorithm", "avg_wave"))
    key = (
        tuple(files),
        algorithm,
        quality["invert_using_spec"],
        quality["overlap"],
        quality["enable_denoise"],
        quality["segment_size"],
        quality["mdxc_overlap"],
    )

    if _separator is None or _loaded_key != key:
        os.makedirs(MODEL_DIR, exist_ok=True)
        kwargs: dict[str, Any] = {
            "output_dir": output_dir,
            "output_format": output_format,
            "model_file_dir": MODEL_DIR,
            "invert_using_spec": quality["invert_using_spec"],
            "mdx_params": {
                "hop_length": 1024,
                "segment_size": quality["segment_size"],
                "overlap": quality["overlap"],
                "batch_size": 1,
                "enable_denoise": quality["enable_denoise"],
            },
            # RoFormer/MDXC models: honor each checkpoint's own trained
            # segment size (override off) — overriding degrades quality.
            "mdxc_params": {
                "segment_size": 256,
                "override_model_segment_size": False,
                "batch_size": 1,
                "overlap": quality["mdxc_overlap"],
                "pitch_shift": 0,
            },
        }
        if len(files) > 1:
            kwargs["ensemble_algorithm"] = algorithm
        _separator = Separator(**kwargs)
        _separator.load_model(
            model_filename=files if len(files) > 1 else files[0]
        )
        _loaded_key = key
    else:
        # Reuse the warm instance but point it at this job's output dir/format.
        _separator.output_dir = output_dir
        _separator.output_format = output_format

    # The loaded model architecture snapshots output_dir/output_format at
    # load_model() time, so mutating the Separator alone leaves a warm worker
    # writing stems into the *previous* job's directory (first victim: the
    # eager-load `_init` dir — every job then "produced no output stems").
    # Point the live model instance at this job's dir/format too.
    inst = getattr(_separator, "model_instance", None)
    if inst is not None:
        if hasattr(inst, "output_dir"):
            inst.output_dir = output_dir
        if hasattr(inst, "output_format"):
            inst.output_format = output_format
    return _separator


def init_worker() -> None:
    """Warm the default model into memory at worker startup.

    Best-effort: a failure here (e.g. transient model-host hiccup) must not
    crash the worker — the handler will lazy-load on the first job instead.
    """
    if not EAGER_LOAD:
        return
    try:
        resolved = resolve_model(DEFAULT_MODEL)
        if resolved is None:
            logger.error(
                "UVR_DEFAULT_MODEL %r is not in the registry %s",
                DEFAULT_MODEL,
                sorted(MODEL_REGISTRY),
            )
            return
        t0 = time.time()
        _get_separator(
            resolved[1], os.path.join(WORK_DIR, "_init"), "FLAC",
            _quality_from_input({}),
        )
        logger.info(
            "Pre-loaded model %s (%s) in %.1fs (device=%s)",
            resolved[0],
            resolved[1]["files"],
            time.time() - t0,
            _detect_device(),
        )
    except Exception:
        logger.exception("Eager model load failed; will lazy-load on first job")


def _safe_name_stem(filename: str) -> str:
    """Sanitize an (untrusted) upload filename into a safe base name.

    The name survives into the output stem filenames, the S3/R2 object keys
    and the user's downloaded file, so keep it readable — "My Song" stays
    "My Song" — but strip path separators and anything S3-key- or
    shell-hostile, collapse whitespace, and cap the length. Falls back to
    "input" when nothing usable remains.
    """
    base = os.path.splitext(os.path.basename(filename or ""))[0]
    base = re.sub(r"[^A-Za-z0-9 ._()\[\]&+',-]+", " ", base)
    base = re.sub(r"\s+", " ", base).strip(" .")
    return base[:60].strip(" .") or "input"


def _materialize_input(job_input: dict, job_dir: str) -> str:
    """Write the job's audio to a local file and return its path."""
    filename = job_input.get("filename") or "input"
    # Sanitized name + validated extension from the (untrusted) filename.
    # Default to .mp3 so ffmpeg sniffs a container if absent. The name is
    # kept (not discarded) so stems come back as "<song>_(Vocals)_….flac"
    # instead of an anonymous "input_(Vocals)_…".
    ext = os.path.splitext(filename)[1].lower() or ".mp3"
    if not re.match(r"^\.[A-Za-z0-9]{1,5}$", ext):
        ext = ".mp3"
    local_path = os.path.join(job_dir, f"{_safe_name_stem(filename)}{ext}")

    audio_url = job_input.get("audio_url")
    audio_b64 = job_input.get("audio_base64")
    audio_s3_key = job_input.get("audio_s3_key")

    if audio_s3_key:
        # Big inputs the worker streamed to R2 under `input/`. Download with
        # our own S3 credentials (same bucket we upload stems to) — no public
        # URL is ever minted for the source audio.
        if not _storage_enabled():
            raise ValueError("audio_s3_key given but S3 storage is not configured")
        key = str(audio_s3_key)
        if not re.match(r"^input/[A-Za-z0-9._-]+$", key):
            raise ValueError("Invalid audio_s3_key")
        _s3().download_file(S3_BUCKET, key, local_path)
        if os.path.getsize(local_path) > MAX_INPUT_BYTES:
            raise ValueError(f"Input exceeds {MAX_INPUT_BYTES // (1024 * 1024)} MB cap")
    elif audio_url:
        import requests

        with requests.get(audio_url, stream=True, timeout=120) as resp:
            resp.raise_for_status()
            written = 0
            with open(local_path, "wb") as fh:
                for chunk in resp.iter_content(chunk_size=1024 * 1024):
                    if not chunk:
                        continue
                    written += len(chunk)
                    if written > MAX_INPUT_BYTES:
                        raise ValueError(
                            f"Input exceeds {MAX_INPUT_BYTES // (1024 * 1024)} MB cap"
                        )
                    fh.write(chunk)
    elif audio_b64:
        raw = base64.b64decode(audio_b64)
        if len(raw) > MAX_INPUT_BYTES:
            raise ValueError(f"Input exceeds {MAX_INPUT_BYTES // (1024 * 1024)} MB cap")
        with open(local_path, "wb") as fh:
            fh.write(raw)
    else:
        raise ValueError(
            "Job input requires 'audio_url', 'audio_base64', or 'audio_s3_key'"
        )

    if os.path.getsize(local_path) == 0:
        raise ValueError("Decoded input audio is empty")
    return local_path


# audio-separator names outputs "<input>_(<Stem>)_<model>.<ext>" — match the
# parenthesised marker first so a song called e.g. "Vocal Coach.mp3" can't
# misclassify its instrumental stem via a bare substring hit. Karaoke models
# label their music-plus-backing-vocals stem "(Karaoke)" — for the app's
# contract that IS the instrumental.
_STEM_MARKER_RE = re.compile(
    r"\((vocals?|instrumental|karaoke|drums|bass|other)\)", re.IGNORECASE
)


def _classify_stem(filename: str) -> str:
    low = filename.lower()
    marker = _STEM_MARKER_RE.search(low)
    if marker:
        raw = marker.group(1)
        if raw.startswith("vocal"):
            return "vocal"
        if raw == "karaoke":
            return "instrumental"
        return raw
    for key in _STEM_KEYS:
        if key in low:
            return key
    return "unknown"


def _audio_duration(path: str) -> float:
    try:
        import subprocess

        out = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                path,
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )
        return float(out.stdout.strip())
    except Exception:
        return 0.0


def _upload_stem(local_path: str, key: str) -> str:
    content_types = {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".flac": "audio/flac",
    }
    ctype = content_types.get(os.path.splitext(local_path)[1].lower(), "audio/wav")
    _s3().upload_file(
        local_path, S3_BUCKET, key, ExtraArgs={"ContentType": ctype}
    )
    if S3_PUBLIC_BASE_URL:
        return f"{S3_PUBLIC_BASE_URL}/{key}"
    return _s3().generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": key},
        ExpiresIn=S3_URL_TTL_SECS,
    )


def handler(job: dict) -> dict:
    """RunPod serverless entrypoint."""
    job_id = job.get("id") or str(uuid.uuid4())
    job_input = job.get("input") or {}

    model = str(job_input.get("model") or DEFAULT_MODEL)
    if not _MODEL_RE.match(model):
        return {"error": "Invalid model name"}
    resolved = resolve_model(model)
    if resolved is None:
        return {
            "error": (
                f"Unknown model {model!r} (use one of "
                f"{sorted(MODEL_REGISTRY)})"
            )
        }
    model_key, model_spec = resolved

    output_format = str(job_input.get("output_format") or "FLAC").upper()
    if output_format not in _VALID_FORMATS:
        return {"error": f"Invalid output_format (use {sorted(_VALID_FORMATS)})"}

    wanted = job_input.get("stems") or ["vocal", "instrumental"]
    quality = _quality_from_input(job_input)
    job_dir = os.path.join(WORK_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    timings: dict[str, float] = {}
    t_start = time.time()
    _lib_errors.clear()
    try:
        t0 = time.time()
        input_path = _materialize_input(job_input, job_dir)
        timings["download"] = round(time.time() - t0, 3)
        # One greppable start line per job in the RunPod console — the job id
        # here is the tail of the app's rp_<tier>_<id> session id, which is
        # the correlation key across worker logs and the credit ledger.
        logger.info(
            "Job %s start: %r (%.1f MB via %s) model=%s%s format=%s quality=%s",
            job_id,
            os.path.basename(input_path),
            os.path.getsize(input_path) / 1_000_000,
            "s3" if job_input.get("audio_s3_key")
            else "url" if job_input.get("audio_url")
            else "base64",
            model_key,
            model_spec["files"],
            output_format,
            quality,
        )

        # Duration guard — reject over-long songs before paying for a full
        # separation. Probe fails open (returns 0.0 → no cap applied) so a
        # probe hiccup never blocks a legitimate job.
        in_duration = _audio_duration(input_path)
        if MAX_INPUT_MINUTES > 0 and in_duration > MAX_INPUT_MINUTES * 60:
            logger.warning(
                "Job %s rejected: %.1f min exceeds the %.0f min cap",
                job_id,
                in_duration / 60,
                MAX_INPUT_MINUTES,
            )
            return {
                "error": (
                    f"Song is too long ({in_duration / 60:.1f} min) for server "
                    f"separation. The limit is {MAX_INPUT_MINUTES:.0f} minutes."
                )
            }
        # Same probe, opposite bound (probe failure = 0.0 stays fail-open).
        if MIN_INPUT_SECONDS > 0 and 0 < in_duration < MIN_INPUT_SECONDS:
            logger.warning(
                "Job %s rejected: %.1f s is under the %.0f s minimum",
                job_id,
                in_duration,
                MIN_INPUT_SECONDS,
            )
            return {
                "error": (
                    f"Audio is too short ({in_duration:.0f} s) for server "
                    f"separation. The minimum is {MIN_INPUT_SECONDS:.0f} seconds."
                )
            }

        t0 = time.time()
        separator = _get_separator(model_spec, job_dir, output_format, quality)
        timings["load_model"] = round(time.time() - t0, 3)

        t0 = time.time()
        returned = separator.separate(input_path) or []
        timings["separate"] = round(time.time() - t0, 3)

        # Collect produced stems (skip the exact input file we wrote — the
        # input now carries the song's name, so match by path, not pattern).
        produced = []
        for path in sorted(glob.glob(os.path.join(job_dir, "*"))):
            if not os.path.isfile(path):
                continue
            if os.path.samefile(path, input_path):
                continue
            produced.append(path)
        # Belt-and-braces: audio-separator returns the written files; trust
        # them too in case a version change moves where output lands.
        for name in returned:
            for cand in (
                name if os.path.isabs(name) else "",
                os.path.join(job_dir, os.path.basename(str(name))),
            ):
                if cand and os.path.isfile(cand) and cand not in produced:
                    produced.append(cand)

        t0 = time.time()
        stems: list[dict] = []
        use_storage = _storage_enabled()
        for path in produced:
            name = os.path.basename(path)
            stem = _classify_stem(name)
            if wanted and stem not in wanted and stem != "unknown":
                # Still return everything the model produced; clients pick.
                pass
            entry: dict[str, Any] = {
                "stem": stem,
                "filename": name,
                "size": os.path.getsize(path),
                "duration": _audio_duration(path),
            }
            if use_storage:
                key = f"{S3_KEY_PREFIX}/{job_id}/{name}"
                entry["url"] = _upload_stem(path, key)
            else:
                with open(path, "rb") as fh:
                    entry["data_base64"] = base64.b64encode(fh.read()).decode("ascii")
            stems.append(entry)
        timings["upload"] = round(time.time() - t0, 3)

        if not stems:
            logger.error(
                "Job %s: separation produced no output stems (dir had %d files)",
                job_id,
                len(produced),
            )
            # Surface the library's swallowed per-file error (see
            # _LibErrorCapture) — without it a separation crash is
            # indistinguishable from an empty result.
            detail = f" ({_lib_errors[-1]})" if _lib_errors else ""
            return {"error": f"Separation produced no output stems{detail}"}

        timings["total"] = round(time.time() - t_start, 3)
        billed = timings["total"]
        # Matching end line: grep "Job <id>" in the RunPod console gives the
        # whole lifecycle; cost/timings mirror what the response reports.
        logger.info(
            "Job %s done: %d stem(s) via %s in %.1fs (separate %.1fs) device=%s cost=$%.4f",
            job_id,
            len(stems),
            "s3" if use_storage else "base64",
            billed,
            timings["separate"],
            _detect_device(),
            billed / 3600.0 * GPU_USD_PER_HR,
        )
        return {
            "stems": stems,
            "model": model_key,
            "model_files": model_spec["files"],
            "output_format": output_format,
            "device": _detect_device(),
            "storage": "s3" if use_storage else "base64",
            "quality": quality,
            "timings": timings,
            "cost": {
                "gpu_usd_per_hr": GPU_USD_PER_HR,
                "billed_secs": round(billed, 1),
                "usd": round(billed / 3600.0 * GPU_USD_PER_HR, 4),
            },
        }
    except Exception as exc:  # noqa: BLE001 — report any failure as a job error
        logger.exception("Job %s failed", job_id)
        return {"error": str(exc)}
    finally:
        # Free the per-job scratch; the model cache (MODEL_DIR) is untouched.
        try:
            import shutil

            shutil.rmtree(job_dir, ignore_errors=True)
        except Exception:
            pass


if __name__ == "__main__":
    # `python handler.py` runs the handler once against test_input.json (if
    # present) and prints the result — the standard RunPod local-test loop,
    # and how you measure cost-per-song before deploying.
    init_worker()
    runpod.serverless.start({"handler": handler})
