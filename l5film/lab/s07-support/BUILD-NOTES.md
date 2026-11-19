# s07-support: build notes (group B)

`compositions/s07-support.html`, 36.390 s on the scratch clock (film 171.495 to 207.885: from the matched cut on
`o8` to the cut 0.15 s before `act3`). STORYBOARD 7a to 7e; HANDOFFS § The mix-up card, § The breath figure (S7),
§ The cuts S6 to S7 (matched) and S7 to S8. F0 throughout: every move is an object move. The room crossfades from
F-gauge to rest over 0.3 s (`L.roomCut(room, { from: 'F-gauge' })`). Hosts at 240 from the 300 chunks
(m-blue-s07, m-orange-s07).

## Rows and anchors (scene time; the scratch clock)

| Row | What | Anchor | Scratch |
| --- | --- | --- | --- |
| 7a | the room crossfades from F-gauge to rest (0.3 s) | `at('o8')` | 0 to 0.30 |
| 7a | the gauge's hatches, lines, chips, labels, its chip, "A3" and the figure's labels fade (0.5 s) | `o8 + 0.07` | 0.07 to 0.57 |
| 7a | the gauge folds back; the small band and strip glide into the chart (`L.MIXUP.REASSEMBLE`, 1.4 s), the chart takes over on the same pixels (0.3 s) | `o8 + 0.17` | 0.17 to 1.57; 1.57 to 1.87 |
| 7a | the figure dims to 35 % and shrinks to its parked place (1.0 s) | `o8 + 0.17` | 0.17 to 1.17 |
| 7a | "COMMON MIX-UP" | `word('o8', 'support')` | 0.50 |
| 7a | row 0, the belief, as a guess (its dashed underline draws to "squeezing?" + 0.3) | `word('o8', 'pushing')` | 2.70 |
| 7a | row 0's last word and its "?" | `word('o8', 'squeezing')` | 4.02 |
| 7b | "COMMON MIX-UP" scales 1.08 | `word('b17', 'mix-up')` | 5.84 |
| 7b | "ILLUSTRATION" under the strip's right end | `word('b17', 'pushing')` | 6.93 |
| 7b | the pushed take redraws, silent, at 2.5x (1.6 s) | `pushing + 0.1` | 7.03 to 8.63 |
| 7b | the band's edge lit with "in the band" (0.4 s, linear) / dark as the centre leaves | `max(entry, pushing + 0.4)` / the take's +35 c crossing | 7.33 / 8.13 |
| 7b | the hold, then the shrink into row 1 (0.41, 0.6 s, power2.inOut); row 1 and its chip land | `clamp(squeezing - 0.56 - 0.6 - redraw's end, 0, 0.5)` | hold 0; 8.63 to 9.23; 9.23 |
| 7c | row 2's first line "squeeze: a pressed sound," | `max(word('b18', 'squeezing'), row 1 + 0.4)` | 9.63 |
| 7c | the press pair draws (0.8 s) with "same push: much quieter" | `word('b18', 'pressed')` | 11.08 |
| 7c | "pressed" scales 1.08 | `word('b18', 'heavy')` | 14.76 |
| 7c | "more pressure, not less" | `word('b18', 'more')` | 17.06 |
| 7c | the pair shrinks into row 2 (0.5, 0.6 s); "one push of air" and the large names fade; the small names land | `word('b18', 'not', 'start', -0.35)`; + 0.6 | 18.15 to 18.75; 18.75 |
| 7d | the four words return; '"support"' lights, the large word lands | `at('b19', 'start', -0.51)`; `at('b19')` | 19.20; 19.71 |
| 7d | "how singers manage the breath" | `word('b19', 'word')` | 21.41 |
| 7d | the four words leave | `word('b19', 'as')` | 23.51 |
| 7d | "no one agreed meaning" | `word('b19', 'no')` | 25.21 |
| 7d | the word and its phrases shrink into row 3 (0.6 s; the serif word gives way to the row's in the last 0.25 s) | `word('b19', 'meaning', 'start', -0.19)` | 26.07 to 26.67 |
| 7e | "The better idea:" (0.3 s, linear) | `at('b20')` | 27.24 |
| 7e | the four phrases | `word('b20', 'steady#2' / 'breathe' / 'start' / 'flow')` | 28.40; 30.77; 32.00; 34.40 |
| 7e | the figure at full, breathes in (1.5 s, sine.inOut); eases back and dims (0.8 s) | `word('b20', 'breathe')`; + 1.57 | 30.77; 32.34 |
| 7e | the rows leave up fast, top to bottom, `min(0.05, (D - out - 0.35) / 4)` apart; the miniatures fade (0.4 s) | `at('b20', 'end', 0.05)` | 35.89, 0.0375 apart |

## 7c's timings (board v3)

Row 2's three lines land on their own words, as v3 asks: the first on "Squeezing" (held to 9.63, 0.18 s after the
word, for the 0.4 s rule after row 1 at 9.23; on the board's clock the formula gives 187.36, the board's own), the
pair and "same push: much quieter" together on "pressed" (11.08), "more pressure, not less" on "more" (17.06). The
names land as the pair settles (18.75); the four words 0.45 s later (19.20), as the board spaces them.

## Departures from the board, with numbers

1. **7b's band edge lights beside "in the band"** (the board names the edge "going dark as its centre leaves";
   STORYBOARD § Codes: the lit edge always stands beside the words "in the band"). Lit from 7.33 (0.4 s after the
   chip) to 8.13; "in the band" right-aligned 366, baseline 540, 45 px under the parked figure's masked foot.
2. **7b's hold is 0 s on the scratch clock** (board 0.5 s): the redraw ends 0.82 s before "squeezing", too little for a
   0.5 s hold, a 0.6 s shrink and the board's 0.56 s to row 2. The formula keeps the board's 0.5 s on the board's clock.
3. **The pushed take's highest point is 91 px under row 0's underline** (board 56): at k 2.5 about the band centre
   470, the take peaks at y 285 (HANDOFFS has 250). Nothing collides; the numbers in HANDOFFS § The mix-up card want
   updating.
4. **The chart's chip and row 1's chip are two chips**: the chart's lands on "Pushing" and fades as the chart
   shrinks (0.2 s); row 1's own chip (`L.MIXUP.ROW1.tag`, from x 360, centred y 345) lands with row 1, as the board
   puts it ("with ILLUSTRATION under it"). HANDOFFS says the chip moves to its row-1 place: from (1520, 790) to
   (360, 345) that move would cross the shrinking chart and land through row 1's words as they arrive, so the kit's lab
   page's way (one fades, one lands) is built instead.
5. **Everything S6 left on screen fades in 7a's 0.5 s**: besides the gauge's marks and chips, "the note: unchanged",
   "push of air (not pitch)" and its arrow, "the lungs' own push", "A3", and the figure's "lungs", "diaphragm" (with
   its leader) and "belly", none of which the board's 7a names.
6. **7e's rows leave 0.0375 s apart** (board 0.05): the scene ends 0.5 s after `b20`'s end + 0.05 on this clock.

## Built locally (the kit might offer)

- Row 0's last word held back by a mask (`maskA`, `maskB`, measured with `getSubStringLength` after the fonts) until
  "squeezing?".
- Row 3 as two labels, '"support":' and "how singers manage the breath", so the large phrase (44 px at (980, 800))
  lands exactly after the colon (7.8 px, a space) at 40 px; the serif word scales from its width to the row's.
- Row 4's four phrases with their middots, laid out from the measured widths of the first phrase on each line.
- The band-lit window from the take's own crossings (bisection on `L.CONTOUR.pushed.cents`).

7. **Two fades made linear**: the band's lit edge with "in the band" (0.4 s) and "The better idea:" (0.3 s). Eased
   0.2 s ramps put each one's change into two frames, which `measure.py` flagged as pops (7.433, 0.61 % of pixels;
   27.333, 0.11 %).
8. **Layering marked for the layout audit**: the large serif '"support"' and the row's '"support":' share one place
   in the shrink's last 0.25 s (`data-layout-allow-overlap`).

## Proof

- Probe (`probe.json`, `probe-*.png`, `sheet-*.png`; checks in `checks.js`): 95 of 95 pass (19 November). Its numbers:
  the first frame on F-gauge's pixels (frame x 738 to 1662, y 279 to 731; the gold line 451.45; the chip x 1367 to
  1652; the small band x 738 to 1662, y 143 to 227; the figure's crown (427.73, 124.90)), the room's crossfade half at
  0.15 s and gone by 0.33; the chart reassembled (plot x 400 to 1520, band 382.5 to 557.5, strip 700); the parked
  figure crown y 190, back x 215, 35 %; row 0's underline under the whole row, its "?" 14 px after the last word; "in
  the band" right-aligned 366, 45 px under the figure's masked foot; the wave rule 50 / 69.9 px large and 20.5 / 28.7 px
  in row 1; the swollen strip 14.1 px over "ILLUSTRATION"; the pair at x 860 to 1200 and 1260 to 1600 large, from x
  1180 (top 465) to 1550 in row 2; row 3's phrase 7.8 px (a space) after the colon; no two visible texts overlap at
  any time tested; the last frame empty but for the room, the hosts at 240 and the dimmed figure.
- **LAB-CHECKS 2** (the matched cut at 178.83, scene 0): S6's last frame against S7's first by region
  (`../s05-push/cutdiff.py`): best shift (0, 0) for the gauge, the small band, the figure, the chips, the labels and
  the hosts, mean residual 0.6 to 2.0 of 255 (encode and dust): the carried objects move under 1 px. The joined
  second round it, `cut-s06-s07.mp4` (S6's last 0.5 s and S7's first 0.5 s): `measure-cut/summary.md` finds no
  single-frame event (no pop, no flash, no empty frame); every frame on `dense-cut/dense-000.50s-30fps.jpg`.
- Clip: `clip.mp4` (30 fps draft with the scratch voice, re-rendered 19 November 09:42, after the passes'
  re-render); stills `clip-still-*.png` at 0, 0.15 (the room's crossfade), 0.80 (the fold), 1.92 (reassembled), 4.47
  (row 0), 7.80 (7b lit, LAB-CHECKS 18), 8.20, 9.53 (row 1), 12.08 (7c, LAB-CHECKS 18), 17.36, 18.80 (row 2), 20.31,
  25.70, 26.71 (7d), 27.60, 31.77 (7e), 34.80, 36.36 (the last frame). Hosts at 240 on every still.
- `measure.py render` (`measure/summary.md`): holds 3.0 s inside the film (2.5 s per 30 s), longest 0.5 s;
  single-frame events: two, both Tavi's blinks in her pass (13.567, 34.167; 0.03 to 0.04 % of pixels). Integrated
  -19.9 LUFS, true peak -2.4 dBTP.
- `check lab/s07-support/proj --at=7.80,8.65,9.53,12.08,17.36` (LAB-CHECKS 18 for 7b and 7c): contrast 35/35, layout 0
  issues, lint 0 errors (one warning: the kit's duplicated host video entry).
- clock-lint silent; `merc-tags.py s07-support --check`: 4 tags, 0 stale, 0 problems.
