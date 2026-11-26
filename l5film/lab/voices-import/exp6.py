"""The first and last 150 ms of takes, frame by frame (dB under the take's loudest 5 ms frame)."""
import importlib.util, json, os, sys
import numpy as np
ROOT = sys.argv[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
ctc = load('ctc_align', os.path.join(ROOT, 'tools', 'ctc_align.py'))
tts = load('tts', os.path.join(ROOT, 'tools', 'tts.py'))
hop = int(tts.FRAME * tts.SR)
for lid in sys.argv[2:]:
    x = ctc.decode(os.path.join(ROOT, 'voice-takes', 'takes', lid + '.mp3'), tts.SR).astype(np.float64)
    rms = tts.frame_rms(x, hop)
    db = 20 * np.log10(np.maximum(rms, 1e-9) / rms.max())
    print(lid, 'samples', len(x), 'first 30 frames:', ' '.join(f'{v:.0f}' for v in db[:30]))
    print('     last 40 frames:', ' '.join(f'{v:.0f}' for v in db[-40:]))
    print('     last 12 samples:', np.round(x[-12:], 4), ' first 6:', np.round(x[:6], 4))
