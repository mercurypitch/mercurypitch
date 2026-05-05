# ============================================================
# UVR Audio Separator API Dockerfile
# ============================================================

FROM python:3.11-slim

# Set environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHOME=/app \
    PATH=/app/.local/bin:$PATH

# Tell Linux to look inside PyTorch for missing AMD GPU libraries
#ENV LD_LIBRARY_PATH="/usr/local/lib/python3.11/site-packages/torch/lib:$LD_LIBRARY_PATH"
# Trying with ROCM 7.2
# Force ROCm 6.2 to treat the RDNA 4 GPU as an RDNA 3 (RX 7000 series) GPU
#ENV HSA_OVERRIDE_GFX_VERSION=11.0.0

# Combine all system installations into ONE layer to prevent cache bloat
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    ffmpeg \
    wget \
    && wget http://archive.ubuntu.com/ubuntu/pool/universe/p/prelink/execstack_0.0.20131005-1.1_amd64.deb \
    && apt-get install -y --no-install-recommends ./execstack_0.0.20131005-1.1_amd64.deb \
    && rm execstack_0.0.20131005-1.1_amd64.deb \
    && apt-get remove -y wget \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .

# The MEGA-RUN: Install PyTorch ROCm, install requirements, uninstall CPU versions, and install ROCm ONNX in ONE layer
RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm7.2 --no-cache-dir \
    && pip install --no-cache-dir -r requirements.txt \
    && pip uninstall -y onnxruntime onnxruntime-gpu \
    && pip install --no-cache-dir onnxruntime-rocm \
    && find /usr/local/lib/python3.11/site-packages/onnxruntime -name "*.so" -exec execstack -c {} \;

# Create symlinks for ONNX Runtime to find the PyTorch AMD libraries
#RUN ln -s /usr/local/lib/python3.11/site-packages/torch/lib/libhipblas.so /usr/local/lib/python3.11/site-packages/torch/lib/libhipblas.so.2 \
#    && ln -s /usr/local/lib/python3.11/site-packages/torch/lib/librocm_smi64.so /usr/local/lib/python3.11/site-packages/torch/lib/librocm_smi64.so.7 \
#    && ln -s /usr/local/lib/python3.11/site-packages/torch/lib/libamdhip64.so /usr/local/lib/python3.11/site-packages/torch/lib/libamdhip64.so.6

# Create output directories
RUN mkdir -p /app/output /app/uploads /tmp/uvr

# Copy API server
COPY api.py .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
