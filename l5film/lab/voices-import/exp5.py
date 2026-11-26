"""Look at the takes' edges: where the sound starts and stops, quiet runs, short loud islands."""
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
    if sys.argv[2] != 'all' and b['who'] != sys.argv[2]: continue
    x = ctc.decode(os.path.join(ROOT, 'voice-takes', 'takes', b['id'] + '.mp3'), tts.SR).astype(np.float64)
    rms = tts.frame_rms(x, hop)
    db = 20 * np.log10(np.maximum(rms, 1e-9) / rms.max())
    loud = rms >= rms.max() * 10 ** (tts.QUIET_DB / 20)
    # loud islands
    isl, s = [], None
    for i, q in enumerate(list(loud) + [False]):
        if q and s is None: s = i
        elif not q and s is not None: isl.append((s, i)); s = None
    short = [(round(a * tts.FRAME, 3), round((c - a) * tts.FRAME, 3)) for a, c in isl if (c - a) * tts.FRAME < 0.06]
    first, last = isl[0][0] * tts.FRAME, isl[-1][1] * tts.FRAME
    # the level of the quiet: median dB of frames below threshold, and the lead/tail floor
    floor = np.median(db[~loud]) if (~loud).any() else 0
    print(f"{b['id']:5s} dur {len(x)/tts.SR:6.2f}  peak {np.abs(x).max():.3f}  first {first:5.2f}  tail {len(x)/tts.SR - last:5.2f}  islands {len(isl):3d}  quiet floor {floor:6.1f} dB  short {short[:6]}")
