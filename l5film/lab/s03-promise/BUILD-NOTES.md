# s03-promise: build notes (group A)

`compositions/s03-promise.html`, 10.47 s on the scratch clock (film 42.41 to 52.88). STORYBOARD 3a to 3c; HANDOFFS
§ Framings (F-promise-a, F-promise-b), § Camera moves (the truck), § The cuts S2 to S3 and S3 to S4.

## Fix round F-01 (DECISIONS 226)

| Item | Before (film-draft-01) | Now |
| ---- | ---------------------- | --- |
| 226, the lower half | the strip's hairline at 690; its outline x 390 to 1530, y 650 to 730 (80 tall, rx 40); "level" 778; "what your diaphragm does" 836; nothing below about 846 | the strip at 720 (line 58), its outline y 660 to 780 (120 tall, 1.5 times; rx 60; line 79), "level" 820 and "what your diaphragm does" 874 (line 84): the outline's stroke to "level"'s ink 15 px, "level" to the label 24 px, the lowest ink 883 (the captions keep 896 and below). The band, its labels and the bead's landing on A3 (480, 400) unchanged. `fix-F-01/before-after-47.0.png` |
| 227, holds | 0.1 s | 0.1 s (0.3 s per 30 s), none inside a word |

- Probe: 35 lines, all pass; new: the strip, outline and labels' places and gaps at 2.29 and 9.47, the captions' line, the last frame's strip and "level" (s04's first frame draws the same). Keep-out: 449 px at the closest.
- Clip `clip.mp4` (scratch voice mix), stills `fix-F-01/still-{0.00,2.30,6.00,9.60,10.46}.png`; `fix-F-01/measure/summary.md`: holds 0.1 s, no events. `check lab/s03-promise/proj --at=2.3,5,8.4,9.7`: contrast 17/17.
- Join S3 to S4: mean abs difference 0.29 of 255, 0.013 % of pixels over 24, all in Tavi (x 1700 to 1900, the pass); the strip's and "level"'s rows 0.36 and 0.30.
- HANDOFFS should carry (S3's places): the strip at 720; its rounded outline x 390 to 1530, y 660 to 780, rx 60; "level" (400, 820); "what your diaphragm does" (400, 874); s02's fade-up and s04's first frames the same.


## Fix round (critic A-01): DECISIONS 174 and 176

- **174**: "what your diaphragm does" now starts at x 400 world (anchor start), left-aligned with "level", baseline
  836 as before. Probe: both advance origins at screen x 474.2 at 1.99 and 321.8 at 9.47; their glyph boxes' left
  edges within 2 px. Crop: `label-crops.png` (1.99 and 8.60).
- **176**: the chart's fade-up runs on from s02's earlier curve (`FADE_UP`): 1.0 on the first frame, as s02's last.
- Clip (with its scratch voice): `clip.mp4`; stills `clip-still-*.png` (0, 0.12, 1.99, 4.6, 8.4, 8.6, 9.3, 9.6,
  10.46). measure.py: holds 0.1 s in all, no single-frame events. Probe: 24 lines, all pass. Round 2: `round2/`.

## Rows and anchors (scene time; b4 is 0)

| Row | What | Anchor | Scratch time |
| --- | --- | --- | --- |
| 3a | the title's bead lands on A3, (480, 400), turns amber (its last 0.3 s), one echo ring | `L.TITLE.flight` (film time: `title` + LIFT + FLY) | 0.12 |
| 3a | Merc's line draws on from the bead (power2.out), its amber head riding the draw; the band's fill spreads behind it (an amber overlay at 7 %, eased off over 0.6 s) | LAND, 0.6 s | 0.12 to 0.72 |
| 3a | the band, "A3", "level", the strip's hairline finish fading up (from s02, one film-time curve) | `L.cue('title', 'start', LIFT)`, 1.0 s | to 0.12 |
| - | truck right 160 px, F-promise-a to F-promise-b (power1.inOut) | LAND + 0.6 to `at('o3', 'start', -0.3)` | 0.72 to 10.17 |
| 3a | "what your diaphragm does" (40 px, world), centred under the strip's left half (x 680, baseline 836) | `word('b4', 'what')` | 1.49 |
| 3a | the strip's rounded outline (chrome, 2 px, x 390 to 1530, y 650 to 730) draws round, then dims to 30 % | that + 0.05 (0.5 s); dims from + 0.75 | 1.54 to 2.04 |
| 3b | "breathe in low · start easily" above the band's left end (x 400, baseline 290) | `word('b4', 'breathe')` | 3.89 |
| 3b | the chrome tick (4 px, the band's height) at the line's start; the line's first 120 px glow | `word('b4', 'start')` | 5.22 |
| 3c | "a comfortable note · 10 s" above the band's right half (right-aligned 1520, baseline 290) | `word('b4', 'hold')` | 7.17 |
| 3c | the playhead (3 px chrome, the band's height) sweeps the band in 2.0 s (sine.inOut); the fill 12 % to 24 % behind it over a 360 px trail, easing back after | `word('b4', 'comfortable')` | 7.59 to 9.59 |
| 3c | the three labels (and their marks) leave up fast, 0.1 s apart | `at('b4', 'end', -0.1)` | 9.77, 9.87, 9.97 |
| 3c | Tavi's leap in from the right to (1800, 840) at 300; the floor fades in with it | the m-orange-s03 chunk's first frame (`MERC_ROOTS['m-orange-s03'].t0`; o3 - 1.38) | 9.09 (air 9.24 to 9.67) |

The board gives no places for the three promise labels or the strip's outline; HANDOFFS neither. Chosen: 40 px
Outfit 600 ink for all three; "what your diaphragm does" sits under "level" (baseline 778) at 836, centred on the
left half, 22 px clear of it, because "level" holds x 400 to 466 on the strip's own baseline row.

## Proof

- Stills: `still-*.png` (0, 0.12, 0.45, 2.0, 4.6, 6.0, 8.4, 9.6, 10.46), sheet `sheet.png`; clip stills with Tavi
  `clip-still-{0.00,0.12,4.60,8.40,9.30,9.60,10.46}.png`.
- Clip: `clip.mp4` (30 fps draft, with sound); `measure/summary.md`: holds 0.1 s in 10.5 s (0.3 s per 30 s, longest
  0.1 s; the no-host budget is 1.8 s per 30 s), no single-frame events, low-motion runs 0.7, 0.4 and 2.2 s (the
  truck and the outline drawing carry them).
- The truck moves content 8 px a second or more from 1.83 to 9.06 (the board's 44.0 to 52.0 is 2.10 to 8.77 here);
  its peak is 33.9 px a second.
- `check lab/s03-promise/proj --at=2.3,5,8.4,9.7`: layout 0 issues, contrast 17/17.
- Probe (`probe.json`): F-promise-a plot x 480 to 1600 at 0; the bead lands at (480.0, 400.0); F-promise-b plot x
  320 to 1440, line y 400 at the truck's end and the last frame; Tavi's body box 1720.5 to 1879.5, 648 to 840;
  keep-out 449 px at its closest.

## Handoffs

- **S2 to S3**: see s02's notes (the bead within 0.1 px; clip frames 0.34 of 255 apart).
- **S3 to S4** (F-promise-b): last frame shows the band, Merc's line, "A3", "level", the hairline, no promise
  labels, Tavi landed. Clip frames across the cut: mean abs difference 0.36 of 255 (0.01 % over 24).

## Built locally (the kit might offer)

- The band's fill spreading behind a drawing line, and a playhead's light (a gradient overlay over the band):
  both small overlays inserted under Merc's line in the chart group.
- A line's start glow (a 14 px amber stroke under the first 120 px).
