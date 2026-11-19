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
| 10a | the stack leaves from dim, up fast (0.3 s, 16 px, power3.in), as the card starts to leave **[C-01: 196]** (2.12 before) | `at('o11', 'start', -0.5)` (the card's exit) | 1.85 to 2.15 |
| 10b | the hold chart fades in at F0 at a 4 s window (0.25 s, linear), at full before the push **[C-01: 200]** (it faded in with the push before); then the push F0 to F-hold (1.5 s, power2.inOut) and the hosts to (110, 840) and (1800, 840) at 300 (0.6 s) | `stack out + 0.3`; `o11 + 0.07` | 2.15 to 2.40; 2.42 to 3.92 |
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
| 10e | "small vibrato: inside the band" and the vibrato's height: two ink hairlines at its crest and trough, 240 px at CU-wave with end ticks **[C-01: 199]** (a chrome bracket before), drawn out from their middle (0.4 s) | `word('b31', 'small')` | 33.452 |
| 10e | the mint edge glows; "in the band" scales 1.08 | `word('b31', 'the band')` | 38.153 |
| 10f | pull to F-hold (1.46 s, power2.inOut); the bracket and "small vibrato" leave | `at('b32')` | 39.14 to 40.60 |
| 10f | the axis, "A, any octave", "settled" with its flag (scaling 1.2) come back, one at a time | `pull end - 0.2`; `+ 0.25`; `max(word('b32', 'settles'), + 0.21)` | 40.40; 40.65; 40.86 |
| 10f | "steady: settles into the band and stays"; the bracket along the band's top from 12 px right of "settled" to the plot's end, its ticks 16 px over the mint edge **[C-01: 199]** (7 px before, from the flag) | `word('b32', 'stays')` | 42.113 |
| 10f | the bracket under the plot, "a comfortable, fixed length" | `word('b32', 'comfortable')` | 43.689 |
| 10g | her guess "steady air keeps it there?" with its dashed underline and "?" (0.3 s, linear) | `word('o13', 'steady air')` | 48.53 |
| 10h | "No." **[C-01: 198]**: an ink strike through her guess and its "?" (0.3 s), held 0.4 s; then in turn, 0.05 s apart, each over 0.3 s (linear): the guess, "steady: ...", "A, any octave", "in the band" with the mint edge, "settled" with its flag, "a comfortable, fixed length", the chip and the axis, both brackets, her line | `at('b33') + 0.06`; `+ 0.7` | 51.37 to 51.67; 52.07, 52.12, ... 52.47 (gone 52.77) |
| 10h | the hold frame slides to the right half (1.1 s, power2.inOut) once her line has gone: screen x 1000 to 1640, line y 245 | her line's fade's end | 52.77 to 53.87 |
| 10h | the voice box draws on (1.0 s) as the frame leaves its place; "voice box" with it | `slide + 0.4`; `max(word('b33', 'voice box'), box)` | 53.17; 53.17 (the word 52.88) |
| 10h | "muscles here set the note" | `word('b33', 'set')` | 53.705 |
| 10h | "a steady note needs steady air too" | `word('b33', 'needs')` | 56.08 |
| 10h | the slider (thumb at 50) and the silent line's head (6 s window, Push's rule), drawing to the end **[C-01: 193]** (on "because" before) | `word('b33', 'needs') + 0.4`; `+ 0.3` | 56.48; 56.78 |
| 10h | "ILLUSTRATION" on the frame | `line + 0.45` | 57.23 |
| 10h | "a change in the air moves it" and one push, 50 to 100 and back (two legs of 0.9 s, sine.inOut), the thumb at 50 after **[C-01: 193]** (on "moves" with four legs of 0.50 s, 50 to 75 to 50 to 70 to 50, before) | `word('b33', 'because')` | 58.17; 58.17 to 59.97 |
| 10h | the slider, line, box and type fade (0.4 s, linear), leaving the empty frame, gone 0.13 s before the cut (364.60) | `D - 0.13 - 0.4` | 60.55 to 60.95 |

The closest two landings are 0.40 s apart ("a steady note needs steady air too" and the slider). After the pull, the three that left
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
7. **10h's push goes to 100, not 75** (DECISIONS 193 asks for 50 to 75 to 50 and a bump at least twice the wave's peak
   to peak; both cannot hold). By Push's rule (FACTS 73, 1.2 cents a step) 75 is +30 cents, 30 px at the frame's 1.0 px
   a cent, and the voice's wave is +-14 cents, 28 px peak to peak at the same scale: 1.07 times, at any scale, since both
   are in cents. Twice needs 97 or more; 100 (the slider's end, +60 cents, as S5's Push note) gives a bump of 59.2 px
   measured, 2.12 times the wave's 28.0. HANDOFFS § 10h's slider ("75 is +30 c, 30 px up; 70 is +24 c") wants the new
   push, if the director keeps it.
8. **The slider starts 0.4 s after "needs"** (56.48; DECISIONS 193 says "from 'needs'"): "a steady note needs steady air
   too" lands on "needs" (56.08), and the slider's "Push" and its value are labels, so the 0.4 s rule puts the slider
   0.4 s after it; the line's head draws from 56.78.
9. **"voice box" lands with its box, 0.29 s after its word** (53.17; the word 52.88): "No."'s strike, hold and turn-by-turn
   clearing (51.37 to 52.77) push the frame's slide to 52.77 and the box to 53.17; the box draws as the frame leaves its
   place (+ 0.4 s, where the band has cleared x 640 going up and right).
10. **The chart fades in over 0.25 s, linear, from the stack's last frame** (2.15 to 2.40), so that it is at full before
    the push (2.42) and barely under the card's exit (the card is gone at 2.23).

## Built locally (the kit might offer)

- **The settled time by the page's rule**: 16 ms readings of `L.CONTOUR.demo`, the first that stays within 35 cents
  for 0.5 s, entry 0.704 s, flag at 1.204 s.
- **A time-based fade for frame-edge objects on fast camera moves** (item 2); `cam.edgeAlpha` with a ramp parameter.
- **The axis's "0" left-aligned with no first tick** (item 1).
- **The stack's rebuild** (item 5): a kit `L.STACK_S9` drawing the end state would keep S9 and S10 in step.
- **The slowed redraw**: the first 1.5 s faded and redrawn at a third of their speed by remapping the line's own time.
- **The cut probe** `cutprobe.mjs`: S10's last 0.5 s and a stand-in for S11's first 0.5 s drawn from the kit's one
  definition (`L.bandChart(world, L.CHART.FRAME)`, `L.roomCut(room, { from: 'F-hold' })`), joined for measure.py.

## Fix round C-01 (19 November)

The critic's report is `review/critic-C-01/REPORT.md`; the calls are DECISIONS 193, 195, 196, 198, 199 and 200. Proof
in `fix-C-01/` (before-and-after pairs against the critic's crops, contact sheets, dense sheets, frame measurements).

- **193, 10h's demonstration** (`compositions/s10-steady.html` lines 90 to 97, 208 to 211, 337 to 347): the slider from
  "needs" + 0.4 (56.48), the line's head from 56.78 to the end; one push on "because", 50 to 100 and back, two legs of
  0.9 s (58.17 to 59.07 to 59.97), the bump 59.2 px against the wave's 28.0 (2.12 times; see departure 7); "a change in
  the air moves it" lands on "because" (58.17) and is at full 2.08 s by the anchors (58.47 to 60.55; 2.37 s by its ink
  in the clip, 58.27 to 60.60, `fix-C-01/moves-label-frames.txt`), before 0.6 s (60.07 to 60.67); it and everything
  but the empty frame fade over 0.4 s, linear, gone at 60.95 = D - 0.13 (364.60). Stills: `fix-C-01/pair-60.20.png`,
  `clip-still-56.93.png`, `clip-still-58.47.png`, `clip-still-59.09.png` (the top, thumb at 100), `clip-still-60.53.png`,
  `clip-still-60.95.png`; `fix-C-01/dense/dense-060.30s-30fps.jpg`.
- **198, "No."** (lines 78 to 89, 181 to 192, 257, 290 to 335): an ink strike (3 px world, 3.9 on screen)
  through the guess and its "?" at the x-height's middle, drawn 51.37 to 51.67, held to 52.07; then the guess,
  "steady: ...", "A, any octave", "in the band" with the mint edge, "settled" with its flag, "a comfortable, fixed
  length", the chip and the axis, both brackets and her line clear in turn, 0.05 s apart (52.07 to 52.47; spread 0.40 s),
  each over 0.3 s, linear; all gone at 52.77 when the frame starts to slide. Before: all within 0.2 s (51.37 to 51.77).
  In the clip each is half gone at: the guess 52.233, "steady" 52.300, "A, any octave" 52.367, "in the band" 52.400,
  "settled" 52.467, "a comfortable" 52.500, the chip 52.533, the brackets 52.600, her line 52.600 (30 fps frames,
  `fix-C-01/no-fades-frames.txt`). Stills: `clip-still-51.50.png` (the strike drawing), `clip-still-52.02.png`
  (`fix-C-01/pair-no.png`), `clip-still-52.22.png`, `clip-still-52.47.png`, `clip-still-52.77.png`;
  `fix-C-01/dense/dense-051.90s-30fps.jpg`.
- **199, the marks** (lines 162 to 171, 310 to 327): the vibrato's height as two ink hairlines (1.5 px on screen) at the
  line's outer edges (crest 491.2, trough 548.8 at CU-wave), 240 px long (x 1124.4 to 1364.4) under the label's middle,
  a 10 px tick across each end, 34.2 px from both band edges (before: a 2 px chrome bracket on the wave at x 1500); the
  "stays" bracket from 12 px right of "settled" (x 398) to the plot's end (1688), its line at y 457 and its ticks ending
  16.2 px over the mint edge's top, ink to ink (before: 7 px, from the flag). Stills: `fix-C-01/crop-vibrato-33.95.png`,
  `fix-C-01/pair-35.50.png`, `fix-C-01/crop-stays-42.81.png`, `fix-C-01/pair-stays.png`.
- **200 and 196, the opening** (lines 38 to 45, 256): the stack leaves (up fast, from dim) as the card starts to leave, 1.85
  to 2.15 (was 2.12 to 2.42); the chart fades in at F0 from 2.15 to 2.40, at full before the push at 2.42 (it came up
  with the push before, 40 % at 2.67). The lit share of the frame from 2.23 to 2.60 (hosts excluded, the critic's dense
  window): mean 0.683 % before, 1.099 % after; the emptiest frame 0.033 % before, 0.280 % after
  (`../s09-onset/fix-C-01/opening-fill.txt`). The bokeh's lift is the kit's and is left alone (200). Stills
  `clip-still-1.85.png`, `clip-still-2.15.png`, `clip-still-2.30.png`, `clip-still-2.42.png`
  (`fix-C-01/pair-push-start.png`); `fix-C-01/dense/dense-002.90s-30fps.jpg`.
- **195**: the first frame follows S9's (the easy start under "Together", "LISTEN ONLY" under "A catch").
- Holds after the fixes: 1.7 s inside the film (0.8 s per 30 s), longest 0.2 s (2.3 s and 1.1 s before).

## Fix round F-01 (19 November)

The full-film critic's report is `review/critic-F-01/REPORT.md`; the calls are DECISIONS 226, 227 and 233 (brief
`briefs/l5-fix-F-01.md`, group C). Proof in `fix-F-01/` (before-and-after pairs against the C-01 clip, whose stills
and measure are kept in `fix-F-01/c01-clip/`; contact sheets; dense sheets; `root-check.log`; `joins.txt`). Screen px
at F-hold are `x' = 1.3 x - 288`, `y' = 1.3 y + 10`; at the close-ups `x' = 1.8 x + ox`, `y' = 1.8 y - 200`.

- **226, the hold chart as the lead subject** (`compositions/s10-steady.html` lines 121 to 139, 146 to 148, 168 to 200,
  226 to 230, 260 to 264, 277; the scoop's deep part lines 59, 285 to 299, 317 to 318): the cents scale stays at the 4 s chart's 2.5 world px a cent as the window widens
  (k = 10 / W before, 1.0 at W 10), and Merc's line moves from world y 400 to 358 so that at the close-ups the band
  keeps both edges in frame and its bottom edge clear of the hosts' keep-outs. From the push in (2.42) to "No." (51.31)
  the band stands **227.5 px** at F-hold (91 before), y 361.65 to 589.15, and the plot spans **1456 px** (x 232 to
  1688, unchanged); at CU-scoop and CU-wave the band is 315 px, y 286.9 to 601.9, both edges in frame. The take, its
  scoop and its vibrato grow with it: a cycle 26.5 px and 91 px peak to peak at F-hold (36.4 before), 36.7 and 126
  at the close-ups (50.4 before), ratio 3.44 (the wave rule's 1.375 gives way here, 226); the scoop's low point (-60 c)
  at world y 508, screen 670.4 at F-hold, (360, 714.4) at CU-scoop. Every label re-placed, 12 px or more from every
  stroke at its framing (the probe measures every visible label's ink against every visible stroke at 23 times from
  10b to 10g, the moves included; the nearest is 13.0 px, the axis's "0" over the length bracket):

  | Item | World | Screen at F-hold |
  | ---- | ----- | ---------------- |
  | Band (W 4 and W 10 alike, k 2.5) | y 270.5 to 445.5 | y 361.65 to 589.15 |
  | Merc's line; Tavi's dashed guess (10b) | y 358 | y 475.4 |
  | The guess's "?" (x 1536) | baseline 381 | x 1708.8 to 1750.6, baseline 505.3 |
  | Tavi's -60 c start | y 508 | y 670.4 |
  | Row 1: "A, any octave" (x 400), "in the band" (x 640) | baseline 206 | baseline 277.8; x 232, 544 |
  | "ILLUSTRATION" right-aligned 1520 | centred y 195 | x to 1688, centred y 263.5 |
  | "steady: settles into the band and stays" (x 400) | baseline 163 | baseline 221.9 |
  | Her guess "steady air keeps it there?" (x 400), underline 14 under, strike 10 over | baseline 114 | baseline 158.2; line 176.4; strike 145.2 |
  | "settled" flag (x 478.8, 16 tall on the top edge); its label | y 254.5 to 270.5; baseline 247.5 | x 334.5, y 340.85 to 361.65; baseline 331.75 |
  | The "stays" bracket (line, ticks to) | y 249.4 (255.5), x from 528.6 | y 334.2 (342.2), x 399.3 to 1688 |
  | Time axis: ticks; "0" (left-aligned 400), "4 s" / "10 s" (right-aligned 1520) | ticks y 524 to 532; baseline 550 | ticks y 691.2 to 701.6; baseline 725 |
  | The length bracket (ticks up 10); "a comfortable, fixed length" centred 960 | y 572; baseline 605 | y 753.6; baseline 796.5 (ink to 803) |
  | "scoop" centred x 400 (CU-scoop) | baseline 540 | CU-scoop (360, 772) |
  | "small vibrato: inside the band" x 960 (CU-wave) | baseline 253 | CU-wave (888, 255.4) |
  | The vibrato's hairlines (CU-wave) | y 321 and 395 | CU-wave y 377.8 and 511, x 1124.4 to 1364.4 |
  | The chart's chip at CU-wave | | x 1408.8 to 1896, y 115 to 187 |
  | "SLOWED · ILLUSTRATION", frame-fixed (screen) | | x 1110 to 1563, y 212 to 252 (380 to 420 before) |

  The "stays" bracket now starts 12 px right of "settled" ink to ink (13.7 measured; its tick's half stroke had put it
  at 10.7). The scoop's deep part (her first 0.45 s, under -40 c) is drawn on its own: the truck and the pull carry it
  across Merc's keep-out (at k 2.5 it reaches y 715 at CU), so it fades by its distance to his body box (gone at 20 px,
  full from 44; out in the truck's first 0.4 s, back as the pull lands, `fix-F-01/deep-scoop-truck-pull.png`,
  `fix-F-01/dense/dense-031.20s-10fps.jpg`); every stroke stays 20 px or more from both body boxes at every time
  tested (nearest 29.2). 10h's slide is unchanged in form: from this geometry (k 2.5) into the hold frame at the right
  half, 52.77 to 53.87, the voice box's drawn outline 225 px or more from the band as it draws on; the last frame and
  the cut on `sing` are unchanged (below). Pairs: `fix-F-01/pair-3.97.png` (10b), `pair-19.58.png` (the whole take),
  `pair-25.20.png` and `pair-29.84.png` (CU-scoop), `pair-33.95.png` (CU-wave), `pair-42.81.png`, `pair-44.39.png`,
  `pair-48.93.png` (10f, 10g); `fix-F-01/clip-sheet-1.png` to `clip-sheet-3.png`.
- **233, the type step at 326.93** (lines 160 to 163, 340 to 347): the settled flag's pulse on "settles" scaled the
  whole flag group, its label too; the scale's slow tail stepped the label's type at its end (clip 41.567, jump
  0.05 %). Now the pole and pennant scale 1.2 and "settled" never does: no event there (`fix-F-01/dense/dense-041.59s-30fps.jpg`).
- **The light along the wave on "waves"** (lines 300 to 304, 316): on the taller wave the kit's run light, up in 0.1 s,
  changed 0.15 % of the frame in one frame (a jump at 20.80 in this round's first render); it comes up over 0.3 s now
  (`fix-F-01/dense/dense-020.80s-30fps.jpg`).
- Holds after the fixes: 2.2 s inside the film (1.1 s per 30 s), longest 0.2 s (C-01's clip: 1.7 s, 0.8 per 30 s): no
  hold of 0.3 s or more, inside a word or not (227 asks nothing here).

**F-01 proof**: probe 209 of 209 (`probe.json`; all three in `probe-groupC.log`, 363 of 363). `check lab/s10-steady/proj
--at=3.97,19.58,25.55,31.64,33.95,42.81,48.93,52.02,53.30,59.09`: 0 errors, contrast 25/25, layout one info (the "4 s"
and "10 s" swap, as before); root `check` (`fix-F-01/root-check.log`): passed, 0 errors, contrast 67/67, the same one
info. clock-lint silent; `merc-tags.py s10-steady --check`: 4 tags, 0 stale, 0 problems. `measure.py render`
(`measure/summary.md`): holds above; single-frame events 6.467 and 46.333 (pops, 0.05 %, blinks in the hosts'
squares), 33.300 (jump, 0.03 %, as before); gone: 1.467 (the card, now the kit's layer) and 41.567 (233). Integrated
-20.5 LUFS, true peak -1.6 dBTP. The joins and the cut (`fix-F-01/joins.txt`): S9 to S10 largest change 8 of 255
outside the hosts' squares, no pixel over 24; the matched cut on `sing` (`cutprobe.mjs`): the band x 1000 to 1640,
y 210.01 to 280.01 against 210.00 to 280.00, Merc's line 245.00 on both, best shift (0, 0), residual 1.14; no
single-frame event in `cut/cut-s10-s11.mp4`.

## Proof

(C-01's proof; where F-01 changed a number, § Fix round F-01 above has it.)

- Probe (`probe.json`, `probe-*.png`; checks in `checks.js`; the last run of all three probes in `probe-groupC.log`):
  134 of 134 pass after C-01. The first frame on S9's last; 10a at 25 %; the stack's exit at the card's; the stack gone
  and the chart at 0 at 2.15; the chart, its labels and chip at full at 2.419, the camera still at F0; F-hold, W 4: the
  plot x 232 to 1688, band y 416.3 to 643.8, Merc's line y 530, "A, any octave" from 232 at 387, the chip right-aligned
  1688, the "0" from 232 at 690; the hosts back at 300 in the corners; the guess along y 530 with its "?" at x 1708.8;
  W 10: band 484.5 to 575.5, ticks 145.6 px apart; "in the band" at (544, 387); the guess gone and Merc's line back;
  CU-scoop: band 457 to 583, the scoop's low point at (360, 628); "scoop" at (360, 700); CU-wave: the chip at x 1408.8 to
  1896, "small vibrato" from (888, 416), the hairlines (above); back at F-hold; the steady label at (232, 322); the
  "stays" bracket (above); the bracket under the plot at y 712, its label centred 960, baseline 760; the second guess at
  (232, 257); "No." (above); 10h: the frame x 1000 to 1640, band 210 to 280, Merc's line y 245, 4 px; the voice box x
  300 to 640, y 190 to 510; the slider not yet at 56.38, drawn with its thumb at 50 at 56.93; the silent line's head at
  106.7 px a second; the frame's chip x 1369 to 1640, y 156 to 196; the push's top and the label's full time (above);
  nothing but the empty frame from D - 0.13; no two visible texts overlap at any time tested; keep-out 32.5 px or more;
  the 0.4 s rule 0.40.
- **The settled flag's time (page's rule; DECISIONS 191)**: entry 0.704 s into the take (16 ms readings; a continuous
  crossing gives 0.688, the board 0.69), the flag at 1.204 s (scene 10.679), world x 478.8, screen x 334.5 at F-hold,
  y 464 to 484.5, "settled" baseline 454.6. Stills `probe-11.03.png`, `clip-still-11.03.png`.
- **The wave rule** (k, W 10 on the 1120 px plot): F-hold one cycle 26.52 px, peak to peak 36.4 (ratio 1.37;
  `probe-19.58.png`); CU-scoop and CU-wave 36.72 / 50.4 (`probe-25.20.png`, `probe-32.69.png`); 10h's frame 19.33 px a
  cycle (`probe-60.53.png`).
- **LAB-CHECKS 14** (10d to 10e, `probe-25.55.png`, `probe-31.14.png` to `probe-32.59.png`, `clip-still-25.55.png`,
  `clip-still-31.64.png`): "SLOWED · ILLUSTRATION" frame-fixed at x 1110 to 1563.2, y 380 to 420 at 326.20 + 0.3 and
  at + 0.5, 1.0, 1.5, 1.95 s into the truck; nothing passes under it (nearest the band's top, 37 px); 536.7 px from
  "settled".
- **LAB-CHECKS 2, the matched cut on `sing`** (`cut/`, re-proved after C-01): S10's last frame against the stand-in's
  first: the band x 1000 to 1640, y 210.01 to 280.01 against 210.00 to 280.00; Merc's line at y 245.00 on both; best
  shift (0, 0) for the band (residual 1.79 of 255) and the line (6.84; the softer edge rows under the 1.3x camera,
  accepted in DECISIONS 191). `cut/cut-s10-s11.mp4` (frame 15 is the cut): `cut/measure/summary.md` finds no
  single-frame event.
- **The joins** (`fix-C-01/joins.txt`): S7 to S8 largest change 22 of 255 outside the hosts' squares, S8 to S9 5, S9 to
  S10 8; no pixel over 24 in any.
- Clip: `clip.mp4` (30 fps draft, scratch voice, re-rendered after C-01); stills `clip-still-*.png` at 0, 0.40, 1.85,
  2.15, 2.30, 2.42, 2.67, 3.97, 6.15, 8.93, 10.63, 11.03, 12.03, 19.58, 25.20, 25.55, 29.84, 31.64, 32.69, 33.95, 35.50,
  38.30, 40.62, 41.31, 42.81, 44.39, 48.93, 51.50, 52.02, 52.22, 52.47, 52.77, 53.47, 53.92, 56.93, 58.47, 59.09, 60.20,
  60.53, 60.95, 61.06; `fix-C-01/clip-sheet-0.png`, `fix-C-01/clip-sheet-1.png`; the camera moves at 10 fps in
  `dense-moves/` (3.17 the push, 24.40 the push to CU-scoop, 31.64 the truck, 39.87 the pull).
- `measure.py render` (`measure/summary.md`): holds 1.7 s inside the film (0.8 s per 30 s), longest 0.2 s; single-frame
  events: 1.467 (jump, 0.47 %, the card's breathing in), 6.467 and 46.333 (pops, 0.05 %, in Merc's and Tavi's squares:
  blinks), 33.300 (jump, 0.03 %, no pixel over 16), 41.567 (jump, 0.05 %, "settled" and its flag coming back with the
  pulse). Integrated -20.5 LUFS, true peak -1.6 dBTP (voice only, DECISIONS 194).
- `check lab/s10-steady/proj --at=2.42,33.95,42.81,52.02,52.22,59.09,60.53` (`check.log`): 0 errors; contrast 28/28;
  layout 0 errors, one info (8.24, "4 s" and "10 s" in one place during the swap, as intended). Root `check`: passes,
  0 errors, contrast 72/72, layout 0 errors (the same one info).
- clock-lint silent; `merc-tags.py s10-steady --check`: 4 tags, 0 stale, 0 problems.
