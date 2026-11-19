# s01-cold-open: build notes (group A)

`compositions/s01-cold-open.html`, 38.81 s on the scratch clock (film 0 to `title`). STORYBOARD 1a to 1h; HANDOFFS
§ The band chart, § The wave rule, § Framings (F-cold, F-cold end, F-hook, F-bead), § Camera moves, § Carried (the
hook's frame), § The cuts S1 to S2. LAB-CHECKS 1, 7 and 9 (and 18's 1a and 1e).

## Fix round F-01 (DECISIONS 229, 230, 233; 227)

The full-film critic's items for the cold open. Times are film times (scene time here). Proof under `fix-F-01/`.

| Item | Before (film-draft-01) | Now |
| ---- | ---------------------- | --- |
| 230, the guess reads | the easy take dimmed to 50 % from the guess (8.26) only to o1's end, back to full over 9.06 to 9.56; the dash 3 world px (2.7 on screen) | `easyDim = 0.5 * P(t, GUESS, 0.3) * (1 - guessOut)` (line 213): 0.500 on every frame from 8.33 to the ghost (21.03); take and ghost together at most 0.5 to the reveal (26.22); back with Merc's line as the guess leaves (`higher` + 0.06, 0.5 s). `guess.path` stroke 4 / scale (line 259): 3.995 to 4.005 px on screen over its 537 frames. `fix-F-01/crop-9.60-guess.png` (before: `review/critic-F-01/crops/c009.6-guess.png`) |
| 229, '"support"' clear of the band | the fill rode the pull at full to 32.65 and faded to 33.65, under the word from its landing (32.07) | `bandA = 1 - P(t, BAND_OUT, BAND_D)` (line 201): the fill leaves with its edges and the label row (`BAND_OUT` = min(told + 0.3, support - 0.45), 0.4 s), as the board's 1g has it; the band's last frame 31.933, the word's first 32.067, no frame with both over the 62 swept (31.60 to 33.63). "A3" still rides the pull. `fix-F-01/crop-32.60-support.png` (before: `c032.6-support.png`) |
| 233, type stepping a pixel | measure.py jumps at 6.267, 10.800, 13.933, 17.800, 17.867, 19.733, 24.267, 27.867, 33.033 (0.03 to 0.64 % of pixels) | the chart's labels group (every label, both chips) in a composited layer (`floatLayer`, line 116; `will-change: transform`) over the mid layer, its CSS matrix the camera's mid matrix to 1/1000 px each frame (line 192); the bead back in the chart (line 143); '"support"' in its own composited layer, its ease a CSS translate (line 289). measure.py on the new clip: none of the nine. Left: 9.233 pop, 28.100 pop, 29.267 jump, 36.733 pop, all inside Merc's body (x 0 to 400, y 500 to 800, the pass) |
| 227, holds inside words | longest 0.3 s at 34.10 | longest 0.2 s at 34.20, in the pause between "note." (33.80) and "If" (34.43); no hold of 0.3 s, so nothing to settle |

- Probe: 85 lines, all pass; new: the guess (every frame of its showing, the dash), the band against '"support"' (every frame 31.60 to 33.63), the two composited layers (at 10.41 and 31.84, and '"support"' mid-ease); `pull50` and `pull80` now want the fill at 0.
- Clip `clip.mp4` (scratch voice mix), stills `fix-F-01/still-{6.27,9.60,17.80,26.20,32.60,33.03,34.25}.png`; `fix-F-01/measure/summary.md`: holds 1.0 s (0.8 s per 30 s), longest 0.2 s; four events, the host's. `check lab/s01-cold-open/proj --at=6.3,9.6,17.8,26.2,32.6,34.3`: layout 0, contrast 34/34.
- Join S1 to S2 (the bead's field): S1's last clip frame against S2's first, mean abs difference 0.26 of 255, 0 % of pixels over 24 (largest 5); the probe has the field at (960, 540), r 1500, opaque on both sides.
- Chrome keeps a composited layer's raster scale from its first raster (a lab test: a layer rastered at 1.0 and shown at 1.4 is a little softer than one rastered at 1.4). The labels' layer is rastered at 0.90 to 0.85 and only shrinks after (the pull to 0.71), so it never enlarges a raster.
- HANDOFFS should carry: S1's band fill leaves with its edges and the label row (`BAND_OUT`, 0.4 s), no longer riding the pull; the easy take at 50 % from `holds` (0.3 s) until the guess leaves (`higher` + 0.06, 0.5 s sine.inOut); the guess's dash 4 px on screen at every framing.


## Leftovers round (DECISIONS 178): Merc's amber line through the softening bead

| Item | Before (round 3) | Now |
| ---- | ---------------- | --- |
| Change | `const hookOut = soft`: the line faded with the disc's defocus, r 300 to 1200 (38.27 to 38.67) | `const hookOut = P(t, HOOK + 0.35, 0.3, 'none')` (`compositions/s01-cold-open.html` line 200): linear over 0.3 s, `hook` + 0.35 to + 0.65 (37.96 to 38.26), keyed off `L.at('hook')`; the unused `soft` removed |
| The line's opacity on frames where the disc has softened (probe) | 0.995 to 0.094 (38.27 to 38.63) | 0 on every one; 1 at hook + 0.35, 0 at hook + 0.65 |
| Amber inside the disc, every frame hook + 0.5 to the cut (`leftovers/amber_in_disc.py`) | the line: 148 to 2538 px a frame, 38.30 to 38.47; its warm tint: 60 to 4136 px, 38.27 to 38.53 | 0 and 0 on all 21 frames (`amber-after.json`) |
| measure.py, the pass | peak mean change 13.54 at 38.30, no event | 13.53 at 38.30, no event; nothing in the line's fade (37.96 to 38.26) |
| measure.py, the clip | holds 0.9 s (longest 0.3 s at 34.10); pops 28.10, 36.73 | the same; -19.9 LUFS integrated, LRA 4.5 LU, true peak -3.3 dBTP |
| S1 to S2 | 0.26 of 255, no pixel over 24 | 0.26 of 255, no pixel over 24; S1's last frame within 4 of round 3's (mean 0.14) |
| The bead's flight (s02's probe) | 50 lines pass | 50 lines pass (s02 untouched: last frame bead (487.78, 395.77) r 17.76) |
| Probe | 75 lines | 78 lines (three for 178), all pass |
| `check` (root) | 0 errors | 0 errors (23 warnings, one from s01: its `-refl` tags' shared source, as before); contrast 67/67; one layout note, in another group's scene (293.54) |

Stills: `leftovers/line-before-after.png` (round 3 above, now below, hook + 0.66 to + 0.99);
`leftovers/softening-sheet.png` (every frame, hook + 0.52 to the cut). Round 3's clip, stills and measure:
`round3/`; its clip again as `leftovers/clip-before.mp4`.

## Fix round (critic A-01, DECISIONS 170, 171, 173 and 177)

Rows below this section that give the guess's 50 %, the band's fade at 31.60, the hook's exits and the pass into
the bead are superseded by it. The `HOOK_FORM` switch is gone (the critic's form ships; round 1's board form is in
`clip-board-form.mp4`).

- **170, the guess.** Merc's line fades to 0 as the guess draws ("holds", 8.005 to 8.505, on the draw's own
  progress) and returns with the guess's exit on "higher." (26.22 to 26.72, 0.5 s sine.inOut: over 0.3 s the line's
  middle frames read as a measure.py pop at 26.37). The easy take dims to 50 % from "holds" (0.3 s) and comes back as
  o1 ends (9.06, 0.5 s), after the "?" has landed (8.71). The guess's head: an ink-2 dot r 7 world with a 14 px halo
  at 18 % (the takes' head-dot size), on the drawing end, fading as the "?" lands. Probe: at 8.26 Merc's line 0.50,
  the easy take 0.51, the head at full on the drawing end (1023.2, 404.9), r 6.3 on screen; at 8.61 0.00 / 0.50 /
  0.13; at 9.66 the easy take 1.00, the head gone; at 26.86 Merc's line 1.00, the guess gone. Stills
  `clip-still-8.25.png`, `-8.60`, `-9.70`; the chart cropped at those three `guess-crops.png`; frames 7.95 to 9.0
  `guess-sheet.png`.
- **173, the pull.** The band's fill and "A3" ride the pull and fade over its last third (32.65 to 33.65); its edge
  lines (the kit's band group draws them with the fill; set here after each `ch.draw`) fade with the label row and
  chip, 31.60 to 32.00, before '"support"' lands (32.05). Probe: over the 203 frames from the word's landing to the
  cut no line under it (the band's edges, the takes, the strip, the arrow and the guess all at 0); at 50 % of the
  pull the fill and "A3" at full, at 80 % the fill 0.74 and "A3" 0.88. The word over the fill, every frame
  (`contrast-sweep.mjs` and `contrast_sweep.py`, the check tool's method, `contrast-support.json`): worst 15.25:1 at
  rest (32.20), the brightest 5 % of the pixels behind its glyphs never under 9.95:1. The fill's top boundary runs
  through the descenders of "pp" at 32.05 to 32.2: a step of tone, not a line. Stills `clip-still-32.15.png` (50 %),
  `-33.05` (80 %), with 32.05 and 34.15 in `pull-sheet.png`.
- **171, the hook's exits and the pass into the bead.** The two lines leave up fast at hook + 0.04 to + 0.24 (37.65
  to 37.85; probe: both at 0 by then); the hosts slide 360 px out over hook + 0.00 to + 0.45 (37.61 to 38.06, power2.in;
  probe: Merc's body box ends at x -18.7, Tavi's starts at 1938.7). The approach, hook + 0.34 to + 1.04 (37.95 to
  38.65): the bead in its screen layer from r 22 to r 1200 in log scale, its time per step of ln r a base rate plus
  the share of the frame the step covers plus an ease from rest (`W_LOG`, `W_COVER`, `W_EASE`, scaled to 0.7 s), so
  the change is spread over the whole approach; the camera's scale on the same log curve to F-bead, the bead's place
  eased to the centre with it. Crisp to r 300 (the first frame with any blur is at r 338.7), 60 px of blur by r 900,
  dimmed to 62 % while still small (r 250 to 500), so the frame then brightens only as the disc covers it; the field
  comes up over the disc over the last 0.25 s (the disc stays whole under it: crossfading both over the dark room
  dipped the frame), then breathes to the cut. Probe: r 24.1 on the approach's first frame, 1200 after it; growth
  1.25x to 1.45x a frame while r < 300. measure.py: no event in the pass; the largest mean change 13.5 a frame at
  38.30; luma 22 to 114 (`pass-sheet.json`). Sheet over hook + 0.3 to + 1.1: `pass-sheet.png`. Tuned before
  rendering with `approach-sim.mjs` and `approach_metrics.py` (the harness's frames measured as measure.py measures
  a clip). HANDOFFS' lines for these times and places are edited, marked **[A-01: 171]**.
- **177, sound.** The round 2 clip had no audio stream: `tools/lab.mjs` takes `assets/audio/<MIX>.wav`, `full` by
  default, and only `voice.wav` exists. Every clip this round is rendered with `MIX=voice` and carries the scratch
  voice (s01 to s04: video and audio streams).
- **Hosts** (the passes re-rendered, `merc/PASSES.md`; m01-blue 23:02, m01-orange 23:12): placed, mirrored and
  reflected as before at every still; the slide-out clears the frame by hook + 0.45.
- Clip `clip.mp4`; stills `clip-still-*.png` (0, 1.4, 8.25, 8.6, 9.7, 19.9, 24.73, 26.7, 30.45, 32.05, 32.15, 33.05,
  34.15, 36.9, 37.85, 38.8); the check at 2x `check-26.70.png`. measure.py: holds 0.9 s (0.7 s per 30 s), the longest
  0.3 s at 34.10 (the hook frame after the bead has faded in, the hosts idling; round 2 had 0.1 s there); pops at
  28.10 and 36.73 (0.14 and 0.11 mean change, the hosts, as round 2); no final hold. Probe: 75 lines, all pass.
  Round 2's clip, stills and measure: `round2/`.

## Rows and anchors (scene time = film time)

| Row | What | Anchor | Scratch time |
| --- | --- | --- | --- |
| 1a | frame 0 finished: the chart at F-cold, band and Merc's line, "A3", the label row and "ILLUSTRATION", the strip's hairline, "level", the kicker; both hosts at 420 with key glows | 0 | 0 |
| 1a | the drift F-cold to F-cold end (power1.inOut) | 0 to `at('o2')` | 0 to 30.50 |
| 1a | the easy take draws as it sounds (line, head dot, strip) | `t - at('easy')` (L.CONTOUR.easy) | 0.60 to 4.60 |
| 1a | mint edge and "in the band" (its centre in the band) | `at('easy') + 0.25` | 0.85 |
| 1a | "sung easily" (0.45 s after) | `at('easy') + 0.7` | 1.30 |
| 1a | head dot fades; kicker leaves | `at('easy', 'end')`; its 0.2 s before | 4.60; 4.40 |
| 1b | the strip's outline brightens (accent) | `word('o1', 'push')` | 5.61 |
| 1b | echo ring at the line's end | `word('o1', 'harder')` | 6.66 |
| 1b | Tavi's guess draws (0.5 s), its "?" at the end; Merc's line to 50 % | `word('o1', 'holds')` | 8.01, 8.51 |
| 1c | a light runs along the easy line (0.6 s) | `word('b1', 'same')` | 10.89 |
| 1c | the "?" pulses 1.2 (about its left baseline) | `word('b1', 'harder')`, `'harder#2'` | 11.94, 12.56 |
| 1c | pill 1, pill 2 (each a 1.08 pulse as it lands) | `word('b1', 'settle')`, `word('b1', 'louder')` | 14.59, 16.94 |
| 1d | ring timer over the predict; the "?" breathes | `at('predict')`, its length | 18.86 to 20.86 |
| 1d | easy line to a 35 % ghost, its envelope to an outline (0.4 s) | `at('predict', 'end', 0.17)` | 21.03 |
| 1e | "LISTEN ONLY"; the pushed take draws over the ghost | `at('pushed')` | 21.21 |
| 1e | band edge dark, "in the band" leaves (its centre out, FACTS 80) | `at('pushed') + 2.75` | 23.96 |
| 1e | "above the band" (the whole line above) | `at('pushed') + 3.45` | 24.66 |
| 1f | the swollen part of the strip lit to 40 % and back; "louder · higher" | `word('b3', 'louder')` | 25.43 |
| 1f | the climb glows; the second pill's tick (0.3 s); the first pill's stroke dims; the guess and "?" fade, Merc's line back to full | `word('b3', 'higher')` (+ 0.06 for the guess) | 26.16 |
| 1f | the small type | `word('b3', 'pushing')` | 27.11 |
| 1f | the arrow draws (0.5 s) | `word('b3', 'moves')` | 29.41 |
| 1g | pills, "louder · higher", arrow, small type, "above the band", "LISTEN ONLY" leave up fast in turn (0.09 s apart) | `at('o2', 'start', 0.05)` | 30.55 to 30.99 |
| 1g | the pull F-cold end to F-hook (sine.inOut, 3.0 s) | `at('o2', 'start', 0.15)` | 30.65 to 33.65 |
| 1g | the takes, ghost, strip, "sung easily", "level" fade (0.5 s) | `word('o2', 'told', 'start', -0.03)` | 31.47 |
| 1g | the band, "A3", the label row and its chip fade (0.4 s) | `min(told + 0.3, support - 0.45)` | 31.60 |
| 1g | '"support"' lands at baseline 406, eases to 420 by the pull's end (sine.inOut) | `word('o2', 'support')` | 32.05 to 33.65 |
| 1g | the head bead fades in at (560, 520), r 22 | the pull's end, 0.4 s | 33.65 |
| 1g | "what keeps it steady?" | `word('o2', 'what')` | 36.32 |
| 1g | the bead pulses 1.2, one echo ring, the line's glow brightens | `word('o2', 'steady')` | 37.05 |
| 1h | hosts slide 360 px outward (power2.in, 0.6 s); the floor fades with them | `at('hook') + 0.21` | 37.82 to 38.42 |
| 1h | the two lines leave up fast | `at('hook') + 0.46` | 38.07 |
| 1h | through the head bead, F-hook to F-bead (power3.in, 0.55 s) | `at('hook') + 0.41` | 38.02 to 38.57 |
| 1h | the glow grows round the bead to the full-frame field; the amber line fades under it (0.3 s) | `at('hook') + 0.51` | 38.12 to 38.57 |
| 1h | the field holds, breathing 2 % with its grain (`L.field`), to the cut | | 38.57 to 38.81 |

## The check in 1f (DECISIONS 166)

The check sits **right of the second pill**, in the place the predict's ring timer held (gone since 21.13): the kit's
check (22 px, 4 px ink stroke, its path -11 to 12 and round caps 2 px past) centred at x 1456 (`TICK_X`), so its ink
runs x 1443 to 1470, 12.0 px clear of the second capsule's outer stroke (1430 + 1), centred y 108. It draws on over
0.3 s from "higher." (26.16) as before; the first pill's stroke dims to 28 % and the second's brightens to ink at
100 %. No capsule changes width. Its first place (round 1: against the second capsule's left end, in the 40 px gap,
0.5 px from one capsule and 12.5 px from the other) read as either pill's, so the lead moved it (`tick-26.66.png`
is that first place, kept). Now: `check-26.70.png` (crop, 3x) and `clip-still-26.70.png` (the full frame).

The chips under it ride the drift: over the check's 140 frames (26.19 to 30.83, wherever the chip is on screen)
its ink keeps 27.4 px from "ILLUSTRATION" (nearest at 29.99) and 33.8 px from "LISTEN ONLY" (nearest at 26.19).

## LAB-CHECKS 1: the pass into the bead, two forms (for the lead)

`const HOOK_FORM = 'critic'` at the top of the scene: **the lead chose the critic's form** (DECISIONS 164), so the
bead keeps its identity into the title. Both forms stay built ('board' builds the other); the round 1 sheets of both
are kept as they were. The shipped form from the new clip: `hook-sheet-critic-clip.png` (38.30 to 38.65).

- **Board's form** (`hook-sheet-board.png`, frames `hook-board/`): F-bead 2.2x, the bead's glow (`L.field`) grows
  round its centre from 0.1 s into the push to fill the frame at the push's end.
- **Critic's form** (`hook-sheet-critic.png`, frames `hook-critic/`): the room still capped at 2.2x; the bead's own
  layer grows on until the disc is r 1150 (2300 px across, wider than the frame at the push's end), defocusing
  (blur to 60 px), dimmed to 55 % so it never flashes, and its light settles into the same field over the last
  0.15 s.
- Each sheet: 26 frames at 1/30 s from 0.1 s before the push to 0.18 s before the cut, stamped with scene time,
  the push's time, the frame's mean luma (L) and its edge detail (E: mean absolute Laplacian at 480 px wide).
  Numbers in `hook-sheets.json` (`python3 -I hook_sheet.py` rebuilds them). Frame-exact sheet from the clip:
  `measure/dense/dense-038.30s-30fps.jpg`, and the 1 s one `dense-038.30s-15fps.jpg`.
- Both pass the line: edge detail falls from 6.6 to 1.5 (board) and 1.8 (critic) by push + 0.40 and to 0.9 (the
  field's grain, its floor) by push + 0.57; nothing blooms sideways (the amber line fades under the glow from
  push + 0.10 to + 0.40); the field holds at luma 114.6 to 115.8 to the cut (Lesson 2: 113 to 122). The board's
  form fills the frame with the glow (the disc never exceeds 2.2 x 30.8 = 68 px); the critic's with the disc
  itself, whose rim and highlight smear out as it nears (luma 43 at push + 0.43, 84 at + 0.50, 113 at + 0.57).
- **Lesson 2's 24.20 to 25.55 frames are not in its study** (`l4film/study/lesson-02/NOTES.md` holds its numbers in
  words only: a 0.75 s accelerating approach from about 270 px across to wider than the frame, edge detail 5.9 to
  0.0 by 24.90, the field 113 to 122, held 0.2 to 0.35 s; its video is not on this machine). So the sheets sit beside
  those numbers, not its frames. Here the approach is the board's 0.55 s from a 44 px bead (power3.in, GSAP's
  quartic: the bead is still about 52 px across at push + 0.30), and the field holds 0.24 s.

## Proof

- Clip (round 2, the critic's form and the check right of the second pill): `clip.mp4` (30 fps draft, the whole
  scene, with the scratch voice). Clip stills with both hosts: `clip-still-*.png` (0, 1.4, 8.9, 19.9, 21.5, 24.73,
  26.7, 30.0, 30.45, 32.05, 34.15, 36.9, 38.3, 38.57, 38.8); the check at 3x: `check-26.70.png`; the pass into the
  bead frame by frame, 38.30 to 38.63: `hook-sheet-critic-clip.png` (numbers in `hook-sheet-critic-clip.json`; the
  frames in `hook-critic-clip/`). Round 1 (the board's form, the check in the gap) is kept: `clip-board-form.mp4`,
  `stills-board-form/`, `measure-board-form/`.
- Snapshot stills: `still-*.png` (round 1).
- measure.py (`measure/summary.md`, round 2): holds 0.7 s in 38.8 s (0.5 s per 30 s), seven 0.1 s samples, none
  longer; no final hold. Low-motion runs (up to 3.3 s at 27.2, while Merc talks b3 and the small type and arrow
  land) all "small element moving". Single-frame events: jumps and pops of 0.05 to 0.6 % of pixels to 36.73, the
  hosts' blinks and state changes (frame-exact sheets in `measure-board-form/dense/`, the same frames). One new
  flag: **a pop at 38.467**, the critic form's fastest frame. Its disc roughly doubles across 38.433 to 38.500 as the
  quartic push nears its end, so 42 % and 37 % of pixels change by more than 24 in those two
  frames against 12 % and 11 % either side. measure.py's rule (two changes in a row three times their neighbours)
  calls that a pop. The frame-exact sheet `measure/dense/dense-038.30s-30fps.jpg` shows one continuous defocus, no
  flash or missing frame; luma climbs 42, 65, 83, 95, 111. The board's form spread the same change over three
  frames (0.37, 0.49, 0.33) and was not flagged.
- `check lab/s01-cold-open/proj --at=1.5,9,20,26.7,30`: layout 0 issues, contrast 44/44 (LAB-CHECKS 18: "in the
  band" and "sung easily" by the amber fill, the labels by the violet strip). `--at=31.8,32.05,32.2,33,36.9`:
  contrast 9/9; one info, "sung easily" (fading) inside the transparent square of Tavi's video at 31.8; her body
  box is 69 px below it.
- clock-lint silent; `merc-tags.py s01-cold-open --check`: 0 stale. Root `check` (round 2, `root-check.log`): 0 errors,
  layout 0 issues bar one info in s06 (152.1 s), contrast 31/31.
- Probe (`probe.mjs` here, `probe.json`; run `$S/bin/heavy node lab/s01-cold-open/probe.mjs s01-cold-open`), 61
  lines, every one passes:
  - F-cold at 0: plot x 456 to 1464, Merc's line y 405, "A3" right edge 425.4, "level" from 456, baseline 745.2;
    frame 0's chart, row, chip, "A3", "level" at full.
  - The wave rule at F-cold: one cycle 45.9 px, peak to peak 63.1 px on screen, ratio 1.37.
  - LAB-CHECKS 9 (24.73 = board 25.00, and 30.445 = the drift's end): "ILLUSTRATION" to "LISTEN ONLY" 14.7 px;
    "LISTEN ONLY" at x 1489 to 1719, y 147 to 184; the chip 12.4 px under the second pill at the drift's end.
    F-cold end: plot x 444.8 to 1475.2, line y 404.
  - The check (26.66, DECISIONS 166): its ink x 1443.0 to 1470.0, 12.0 px clear of the second capsule's outer stroke,
    centred y 108.0; the first pill's stroke 0.28, the second's 1.0. Swept every frame of its life (140 frames,
    26.19 to 30.83): 27.4 px from "ILLUSTRATION" at its nearest (29.99), 33.8 px from "LISTEN ONLY" (26.19).
  - LAB-CHECKS 7 (real Instrument Serif descenders): '"support"' clears the top of Merc's line's stroke by 15.1 px
    as it lands (32.05), 26.7 px 0.2 s later, 65 px at the pull's end, where it sits on baseline 420.0; its ease
    moves it 14 px over 1.6 s (0.23 px a 60 fps frame at most).
  - F-hook (34.15 and 37.35): the long note x 560 to 1360 at y 520, 4.0 px on screen; the head bead centred
    (560.0, 520.0), r 22.0; '"support"' 160 px at (960, 420), "what keeps it steady?" 96 px at (960, 680): Lesson 4's
    S15 frame (DECISIONS 156's geometry).
  - F-bead (38.57): the bead at (960, 540), r 67.8; the field r 1500.
  - Last frame: the field at (960, 540), r 1500, opaque (s02's first frame).
  - Keep-out: 93 px or more from either host's body box at every sampled time.

## Handoffs

- **S1 to S2**: the same full-frame field both sides; clip frames across the cut differ by 0.30 of 255 (no pixel
  over 24), luma 114.8 both.

## Departures from the board, with numbers

The lead accepted 1 and 2 as built (DECISIONS 165).

1. **The band group leaves before '"support"' lands.** The board fades the band, "A3" and the label row 32.50 to
   33.00 and lands '"support"' at 32.87, over their place, while they are still leaving (`check`, 32.2 s, flagged
   the row under the word). They now fade over 0.4 s from the earlier of ("told" + 0.3) and ('"support"' - 0.45):
   31.60 to 32.00 here, the word landing at 32.05.
2. **The arrow (1f)** runs 55 px above the line's centre (the wave's crests are 35 px, so 20 px clear all the way)
   from over the last in-band point (x 1170) to over the line's end (x 1520), bowing 15 px higher at its middle.
   HANDOFFS' endpoints sit on the line's centre, which its crests cross, so an arrow starting there cannot also
   stay 20 px clear of it.
3. **The hook's long note** is drawn 4 px on screen at every framing (`merc.w = 4 / scale`), as DECISIONS 156 sets
   it for F-hook.

## Hosts

m01-blue and m01-orange (rendered 20:30 and 20:38) at the cold place, 420, key glows, sliding out on the board's
curve; the scene shows what the passes do (they idle through the takes, listen and talk). measure.py's "jumps"
and "pops" (0.05 to 0.6 % of pixels) are their blinks and state changes (the dense sheets at 22.9 and 33.03).
Re-check the host stills once `merc/PASSES.md` says the re-render is done (it does not yet).
