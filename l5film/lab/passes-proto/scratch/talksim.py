"""Offline: the sim's mouth for a talk mapping (sim.ts smoothVoice 45 ms, sing's mouthO target, the mouthO spring 11 Hz 0.72)."""
import json, math, sys
STEP = 1 / 240
def mouth(level_fn, voiced_fn, dur):
    a1 = 1 - math.exp(-STEP / 0.045)
    w = 2 * math.pi * 11; z = 0.72
    lv = vo = 0.0; x = v = 0.0
    out = []
    for n in range(int(dur / STEP)):
        t = n * STEP
        vd = voiced_fn(t)
        lv += ((level_fn(t) if vd else 0) - lv) * a1
        vo += ((1 if vd else 0) - vo) * a1
        T = vo * min(1, max(0, 0.2 + lv))
        v += (w * w * (T - x) - 2 * z * w * v) * STEP
        x += v * STEP
        out.append((t, x, lv, vo))
    return out

def talk(env, rate, gain, hz, depth, power=1.0, thr=0.04, shape='cos', duty=0.5, gap=0.06):
    """level(t), voiced(t) for one line: the envelope shaped (power), a flap of `depth` at `hz` restarted at each onset."""
    n = len(env)
    lev = [0.0] * n; vd = [False] * n
    phase = 0.0; silent = 1e9
    for i in range(n):
        e = env[i]
        on = e > thr
        if on:
            if silent >= gap: phase = 0.0
            silent = 0.0
            if shape == 'cos':
                f = 0.5 * (1 - math.cos(2 * math.pi * phase))
            else:
                f = 0.0 if (phase % 1.0) < duty else 1.0
            lev[i] = min(1.0, gain * (e ** power) * (1 - depth * f))
            vd[i] = True
            phase += hz / rate
        else:
            silent += 1 / rate
    return (lambda t: lev[min(n - 1, int(t * rate))] if 0 <= t * rate < n else 0.0,
            lambda t: vd[min(n - 1, int(t * rate))] if 0 <= t * rate < n else False)

if __name__ == '__main__':
    P = '/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/l5film/'
    e = json.load(open(P + 'assets/voice/b21.env.json'))
    env, rate = e['level'], e['rate']
    dur = len(env) / rate
    variants = {
        'now 0.55': dict(gain=0.55, hz=0, depth=0),
        'cos 5.5 d.9 g.55': dict(gain=0.55, hz=5.5, depth=0.9),
        'cos 5.5 d.9 g.5 p.6': dict(gain=0.5, hz=5.5, depth=0.9, power=0.6),
        'sq 5.5 d1 g.5 p.6': dict(gain=0.5, hz=5.5, depth=1.0, power=0.6, shape='sq', duty=0.55),
        'cos 4.6 d1 g.5 p.6': dict(gain=0.5, hz=4.6, depth=1.0, power=0.6),
        'cos 6.3 d1 g.5 p.6': dict(gain=0.5, hz=6.3, depth=1.0, power=0.6),
    }
    for name, kw in variants.items():
        lf, vf = talk(env, rate, **kw)
        m = mouth(lf, vf, dur)
        # per 0.1 s sample pairs while voiced at both ends: |delta o|
        ds = []
        for k in range(1, int(dur / 0.1)):
            a = m[int((k - 1) * 0.1 / STEP)]; b = m[int(k * 0.1 / STEP)]
            if vf((k - 1) * 0.1) and vf(k * 0.1):
                ds.append(abs(b[1] - a[1]))
        ds.sort()
        peak = max(x[1] for x in m)
        mean = sum(x[1] for x in m if x[3] > 0.5) / max(1, sum(1 for x in m if x[3] > 0.5))
        small = sum(1 for d in ds if d < 0.06) / len(ds)
        print(f'{name:22s} peak o {peak:.2f} mean o {mean:.2f}  |do| per 0.1 s: median {ds[len(ds)//2]:.3f}  p25 {ds[len(ds)//4]:.3f}  share under 0.06: {small:.2f}')
