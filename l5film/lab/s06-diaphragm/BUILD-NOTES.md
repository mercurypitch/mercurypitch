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
| 6b | the split (1.5 s, the settled curves below); the slider and the label row's text fade (0.2 s) | `word('o6', "isn't")` | 4.94 |
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
| 6f | the crossing: readout switch to "Now: adding", "added", the other hatch | `L.GAUGE.cross(606)` of the note (7.0 s) | 29.26 |
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

1. **"added" lands at the crossing** (29.26), with the readout switch (DECISIONS 144, HANDOFFS [kit-01: 2]): the
   board's v3 row still names 7.45 s. Its glyphs 15.5 px under the gold line, 20.7 px over the lungs' line (probe).
2. **"Hold it back"'s check** stands right of its capsule at x 1446: the 30 px between the two pills cannot hold a 22 px
   check 12 px from both. The ring timer has gone by then (it ends at 21.91, the check lands at 25.76). S1's
   check now sits the same way (DECISIONS 166), so this is the shared rule.
3. **The readout switches at every crossing of the gold line by the cursor** (four: 29.26, and three found by
   bisection on the cursor's own walk in 6h, 6i and 6j), each an `L.swap`, so the words never disagree with the cursor.
4. **The figure's breath follows the cursor** through the gauge and the walks (full at 0 s, empty at the crossing,
   the belly wall in by 0.6 of a breath after it, FACTS 17 and Q27); after "Yes." it eases back to rest over 1.5 s so
   the last frame has the figure at rest, as HANDOFFS § S6 to S7 fixes it (breath 0.000).
5. **6i's "can't push air out"** (30 px, right-aligned world 350, baseline 580) measures 244 px wide, not the board's
   270: it spans screen x 64 to 308 at F-gauge, 29.4 px over "diaphragm"'s ink (board 29).
6. **6b's guess** waits for the figure on this clock: "diaphragm?" + 0.13 is 5.64, before the figure has drawn (6.04).
   On the board's clock the two coincide (112.00).

## Built locally (the kit might offer)

- The split itself (`split(u)`, the curves above) and "A3" riding the band.
- The readout's switch scheduler (`SWITCHES`, crossings by bisection, `L.swap`) and the cursor's piecewise walk.
- The figure's breath as a function of the cursor (`breathOf`).
- 6j's "first stretch glows": a 9 px white path at 35 % over the lungs' line from 0 to 3.5 s.
- The struck arrow and strike (two `L.arrow`s) for 6i.

7. **The cursor fades up linearly over 0.4 s** (21.16 to 21.56) where it stands at the frame's left edge: an eased
   0.3 s ramp put the whole thin line's change into two frames, which `measure.py` flagged as a pop at 21.30 (0.11 %).
8. **Layering marked for the layout audit**: "diaphragm" (world 350, 640) sits inside Merc's video square at
   F-gauge, transparent there and 30 px from his drawn body (`data-layout-allow-occlusion`); the readout's two
   wordings share one place and switch (`data-layout-allow-overlap`).

## Proof

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
