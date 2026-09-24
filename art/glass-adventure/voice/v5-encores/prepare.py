"""Retain Merc D2's spectral character while singing the game's authored contour."""
import hashlib
import json
from pathlib import Path
import subprocess

import numpy as np
import pyworld
import soundfile as sf
from scipy.interpolate import interp1d

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "delivery"
OUTPUT.mkdir(exist_ok=True)
FRAME = 0.005
LEAD = 0.12
TAIL = 0.16

for identity in ("light-a", "home-a"):
    source_path = ROOT / "raw" / f"{identity}.wav"
    source, rate = sf.read(source_path, dtype="float64")
    source = np.ascontiguousarray(source)
    definition = json.loads((ROOT / "analysis" / f"{identity}-contour.json").read_text())
    alignment = json.loads((ROOT / "analysis" / f"{identity}-alignment.json").read_text())
    words = [word for word in alignment["words"] if word["text"].strip()]
    anchors = definition["contour"]["anchors"]
    duration = definition["contour"]["durationSeconds"]
    assert len(words) == len(anchors)
    f0, source_times = pyworld.harvest(source, rate, f0_floor=60, f0_ceil=500, frame_period=FRAME * 1000)
    f0 = pyworld.stonemask(source, f0, source_times, rate)
    spectral = pyworld.cheaptrick(source, f0, source_times, rate)
    aperiodic = pyworld.d4c(source, f0, source_times, rate)
    # Preserve consonant attacks/releases, using the vowel core for the extra
    # duration. Map word boundaries to each next landing; the outgoing vowel
    # carries the glide rather than jumping to disconnected held pitches.
    edges = [0] + [(a["end"] + b["start"]) / 2 for a, b in zip(words, words[1:])] + [len(source) / rate]
    target_edges = [anchor["startSeconds"] for anchor in anchors] + [duration]
    map_source, map_target = [], []
    for index in range(len(words)):
        start, end = edges[index:index + 2]
        target_start, target_end = target_edges[index:index + 2]
        attack = min(0.14, (end - start) * 0.25)
        release = min(0.10, (end - start) * 0.18)
        map_source.extend([start, start + attack, end - release])
        map_target.extend([target_start, target_start + attack, target_end - release])
    map_source.append(edges[-1]); map_target.append(duration)
    output_times = np.arange(0, duration + TAIL + FRAME / 2, FRAME)
    warped_times = np.interp(np.minimum(output_times, duration), map_target, map_source)
    sp = interp1d(source_times, spectral, axis=0, bounds_error=False, fill_value=(spectral[0], spectral[-1]))(warped_times)
    ap = interp1d(source_times, aperiodic, axis=0, bounds_error=False, fill_value=(aperiodic[0], aperiodic[-1]))(warped_times)
    closest = np.minimum(np.rint(warped_times / FRAME).astype(int), len(f0) - 1)
    expected_midi = np.interp(np.minimum(output_times, duration), [p["time"] for p in definition["points"]], [p["midi"] for p in definition["points"]])
    pitch = 440 * np.power(2, (expected_midi - 69) / 12)
    pitch[f0[closest] == 0] = 0
    resynthesis = pyworld.synthesize(np.ascontiguousarray(pitch), np.ascontiguousarray(sp), np.ascontiguousarray(ap), rate, FRAME * 1000)
    # A short natural release avoids the abrupt ending of the original TTS file.
    envelope = np.ones(len(resynthesis))
    fade_start = int((duration - 0.035) * rate)
    envelope[fade_start:] = np.linspace(1, 0, len(envelope) - fade_start) ** 2
    envelope[:int(rate * 0.012)] = np.linspace(0, 1, int(rate * 0.012))
    resynthesis *= envelope
    resynthesis = np.concatenate([np.zeros(round(LEAD * rate)), resynthesis])
    peak = max(1e-9, np.max(np.abs(resynthesis)))
    resynthesis *= min(0.79 / peak, 2)
    master = OUTPUT / f"merc-{identity}-master.wav"
    sf.write(master, resynthesis, rate, subtype="PCM_24")
    delivery = OUTPUT / f"merc-{identity}-v5.mp3"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(master), "-af", "loudnorm=I=-20:TP=-2:LRA=9", "-ar", "24000", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", str(delivery)], check=True)
    decoded = OUTPUT / f"merc-{identity}-decoded.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(delivery), "-ar", "24000", str(decoded)], check=True)
    y, sr = sf.read(decoded, dtype="float64")
    measured, t = pyworld.harvest(np.ascontiguousarray(y), sr, f0_floor=85, f0_ceil=300, frame_period=5)
    measured = pyworld.stonemask(np.ascontiguousarray(y), measured, t, sr)
    valid = (measured > 0) & (t >= LEAD + 0.08) & (t < LEAD + duration - 0.08)
    ideal = np.interp(t[valid] - LEAD, [p["time"] for p in definition["points"]], [p["midi"] for p in definition["points"]])
    cents = 100 * (69 + 12 * np.log2(measured[valid] / 440) - ideal)
    report = dict(source=identity, melody=definition["contour"]["id"], rootMidi=50,
        method="WORLD source spectral/aperiodic envelopes, consonant-preserving word time map, exact game contour resynthesis; MP3 independently reanalysed",
        leadingSeconds=LEAD, phraseSeconds=duration, trailingSeconds=TAIL,
        sourceSha256=hashlib.sha256(source_path.read_bytes()).hexdigest(),
        deliverySha256=hashlib.sha256(delivery.read_bytes()).hexdigest(), deliveryBytes=delivery.stat().st_size,
        durationSeconds=len(y)/sr, sampleRate=sr, peakDb=float(20*np.log10(max(1e-9,np.max(np.abs(y))))),
        measuredVoicedFrames=int(valid.sum()), medianAbsoluteCents=float(np.median(np.abs(cents))), p95AbsoluteCents=float(np.percentile(np.abs(cents),95)),
        maps={"sourceSeconds":map_source,"targetSeconds":map_target})
    (ROOT / "analysis" / f"{identity}-production.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report), flush=True)
