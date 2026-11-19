# Build notes: scene group E (s13-recap, s14-next, s15-end)

These notes are the same in `lab/s13-recap/`, `lab/s14-next/` and `lab/s15-end/`. Paths are relative to P
(`$S/l5film`). Times are scene times unless marked "film".

| Scene | Film time | Length |
| --- | --- | --- |
| s13 | 462.37 to 527.395 | 65.025 s |
| s14 | 527.395 to 543.265 | 15.87 s |
| s15 | 543.265 to 549.465 | 6.2 s |

Every time keys off the clock (`L.at`, `L.word`, `L.dur`).

## Fix round E-01 (critic E-01; DECISIONS 214 to 221)

The before files and stills are kept in each lab's `fix-E-01/old/`:
- the old clips, as `clip-before-E01.mp4`;
- the old clip and probe stills;
- s13's old parts;
- the old compositions and checks, as `*.before-E01.*.txt`;
- the kit's old `recap.js`, as `lab/s13-recap/fix-E-01/recap.before-E01.js.txt`.

The before-and-after crops are built by `lab/s13-recap/fix-E-01/crops.py`.

### 1. The answer holds before the clean break (DECISIONS 215)

**What changed** (`compositions/s13-recap.html`, the 13d and 13e anchors, lines 76 to 91):
- `CASCADE = at('break','start',0.2)`. The kicker, panel, answer and frame leave in turn, 0.07 s apart, each over 0.3 s.
- `REDRAW = Math.min(2.4, CASCADE - HOLD_MIN - SETTLES)`, with `HOLD_MIN = 0.5`.
- `LINE_K = DC.len / REDRAW`, so the redraw's speed comes from the clock.
- `VMT = PRACT + 0.4`.

| | Before | After |
| --- | --- | --- |
| Card 3's redraw | 2.4 s (10 / 2.4), done at 27.505 | 1.935 s (10 / 1.935, from the clock), done at 27.04 |
| Mint edge lit | 25.274 | 25.241 |
| Flag stands | 25.394 | 25.338 |
| The answer complete before the cascade | about 0.1 s | 0.50 s |
| Cascade | from break + 0.06: 27.40, 27.47, 27.54, 27.60 | from break + 0.2: 27.54, 27.61, 27.68, 27.75 |
| The recap gone | | by 28.05, 0.21 s before hop 1's apex (about 28.27) |
| Empty stage before the panel | 27.87 to 29.60 (1.73 s) | 28.05 to 29.56 (1.51 s) |
| "Voice Mirror" | on its word, 30.855 | 29.96, 0.4 s after the panel (29.56) |

The flag's x (334.5) and the entry (0.704 s of the line) do not change. The rows after "Voice Mirror" keep their words.

**Probe:**
- At 27.05: the redraw is complete at x 1688, it took 1.935 s (2.4 or less), the hold is 0.500 s, and the frame and answer are at 1.00.
- At 28.055: 0 texts, the chart and panel at 0, cascade from break + 0.20, 0.210 s before the apex.
- At 30.41: "Voice Mirror" lands 0.400 s after the panel.

**Stills and crops:**
- `lab/s13-recap/fix-E-01/item1-hold.png`: before 27.64; after 27.10, 27.50, 27.80 and 28.27.
- `lab/s13-recap/fix-E-01/item1-voice-mirror.png`: before 30.06; after 29.94, 30.20 and 30.60.
- `clip-still-27.10`, `27.50`, `27.64`, `27.80` and `28.05.png`.

### 2. The ten line (DECISIONS 216; a kit change)

**s13 is `L.RECAP`'s only user.** A grep of `compositions/`, `assets/lib/` and `tools/` finds `L.RECAP` only in `s13-recap.html` and in `recap.js` itself.

**The kit change** (`assets/lib/recap.js`, `L.RECAP.VM`, lines 52 to 66), logged in `tools/CHANGES.md`. The Voice Mirror card closes up 13 px under its rows:

| Element | Before | After |
| --- | --- | --- |
| Readout baselines | 525, 565, 605 (40 apart) | 523, 560, 597 (37 apart; ink gaps 8 px) |
| "Keep the glides comfortable." | 665 | 654 |
| "Sore, hoarse or unwell today? Just listen along." | 710 | 699 |
| "Free, no account: mercurypitch.com/mirror" | 765 | 752 |
| The free line's underline | 777 | 764 |

The panel's feet move from [300, 360, 420, 480, 625, 685, 730, 790] to **[300, 360, 420, 480, 617, 674, 719, 777]**. The rows (340, 400, 460), the glyphs (328, 388, 448), the title and the rule do not move. The carried bead still starts at the "five notes" glyph's first dot (272, 434 after the drift), so `L.TEASE.carry` is unchanged.

`VM.ten` is now one line: `{ text, x 270, y 820, size 30, family 'inter', weight 400 }`. s13 draws it as `{ ...VM.ten, fill: ink-2 }` (line 184).

**Measured** (probe at 50.485):

| Measure | Before | After |
| --- | --- | --- |
| Type | Inter 32, ends at x 1146 (36 px past the card's edge, 1110) | Inter 30, x 270 to 1100.2, left of 1110 |
| Ink | | y 797 to 827; glyph foot 827 (828 or higher) |
| Panel's last foot | 790, cap top 6 px under it | 777, 20 px over the cap top |
| Over the floor horizon (840) | | 13 px |
| From Merc's body box | 64 px | 110 px |

**Crops:**
- `lab/s13-recap/fix-E-01/item2-ten-line.png`: before and after at 50.59.
- `item2-card-whole.png`: both cards at 60.47.
- `lab/s13-recap/ten-crop-50.59.png`.

### 3. The recap's frame fill (DECISIONS 217)

**What changed** (s13, the card 1 and card 2 objects, lines 116 to 136, and the clock):
- The figure is drawn at `FIG_K = 0.75 x 1.2 = 0.9`, `FIG_X0 = 1395 - 0.9 x 255 = 1165.5` and `FIG_Y0 = 45`. Its fade is at the kit's own figure units (v 520 to 540), which lands at y 513 to 531.
- The traces are the kit's `L.TRACE.RECAP` drawn through `place { s 1.2, dx -280, dy -70 }`.
- The frame dims to `DIM_TO = 0.2`, where it dimmed to 0.35 before.

| | Before | After |
| --- | --- | --- |
| Figure | k 0.75: x 1262 to 1420, crown 105 | k 0.9: back 1300.5, belly 1462.5 (1489.5 breathing in), crown 63, masked by 531 |
| Figure's bounding box | 3.0 % of the frame | 4.3 % of the frame |
| Traces | x 1180 to 1640, centres 200, 320, 440, half-height 45 | x 1136 to 1688, centres 170, 314, 458, half-height 54 |
| Trace stack | y 155 to 485 | y 116 to 512 |
| Traces' bounding box | 7.3 % of the frame | 10.5 % of the frame |
| Trace names (Outfit 30) | right-aligned 1160 | right-aligned 1116, baselines 180, 324, 468, 24.6 px clear of the panel |
| Band under cards 1 and 2 | 35 % | 20 % (probe at 1.66: 0.20) |

- Everything sits inside x 1100 to 1690 and y 60 to 535.
- The names stay at Outfit 30, as chapter 4's type. At 36 px "Together" would come within 8 px of the panel.
- The band comes back to full for card 3 at BACK, as before.

**Crops:** `lab/s13-recap/fix-E-01/item3-fill.png` (before and after at 3.27 and 9.15), and `clip-still-3.27.png` and `9.15.png`.

### 4. The traces' ILLUSTRATION chip (DECISIONS 218)

**What changed** (s13: `trTag`, line 136; `TR_OUT`, line 58; the traces' block in the clock, line 301):
- The chip is `L.tag(world, ILLUSTRATION, { x 1688, anchor 'end' })`. It sits over the stack at x 1417.3 to 1688, y 62 to 102.
- It is 14 px over the top trace's crest (116) and 301 px from the names.
- It lands with the first trace (`TRACES`, 0.5 s) and leaves with all three from the swap to q4: `TR_OUT = Q4`, 0.4 s, linear.

| | Before | After |
| --- | --- | --- |
| Traces and their chip leave | 19.48 to 20.08, while card 3's chip came in over the Together trace (6 px overlap) | from 18.945, gone by 19.345 |
| Card 3's chip | | from BACK at 19.48 |
| Frames with no chip | | 0.135 s |

No frame holds both chips (probe at 19.35: traces 0.00 0.00 0.00, chip 0.00, card 3's chip 0.00).

**Crops:** `lab/s13-recap/fix-E-01/item4-chip.png`, with after at 9.15, 19.10, 19.40 and 20.18, and before at 19.75 (a frame from the old clip).

### 5. The carried bead keeps its identity (DECISIONS 219)

**What changed** (`compositions/s14-next.html`):
- `ROWS_IN = 0, ROWS_D = 0.6` (line 44). The rows and the six other outlines fade in from S14's first frame. `BEADS_D` is gone.
- The carried bead's alpha is now `1 - handed` (lines 100 to 105), where `handed = P(t, TW + onset(0), LIGHT_D)`.
- Bead 0 shows only from its note (line 114), lit blue under the bead as it gives way.

| | Before | After |
| --- | --- | --- |
| The rows | 0.53 to 1.13 | 0 to 0.6 |
| The outlines | 0.83 to 1.33 | 0 to 0.6 |
| The carried bead | emptied to an outline from 0.83 to 1.33 | filled from its landing (0.83, with the squash) to its note (1.74); hands over to bead 0 lit blue over 0.2 s |

**Probe:**
- At 0.61: the rows and the six outlines are at 1.00, bead 0 at 0, the carried bead at a 1.00.
- At 1.69: the carried bead is at (420, 745), r 20, alpha 1.00.
- At 1.95: bead 0's fill is 1.00, all seven groups are at 1.00, and the carried bead is hidden.

**Crops:** `lab/s14-next/fix-E-01/item5-bead.png` (before 0.30 and 1.43; after 0.30, 1.43, 1.70 and 1.84), and `clip-still-0.30`, `0.61`, `1.43`, `1.70` and `1.84.png`.

### 6. The tease line clears the kicker (DECISIONS 220)

**What changed** (s14): `LINE_Y = 170` (lines 49 to 51), used by the line's label (line 75). The kit's `L.TEASE.LINE.y` stays 150: I may change only `L.RECAP.VM`. The kit could follow at integration.

| | Before | After |
| --- | --- | --- |
| Baseline | 150 | 170 |
| Ink top (caps and quotes) | 117 | 137 |
| Gap under "NEXT TIME"'s foot (110) | 7 px by ink; the critic read 9 | 27 px (24 or more) |

- The line is still centred on x 960, ink x 436.3 to 1484.7. That is the board's "centred", and the line did not move sideways. The beads span x 420 to 1380 (centre 900) and the rows 340 to 1500 (centre 920). I read "still centred over the tune" as keeping it where it was.
- The kicker stays at x 122 (the left margin).
- The line sits 96 px over the copy.

**Crop:** `lab/s14-next/fix-E-01/item6-tease-line.png` (6.36, before and after).

### 7. Holds (DECISIONS 221): reported, nothing added

| Clip | Holds | Loudness |
| --- | --- | --- |
| s13, whole | 3.5 s, 1.6 s per 30 s, longest 0.3 s (3.2 s before) | -19.9 LUFS, true peak -2.0 dBTP |
| s13 part a | 1.6 s per 30 s, longest 0.2 s | -20.0 LUFS |
| s13 part b | 1.7 s per 30 s, longest 0.3 s, final 0.2 s (the cut) | -19.7 LUFS |
| s13 part c | 2.2 s per 30 s, longest 0.2 s | -20.1 LUFS |
| s14 | 0.6 s, 1.1 s per 30 s, longest 0.2 s | -19.9 LUFS, true peak -1.0 dBTP |
| s15 | 0.8 s in 6.2 s, longest 0.4 s | -70 LUFS: no voice |

The answer's new 0.5 s hold does not show as a hold: the hosts idle through it.

### After the fixes

| Check | Result |
| --- | --- |
| Probes | 229 (s13) + 107 (s14) + 48 (s15) checks, 0 FAIL |
| Root `check` | 0 errors, Check passed, 67/67 text checks AA. My warnings: `duplicate_media_discovery_risk` on all three (every scene has it) and `composition_file_too_large` on s13, now 377 lines (it stands, DECISIONS 214) |
| Contrast, s13 at 3.3, 9.2, 20.2, 27.3, 30.6 | 24/24 AA |
| Contrast, s13 at 39.5, 42.4, 48.6, 50.6, 60.5 | 59/59 AA |
| Contrast, s14 at 1.4, 1.9, 7.7, 10.3, 14.2 | 10/10 AA |
| Contrast, s15 at 1.2, 3.0, 6.1 | 15/15 AA; layout 0 issues in every run |
| clock-lint | silent |
| `merc-tags --check` | 12 tags, 0 stale, 0 problems |

**Events (measure.py):**
- s13 lost three small events: 47.367, 62.8 and 64.1.
- s13 keeps eight small ones from 5.2 to 23.4 s (0.05 to 0.23 %, as before) and two inside the drift: 62.733 (0.18 %) and 62.9 (0.62 %).
- s14 has two pops of 0.05 to 0.06 %. s15 has none.

**The cuts**, proved again after the fixes:

| Cut | Result |
| --- | --- |
| `recap` | The band, the line and the edges have cutdiff residual 0.00 on the cut frames, and 0.03, 0.08 and 0.00 on the 60 fps pair. No event. |
| `next` | The bead moves 0.28 px. Steps 17.58, 19.40 \| 20.75, 22.25, 21.49 px. No event. The rows and outlines now start fading in from the frame after the cut (`lab/s14-next/cut-next/sheet.png`). |
| `end` | Beads 0.30 px, copy 0.28 px, "?" 0.08 px. Steps 7.16, 9.77 \| 11.76, 14.92, 18.41 px. One jump of 0.80 %: the hook leaving, 0.23 s before the cut. |

**Not fixed: none.**

**Notes from the round:**
- `lab/s13-recap/cutprobe.mjs` clears its output folder on every run. It removed the old `steps.py` and the end cut's `sheet.png`. The steps tool now lives at `lab/s13-recap/tools/steps.py`, and the two cut sheets were made again.
- The critic's "Needs a person" items are outside a lab's reach: the missing sound (the tune, the end chimes, the pad), the 60 fps smoothness, and whether the figure reads on mute (DECISIONS 221).

## Checks over the group

| Check | Result | Where |
| --- | --- | --- |
| The 0.4 s rule over my rows | Every landing closer than 0.4 s is a pair the board or a decision sets (per scene below) | `lab/<sid>/landings.txt`, from `lab/s13-recap/tools/landings.py` |
| LAB-CHECKS 21: real font widths | Every line is measured in the real fonts, and the clearances hold | `lab/s13-recap/widths.txt` (`tools/widths.mjs`); the probes |
| LAB-CHECKS 22: the card lines and the coach | b55, b56 and b58 are `[coach]` lines. They are drawn word for word from `L.RECAP.VM` and `L.RECAP.REST`, and the probe checks each string. They wait for the coach. | `probe.json` |
| LAB-CHECKS 2: the matched cut on `recap` | The frame moves under 2 px (0.000), and the room crossfades over 0.3 s with no event | `lab/s13-recap/cut-recap/` |

---

## s13-recap (`compositions/s13-recap.html`)

### Rows and the anchor each keys off

The camera stays at F0; every move belongs to an object.

| Row | What | Anchor |
| --- | --- | --- |
| cut | The frame on F-turn's pixels. `L.roomCut(room, {from: 'F-turn'})` crossfades the room over 0.3 s. | the scene's start |
| 13a | The frame slides and widens (1.2 s, power2.inOut). Its edges go from 2.8 to 2 px (DECISIONS 202). Then it dims to 20 % (0.3 s, linear). | `at('recap','start',-0.04)` |
| 13a | Kicker "QUICK CHECK" | `at('recap')` |
| 13a | The panel and q1 (0.3 s). The ring timer sits at (910, 250). | `word('b48','What is')` |
| 13a | The figure's torso draws on (0.8 s; k 0.9, legs 0) | `word('b48',"diaphragm's")` |
| 13b | "Breathing in." The dome flattens and the belly moves out (1.2 s). | `word('b49','Breathing')` |
| 13c | The question swaps to q3 (out 0.12 s, in 0.2 s, linear). The figure fades over 0.4 s. | `at('b51')` |
| 13c | The traces stack in at 1.2 times, rising 14 px, 0.1 s apart, with their names. Their ILLUSTRATION chip comes in with the first. | `word('b51','long')` |
| 13c | Row 3 lights and its tick scales 1.2. Rows 1 and 2 dim. The answer lands. | `word('b52','together')` |
| 13d | The question swaps to q4. The traces and their chip leave over 0.4 s. | `at('o14a')` |
| 13d | The frame comes back to full with "A, any octave" and its own chip (0.6 s). | `word('o14a','steady')` |
| 13d | Tavi's line redraws, silent, in `REDRAW` = min(2.4, the cascade - 0.5 - "settles") = 1.935 s. | `word('b54','settles')` |
| 13d | The mint edge and "in the band" light. | settles + 0.704 / LINE_K = 25.241 |
| 13d | The "settled" flag stands at x 334.5. | settles + 1.204 / LINE_K = 25.338 |
| 13d | "It settles into the band / and stays there." | `word('b54','band')` |
| 13e | The clean break: the kicker, panel, answer and frame leave up fast in turn, 0.07 s apart | `at('break','start',0.2)` |
| 13e | Hop 1 to (700, 840) and hop 2 to (1290, 840): the pass's crouch, then power1.in | `at('break','start',0.6)`, `at('break','start',1.25)` |
| 13e | The Voice Mirror panel and "Practise it." The panel's foot steps through `VM.panel.feet` (0.3 s each, power2.out). | `word('b55','Practise')` |
| 13e | "Voice Mirror" and its rule | the panel + 0.4 |
| 13e | Three rows, each glyph 0.25 s before its words | `word('b55','glide' / 'hold' / 'then')` |
| 13e | The hold's readout (Inter 32, three lines at 523, 560, 597) | `word('b55','plays')` |
| 13f | "Keep the glides comfortable." (654) | `word('b56','Keep')` |
| 13f | "Sore, hoarse or unwell today? Just listen along." (699) | `word('b56','Sore')` |
| 13f | "Free, no account: mercurypitch.com/mirror" (752) | `word('b56','Free')` |
| 13f | The address underlined at 764, over 0.5 s | `word('b56','mercurypitch')` |
| 13f | The ten line: one line, Inter 30, baseline 820 | `at('b56','end',-0.3)` |
| 13g | The rest card: its panel and question, title, body and address | `word('b58', 'Felt' / 'Rest' / 'Voice' / 'mercurypitch')` |
| 13g | Both cards drift up 14 px (sine.inOut) in a composited HTML layer | `at('card')` |
| 13g | The cards' lines leave up 12 px in turn, 0.03 s apart. Each panel fades over its lines' sweep. | `at('card','end',-0.32)` |
| carry | The glyph's first dot hands over to the chrome bead in 0.1 s, which follows `L.TEASE.carry` in film time | `at('next','start',-0.92)` |

### Stills and clips

- **Probe stills** (`lab/s13-recap/probe-<t>.png`; `probe-sheet.png`):
  - The first frame is 0.00 and the last 65.02.
  - The rest: 0.71, 1.32, 1.66, 2.13, 3.17, 7.77, 8.22, 9.10, 16.80, 19.35, 19.39, 20.13, 25.49, 25.64, 26.16, 27.05, 27.16, 28.05, 28.26, 28.91, 29.17, 29.91, 30.41, 37.45, 39.40, 42.23, 48.56, 50.49, 60.27, 64.25 and 64.65.
- **The clip:** `lab/s13-recap/clip.mp4`, 30 fps, the whole scene, with the scratch voice (MIX=voice).
  - Stills: `clip-still-<t>.png` at 0.00, 1.71, 3.27, 7.77, 9.15, 17.00, 19.10, 19.40, 20.18, 25.30, 25.57, 25.79, 27.10, 27.50, 27.64, 27.80, 28.05, 28.27, 28.91, 29.25, 29.94, 30.20, 30.40, 30.60, 39.50, 42.40, 48.16, 50.59, 60.47, 63.40, 64.38, 64.55 and 65.00.
  - Sheet: `clip-sheet.png`.
- **The parts**, cut from the same render, each with its own `measure-*/` folder and log (`lab/s13-recap/parts/`):
  - `part-a-0-27.94.mp4`: 13a to 13d and the clean break.
  - `part-b-27.34-46.6.mp4`: the hops and the Voice Mirror card.
  - `part-c-46.2-65.025.mp4`: 13f, 13g and the carry.

### The cut on `recap` (S12 to S13), LAB-CHECKS 2

The proof is `lab/s13-recap/cutprobe.mjs` (adapted from group D's), with output in `lab/s13-recap/cut-recap/`:
- `out.png` and `in.png`, the cut frames;
- `out60.png` and `in60.png`, the 60 fps pair;
- `frame-000` to `frame-030`, through the cut;
- `cut-recap.mp4`, `cutdiff.txt` and `measure/`.

| Element | S12's last frame | S13's first frame |
| --- | --- | --- |
| The band | x 928 to 1824, y 104 to 202 | the same |
| Merc's line | y 153 at 5.6 px | the same |
| The edges | 2.8 px at 102.6 and 200.6 | the same |

- The frame moves 0.000 px across the cut.
- cutdiff residual is 0.00 on the cut frames, and 0.03, 0.08 and 0.00 on the 60 fps pair.
- `L.roomCut` crossfades the room over 0.3 s from F-turn.
- measure.py finds no event.

### Earlier fixes (the build round)

- **Hop 2's root snap.**
  - The renderer shows the pass frame for (t - data-start + data-media-start). That runs about 1.4 frames ahead of the index `L.mercGate` counts, and it put Merc 50 px left for 3 frames at hop 2 (`events/`).
  - s13 builds the root's t0 from the tag (`rootFromTag`).
  - It is accepted as a local fix until integration (DECISIONS 214).
- **The cards' drift snapped the type to whole pixels.** The cards now sit in a composited HTML layer moved by `translate3d`. The drawn shift follows the layer within 0.06 px (`drift.txt`).

### Accepted as built (DECISIONS 214)

- q3 breaks after "which start" (593 and 618 px). A break after "note," leaves 828 px for the second line, into the ring timer.
- q1 is one line at baseline 264. q4 breaks after "look like".
- The file's length warning stands.

### What the kit could offer

- `L.mercGate` taking its root's t0 from the tag. This is planned for integration (DECISIONS 214).
- A composited HTML card layer for slow drifts.
- The page's settled rule as a kit function. s13 and s10 each compute it now.
- `L.TEASE.LINE.y` at 170, to match s14's local override (DECISIONS 220).
- Lab tools:
  - `lab/s13-recap/tools/landings.py`, the 0.4 s sweep;
  - `tools/where.py`, the pixels behind an event;
  - `tools/steps.py`, centroid steps through a cut;
  - `cutprobe.mjs`;
  - the ink-based overlap checks in `checks.js`.

### Provisional values (confirmed; DECISIONS 214)

**The settled flag**, by group C's page rule:
- The entry is at 0.704 s, which puts x at 232 + 145.6 x 0.704 = 334.5. It spans y 538.5 to 554.5, with no label.
- The flag stands at the line's 1.204 s. With the fix round's speed that is 25.338.
- The mint edge lights at the entry, 25.241.
- Stills: `lab/s13-recap/flag-crop-25.79.png`, `clip-still-25.79.png` and `probe-25.64.png`.
- The wave measures 26.48 px a cycle and 36.4 px peak to peak.

**The hop height** is the pass's own.
- In the pass frames (`hop/hop.txt`, `hop/hop-sheet.png`) the sole lifts 20.0 px at the apex.
- In the film (`hop/hop-film.txt`, `hop/hop-film-sheet.png`):

| Still | Sole y | Crown y |
| --- | --- | --- |
| 28.27, hop 1 | 814 | 639 |
| 28.91, hop 2 | 812 | 637 |
| 29.25, landed | 835 | 666 |

- That is about 22 px at the feet. The floor is empty by then.

### measure.py (`lab/s13-recap/measure/`, `measure.log`)

**Holds:** see item 7.

**Events:**
- At 5.233, 8.9, 14.967, 15.067, 17.733, 21.6 and 23.367: 0.05 to 0.11 %, in the hosts' boxes and the ring timer's row.
- At 16.733: 0.23 %, where answer 3's linear fade ends.
- At 62.733 and 62.9: 0.18 and 0.62 %, inside the cards' drift. Every drift frame changes 14 to 26 thousand pixels as the type resamples (`events/where-drift.txt`).

### The 0.4 s rule (`lab/s13-recap/landings.txt`)

There are 29 landings. Two pairs are closer than 0.4 s, both the board's (13d): the redraw then the mint edge (0.136 s), and the mint edge then the flag (0.097 s). Both are scaled by the clock's redraw speed.

### Open questions

- None of s13's own after this round.

---

## s14-next (`compositions/s14-next.html`)

### Rows and the anchor each keys off

The camera stays at F0. Merc stands at (1290, 840) and Tavi at (1800, 840), both at 300.

| Row | What | Anchor |
| --- | --- | --- |
| 14a | The faint rows and the six other beads' outlines fade in (0.6 s), the rows masked round the hosts | S14's first frame (DECISIONS 219) |
| 14a | Kicker "NEXT TIME" | `at('next')` (next + 0.15 after the cut) |
| 14a | The carried bead lands on C4 with a squash and stays filled | `at('next','start',-0.92)` + 1.6 |
| 14a | Each bead lights blue (0.2 s, linear) on its onset, with an echo ring, and stays lit. On bead 0's note the carried bead gives way to it. | `at('twinkle')` + `L.TEASE.onset(i)` |
| 14b | The tease line, centred on x 960, baseline 170 | `word('b60','I move')` |
| 14b | The arrows, 0.08 s apart, 0.4 s each | `word('b60','every')` |
| 14b | The dashed copy (0.56 s) | the arrows + 0.3 |
| 14b | The "?" | the copy's end + 0.1 |
| 14c | The line and the kicker leave up fast | `at('b60','end',-0.06)` |
| 14c | The hook, line by line | `word('o15','Why')`, `word('o15','and')` |
| 14c | The hook leaves | `at('o15','end',0.04)` |
| 14c | The shrink starts. The rows and arrows fade over 0.4 s. | `at('end','start',-0.31)` |

### Stills and clips

- **Probe stills** (`lab/s14-next/probe-<t>.png`; `probe-sheet.png`): 0.00 (the first frame), 0.61, 0.65, 0.84, 1.69, 1.95, 5.04, 6.26, 7.69, 10.19, 14.03, 15.82 and 15.87 (the last frame).
- **The clip:** `lab/s14-next/clip.mp4`, 30 fps, with the voice.
  - Stills at 0.00, 0.30, 0.61, 0.88, 1.43, 1.70, 1.84, 4.94, 6.36, 7.73, 10.34, 14.18, 15.76 and 15.84.
  - Sheet: `clip-sheet.png`.

### The bead across `next` (S13 to S14)

The proof is in `lab/s14-next/cut-next/`: `rects.json`, `steps.txt`, `sheet.png`, `cut-next.mp4` and `frame-000` to `frame-030`.
- The bead sits at (332.16, 594.32), r 11.12, on S13's last frame and at (332.30, 594.60), r 11.13, on S14's first: 0.28 px apart.
- Its steps through the cut are 17.58, 19.40 | 20.75, 22.25 and 21.49 px.
- Its whole path stays left of x 450 (max 440).
- measure.py finds no event.

### measure.py and clearances

- measure.py: see item 7. There are two pops of 0.05 to 0.06 %, over the hosts and the drawing copy.
- The tease line's ink runs x 436.3 to 1484.7 and y 137 to 180. It sits 27 px under the kicker and 96 px over the copy.
- The hook's first line runs x 431.5 to 1494.7. Its second line sits 75 px over the copy.
- The A4 and G4 beads' feet sit 73 px over Merc's keep-out.

### The 0.4 s rule (`lab/s14-next/landings.txt`)

There are 16 landings. Two pairs are closer than 0.4 s:
- The rows, then the kicker, 0.15 s apart. DECISIONS 219 puts the rows on the first frame, and the board puts the kicker at next + 0.15.
- The arrows, then the copy, 0.30 s apart. The board makes these one beat.

### Accepted as built (DECISIONS 214)

- The arrows leave with the rows. HANDOFFS' end card keeps only the beads, the copy and the "?".

---

## s15-end (`compositions/s15-end.html`)

Unchanged in this round. It was rendered again and proved again.

### Rows and the anchor each keys off

| Row | What | Anchor |
| --- | --- | --- |
| 15 | The 3 % push, F0 to F-end, sine.inOut. The type stays frame-fixed. | the scene |
| 15 | The tease figure on its shrink, lit, with its copy and "?". The rows and arrows finish fading. | `at('end','start',-0.31)` |
| 15 | Merc grows to 400 in place. Tavi grows and hops 190 px left to (1610, 840). | `at('end','start',0.04)`, 0.7 s |
| 15 | The lockup's wipe (0.5 s) | `at('end','start',0.14)` |
| 15 | "mercurypitch.com/mirror" (0.2 s) | `at('end','start',0.54)` |
| 15 | "Voice Mirror is free, with no account" (0.2 s) | `at('end','start',0.94)` |

The card is at rest by end + 1.14 and complete for the last 5.06 s.

### Stills and clips

- **Probe stills** (`lab/s15-end/probe-<t>.png`; `probe-sheet.png`): 0.00, 0.39, 0.79, 0.90, 1.15 and 6.20.
- **The clip:** `lab/s15-end/clip.mp4`, 186 frames.
  - Stills at 0.00, 0.40, 0.90, 1.20, 3.00 and 6.17. The 6.17 still is taken from the clip's last frame.
  - Sheet: `clip-sheet.png`.

### The figure across `end` (S14 to S15)

The proof is in `lab/s15-end/cut-end/`: `rects.json`, `steps.txt`, `sheet.png` and `cut-end.mp4`.
- Across the cut the beads move 0.30 px, the copy 0.28 px and the "?" 0.08 px.
- The steps are 7.16, 9.77 | 11.76, 14.92 and 18.41 px.
- One jump of 0.80 %, 0.23 s before the cut: the hook leaving.
- The push lands at F-end, scale 1.030. The address stays at baseline 320.

### The end card, measured

| Element | Measured |
| --- | --- |
| Lockup ink | x 124.6 to 497.4 |
| Address | x 124 to 949, baseline 320 |
| Free line | baseline 395, 58 px over the clear zone |
| Tease figure | x 1203 to 1688, y 159 to 386 |
| Merc and Tavi at 400 | x 1184 to 1396 and 1504 to 1716 |

**The clear zone** (`lab/s15-end/clear-zone.txt`) holds only the room. Its mean is 21.1 against 19.8 for the ground, and its maximum is 63, a dust speck.

### The 0.4 s rule

The wipe, the address and the free line land exactly 0.40 s apart.
