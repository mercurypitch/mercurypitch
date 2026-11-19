# s12-your-turn: build notes (group D)

`compositions/s12-your-turn.html`, 76.78 s on the scratch clock (film 385.59 to 462.37: from the cut on b38 to the
matched cut 0.15 s before `recap`). STORYBOARD 12a to 12h; HANDOFFS § The turn, § Framings (F-turn), § Camera moves,
§ The cuts S11 to S12 and S12 to S13 (matched). F0 from the cut, one push to F-turn (1.4x) that does not come back: the
scene ends on it. Hosts at 300 in the corners (m-blue-s12, m-orange-s12). The turn's objects come from the same
builder as S11 (`turnObjects`), so the cut on b38 is the same frame on both sides.

## Rows and anchors (scene time; the scratch clock)

| Row | What | Anchor | Scratch |
| --- | --- | --- | --- |
| 12a | the six reasons fade (0.5 s, linear); the comfort line, its icon, "Your turn.", the listening line and the small doctor lines stay to the thinning **[D-01: 204]** | `word('b38', 'Otherwise')` | 0.02 to 0.52 |
| 12a | "A3 · Merc" with its blue dot; Merc's line glows (up 0.3, held 0.6, down 0.8) | `word('b38', 'my A')` | 0.88 |
| 12a | "A4 · Tavi, an octave up" with its orange dot | `word('b38', 'an octave')` | 2.71 |
| 12b | the phase row under the ring (mono 28, baseline 747), "Listen" lit (ink) with a small chrome mark under it (24 x 3 at baseline + 7), the unlit words ink-2 at 60 % **[D-01: 209]** | `at('b39')` | 3.86 |
| 12b | the lit word moves on: "Breathe", then "Sing" (the word before back to ink-2 at 60 %, the mark sliding under the new one; 0.25 s, power2.inOut) | `word('b39', 'Breathe')`; `word('b39', 'sing')` | 5.47; 8.33 |
| 12b | "at about speaking volume" (baseline 785) | `word('b39', 'at about')` | 10.35 |
| 12b | the ring's 12 o'clock tick brightens (up 0.25, held 0.8, down 0.6) | `word('b40', 'ring closes')` | 13.55 |
| 12b | "stop sooner if you need to" (baseline 820: its ink ends 14 rows above the floor horizon, DECISIONS 203) | `word('b40', 'stop sooner')` | 15.34 |
| 12c | the stop line, two lines at once (0.3 s, linear): its first line lit (ink), its second at ink-2, lit on "feels" (0.3 s, linear) **[F-01: 228]** | `at('b41')`; `word('b41', 'feels')` | 17.44; 19.55 |
| 12c | the icon, comfort line and listening line fade (0.3 s, linear); the phase row and its two lines leave up fast (0.3 s, power3.in, 16 px) | `push - 0.5` | 19.81 to 20.11 |
| 12c | push F0 to F-turn (1.1 s, power2.inOut), landing 0.14 s before `listen` (DECISIONS 112) | `at('listen') - 0.14 - 1.1` | 20.31 to 21.41 |
| 12d | "Listen" inside the ring; both voices scale 1.08; the band brightens (fill 12 to 22 %) through the model note | `at('listen')`; to `at('listen', 'end')` | 21.55 to 23.55 |
| 12d | "Listen" switches to "Breathe" (old out 0.1 s, new in 0.15 s: never glyph on glyph, DECISIONS 183) | `at('b42')` | 23.65 |
| 12d | the ring breathes once to 1.08 and back (sine.inOut), a CSS transform on the ring's own layer, composited from the push's landing, so the ring and its word move sub-pixel **[F-01: 233]** | `at('b42', 'start', -0.04)` to `at('tick-in')` | 23.61 to 25.69 |
| 12d | "Breathe in, low and quiet" on the "Nothing listens" line, right-aligned to the frame's end | `word('b42', 'in')` | 24.12 |
| 12e | "Breathe" switches to "Sing"; "Breathe in, low and quiet" leaves (0.2 s, linear) | `at('tick-in')` | 25.69 |
| 12e | the arc fills clockwise from 12 o'clock at an even pace (`angle = 36 t`); the playhead sweeps the frame in step (64 world px a second, fading in over its first 0.3 s) | `at('hold')` to `at('hold', 'end')` | 25.79 to 35.79 |
| 12e | the counter fades in at "0" (0.2 s) | `tick-in + 0.4` | 26.09 |
| 12e | the counter's seconds 1 to 10, each a 0.15 s switch (old out 0.06 s, new in 0.09 s, landing on the second) | `at('hold') + n` | 26.79 to 35.79 |
| 12e | the ring closes and sends one chrome echo ring (0.6 s, to 1.16 of its radius: its widest ink 11 rows above the floor horizon) | `at('hold', 'end')` | 35.79 |
| 12f | the ring, its word, the counter, the playhead and "Your turn." fade (0.4 s, linear), and with them the bracket with "0" and "10 s", "A3 · Merc" and "A4 · Tavi, an octave up"; the band, Merc's line and "Nothing listens" stay **[D-01: 206]** | `at('b43', 'start', -0.4)` | 36.19 to 36.59 |
| 12f | the band and Merc's line dim to 50 % with them (0.4 s, linear) while the feel block and the doctor lines are the subject **[F-01: 226]** | `at('b43', 'start', -0.4)` | 36.19 to 36.59 |
| 12f | "How did that feel?" (serif italic 64, frame-fixed, 0.3 s, linear) | `at('b43')` | 36.59 |
| 12f | the four capsules on their words | `word('b43', 'Easy' / 'workable' / 'effortful' / 'uncomfortable')` | 38.18, 38.81, 39.49, 40.38 |
| 12f | the small ring timer beside the question (1660, 458), r 16, over the `feel` pause | `at('feel')`, its length | 41.56 to 43.36 |
| 12g | "Easy" and "Workable" light (stroke to full, a chrome tint, a 1.08 pulse) | `word('b44', 'Easy')` | 43.73 |
| 12g | the bracket at x 1240 and "rest for a few easy breaths" (the page's words, ink to x 1614.6) **[D-01: 209]** | `word('b44', 'Rest')` | 45.48 |
| 12g | "Effortful" lights, the two before dim their strokes (labels stay ink); "rest before you sing again" | `word('b45', 'Effortful')`; `word('b45', 'rest')` | 47.84; 49.93 |
| 12g | "Uncomfortable" lights, "Effortful" dims; "enough singing for today" | `word('b46', 'Uncomfortable')`; `word('b46', 'enough')` | 51.99; 55.03 |
| 12h | all four light together | `at('b46a')` | 57.95 |
| 12h | the stop line fades (0.4 s, linear) | `b46a + 0.05` | 58.00 to 58.40 |
| 12h | the doctor lines to full size: the small lines out (0.3 s, linear), then the full lines in rising 12 px (0.5 s), seven lines broken by hand at phrase ends, baselines 430 to 730 **[D-01: 205]** | `b46a + 0.2` | 58.15 to 58.95 |
| 12h | the full lines rise at ink-2 and light line by line to ink as each is said (0.3 s, linear, on the line's first word, staying lit) **[F-01: 228]** | `word('b46a', 'if hoarseness' / 'more than' / 'see a doctor' / 'nose and' / "If it's" / 'or breathing' / 'get help')` | 59.71, 62.22, 64.12, 67.32, 69.88, 71.34, 74.36 |
| 12h | the feel block (question, capsules, their lines and bracket) dims to 55 % (0.6 s, linear; every text 4.8:1 or better, measured) and stays so to the end fade **[D-01: 205]** **[F-01: 231]** | `b46a + 0.5` | 58.45 to 59.05 |
| 12h | "see a doctor" underlined (0.5 s); "get help straight away" underlined, one line now (0.6 s) | `word('b46a', 'see a doctor')`; `word('b46a', 'get help')` | 64.12; 74.35 |
| 12h | every mark of the turn fades but the band and Merc's line (0.5 s, linear) | `at('b46a', 'end', 0.06)` | 75.79 to 76.29 |
| 12h | the band and Merc's line back to full (0.4 s, linear), 0.59 s before the matched cut on `recap` **[F-01: 226]** | `at('b46a', 'end', 0.06)` | 75.79 to 76.19 |

The closest two landings are 0.40 s apart ("Sing", the counter's "0"); the counter's switches are 1.0 s apart and 0.70 s
after the "0" (`lab/s12-your-turn/tools/landings.py`).

## Departures from the board, with numbers

1. **The doctor lines' cross-fade to full size is sequential** (the board: "re-broken as a cross-fade rising 12 px,
   460.00 to 460.80"): the small lines fade out over 0.3 s (linear), then the full lines fade in over 0.5 s (linear),
   rising 12 px over their first 0.2 s (linear, a pixel a 60 fps frame), all inside the board's 0.8 s. The two sets
   overlap on the screen (small at baselines 650 to 764, full at 430 to 680), so a true cross-fade put glyph on glyph
   (DECISIONS 183). The first render eased the rise over 0.5 s (power2.out): the type then stepped a whole pixel every
   other frame as it settled, and measure.py flagged two jumps of 1.2 and 1.3 % of the frame (`round0/measure`).
2. **The full doctor lines are seven lines, broken by hand at phrase ends** (DECISIONS 205; the board's six were the
   font's breaks, which split "(a | GP" and left "away." alone): "If hoarseness or discomfort lasts" / "more than a
   couple of weeks," / "see a doctor (a GP or an ear," / "nose and throat specialist)." / "If it’s very painful," / "or
   breathing or swallowing is hard," / "get help straight away." at Inter 40, baselines 430 to 730, widths 296.9 to
   588.0 px (ink x 258 to 846.2); joined they are the page's text word for word. Both underlines are one segment each.
3. **The phase row lights one word at a time** (DECISIONS 209, replacing 202's "each staying lit"): the word Merc
   names at ink with a small chrome mark under it (24 x 3, rounded, at baseline + 7), the other two ink-2 at 60 %; the
   mark slides to the next word in 0.25 s. The row and its lines moved up (baselines 747, 785, 820, from 790, 828,
   864): "stop sooner if you need to" crossed the floor horizon (ink 842 to 871 against y 840), which DECISIONS 203
   rules out for every line of type.
4. **"Listen" to "Breathe" to "Sing" are swaps, never glyph on glyph** (DECISIONS 183): the old word out in 0.1 s
   (sliding up 12), the new in 0.15 s (from 12 below). The counter's switches the same in 0.15 s: out 0.06, in 0.09,
   the new digit landing on the second (`hold` + n).
5. **The ring's echo grows to 1.16 of its radius** (1.25 in the first build), not the kit's bead echo (3x): with the
   ring at r 190.4 on screen it reaches r 220.9 (x 1155 to 1597), its widest ink 11 rows above the floor horizon (it
   crossed it by 71 rows in the first build) and 103 px clear of Tavi's keep-out (1700).
6. **The doctor lines own the end** (DECISIONS 205): with the hand breaks the lines end at x 846.2 (154 px left of
   the capsules, 151 px of the question's ink), and the feel block dims to 35 % as they rise (58.45 to 59.05) and stays
   so to the end fade. All four capsules stay lit inside the dimmed block.
7. **Fades made linear for measure.py** (DECISIONS 179): the reasons out (0.5 s); the stop line in (0.3 s) and out (0.4 s); the thinning (0.3 s);
   "Breathe in, low and quiet" out (0.2 s); the ring's group out (0.4 s); "How did that feel?" in (0.3 s); the feel
   block's dim (0.6 s); the last fade (0.5 s); the small doctor lines out (0.3 s).
8. **The ring is smaller and a little higher** (DECISIONS 207, 208; HANDOFFS § The turn had centre (1320, 590), r
   160): centre (1320, 572), r 136 in the world, so (1376, 610.8), r 190.4 on screen at F-turn (381 px across the
   track's middle, 395 px across its stroke; signature 3's "448 px across" comes down past the board's "about 420").
   Three bounds set it, measured on pixels with the same harness for both builds (`fix-D-01/geom.py`; `geom.txt`
   now, `geom-before.txt` the first build): at its largest breath its tick's top stays 13 rows under the foot of
   "Breathe in," (2 rows in the first build, the tick tucked under the "B") and 20.5 px from the label's ink (13.9),
   the label unmoved on the line of "Nothing listens"; at its largest breath its ink ends 16 rows above the floor
   horizon (it crossed it by 46), at rest 23 rows (crossed by 36); at F0 the phase row, moved up for DECISIONS 203,
   keeps 14 px under it. A larger ring has to push the label past the frame's end or shrink it, or press the row
   into the ring. The word inside sits at screen baseline 552 (56 px), the counter at 680.8 (112 px).

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

- Probe (`probe.json`; checks in `checks.js`, run by `lab/s05-push/probe.mjs`): 137 of 137 pass after fix D-01 (122 of
  122 in the first build; the fix round's checks are named for their DECISIONS). The first frame as S11's last (16
  texts, the ring at 35 % at rest); the six reasons gone by 0.54 (on "Otherwise,"), the comfort line, its icon, the
  listening line and the small doctor lines kept; "A3 · Merc" from x 1016 with its dot at 1000 to
  1012, 12 px or more under "0"; "A4 · Tavi, an octave up" from 1202, its dot from 1186; the phase row centred on 1320
  (advance boxes), its middots a space each side, "Listen" lit (ink at full, the others ink-2 at 60 %, the mark centred
  under it at y 754), then "Breathe" (mark at 1341.9), then "Sing" (mark at 1527.5), the word before back to 60 %; "at
  about speaking volume" centred 1320 on baseline 785; "stop sooner if you need to" on 820, its ink to y 826 (the floor
  horizon 840); the stop line from x 260 within 960, 28 and 37 px clear of the listening line
  and the doctor lines; thinned before the push (icon, comfort line, reasons, listening line at 0; the phase row and
  its lines gone; "Your turn.", the stop line and the four doctor lines kept) with the camera still at s 1; mid-push
  the layers part (far 1.05, mid 1.2, near 1.32) while "Your turn." holds at x 266; **F-turn**: the frame x 928 to
  1824, band 104 to 202, Merc's line y 153; the ring centre (1376, 610.8), r 190.4, at rest its stroke 31.8 px above the floor
  horizon (23 rows with the arc's glow, on pixels) and 30.8 px under "Nothing listens", 126.6 px from Tavi's keep-out; the labels at screen baselines 261, 317 and
  373; "Listen" at 56 px centred 1376, baseline 552; the voices at 1.08 on `listen`;
  "Breathe in, low and quiet" ink x 1390.9 to 1824.2 on baseline 373, 182.7 px right of "Nothing listens" (HANDOFFS estimated 74: the real text is narrower); the breath
  at 1.08 in its middle, where the ring keeps 23.9 px (its circle) and 17.5 px (its tick) from "Breathe in, low and
  quiet", its tick's top 12.8 px under the foot of "Breathe", its stroke 16.0 px above the floor horizon and 15.0 px
  under "Nothing listens"'s ink foot; "Sing" and no counter at the first tick; "0" then each second; at hold + 4.8 (board 433.00)
  the counter "4" on baseline 680.8 at 112 px, the arc at 0.480 of the ring, the playhead at 1358.1 the band's height,
  no violet line, "Your turn." on screen; at the second tick the arc closed, "10", one echo ring; the ring, its word,
  the counter, the playhead and "Your turn." at 0 before the question, and with them the bracket, "0", "10 s" and both
  voices; the band, Merc's line and "Nothing listens" kept; "How did that feel?" ink from 997 on baseline
  481; the capsules x 1000 to 1230, centred 540, 596, 652 and 708, 37 px under the question, each word 10 px or more
  inside; the small ring timer at (1660, 458); the lit and dimmed strokes (1.0, 0.28) in each state the board names;
  the bracket x 1234 to 1240, y 540 to 596; the feel block to x 1600.2 and y 730; the full doctor lines seven, broken at phrase ends, ink x 258 to 846.2, baselines 430 to 730, word for word, clear of
  "Nothing listens" and the answers; the feel block at 35 % from 59.05 (question, capsules, lines, bracket), all four
  still lit; both underlines one segment under their words (x 260 to 475 at y 540; 260 to 638.9 at 740); nothing
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
  764) beside the arcs' height, and the full lines too since fix D-01 (seven lines, their ink to y 739, from x 258: 28.7 px
  from the arcs' reach). "Your turn." (ink x 266 to 663, y
  120 to 201) is 441 px from the arcs' nearest point, 265 px from the frame at F-turn and 484 px from the ring. Stills
  `clip-still-22.05.png` (both singing on `listen`, arcs on) and `clip-still-30.59.png` (board 433.00, the hold). Tavi's
  arcs reach x 1682 (alpha over 8, singing): 108.6 px from the ring at F-turn (1573.4 with its stroke; 77 px from the
  first build's ring).
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
  Re-proved after fix D-01: the same numbers (band 0.89, line 0.12, edges 5.82; 60 fps pair 0.91, 0.13, 5.82), no
  single-frame event.
- **The plain cut on b38** (`cut-b38/`, `../s11-sing/cutprobe.mjs b38`; re-proved after fix D-01, `proof.txt`): S11's
  last frame against S12's first, the same 16 texts, the band, the line and the ring (1320, 572), r 136 on the same
  pixels; no pixel of the frame changes by more than 24 (the largest change 10, 12 on the 60 fps pair: the dust); the
  reasons start to leave 0.02 s after it. `measure/summary.md` finds no single-frame event.
- Clip (fix D-01; the first build's clip, stills and measure in `fix-D-01/before/`): `clip.mp4` (30 fps draft, the whole
  scene, 76.8 s, with the scratch voice; MIX=voice); stills `clip-still-*.png` at 0, 0.30, 0.60 (the reasons leaving),
  1.18, 3.01, 4.16 ("LISTEN" lit, its mark), 5.80 (the mark moving), 6.20 ("BREATHE" lit), 8.70 ("SING" lit), 10.65,
  13.96, 15.64, 17.84, 20.16, 20.86 (mid-push), 21.41 (landed), 21.85, 22.05, 24.42, 24.65 (the largest breath),
  25.99, 26.34, 30.59, 35.91, 36.10 (the echo), 36.40 (the labels leaving with the ring), 36.75, 38.48, 40.68, 42.47,
  45.99, 50.23, 55.33, 58.10 (all four lit), 58.23, 58.60 (the doctor lines mid-change), 58.98, 59.20 (the feel block
  at 35 %), 64.72, 70.00, 75.16, 76.30, 76.75 (the last frame). The first build's eased-rise render is in `round0/`.
- `measure.py render` (`measure/summary.md`, fix D-01): holds 4.5 s inside the clip (1.8 s per 30 s; 4.3 s and 1.7 in
  the first build), longest 0.2 s; none in the viewer's ten seconds (the arc, the counter and the playhead each
  register); against the voice (`tools/holds.py`), 2.6 s in Merc's pauses (0.24 to 2.54 s long; two in the `feel`
  pause, where only the small ring timer moves) and 2.2 s inside words (holds.py counts the final hold too) (his mouth under the measure's threshold at 320 px; DECISIONS 189). **The turn at F-turn** (21.41 to
  76.78, 55.4 s on the scratch clock, no camera drift added, DECISIONS 171 and the brief): 21 holds, 2.5 s in all (1.35 s
  per 30 s), the longest 0.2 s, as in the first build; before the push lands, 17 holds, 2.0 s (16, 1.8: the reasons
  gone from the block). Final hold 0.3 s (76.40, the frame alone before the cut). Single-frame events: 15.067, 39.267,
  42.467 and 73.133 (pops, 0.05 to 0.07 % of pixels: the hosts' blinks, with the small ring timer and dust at 42.467),
  69.900 (jump, 0.04 %: the hosts and dust), and two new ones inside the breath, 24.533 and 25.467 (jumps, 0.12 and
  0.10 %): the ring's breath, whose pixels change on nearly every frame from 23.6 to 25.7 (median 2,472 a frame in
  its region; Merc 513 at 24.533); these are its last larger steps before the scale turns at its peak (24.65) and as
  it comes to rest (25.69), where the change drops to a few hundred pixels; neither differs from both neighbours. The first build's 54.867 jump is gone. Integrated -19.8 LUFS, true peak -1.3 dBTP.
- `check lab/s12-your-turn/proj --at=4.16,17.84,21.41,24.65,30.59,45.99` and `--at=36.40,58.98,59.20,64.72,75.16`
  (`check.log`, `check-2.log`, fix D-01; the phase row lit with its mark, the row above the floor, F-turn landed, the
  largest breath, the hold, the feel block; the labels leaving, the doctor lines full size, the feel block at 35 %,
  the first underline, the second): both passed, contrast 79/79 and 78/78 (the dimmed feel block included), layout 0
  issues, runtime and motion 0, lint 0 errors (warnings: the kit's duplicated host video entry; the file's 370 lines,
  337 in the first build).
- **LAB-CHECKS 21 for these lines** (real widths, the probe): the stop line 260.0 to 726.2 and 260.0 to 596.3; "Breathe
  in, low and quiet" 1390.9 to 1824.2 on screen; "How did that feel?" 997.0 to 1406.8; the capsules' words inside x 1000
  to 1230 ("Uncomfortable" the widest, its ink 12.6 and 11.8 px from the capsule's ends); the answers' lines to 1600.2;
  the full doctor lines' ink within x 258 to 846.2 (954.4 in the first build); "rest for a few easy breaths" 1260 to
  1614.6 (left of 1630).
- clock-lint silent; `merc-tags.py s12-your-turn --check`: 4 tags, 0 stale, 0 problems.
- The root check (`npx hyperframes@0.8.97 check` over the film, after the final renders; `../s12-your-turn/root-check.log`):
  check passed, lint 0 errors and 19 warnings (for this group: the kit's duplicated host video entry in both scenes, and
  s12-your-turn's 337 lines; the rest are other groups'), runtime 0 errors, layout 0 issues across 9 samples, motion 0
  errors, contrast 56/56.

## Fix round D-01 (critic D-01; DECISIONS 204 to 210)

What changed in `compositions/s12-your-turn.html` (line numbers as the file stands), the numbers before and after, and
the crop that shows each; the first build's clip, stills and measure are in `fix-D-01/before/`, its cut probes in
`fix-D-01/before-cuts/`. The shared builder `turnObjects` (lines 37 to 122) is the same text in s11-sing.

1. **204, the turn's first minute.** The six reasons fade on "Otherwise," (0.02 to 0.52, linear; lines 129, 334); the
   comfort line, its icon, "Your turn.", the listening line and the small doctor lines stay to the thinning (19.81).
   In s11 the ring now draws on in 11b on "seconds" (5.82), so S12 opens on it as before. The block loses three lines of type
   for the rest of its time (the five reason labels; the critic counted about 22 lines by 17.5). `fix-D-01/1-reasons-leave-on-b38.png` (1.18).
2. **205, the doctor lines own the end.** All four answers light on "Whatever you chose:" (57.95, as before); the
   feel block (question, capsules, their lines and bracket) dims to 35 % from 58.45 to 59.05 (lines 166, 350), as the
   full lines rise (58.45 to 58.95), and stays so to the end fade; the four stay lit within it. The full lines are
   broken by hand at phrase ends (line 201): seven lines, baselines 430 to 730, ink x 258 to 846.2 (the font's six
   lines reached 954.4, 45 px from the capsules; now 154 px), never "(a | GP", never "away." alone; word for word the
   page's text. Both underlines are one segment ("see a doctor" x 260 to 475 at y 540; "get help straight away" 260 to
   638.9 at 740). `fix-D-01/2-doctor-lines-own-the-end.png` (64.72).
3. **206, the chart's labels leave with the hold.** The bracket with "0" and "10 s", "A3 · Merc" and "A4 · Tavi, an
   octave up" fade with the ring (36.19 to 36.59; lines 279 to 286); the band, Merc's line and "Nothing listens" stay
   to the end fade (75.79). Before: on screen to 75.79, 39.2 s after the close. `fix-D-01/3-labels-leave-with-the-ring.png`
   (45.99). The bracket goes with its labels, as the board's one object.
4. **207, "Breathe in, low and quiet" clear of the ring.** The label is unmoved (right-aligned to the frame's end on
   the line of "Nothing listens", ink x 1390.9 to 1824.2); the ring moved (item 5). At its largest breath (24.65, 1.08)
   on pixels: the tick's top 13 rows under the label's foot (before 2 rows, the tick under the "B"), 20.5 px from its
   ink (before 13.9). `fix-D-01/4-breathe-in-clear-of-the-ring.png`; `fix-D-01/geom.txt` and `geom-before.txt`.
5. **208, the ring's bounds** (line 58): centre (1320, 572), r 136 in the world (was (1320, 590), r 160); on screen at
   F-turn (1376, 610.8), r 190.4 (was (1376, 636), r 224), 381 px across the track's middle, 395 across its stroke.
   At rest at F-turn its ink ends 23 rows above the floor horizon (it crossed by 36), its stroke 30.8 px under "Nothing
   listens"; at its largest breath 16 rows above the horizon (crossed by 46) and 15 px under "Nothing listens"' foot; at
   F0 its stroke 22 px under "Nothing listens", its foot 127 px above the horizon. The echo grows to 1.16 (line 91; was
   1.25): its widest ink 11 rows above the horizon (crossed by 71). The word inside at screen baseline 552, the counter
   at 680.8. **For HANDOFFS § The turn**: ring centre (1320, 572), r 136 (F0: x 1184 to 1456, y 436 to 708); at F-turn
   (1376, 610.8), r 190.4 (x 1185.6 to 1566.4, y 420.4 to 801.2); the phase word baseline 530 (F0) / 552 (F-turn); the
   counter baseline 622 / 680.8. `fix-D-01/5-ring-above-the-floor.png` (30.59).
   **And DECISIONS 203 here**: "stop sooner if you need to" (baseline 864) crossed the floor horizon at F0 (ink 842 to
   871) and "at about speaking volume" ended 6 rows above it; the phase row and its lines move up to baselines 747,
   785 and 820 (line 64), the last ink 14 rows above the horizon, the row 14 px under the ring.
   `fix-D-01/5b-row-above-the-floor-f0.png` (17.84). **For HANDOFFS § The turn**: the row's baselines 747, 785, 820.
6. **209, the feel lines and the phase row.** "rest for a few easy breaths" (line 185; the page's words), Outfit 500
   30 at x 1260, ink to 1614.6, one line (left of 1630). The phase row: the word Merc names at ink, the others ink-2 at
   60 %, a chrome mark 24 x 3 under the lit word (y 754), sliding to the next word in 0.25 s (lines 71, 294 to 301).
   Before: all three ink, "lit" by fill alone and staying lit (luma 192 to 252). `fix-D-01/6-phase-row-lit-word.png`
   (8.60 before, 8.70 after), `fix-D-01/6b-feel-line-words.png` (45.99).
7. **210, holds, the push, the sound**: nothing changed. Holds: 4.5 s in the clip (1.8 s per 30 s; first build 4.3 s,
   1.7), longest 0.2 s; at F-turn 21 holds, 2.5 s (1.35 per 30 s, as before), none in the ten seconds; 2.6 s in
   Merc's pauses, 2.2 s inside words. s11: 3.5 s (2.7 per 30 s), longest 0.5 s at 19.50 inside "singing has" (as
   before).

Tools for this round (`fix-D-01/`): `evalpage.mjs` (a scene in Chromium with the kit and fonts, hosts hidden, a measuring
script run in the page; `REPLACE` loads an earlier geometry), `geomshots.js` and `geom.py` (each element alone on black,
the pixel gaps between them and from the floor horizon), `fontgeom.js` (ink metrics for the type), `cutproof.py` (a cut's
frame sheet and the b38 pixel diff), `crops.py` (the before and after crops).
- **After fix D-01**: the probes (s11 62 of 62, s12 137 of 137), clock-lint silent, `merc-tags.py s11-sing
  s12-your-turn --check` 8 tags, 0 stale, 0 problems; the root check again (`../s12-your-turn/root-check.log`, after
  this round's renders): check passed, lint 0 errors and 23 warnings (this group's: the kit's duplicated host video
  entry in both scenes, s12-your-turn's 370 lines), runtime 0, layout 0 errors and 0 warnings (one info at film
  293.54, another group's time axis), motion 0, contrast 67/67.
