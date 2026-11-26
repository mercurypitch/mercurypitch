"""Experiment 2: who is snapped by the envelope, and the error of each population."""
import importlib.util, json, os, sys, pickle
import numpy as np, soundfile as sf
ROOT = sys.argv[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
ctc = load('ctc_align', os.path.join(ROOT, 'tools', 'ctc_align.py'))
tts = load('tts', os.path.join(ROOT, 'tools', 'tts.py'))
al = ctc.Aligner(calibration=None)
script = json.load(open(os.path.join(ROOT, 'script.json')))
data = pickle.load(open(os.path.join(ROOT, 'lab', 'voices-import', 'kokoro-emissions.pkl'), 'rb'))
def st(d):
    d = np.array(d)
    return f'med {np.median(d)*1000:+6.1f}  |med| {np.median(np.abs(d))*1000:5.1f}  p90 {np.percentile(np.abs(d),90)*1000:5.1f}  max {np.abs(d).max()*1000:4.0f}  n {len(d)}'
rows = []
for e in script['events']:
    if e['type'] != 'line': continue
    x, sr = sf.read(os.path.join(ctc.KOKORO, e['id'] + '.wav'), dtype='float32')
    ref = json.load(open(os.path.join(ctc.KOKORO, e['id'] + '.words.json')))
    raw = al.raw(data[e['id']], e['text'])
    rows.append((e, x.astype(np.float64), ref, raw))
def snapped(x, w):
    """Run tts.calibrate; return (final words, lag, start-snapped flags, end-snapped flags)."""
    before = [list(k) for k in w]
    lag, first, last = tts.calibrate(x, w)
    # a non-snapped word moved by -lag before the ordering and clamps; mark snapped when it did not
    s = [abs((a[0] - b[0]) + lag) > 1e-6 for a, b in zip(w, before)]
    en = [abs((a[1] - b[1]) + lag) > 1e-6 for a, b in zip(w, before)]
    return w, lag, s, en
def times(raw, A, B):
    return [[r['f0'] * 0.02 - ctc.LEAD - A, (r['f1'] * 320 + 400) / 16000 - ctc.LEAD - B] for r in raw]
for A, B in ((0, 0), (0.04, -0.01), (0.04, 0.02), (0.055, 0.0)):
    S_, N_, ES, EN, lags = [], [], [], [], []
    for e, x, ref, raw in rows:
        w = times(raw, A, B)
        for k in w: k[1] = max(k[1], k[0] + 0.01)
        w, lag, s, en = snapped(x, w)
        lags.append(lag)
        for (t, e2), r, fs, fe in zip(w, ref['words'], s, en):
            (S_ if fs else N_).append(t - r['t'])
            (ES if fe else EN).append(e2 - r['e'])
    print(f'A {A} B {B}: lag median {np.median(lags)*1000:.1f}')
    print('   starts snapped ', st(S_)); print('   starts others  ', st(N_)); print('   starts all     ', st(S_ + N_))
    print('   ends snapped   ', st(ES)); print('   ends others    ', st(EN)); print('   ends all       ', st(ES + EN))
# how many of the reference's own words sit on a silence edge (Kokoro's snapped share)?
n = tot = 0
for e, x, ref, raw in rows:
    hop = int(tts.FRAME * tts.SR); rms = tts.frame_rms(x, hop); thr = rms.max() * 10 ** (tts.QUIET_DB / 20)
    q = [(a * tts.FRAME, b * tts.FRAME) for a, b in tts.silences(rms, thr, int(round(tts.MIN_SILENCE / tts.FRAME)))]
    ends = {round(b, 3) for a, b in q}
    loud = np.nonzero(rms >= thr)[0]; ends.add(round(loud[0] * tts.FRAME, 3))
    for r in ref['words']:
        tot += 1; n += round(r['t'], 3) in ends
print('reference words starting on a silence edge:', n, 'of', tot)
