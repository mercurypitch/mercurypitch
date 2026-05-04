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
            
            # 1. Initialize with configuration (Fixed for v0.44.1)
            separator = Separator(
                output_dir=session_output_dir,
                output_format=output_format,
                model_file_dir="/tmp/audio-separator-models/"
            )

            # Specify multiple models for ensembling
            if not model_name.endswith('onnx'):
                model_name_wext = model_name + '.onnx'
            else:
                model_name_wext = model_name
            
            separator.load_model(model_filename=model_name_wext)

            # 3. Separate
            separator.separate(input_path)
            
            logger.info(f"Processing completed for session {session_id}")
            open(os.path.join(session_output_dir, "done.txt"), 'w').close()
        except Exception as e:
            logger.error(f"Processing error for session {session_id}: {e}")

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

    # Check if still processing
    is_processing = False
    input_file = os.path.join(
        os.path.join(UPLOAD_DIR, session_id),
        f"input.wav"
    )

    if os.path.exists(input_file):
        is_processing = True

    files = []
    for root, dirs, filenames in os.walk(session_output_dir):
        for filename in filenames:
            # Skip input files
            if filename.startswith("input") or filename.startswith("done"):
                continue

            stem_name = os.path.basename(root) if root != session_output_dir else "root"

            file_path = os.path.join(root, filename)
            rel_path = os.path.relpath(root, session_output_dir)

            # Try to determine stem from path
            stem = stem_name
            for s in ["vocal", "instrumental", "drums", "bass", "other"]:
                if s in stem.lower():
                    stem = s
                    break

            files.append({
                "stem": stem,
                "filename": filename,
                "path": f"/api/output/{session_id}/{rel_path}/{filename}",
                "size": os.path.getsize(file_path)
            })
    # Check if finished
    is_done = os.path.exists(os.path.join(session_output_dir, "done.txt"))
    if is_done:
         status = "completed"
         message = "Processing completed successfully"
    elif is_processing:
         status = "processing"
         message = "Processing in progress..."
    else:
         status = "error"
         message = "Process failed or unknown status"

    return ProcessStatusResponse(
        session_id=session_id,
        status=status,
        files=files,
        message=message
    )


@app.get("/api/output/{session_id}/{path:path}")
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
            "output": "/api/output/{session_id}/{path}",
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
