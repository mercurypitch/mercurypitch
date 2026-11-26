"""Experiment 4: the silence put round the sound (LEAD), by the P2 measure."""
import importlib.util, json, os, sys
import numpy as np, soundfile as sf
ROOT = sys.argv[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
ctc = load('ctc_align', os.path.join(ROOT, 'tools', 'ctc_align.py'))
tts = load('tts', os.path.join(ROOT, 'tools', 'tts.py'))
al = ctc.Aligner(calibration=None)
script = json.load(open(os.path.join(ROOT, 'script.json')))
def st(d):
    d = np.array(d)
    return f'med {np.median(d)*1000:+6.1f}  |med| {np.median(np.abs(d))*1000:5.1f}  p90 {np.percentile(np.abs(d),90)*1000:5.1f}  max {np.abs(d).max()*1000:4.0f}  n {len(d)}'
for lead in [float(a) for a in sys.argv[2:]]:
    ctc.LEAD = lead
    S_, P2s, ES, P2e = [], [], [], []
    for e in script['events']:
        if e['type'] != 'line': continue
        x, sr = sf.read(os.path.join(ctc.KOKORO, e['id'] + '.wav'), dtype='float32')
        ref = json.load(open(os.path.join(ctc.KOKORO, e['id'] + '.words.json')))['words']
        got = al.words(x, sr, e['text'], lags=False)
        w = [[g['t'], max(g['e'], g['t'] + 0.01)] for g in got]
        before = [list(k) for k in w]
        lag, first, last = tts.calibrate(x.astype(np.float64), w)
        for i, r in enumerate(ref):
            if abs((w[i][0] - before[i][0]) + lag) > 1e-6: S_.append(w[i][0] - r['t'])
            else: P2s.append(before[i][0] - r['t'])
            if abs((w[i][1] - before[i][1]) + lag) > 1e-6: ES.append(w[i][1] - r['e'])
            else: P2e.append(before[i][1] - r['e'])
    a, b = np.median(P2s), np.median(P2e)
    print(f'LEAD {lead}: others raw less {a*1000:+.1f} / {b*1000:+.1f}')
    print('   starts snapped', st(S_)); print('   starts others ', st(np.array(P2s) - a)); print('   starts all    ', st(S_ + list(np.array(P2s) - a)))
    print('   ends snapped  ', st(ES)); print('   ends others   ', st(np.array(P2e) - b)); print('   ends all      ', st(ES + list(np.array(P2e) - b)))
