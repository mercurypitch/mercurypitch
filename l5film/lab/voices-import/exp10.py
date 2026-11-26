"""A placement that lets the aligner say which words a silence parts: against Kokoro's files, and its moves on the takes."""
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
def place(audio, raw, lag_t, lag_e, near_t=(-0.05, 0.2), near_e=(-0.02, 0.3), tol_e=0.02, tol_t=0.05):
    rms = tts.frame_rms(audio, hop); thr = rms.max() * 10 ** (tts.QUIET_DB / 20)
    quiet = [(a * tts.FRAME, b * tts.FRAME) for a, b in tts.silences(rms, thr, int(round(tts.MIN_SILENCE / tts.FRAME)))]
    loud = np.nonzero(rms >= thr)[0]; first, last = loud[0] * tts.FRAME, (loud[-1] + 1) * tts.FRAME
    t = [r['t'] for r in raw]; e = [r['e'] for r in raw]
    out = [[a - lag_t, b - lag_e] for a, b in zip(t, e)]
    ps, pe, moves = set(), set(), []
    n = len(raw)
    if near_t[0] <= t[0] - first <= near_t[1]: out[0][0] = first; ps.add(0); moves.append(('s', 0, t[0] - first, 9))
    if near_e[0] <= last - e[-1] <= near_e[1]: out[-1][1] = last; pe.add(n - 1); moves.append(('e', n - 1, last - e[-1], 9))
    for a, b in quiet:
        if a <= first or b >= last: continue
        j = max((i for i in range(n) if e[i] <= a + tol_e), default=None)
        k = min((i for i in range(n) if t[i] >= b - tol_t), default=None)
        if j is None or k is None or k != j + 1: continue
        if k not in ps and near_t[0] <= t[k] - b <= near_t[1]: out[k][0] = b; ps.add(k); moves.append(('s', k, t[k] - b, b - a))
        if j not in pe and near_e[0] <= a - e[j] <= near_e[1]: out[j][1] = a; pe.add(j); moves.append(('e', j, a - e[j], b - a))
    for k in range(1, n): out[k][0] = max(out[k][0], out[k - 1][0])
    for k in range(n - 1):
        if out[k][1] > out[k + 1][0] > out[k][0]: out[k][1] = out[k + 1][0]
    for w in out:
        w[0] = min(max(w[0], first), last - 0.01); w[1] = min(max(w[1], w[0] + 0.01), last)
    return out, ps, pe, moves, first, last
def st(d):
    d = np.array(d); return f'med {np.median(d)*1000:+6.1f}  |med| {np.median(np.abs(d))*1000:5.1f}  p90 {np.percentile(np.abs(d),90)*1000:5.1f}  max {np.abs(d).max()*1000:4.0f}  n {len(d)}'
# constants: unplaced words on Kokoro
us, ue = [], []
for b in batch:
    x, raw, _ = data['kokoro:' + b['id']]
    ref = json.load(open(os.path.join(ROOT, 'assets', 'voice-kokoro', b['id'] + '.words.json')))['words']
    out, ps, pe, moves, first, last = place(x, raw, 0, 0)
    us += [raw[i]['t'] - ref[i]['t'] for i in range(len(raw)) if i not in ps]
    ue += [raw[i]['e'] - ref[i]['e'] for i in range(len(raw)) if i not in pe]
A, B = float(np.median(us)), float(np.median(ue))
print('unplaced starts', st(us)); print('unplaced ends  ', st(ue)); print('constants', A, B)
ds, de, dsp, dsu, worst, nps, npe = [], [], [], [], [], 0, 0
for b in batch:
    x, raw, _ = data['kokoro:' + b['id']]
    ref = json.load(open(os.path.join(ROOT, 'assets', 'voice-kokoro', b['id'] + '.words.json')))['words']
    out, ps, pe, moves, first, last = place(x, raw, A, B)
    nps += len(ps); npe += len(pe)
    for i, (o, r) in enumerate(zip(out, ref)):
        ds.append(o[0] - r['t']); de.append(o[1] - r['e']); (dsp if i in ps else dsu).append(o[0] - r['t'])
        worst.append((abs(o[0] - r['t']), b['id'], r['w'], round(o[0], 3), r['t'], i in ps))
print(f'kokoro: placed {nps} starts, {npe} ends')
print(' starts all     ', st(ds)); print(' starts placed  ', st(dsp)); print(' starts unplaced', st(dsu)); print(' ends all       ', st(de))
for w in sorted(worst)[-14:]: print('    ', w)
# the takes: moves
for who in ('blue', 'orange'):
    ms, me, big = [], [], []
    n = 0
    for b in batch:
        if b['who'] != who: continue
        x, raw, _ = data['take:' + b['id']]
        y = imp.clicks(x)[1]
        out, ps, pe, moves, first, last = place(y, raw, A, B)
        n += len(raw)
        for kind, i, d, sil in moves:
            (ms if kind == 's' else me).append(d)
            if (kind == 's' and d > 0.13) or (kind == 'e' and (d < 0.0 or d > 0.25)): big.append((b['id'], kind, raw[i]['w'], round(d, 3), 'silence', round(sil, 3)))
    ms, me = np.array(ms), np.array(me)
    print(f'takes {who}: {n} words; starts placed {len(ms)}: aligned - sound start ms: ' + ' '.join(f'{p}%:{np.percentile(ms,p)*1000:.0f}' for p in (1,5,25,50,75,95,99)))
    print(f'   ends placed {len(me)}: sound stop - aligned ms: ' + ' '.join(f'{p}%:{np.percentile(me,p)*1000:.0f}' for p in (1,5,25,50,75,95,99)))
    for r in big: print('    ', r)
