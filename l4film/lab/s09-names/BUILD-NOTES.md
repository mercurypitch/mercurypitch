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

## Status (final, round 3)

| Scene | Clip | measure.py (lab, no Merc rendered) | Text sweep | clock-lint | merc-tags |
| --- | --- | --- | --- | --- | --- |
| s09-names | lab/s09-names/clip.mp4 | 4.9 s inside (3.6 / 30 s), longest 0.8 at 21.0 (Tavi's drop window); 0-20.6 s (no Merc in the film): 0.5 s, longest 0.3 | 0 contrast; 1 EDGE ('6' leaving the right edge in the push, 245.74-245.99) | clean | current (m09 missing) |
| s10-ti | lab/s10-ti/clip.mp4 | 4.0 s inside (4.7 / 30 s), longest 0.4, final 0.1 | clean | clean | current (m09, m10 missing) |
| s11-why | lab/s11-why/clip.mp4 | 5.7 s inside (3.8 / 30 s), longest 0.4; the no-Merc stretch 2.6-25.46 s (298.6-321.4): 2.8 s in 22.9 s (3.7 / 30 s) | clean | clean | current (m09, m10, m11 x2 missing) |

- Root check (09:05, again after round 3): 5 errors, all missing_local_asset (m08 for s07/s08; m09, m10, m11 x2 mine);
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
- Round 3: s09 the stair-1 light moves to "We'll use", stair 1 lights on o9's "doh", stair 3 lights and F#4
  scales on "sharp". s10 the lit top house pulses 0.12 as C5 lets go (at('land-c','end')), settled by the
  cut. s11 the tiers' scale pulses ("same", "just", do on "home") also light the chips 40 % chrome (the
  board: larger events, not more); the probe hovers on a 4 px circle (a sine bob stood still at its ends).
- s09 folded to 300 lines (the root check's composition_file_too_large fires above 300); s11 (408) still
  warns, as in round 1.

## Fix round D-01 (from 13:33; review/component-D-01/REPORT.md, items 1 to 17)

Read first: DECISIONS 81, 83, 85, 86; the director retimed the S9d and S11c pulls (o9 / o11 - 1.35, 0.8 s),
set S10's mouth to (156, 797) and re-timed the tags (merc-tags starts a running pass at 0.000).

- s09: dim 0.5 s sine.inOut (13); every name switch is old out (0.12) then new in (0.18), swap2 (7); the
  bottom house rides up with stair 1's rising outline and fades with it (10); the pill switch is old words out,
  the box grows, new words in, over 0.6 s (4); "movable do" plain 64 px type (14); " = home" slides in from the
  right (the 60 fps label scan caught it crossing "tonic"); hold pulses: the guess on "one" and "called", the do
  stairs on "is." (stair 8 0.4/0.8), D4/E4/F#4 on their own words.
- s10: "still hanging?" (s01's words, 64 px, ink, x 1200 baseline 460) on "question." to out1 (16); the ink
  arrow pulses on "one."; both arrows' tips lifted (13 and 15 px clear of the gold corner, DECISIONS 85).
- s11: strip and hairlines dim to 20 % over the push, back over the pull (2); flights: out top shelf first,
  rise then slide; back bottom shelf first, slide then drop; stair 1's do fades into stair 8's (sep 140 to 220)
  and is hidden once parked, only stair 8's flies back (3, 11); outline chips for the five outside the scale
  (obsidian fill, 35 % rim brightening to 80 % on their pulses, ink-2 letters) (8); "leading note" centred on
  ti (x 1018, baseline 250) with a hairline to ti's tread, riding the slide (9); credits land whole (5);
  houses and risers hidden while the staircase is dim, back as the last chip lands (A.chipsHome) (15); the
  kicker, credits, axis and its labels leave as the pull starts (gone by 320.43), clear of both falls (17);
  arrow tip 15 px over the gold corner; hold work: the quick turn on "major" (the board's 300.95), stair 1
  peaks on "heard" and "C" with C4, the sweeps on "studies" (0.7 apart) and "training" (0.3), do's light
  after its landing and as "learned," ends, the house pulses as it lands, the weaker lights back over 0.6.
- Proof tools: lab/s11-why/tools/overlaps.mjs (every frame: visible labels and chips touching, overlapping
  or doubled), chip gaps via probe.mjs, lab/s09-names/tools/stills.sh (stills into a subfolder via a marker).
- Final (bokeh kit, DECISIONS 89; clips niced, one at a time): s09 clip 14:54 UTC, 1.1 s inside (0.8 / 30 s),
  longest 0.3, final 0.3; s10 clip 14:59, 1.0 s (1.2 / 30 s), longest 0.1, final 0.1; s11 clip 15:05, 1.9 s
  (1.3 / 30 s), longest 0.2. Text sweep: no contrast findings (s09's EDGE '6' only). Root check: 5 errors, all
  m12-orange in s12 to s16. clock-lint silent; merc-tags clean. 60 fps label scans: 0 frames in all three.
  Chip gaps: 8.0 world px closed, 12 on the flights. Report stills: lab/<scene>/fix1, fix2.

## Round 3, D-02 (review/component-D-02/REPORT.md; DECISIONS 92 and 93)

- s10 (A): "still hanging?" is ti's question: Outfit 500, 40 px on screen in CU-C (22.2 world px), ink-2, in
  the world centred on ti's column (x 1018, baseline 331.7, so 165 on screen), its box 736 to 969 x 125 to 175,
  22 px over do's tread and the gold corner; a hairline (x 852, 184 to 240 on screen) draws down to ti's tread
  over 0.3 s as "Tee" is said; label and hairline leave from 0.1 s before "semitone" over 0.2 s (gone as
  "1 semitone" lands). Holds: stair 7 lights again on "below" (0.4/0.8), so ti and do light in turn on
  "below doh"; the hairline's draw and the handover sit in the old holds at 2.3 and 5.2.
- s11 (B): one cascade, on "just" (0.25 s apart, linear 4-frame attack, 0.6 s sine settle; scale 1.05 and the
  40 % light, an outline chip's rim). The cascades on "studies", "training" and "weaker", the do-only pulse on
  "home" and do's lights after its landing and on "learned," are gone. Between the beats the camera drifts
  sideways at 5 px a second (one curve from the push to the pull), turning only inside beats; horizontal only,
  because a vertical drift snaps every text baseline by a whole pixel at once (measured: 7 jumps of 0.24 % in
  2 s for a 5 px circle, none for the horizontal drift).
- s11 (D): F-chart is now { s: 1.45, ox: -432, oy: -47 } (assets/lib/frames.js, its only entry I changed): the
  shelves, chips, axis and labels at x 148 to 1772 and y 297 to 790 on screen. 11a's push lands on the old
  numbers (1.3, -252, -75), inline in s11 as F_EXP, because the stair names (the chips' origins) must sit over
  the caption band; from "top" the camera follows the names in to F-chart over 1.85 s (307.13 to 308.98), slow
  enough that the strip is still in frame when the five dim chips leave it.
- s11 (E): the hairline ends at the top of the riser (1078, 352), drawn in the world between the stairs' blocks
  and risers so the gold corner stays whole over its end.
- s11 (F): credit 2's box foot (213) is 85.9 px or more over any chip under it.
- s11 (check): the answer labels glow through a filter on their own text (a flood in the blurred alpha), not a
  second text copy, so no two texts share a zone (the content_overlap at 328.68 to 329.49).
- Final clips (kit of 18:41, niced, TMPDIR=/dev/shm, one at a time): s10 19:30, 0.8 s inside (0.9 / 30 s),
  longest 0.1; s09 19:32, 1.2 s (0.9 / 30 s), longest 0.3; s11 20:03, 0.4 s (0.3 / 30 s), longest 0.1, no
  single-frame events in 3.9 to 24.4. Full check 20:05: 0 lint errors, layout 1 error (S6's), S9 to S11 none.
  Stills: lab/<scene>/r3. Lab tools: lab/s11-why/tools/frames.mjs (screenshots of a variant file).

## Round 4, D-03 (review/component-D-03/REPORT.md; DECISIONS 100)

- s11 (item 2): the strip, its hairlines and names fade from 20 % to 0 from "doh." (308.22) as the camera comes to
  rest on F-chart (308.98), and return 0 to full over the pull (320.23 to 321.03), before the chips fly back
  (321.58). Probed: the strip and its hairlines are display none on all 675 frames from 13.05 to 24.30 (60 fps).
- s11 (item 4): on the fourth shelf's turn (320.05, the same linear 4-frame attack and 0.6 s settle) the outline
  chips' fill goes to 50 % chrome, their rim to 80 %, their letters from ink-2 to ink; a chip's luma goes from
  about 37 to 123 (stills 24.12 and 24.25).
- Items 1 (the kit's bokeh under the diagram), 3 and 5: no change of mine.
- Clips at 60 fps (lab/s09-names/tools/clips60.sh, a copy of builder E's hostpass60.sh): s11 23:32, 0.6 s inside
  (0.4 / 30 s), longest 0.2; s10 23:37, 0.7 s (0.8 / 30 s), longest 0.1; s09 23:44, 1.5 s (1.1 / 30 s),
  longest 0.3 (the card at 0.9). The 30 fps round 3 clips are clip-r3.mp4, their measures measure-r3.log.

## Polish round (30 Oct, from 14:30 UTC; polish/BRIEF-D.md, DECISIONS 107, critic D-04 items 1 to 3)

Items: (1) s10's do re mi fade in as each column clears the left edge in the pull, all by A.empty (281.50,
s10 10.87); (2) s11's sharps at rest by the pull (320.23, s11 24.29); (3) s09's pill widens with "fixed do:
do = C" inside it, clipped by its edge (255.82 to 256.04). Handoffs stay put. Renders: TMPDIR=/dev/shm,
--workers 2, --output /dev/shm/l4lab-D/, then mv into lab/<sid>/clip.mp4 (lab/s09-names/tools/render60.sh).
Proof stills and probes in lab/<sid>/polish/.
- 14:45 edits in (clock-lint silent on all three):
  - s10 (item 1): `PULL_DUR`, `NAME_IN` 0.2, `clearAt(n)` (first pull time stair n's left edge, colX - 56, maps to
    screen x >= 0, scanned at 1/240 s) and `NAME_BACK[n]` = min(clearAt, A.empty) - 0.2; stairs 1-3's `edge` fades
    in from NAME_BACK. Probe (lab/s10-ti/polish/after-names.txt): mi 10.50 to 10.67 (its column clears at 10.683),
    re and do 10.67 to 10.85, full before they reach the frame (re's name enters at 10.85, do's at 11.0). Before:
    all three 11.30 to 11.65.
  - s11 (item 2): cascade 0.15 s apart (was 0.25), the 0.133 s attack kept, SETTLE = min(0.6, A.pull - 2/60 -
    CASC[3] - ATTACK) = 0.32 s. Probe (lab/s11-why/polish/after-cascade.txt): every tier at rest from 24.267, the
    pull at 24.298. Before: the sharps at 1.049 and 50 % chrome at 24.283, at rest at 24.84.
  - s09 (item 3): makePill clips its words to its own shape (clipPath rect, width per frame, under the rims); the
    words roll 1.25 x size (60 px) up over mix 0 to 0.5 (old out the top, new in from the foot), the box widens over
    mix 0.1 to 0.7. Probe page sheet: never empty, never overlapping. Before: empty 26.60 to 26.78 (60 fps clip).
- Old handoff frames saved: lab/<sid>/polish/first-old.png, last-old.png (from the 29 Oct 60 fps clips).
- Renders: lab/s09-names/tools/render60.sh <sid> 2 (one at a time).
- 14:37 s10 clip (60 fps): 0.7 s inside (0.8 / 30 s), longest 0.1 (as round 4); first and last frames identical to
  the 29 Oct clip's (max diff 0). Sheets lab/s10-ti/polish/names-before-60fps.png, names-after-60fps.png,
  names-after-dense.png.
- 14:45 s11 clip: 0.6 s inside (0.4 / 30 s), longest 0.2 (as round 4); first and last frames identical (max diff 0).
  F-sharp chip luma (lab/s11-why/polish/sharp-luma-after.txt): peak 108 at 23.95, 15.0 (rest) from 24.25; the pull
  at 24.298. Sheets cascade-before-60fps.png, cascade-after-60fps.png, sharps-after-dense.png.
- Text sweep (all three, step 0.25): unchanged, s09's EDGE '6' only (lab/s09-names/polish/sweep-report.txt).
- 14:51 s09 clip: 1.6 s inside (1.2 / 30 s), longest 0.3: one new 0.1 s hold at 26.90 (the pill settled at 26.84,
  0.18 s sooner than round 4's fade). The widening now runs mix 0.1 to 1 (to A.fixed + 0.6, as before), so that
  span keeps moving; re-rendering (14:53).
- 14:56 s09 clip: 1.5 s inside (1.1 / 30 s), longest 0.3 (round 4's numbers; the 26.90 hold gone, motion there 0.091
  / 170). First and last frames identical to the 29 Oct clip's (max diff 0). Sheets lab/s09-names/polish/
  pill-before-60fps.png, pill-after-60fps.png, pill-after-1to1.png; probe after-pill.txt.
- 15:05 check: 0 errors (lint 0 / 75 warnings, runtime, layout, motion 0, contrast 59/59); my scenes' 23 warnings
  are round 4's (18 nested_media_start_basis, 3 duplicate_media, s09 and s11 file size). Text sweep: s09's EDGE '6'
  only. clock-lint silent; merc-tags --check clean on all three. Old clip-r3.mp4 files deleted; /dev/shm/l4lab-D
  removed. Round done; report sent to the director.
