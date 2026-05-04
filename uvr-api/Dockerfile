# ============================================================
# UVR Audio Separator API Dockerfile
# ============================================================

FROM python:3.11-slim

# Set environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHOME=/app \
    PATH=/app/.local/bin:$PATH

# For diffq, wheels package compilaton
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install FFmpeg (required for audio-separator)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    execstack \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm7.2 --no-cache-dir

# 1. Install your normal requirements first
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2. Rip out any NVIDIA/Standard ONNX packages that audio-separator downloaded
RUN pip uninstall -y onnxruntime onnxruntime-gpu

# 3. Force the AMD ROCm ONNX Runtime
RUN pip install --no-cache-dir onnxruntime-rocm 
RUN find /usr/local/lib/python3.11/site-packages/onnxruntime -name "*.so" -exec execstack -c {} \;

# Create output directories
RUN mkdir -p /app/output /app/uploads /tmp/uvr

# Copy API server
COPY api.py .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run server
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
