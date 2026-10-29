# Build notes: group D (s09-names, s10-ti, s11-why)

Running notes so a container restart or a usage-limit pause can resume. Builder D owns
`compositions/s09-names.html`, `s10-ti.html`, `s11-why.html` and `lab/s09-names/`, `lab/s10-ti/`,
`lab/s11-why/` only. Clock: Kokoro scratch, 483.73 s (cues.json = tools/board-cues.json today).

## Spans

- s09-names 229.240 to 270.634 (D 41.394); cuts on act3 (229.39) 0.15 s early.
- s10-ti 270.634 to 295.936 (D 25.302).
- s11-why 295.936 to 341.242 (D 45.306).

## Merc passes (mine: m09-orange, m10-blue (mirrored), m11-blue (mirrored), m11-orange)

- 08:25: none rendered. Queue (detached, after m01-orange): m04, m06b, m07, m08, m09, m10-blue,
  m11-blue, m11-orange. L.mercGate warns and uses 30 until assets/merc/whole.js lists a pass.
- m09-orange film 249.85 to 298.633 (drop, hop out at 298.0); m10-blue 282.5 to 298.633 (drop, hop
  at 298.0); m11-blue / m11-orange 321.4 to 341.15 (drop, hop at 340.51).

## Status (09:20)

| Scene | Built | Stills | Clip | measure.py | Text sweep | clock-lint | merc-tags |
| --- | --- | --- | --- | --- | --- | --- | --- |
| s09-names | all rows, round 2 (Tavi-span events) | lab/s09-names/frame-* | round 2 rendering | round 1: 0-20.6 s 0.5 s | 0 contrast; 1 EDGE ('6' leaving right edge in the push, 245.74-245.99) | clean | current (m09 missing) |
| s10-ti | all rows, round 2 (+ quiet-stretch events) | lab/s10-ti/frame-* | round 1 measured; round 2 queued | round 1: 8.4 s inside, longest 1.5 | clean | clean | current (m09, m10 missing) |
| s11-why | all rows, round 2 (+ quiet-stretch events) | lab/s11-why/frame-* | round 1 measured; round 2 queued | round 1: 9.6 s inside, longest 1.2 | clean | clean | current (m09, m10, m11 x2 missing) |

- Root check (09:05): 5 errors, all missing_local_asset (m08 for s07/s08; m09, m10, m11 x2 mine);
  warnings are the usual nested_media_start_basis / duplicate_media (the reflections) / file size.
- Handoffs: s10 last vs s11 first: max diff 22, 0 px over 24 (lab/s11-why/tools/hdiff.py). s11 last
  frame: stair 1 x 361-474, both houses lit, D major, F#4 and C#5 lit, no labels (HANDOFFS D to E).
- Item 3 (s10): probe of the bead transform (lab/s11-why/tools/probe.mjs): launch 12.64 (130, 711),
  apex y 602.1 at 12.82 over x 240.8, i.e. 39.9 px clear of stair 1's corner (242, 664) edge to
  corner, lands (298, 642) at 12.94. Stills frame-00-at-12.79s / frame-01-at-12.834s / frame-02-at-12.94s.

## Decisions (builder D)

- Lab stills land on a 30 fps grid (floor): pick times on it (12.8 for the hop's middle, not 12.786).
- s09: the strip and hairlines dim to 25 % with the staircase under the card; rows stay. Riser labels
  fade with the dim and never return. The S9 push: frameRig curve + hermite as the sheet says; checked
  in lab/s09-names/push.txt (tools/push.mjs): s up, ox and oy down only; rate at F-near 0.0245/s;
  "scale degrees" at s 1.129, top stair edge x 1293.9. Truck from at('b28') (245.837, HANDOFFS assumed
  245.85): the named stair stands at 480 717 880 867 892 969 1105 1309 (HANDOFFS 480 719 886 874 899
  974 1108 1311).
- s09 pills: own SVG pill (L.pill is solid only): L.GUESS dash traced on by a mask; "do = C?" 48 px
  (ink-2 text), solid ink on "fixed" with "fixed do: do = C", up to baseline 170 at 40 px on "it is";
  "movable do" a solid pill at 64 px (the board's "two pills"), x 1360.
- s09 extra word-tied events in Tavi's span: the guess pulses on "system" and "always"; C4 and C5 scale
  on "is."; the do stairs light on "use"; the houses pulse on "doh#2" (b29) and "with" (b31); key names
  rise 10 px; mi's stair scales on "sharp".
- s10: names of stairs 1 to 3 leave over the push to CU-C (mi is cut by the left edge) and return as the
  pull lands; ti's name scales 1.2 on "Tee"; ti's stair scales on "sits"; the gold riser grows on
  "semitone", "the last step" and "short" with a gold glow; the ink arrow (A colX(7)+10, tread-14 to B
  house.x-14, tread8-10) draws on "step"; the 10c arrow is s01's arrowAt(0), drawn again on "one more",
  pulsing on "step" (b34). The bead and echo rings draw in screen space over the Mercs (top layer).
- s11: chips per HANDOFFS; dim chips an opaque 35 % chrome mix (rgb 77,83,90), no rim, ink letters;
  the tiers pulse on "same" (my addition, "the same kind of order") and "just" only while the shelves
  are 80 px apart; on "weaker" (closed) the scale chips light 40 % chrome instead, so the closed gap
  stays 8 px. Credits 2 and 3 type on (display none per hidden letter, trap 26). Probe bead bobs 8 px
  on a 1.2 s cycle from film time. Arrow larger than s10's (seen at 1x).
- Round 2 quiet-stretch events (lab clip holds over 0.5 s, every one tied to a word): s10: do's then ti's
  name scale as the push lands ("question.", +0.45 and +0.65); the top stair lights on "doh:" (below
  doh); stair 1 lights on "C", stair 7 on "stop"; an echo ring on ti halfway through B4's 1.2 s hold
  (RUN[6] + 0.6, FACTS 68); ti's name on "Most"; the outline top stair pulses on "note" and "Take"; the
  bead pulses on "hear". s11: do's chip lights as "doh." ends and again as the house lands; the shelf
  house falls 70 px from "seems" to land on "learned"; the top stair lights on "it?#2" (o11) and on
  "is." (b38, "wherever home is"); stair 7 lights on "it's" (b37).
