# Amber transmission over backdrops, tone-mapped with the r185 port in tm/tm.py, at a given exposure.
import sys, io, contextlib, importlib.util, numpy as np
path, E = sys.argv[1], float(sys.argv[2])
spec = importlib.util.spec_from_file_location('tm', path); tm = importlib.util.module_from_spec(spec)
saved = sys.argv; sys.argv = [path, str(E)]
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(tm)
sys.argv = saved
att = tm.s2l((0xF2, 0xA9, 0x3B))
print(f'exposure={E}; attenuationColor #F2A93B; transmitted = 0.96 * L_bg * att^t')
for name, L in (('dark wall 0.042', 0.042), ('mid wall 0.195', 0.195), ('white lit 1.0', 1.0), ('light box 2.0', 2.0)):
    for t in (1, 2):
        lin = 0.96 * L * np.power(att, t)
        row = [f'{lab}:{tm.hexs(fn(lin, E))}' for fn, lab in ((tm.aces, 'ACES'), (tm.neutral, 'Neutral'), (tm.agx, 'AgX'))]
        print(f'{name:16} t={t}  ' + '  '.join(row))
