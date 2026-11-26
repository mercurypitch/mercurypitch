"""How far the envelope moves each word from where the aligner put it: Kokoro takes and the final takes."""
import importlib.util, json, os, sys, pickle
import numpy as np, soundfile as sf
ROOT = sys.argv[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
imp = load('imp', os.path.join(ROOT, 'tools', 'import.py'))
ctc, tts = imp.ctc, imp.tts
al = ctc.Aligner()
batch = json.load(open(os.path.join(ROOT, 'voice-takes', 'batch.json')))
cache = os.path.join(ROOT, 'lab', 'voices-import', 'takes-raw.pkl')
data = pickle.load(open(cache, 'rb')) if os.path.exists(cache) else {}
def get(kind, b):
    key = kind + ':' + b['id']
    if key not in data:
        if kind == 'kokoro':
            x, sr = sf.read(os.path.join(ROOT, 'assets', 'voice-kokoro', b['id'] + '.wav'), dtype='float64')
        else:
            x = ctc.decode(os.path.join(ROOT, 'voice-takes', 'takes', b['id'] + '.mp3'), tts.SR).astype(np.float64)
        logp = al.emissions(x, tts.SR)
        data[key] = (x, al.words(x, tts.SR, b['text'], logp, lags=False), al.heard(logp))
    return data[key]
for kind in ('kokoro', 'take'):
    fs, fe, big = [], [], []
    for b in batch:
        x, raw, heard = get(kind, b)
        q = imp.clicks(x)[1] if kind == 'take' else x
        w = [[r['t'], max(r['e'], r['t'] + 0.01)] for r in raw]
        before = [list(k) for k in w]
        lag, first, last = tts.calibrate(q, w, lags=(al.start_lag, al.end_lag))
        for i, (a, c) in enumerate(zip(w, before)):
            if abs(a[0] - (c[0] - al.start_lag)) > 1e-9:
                fs.append(c[0] - a[0])
                if c[0] - a[0] > 0.13 or c[0] - a[0] < -0.03: big.append((b['id'], 'start', raw[i]['w'], round(c[0], 3), round(a[0], 3), round(c[0] - a[0], 3)))
            if abs(a[1] - (c[1] - al.end_lag)) > 1e-9:
                fe.append(c[1] - a[1])
                if abs(c[1] - a[1]) > 0.15: big.append((b['id'], 'end', raw[i]['w'], round(c[1], 3), round(a[1], 3), round(c[1] - a[1], 3)))
    fs, fe = np.array(fs), np.array(fe)
    print(f'== {kind}: starts placed {len(fs)}: aligned - placed: median {np.median(fs)*1000:.0f} ms, 5% {np.percentile(fs,5)*1000:.0f}, 25% {np.percentile(fs,25)*1000:.0f}, 75% {np.percentile(fs,75)*1000:.0f}, 95% {np.percentile(fs,95)*1000:.0f}, 99% {np.percentile(fs,99)*1000:.0f}, max {fs.max()*1000:.0f}')
    print(f'   ends placed {len(fe)}: aligned - placed: median {np.median(fe)*1000:.0f} ms, 5% {np.percentile(fe,5)*1000:.0f}, 25% {np.percentile(fe,25)*1000:.0f}, 75% {np.percentile(fe,75)*1000:.0f}, 95% {np.percentile(fe,95)*1000:.0f}, min {fe.min()*1000:.0f} max {fe.max()*1000:.0f}')
    for r in big: print('    ', r)
pickle.dump(data, open(cache, 'wb'))
