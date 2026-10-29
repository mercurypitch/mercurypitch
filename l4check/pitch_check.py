"""Synthesise each Lesson 4 film sound with tools/mix.py and measure every note's pitch."""
import sys, math
sys.path.insert(0, '/home/user/mercurypitch/output/motion/lesson-04/tools')
import numpy as np
import mix
SR = mix.SR
def f0(seg):
    w = seg * np.hanning(len(seg))
    n = 1 << 20
    X = np.abs(np.fft.rfft(w, n))
    fr = np.fft.rfftfreq(n, 1 / SR)
    band = (fr > 80) & (fr < 1200)
    i = np.argmax(X * band)
    # centroid of the main lobe
    lo, hi = max(i - 40, 0), i + 40
    return float((X[lo:hi] * fr[lo:hi]).sum() / X[lo:hi].sum())
SPEC = {  # name: (voice?, [(note or None, length)])
 'stop-c': mix.even(mix.C_MAJ[:7], 0.45, 1.2), 'stop-d': mix.even(mix.D_MAJ[:7], 0.45, 1.2),
 'land-d': [('C#5', 0.45), ('D5', 1.2)], 'land-c': [('B4', 0.45), ('C5', 1.2)],
 'scale-c': mix.even(mix.C_MAJ, 0.45, 0.9), 'steps-c': mix.even(mix.C_MAJ, 0.8, 1.2),
 'group-low': mix.even(mix.C_MAJ[:4], 0.45, 0.9), 'group-high': mix.even(mix.C_MAJ[4:], 0.45, 0.9),
 'white-d': mix.even(['D4','E4','F4','G4','A4','B4','C5','D5'], 0.45, 0.9), 'major-d': mix.even(mix.D_MAJ, 0.45, 0.9),
 'slide-g': mix.even(['G4','A4','B4','C5','D5','E5','F#5','G5'], 0.36, 0.72), 'slide-e': mix.even(['E4','F#4','G#4','A4','B4','C#5','D#5','E5'], 0.36, 0.72),
 'sing-a': [(n, 0.8) for n in ['D3','E3','F#3','G3','A3','B3']] + [('C#4', 2.0), (None, 0.6), ('D4', 1.2)],
 'sing-b': [(n, 0.8) for n in mix.D_MAJ[:6]] + [('C#5', 2.0), (None, 0.6), ('D5', 1.2)],
 'count-in': [('D3', 0.8), (None, 0.2)], 'ti-do': [('B4', 0.45), ('C5', 1.2)],
}
DUR = {'stop-c': 3.9, 'stop-d': 3.9, 'land-d': 1.65, 'land-c': 1.65, 'scale-c': 4.05, 'steps-c': 6.8, 'group-low': 2.25, 'group-high': 2.25,
       'white-d': 4.05, 'major-d': 4.05, 'slide-g': 3.24, 'slide-e': 3.24, 'sing-a': 8.6, 'sing-b': 8.6, 'count-in': 1.0, 'ti-do': 1.65}
worst = 0
for name, seq in SPEC.items():
    x = mix.sound_for(name, DUR[name])
    assert abs(len(x) / SR - DUR[name]) < 1e-3, (name, len(x) / SR)
    total = sum(l for _, l in seq)
    assert abs(total - DUR[name]) < 1e-6, (name, total)
    at, row = 0.0, []
    for nm, ln in seq:
        if nm:
            a, b = at + 0.18 * ln + 0.05, at + ln - 0.12
            if b - a < 0.12: a, b = at + 0.06, at + ln - 0.06
            got = f0(x[int(a * SR):int(b * SR)])
            want = mix.hz(nm)
            c = 1200 * math.log2(got / want)
            worst = max(worst, abs(c))
            row.append(f'{nm} {got:.1f}({c:+.0f}c)')
        at += ln
    pk = np.abs(x).max()
    print(f'{name:10s} {DUR[name]:5.2f}s peak {pk:.2f} | ' + ' '.join(row))
print('worst deviation', round(worst, 1), 'cents')
