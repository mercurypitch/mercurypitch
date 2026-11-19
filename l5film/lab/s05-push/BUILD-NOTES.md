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
| 5b | "level" moves to the strip's left at its height (right-aligned 366, baseline 701), with the axis's ease **[B-01: 184]** | `at('o4')`, 0.6 s | 2.35 |
| 5c | "mainly: louder" with its arrow down to the strip; the strip's resting envelope draws in ghost violet (0.5 s), its edge brightening once, and stays to the end **[B-01: 184]** | `word('b7', 'mainly')` | 10.12 |
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
| 5g | "in a voice, one push moves both" (the thesis, before the fork) **[B-01: 181]** | `word('b9', 'in')` | 33.12 |
| 5g | the panels, fork, labels, line and envelope, "LISTEN ONLY", the type fade (0.4 s) | `max(at('b9', 'end'), "higher" + 0.4)` | 35.66 to 36.06 |

## Departures from the board, with numbers

1. **No chapter-1 kicker.** The board's 5a to 5g name none (chapter 2 has "02 · WHAT THE DIAPHRAGM DOES"); one at (120,
   110) would sit 16 px over the label row's text (baseline 150, from x 400). Built as the board has it; a question for
   the director.
2. **5g's labels** keep the 0.4 s rule on any clock: the fork on "one", "louder" 0.30 s later, "higher" 0.45 s after
   that (104.30 and 104.75 on the board's clock). The thesis now lands on "in a voice," (DECISIONS 181), 0.98 s before
   the fork.
3. **The fork's stem bends.** A straight stem from (915, 720) (DECISIONS 157) passes 5.8 px from the lower right corner
   of "50" (measured on the digits' ink at 0.78: the stem at 64 degrees climbs past the corner at y 704). Built as a
   gentle quadratic from (916, 724) through (956, 700) to the fork point (1010, 525): it leaves the thumb's right side,
   keeps 12 px or more from "50" (probe), and crosses the strip just right of the peak, as the board asks.
4. **The plan (5d) is drawn locally, clear of "50"**: the kit slider's plan starts at the thumb (x 960) at y 770 and
   778, through the "50" (y 754 to 776). Here: out at y 774 from x 1002 to 1514, a hold bar at x 1520 (y 740 to 784), back
   at y 750 from 1514 to 1002; 18 px from "50"'s right edge.
5. **"mainly: louder"'s strip** (superseded by B-01, DECISIONS 184): from "mainly" the strip shows its resting
   envelope in ghost violet (`L.CONTOUR.demo`, half-height 28, outline 35 %), so the arrow points at a level; the
   local chrome glow is gone.
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
- The fork (three `L.arrow`s, the stem a quadratic), the 5c arrows, the plan.
- `L.CONTOUR.push`'s band crossings found by bisection on the contour (no typed seconds).

## Fix round B-01 (critic B-01, DECISIONS 180 to 189)

| Item | Change (file, line) | Before | After | Proof |
| --- | --- | --- | --- | --- |
| 2, the thesis (181) | `THESIS = word('b9', 'in')` (s05-push.html line 79); `FADE = max(at('b9', 'end'), L_HIGH + 0.4)` | lands 35.25 (critic: seen from 35.47), on screen about 0.6 s, at full about 0.4 s | lands 33.12 on "in a voice,", fades 35.66 to 36.06: on screen 2.94 s, at full 2.14 s; the fork 0.98 s after it, "louder" 1.28 s, "higher" 1.73 s | `fix-B-01/thesis-33.62-35.55.png`, `clip-still-33.62.png`, `clip-still-35.55.png`; probe |
| 5, the strip and "level" (184) | the ghost envelope in `ch.draw`'s strip (line 205); "level" moved by its own width on `o4` (lines 90 to 96, 220 to 223); the local strip glow removed | the arrow pointed at a hairline (+11 luma, like the staves); "level" on the slider's row | from "mainly" the resting envelope in ghost violet, outline y 662 to 718, x 400 to 1520, the arrow's tip on its top edge (662); "level" right-aligned 366, its glyphs centred at 689 (the strip 690); S4's first frame unchanged ("level"'s first glyph at x 400) | `fix-B-01/ghost-level-14.2.png` (before and after), `clip-still-3.05.png`, `clip-still-10.92.png`, `clip-still-19.44.png` |

The last frame now carries the ghost envelope and "level" at the strip's left (HANDOFFS § S5 to S6 [B-01: 184]); S6
draws both from its first frame and fades the envelope as the split begins.

## Proof (after the fix round, 19 November)

- Probe: 75 of 75 pass. LAB-CHECKS 10: 15 px and 13.2 px; LAB-CHECKS 9: 16.0 px at F0, 12.5 px at 0.78, "loud ≠ high"
  18.2 px under "LISTEN ONLY"; LAB-CHECKS 4: both arrowheads inside the peak, the stem 14.7 px from "50", "louder" 17.6
  px over the fill, "higher" 14.5 px under the band; the wave rule 33.8 / 46.6 px at F0 and 26.4 / 36.4 px at 0.78.
- First frame against S4's last (`lab/s04-recall/clip-still-13.63.png`, 19 November 09:13) and the last frame against
  S6's first: best shift (0, 0) in every region (`cutdiff.py`).
- Clip `clip.mp4` (30 fps, the scratch voice, 19 November 11:44); stills `clip-still-*.png` at 0, 3.05, 10.92, 14.20,
  19.44, 23.25, 26.24, 31.00, 33.62, 35.55, 36.17.
- `measure.py render` (`measure/summary.md`): holds 1.1 s (0.9 s per 30 s), longest 0.2 s; single-frame events all in
  the hosts' faces (pops 7.833, 12.367, 35.033; jumps 10.000, 14.900, 31.367; the jump at 20.167 is Tavi's eyes as the
  plan's arrows fade); -20.0 LUFS, true peak -2.8 dBTP.
- `check lab/s05-push/proj --at=10.92,21.0,23.25,33.62,35.55`: contrast 56/56, layout 0 issues, lint 0 errors.
- clock-lint silent; `merc-tags.py s05-push --check`: 0 stale, 0 problems.
