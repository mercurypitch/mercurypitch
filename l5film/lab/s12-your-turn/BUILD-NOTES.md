# s12-your-turn: build notes (group D)

`compositions/s12-your-turn.html`, 76.78 s on the scratch clock (film 385.59 to 462.37: from the cut on b38 to the
matched cut 0.15 s before `recap`). STORYBOARD 12a to 12h; HANDOFFS § The turn, § Framings (F-turn), § Camera moves,
§ The cuts S11 to S12 and S12 to S13 (matched). F0 from the cut, one push to F-turn (1.4x) that does not come back: the
scene ends on it. Hosts at 300 in the corners (m-blue-s12, m-orange-s12). The turn's objects come from the same
builder as S11 (`turnObjects`), so the cut on b38 is the same frame on both sides.

## Rows and anchors (scene time; the scratch clock)

| Row | What | Anchor | Scratch |
| --- | --- | --- | --- |
| 12a | "A3 · Merc" with its blue dot; Merc's line glows (up 0.3, held 0.6, down 0.8) | `word('b38', 'my A')` | 0.88 |
| 12a | "A4 · Tavi, an octave up" with its orange dot | `word('b38', 'an octave')` | 2.71 |
| 12b | the phase row under the ring (mono 28, ink-2), "Listen" lit to ink | `at('b39')` | 3.86 |
| 12b | "Breathe" lit; "Sing" lit (each 0.2 s, and stays lit) | `word('b39', 'Breathe')`; `word('b39', 'sing')` | 5.47; 8.33 |
| 12b | "at about speaking volume" (baseline 828) | `word('b39', 'at about')` | 10.35 |
| 12b | the ring's 12 o'clock tick brightens (up 0.25, held 0.8, down 0.6) | `word('b40', 'ring closes')` | 13.55 |
| 12b | "stop sooner if you need to" (baseline 864) | `word('b40', 'stop sooner')` | 15.34 |
| 12c | the stop line, two lines at once (0.3 s, linear) | `at('b41')` | 17.44 |
| 12c | the icon, comfort line, reasons and listening line fade (0.3 s, linear); the phase row and its two lines leave up fast (0.3 s, power3.in, 16 px) | `push - 0.5` | 19.81 to 20.11 |
| 12c | push F0 to F-turn (1.1 s, power2.inOut), landing 0.14 s before `listen` (DECISIONS 112) | `at('listen') - 0.14 - 1.1` | 20.31 to 21.41 |
| 12d | "Listen" inside the ring; both voices scale 1.08; the band brightens (fill 12 to 22 %) through the model note | `at('listen')`; to `at('listen', 'end')` | 21.55 to 23.55 |
| 12d | "Listen" switches to "Breathe" (old out 0.1 s, new in 0.15 s: never glyph on glyph, DECISIONS 183) | `at('b42')` | 23.65 |
| 12d | the ring breathes once to 1.08 and back (sine.inOut) | `at('b42', 'start', -0.04)` to `at('tick-in')` | 23.61 to 25.69 |
| 12d | "Breathe in, low and quiet" on the "Nothing listens" line, right-aligned to the frame's end | `word('b42', 'in')` | 24.12 |
| 12e | "Breathe" switches to "Sing"; "Breathe in, low and quiet" leaves (0.2 s, linear) | `at('tick-in')` | 25.69 |
| 12e | the arc fills clockwise from 12 o'clock at an even pace (`angle = 36 t`); the playhead sweeps the frame in step (64 world px a second, fading in over its first 0.3 s) | `at('hold')` to `at('hold', 'end')` | 25.79 to 35.79 |
| 12e | the counter fades in at "0" (0.2 s) | `tick-in + 0.4` | 26.09 |
| 12e | the counter's seconds 1 to 10, each a 0.15 s switch (old out 0.06 s, new in 0.09 s, landing on the second) | `at('hold') + n` | 26.79 to 35.79 |
| 12e | the ring closes and sends one chrome echo ring (0.6 s, to 1.25 of its radius) | `at('hold', 'end')` | 35.79 |
| 12f | the ring, its word, the counter, the playhead and "Your turn." fade (0.4 s, linear) | `at('b43', 'start', -0.4)` | 36.19 to 36.59 |
| 12f | "How did that feel?" (serif italic 64, frame-fixed, 0.3 s, linear) | `at('b43')` | 36.59 |
| 12f | the four capsules on their words | `word('b43', 'Easy' / 'workable' / 'effortful' / 'uncomfortable')` | 38.18, 38.81, 39.49, 40.38 |
| 12f | the small ring timer beside the question (1660, 458), r 16, over the `feel` pause | `at('feel')`, its length | 41.56 to 43.36 |
| 12g | "Easy" and "Workable" light (stroke to full, a chrome tint, a 1.08 pulse) | `word('b44', 'Easy')` | 43.73 |
| 12g | the bracket at x 1240 and "rest a few easy breaths" | `word('b44', 'Rest')` | 45.48 |
| 12g | "Effortful" lights, the two before dim their strokes (labels stay ink); "rest before you sing again" | `word('b45', 'Effortful')`; `word('b45', 'rest')` | 47.84; 49.93 |
| 12g | "Uncomfortable" lights, "Effortful" dims; "enough singing for today" | `word('b46', 'Uncomfortable')`; `word('b46', 'enough')` | 51.99; 55.03 |
| 12h | all four light together | `at('b46a')` | 57.95 |
| 12h | the stop line fades (0.4 s, linear) | `b46a + 0.05` | 58.00 to 58.40 |
| 12h | the doctor lines to full size: the small lines out (0.3 s, linear), then the full lines in rising 12 px (0.5 s) | `b46a + 0.2` | 58.15 to 58.95 |
| 12h | "see a doctor" underlined (0.5 s); "get help straight away" underlined across its two lines (0.6 s) | `word('b46a', 'see a doctor')`; `word('b46a', 'get help')` | 64.12; 74.35 |
| 12h | every mark of the turn fades but the band and Merc's line (0.5 s, linear) | `at('b46a', 'end', 0.06)` | 75.79 to 76.29 |

The closest two landings are 0.40 s apart ("Sing", the counter's "0"); the counter's switches are 1.0 s apart and 0.70 s
after the "0" (`lab/s12-your-turn/tools/landings.py`).

## Departures from the board, with numbers

1. **The doctor lines' cross-fade to full size is sequential** (the board: "re-broken as a cross-fade rising 12 px,
   460.00 to 460.80"): the small lines fade out over 0.3 s (linear), then the full lines fade in over 0.5 s (linear),
   rising 12 px over their first 0.2 s (linear, a pixel a 60 fps frame), all inside the board's 0.8 s. The two sets
   overlap on the screen (small at baselines 650 to 764, full at 430 to 680), so a true cross-fade put glyph on glyph
   (DECISIONS 183). The first render eased the rise over 0.5 s (power2.out): the type then stepped a whole pixel every
   other frame as it settled, and measure.py flagged two jumps of 1.2 and 1.3 % of the frame (`round0/measure`).
2. **The full doctor lines are six lines** at Inter 40 within 700 px (as the board says); the small ones four, not
   five (s11's notes, departure 1). "get help straight away" breaks across lines 5 and 6, so its underline is two
   segments (x 593.8 to 874.5 at y 640, x 260 to 348.3 at y 690), drawn on as one stroke left to right.
3. **The phase row lights cumulatively**: "Listen", "Breathe" and "Sing" each go to ink on their word and stay ink
   (the board says each "lights to ink as Merc says it", and names no dimming here, where 12g does).
4. **"Listen" to "Breathe" to "Sing" are swaps, never glyph on glyph** (DECISIONS 183): the old word out in 0.1 s
   (sliding up 12), the new in 0.15 s (from 12 below). The counter's switches the same in 0.15 s: out 0.06, in 0.09,
   the new digit landing on the second (`hold` + n).
5. **The ring's echo grows to 1.25 of its radius**, not the kit's bead echo (3x): at r 224 on screen three times would
   cross the frame's labels and Tavi's corner. It reaches r 280 on screen (x 1096 to 1656, y 356 to 916) as it fades
   over 0.6 s: 44 px clear of Tavi's keep-out (1700); under "A4 · Tavi" (foot 325) and right of "Nothing listens" (its
   circle crosses y 380 at x 1263 to 1489).
6. **"How did that feel?" and its capsules sit beside the full doctor lines on the board's places**: line 2 ("than a
   couple of weeks, see a doctor (a") ends at about x 935 on baseline 480, the question's baseline, about 62 px left of
   the question's ink (997); line 3 ends at x 954.4, 45 px left of the "Easy" capsule (1000). Clear, as HANDOFFS says, but
   close: the two blocks read as two columns.
7. **Fades made linear for measure.py** (DECISIONS 179): the stop line in (0.3 s) and out (0.4 s); the thinning (0.3 s);
   "Breathe in, low and quiet" out (0.2 s); the ring's group out (0.4 s); "How did that feel?" in (0.3 s); the last
   fade (0.5 s); the small doctor lines out (0.3 s).

## Built locally (the kit might offer)

- **The turn's block** (`turnObjects`, s11's notes): one definition for both scenes.
- **The feel block** from `L.TURN.FEEL`: the question, the ring timer, four `L.pill` capsules (x 1000 to 1230, the
  text centred), their lit state (stroke to full and a chrome tint, `capDraw`) and dim state (stroke to 0.28, the
  label ink), the vertical bracket at x 1240 (`L.bracket` with `vertical`), the three lines.
- **Phrase underlines across broken lines** (`underlineLayout`): a phrase's character range in the whole text mapped
  onto the lines the font broke it into, measured with `getSubStringLength`, drawn as one stroke over its segments.
- **The sequential swap** (`swapSeq`) and the counter (`counts`): the kit's `L.swap` cross-fades the two words in place.
- **Merc's arc reach** (`arcs/arcs.py`): a pass's alpha extent frame by frame, mapped to the screen at the corners' box.
- **Lab tools** (`tools/`): `where.py` (the pixels behind a flagged single-frame event), `holds.py` (each hold against the
  voice: inside a word or in a pause), `landings.py` (group D's landings and the 0.4 s sweep).

## Proof

- Probe (`probe.json`, `probe-*.png`; checks in `checks.js`, run by `lab/s05-push/probe.mjs`): 122 of 122 pass. The
  first frame as S11's last (16 texts, the ring at 35 % at rest); "A3 · Merc" from x 1016 with its dot at 1000 to
  1012, 12 px or more under "0"; "A4 · Tavi, an octave up" from 1202, its dot from 1186; the phase row centred on 1320
  (advance boxes), its middots a space each side, "Listen" lit; "at about speaking volume" centred 1320; "stop sooner
  if you need to" with its ink above 896; the stop line from x 260 within 960, 28 and 37 px clear of the listening line
  and the doctor lines; thinned before the push (icon, comfort line, reasons, listening line at 0; the phase row and
  its lines gone; "Your turn.", the stop line and the four doctor lines kept) with the camera still at s 1; mid-push
  the layers part (far 1.05, mid 1.2, near 1.32) while "Your turn." holds at x 266; **F-turn**: the frame x 928 to
  1824, band 104 to 202, Merc's line y 153; the ring centre (1376, 636), r 224, 95 px from Tavi's keep-out; the labels at
  screen baselines 261, 317 and 373; "Listen" at 56 px centred 1376, baseline 577; the voices at 1.08 on `listen`;
  "Breathe in, low and quiet" ink x 1390.9 to 1824.2 on baseline 373, 182.7 px right of "Nothing listens" (HANDOFFS estimated 74: the real text is narrower); the breath
  at 1.08 in its middle; "Sing" and no counter at the first tick; "0" then each second; at hold + 4.8 (board 433.00)
  the counter "4" on baseline 706 at 112 px, the arc at 0.480 of the ring, the playhead at 1358.1 the band's height,
  no violet line, "Your turn." on screen; at the second tick the arc closed, "10", one echo ring; the ring, its word,
  the counter, the playhead and "Your turn." at 0 before the question; "How did that feel?" ink from 997 on baseline
  481; the capsules x 1000 to 1230, centred 540, 596, 652 and 708, 37 px under the question, each word 10 px or more
  inside; the small ring timer at (1660, 458); the lit and dimmed strokes (1.0, 0.28) in each state the board names;
  the bracket x 1234 to 1240, y 540 to 596; the feel block to x 1600.2 and y 730; the full doctor lines six, within x
  260 to 960, word for word, clear of "Nothing listens" and the answers; both underlines under their words; nothing
  but the band and Merc's line at 76.30; the last frame as HANDOFFS § S12 to S13. No two visible texts overlap at any
  time tested; the keep-out 70.5 px (Merc, the doctor lines) and 118.8 px or more (Tavi).
- **LAB-CHECKS 3** (the voiced, scratch clock): the push 20.31 to 21.41, `listen` at 21.55 (0.14 s, DECISIONS 112). In
  the clip the turn's region changes by 0.15 (mean, of 255) at frame 642 (21.400), the push's last moving frame, and by
  0.02 or less from frame 643 to 646; "Listen" shows from frame 647 (21.567), the first frame after `listen` starts:
  the push has landed 5 frames before it. The stop line lands at 17.44 (in by 17.74); the thinning starts 19.81, 2.07 s
  after. b41 ends 0.60 s before `listen` on both clocks (the clock unchanged).
- **LAB-CHECKS 15 and the provisional value, Merc's arc reach beside the care block (m-blue at 300)**, measured on
  every frame of m-blue-s12 (`arcs/arcs.py`, `arcs/m-blue-s12.csv`): the rightmost pixel with alpha over 8 of 255 at
  screen x 228.0 while he talks (b38, b42, b43, b44, b46a), 229.3 while he sings (`listen`), 226.7 idle (his glow);
  over alpha 32: 218.7, 220.0 and 193.3. Right of his body (x 190) the arcs lie at y 722 to 857. So the care block at x
  260 keeps **30.7 px** (the board's 35, "about x 225"; 12 or more passes): the small doctor lines (baselines 650 to
  764) beside the arcs' height, the full lines (to y 690) 32 px above them as well. "Your turn." (ink x 266 to 663, y
  120 to 201) is 441 px from the arcs' nearest point, 265 px from the frame at F-turn and 484 px from the ring. Stills
  `clip-still-22.05.png` (both singing on `listen`, arcs on) and `clip-still-30.59.png` (board 433.00, the hold). Tavi's
  arcs reach x 1682 (alpha over 8, singing): 77 px from the ring at F-turn (1605 with its stroke).
- **LAB-CHECKS 19** (12e watched, `lab19-sheet.png`: one frame a second through the hold, and the clip): with the sound
  off I see the ring's bright arc grow clockwise from 12 o'clock at one even pace, a large counter step 0 to 10 once a
  second, and a thin chrome playhead walk across the empty frame in step with the arc; "Sing" stands in the ring; both
  hosts stand idle facing in, eyes open, no arcs and no mouth; "Nothing listens" stays under the frame; nothing pulses
  or reacts. When the arc closes one faint ring spreads out from it and the counter rests on "10". With the sound on
  (the scratch voice mix) the hold is silent: -91 dB through all ten seconds (the room tone and the two ticks come in
  the sound round, LAB-CHECKS 16), and so is `listen`'s model note (the voice mix carries the lines only). Whether it
  reads as listening is the critic's call; nothing on screen follows a sound.
- **LAB-CHECKS 2, the matched cut on `recap`** (`cut-recap/`, `../s11-sing/cutprobe.mjs recap`): S12's last frame
  against a stand-in for S13's first (the kit's `L.RECAP.FROM` at F0 under `L.roomCut(room, { from: 'F-turn' })`, Merc's
  line at `L.RECAP.mercW(0)`; s13-recap is group E's): the band x 928 to 1824, y 104 to 202 on both; Merc's line y 153,
  x 928 to 1824, 5.6 px on both; no labels on either. By region (`cutdiff.txt`): best shift (0, 0) for the band
  (residual 0.89 of 255), the line (0.12) and the band's top edge (5.82), the same on the true 60 fps frames
  (`out60.png`, `in60.png`). **For group E**: the band's two edges are 2 world px, so 2.8 px on screen at F-turn, where
  `L.RECAP.FROM` draws them 2 px: one fringe row each side thins at the cut (red 59 against the ground's 19 at y 102, 81
  against the fill's 46 at y 105), same centre. `L.RECAP` carries Merc's line through the slide (`mercW`) but not the
  edges; an edge weight from 2.8 to 2 with the same `u` would make the band hold to the pixel. `cut-recap.mp4` (S12's last
  0.5 s, the stand-in's first 0.5 s; `sheet.png`): `measure/summary.md` finds no single-frame event; the frame is still
  across it (hosts hidden in the probe, the labels gone by 76.29): a 0.4 s hold, then S13's slide (board 478.20).
- **The plain cut on b38** (`cut-b38/`, `../s11-sing/cutprobe.mjs b38`): S11's last frame against S12's first, the same
  16 texts, the band and line on the same pixels; no pixel of the frame changes by more than 24 (the largest change 10,
  12 on the 60 fps pair: the dust).
- Clip: `clip.mp4` (30 fps draft, the whole scene, 76.8 s, with the scratch voice; MIX=voice; one clip rather than parts,
  since a part renders from the scene's start anyway); stills `clip-still-*.png` at 0, 0.30, 1.18, 3.01, 4.16, 8.60,
  10.65, 13.96, 15.64, 17.84, 20.16, 20.86 (mid-push), 21.41 (landed), 21.85, 22.05, 22.50, 24.42, 24.65, 25.99,
  26.34, 30.59, 35.91, 36.10 (the echo), 36.60, 36.99, 38.48, 40.68, 42.47, 45.99, 50.23, 55.33, 58.23, 58.60 (the
  doctor lines mid-change), 58.98, 64.72, 70.00, 75.16, 76.30, 76.75 (the last frame). The first render (eased rise)
  is measured in `round0/`.
- `measure.py render` (`measure/summary.md`): holds 4.3 s inside the clip (1.7 s per 30 s), longest 0.2 s; none in the
  viewer's ten seconds (the arc, the counter and the playhead each register); against the voice (`tools/holds.py`), 2.5
  s in Merc's pauses (0.24 to 2.54 s long; two in the `feel` pause, where only the small ring timer moves) and 2.0 s
  inside words (his mouth under the measure's threshold at 320 px; DECISIONS 189). **The turn at F-turn** (21.41 to
  76.78, 55.4 s on the scratch clock, no camera drift added, DECISIONS 171 and the brief): 21 holds, 2.5 s in all (1.35 s
  per 30 s), the longest 0.2 s; before the push lands, 16 holds, 1.8 s. Final hold 0.3 s (76.40, the frame
  alone before the cut). Single-frame events: 15.067, 39.267, 42.467 and 73.133 (pops, 0.05 to 0.07 % of pixels: the
  hosts' blinks, with the small ring timer and dust at 42.467), 54.867 and 69.900 (jumps, 0.03 and 0.04 %: the hosts
  and dust). Integrated -19.8 LUFS, true peak -1.3 dBTP.
- `check lab/s12-your-turn/proj --at=4.16,21.41,30.59,45.99,58.98` and `--at=17.84,24.42,55.33,64.72,75.16`
  (`check.log`, `check-2.log`; the phase row, F-turn landed, the hold, the feel block, the doctor lines full size; the
  stop line, the breath, the answers' lines, the first underline, the second): contrast 85/85 and 98/98, layout 0
  issues, lint 0 errors (warnings: the kit's duplicated host video entry; the file's 337 lines).
- **LAB-CHECKS 21 for these lines** (real widths, the probe): the stop line 260.0 to 726.2 and 260.0 to 596.3; "Breathe
  in, low and quiet" 1390.9 to 1824.2 on screen; "How did that feel?" 997.0 to 1406.8; the capsules' words inside x 1000
  to 1230 ("Uncomfortable" the widest, its ink 12.6 and 11.8 px from the capsule's ends); the answers' lines to 1600.2;
  the full doctor lines' ink within x 260.0 to 954.4.
- clock-lint silent; `merc-tags.py s12-your-turn --check`: 4 tags, 0 stale, 0 problems.
- The root check (`npx hyperframes@0.8.97 check` over the film, after the final renders; `../s12-your-turn/root-check.log`):
  check passed, lint 0 errors and 19 warnings (for this group: the kit's duplicated host video entry in both scenes, and
  s12-your-turn's 337 lines; the rest are other groups'), runtime 0 errors, layout 0 issues across 9 samples, motion 0
  errors, contrast 56/56.
