import sys, io, contextlib, importlib.util, numpy as np
path, E = sys.argv[1], float(sys.argv[2])
spec = importlib.util.spec_from_file_location('tm', path); tm = importlib.util.module_from_spec(spec)
saved = sys.argv; sys.argv = [path, str(E)]
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(tm)
sys.argv = saved
att = tm.s2l((0xF2, 0xA9, 0x3B)); target = tm.s2l((0xF2, 0xA9, 0x3B))
L0, C0, h0 = tm.oklch(target)
def de(o):  # simple OKLab distance to the concept gold
    L, C, h = tm.oklch(o); import math
    a, b = C*math.cos(math.radians(h)), C*math.sin(math.radians(h)); a0, b0 = C0*math.cos(math.radians(h0)), C0*math.sin(math.radians(h0))
    return math.sqrt((L-L0)**2 + (a-a0)**2 + (b-b0)**2)
for fn, lab in ((tm.aces, 'ACES'), (tm.neutral, 'Neutral')):
    best = min(((de(fn(0.96*L*np.power(att, t), E)), L, t) for t in (1, 1.5, 2) for L in np.arange(0.5, 4.01, 0.05)))
    d, L, t = best; o = fn(0.96*L*np.power(att, t), E)
    print(f'{lab}: closest to #F2A93B at backdrop {L:.2f}, t={t}: {tm.hexs(o)} (OKLab dist {d:.3f})')
