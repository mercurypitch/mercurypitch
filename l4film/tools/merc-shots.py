"""Write every Merc pass's shot file from cues.json, so his performance follows
the narration clock exactly.

  python3 tools/merc-shots.py            writes the shot files that changed
  python3 tools/merc-shots.py --check    lists them and writes nothing (exit 1 if any)

For each pass in PASSES: inside its span, Merc
  - sings (`sing`, mouth by level, full sound arcs) on his own `sing` cues,
  - talks (`sing` driven by the line's loudness envelope, soft arcs at
    SPEECH_ARCS) on his own lines, so the Merc with sound coming off him is
    the one speaking,
  - idles otherwise, still turned towards the other Merc by his facing bias,
    unless the pass names a state for a cue (`moods`). He never `listen`s:
    that state draws arcs at his side and closes one eye, and on mute it read
    as him talking, first beside the other Merc (critic 05) and then alone in
    S3d while Blue narrates off screen (critic 06). Only the Merc making the
    sound shows arcs, everywhere.
Arcs keys are steps: 0 outside a voiced window, the window's level inside,
with ARC_FADE ramps at each edge (merc-pass.mjs interpolates linearly between
keys, so every edge gets its own pair of keys).
Passes render at FPS (the master's 60). Every span is snapped to that frame
grid, so pass frame i is film frame round(filmStart * FPS) + i exactly
(tools/merc-tags.py relies on it).
Times in the shot files are relative to the pass start (shot time).

Lesson 4 (STORYBOARD § Merc performances and its notes for this tool): every
entrance and exit is a named state with a start and a fixed length (`enter`: a
`drop` of DROP; `exit`: a `hop` of 0.6 s; the slides out of S1 and every move
in S13 and S16 are the scene moving his box), and each pass ends 0.05 s after
its exit ends; m12, which has no exit, runs past the film's end. A drop starts
LAND before its host's first word, so the fall and the splat are over before
he speaks (DECISIONS 81), and every drop pass has a tall intro (merc-pass.mjs
--tall) that shows the fall whole: `intros` below, read by tools/merc-tags.py
and the scenes' L.mercGate. The passes rendered before that decision (m08, m09
and m12) keep their 0.4 s drop (`drop`) under a head pass (`<id>-in`) with the
new entrance, which hands over to them once the two performances agree
(`splice`). The sung runs
are `sound` events with no singer in cues.json, so each pass names the ones its
Merc sings (`sings`: cue -> state): state `sing` (`ride` for S12's sing-along)
from 0.15 s before to 0.15 s after, full sound arcs over each run of notes, and
one voice entry per note at its pitch (NOTES, from FACTS 68), so his mouth, his
stretch and, in `ride`, his lean follow the run. `leads` (cue -> seconds) names
a run whose bead the scene sends out of his mouth that long before its first
note: his mouth opens before the bead leaves and steps up on the note (no sound
arcs until the note). `quiet` names a pause (the
viewer's `your-turn`) through which he idles whatever else is near: nothing in
the film listens to the viewer.
Anchors are cues and words (cues.json), never typed seconds.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
C = json.load(open(os.path.join(ROOT, 'cues.json')))['cues']

FPS = 60            # the master's frame rate: Merc moves on every frame
ARC_FADE = 0.08     # seconds: each arcs window fades in before it and out after it
SPEECH_ARCS = 0.5   # arcs level while he talks (sung notes: 1.0)
MOUTH_OPEN = 0.1    # seconds a lead's mouth opens before its bead leaves: the voice entry's 0.06 s edge
                    # and the mouth spring's (11 Hz, sim-springs.ts) settling
LEAD_LEVEL = 0.45   # a lead's voice level: the mouth 0.65 open (sing: 0.2 + level), the note's 1.0

FACE = {'blue': [{'t': 0, 'yaw': 0.32, 'lookX': 0.35}], 'orange': [{'t': 0, 'yaw': -0.32, 'lookX': -0.35}]}
CAMERA = {'blue': [{'t': 0, 'yaw': 0.0, 'lookX': 0.0}], 'orange': [{'t': 0, 'yaw': 0.0, 'lookX': 0.0}]}
# turned toward the picture from either side (STORYBOARD: "turned right", "turned left")
TURN = {'right': [{'t': 0, 'yaw': 0.32, 'lookX': 0.35}], 'left': [{'t': 0, 'yaw': -0.32, 'lookX': -0.35}]}

SC = {}
_sj = open(os.path.join(ROOT, 'assets/scenes.js')).read()
SC = json.loads(_sj[_sj.index('=') + 1:].strip().rstrip(';'))


def sc(sid, a=0.0, b=0.0):
    """A scene's span, padded (seconds) at either end."""
    return (round(max(0.0, SC[sid]['start'] - a), 3), round(SC[sid]['end'] + b, 3))


def cue(cid, edge='start', off=0.0):
    return round(C[cid][edge] + off, 3)


def _norm(w):
    return ''.join(ch for ch in w.lower() if ch.isalnum() or ch == "'")


def word(cid, which, off=0.0):
    """Film time of a word's start: an index, or a phrase from the line (its first word)."""
    W = C[cid]['words']
    if isinstance(which, int):
        return round(W[which][1] + off, 3)
    want = [_norm(w) for w in which.split()]
    have = [_norm(w[0]) for w in W]
    for i in range(len(have) - len(want) + 1):
        if have[i:i + len(want)] == want:
            return round(W[i][1] + off, 3)
    raise KeyError(f'{cid} does not say {which!r}')


# An entrance's and an exit's length. The renderer's drop falls for 0.55 s (DROP_T in
# src/lib/merc/sim-choreo.ts) and holds its splat for 0.24 s (SPLAT.hold); a state that starts
# sooner cuts the fall in mid-air (the first passes' 0.4 s did: critic B-01 item 3).
DROP, HOP = 0.85, 0.6
DROP_OLD = 0.4      # the drop of the passes rendered before DECISIONS 81 (m08, m09, m12), kept under their heads
LAND = 1.1          # a drop starts this long before its host's first word: fall and splat over 0.26 s before it
TALL_FRAMES = 44    # a drop's tall intro (merc-pass.mjs --tall --until): its first 44 frames, the fall and the splat
SWITCH = 40         # the pass frame where a pass takes over from its tall intro: inside the splat's hold (0.61 to
                    # 0.79 s), where he is still, so the hand-over cannot show even if a tag runs a frame early


def run(midis, step, last):
    """Notes `step` s apart, the last held `last` s: [(offset, length, midi)]."""
    out = [(round(i * step, 3), step, m) for i, m in enumerate(midis[:-1])]
    out.append((round((len(midis) - 1) * step, 3), last, midis[-1]))
    return out


# FACTS 68: every sung run's notes, as (offset from the sound's start, length, midi)
NOTES = {
    'stop-c': run([60, 62, 64, 65, 67, 69, 71], 0.45, 1.2),        # C4 to B4, B4 held
    'stop-d': run([62, 64, 66, 67, 69, 71, 73], 0.45, 1.2),        # D4 to C#5, C#5 held
    'land-d': run([73, 74], 0.45, 1.2),                            # C#5, then D5
    'land-c': run([71, 72], 0.45, 1.2),                            # B4, then C5
    'count-in': [(0.0, 0.8, 50)],                                  # D3, then 0.2 s of silence
}
NOTES['stop-c-home'] = NOTES['stop-c']
# the sing-along: six notes of 0.8 s, ti held 2.0 s, a 0.6 s rest, do 1.2 s
NOTES['sing-a'] = run([50, 52, 54, 55, 57, 59, 61], 0.8, 2.0) + [(7.4, 1.2, 62)]   # D3 to D4
NOTES['sing-b'] = [(t, d, m + 12) for t, d, m in NOTES['sing-a']]                   # D4 to D5


# id, merc, span (start, end) in film time, size, view, facing, quality, extra
# A pass that runs to the end of its last scene is padded past it (+0.05 to
# +0.2 s): merc-tags.py clips the tag to the pass's own last frame, so a pass
# that stopped on the scene's end lost Merc on its last frame (critic 06 saw
# both hosts vanish on the film's final frame).
# Sparkles (the app's celebration stars) are off in every pass: critics 03 and
# 04 read them as a stock effect, even on the end card. Scenes mark a
# celebration with one gold ring instead.
def ended(exit_start, dur=HOP):
    """A pass ends 0.05 s after its exit ends."""
    return round(exit_start + dur + 0.05, 3)


END = json.load(open(os.path.join(ROOT, 'cues.json')))['total']
PASSES = [
    # S1: on screen from frame 0, turned toward the stairs between them. Merc sings stop-c (the scene's
    # bead leaves his mouth 0.3 s before it, so his mouth opens first: `leads`), Tavi stop-d and land-d;
    # each talks his own lines and idles through the other's. Both slide 360 px outward and out of frame
    # from o2's end (the scene moves them, 0.6 s, power2.in); the passes end 0.05 s after the slide.
    dict(id='m01-blue', who='blue', span=(0.0, ended(cue('o2', 'end'))), size=420, bias=FACE['blue'],
         sings={'stop-c': 'sing'}, leads={'stop-c': 0.3}),
    dict(id='m01-orange', who='orange', span=(0.0, ended(cue('o2', 'end'))), size=420, bias=FACE['orange'],
         sings={'stop-d': 'sing', 'land-d': 'sing'}),
    # S4d: drops in at the bottom right before o3, talks o3, hops out right on b7's start.
    dict(id='m04-orange', who='orange', span=(cue('o3', 'start', -LAND), ended(cue('b7', 'start', 0.29))), size=300, view='hero',
         bias=TURN['left'], enter=('drop', cue('o3', 'start', -LAND)), exit=('hop', cue('b7', 'start', 0.29))),
    # S5g to S6a: drops in before o5 (the pass spans the S5 to S6 cut), talks o5, hops out right after it.
    dict(id='m06a-orange', who='orange', span=(cue('o5', 'start', -LAND), ended(cue('o5', 'end', 0.09))), size=300, view='hero',
         bias=TURN['left'], enter=('drop', cue('o5', 'start', -LAND)), exit=('hop', cue('o5', 'end', 0.09))),
    # S6d: drops in before o6, talks o6, idles through b16, hops out right at its end.
    dict(id='m06b-orange', who='orange', span=(cue('o6', 'start', -LAND), ended(cue('b16', 'end', -0.55))), size=300, view='hero',
         bias=TURN['left'], enter=('drop', cue('o6', 'start', -LAND)), exit=('hop', cue('b16', 'end', -0.55))),
    # S7b: drops in before o7, talks o7, hops out right after it.
    dict(id='m07-orange', who='orange', span=(cue('o7', 'start', -LAND), ended(cue('o7', 'end', 0.07))), size=300, view='hero',
         bias=TURN['left'], enter=('drop', cue('o7', 'start', -LAND)), exit=('hop', cue('o7', 'end', 0.07))),
    # S7h to S8d: drops in once the pull has landed, talks o8, idles through b23 to b25 and the slides,
    # hops out right on b25's "keys" (the pass spans the S7 to S8 cut).
    dict(id='m08-orange', who='orange', span=(cue('o8', 'start', -0.46), ended(word('b25', 19))), size=300, view='hero',
         bias=TURN['left'], enter=('drop', cue('o8', 'start', -0.46)), exit=('hop', word('b25', 19)), drop=DROP_OLD),
    # its head: the drop LAND before o8, then the same performance; m08 takes over in the idle after o8
    dict(id='m08-orange-in', who='orange', span=(cue('o8', 'start', -LAND), cue('o8', 'end', 0.7)), size=300, view='hero',
         bias=TURN['left'], enter=('drop', cue('o8', 'start', -LAND)), splice=('m08-orange', cue('o8', 'end', 0.6))),
    # S9e to S11a: drops in once the pull has landed, talks o9, idles through b29 to b34 and both of
    # Merc's runs, talks o10, hops out right as it ends (the pass spans the S9 to S10 and S10 to S11 cuts).
    dict(id='m09-orange', who='orange', span=(cue('o9', 'start', -0.21), ended(cue('o10', 'end'))), size=300, view='hero',
         bias=TURN['left'], enter=('drop', cue('o9', 'start', -0.21)), exit=('hop', cue('o10', 'end')), drop=DROP_OLD),
    dict(id='m09-orange-in', who='orange', span=(cue('o9', 'start', -LAND), cue('o9', 'end', 0.7)), size=300, view='hero',
         bias=TURN['left'], enter=('drop', cue('o9', 'start', -LAND)), splice=('m09-orange', cue('o9', 'end', 0.6))),
    # S10b to S11a: drops in at the bottom left as the pull out of CU-C lands (CU-C's lower stairs fill
    # his corner, so he cannot stand there before it; by 282.2 the pull has cleared it), down 0.28 s
    # before his bead leaves his mouth. That fall runs over b33's last words, the one drop that does
    # (DECISIONS 81). Sings stop-c-home (the scene's bead leaves his mouth 0.3 s before it: `leads`),
    # idles through `wait`, talks b34, sings land-c, idles through o10, and hops out left as it ends,
    # starting b35 as he goes. The renderer's first hop always arcs right, so this pass faces left and
    # the scenes mirror it (scaleX(-1), as Lesson 2's s10): on screen he faces right, toward the
    # stairs, and hops out left.
    dict(id='m10-blue', who='blue', span=(cue('stop-c-home', 'start', -1.37), ended(cue('o10', 'end'))), size=300, view='hero',
         bias=TURN['left'], enter=('drop', cue('stop-c-home', 'start', -1.37)), exit=('hop', cue('o10', 'end')),
         sings={'stop-c-home': 'sing', 'land-c': 'sing'}, leads={'stop-c-home': 0.3}),
    # S11d to S11f: both drop back into their corners, turned toward each other: Tavi LAND before o11,
    # Merc as b36 ends (not while his own voice runs); Tavi talks o11, Merc b37 and b38; both hop out
    # before the act 4 card. Merc's pass faces left and is mirrored, as m10's, so his hop arcs out left.
    dict(id='m11-blue', who='blue', span=(cue('b36', 'end', 0.05), ended(cue('b38', 'end', -0.19))), size=300, view='hero',
         bias=TURN['left'], enter=('drop', cue('b36', 'end', 0.05)), exit=('hop', cue('b38', 'end', -0.19))),
    dict(id='m11-orange', who='orange', span=(cue('o11', 'start', -LAND), ended(cue('b38', 'end', -0.19))), size=300, view='hero',
         bias=TURN['left'], enter=('drop', cue('o11', 'start', -LAND)), exit=('hop', cue('b38', 'end', -0.19))),
    # S12 to S16: one unbroken pass each, from the drop before b39 to past the film's end (trap 15),
    # rendered at 520; the scenes move and scale their boxes (360 in S12, 300 and 240 in S13, 300 in S14
    # and S15, 520 in S16). Merc rides sing-a and sings the count-in; Tavi rides sing-b; both idle
    # through your-turn (no listening, no arcs) and celebrate once on the end card, at the hop the
    # storyboard times (end + 0.87, 0.6 s, inside the 0.85 s state).
    dict(id='m12-blue', who='blue', span=(cue('b39', 'start', -0.39), round(END + 0.1, 3)), size=520, bias=FACE['blue'],
         enter=('drop', cue('b39', 'start', -0.39)), sings={'sing-a': 'ride', 'count-in': 'sing'}, quiet={'your-turn'},
         glideMouth='open', during=[('celebrate', cue('end', 'start', 0.87), cue('end', 'start', 1.72))], sparkles='none',
         drop=DROP_OLD),
    dict(id='m12-orange', who='orange', span=(cue('b39', 'start', -0.39), round(END + 0.1, 3)), size=520, bias=FACE['orange'],
         enter=('drop', cue('b39', 'start', -0.39)), sings={'sing-b': 'ride'}, quiet={'your-turn'},
         glideMouth='open', during=[('celebrate', cue('end', 'start', 0.87), cue('end', 'start', 1.72))], sparkles='none',
         drop=DROP_OLD),
    # their heads: both drop during the act 4 card, Tavi 0.12 s after Merc. Merc talks b39 and rides
    # sing-a before m12-blue takes over, in the first idle with no arcs (a splice under the arcs or the
    # lip flutter would jump their phases); Tavi idles through b39, so m12-orange takes over in it.
    dict(id='m12-blue-in', who='blue', span=(cue('b39', 'start', -LAND), cue('sing-a', 'end', 0.75)), size=520, bias=FACE['blue'],
         enter=('drop', cue('b39', 'start', -LAND)), sings={'sing-a': 'ride'}, glideMouth='open', sparkles='none',
         splice=('m12-blue', cue('sing-a', 'end', 0.65))),
    dict(id='m12-orange-in', who='orange', span=(cue('b39', 'start', -LAND + 0.12), cue('b39', 'start', 2.5)), size=520, bias=FACE['orange'],
         enter=('drop', cue('b39', 'start', -LAND + 0.12)), glideMouth='open', sparkles='none',
         splice=('m12-orange', cue('b39', 'start', 2.4))),
]


def arc_keys(windows, dur):
    """Step keys for the sound arcs: 0 outside every window, its level inside,
    ARC_FADE linear ramps before its start and after its end. Overlapping
    windows take the larger value."""
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
                pts.add(t)
    keys = [{'t': round(t, 3), 'v': round(val(t), 3)} for t in sorted(pts)]
    # drop keys inside a flat run (same value on both sides)
    out = []
    for i, k in enumerate(keys):
        if 0 < i < len(keys) - 1 and keys[i - 1]['v'] == k['v'] == keys[i + 1]['v']:
            continue
        out.append(k)
    return out


def main():
    out_dir = os.path.join(ROOT, 'merc/shots')
    os.makedirs(out_dir, exist_ok=True)
    check = '--check' in sys.argv     # report the shots that would change; write nothing
    changed = []
    for p in PASSES:
        # snap the span to the frame grid: frame i of the pass is film frame P + i
        t0 = round(p['span'][0] * FPS) / FPS
        t1 = round(p['span'][1] * FPS) / FPS
        who = p['who']
        voice = []
        windows = []   # (start, end, arcs level) in shot time, for the arcs keys
        talk = p.get('talk', True)

        def inside(c):
            return c['end'] > t0 and c['start'] < t1

        events = sorted((c for c in C.values() if inside(c) and c['type'] in ('line', 'sing')), key=lambda c: c['start'])
        ids = {id(v): k for k, v in C.items()}
        # intervals: (start, end, priority, state); the highest priority wins
        iv = []
        if 'fixed' not in p:
            for c in events:
                a, b = c['start'] - t0, c['end'] - t0
                cid = ids[id(c)]
                mood = p.get('moods', {}).get(cid)
                if c.get('who') == who and talk:
                    if c['type'] == 'sing':
                        state = 'hum' if cid in p.get('hum', set()) else 'sing'
                        iv.append((a - 0.05, b + 0.12, 2, state))
                        voice.append({'t0': max(0.0, a), 't1': b, 'level': 0.8, 'cents': 0, 'steady': 0.92})
                        windows.append((a, b, 1.0))
                    else:
                        iv.append((a - 0.05, b + 0.12, 2, 'sing'))
                        voice.append({'env': f'assets/voice/{cid}.env.json', 'offset': a, 'gain': 0.55})
                        windows.append((a, b, SPEECH_ARCS))
                    if mood:
                        iv.append((b + 0.12, b + 1.5, 3, mood))
                # the other Merc's lines and notes: he idles (no `listen`), see the docstring
            fixed = []
        else:
            fixed = list(p['fixed'])
        for k2, st in p.get('after', {}).items():
            if k2 in C:
                iv.append((C[k2]['start'] - t0 + 0.2, t1 - t0 + 1, 4, st))
        # after_for: a state for a fixed length after a cue, then back to the
        # default (one celebrate hop on the end card, then stillness).
        for k2, (st, dur) in p.get('after_for', {}).items():
            if k2 in C:
                a = C[k2]['start'] - t0 + 0.2
                iv.append((a, a + dur, 4, st))
        for (a, st) in p.get('fixed_after', []):
            iv.append((a, t1 - t0 + 1, 0.5, st))
        # named entrances and exits, and a state during a stretch
        rel = lambda at: 0.0 if at - t0 < 0.02 else at - t0   # an entrance on the pass's first frame starts it
        if 'enter' in p:
            st, at = p['enter']
            iv.append((rel(at), rel(at) + p.get('drop', DROP), 5, st))
        if 'exit' in p:
            st, at = p['exit']
            iv.append((rel(at), rel(at) + HOP + 0.06, 5, st))
        for st, a1, b1 in p.get('during', []):
            iv.append((rel(a1), b1 - t0, 3, st))
        # the sung runs this Merc sings (sound cues carry no singer): one voice entry per note at its
        # pitch, full arcs over each run of notes, the state from 0.15 s before to 0.15 s after
        for k2, st in p.get('sings', {}).items():
            a0 = C[k2]['start'] - t0
            # a mouth lead (`leads`): the scene's bead leaves his mouth `lead` s before the run, so his
            # mouth opens MOUTH_OPEN s before that, at LEAD_LEVEL, and steps up to the note's level on it
            lead = p.get('leads', {}).get(k2, 0.0)
            pre = lead + MOUTH_OPEN if lead else 0.0
            iv.append((a0 - pre - 0.15, a0 + C[k2]['dur'] + 0.15, 4, st))
            notes = NOTES[k2]
            if lead:
                voice.append({'t0': round(a0 + notes[0][0] - pre, 3), 't1': round(a0 + notes[0][0], 3),
                              'level': LEAD_LEVEL, 'cents': 0, 'steady': 0.92, 'midi': notes[0][2], 'edgeOut': 0})
            for i, (off, d, m) in enumerate(notes):
                last = i == len(notes) - 1
                e = {'t0': round(a0 + off, 3), 't1': round(a0 + off + d - (0 if last else 0.04), 3),
                     'level': 0.8, 'cents': 0, 'steady': 0.92, 'midi': m}
                if lead and i == 0:
                    e['edgeIn'] = 0
                voice.append(e)
            ra = rb = None
            for off, d, m in notes:
                if rb is not None and off > rb + 1e-6:      # a rest: the arcs fall between the runs
                    windows.append((a0 + ra, a0 + rb, 1.0))
                    ra = None
                ra = off if ra is None else ra
                rb = off + d
            windows.append((a0 + ra, a0 + rb, 1.0))
        # a pause he waits through (the viewer's turn): idle over anything else
        for k2 in p.get('quiet', ()):
            iv.append((C[k2]['start'] - t0, C[k2]['end'] - t0, 6, 'idle'))
        dur = t1 - t0
        if fixed:
            merged = [(t, st) for t, st in fixed]
        else:
            grid = [round(i * 0.01, 2) for i in range(int(dur * 100) + 1)]
            states = []
            for t in grid:
                best = (0, 'idle')
                for (a, b, pr, st) in iv:
                    if a <= t < b and pr > best[0]:
                        best = (pr, st)
                states.append(best[1])
            runs = []
            for t, st in zip(grid, states):
                if not runs or runs[-1][1] != st:
                    runs.append([t, st, t])
                runs[-1][2] = t
            # fill short idle gaps (< 0.45 s) between two runs with the earlier state
            out = []
            for i, r in enumerate(runs):
                short = (r[2] - r[0]) < 0.45 and 0 < i < len(runs) - 1 and r[1] in ('idle', 'listen')
                if short and out:
                    out[-1][2] = r[2]
                    continue
                if out and out[-1][1] == r[1]:
                    out[-1][2] = r[2]
                    continue
                out.append(r)
            merged = [(round(max(0.0, r[0]), 3), r[1]) for r in out]
        # fixed passes have no voiced windows; their states draw no scaled arcs
        arcs = arc_keys(windows, dur) if 'fixed' not in p else [{'t': 0.0, 'v': 1.0}]
        shot = {
            'id': p['id'],
            'variant': who,
            'size': p['size'],
            'quality': p.get('quality', 'medium'),
            'fps': FPS,
            'duration': round(dur, 6),
            'filmStart': round(t0, 6),
            'view': p.get('view', 'front'),
            'cues': [{'t': t, 'state': st} for t, st in merged],
            'voice': voice,
            'arcs': arcs,
            'bias': p.get('bias', []),
            'sparkles': p.get('sparkles', 'none'),
        }
        if 'timeScale' in p:
            shot['timeScale'] = p['timeScale']
        if 'glideMouth' in p:
            shot['glideMouth'] = p['glideMouth']
        # write a shot only when it changes: merc-pass.mjs's queue and tools/merc-whole.py count a pass
        # as rendered only while its WebM is newer than its shot file
        path = os.path.join(out_dir, p['id'] + '.json')
        text = json.dumps(shot, indent=1)
        same = os.path.exists(path) and open(path).read() == text
        if not same:
            changed.append(p['id'])
            if not check:
                open(path, 'w').write(text)
        print(f"{p['id']:16s} {t0:7.2f}-{t1:7.2f} {round(dur * FPS):5d} fr {len(merged):2d} cues {len(voice):2d} voice  " + ' '.join(f"{t:.1f}:{s}" for t, s in merged) + ('' if same else '  (changed)'))
    print(f"{len(changed)} shot{'s' if len(changed) != 1 else ''} {'would change' if check else 'written'}{': ' + ', '.join(changed) if changed else ''}")
    # Each drop pass's intro, the videos that play before the pass itself, in film frames: its tall intro
    # from its first frame to SWITCH, then (a pass under a head) the head from SWITCH to the splice.
    # tools/merc-tags.py writes their tags, and L.mercGate (assets/lib/hosts.js) shows each in turn.
    frame = lambda t: round(t * FPS)

    def tall(p):
        # a tall render's drawn square and its padding above and below, as merc-pass.mjs draws them
        # (quality's scale times size; TALL_PAD_SHARE 0.91 of it, to a multiple of 8): L.mercGate needs both
        drawn = round(p['size'] * {'low': 0.5, 'medium': 0.75, 'high': 1.0, 'ultra': 1.0}[p.get('quality', 'medium')])
        return {'drawn': drawn, 'pad': 8 * round(0.91 * drawn / 8)}
    intros = {}
    for p in PASSES:
        if p.get('enter', (None,))[0] != 'drop' or p.get('drop', DROP) != DROP:
            continue
        P0 = frame(p['span'][0])
        if 'splice' in p:
            main_id, at = p['splice']
            N = round((round(p['span'][1] * FPS) - P0))
            intros[main_id] = [
                {'shot': p['id'], 'tall': True, 'from': P0, 'until': P0 + SWITCH, 'frames': TALL_FRAMES, **tall(p)},
                {'shot': p['id'], 'tall': False, 'from': P0 + SWITCH, 'until': frame(at), 'frames': N},
            ]
        else:
            intros[p['id']] = [{'shot': p['id'], 'tall': True, 'from': P0, 'until': P0 + SWITCH, 'frames': TALL_FRAMES, **tall(p)}]
    text = json.dumps(intros, indent=1, sort_keys=True)
    js = ('// Generated by tools/merc-shots.py. Do not edit.\n// Each drop pass: the videos that play before it, '
          'in film frames (see merc-shots.py and L.mercGate).\nwindow.MERC_INTRO = ' + text + ';\n')
    for path, body in ((os.path.join(ROOT, 'merc/intros.json'), text + '\n'), (os.path.join(ROOT, 'assets/merc/intro.js'), js)):
        same = os.path.exists(path) and open(path).read() == body
        if not same and not check:
            open(path, 'w').write(body)
        print(f"{os.path.relpath(path, ROOT)}: {len(intros)} intros{'' if same else (' would change' if check else ' written')}")
    if check and changed:
        sys.exit(1)


if __name__ == '__main__':
    main()
