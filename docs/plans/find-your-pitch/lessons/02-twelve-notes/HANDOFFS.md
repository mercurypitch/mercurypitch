# Handoffs: exact frames where one builder's scene meets the next

The last frame of scene N and the first frame of scene N+1 must show every carried object on the
same pixels (within 2 px). Values marked **(provisional)** are starting values: the two builders on
either side of a handoff confirm them in a lab still, then this file is updated and the mark
removed before either scene is built further. Unmarked values are carried from Lesson 1 or follow
from arithmetic and are fixed now. Times are the estimates in SCRIPT.md (storyboard v4).

Builder groups (STORYBOARD): [A] S1 to S3, [B] S4 to S6, [C] S7 to S10, [D] S11 to S13, [E] S14,
[F] S15 to S17.

## Shared formulas

- Film time `T = L.scene(SID).start + t`; anything that travels (a glow, a drift, an orbit) is drawn
  from `T`, so its phase matches across a cut.
- Easing names are GSAP's: `power1` is quadratic, `power2` cubic, `power3` quartic. Evaluate a
  curve that spans a cut with GSAP's own function on both sides, never a hand-written polynomial.
- A push of scale `s` about `(cx, cy)` maps `x' = cx + s (x - cx)`, `y' = cy + s (y - cy)` on the
  mid layer; every push below names its scale, its centre, its span and its curve.
- The Mercs ride the near layer only in S1; everywhere else they are placed in screen space, so a
  camera move never shifts or scales them. A Merc's body is about 0.53 of its shown size wide and
  0.64 of it tall, standing on its feet point (measured on Lesson 1's frames).
- Beads: `L.bead(svg, { r: 22, color })`. Chrome `#c3ccd6`; a dim bead is chrome at 35 % opacity
  with a "?" glyph (Lesson 1's S14c); a lit bead is chrome at 100 % with a soft glow (16 px).
- Orange's guesses: a dashed ink-2 `#a8b3bf` stroke (dash 10, gap 8, 3 px) with a "?" in
  JetBrains Mono 30 px, ink-2 (S1e's rings, S8b's arc, S12a's outlines).
- Step bars: 24 px wide, rounded ends, chrome, 80 px per semitone on screen, drawn in the top layer
  (so a camera push moves them with their pair but never scales them), standing upward from 10 px
  above the top of the pair they measure, labelled "1" or "2" (Outfit 64 px) above their tops
  (pitch is height).
- Everything essential sits above y 896 (the caption band).

## Carried from Lesson 1 (fixed)

- **The spiral**: Lesson 1's helix function (`output/motion/lesson-01/compositions/s13-*`, promoted
  into the film kit): three turns, A2 at the bottom to A5 at the top, radius 300, 200 px per turn
  (16.67 px per semitone), 30 degrees per semitone, A at 0 degrees (the front), heights before
  projection y = 820 - 16.67 s for s semitones above A2 (A3 at 620, A4 at 420), depth-sorted, near
  beads larger. Camera azimuth `phi` and elevation `eps` (degrees, looking down) as given below.
- **The keyboard**: Lesson 1's HANDOFFS § E to F. A2 to A5, 22 white keys from x 200 to 1720
  (69.09 px each), y 560 to 820, fill `#e6edf3` at 92 %, 2 px gaps; black keys 40 px wide, y 560 to
  724, fill `#161b22` with a `#30363d` rim, centred on the boundary between their two white keys;
  labels "C3", "C4", "C5" in JetBrains Mono 30 px, `#2a323c`, 18 px above the key bottom. In Lesson 2
  every key also carries a soft chrome edge glow ("lit"), A3 a 55 % blue fill mix and A4 a 55 %
  orange mix, as in Lesson 1.
- **The chapter card**: Lesson 1's act 2 card (`output/motion/lesson-01/compositions/s08-puzzle.html`,
  "the chapter card for the breath"): one SVG text line, anchored at its middle on x 960 with its
  baseline at y 612 (its glyphs measure y 393 to 615 in Lesson 1's frame at 86.0 s), the numeral in
  aqua `#2dd4bf` at 300 px and the title in a chrome gradient at 170 px, 56 px apart; in from act +
  0.22 (0.85 s, expo.out, y +34 to 0, scale 0.95 to 1), breathing to scale 1.03, out 0.1 s before
  the next line (0.38 s, power3.in, y to -70). It sits in the top layer, so it never moves with the
  camera, and it has left before any handoff below. In Lesson 2 the act 2 card keeps that line, over
  a spiral dimmed to 25 %; the act 3 and 4 cards set the same line at baseline y 360, so their
  glyphs run from about y 141 to 394 and clear the tile row's top (y 420).

## A to B: S3 -> S4 at act1 - 0.15 (est. 36.24)

- The spiral, front view, `phi` 0, `eps` 10 (provisional), orbit stopped (S3 settles it by 35.4).
- The lit turn A3 to A4: the seven letter labels at their angles (Outfit 48 px, ink), the five dim
  beads, the blue bead on the front at A3 and the orange bead on the front at A4, one above the
  other. The other two turns: chrome beads at 60 %, no letters.
- One push spans the cut: camera scale 1.0 at 35.37 (b5 end - 0.42) to 2.2 at 37.37 (act1 +
  0.98), `power2.inOut`, centred on the front of the lit turn between A3 and B3 (provisional
  (1230, 650), so that at 2.2x A3 lands on the left third, the dim A♯3 bead near the centre, B3
  near the right third and the orange A4 bead in the upper third, below the act 1 kicker; v3's
  (1010, 650) put A3 at x 900). Both builders evaluate the same curve; at the estimated cut (u = 0.435) its value
  is 1.395, GSAP's cubic `power2.inOut` (recompute at the measured cut). This is a match motion,
  so speed and direction continue across the join.
- No text on screen (S3's last kicker has left by 36.0). No Mercs. Dust continues (near layer).

## B to C: S6 -> S7 at act2 - 0.15 (est. 95.39)

A rest frame, so the crane down in S7a starts from stillness.

- Camera straight down the spiral's axis (`eps` 90), plan projection (orthographic), so the lit turn
  is a true circle: centre (960, 520), radius 300 (provisional). The other two turns have faded to 0
  during S6b's crane; only the A3 to A4 turn shows.
- Its twelve beads at x = 960 + 300 sin(30 s deg), y = 520 + 300 cos(30 s deg), s semitones above A,
  A at the bottom where the front was: A (960, 820), A♯ (1110.0, 779.8), B (1219.8, 670.0), C (1260.0,
  520.0), C♯ (1219.8, 370.0), D (1110.0, 260.2), D♯ (960.0, 220.0), E (810.0, 260.2), F (700.2, 370.0),
  F♯ (660.0, 520.0), G (700.2, 670.0), G♯ (810.0, 779.8). All twelve lit chrome, except A: the orange
  A4 bead drawn exactly over the blue A3 bead, a 3 px blue rim showing round it.
- The twelve gold wedges at 0 (dimmed by 95.0); "semitone" (its 300 px full-frame moment over, then
  settled at 120 px right of the ring, baseline y 800 from x 1330) and "HALF STEP" (baseline y 850)
  gone by 95.0; the "+13 Hz" and "+25 Hz" labels gone since S6b.
- No kicker. No Mercs.

## Inside C: S7 -> S8, the one-octave close-up (fixed)

S7b ends on a uniform 2x push about (960, 820) of the Lesson 1 keyboard (x' = 2x - 960,
y' = 2y - 820), 105.8 to 107.3, `power2.inOut`, which frames the A3 to A4 octave, because that
octave is centred on x 960 there. The frame spans x 480 to 1440 of the keyboard before the push,
so it would also hold E3 (a sliver) to G♯3 on the left and A♯4 to D♯5 on the right: every key
outside A3 to A4 fades from 100 % to 0 over the push, on the same curve. S8 starts from exactly
this frame:

- White keys 138.18 px wide, y 300 to 820. Left edges: A3 407.27, B3 545.45, C4 683.64, D4 821.82, E4
  960.00, F4 1098.18, G4 1236.36, A4 1374.55 (right edge 1512.73); centres 69.09 px to the right of
  each.
- Black keys 80 px wide, y 300 to 628, centred on A♯3 545.45, C♯4 821.82, D♯4 960.00, F♯4 1236.36,
  G♯4 1374.55. G♯3 and A♯4, which overlapped the A3 and A4 keys' outer corners, are at 0 with the
  rest, so the octave reads as 8 white and 5 black keys and nothing else.
- Labels A3, B3, C4, D4, E4, F4, G4, A4 on the white keys: JetBrains Mono 60 px on screen (authored at
  30 px before the push), `#2a323c`, baseline 36 px above the key bottom (y 784).
- The empty frame either side of the octave (x 0 to 407 and 1513 to 1920) is where Orange stands
  in S8b (feet 1700, 840, shown at 480: body about x 1573 to 1827).
- The "7 white + 5 black" bracket has left by 105.6.

## Inside C: S8 and S9, arcs, pills and bars (provisional)

- S8b's arcs: chrome from the C4 centre (752.73) to the D4 centre (890.91), dashed ink-2 from the B3
  centre (614.54) to the C4 centre, both with their apex 70 px above the key tops (y 230).
- S8c's pills (Outfit 44 px, 60 px tall): "B to C" centred at (614, 180), "C to D" at (890, 180),
  "The same" at (752, 90); "Predict." at the top right (baseline y 200 from x 1180), "WHICH STEP IS
  BIGGER?" under it (378 px). The keyboard is never dimmed.
- S8d's bars: over B3 and C4 at x 683.64, over C4 and D4 at x 821.82, standing from y 290: one notch
  to y 210, two notches to y 130.
- S8e's pills: the same three at 0.7 scale in one row at the top right, right-aligned at x 1800,
  centred on y 180, where "Predict." was; nothing in the kicker lane.
- S8c's slow push (6 %) and S8e's (4 % more) are both about (752, 300), so S9a starts from the S8
  frame at 1.10x about that point; the positions above are on the S8 frame before those pushes, and
  S9a's push lands on its own framing from there.
- S9a's close-up: after the bars fade (141.1 to 141.5), a uniform 2.2x push about (580, 317) on the
  S8 frame, 141.5 to 143.1, `power2.inOut`. Key tops land at y 280; on screen A3 runs x 200 to 504,
  B3 504 to 808, C4 808 to 1112, D4 1112 to 1416 and E4 1416 to 1720 (F4 past the edge); C♯4's black
  key is 176 px wide, centred on x 1112. The key labels ride the top layer at baseline y 860. The two
  one-notch bars stand from y 270 to y 190, over the B3/C4 join (x 808) and over C4/C♯4 (x 1036,
  midway between their centres).
- S9c pulls back to the S8 frame (1x), 157.6 to 159.0, `power2.inOut`; S9d is that frame at rest.

## Inside C: S9d and S10, keys to tiles (fixed geometry, provisional timing)

Every key of the octave glides to its tile (the keys outside it have been at 0 since S7b's push).
Tiles:

- 13 tiles, 112 px wide, 8 px gaps, centres x = 240 + 120 i (A3 240, A♯3 360, B3 480, C4 600, C♯4
  720, D4 840, D♯4 960, E4 1080, F4 1200, F♯4 1320, G4 1440, G♯4 1560, A4 1680), so the row runs from
  x 184 to 1736; its home is y 420 to 700; corner radius 10.
- White tiles `#e6edf3` at 92 % with their labels (JetBrains Mono 40 px, `#2a323c`, baseline y 676);
  dark tiles `#161b22` with the `#30363d` rim and no label.
- Under the row, at y 740: a chrome bracket under each of the 12 neighbouring pairs, labelled "1"
  (Outfit 40 px, baseline y 790). The step bars shrink into them.
- The A3 tile's top edge glows blue, the A4 tile's orange (the two beads' notes).
- S10c and S10d: the five dark tiles lift 300 px (to y 120 to 400) from 179.3 and drop back into
  the same slots from 188.1, 1.0 s each, `power2.inOut`, while the camera tilts with them, so the
  whole picture eases down 80 px on screen and back: while they hover, the lifted tiles sit at y 200
  to 480, the row at y 500 to 780 and the bracket labels at baseline y 870. "tone", "= 2 semitones"
  and "WHOLE STEP" have left that space by 177.9. Orange's peek sits at feet (96, 870), shown at
  300 (body about x 16 to 176), in screen space, left of the A3 tile (x 184). S10b's 3 % push is
  about (720, 410) and has eased back to 1x by 177.5, before Orange peeks in, so the A3 tile never
  reaches Orange.
- "7 + 5 = 12" (Outfit 72 px, 280 px wide) sits in the top layer at the top right, right-aligned at
  x 1800, baseline y 150 (glyphs from about y 97), from the last tile's landing in S10d until 195.0.
- S10e: a 2.6x push that carries the B3/C4 join (540, 560) to the frame's centre (x' = 960 + 2.6
  (x - 540), y' = 560 + 2.6 (y - 560)), 190.0 to 190.9, `power2.inOut`: B3 and C4 at x 658 to 1262,
  the tiles from y 196 to 924, their labels at baseline y 862. Then a truck at 2.6x that carries the
  E4/F4 join (1140, 560) to the centre instead (x' = 960 + 2.6 (x - 1140)), 191.2 to 192.4,
  `power2.inOut`: E4 and F4 at x 658 to 1262. Then back to 1x, 193.4 to 194.4, `power2.inOut`.
- S10e's labels sit above the tiles, on the dark ground: the dashed "?" ring (64 px across) centred
  on (960, 138) over each join, then "semitone" (Outfit 48 px) in its place, centred on the join at
  baseline y 170. Each label rides with its join, so the B-C one leaves frame left during the truck;
  the E-F one leaves as the pull out begins (193.4).

## C to D: S10 -> S11 at act3 - 0.15 (est. 195.19)

- The tile row at home exactly as in "Inside C: S9d and S10", every tile in its slot, the five dark
  tiles with no label, the twelve "1" brackets under the row in chrome.
- "tone", "semitone", "= 2 semitones", "WHOLE STEP", the returning "?" rings and "7 + 5 = 12" all
  gone (cleared by 195.0).
- Camera at rest (scale 1) since 194.4. No Mercs (Orange hopped out at b26). No kicker.

## Inside D: S11 and S12, the tile framings (provisional)

- S11b to S11d, the close-up the object makes: the camera stays at 1x. The C4, C♯4 and D4 tiles
  lift out of the row onto a nearer layer and come forward to 2.4x, centred on the frame, 202.2 to
  203.8, `power2.inOut`: x 538 to 1382, y 224 to 896, their labels at baseline y 838. The rest of the
  row stays in place behind them at 30 % with a 6 px blur, its ends showing either side. The ♯ glyph
  (160 px) sits over the lifted C4 tile from x 622 and the ♭ over the lifted D4 tile from x 1242,
  both at y 50 to 210, their mono labels beside them; the act 3 kicker ends at x 419. From 216.3 to
  217.5 (`power2.inOut`) the three settle back into their slots, the row returns to full, and the
  whole row eases up 80 px to y 340 to 620.
- S12a: the row is already at y 340 to 620 when Orange peeks in (217.82), below its right end, at
  feet (1640, 860), shown at 360 (body about x 1545 to 1735, y 630 to 860): 10 px below the tiles.
- S12b and S12c: Orange ducks out right, 224.6 to 225.0; then a 2.4x push about (1140, 420), 225.0
  to 226.2, `power2.inOut`: E4 and F4 at x 862 to 1418, the tiles from y 228 to 900, their labels at
  baseline y 842; the predict row ("Predict." and the two pills) over E4 at y 110 to 200, from x 650
  to 1350; "E♯ = F" from x 1460, baseline y 180, leaving at 241.2. S12c pulls back to 1x, 241.2 to
  242.2, and only then, at 242.2, does Orange peek back in at the same feet (m12b). "BOTH" (mono 34
  px) is centred on x 720, baseline y 310, above the C♯/D♭ tile, until 249.3.
- S12e: the row slides down 200 px to y 540 to 820 (249.4 to 250.2, `power2.inOut`); the panel sits
  at y 200 to 480. The panel leaves at 254.77, and the row eases home to y 420 to 700 from 254.77 to
  255.27, `power2.inOut`, across the S12 to S13 cut (254.97), so S13 opens on the row at home before
  the act 4 card lands (255.34).
- Orange is never on a tile: checked frame by frame with its body at 0.53 x 0.64 of its shown size
  against every tile move above, from S10c to S13a.

## Inside D: S13, tiles to ruler (fixed geometry, provisional timing)

- From 257.3 to 259.7 (2.4 s, `power2.inOut`), starting as the act 4 chapter card leaves: the tile
  row tips up 90 degrees anticlockwise about its centre (low notes end at the bottom) while it
  scales to 55/120 and moves its centre from (960, 560) to (560, 490): a vertical ruler with its
  line at x 560, A3 at y 820 and A4 at y 160, 55 px per semitone. Each tile shrinks into a 24 px tick
  on the right of the line, with its name on the left in the pitch line's sharp spelling (JetBrains
  Mono 30 px, ink-2, right-aligned at x 540): A3, A#3, B3, C4, C#4, D4, D#4, E4, F4, F#4, G4, G#4, A4.
  The dark tiles' flat names fade as they shrink. The blue bead rides the A3 tick, the orange bead
  the A4 tick.
- The act 4 kicker (x 120 to 653, y 88 to 115) leaves up fast by 258.8: the tipping row's top end
  sweeps through its lane from about 258.9. Orange drops in at feet (1830, 860), shown at 300 (body
  about x 1750 to 1910, y 668 to 860), right of the row's end (x 1736); as the row tips and shrinks,
  every corner moves inward, so the tip never reaches it.
- Every label on the ruler keeps a fixed distance from the line on screen (names 20 px left of it,
  cents 40 px right of it), so a push moves them with their ticks but never scales them; every push
  is about a point on the line, so the line stays at x 560.
- The column labels (JetBrains Mono 30 px, ink-2, tracking .18em, top layer, baseline y 120): the
  house label "PITCH-LINE NAMES" (369 px) right-aligned at x 540, directly over the names (x 171 to
  540), from b36's start (260.37); the film's label "CENTS ABOVE A3" (322 px) left-aligned at x 600,
  over the cents (x 600 to 922), from b37's "a hundred cents". The act 4 kicker has left their lane
  by 258.8; both labels leave at 289.9, as S13f's push begins. At 1x they sit above the ruler's
  top tick, A4 at y 160.
- While a column label is up (260.37 to 289.9), the whole ruler (line, ticks, names and cents
  labels) is clipped above y 130, feathered over 6 px (y 124 to 130): S13b's push about (560, 826)
  carries B3 to A4 up past that line, and S13e's pull out brings them back down, and none of them crosses the labels at
  y 98 to 120. At 1x the orange bead on A4 (top at y 138) and the A4 name (from y 149) sit below the
  clip, whole.
- S13b's push to the A3 to A♯3 segment (y 760 to 160, 600 px per semitone, scale 10.9) eases the
  logarithm of the scale with `power2.inOut` over 260.37 to 266.10, so its rate looks even.
- S13c's readout is fixed at the right, Outfit 96 px left-aligned at x 1100, baseline y 500, with the
  frequency under it (mono 34 px, baseline y 556); it leaves as S13e's pull out begins (276.7).
- S13e's 10-cent ticks fade as the segment shrinks (276.7 to 277.5). Its cents labels sit right of
  the ticks (JetBrains Mono 30 px, left-aligned at x 600): 0, 100 ... 1200; the gold bracket runs
  from 0 to 1200 at x 730, "1200 ¢ = 1 octave" beside it. The bracket leaves as the monitor (a box
  from x 1260 to 1770 and y 300 to 640) slides in at b39; the cents labels and both beads leave at
  289.9, as S13f's push begins.

## D to E: S13 -> S14 at b41 (est. 291.90)

S13f's push in on the ruler's A3 region, from 1x to 160 px per semitone (scale 2.909) about
(560, 977), 289.90 to 291.90, `power2.inOut`, lands at rest exactly on the cut, and S14a starts
from that rest frame by drawing the lanes:

- The ruler line at x 560, 160 px per semitone, from G♯3 to B3 only: ticks for G♯3 at y 680, A3 at
  520, A♯3 at 360, B3 at 200 (each follows from the push). G♯3 is the dim tick the ruler grew below
  A3 as the push began. Over the push the line above B3, and every tick and name from C4 up, fade to
  0: at 160 px per semitone C4 would land at y 40, and the line would cross the canvas title at
  x 560.
- Labels "G#3", "A3", "A#3", "B3" in JetBrains Mono 30 px, ink-2, right-aligned at x 540; they live
  in the top layer, so they stay 30 px through the push. No cents labels; no bead; the monitor has
  gone (290.0); the column labels have gone (289.9).
- No Mercs (both drop in during S14a).

## Inside E: S14, the canvas (provisional)

- Lanes from x 560 to 1360 at the four heights above; the title "How MercuryPitch draws your voice"
  (JetBrains Mono 30 px, 594 px) from x 560, baseline y 150, from 292.0 until b42a's "Now you"
  (320.3), 50 px above the ruler line's top (B3, y 200). The chips "one octave up" (S14c) and then
  "A3 or A4" (S14f) sit above the lane labels, right-aligned at x 540, baseline y 150.
- The app's "you are here" marker, drawn as the app draws it (FACTS 28): a dot with a soft glow 14
  px inside the canvas's left edge (x 574) at the singer's current height, a faint dashed guide
  running right from it, and a dark pill from 25 px in (x 585) naming the note. It leaves with the
  title.
- The monitor (S13f's drawing at 0.8 scale) in S14d and S14e: a box from x 1400 to 1820 and y 160 to
  440, 30 px of padding round its 360 px title, above Orange (body from y 591).
- S14d's push: 3 % about the marker (574, 520), 306.4 to 307.4, `power2.inOut`, so the lanes end at
  x 1384, clear of the monitor box (x 1400); S14f eases back to 1x, 320.4 to 321.4, so the viewer's
  turn plays on the lanes exactly as drawn in S14a.
- The Mercs: Blue at feet (230, 860), Orange at (1690, 860), shown at 420 (bodies about x 119 to 341
  and 1579 to 1801, from y 591).
- From "Now you" (320.3 to 321.0) nothing of the app's drawing stays: the title, the marker,
  orange's violet line and the amber band fade out, and the film's own plain guide fades in on the
  same lanes: four thin chrome lines (2 px, 50 %), labelled in the film's spelling with the Noto
  Music glyph (G♯3, A3, A♯3, B3, right-aligned at x 540, each with its octave-up name ghosted
  beside it), and Merc's path as a dashed chrome line (3 px, dash 10, gap 8).
- The your-turn cursor: a vertical chrome line (4 px, 100 %, soft glow) spanning the four lanes,
  waiting at x 560 from 335.26, then sweeping to x 1360 from 336.26 to 340.46 in step with Merc's
  path (A held 1.2 s, up 0.5, A♯ held 1.0, down 0.5, A held 1.0). Nothing rides the path.

## E to F: S14 -> S15 at recap - 0.15 (est. 342.31)

- The plain guide at 20 %: its four chrome lanes from x 560 to 1360 at the four heights above, their
  labels and Merc's dashed path; nothing of the app's drawing (gone since 321.0); "Your turn.", the
  safety labels, the chip, the cursor and the ring timer gone (by 341.9); the monitor gone since
  320.2.
- The Mercs are mid-move on one curve that spans the cut (S14g to S15a): from feet (230, 860) and
  (1690, 860) at 341.89 to (170, 860) and (1750, 860) at 343.09, shown size 420 to 300 (scale 0.808
  to 0.577 of the 520 render), `power3.inOut` (provisional). The pass is the same on both sides
  (m14-duo), so their pixels match by construction.

## Inside F: S15 -> S16 at next - 0.15 (est. 389.06)

- S15g's grid, its labels and its kicker leave from 388.5 to 388.8, before the Mercs move.
- The Mercs are then mid-move on one curve that spans the cut (S15g to S16): from feet (170, 860)
  and (1750, 860), shown at 300 (scale 0.577), at 388.8 to (560, 840) and (1360, 840), shown at 520
  (scale 1.0), at 390.4, `power3.inOut` (provisional). The same m14-duo pass on both sides: no hop
  out, no drop in. S16's canvas fades in under the move, between the Mercs' landing places (x 718
  to 1202, y 560 to 800), which neither body crosses on its way in.

## Inside F: S16 -> S17 at end (est. 405.00)

- Both Mercs on the floor: Blue feet (560, 840), Orange feet (1360, 840), shown at 520 (bodies about
  x 422 to 698 and 1222 to 1498, from y 507), the same m14-duo pass on both sides. The 524 px
  between their bodies holds S16's one-band canvas and then S17's two-line legend.
- S16's two figures sit side by side above the Mercs (y 230 to 480): "ASKED", "59 %" and "of 1,105"
  centred on x 640, "TESTED", "10–16 %" and "≥ 1 semitone off" centred on x 1280, on shared
  baselines (y 260, 420 and 470); they and the kicker have gone by 404.74.
- S16's canvas (one amber band and the faded violet line, x 718 to 1202, y 560 to 800) is still at
  100 % at the cut and fades out over S17's first 0.5 s, as the legend lands in its place.
- S17's text sits above the Mercs' heads: the lockup at y 40 to 220, "Find your pitch." at baseline
  y 330, the URL at baseline y 440.
