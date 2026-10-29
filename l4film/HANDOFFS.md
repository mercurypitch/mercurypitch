# Handoffs v3.1: exact frames where one builder's scene meets the next

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
  push of scale `s` about the world point `(cx, cy)` is `ox = cx (1 - s)`, `oy = cy (1 - s)`, which
  keeps that point where it is on screen. A change of framing interpolates `s`, `ox` and `oy`
  together on one curve. The room's far, mid and near layers follow `L.rig` with factors k = 0.25, 1
  and 1.6. Through pushes, pulls, trucks and the crane, layer k draws at scale `1 + k (s - 1)` with
  offset `(k ox, k oy)`; a pan instead adds the same offset to every layer, so after the pan from
  CU-A to CU-B the far layer sits 480 px left of where CU-A put it (offset -550, not `0.25 × -760`),
  and the pull out of CU-B eases every layer from there back to F0. In `L.rig`'s terms,
  `a = 1 + (s - 1) k` and `e = (1 - a) cx + px + k tx` (§ Camera moves names which each move is).
- The near layer carries the kit's bokeh (`L.bokeh`, DECISIONS 89): faint soft discs, static in
  that layer, so they part from the world on a push, pull, truck or crane and move with it on a
  pan. Being the same in every scene, they match across any cut whose two frames share a framing,
  as every cut in this film does. While they slide against the world they brighten, as the far
  staves do with their vertical slide (DECISIONS 93); at rest both are as before, so no handoff
  frame changes.
- The staircase's own labels (stair names, riser labels, key names, "tonic = home", "(sol)", the
  brackets, "leading note" and its arrow) ride the world and scale with it: 36, 40 and 34 px at
  `s = 1`. Frame-fixed type (kickers, the list, legends, tallies, sums, cards, pills, credits,
  "scale degrees", "solfège", "1 semitone", the hook's lines) never scales and never moves with the
  camera.
- Text and marks fade in over 0.2 s from their cue and out over 0.2 s from their exit cue unless a
  row says otherwise. Counted pulses as STORYBOARD § Type. Ring timers, pills, arrows and brackets
  are `assets/lib/marks.js`'s (Lessons 1 and 2).
- The Mercs are placed in screen space. A Merc's body is about 0.53 of its shown size wide and 0.64
  of it tall, standing on its feet point (Lesson 1's frames): at 420 it is x ±111, 269 tall; at 360
  ±95, 230; at 300 ±80, 192; at 240 ±64, 154; at 520 ±138, 333.
- **Keep-out.** No stair, key, lane, label or mark comes within 20 px of a Merc's body box. The
  faint semitone rows are masked instead: the rows' layer carries a screen-space mask that is clear
  inside each on-screen Merc's body box grown by 20 px and rises linearly to full over the next
  60 px, built every frame from the Mercs' boxes. In CU-C, F-recap-1 and F-recap-3 the keyboard
  strip (with its hairlines and key names) would run under a Merc's feet and reflection, so it fades
  out (and sinks) over the push into those framings and comes back over the pull out of them.
- **Beads.** `L.bead(svg, { r: 22, color })` in world units (26 px in F-cold, 44 px in a 2x
  close-up). A bead rests on its stair's tread: centre on the column centre, 22 world px above the
  tread. A hop between treads is an arc 0.3 s long, landing on the note's onset, its centre peaking
  40 world px above its resting point on the higher stair: its height is a parabola in linear time
  and its x eases sine.inOut, so it rises before it travels. Modelled with the riser labels below, a
  hop up or down a tone keeps 7 px from the lower stair's label and a semitone 6 px (8 px at rest),
  and 28 px or more from the riser's bar. A bead that lands on a do stair with a house over it then
  rises into the house: from its resting point to the house's centre over 0.3 s (power2.out),
  shrinking to nothing as the house lights (S1e 23.2 to 23.5, S10c 294.2 to 294.5, S14d 433.8 to
  434.1; the title's bead does the same at 37.6 to 37.9). Blue `#58a6ff`, orange `#ff7448`, chrome
  `#c3ccd6`. A bead that drops in falls from 60 world px above its resting point onto it over 0.2 s
  (power2.in), fading in over the first 0.08 s, and squashes as it lands: the chrome beads, Tavi's
  in S1d (her corner is too far from stair 1 to send hers across the staircase and its house) and
  the guide's in S12 and S13. An echo ring is 2 px chrome growing from the bead's edge to three
  times its radius over 0.5 s as it fades.
- **Marks.** Tavi's wrong guesses are dashed ink-2 `#a8b3bf` (3 px, dash 10, gap 8) with a "?"
  (`L.GUESS`): the ring round "from C", the white-keys staircase, the "do = C?" pill. A step being
  measured is a plain chrome outline (`L.MEASURE`: 2 px chrome at 55 %, unfilled) until it fills.
- **Label lane** (STORYBOARD § Codes). In F0, frame-fixed labels stand right of the staircase on C
  (from x 1250; it ends at x 1194) and on D (from x 1340; it ends at 1314, its top house at 1286),
  and top left (from x 140) on E and G and through S7. Exceptions: the legend, S4's labels, the
  recap panel.
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
`y = 736 - 26 s0` (46 px below do's row). Corner radius 6 at the tread. Before the keyboard exists
(S1 to S3b) the staircase on D keeps C's columns (`w` 0, `s0` 2): it rises two rows and does not
move along.

| Start | Stair centres x                       | Treads y (stairs 1 to 8)        | Foot y | Names baseline | Keys                        |
| ----- | ------------------------------------- | ------------------------------- | ------ | -------------- | --------------------------- |
| C     | 298 418 538 658 778 898 1018 1138     | 664 612 560 534 482 430 378 352 | 736    | 724            | C4 D4 E4 F4 G4 A4 B4 C5     |
| D     | 418 538 658 778 898 1018 1138 1258    | 612 560 508 482 430 378 326 300 | 684    | 672            | D4 E4 F♯4 G4 A4 B4 C♯5 D5   |
| E     | 538 658 778 898 1018 1138 1258 1378   | 560 508 456 430 378 326 274 248 | 632    | 620            | E4 F♯4 G♯4 A4 B4 C♯5 D♯5 E5 |
| G     | 778 898 1018 1138 1258 1378 1498 1618 | 482 430 378 352 300 248 196 170 | 554    | 542            | G4 A4 B4 C5 D5 E5 F♯5 G5    |

A slide interpolates `w` and `s0` together (power2.inOut unless a row says otherwise), so the shape
never changes in flight. Fills: unlit `#1b232d` with a 2 px chrome rim at 40 % and a 3 px chrome
tread line at 70 %; lit chrome a 40 % chrome mix (ink names 4.9:1); lit blue or orange a 45 % mix
with a rim in the colour (ink names 5.7:1 and 6.1:1; 35 % if the lab's stair-name contrast falls
under 4.5:1); outline (the cold open's unreached top stair) no fill, a 2 px chrome stroke at 55 %;
dimmed, every fill and stroke at 25 % (20 % in S11's tiers) with its labels hidden.

**Stair names.** Outfit 600 36 px, ink, centred on the column, baseline `foot - 12`.

**Risers.** Between stairs n and n+1, centred at `x = 298 + 120 (w + n - 1) + 60`, from stair n's
tread up to stair n+1's: unmeasured 4 px chrome at 40 %; being measured, `L.MEASURE` drawn as the
6 px bar's outline, with a 12 px chrome tick at 55 % at a tone's middle row line; measured 6 px,
chrome for a tone with a 12 px dark tick (`#2a323c`) at its middle row line, gold `#ffd84d` for a
semitone. On every start the gold pair is between stairs 3 and 4 and between 7 and 8. A riser label
(T, S, 2, 1) is Outfit 600 40 px, ink, right-aligned 2 px left of the measured bar (at the column
centre + 55), baseline 8 px above stair n's tread. Beside a house on stair 1 a "T" would stand 2 px
from it, so the bottom house is never up while riser 1's label is (S14b).

**House.** 56 x 52 px, centred on a do stair's column, its base 14 px above the tread, so its
centre is 40 px above the tread. Unlit: a 3 px chrome outline at 55 %. Lit: ink fill, a 16 px soft
chrome glow.

**Strip.** White keys C4 to G5, key j (0 to 11) from `x = 240 + 120 j` to `+ 116`, y 760 to 880,
centre `298 + 120 j`; Lesson 1's fill `#e6edf3` at 92 %, corner radius 6 at the foot. Black keys 64
px wide, y 760 to 836, `#161b22` with a `#30363d` rim, centred on the boundaries `358 + 120 j`: C♯4
358, D♯4 478, F♯4 718, G♯4 838, A♯4 958, C♯5 1198, D♯5 1318, F♯5 1558. Keys outside the scale have
their fills at 45 %; a black key in the scale lights to 40 % chrome (its ink name 5.2:1). Key names:
a white key's letter JetBrains Mono 34 px `#2a323c`, centred, baseline 862; a black key's name ink
28 px, baseline 822; ♯ as a Noto Music path (`L.spell`).

**Hairlines.** 1.5 px chrome at 50 % from each stair's foot at its column centre to the top centre
of its key (y 760). A sharp's hairline slants to its black key.

**Tavi's white-keys staircase (S7).** On D's columns (centres 418 to 1258), heights 0, 2, 3, 5, 7,
9, 10, 12, so treads 612 560 534 482 430 378 352 300, foot 684; every block drawn as a dashed ink-2
outline (`L.GUESS`), filled ink-2 at 25 % where a row says so; dashed hairlines to D4 E4 F4 G4 A4
B4 C5 D5; its "?" (Outfit 600 64 px, ink-2) from x 1360, baseline 330, beside stair 8: 80 px from
the bead at rest there and 24 px clear of its echo rings at their largest (component round C-01,
item 3). Against D major it
differs only at stair 3 (tread 534 against 508) and stair 7 (352 against 326).

**Merc corners in F0.** Merc (110, 840) at 300: body x 30 to 190, y 648 to 840; 30 px from the rows
(x 220), 50 from the strip (240), 52 from stair 1 on C (242). Tavi (1800, 840) at 300: body x 1720
to 1880; 40 px from the rows (1680), 44 from the strip (1676), 46 from stair 8 on G (1674).

## Framings

| Framing    | s    | ox      | oy      | About             | Used           | What it holds (screen pixels)                                                                                                                                                                                       |
| ---------- | ---- | ------- | ------- | ----------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-cold     | 1.2  | 98.4    | -97.2   | -                 | S1, S3a, S3b   | compact staircase centred: C's stairs x 389 to 1531, treads 700 to 325, foot 786; on D treads 637 to 263, foot 724; compact rows x 374 to 1546                                                                      |
| F-cold end | 1.22 | 84.04   | -106.92 | screen (960, 486) | 32.8           | the drift's end: stairs x 379 to 1541, rows x 365 to 1555 (24 px from both Mercs, 38 px for the stairs)                                                                                                             |
| F-house    | 2.2  | -1543.6 | -32     | -                 | 33.88 to 34.18 | the top house on D (world centre (1138, 260)) at the frame's centre, 123 x 114 px, under the full-frame field                                                                                                       |
| F0         | 1    | 0       | 0       | -                 | most shots     | the world as drawn                                                                                                                                                                                                  |
| CU-A       | 2    | -280    | -880    | (280, 880)        | S5c            | stairs 1 to 5 with their treads (stair 1 x 204 to 428, tread 448; stair 5's tread at 84), keys C4 to A4 (y 640 to 880); the C-D riser at x 436 from y 448 to 344                                                    |
| CU-B       | 2    | -760    | -880    | (760, 880)        | S5d            | a pan of 480 px: stairs 3 to 5 with their treads (stair 3 x 204 to 428, tread 240), keys E4 to C5; the E-F riser at x 436 from y 240 to 188, where CU-A held the C-D riser; stair 2 and D4 cut by the left edge     |
| F-low      | 1.8  | 99.6    | -704    | -                 | S6a, S6b       | stairs 1 to 4 x 535 to 1385 (treads 491 to 257), the lower bracket at y 167, names baseline 599, keys C4 to F4 x 532 to 1388, y 664 to 880, key letters at 848                                                      |
| F-high     | 1.8  | -764.4  | -450    | -                 | S6b            | stairs 5 to 8 x 535 to 1385, treads 418 to 184, the upper bracket at y 94, names baseline 853; the strip under the caption band (from y 918), carrying nothing named                                                |
| F-white    | 1.25 | -75     | -211.5  | (300, 846)        | S7d            | the dashed staircase x 378 to 1568, treads 554 (stair 1) to 164, foot 644, its "?" at (1498, 101); the strip y 739 to 889; the top-left lane clear                                                                  |
| CU-D       | 2    | -836    | -464    | (836, 464)        | S7g            | D's stairs 3 to 7 x 368 to 1552: real treads 552 (stair 3) and 188 (stair 7), dashed 604 and 240, 52 px apart; names baseline 880                                                                                   |
| F-keys-D   | 1.6  | -380.8  | -528    | (634.7, 880)      | S7h            | the strip x 3 to 2301, y 688 to 880, F♯4 x 717 to 819, C♯5 x 1485 to 1587 (black-key names at 787); D's names baseline 547                                                                                          |
| F-near     | 1.2  | -84     | -147.2  | (420, 736)        | S9b, S9c       | C's stairs x 206 to 1349, treads 650 to 275, names baseline 722; the top house x 1248 to 1315, y 196 to 258; "tonic = home" x 96 to 481, baseline 501                                                               |
| F-names-1  | 2.4  | -235    | -1232   | -                 | S9c, S9d       | the name band: names 86 px at baseline 506, foot 534, keys y 592 to 880; stair 1 x 346 to 615 (centre 480), stairs 1 to 5 in frame                                                                                  |
| F-names-2  | 2.4  | -1431   | -1232   | -                 | S9d            | the same band at stairs 4 to 8: stair 8 x 1166 to 1435 (centre 1300)                                                                                                                                                |
| CU-C       | 1.8  | -980    | -432    | (1225, 540)       | S10a           | la, ti, do x 536 to 1169, names baseline 871; the ti-do riser at x 960 from y 248 to 202; the top house x 1018 to 1119, y 83 to 176; the strip faded                                                                |
| F-chart    | 1.3  | -252    | -75     | (840, 250)        | S11a to S11c   | the tiers: do's chip x 762 to 918, y 242 to 315, the fourth shelf to y 627; the axis at x 1438 from y 289 to 653, "finishes it best" from x 1464; stair names at 866; the strip under the caption band (from y 913) |
| F-recap-1  | 1.25 | -75     | -75     | (300, 300)        | S14a, S14b     | C's stairs x 228 to 1418 (stair 1 x 228 to 368, y 755 to 845; 38 px from Merc), the top house x 1313 to 1383, y 283 to 348, names baseline 830; the strip faded                                                     |
| F-recap-3  | 1.4  | -120    | -144    | (300, 360)        | S14d           | la, ti, do x 1059 to 1552; the ti-do riser at x 1389 from y 385 to 349; the top house x 1434 to 1512, y 256 to 329; stair 1 x 219 (29 px from Merc), foot 886; names baseline 870; the strip faded                  |

**The panel and the recap framings.** The card panel (x 120 to 1000, y 140 to 330) is frame-fixed.
In F0 the highest tread under it is 378 (stair 6 on D, stair 3 on G), 48 px below it; in F-recap-1
the highest is the corner of stair 6 that reaches under it (x 978 to 1000) at y 463, 133 px below
it; in F-recap-3 nothing of the staircase under the panel rises above y 531.

## Camera moves

Each changes framing on one curve (`s`, `ox`, `oy` together). "Push" and "pull" scale the layers
by their factors; "truck" moves them by their factors at a fixed scale; "pan" moves every layer
equally.

| Time          | Move         | From       | To         | Ease                            | Notes                                                                                                                                                                               |
| ------------- | ------------ | ---------- | ---------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.00-32.80    | drift (push) | F-cold     | F-cold end | power1.inOut                    | about the screen point (960, 486); not counted as motion                                                                                                                            |
| 32.95-33.88   | dolly (push) | F-cold end | F-house    | power3.in                       | the two lines left up fast at 32.85 to 33.15; the Mercs slid out 32.80 to 33.40                                                                                                     |
| 37.58         | cut          | -          | F-cold     | -                               | S3 opens at 1.2                                                                                                                                                                     |
| 44.40-46.90   | pull and pan | F-cold     | F0         | power2.inOut                    | the compact rows widen to x 220 to 1680 over 46.3 to 46.9                                                                                                                           |
| 79.80-81.30   | push         | F0         | CU-A       | power2.inOut                    |                                                                                                                                                                                     |
| 86.60-88.20   | pan          | CU-A       | CU-B       | sine.inOut                      | 480 px left                                                                                                                                                                         |
| 90.80-92.40   | pull         | CU-B       | F0         | power2.inOut                    | the legend lands after it                                                                                                                                                           |
| 115.30-116.90 | push         | F0         | F-low      | power2.inOut                    | Tavi gone at 114.75                                                                                                                                                                 |
| 119.60-120.70 | truck        | F-low      | F-high     | power2.inOut                    | up and right; the bead hops from stair 4 to stair 5 on G4, landing 120.83                                                                                                           |
| 122.90-124.00 | pull         | F-high     | F0         | power2.inOut                    | the lit stairs go unlit as it lands (123.6 to 124.0)                                                                                                                                |
| 159.00-163.30 | push         | F0         | F-white    | sine.inOut                      | slow, from inside the predict pause                                                                                                                                                 |
| 169.30-170.30 | pull         | F-white    | F0         | power2.inOut                    | the real staircase returns to full as it lands (169.9 to 170.3)                                                                                                                     |
| 185.60-186.60 | push         | F0         | CU-D       | power2.inOut                    | the step rows (x 140 to 596, y 345 to 450) stay 50 px or more from every stair throughout                                                                                           |
| 189.60-190.60 | crane down   | CU-D       | F-keys-D   | power2.inOut                    | the step rows left at 189.3 to 189.5                                                                                                                                                |
| 195.60-196.60 | pull         | F-keys-D   | F0         | power2.inOut                    | "D major" lands as it lands                                                                                                                                                         |
| 231.60-245.80 | push         | F0         | F-names-1  | sine.in, then a Hermite to rest | one curve through F-near (s 1.2 at 244.40; below); "scale degrees" lands at 241.44, at s 1.129, the top stair's right edge at x 1294; it and "tonic = home" leave at 244.2 to 244.4 |
| 245.85-248.85 | truck        | F-names-1  | F-names-2  | power1.inOut                    | the named stair at x 480, 719, 886, 874, 899, 974, 1108 and 1311 as each syllable starts                                                                                            |
| 248.70-249.50 | pull         | F-names-2  | F0         | power2.inOut                    | Tavi drops in over it                                                                                                                                                               |
| 270.70-272.20 | push         | F0         | CU-C       | power2.inOut                    | the strip fades out over it                                                                                                                                                         |
| 280.70-282.40 | pull         | CU-C       | F0         | power2.inOut                    | "1 semitone" and the arrow left at 280.5 to 280.7; the strip returns over it                                                                                                        |
| 298.70-299.90 | push         | F0         | F-chart    | power2.inOut                    | both Mercs gone at 298.6                                                                                                                                                            |
| 320.23-321.03 | pull         | F-chart    | F0         | power2.inOut                    | Tavi drops back over it                                                                                                                                                    |
| 411.00-412.60 | push         | F0         | F-recap-1  | power2.inOut                    | the strip and its hairlines sink 60 px and fade                                                                                                                                     |
| 419.70-420.70 | pull         | F-recap-1  | F0         | power2.inOut                    | the strip returns without its hairlines (they draw on "F sharp", 427.22)                                                                                                            |
| 430.70-431.90 | push         | F0         | F-recap-3  | power2.inOut                    | the strip and its hairlines sink and fade                                                                                                                                           |
| 443.10-444.10 | pull         | F-recap-3  | F0         | power2.inOut                    | the strip and its hairlines return                                                                                                                                                  |

**The push in S9 (231.60 to 245.80)** is one curve with no stop. `s` follows sine.in from 1 to 1.2
over 231.60 to 244.40, so it reaches F-near moving at 0.0245 a second, with `ox = -420 (s - 1)` and
`oy = -736 (s - 1)`. Over 244.40 to 245.80, with `u` from 0 to 1, `s`, `ox` and `oy` are each a
cubic Hermite that starts at the first leg's rate and ends at rest (`h00 = 2u³ - 3u² + 1`,
`h10 = u³ - 2u² + u`, `h01 = 3u² - 2u³`): `s = 1.2 h00 + 0.0344 h10 + 2.4 h01`,
`ox = -84 h00 - 14.43 h10 - 235 h01`, `oy = -147.2 h00 - 25.29 h10 - 1232 h01`. All three only ever
move one way.

Outside these moves the camera is still. S8 holds F0 from 196.6 to 229.2 (signature 2).

## Carried from Lessons 1 and 2 (fixed)

- **The room**: Lesson 2's (`output/motion/lesson-02/`, its `assets/lib/lesson.js` room and the
  staves), glows and dust seeded as there.
- **Chapter cards**: `L.chapterCard(hud, { num, title, baseline: 480, tIn, tOut })`, Lesson 1's card.
- **Title card (S2)**: Lesson 2's s02 composition with the title "The major scale and home" (chrome
  serif italic 140 px, one line, centred, baseline 380) and the kicker "LESSON 04".
- **End card (S16)**: Lesson 2's s17 with this film's lines (STORYBOARD 16).
- **The tile row (S4)**: `L.tiles` for C4 to C5: 13 tiles 112 px wide on a 120 px pitch, centres
  `x = 240 + 120 i`, so x 184 to 1736, home y 420 to 700; dark tiles at i 1, 3, 6, 8, 10. Its "1"
  brackets at y 740, labels baseline 790.

## Inside A: S1 to S4

- **Cold open (F-cold).** Merc feet (230, 840), Tavi feet (1690, 840), size 420: bodies x 119 to 341
  and 1579 to 1801, y 571 to 840; 33 px clear of the compact rows and 48 px of the stairs at 1.2 (24
  and 38 at the drift's end). "from C" and "from D?" are Outfit 600 64 px, ink, riding the world at
  world (242, 798) on C and (242, 746) on D, so x 389 and baselines 860 and 798 at 1.2; "from D?"
  fades with "still hanging?" (23.6 to 23.8). "still hanging?" at x 140, baseline 300; its ring
  timer, then its check, at (610, 278). "home moved" right-aligned at x 1400, baseline 230, 30 px
  left of the house on D. "finished on do" and "restless on ti?" serif italic 110 px at x 140,
  baselines 300 and 420 (x 140 to 696 and 140 to 656). The house on the top stair: centre x 1464, y
  246 to 308 on C and 184 to 246 on D. Beads rest on stair 1 at (456, 673) on C and (456, 611) on D,
  on the top stair at (1464, 299) on C and (1464, 236) on D. Merc's bead leaves his mouth at about
  (270, 664) **(provisional: the pass's mouth point)** and lands on stair 1 at 0.60; Tavi's drops
  onto stair 1 on D (14.79 to 14.99, § Shared formulas), so it crosses neither the staircase nor the
  house, nor passes under "still hanging?" and its fading ring timer. stop-c's and stop-d's notes
  land 0.45 s apart (0.60 to 3.30 and 14.99 to 17.69); land-d's last hop lands on the top stair at
  23.14 and the bead rises into the house (23.2 to 23.5).
- **S1g.** At 32.80 the frame is F-cold end. The two lines leave up 60 px and fade (32.85 to 33.15,
  power3.in, unscaled). Merc slides to feet x -130 and Tavi to 2050 (32.80 to 33.40, power2.in), off
  the frame by 19 px and more. The dolly runs 32.95 to 33.88. From 33.30 the house's glow grows
  toward the lens, blurring the house's edges away, until the field covers the frame at 33.88; it
  holds, breathing 2 % in brightness, to the cut.
- **S1 to S2 (34.18).** The same full-frame field on both sides of the cut: a smooth radial
  field, chrome `#c3ccd6` at 75 % over the ground at the frame's centre falling to 35 % at the
  corners, no edges, mean brightness 110 to 125 of 255 (Lesson 2's field peaks at 122). S2 shrinks
  it into the bead on the staff's middle line over 34.18 to 34.48 (expo.out); the title lands from
  34.44; the five notes hop in with the chimes at 34.23, 34.32, 34.41, 34.50 and 34.59.
- **S2 to S3 (37.58).** Both scenes draw the staircase and the bead from the same module and from
  `T`. The staff fades 36.9 to 37.5 while the staircase on D fades up under it in F-cold (36.9 to
  37.5: stairs unlit, the top stair filled unlit, the house unlit), and the bead flies back into the
  top house (36.9 to 37.9, power2.inOut, ending at the house's centre (1464, 215)), lighting it at
  37.9. At 37.58 the staircase is at full, the bead in flight, no Mercs.
- **S3.** Four labels on the staircase, not a list (DECISIONS 88): Outfit 600, 40 world px, ink, in
  the mid layer, so they ride the camera and the slide (their baselines are written on C), each 24
  px or more clear of the stairs, their names and each other. "build it from its steps" from x 242,
  baseline 494 (32 px over stair 4's tread); "start it on any note" from x 242, baseline 790 (under
  stair 1's foot); "name its notes" centred on x 958, baseline 790 (under the names of stairs 5 to
  8; builder A's round 2 right-aligns it to do's right edge, so the two bottom labels read apart);
  "hear ti lean home" ending at x 1166, baseline 254 (over ti and the house, 24 px over the roof).
  The arrow from ti's tread to the house is ink, 3 px.
- **S3 to S4 (47.05).** F0. The staircase on C, names do to do, the top house lit (it fades in S4a,
  47.1 to 47.5); rows C4 to D5 already full width (x 220 to 1680, widened 46.3 to 46.9); the labels
  gone at 46.75.
- **S4.** "1 octave = 12 semitones" Outfit 600 56 px at x 140, baseline 250; "in 7 steps" and then
  "in 7 steps?" at baseline 330. q0's ring timer at (164, 232), where the answer lands after it has
  gone.
- **S4c's stand-up.** Phase 1 (58.4 to 59.4): the tile row turns 90 degrees counter-clockwise about
  the C4 tile's centre while its pitch shrinks from 120 to 26 px, ending as a column of 13 slivers,
  each 280 x 24, left edge x 220, centred on rows C4 to C5 (y 677 down to y 365 for C5). Phase 2
  (59.4 to 60.4): each sliver widens to x 220 to 1680, the dark ones landing as the black-key rows;
  the cold open's rows fade out under them (59.4 to 60.4); rows C♯5 to G5 fade in (60.0 to 60.5).
  **(provisional: the lab decides the pivot and the curves)**.

## A to B (S4 to S5 at 69.35)

F0, no Mercs (m04 ended 68.55), the kicker lane empty. The staircase on C at full: names do re mi fa
so la ti do (36 px, baseline 724), risers unmeasured (4 px chrome 40 %), no riser labels, no house;
rows C4 to G5, x 220 to 1680, black-key rows shaded. No strip yet: it enters in S5a from y +240
(69.55 to 70.45, power3.out).

## Inside B: S5 and S6

- **S5a.** "a major scale" serif italic 110 px at x 1250, baseline 300 (x 1250 to 1776).
- **S5c to S5e.** The C-D riser's measuring outline (81.4 to 82.2) then its fill (84.94, a bar
  growing from stair 1's tread, 0.3 s); the E-F riser's outline at 89.69 and its gold fill on "Yes"
  (90.77). The legend at x 140, baselines 200 and 252 (Outfit 600 44 px), frame-fixed, landing after
  the pull (92.4).
- **S5 to S6 (110.88).** F0. Tavi down since 110.63 (m06a drops 109.78 to 110.63 and spans the
  cut): feet (1800, 840), size 300, body x 1720 to 1880, y 648 to 840. The staircase on C, letters,
  all seven risers measured and labelled T T S T T T S, the legend at x 140; E4, F4, B4 and C5
  named.
- **S6's brackets.** `L.bracket`, ink, ticks down, riding the world: stairs 1 to 4 from x 242 to 714
  at y 484, stairs 5 to 8 from x 722 to 1194 at y 302. The ghost outline in S6c moves by
  (+480, -182). The sum Outfit 600 64 px at x 1270, baseline 260 (to x 1615), "= 12" after it at
  x 1639 (to 1746). The octave bracket, chrome, at x 1232 from stair 1's tread to stair 8's (y 664
  to 352, twelve rows); "= 1 octave" serif italic 96 px at x 1262, baseline 543, its ink centred on
  the bracket's middle (y 508).

## B to C (S6 to S7 at 146.10)

F0 (since the pull landed at 124.0), no Mercs (m06b ended 145.65), the kicker lane empty. The
staircase on C at full, letters C to C, risers measured (tones chrome with a notch, semitones gold),
riser labels 2 2 1 2 2 2 1, hairlines drawn; the strip with C major's keys at full and the rest at
45 %, no key names (gone at 145.8); no sum, no brackets, no legend.

## Inside C: S7 and S8

- **S7's top-left lane.** "Predict." serif italic 120 px at x 140, baseline 300; the pills at x 140,
  baselines 400 and 480 (`L.pill`, Outfit 600 40 px, box from x 140, text inset 24 px); the ring
  timer at (620, 440), radius 24, 28 px or more from every dashed stair while it is up (it leaves
  at 161.99, the push then 79 % done); the step rows at
  x 140, baselines 380 and 450: "WHITE KEYS" and "MAJOR" JetBrains Mono 28 px from x 140, their
  steps Outfit 600 48 px from x 340 (to x 596); "D major" serif italic 120 px at x 140, baseline 300.
- **S7's bead.** The chrome bead rests on the dashed treads in white-d (stair 1 at (448, 526) in
  F-white) and on the real treads in major-d (F0).
- **S7 to S8 (199.36).** Tavi on screen (m08 spans the cut, from 198.27). The staircase on D at full,
  letters D E F♯ G A B C♯ D, riser labels T T S T T T S, F♯4 and C♯5 lit (their names gone at
  195.7), "D major" up (it leaves in S8a, 199.4 to 199.6).
- **S8's tally.** Outfit 600 64 px at x 140, baseline 250: "C 0 · D 2" from 207.1, "G 1" from 208.9,
  "E 4" from 212.78, under a "BLACK KEYS" kicker (mono 30 px, 0.18 em, ink-2) at x 140, baseline 172.
  Word spacing +0.3 em on the entries and +0.5 em round each dot, so the pairs read apart: the whole
  line runs about x 140 to 945, clear of every start's stairs (component round C-01, item 2).
- **S8d's slide back.** E to C over 225.2 to 226.1 (power2.inOut), its black keys going dark.

## C to D (S8 to S9 at 229.24)

F0, no Mercs (m08 ended 228.25), the kicker lane empty, the tally gone (228.9). The staircase on C
at full: letters C D E F G A B C, riser labels T T S T T T S, hairlines; the strip with C major's
keys at full and the rest at 45 %, no key names.

## Inside D: S9 to S11

- **S9's labels.** "tonic = home" Outfit 600 56 px riding the world at x 150, baseline 540 (over
  stairs 1 and 2, ending at x 471, short of stair 3); "scale degrees" and then "solfège" Outfit 600
  56 px, frame-fixed at x 1400, baseline 420; "do = C?" in a dashed pill at x 1360, baseline 260,
  then "fixed do: do = C" at 40 px, baseline 170; "movable do" Outfit 600 64 px at x 1360, baseline
  300; "(sol)" Outfit 500 28 px, ink-2, right-aligned at x 828, baseline 474 (so's tread on C). On D
  the top house (x 1230 to 1286) is 74 px from the pills.
- **S9 to S10 (270.63).** Tavi on screen (m09 spans the cut). The staircase on C (back from D at
  269.4), names do to do, both houses lit, no riser labels, no key names.
- **S10.** "1 semitone" Outfit 600 48 px, frame-fixed at x 1200, baseline 250 in CU-C (x 1200 to
  1426, 31 px right of the top stair). Merc drops in at feet (110, 840), size 300, 282.20 to 283.05;
  his bead leaves his mouth at (156, 797) and hops onto stair 1, resting at (298, 642), at 283.57:
  a hop's arc (above), peaking at y 602, about 100 px over the straight line at mid-flight and 34 px
  clear of stair 1's corner (242, 664); it rests on ti at 286.27, lands on the
  top stair at 294.14 and rises into the house (294.2 to 294.5). The bottom house fades out as the
  top one unlights (281.5 to 282.0), so the bead on stair 1 (y 620 to 664) never meets it (y 598 to
  650), and returns lit in S11a (295.9 to 296.3).
- **S10 to S11 (295.94).** Both Mercs on screen (m09 and m10 span the cut). The staircase on C, the
  stairs lit blue (they fade in S11a, 295.9 to 296.3), no bead, the top house lit, the bottom house
  returning lit (295.9 to 296.3).
- **S11's experiment.** Kicker "AN EXPERIMENT" at (120, 110); credits frame-fixed, Outfit 500,
  ink-2, x 120: "Krumhansl & Shepard, 1979" 36 px at baseline 160, "later studies: without training
  too, only weaker" 32 px at 205 (to x 776), "as summed up in Janata et al., 2003" 32 px at 245 (to
  x 628). The chart rides the world and is seen through F-chart. The probe bead with "?" at
  (1420, 420). The axis at x 1300 from y 560 up to 280, "finishes it best" at x 1320, baseline 290, "least"
  at baseline 568 (Outfit 500 32 px, ink-2). Shelves (chrome 2 px at 50 %) x 400 to 1280 at y 300,
  380, 460, 540, 80 px apart; on "only weaker" the lower three close to 364, 428 and 492 (64 px
  apart, the top shelf fixed; 314.6 to 315.4) and spread back to 80 on "So that" (316.3 to 317.1).
  Chips 120 x 56, radius 12, sitting on their shelves (8 px apart at the closest), names Outfit 600
  40 px ink: do centred x 840; mi 760, so 920; re 600, fa 760, la 920, ti 1080; C♯ 520, D♯ 680, F♯
  840, G♯ 1000, A♯ 1160 (the seven scale chips `#1b232d`, opaque, with a 2 px chrome rim at 55 % and
  ink names, 13.4:1, so they read over the staircase dimmed to 20 %; dim chips: chrome at 35 %,
  their letters ink). The house beside do (11c) at x 916 to 972, its base on the top shelf.
- **S11's labels.** "learned, it seems" Outfit 600 48 px at x 1250, baseline 320; "one short step"
  at x 1250, baseline 400, a hairline from its left end to the ti-do riser (1078, 365); "leading
  note" Outfit 600 64 px riding the world at x 660, baseline 300 on C (x 780, baseline 248 on D);
  "ti = C♯" Outfit 600 48 px, frame-fixed at x 1360, baseline 300 on D.

## D to E (S11 to S12 at 341.24)

F0, no Mercs (m11 ended 341.15), the kicker lane empty, every label gone (340.9). The staircase on
D at full: names do to do, both houses lit (stair 1 at x 362 to 474, stair 8 at 1202 to 1314),
risers measured (no labels), hairlines; the strip with D major's keys, F♯4 and C♯5 lit.

## Inside E: S12 and S13

- **S12a.** The staircase dims to 25 % (341.4 to 341.6); the strip slides down 240 px and out
  (341.6 to 342.2, power2.in); the card in from 341.61, out 343.11 to 343.49; the staircase back to
  full 343.49 to 343.69. Merc drops in at 342.50 to 343.35 and Tavi at 342.62 to 343.47, under the card.
- **The guide (S12).** Lanes x 600 to 1440; lane k (0 D3 to 12 D4) spans `y = 760 - 46 (k + 1)` to
  `760 - 46 k`, centre `737 - 46 k`. Names (Outfit 600 32 px, ink-2) right-aligned at x 556 on lanes
  0, 2, 4, 5, 7, 9, 11, 12 (do re mi fa so la ti do), baselines 748, 656, 564, 518, 426, 334,
  242, 196. The path at 97.67 px a second: D3 600 to 678, E3 678 to 756, F♯3 756 to 834, G3 834 to
  913, A3 913 to 991, B3 991 to 1069, C♯4 1069 to 1264 (the hold), the rest to 1323, D4 1323 to
  1440; an amber band 14 px tall on its lane's centre, at 35 % until lit. "wait" Outfit 600 40 px
  centred at x 1166, baseline 196. The house centred at x 1381, y 90 to 142, 21 px above a bead on
  do's segment (y 163 to 207). The chip "one octave up" at x 600, baseline 120. Merc feet (240,
  840), Tavi (1700, 840), size 360: bodies x 145 to 335 and 1605 to 1795, Merc's 184 px clear of the
  names (the widest, "do", from x 519) and Tavi's 165 px of the lanes. The beads drop onto the
  path's start (600, 737), 22 px clear of the names: Merc's 348.0 to 348.19, Tavi's 363.53 to
  363.72.
- **S12a's tip (343.7 to 345.5).** The rows D4 to D5 (world k 2 to 14) stretch onto lanes 0 to 12
  (the names carry no octave) and the other rows fade; the blocks fade (343.7 to 344.3) while each
  tread slides and stretches onto its segment, ti's onto the hold; the top house rides to (1381,
  116); the bottom house and the stair names fade (343.7 to 344.0); the lane names fade in (345.3 to
  345.6) **(provisional: the lab decides the curves)**.
- **S12 to S13 (372.92).** The S12 guide with every segment lit, the orange bead on D4's segment end
  (it fades in S13a), "wait", the arrow, the chip and the house still up; Merc (240, 840) and Tavi
  (1700, 840) at 360 (m12 spans the cut).
- **The guide in S13.** It moves 373.0 to 373.9 (power2.inOut) to lanes x 1060 to 1700, 40 px each:
  lane k spans `y = 720 - 40 (k + 1)` to `720 - 40 k`; names right-aligned at x 1040, baselines 711,
  631, 551, 511, 431, 351, 271, 231. The names travel with the move from right-aligned 556 to 1040,
  so the top do's left edge is at x 837 at 373.50, 37 px clear of "Your turn." (x 360 to 800, its ink
  to 788), and at 892 when the title lands at 373.55 (power2.inOut, as measured in the S13 lab).
  The plain path (solid chrome, 3 px at 70 %) at 74.42 px a second: D3 1060 to 1120, E3 to 1179,
  F♯3 to 1239, G3 to 1298, A3 to 1358, B3 to 1417, the hold to 1566, the rest to 1611, D4 1611 to
  1700. The cursor a vertical chrome line, 4 px with a soft glow,
  spanning the lanes. The count-in's bead drops onto (1090, 700), the middle of do's segment, 28 px
  clear of the names, landing at 394.24 and gone by 395.24. Merc moves to size 300 at (240, 840)
  (body x 160 to 320); Tavi to size 240 at (1820, 840) (body x 1756 to 1884, top y 686, 56 px clear
  of the lanes).
- **The care block (S13).** Left-aligned at x 360, no line past x 960 (35 px clear of the shortest
  lane name), nothing below y 864, 40 px clear of Merc: "Your turn." serif italic 120 px, baseline
  200 (x 360 to 800), landing at 373.55, once the names have passed; care lines from 373.85, 0.3 s
  after it, Outfit 500 32 px, ink, baselines 262 and 302, 352 and 392, 442 (the longest 445 px);
  "wait on ti" Outfit 600 40 px at 492; the stop line Outfit 600 40 px, ink, at 548 and 592 ("Stop
  immediately if anything" 520 px, "feels uncomfortable."); the doctor lines Inter 30 px, ink-2,
  five lines at baselines 640, 677, 714, 751 and 788, landing at 373.9 once the guide has stopped,
  broken where the font puts them within 560 px (495, 555, 542, 534 and 363 px): "If hoarseness or
  discomfort lasts more / than a couple of weeks, see a doctor (a GP / or an ear, nose and throat
  specialist). If it's / very painful, or breathing or swallowing is / hard, get help straight
  away." No ring timer: the cursor shows the time.
- **S13d's reverse tip (404.2 to 405.4).** The plain guide's lane k (S13 geometry) narrows onto
  row k of the staircase on C (k 0 to 12, x 220 to 1680, 26 px), and rows C♯5 to G5 fade in above
  (405.0 to 405.4); each segment slides and shortens onto its stair's tread (column centre
  `298 + 120 (n - 1)`), the hold onto ti's; the blocks grow down to the foot (736) from 405.0; the
  names fade in at baseline 724 and both houses fade in lit (405.2 to 405.45); the strip rises from
  y +240 (404.9 to 405.45, power3.out), its hairlines fading in over its last 0.2 s. The Mercs move
  404.0 to 405.2: Merc from (240, 840) at 300 to (110, 840) at 300, Tavi from (1820, 840) at 240 to
  (1800, 840) at 300, both clear of every row and stair as they go (the rows are masked)
  **(provisional: the lab decides the curves)**.

## E to F (S13 to S14 at 405.49)

F0. The staircase on C at full: names do to do (baseline 724), both houses lit, risers unmeasured
(4 px chrome at 40 %), no riser labels; the strip with C major's keys at full and the rest at 45 %,
hairlines drawn, no key names. Merc at (110, 840) and Tavi at (1800, 840), both at 300 (their move
ended 405.2; m12 spans the cut). Every mark of S13 gone (404.24).

## Inside F: S14 to S16

- **Recap.** The card panel x 120 to 1000, y 140 to 330 (radius 16, a chrome stroke at 25 %,
  obsidian fill at 85 %), text Outfit 600 40 px, ink, at x 150, baselines 220 and 280 (the longest
  line, "Which two black keys does it need?", 628 px); the ring timer at (950, 250). Riser labels
  and the gold fills land as 14b and 14d say; at 419.62 and 443.01 every riser returns to unmeasured
  chrome. The bottom house fades out 413.0 to 413.3, before 14b's first label, and returns lit
  419.62 to 419.92. On 14c's slide to D (421.4 to 422.3) the strip's eight lit keys fade to 45 %
  with the rest, so it shows no scale until "F sharp" (427.22), when D major's keys come up to full,
  F♯4 lit and named, and C♯5 on "C sharp" (427.84). The strip follows every later slide, as in S8:
  back to C major's keys on 14d's slide (429.8 to 430.6, F♯4 and C♯5 going dark) and to G major's on
  14e's (449.5 to 450.3, F♯5 lit, its hairline slanting to it). In 14d's F-recap-3 the chrome bead
  rests on ti at (1305, 354), lands on the top stair at (1473, 318) at 433.74 and rises into the
  house (centre (1473, 293)), 433.8 to 434.1; the "S" right-aligned at x 1382 (world 1073), baseline
  374, 14 px clear of the bead on ti.
- **The ladder (S14f).** The strip slides out and the stair blocks, names, risers, rows, houses and
  hairlines fade (453.9 to 454.5), leaving the eight treads, which become the sung line and the
  rungs (454.0 to 455.2). Panel x 300 to 1620, y 150 to 470; title "Scale Runner" at (330, 200),
  "ILLUSTRATION" right-aligned at (1590, 200). Playhead x 894 (45 % of the panel), a chrome line 2
  px at 35 %, y 220 to 450. Pitch at 16 px a semitone, G4 at y 430: A4 398, B4 366, C5 350, D5 318,
  E5 286, F♯5 254, G5 238. The note being asked for, re (A4): a dashed amber line (3 px, dash 10,
  gap 8) at y 398 from the panel's inner margin (x 340) to the playhead, as the app draws it from
  its left margin (`PitchOverTimeCanvas.tsx`, the target line's `moveTo(MARGIN, y)`), with its name
  "A4" (mono 26 px, ink) in a small dark pill with an amber stroke against the playhead's left. The
  sung line (violet `#a78bfa`, 4 px, round): G4 from x 340 to 600, a break to 660 while the app
  plays the next note (FACTS 38), then A4 from 660 to the playhead, over the dashed line. Six chrome
  rungs at x 992, 1090, 1188, 1286, 1384, 1482 (98 px apart, the app's spacing for six), 56 px wide,
  the first 6 px thick and the rest 4 px, their strokes at 100, 85, 71, 56, 42 and 27 % (the app's
  falloff, lifted); "B4" and "C5" (mono 30 px, ink-2) 10 px above the first two; a dashed chrome
  connector (1 px, 30 %, dash 3 gap 4) from (894, 398) through the rungs. The app draws these in
  green (`PitchOverTimeCanvas.tsx:442`, `:530`, `:546`); the film keeps their shapes and draws them
  in its own colours (STORYBOARD § Codes). The run starts on G4, which the app plays when the singer
  picks it on Scale Runner's Starting Note dial (FACTS 89).
- **The practise card (S14g).** Centred at x 960, every line within x 310 to 1610: baselines 580
  (Outfit 600 48 px, 1055 px), 650, 710, 770 and 830 (Outfit 500 40 px: about 650, 1150, 560 and
  440 px), and 890 (Outfit 500 32 px, ink-2, about 860 px: "On a phone, Settings and Exercises are
  under [More icon] More"). The tab icons are the app's SVGs from `src/components/AppNavTabs.tsx`
  (Settings and Exercises), drawn 36 px in ink before each tab's name, and More's three dots from
  `src/components/mobile/BottomTabBar.tsx` (`EllipsisIcon`), 28 px in ink-2; the × is the intro's
  close glyph (`src/features/onboarding/FirstLight.tsx`), 32 px in ink. The line at 710 is the
  widest: the builder measures it and keeps it inside x 310 to 1610.
- **S14 to S15 (470.24).** The Mercs in the corners at 300; the ladder and the card gone (469.9).
- **S15.** '"support"' serif italic 160 px centred, baseline 420; the long note at y 520 from x 560
  to 1360; "what keeps it steady?" serif italic 96 px centred, baseline 680.
- **S15 to S16 (478.53).** The Mercs in the corners at 300; S15's type gone (478.5).
- **S16.** The Mercs grow to 520 at (330, 840) and (1590, 840) (478.6 to 479.2): bodies x 192 to 468
  and 1452 to 1728, heads at y 507; one hop of 30 px (479.4 to 480.0), heads at 477 at its top.
  Lockup y 40 to 220; "Find your pitch." baseline 330; the address Outfit 600 56 px, baseline 440, its
  descenders to y 452 (55 px above the heads, 25 px at the hop's top); the skip line and "then
  [Exercises icon] Exercises › Scale Runner" Outfit 500 40 px, ink-2, baselines 510 and 570, within
  x 636 to 1284, 168 px clear of both bodies.
