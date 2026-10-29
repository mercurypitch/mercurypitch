# Handoffs: exact frames where one builder's scene meets the next

The last frame of scene N and the first frame of scene N+1 must show every carried object on the
same pixels (within 2 px). Values marked **(provisional)** are starting values: the builders on
either side of a handoff confirm them in a lab still, then this file is updated and the mark removed
before either scene is built further. Unmarked values follow from the formulas below and are fixed
now. Times are the scratch clock's (`cues.json`); every scene computes them from cues.

Builder groups (STORYBOARD): [A] S1 to S4, [B] S5 and S6, [C] S7 and S8, [D] S9 to S11, [E] S12 and
S13, [F] S14 to S16.

## Shared formulas

- Film time `T = L.scene(SID).start + t`; anything that travels (a glow, a drift, an orbit) is drawn
  from `T`, so its phase matches across a cut. Easing names are GSAP's; a curve that spans a cut is
  evaluated with GSAP's own function on both sides.
- A framing is `x' = s x + ox`, `y' = s y + oy` from world coordinates (§ World) to the screen. A
  push of scale `s` about `(cx, cy)` is `ox = cx (1 - s)`, `oy = cy (1 - s)`. A change of framing
  interpolates `s`, `ox` and `oy` together on one curve. The room's far, mid and near layers follow
  `L.rig` with factors 0.25, 1 and 1.6, so a push shows parallax and a pan moves every layer equally.
- The staircase's own labels (stair names, riser labels, key names) scale with it: 36, 40 and 34 px
  at `s = 1`. Frame-fixed type (kickers, the list, legends, tallies, cards) never scales.
- Text and marks fade in over 0.2 s from their cue and out over 0.2 s from their exit cue unless a
  row says otherwise. Counted pulses as STORYBOARD § Type.
- The Mercs are placed in screen space. A Merc's body is about 0.53 of its shown size wide and 0.64
  of it tall, standing on its feet point (Lesson 1's frames): at 420 it is x ±111, 269 tall; at 360
  ±95, 230; at 300 ±80, 192; at 240 ±64, 154; at 520 ±138, 333.
- Beads: `L.bead(svg, { r: 22, color })` in world units, so 26 px in F-cold and 44 px in a 2x
  close-up; a bead on a stair sits on the tread at the stair's centre. Blue `#58a6ff`, orange
  `#ff7448`, chrome `#c3ccd6`. A hop between treads is an arc 0.3 s long, landing on the note's
  onset, peaking 40 world px above the higher tread.
- Tavi's guesses: a dashed ink-2 `#a8b3bf` stroke (3 px, dash 10, gap 8) with a "?" (`L.GUESS`).
- Everything essential sits above y 896; S13's care block above y 864.

## World (F0, `s = 1`)

**Rows.** Semitone rows from C4 (k 0) to G5 (k 19), 26 px each: row k spans
`y = 690 - 26 (k + 1)` to `690 - 26 k`, so C4 is y 664 to 690 and G5 y 170 to 196. In F0 they run
x 220 to 1680. Black-key rows (C♯, D♯, F♯, G♯, A♯) are filled ink at 6 %, the others ink at 2.5 %;
row lines ink 6 %, 1 px. The cold open's compact rows are C4 to D5 (k 0 to 14, y 300 to 690) and
run x 230 to 1206.

**Stairs.** A start is named by its white-key index `w` (C 0, D 1, E 2, G 4) and its semitones above
C4 `s0` (C 0, D 2, E 4, G 7). Stair n (1 to 8) has height `h` = 0, 2, 4, 5, 7, 9, 11, 12 above do;
its column is centred at `x = 298 + 120 (w + n - 1)`, 112 px wide; its tread is the top of row
`k = s0 + h`, `y = 690 - 26 (k + 1)`; the block runs from the tread down to the foot,
`y = 736 - 26 s0` (46 px below do's row). Corner radius 6 at the tread.

| Start | Stair centres x                              | Treads y (stairs 1 to 8)              | Foot y | Keys                                  |
| ----- | -------------------------------------------- | ------------------------------------- | ------ | ------------------------------------- |
| C     | 298 418 538 658 778 898 1018 1138            | 664 612 560 534 482 430 378 352       | 736    | C4 D4 E4 F4 G4 A4 B4 C5               |
| D     | 418 538 658 778 898 1018 1138 1258           | 612 560 508 482 430 378 326 300       | 684    | D4 E4 F♯4 G4 A4 B4 C♯5 D5             |
| E     | 538 658 778 898 1018 1138 1258 1378          | 560 508 456 430 378 326 274 248       | 632    | E4 F♯4 G♯4 A4 B4 C♯5 D♯5 E5           |
| G     | 778 898 1018 1138 1258 1378 1498 1618        | 482 430 378 352 300 248 196 170       | 554    | G4 A4 B4 C5 D5 E5 F♯5 G5              |

A slide interpolates `w` and `s0` together (power2.inOut unless a row says otherwise), so the shape
never changes in flight. Fills: unlit `#1b232d` with a 2 px chrome rim at 40 % and a 3 px chrome
tread line at 70 %; lit chrome 60 % chrome mix; lit blue or orange a 45 % mix with a rim in the
colour (35 % if the lab's stair-name contrast falls under 4.5:1); outline (the cold open's unreached
top stair) no fill, a 2 px chrome stroke at 55 %; dimmed, every fill and stroke at 25 % (20 % in
S11's tiers) with its labels hidden.

**Stair names.** Outfit 600 36 px, ink, centred on the column, baseline `foot - 12`.

**Risers.** Between stairs n and n+1, centred at `x = 298 + 120 (w + n - 1) + 60`, from stair n's
tread up to stair n+1's: unmeasured 4 px chrome at 40 %; measured 6 px, chrome for a tone with a
12 px dark tick (`#2a323c`) at its middle row line, gold `#ffd84d` for a semitone. On every start the
gold pair is between stairs 3 and 4 and between 7 and 8. A riser label (T, S, 2, 1) is Outfit 600
40 px, ink, right-aligned 10 px left of the riser, baseline 8 px above stair n's tread.

**House.** 56 x 52 px, centred on a do stair's column, its base 14 px above the tread. Unlit: a 3 px
chrome outline at 55 %. Lit: ink fill, a 16 px soft chrome glow.

**Strip.** White keys C4 to G5, key j (0 to 11) from `x = 240 + 120 j` to `+ 116`, y 760 to 880,
centre `298 + 120 j`; Lesson 1's fill `#e6edf3` at 92 %, corner radius 6 at the foot. Black keys 64
px wide, y 760 to 836, `#161b22` with a `#30363d` rim, centred on the boundaries `358 + 120 j`:
C♯4 358, D♯4 478, F♯4 718, G♯4 838, A♯4 958, C♯5 1198, D♯5 1318, F♯5 1558. Keys outside the scale
have their fills at 45 %; a black key in the scale lights to 60 % chrome. Key names: a white key's
letter JetBrains Mono 34 px `#2a323c`, centred, baseline 862; a black key's name ink 28 px, baseline
822; ♯ as a Noto Music path (`L.spell`).

**Hairlines.** 1.5 px chrome at 50 % from each stair's foot at its column centre to the top centre
of its key (y 760). A sharp's hairline slants to its black key.

**Tavi's white-keys staircase (S7).** On D's columns (centres 418 to 1258), heights 0, 2, 3, 5, 7,
9, 10, 12, so treads 612 560 534 482 430 378 352 300, foot 684; every block drawn as a dashed ink-2
outline (`L.GUESS`) over the real staircase; dashed hairlines to D4 E4 F4 G4 A4 B4 C5 D5; its "?"
(Outfit 600 64 px, ink-2) centred at x 1258, baseline 250. Against D major it differs only at stair 3
(tread 534 against 508) and stair 7 (352 against 326).

## Framings

| Framing | s   | ox     | oy     | Used                                   | What it holds                                                                 |
| ------- | --- | ------ | ------ | -------------------------------------- | ----------------------------------------------------------------------------- |
| F-cold  | 1.2 | 98.4   | -97.2  | S1a to S3b (from 3c it pulls to F0)    | compact staircase centred: C's stairs x 389 to 1531, treads 700 to 325, foot 786; D's treads 637 to 263, foot 724 |
| F0      | 1   | 0      | 0      | S3c's end to S11, S14                  | the world as drawn                                                            |
| CU-A    | 2   | -280   | -880   | S5c                                    | a push of 2 about (280, 880): stairs 1 to 4 x 204 to 1148, keys C4 to F4, C-D riser at x 436 from y 448 to 344 |
| CU-B    | 2   | -760   | -880   | S5d                                    | about (760, 880): E-F riser at x 436 from y 240 to 188, keys D4 to G4           |
| CU-C    | 1.8 | -980   | -286.4 | S10a                                   | about (1225, 358): la, ti, do x 536 to 1169, ti-do riser at x 960 from y 394 to 347, house y 228 to 322 |

F-cold's push during S1 (a drift, 1.2 to 1.236 over 0 to 24.7, then to 1.28 by 31.4, power1.in) is
about the screen point (960, 486); S1g's dolly from 1.28 to 2.2 is about the top house (31.4 to
33.1, power2.in) **(provisional: the light's growth decides its end scale)**. S3c pulls F-cold to F0
over 43.4 to 45.9 (power2.inOut), interpolating `s`, `ox`, `oy`. S6a's push to 1.05 and back is
about (1676, 880), so the strip's right end and the rows' right edge never move toward Tavi.

## Carried from Lessons 1 and 2 (fixed)

- **The room**: Lesson 2's (`output/motion/lesson-02/`, its `assets/lib/lesson.js` room and the
  staves), glows and dust seeded as there.
- **Chapter cards**: `L.chapterCard(hud, { num, title, baseline: 480, tIn, tOut })`, Lesson 1's card.
- **Title card (S2)**: Lesson 2's s02 composition with the title "The major scale and home" (chrome
  serif italic 140 px, one line, centred, baseline 380) and the kicker "LESSON 04"; its light enters
  as S1g's full-frame light and leaves as the bead flying back into the top house (35.9 to 36.58,
  landing at F-cold's house centre (1464, 215) on D).
- **End card (S16)**: Lesson 2's s17 with this film's lines (STORYBOARD 16).
- **The tile row (S4)**: `L.tiles` for C4 to C5: 13 tiles 112 px wide on a 120 px pitch, centres
  `x = 240 + 120 i`, so x 184 to 1736, home y 420 to 700; dark tiles at i 1, 3, 6, 8, 10. Its "1"
  brackets at y 740, labels baseline 790.
- **Kicker, ring timer, pill, bracket, arrow**: `assets/lib/marks.js`.

## Inside A: S1 to S4

- **Cold open (F-cold).** Merc feet (230, 840), Tavi feet (1690, 840), size 420: bodies x 119 to 341
  and 1579 to 1801, 33 px clear of the compact rows (374 to 1546) and 48 px of the stairs. "from C"
  and "from D?" are Outfit 600 64 px, ink, left-aligned at x 389, baseline 860 on C and 798 on D.
  "still hanging?" at x 140, baseline 300; its ring timer (and then its check) at (610, 278). "home
  moved" right-aligned at x 1400, baseline 230. "finished on do" and "restless on ti?" serif italic
  110 px at x 140, baselines 300 and 420. The house on the top stair: centre x 1464, y 246 to 308 on
  C and 184 to 246 on D. Merc's bead leaves his mouth at about (270, 664) **(provisional: the pass's
  mouth point)** and lands on stair 1's tread (456, 700) at 0.60; Tavi's leaves hers at about
  (1650, 664) and lands on stair 1 on D (456, 637) at 14.99, its arc peaking at y 140.
- **S1 to S2 (33.18).** Full-frame warm white on both sides of the cut.
- **S2 to S3 (36.58).** The bead's flight into the house spans the cut (35.9 to 36.9, power2.inOut,
  ending at (1464, 215)); both scenes draw it from `T`. At 36.58 the staircase is on D in F-cold,
  stairs unlit, the top stair filled unlit, no Mercs.
- **S3 to S4 (46.05).** F0. The staircase on C, names do to do, the top house lit (it fades in S4a,
  46.1 to 46.5); rows C4 to D5 already full width (x 220 to 1680, widened 45.3 to 45.9); the list
  gone at 45.65.
- **S4c's stand-up.** Phase 1 (57.4 to 58.4): the tile row turns 90 degrees counter-clockwise about
  the C4 tile's centre while its pitch shrinks from 120 to 26 px, ending as a column of 13 slivers,
  each 280 x 24, left edge x 220, centred on rows C4 to C5 (y 677 down to y 365 for C5). Phase 2
  (58.4 to 59.4): each sliver widens to x 220 to 1680, the dark ones landing as the black-key rows;
  the cold open's rows fade out under them (58.4 to 59.4); rows C♯5 to G5 fade in (59.0 to 59.5).
  **(provisional: the lab decides the pivot and the curves)**.

## A to B (S4 to S5 at 68.35)

F0, no Mercs (m04 ended 67.55), the kicker lane empty. The staircase on C at full: names do re mi fa
so la ti do (36 px, baseline 724), risers unmeasured (4 px chrome 40 %), no riser labels, no house;
rows C4 to G5, x 220 to 1680, black-key rows shaded. No strip yet: it enters in S5a from y +240
(68.55 to 69.45, power3.out).

## Inside B: S5 and S6

- **S5c to S5e.** CU-A from 78.8 to 80.3; the pan to CU-B 85.6 to 87.2 (sine.inOut); the pull to F0
  89.8 to 91.4. The legend at x 140, baselines 200 and 252 (Outfit 600 44 px), frame-fixed, landing
  after the pull (91.4).
- **S5 to S6 (109.88).** F0. Tavi on screen since 109.78 (m06 spans the cut): feet (1800, 840), size
  300, body x 1720 to 1880, y 648 to 840. The staircase on C, letters, all seven risers measured and
  labelled T T S T T T S, the legend at x 140; E4, F4, B4 and C5 named.
- **S6's brackets.** `L.bracket`, ink, ticks down: stairs 1 to 4 from x 242 to 714 at y 484, stairs 5
  to 8 from x 722 to 1194 at y 302. The ghost outline in S6c moves by (+480, -182). The sum at x 140,
  baseline 260; "= 1 octave" baseline 360; the octave bracket at x 1232, y 690 to 352.

## B to C (S6 to S7 at 145.10)

F0 (S6's push back at 1.0 since 130.6), no Mercs (m06 ended 144.65), the kicker lane empty. The
staircase on C at full, letters C to C, risers measured (tones chrome with a notch, semitones gold),
riser labels 2 2 1 2 2 2 1, hairlines drawn; the strip with C major's keys at full and the rest at
45 %, no key names (gone at 144.8); no sum, no brackets, no legend.

## Inside C: S7 and S8

- **S7's top-left lane.** "Predict." serif italic 120 px at x 140, baseline 300; the pills at x 140,
  baselines 400 and 480 (`L.pill`, Outfit 600 40 px); the ring timer at (620, 440); the step rows at
  x 140, baselines 380 and 450; "D major" serif italic 120 px at x 140, baseline 300.
- **S7 to S8 (198.36).** Tavi on screen (m07 spans the cut). The staircase on D at full, letters D E
  F♯ G A B C♯ D, riser labels T T S T T T S, F♯4 and C♯5 lit and named, "D major" up (it leaves in
  S8a, 198.4 to 198.6).
- **S8's tally.** Outfit 600 64 px at x 140, baseline 250: "C 0 · D 2" from 206.1, "G 1" from 207.9,
  "E 4" from 211.78, each entry about 170 px wide **(provisional: set from the font's tabular width)**.

## C to D (S8 to S9 at 228.24)

F0, no Mercs (m07 ended 227.25), the kicker lane empty, the tally gone (227.9). The staircase on E
at full: letters E F♯ G♯ A B C♯ D♯ E, riser labels T T S T T T S, hairlines; the strip with E4, A4,
B4 and E5 at full, F♯4, G♯4, C♯5 and D♯5 lit to 60 % chrome, the rest at 45 %, no key names.

## Inside D: S9 to S11

- **S9's labels.** "tonic = home" Outfit 600 56 px at x 150, baseline 540; "scale degrees" and
  "solfège" Outfit 600 56 px at x 1270, baseline 260; "do = C?" in a dashed pill at x 1270, baseline
  260, then "fixed do: do = C" at 40 px, baseline 170; "movable do" Outfit 600 64 px at x 1270,
  baseline 300; "(sol)" Outfit 500 28 px, ink-2, right-aligned at x 828, baseline 474 (so's tread on
  C).
- **S9 to S10 (269.63).** Tavi on screen (m09 spans the cut). The staircase on C (back from D at
  268.4), names do to do, both houses lit, no riser labels, no key names.
- **S10.** CU-C 269.7 to 271.2 and back to F0 279.7 to 281.4. "1 semitone" Outfit 600 48 px at x
  1200, baseline 380 (frame-fixed, in CU-C). Merc drops in at feet (110, 840), size 300 (body x 30
  to 190, 30 px clear of the rows), 281.5 to 281.9; his bead leaves his mouth at about (130, 715)
  **(provisional)** and lands on stair 1 (298, 642) at 282.57.
- **S10 to S11 (294.94).** Both Mercs on screen (m09 and m10 span the cut). The staircase on C, the
  top stair lit blue with the blue bead on it (both fade in S11a, 294.9 to 295.3), the top house lit.
- **S11's experiment.** Kicker "AN EXPERIMENT" at (120, 110); credits Outfit 500, ink-2, x 120:
  "Krumhansl & Shepard, 1979" 36 px at baseline 160, "later studies: without training too, only
  weaker" 32 px at 205, "as summed up in Janata et al., 2003" 32 px at 245. The probe bead with "?"
  at (1420, 420). The axis at x 1300 from y 560 up to 280, "finishes it best" at x 1320, baseline
  290, "least" at baseline 568 (Outfit 500 32 px, ink-2). Shelves (chrome 2 px at 50 %) x 400 to
  1280 at y 300, 380, 460, 540, drawn 80 px apart and 40 px apart on "only weaker" (the top shelf
  fixed). Chips 120 x 56, radius 12, sitting on their shelves, names Outfit 600 40 px ink: do centred
  x 840; mi 760, so 920; re 600, fa 760, la 920, ti 1080; C♯ 520, D♯ 680, F♯ 840, G♯ 1000, A♯ 1160
  (dim chips: chrome at 35 %, their letters ink).
- **S11's labels.** "learned, it seems" Outfit 600 48 px at x 1220, baseline 320; "one short step"
  at x 1220, baseline 400, a hairline from its left end to the ti-do riser (1078, 365); "leading
  note" Outfit 600 64 px at x 660, baseline 300 on C (riding to x 780, baseline 248 on D); "ti = C♯"
  Outfit 600 48 px at x 1340, baseline 300 on D.

## D to E (S11 to S12 at 340.24)

F0, no Mercs (m09 and m10 ended 340.15), the kicker lane empty, every label gone (339.9). The
staircase on D at full: names do to do, both houses lit (stair 1 at x 362 to 474, stair 8 at 1202 to
1314), risers measured (no labels), hairlines; the strip with D major's keys, F♯4 and C♯5 lit.

## Inside E: S12 and S13

- **The guide (S12).** Lanes x 600 to 1440; lane k (0 D3 to 12 D4) spans `y = 760 - 46 (k + 1)` to
  `760 - 46 k`, centre `737 - 46 k`. Names (Outfit 600 32 px, ink-2) right-aligned at x 580 on lanes
  0, 2, 4, 5, 7, 9, 11, 12 (do re mi fa so la ti do), baselines 748, 656, 564, 518, 426, 334, 242,
  196. The path at 97.67 px a second: D3 600 to 678, E3 678 to 756, F♯3 756 to 834, G3 834 to 913,
  A3 913 to 991, B3 991 to 1069, C♯4 1069 to 1264 (the hold), the rest to 1323, D4 1323 to 1440; an
  amber band 14 px tall on its lane's centre, at 35 % until lit. "wait" Outfit 600 40 px centred at x
  1166, baseline 196. The house centred at x 1381, y 104 to 156. The chip "one octave up" at x 600,
  baseline 120. Merc feet (240, 840), Tavi (1700, 840), size 360: bodies x 145 to 335 and 1605 to
  1795, 185 px clear of the names and 165 px of the lanes.
- **S12a's tip.** The rows D4 to D5 (world k 2 to 14) map onto lanes 0 to 12 (the names carry no
  octave); each stair's tread slides and stretches onto its segment, ti's onto the hold; the top
  house onto (1381, 130) **(provisional: the lab decides the curves)**.
- **S12 to S13 (371.92).** The S12 guide with every segment lit, the orange bead on D4's segment end
  (it fades in S13a), "wait", the arrow and the chip still up; Merc (240, 840) and Tavi (1700, 840)
  at 360 (m12 spans the cut).
- **The guide in S13.** It moves 372.0 to 372.9 (power2.inOut) to lanes x 1060 to 1700, 40 px each:
  lane k spans `y = 720 - 40 (k + 1)` to `720 - 40 k`; names right-aligned at x 1040, baselines 711,
  631, 551, 511, 431, 351, 271, 231. The plain path (dashed chrome, 3 px) at 74.42 px a second: D3
  1060 to 1120, E3 to 1179, F♯3 to 1239, G3 to 1298, A3 to 1358, B3 to 1417, the hold to 1566, the
  rest to 1611, D4 1611 to 1700. The cursor a vertical chrome line, 4 px with a soft glow, spanning
  the lanes. The count-in's bead lands at (1060, 700). Merc moves to size 300 at (240, 840) (body x
  160 to 320); Tavi to size 240 at (1820, 840) (body x 1756 to 1884, top y 686, 56 px clear of the
  lanes).
- **The care block (S13).** Left-aligned at x 360, no line past x 960 (35 px clear of the shortest
  lane name), nothing below y 864: "Your turn." serif italic 120 px, baseline 200; care lines Outfit
  500 32 px, ink, baselines 262 and 302, 352 and 392, 442; "wait on ti" Outfit 600 40 px at 492; the
  stop line Outfit 600 40 px, ink, at 548 and 592; the doctor lines Inter 30 px, ink-2, six lines
  from baseline 640, 37 px apart (to 825). The ring timer at (920, 170). **(provisional: the line
  breaks are set from the fonts' real widths, keeping x 960 and y 864)**

## E to F (S13 to S14 at 404.49)

The room alone and both Mercs: Merc at (110, 840) and Tavi at (1800, 840), both at size 300 (their
move ended 404.2; m12 spans the cut). Every mark of S13 gone (403.24). The staircase enters in S14a
(404.5 to 405.1).

## Inside F: S14 to S16

- **Recap.** F0; the card panel x 120 to 1000, y 140 to 330 (radius 16, a chrome stroke at 25 %,
  obsidian fill at 85 %), text Outfit 600 40 px, ink, at x 150, baselines 220 and 280; the ring timer
  at (950, 250). The staircase's highest point under the panel is stair 6 on D (x 962 to 1074, tread
  352), 22 px below it.
- **The ladder (S14f).** Panel x 300 to 1620, y 150 to 470; title "Scale Runner" at (330, 200),
  "ILLUSTRATION" right-aligned at (1590, 200). Playhead x 894 (45 % of the panel), a chrome line 2 px
  at 35 %, y 220 to 450. Pitch at 16 px a semitone, G4 at y 430: A4 398, B4 366, C5 350, D5 318, E5
  286, F♯5 254, G5 238. The sung line (violet `#a78bfa`, 4 px, round): G4 from x 340 to 600, a glide
  to A4 by 660, A4 on to the playhead. The current target, re: a dashed amber line (3 px, dash 10,
  gap 8) at y 398 from x 700 to 894. Six rungs at x 992, 1090, 1188, 1286, 1384, 1482 (98 px apart,
  the app's spacing for six), 56 px wide, the first 6 px thick and the rest 4 px, their strokes at
  100, 85, 70, 56, 42 and 27 % (the app's falloff, lifted); "B4" and "C5" (mono 30 px, ink-2) 10 px
  above the first two; a dashed chrome connector (1 px, 30 %, dash 3 gap 4) from (894, 398) through
  the rungs.
- **The practise card (S14g).** Centred at x 960, every line within x 310 to 1610: baselines 580
  (Outfit 600 48 px), 650, 710, 770 and 830 (Outfit 500 40 px). The tab icons are the app's SVGs
  from `src/components/AppNavTabs.tsx` (Settings and Exercises), drawn 36 px in ink before each tab's
  name; the × is the intro's close glyph (`src/features/onboarding/FirstLight.tsx`), 32 px in ink.
- **S14 to S15 (465.24).** The Mercs in the corners at 300; the ladder and the card gone (464.9).
- **S15.** '"support"' serif italic 160 px centred, baseline 420; the long note at y 520 from x 560
  to 1360; "what keeps it steady?" serif italic 96 px centred, baseline 680.
- **S15 to S16 (473.53).** The Mercs in the corners at 300; S15's type gone (473.5).
- **S16.** The Mercs grow to 520 at (330, 840) and (1590, 840) (473.6 to 474.2): bodies x 192 to 468
  and 1452 to 1728, heads at y 507. Lockup y 40 to 220; "Find your pitch." baseline 330; the address
  Outfit 600 56 px, baseline 440; the skip line Outfit 500 40 px, ink-2, baseline 510, within x 530
  to 1390, 62 px clear of both bodies.
