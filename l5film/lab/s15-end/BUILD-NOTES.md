# Build notes: scene group E (s13-recap, s14-next, s15-end)

The same notes are in `lab/s13-recap/`, `lab/s14-next/` and `lab/s15-end/`. All paths are relative to
P (`$S/l5film`). Times are scene time unless they say "film". Scenes: s13 462.37 to 527.395 (65.025 s),
s14 to 543.265 (15.87 s), s15 to 549.465 (6.2 s). Every time keys off the clock (`L.at`, `L.word`,
`L.dur`); clock-lint is silent on all three files.

## Checks over the group

| Check | Result | Where |
| --- | --- | --- |
| Probes (checks.js through `lab/s05-push/probe.mjs`) | 205 + 90 + 48 checks, 0 FAIL | `lab/<sid>/probe.json` and `probe-<t>.png` (sheets: `lab/s13-recap/probe-sheet.png`, `lab/s14-next/probe-sheet.png`) |
| Root `check` (observe mode, coverage 0) | 0 errors. My files' warnings: `duplicate_media_discovery_risk` on all three (the `-refl` tags; every scene in the film has it) and `composition_file_too_large` on s13 (352 lines). No missing-pass finding: the passes exist. | `lab/s13-recap/root-check.log` |
| Contrast at the settled-label times | s13 at 20.2, 26.4, 39.5, 50.6, 60.5: 51/51 AA. s13 at 3.2, 9.1, 17.0, 30.0, 48.2: 28/28. s14 at 1.4, 7.7, 10.3, 14.2: 9/9. s15 at 1.2, 3.0, 6.1: 15/15. Layout: 0 issues. | `lab/<sid>/contrast-check*.log` |
| clock-lint over the three files | silent, exit 0 | `lab/s13-recap/clock-lint.log` |
| `merc-tags.py s13-recap s14-next s15-end --check` | 12 Merc tags, 0 stale, 0 problems | `lab/s13-recap/merc-tags.log` |
| The 0.4 s rule over my rows | Every landing closer than 0.4 s is a pair the board sets itself (listed per scene below) | `lab/<sid>/landings.txt`, from `lab/s13-recap/tools/landings.py` |
| LAB-CHECKS 21: real font widths | Every line measured in the real fonts; the clearances below hold | `lab/s13-recap/widths.txt` (`tools/widths.mjs`) |
| LAB-CHECKS 22: the card lines and the coach | b55, b56 and b58 are `[coach]` lines (script.json). Their cards are drawn word for word from the kit's page text (`L.RECAP.VM`, `L.RECAP.REST`); the probe checks every string. Nothing is reworded. They wait for the coach. | `probe.json` (the wording rows) |

---

## s13-recap (`compositions/s13-recap.html`)

### Rows and the anchor each keys off

The camera stays at F0 throughout. Every move in the scene belongs to an object.

| Row | What | Anchor |
| --- | --- | --- |
| cut | The frame on F-turn's pixels. `L.roomCut(room, {from: 'F-turn'})` gives the room's 0.3 s crossfade. | the scene's start |
| 13a | The frame slides down and widens (1.2 s, power2.inOut). The band edges ease from 2.8 to 2 px (DECISIONS 202). Merc's line width follows `RC.mercW`. Her line waits for `RC.voiceOK`. The frame then dims to 35 % (0.3 s, linear). | `at('recap','start',-0.04)` (board 478.20) |
| 13a | Kicker "QUICK CHECK" | `at('recap')` |
| 13a | The panel and q1 (0.3 s). The ring timer sits at (910, 250), beside the question. | `word('b48','What is')` |
| 13a | The figure's torso draws on (0.8 s; `L.FIGURE.S13`, legs 0) | `word('b48',"diaphragm's")` |
| 13b | "Breathing in." The dome flattens and the belly moves out (1.2 s, sine.inOut). | `word('b49','Breathing')` |
| 13c | The question swaps to q3: the old line out over 0.12 s, the new in over 0.2 s, both linear (DECISIONS 183). The figure fades over 0.4 s. | `at('b51')` |
| 13c | The traces stack in, rising 14 px, 0.1 s apart, with their names | `word('b51','long')` |
| 13c | Row 3 lights and its tick scales 1.2. Rows 1 and 2 dim. The answer lands. | `word('b52','together')` |
| 13d | The question swaps to q4. | `at('o14a')` |
| 13d | The traces fade. The frame comes back to full with "A, any octave" and "ILLUSTRATION" (0.6 s). | `word('o14a','steady')` |
| 13d | Tavi's line redraws, silent, at 10 / 2.4 its speed. | `word('b54','settles')` |
| 13d | The mint edge and "in the band" light. They hold. | settles + 0.704 / (10/2.4) = 25.274 (film 487.644) |
| 13d | The "settled" flag stands at the entry's x. | settles + 1.204 / (10/2.4) = 25.394 (film 487.764) |
| 13d | "It settles into the band / and stays there." | `word('b54','band')` |
| 13e | The clean break: the kicker, panel, answer and frame leave up fast in turn (power3.in, 0.3 s) | `at('break','start', 0.06 / 0.13 / 0.2 / 0.26)` |
| 13e | Hop 1 to (700, 840) and hop 2 to (1290, 840). Each is the pass's crouch, then power1.in through the air. | `at('break','start',0.6)` and `at('break','start',1.25)` |
| 13e | The Voice Mirror panel and "Practise it." The panel's foot follows `L.track` through `VM.panel.feet` (0.3 s each, power2.out). | `word('b55','Practise')` |
| 13e | "Voice Mirror" and its rule | `word('b55','Voice Mirror')` |
| 13e | Three rows. Each glyph lands 0.25 s before its words. | `word('b55','glide' / 'hold' / 'then')` |
| 13e | The hold's readout (Inter 32, three lines, `L.TURN.breakLines` at 800 px) | `word('b55','plays')` |
| 13f | "Keep the glides comfortable." | `word('b56','Keep')` |
| 13f | "Sore, hoarse or unwell today? Just listen along." | `word('b56','Sore')` |
| 13f | "Free, no account: mercurypitch.com/mirror" | `word('b56','Free')` |
| 13f | Its address underlined over 0.5 s | `word('b56','mercurypitch')` |
| 13f | The ten line (see "Could not build as written", item 1) | `at('b56','end',-0.3)` |
| 13g | The rest card: the panel and its question | `word('b58','Felt')` |
| 13g | Its title | `word('b58','Rest')` |
| 13g | Its body | `word('b58','Voice')` |
| 13g | Its address. The underline starts 0.2 s later. | `word('b58','mercurypitch')` |
| 13g | Both cards drift up 14 px (sine.inOut) over `card`. | `at('card')` to `at('card','end')` |
| 13g | The cards' lines leave up 12 px in turn, by baseline, 0.03 s apart, 0.2 s each. Each panel fades over its own lines' whole sweep. | `at('card','end',-0.32)` |
| carry | The glyph's first dot hands over to the chrome bead in 0.1 s. The bead follows `L.TEASE.carry` in film time across the cut. | `at('next','start',-0.92)` |

### Stills and clips

- **Probe stills** (`lab/s13-recap/probe-<t>.png`; sheet `probe-sheet.png`):
  - The first and last frames: 0.00 and 65.02.
  - Landed and settling moments: 0.71, 1.32, 1.66, 2.13, 3.17, 7.77, 8.22, 9.10, 16.80, 19.39, 20.13, 25.52, 25.69, 26.16, 27.16, 27.91, 28.26, 28.91, 29.17, 29.91, 31.31, 37.45, 39.40, 42.23, 48.56, 50.49, 60.27, 64.25 and 64.65.
- **The clip:** `lab/s13-recap/clip.mp4`, 30 fps, the whole scene, with the scratch voice.
  - Stills are `clip-still-<t>.png` at 0.00, 0.15, 0.35, 0.71, 1.71, 2.23, 3.27, 7.77, 9.15, 17.00, 20.18, 25.57, 25.79, 26.36, 27.64, 27.94, 28.27, 28.47, 28.55, 28.57, 28.60, 28.91, 29.25, 29.94, 30.06, 39.50, 48.16, 50.59, 60.47, 63.40, 64.38, 64.55 and 65.00.
  - The sheet is `clip-sheet.png`.
- **The parts** (s13 runs 65 s), cut from the same render: `lab/s13-recap/parts/`.
  - `part-a-0-27.94.mp4`: 13a to 13d and the clean break.
  - `part-b-27.34-46.6.mp4`: the hops and the Voice Mirror card.
  - `part-c-46.2-65.025.mp4`: 13f, 13g and the carry.
  - Each has its own `measure-part-*/` folder and `.log`.

### The cut and handoff proofs

**The matched cut on `recap` (S12 to S13), LAB-CHECKS 2.** The proof is `lab/s13-recap/cutprobe.mjs` (adapted from group D's), with output in `lab/s13-recap/cut-recap/`:
- `out.png` and `in.png` are the cut frames; `out60.png` and `in60.png` are the 60 fps pair; `frame-000` to `frame-030` run through the cut; the clip is `cut-recap.mp4`.

| Measure | S12's last frame | S13's first frame |
| --- | --- | --- |
| Band | x 928 to 1824, y 104 to 202 | the same |
| Merc's line | y 153, 5.6 px | the same |
| Edges | 2.8 px at y 102.6 and 200.6 | the same |

- The movement across the cut is 0.000 px.
- cutdiff gives residuals of 0.00 for the band, the line and the edges on the cut frames, and 0.03, 0.08 and 0.00 on the 60 fps pair (`cutdiff.txt`).
- `L.roomCut` crossfades the room over 0.3 s from F-turn.
- measure.py over the cut clip finds no single-frame event: no spike from the near layer.

**The bead across `next` (S13 to S14).** See the s14 section.

**Framing.** s13 lands no framing other than F0. Its object moves are the frame's slide (probe 0.00, 0.71 and 1.32), the hops and the drift.

### measure.py (the whole clip: `lab/s13-recap/measure/`, `measure.log`)

- **Holds:** 3.2 s inside the scene, 1.5 s per 30 s, the longest 0.3 s, no final hold.
  - By part: a 1.6 s per 30 s (longest 0.2), b 1.9 (longest 0.3), c 2.1 (longest 0.2).
  - The holds are 0.1 to 0.3 s each, in Merc's pauses and the ring-timer windows. Per DECISIONS 189 they go to the final passes; no motion was added for them.
- **Single-frame events:** none over 0.56 % of pixels.
  - 5.233, 8.9, 14.967, 15.067, 17.733, 21.6, 23.367 and 47.367 s: 0.05 to 0.11 %. Their pixels are in the hosts' boxes, plus the ring timer's row, which moves continuously (`events/where-events.txt`).
  - 16.733 s: 0.23 %. Answer 3's linear fade-in ends here.
  - 62.733, 62.8, 62.9 and 64.1 s: 0.12, 0.07, 0.56 and 0.45 %. These fall inside the cards' 2 s drift. Every frame of the drift changes 14 to 26 thousand pixels as the type resamples sub-pixel, and these frames stand out of that stream by less than 2x at full size (`events/where-drift.txt`).
- **Loudness:** -19.9 LUFS integrated, true peak -2.0 dBTP.

### Fixes made in the lab, with numbers

1. **The hop-2 root snap.**
   - The first clip showed a 1.25 % pop at 28.567. At 60 fps (`events/f60`, `events/hop-event-sheet.png`), Merc sat 50 px left for 3 frames (28.55 to 28.58).
   - Cause: the renderer shows pass frame floor((t - data-start + data-media-start) x 30). That runs about 1.4 frames ahead of the index `L.mercGate` counts from the root table's t0, and at hop 2's start the root snaps from 0.38 back to 0.
   - Fix: s13 now builds the root's t0 from its tag (`rootFromTag`). After the re-render the pop is gone, and `clip-still-28.55`, `28.57` and `28.60` hold him at 700.
2. **The cards' drift snapped the type.**
   - It caused 13 jumps of 3.3 to 3.9 % between 62.7 and 64.2. Chrome snaps SVG text baselines to whole pixels.
   - The cards now sit in a composited HTML layer that drifts by `translate3d`.
   - The drawn shift follows the layer's offset within 0.06 px from 0 to 1.70 s into `card` (`drift.txt`, `tools/driftcheck.mjs`, `tools/drift.py`).

### Could not build as written

1. **The ten line is one line, not two.**
   - Built: "Ten minutes, gently, most days. Missed a day? Just come back." in Inter 32, ink-2, at x 270, baseline 820.
   - The board's two lines (Inter 34, baselines 822 and 862) would put the floor horizon at y 840 through the second line's capitals, against DECISIONS 203 (no type within 12 px of y 840).
   - The ink runs y 796 to 827, 13 px over the floor horizon and 6 px under the Voice Mirror panel's foot (y 790), and x 270 to 1146, 64 px from Merc's body box.
   - Crop: `lab/s13-recap/ten-crop-50.59.png`, from `clip-still-50.59.png`.
2. **Card 3's line ends 0.09 s before the frame leaves.**
   - The board's 2.4 s redraw from "settles" ends at 27.505, and the frame leaves up fast from 27.6.
   - The scratch b54 runs 2.235 s from "settles" to `break`, against the board's 3.31 s (504.93 to 508.24).
   - The flag (25.394) and answer 4 (25.855) land in good time; only the line's last wave is cut short.
3. **The q3 line break.**
   - q3 is split as "For a long, easy note, which start" / "do many singing teachers aim for?" (593 and 618 px).
   - The phrase break after "note," would make the second line 828 px, which runs into the ring timer at x 910.
   - q1 fits on one line (642 px), at baseline 264, level with the ring timer. q4 breaks after "look like" (685 and 303 px).
   - Every question is word for word.

### What the kit could offer

- **`L.mercGate` should take its root's t0 from the tag** (data-start minus data-media-start). s13's `rootFromTag` does this in 6 lines. Any scene whose root snaps mid-move is otherwise off by about 1.4 frames.
- **A composited HTML card layer for slow drifts** (`translate3d`), so type moves sub-pixel. Any chapter card that drifts would gain from it.
- **The page's settled rule as a kit function.** Something like `L.CONTOUR.settledAt(contour, {every: 0.016, cents: 35, hold: 0.5})` would replace the copies; s13 and s10 each compute it now.
- **Lab tools.** These may be of use to the other groups:
  - `lab/s13-recap/tools/landings.py`: the 0.4 s sweep from the clock.
  - `tools/where.py`: the pixels behind a measure.py event.
  - `cutprobe.mjs`: three cuts in one probe.
  - `lab/s14-next/cut-next/steps.py`: centroid steps through a cut.
  - The ink-based overlap checks in `checks.js`.

### Provisional values confirmed

**The "settled" flag** uses group C's page rule (DECISIONS 191): readings every 16 ms, settled from the first reading after which the line stays within 35 cents for 0.5 s.

| Value | HANDOFFS (provisional) | Confirmed |
| --- | --- | --- |
| Entry | 0.69 s | 0.704 s |
| Flag x | 332 | 232 + 145.6 x 0.704 = 334.50 |
| Flag time | 505.21 (board) | the line's 1.204 s: 25.394 (film 487.764) |

- The mint edge and "in the band" light at the entry: 25.274 (film 487.644).
- The flag spans y 538.5 to 554.5 on the band's top edge, with no label.
- Stills: `lab/s13-recap/flag-crop-25.79.png` (2x, with ticks at x 334.5 and y 538.5 / 554.5), `clip-still-25.79.png` and `probe-25.69.png`.
- The wave in 13d measures 26.48 px a cycle and 36.4 px peak to peak, as the board asks (26.5 and 36.4).

**The hop height** is the pass's own.
- On m-blue-s13's frames (`lab/s13-recap/hop/hop.txt`, `hop-sheet.png`), the sole lifts 20.0 screen px at the apex (pass frames 847 to 849 for hop 1, 867 to 868 for hop 2), the body's top 41 px, and the root 0.2016 units (26.3 px).
- In the film's frames (`hop/hop-film.txt`, `hop/hop-film-sheet.png`):

| Still | Sole y | Crown y |
| --- | --- | --- |
| 27.94 (before hop 1) | 835 | 673 |
| 28.27 (hop 1) | 813 | 640 |
| 28.91 (hop 2) | 813 | 637 |
| 29.25 (landed) | 835 | 666 |

- That is a 22 px lift at the feet. The floor is empty by then, so it clears everything.

### The 0.4 s rule (`lab/s13-recap/landings.txt`)

There are 29 landings. Two pairs are closer than 0.4 s, and both are the board's (13d):
- The redraw, then the mint edge 0.169 s later. The board has 504.93, then 505.10 at the line's 0.69 s.
- The mint edge, then the flag 0.120 s later. The board has 505.10, then 505.21.

### Open questions

1. Accept the ten line as one line (item 1 above)? Or should the Voice Mirror panel's foot rise to give it more than 6 px of air? That foot is the kit's `L.RECAP.VM.panel.feet`.
2. Card 3's line has 0.09 s to spare before the break. Should the final voice's b54 decide, or should the line draw faster than 10 / 2.4?
3. Should `L.mercGate`'s root index move to the tag's media start for every scene? That would retire s13's local `rootFromTag`.
4. The root check warns that s13 is 352 lines. It is one sub-composition, as BUILD-GUIDE's skeleton has it. Split it only if the director wants that.

---

## s14-next (`compositions/s14-next.html`)

### Rows and the anchor each keys off

The camera stays at F0 throughout. Merc stands at (1290, 840) and Tavi at (1800, 840), both at 300 (`L.HOSTS.mercRight`).

| Row | What | Anchor |
| --- | --- | --- |
| 14a | Kicker "NEXT TIME" (board 540.62 = next + 0.15 after the cut) | `at('next')` |
| 14a | The faint rows fade in (0.6 s), masked round the hosts | `at('next','start',0.38)` (board 541.00) |
| 14a | The carried bead lands on C4 with a squash (`L.bead4.squash`) and crossfades into bead 0's outline as the six outlines come in (0.5 s) | `at('next','start',-0.92)` + 1.6 (board 541.30) |
| 14a | Each bead lights blue (0.2 s, linear) on its onset, with its echo ring, and stays lit | `at('twinkle')` + `L.TEASE.onset(i)`, 0.5 s apart |
| 14b | The tease line, centred, baseline 150 | `word('b60','I move')` |
| 14b | The arrows rise, 0.08 s apart, 0.4 s each | `word('b60','every')` |
| 14b | The dashed copy draws bead by bead (0.56 s) | arrows + 0.3 |
| 14b | Its "?" | the copy's end + 0.1 |
| 14c | The tease line and the kicker leave up fast | `at('b60','end',-0.06)` |
| 14c | The hook, two lines, each on its words | `word('o15','Why')`, `word('o15','and')` |
| 14c | The hook leaves up fast | `at('o15','end',0.04)` |
| 14c | The shrink starts (`L.TEASE.shrink`, film time, across the cut). The rows and arrows fade over 0.4 s. | `at('end','start',-0.31)` |

### Stills and clips

- **Probe stills** (`lab/s14-next/probe-<t>.png`; sheet `probe-sheet.png`): 0.00 (first frame), 0.65, 0.84, 1.38, 5.04, 6.26, 7.69, 10.19, 14.03, 15.82 and 15.87 (last frame).
- **The clip:** `lab/s14-next/clip.mp4`, 30 fps, with the voice.
  - Stills at 0.00, 0.30, 0.88, 1.43, 1.84, 4.94, 6.36, 7.73, 10.34, 14.18, 15.76 and 15.84.
  - The sheet is `clip-sheet.png`.

### The cut and handoff proofs

**The bead across `next` (S13 to S14).** The proof is in `lab/s14-next/cut-next/` (`rects.json`, `steps.txt`, `cut-next.mp4`, `frame-000` to `frame-030`).
- The bead is at (332.16, 594.32), r 11.12, on S13's last frame and at (332.30, 594.60), r 11.13, on S14's first: 0.28 px.
- Its centroid steps through the cut are 17.58, 19.40 | 20.75, 22.25 and 21.49 px (frames 13 to 17), which is smooth.
- The carry's whole path, radius included, stays left of x 450 (max 440.0).
- measure.py over the cut clip finds no event.

**The tease figure across `end`.** See s15.

**Framing.** F0 only.

### measure.py (`lab/s14-next/measure/`, `measure.log`)

- **Holds:** 0.6 s (1.1 s per 30 s), the longest 0.2 s, no final hold.
- **Events:** two pops, at 7.233 (0.06 %) and 12.5 (0.05 %). Their pixels lie over the hosts, and at 7.233 also over the copy as it draws (`measure/where-events.txt`).
- **Loudness:** -19.9 LUFS, true peak -1.0 dBTP.

### Fonts, clearances and the 0.4 s rule

| Item | Measured |
| --- | --- |
| The tease line | x 436 to 1484. 156.5 px clear of the kicker. 487 px from Merc's body box. |
| The hook, line 1 | x 431.5 to 1494.7 |
| The hook, line 2 | 75 px over the copy |
| A4 and G4 beads | their feet are 73 px over Merc's keep-out |
| The beads and the copy | 90.8 px or more from Merc's body box |

- The landing sweep (`lab/s14-next/landings.txt`) finds 16 landings and three pairs under 0.4 s, all the board's:
  - 14a: the kicker 540.62, then the rows 541.00 (0.38 s).
  - 14a: the rows 541.00, then the carried bead 541.30 (0.30 s).
  - 14b: the arrows, then the copy (0.30 s). The board makes them one beat: the copy draws as each arrow arrives.

### Could not build as written

- **The arrows leave with the rows.** HANDOFFS § The end card keeps only "the beads, copy, "?"", so the arrows fade over the shrink's first 0.4 s with the rows, in both s14 and s15.

### Open questions

- None of s14's own.

---

## s15-end (`compositions/s15-end.html`)

### Rows and the anchor each keys off

| Row | What | Anchor |
| --- | --- | --- |
| 15 | The push from F0 to F-end, 3 % about (960, 540), sine.inOut over the scene. The room and the figure ride it; the type stays frame-fixed. | the scene |
| 15 | The tease figure, lit, with its copy and "?", carries on its shrink into the end card's box (`TE.place(L.TEASE.shrink(T, ...))`). The rows and arrows finish fading. | `at('end','start',-0.31)` |
| 15 | Merc grows to 400 in place. Tavi grows to 400 and hops 190 px left to (1610, 840) (`L.LEAP.crouch`, then `L.LEAP.air`, power1.in). | `at('end','start',0.04)` (board 556.05), 0.7 s |
| 15 | The lockup's feathered wipe (0.5 s, power1.inOut) | `at('end','start',0.14)` (board 556.15) |
| 15 | "mercurypitch.com/mirror", Outfit 600 72 (0.2 s, linear) | `at('end','start',0.54)` (board 556.55) |
| 15 | "Voice Mirror is free, with no account", Outfit 500 44 (0.2 s) | `at('end','start',0.94)` (board 556.95) |

The card is at rest by end + 1.14, complete for the last 5.06 s, with the hosts idling past the last frame.

### Stills and clips

- **Probe stills** (`lab/s15-end/probe-<t>.png`): 0.00 (first frame), 0.39, 0.79, 0.90, 1.15 and 6.20 (last frame, F-end landed).
- **The clip:** `lab/s15-end/clip.mp4`, 30 fps, 186 frames.
  - Stills at 0.00, 0.40, 0.90, 1.20, 3.00 and 6.17. The last was cut from the clip's end frame; the clip tool's seek missed it.
  - The sheet is `clip-sheet.png`.

### The cut and handoff proofs

**The tease figure across `end` (S14 to S15).** The proof is in `lab/s15-end/cut-end/` (`rects.json`, `steps.txt`, `sheet.png`, `cut-end.mp4`).

| Element | Largest move across the cut |
| --- | --- |
| The beads | 0.30 px |
| The copy | 0.28 px |
| The "?" | 0.08 px |

- The centroid steps of the lit beads through the cut are 7.16, 9.77 | 11.76, 14.92 and 18.41 px (frames 13 to 17), which is smooth.
- measure.py over the cut clip finds one jump at 0.267 s (0.80 %). That is the hook leaving up fast (power3.in), 0.23 s before the cut.

**The landed framing.** F-end, scale 1.0300 at 6.20 (`probe-6.20.png`, `clip-still-6.17.png`).
- The type stays frame-fixed: the address is still at baseline 320.
- The world scales 3 % under it. That is the push's tell.

### The end card, measured

| Item | Measured |
| --- | --- |
| Lockup | ink x 124.6 to 497.4, y 84.6 to 175.4 |
| Address | x 124 to 948.8, baseline 320 |
| Free line | x 121 to 815, baseline 395, 58 px over the clear zone's top (y 460) |
| Tease figure, settled | x 1203 to 1688, y 159 to 386 |
| Merc at 400 | body x 1184 to 1396, y 584 to 840 |
| Tavi at 400 | body x 1504 to 1716 |

- The tease figure's box runs past x 1660 only for the "?", by HANDOFFS' own formula: the "?" runs from x 1430 to about 1464 in the full figure, which maps to 1674 to 1689.
- **The clear zone** (x 80 to 1100, y 460 to 880) holds nothing the scene draws. Only the room's ground, floor horizon and dust reach it (`lab/s15-end/clear-zone.txt`):
  - Its mean luminance is 21.1, against 19.8 for the ground below it.
  - Its maximum is 63 (a dust speck); 2 of 428,400 pixels are over 60.

### measure.py (`lab/s15-end/measure/`, `measure.log`)

- **Holds:** 0.8 s inside the scene (3.9 s per 30 s on a 6.2 s scene), the longest 0.4 s, no final hold. The end card holds still for the eye on the board's word (DECISIONS 180), and the push never stops.
- **Events:** none.
- **Loudness:** -70 LUFS. The scene has no voice; the end chimes come in the sound round.

### The 0.4 s rule (`lab/s15-end/landings.txt`)

The wipe, the address and the free line land exactly 0.40 s apart, on the rule.

### Open questions

- None of s15's own.
