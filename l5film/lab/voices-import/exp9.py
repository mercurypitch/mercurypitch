"""At clear pauses (a silence of 0.15 s or more, and the take's own edges): how late the aligner marks the word
after it, and how early the end of the word before it."""
import importlib.util, json, os, sys, pickle
import numpy as np
ROOT = sys.argv[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
imp = load('imp', os.path.join(ROOT, 'tools', 'import.py'))
ctc, tts = imp.ctc, imp.tts
batch = json.load(open(os.path.join(ROOT, 'voice-takes', 'batch.json')))
data = pickle.load(open(os.path.join(ROOT, 'lab', 'voices-import', 'takes-raw.pkl'), 'rb'))
hop = int(tts.FRAME * tts.SR)
def q(v): v = np.array(v); return ' '.join(f'{p}%:{np.percentile(v, p)*1000:.0f}' for p in (1, 5, 25, 50, 75, 95, 99)) + f'  n {len(v)}'
for kind in ('kokoro', 'take'):
    for who in ('blue', 'orange'):
        on, off, edge_on, edge_off = [], [], [], []
        for b in batch:
            if b['who'] != who: continue
            x, raw, heard = data[kind + ':' + b['id']]
            y = imp.clicks(x)[1] if kind == 'take' else x
            rms = tts.frame_rms(y, hop); thr = rms.max() * 10 ** (tts.QUIET_DB / 20)
            sil = [(a * tts.FRAME, c * tts.FRAME) for a, c in tts.silences(rms, thr, int(round(0.15 / tts.FRAME)))]
            loud = np.nonzero(rms >= thr)[0]; first, last = loud[0] * tts.FRAME, (loud[-1] + 1) * tts.FRAME
            edge_on.append(raw[0]['t'] - first); edge_off.append(last - raw[-1]['e'])
            for a, c in sil:
                if a <= first or c >= last: continue
                k = next((i for i, r in enumerate(raw) if r['t'] >= a), None)
                j = next((i for i in range(len(raw) - 1, -1, -1) if raw[i]['t'] + 0.05 < a), None)
                if k is not None and j == k - 1:
                    on.append(raw[k]['t'] - c); off.append(a - raw[j]['e'])
        print(f'{kind} {who}: word after a pause, aligned start - sound start (ms): {q(on)}')
        print(f'{"":{len(kind)+len(who)+1}}  word before a pause, sound stop - aligned end (ms): {q(off)}')
        print(f'{"":{len(kind)+len(who)+1}}  first word: {q(edge_on)}   last word: {q(edge_off)}')
