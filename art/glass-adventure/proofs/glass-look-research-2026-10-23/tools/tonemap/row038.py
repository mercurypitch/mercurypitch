import sys, io, contextlib, importlib.util, numpy as np
path, E = sys.argv[1], float(sys.argv[2])
spec = importlib.util.spec_from_file_location('tm', path); tm = importlib.util.module_from_spec(spec)
saved = sys.argv; sys.argv = [path, str(E)]
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(tm)
sys.argv = saved
att = tm.s2l((0xF2, 0xA9, 0x3B))
for L, t in ((0.38, 1), (0.38, 2)):
    lin = 0.96 * L * np.power(att, t)
    print(L, t, ' '.join(f'{lab}:{tm.hexs(fn(lin, E))}' for fn, lab in ((tm.aces, 'ACES'), (tm.neutral, 'Neutral'))))
