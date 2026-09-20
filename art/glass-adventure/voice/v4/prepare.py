"""Verify D2 reaction masters, transcribe independently and export runtime MP3s."""
import array
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]
RUNTIME = REPO / "apps/beside-cue/public/games/adventure-voice-v2"
MODEL = Path("/home/maff/.dotfiles/personal/besidecue/assets/voice-auditions/2026-09-05-casting-review/speech-audit-v1/models/ggml-base.en.bin")
SECONDARY_MODEL = Path("/home/maff/.dotfiles/personal/besidecue/assets/voice-auditions/2026-09-05-es-de-v1/qa/models/ggml-medium.bin")


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def normalize(text):
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


batch = json.loads((ROOT / "batch.json").read_text())
RUNTIME.mkdir(parents=True, exist_ok=True)
(ROOT / "masters").mkdir(exist_ok=True)
audit = []
files = []
with tempfile.TemporaryDirectory(prefix="merc-reaction-audit-") as temp:
    for line in batch["lines"]:
        identity = line["id"]
        raw_path = ROOT / "raw" / f"{identity}.pcm"
        raw = raw_path.read_bytes()
        receipt = json.loads(raw_path.with_suffix(".json").read_text())
        assert receipt["status"] == "complete"
        assert receipt["sha256"] == sha(raw)
        samples = array.array("h", raw)
        peak = max(abs(value) for value in samples) / 32768
        clipped = sum(abs(value) >= 32767 for value in samples)
        assert clipped == 0, f"Clipped master: {identity}"
        rms = math.sqrt(sum((value / 32768) ** 2 for value in samples) / len(samples))
        master = ROOT / "masters" / f"merc-d2-{identity}.wav"
        common = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "s16le", "-ar", str(receipt["sample_rate_hz"]), "-ac", "1", "-i", str(raw_path)]
        run(common + ["-map_metadata", "-1", "-c:a", "pcm_s16le", str(master)])
        pcm16 = Path(temp) / f"{identity}.wav"
        run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(master), "-ar", "16000", str(pcm16)])
        asr_path = Path(temp) / identity
        run(["whisper-cli", "-m", str(MODEL), "-l", "en", "-ojf", "-of", str(asr_path), "-np", "-ng", str(pcm16)])
        asr = json.loads(asr_path.with_suffix(".json").read_text())
        transcript = " ".join(item["text"].strip() for item in asr["transcription"])
        entry = {
            "id": identity, "expected": line["text"], "independent_transcript": transcript,
            "normalized_exact_match": normalize(transcript) == normalize(line["text"]),
            "duration_seconds": receipt["duration_seconds"], "sample_rate_hz": receipt["sample_rate_hz"],
            "peak_dbfs": round(20 * math.log10(peak), 2),
            "rms_dbfs": round(20 * math.log10(rms), 2), "clipped_samples": clipped,
            "raw_sha256": sha(raw), "asr_model_sha256": sha(MODEL.read_bytes()),
        }
        entry["accepted_transcript_match"] = entry["normalized_exact_match"]
        if not entry["normalized_exact_match"]:
            secondary_path = Path(temp) / f"{identity}-medium"
            run(["whisper-cli", "-m", str(SECONDARY_MODEL), "-l", "en", "-ojf", "-of", str(secondary_path), "-np", "-ng", str(pcm16)])
            secondary = json.loads(secondary_path.with_suffix(".json").read_text())
            secondary_text = " ".join(item["text"].strip() for item in secondary["transcription"])
            entry["secondary"] = {"engine": "whisper.cpp medium", "independent_transcript": secondary_text,
                                  "asr_model_sha256": sha(SECONDARY_MODEL.read_bytes()), "expected_text_supplied": False}
            entry["accepted_transcript_match"] = normalize(secondary_text) == normalize(line["text"])
        audit.append(entry)
        output = RUNTIME / f"merc-d2-{identity}.mp3"
        run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(master), "-map_metadata", "-1", "-c:a", "libmp3lame", "-b:a", "128k", str(output)])
        output_bytes = output.read_bytes()
        files.append({"cue": identity, "assetId": f"merc-voice-{identity}", "text": line["text"], "file": output.name,
                      "source": str(master.relative_to(REPO)), "bytes": len(output_bytes), "sha256": sha(output_bytes)})
        print(json.dumps(entry))
(ROOT / "audio-audit.json").write_text(json.dumps({"engine": "whisper.cpp base.en", "expected_text_supplied": False, "lines": audit}, indent=2) + "\n")
(RUNTIME / "manifest.json").write_text(json.dumps({"version": 2, "character": "Merc", "voiceId": batch["voice_id"],
                                                "selection": "D2 Gentle Whimsical", "model": batch["model_id"], "files": files}, indent=2) + "\n")
if not all(item["accepted_transcript_match"] for item in audit):
    raise SystemExit("Inspect transcript differences before accepting these recordings.")
