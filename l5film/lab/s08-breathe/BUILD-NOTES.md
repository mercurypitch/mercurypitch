# s08-breathe: build notes (group C)

`compositions/s08-breathe.html`, 20.385 s on the scratch clock (film 207.885 to 228.270: from the cut 0.15 s before
`act3` to the cut 0.15 s before `act4`). STORYBOARD 8a to 8d; HANDOFFS § The breath figure (S8), § The cuts S7 to S8
and S8 to S9. F0 throughout, no camera move: the stand-up is an object move. Hosts at 240 (m-blue-s08, m-orange-s08,
small chunks), idle.

## Rows and anchors (scene time; the scratch clock)

| Row | What | Anchor | Scratch |
| --- | --- | --- | --- |
| 8a | the parked figure (S7's last frame: k 0.5 at (140, 180), 35 %) dims to 25 % (0.2 s, linear) | `at('act3')` | 0.15 to 0.35 |
| 8a | card "03 Breathing in" in (0.85 s, expo.out), leaving up fast (0.38 s) | `act3 + 0.22`; `at('o9', 'start', -0.5)` | 0.37; 1.85 to 2.23 |
| 8b | kicker "03 · BREATHING IN" | `at('o9')`; out at `at('b21', 'end')` | 2.35; 11.885 |
| 8b | the figure back to full (0.6 s, linear) and standing up whole (1.2 s, power2.inOut) to `L.FIGURE.S8` (k 0.7 at (830, 140)) | `o9 + 0.05` | 2.40 to 3.60 |
| 8b | the legs draw down from the hips (0.55 s, power2.out), the soft edge riding the reveal (v 540 to 570, then + 470) | `stand + 0.65` | 3.05 to 3.60 |
| 8b | the lungs glow (0.25 / 0.4 / 0.6) | `word('o9', 'breathe')` | 3.07 |
| 8c | the back arrow draws heel to crown (0.5 s, x 925, y 830 to 150, 3 px chrome); "tall but easy" with its leader | `word('b21', 'tall')` | 4.53 |
| 8c | the knee softens 2 degrees and back (0.4 / 0.5 / 0.5); "knees unlocked" with its leader to the back of the knee | `word('b21', 'knees')` | 7.51 |
| 8c | the jaw drops 4 px (0.5 s) and stays; a light runs down the neck (0.7 s); "jaw · tongue · neck loose" with its leader to the chin | `word('b21', 'jaw')`; `+ 0.1` | 9.635; 9.735 |
| 8d | "breathe in quietly, low", its leader to the lungs' left edge | `word('b22', 'in')` | 12.93 |
| 8d | the breath in (2.0 s, sine.inOut), held | `word('b22', 'let')` | 14.455 to 16.455 |
| 8d | "diaphragm at work", its leader to the dome's apex | `word('b22', 'drop')` | 15.205 |
| 8d | "shoulders still" and the level mark (0.4 s) | `word('b22', 'shoulders')` | 16.28 |
| 8d | "as much as feels easy" (no leader) | `word('b22', 'taking')` | 17.765 |
| 8d | the breath out, past rest to -1 (the belly and rib muscles' push; 2.0 s, sine.inOut), held to the cut | `taking + 0.06` | 17.825 to 19.825 |
| 8d | "Singers breathe in / different ways." (serif 48, x 1110, baselines 720 and 770) | `taking + 0.56` | 18.325 |

The closest two landings are 0.56 s apart ("as much as feels easy", "Singers breathe in different ways.").

## Departures from the board, with numbers

1. **The level mark is 26 px, x 932 to 958, y 289, ticks 5 px** (HANDOFFS: 40 px at y 290). At 40 px its right end
   runs into the neck's back outline at x 967 and its left end comes within 8 px of the arrow; at 26 px it stands
   4.25 px clear of the arrow's stroke (outer edge 926.5) and 6 px from the neck.
2. **"jaw · tongue · neck loose" is set from x 1070**; the j's hook reaches 5 px left of it (ink from 1065). Nothing is
   near it.
3. **The breath ends at -1 and is held 0.56 s to the cut**, and S9 starts on that pose (the out-breath, the jaw at 4
   px). The board's out-breath (234.30 to 236.30) is 2.0 s; here `min(2.0, D - out)` gives 2.0.
4. **The two-line serif label is two labels 50 px apart**, marked `data-layout-allow-overlap` (their font boxes overlap;
   the ink does not).
5. **Holds run 3.8 s per 30 s** (target about 1 s; longest 0.4 s). 8c and 8d are static frames where the figure's own
   breath and the cue landings are the only motion, as the board asks ("the figure's own breath is the motion").

## Built locally (the kit might offer)

- The parked-to-whole stand-up as one interpolation of `L.FIGURE.S7` to `L.FIGURE.S8` (k, x0, y0), with the parked
  figure's soft leg mask carried down with the legs' reveal.
- Leaders computed from the figure's current pose (the lungs' outline's left edge at a height, the dome's apex, the
  back of the knee, the chin), so they follow the breath, the knee and the jaw. The cue block (labels, arrow, level
  mark, leaders) is copied into s09-onset for its first frame; a kit `L.FIGURE.S8_CUES` would keep the two in step.

## Proof

- Probe (`probe.json`, `probe-*.png`, `probe-sheet.png`; checks in `checks.js`, run by `../s05-push/probe.mjs`): 52 of
  52 pass. The first frame on S7's last (crown (255, 190), back x 215, 35 %, nothing labelled); the card within 1680 px
  (1091); the S8 pose on HANDOFFS' points (head (991, 199.5), chin (1029.5, 238), throat (1005, 273), shoulder (952.5,
  304.5), lungs (998, 374.5), dome apex (998, 444.5), knee (994.5, 686), soles at 840); the breathed-in belly at x 1082
  and dome apex v 474.25; the shoulder still (952.5, 304.5) at rest and breathed in; every label 8 px or more from the
  other leaders and the arrow (nearest 14.68); no two visible texts overlap; keep-out 480 and 324 px; the last frame
  whole, breathed out, the jaw at 4 px, every cue label at full, card and kicker gone.
- **LAB-CHECKS 6** (8c, still `probe-8.11.png` and `clip-still-8.11.png`): "knees unlocked" ink 17.67 px left of the
  back arrow's stroke (16 or more); its font box right-aligned 907; its leader crosses the arrow from (913, 687.4) to
  the back of the knee (976.1, 686.0) and reads as a leader passing.
- **The cut S7 to S8** (`../s07-support/probe-36.39.png` against `probe-0.00.png`): outside the hosts' squares (their
  passes are not seeked in the probe) the largest change is 22 of 255, no pixel over 24. **S8 to S9**
  (`probe-20.38.png` against `../s09-onset/probe-0.00.png`): largest 5, none over 24.
- Clip: `clip.mp4` (30 fps draft, scratch voice); stills `clip-still-*.png` at 0, 0.40, 1.27 (the card), 3.00
  (mid-stand), 3.65, 5.13, 8.11, 10.44, 13.33, 16.56, 18.83, 20.35; `clip-sheet.png`. Hosts at 240 on every still.
- `measure.py render` (`measure/summary.md`): holds 2.6 s inside the film (3.8 s per 30 s), longest 0.4 s; single-frame
  events: 1.467 (jump, 0.54 %, the card's breathing in), 1.667 (jump, 0.06 %), 6.767 and 11.300 (pops, 0.04 %, in the
  hosts' squares: blinks). Integrated -19.9 LUFS, true peak -2.1 dBTP. `dense/dense-001.57s-30fps.jpg` covers the card.
- `check lab/s08-breathe/proj` (`check.log`): 0 errors; contrast 31/31; layout 0 errors. Root `check`: passes, 0 errors
  (warnings only: the kit's duplicated host video entry).
- clock-lint silent; `merc-tags.py s08-breathe --check`: 4 tags, 0 stale, 0 problems.
