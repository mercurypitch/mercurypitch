# s09-onset: build notes (group C)

`compositions/s09-onset.html`, 57.07 s on the scratch clock (film 228.27 to 285.34: from the cut 0.15 s before
`act4` to the cut 0.15 s before `act5`). STORYBOARD 9a to 9g; HANDOFFS § The folds and the traces (S9), § Provisional
values (9b), § The cuts S8 to S9 and S9 to S10. F0 throughout, no camera move: the strip becomes the stack in an object
move. Hosts at 240 (m-blue-s09, m-orange-s09), idle.

## Rows and anchors (scene time; the scratch clock)

| Row | What | Anchor | Scratch |
| --- | --- | --- | --- |
| 9a | S8's last frame (the figure whole, breathed out to rest, the jaw at 4 px, its cue block) dims to 25 %, the labels, leaders and marks hidden (0.2 s, linear) | `at('act4')` | 0.15 to 0.35 |
| 9a | card "04 Starting a note" | `act4 + 0.22`; `at('o10', 'start', -0.5)` | 0.37; 1.85 to 2.23 |
| 9b | kicker "04 · STARTING A NOTE" | `at('o10')`; out at `at('b24', 'end')` | 2.35; 10.465 |
| 9b | the figure fades from 25 % (0.4 s); the ring at the throat (1005, 273), full strength, grows into the folds (0.5 s), as the card starts to leave **[C-01: 196]** (on "how" and 0.9 s before) | `at('o10', 'start', -0.5)` (the card's exit) | 1.85 to 2.25; to 2.35 |
| 9b | the folds slide to (390, 430) at scale 1.35 **[C-01: 192]** (1.0 s, power2.inOut); "vocal folds, from above" centred under them, baseline 694 (0.3 s, linear) | `+ 0.4`; its end | 2.25 to 3.25; 3.25 |
| 9b | the strip, a lit lane (chrome 6 %, x 700 to 1600, y 320 to 540) **[C-01: 192]** with its hairline, draws on left to right (0.6 s), "ILLUSTRATION" with it | `+ 0.45` | 3.70 |
| 9b | the four words return; "onset" lights | `word('b24', 'onset', 'start', -0.41)`; `word('b24', 'onset')` | 5.655; 6.065 |
| 9b | title "onset: how a note starts" | `word('b24', 'onset', 'end')` | 6.65 |
| 9b | the three chips, 0.4 s apart | `word('b24', 'three')` | 7.963, 8.363, 8.763 |
| 9b | the four words leave | `at('b24', 'end', -0.1)` | 10.365 |
| 9c | "Air first" lights, the title switches; the folds draw apart, the air arrow rising between them | `word('b25', 'air first')` | 10.785 |
| 9c | the air start drawn at the sound's pace; the folds close into vibration as the tone grows | `at('start-air')` | 15.63 |
| 9c | "air, no note" | `start-air + 0.56` | 16.19 |
| 9d | trace 1 goes to 30 % (0.3 s, linear) and stays until the catch draws over it **[C-01: 192]**; the title switches to "A catch" | `word('b26', 'catch')` | 17.70 |
| 9d | "LISTEN ONLY" beside it (+ 24 px) | `catch + 0.43` | 18.13 |
| 9d | the folds pressed shut (12 px, no gap) | `word('b26', 'pressed')` | 19.85 |
| 9d | the catch: 0.15 s of nothing, its mark, the folds snapping open into vibration; trace 1 hidden left of its head | `at('start-catch')` | 24.66 |
| 9d | "the catch" | `start-catch + 0.29` | 24.95 |
| 9e | trace 2 goes to 30 % until together draws over it, "Together", "LISTEN ONLY" leaves | `word('b27', 'together')` | 26.805 |
| 9e | the folds from apart to a slit | `word('b27', 'meet')` | 28.455 |
| 9e | the together start, the wave growing smoothly, the gold tick (4 x 40) at its onset | `at('start-together')` | 31.39 |
| 9f | the title and chips leave | `at('b27a') + 0.04` | 33.38 |
| 9f | the stack, in order **[C-01: 197]**: the folds shrink first (0.5 s), then trace 3 settles into row 3 (y 650; 0.6 s, from 0.4 s), the lane fading as it does | `b27a + 0.09`; `+ 0.4` | 33.43 to 33.93; 33.83 to 34.43 |
| 9f | the names once trace 3 has settled, 0.4 s apart (they landed with the move before) | `+ 1.0` | 34.43, 34.83, 35.23 |
| 9f | each name pulses on its word | `word('b27a', 'puff' / 'click' / 'neither')` | 35.735, 36.45, 37.11 |
| 9f | row 3's drawing leaves before the replay | `at('b27a', 'end')` | 37.61 |
| 9f | the three back to back, each row lit while it plays, the small folds in each start's state; "LISTEN ONLY" under "A catch" (right-aligned 660, centred y 495) **[C-01: 195]** | `at('starts')` + 0, 1.8, 3.6 | 37.96, 39.76, 41.56 |
| 9f | the circles round row 1's puff and row 2's click; "neither" | each row's end + 0.23; row 3's end + 0.13 | 39.79, 41.59; 43.29 |
| 9g | row 3 lights, rows 1 and 2 dim their strokes (0.6 s, linear) | `word('b28', 'the third')` | 47.983 |
| 9g | "the easy start" under "Together" (right-aligned 660, baseline 714) **[C-01: 195]**; the gold tick scales 1.2 | `word('b28', 'the easy')` | 48.67 |
| 9g | the "h" (serif 120, ink-2) to 70 % and row 3's first 200 px to 25 % (0.5 s, linear) **[C-01: 195]** | `word('b28', 'soft')` | 52.657 |
| 9g | "the h, only in your mind"; the "h" fades (1.2 s) | `word('b28', 'only')` | 55.12 |

The closest two landings are 0.40 s apart (the names).

## Departures from the board, with numbers

1. **The names right-aligned to 660** (HANDOFFS 670): row 1's circle (rx 122 round its dots) reaches x 676, 5 px from
   "Air first"; at 660 "Air first" stands 14.75 px clear.
2. **"the puff" at baseline 148** (HANDOFFS 165): row 1's circle (ry 84 round 250) rises to y 166, through the label's
   descender at 171; at 148 it stands 9.75 px clear.
3. **"the click" from x 812** (HANDOFFS 800): at 800 it sits 6 px over row 2's circle; at 812 it is 12.19 px clear of
   row 2's circle and 11.23 px of row 1's.
4. **"the easy start" at baseline 564** (HANDOFFS 568): at 568 its "y" stands 3 px over row 3's crests at y 580; at
   564, 7 px over them and 15 px under row 2's envelope.
5. **The rows' half-height is a local 70**: `L.TRACE.STACK` names the key `h` twice (70, then the "h" glyph's place),
   so `STACK.h` is the glyph's object and the rows' geometry came out NaN.
6. **The chapter card lands at act4 + 0.22** (STORYBOARD § Chapter cards); 9a's own row gives 237.89, act4 + 0.52.
7. **Fades made linear**: row 3's light and rows 1 and 2's dim at "the third" (0.6 s; eased 0.3 s it measured as a pop,
   1.46 % at 48.133) and "vocal folds, from above" (0.3 s; a pop at 3.933).
8. **The two-line serif label carried from S8** is marked `data-layout-allow-overlap`, as in S8.
9. **Holds run 3.0 s per 30 s** (target about 1 s; longest 0.4 s): the board's static frames between the starts.

## Built locally (the kit might offer)

- **A trace with movable geometry**: the strip's hairline is its own empty trace and trace 3 rides a group with a
  non-uniform transform (`translate(0, cy - 430 sy) scale(1, sy)`, sy to 70/110) into row 3, its strokes
  `vector-effect: non-scaling-stroke`; the gold tick is drawn locally so it never scales. `L.trace` fixes its strip at
  build.
- **The folds' state machine** (`foldsAt(t)`): apart, slit, pressed, vibration, from the starts' own times (FACTS 80),
  for the large folds and again for the small folds during the replay.
- The title switches and "LISTEN ONLY" placed by the measured title width (+ 24 px).
- S8's cue block, copied, for the first frame.

## Fix round C-01 (19 November)

The critic's report is `review/critic-C-01/REPORT.md`; the calls are DECISIONS 191, 192, 195, 196 and 197. Proof in
`fix-C-01/` (before-and-after pairs against the critic's crops, contact sheets, dense sheets, the fill numbers).

- **192, the long middle gets a subject** (`compositions/s09-onset.html` lines 38 to 44, 175 to 197, 268 to 290): the
  strip is a lit lane (chrome 6 %, x 700 to 1600, y 320 to 540; it lifts the ground from 19 to 30 of 255 in the clip),
  drawn on with the strip and fading as trace 3 settles in row 3; each finished trace goes to 30 % when the next start
  is named and stays until the next draws over it (a clip whose left edge is the next trace's head); the folds' box at
  1.35 about (390, 430): x 160.5 to 619.5, y 200.5 to 659.5, 80.5 px clear of the lane, 26.9 px clear of Merc's body
  box, its name centred under it (baseline 694, 13.5 px under the outline). In the right two-thirds of the frame
  (x 640 to 1680, y 200 to 700) the share of pixels 8 levels or more over the ground: at 9.50, 3.6 % before, 5.5 %
  after; at 21.00, 3.2 % before, 15.0 % after (25 levels: 2.3 % to 9.8 %) (`fix-C-01/middle-fill.txt`). measure.py's
  low-motion runs are the same length as before (19.5 s before, 19.3 s after, listed from 6.7 to 31.4): the waits stay,
  as 192 says; what changed is what the frame holds in them. Stills: `fix-C-01/pair-9.50.png`, `fix-C-01/pair-21.00.png`,
  `clip-still-19.20.png`, `clip-still-25.46.png` (the catch drawing over trace 1), `clip-still-29.92.png`.
- **195, the labels** (lines 211 to 229, 316 to 322): "the easy start" right-aligned 660, baseline 714 under
  "Together" (15 px under its ink, 40.6 px from row 3, 38.2 px from the gold tick, 62.9 px from "the h, only in your
  mind"; before, on "neither"'s baseline 564 at x 1000); the "h" at 70 % (was 40 %) with row 3's first 200 px (x 704 to
  880, soft to 920, past the tick) at 25 % through a mask while it shows, both linear over 0.5 s (eased over 0.3 s
  they measured as a pop, 0.28 % at 52.800); "LISTEN ONLY" under "A catch", right-aligned 660, centred y 495 (x 409.6 to
  660, y 475 to 515): 12 px under the name's ink, 40 px left of row 2, 90.4 px from its circle, 120 px over "Together".
  Stills: `fix-C-01/pair-54.00.png`, `fix-C-01/crop-h-53.16.png`, `clip-still-46.72.png` (LAB-CHECKS 13), `clip-still-48.97.png`.
- **196, the opening** (lines 38 to 44): the figure's fade and the ring's growth start at the card's exit (1.85, was
  2.495); the ring grows in 0.5 s (was 0.9) and slides from 2.25. The lit share of the frame from 2.23 to 3.40 (hosts
  excluded, the critic's dense window): mean 0.135 % before, 0.440 % after; emptiest frame 0.047 % before, 0.141 %
  after (`fix-C-01/opening-fill.txt`; `fix-C-01/dense/dense-002.90s-30fps.jpg` against `review/critic-C-01/d09/`).
- **197, the stack in order** (lines 60 to 66, 259 to 300): the folds shrink first (33.43 to 33.93), trace 3 settles
  (33.83 to 34.43), the names land from 34.43, 0.4 s apart (they landed from 33.43 with the move before). Stills
  `clip-still-33.60.png`, `clip-still-33.95.png` (`fix-C-01/pair-33.95.png`), `clip-still-34.41.png`,
  `clip-still-34.60.png`; `fix-C-01/dense/dense-034.10s-30fps.jpg`.
- **191**: the first frame is S8's at rest (belly 1061.0; POSE8 `breath: 0`).
- Holds after the fixes: 5.7 s inside the film (3.0 s per 30 s), longest 0.4 s (5.8 before); they go to the passes
  step (DECISIONS 201).

## Proof

- Probe (`probe.json`, `probe-*.png`, `probe-sheet-0.png`, `probe-sheet-1.png`; checks in `checks.js`): 59 of 59 pass.
  The first frame on S8's last (crown (991, 154), belly 1050.5, chin 242, every cue label at full); 9a at 25 %, labels
  0; the folds' box x 220 to 560, y 260 to 600, their label x 220, baseline 650; the strip x 700 to 1600, y 430, its chip
  right-aligned 1600; the title 158 px from the chip, 39 px over the strip; the chips at y 680 from x 700, 920, 1140;
  "LISTEN ONLY" 24 px after "A catch"; the folds pressed 12 px; the catch's mark at x 782.4 (0.15 s); the tick 4 x 40 at
  x 698 to 702; the stack (small folds x 160 to 330, y 110 to 280; trace 3's wave y 580.7 to 719.3; row 3's hairline
  650; the tick y 630 to 670; names right-aligned 660 at baselines 262, 462, 662); the "h" at (760, 690), 40 %; the last
  frame (the stack, its names, circles, labels, both chips at full, the "h" gone, the small folds apart at rest); no two
  visible texts overlap at any time tested; keep-out 348.66 and 360.44 px.
- **Provisional value confirmed, the folds' growth from the throat (9b)**: a ring of r 20 at scale 0.5 (20 px across)
  centred (1005.0, 273.0), at full strength from its first frame (0.2 s linear fade-in), growing over 0.9 s from
  `word('o10', 'how') - 0.05`, sliding from + 0.4 s over 1.0 s (power2.inOut) to (390, 430) at scale 1, landed box x 220
  to 560, y 260 to 600. Stills: `probe-2.51.png`, `clip-still-2.51.png`, `clip-still-2.60.png`, `clip-still-2.69.png`,
  `clip-still-2.89.png`, `probe-3.19.png` (mid-slide), `probe-3.94.png` (landed).
- **LAB-CHECKS 13** (9f to 10a, board 290.00 = scene 46.72; `probe-46.72.png`, `clip-still-46.72.png`): the strip's
  chip 10 px over row 1's envelope (180); "LISTEN ONLY" 10 px under row 1's envelope (320) and 10 px over row 2's (380),
  at row 2's right end (x 1349.6 to 1600, centred y 350).
- **The cut S9 to S10** (`probe-57.07.png` against `../s10-steady/probe-0.00.png`): outside the hosts' squares the
  largest change is 8 of 255, no pixel over 24.
- Clip: `clip.mp4` (30 fps draft, scratch voice); stills `clip-still-*.png` at 0, 0.40, 2.51, 2.60, 2.69, 2.89, 3.19,
  3.94, 5.29, 7.00, 9.11, 11.48, 16.49, 18.43, 20.25, 25.06, 28.96, 32.39, 34.03, 34.68, 40.26, 43.59, 46.72, 48.97,
  53.16, 57.04; `clip-sheet.png`. Hosts at 240 on every still.
- `measure.py render` (`measure/summary.md`): holds 5.8 s inside the film (3.0 s per 30 s), longest 0.4 s; single-frame
  events: 1.467 (jump, 0.63 %, the card's breathing in), 33.100 (jump, 0.22 %: the folds' last vibration, sampled at 30
  fps, then their release to apart; the region x 360 to 480, y 300 to 600), 47.767, 53.267, 55.767 (pops, 0.03 to
  0.05 %, in the hosts' squares: blinks). Integrated -20.0 LUFS, true peak -2.7 dBTP.
- `check lab/s09-onset/proj` (`check.log`): 0 errors; contrast 44/44; layout 0 errors, one info (17.86, the title's
  switch from "Air first" to "A catch", a cross-fade in one place, as intended). Root `check`: passes, 0 errors.
- clock-lint silent; `merc-tags.py s09-onset --check`: 4 tags, 0 stale, 0 problems.
