# ============================================================
# UVR Audio Separator API Server
# ============================================================
from fastapi import FastAPI, Form, UploadFile, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import shutil
import os
import re
import uuid
import logging
import time
from typing import Optional, List, Dict, Any
import threading
import subprocess
import json

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="UVR Audio Separator API",
    description="API for processing audio using python-audio-separator",
    version="1.0.0"
)

# CORS configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "https://mercurypitch.com,https://dev.mercurypitch.com").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AMD ROCm OVERRIDE (applied lazily before first use) ---
_rocm_patched = False

def _apply_rocm_patch():
    """Apply ROCm ONNX provider override once, on first use."""
    global _rocm_patched
    if _rocm_patched:
        return
    _rocm_patched = True
    import onnxruntime as ort
    _providers = ort.get_available_providers()
    if "ROCMExecutionProvider" not in _providers:
        return
    original_get_providers = ort.get_available_providers
    def _rocm_get_providers():
        providers = original_get_providers()
        if "ROCMExecutionProvider" in providers and "CUDAExecutionProvider" not in providers:
            providers.append("CUDAExecutionProvider")
        return providers
    ort.get_available_providers = _rocm_get_providers

    original_session = ort.InferenceSession
    def _rocm_inference_session(*args, **kwargs):
        if "providers" in kwargs:
            kwargs["providers"] = [
                "ROCMExecutionProvider" if p == "CUDAExecutionProvider" else p
                for p in kwargs["providers"]
            ]
        return original_session(*args, **kwargs)
    ort.InferenceSession = _rocm_inference_session

# Configure paths
OUTPUT_DIR = "/app/output"
UPLOAD_DIR = "/app/uploads"

# Create directories
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Session ids are server-generated UUID4s (see /process). Any client-supplied
# session id must be validated before it touches a filesystem path, so a
# crafted id/path cannot escape OUTPUT_DIR / UPLOAD_DIR (path traversal).
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)


def _safe_session_dir(base_dir: str, session_id: str) -> str:
    """Validate session_id and return its sandbox directory under base_dir.

    Raises HTTPException(400) for a malformed id. The returned path is the
    realpath of base_dir/session_id; callers that join further untrusted
    segments must re-check containment with os.path.commonpath.
    """
    if not _UUID_RE.match(session_id):
        raise HTTPException(status_code=400, detail="Invalid session id")
    return os.path.realpath(os.path.join(base_dir, session_id))


# Upload guards
MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB cap on uploaded audio
# Model filenames resolve under model_file_dir; restrict to a safe charset so
# the `model` parameter cannot traverse paths via load_model().
_MODEL_RE = re.compile(r"^[A-Za-z0-9._-]+$")

# ── Model registry ──────────────────────────────────────────────
# Quality tiers the app may request, resolved to exact weight files.
# Mirror of MODEL_REGISTRY in runpod/handler.py (that copy is the source
# of truth — keep them in sync). Doubles as the allowlist: anything not
# listed is rejected. First use of a model downloads its weights into
# model_file_dir (~0.6-1 GB for the RoFormer checkpoints).
MODEL_REGISTRY: Dict[str, Dict[str, Any]] = {
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

# Older clients send the MDX weights filename directly.
_MODEL_ALIASES = {
    "UVR-MDX-NET-Inst_HQ_3": "mdx",
    "UVR-MDX-NET-Inst_HQ_3.onnx": "mdx",
}

DEFAULT_MODEL = os.getenv("UVR_DEFAULT_MODEL", "roformer")


def resolve_model(name: str) -> Optional[tuple]:
    """Map a requested model name to (registry key, spec), or None."""
    key = _MODEL_ALIASES.get(name, name).lower()
    spec = MODEL_REGISTRY.get(key)
    return (key, spec) if spec is not None else None

# ── Progress tracking ──────────────────────────────────────────

def get_audio_duration(file_path: str) -> float:
    """Get audio duration in seconds using ffprobe."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", file_path],
            capture_output=True, text=True, timeout=15
        )
        return float(result.stdout.strip())
    except Exception:
        return 0.0


def write_progress(session_dir: str, progress: float, status: str,
                   duration: float = 0.0, started_at: float = 0.0,
                   estimated_total: float = 0.0, cpu_profile: str = 'high',
                   error_msg: Optional[str] = None):
    """Write progress data to session directory."""
    progress_file = os.path.join(session_dir, "progress.json")
    data = {
        "progress": progress,
        "status": status,
        "duration_secs": duration,
        "started_at": started_at,
        "estimated_total_secs": estimated_total,
        "cpu_profile": cpu_profile,
        "updated_at": time.time(),
    }
    if error_msg:
        data["error"] = error_msg
    with open(progress_file, 'w') as f:
        json.dump(data, f)


# CPU profile speed ratios (multiplier applied to audio duration)
CPU_PROFILES = {
    'high': 0.8,   # Fast GPU / high-end CPU — sub-realtime
    'mid':  3.0,   # Mid-range — ~3x realtime
    'low':  10.0,  # Slow CPU — ~10x realtime
}

def estimate_processing_time(duration_secs: float, file_size_bytes: int,
                             cpu_profile: str = 'high') -> float:
    """Estimate total processing time based on audio duration, file size, and CPU profile.

    Profiles:
      high — fast GPU / high-end CPU (0.8x realtime base)
      mid  — mid-range (3x realtime base)
      low  — slow CPU (10x realtime base)
    """
    if duration_secs <= 0:
        return 120.0  # 2 minute fallback

    base_ratio = CPU_PROFILES.get(cpu_profile, CPU_PROFILES['high'])

    # Adjust for file size: larger files = higher bitrate = more processing
    size_mb = file_size_bytes / (1024 * 1024)
    if size_mb > 50:
        base_ratio *= 1.4
    elif size_mb > 30:
        base_ratio *= 1.2

    return duration_secs * base_ratio

# Request/Response models
class ProcessRequest(BaseModel):
    """Request to process audio file"""
    model: str = Field(
        default="roformer",
        description="Registry model name for separation"
    )
    output_format: str = Field(
        default="WAV",
        description="Output format (WAV, MP3, FLAC)"
    )
    stems: List[str] = Field(
        default=["vocal", "instrumental"],
        description="Stems to extract"
    )


class ProcessResponse(BaseModel):
    """Response after starting processing"""
    session_id: str
    status: str
    message: str
    model: str
    output_format: str


class ProcessStatusResponse(BaseModel):
    """Response with processing status"""
    session_id: str
    status: str
    progress: Optional[float] = None
    message: Optional[str] = None
    files: List[Dict[str, Any]] = Field(default_factory=list)
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    processing_sessions: int


# ==================== Endpoints ====================

@app.get("/health")
async def health_check() -> HealthResponse:
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        processing_sessions=0  # Could be tracked separately
    )

@app.get("/models")
async def list_models():
    """List available UVR models by hooking into the CLI"""
    try:
        # Call the CLI and tell it to dump the models as JSON
        result = subprocess.run(
            ["audio-separator", "--list_models", "--list_format=json"],
            capture_output=True,
            text=True,
            check=True
        )
        # Parse the JSON string returned by the CLI
        models_data = json.loads(result.stdout)
        return {"models": models_data}
    except subprocess.CalledProcessError as e:
        logger.error(f"CLI failed: {e.stderr}")
        raise HTTPException(status_code=500, detail="Failed to fetch models from CLI")
    except Exception as e:
        logger.error(f"Error parsing models: {e}")
        raise HTTPException(status_code=500, detail="Failed to list models")

# @app.get("/models")
# async def list_models():
#     """List available UVR models"""
#     try:
#         # In v0.44.1, use 'info_only=True' to access metadata without 
#         # initializing the heavy audio engine.
#         separator = Separator(info_only=True)
#
#         # The correct method name in this version is 'list_available_models()'
#         # Note: This returns a dictionary of model metadata.
#         models = separator.list_available_models()
#     except Exception as e:
#         logger.error(f"Error listing models: {e}")
#         raise HTTPException(status_code=500, detail=str(e))

@app.post("/process", response_model=ProcessResponse)
async def process_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile,
    # The app sends these as multipart FORM fields (see uvr-api.ts
    # processAudio). They were previously declared as plain params, which
    # FastAPI reads from the QUERY string — so the client's form values
    # were silently ignored and the defaults always applied (unnoticed
    # while both sides shared the same defaults).
    model: str = Form(DEFAULT_MODEL),
    output_format: str = Form("WAV"),
    # JSON array string from the app; accepted for contract parity but
    # unused — separation always produces all stems and /status lists them.
    stems: Optional[str] = Form(None),
    cpu_profile: str = Form('high')
):
    """
    Process an uploaded audio file to separate vocals and instrumental
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Validate output format
    output_format = output_format.upper()
    if output_format not in ["WAV", "MP3", "FLAC"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid output format. Use WAV, MP3, or FLAC"
        )

    # Validate model name — blocks path traversal through load_model()
    if not _MODEL_RE.match(model):
        raise HTTPException(status_code=400, detail="Invalid model name")
    resolved = resolve_model(model)
    if resolved is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model (use one of {sorted(MODEL_REGISTRY)})",
        )
    model_key, model_spec = resolved

    # Reject obvious non-audio uploads early (empty/octet-stream/audio-* pass).
    ctype = (file.content_type or "").lower()
    if ctype and not ctype.startswith("audio/") and ctype != "application/octet-stream":
        raise HTTPException(status_code=415, detail="Unsupported media type")

    # Create session directory
    session_id = str(uuid.uuid4())
    session_output_dir = os.path.join(OUTPUT_DIR, session_id)
    session_upload_dir = os.path.join(UPLOAD_DIR, session_id)

    os.makedirs(session_output_dir, exist_ok=True)
    os.makedirs(session_upload_dir, exist_ok=True)

    # Save uploaded file
    input_filename = f"input.{output_format.lower()}"
    input_path = os.path.join(session_upload_dir, input_filename)

    try:
        written = 0
        with open(input_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)  # 1 MB chunks
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    buffer.close()
                    os.remove(input_path)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB)",
                    )
                buffer.write(chunk)
        logger.info(f"File uploaded: {input_path} ({written} bytes)")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save uploaded file: {e}")
        raise HTTPException(status_code=500, detail="Failed to save uploaded file")

    # Start processing in background
    def process_task(session_id: str, input_path: str, spec: Dict[str, Any]):
        try:
            logger.info(f"Starting processing for session {session_id}")

            # Lazy-load heavy deps so uvicorn starts fast
            _apply_rocm_patch()
            from audio_separator.separator import Separator

            # Get audio duration and file size for progress estimation
            file_size = os.path.getsize(input_path)
            duration = get_audio_duration(input_path)
            estimated = estimate_processing_time(duration, file_size, cpu_profile)
            logger.info(
                f"Session {session_id}: duration={duration:.1f}s, "
                f"size={file_size/1024/1024:.1f}MB, "
                f"estimated={estimated:.1f}s"
            )

            # Write initial progress
            started_at = time.time()
            write_progress(session_output_dir, 0.0, "processing",
                           duration, started_at, estimated, cpu_profile)

            # Initialize separator. Quality settings mirror the RunPod GPU
            # handler (runpod/handler.py) so local output matches the paid
            # tier: spectrogram-domain inversion avoids the time-domain
            # phase-bleed in derived stems, and MDXC params honor each
            # RoFormer checkpoint's trained segment size.
            files = list(spec["files"])
            separator_kwargs = dict(
                output_dir=session_output_dir,
                output_format=output_format,
                model_file_dir="/tmp/audio-separator-models/",
                invert_using_spec=True,
                mdx_params={
                    "hop_length": 1024,
                    "segment_size": 256,
                    "overlap": 0.25,
                    "batch_size": 1,
                    "enable_denoise": False,
                },
                mdxc_params={
                    "segment_size": 256,
                    "override_model_segment_size": False,
                    "batch_size": 1,
                    "overlap": 8,
                    "pitch_shift": 0,
                },
            )
            if len(files) > 1:
                separator_kwargs["ensemble_algorithm"] = spec.get(
                    "algorithm", "avg_wave"
                )
            separator = Separator(**separator_kwargs)
            separator.load_model(
                model_filename=files if len(files) > 1 else files[0]
            )

            # Run separation in a thread so we can update progress
            separation_error = [None]  # mutable container for thread exception

            def run_separation():
                try:
                    separator.separate(input_path)
                except Exception as e:
                    separation_error[0] = e

            sep_thread = threading.Thread(target=run_separation, daemon=True)
            sep_thread.start()

            # Update progress while separation runs
            while sep_thread.is_alive():
                sep_thread.join(timeout=2.0)  # check every 2 seconds
                elapsed = time.time() - started_at
                if estimated > 0:
                    pct = min(95, (elapsed / estimated) * 100)
                    write_progress(session_output_dir, pct, "processing",
                                   duration, started_at, estimated, cpu_profile)

            # Check for separation errors
            if separation_error[0]:
                raise separation_error[0]

            logger.info(f"Processing completed for session {session_id}")

            # Write completion markers
            write_progress(session_output_dir, 100.0, "completed",
                           duration, started_at, estimated, cpu_profile)
            open(os.path.join(session_output_dir, "done.txt"), 'w').close()

        except Exception as e:
            logger.error(f"Processing error for session {session_id}: {e}")
            try:
                write_progress(session_output_dir, 0.0, "error", 0, 0, error_msg=str(e))
            except Exception:
                pass

    background_tasks.add_task(process_task, session_id, input_path, model_spec)

    return ProcessResponse(
        session_id=session_id,
        status="processing",
        message="Processing started",
        model=model_key,
        output_format=output_format
    )


# exclude_none: the app's zod schema (and the RunPod bridge's JSON) treat
# progress/message/error as OPTIONAL keys — pydantic would otherwise emit
# explicit `null`s, which fail the client's response validation.
@app.get(
    "/status/{session_id}",
    response_model=ProcessStatusResponse,
    response_model_exclude_none=True,
)
async def get_status(session_id: str):
    """Check processing status for a session"""
    session_output_dir = os.path.join(OUTPUT_DIR, session_id)

    if not os.path.exists(session_output_dir):
        return ProcessStatusResponse(
            session_id=session_id,
            status="not_started",
            files=[]
        )

    # Check if done
    is_done = os.path.exists(os.path.join(session_output_dir, "done.txt"))

    # Read progress file for real progress data
    progress = None
    pdata = {}
    progress_file = os.path.join(session_output_dir, "progress.json")
    if os.path.exists(progress_file):
        try:
            with open(progress_file) as f:
                pdata = json.load(f)
            progress = pdata.get("progress")
        except Exception:
            pass

    # If processing is ongoing, calculate live progress from elapsed time
    if not is_done and progress is not None and progress < 100 and pdata.get("status") != "error":
        try:
            started = pdata.get("started_at", 0)
            estimated = pdata.get("estimated_total_secs", 0)
            if started > 0 and estimated > 0:
                elapsed = time.time() - started
                progress = min(95, (elapsed / estimated) * 100)
        except Exception:
            pass

    # Collect output files
    files = []
    for root, dirs, filenames in os.walk(session_output_dir):
        for filename in filenames:
            # Skip the uploaded input file (e.g. input.wav) but NOT
            # audio-separator output files (e.g. input_(Vocals)_Model.wav)
            if filename == "done.txt" or filename == "progress.json":
                continue
            if filename.startswith("input") and not filename.startswith("input_"):
                continue

            file_path = os.path.join(root, filename)
            rel_path = os.path.relpath(root, session_output_dir)

            # Detect stem type from directory name AND filename
            stem = os.path.basename(root) if root != session_output_dir else ""
            combined = (stem + "/" + filename).lower()
            detected = None
            for s in ["vocal", "instrumental", "drums", "bass", "other"]:
                if s in combined:
                    detected = s
                    break
            if detected is None:
                # Fallback: try file extension hints or skip
                if "(Vocals)" in filename or "vocals" in filename.lower():
                    detected = "vocal"
                elif "(Instrumental)" in filename or "instrumental" in filename.lower():
                    detected = "instrumental"
                elif "(Karaoke)" in filename:
                    # Karaoke models label the music-plus-backing-vocals stem
                    # "(Karaoke)" — for the app's contract that IS the
                    # instrumental. (Checked after vocal/instrumental: every
                    # stem from these models has "karaoke" in the MODEL name.)
                    detected = "instrumental"
                else:
                    detected = stem if stem else "unknown"

            # Normalize rel_path: os.walk yields "." for root, strip it
            clean_rel = rel_path.lstrip("./") if rel_path != "." else ""
            path_segment = f"{clean_rel}/{filename}" if clean_rel else filename
            files.append({
                "stem": detected,
                "filename": filename,
                "path": f"/api/uvr/output/{session_id}/{path_segment}",
                "size": os.path.getsize(file_path),
                "duration": get_audio_duration(file_path),
            })

    # Determine status and message
    error_msg = None
    if is_done:
         status = "completed"
         message = "Processing completed successfully"
         progress = 100
    elif pdata.get("status") == "error":
         status = "error"
         message = "Processing failed"
         error_msg = pdata.get("error", "An internal error occurred during processing.")
    elif progress is not None:
         status = "processing"
         message = "Processing in progress..."
    else:
         # Check if upload exists to distinguish not_started vs error
         upload_dir = os.path.join(UPLOAD_DIR, session_id)
         if os.path.exists(upload_dir) and os.listdir(upload_dir):
             status = "processing"
             message = "Processing in progress..."
         else:
             status = "error"
             message = "Process failed or unknown status"

    return ProcessStatusResponse(
        session_id=session_id,
        status=status,
        progress=progress,
        files=files,
        message=message,
        error=error_msg
    )


@app.get("/output/{session_id}/{path:path}")
async def get_output_file(session_id: str, path: str):
    """Serve processed output file"""
    # `{path:path}` captures '/' and '..', so without a containment check a
    # crafted path (e.g. ../../../../etc/passwd) would escape OUTPUT_DIR and
    # be streamed back. Validate the id, then confine the resolved target to
    # the session sandbox.
    session_dir = _safe_session_dir(OUTPUT_DIR, session_id)
    target = os.path.realpath(os.path.join(session_dir, path))
    if (
        os.path.commonpath([session_dir, target]) != session_dir
        or not os.path.isfile(target)
    ):
        raise HTTPException(status_code=404, detail="File not found")

    # Determine media type
    ext = os.path.splitext(target)[1].lower()
    media_types = {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".flac": "audio/flac",
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        target,
        media_type=media_type,
        filename=os.path.basename(target),
    )


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its files"""
    # Validate the id before any rmtree so a crafted id cannot remove a
    # directory outside the OUTPUT_DIR / UPLOAD_DIR sandboxes.
    session_output_dir = _safe_session_dir(OUTPUT_DIR, session_id)
    session_upload_dir = _safe_session_dir(UPLOAD_DIR, session_id)

    try:
        if os.path.exists(session_output_dir):
            shutil.rmtree(session_output_dir)
        if os.path.exists(session_upload_dir):
            shutil.rmtree(session_upload_dir)

        return {"status": "success", "message": f"Session {session_id} deleted"}
    except Exception as e:
        logger.error(f"Failed to delete session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete session")


@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "name": "UVR Audio Separator API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "list_models": "/models",
            "process": "/process (POST)",
            "status": "/status/{session_id}",
            "output": "/output/{session_id}/{path}",
            "delete_session": "/session/{session_id} (DELETE)",
        }
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api:app",
        host=os.getenv("UVR_API_HOST", "0.0.0.0"),
        port=int(os.getenv("UVR_API_PORT", "8080")),
        # Auto-reload is a dev-only convenience; never run the file-watcher in
        # production. Opt in with UVR_DEV=1.
        reload=os.getenv("UVR_DEV") == "1",
    )
