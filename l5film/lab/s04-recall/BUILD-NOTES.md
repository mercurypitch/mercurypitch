# s04-recall: build notes (group A)

`compositions/s04-recall.html`, 13.635 s on the scratch clock (film 52.88 to 66.515, the cut 0.15 s before
`act1`). STORYBOARD 4a to 4d; HANDOFFS § The band chart (the swatches), § Framings (F-strip), § Camera moves
(push-and-return 1), § The cuts S3 to S4 and S4 to S5.

## Fix round F-01 (DECISIONS 226, 229, 233)

| Item | Before (film-draft-01) | Now |
| ---- | ---------------------- | --- |
| 226, the lower half | at F-strip: the strip centred y 266 (world 690), its envelope 227 to 305 (half-height 28 world); swatches 224 px wide, 14 / 39 / 78 px half-heights, centred y 490; names' baseline 630; heading 716; the introduced row's baseline 790; ring (1580.9, 490) | S3's strip at 720 carries in (screen 308; `STRIP_Y`, line 75), its even envelope at +3.5 dB, half-height 42 (1.5 times; line 79): 249.2 to 366.8; swatches 1.5 times (240 world wide, half-heights 15 / 42 / 84; line 80) at world y 890: centred (512 / 960 / 1408, 546), 336 wide, 42 / 117.6 / 235.2 tall, the middle one still exactly the envelope; names' baseline 730.8 at 50.4 px; heading 790 (line 124); the row's baseline 862 (line 127), outlines 818.7 to 874.5; ring (1636.9, 546), still 40 px clear of the third swatch. Gaps: tall swatch to the names 15.8, names to the heading 19.2, heading to the row 28.7; the lowest ink 874.7 (captions 896). The strip and "level" glide home to 690 and 778 through the crane up (lines 144, 151), so S5's first frame is unchanged. `fix-F-01/before-after-57.5.png`, `fix-F-01/still-11.49.png` |
| 229, the chips clear of the band's line through the crane up | the band's edges and Merc's line passed through the parked chips (65.43 to 65.57) | each line hidden until its whole stroke is 12 px under the row (its outlines end at 106), found on the camera's curve (`clearAt`, line 110), then up over 0.3 s, linear: the bottom edge from 12.547, Merc's line (with its 10 px glow) 12.680, the top edge 12.778 (film 65.427, 65.560, 65.658); nearest line to a chip over the 45 frames: 26.1 px. The fill passes under the row (DECISIONS 168). `fix-F-01/crop-crane-up-12.56-12.69.png` |
| 233, the names stepping | the names rose in whole-pixel steps: "whisper" 32.53 to 31.53 at 55.267, "about speaking volume" 33.00 to 31.99 at 55.667 after held frames (`fix-F-01/name-trace.txt`, from the film draft) | each name in its own composited layer (lines 88 to 96), drawn at its size on screen, the layer translated to its anchor to 1/1000 px (line 170), shown only while seen (so its first raster is at F-strip's scale): the same trace now eases 31.59, 31.36, 31.23 and 32.04, 31.79, 31.65 with no held step. Tool `fix-F-01/name_trace.py` |
| 172, the flight | heading and names left at FLY - 0.2 (gone FLY + 0.1) | the row starts lower and reaches the heading 0.08 s into the flight, so they leave at FLY - 0.32 (line 53), gone 0.02 s before it; the flight crosses no type on screen (`flight-cross.mjs`: the heading's box crossed at 11.933 and 11.967, at 0) |

- Probe: 52 lines, all pass; new: F-strip's places at the new scale, the names' layers on their anchors over the landing (33 frames), the lower half's gaps and the captions' line, the band's lines against the parked chips on every crane-up frame, the first frame's strip and "level" (S3's) and the last frame's (S5's). Keep-out: 188.8 px at the closest ("level" to Merc).
- Clip `clip.mp4` (scratch voice mix), stills `fix-F-01/still-{0.00,2.39,2.79,3.30,6.05,8.30,11.49,12.56,12.69,13.63}.png`; `fix-F-01/measure/summary.md`: holds 0.5 s (1.1 s per 30 s), longest 0.1 s, none inside a word; one pop, 9.60 (the hosts' blink, as before). `check lab/s04-recall/proj --at=2.8,3.3,6.05,8.3,11.49,12.6`: layout 0, contrast 23/23.
- Join S4 to S5: S4's last clip frame against S5's clip still at 0 (group B's of 19 November, 11:44): mean abs difference 0.47 of 255, 0.009 % of pixels over 24 (Merc and the label row's antialiasing).
- HANDOFFS should carry (§ Framings F-strip, § The swatches): the numbers in the 226 row above; the strip and "level" glide 720 to 690 and 820 to 778 over the crane up (power2.inOut); the band's lines come in 12 px under the parked row, 0.3 s linear each.


## Fix round (critic A-01): DECISIONS 172 and 175

- **175, the q0 ring** stands right of the third swatch ("shout"), centred on the swatch row: centre (1580.9, 490.0)
  at F-strip, its ink (r 18, a 3 px stroke) 40.0 px clear of the swatch outline's outer edge (computed from the
  swatch's world place on the camera's F-strip mapping). Same ring, same size. Crop: `ring-6.05.png`.
- **172, the crane up keeps its subject.** `flight-cross.mjs` measured what the four words' flight (11.79 to 12.39)
  crosses: the heading (11.93 to 11.97) and all three names (12.00 to 12.03) are type it would cross, so they alone
  leave at fly - 0.2 (11.59 to 11.89). The middle and right swatches (12.03 to 12.10), the hairline and the strip's
  envelope (12.13 to 12.17) are marks the frame-fixed chips pass in front of (as DECISIONS 168 has the parked words
  over the band's fill): they stay. The swatches and the hairline leave on "right" (12.34, 0.4 s) with the crane
  running (from 11.935); the strip's envelope stays until the band's foot (its whole edge line) is 16 px into the
  frame, found on the camera's curve (12.31), then fades over 0.4 s. This departs from 172's list in one place:
  172 names the heading among what leaves with the crane, but the flight crosses it in its first frames, so it
  leaves before the flight.
  Probe: over the flight's 18 frames the nearest visible type to a chip is 17.1 px; over the crane's 45 frames the
  chart always has a mark on screen at 30 % or more (the fewest is one, the band, at 12.667 as the swatches go).
  Sheet: `crane-up-sheet.png` (11.80 to 13.50, every 3rd frame; the stamps cover the parked chips' lane).
- Clip (with its scratch voice): `clip.mp4`; stills `clip-still-*.png` (0, 1.0, 3.3, 6.05, 6.6, 8.3, 10.0, 11.2, 11.7,
  and the crane up 11.93 to 13.43 every 0.2 s, 13.63). measure.py: holds 0.5 s in all (1.1 s per 30 s), longest 0.1 s;
  no low-motion run inside the crane up (its largest mean change 3.7 a frame at 12.70); one pop at 9.60 (0.12 % of
  pixels, the heading landing over Tavi's idle, as round 2). Round 2: `round2/`.

## Rows and anchors (scene time; o3 is 0)

| Row | What | Anchor | Scratch time |
| --- | --- | --- | --- |
| 4a | kicker "FROM LESSON 3" | `at('o3', 'start', 0.05)` to `at('q0', 'end')` | 0.05 to 6.95 |
| 4a | crane down with a push, F-promise-b to F-strip (power2.inOut, 1.4 s) | `at('o3', 'start', 0.3)` | 0.30 to 1.70 |
| 4a | the strip's even envelope at 0 dB (violet, the strip's own height), in over 0.8 s with the crane; never changes | the crane | 0.30 |
| 4a | "A3" leaves with the band out of the top (0.3 s) | the crane | 0.30 |
| 4a | the three swatches with their names, 0.4 s apart (fade 0.3 s, rising 12 px) | `word('o3', 'loud')` + 0.4 k | 2.08, 2.48, 2.88 |
| 4b | the predict's ring timer, top left (180, 188), over q0 | `at('q0')`, q0's length | 5.15 to 6.95 |
| 4b | Merc's leap in from the left to (110, 840) at 300 | the m-blue-s04 chunk's first frame (b6 - 1.38) | 6.05 (air 6.20 to 6.63) |
| 4c | the middle swatch lights (violet 28 %, ink outline, its name to ink, a 1.08 pulse) | `word('b6', 'about')` | 7.64 |
| 4c | the chrome hairline (40 %) draws up from it to the strip's foot (960, 822) to (960, 718) | that + 0.1 (0.4 s) | 7.74 to 8.14 |
| 4d | "FOUR WORDS YOU'LL MEET" (mono 26, ink-2, centred, baseline 716) | `min(word('b6', 'a quiet'), FLY - 2.23)` | 9.56 |
| 4d | the four chips (Outfit 600 44 px, ink, centred row, baseline 790), 0.4 s apart | heading + 0.43 + 0.4 k | 9.99, 10.39, 10.79, 11.19 |
| 4d | swatches, names, hairline, heading and envelope leave | `min(UP, FLY - 0.2)`, 0.3 s | 11.59 to 11.89 |
| 4d | the row shrinks to 30 px, flies to the top lane (right-aligned 1800, baseline 98) and dims | `word('b6', 'much', 'start', -0.15)`, 0.6 s | 11.79 to 12.39 |
| 4d | crane up to F0 (power2.inOut, 1.5 s) | `word('b6', 'the right', 'start', -0.28)` | 11.93 to 13.43 |
| 4d | "A3" back as the band comes into frame; the label row's text in as the crane lands | UP + 0.6 (0.5 s); UP_END - 0.5 (0.5 s) | 12.53; 12.93 to 13.43 |

## Departures from the board, with numbers

1. **The heading's anchor.** The board lands it on "a quiet note" (63.27), then the chips 0.43 and 0.4 s apart and
   the flight on "much" (65.70): 0.8 s between the last chip and the flight. On the scratch clock b6's second half
   is 2.97 s against the board's 4.31: from "a quiet" (63.00) the last chip would land at 64.63 and the row would
   fly at 64.67. So the heading lands at the earlier of "a quiet" and (the flight - 2.23 s), keeping the 0.4 s
   staging and a 0.6 s read before the flight: here 62.44, 0.06 s after "at:" ends, in the pause before "a quiet
   note". On the board's clock the formula gives "a quiet" itself.
2. **The swatches leave before the row flies** (`check`'s layout pass, 64.9 s: the rising row crossed "about
   speaking volume" and "shout"). The board's own times cross too (its flight 65.70 to 66.30 passes their names at
   about 66.0, as they start to fade). They now leave 0.2 s before the flight, over 0.3 s; the board's
   "with the crane" stays when the crane starts first.
3. **"A3" leaves with the crane and returns on the way back** (`check`, 53.93 s: it rode the band up under the
   kicker). It is off-frame at F-strip either way.
4. **The ring timer is at (180, 188)**, 12 px over the board's (180, 200): at 200 its ring sat 8.8 px over the
   strip's envelope (y 226.8 at F-strip); at 188 it clears it by 19.3 px.
The lead accepted 1 to 4 as built (DECISIONS 167); the fix round then replaced 2 and 4 (DECISIONS 172 and 175, above).

5. **Two frame-fixed passes, as the board times them** (DECISIONS 168: each label measured at its pass's worst frame;
   one under 4.5:1 would get an opaque back). The band's fill passes under "FROM LESSON 3" in the crane down and under
   the parked four words in the crane up. `contrast-pass.mjs` (run through `$S/bin/heavy`) seeks every frame of each
   crane and 0.5 s either side in the probe's harness, shoots each label's region as drawn and with its own glyphs
   hidden (the check tool's way of finding the pixels behind them), and `contrast_pass.py` measures each label's
   paint at its drawn opacity against the median of the pixels behind its glyphs (the check tool takes the median of
   the whole box), and against the brightest 5 % of them. Frames where a label is still fading in are left out (the
   kicker's first 4). The harness's frames match the clip's (mean difference 1.4 to 5.0 of 255 in the label regions:
   the draft encode and the grain). Numbers in `contrast.json`; each label's worst frame, drawn and with its glyphs
   hidden, at 3x: `contrast-worst.png`.
   - **"FROM LESSON 3"** (ink-2 on the ground at full, 8.16:1 on clear ground): over the band's fill at 0.967 to 1.133
     (the crane's 0.67 to 0.83 s), worst **6.74:1 at 1.033** (the fill behind it rgb(44, 42, 36)).
   - **The parked four words** (ink-2 on the chips' 60 % ground, 15.7 to 16.0:1 at rest): worst **8.2:1** ("onset",
     12.500), "diaphragm" 8.22:1 (12.533), "air pressure" 8.31:1 (12.633), '"support"' 8.7:1 (12.333).
   - Both keep 4.5:1, so neither has a back: the pass stays as the board has it.
   - What the median does not show: for one frame each, a line crosses the kicker's glyphs. The band's top edge at
     0.933, Merc's amber line through the middle of "LESSON 3" at 1.033 and the band's lower edge at 1.167. The glyph
     pixels over a line drop to 2.96:1, 1.01:1 and 2.76:1 (the brightest 5 % behind them). Under the chips the lines
     are dimmed by the chips' ground: the lowest is 3.83:1 ("air pressure", 12.633). Harness and clip side by side at
     0.933, 1.033 and 1.167: `contrast-kicker-lines.png`.
   - `check lab/s04-recall/proj --at=0.933,1.033,1.167,12.5,12.633` (`check-passes.json`): contrast 16/16, layout 0.

## Proof

- Clip: `clip.mp4` (30 fps draft, with sound); clip stills with both hosts `clip-still-*.png` (0, 1.0, 3.3, 6.6,
  8.3, 10.0, 11.2, 11.7, 12.0, 12.3, 12.9, 13.63); 4d sheet `sheet-4d.png`; snapshot stills `still-*.png`, `sheet.png`
  (taken before the fixes above).
- measure.py (`measure/summary.md`): holds 0.5 s in 13.6 s (five 0.1 s samples in the F-strip stretch, while Tavi
  talks), longest 0.1 s; final 0.1 s; two pops (6.03, 9.60; 0.05 % and 0.12 % of pixels): the hosts' blinks.
- `check lab/s04-recall/proj --at=3.3,8.3,10.9,12.0,13.6`: layout 0 issues, contrast 29/29. Root check: layout 0.
- Probe (`probe.json`): F-promise-b at 0; F-strip: strip x 176 to 1744, envelope y 226.8 to 305.2, swatches centred
  (512, 490), (960, 490), (1408, 490), names baseline 630 at 50.4 px; the lit swatch's fill 0.28, outline and name
  ink; the introduced row centred on 960 (x 470.5 to 1449.5, y 746.7 to 802.5), 17.6 px gaps (12 x 44/30); parked:
  right edge 1800.0, outlines y 68.0 to 106.0, gaps 12.0, ink-2; keep-out 210 px at its closest.

## Handoffs

- **S3 to S4**: see s03's notes (0.36 of 255 across the cut).
- **S4 to S5 (act1, to group B)**, last frame (13.6345): F0; band 312.5 to 487.5, Merc's line y 400, "A3",
  "level", the strip's hairline; the label row's text from x 400, baseline 150, at full; no chips on the chart; the
  four words parked dim (ink-2, chrome 25 %), right edge 1800, outlines 68 to 106 (baseline 98), 12 px apart;
  swatches and heading gone; Merc (110, 840) and Tavi (1800, 840) at 300, bodies x 30.5 to 189.5 and 1720.5 to
  1879.5. `clip-still-13.63.png`.

## Built locally (the kit might offer)

- The swatches (three envelopes, their names, the lit state, the hairline): HANDOFFS § The band chart places them;
  the kit has no maker.
- The four words' introduced row (44 px, centred) flying into `L.chipRow`'s parked layout: each chip drawn with
  `dx`, `dy` and `scale` from the parked row, so gaps stay proportional through the flight.
