# UVR Web Integration Research

**Goal:** Integrate python-audio-separator (Ultimate Vocal Remover) into MercuryPitch web app

**Date:** 2026-05-03
**Tool:** [python-audio-separator](https://github.com/nomadkaraoke/python-audio-separator) by nomadkaraoke
**Based on:** UVR architecture (MDX-Net, VR Architecture, Demucs, MDXC)

---

## Overview

python-audio-separator is a CLI tool for separating audio into stems using UVR models. It supports:
- 2-stem separation (vocals/instrumental)
- 4-stem and 6-stem separation (Demucs)
- Multiple architectures: MDX, VR, Demucs, MDXC
- GPU acceleration via CUDA
- Batch processing
- Remote API support

---

## Integration Approaches

### Option 1: Backend Server with Docker (RECOMMENDED)

**Architecture:**
```
MercuryPitch Web App ← HTTP/WebSocket → Python Audio Separator (Docker)
                                           ↓
                                    Volume Storage
```

**Implementation:**

#### 1.1 Docker Deployment

**Dockerfile:**
```dockerfile
FROM python:3.11-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Install Python dependencies
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create output directory
RUN mkdir -p /app/output

EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
```

**requirements.txt:**
```txt
audio-separator[gpu]
fastapi uvicorn
python-multipart
```

#### 1.2 FastAPI Server

```python
# api.py
from fastapi import FastAPI, UploadFile, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uuid
import shutil
import os
from audio_separator.separator import Separator
import logging

app = FastAPI(title="UVR Audio Separator")

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Separator instance (cached)
separator = None

@app.get("/health")
async def health():
    return {"status": "healthy", "version": "1.0"}

@app.get("/models")
async def list_models():
    if separator is None:
        return {"error": "Not initialized"}
    return {"models": separator.list_available_models()}

class ProcessRequest(BaseModel):
    model: str = "MDX-Net"
    output_format: str = "WAV"
    stems: list[str] = ["vocal", "instrumental"]

@app.post("/process")
async def process_audio(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    model: str = "UVR-MDX-NET-Inst_HQ",
    output_format: str = "WAV",
    stems: list[str] = ["vocal", "instrumental"]
):
    session_id = str(uuid.uuid4())
    input_dir = f"/tmp/uvr/{session_id}"
    output_dir = f"/app/output/{session_id}"

    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    # Save uploaded file
    input_path = os.path.join(input_dir, f"input.{output_format.lower()}")
    with open(input_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Process in background
    async def process_task():
        try:
            sep = Separator()
            sep.load_model(model_name=model)
            sep.separate(input_path, output_dir=output_dir, output_format=output_format)
        except Exception as e:
            logger.error(f"Processing error: {e}")

    background_tasks.add_task(process_task)

    return {
        "session_id": session_id,
        "status": "processing",
        "input_path": input_path,
        "output_dir": output_dir
    }

@app.get("/status/{session_id}")
async def get_status(session_id: str):
    output_dir = f"/app/output/{session_id}"
    if not os.path.exists(output_dir):
        return {"status": "not_started"}

    files = []
    for root, _, filenames in os.walk(output_dir):
        for filename in filenames:
            if filename.endswith((".wav", ".mp3", ".flac")):
                rel_path = os.path.relpath(root, output_dir)
                stem = os.path.basename(rel_path) if rel_path != "." else "root"
                files.append({
                    "stem": stem,
                    "path": f"/api/output/{session_id}/{filename}"
                })

    return {
        "status": "completed" if files else "processing",
        "files": files
    }

@app.get("/api/output/{session_id}/{filename}")
async def get_output(session_id: str, filename: str):
    file_path = f"/app/output/{session_id}/{filename}"
    if not os.path.exists(file_path):
        return JSONResponse(status_code=404, content={"error": "File not found"})
    return FileResponse(file_path, media_type="audio/wav")
```

#### 1.3 CORS Configuration

Add CORS to allow web app to communicate with the API:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://mercurypitch.com", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 1.4 Web App Integration

```typescript
// src/lib/uvr-api.ts
const API_BASE = '/api/uvr'

export interface ProcessResponse {
  session_id: string
  status: string
  input_path: string
  output_dir: string
}

export interface ProcessStatus {
  status: string
  files: Array<{ stem: string; path: string }>
}

export async function processAudio(file: File, model: string) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('model', model)
  formData.append('output_format', 'WAV')

  const response = await fetch(`${API_BASE}/process`, {
    method: 'POST',
    body: formData,
  })

  return response.json() as Promise<ProcessResponse>
}

export async function getProcessStatus(sessionId: string) {
  const response = await fetch(`${API_BASE}/status/${sessionId}`)
  return response.json() as Promise<ProcessStatus>
}

export async function getOutputFile(sessionId: string, filename: string) {
  const response = await fetch(`${API_BASE}/output/${sessionId}/${filename}`)
  return response
}
```

**Pros:**
- ✅ Fast and efficient
- ✅ GPU acceleration available
- ✅ Can handle large audio files
- ✅ Persistent output storage
- ✅ Scalable to multiple users
- ✅ Can deploy on any server (heroku, render, droplet, etc.)

**Cons:**
- ❌ Requires server deployment
- ❌ User uploads go to server (privacy concerns)
- ❌ Processing time depends on server
- ❌ Additional infrastructure to maintain

---

### Option 2: Modal.com Serverless Deployment

**What is Modal:**
[Modal](https://modal.com) is a serverless platform for running Python workloads with low cold-start latency.

**Advantages:**
- Zero infrastructure management
- Auto-scaling based on load
- GPU support included
- Built-in logging and monitoring
- Easy deployment from GitHub

**Implementation:**

Create `modal.py`:
```python
import modal

app = modal.App("pitchperfect-uvr")

# Volume for persisting models and output
volume = modal.Volume.from_name("uvr-models", create_if_missing=True)

@app.function(
    image=modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "audio-separator[gpu]",
        "fastapi",
        "uvicorn",
        "ffmpeg-python"
    ),
    timeout=300,  # 5 minutes max
    memory=4096,
    gpu="T4",  # Or "A100" for faster processing
)
def process_audio(model_name: str, file_bytes: bytes, output_format: str = "WAV"):
    import io
    import os
    from audio_separator.separator import Separator

    # Save input
    input_path = "/tmp/input.wav"
    with open(input_path, "wb") as f:
        f.write(file_bytes)

    # Setup output
    output_dir = "/tmp/output"
    os.makedirs(output_dir, exist_ok=True)

    # Process
    sep = Separator()
    sep.load_model(model_name=model_name)
    sep.separate(input_path, output_dir=output_dir, output_format=output_format)

    # Read output files
    outputs = []
    for root, _, filenames in os.walk(output_dir):
        for filename in filenames:
            outputs.append({
                "stem": os.path.basename(root),
                "content": open(os.path.join(root, filename), "rb").read()
            })

    return outputs

@app.local_entrypoint()
def serve():
    import uvicorn
    uvicorn.run("modal_app:app", host="0.0.0.0", port=8000)
```

**Deployment:**
```bash
modal deploy modal.py
```

**Pros:**
- ✅ No server management
- ✅ Auto-scaling
- ✅ GPU available
- ✅ Easy deployment
- ✅ Pay-per-use

**Cons:**
- ❌ Cost per execution
- ❌ Cold start latency (~1-3 seconds)
- ❌ Dependencies on Modal service
- ❌ Output volume size limits

---

### Option 3: Self-Hosted Droplet (DigitalOcean, Vultr, etc.)

**Setup:**
1. Deploy Ubuntu 22.04 Droplet
2. Install Docker
3. Run python-audio-separator container
4. Expose via nginx reverse proxy

**Docker Compose:**
```yaml
version: '3.8'
services:
  uvr-api:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./models:/app/models
      - ./output:/app/output
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    environment:
      - CUDA_VISIBLE_DEVICES=0

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - uvr-api
```

**Pros:**
- ✅ Full control
- ✅ No external service dependencies
- ✅ Can use own GPU
- ✅ Data stays on your server

**Cons:**
- ❌ Infrastructure costs ($5-20/month)
- ❌ Must manage updates/security
- ❌ Manual scaling

---

### Option 4: Python API Direct Integration (No Server)

**Concept:** Run python-audio-separator locally on the user's machine via CLI.

**Implementation:**
```typescript
// Ask user to install python-audio-separator and FFmpeg
// Use child_process to execute
import { exec } from 'child_process'

async function processLocally(audioPath: string, outputPath: string) {
  return new Promise((resolve, reject) => {
    exec(
      `audio-separator "${audioPath}" -o "${outputPath}"`,
      (error, stdout, stderr) => {
        if (error) reject(error)
        else resolve(stdout)
      }
    )
  })
}
```

**Pros:**
- ✅ No server needed
- ✅ No privacy concerns
- ✅ No infrastructure cost

**Cons:**
- ❌ Requires user to install Python/FFmpeg
- ❌ User's hardware limitations
- ❌ Can't handle large files on slow machines
- ❌ No concurrent processing
- ❌ Complex setup for users

---

### Option 5: ONNX Runtime Web (Browser-Based) - RESEARCH ONLY

**What is it:**
ONNX Runtime Web allows running ONNX models directly in the browser using WebGL or WebAssembly.

**Architecture:**
```
MercuryPitch Web App → Browser → ONNX Runtime Web → Model (WASM)
                          ↓
                      Web Audio API
```

**Implementation:**
```typescript
import { Ort } from 'onnxruntime-web'

async function init() {
  await Ort.InferenceSession.create('model.onnx', {
    useWasm: true,
    wasmSimd: true,
    executionProviders: ['wasm', 'webgl']
  })
}
```

**Issues with UVR Models:**
- UVR models (MDX-Net, VR) are complex PyTorch models
- Models need to be converted to ONNX format
- Large model sizes (100MB-1GB+)
- Browser memory limitations (~2GB max)
- Performance is slower than GPU

**Conversion Process:**
1. Convert PyTorch → ONNX
2. Optimize model (quantization, pruning)
3. Compress for web

**Pros:**
- ✅ Works entirely in browser
- ✅ No server needed
- ✅ Data stays on client

**Cons:**
- ❌ Cannot run full UVR models (too large/slow)
- ❌ Requires model conversion effort
- ❌ Limited performance vs server
- ❌ Browser compatibility issues

---

### Option 6: WebContainers (StackBlitz) - RESEARCH ONLY

**What is it:**
StackBlitz provides browser-based development environments with full Node.js runtime.

**Potential Use:**
- Allow users to process audio directly in their browser session
- Shareable processing sessions

**Implementation:**
```typescript
// Interact with WebContainer API
const container = await webContainer.boot()

// Install dependencies inside browser
await container.spawn('npm', ['install', 'audio-separator'])
await container.spawn('audio-separator', ['--help'])
```

**Pros:**
- ✅ Browser-based
- ✅ Stateful sessions
- ✅ No user setup

**Cons:**
- ❌ Experimental
- ❌ Limited resources
- ❌ Not suitable for production
- ❌ Session management complexity

---

## Recommended Approach

### Primary: Option 1 - Backend Server with Docker

**Why:**
1. **Performance**: GPU-accelerated processing
2. **Scalability**: Handle multiple users concurrently
3. **Reliability**: Persistent storage, stable hosting
4. **Privacy**: Option to use S3/Cloud storage instead of server

### Deployment Plan:

#### Phase 1: Development Server
```bash
# Local development
docker build -t pitchperfect-uvr .
docker run -p 8000:8000 --gpus all -v $(pwd)/output:/app/output pitchperfect-uvr
```

#### Phase 2: Production Deploy
```bash
# On your existing server
docker build -t pitchperfect-uvr .
docker run -d -p 8000:8000 \
  --gpus all \
  --restart unless-stopped \
  -v /var/www/mercurypitch.com/uvr-output:/app/output \
  pitchperfect-uvr
```

#### Phase 3: Integration with MercuryPitch

Update `UvrPanel.tsx` to use real API:

```typescript
import { processAudio, getProcessStatus } from '@/lib/uvr-api'

const handleProcessStart = async (sessionId: string) => {
  if (!selectedFile()) return

  // Upload file to server
  const formData = new FormData()
  formData.append('file', selectedFile()!)
  formData.append('model', currentSettings().model)

  const response = await fetch('/api/uvr/process', {
    method: 'POST',
    body: formData,
  })

  const { session_id } = await response.json()

  // Poll for status
  const interval = setInterval(async () => {
    const status = await getProcessStatus(session_id)
    updateUvrSessionProgress(session_id, (status.progress || 0))

    if (status.status === 'completed') {
      clearInterval(interval)
      const outputs = status.files.map(f => ({
        vocal: `/uvr/output/${session_id}/${getFileName(f.stem, 'vocal')}.wav`,
        instrumental: `/uvr/output/${session_id}/${getFileName(f.stem, 'instrumental')}.wav`,
      }))
      completeUvrSession(session_id, outputs)
    }
  }, 1000)
}
```

---

## Implementation Checklist

### Pre-implementation:
- [ ] Set up python environment on server
- [ ] Install FFmpeg
- [ ] Download required UVR models
- [ ] Test python-audio-separator CLI locally

### Server Setup:
- [ ] Create Dockerfile for API server
- [ ] Build Docker image
- [ ] Deploy to production server
- [ ] Configure CORS
- [ ] Set up output volume/persistence
- [ ] Configure NGINX reverse proxy

### Web Integration:
- [ ] Create `uvr-api.ts` service
- [ ] Update `UvrPanel.tsx` to use API
- [ ] Add progress polling mechanism
- [ ] Update `UvrResultViewer.tsx` to show real file paths
- [ ] Add error handling
- [ ] Add retry logic

### Testing:
- [ ] Test with sample MP3 files
- [ ] Verify vocal/instrumental separation quality
- [ ] Test concurrent processing
- [ ] Verify session management
- [ ] Test output file serving

---

## Required Infrastructure

### Hardware:
- **CPU**: 4+ cores recommended
- **Memory**: 8GB+ (more for GPU models)
- **GPU**: Optional but highly recommended for faster processing

### Storage:
- **Models**: ~1-5GB (UVR models)
- **Output**: At least 10GB per 100GB of input audio
- **Temp**: ~2-3GB for processing

### Software:
- **OS**: Ubuntu 22.04 or similar
- **Docker**: Latest version
- **NVIDIA Docker**: For GPU support
- **FFmpeg**: For audio conversion

---

## Cost Considerations

### Development:
- Compute time: Free (local machine)

### Production (Self-Hosted):
- Server: $5-20/month (VPS)
- Storage: $0.10/GB/month
- Bandwidth: Limited on VPS
- **Total: ~$20/month**

### Production (Cloud Platform):
- Modal: $0.00073/GB-sec + GPU usage
- Heroku: Free tier + $7/month dyno
- Render: $7/month + storage costs
- **Total: $10-50/month depending on usage**

---

## References

- [python-audio-separator GitHub](https://github.com/nomadkaraoke/python-audio-separator)
- [Ultimate Vocal Remover GUI](https://github.com/Anjok07/ultimatevocalremovergui)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-web.html)
- [Modal Platform](https://modal.com)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

---

## Next Steps

1. Review this research and select recommended approach
2. Set up local Python environment with python-audio-separator
3. Test CLI locally with sample audio files
4. Build and test Docker container
5. Deploy to development server
6. Integrate with MercuryPitch web app
7. Test end-to-end workflow
8. Deploy to production

---

## Notes

- **Session Management**: Ensure session IDs are unique and persisted
- **File Cleanup**: Add periodic cleanup of old processing sessions
- **Rate Limiting**: Implement rate limiting to prevent abuse
- **Model Selection**: Allow users to select between models based on quality vs speed
- **GPU Priority**: Implement queuing system for GPU processing
- **Error Handling**: Robust error handling for file I/O and processing errors
