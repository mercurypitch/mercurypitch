# Build notes: group F (s14-recap, s15-next, s16-end)

Running notes so a container restart or a usage-limit pause can resume. Builder F owns
`compositions/s14-recap.html`, `s15-next.html`, `s16-end.html` and `lab/s14-recap/`, `lab/s15-next/`,
`lab/s16-end/` only. Clock: Kokoro scratch, 483.73 s (cues.json = tools/board-cues.json today).
Never touch s12/s13 (builder E, in progress).

## Spans

- s14-recap 405.494 to 470.243 (D 64.749); cuts on recap (405.644) 0.15 s early.
- s15-next 470.243 to 478.529 (D 8.286); cuts on next (470.393) 0.15 s early.
- s16-end 478.529 to 483.729 (D 5.200).

## Merc passes (m12-blue, m12-orange; 8,438 frames each, filmStart 343.2, size 520, front view)

- 10:00: both still .part.webm. L.mercGate warns and uses 30 until whole.js lists them (harmless here:
  the drop is in S12, so the gate's frame lies long before S14).
- Celebrate in the pass at pass t 136.2 (film 479.4) to 137.05 (480.25): the hop 479.4 to 480.0.
- S14, S15: L.mercGate, x 110 and 1800, size 300, feet 0.81, floor patch on.
- S16: L.mercGate at the end pose (330 / 1590, 520, floor off); the scene sets each box's transform after
  the gate's draw (scale about the feet + translate) for the grow-and-move, and draws its own floor
  patches that match the gate's at the cut and widen with the Mercs.

## Plan, s14 (anchors by role)

See the scene's anchor table (comments in compositions/s14-recap.html). Hold plan with no Merc in the lab
clip: every gap between counted events under about 0.45 s, the ring timers carrying q1 to q4, larger
events in the card pause (icon pulses that register, then the address once more).

## Log

- 10:00 read everything; plan written.
- 10:25 s14 built (all rows 14a-14g), tags written (merc-tags s14-recap), clock-lint clean. Stills round 1
  (lab/s14-recap/frame-*.png): frame 0 matches E to F; F-recap-1, 14b labels, 14c no-scale at 424.0, D major
  keys at 428.5, F-recap-3 bead on ti, S at 438.1, G at 452.1, ladder 459.0, card 466.0, empty at 470.2.
  Clip rendering (lab/s14-recap/clip.mp4).
- 10:30 s15 built, tags, clock-lint clean, stills lab/s15-next/frame-*.png and sheet-r1.png.
- 10:35 s16 built (Lesson 2's s17 adapted), tags, clock-lint clean, stills lab/s16-end/frame-*.png, sheet-r1.png.
  Text sweep s15 + s16 clean (lab/s15-next/sweep). Ink extents (frame-06-at-5.19s): skip line x 636-1284 and
  the Scale Runner line 680-1239 (HANDOFFS' 636-1284 exactly); address x 356-1567.
  Fixes after round 1: the gate's corner patches carried hard outer edges into frame as the Mercs grew: they
  now hand over to a full room floor (own layer, no drift) over the move; the underline raised to y 449-452 so
  the address keeps 55 / 25 px over the heads.
- Practise card ink (s14 frame-09-at-60.5s): L1 x 436-1484, L2 640-1281, L3 (the 710 line, the widest)
  410-1509 (inside 310-1610 by 100 px each side), L4 683-1236, L5 741-1178, L6 585-1334, its descenders to y 896.
- 10:40 s14 clip round 1 measured (lab/s14-recap/measure): 15.1 s of holds inside (7.0 per 30 s), longest 1.4 s
  (455.5, the ladder before "Runner,"), five over 0.5 s. A proxy (lab/s14-recap/tools/holds.mjs + holds.py,
  seeks the timeline, no Merc) reproduces measure.py's holds exactly, so fixes iterate on it.
- 10:50 hold fixes: stairs ripple on "check.", card 2's "scale" and card 4's "major scale" (0.07 s apart); the
  black keys light in turn on "black" (was a scale pulse too small to count); both gold glows and the S labels
  pulse 0.55 s after "semitone."; rung names and the connector arrive on "Runner,"; the tip wavers on "sing";
  card lines rise 20 px over 0.7 s; icons pop in 0.15 s after their line and pulse to 1.5 with a full glow.
- 11:05 proxy round 2: 8.1 s inside (3.75 per 30 s), longest 0.5. Bar (BUILD-GUIDE): <= about 1.8 per 30 s with
  no Merc, none over 0.5. Most holds were dead samples at a pulse's peak, or a 0.1-0.3 s gap between word beats.
  Fixes (round 3): a label's pulse lags its bar's by 0.15 s (LAG), risers grow 0.6 s power1.out, the stairs
  ripple also on b46 "scale?" and b48 "major", stairs 3/4/7/8 light on the semitone recap, stair 1 lights as
  the slide to D lands and on b52 "Doh", ti/do beats in 14d are scale pulses (both are held lit there) with
  their names lagging, card lines leave up over 0.35 s (staggered 0.08), the F#/C# names 0.15 s after, the ladder
  title and names rise over 0.7 s, the title pulses as "Exercises > Scale Runner" lands, the rung names pulse on
  "back," and "octave", the tip wavers on "time.", and the card pause traces each tab's path under its line
  as its icon glows (the icon alone registered 0.1 s). Tools: lab/s14-recap/tools/where.py (what changed where).
- 11:35 (after a usage-limit pause; every background job re-checked) proxy round 3: 2.4 s inside (1.1 per 30 s),
  longest 0.3 (the empty F0 before the cut, and 429.2 between cards 2 and 3). Icon pulse cut to 1.25 (at 1.5 the
  gear touched "first:"). The black-key ripple on "black" now lights all eight in turn and holds them together
  to "need?" + 0.3 (a still at 424.0 caught the ripple half way, C#5, D#5 and F#5 lit unevenly, which read as an
  answer); proxy: one 0.2 s hold before "need?". s14 clip round 3 rendering.
- s15 clip r1 measured: 0.5 s inside (1.8 per 30 s), longest 0.2. Fixes: '"support"' pulses on o14 "that"
  (it is "that"), "what keeps it steady?" rises over 0.7 s, the bead's "steady?" pulse sends a second ring 0.12 s
  behind. Proxy: 0.1 s (the cut). s16 clip r1: 0.2 s at its start only (no Merc in the lab; the Mercs move from
  +0.07 in the film). Root lint in the lab project: only missing_local_asset (passes not rendered).
