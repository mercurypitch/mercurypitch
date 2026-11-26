"""Experiment: CTC word times on the Kokoro takes, variants, against Kokoro's own word files."""
import importlib.util, json, os, sys, pickle
import numpy as np, soundfile as sf
ROOT = sys.argv[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
ctc = load('ctc_align', os.path.join(ROOT, 'tools', 'ctc_align.py'))
tts = load('tts', os.path.join(ROOT, 'tools', 'tts.py'))
al = ctc.Aligner(calibration=None)
script = json.load(open(os.path.join(ROOT, 'script.json')))
cache = os.path.join(ROOT, 'lab', 'voices-import', 'kokoro-emissions.pkl')
data = {}
if os.path.exists(cache):
    data = pickle.load(open(cache, 'rb'))
else:
    for e in script['events']:
        if e['type'] != 'line': continue
        x, sr = sf.read(os.path.join(ctc.KOKORO, e['id'] + '.wav'), dtype='float32')
        data[e['id']] = al.emissions(x, sr)
    pickle.dump(data, open(cache, 'wb'))
def st(d): d = np.array(d); return f'med {np.median(d)*1000:+6.1f}  |med| {np.median(np.abs(d))*1000:5.1f}  p90 {np.percentile(np.abs(d),90)*1000:5.1f}  max {np.abs(d).max()*1000:4.0f}  n {len(d)}'
rows = []
for e in script['events']:
    if e['type'] != 'line': continue
    x, sr = sf.read(os.path.join(ctc.KOKORO, e['id'] + '.wav'), dtype='float32')
    ref = json.load(open(os.path.join(ctc.KOKORO, e['id'] + '.words.json')))
    got = al.words(x, sr, e['text'], logp=data[e['id']], lags=False)
    rows.append((e, x, ref, got))
# 1. raw
ds = [g['t'] - r['t'] for e, x, ref, got in rows for g, r in zip(got, ref['words'])]
de = [g['e'] - r['e'] for e, x, ref, got in rows for g, r in zip(got, ref['words'])]
print('raw starts', st(ds)); print('raw ends  ', st(de))
A, B = float(np.median(ds)), float(np.median(de))
print('constants', A, B)
# by who
for who in ('blue', 'orange'):
    d = [g['t'] - r['t'] for e, x, ref, got in rows if e['who'] == who for g, r in zip(got, ref['words'])]
    d2 = [g['e'] - r['e'] for e, x, ref, got in rows if e['who'] == who for g, r in zip(got, ref['words'])]
    print(who, 'starts', st(d)); print(who, 'ends  ', st(d2))
# 2. constants then tts.calibrate on the envelope
def run(A, B, label):
    ds, de, lags, worst = [], [], [], []
    for e, x, ref, got in rows:
        w = [[g['t'] - A, g['e'] - B] for g in got]
        for k in w: k[1] = max(k[1], k[0] + 0.01)
        lag, first, last = tts.calibrate(x.astype(np.float64), w)
        lags.append(lag)
        for (t, en), r in zip(w, ref['words']):
            ds.append(t - r['t']); de.append(en - r['e'])
            worst.append((abs(t - r['t']), e['id'], r['w'], round(t,3), r['t']))
    print(label, 'starts', st(ds)); print(label, 'ends  ', st(de)); print('   lags: med', np.median(lags), 'min', min(lags), 'max', max(lags))
    return sorted(worst)[-12:]
w = run(A, B, 'const+env')
for r in w: print('   ', r)
run(0, 0, 'env only ')
