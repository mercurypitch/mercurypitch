# s05-push: build notes (group B)

`compositions/s05-push.html`, 36.205 s on the scratch clock (film 66.515 to 102.72, the cut 0.15 s before
`act1`). STORYBOARD 5a to 5g; HANDOFFS § The band chart (S5's k, the Push slider, the chart at 0.78, Lesson 1's
figure, the fork, the tags), § The wave rule, § The cuts S4 to S5 and S5 to S6. F0 throughout (every move here is an
object move). Hosts at 300 in their corners, m-blue-s05 and m-orange-s05 (both chunks re-rendered at 21:29 and 22:41,
before this lab's renders).

## Rows and anchors (scene time; the scratch clock)

| Row | What | Anchor | Scratch |
| --- | --- | --- | --- |
| 5a | the chart dims to 25 % ("A3", "level", the row's text hidden while dim) | `at('act1')`, 0.2 s | 0.15 |
| 5a | card "01 What pushing does" in; out up fast 0.38 s, ending 0.12 s before o4 | `act1 + 0.22`; `at('o4', 'start', -0.5)` | 0.37; 1.85 |
| 5a | the chart back to full as the card has gone | card out + 0.38, 0.2 s | 2.23 |
| 5b | the four words leave up fast | `at('o4')` | 2.35 |
| 5b | the pitch axis eases 2.5 to 1.667 px a cent (power2.inOut, 0.6 s) | `at('o4')` | 2.35 |
| 5b | the slider draws, left to right (0.5 s), with "Push" and "50" | `word('o4', 'if')` | 2.37 |
| 5b | "ILLUSTRATION" lands (part of the toy) | slider + 0.45 (the board's spacing) | 2.82 |
| 5b | the thumb scales 1.2 | `word('o4', 'ease')` | 2.87 |
| 5c | the definition (own line, baseline 200) | `word('b7', 'how')` | 5.19 |
| 5c | the four words return; "air pressure" lights (ink, 2 px underline, a 1.08 pulse) | `word('b7', 'pressure') - 0.54`; `word('b7', 'pressure')` | 8.27; 8.81 |
| 5c | "mainly: louder" with its arrow down to the strip; the strip's centre glows | `word('b7', 'mainly')` | 10.12 |
| 5c | the four words leave | `word('b7', 'and', 'start', -0.12)` | 12.87 |
| 5c | "also: a little higher" with its arrow up to the band's top edge | `word('b7', 'nudges')` | 13.32 |
| 5d | "mainly", "also", the definition leave (0.3 s) | `at('b8')` | 14.89 |
| 5d | the line's starting point (400, 400) sends an echo ring | `word('b8', 'watch')` | 15.50 |
| 5d | the plan: out to 100, a hold bar, back to 50 (chrome 40 %); fades | `rises`, `holds`, `eases`; `at('push') - 0.2` | 17.48, 18.13, 18.95; 20.05 |
| 5e | the Push note, its strip and the thumb, one function of the take's time; "LISTEN ONLY" | `at('push')` | 20.25 |
| 5e | the mint edge and "in the band" (0.4 s after "LISTEN ONLY") | push + 0.4 | 20.65 |
| 5e | the centre out (edge dark, "in the band" gone) / back in | the contour's own +35 c crossings, 1.475 and 4.10 s | 21.72 / 24.35 |
| 5e | "above the band" (x 1536, baseline 300) while the whole line is out | the contour's crossings of +49 c, 1.825 and 3.82 s | 22.07 to 24.07 |
| 5f | the line's return glows; "in the band" scales 1.08 | `word('o5', 'it')`; `word('o5', 'back')` | 26.17; 26.70 |
| 5f | the chart slides left and shrinks to 0.78 (power2.inOut, 1.2 s) | `word('o5', 'but')` | 27.43 to 28.63 |
| 5f | Lesson 1's panels slide in from the right edge, landing with it | chart + 0.3, 0.9 s | 27.73 to 28.63 |
| 5f | LOUDER plays; HIGHER plays (its bead jumps) | `word('o5', 'loud')`; `word('o5', 'high')` | 28.70; 29.33 |
| 5f | "loud ≠ high" (≠ drawn) | `word('o5', 'different')` | 29.90 |
| 5g | "loud ≠ high" scales 1.2 about its left baseline | `word('b9', 'they')` | 32.39 |
| 5g | the fork from the thumb (0.6 s) | `word('b9', 'one')` | 34.10 |
| 5g | "louder" as its branch arrives; "higher" 0.45 s later | fork + 0.3; + 0.45 | 34.40; 34.85 |
| 5g | "in a voice, one push moves both" | `max(word('b9', 'both'), "higher" + 0.4)` | 35.24 |
| 5g | the panels, fork, labels, line and envelope, "LISTEN ONLY", the type fade (0.4 s) | `max(at('b9', 'end'), "both" + 0.4)` | 35.66 to 36.06 |

## Departures from the board, with numbers

1. **No chapter-1 kicker.** The board's 5a to 5g name none (chapter 2 has "02 · WHAT THE DIAPHRAGM DOES"); one at (120,
   110) would sit 16 px over the label row's text (baseline 150, from x 400). Built as the board has it; a question for
   the director.
2. **5g's "higher" and the line's landing** keep the 0.4 s rule on any clock: on the scratch clock b9's "one" to
   "both." is 1.04 s (board 1.30), so the board's offsets (0.30, 0.75, 1.30) would land the line 0.30 s after "higher".
   Built as fork + 0.30, + 0.45 more, then `max("both.", higher + 0.4)`: on the board's clock that gives 104.30, 104.75,
   105.30, the board's own.
3. **The fork's stem bends.** A straight stem from (915, 720) (DECISIONS 157) passes 5.8 px from the lower right corner
   of "50" (measured on the digits' ink at 0.78: the stem at 64 degrees climbs past the corner at y 704). Built as a
   gentle quadratic from (916, 724) through (956, 700) to the fork point (1010, 525): it leaves the thumb's right side,
   keeps 12 px or more from "50" (probe), and crosses the strip just right of the peak, as the board asks.
4. **The plan (5d) is drawn locally, clear of "50"**: the kit slider's plan starts at the thumb (x 960) at y 770 and
   778, through the "50" (y 754 to 776). Here: out at y 774 from x 1002 to 1514, a hold bar at x 1520 (y 740 to 784), back
   at y 750 from 1514 to 1002; 18 px from "50"'s right edge.
5. **"mainly: louder"'s strip**: the board says the strip's "envelope outline brightens", but before the Push note the
   strip is a hairline. A chrome glow along the strip's centre (3 px, 50 %) lights on "mainly" (an accent).
6. **"in the band" and the mint edge** land 0.4 s after "LISTEN ONLY" (the Push note starts inside the band, so the
   board's lit edge would land with the chip): lit from 20.65 to 21.72, dark to 24.35, then lit to the fade.
7. **The two arrows of 5c**: "also: a little higher" has its 30 px arrow pointing up to the band's top edge, from
   (440, 372) to (440, 342), inside the band under the label; "mainly: louder" points down to the strip's top, (440, 632)
   to (440, 662).

## Built locally (the kit might offer)

- **Lesson 1's loud-or-high figure** (no kit maker): two panels 187 x 203 at HANDOFFS' places, titled LOUDER and HIGHER
  (JetBrains Mono 500 22 px, ink-2, tracking .18em), a chrome trace (2.5 px) and a bead (r 7) on a 116 px rail. LOUDER:
  the trace's height 14 to 34 px over 0.8 s, the bead still; HIGHER: 3 to 6 cycles over 0.8 s, its bead up 56 px
  (power3.out, 0.3 s). "loud ≠ high" with its ≠ as a 4 px ink path between two texts, laid out from their widths.
- The fork (three `L.arrow`s, the stem a quadratic), the 5c arrows, the strip's glow, the plan.
- `L.CONTOUR.push`'s band crossings found by bisection on the contour (no typed seconds).

## Proof

- Probe (`probe.mjs`, `checks.js`, `probe.json`; screenshots `probe-*.png`, no hosts): every check passes. Its
  numbers: LAB-CHECKS 10, the definition 15 px under the chip's foot and the four words' outlines 13.2 px over it;
  LAB-CHECKS 9, "ILLUSTRATION" and "LISTEN ONLY" 16.0 px apart at F0 (21.95) and 12.5 px at 0.78 (31.00), "loud ≠ high"
  18.2 px under "LISTEN ONLY"; LAB-CHECKS 4 (35.55), both arrowheads inside the peak (x 960), the stem 14.7 px from
  "50"'s ink, "louder" 17.6 px over the swollen fill, "higher" 14.5 px under the band's foot; the wave rule 33.8 / 46.6
  px at F0 and 26.4 / 36.4 px at 0.78; the plan 18 px from "50".
- First frame against group A's last (`lab/s04-recall/clip-still-13.63.png`, re-rendered 19 November 09:13) and the
  last frame against S6's first, by region (`cutdiff.py`): best shift (0, 0) everywhere; mean residual 0.3 to 1.5 of
  255 (S4's four words 2.5).
- Clip: `clip.mp4` (30 fps draft with the scratch voice; re-rendered 18 November 23:24, after the passes'
  re-render and `roots.js` of 23:12); stills `clip-still-*.png` at 0, 1.50 (card), 3.05 (5b), 9.25 (LAB-CHECKS 10),
  19.44 (plan), 21.95 (LAB-CHECKS 9, F0), 23.25 (the peak), 26.24 (the whole line), 31.00 (LAB-CHECKS 9 at 0.78),
  35.55 (LAB-CHECKS 4), 36.17 (the last frame). Hosts checked on every still: at 300 in their corners, no keep-out
  breach (probe: 20 px or more on every frame tested).
- `measure.py render` (`measure/summary.md`): holds 1.3 s inside the film (1.1 s per 30 s), longest 0.3 s; two
  single-frame events, both in Merc's own pass: a pop at 7.833 (0.05 % of pixels: his eyes, x 94 to 159, y 736 to
  787, a blink) and a jump at 10.000 (his talk arcs); integrated -20.0 LUFS, true peak -2.8 dBTP (scratch voice only).
- `check lab/s05-push/proj --at=21.0,23.25,26.24,31.0,35.55` (LAB-CHECKS 18 for 5e): contrast 51/51, layout 0
  issues, lint 0 errors (one warning: the kit's duplicated host video entry, as in every scene).
- clock-lint silent; `merc-tags.py s05-push --check`: 4 tags, 0 stale, 0 problems.
