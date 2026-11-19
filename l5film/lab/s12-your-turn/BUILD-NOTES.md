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

(filled below)

## Built locally (the kit might offer)

(filled below)

## Proof

(filled below)
