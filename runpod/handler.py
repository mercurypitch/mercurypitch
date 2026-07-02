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
#     "model":         "UVR-MDX-NET-Inst_HQ_3",            # optional
#     "output_format": "FLAC",                             # WAV | MP3 | FLAC
#     "stems":         ["vocal", "instrumental"]           # optional
#   }
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

# ── Configuration (env) ─────────────────────────────────────────
# Where audio-separator caches its ONNX/torch model weights. Bake the
# default model into the image at this path (see Dockerfile) so a cold
# worker does not re-download it — cold-start download is the one real
# cost leak on serverless.
MODEL_DIR = os.getenv("UVR_MODEL_DIR", "/models")
WORK_DIR = os.getenv("UVR_WORK_DIR", "/tmp/uvr-jobs")
DEFAULT_MODEL = os.getenv("UVR_DEFAULT_MODEL", "UVR-MDX-NET-Inst_HQ_3")

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
_loaded_model: Optional[str] = None
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


def _get_separator(model: str, output_dir: str, output_format: str):
    """Return a Separator with `model` loaded, reusing the warm instance.

    audio-separator auto-selects CUDAExecutionProvider when onnxruntime-gpu
    sees a GPU, so no provider plumbing is needed on NVIDIA hosts.
    """
    global _separator, _loaded_model
    from audio_separator.separator import Separator

    if _separator is None:
        os.makedirs(MODEL_DIR, exist_ok=True)
        _separator = Separator(
            output_dir=output_dir,
            output_format=output_format,
            model_file_dir=MODEL_DIR,
        )
    else:
        # Reuse the warm instance but point it at this job's output dir/format.
        _separator.output_dir = output_dir
        _separator.output_format = output_format

    model_file = model if model.endswith(".onnx") else f"{model}.onnx"
    if _loaded_model != model_file:
        _separator.load_model(model_filename=model_file)
        _loaded_model = model_file

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
        t0 = time.time()
        _get_separator(DEFAULT_MODEL, os.path.join(WORK_DIR, "_init"), "FLAC")
        logger.info(
            "Pre-loaded model %s in %.1fs (device=%s)",
            DEFAULT_MODEL,
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

    if audio_url:
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
        raise ValueError("Job input requires 'audio_url' or 'audio_base64'")

    if os.path.getsize(local_path) == 0:
        raise ValueError("Decoded input audio is empty")
    return local_path


# audio-separator names outputs "<input>_(<Stem>)_<model>.<ext>" — match the
# parenthesised marker first so a song called e.g. "Vocal Coach.mp3" can't
# misclassify its instrumental stem via a bare substring hit.
_STEM_MARKER_RE = re.compile(
    r"\((vocals?|instrumental|drums|bass|other)\)", re.IGNORECASE
)


def _classify_stem(filename: str) -> str:
    low = filename.lower()
    marker = _STEM_MARKER_RE.search(low)
    if marker:
        key = marker.group(1).rstrip("s") if marker.group(1).startswith("vocal") else marker.group(1)
        return key
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

    model = job_input.get("model") or DEFAULT_MODEL
    if not _MODEL_RE.match(model):
        return {"error": "Invalid model name"}

    output_format = str(job_input.get("output_format") or "FLAC").upper()
    if output_format not in _VALID_FORMATS:
        return {"error": f"Invalid output_format (use {sorted(_VALID_FORMATS)})"}

    wanted = job_input.get("stems") or ["vocal", "instrumental"]
    job_dir = os.path.join(WORK_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    timings: dict[str, float] = {}
    t_start = time.time()
    try:
        t0 = time.time()
        input_path = _materialize_input(job_input, job_dir)
        timings["download"] = round(time.time() - t0, 3)

        t0 = time.time()
        separator = _get_separator(model, job_dir, output_format)
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
            return {"error": "Separation produced no output stems"}

        timings["total"] = round(time.time() - t_start, 3)
        billed = timings["total"]
        return {
            "stems": stems,
            "model": model,
            "output_format": output_format,
            "device": _detect_device(),
            "storage": "s3" if use_storage else "base64",
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
