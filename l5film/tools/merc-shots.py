"""Write Lesson 5's Merc passes (merc/shots/<pass>.json) from cues.json, so the hosts' performances
follow the narration clock exactly.

  python3 tools/merc-shots.py            writes the shot files that changed
  python3 tools/merc-shots.py --check    lists them and writes nothing (exit 1 if any)

Three performances (STORYBOARD § Merc performances): the m01 pair in S1 (0 to the hook's end, both
sliding out in the hook, at 420), then m-orange and m-blue from their leaps to past the film's end
(trap 15), each cut into chunks at the scene boundaries (`chunks`) and rendered chunk by chunk
(tools/merc-pass.mjs --chunk; the chunks join exactly, DECISIONS 129).

The scoring is the board's (Lesson 4's, with `listen`):
  - talk: state `sing` driven by the line's loudness envelope, sound arcs at SPEECH_ARCS, on the
    host's own lines (from 0.05 s before to 0.12 s after);
  - sing: state `sing` from SING_PAD before to SING_PAD after the host's own sound, one voice entry
    per note at its pitch (NOTES, from FACTS 80), full sound arcs over each run of notes; Tavi's
    `demo` follows the page's demo line to the cent (`demoCents`, lesson-05/lines.ts);
  - listen: state `listen` for the first LISTEN_CAP (3 s) of each line the other host speaks (the
    whole line if it is shorter; a remainder under 0.45 s stays in `listen`), then `idle` until the
    line ends (the lead, DECISIONS 161), with its sound arcs scaled to 0 (trap 14: only the host
    making a sound shows arcs); a sound is not talk. Through that listening `idle` the eyes stay
    turned to the speaker: `idle`'s glance away (lookX -0.7, lookY 0.1 for 0.9 s from 2.2 s of
    every 8 s) is cancelled in the pose bias, frame by frame, by the eye springs' own response to
    it (`glance_bias`); its glance toward the speaker (from 5.0 s) stays;
  - idle otherwise: through every sound with no singer (easy, pushed, push, the starts, starts), so
    both stand turned to the drawing, and through `quiet` (breathe, tick-in, hold, tick-out), with
    no arcs: nobody listens to the viewer.
Entrances, hops and the end card's jump are fixed-length states (`fixed`), which win over all the
rest: each leap is one `celebrate` cycle (LEAP_LEN) on its pass's first frame, which the scene
carries in from the frame's edge; Merc's two hops are two `hop` states (the renderer's slot 0, a
hop to his right), 0.65 s apart (the board's rhythm), in `break`, the silent beat made for them
at the recap's clean break (DECISIONS 190, amending 160: nobody talks while hopping), which the scene
carries 590 px each, drawn without the renderer's floor stop marks (`light`: the `stops` slot at
0 through the renderer's setLook; the dotted arc stays); Tavi's end-card hop is one `celebrate`
cycle, which the scene carries 190 px left. A gap under 0.45 s between two runs joins the run
before it, or the run after it when the run before is a fixed state (so a leap never jumps twice).

Facing (DECISIONS 130): both hosts render facing screen right (FACE). Merc stands at the left and
is shown as rendered; Tavi stands at the right and every scene mirrors her passes (scaleX(-1)), so
she faces left. The renderer's `listen` leans and looks to screen right: mirrored, Tavi leans toward
Merc as he leans toward her (unmirrored she leaned away from him). Merc's hops go right, the
renderer's own way, so his passes are never mirrored.

Every time is a cue, a word or a storyboard time mapped onto the voiced clock by
tools/board-clock.py (`board()`), never typed seconds. Passes render at FPS (30 for this step's
labs and critic rounds; the final passes at 60 come after the final voices re-time the film), each
span snapped to that frame grid, so pass frame i is film frame round(filmStart * FPS) + i exactly
(tools/merc-tags.py relies on it). Times in the shot files are shot time (from the pass's start).

Reads cues.json, assets/scenes.js, tools/board-clock.py (its frozen board clock) and
assets/voice/<line>.env.json (by path, in the shots); writes merc/shots/<pass>.json (only those that
changed).
"""
import importlib.util
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CUES = json.load(open(os.path.join(ROOT, 'cues.json')))
C = CUES['cues']
END = CUES['total']

FPS = 30            # this step's passes (the brief: 30 fps for labs and critic rounds)
ARC_FADE = 0.08     # seconds: each arcs window fades in before it and out after it
SPEECH_ARCS = 0.5   # arcs level while a host talks (sung notes: 1.0)
SING_PAD = 0.15     # `sing` from this long before a host's sound to this long after it
GAP = 0.45          # an idle or listen run shorter than this between two runs joins a neighbour
LISTEN_CAP = 3.0    # `listen` holds for the first 3 s of the other host's line, then `idle` (DECISIONS 161)
STEP = 1 / 240      # the renderer's simulation step (src/lib/merc/sim.ts)

# Both render facing screen right; Tavi's passes are mirrored by the scenes (see the docstring).
FACE = [{'t': 0, 'yaw': 0.32, 'lookX': 0.35}]
MIRROR = {'blue': False, 'orange': True}

# A leap in from the frame's edge (Lesson 4 DECISIONS 123): one cycle of the renderer's `celebrate`
# (CEL in sim-choreo.ts: crouch 0.15 s, 0.43 s in the air, settled by 0.8 s) on the pass's first
# frame, opening LEAP before the host's first word, so the host lands 0.80 s and is settled 0.58 s
# before it. Tavi's end-card hop is the same cycle.
LEAP, LEAP_LEN = 1.38, 0.8
# A hop: the renderer's `hop`, slot 0 (HOP in sim-choreo.ts: crouch 0.12 s, 0.41 s in the air,
# landed at 0.53 s), held HOP_LEN (Lesson 4's exits: 0.6 s and 0.06 s to settle).
HOP_LEN = 0.66
FIXED = {'celebrate', 'hop'}

# The board clock (tools/board-cues.json, frozen; DECISIONS 127) mapped onto cues.json.
_spec = importlib.util.spec_from_file_location('board_clock', os.path.join(HERE, 'board-clock.py'))
_bc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_bc)


def board(t):
    """A storyboard time on the voiced clock: by its cue, its word, or its offset in a gap."""
    return round(_bc.where(t)[0], 3)


def cue(cid, edge='start', off=0.0):
    return round(C[cid][edge] + off, 3)


_sj = open(os.path.join(ROOT, 'assets/scenes.js')).read()
SC = json.loads(_sj[_sj.index('=') + 1:].strip().rstrip(';'))


# ---------------------------------------------------------------- the sounds a host makes (FACTS 80)

def note(off, length, midi, cents=0.0, legato=False):
    return {'off': round(off, 4), 'len': round(length, 4), 'midi': midi, 'cents': round(cents, 2), 'legato': legato}


def run(midis, step, last):
    """Notes `step` s apart, the last held `last` s."""
    out = [note(i * step, step, m) for i, m in enumerate(midis[:-1])]
    out.append(note((len(midis) - 1) * step, last, midis[-1]))
    return out


# The page's demo line (src/features/lessons/lesson-05/lines.ts, demoCents): the hand-set rise to
# the band's middle at 0.9 s, then a 5.5 Hz, +-14 cent wave grown in over 0.35 s.
DEMO_RISE = [(0, -60), (0.18, -38), (0.34, -52), (0.5, -22), (0.66, -38), (0.8, -10), (0.9, 0)]
DEMO_STEADY_AT = 0.9
VIBRATO = {'hz': 5.5, 'cents': 14, 'grow': 0.35}


def demo_cents(t):
    if t < DEMO_STEADY_AT:
        for i in range(1, len(DEMO_RISE)):
            t1, c1 = DEMO_RISE[i]
            if t > t1:
                continue
            t0, c0 = DEMO_RISE[i - 1]
            u = (max(t, t0) - t0) / (t1 - t0)
            return c0 + (c1 - c0) * u * u * (3 - 2 * u)
        return 0.0
    s = t - DEMO_STEADY_AT
    return VIBRATO['cents'] * min(1.0, s / VIBRATO['grow']) * math.sin(2 * math.pi * VIBRATO['hz'] * s)


def contour(midi, length, cents, step=1 / 60):
    """One sung note whose pitch follows `cents(t)`: a run of `step`-long legato entries."""
    n = round(length / step)
    return [note(i * step, step, midi, cents(i * step + step / 2), legato=True) for i in range(n)]


NOTES = {
    'gauge': {'blue': [note(0, 10.0, 57)]},                                  # A3, 10 s, unchanged
    'demo': {'orange': contour(69, 10.0, demo_cents)},                       # A4 on the demo line
    'listen': {'blue': [note(0, 2.0, 57)], 'orange': [note(0, 2.0, 69)]},    # A3 and A4 together
    'twinkle': {'blue': run([60, 60, 67, 67, 69, 69, 67], 0.5, 1.0)},        # C C G G A A, G held
}
for _k, _by in NOTES.items():
    for _who, _ns in _by.items():
        _end = _ns[-1]['off'] + _ns[-1]['len']
        assert abs(_end - C[_k]['dur']) < 0.02, (_k, _who, _end, C[_k]['dur'])

# ---------------------------------------------------------------- the passes

QUIET = ('breathe', 'tick-in', 'hold', 'tick-out')
# Merc's two hops (DECISIONS 190, amending 160): nobody talks while hopping, and in the `card` pause
# the hop path crossed the Voice Mirror card, so the pair goes back to the recap's clean break, in
# `break`, the 1.9 s silent beat made for it between b54 and b55. The recap leaves up fast in the
# beat's first 0.56 s; hop 1 starts at its start + 0.60 (in the air + 0.72 to + 1.13), hop 2 the
# board's 0.65 s later (+ 1.25; in the air + 1.37 to + 1.78; a physical rhythm, 509.50 - 508.85 on
# the board), its state ending at + 1.91, 0.29 s before "Practise it." starts.
HOP_GAP = round(509.50 - 508.85, 3)
HOP1 = cue('break', 'start', 0.60)
HOP2 = round(HOP1 + HOP_GAP, 3)
for _c in C.values():                    # the pair is wholly inside a silence: no line, no sound
    if _c['type'] in ('line', 'sound'):
        assert _c['end'] + 0.12 <= HOP1 or _c['start'] - 0.05 >= HOP2 + HOP_LEN, ('hops overlap', _c)
# Tavi's end-card hop, 190 px left (556.05 on the board, the end sting's start + 0.04).
TAVI_HOP = board(556.05)
# Each chunk renders at the largest size its scene shows its host (the brief): 300 everywhere but
# the end card (S6 to S9 show them at 240, rendered at 300).
CHUNK_SIZE = {'s15-end': 400}

PASSES = [
    # S1: on screen from frame 0, at 420, turned toward the chart; neither sings (the takes belong to
    # no host, FACTS 72). Tavi talks o1 and o2, Merc listens; Merc talks b1 and b3, Tavi listens.
    # Both slide 360 px outward in the hook (37.30 to 37.90 on the board: the hook's start + 0.20 to
    # its end, a scene move); each pass ends 0.05 s after the hook.
    dict(id='m01-blue', who='blue', span=(0.0, cue('hook', 'end', 0.05)), size=420),
    dict(id='m01-orange', who='orange', span=(0.0, cue('hook', 'end', 0.05)), size=420),
    # Tavi from her leap in from the right edge (in S3, opening LEAP before o3) to past the end:
    # sings demo and listen, idles through the viewer's turn, hops left on the end card.
    dict(id='m-orange', who='orange', span=(cue('o3', 'start', -LEAP), round(END + 0.1, 3)), size=300,
         fixed=[('celebrate', cue('o3', 'start', -LEAP), LEAP_LEN), ('celebrate', TAVI_HOP, LEAP_LEN)],
         sings=('demo', 'listen'), quiet=QUIET, chunked=True),
    # Merc from his leap in from the left edge (in q0, opening LEAP before b6) to past the end: sings
    # gauge, listen and twinkle, idles through the viewer's turn, hops twice right in `break`, the
    # recap's clean break, without the hop's floor stop marks (the `stops` light at 0).
    dict(id='m-blue', who='blue', span=(cue('b6', 'start', -LEAP), round(END + 0.1, 3)), size=300,
         fixed=[('celebrate', cue('b6', 'start', -LEAP), LEAP_LEN), ('hop', HOP1, HOP_GAP), ('hop', HOP2, HOP_LEN)],
         sings=('gauge', 'listen', 'twinkle'), quiet=QUIET, chunked=True,
         light={'stops': [0, 0, 0]}),
]


def arc_keys(windows, dur):
    """Step keys for the sound arcs: 0 outside every window, its level inside, ARC_FADE linear ramps
    before its start and after its end. Overlapping windows take the larger value."""
    def val(t):
        v = 0.0
        for a, b, lv in windows:
            if t < a - ARC_FADE or t > b + ARC_FADE:
                continue
            w = (t - (a - ARC_FADE)) / ARC_FADE if t < a else ((b + ARC_FADE) - t) / ARC_FADE if t > b else 1.0
            v = max(v, lv * min(1.0, max(0.0, w)))
        return v
    pts = {0.0, dur}
    for a, b, lv in windows:
        for t in (a - ARC_FADE, a, b, b + ARC_FADE):
            if 0.0 <= t <= dur:
                pts.add(round(t, 4))
    keys = [{'t': round(t, 3), 'v': round(val(t), 3)} for t in sorted(pts)]
    out = []
    for i, k in enumerate(keys):
        if 0 < i < len(keys) - 1 and keys[i - 1]['v'] == k['v'] == keys[i + 1]['v']:
            continue
        out.append(k)
    return out


def score(p, t0, t1):
    """The pass's states [(t, state)], voice entries and arcs windows, in shot time."""
    who = p['who']
    other = 'orange' if who == 'blue' else 'blue'
    dur = t1 - t0
    iv, voice, windows = [], [], []   # iv: (start, end, priority, state); the highest priority wins
    heard = []                        # the listening idles: (start, end) while the other host talks
    for cid, c in C.items():
        if c['end'] <= t0 or c['start'] >= t1 or c['end'] <= c['start']:
            continue
        a, b = c['start'] - t0, c['end'] - t0
        if c['type'] == 'line' and c['who'] == who:
            iv.append((a - 0.05, b + 0.12, 2, 'sing'))
            voice.append({'env': f'assets/voice/{cid}.env.json', 'offset': round(a, 3), 'gain': 0.55})
            windows.append((a, b, SPEECH_ARCS))
        elif c['type'] == 'line' and c['who'] == other:
            if b - a <= LISTEN_CAP:
                iv.append((a, b + 0.12, 1, 'listen'))
            else:
                iv.append((a, a + LISTEN_CAP, 1, 'listen'))
                iv.append((a + LISTEN_CAP, b + 0.12, 1, 'idle'))
                heard.append((a + LISTEN_CAP, b + 0.12))
        elif c['type'] == 'sound' and cid in p.get('sings', ()):
            ns = NOTES[cid][who]
            iv.append((a - SING_PAD, b + SING_PAD, 4, 'sing'))
            for i, n in enumerate(ns):
                last = i == len(ns) - 1
                nxt_legato = not last and ns[i + 1]['legato']
                gap = 0 if (last or n['legato']) else 0.04     # a sung note ends 0.04 s before the next
                e = {'t0': round(a + n['off'], 4), 't1': round(a + n['off'] + n['len'] - gap, 4),
                     'level': 0.8, 'cents': n['cents'], 'steady': 0.92, 'midi': n['midi']}
                if n['legato'] and i > 0 and ns[i - 1]['legato']:
                    e['edgeIn'] = 0
                if n['legato'] and nxt_legato:
                    e['edgeOut'] = 0
                voice.append(e)
            ra = rb = None
            for n in ns:                                     # full arcs over each run of notes
                if rb is not None and n['off'] > rb + 1e-6:
                    windows.append((a + ra, a + rb, 1.0))
                    ra = None
                ra = n['off'] if ra is None else ra
                rb = n['off'] + n['len']
            windows.append((a + ra, a + rb, 1.0))
    for cid in p.get('quiet', ()):
        iv.append((C[cid]['start'] - t0, C[cid]['end'] - t0, 6, 'idle'))
    for k, (st, at, length) in enumerate(p.get('fixed', ())):
        a = 0.0 if at - t0 < 0.02 else at - t0               # an entrance on the first frame starts it
        iv.append((a, a + length, 7, f'{st}#{k}'))           # numbered: two hops in a row stay two states
    # sweep the intervals' edges: one state between each pair of edges
    edges = sorted({0.0, dur, *(round(min(dur, max(0.0, x)), 4) for a, b, _, _ in iv for x in (a, b))})
    runs = []
    for lo, hi in zip(edges, edges[1:]):
        mid = (lo + hi) / 2
        best = (0, 'idle')
        for a, b, pr, st in iv:
            if a <= mid < b and pr > best[0]:
                best = (pr, st)
        if runs and runs[-1][1] == best[1]:
            runs[-1][2] = hi
        else:
            runs.append([lo, best[1], hi])
    fixed = lambda r: r[1].split('#')[0] in FIXED
    out = []
    for i, r in enumerate(runs):
        short = (r[2] - r[0]) < GAP and 0 < i < len(runs) - 1 and r[1] in ('idle', 'listen')
        if short and out and not fixed(out[-1]):
            out[-1][2] = r[2]
            continue
        if short and not fixed(runs[i + 1]):
            runs[i + 1][0] = r[0]
            continue
        if out and out[-1][1] == r[1] and not fixed(r):
            out[-1][2] = r[2]
            continue
        out.append(r)
    states = [(round(r[0], 3), r[1].split('#')[0]) for r in out]
    # the idle runs in which the host listens: each with the end of the line it hears
    listening = []
    for r in out:
        if r[1] != 'idle':
            continue
        ends = [e for a, e in heard if a < r[2] and e > r[0]]
        if ends:
            listening.append((r[0], r[2], max(ends)))
    return states, voice, windows, listening


# `idle`'s glances (sim-choreo.ts, idle): from its state's start, tau % 8 in (2.2, 3.1) looks away
# (lookX -0.7, lookY 0.1) and in (5.0, 5.9) toward the side it faces (0.6, 0.25). The eye springs
# (sim-springs.ts: lookX and lookY, 3.2 Hz, damping 0.8, rest 0) are linear and stepped at STEP, and
# the eyes are drawn at spring + bias (sim.ts, pose), so adding minus the springs' response to the
# away pulse to the bias cancels it to within a step at the window's edges.
LOOK_F, LOOK_Z = 3.2, 0.8
AWAY = (2.2, 3.1, -0.7, 0.1)


def glance_bias(listening, dur, fps):
    """The pose bias keys that hold a listening idle's eyes on the speaker: FACE, plus, on every
    frame the away glance moves the eyes, minus the springs' response to it."""
    n = int(dur / STEP) + 2
    tx = [0.0] * n
    ty = [0.0] * n
    for s0, e, heard_end in listening:
        k = 0
        while s0 + 8 * k + AWAY[0] < heard_end:            # a glance that starts while the line runs
            j0, j1 = round(s0 / STEP), min(round(e / STEP), n)
            for j in range(j0, j1):
                tau = (j - j0) * STEP - 8 * k
                if AWAY[0] < tau < AWAY[1]:
                    tx[j] += AWAY[2]
                    ty[j] += AWAY[3]
            k += 1
    w = 2 * math.pi * LOOK_F
    gx = [0.0] * (n + 1)
    gy = [0.0] * (n + 1)
    x = vx = y = vy = 0.0
    for j in range(n):                                       # g[j]: the springs after j steps
        gx[j], gy[j] = x, y
        vx += (w * w * (tx[j] - x) - 2 * LOOK_Z * w * vx) * STEP
        x += vx * STEP
        vy += (w * w * (ty[j] - y) - 2 * LOOK_Z * w * vy) * STEP
        y += vy * STEP
    face = FACE[0]
    keys = [dict(face)]
    live = [i for i in range(round(dur * fps) + 1)
            if abs(gx[min(n, round(i / fps / STEP))]) > 1e-5 or abs(gy[min(n, round(i / fps / STEP))]) > 1e-5]
    want = sorted({j for i in live for j in (i - 1, i, i + 1) if j > 0})
    for i in want:
        g = round(i / fps / STEP)
        keys.append({'t': round(i / fps, 6), 'yaw': face['yaw'], 'lookX': round(face['lookX'] - gx[min(n, g)], 5),
                     'lookY': round(-gy[min(n, g)], 5)})
    return keys


def keep_before_beat(keys, t0):
    """DECISIONS 190 inserted `break` (1.9 s) before b55 after the passes were rendered, and only
    the chunks from s13 on render again. Between two glance blocks the bias eases from one block's
    last key (FACE to within 1e-5, by rounding) toward the next block's first, so the beat, by moving
    that next key 1.9 s later, would move every frame of the long span before it by up to 5e-8 of
    lookX. So the first key after the beat is also written at its time before the beat (FACE, as it
    was there): every frame before the beat keeps exactly the bias it was rendered with."""
    beat, shift = C['break']['start'] - t0, C['break']['dur']
    nxt = next((k for k in keys if k['t'] >= beat), None)
    if nxt is None:
        return keys
    was = round(nxt['t'] - shift, 6)
    prev = max((k['t'] for k in keys if k['t'] < beat), default=None)
    if prev is not None and prev < was and all(abs(k['t'] - was) > 1e-6 for k in keys):
        pin = {'t': was, 'yaw': FACE[0]['yaw'], 'lookX': FACE[0]['lookX'], 'lookY': 0.0}
        keys = sorted(keys + [pin], key=lambda k: k['t'])
    return keys


def chunks(p, P0, N):
    """The pass cut at the scene boundaries: each chunk covers its scene's film frames, one frame
    before them and two after (tools/merc-tags.py shows a pass up to the film frame after the scene)."""
    out = []
    for sid, sc in sorted(SC.items(), key=lambda kv: kv[1]['start']):
        s0 = math.ceil(sc['start'] * FPS - 1e-6)
        s1 = math.ceil(sc['end'] * FPS - 1e-6) - 1
        a, b = max(0, s0 - P0 - 1), min(N - 1, s1 + 2 - P0)
        if s1 < P0 or b - a + 1 < 2:
            continue
        out.append({'id': f"{p['id']}-{sid.split('-')[0]}", 'scene': sid, 'from': a, 'to': b,
                    'size': CHUNK_SIZE.get(sid, 300)})
    return out


def main():
    out_dir = os.path.join(ROOT, 'merc/shots')
    os.makedirs(out_dir, exist_ok=True)
    check = '--check' in sys.argv
    changed = []
    for p in PASSES:
        t0 = round(p['span'][0] * FPS) / FPS                  # snapped to the frame grid
        t1 = round(p['span'][1] * FPS) / FPS
        dur = t1 - t0
        states, voice, windows, listening = score(p, t0, t1)
        P0, N = round(t0 * FPS), round(dur * FPS)
        shot = {
            'id': p['id'],
            'variant': p['who'],
            'size': p['size'],
            'quality': 'medium',
            'fps': FPS,
            'duration': round(dur, 6),
            'filmStart': round(t0, 6),
            'view': 'front',
            'mirror': MIRROR[p['who']],
            'cues': [{'t': t, 'state': st} for t, st in states],
            'voice': voice,
            'arcs': arc_keys(windows, dur),
            'bias': keep_before_beat(glance_bias(listening, dur, FPS), t0),
            'sparkles': 'none',
        }
        if 'light' in p:
            shot['light'] = p['light']
        if p.get('chunked'):
            shot['chunks'] = chunks(p, P0, N)
        path = os.path.join(out_dir, p['id'] + '.json')
        text = json.dumps(shot, indent=1)
        same = os.path.exists(path) and open(path).read() == text
        if not same:
            changed.append(p['id'])
            if not check:
                open(path, 'w').write(text)
        counts = {}
        for _, st in states:
            counts[st] = counts.get(st, 0) + 1
        print(f"{p['id']:11s} {t0:7.2f}-{t1:7.2f} {N:6d} fr  {len(states):3d} cues {len(voice):4d} voice  "
              + ' '.join(f'{k} {v}' for k, v in sorted(counts.items()))
              + (f"  {len(shot['chunks'])} chunks" if 'chunks' in shot else '') + ('' if same else '  (changed)'))
    print(f"{len(changed)} shot{'s' if len(changed) != 1 else ''} {'would change' if check else 'written'}"
          + (': ' + ', '.join(changed) if changed else ''))
    if check and changed:
        sys.exit(1)


if __name__ == '__main__':
    main()
