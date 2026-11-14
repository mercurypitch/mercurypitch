import sys, io, contextlib, importlib.util, numpy as np
path, E = sys.argv[1], float(sys.argv[2])
spec = importlib.util.spec_from_file_location('tm', path); tm = importlib.util.module_from_spec(spec)
saved = sys.argv; sys.argv = [path, str(E)]
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(tm)
sys.argv = saved
for disp in (173, 185, 207):
    target = float(tm.s2l((disp,))[0])
    lo, hi = 1e-4, 10.0
    for _ in range(80):
        mid = (lo + hi) / 2
        out = tm.aces(np.array([mid, mid, mid]), E)[0]
        lo, hi = (mid, hi) if out < target else (lo, mid)
    print(f'display {disp}/255 grey under ACES {E}: scene radiance ~{mid:.3f}; 1.45 is {1.45/mid:.1f}x that')
for L in (0.042, 0.195):
    print(L, 'displays as', tm.hexs(tm.aces(np.array([L, L, L]), E)))
