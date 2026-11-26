"""Look at imported takes closely: the trimmed waveform's edges, the envelope, and the word times
against the envelope's onsets. python3 lab/voices-import/look.py <project> <id> [...]
Writes lab/voices-import/look/<id>.png and prints the numbers. Reads only assets/voice/."""
import json, os, sys, wave
import numpy as np
from PIL import Image, ImageDraw
ROOT = sys.argv[1]
OUT = os.path.join(ROOT, 'lab', 'voices-import', 'look')
os.makedirs(OUT, exist_ok=True)
VOICED = 0.04
def read(path):
    w = wave.open(path); n = w.getnframes(); sr = w.getframerate()
    assert w.getnchannels() == 1 and w.getsampwidth() == 2
    return np.frombuffer(w.readframes(n), dtype='<i2').astype(np.float64) / 32768, sr
def panel(d, x0, y0, W, H, x, sr, t0, t1, env, words, title):
    d.rectangle([x0, y0, x0 + W, y0 + H], outline=(70, 70, 70))
    d.text((x0 + 4, y0 + 2), title, fill=(200, 200, 200))
    mid, amp = y0 + H / 2, H / 2 - 12
    peak = max(1e-6, np.abs(x).max())
    a, b = int(t0 * sr), min(len(x), int(t1 * sr))
    for px in range(W):
        i0 = a + (b - a) * px // W; i1 = max(i0 + 1, a + (b - a) * (px + 1) // W)
        seg = x[i0:i1]
        if len(seg):
            d.line([x0 + px, mid - seg.max() / peak * amp, x0 + px, mid - seg.min() / peak * amp], fill=(120, 170, 255))
    # the envelope (0..1), drawn upward from the panel's foot
    pts = []
    for k, v in enumerate(env['level']):
        t = k / env['rate']
        if t0 <= t <= t1:
            pts.append((x0 + (t - t0) / (t1 - t0) * W, y0 + H - 4 - v * (H / 2 - 16)))
    if len(pts) > 1: d.line(pts, fill=(255, 190, 60), width=2)
    yv = y0 + H - 4 - VOICED * (H / 2 - 16)
    d.line([x0, yv, x0 + W, yv], fill=(120, 90, 30))
    for k, w in enumerate(words):
        for key, col in (('t', (90, 255, 140)), ('e', (255, 90, 90))):
            if t0 <= w[key] <= t1:
                px = x0 + (w[key] - t0) / (t1 - t0) * W
                d.line([px, y0 + 14, px, y0 + H - 2], fill=col)
        if t0 <= w['t'] <= t1:
            d.text((x0 + (w['t'] - t0) / (t1 - t0) * W + 2, y0 + 14 + 10 * (k % 3)), w['w'], fill=(90, 255, 140))
    for s in np.arange(np.ceil(t0 * 10) / 10, t1, 0.1 if t1 - t0 > 0.5 else 0.01):
        px = x0 + (s - t0) / (t1 - t0) * W
        d.line([px, y0 + H - 3, px, y0 + H], fill=(160, 160, 160))
for lid in sys.argv[2:]:
    x, sr = read(os.path.join(ROOT, 'assets', 'voice', lid + '.wav'))
    env = json.load(open(os.path.join(ROOT, 'assets', 'voice', lid + '.env.json')))
    wj = json.load(open(os.path.join(ROOT, 'assets', 'voice', lid + '.words.json')))
    words, dur = wj['words'], len(x) / sr
    img = Image.new('RGB', (1800, 760), (16, 18, 22)); d = ImageDraw.Draw(img)
    panel(d, 10, 10, 1780, 360, x, sr, 0, dur, env, words, f'{lid}: the whole take, {dur:.3f} s (blue: wave; amber: envelope, the line at 0.04; green: word starts; red: word ends)')
    panel(d, 10, 385, 885, 360, x, sr, 0, 0.12, env, words, 'the first 120 ms (ticks every 10 ms)')
    panel(d, 905, 385, 885, 360, x, sr, dur - 0.12, dur, env, words, 'the last 120 ms')
    img.save(os.path.join(OUT, lid + '.png'))
    ms = int(sr / 1000)
    db = lambda seg: 20 * np.log10(max(1e-9, np.sqrt((seg ** 2).mean())))
    print(f'== {lid}: {dur:.3f} s, peak {np.abs(x).max():.3f}; first sample {x[0]:+.5f}, last {x[-1]:+.5f}')
    print('   first 30 ms, dBFS per ms:', ' '.join(f'{db(x[k * ms:(k + 1) * ms]):.0f}' for k in range(30)))
    print('   last 30 ms,  dBFS per ms:', ' '.join(f'{db(x[len(x) - (30 - k) * ms: len(x) - (29 - k) * ms]):.0f}' for k in range(30)))
    lv = np.array(env['level'])
    print(f"   envelope: {len(lv)} frames at {env['rate']}/s, max {lv.max():.3f}; first 8: {list(lv[:8])}; last 8: {list(lv[-8:])}")
    # the envelope's onsets: a frame above VOICED after 5 or more frames at or under it
    onsets = [k / env['rate'] for k in range(len(lv)) if lv[k] > VOICED and (k == 0 or lv[k - 1] <= VOICED) and (k < 5 or (lv[max(0, k - 5):k] <= VOICED).all())]
    print('   envelope onsets (voiced after 50 ms or more unvoiced):', ' '.join(f'{t:.2f}' for t in onsets))
    for w in words:
        near = min(onsets, key=lambda t: abs(t - w['t'])) if onsets else None
        k = int(round(w['t'] * env['rate']))
        around = ' '.join(f'{v:.2f}' for v in lv[max(0, k - 3):k + 4])
        note = f'onset {near:.2f} ({(w["t"] - near) * 1000:+.0f} ms)' if near is not None and abs(near - w['t']) <= 0.06 else ''
        print(f"   {w['t']:6.3f} {w['e']:6.3f}  {w['w']:14s} env around the start: {around:44s} {note}")
