#!/usr/bin/env python3
"""Prepare approved full-take loop derivatives without changing the archived masters."""
from pathlib import Path
import hashlib
import json
import subprocess
import numpy as np

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]
OUT = REPO / 'apps/beside-cue/public/games/adventure-audio-v1'
DERIVATIVES = ROOT / 'runtime-derivatives'


def run(args, data=None):
    return subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def overlap(samples, frames):
    weight = (1 - np.cos(np.pi * np.arange(frames) / (frames - 1)))[:, None] / 2
    return np.concatenate((samples[frames:-frames], samples[-frames:] * (1 - weight) + samples[:frames] * weight)).astype('<f4')


def decode(path, rate):
    return np.frombuffer(run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ar', str(rate), '-ac', '2', '-']), dtype='<f4').reshape(-1, 2)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    DERIVATIVES.mkdir(parents=True, exist_ok=True)
    intake = json.loads((ROOT / 'intake.json').read_text())
    result = []
    for cue in ['M01', 'M03', 'A01', 'A02', 'A03']:
        row = next(row for row in intake['tracks'] if row['id'] == cue and row['take'] == 'v1')
        master = ROOT / row['master']
        assert sha(master) == row['sha256'], f'Master hash changed: {master}'
        rate = 48000
        samples = decode(master, rate)
        samples = samples * 10 ** (row['audition']['gainDb'] / 20)
        seconds = 3.0 if cue.startswith('M') else 1.5
        loop = overlap(samples, round(rate * seconds))
        lossless = DERIVATIVES / f'{cue.lower()}-loop.flac'
        runtime = OUT / f'{cue.lower()}-loop.mp3'
        run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(rate), '-ac', '2', '-i', '-', '-map_metadata', '-1', '-c:a', 'flac', '-sample_fmt', 's32', '-bits_per_raw_sample', '24', str(lossless)], loop.tobytes())
        run(['ffmpeg', '-v', 'error', '-y', '-i', str(lossless), '-map_metadata', '-1', '-c:a', 'libmp3lame', '-q:a', '3', '-ar', '44100', '-ac', '2', str(runtime)])
        decoded = decode(runtime, 44100)
        repaired = overlap(decoded, round(44100 * 0.08))
        assert float(np.max(np.abs(repaired))) < 0.95, 'Unexpected clipping risk'
        # Save a short inspectable seam audition from the actual MP3 decode plus
        # the same sample-domain repair used in the browser. No runtime WAVs.
        seam = np.concatenate((repaired[-3 * 44100:], repaired[:3 * 44100]))
        proof = DERIVATIVES / f'{cue.lower()}-seam-audition.wav'
        run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', '44100', '-ac', '2', '-i', '-', '-c:a', 'pcm_s24le', str(proof)], seam.tobytes())
        stats = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(runtime), '-af', 'loudnorm=I=-20:TP=-2:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True, check=True).stderr
        measured, _ = json.JSONDecoder().raw_decode(stats[stats.rindex('{'):])
        result.append({
            'id': f'audio-{cue.lower()}-loop', 'cue': cue, 'take': 'v1',
            'source': row['master'], 'sourceSha256': row['sha256'],
            'gainDb': row['audition']['gainDb'], 'authoredOverlapSeconds': seconds,
            'overlap': 'constant-sum raised cosine, tail to head; middle retained verbatim after gain',
            'lossless': str(lossless.relative_to(ROOT)), 'losslessSha256': sha(lossless),
            'losslessFormat': 'stereo48kHz FLAC24', 'losslessDurationSeconds': len(loop) / rate,
            'runtime': str(runtime.relative_to(REPO)), 'runtimeSha256': sha(runtime),
            'runtimeBytes': runtime.stat().st_size, 'runtimeFormat': 'stereo44.1kHz MP3 VBR q3',
            'decodedDurationSeconds': len(decoded) / 44100, 'decodedRepairOverlapSeconds': 0.08,
            'repairedLoopSeconds': len(repaired) / 44100,
            'repairedBoundaryMaxStep': float(np.max(np.abs(repaired[-1] - repaired[0]))),
            'repairedMaxSample': float(np.max(np.abs(repaired))),
            'measuredRuntimeLufs': float(measured['input_i']), 'measuredRuntimeTruePeakDbTP': float(measured['input_tp']),
            'seamAudition': str(proof.relative_to(ROOT)), 'seamAuditionSha256': sha(proof),
            'fullDecode': 'passed',
        })
        assert sha(master) == row['sha256'], 'Master modified during preparation'
        print(f'{cue}: {len(repaired)/44100:.2f}s, {runtime.stat().st_size} bytes, seam step {result[-1]["repairedBoundaryMaxStep"]:.7f}', flush=True)
    manifest = {
        'version': 1, 'preparedDate': '2026-09-15',
        'approval': 'M01 main, M03 garden, all ambience approved; A03v1 selected; M02 retained only in source archive; M04-M06 deferred',
        'mastersUnchanged': True, 'codecPadding': 'Runtime repeats an AudioBuffer repaired from actual decoded samples; it does not assume MP3 encoder delay metadata.',
        'runtimeBytes': sum(row['runtimeBytes'] for row in result), 'tracks': result,
        'validation': 'All delivery files decoded, hashes verified, peak and seam samples measured. Musical loop transitions remain subject to real-device owner audition.',
    }
    (ROOT / 'runtime-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
