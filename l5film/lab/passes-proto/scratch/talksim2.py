import json, math, sys
sys.path.insert(0, 'lab/passes-proto/scratch')
from talksim import mouth, STEP
def talk2(env, rate, gain, hz, power=0.6, thr=0.04, open_share=0.6, floor=0.0, gate=True, gap=0.06, out_rate=240):
    """Per syllable cycle (1/hz s from each onset): open for open_share of it at gain * env^power, then shut
    (unvoiced when gate, else level * floor)."""
    n = int(len(env) / rate * out_rate)
    lev = [0.0] * n; vd = [False] * n
    phase = 0.0; silent = 1e9
    for j in range(n):
        e = env[min(len(env) - 1, int(j / out_rate * rate))]
        if e > thr:
            if silent >= gap: phase = 0.0
            silent = 0.0
            op = (phase % 1.0) < open_share
            if op:
                lev[j] = min(1.0, gain * e ** power); vd[j] = True
            elif not gate:
                lev[j] = min(1.0, gain * e ** power) * floor; vd[j] = True
            phase += hz / out_rate
        else:
            silent += 1 / out_rate
    return (lambda t: lev[int(t * out_rate)] if 0 <= int(t * out_rate) < n else 0.0,
            lambda t: vd[int(t * out_rate)] if 0 <= int(t * out_rate) < n else False), (lev, vd)
P = '/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/l5film/'
e = json.load(open(P + 'assets/voice/b21.env.json'))
env, rate = e['level'], e['rate']
dur = len(env) / rate
on = lambda t: env[min(len(env) - 1, int(t * rate))] > 0.04
for name, kw in {
    'gate 5.5 .60 g.5': dict(gain=0.5, hz=5.5, open_share=0.60),
    'gate 5.5 .70 g.5': dict(gain=0.5, hz=5.5, open_share=0.70),
    'gate 5.5 .75 g.45': dict(gain=0.45, hz=5.5, open_share=0.75),
    'gate 4.7 .70 g.45': dict(gain=0.45, hz=4.7, open_share=0.70),
    'gate 6.2 .70 g.45': dict(gain=0.45, hz=6.2, open_share=0.70),
    'nogate 5.5 .6 g.5': dict(gain=0.5, hz=5.5, open_share=0.6, gate=False),
}.items():
    (lf, vf), _ = talk2(env, rate, **kw)
    m = mouth(lf, vf, dur)
    ds = []
    for k in range(1, int(dur / 0.1)):
        a = m[int((k - 1) * 0.1 / STEP)]; b = m[int(k * 0.1 / STEP)]
        if on((k - 1) * 0.1) and on(k * 0.1):
            ds.append(abs(b[1] - a[1]))
    ds.sort()
    vo = [x for x in m if on(x[0])]
    peak = max(x[1] for x in m); mean = sum(x[1] for x in vo) / len(vo); lo = sorted(x[1] for x in vo)[len(vo) // 10]
    print(f'{name:20s} peak o {peak:.2f} mean {mean:.2f} p10 {lo:.2f}  |do| per 0.1 s: median {ds[len(ds)//2]:.3f} p25 {ds[len(ds)//4]:.3f} under 0.06: {sum(1 for d in ds if d < 0.06)/len(ds):.2f}')
