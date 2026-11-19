# s10-steady: build notes (group C)

`compositions/s10-steady.html`, 61.08 s on the scratch clock (film 285.34 to 346.42: from the cut 0.15 s before
`act5` to the matched cut on `sing`). STORYBOARD 10a to 10h; HANDOFFS § The hold chart, § The hold frame at the right
half, § The wave rule, § Framings (F-hold, CU-scoop, CU-wave), § Camera moves, § The cuts S9 to S10 and S10 to S11.
Hosts at 240, moving to the corners at 300 with the push (m-blue-s10, m-orange-s10). Push-and-return 2 is a push to
CU-scoop, a truck to CU-wave and a pull back to F-hold; 10h holds F-hold to the cut.

## Rows and anchors (scene time; the scratch clock)

| Row | What | Anchor | Scratch |
| --- | --- | --- | --- |
| 10a | S9's last frame (the stack, its names, circles, labels, both chips, the small folds) dims to 25 %, its type and chips hidden while dim, the circles undrawn | `at('act5')` | 0.15 |
| 10a | card "05 A steady note" | `act5 + 0.22`; `at('o11', 'start', -0.5)` | 0.37; 1.85 to 2.23 |
| 10a | the stack leaves from dim, up fast (0.3 s, 16 px, power3.in) | `at('o11', 'start', -0.23)` | 2.12 to 2.42 |
| 10b | push F0 to F-hold (1.5 s, power2.inOut); the chart fades in at a 4 s window (0.6 s, linear); the hosts to (110, 840) and (1800, 840) at 300 (0.6 s) | `o11 + 0.07` | 2.42 to 3.92; 2.42 to 3.02 |
| 10b | kicker "05 · A STEADY NOTE" (out 0.4 s) | `push + 0.4`; `at('b29', 'end')` | 2.82; 9.075 |
| 10b | Tavi's straight guess draws with its travelling head; Merc's line to 0 under it (DECISIONS 170) | `word('o11', 'perfectly')` | 4.75 |
| 10b | its "?" | `word('o11', 'line')` | 5.848 |
| 10b | the window widens 4 s to 10 s (0.8 s); "4 s" gives way to "10 s" | `word('b29', 'ten')` | 8.077 |
| 10c | her hold draws as she sings (10 s) | `at('demo')` | 9.475 |
| 10c | the band's mint edge and "in the band" lit (0.4 s, linear) | `demo + entry` (0.704) | 10.179 |
| 10c | the settled flag and "settled" | `demo + entry + 0.5` | 10.679 |
| 10c | the guess and its "?" fade (0.5 s); Merc's line back | `demo + 2.0` | 11.475 |
| 10d | the line's first second glows | `word('o12', 'scooped')` | 20.027 |
| 10d | a light runs along its held wave | `word('o12', 'waves')` | 20.727 |
| 10d | push to CU-scoop (1.5 s, power2.inOut); the axis fades; the chart's chip leaves (0.5 s, linear) | `word('b30', 'is', 'start', 0.03)` | 23.648 to 25.148 |
| 10d | "SLOWED · ILLUSTRATION" (frame-fixed); the first 1.5 s fade and redraw at a third of their speed | `push2 + 1.6` | 25.248 to 29.748 |
| 10d | "scoop" | `word('b30', 'a scoop')` | 29.542 |
| 10e | truck to CU-wave (2.0 s, sine.inOut); "scoop" and "A, any octave" leave (0.2 s), "settled" and its flag (0.3 s, linear); SLOWED leaves as the truck lands (0.3 s, linear); the chip comes back by the edge rule | `at('b31') + 0.08` | 30.64 to 32.64 |
| 10e | "small vibrato: inside the band" and the vibrato's bracket | `word('b31', 'small')` | 33.452 |
| 10e | the mint edge glows; "in the band" scales 1.08 | `word('b31', 'the band')` | 38.153 |
| 10f | pull to F-hold (1.46 s, power2.inOut); the bracket and "small vibrato" leave | `at('b32')` | 39.14 to 40.60 |
| 10f | the axis, "A, any octave", "settled" with its flag (scaling 1.2) come back, one at a time | `pull end - 0.2`; `+ 0.25`; `max(word('b32', 'settles'), + 0.21)` | 40.40; 40.65; 40.86 |
| 10f | "steady: settles into the band and stays"; the bracket along the band's top from the flag | `word('b32', 'stays')` | 42.113 |
| 10f | the bracket under the plot, "a comfortable, fixed length" | `word('b32', 'comfortable')` | 43.689 |
| 10g | her guess "steady air keeps it there?" with its dashed underline and "?" (0.3 s, linear) | `word('o13', 'steady air')` | 48.53 |
| 10h | the guess fades (0.3 s); her line, the flag, both brackets and the chart's labels (0.4 s) | `at('b33') + 0.06` | 51.37 |
| 10h | the hold frame slides to the right half (1.1 s, power2.inOut): screen x 1000 to 1640, line y 245 | `b33 + 0.16` | 51.47 to 52.57 |
| 10h | the voice box draws on (1.0 s); "voice box" | `slide + 0.5`; `word('b33', 'voice box')` | 51.97; 52.88 |
| 10h | "muscles here set the note" | `word('b33', 'set')` | 53.705 |
| 10h | "a steady note needs steady air too" | `word('b33', 'needs')` | 56.08 |
| 10h | the slider and the silent line (6 s window, Push's rule), the thumb 50, 75, 50, 70, 50 (four legs of 0.5025 s, sine.inOut) | `word('b33', 'because') + 0.47` | 58.64 |
| 10h | "ILLUSTRATION" on the frame | `line + 0.45` | 59.09 |
| 10h | "a change in the air moves it" | `word('b33', 'moves')` | 59.93 |
| 10h | the slider, line, box and type fade (0.3 s), leaving the empty frame for the cut | `D - 0.43` | 60.65 to 60.95 |

The closest two landings are 0.40 s apart (the chart with its labels, the kicker). After the pull, the three that left
come back 0.25 and 0.21 s apart.

## Departures from the board, with numbers

1. **The axis's "0" left-aligned at x 400, its first tick not drawn.** The kit's default, right-aligned 12 px left of
   the plot (x 388), stands at screen x 193 to 216 at F-hold, 3 px from Merc's body box (to x 190). Left-aligned it is
   42.5 px clear; the first tick would cut into its top, so the "0" stands for it, as "4 s" and "10 s" stand for the last
   (the kit fades that tick itself). "0" and "10 s" stand inside the hosts' video squares, over their transparent part,
   42.5 and 32.5 px from the body boxes (keep-out 20): marked `data-layout-allow-occlusion`.
2. **The chart's chip leaves by time, not by the edge rule, on the push to CU-scoop**: the push carries it out of frame
   inside about 2 frames, so it fades over the push's first 0.5 s (linear). It comes back by the edge rule as the truck
   lands at CU-wave (x 1408.8 to 1896, 24 px from the frame's right edge) with an 8 px ramp past the 16 px margin.
3. **"settled" and its flag leave over 0.3 s, linear** (board 331.90 to 332.10, 0.2 s), and come back together on
   "settles" with the flag's 1.2 pulse. An eased 0.2 s fade measured as a pop.
4. **Three more fades lengthened or made linear for measure.py** (DECISIONS 179): the kicker's exit 0.4 s (a pop at
   9.233), SLOWED's exit 0.3 s linear (32.8), her second guess's entry 0.3 s linear (48.567).
5. **The stack is rebuilt from S9's last frame** in this file (its strokes, names, circles, labels, chips and the
   small folds), then dimmed and sent up fast.
6. **10h is drawn in a group under the inverse of F-hold** (matrix 1/1.3, offsets 288/1.3 and -10/1.3), so its screen
   numbers (HANDOFFS) are written as they are; the hold frame's slide moves the chart's geometry to the frame's world
   place (x 990.8 to 1483.1, y0 180.8, k 1/1.3), Merc's line from 4 to 4/1.3 world px (4 px on screen).

## Built locally (the kit might offer)

- **The settled time by the page's rule**: 16 ms readings of `L.CONTOUR.demo`, the first that stays within 35 cents
  for 0.5 s, entry 0.704 s, flag at 1.204 s.
- **A time-based fade for frame-edge objects on fast camera moves** (item 2); `cam.edgeAlpha` with a ramp parameter.
- **The axis's "0" left-aligned with no first tick** (item 1).
- **The stack's rebuild** (item 5): a kit `L.STACK_S9` drawing the end state would keep S9 and S10 in step.
- **The slowed redraw**: the first 1.5 s faded and redrawn at a third of their speed by remapping the line's own time.
- **The cut probe** `cutprobe.mjs`: S10's last 0.5 s and a stand-in for S11's first 0.5 s drawn from the kit's one
  definition (`L.bandChart(world, L.CHART.FRAME)`, `L.roomCut(room, { from: 'F-hold' })`), joined for measure.py.

## Proof

- Probe (`probe.json`, `probe-*.png`, `probe-sheet-0.png` to `probe-sheet-2.png`; checks in `checks.js`; the last run
  of all three probes in `probe-groupC.log`): 117 of 117 pass. The first frame on S9's last; 10a at 25 %; F-hold, W 4:
  the plot x 232 to 1688, band y 416.3 to 643.8, Merc's line y 530, "A, any octave" from 232 at 387, the chip
  right-aligned 1688, the "0" from 232 at 690; the hosts back at 300 in the corners; the guess along y 530 with its "?"
  at x 1708.8; W 10: band 484.5 to 575.5, ticks 145.6 px apart; "in the band" at (544, 387); the guess gone and Merc's
  line back; CU-scoop: band 457 to 583, the scoop's low point at (360, 628); "scoop" at (360, 700); CU-wave: the chip at
  x 1408.8 to 1896, the vibrato bracket at x 1500, y 495 to 545, "small vibrato" from (888, 416); back at F-hold; the
  steady label at (232, 322); the top bracket from the flag (334.5) to 1688; the bracket under the plot at y 712, its
  label centred 960, baseline 760; the second guess at (232, 257); 10h: the frame x 1000 to 1640, band 210 to 280,
  Merc's line y 245, 4 px; the voice box x 300 to 640, y 190 to 510; the silent line's head at 106.7 px a second; the
  frame's chip x 1369 to 1640, y 156 to 196; no two visible texts overlap at any time tested; keep-out 32.5 px or more.
- **Provisional value confirmed, the settled flag's time (page's rule)**: entry 0.704 s into the take (16 ms readings;
  a continuous crossing gives 0.688, the board 0.69), the flag at 1.204 s (scene 10.679), world x 478.8, screen x 334.5
  at F-hold, y 464 to 484.5, "settled" baseline 454.6. Stills `probe-11.03.png`, `clip-still-11.03.png`.
- **The wave rule** (k, W 10 on the 1120 px plot): F-hold one cycle 26.52 px, peak to peak 36.4 (ratio 1.37;
  `probe-19.58.png`); CU-scoop and CU-wave 36.72 / 50.4 (`probe-25.20.png`, `probe-32.69.png`); 10h's frame 19.33 px a
  cycle (`probe-60.63.png`).
- **LAB-CHECKS 14** (10d to 10e, `probe-25.55.png`, `probe-31.14.png` to `probe-32.59.png`, `clip-still-25.55.png`,
  `clip-still-31.64.png`): "SLOWED · ILLUSTRATION" frame-fixed at x 1110 to 1563.2, y 380 to 420 at 326.20 + 0.3 and
  at + 0.5, 1.0, 1.5, 1.95 s into the truck; nothing passes under it (nearest the band's top, 37 px); 536.7 px from
  "settled".
- **LAB-CHECKS 2, the matched cut on `sing`** (`cut/`): S10's last frame against the stand-in's first: the band x 1000
  to 1640, y 210.01 to 280.01 against 210.00 to 280.00; Merc's line at y 245.00 on both; best shift (0, 0) for the band
  (residual 1.79 of 255) and the line (6.84). The line's centre and width match (3.97 against 4.0 px of ink), but under
  the 1.3x camera its two edge rows read 87 % and a 1 px fringe at 18 % (largest change 32 of 255 on those rows): the
  layer's rasterising at scale, not a move. `cut/cut-s10-s11.mp4` (frame 15 is the cut): `cut/measure/summary.md`
  finds no single-frame event. The room's crossfade is S11's (`L.roomCut`).
- **The cut S9 to S10** (`../s09-onset/probe-57.07.png` against `probe-0.00.png`): outside the hosts' squares the
  largest change is 8 of 255, no pixel over 24.
- Clip: `clip.mp4` (30 fps draft, scratch voice, re-rendered after the chip and flag fades); stills `clip-still-*.png`
  at 0, 0.40, 2.43, 2.67, 3.97, 6.15, 8.93, 10.63, 11.03, 12.03, 19.58, 25.20, 25.55, 29.84, 31.64, 32.69, 33.95, 38.30,
  40.62, 41.31, 42.81, 44.39, 48.93, 52.62, 53.18, 56.38, 59.39, 60.23, 61.06; `clip-sheet.png`; the camera moves at
  10 fps in `dense-moves/` (3.17 the push, 24.40 the push to CU-scoop, 31.64 the truck, 39.87 the pull).
- `measure.py render` (`measure/summary.md`): holds 2.3 s inside the film (1.1 s per 30 s), longest 0.2 s; single-frame
  events: 1.467 (jump, 0.47 %, the card's breathing in), 6.467 and 46.333 (pops, 0.05 %, in Merc's and Tavi's squares:
  blinks), 33.300 (jump, 0.03 %, no pixel over 16), 41.567 (jump, 0.05 %, "settled" and its flag coming back with the
  pulse). Integrated -20.5 LUFS, true peak -1.6 dBTP.
- `check lab/s10-steady/proj --at=11.03,25.20,29.84,31.64,33.95,41.31,48.93,60.23` (`check.log`): 0 errors; contrast
  21/21; layout 0 errors, one info (8.24, "4 s" and "10 s" in one place during the swap, as intended). Root `check`:
  passes, 0 errors, contrast 36/36, layout 0 issues.
- clock-lint silent; `merc-tags.py s10-steady --check`: 4 tags, 0 stale, 0 problems.
