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

## Round 4: fix round for review/component-B-01 (items 1, 2, 4 to 10; item 3 by the gate move)

- Shared block (identical in both files, diffed): sequential name swap (out 0.125 s power2.in, then in
  0.125 s power2.out, 12 px each way); riserOverlays gold = the whole 8 px gap plus a 56 x 5 px corner on the
  upper tread; featherRows (the row field feathers 160 px at each end once the camera is zoomed);
  tokenRow / tokenSet (tally and sum laid out by measured advance).
- s05: CU-B holds to "Watch" (pull 1.4 s from it); the demo T and S stay through the pull and the legend and
  reset at STEP(0); legend at pull + 1.4, lines 0.3 s apart; tally T T S T T T S at x 1240, baseline 260,
  landing on b11's words, riding the cut.
- s06: brackets y 460 / 278 (24 up); legend and tally out at push - 0.35, legend back at pull + 1.1 (124.0);
  ghost under risers and labels, its riser-3 segment gold; sum gaps half an em, ends x 1800; "Exactly" lights
  stairs 1 and 8; "Seven steps" lights them in turn; b16 "semitones" ripples the rows; the octave bracket
  grows up the 12 rows (0.9 s) with each row glowing as its tip passes; "= 1 octave" to b16 end + 0.3.
- Bead vs raised brackets (found on stills 8.4, 9.7, 11.15): brackets now y 458 / 276 (26 up); the semitone
  hops (E-F, B-C) lift 24 with x on power2.inOut (bracket 6.3 px, S label 6.8, bar 22.2, top speed 46 px a
  frame against a tone hop's 43; lab/s06-groups/item5/bracket-clear.mjs 24 power2.inOut). First try (lift 22,
  power3.inOut) made measure.py flag a pop at 8.40 (65 px a frame). The F-G hop has to climb out through the
  lower bracket's line, so the lower bracket leaves over the truck (0.4 s) and comes back on "Both halves".
  Stills: lab/s06-groups/stills-r4d (final), r4b (before), r4c (first try).
- Round 4 proof: clock-lint silent (both); merc-tags --check 10 tags, 0 stale; shared block identical; root
  check 5 errors, all missing_local_asset for m12 passes (s12 to s16), none in mine; text sweep sweep-r4: no
  label under 4.5:1, EDGE only mid-move (s05 11.5, 17.75, 18.25, 18.5, 22.75; s06 5.5, 12.5); s05 clip:
  holds 0.1 s (longest 0.1), events 4.833, 4.900, 12.067 (as before, 24.30 gone); s06 clip (after the
  final hop): holds 0.5 s (0.4 per 30 s), longest 0.2 (2.9), the 0.7 s at 29.2 gone; events 1.967, 6.400,
  26.100 (small jumps), 23.967 (pop: Tavi's first intro frame, the gate's), 27.733, 33.100 (Tavi's face, x 1728
  to 1792, y 738 to 794, the m06b pass).
- Seam S5 to S6: my layers match; 3584 px differ by > 24, all Tavi's corner (her landing ring is on S5's
  last frame and not on S6's first: the intro segment hands over to the pass at the cut). The gate's.
- Stills: lab/s05-steps/stills-r4 (+ r4b after the 56 px corner, phone-34.9s.png), lab/s06-groups/stills-r4
  (+ r4b crossing before, r4c after).

## Round 5: fix round for review/component-B-02 (items 2 to 5; item 1 done in the kit, DECISIONS 86)

- s06 item 2: the octave bracket grows over 0.6 s on power2.out (was 0.9 s linear); the row glows follow its
  tip (octAt); "= 1 octave" starts once the tip is at y 491, past the middle (y 508): about 0.14 s in.
- s05 item 3: RESETAT = STEP(0) - 0.36 (23.94): the demo T and S fade 23.94 to 24.14, the bars shrink back by
  24.29, the bead drops 24.10 to 24.30.
- s06 item 4: the sum at Outfit 600 56 px, gaps 16 (digits), 12 (dots), 16 and 12 round "=", ending x 1739:
  ink x 1254 to 1737, so the 1.2 pulse of "= 12" stays inside 1746 (scratch/sum56.mjs).
- Item 5 (shared block): the row feather ramps on smootherstep (8 stops) over 180 z world px (F-low 144 world,
  259 on screen from x 496; CU 180 world).
- Shared block also: tokenRow takes `size`, tokens carry cy (the scale centre) for tokenSet.
- Correction to round 4's report: the semitone hop's power2.inOut is GSAP's cubic, so its middle frame moves
  65 px in F-low, not 46 (I had modelled a quadratic). measure.py flagged nothing there in round 4's clip.
- Proof: clock-lint silent, shared block identical, npm run check 5 errors (m12-orange in s12 to s16 only).
  Stills: lab/s05-steps/stills-r5 (reset-sheet.png), lab/s06-groups/stills-r5 (octave-sheet.png, 6.5 F-low).

## Round 6: small round for review/component-B-03 (items 2, 3, 4) and the full check's layout error

- Item 2 (both scenes, the same call): the tally at x 1270 (the sum's lane), baseline 260, Outfit 600 64 px,
  21 px of advance between letters (23 to 24 px of ink): ink x 1271 to 1668 (was 1241 to 1692). Stills: Tavi's
  body min x 1734 to 1738 through 40.6 to 40.9; nearest tally ink to her body 73 px (was 41). Tally band at
  s05 41.5 against s06 0: max difference 5 levels.
- Item 3 (s06): the sum at 50 px, advance gaps 12 (digits), 19 (dots), 15 and 12 round "=", ending x 1739:
  ink x 1280 to 1737, gaps 15 to 18 / 20 to 22 / 20 and 17; "= 12" at 1.2 ends 1746; first "2" landing from
  1.3x starts about 1276 (scratch/sum-fit.mjs).
- Item 4 (s06): both brackets 10 more up (y 448, 266); the bead's top keeps 16.3 world px (29 on screen in
  F-low and F-high) under them; brackets drawn over the bead's glow and the echo rings. The glow itself (70 px
  halo; +16 levels out to about 57 world px) cannot clear the line in F-high: see the report.
- Layout error (s06 17.86 to 19.73): the F-G "T"'s glow was a second, blurred "T" text; now a soft 28 x 31 box
  (0.45 peak). Layout check on both lab projects, 80 samples: 0 errors.
- 60 fps: lab/s05-steps/tools/hostpass60.sh (a copy of builder E's); round 5's 30 fps clips kept as clip-r3.mp4.
- Results (60 fps, 00:45 and 00:51): s05 holds 0.4 s (0.3 per 30 s), longest 0.1; s06 0.7 s (0.6 per 30 s),
  longest 0.2. npm run check: passed, 0 errors (lint 0, layout 0, 2 infos in s01), contrast 59/59.

## Round 7 (coordinator's "round 5", S6 only): critic B-04 items 1, 3, 5

- Item 1: names ride out with the world; three fade, each after its outer neighbour has left: "B" from 5.44
  (stair 8's "C" out 5.42), riser 6's "T" from 5.60 ("S" out 5.60), both back 8.75 to 8.93 (before "S" 9.03,
  "C" 9.15); "D" from 9.42 (stair 1's "C" out 9.40), back 12.20 to 12.42 (before "C" 12.53).
  lab/s06-groups/item1/names.mjs.
- Item 3: brackets y 462 / 280 (72 px above F and C5); upper line at screen 52 to 55 in F-high (was 26 to 30);
  tone hops under brackets lift 30, semitone hops semiHopAt top 15 (flat top): bead rim 21 px under each line
  at closest (clip, 8.333 and 11.100); S label 3.8 world (was 6.8); glow still reaches the lines (+40 / +46
  levels under them); the C5 echo ring crosses behind the upper line (11.52 on). item5/hop-clear.mjs.
- Item 5: ghost masked out of each riser label's box (ink + 5 px, soft).
- Clip lab/s06-groups/clip.mp4 (60 fps, 02:24), round 4's kept as clip-r4.mp4. Holds 0.6 s (0.5 per 30 s),
  longest 0.2. Handoffs: S5/S6 168 px > 24 outside Tavi (max 45); S6/S7 156 (max 52). npm run check passed;
  80-sample layout check on S6: 0. Text sweep: EDGE only mid-move (5.5, 12.5).

## Status

| Scene | Built | Stills | Clip | measure.py | Text sweep | clock-lint | merc-tags |
| --- | --- | --- | --- | --- | --- | --- | --- |
| s05-steps | polish round (30 Oct) | polish/leap-sheet.jpg | 60 fps, 13:55 | 0.4 s (0.3/30), longest 0.1: pass | polish: as round 4 | clean | current (2 tags) |
| s06-groups | polish round (30 Oct) | polish/*.jpg | 60 fps, 13:52 | 0.8 s (0.7/30), longest 0.2: pass | polish: clean | clean | current (4 tags) |

## Next

1. Polish round reported to the director (30 Oct, 14:10). Await the film critic.

## Polish round (30 Oct, from 13:30): film-01 items 4 and 9, B-05 items 2 and 3, decision 123's check

Brief: /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/l4entr/polish/BRIEF-B.md.
Scratch in lab/s06-groups/polish/ (harness.mjs runs a JS body in a page with the kit and fonts).

- Plan, item 1 (s06 copy): a closed silhouette of stairs 1 to 4 (left side, treads, risers through the
  risers' centres, right side, foot), 15 % chrome fill, 4 px chrome outline plus a soft halo, the E-F segment
  gold; in on stairs 1 to 4 from climb - 0.25, travels climb + 0.05 over 1.3 s (the row's 124.3 to 125.6),
  out from word semitone + 0.35 over 0.3 s (127.30 to 127.60). The label mask goes. Measured
  (polish/contact.js): the copy moves along the staircase's own slope (182/480 = the stairs' rise), so every
  tread slides through the labels for most of the flight (T1 touches a label 0.21 to 0.99 s of 1.3 s with
  gaps of 0.04 s) and every riser crosses a label four times; a whole segment is dropped while it touches a
  label (band + 3 px) or while an end of it is free (its neighbour dropped) within 24 px of one. In practice
  the outline goes after the first ~0.2 s of travel and comes back in the last 0.06 s; the fill carries the
  flight.
- Plan, item 2 (s06): no camera moves; anchors A.push / A.truck / A.pull go. Events in their place: on "two,"
  (115.49) stairs 1 to 4 light together, stairs 5 to 8 0.35 s later; at the old truck's start (group-low
  + 1.52) the lower bracket leaves (as before), the upper lights, keys G4 A4 B4 C5 pulse 0.2 s apart (as C4
  to F4 do on "each"); the stairs go unlit from "Both" (123.50 to 124.00); the legend stays from S5 to b15;
  the tally still leaves at in - 0.35; key names stay to b16's end; no edge fades. Brackets heavier (4 px,
  10 px ticks) and 10 px higher (452, 270) so the bead's edge keeps 21 px under them at 1x, as HANDOFFS says.
  The C5 echo ring at F0 grows to 2x (at 3.5x it crossed the upper bracket and touched the "S" at 1x too).
- Plan, item 3 (shared block, both scenes): echo rings through a helper that caps the growth at 2x when the
  camera passes 1.5x during the ring's life. s05's two rings are at F0 (78.60 and 99.90; CU-A starts 79.80,
  the first ring has faded by 79.50), so nothing changes on screen today; it guards a re-voice.
- Built (13:40): s06 copy as planned; brackets 452 / 270, 4 px, ticks 10; ring 2x; anchors two, tallyOut, turn,
  copyOut; legend stays; key names stay; edgeA gone. Drop engine: touch = line within 3 px of a label's ink;
  free end = the joined segment dropped (after merging runs closer than 0.3 s) and the end within 24 px;
  iterated to a fixed point. polish/verify-copy.js (the real scene seeked at 240/s): outline on stairs 1 to 4
  until 124.42 (gone 124.48), F back 124.87, RS 124.97, all back 125.54 to 125.60; no drawn segment touches a
  label and no free end of any segment comes within 24 px of one. (A first try that widened the free-end test
  by the ramp's length crept back to the travel's first frame: two segments sharing a corner by a label
  dropped each other a ramp earlier each pass.)
- polish/hop-bracket.js: bead edge to the 4 px lines at F0: 20.8 px (semitone hops), 31.8 (tone hops), 35.8 at
  rest; at 462 / 280 it would be 10.8. Ring (2x) 12.5 px under the upper line, 21.2 from riser 7's "S". Lower
  right tick ends 18 px above the F-G bar, 33 above its "T".
- Text sweep (13:43, both): s05 as round 4 (EDGE 'C' 11.50 to 22.75 and 'T' 18.50, mid-move only); s06 clean,
  nothing flagged (no camera moves, so no EDGE).
- s06 clip 1 (13:46): holds 1.7 s (1.4 per 30 s), longest 0.3: 4.30 (0.3), 5.70 (0.3), 12.10 (0.2), 13.30
  (0.2), 18.70 (0.1) in the no-Merc stretch, 1.1 s in 19.3 s (1.7 per 30 s, at the limit). Fixes: the tally
  fades over 0.5 s linear (was 0.25); the group lights go back over 0.9 s (four stairs register by area);
  the bead scales 1.2 as it sends the C5 ring; the copy fades in linear and comes up at 28 % fill on stairs
  1 to 4, easing to the flight's 23 % over 124.25 to 124.65. Re-rendering.
- s06 clip 2 (13:52, lab/s06-groups/clip.mp4, 60 fps): holds 0.8 s (0.7 per 30 s), longest 0.2: 2.90 (0.2, Tavi
  talking), 12.10 (0.1), 18.70 (0.1), then 28.9 to 34.9 with Tavi on screen; the no-Merc stretch 4.4 to 23.66
  has 0.2 s. Events: small jumps only (1.40, 1.58, 25.58 to 32.38, all with Tavi on screen); the old 6.78 is gone.
- s05 clip (13:55, lab/s05-steps/clip.mp4, 60 fps): holds 0.4 s (0.3 per 30 s), longest 0.1; events as B-05 listed
  (4.68 to 4.90, 12.05, 16.92, 19.37 to 19.93, 38.13 to 38.42), nothing new from Tavi's leap at 40.30.
- Rings (polish/verify-rings.js, the scenes seeked at 60/s): s05 78.60 to 79.49 and 99.90 to 100.79 at F0, 3.5x
  (75.5 px); s06 122.41 to 123.30 at F0, 2.0x (42.5 px). The guard (polish/ring-cap-test.js, s05's camera and
  the helper verbatim): a ring at 80.30, 82.80, 87.10 or 92.07 grows to 2.0x; at 78.60, 79.30 or 93.07, 3.5x.
- Seams: s04/s05 (s05 frame 0 new against old) identical, max 0. S5/S6: outside the corners max 51, 181 px over
  24, all on "S" edges (the gold S labels and the tally's S's; round 7 had 168, B-05 328); Tavi's box (x 1640 to
  1920, y 560 to 900) mean 1.66, max 64, consecutive pass frames, polish/seams/cut-s05-s06-corner.jpg. s06 last,
  new against old: max 27, 1 px over 24 (B to C unchanged).
- Tavi (decision 123): s05 40.2 to 41.5 stills and s06 23.70 to 24.45 at 20 fps: she comes in at floor level,
  body x 1720 or more once in frame; the tally (ink to x 1668, y 214 to 260) and the sum (y 224 to 260) are far
  above her path; the strip ends at 1676; the rows are masked round her box. Nothing of mine on her path.
- check (root, 14:02): passed, 0 errors; my scenes' warnings are the same kinds as round 6 (too large,
  duplicate media, nested media start for the Merc tags), four fewer (the intro seg tags went). 80-sample check
  on lab/s06-groups/proj: layout 0 issues, contrast 128/128. merc-tags --check: 2 and 4 tags, 0 stale.
