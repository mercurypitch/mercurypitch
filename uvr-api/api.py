# ============================================================
# UVR Audio Separator API Server
# ============================================================
from fastapi import FastAPI, UploadFile, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import shutil
import os
import uuid
import logging
import time
from typing import Optional, List, Dict, Any
import threading
from audio_separator.separator import Separator
import subprocess
import json
from fastapi import HTTPException
import onnxruntime as ort

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://pitchperfect.clodhost.com",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- START AMD ROCm OVERRIDE ---
# 1. Trick the library into passing the "Is CUDA installed?" check
original_get_providers = ort.get_available_providers
def rocm_get_providers():
    providers = original_get_providers()
    if "ROCMExecutionProvider" in providers and "CUDAExecutionProvider" not in providers:
        providers.append("CUDAExecutionProvider")
    return providers

ort.get_available_providers = rocm_get_providers

# 2. Silently swap the NVIDIA provider for the AMD one when the model loads
original_session = ort.InferenceSession
def rocm_inference_session(*args, **kwargs):
    if "providers" in kwargs:
        kwargs["providers"] = [
            "ROCMExecutionProvider" if p == "CUDAExecutionProvider" else p
            for p in kwargs["providers"]
        ]
    return original_session(*args, **kwargs)

ort.InferenceSession = rocm_inference_session
# --- END AMD ROCm OVERRIDE ---

# Configure paths
OUTPUT_DIR = "/app/output"
UPLOAD_DIR = "/app/uploads"
SESSION_DIR = "/tmp/uvr"

# Create directories
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(SESSION_DIR, exist_ok=True)

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
                   estimated_total: float = 0.0):
    """Write progress data to session directory."""
    progress_file = os.path.join(session_dir, "progress.json")
    data = {
        "progress": progress,
        "status": status,
        "duration_secs": duration,
        "started_at": started_at,
        "estimated_total_secs": estimated_total,
        "updated_at": time.time(),
    }
    with open(progress_file, 'w') as f:
        json.dump(data, f)


def estimate_processing_time(duration_secs: float, file_size_bytes: int) -> float:
    """Estimate total processing time based on audio duration and file size.

    GPU-accelerated processing typically runs at 0.5-2x realtime.
    CPU fallback is slower at 6-12x realtime.
    We use a 3x multiplier as a middle-ground starting estimate,
    then adjust based on file size.
    """
    if duration_secs <= 0:
        return 120.0  # 2 minute fallback

    # Base estimate: 3x realtime (reasonable for both GPU and CPU)
    base_ratio = 3.0

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
        default="UVR-MDX-NET-Inst_HQ",
        description="Model name for separation"
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
        raise HTTPException(status_code=500, detail=str(e))

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
    model: str = 'UVR_MDXNET_KARA_2',
    output_format: str = "WAV",
    stems: List[str] = ["vocal", "instrumental"]
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
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"File uploaded: {input_path}")
    except Exception as e:
        logger.error(f"Failed to save uploaded file: {e}")
        raise HTTPException(status_code=500, detail="Failed to save uploaded file")

    # Start processing in background
    def process_task(session_id: str, input_path: str, model_name: str):
        try:
            logger.info(f"Starting processing for session {session_id}")

            # Get audio duration and file size for progress estimation
            file_size = os.path.getsize(input_path)
            duration = get_audio_duration(input_path)
            estimated = estimate_processing_time(duration, file_size)
            logger.info(
                f"Session {session_id}: duration={duration:.1f}s, "
                f"size={file_size/1024/1024:.1f}MB, "
                f"estimated={estimated:.1f}s"
            )

            # Write initial progress
            started_at = time.time()
            write_progress(session_output_dir, 0.0, "processing",
                           duration, started_at, estimated)

            # Initialize separator
            separator = Separator(
                output_dir=session_output_dir,
                output_format=output_format,
                model_file_dir="/tmp/audio-separator-models/"
            )

            if not model_name.endswith('onnx'):
                model_name_wext = model_name + '.onnx'
            else:
                model_name_wext = model_name

            separator.load_model(model_filename=model_name_wext)

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
                                   duration, started_at, estimated)

            # Check for separation errors
            if separation_error[0]:
                raise separation_error[0]

            logger.info(f"Processing completed for session {session_id}")

            # Write completion markers
            write_progress(session_output_dir, 100.0, "completed",
                           duration, started_at, estimated)
            open(os.path.join(session_output_dir, "done.txt"), 'w').close()

        except Exception as e:
            logger.error(f"Processing error for session {session_id}: {e}")
            try:
                write_progress(session_output_dir, 0.0, "error", 0, 0)
            except Exception:
                pass

    background_tasks.add_task(process_task, session_id, input_path, model)

    return ProcessResponse(
        session_id=session_id,
        status="processing",
        message="Processing started",
        model=model,
        output_format=output_format
    )


@app.get("/status/{session_id}", response_model=ProcessStatusResponse)
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
    progress_file = os.path.join(session_output_dir, "progress.json")
    if os.path.exists(progress_file):
        try:
            with open(progress_file) as f:
                pdata = json.load(f)
            progress = pdata.get("progress")
        except Exception:
            pass

    # If processing is ongoing, calculate live progress from elapsed time
    if not is_done and progress is not None and progress < 100:
        try:
            with open(progress_file) as f:
                pdata = json.load(f)
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
                else:
                    detected = stem if stem else "unknown"

            # Normalize rel_path: os.walk yields "." for root, strip it
            clean_rel = rel_path.lstrip("./") if rel_path != "." else ""
            path_segment = f"{clean_rel}/{filename}" if clean_rel else filename
            files.append({
                "stem": detected,
                "filename": filename,
                "path": f"/api/uvr/output/{session_id}/{path_segment}",
                "size": os.path.getsize(file_path)
            })

    # Determine status and message
    if is_done:
         status = "completed"
         message = "Processing completed successfully"
         progress = 100
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
        message=message
    )


@app.get("/output/{session_id}/{path:path}")
async def get_output_file(session_id: str, path: str):
    """Serve processed output file"""
    file_path = os.path.join(OUTPUT_DIR, session_id, path)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    # Determine media type
    ext = os.path.splitext(path)[1].lower()
    media_types = {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".flac": "audio/flac",
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        file_path,
        media_type=media_type,
        filename=path
    )


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its files"""
    session_output_dir = os.path.join(OUTPUT_DIR, session_id)
    session_upload_dir = os.path.join(UPLOAD_DIR, session_id)

    try:
        if os.path.exists(session_output_dir):
            shutil.rmtree(session_output_dir)
        if os.path.exists(session_upload_dir):
            shutil.rmtree(session_upload_dir)

        return {"status": "success", "message": f"Session {session_id} deleted"}
    except Exception as e:
        logger.error(f"Failed to delete session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
        host="0.0.0.0",
        port=8000,
        reload=True
    )
