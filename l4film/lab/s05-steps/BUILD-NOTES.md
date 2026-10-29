# Build notes: group B (s05-steps, s06-groups)

Running notes so a container restart or a usage-limit pause can resume. Builder B owns
`compositions/s05-steps.html`, `compositions/s06-groups.html`, `lab/s05-steps/` and `lab/s06-groups/`
only. Clock: Kokoro scratch, 483.73 s (cues.json = tools/board-cues.json today).

## Spans

- s05-steps 69.354 to 110.881 (D 41.527); cuts on act1 (69.50) 0.15 s early.
- s06-groups 110.881 to 146.097 (D 35.216).

## Merc passes

- m06a-orange: rendered (225 px, 265 frames, filmStart 110.3833). From its alpha: frames 6 to 29 touch
  the square's top row, frame 30 is the first with rows 0 to 2 empty (row max 4, 3, 3), frame 32 fully 0.
  Its first whole frame is film 110.883 = s06's first frame. Hop: state from pass t 3.77 (114.153),
  airborne about frames 236 to 263 (HOP + 0.17 to + 0.62).
- m06b-orange: not rendered yet (07:37). Gate assumed at frame 31 like m06a until measured.

## Decisions (builder)

- Drops (trap 23 against the board's 60 px ease): box hidden until pass frame 31 (one after the first
  whole frame, since 0.8.97 may show the frame before), fades in over 18 frames (sine.out), and eases down
  the last 60 px over 0.4 s (power2.out) from that frame. In s05 m06a is therefore never seen (frames 0
  to 29); its tags stay so the gate holds if a re-time moves frame 31 into s05.
- Hops out: box carried 360 px right from HOP + 0.15 over 0.42 s (power1.in).
- Room: L.room(floor false), a floor patch under Tavi's corner (x 1690 to 1920 from y 840) with her,
  film-time dust (Lesson 2's filmDust, seed 7, 26 motes).
- Stair light (40 % chrome), measured in lab/s05-steps/pulse (still F0 staircase, no dust):
  - kit L.lit shape (up 0.15 power2.out, back 0.6 sine.inOut): registers 0.4, 0.4, 0.5, 0.6 s (stairs 2-5);
  - + block scale 1.05: 0.4, 0.5, 0.5, 0.7 (no gain);
  - up 0.3 / back 0.5 power1.inOut: 0.6 each; up 0.35 / back 0.6: 0.5-0.6; up 0.25 + hold 0.1 + 0.5: 0.5-0.7;
  - up 0.3 linear / back 0.4 linear: 0.7, 0.7, 0.7  -> adopted as light() in both scenes.
  - a held light (0.15 rise) registers 0.1 s.
- Riser "grows" (bar 15 %) barely register on a draft clip; each riser pulse now also scales its label
  1.25 (settle 0.8 s).
- s06 brackets end 6 px short of HANDOFFS' 714 / 1194 (708 / 1188): at 714 the lower bracket touched the
  F-G riser's bar. Ticks 8 px (down). The lower dims as the truck starts, the upper lights on G4.
- s06 key names: E, F leave before the truck (F-high cuts them at the frame's foot), B, C before the push
  (off the right edge in F-low); all back as the pull lands (123.6).
- s06 count: on "semitones" the octave's twelve rows glow in turn (fills the 131.4 to 132.7 pause).

## Item 2 (S6b), lab/s06-groups/item2/clearance.mjs (kit hop formula, real Outfit ink)

- Middle of every hop: label gap 52.3 (tones) / 28.3 (semitones) world px; bar gap 37.1 / 38.9. Passes.
- Closest anywhere in a hop: tones 6.6 px at take-off (+0.02 s), semitones 7.6; bars 27.6 / 34.5.
- At rest: 7.6 px (tones), 10 (semitones). Model said 8 at rest, 7 in flight: real T ink is ~0.4 px wider.

## Round 2 measurements (07:41 to 07:55)

- s05 round 2: 4.7 s of holds inside (3.4 s per 30 s), longest 0.3 s. Passes the 0.5 s limit, fails the
  1.8 s per 30 s one (no Merc on screen in s05). Twenty-five holds of 0.1 to 0.3 s, each where one event's
  registration ends before the next word.
- s06 round 2: 7.6 s (6.5 per 30), longest 2.4 s. From 24.5 on (m06b's span, its pass not rendered) the holds
  are where Tavi will be on screen: 25.0 (0.2), 25.9 (1.2), 27.4 (0.1), 27.9 (2.4), 32.5 (1.0), 34.1 (0.6).
  Before it, with no Merc (4.4 to 24.5): 1.9 s (13.2, 14.6, 15.0, 17.0, 17.6, 18.0, 18.7, 19.4, 19.9).
- Text sweep (both): no label under 4.5:1. EDGE: s05 only single samples mid-move; s06 riser 6's "T" at the
  frame's top through F-low (5.75 to 8.75), stair 2's "D" cut at the left through F-high (9.75 to 12.25).
- What registers (from the motion samples): a linear ramp registers by its largest change only when it is
  0.42 s or shorter (16 luma per 0.1 s at 40 % chrome); a slower ramp registers only by area (stairs 4 and up
  at F0, any stair in a close-up). Every light or pulse has a dead sample near its peak about a third of the
  time (the change reverses inside the 0.1 s sample), so a long pause needs a larger event, not a later one.

## Round 3 changes (07:55)

- s05: the strip slides from act1 - 0.1 over 1.3 s (power3.out) so the cut does not open on a hold and the
  slide carries to "doh"; doh - 0.06; the name switch from "from C" + 0.12 (the switch itself stays
  § Type's 0.25 s, 0.05 stagger); the keys come up over 0.8 s and each pulses as it reaches full; "a major
  scale" rises 20 px over 0.6 s (power2.out); the second ripple from "scale" - 0.05; echo rings 0.9 s, 3 px,
  3.5x (scale-c, steps-c, group-high); the beads leave over 0.5 s (power1.in); larger lights (up 0.4,
  back 0.8 or 0.9) for stairs 1 and 2 in CU-A ("2." and "tone."), stair 3 in CU-B ("semitone?", now from
  0.2 s before the word), b11's two semitones (stairs 4, 8) and b12's "two short ones" (stairs 4, 8; their
  light on "equal" too); C#4 lights over 0.5 s; "C#", "E", "F" land with a 12 px rise over 0.5 s; the pan
  1.7 s; the legend's lines 0.5 s apart, 40 px over 0.65 s (power2.out).
- s06: the stairs go unlit over 0.5 s from pull + 0.8; the ghost in from climb - 0.05, travels 1.45 s,
  fades over 0.5 s (power1.in); each b14 pair lights the stair above it (semitone pair's stairs 4, 8 larger,
  1.2 s back); "One more tone" from 0.1 s before the word, G4's stair lighting (larger) on it and on
  "joins"; brackets and legend leave over 0.3 s; "C again" larger; riser 6's label and stair 7's name leave
  through F-low, stair 2's name through F-high (text sweep EDGE).

## Round 3 results (08:10)

- s05 clip (lab/s05-steps/clip.mp4, measure/): holds inside 0.1 s (0.1 s per 30 s), longest 0.1 s (at 1.1);
  final 0.2 s at the cut. Passes both limits. The four tight spans have no hold.
- s06 clip: holds 5.3 s inside, but only 0.2 s (2.9, Tavi m06a talking) falls outside m06b's span; the no-Merc
  stretch 4.4 to 24.5 has none. In m06b's span (24.5 to 34.8, pass not rendered): 25.0 (0.2), 25.9 (1.2),
  27.5 (0.1), 28.3 (2.0), 32.5 (1.0), 34.1 (0.6, her hop out covers it). Re-measure once m06b exists.
- Stills: lab/s05-steps/stills-r3, lab/s06-groups/stills-r3 (+ stills-r3c for the respaced sum),
  lab/s06-groups/item2/hops-sheet.png (hop middles), lab/s06-groups/scratch/tavi/sheet.png (m06a drop, hop).
- Sum respaced (after round 3's clip): a space between numbers, a space and two hair spaces round each dot,
  "= 12" 20 px after; ends x 1828.
- Root check: 3 errors, all missing_local_asset (m01-orange, m04-orange, m06b-orange); mine is m06b only.

## Status

| Scene | Built | Stills | Clip | measure.py | Text sweep | clock-lint | merc-tags |
| --- | --- | --- | --- | --- | --- | --- | --- |
| s05-steps | all rows, round 3 | round 3 | round 3 | 0.1 s (0.1/30 s), longest 0.1: pass | round 3: pass (names on lit stairs 4.92:1 or better, C♯ 5.23:1; EDGE only mid-move) | clean | current |
| s06-groups | all rows, round 3 (+ sum spacing) | round 3 | round 3 | 0.2 s outside m06b's span; m06b's span unproven | round 3: pass (EDGE only mid-move) | clean | current (m06b missing) |

## Next

1. Reported (08:20). Root index.html still lacks frames.js and stairs.js (gen-root, the director's).
2. When m06b-orange lands: merc-tags --check, measure its first whole frame, re-render s06's clip.
