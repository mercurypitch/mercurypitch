#!/bin/bash
# Rebuild the local Kokoro TTS environment the film tools expect.
set -u
S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
cd "$S"
echo "venv: $(date -u +%T)"
python3 -m venv "$S/tts-venv" && "$S/tts-venv/bin/pip" install -q kokoro-onnx soundfile numpy 2>&1 | tail -3
"$S/tts-venv/bin/python" -c "import kokoro_onnx, soundfile, numpy; print('kokoro-onnx', kokoro_onnx.__version__ if hasattr(kokoro_onnx,'__version__') else '?')"
mkdir -p /root/.cache/hyperframes/tts/models /root/.cache/hyperframes/tts/voices
B=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
echo "models: $(date -u +%T)"
curl -sSL --retry 3 -o /root/.cache/hyperframes/tts/models/kokoro-v1.0.onnx "$B/kokoro-v1.0.onnx" && echo onnx ok
curl -sSL --retry 3 -o /root/.cache/hyperframes/tts/voices/voices-v1.0.bin "$B/voices-v1.0.bin" && echo voices ok
ls -la /root/.cache/hyperframes/tts/models /root/.cache/hyperframes/tts/voices
sha256sum /root/.cache/hyperframes/tts/models/kokoro-v1.0.onnx /root/.cache/hyperframes/tts/voices/voices-v1.0.bin
echo "done: $(date -u +%T)"
