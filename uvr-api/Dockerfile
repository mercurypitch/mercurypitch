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
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

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
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
