# ============================================================
# MercuryPitch — RunPod Serverless Vocal Separation (CUDA/GPU)
# ============================================================
# Build & push (pinned version tag), then point a RunPod serverless
# endpoint at the image:
#   docker build -t <registry>/mercurypitch-uvr-runpod:v0.2.1 runpod/
#   docker push  <registry>/mercurypitch-uvr-runpod:v0.2.1
# See runpod/README.md for the full deploy + cost-measurement runbook.
# ============================================================
FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive \
    UVR_MODEL_DIR=/models \
    UVR_DEFAULT_MODEL=roformer \
    UVR_EAGER_LOAD=1

WORKDIR /app

# Use the distro python3 (3.10 on ubuntu22.04) consistently: python3-pip
# targets the distro interpreter, so pairing it with a separate python3.11
# splits pip's site-packages from the `python` that runs — imports vanish.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-dev ffmpeg \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Torch + onnxruntime from CUDA wheels, then the rest of the deps. A smaller
# image pulls faster onto a fresh worker, which shortens (billable) cold
# starts — so install lean and strip caches afterwards. `python -m pip`
# guarantees packages land in the same interpreter that runs the handler.
RUN python -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124 \
    && python -m pip install onnxruntime-gpu \
    && python -m pip install -r requirements.txt \
    && (find /usr/local/lib -name "__pycache__" -type d -prune -exec rm -rf {} + 2>/dev/null || true) \
    && rm -rf /root/.cache

# Pre-bake every registry model so a cold worker never re-downloads weights
# on a job. RunPod bills per second from worker start, so re-downloading
# weights on every cold start is pure wasted spend — baking removes it.
# Keep this list in sync with MODEL_REGISTRY in handler.py. Loading each
# model at build (CPU, no GPU — onnxruntime warning is normal) both fetches
# the weights and validates the file names against the installed
# audio-separator release. Adds ~2 GB to the image; disk is 20 GB.
# Baked BEFORE the handler COPY on purpose: a handler-only change must not
# invalidate this layer (each re-bake re-downloads ~2.5 GB of weights).
RUN python -c "from audio_separator.separator import Separator; \
import os; os.makedirs('/models', exist_ok=True); \
s = Separator(model_file_dir='/models'); \
[s.load_model(model_filename=m) for m in ( \
    'model_bs_roformer_ep_317_sdr_12.9755.ckpt', \
    'UVR-MDX-NET-Inst_HQ_3.onnx', \
    'mel_band_roformer_karaoke_aufr33_viperx_sdr_10.1956.ckpt', \
    'vocals_mel_band_roformer.ckpt', \
)]"

COPY handler.py .
COPY test_input.json .

# The handler pre-loads this model at startup (UVR_EAGER_LOAD=1) so FlashBoot
# can snapshot the warmed worker and restore it in ~2s on later cold starts.
CMD ["python", "-u", "handler.py"]
