"""Experiment 3: sub-frame times from shifted copies; ways to place the words the envelope does not."""
import importlib.util, json, os, sys, pickle
import numpy as np, soundfile as sf
ROOT = sys.argv[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
ctc = load('ctc_align', os.path.join(ROOT, 'tools', 'ctc_align.py'))
tts = load('tts', os.path.join(ROOT, 'tools', 'tts.py'))
al = ctc.Aligner(calibration=None)
script = json.load(open(os.path.join(ROOT, 'script.json')))
NS = 4
cache = os.path.join(ROOT, 'lab', 'voices-import', 'kokoro-emissions-shift.pkl')
def emis(x, sr, shift):
    x16 = ctc.resample(x, sr, 16000).astype(np.float64)
    pad = int(ctc.LEAD * 16000)
    y = np.concatenate([np.zeros(pad + shift), x16, np.zeros(pad)])
    y = (y - y.mean()) / np.sqrt(y.var() + 1e-7)
    lg = al.sess.run(None, {'input_values': y[None].astype(np.float32)})[0][0].astype(np.float64)
    lg -= lg.max(1, keepdims=True)
    return lg - np.log(np.exp(lg).sum(1, keepdims=True))
if os.path.exists(cache):
    data = pickle.load(open(cache, 'rb'))
else:
    data = {}
    for e in script['events']:
        if e['type'] != 'line': continue
        x, sr = sf.read(os.path.join(ctc.KOKORO, e['id'] + '.wav'), dtype='float32')
        data[e['id']] = [emis(x, sr, s * 80) for s in range(NS)]
    pickle.dump(data, open(cache, 'wb'))
def st(d):
    d = np.array(d)
    return f'med {np.median(d)*1000:+6.1f}  |med| {np.median(np.abs(d))*1000:5.1f}  p90 {np.percentile(np.abs(d),90)*1000:5.1f}  max {np.abs(d).max()*1000:4.0f}  n {len(d)}'
rows = []
for e in script['events']:
    if e['type'] != 'line': continue
    x, sr = sf.read(os.path.join(ctc.KOKORO, e['id'] + '.wav'), dtype='float32')
    ref = json.load(open(os.path.join(ctc.KOKORO, e['id'] + '.words.json')))
    raws = [al.raw(lp, e['text']) for lp in data[e['id']]]
    rows.append((e, x.astype(np.float64), ref, raws))
def times(raws, n):
    """mean over the first n shifts of (start, end) raw times."""
    out = []
    for k in range(len(raws[0])):
        t = np.mean([raws[s][k]['f0'] * 0.02 - s * 0.005 - ctc.LEAD for s in range(n)])
        e = np.mean([(raws[s][k]['f1'] * 320 + 400) / 16000 - s * 0.005 - ctc.LEAD for s in range(n)])
        out.append([float(t), float(e)])
    return out
def flags(x, w):
    before = [list(k) for k in w]
    lag, first, last = tts.calibrate(x, w)
    s = [abs((a[0] - b[0]) + lag) > 1e-6 for a, b in zip(w, before)]
    en = [abs((a[1] - b[1]) + lag) > 1e-6 for a, b in zip(w, before)]
    return before, lag, s, en
for n in (1, 2, 4):
    print(f'=== {n} shift(s)')
    ds = [t[0] - r['t'] for e, x, ref, raws in rows for t, r in zip(times(raws, n), ref['words'])]
    de = [t[1] - r['e'] for e, x, ref, raws in rows for t, r in zip(times(raws, n), ref['words'])]
    print(' raw starts', st(ds)); print(' raw ends  ', st(de))
    # P0: tts.calibrate as it is
    S_, N_, ES, EN, P2s, P2e, keep = [], [], [], [], [], [], []
    for e, x, ref, raws in rows:
        w = times(raws, n)
        for k in w: k[1] = max(k[1], k[0] + 0.01)
        before, lag, s, en = flags(x, w)
        for i, ((t, e2), r, fs, fe) in enumerate(zip(w, ref['words'], s, en)):
            (S_ if fs else N_).append(t - r['t']); (ES if fe else EN).append(e2 - r['e'])
            if not fs: P2s.append(before[i][0] - r['t'])
            if not fe: P2e.append(before[i][1] - r['e'])
    print(' P0 starts snapped', st(S_)); print(' P0 starts others ', st(N_)); print(' P0 starts all    ', st(S_ + N_))
    print(' P0 ends snapped  ', st(ES)); print(' P0 ends others   ', st(EN)); print(' P0 ends all      ', st(ES + EN))
    # P1: P0 + the others' residual medians taken off
    a, b = np.median(N_), np.median(EN)
    print(f' P1 (others less {a*1000:+.1f} / {b*1000:+.1f}) starts others', st(np.array(N_) - a)); print('    starts all', st(S_ + list(np.array(N_) - a)))
    print('    ends others', st(np.array(EN) - b)); print('    ends all  ', st(ES + list(np.array(EN) - b)))
    # P2: snapped by the envelope, the others raw less one global constant
    a, b = np.median(P2s), np.median(P2e)
    print(f' P2 (others raw less {a*1000:+.1f} / {b*1000:+.1f}) starts others', st(np.array(P2s) - a)); print('    starts all', st(S_ + list(np.array(P2s) - a)))
    print('    ends others', st(np.array(P2e) - b)); print('    ends all  ', st(ES + list(np.array(P2e) - b)))
