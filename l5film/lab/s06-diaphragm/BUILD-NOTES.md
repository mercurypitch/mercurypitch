# s06-diaphragm: build notes (group B)

`compositions/s06-diaphragm.html`, 68.775 s on the scratch clock (film 102.72 to 171.495, the cut 0.15 s before
`act2`; it ends on the matched cut at `o8`). STORYBOARD 6a to 6k; HANDOFFS § The gauge, § The breath figure (S6),
§ Framings (F-gauge), § Camera moves, § The cuts S5 to S6 and S6 to S7. F0 until `gauge`, then the steady 10 s push
to F-gauge (`cam.to(GAUGE, 10, 'F-gauge', L.steady(10))`), held to the cut. Hosts from the 300 chunks
(m-blue-s06 with `gauge` sung, arcs on; m-orange-s06), shrinking to 240 in place on o6 (`mercGate` moves).

## Rows and anchors (scene time; the scratch clock)

| Row | What | Anchor | Scratch |
| --- | --- | --- | --- |
| 6a | the chart and slider dim to 25 %, their labels and the chip hidden while dim | `at('act2')`, 0.2 s | 0.15 |
| 6a | card "02 What the diaphragm does" in; out up fast (0.38 s); back to full | `act2 + 0.22`; `at('o6', 'start', -0.5)`; + 0.38 | 0.37; 1.85; 2.23 |
| 6b | the kicker "02 · WHAT THE DIAPHRAGM DOES" (to b11's end) | `at('o6')`; `at('b11', 'end')` | 2.35; 12.51 |
| 6b | the hosts shrink in place to 240 (0.8 s, power2.inOut) | `o6 + 0.07` | 2.42 |
| 6b | the chip glides down, then right, to the gauge's place, growing to full size (0.6 s) | `o6 + 0.17` | 2.52 |
| 6b | the thumb scales 1.2 | `word('o6', 'that')` | 3.18 |
| 6b | the split (1.5 s, the settled curves below); the slider and the label row's text fade (0.2 s); the strip's ghost resting envelope, carried from S5 with "level" at the strip's left, fades (0.3 s, linear) **[B-01: 184]** | `word('o6', "isn't")` | 4.94 |
| 6b | the figure draws on (1.0 s, power2.in) | split + 0.1 | 5.04 |
| 6b | her guess (dashed arrow, "?") | `max(word('o6', 'diaphragm') + 0.13, figure's end)` | 6.04 |
| 6c | the four words return ("air pressure" still lit) | `at('b11', 'start', -0.15)` | 6.62 |
| 6c | "diaphragm" lights in the row; lands by the dome with its leader | `word('b11', 'diaphragm')`; + 0.47 | 7.02; 7.49 |
| 6c | a light runs along the dome (0.6 s) | `word('b11', 'dome-shaped')` | 8.14 |
| 6c | "lungs" lands, the guess fades (0.3 s) | `word('b11', 'lungs')` | 9.87 |
| 6c | the breath in (1.5 s, sine.inOut); "belly"; the row leaves; "breathing in"; the ease back (1.0 s) | `word('b11', 'tightens')`; + 0.24; `max(word('b11', 'breathe') - 0.12, belly + 0.4)`; + 1.54 | 11.09; 11.33; 11.73; 12.63 |
| 6d | the full breath (1.21 s), "breathing in" leaves | `word('b12', 'big')` | 13.49 |
| 6d | the strip's low, even envelope draws (0.6 s) | `word('b12', 'quiet')` | 14.97 |
| 6d | "PREDICT"; "Push it out"; "Hold it back" | `word('b12', 'must' / 'push' / 'hold')` | 16.57; 17.39; 18.69 |
| 6e | the ring timer (2.0 s) | `at('predict2')` to its end | 19.91 to 21.91 |
| 6e | Merc's line fades (0.3 s); the strip opens into the gauge (1.4 s, the kit's power2.inOut) | `predict2 + 0.05` | 19.96 to 21.36 |
| 6e | "one 10-second note"; "push of air (not pitch)" with its up arrow | predict2 + 0.5; + 0.45 | 20.41; 20.86 |
| 6f | the push to F-gauge, the cursor, Merc's line and the falling line, all on the note's own clock (10 s) | `at('gauge')` to its end | 22.26 to 32.26 |
| 6f | the stages, at the note's own seconds 0.2, 1.0 (gold line, 0.6 s), 1.3, 2.0, 2.5, 3.5 (check), 4.0 (predict out), 5.0 | `gauge + s` | 22.46, 23.26, 23.56, 24.26, 24.76, 25.76, 26.26, 27.26 |
| 6f | the crossing: the readout swaps to "Now: adding" (the old out 0.1 s, then the new in 0.15 s, linear) **[B-01: 183]**, the other hatch | `L.GAUGE.cross(606)` of the note (7.0 s) | 29.26 to 29.51 |
| 6f | "added" lands, once its region shows **[B-01: 183]** | the crossing + 0.45 | 29.71 |
| 6g | the held-back hatch lights; ribs and dome glow + "with your breathing muscles,"; "never your throat" | `word('b13', 'hold' / 'breathing' / 'never')` | 32.48; 33.77; 34.87 |
| 6h | the cursor back (0.4 s), the lungs fill; a light down the falling line (1.0 s), the lungs pull in; held back lights | `word('b14', 'full' / 'spring' / 'harder')` | 36.17; 37.10; 39.73 |
| 6h | the cursor walks 0 to 3.5 s (sine.inOut), the readout switching back at the crossing; dome glow; "held back" 1.2 | `word('b14', 'so')` to `word('b14', 'back#2')`; `'breathing-in'`; `'holding'` | 42.67 to 47.47; 43.73; 46.04 |
| 6i | b13's labels leave; the cursor runs to 8.5 s (1.27 s), switching at the crossing | `at('b15')`; `word('b15', 'the')` | 48.20; 48.47 |
| 6i | belly wall in, belly and ribs glow, "belly and rib muscles", added lights | `word('b15', 'belly')` | 50.24 |
| 6i | the solid arrow (0.3 s); the strike, "can't push air out" with its leader | `word('b15', "can't")`; + 0.43 | 54.57; 55.00 |
| 6j | the struck arrow, its label and "belly and rib muscles" fade (0.3 s) | `at('o7') + 0.01` | 56.17 |
| 6j | the cursor back, lungs fill, the falling line's first stretch glows; held back lights, "held back" 1.2 | `word('o7', 'full')`; `word('o7', 'hold')` | 56.59; 60.47 |
| 6j | the cursor and readout fade (0.2 s) | `at('o7', 'end', 0.16)` | 61.64 |
| 6k | "one 10-second note" leaves; Quiet (lit) and Loud land | `at('b16')` | 61.88 |
| 6k | Loud lit, Quiet dims; "what the note needs", "held back", "added" fade | `word('b16', 'loud')` | 62.85 |
| 6k | the gold line rises (power2.inOut, `clamp(less - note, 0.5, 0.8)` = 0.575 s) | `word('b16', 'note')` | 63.30 |
| 6k | "less holding back at first" + leader; "what the note needs" (Loud); "more adding as the air runs low" + leader | `word('b16', 'less' / 'back' / 'more')` | 63.88; 64.53; 66.05 |

## The split's curves (the provisional value, settled)

`L.GAUGE.split` was provisional. Settled, in the scene (`SPLIT_C`), u the split's progress over 1.5 s:

- the band **rises** over u 0 to 0.35, power2.out (y from the 0.78 place to the small band's 160 to 240);
- it **slides right** over u 0.15 to 0.75, power2.inOut (x 466 to 1340 to 760 to 1640);
- the **strip and the line's weight** move over u 0 to 1, power2.inOut (the strip to the gauge's floor, y 690);
- the **figure** draws on power2.in over 1.0 s from u 0.067, so its head (x 389 to 561) is drawn after the band and
  its "A3" have passed;
- "A3" rides the band: right end `band.x0 - lerp(26.5, 20, ux)`, baseline `line + lerp(13.26, 12, uy)`, 37.44 to 36 px.

Proof (probe, u 0.10 to 0.90, `probe.json`): the band's right end passes x 1347 between u 0.25 and 0.30 with its foot
about 55 px over the chip's top (y 245 at u 0.25, 241 at u 0.30; the chip's top 300; board: 12 or more); the band keeps 181 px or more from the drawn
outline, "A3" 115 px or more. Stills: `sheet-split.png` (u 0.10 to 0.90), `probe-5.09.png` to `probe-6.54.png`,
and `clip-still-5.46.png`, `clip-still-5.76.png`, `clip-still-6.14.png` from the clip.

## Departures from the board, with numbers

1. **"added" lands 0.45 s after the readout's switch** (29.71; B-01, DECISIONS 183; it had landed at the crossing).
   Its glyphs 15.5 px under the gold line, 20.7 px over the lungs' line (probe).
2. **"Hold it back"'s check** stands right of its capsule at x 1446: the 30 px between the two pills cannot hold a 22 px
   check 12 px from both. The ring timer has gone by then (it ends at 21.91, the check lands at 25.76). S1's
   check now sits the same way (DECISIONS 166), so this is the shared rule.
3. **The readout switches at every crossing of the gold line by the cursor** (four: 29.26, and three found by
   bisection on the cursor's own walk in 6h, 6i and 6j), each a swap (the old out in 0.1 s, then the new in 0.15 s,
   B-01), so the words never disagree with the cursor and never sit glyph on glyph.
4. **The figure's breath follows the cursor** through the gauge and the walks (full at 0 s, empty at the crossing,
   the belly wall in by 0.6 of a breath after it, FACTS 17 and Q27); after "Yes." it eases back to rest over 1.5 s so
   the last frame has the figure at rest, as HANDOFFS § S6 to S7 fixes it (breath 0.000).
5. **6i's "can't push air out"** (30 px, right-aligned world 350, baseline 580) measures 244 px wide, not the board's
   270: it spans screen x 64 to 308 at F-gauge, 29.4 px over "diaphragm"'s ink (board 29).
6. **6b's guess** waits for the figure on this clock: "diaphragm?" + 0.13 is 5.64, before the figure has drawn (6.04).
   On the board's clock the two coincide (112.00).

## Built locally (the kit might offer)

- The split itself (`split(u)`, the curves above) and "A3" riding the band.
- The readout's switch scheduler (`SWITCHES`, crossings by bisection; `readoutAt`, the swap in two steps) and the
  cursor's piecewise walk.
- The readout's own plate (`roPlate`, the shown wording's box + 4 px, measured each frame): it stays at full while
  both wordings are faint mid-swap; it grows to the wider wording's box while the old words leave (0.1 s) or shrinks
  to the narrower once they have gone (0.15 s), so every glyph drawn sits on it and the cursor at the crossing is
  behind it or clear of the words on every frame (B-01).
- The figure's breath as a function of the cursor (`breathOf`).
- 6j's "first stretch glows": a 9 px white path at 35 % over the lungs' line from 0 to 3.5 s.
- The struck arrow and strike (two `L.arrow`s) for 6i.

7. **The cursor fades up linearly over 0.4 s** (21.16 to 21.56) where it stands at the frame's left edge: an eased
   0.3 s ramp put the whole thin line's change into two frames, which `measure.py` flagged as a pop at 21.30 (0.11 %).
8. **Layering marked for the layout audit**: "diaphragm" (world 350, 640) sits inside Merc's video square at
   F-gauge, transparent there and 30 px from his drawn body (`data-layout-allow-occlusion`); the readout's two
   wordings share one place and switch (`data-layout-allow-overlap`).

## Fix round B-01 (critic B-01, DECISIONS 180 to 189)

| Item | Change (file, line) | Before | After | Proof (`fix-B-01/`) |
| --- | --- | --- | --- | --- |
| 3, plates (182) | `backPadX: 4, backPadY: 4` on every backed label (s06-diaphragm.html line 162); places `GP` (line 151): "push of air (not pitch)" baseline 275 to 276, "the lungs' own push" 325 to 327, "what the note needs" 640 to 646, the readout from (1640, 275) to right-aligned 1630, baseline 382, under the chip; the readout's own plate `roPlate` (line 161, drawn lines 320 to 330) | at 45.0 (critic's frame): the gold line hidden x 748 to 1047, the small band's lower edge 765 to 1073 and 1359 to 1660, the frame's top stroke 751 to 1031 (screen px) | at 32.31, 45.00, 55.50, 68.75: the band's edge and the frame's top shown on all 921 columns, the gold line on 912 or 913 (its only gap, 7 to 8 px, is where the lungs' line crosses it, a stroke over a stroke); every plate covers no stroke (probe at 26.16, 30.06, 32.31, 45.00, 55.50); "what the note needs"'s plate 4.5 px under the gold line; the readout's plate fits the shown wording, 4.0 px each side | `plates-45.0.png` (before and after), `strokes-before.txt`, `strokes.txt`, `gold-gaps-are-the-crossing.png` |
| 4, the readout's swaps (183) | `switchAt`, `readoutAt` (lines 204 to 211): the old wording out in 0.1 s, then the new in 0.15 s, linear; `ADDED = CROSS1 + 0.45` (line 71); the readout's plate (lines 320 to 331) grows to the wider box while the old words leave, or shrinks to the narrower once they have gone | glyph on glyph for 2 to 3 frames at 29.37 to 29.43, about 36.45 and about 49.4; "added" at 29.27, before the switch | 0 frames with both wordings at any of the four switches (29.26, 36.34, 49.20, 56.73; the probe walks every frame at 30 fps for 0.3 s from each); on every one of those 40 frames the wording drawn sits on its plate and the cursor is behind the plate or clear of the words; "added" lands at 29.71, 0.45 s after the switch | `readout-swaps.png` (every frame of the four swaps), `../dense-swaps/` |
| 5, the ghost envelope and "level" (184) | the strip's `rest` envelope in `ch.draw` (line 248), "level" at S5's last place (line 99 on) | the strip a hairline, "level" on the slider's row | the first frame carries S5's last: the resting envelope in ghost violet and "level" right-aligned 366 at the strip's height; the envelope fades as the split begins (4.94, 0.3 s, linear) | `clip-still-0.00.png`, `clip-still-3.22.png` |
| 7, the hosts at the cut (186) | none: tags and offsets are right | see `../s07-support/BUILD-NOTES.md` § Fix round B-01: Merc's own eye turn in the pass (pass frames 3375 to 3377), for the passes step | - | `../s07-support/fix-B-01/cut-hosts-frames.png` |
| 9, the legs (188) | `F6 = { ...L.FIGURE.S6, fade: [730, 760] }` (line 125; the kit's [750, 780]) | the legs' strokes about 7 px over "with your breathing muscles," | the legs' lowest visible point 20.8 px over its ink | `legs-36.5.png` (before and after) |
| 10, holds (189) | no motion added | 4.6 s inside the film (2.0 s per 30 s), longest 0.5 s | 4.5 s inside the film (2.0 s per 30 s), longest 0.4 s: 0.00, 4.40, 4.60 (0.3), 10.60, 14.80, 17.20, 18.00, 18.20 (0.2), 19.60, 34.20 (0.3), 34.60 (0.2), 38.30, 38.60, 39.00, 40.90, 42.20 (0.4), 48.00 (0.2), 49.80, 52.10, 52.60, 53.00, 53.20 (0.3), 54.00, 54.20, 54.40, 55.80, 58.20, 58.40 (0.3), 65.60, 65.80, 67.80; 0.1 s each unless marked; the final 0.1 s at 68.60 exempt | `measure/summary.md` |

Seen, not fixed: "never your throat" (world baseline 838, the board's place, STORYBOARD 6g and HANDOFFS § The breath
figure) sits on the room's floor horizon at F-gauge (screen y 840 runs through its x-height, 34.87 to 48.20;
`throat-on-horizon-36.5.png`). DECISIONS 188 names only S7's row 4 for the horizon. Clearing it by 12 px means
moving both lines up 27 px and shortening the legs a further 18 px in S6 and in S7's first frame; left for the
director.

## Proof (after the fix round, 19 November)

- Probe: 245 of 245 pass (`probe.json`; checks in `checks.js`, the B-01 ones marked; 40 of them walk the four swaps
  frame by frame). The last frame against HANDOFFS § The cuts S6 to S7 as before (frame x 738 to 1662, y 279 to 731;
  the gold line 451.45; the figure at rest, breath 0.000; no cursor, no readout).
- Clip `clip.mp4` (30 fps, the scratch voice, 19 November 12:25, after the readout's plate was fitted); stills
  `clip-still-*.png` at 0, 3.22, 5.76, 6.14, 8.09, 12.13, 19.19, 21.60, 26.16, 29.40, 30.06, 31.50, 32.31, 35.37,
  36.50, 45.00, 49.40, 55.50, 62.48, 66.65, 68.75. Hosts looked at on every still.
- `measure.py render` (`measure/summary.md`): holds as in the table above; single-frame events four, all a host's blink
  in its own pass (38.033 and 51.833 Merc's eyes, the first with the light down the falling line reaching its end in
  the same frame; 55.400 and 58.833 Tavi's; 0.03 to 0.05 % of pixels). Integrated -19.8 LUFS, true peak -1.5 dBTP.
- The S6 to S7 join, re-made from this clip (`../s07-support/cut-s06-s07.mp4`): `measure-cut/summary.md` finds no
  single-frame event; every frame on `../s07-support/dense-cut/dense-000.50s-30fps.jpg`.
- `dense-swaps/` (the four swaps, every frame) and `dense-cursor/dense-030.70s-30fps.jpg` (29.1 to 32.3).
- `check lab/s06-diaphragm/proj --at=26.16,29.38,30.06,45.00,66.65`: contrast 62/62, layout 0 issues, lint 0 errors
  (warnings: the kit's duplicated host video entry; the file's 367 lines).
- clock-lint silent; `merc-tags.py s05-push s06-diaphragm s07-support --check` (12:30): 12 tags, 0 stale, 0 problems.

## Proof (round 1, kept for the record)

- Probe (`probe.json`, `probe-*.png`, `sheet-*.png`, `sheet-split.png`; checks in `checks.js`): 157 of 157 pass
  (19 November). Its numbers: the card 1665 px wide (cap 1680); the chip at x 1359 to 1630, y 300 to 340, 19.9 px right
  of the plot and 25.5 px over the band (LAB-CHECKS 11); the split as above; the head 33 px under the kicker; the
  frame's top edge at 317 (128.97) and 292 (129.18), the chip drawn above the stroke and 9 px in from both strokes;
  "added" 15.5 px under the gold line and 20.7 px over the lungs' line; F-gauge: frame x 738 to 1662, y 279 to 731,
  scale 1.05, the head's crown y 125; LAB-CHECKS 5: "can't push air out" from screen x 64, 29.4 px over "diaphragm";
  LAB-CHECKS 8: "Quiet" and "Loud" 13.7 px from the stroke and 14.7 px apart, 24.2 px from the chip (board 22), the two
  labels 141.7 px apart across and 11.6 px in height (board 12), "what the note needs" (Loud) 12.1 px over the gold
  line, the leader (900, 740) to (900, 430); keep-out 30 px or more on every frame tested.
- First frame against S5's last and last frame against S7's first, by region (`../s05-push/cutdiff.py`): best shift
  (0, 0) in every region; mean residual 0.3 to 2.0 of 255.
- Clip: `clip.mp4` (30 fps draft with the scratch voice, re-rendered 19 November 09:47, after the passes' re-render);
  stills `clip-still-*.png` at 0, 1.35 (card), 3.22 (glide landed), 5.46, 5.76, 6.14 (split), 8.09, 12.13 (6c), 17.00,
  19.19 (6d), 21.26 (opened), 21.60 (the cursor up), 24.98, 26.16, 29.61 (6f), 32.31 (F-gauge), 33.00, 35.37 (6g),
  40.00, 46.00 (6h), 55.50 (LAB-CHECKS 5), 62.48, 66.65 (LAB-CHECKS 8), 68.75 (the last frame). Hosts looked at on every
  still: at 300 to 2.42, shrinking to 240 in place, Merc singing with arcs through 6f.
- `measure.py render` (`measure/summary.md`): holds 4.6 s inside the film (2.0 s per 30 s), longest 0.5 s, none in
  6f; single-frame events: four, all a host's blink in its own pass (38.033 and 51.833 Merc's eyes, 55.400 and 58.833
  Tavi's; 0.03 to 0.05 % of pixels); none of the scene's own. Integrated -19.8 LUFS, true peak -1.5 dBTP.
- **LAB-CHECKS 20** (6f, 22.26 to 32.26): no hold in the 10 s (`measure/motion.csv`): every 0.1 s sample's mean change
  0.28 or more (median 0.65; the 4 s before the push: median 0.07), its largest change 72 or more. The push registers
  and the room's layers part (L.frameRig; F-gauge reached at scale 1.05, probe).
- **LAB-CHECKS 11**: `dense/dense-002.80s-30fps.jpg` (the glide), `dense/dense-005.70s-30fps.jpg` (the split),
  `dense/dense-020.95s-30fps.jpg` (the opening's end and the cursor fading up): every frame, the chip crossed by
  nothing, the frame's top stroke behind it.
- **LAB-CHECKS 12**: `dense-cursor/dense-030.70s-30fps.jpg` (29.1 to 32.3, every frame) and `cursor-chip-sheet.png`
  (the chip and readout at full size either side of each change peak): the cursor passes behind the readout's back
  and the chip's body with no flicker in either.
- `check lab/s06-diaphragm/proj --at=24.98,26.16,29.61,62.48,66.65` (LAB-CHECKS 18 for 6f and 6k): contrast 62/62,
  layout 0 issues, lint 0 errors (warnings: the kit's duplicated host video entry; the file's 338 lines).
- clock-lint silent; `merc-tags.py s06-diaphragm --check`: 4 tags, 0 stale, 0 problems.
