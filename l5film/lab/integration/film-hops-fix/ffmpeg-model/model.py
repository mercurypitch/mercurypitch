# The renderer's extraction (HyperFrames 0.8.97, extractVideoFramesRange) run on a synthetic pass whose
# frame i is a flat gray of 3i+16: which source frame lands on each extracted frame k, against the model
# the kit now uses (L.passFrame) and against the two older readings.
import subprocess, sys, math
src, ms = 'synth.webm', 0.050
def extract(F):
    cmd = ['ffmpeg', '-v', 'error', '-noaccurate_seek', '-ss', str(ms), '-i', src, '-t', '2.4',
           '-vf', f'settb=intb/2,setpts=PTS-lte(TB\\,0.001),fps={F}:start_time=0:round=up',
           '-f', 'rawvideo', '-pix_fmt', 'gray', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    n = 64 * 64
    return [round((sum(raw[j * n:(j + 1) * n]) / n - 16) / 3) for j in range(len(raw) // n)]
def model(k, F, pf=30):
    lim = 1000 * ms + 0.5 + 1000 * k / F + 1e-6
    i = math.floor(lim / 1000 * pf) + 1
    while i > 0 and round(i * 1000 / pf) > lim: i -= 1
    return i
out = []
for F in (30, 60):
    got = extract(F)
    bad = [k for k, g in enumerate(got) if g != model(k, F)]
    prop = [k for k, g in enumerate(got) if g != math.floor(ms * 30 + 1e-6) + math.floor(k / F * 30 + 1e-6)]
    old = [k for k, g in enumerate(got) if g != math.floor((k / F + ms) * 30 + 1e-6)]
    out.append(f'F={F}: {len(got)} extracted frames; model mismatches {len(bad)} {bad[:8]}; '
               f'floor(30 ms)+floor(30 (t-ds)) mismatches {len(prop)} {prop[:8]}; floor(30 (t-ds+ms)) mismatches {len(old)} {old[:8]}')
    out.append('   k: ' + ' '.join(f'{k}:{g}' for k, g in enumerate(got[:16])))
print('\n'.join(out))
