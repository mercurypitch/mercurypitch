# s11-sing: build notes (group D)

`compositions/s11-sing.html`, 39.17 s on the scratch clock (film 346.42 to 385.59: from the matched cut 0.15 s before
`sing` to the cut on b38). STORYBOARD 11a to 11e; HANDOFFS § The hold frame at the right half, § The turn, § The cuts
S10 to S11 (matched) and S11 to S12. F0 throughout; the room crossfades from F-hold to rest over 0.3 s
(`L.roomCut(room, { from: 'F-hold' })`). Hosts at 300 in the corners (m-blue-s11, m-orange-s11).

## Rows and anchors (scene time; the scratch clock)

| Row | What | Anchor | Scratch |
| --- | --- | --- | --- |
| 11a | the empty frame on S10's pixels (`L.bandChart(world, L.TURN.FRAME)`, i.e. `L.CHART.FRAME`, Merc's line 4 px); the room crossfades from F-hold (0.3 s) | the cut | 0 to 0.30 |
| 11a | the frame dims to 25 % (0.2 s, linear) | `at('sing')` | 0.15 |
| 11a | card "Sing it" (no numeral, `L.chapterCard`), out up fast | `sing + 0.22`; `at('b34', 'start', -0.5)` | 0.37; 1.85 to 2.23 |
| 11a | the frame back to full as the card leaves (0.38 s, linear) | the card's exit | 1.85 to 2.23 |
| 11b | "Your turn." (serif italic 110, x 260, baseline 200; 0.3 s, linear) | `word('b34', 'Your')` | 2.37 |
| 11b | the frame's band glows (fill 12 to 24 %, up 0.3, held 0.5, down 0.8) | `word('b34', 'comfortable')` | 4.00 |
| 11b | the bracket under the frame (0.5 s from its middle) with "0" and "10 s" (one object; the labels as its ends arrive) | `word('b34', 'ten')` | 5.42 |
| 11b | "Nothing listens" (x 1000, baseline 402), to the end of the turn | `max(word('b34', 'seconds'), bracket + 0.4)` | 5.82 |
| 11c | the doctor lines, small (Inter 30, ink-2, `L.TURN.breakLines` at 700 px; 0.3 s, linear) | `word('b35', 'care lines')` | 7.58 |
| 11c | the care icon (`L.icon` 'leaf' at (260, 236), 36 px) and "Sore, hoarse or unwell today?" | `word('b36', 'Sore')` | 12.87 |
| 11c | "Just listen along." | `word('b36', 'Just')` | 15.40 |
| 11d | "hurts or uncomfortable" | `word('b37', 'hurts')` | 18.78 |
| 11d | "· unusually hoarse or tired" | `word('b37', 'unusually')` | 23.21 |
| 11d | "usual notes suddenly gone" | `word('b37', 'suddenly')` | 28.05 |
| 11d | "· ill" | `word('b37', 'ill')` | 29.80 |
| 11d | "talking or singing is hard work" | `word('b37', 'talking')` | 31.43 |
| 11e | the ring draws on under the frame (0.8 s, its 12 o'clock tick last; 35 %, no counter) | `word('b37a', 'Listening', 'start', 0.05)` | 35.34 |
| 11e | "listening along: rest your voice and watch the ring" | `word('b37a', 'Rest')` | 36.83 |
| 11e | the ring scales 1.05 once (`L.pulse` 'ring') | `word('b37a', 'the ring')` | 38.23 |

The closest two landings are 0.40 s apart (the bracket with its labels, "Nothing listens"). Every other landing is
1.49 s or more from its neighbours (`lab/s12-your-turn/tools/landings.py` prints the sweep for both scenes).

## Departures from the board, with numbers

1. **The doctor lines break into four lines at 30 px, not five.** HANDOFFS § The turn says five lines at baselines 650
   to 802, "broken where the font puts them within 700 px"; the real font (the kit's `L.TURN.breakLines`) puts them in
   four, at 650, 688, 726 and 764 (widths 686.4, 632.8, 657.0 and 547.5 px). The block's foot is then y 771 (ink), not
   about 809. Word for word: the four lines joined are `L.TURN.CARE.doctor`.
2. **The reasons' middot lands with the phrase after it** (the board lands each phrase on its word and joins them by
   middots): "· unusually hoarse or tired" and "· ill" are each one label, placed where the whole line sets them
   (measured once the fonts are in), so each line reads as the kit's string when whole.
3. **The phase row is uppercase** in S12 (mono 28, ink-2, tracking .18em), as the kit's lab sets it; the board writes
   it "Listen · Breathe · Sing". Built in the shared block here, shown in S12 only.
4. **Fades made linear for measure.py** (DECISIONS 179): the frame's dim (0.2 s) and its return (0.38 s), "Your
   turn." (0.3 s), the doctor lines (0.3 s).

## Built locally (the kit might offer)

- **The turn's block** (`turnObjects(world, hud)`, the same code in s11-sing and s12-your-turn, so both draw the same
  pixels either side of the cut on b38): the frame, its bracket with "0" and "10 s", the two voices with their dots
  (each a group that pulses about its dot's left baseline), "Nothing listens", "Breathe in, low and quiet", the ring,
  the phase row with each word its own text laid out from the row's measured advance, its two lines, the playhead,
  the ring's echo; the care block from `L.TURN.CARE`, the reasons split at their middots, the doctor lines. A kit
  `L.turnBlock` would keep the two scenes in step from one definition.
- **The cut probe** (`cutprobe.mjs sing|recap`): either matched cut's last 0.5 s and first 0.5 s, every frame seeked
  in Chromium, joined for measure.py, with the true 60 fps frame pair and the carried object's boxes either side.

## Proof

- Probe (`probe.json`, `probe-*.png`; checks in `checks.js`, run by `lab/s05-push/probe.mjs`): 55 of 55 pass. The first
  frame: the band x 1000 to 1640, y 210 to 280, Merc's line at y 245, 4 px, x 1000 to 1640, no labels; the room's ghost
  at 1 over the room at rest, 0.5 at 0.15 s, gone by 0.34 s; the frame at 25 % under the card, back to full by 2.25;
  "Sing it" centred x 961.9, its top 29 px under the band's foot; "Your turn." ink x 266.0 to 662.7, y 120 to 201; the
  bracket x 1000 to 1640 at y 292 (ticks up 8), "0" from 1001, "10 s" to 1639.7, foot 323, 8 px under it; "Nothing
  listens" ink x 1002 to 1200, y 380 to 409, 57 px under "0"; the doctor lines four lines within 700 px, word for word;
  the icon's ink x 267.5 to 288.5, y 240.5 to 267.5 inside its 36 px box at (260, 236); the comfort line from x 310
  (ink to 794.6), "Just listen along." to 584.9; the reasons from x 310, each middot one space (6.0 px of ink gap) after
  its phrase, line 1 to x 958.7; the care block's ink within x 260 to 958.7 and above y 771; the ring centre (1320,
  590), r 160, no word or counter, its track 21 px under "Nothing listens"; the listening line x 261 to 912; the ring at
  1.05 on "the ring."; the last frame as HANDOFFS § S11 to S12 (16 texts: the block, four doctor lines, the bracket's
  two, "Nothing listens"; the ring at 35 % at rest). No two visible texts overlap at any time tested; the keep-out 70.5
  px (Merc, the doctor lines) and 328 px (Tavi, "10 s").
- **LAB-CHECKS 2, the matched cut on `sing`** (`cut-sing/`, `cutprobe.mjs sing`): S10's last frame (group C's
  `s10-steady.html`, seeked to D - 0.0005) against S11's first: the band x 1000 to 1640, y 210.01 to 280.01 against
  210.00 to 280.00; Merc's line y 245, x 1000 to 1640, 4 px on screen on both; no labels on either. By region
  (`cutdiff.txt`, `lab/s05-push/cutdiff.py`): best shift (0, 0) for the band (residual 2.08 of 255), the line (8.72) and
  the band's top edge (4.42), the same on the true 60 fps film frames either side (`out60.png`, `in60.png`). The
  residuals are S10's raster at 1.3x, not a move: its edges are 2 world px at 1.3 (2.6 px, a fringe row at y 208 and
  211, red 48 and 71 against the ground's 18 and the fill's 46) where S11 draws 2 px at F0, and the line's softer edge
  rows (DECISIONS 191 accepted it). `cut-sing.mp4` (S10's last 0.5 s and S11's first 0.5 s, 30 fps, frame 15 the
  first after the cut; `sheet.png` the eight frames round it): `measure/summary.md` finds no single-frame event (no pop,
  no flash, no empty frame), one 0.1 s hold (hosts hidden in the probe).
- Clip: `clip.mp4` (30 fps draft, the whole scene, with the scratch voice; MIX=voice); stills `clip-still-*.png` at 0,
  0.15, 0.40, 1.27, 2.25, 2.77, 4.20 (the band's glow), 6.22, 7.98, 13.17, 15.70, 19.07, 23.51, 28.35, 31.73, 36.23,
  37.12, 38.38, 39.15 (the last frame). Hosts at 300 on every still; Merc's talking arcs reach x 210 to 229 beside the
  doctor lines at x 260.
- `measure.py render` (`measure/summary.md`): holds 3.5 s inside the clip (2.7 s per 30 s), longest 0.5 s; mapped
  against the voice (`../s12-your-turn/tools/holds.py`), 1.7 s fall in Merc's pauses (0.39 to 0.70 s long) and 1.8 s
  inside words, where his mouth moves under the measure's 16-level threshold at 320 px (DECISIONS 189: the final
  passes' idles). Single-frame events: 0.800 and 1.467 (jumps, 0.29 and 0.25 % of pixels, inside the card "Sing it":
  the kit card's breathing scale snapping its glyph edges, as S10's card at 1.467), 0.033 (jump, 0.04 %, the room's
  crossfade starting), 10.833 and 32.267 (pops, 0.05 and 0.06 %, the hosts' blinks), 17.067 (jump, 0.09 %, the hosts
  and a dust mote). Integrated -20.0 LUFS, true peak -1.2 dBTP.
- `check lab/s11-sing/proj --at=1.27,6.22,13.17,31.73,37.12` (`check.log`; the card, the bracket's labels, the
  comfort line, the reasons, the listening line): contrast 45/45, layout 0 issues, lint 0 errors (one warning: the
  kit's duplicated host video entry).
- **LAB-CHECKS 21 for these lines** (real widths, measured in the probe with the film's fonts): "Your turn." ink x 266.0
  to 662.7; "Sore, hoarse or unwell today?" 310.0 to 794.6; the reasons' first line to 958.7 (1.3 px inside the block's
  960), the second to 690.4, the third to 705.4; the listening line 261.0 to 912.1; the doctor lines 547.5 to 686.4 px
  wide (within 700); "Nothing listens" 1002.0 to 1200.1; "0" from 1001.0, "10 s" to 1639.7.
- clock-lint silent; `merc-tags.py s11-sing --check`: 4 tags, 0 stale, 0 problems.
- The root check (`npx hyperframes@0.8.97 check` over the film, after the final renders; `../s12-your-turn/root-check.log`):
  check passed, lint 0 errors and 19 warnings (for this group: the kit's duplicated host video entry in both scenes, and
  s12-your-turn's 337 lines; the rest are other groups'), runtime 0 errors, layout 0 issues across 9 samples, motion 0
  errors, contrast 56/56.
