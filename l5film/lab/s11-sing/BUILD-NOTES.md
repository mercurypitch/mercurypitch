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

(filled below once measured)
