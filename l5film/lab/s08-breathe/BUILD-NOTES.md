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
| 8a | the figure back to full strength (0.25 s, linear), still parked, while the card is up **[C-01: 196]** | `card out - 0.25` | 1.60 to 1.85 |
| 8b | the figure stands up whole (1.2 s, power2.inOut) to `L.FIGURE.S8` (k 0.7 at (830, 140)), starting as the card starts to leave **[C-01: 196]** (2.40 before) | `at('o9', 'start', -0.5)` (the card's exit) | 1.85 to 3.05 |
| 8b | kicker "03 · BREATHING IN" | `at('o9')`; out at `at('b21', 'end')` | 2.35; 11.885 |
| 8b | the legs draw down from the hips (0.55 s, power2.out), the soft edge riding the reveal (v 540 to 570, then + 470) | `stand + 0.65` | 2.50 to 3.05 |
| 8b | the lungs glow (0.25 / 0.4 / 0.6) | `word('o9', 'breathe')` | 3.07 |
| 8c | the back arrow draws heel to crown (0.5 s, x 925, y 830 to 150, 3 px chrome); "tall but easy" with its leader | `word('b21', 'tall')` | 4.53 |
| 8c | the knee softens 2 degrees and back (0.4 / 0.5 / 0.5); "knees unlocked" with its leader to the back of the knee | `word('b21', 'knees')` | 7.51 |
| 8c | the jaw drops 4 px (0.5 s) and stays; a light runs down the neck (0.7 s); "jaw · tongue · neck loose" with its leader to the chin | `word('b21', 'jaw')`; `+ 0.1` | 9.635; 9.735 |
| 8d | "breathe in quietly, low", its leader to the lungs' left edge | `word('b22', 'in')` | 12.93 |
| 8d | the breath in (2.0 s, sine.inOut), held | `word('b22', 'let')` | 14.455 to 16.455 |
| 8d | "diaphragm at work", its leader to the dome's apex | `word('b22', 'drop')` | 15.205 |
| 8d | "shoulders still" and the level mark (0.4 s) | `word('b22', 'shoulders')` | 16.28 |
| 8d | "as much as feels easy" (no leader) | `word('b22', 'taking')` | 17.765 |
| 8d | the breath out to rest (breath 0, the belly wall springing back in; 2.0 s, sine.inOut), held at rest to and across the cut **[C: 191]** (-1 before) | `taking + 0.06` | 17.825 to 19.825 |
| 8d | "Singers breathe in / different ways." (serif 48, x 1110, baselines 720 and 770) | `taking + 0.56` | 18.325 |

The closest two landings are 0.56 s apart ("as much as feels easy", "Singers breathe in different ways.").

## Departures from the board, with numbers

1. **The level mark is 26 px, x 932 to 958, y 289, ticks 5 px** (HANDOFFS: 40 px at y 290). At 40 px its right end
   runs into the neck's back outline at x 967 and its left end comes within 8 px of the arrow; at 26 px it stands
   4.25 px clear of the arrow's stroke (outer edge 926.5) and 6 px from the neck.
2. **"jaw · tongue · neck loose" is set from x 1070**; the j's hook reaches 5 px left of it (ink from 1065). Nothing is
   near it.
3. **The breath ends at rest (breath 0) and is held 0.56 s to the cut** (DECISIONS 191; it ended at -1, the muscles'
   push, before C-01), and S9 starts on that pose (the jaw at 4 px). The board's out-breath (234.30 to 236.30) is
   2.0 s; here `min(2.0, D - out)` gives 2.0.
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

## Fix round C-01 (19 November)

The critic's report is `review/critic-C-01/REPORT.md`; the calls are DECISIONS 191 and 196. Proof in `fix-C-01/`.

- **196, the opening never goes empty** (`compositions/s08-breathe.html` lines 37 to 42 and 142): the stand-up starts
  at the card's exit (1.85, was 2.40) and the figure is at full strength from the move's start (it comes up from 25 %
  over 1.60 to 1.85 while the card is still up and parked, so nothing changes shape under it). The lit share of the
  frame from the card's exit to 3.07 (hosts excluded, the critic's dense window, `fix-C-01/dense/` against
  `review/critic-C-01/d08/`): mean 0.213 % before, 0.653 % after; the emptiest frame 0.033 % before, 0.376 % after
  (`../s09-onset/fix-C-01/opening-fill.txt`). Stills: `fix-C-01/probe-sheet-open.png` (1.27, 1.55, 1.85, 2.15, 2.45,
  3.10), `fix-C-01/clip-sheet.png`, `fix-C-01/pair-opening-3.00.png`.
- **191, the out-breath ends at rest** (line 147): `breath = in - out`, ending at 0 (was `in - 2 out`, ending at -1).
  The last frame's belly front at x 1061.0 (u 330, rest; was 1050.5, u 315). Still: `fix-C-01/pair-rest-19.80.png`.
- Holds after the fixes: 2.6 s inside the film (3.8 s per 30 s), longest 0.4 s, unchanged; they fall in Merc's pauses
  and go to the passes step (DECISIONS 201: the talk cycle at 240 px).

## Fix round F-01 (19 November)

The full-film critic's report is `review/critic-F-01/REPORT.md`; the calls are DECISIONS 227, 229 and 233 (brief
`briefs/l5-fix-F-01.md`, group C). Proof in `fix-F-01/` (the film's frames before, pairs against the C-01 clip whose
stills and measure are kept in `fix-F-01/c01-clip/`, a contact sheet, dense sheets, `joins.txt`).

- **229, the card's "03" and the parked figure** (`compositions/s08-breathe.html` lines 41 to 45, 147): measured on
  every film frame from 209.40 to 210.30 (`fix-F-01/gap-03-per-frame.txt`: the card's ink alone and the figure's ink
  alone, from Chromium seeks), the two never touched: 119 px apart while the figure is parked and brightens (209.50 to
  209.75), closing as the figure starts up under the leaving card to 86 px at 210.00 and 38 px at 210.10, the card's
  last frame (at 11 %). The figure now starts up on power3.inOut (power2.inOut before), same start (the card's exit,
  196) and same landing (3.05): it moves less while the card shows, so the gap is 104 px at 210.00 and 71.4 px at
  210.10, the least on any frame; the probe's font-box measure is 49.3 px or more. Before: the film's frames
  `fix-F-01/before-03-209.4-210.2.png`; after: `fix-F-01/pair-03-2.15.png`, `fix-F-01/dense/dense-002.10s-30fps.jpg`.
- **233, the kicker's exit** (lines 48, 179 to 182): it left over 0.2 s, power2.in (the kit's), measured as a pop at
  film 219.93; now 0.3 s, linear, from `b21`'s end (11.885): half way at 12.035, gone at 12.185
  (`fix-F-01/dense/dense-012.05s-30fps.jpg`). No event there.
- **227, holds inside words** (lines 51, 62 to 65, 171 to 173): the C-01 clip held still 0.4 s at 7.7 to 8.1, inside
  "knees unlocked" (the knee's 2 degrees do not register). "unlocked" names "knees unlocked", so the label takes the
  board's settle on it (7.94): 0.15 s up, 0.6 s back, 1.08 (a 36 px label, as S9's names), about its right end where
  its leader leaves (its right edge stays at 907, 16 px or more from the back arrow), its way back linear so its type
  never steps (233). That hold is 0.2 s now (`clip-still-8.11.png`). Holds after the fixes: 2.6 s inside the film (3.8 s
  per 30 s), longest 0.4 s; of 0.3 s or more: 0.00 (S7's last frame, before `act3`), 5.80 (in the pause after
  "easy." 5.65 to "If" 6.17), 8.80 (0.4 s: in the pause after "unlocked." 8.48 to "Let" 9.05, then 0.15 s into "Let";
  "Let" names nothing and the jaw moves on "jaw", 9.64), 14.00 (in the pause after "quietly," 13.88 to "and" 14.25).
  These are pauses, which 227 leaves to the final passes with the hosts' stillness.

**F-01 proof**: probe 66 of 66 (`probe.json`; all three in `../s10-steady/probe-groupC.log`), new: the card's "03" 12 px
or more from the figure at 1.60 and 0.10 to 0.37 s into the move (49.3 px least), the kicker half way and gone, the
settle at 1.08 about the right end. `check lab/s08-breathe/proj --at=1.85,2.15,8.11,12.03,18.83`: 0 errors, contrast
20/20, layout 0 errors. clock-lint silent; `merc-tags.py s08-breathe --check`: 4 tags, 0 stale, 0 problems. `measure.py
render` (`measure/summary.md`): holds above; single-frame events 6.767 and 11.300 (pops, 0.04 %, blinks in the hosts'
squares); gone: 1.467 and 1.667 (the card, now the kit's layer). Integrated -19.9 LUFS, true peak -2.1 dBTP. The joins
(`fix-F-01/joins.txt`): S7 to S8 largest change 22 of 255 outside the hosts' squares (mean 0.011), S8 to S9 5; no pixel
over 24.

## Proof

(C-01's proof; where F-01 changed a number, § Fix round F-01 above has it.)

- Probe (`probe.json`, `probe-*.png`; checks in `checks.js`, run by `../s05-push/probe.mjs`): 55 of 55 pass after
  C-01 (the opening's three checks added; all three probes in `../s10-steady/probe-groupC.log`). The first frame on S7's last (crown (255, 190), back x 215, 35 %, nothing labelled); the card within 1680 px
  (1091); the S8 pose on HANDOFFS' points (head (991, 199.5), chin (1029.5, 238), throat (1005, 273), shoulder (952.5,
  304.5), lungs (998, 374.5), dome apex (998, 444.5), knee (994.5, 686), soles at 840); the breathed-in belly at x 1082
  and dome apex v 474.25; the shoulder still (952.5, 304.5) at rest and breathed in; every label 8 px or more from the
  other leaders and the arrow (nearest 14.68); no two visible texts overlap; keep-out 480 and 324 px; the last frame
  whole, breathed out to rest (belly 1061.0), the jaw at 4 px, every cue label at full, card and kicker gone.
- **LAB-CHECKS 6** (8c, still `probe-8.11.png` and `clip-still-8.11.png`): "knees unlocked" ink 17.67 px left of the
  back arrow's stroke (16 or more); its font box right-aligned 907; its leader crosses the arrow from (913, 687.4) to
  the back of the knee (976.1, 686.0) and reads as a leader passing.
- **The cut S7 to S8** (`../s07-support/probe-36.39.png` against `probe-0.00.png`, re-proved after C-01): outside the
  hosts' squares (their passes are not seeked in the probe) the largest change is 22 of 255, no pixel over 24. **S8 to
  S9** (`probe-20.38.png` against `../s09-onset/probe-0.00.png`, both at rest now): largest 5, none over 24
  (`../s10-steady/fix-C-01/joins.txt`).
- Clip: `clip.mp4` (30 fps draft, scratch voice, re-rendered after C-01); stills `clip-still-*.png` at 0, 0.40, 1.27
  (the card), 1.55, 1.85 (the move starts, at full), 2.15, 2.45, 3.10, 3.65, 5.13, 8.11, 10.44, 13.33, 16.56, 18.83,
  19.90 (at rest), 20.35; `fix-C-01/clip-sheet.png`. Hosts at 240 on every still.
- `measure.py render` (`measure/summary.md`): holds 2.6 s inside the film (3.8 s per 30 s), longest 0.4 s; single-frame
  events: 1.467 (jump, 0.54 %, the card's breathing in), 1.667 (jump, 0.06 %), 6.767 and 11.300 (pops, 0.04 %, in the
  hosts' squares: blinks). Integrated -19.9 LUFS, true peak -2.1 dBTP (voice only, DECISIONS 194).
- `check lab/s08-breathe/proj --at=1.85,2.15,3.10,8.11,18.83,20.35` (`check.log`): 0 errors; contrast 17/17; layout 0
  issues. Root `check`: passes, 0 errors (warnings only: the kit's duplicated host video entry, file sizes).
- clock-lint silent; `merc-tags.py s08-breathe --check`: 4 tags, 0 stale, 0 problems.
