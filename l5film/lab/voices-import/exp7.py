"""The loud islands near each take's start and end: start, length, level, the gap from the island before."""
import importlib.util, json, os, sys
import numpy as np
ROOT = sys.argv[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
ctc = load('ctc_align', os.path.join(ROOT, 'tools', 'ctc_align.py'))
tts = load('tts', os.path.join(ROOT, 'tools', 'tts.py'))
batch = json.load(open(os.path.join(ROOT, 'voice-takes', 'batch.json')))
hop = int(tts.FRAME * tts.SR)
for b in batch:
    x = ctc.decode(os.path.join(ROOT, 'voice-takes', 'takes', b['id'] + '.mp3'), tts.SR).astype(np.float64)
    rms = tts.frame_rms(x, hop)
    db = 20 * np.log10(np.maximum(rms, 1e-9) / rms.max())
    loud = db >= tts.QUIET_DB
    isl, s = [], None
    for i, q in enumerate(list(loud) + [False]):
        if q and s is None: s = i
        elif not q and s is not None: isl.append((s, i)); s = None
    n = len(rms)
    def fmt(k):
        a, c = isl[k]
        gap = (a - isl[k - 1][1]) * tts.FRAME if k else a * tts.FRAME
        return f'[{a*tts.FRAME:.3f}+{(c-a)*tts.FRAME:.3f} {db[a:c].max():.0f}dB gap {gap:.3f}{" END" if c == n else ""}{" START" if a == 0 else ""}]'
    words = b['text'].split()
    tailk = [k for k in range(len(isl)) if isl[k][0] * tts.FRAME > n * tts.FRAME - 0.5]
    headk = [k for k in range(len(isl)) if isl[k][1] * tts.FRAME < 0.35]
    print(f"{b['id']:5s} {n*tts.FRAME:6.2f}  head({words[0]}): {' '.join(fmt(k) for k in headk[:4])}   tail({words[-1]}): {' '.join(fmt(k) for k in tailk[-4:])}")
