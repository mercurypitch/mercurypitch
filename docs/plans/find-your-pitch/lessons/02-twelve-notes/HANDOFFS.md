# Handoffs: exact frames where one builder's scene meets the next

The last frame of scene N and the first frame of scene N+1 must show every carried object on the
same pixels (within 2 px). Values marked **(provisional)** are starting values: the two builders on
either side of a handoff confirm them in a lab still, then this file is updated and the mark
removed before either scene is built further. Unmarked values are carried from Lesson 1 or follow
from arithmetic and are fixed now. Times are the estimates in SCRIPT.md (storyboard v8).

Builder groups (STORYBOARD): [A] S1 to S3, [B] S4 to S6, [C] S7 to S10, [D] S11 to S13, [E] S14,
[F] S15 to S17.

## Shared formulas

- Film time `T = L.scene(SID).start + t`; anything that travels (a glow, a drift, an orbit) is drawn
  from `T`, so its phase matches across a cut.
- Easing names are GSAP's: `power1` is quadratic, `power2` cubic, `power3` quartic. Evaluate a
  curve that spans a cut with GSAP's own function on both sides, never a hand-written polynomial.
- A push of scale `s` about `(cx, cy)` maps `x' = cx + s (x - cx)`, `y' = cy + s (y - cy)` on the
  mid layer; every push below names its scale, its centre, its span and its curve. A tilt moves
  every layer (far, mid, near, top) by the same amount, so it reads as a turn of the camera, not a
  pedestal; only pushes, pulls and dollies use the layers' parallax factors. An arc travels the
  camera round its subject: the far layer slides with the camera's travel and the near layer against
  it (in S5b and S5c about 4 and 10 px per degree, keeping the spiral at frame centre); a turntable
  turn rotates the object while the camera and every layer hold (S1e, and the spiral's slow turn
  through S1 to S3).
- Text and marks fade in over 0.2 s from their cue and out over 0.2 s from their exit cue unless a
  line below says otherwise; nothing lands where something else is still leaving. A glow or a pulse
  on a word, or a key or tile lighting with its note, rises over 0.15 s and falls back over 0.6 s
  unless the storyboard row holds it.
- Merc entrances and exits each have a start and an end; a pass ends 0.05 s after its exit ends.
- The Mercs ride the near layer only in S1; everywhere else they are placed in screen space, so a
  camera move never shifts or scales them. A Merc's body is about 0.53 of its shown size wide and
  0.64 of it tall, standing on its feet point (measured on Lesson 1's frames).
- Beads: `L.bead(svg, { r: 22, color })` (r 12 on the S13 ruler). Chrome `#c3ccd6`; a dim bead is
  chrome at 35 % opacity with a "?" glyph (Lesson 1's S14c); a lit bead is chrome at 100 % with a
  soft glow (16 px).
- Orange's guesses: a dashed ink-2 `#a8b3bf` stroke (dash 10, gap 8, 3 px) with a "?" in JetBrains
  Mono 30 px, ink-2 (S1e's rings, S8b's arc, S12a's outlines). A ring round a dim bead uses the
  bead's own "?"; a ring round empty space carries its "?" at its centre.
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

- The spiral, front view, `phi` 0, `eps` 10 (provisional), its slow turn stopped (S3 settles it by
  35.4).
- The lit turn A3 to A4: the seven letter labels at their angles (Outfit 48 px, ink, placed as
  STORYBOARD § Codes says), the five dim beads, the blue bead on the front at A3 and the orange bead
  on the front at A4, one above the other. The other two turns: chrome beads at 60 %, no letters.
- One push spans the cut: camera scale 1.0 at 35.37 (b5 end - 0.42) to 2.2 at 37.37 (act1 + 0.98),
  `power2.inOut`, centred on the front of the lit turn between A3 and B3 (provisional (1230, 650),
  so that at 2.2x A3 lands on the left third, the dim A♯3 bead near the centre, B3 near the right
  third and the orange A4 bead in the upper third, below the act 1 kicker; v3's (1010, 650) put A3
  at x 900). Both builders evaluate the same curve; at the estimated cut (u = 0.435) its value is
  1.395, GSAP's cubic `power2.inOut` (recompute at the measured cut). This is a match motion, so
  speed and direction continue across the join.
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
  centre (614.54) to the C4 centre, both with their apex 70 px above the key tops (y 230). They draw
  in the order Orange says them: the chrome arc on "C to D" (115.51 to 116.1), the dashed one on
  "the same step" (117.44 to 118.0).
- S8c's pills (Outfit 44 px, 60 px tall): "B to C" centred at (614, 180), "C to D" at (890, 180),
  "The same" at (752, 90); "Predict." at the top right (baseline y 200 from x 1180), "WHICH STEP IS
  BIGGER?" under it (378 px). The keyboard is never dimmed.
- S8d's bars: over B3 and C4 at x 683.64, over C4 and D4 at x 821.82, standing from y 290: one notch
  to y 210, two notches to y 130, each growing up from y 290 (130.9 to 131.5 and 132.8 to 133.6).
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
The timing (S9d): on b23's "every key the same width" each key glides to its tile over 1.1 s,
`power2.inOut`, starting left to right 0.035 s apart (A3 at 162.15, A4 at 162.57), all landed by
163.7; on "Neighbours, white or black" the twelve "1" brackets appear left to right, one every 0.13
s (164.07 to 165.6), the three step bars shrinking into theirs; on "always" the B-C and E-F brackets
flash gold (166.0); on "apart" all twelve pulse together (167.15). Tiles:

- 13 tiles, 112 px wide, 8 px gaps, centres x = 240 + 120 i (A3 240, A♯3 360, B3 480, C4 600, C♯4
  720, D4 840, D♯4 960, E4 1080, F4 1200, F♯4 1320, G4 1440, G♯4 1560, A4 1680), so the row runs from
  x 184 to 1736; its home is y 420 to 700; corner radius 10.
- White tiles `#e6edf3` at 92 % with their labels (JetBrains Mono 40 px, `#2a323c`, baseline y 676);
  dark tiles `#161b22` with the `#30363d` rim and no label.
- Under the row, at y 740: a chrome bracket under each of the 12 neighbouring pairs, labelled "1"
  (Outfit 40 px, baseline y 790). The step bars shrink into them.
- The A3 tile's top edge glows blue, the A4 tile's orange (the two beads' notes).
- S10c and S10d: the five dark tiles lift 300 px (to y 120 to 400) from 179.3 and drop back into the
  same slots from 188.1, 1.0 s each, `power2.inOut`, while the camera tilts with them, every layer
  moving down 80 px on screen and back by the same amount: while they hover, the lifted tiles sit at
  y 200 to 480, the row at y 500 to 780 and the bracket labels at baseline y 870. "tone", "= 2
  semitones" and "WHOLE STEP" have left that space by 177.9. Orange's peek (177.57 to 177.97) sits
  at feet (80, 870), shown at 300 (body about x 0 to 160), in screen space, 24 px left of the A3
  tile (x 184); its hop out left runs 183.6 to 184.2. S10b's 3 % push is about (720, 410) and has
  eased back to 1x by 177.5, before Orange peeks in, so the A3 tile never reaches Orange.
- "7 + 5 = 12" (Outfit 72 px, 280 px wide) sits in the top layer at the top right, right-aligned at
  x 1800, baseline y 150 (glyphs from about y 97), from the last tile's landing in S10d until
  195.19, fading out over 194.99 to 195.19.
- S10e: one 2.0x push that carries (840, 560) to the frame's centre (x' = 960 + 2 (x - 840), y' =
  560 + 2 (y - 560)), 190.0 to 190.9, `power2.inOut`, and holds both pairs: B3 to F4 fill x 128 to
  1792, the tiles from y 280 to 840, their labels at baseline y 792, the B-C join at x 360 and the
  E-F join at x 1560. It holds until the pull out back to 1x, 194.39 to 195.19, `power2.inOut`,
  which lands at rest exactly on the cut. The twelve "1" brackets fade out early in the push, 190.0
  to 190.4, and back in late in the pull out, 194.8 to 195.19, so none shows in the caption band (at
  2x they would sit at y 920, their labels at 1020).
- S10e's labels sit above the tiles, on the dark ground: over each join the dashed "?" ring (64 px
  across, centred on y 220) and then "semitone" (Outfit 48 px, 199 px wide) in its place, centred on
  the join at baseline y 252 (B-C x 260 to 460, E-F x 1460 to 1660), clear of "7 + 5 = 12" (which
  ends at y 150). Each ring clears before its label lands: B-C's ring 190.6 to 191.2 (cued once its
  join has nearly settled), its label from 191.2; E-F's ring 191.56 to 192.5 (in on "E"), its label
  from 192.5. On "no gap" each join flashes once, B-C at 193.1 and E-F at 193.5. Both labels hold
  until the pull out begins and are gone by 194.59.

## C to D: S10 -> S11 at act3 - 0.15 (est. 195.19)

- The tile row at home exactly as in "Inside C: S9d and S10", every tile in its slot, the five dark
  tiles with no label, the twelve "1" brackets under the row in chrome, back at full by 195.19.
- "tone", "semitone", "= 2 semitones", "WHOLE STEP", the returning "?" rings and "7 + 5 = 12" all
  gone (cleared by 195.19).
- Camera at rest (scale 1): the pull out lands exactly on the cut (195.19). No Mercs (Orange's hop
  out ended at 184.2). No kicker.

## Inside D: S11 and S12, the tile framings (provisional)

- S11b to S11d, the close-up the object makes: the camera stays at 1x. The C4, C♯4 and D4 tiles
  lift out of the row onto a nearer layer and come forward to 2.4x, centred on the frame, 202.2 to
  203.8, `power2.inOut`: x 538 to 1382, y 224 to 896, their labels at baseline y 838. The rest of the
  row stays in place behind them at 30 % with a 6 px blur, its ends showing either side. The ♯ glyph
  (160 px) sits over the lifted C4 tile from x 622 and the ♭ over the lifted D4 tile from x 1242,
  both at y 50 to 210, their mono labels beside them; the act 3 kicker ends at x 419. Each arrow
  fades once it has written its name. From 216.3 to 217.5 (`power2.inOut`) the three settle back
  into their slots, the row returns to full, the gold ring fades, and the whole row eases up 80 px
  to y 340 to 620.
- A dark tile's two names stack in its lower half, the sharp name above the flat one: at home the
  sharp name's baseline is y 630 and the flat name's y 676, the white tiles' label row. A white
  tile's second name goes above its letter the same way: "E♯" on the F tile at baseline y 630 at
  home (550 with the row up 80), never under it, where the tile ends 24 px below the label.
- S12a: the row is already at y 340 to 620 when Orange peeks in (217.82 to 218.22), below its right
  end, at feet (1640, 860), shown at 330 (body about x 1553 to 1727, y 649 to 860): 29 px below the
  tiles.
- S12b and S12c: Orange ducks out right, 224.6 to 225.0; then the camera tilts up instead of pushing
  in, every layer easing down the same 160 px, 225.0 to 226.2, `power2.inOut`: the row at y 500 to
  780, E♯ (when written) at baseline 710 and F's label at 756, all at 1x. Above the row: the predict
  row ("Predict." from x 777, the pills "black key" and "white key" from x 1063 and 1293, y 300 to
  380), the "+1 semitone" arrow just above the tiles (y 480, from x 1080 to the F4 centre at
  x 1200), its label from x 1030 at baseline y 462, and "E♯ = F" centred on x 1200 at baseline y
  250, leaving at 241.2. S12c tilts back down (every layer by the same 160 px), 241.2 to 242.2, and
  only then does Orange peek back in at the same feet (242.2 to 242.6; m12b). "BOTH" (mono 34 px) is
  centred on x 720, baseline y 310, above the C♯/D♭ tile, until Orange's hop begins (249.32). E♯ and
  the arrow fade at 249.4.
- S12e: Orange's hop out runs 249.32 to 249.92 (a 0.15 s crouch, then a 0.41 s arc, off frame by
  249.88), and its pass ends at 249.97; only then does the row slide down 200 px to y 540 to 820
  (250.0 to 250.8, `power2.inOut`); the panel slides in above it, at y 200 to 480 (250.3 to 251.1),
  and a short singer-violet line draws across its five faint lanes from C4, rising into the C#4
  lane, 251.1 to 254.6; C#4's label glows on "C sharp" (253.65). The panel leaves at 254.77, and the
  row eases home to y 420 to 700 from 254.77 to 255.27, `power2.inOut`, across the S12 to S13 cut
  (254.97), so S13 opens on the row at home before the act 4 card lands (255.34).
- Orange is never on a tile: checked frame by frame with its body at 0.53 x 0.64 of its shown size
  against every tile move above, from S10c to S13a.

## Inside D: S13, tiles to ruler (fixed geometry, provisional timing)

- From 257.3, as the act 4 chapter card leaves, the tile row tips into a vertical ruler. Its scale
  leads, from 1 to 55/120 over 257.3 to 258.5 (`power2.out`), while its 90 degree anticlockwise turn
  about its centre (low notes end at the bottom) and the move of that centre from (960, 560) to
  (560, 490) run over 257.3 to 259.7 (`power2.inOut`). Sampled every frame, no tile corner goes
  below y 862.1 (v5's tip reached y 1000), above y 133.8, or right of x 1736. It lands as a vertical
  ruler with its line at x 560, A3 at y 820 and A4 at y 160, 55 px per semitone. Each tile shrinks
  into a 24 px tick on the right of the line, with its name on the left in the pitch line's sharp
  spelling (JetBrains Mono 30 px, ink-2, right-aligned at x 540): A3, A#3, B3, C4, C#4, D4, D#4, E4,
  F4, F#4, G4, G#4, A4. The dark tiles' flat names fade as they shrink. The A3 tile's blue edge glow
  and the A4 tile's orange one condense into the blue and orange beads, r 12, centred on their ticks
  at x 572 (x 560 to 584: 20 px clear of the names, which end at x 540, and of the cents labels,
  which start at x 604).
- The act 4 kicker (x 120 to 653, y 88 to 115) lands only once the card has gone (257.6), because
  the card's line (x 337 to 1583) rises through its lane as it leaves; the tip never reaches the
  lane, so the kicker holds until 260.0 and has gone by 260.2, before "PITCH-LINE NAMES" lands
  (260.37). Orange drops in at feet (1840, 860), shown at 290 (257.22 to 257.62; body about x 1763
  to 1917, y 674 to 860), 27 px right of the row's end (x 1736), and hops out right 260.1 to 260.7;
  its pass ends at 260.75.
- Every label on the ruler keeps a fixed distance from the line on screen (names 20 px left of it,
  cents 44 px right of it), so S13f's push moves them with their ticks but never scales them; it is
  about a point on the line, so the line stays at x 560.
- The column labels (JetBrains Mono 30 px, ink-2, tracking .18em, top layer, baseline y 120): the
  house label "PITCH-LINE NAMES" (369 px) right-aligned at x 540, directly over the names (x 171 to
  540), from b36's start (260.37); the film's label "CENTS ABOVE A3" (322 px), over the cents, from
  b37's "a hundred cents": first over the inset's cents (x 900 to 1222), then, as the inset closes,
  sliding left with the cents to x 604 (x 604 to 926), 276.7 to 277.7. The act 4 kicker has left
  their lane by 260.2. Both labels leave up fast as S13f's push begins and have
  gone by 290.2, before the push carries A4's name into their row (290.24). At 1x they sit above the
  ruler's top tick, A4 at y 160, and the orange bead on it (top at y 148).
- S13b to S13e hold the camera, the ruler and its labels still at 1x, so nothing on the ruler moves
  while the column labels are up and no clip is needed; once open, only the inset moves: it drifts 2
  % in and back out about its own centre (980, 500), 263.9 to 276.7, `sine.inOut`. On b36's "Let's
  measure it" the ruler's ticks light once, A3 up to A4 (260.8 to 261.5), and the A3 to A♯3
  segment's glow rises from "Listen" (261.5 to 262.7), before the inset grows.
- The magnifier (S13b to S13e), an object move instead of a push: the A3 to A♯3 segment glows, and
  two fine chrome leader lines run from its two ticks' outer ends, (584, 765) and (584, 820), to the
  inset's left corners, (760, 150) and (760, 850). The inset grows out of the segment, 262.7 to
  263.9, `power2.out`, and closes back into it, 276.7 to 277.5, `power2.in`: a dark rounded panel
  (`#161b22` at 90 %, `#30363d` rim, corner radius 16) from x 760 to 1200 and y 150 to 850, showing
  the segment at 10.9x: its own line at x 860 from y 170 to 830, A3 at y 790 and A♯3 at y 190 (600
  px per semitone), the names "A3" and "A#3" right-aligned at x 840, a tick every 10 cents (60 px
  apart, 860 to 884) labelled 0, 50 and 100, later with "¢" (left-aligned at x 900). The glide's
  chrome bead runs up the inset's line; nothing moves on the ruler but the segment's glow. The
  ruler's own cents column stays empty while the inset is open, so the upper leader line crosses
  nothing.
- S13c's readout is fixed right of the inset, Outfit 96 px left-aligned at x 1260, baseline y 500,
  with the frequency under it (mono 34 px, baseline y 556); it leaves as the inset closes (276.7).
- S13e's cents labels climb the ruler's right side, one every 0.14 s from 276.9 to 278.6 (JetBrains
  Mono 30 px, left-aligned at x 604): 0, 100 ... 1200; the gold bracket draws up from 0 to 1200 at x
  736, 24 px right of the longest label, 278.6 to 280.5; "1200 ¢ = 1 octave" lands beside it from x
  756 at 280.55, and the two beads pulse together at 280.9.
- S13f: the bracket, its label and both beads leave, 281.8 to 282.0; then the monitor slides in from
  the right, 282.0 to 282.5, drawn 1.4x its base size in a box from x 900 to 1614 and y 232 to 708
  (188 px right of the longest cents label, which ends at x 712), and slides out right, 289.5 to
  289.9. A chrome bead (r 12) grows on the A3 tick, 282.2 to 282.5, and from then on moves with the
  monitor's marker, 55 px on the ruler per 100 ¢ on the bar; the marker sits at (cents + 50) / 100
  of the bar's width (FACTS 30). Keyframes, each move `sine.inOut` except the glide, which is linear
  in cents as the sound was: 0 ¢, "A3", 220.0 Hz, at rest to 283.0; +15 ¢ (bead y 811.75, marker at
  65 %, 221.9 Hz) at 284.0; 0 ¢ at 284.9; -15 ¢ (y 828.25, 35 %, 218.1 Hz) at 285.9; 0 ¢ at 286.8,
  the name "A3" throughout; "A3" pulses at 285.3 and the bar's -50 and +50 labels at 286.05; the
  glide from 0 ¢ at 287.17 to 50 ¢ (y 792.5, the marker at the bar's right end, 226.4 Hz) at 288.3,
  where the segment's 50 ¢ point flashes, the name flips to "A#3" and the marker jumps to the left
  end; on to 100 ¢ (A♯3, y 765, the marker centred, 233.1 Hz) at 289.4; at rest to 289.5. The bead
  and the marker rest only 282.5 to 283.0, 286.8 to 287.17 and 289.4 to 289.5; v7's quicker nudges
  left them resting from 285.4 to 287.17, with only the two pulses. The marker is drawn in ink at
  every reading, never the app's green (within 10 cents), yellow (sharp) or blue (flat) (FACTS 30).
  The cents labels and that bead leave at 289.9, as S13f's push begins.

## D to E: S13 -> S14 at b41 (est. 291.90)

S13f's push in on the ruler's A3 region, from 1x to 160 px per semitone (scale 2.909) about
(560, 977), 289.90 to 291.90, `power2.inOut`, lands at rest exactly on the cut, and S14a starts
from that rest frame by drawing the lanes:

- The ruler line at x 560, 160 px per semitone, from G♯3 to B3 only: ticks for G♯3 at y 680, A3 at
  520, A♯3 at 360, B3 at 200 (each follows from the push). G♯3 is the dim tick the ruler grew below
  A3 as the push began. The line above B3, and every tick and name from C4 up, fade to 0 over 289.9
  to 290.4: at 160 px per semitone C4 would land at y 40, and the line would cross the canvas title
  at x 560.
- Labels "G#3", "A3", "A#3", "B3" in JetBrains Mono 30 px, ink-2, right-aligned at x 540; they live
  in the top layer, so they stay 30 px through the push. No cents labels; no bead; the monitor has
  gone (by 289.9); the column labels have gone (by 290.2).
- No Mercs (both drop in during S14a).

## Inside E: S14, the canvas (provisional)

- Lanes from x 560 to 1360 at the four heights above; the title "How MercuryPitch draws your voice"
  (JetBrains Mono 30 px, 594 px) from x 560, baseline y 150, from 292.0 until b42a's "Now you"
  (320.3), 50 px above the ruler line's top (B3, y 200). The chips "one octave up" (S14c) and then
  "A3 or A4" (S14f) sit above the lane labels, right-aligned at x 540, baseline y 110: 40 px above
  the title's baseline, so neither reads as part of the title.
- The app's "you are here" marker, drawn where and as the app draws it (FACTS 28), in the film's
  canvas colours: a white dot with a soft violet glow, the singer's colour, never the app's default
  green (which reads as in tune, Lesson 3's idea) nor its sing room's blue (blue Merc's note in this
  film), 14 px inside the canvas's left edge (x 574) at the singer's current height, a faint dashed
  guide running right from it, and a dark pill from 25 px in (x 585) naming the note. It leaves with
  the title.
- The monitor in S14d and S14e, its base drawing at 0.8 scale (S13f showed it at 1.4): a box from x
  1400 to 1820 and y 160 to 440, 30 px of padding round its 360 px title, above Orange (body from y
  591). It slides in 306.4 to 306.8 and out 319.9 to 320.3. Its marker is drawn in ink at every
  reading, as in S13f (FACTS 30).
- S14c's lane labels change out, then in: the A3 set fades out 301.8 to 302.0 and "G#4 A4 A#4 B4"
  fades in 302.0 to 302.2.
- S14d's push: 2 % about the marker (574, 520), 306.4 to 307.4, `power2.inOut`, so the lanes end at
  x 1376, 24 px clear of the monitor box (x 1400); S14f eases back to 1x, 320.4 to 321.4, so the viewer's
  turn plays on the lanes exactly as drawn in S14a.
- The Mercs: Blue at feet (230, 860), Orange at (1690, 860), shown at 420 (bodies about x 119 to 341
  and 1579 to 1801, from y 591).
- From "Now you" nothing of the app's drawing stays, and nothing of the film's guide lands until it
  has gone: the title, the marker, orange's violet line, the amber band, the app-style lane labels
  and the chip fade out, 320.3 to 320.6; then the film's own plain guide fades in on the same lanes,
  320.6 to 320.9, and "Your turn." lands from 320.7 where the title was: four thin chrome lines (2
  px, 50 %), labelled in the film's spelling with the Noto Music glyph (G♯3, A3, A♯3, B3,
  right-aligned at x 540, each with its octave-up name ghosted beside it), and Merc's path as a
  dashed chrome line (3 px, dash 10, gap 8).
- The your-turn cursor: a vertical chrome line (4 px, 100 %, soft glow) spanning the four lanes,
  waiting at x 560 from 335.26, then sweeping to x 1360 from 336.26 to 340.46 in step with Merc's
  path (A held 1.2 s, up 0.5, A♯ held 1.0, down 0.5, A held 1.0). Nothing rides the path.
- Before it, on b42b's "Slide up a semitone, and back", one soft chrome highlight (a 60 px glow)
  runs once along Merc's dashed path while Blue speaks: along A3 from 332.55, up to A♯3 332.9 to
  333.3, along A♯3, down 334.1 to 334.5, fading at the path's end by 334.9. Earlier in b42b the A3
  label brightens on "Start on my A" (327.6), the ghosted A4 beside it as the chip lands (329.1),
  and both together on "whichever feels easy" (331.4).

## E to F: S14 -> S15 at recap - 0.15 (est. 342.31)

- The plain guide at 20 % (since 341.89): its four chrome lanes from x 560 to 1360 at the four
  heights above, their labels and Merc's dashed path, fading out by 343.0, before card 1 lands;
  nothing of the app's drawing (gone since 320.6); "Your turn.", the safety labels, the chip, the
  cursor and the ring timer gone (by 341.96, fading from 341.76 as the pause ends); the monitor gone
  since 320.3.
- The Mercs are mid-move on one curve that spans the cut (S14g to S15a): from feet (230, 860) and
  (1690, 860) at 341.89 to (170, 860) and (1750, 860) at 343.09, shown size 420 to 300 (scale 0.808
  to 0.577 of the 520 render), `power3.inOut` (provisional). The pass is the same on both sides
  (m14-duo), so their pixels match by construction.

## Inside F: S15 -> S16 at next - 0.15 (est. 389.06)

- S15g's grid, its labels and its kicker leave from 388.5 to 388.8, before the Mercs move.
- The Mercs are then mid-move on one curve that spans the cut (S15g to S16): from feet (170, 860)
  and (1750, 860), shown at 300 (scale 0.577), at 388.8 to (560, 840) and (1360, 840), shown at 520
  (scale 1.0), at 390.4, `power3.inOut` (provisional). The same m14-duo pass on both sides: no hop
  out, no drop in. S16's canvas fades in under the move, between the Mercs' landing places (x 728
  to 1192, y 560 to 800, 30 px from each body), which neither body crosses on its way in.

## Inside F: S16 -> S17 at end (est. 405.00)

- Both Mercs on the floor: Blue feet (560, 840), Orange feet (1360, 840), shown at 520 (bodies about
  x 422 to 698 and 1222 to 1498, from y 507), the same m14-duo pass on both sides. The 524 px
  between their bodies holds S16's one-band canvas and then S17's two-line legend.
- S16's two figures sit side by side above the Mercs (y 230 to 480): "ASKED", "59 %" and "of 1,105"
  centred on x 640, "TESTED", "10–16 %" and "≥ 1 semitone off" centred on x 1280, on shared
  baselines (y 260, 420 and 470); they and the kicker have gone by 404.74.
- S16's canvas (one amber band and the faded violet line, x 728 to 1192, y 560 to 800) is still at
  100 % at the cut and fades out over S17's first 0.5 s; only then, from 405.5, does the legend
  land in its place.
- S17's text sits above the Mercs' heads: the lockup at y 40 to 220, "Find your pitch." at baseline
  y 330, the URL at baseline y 440.
