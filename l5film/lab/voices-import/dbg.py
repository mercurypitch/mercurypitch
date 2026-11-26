import importlib.util, json, os, sys
import numpy as np
ROOT = sys.argv[1]; lid = sys.argv[2]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
ctc = load('ctc_align', os.path.join(ROOT, 'tools', 'ctc_align.py'))
al = ctc.Aligner()
text = {b['id']: b['text'] for b in json.load(open(os.path.join(ROOT, 'voice-takes', 'batch.json')))}[lid]
x = ctc.decode(os.path.join(ROOT, 'voice-takes', 'takes', lid + '.mp3'), 24000).astype(np.float64)
logp = al.emissions(x, 24000)
ids = logp.argmax(1)
print('frames', len(ids), 'audio', len(x) / 24000)
print('greedy per frame:', ''.join(('.' if i == 0 else al.letters[i]) for i in ids))
toks, lab = [], []
for k, w in enumerate(text.split()):
    for p in ctc.spoken(w):
        if toks: toks.append(al.vocab['|']); lab.append('|')
        for c in p: toks.append(al.vocab[c]); lab.append(c)
spans = ctc.viterbi(logp, np.array(toks), al.vocab['<pad>'], edge=al.vocab['|'])
line = ['.'] * len(ids)
for (f0, f1, s), c in zip(spans, lab):
    for f in range(f0, f1 + 1): line[f] = c
print('forced per frame:', ''.join(line))
for (f0, f1, s), c in zip(spans, lab):
    print(f'  {c} frames {f0}-{f1} t {f0*0.02-0.5:.2f} score {s:.2f}  greedy there: {"".join(("." if i == 0 else al.letters[i]) for i in ids[f0:f1+1])}')
