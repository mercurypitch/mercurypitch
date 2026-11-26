"""tts.calibrate, changed for the importer, against the copy kept before the change: the same words
out, to the last bit, for every Kokoro take (the aligner's times in, no `lags`)."""
import importlib.machinery, importlib.util, json, os, sys
import numpy as np, soundfile as sf
ROOT = sys.argv[1]
def load(name, path):
    loader = importlib.machinery.SourceFileLoader(name, path)
    spec = importlib.util.spec_from_loader(name, loader); m = importlib.util.module_from_spec(spec); loader.exec_module(m); return m
new = load('tts_new', os.path.join(ROOT, 'tools', 'tts.py'))
old = load('tts_old', os.path.join(ROOT, 'lab', 'voices-import', 'before', 'tts.before-import.py.txt'))
script = json.load(open(os.path.join(ROOT, 'script.json')))
n = same = 0
rng = np.random.default_rng(5)
for e in script['events']:
    if e['type'] != 'line': continue
    x, sr = sf.read(os.path.join(ROOT, 'assets', 'voice-kokoro', e['id'] + '.wav'), dtype='float64')
    ref = json.load(open(os.path.join(ROOT, 'assets', 'voice-kokoro', e['id'] + '.words.json')))['words']
    for trial in range(3):   # the take's own words, late by a model's lag, and jittered
        w = [[r['t'] + 0.09 * (trial > 0) + rng.normal(0, 0.03) * (trial > 1), r['e'] + 0.09 * (trial > 0)] for r in ref]
        a, b = [list(k) for k in w], [list(k) for k in w]
        ra, rb = old.calibrate(x, a), new.calibrate(x, b)
        n += 1
        same += (ra == rb and a == b)
print(f'{same} of {n} runs identical (words and the returned lag, first and last)')
