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

The final passes (`--final`; DECISIONS 189, 201, 203, 225, 227) are the same performances with what
those decisions sent to them, at 60 fps:

  python3 tools/merc-shots.py --final            the final shots: merc/shots/, merc/talk/, merc/final-report.md
  python3 tools/merc-shots.py --final --fps=30 --out=lab/passes-proto/shots     a lab's copy, elsewhere
  python3 tools/merc-shots.py --final --check    lists what would change, writes nothing

  - a talk cycle (TALK): each line's loudness envelope is written again as merc/talk/<line>.env.json,
    the mouth opening and shutting TALK['hz'] times a second from each word's start, so a held vowel
    no longer holds one mouth shape (DECISIONS 201);
  - a breath in before a phrase (BREATH_IN): the mouth opens that long before the first word after
    every pause of PAUSE_MIN or more (DECISIONS 189);
  - a blink in every pause of PAUSE_MIN or more that the renderer's blinks can reach (`plan_blinks`):
    a state's blinks run from its start (sim-choreo.ts), so a cue of the state a host is already in
    restarts them, and such a cue BLINK_AT[state] before the pause puts a blink in it;
  - eyes at rest across every cut (CUT_CLEAR): a `listen` that would start on a cut starts after it
    (DECISIONS 203), and no blink or glance crosses a cut;
  - S14's chunks at S15's size (CHUNK_SIZE_FINAL; DECISIONS 225);
  - the lead's additions (DECISIONS 245, 258): a breath in before each host's own sung sound too
    (`gauge`, `demo`, `listen`, `twinkle`: the same BREATH_IN before the first note), and in `breathe`
    the hosts breathe in with the viewer (BREATHE_WITH: the mouth's small o through the pause).
Without `--final` the tool writes today's shots, byte for byte.
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

FINAL = '--final' in sys.argv   # the final passes' profile (below); without it, today's shots
FINAL_FPS = 60      # DECISIONS 224, 225: the final passes are at the film's 60 fps
# this step's passes are at 30 (the brief: 30 fps for labs and critic rounds); --fps=<n> sets another
FPS = next((int(a[6:]) for a in sys.argv[1:] if a.startswith('--fps=')), FINAL_FPS if FINAL else 30)
ARC_FADE = 0.08     # seconds: each arcs window fades in before it and out after it
SPEECH_ARCS = 0.5   # arcs level while a host talks (sung notes: 1.0)
SING_PAD = 0.15     # `sing` from this long before a host's sound to this long after it
GAP = 0.45          # an idle or listen run shorter than this between two runs joins a neighbour
LISTEN_CAP = 3.0    # `listen` holds for the first 3 s of the other host's line, then `idle` (DECISIONS 161)
STEP = 1 / 240      # the renderer's simulation step (src/lib/merc/sim.ts)

# ---- the final passes' profile (--final). Nothing below changes a shot written without it.
VOICED = 0.04           # tools/merc-pass.mjs: an envelope level above this is voiced
PAUSE_MIN = 0.25        # DECISIONS 189: every pause over this gets a visible idle
# The talk cycle (DECISIONS 201). `sing` opens the mouth to 0.2 + level while voiced and shuts it
# when not (sim-choreo.ts), and the scratch passes fed it the line's loudness as it is, so a held
# vowel held one mouth shape (S8 7.7 to 8.1 s: no pixel changed by 16). The cycle shuts the mouth
# for the last (1 - open) of every 1 / hz s, counted from each word's start (a silence of `gap` or
# more restarts it): hz is speech's own syllable rate; `open` leaves a shut of 55 ms, in which the
# renderer's 45 ms voice smoothing takes the mouth about two thirds of the way down, so it pulses
# between a small o and the word's O and never snaps shut; `power` lifts quiet syllables (the
# envelope's 0.4 opens the mouth as 0.58 did, so the open half of the cycle is as wide as the scratch
# mouth was); `gain` is the scratch passes' own 0.55, so the loudest O stays 0.75 of a sung note's
# (1.0) and talk never opens as wide as singing.
TALK = {'hz': 5.5, 'open': 0.70, 'gain': 0.55, 'power': 0.6, 'gap': 0.06, 'rate': 240}
SPEECH_ARCS_FINAL = 0.5  # the arcs' level while a host talks (unchanged), over each phrase; they pulse with the cycle
# The breath in: the mouth opens (the small o, no sound) this long before the first word after a
# pause, at BREATH_LEVEL (just over VOICED: the mouth's smallest open shape, no squash, no arcs).
BREATH_IN = 0.15
BREATH_LEVEL = 0.05
# The lead's additions (DECISIONS 245, 258). A host breathes in before its own sung sound as before
# a phrase: the same small o for BREATH_IN before the first note, in `sing` from 0.05 s before the
# mouth first moves (as a line that opens on a breath in). And in the pauses of BREATHE_WITH the
# hosts breathe in with the viewer: both in `sing` with the mouth at BREATH_LEVEL (no sound, no arcs)
# from `after` s into the pause, when Merc's mouth has shut on "Breathe in." (the renderer's 45 ms
# voice smoothing shuts it in about 0.1 s), to `before` s from its end, so that both mouths are shut
# again when the tick starts the viewer's note: nobody sings with the viewer (FACTS 87).
BREATHE_WITH = {'breathe': {'after': 0.12, 'before': 0.15}}
# The renderer's blinks (sim-choreo.ts, blinkMul): each takes BLINK_LEN, at these times from its
# state's start, then every `period`. `listen` holds one eye shut and blinks at 3.3 s, after its 3 s cap.
BLINK_LEN = 0.22
BLINK_AT = {'idle': ((1.1, 3.9, 4.18, 6.6), 8.0), 'sing': ((2.7, 6.9), 9.0), 'listen': ((3.3,), 6.0)}
GLANCE_AT = (2.2, 3.1, 5.0, 5.9)   # idle's glances start and end at these times, every 8 s
BLINK_AFTER = 0.10      # the talker's blink starts this long after the voice stops (the mouth has shut)
BLINK_PAIR = 0.03       # the listener's blink follows the talker's by this much, in a pause of
PAIR_MIN = 0.50         # this length or more (a shorter pause is over before a second blink)
OWN_BLINK = 0.35        # a blink the state has within this of the wanted time is the pause's blink
LONG_PAUSE = 1.2        # a pause longer than this goes into `idle`, whose own first blink (1.1 s) is in it
# A cue of the state a host is in restarts its breath too (sim-choreo.ts, breathe: the squash follows
# amp x sin(2 pi tau / 2.8), amp by state), and the squash spring (3 Hz, damping 0.24) answers a step
# with a bounce: restarting `idle` at the top of a breath (2 %) showed as a 3 px jolt at 240 px, a
# tenth of a second after a cut. So a cue of `idle` goes only where the breath is within BREATH_STEP
# of its start value (0.7 % of the body's height: 1 px at 240). A cue of `sing` goes anywhere: its
# whole breath is 1.2 % (a 2 px lift at 240 when it falls in a pause, nothing seen while he talks),
# under the bounce every word gives the body (the squash follows the loudness by up to 4.4 %).
BREATH = {'idle': 0.02, 'sing': 0.012, 'listen': 0.015}
BREATH_PERIOD = 2.8
BREATH_STEP = {'idle': 0.007, 'listen': 0.007, 'sing': 0.012}
BOUNCE = 0.6            # the squash spring's bounce after a step is over in about this long
RECUE_BACK = 2.6        # how far before a cut a cue that clears it may go (`sing`'s first blink is at 2.7 s)
BREATH_STEP_CUT = 0.012 # a cue that takes an eye move off a cut may step an idle breath this far, BOUNCE before it
# Eyes at rest across a cut (DECISIONS 203): nothing that moves an eye from CUT_CLEAR before a scene
# boundary to CUT_CLEAR after it. 0.2 s is 12 frames at 60 fps and a listener's own reaction time,
# so a `listen` moved off a cut still reads as an answer to the line's first word.
CUT_CLEAR = 0.20

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
# The final passes (DECISIONS 225): S14 shows its hosts at 300 from 225 px chunks and S15 at 300
# growing to 400 from 300 px ones, so both sharpened on the cut on `end`; S14's chunks render as S15's.
CHUNK_SIZE_FINAL = {'s14-next': 400, 's15-end': 400}

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


def breath_span(t0, t1, midi):
    """A breath in as a voice entry (the final profile): the mouth's small o from t0 to t1 with no
    sound, a step in and out, at the level a line's breath in has in its talk envelope (BREATH_LEVEL)."""
    return {'t0': round(t0, 4), 't1': round(t1, 4), 'level': BREATH_LEVEL, 'cents': 0, 'steady': 0.95,
            'midi': midi, 'edgeIn': 0, 'edgeOut': 0}


def breathe_with(cid):
    """(start, end) in film time of the hosts' breath in with the viewer in pause `cid` (BREATHE_WITH)."""
    k = BREATHE_WITH[cid]
    a, b = round(C[cid]['start'] + k['after'], 4), round(C[cid]['end'] - k['before'], 4)
    assert b - a >= 2 * BREATH_IN, (cid, 'too short a pause to breathe in with the viewer', a, b)
    return a, b


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
        if c['type'] == 'line' and c['who'] == who and FINAL:
            # the talk cycle's envelope (talk_env), which starts `lead` before the line when the line
            # opens on a breath in; `sing` from 0.05 s before the mouth first moves
            tk = talk_env(cid)
            iv.append((a - tk['lead'] - 0.05, b + 0.12, 2, 'sing'))
            voice.append({'env': f'{TALK_DIR}/{cid}.env.json', 'offset': round(a - tk['lead'], 6), 'gain': 1})
            # the arcs over each phrase, not over the pauses between: the breath in is not a sound
            # (trap 14), and its BREATH_LEVEL would draw them at 3 %
            windows += [(a + pa, a + pb, SPEECH_ARCS_FINAL) for pa, pb in voiced_runs(cid, PAUSE_MIN)]
        elif c['type'] == 'line' and c['who'] == who:
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
            if FINAL:
                # a breath in before the host's own sound (DECISIONS 245): the mouth's small o for
                # BREATH_IN before the first note, a step in and out (the note's own soft edge opens it
                # from there); `sing` from 0.05 s before the mouth first moves, as before a phrase
                iv.append((a - BREATH_IN - 0.05, b + SING_PAD, 4, 'sing'))
                voice.append(breath_span(a - BREATH_IN, a, ns[0]['midi']))
            else:
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
        if FINAL and cid in BREATHE_WITH:
            # the hosts breathe in with the viewer (DECISIONS 245): `sing`, over the quiet `idle`,
            # with the mouth's small o and no sound, from 0.05 s before the mouth opens to 0.05 s after
            # it has shut
            ba, bb = breathe_with(cid)
            iv.append((ba - 0.05 - t0, bb + 0.05 - t0, 6.5, 'sing'))
            voice.append(breath_span(ba - t0, bb - t0, 57 if who == 'blue' else 69))
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
    if FINAL:
        # the runs as they are ([start, state, end], shot time): main() plans the blinks and the cuts
        # on them, and writes the states and the listening idles from what it planned
        return [[r[0], r[1].split('#')[0], r[2]] for r in out], voice, windows, heard
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


# ---------------------------------------------------------------- the final passes (--final)

_out = next((a[6:] for a in sys.argv[1:] if a.startswith('--out=')), os.path.join('merc', 'shots'))
OUT_DIR = _out if os.path.isabs(_out) else os.path.join(ROOT, _out)        # the shot files
# the talk cycle's envelopes sit beside the shots; the shots name them from the project's root
TALK_DIR = os.path.relpath(os.path.join(os.path.dirname(OUT_DIR), 'talk'), ROOT).replace(os.sep, '/')
REPORT = os.path.join(os.path.dirname(OUT_DIR), 'final-report.md')
BLIP = {'len': 0.05, 'level': 0.12, 'apart': 0.1}   # a click in a take's pause, not a syllable (voiced_runs)
LISTEN_MOVE = 0.5       # `listen` leans in over 0.5 s and shuts one eye at 0.25 s (sim-choreo.ts)
GLANCE_MOVE = 0.35      # the eye springs (3.2 Hz, damping 0.8) settle in about this long
_ENV, _TALK = {}, {}


def envelope(cid):
    if cid not in _ENV:
        e = json.load(open(os.path.join(ROOT, 'assets', 'voice', cid + '.env.json')))
        _ENV[cid] = (e['rate'], e['level'])
    return _ENV[cid]


def voiced_runs(cid, join=0.0):
    """A line's voiced stretches, [start, end) in seconds from its start: its envelope above VOICED,
    stretches less than `join` apart taken as one. A click is left out: a stretch shorter than
    BLIP['len'] and quieter than BLIP['level'] that stands BLIP['apart'] or more from the stretches
    either side (a breath or a lip noise in a pause; a word's own tail or onset stays)."""
    rate, lv = envelope(cid)
    raw, i, n = [], 0, len(lv)
    while i < n:
        if lv[i] > VOICED:
            j = i
            while j < n and lv[j] > VOICED:
                j += 1
            raw.append((i / rate, j / rate, max(lv[i:j])))
            i = j
        else:
            i += 1
    runs = []
    for k, (a, b, peak) in enumerate(raw):
        before = a - raw[k - 1][1] if k else 1e9
        after = raw[k + 1][0] - b if k + 1 < len(raw) else 1e9
        if b - a < BLIP['len'] - 1e-9 and peak < BLIP['level'] and before >= BLIP['apart'] - 1e-9 and after >= BLIP['apart'] - 1e-9:
            continue
        if runs and a - runs[-1][1] < join - 1e-9:
            runs[-1][1] = b
        else:
            runs.append([a, b])
    return runs


def find_pauses():
    """Every stretch of PAUSE_MIN or more in which nobody talks or sings and no sound plays:
    [(start, end, who talked before or None, the cue before, who talks after or None, the cue after)]."""
    act = []
    for cid, c in C.items():
        if c['type'] == 'line':
            act += [(c['start'] + a, c['start'] + b, c['who'], cid) for a, b in voiced_runs(cid, PAUSE_MIN)]
        elif c['type'] in ('sound', 'sting') and c['end'] > c['start']:
            act.append((c['start'], c['end'], None, cid))
    act.sort()
    out, last = [], None
    for a in act:
        if last is not None and a[0] - last[1] >= PAUSE_MIN - 1e-9:
            out.append((round(last[1], 4), round(a[0], 4), last[2], last[3], a[2], a[3]))
        if last is None or a[1] > last[1]:
            last = a
    return out


PAUSES = find_pauses() if FINAL else []


def talk_env(cid):
    """A line's loudness for the final passes (TALK, BREATH_IN): {rate, level, lead}. `level` starts
    `lead` s before the line (BREATH_IN when the line opens on a breath in, else 0). Each word (voiced
    stretches less than TALK['gap'] apart) opens the mouth at gain * loudness ** power for the first
    `open` of every 1 / hz s from its start and shuts it (level 0: not voiced) for the rest; the
    BREATH_IN before the first word after a pause holds BREATH_LEVEL (the mouth's small o)."""
    if cid in _TALK:
        return _TALK[cid]
    rate, lv = envelope(cid)
    start = C[cid]['start']
    R = TALK['rate']
    runs = voiced_runs(cid)
    after_pause = {round(p[1], 4) for p in PAUSES}
    breaths = [a for a, b in voiced_runs(cid, PAUSE_MIN) if round(start + a, 4) in after_pause]
    lead = BREATH_IN if runs and breaths and abs(breaths[0] - runs[0][0]) < 1e-9 else 0.0
    n = math.ceil((lead + len(lv) / rate) * R)
    out = [0.0] * n
    at = lambda t: max(0, min(n, round((t + lead) * R)))            # the sample that starts at line time t
    word = None
    for a, b in runs:
        if word is None or a - word[1] >= TALK['gap'] - 1e-9:
            word = [a, b]
        word[1] = b
        for j in range(at(a), at(b)):
            t = (j + 0.5) / R - lead
            if ((t - word[0]) * TALK['hz']) % 1.0 < TALK['open']:
                src = lv[min(len(lv) - 1, int(t * rate))]
                out[j] = round(max(BREATH_LEVEL, min(1.0, TALK['gain'] * max(src, 0.0) ** TALK['power'])), 3)
    for a in breaths:
        for j in range(at(a - BREATH_IN), at(a)):
            out[j] = max(out[j], BREATH_LEVEL)
    _TALK[cid] = {'rate': R, 'lead': lead, 'level': out, 'breaths': len(breaths),
                  'from': f'assets/voice/{cid}.env.json', 'talk': TALK, 'breathIn': BREATH_IN}
    return _TALK[cid]


class Track:
    """One host's states in film time, with the eye events the renderer gives them. A state's blinks
    (BLINK_AT) and idle's glances (GLANCE_AT) run from the state's start, so a cue of the state the host
    is already in restarts them: that is how a blink is put where it is wanted, and how one is taken
    off a cut. Such a cue changes nothing else but the breath's phase (under 2 % of the squash)."""

    def __init__(self, runs, t0, heard, talk=()):
        self.cues = [[t0 + a, st] for a, st, b in runs]
        self.end = t0 + runs[-1][2]
        self.heard = [(t0 + a, t0 + b) for a, b in heard]     # the listening idles' lines (DECISIONS 161)
        self.talk = list(talk)                                # when the host's own voice sounds, film time
        self.cuts = []                                        # the scene boundaries (plan_final)
        self.kept = []          # the blinks planned, {t, how, own, lo, hi}: no later cue may cut or cancel one
        self.added = []         # the cues added, with why

    def at(self, t):
        i = max(k for k, c in enumerate(self.cues) if c[0] <= t + 1e-9) if self.cues[0][0] <= t + 1e-9 else 0
        return i, self.cues[i][0], self.cues[i][1], (self.cues[i + 1][0] if i + 1 < len(self.cues) else self.end)

    def blinks(self, i):
        """Cue i's blinks, [(start, end)], an end past the cue's own end cut to it."""
        s0, st = self.cues[i]
        s1 = self.cues[i + 1][0] if i + 1 < len(self.cues) else self.end
        out = []
        times, period = BLINK_AT.get(st, ((), 1.0))
        k = 0
        while times and s0 + k * period + times[0] < s1:
            out += [(s0 + k * period + b, min(s1, s0 + k * period + b + BLINK_LEN)) for b in times if s0 + k * period + b < s1]
            k += 1
        return out

    def glances(self, i):
        """Cue i's eye moves by idle's glances, [(start, end)]: each glance's start and end, with the
        springs' settle. An away glance in a listening idle is cancelled in the bias (glance_bias)."""
        s0, st = self.cues[i]
        s1 = self.cues[i + 1][0] if i + 1 < len(self.cues) else self.end
        if st != 'idle':
            return []
        ends = [e for a, e in self.heard if a < s1 and e > s0]
        out, k = [], 0
        while s0 + 8 * k + GLANCE_AT[0] < s1:
            for j, g in enumerate(GLANCE_AT):
                if j < 2 and ends and s0 + 8 * k + AWAY[0] < max(ends):
                    continue
                if s0 + 8 * k + g < s1:
                    out.append((s0 + 8 * k + g, min(s1, s0 + 8 * k + g + GLANCE_MOVE)))
            k += 1
        return out

    def jolt(self, i, r):
        """How far a cue at r, inside cue i, steps the breath past what its state allows (BREATH_STEP),
        as a share of the body's height: 0 when it is allowed. Nothing while the host talks there."""
        s0, st = self.cues[i]
        if st == 'sing' and any(a - 0.02 <= r <= b + 0.02 for a, b in self.talk):
            return 0.0
        step = BREATH.get(st, 0.0) * abs(math.sin(2 * math.pi * (r - s0) / BREATH_PERIOD))
        # (the bounce rings for about half a second: none of any size from BOUNCE before a cut to CUT_CLEAR after)
        limit = BREATH_STEP['idle'] if any(c - BOUNCE < r < c + CUT_CLEAR for c in self.cuts) else BREATH_STEP.get(st, 0.0)
        return step if step > limit + 1e-9 else 0.0

    def glancing(self, i, r):
        """Is cue i in a glance at r (the eyes away from rest, or on their way back)?"""
        s0 = self.cues[i][0]
        if self.cues[i][1] != 'idle':
            return False
        tau = (r - s0) % 8.0
        ends = [e for a, e in self.heard if a < r and e > s0]
        for a, b in ((GLANCE_AT[0], GLANCE_AT[1]), (GLANCE_AT[2], GLANCE_AT[3])):
            if a - 0.02 < tau < b + GLANCE_MOVE and not (a == GLANCE_AT[0] and ends and r - tau + AWAY[0] < max(ends)):
                return True
        return False

    def busy(self, i, r, glance_ok=False, moved=None):
        """Would a cue at r, inside cue i, cut a blink short, cancel a planned blink, or (unless
        `glance_ok`) send the eyes back from a glance early? With `moved` (a list), a planned blink that
        was the state's own may move to the new cue's first blink if that is in the same pause; the
        list gets those."""
        if any(bs - 1e-6 < r < be + 0.02 for bs, be in self.blinks(i)):
            return True
        if not glance_ok and self.glancing(i, r):
            return True
        s0, st = self.cues[i]
        s1 = self.cues[i + 1][0] if i + 1 < len(self.cues) else self.end
        for k in self.kept:
            if s0 - 1e-6 <= k['t'] < s1 and k['t'] + BLINK_LEN > r - 0.02:
                if moved is not None and k['own'] and k['t'] > r and k['lo'] - 0.03 <= r + BLINK_AT[st][0][0] <= k['hi'] + 1e-6:
                    moved.append(k)
                    continue
                return True
        return False

    def add(self, i, r, why):
        self.cues.insert(i + 1, [r, self.cues[i][1]])
        self.added.append((r, self.cues[i][1], why))

    def blink_in(self, lo, hi, cuts, own=None, cue=True):
        """A blink that starts in [lo, hi]: one the state has there already (within `own` of lo), or
        (with `cue`) one from a cue of the same state BLINK_AT[state][0] earlier. Returns (the blink's
        record, None) or (None, why not)."""
        own = OWN_BLINK if own is None else own
        i, s0, st, s1 = self.at(lo)
        clear = lambda t: all(t + BLINK_LEN < c - CUT_CLEAR or t > c + CUT_CLEAR for c in cuts)
        for k in range(i, len(self.cues)):
            if self.cues[k][0] > hi:
                break
            mine = self.blinks(k)
            for bs, be in mine:
                # (idle blinks twice, 0.28 s apart, at 3.9 s: the second must be clear of a cut too)
                if lo - 0.03 <= bs <= min(hi, lo + own) + 1e-6 and be - bs > BLINK_LEN - 1e-6 \
                        and all(clear(x) for x, _ in mine if bs <= x < bs + 0.5):
                    self.kept.append({'t': bs, 'how': 'its own', 'own': True, 'lo': lo, 'hi': min(hi, lo + own)})
                    return self.kept[-1], None
        if not cue:
            return None, 'it has none there'
        if st == 'listen':
            return None, 'in `listen` (one eye shut; its blink is at 3.3 s, after the 3 s cap)'
        if st not in BLINK_AT:
            return None, f'in `{st}`'
        first = BLINK_AT[st][0][0]
        tb = lo
        while tb <= hi + 1e-6:
            r = tb - first
            if r < s0 + 0.02:
                return None, f'`{st}` starts {tb - s0:.2f} s before it, its first blink is at {first}'
            if not clear(tb):
                tb = next(c for c in cuts if not (tb + BLINK_LEN < c - CUT_CLEAR or tb > c + CUT_CLEAR)) + CUT_CLEAR + 0.01
                continue
            if self.busy(i, r) or self.jolt(i, r) > 0:
                tb += 0.02
                continue
            if tb + BLINK_LEN > s1 - 1e-6:
                # the state would end inside the blink: an `idle` or a `listen` after it starts when the blink ends
                nxt = self.cues[i + 1] if i + 1 < len(self.cues) else None
                after = self.cues[i + 2][0] if i + 2 < len(self.cues) else self.end
                room = nxt and nxt[1] != st and nxt[1] in ('idle', 'listen') and after - (tb + BLINK_LEN + 0.02) >= 0.3
                if not room or tb + BLINK_LEN + 0.02 - nxt[0] > 0.3:
                    return None, f'`{st}` ends {s1 - tb:.2f} s after it starts'
                nxt[0] = tb + BLINK_LEN + 0.02
            self.add(i, r, f'blink at {tb:.2f}')
            self.kept.append({'t': tb, 'how': 'cued', 'own': False, 'lo': lo, 'hi': hi})
            return self.kept[-1], None
        return None, 'no cue fits: the blink before it is too close, or the breath would jolt'

    def moves(self, lo, hi):
        """Every eye move that touches [lo, hi]: (start, end, what, the cue's index)."""
        out = []
        for i, (t, st) in enumerate(self.cues):
            s1 = self.cues[i + 1][0] if i + 1 < len(self.cues) else self.end
            if s1 < lo - 10 or t > hi + 1:
                continue
            prev = self.cues[i - 1][1] if i else None
            if prev is not None and prev != st and 'listen' in (prev, st) and not ({prev, st} & FIXED):
                out.append((t, t + LISTEN_MOVE, f'`{prev}` to `{st}`', i))
            out += [(a, b, 'blink', i) for a, b in self.blinks(i)]
            out += [(a, b, 'glance', i) for a, b in self.glances(i)]
        return [m for m in out if m[0] < hi and m[1] > lo]

    def cut_blinks(self):
        """The blinks a later cue cuts short: (the blink's start, the cue's time, the cue's index)."""
        out = []
        for i in range(len(self.cues) - 1):
            t = self.cues[i + 1][0]
            out += [(bs, t, i) for bs, be in self.blinks(i) if bs < t - 1e-6 and be >= t - 1e-6 and t - bs < BLINK_LEN - 1e-6]
        return out

    def recue(self, i, before, why, half=CUT_CLEAR):
        """A cue of cue i's own state before `before`, so that none of its blinks or glances is under
        way from `before` - half to `before` + half: what the state did before the cue is over before
        that window, and what it does after the cue (its blinks, idle's glances) misses it. A cue inside
        a glance sends the eyes back at once, so it must leave them GLANCE_MOVE to settle. Of the places
        that do, the nearest that leaves the breath where it is (`jolt`); none within RECUE_BACK means
        the cue is not made. True if one was made."""
        s0, st = self.cues[i]
        if st not in BLINK_AT or st == 'listen':
            return False
        times, period = BLINK_AT[st]
        lo, hi = before - half, before + half
        d = half + 0.05
        best = None
        while d < RECUE_BACK and before - d > s0 + 0.05:
            r = before - d
            moved = []
            ok = not self.busy(i, r, glance_ok=True, moved=moved)
            ok = ok and not (self.glancing(i, r) and r + GLANCE_MOVE > lo)
            ok = ok and not any(a < hi and b > lo for a, b in self.blinks(i) if a < r)
            ok = ok and not any(a < hi and min(b, r + GLANCE_MOVE) > lo for a, b in self.glances(i) if a < r)
            ok = ok and not any(r + k * period + b0 < hi and r + k * period + b0 + BLINK_LEN > lo for k in (0, 1) for b0 in times)
            ok = ok and not (st == 'idle' and any(r + g < hi and r + g + GLANCE_MOVE > lo for g in GLANCE_AT))
            if ok:
                # a place that leaves the breath where it is; failing that, one BOUNCE or more before
                # the window (the bounce is over by then) that steps it least, up to BREATH_STEP_CUT
                j = self.jolt(i, r)
                raw = BREATH.get(st, 0.0) * abs(math.sin(2 * math.pi * (r - s0) / BREATH_PERIOD))
                if j == 0:
                    best = (0.0, r, moved)
                    break
                if d >= BOUNCE and raw <= BREATH_STEP_CUT and (best is None or raw < best[0] - 1e-9):
                    best = (raw, r, moved)
            d += 0.02
        if best is None:
            return False
        step, r, moved = best
        self.add(i, r, why + (f' (the breath steps {step * 100:.1f} %, {before - r:.2f} s before it)' if step > 0 else ''))
        for k in moved:
            k['t'], k['how'] = r + times[0], 'its own, after a cue that keeps a cut clear'
        return True


def plan_final(tracks, who_of, span_of):
    """The blinks in the pauses and the eyes at the cuts, on every pass's track. Returns the report's
    rows: the pauses with what each host does in them, and what was moved for the cuts."""
    cuts = sorted(v['start'] for v in SC.values() if v['start'] > 0)
    host = lambda who, t: next((pid for pid in tracks if who_of[pid] == who and span_of[pid][0] <= t and t + 1.0 <= span_of[pid][1]), None)
    notes = []
    for tr in tracks.values():
        tr.cuts = cuts

    def clear_cuts(pid, tr):
        """Nothing moves an eye across a cut, and no cue cuts a blink short."""
        # a `listen` never starts or ends on a cut (DECISIONS 203): it starts CUT_CLEAR after it
        for c in cuts:
            for i in range(1, len(tr.cues)):
                t, st = tr.cues[i]
                prev = tr.cues[i - 1][1]
                if prev == st or 'listen' not in (prev, st) or ({prev, st} & FIXED):
                    continue
                if t < c + CUT_CLEAR - 1e-6 and t + LISTEN_MOVE > c - CUT_CLEAR:
                    nxt = tr.cues[i + 1][0] if i + 1 < len(tr.cues) else tr.end
                    if st == 'sing' or nxt - (c + CUT_CLEAR) < 0.3:
                        if (c, pid, i, 'left') not in seen:
                            seen.add((c, pid, i, 'left'))
                            notes.append((c, pid, f'`{prev}` to `{st}` at {t:.3f} is left on the cut: `{st}` cannot wait'))
                        continue
                    notes.append((c, pid, f'`{prev}` to `{st}` moved from {t:.3f} to {c + CUT_CLEAR:.3f} ({t - c:+.3f} s from the cut)'))
                    tr.cues[i][0] = c + CUT_CLEAR
        # a blink or a glance on a cut, or a blink a later cue cuts short: a cue of the state's own,
        # shortly before, restarts its blinks and glances clear of both
        left = set()
        for _ in range(400):
            found = None
            for c in cuts:
                found = next(((c, a, what, i) for a, b, what, i in tr.moves(c - CUT_CLEAR, c + CUT_CLEAR)
                              if what in ('blink', 'glance') and (c, round(a, 3)) not in left), None)
                if found:
                    break
            if found:
                c, a, what, i = found
                if tr.recue(i, c, f'{what} at {a:.2f} off the cut at {c:.3f}'):
                    notes.append((c, pid, f'{what} at {a:.3f} taken off the cut by a cue of its state'))
                else:
                    left.add((c, round(a, 3)))
                    if (c, pid, round(a, 3)) not in seen:
                        seen.add((c, pid, round(a, 3)))
                        notes.append((c, pid, f'{what} at {a:.3f} IS LEFT ON THE CUT (no cue of its state clears it)'))
                continue
            short = next(((bs, t, i) for bs, t, i in tr.cut_blinks() if (t, round(bs, 3)) not in left), None)
            if not short:
                break
            bs, t, i = short
            nxt, st = tr.cues[i + 1], tr.cues[i][1]
            after = tr.cues[i + 2][0] if i + 2 < len(tr.cues) else tr.end
            if nxt[1] != st and nxt[1] in ('idle', 'listen') and after - (bs + BLINK_LEN + 0.02) >= 0.3 \
                    and all(not (c - CUT_CLEAR - LISTEN_MOVE < bs + BLINK_LEN + 0.02 < c + CUT_CLEAR) for c in cuts):
                # the state after it can wait the rest of the blink (under BLINK_LEN)
                nxt[0] = bs + BLINK_LEN + 0.02
                notes.append((t, pid, f'blink at {bs:.3f} would be cut short by `{nxt[1]}` at {t:.3f}: `{nxt[1]}` waits until {nxt[0]:.3f}'))
            elif st == 'listen' and bs - 0.05 > tr.cues[i][0] + 0.5:
                # a `listen` that runs past its 3 s cap by a short remainder (DECISIONS 161) reaches its
                # blink at 3.3 s and is cut in it: it ends 0.05 s before the blink, in `idle`
                tr.cues.insert(i + 1, [bs - 0.05, 'idle'])
                tr.added.append((bs - 0.05, 'idle', 'listen ends before its blink'))
                notes.append((t, pid, f'`listen` would start its blink at {bs:.3f} and be cut at {t:.3f}: it ends in `idle` at {bs - 0.05:.3f}'))
            elif tr.recue(i, t, f'blink at {bs:.2f} not cut short at {t:.2f}', half=0.03):
                notes.append((t, pid, f'blink at {bs:.3f} would be cut short by the cue at {t:.3f}: restarted clear of it'))
            else:
                left.add((t, round(bs, 3)))
                if (t, pid, round(bs, 3)) not in seen:
                    seen.add((t, pid, round(bs, 3)))
                    notes.append((t, pid, f'blink at {bs:.3f} IS CUT SHORT by the cue at {t:.3f} (no cue of its state moves it)'))

    seen = set()
    # 1. the states as scored: the cuts cleared before any blink is planned, so that a blink is
    #    planned on the blinks and glances the hosts will have
    for pid, tr in tracks.items():
        clear_cuts(pid, tr)
    # 2. the blinks in the pauses: the talker's first, then the listener's.
    #    A state's blinks are at least its first blink's time and a blink apart (`sing`: 2.92 s), so two
    #    pauses closer than that cannot both have the talker's. The pauses up to LONG_PAUSE come first,
    #    the longest first; a longer pause comes after them, and if its blink cannot be cued where it is
    #    wanted, any blink the state has inside it will do (it goes into `idle`, which blinks 1.1 s in)
    rows = [{'p0': p0, 'p1': p1, 'before': cb, 'after': ca, 'talker': wb or wa or 'blue', 'blinks': {}, 'why': {}}
            for p0, p1, wb, cb, wa, ca in PAUSES]
    long_ = lambda r: r['p1'] - r['p0'] > LONG_PAUSE

    def ask(row, pid, lo, hi):
        tb, how = tracks[pid].blink_in(lo, hi, cuts)
        if tb is None and long_(row):
            tb, how2 = tracks[pid].blink_in(lo, hi, cuts, own=hi - lo, cue=False)
        (row['blinks'] if tb is not None else row['why'])[pid] = tb if tb is not None else how

    for row in sorted(rows, key=lambda r: (long_(r), -(r['p1'] - r['p0']) if not long_(r) else r['p0'], r['p0'])):
        pid = host(row['talker'], row['p0'])
        if pid:
            lo = row['p0'] + BLINK_AFTER
            ask(row, pid, lo, max(lo, row['p1'] - BLINK_LEN - 0.02))
    for row in rows:
        p0, p1 = row['p0'], row['p1']
        other = 'orange' if row['talker'] == 'blue' else 'blue'
        pid = host(other, p0)
        if not pid:
            continue
        first = next(iter(row['blinks'].values()), None)
        if p1 - p0 < PAIR_MIN - 1e-9 and first:
            continue
        lo = min(first['t'] + BLINK_LEN + BLINK_PAIR, p0 + BLINK_AFTER + OWN_BLINK) if first else p0 + BLINK_AFTER
        ask(row, pid, lo, max(lo, p1 - 0.05))
        if pid not in row['blinks'] and lo > p0 + BLINK_AFTER + 1e-6:
            # no cue fits after the talker's blink: with it, from the pause's start
            row['why'].pop(pid, None)
            ask(row, pid, p0 + BLINK_AFTER, lo)
    # 3. the cuts again, for what the planned cues brought (a state's later blinks, a state that waits)
    for pid, tr in tracks.items():
        clear_cuts(pid, tr)
    return rows, notes, cuts


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
                    'size': (CHUNK_SIZE_FINAL if FINAL else CHUNK_SIZE).get(sid, 300)})
    return out


def main_final():
    """The final passes' shots (see the docstring): merc/shots/<pass>.json (or --out), the talk cycle's
    envelopes beside them (talk/<line>.env.json) and final-report.md, the pauses and the cuts."""
    check = '--check' in sys.argv
    scored, tracks, who_of, span_of = {}, {}, {}, {}
    for p in PASSES:
        t0 = round(p['span'][0] * FPS) / FPS
        t1 = round(p['span'][1] * FPS) / FPS
        runs, voice, windows, heard = score(p, t0, t1)
        scored[p['id']] = (p, t0, t1, voice, windows)
        talk = [(c['start'] + a, c['start'] + b) for cid, c in C.items() if c['type'] == 'line' and c['who'] == p['who']
                for a, b in voiced_runs(cid, TALK['gap'])]
        tracks[p['id']] = Track(runs, t0, heard, talk)
        who_of[p['id']], span_of[p['id']] = p['who'], (t0, t1)
    before = {pid: len(tr.cues) for pid, tr in tracks.items()}
    rows, notes, cuts = plan_final(tracks, who_of, span_of)
    files = {}
    for pid, (p, t0, t1, voice, windows) in scored.items():
        tr = tracks[pid]
        dur = t1 - t0
        P0, N = round(t0 * FPS), round(dur * FPS)
        cues = [{'t': round(max(0.0, t - t0), 3), 'state': st} for t, st in tr.cues]
        assert all(b['t'] > a['t'] for a, b in zip(cues, cues[1:])), (pid, 'cues out of order')
        # a breath in before a sung sound or with the viewer never lies over the host's own voice
        for v in voice:
            if 't0' in v and v['level'] == BREATH_LEVEL:
                assert not any(a < t0 + v['t1'] and b > t0 + v['t0'] for a, b in tr.talk), (pid, 'a breath in over a line', v)
        # the idles in which the host listens, cue by cue: a cue of `idle` restarts its glances
        listening = []
        for i, (t, st) in enumerate(tr.cues):
            s1 = tr.cues[i + 1][0] if i + 1 < len(tr.cues) else tr.end
            ends = [e for a, e in tr.heard if a < s1 and e > t]
            if st == 'idle' and ends:
                listening.append((t - t0, s1 - t0, max(ends) - t0))
        shot = {
            'id': pid, 'variant': p['who'], 'size': p['size'], 'quality': 'medium', 'fps': FPS, 'profile': 'final',
            'duration': round(dur, 6), 'filmStart': round(t0, 6), 'view': 'front', 'mirror': MIRROR[p['who']],
            'cues': cues, 'voice': voice, 'arcs': arc_keys(windows, dur),
            'bias': glance_bias(listening, dur, FPS), 'sparkles': 'none',
        }
        if 'light' in p:
            shot['light'] = p['light']
        if p.get('chunked'):
            shot['chunks'] = chunks(p, P0, N)
        files[os.path.join(OUT_DIR, pid + '.json')] = json.dumps(shot, indent=1)
        made = sum(1 for r in rows if pid in r['blinks'])
        print(f"{pid:11s} {t0:7.2f}-{t1:7.2f} {N:6d} fr at {FPS} fps  {len(cues):3d} cues ({len(cues) - before[pid]} added) "
              f"{len(voice):4d} voice  {made} pauses with its blink" + (f"  {len(shot['chunks'])} chunks" if 'chunks' in shot else ''))
    for cid, tk in sorted(_TALK.items()):
        files[os.path.join(ROOT, TALK_DIR, cid + '.env.json')] = json.dumps(tk, separators=(',', ':'))
    files[REPORT] = final_report(rows, notes, cuts, tracks, who_of, span_of)
    changed = [f for f, text in files.items() if not (os.path.exists(f) and open(f).read() == text)]
    if not check:
        for f in changed:
            os.makedirs(os.path.dirname(f), exist_ok=True)
            open(f, 'w').write(files[f])
    print(f"{len(changed)} of {len(files)} files {'would change' if check else 'written'} under "
          f"{os.path.relpath(os.path.dirname(OUT_DIR), ROOT)}/ (the shots, {len(_TALK)} talk envelopes, final-report.md)")
    if check and changed:
        sys.exit(1)


def final_report(rows, notes, cuts, tracks, who_of, span_of):
    """final-report.md: every pause of PAUSE_MIN or more with what each host does in it, and the cuts."""
    name = {'blue': 'Merc', 'orange': 'Tavi'}
    on = lambda t: [pid for pid in tracks if span_of[pid][0] <= t and t + 1.0 <= span_of[pid][1]]
    seen = [r for r in rows if on(r['p0'])]
    with_blink = [r for r in seen if r['blinks']]
    sung = {cid for p in PASSES for cid in p.get('sings', ())}        # a host's own sound: a breath in before it too
    breath = [r for r in seen if r['after'] in C and (C[r['after']]['type'] == 'line' or r['after'] in sung)]
    viewer = [r for r in seen if any(r['p0'] - 1e-6 <= C[cid]['start'] and C[cid]['end'] <= r['p1'] + 1e-6 for cid in BREATHE_WITH)]
    L = ['# The final passes: pauses and cuts', '',
         f'Generated by `tools/merc-shots.py --final` at {FPS} fps from `cues.json` and the lines\' envelopes. Do not edit.',
         '', '## Constants', '',
         f'- Talk cycle: {TALK["hz"]} Hz, open {TALK["open"]} of each cycle, gain {TALK["gain"]}, power {TALK["power"]}; arcs {SPEECH_ARCS_FINAL} while talking.',
         f'- Breath in: the mouth opens {BREATH_IN} s before the first word after a pause of {PAUSE_MIN} s or more, and before a host\'s own sung sound ({", ".join(f"`{x}`" for x in sorted(sung, key=lambda x: C[x]["start"]))}).',
         *[f'- In `{cid}` ({a:.2f} to {b:.2f}) both hosts breathe in with the viewer: the mouth\'s small o, no sound, no arcs.'
           for cid in BREATHE_WITH for a, b in [breathe_with(cid)]],
         f'- Blinks: the talker\'s {BLINK_AFTER} s after the voice stops; the listener\'s {BLINK_PAIR} s after that one, in a pause of {PAIR_MIN} s or more (or when the talker has none).',
         f'- Cuts: no eye move from {CUT_CLEAR} s before a cut to {CUT_CLEAR} s after it.',
         '', '## Pauses', '',
         f'{len(seen)} pauses of {PAUSE_MIN} s or more with a host on screen: {len(with_blink)} have a blink, '
         f'{len(breath)} end on a breath in (a line or a host\'s own sound follows), {len(viewer)} hold the hosts\' breath in with the viewer, '
         f'{sum(1 for r in seen if not r["blinks"] and r not in breath and r not in viewer)} have none of these.',
         '', '| Pause | Length | After | Before | Merc | Tavi |', '| ----- | ------ | ----- | ------ | ---- | ---- |']
    for r in seen:
        cell = {}
        for who in ('blue', 'orange'):
            pid = next((x for x in on(r['p0']) if who_of[x] == who), None)
            if pid is None:
                cell[who] = 'not on screen'
            elif pid in r['blinks']:
                cell[who] = f"blinks at {r['blinks'][pid]['t']:.2f} ({r['blinks'][pid]['how']})"
            else:
                cell[who] = 'no blink: ' + r['why'].get(pid, 'a blink is there already' if r['blinks'] else 'not asked')
        L.append(f"| {r['p0']:.2f} to {r['p1']:.2f} | {r['p1'] - r['p0']:.2f} | {r['before']} | {r['after']}"
                 f"{' (breath in)' if r in breath else ''}{' (the hosts breathe in with the viewer)' if r in viewer else ''}"
                 f" | {cell['blue']} | {cell['orange']} |")
    L += ['', '## Cuts', '', 'What was moved so that no eye moves across a cut, and so that no cue cuts a blink short:', '']
    L += [f'- {t:.3f}, {pid}: {text}' for t, pid, text in sorted(notes)] or ['- nothing']
    L += ['', 'Eye moves left within the clear window of a cut, by pass (none is the aim):', '']
    left = [f'- {c:.3f}, {pid}: {what} from {a:.3f} to {b:.3f}' for pid, tr in tracks.items() for c in cuts
            for a, b, what, i in tr.moves(c - CUT_CLEAR, c + CUT_CLEAR)]
    L += left or ['- none']
    L += ['', 'Cues added (a cue of the state the host is already in restarts its blinks):', '']
    for pid, tr in tracks.items():
        over = [a for a in tr.added if 'the breath steps' in a[2]]
        L.append(f'- {pid}: {len(tr.added)}' + (f'; {len(over)} step an idle breath by more than {BREATH_STEP["idle"] * 100:.1f} %: ' + '; '.join(f'at {a[0]:.2f}, {a[2]}' for a in over) if over else ''))
    return '\n'.join(L) + '\n'


def main():
    if FINAL:
        return main_final()
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
