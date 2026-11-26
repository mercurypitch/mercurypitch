"""The words a silence places on the final takes: how far each start moves from the aligner's own time,
and the envelope between the silence's end and that time for the far ones (a soft start rises; a
stop's release is a short bump, then a gap). Reads voice-takes/ and the tools; writes nothing."""
import importlib.util, json, os, sys
import numpy as np
ROOT = sys.argv[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
imp = load('imp', os.path.join(ROOT, 'tools', 'import.py'))
ctc, tts = imp.ctc, imp.tts
al = ctc.Aligner()
batch = json.load(open(os.path.join(ROOT, 'voice-takes', 'batch.json')))
moves, far, n, placed = [], [], 0, 0
for b in batch:
    x = ctc.decode(os.path.join(ROOT, 'voice-takes', 'takes', b['id'] + '.mp3'), tts.SR).astype(np.float64)
    q = imp.clicks(x)[1]
    raw = al.words(x, tts.SR, b['text'])
    p = ctc.place(tts, q, raw, al.start_lag, al.end_lag)
    rms = tts.frame_rms(q, tts.SR // 100); lv = np.minimum(1, rms / np.percentile(rms[rms >= rms.max() * 10 ** (tts.QUIET_DB / 20)], 95))
    n += len(raw); placed += len(p['starts'])
    for k in sorted(p['starts']):
        d = raw[k]['t'] - p['words'][k][0]
        moves.append(d)
        if d > 0.13:
            i0, i1 = int(round(p['words'][k][0] * 100)), int(round(raw[k]['t'] * 100))
            far.append((round(d, 3), b['id'], raw[k - 1]['w'] if k else '(start)', raw[k]['w'], ' '.join(f'{v:.2f}'.lstrip('0') or '0' for v in lv[i0:i1 + 3])))
moves = np.array(moves)
print(f'{n} words, {placed} starts placed by a silence; aligned - placed (ms): ' + ' '.join(f'{q}%:{np.percentile(moves, q) * 1000:.0f}' for q in (1, 5, 25, 50, 75, 95, 99)) + f' max {moves.max() * 1000:.0f}')
print(f'{len(far)} moved more than 130 ms (move, line, the word before, the word, the envelope from the placed start to the aligned start + 30 ms):')
for r in sorted(far, reverse=True): print('  ', r)
