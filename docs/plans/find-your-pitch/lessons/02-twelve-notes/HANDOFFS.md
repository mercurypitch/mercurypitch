# Handoffs: exact frames where one builder's scene meets the next

The last frame of scene N and the first frame of scene N+1 must show every carried object on the
same pixels (within 2 px). Values marked **(provisional)** are starting values: the two builders on
either side of a handoff confirm them in a lab still, then this file is updated and the mark
removed before either scene is built further. Unmarked values are carried from Lesson 1 or follow
from arithmetic and are fixed now.

Builder groups (STORYBOARD): [A] S1 to S3, [B] S4 to S6, [C] S7 to S10, [D] S11 to S13, [E] S14,
[F] S15 to S17.

## Shared formulas

- Film time `T = L.scene(SID).start + t`; anything that travels (a glow, a drift, an orbit) is drawn
  from `T`, so its phase matches across a cut.
- Beads: `L.bead(svg, { r: 22, color })`. Chrome `#c3ccd6`; a dim bead is chrome at 35 % opacity
  with a "?" glyph (Lesson 1's S14c); a lit bead is chrome at 100 % with a soft glow (16 px).
- Step bars: 16 px wide, rounded ends, chrome, 40 px per semitone, drawn upward from the line under
  the pair they measure (pitch is height).
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

## A to B: S3 -> S4 at act1 - 0.15 (est. 40.47)

- The spiral, front view, `phi` 0, `eps` 10 (provisional), orbit stopped (S3 settles it by 39.6).
- The lit turn A3 to A4: the seven letter labels at their angles (Outfit 48 px, ink), the five dim
  beads, the blue bead on the front at A3 and the orange bead on the front at A4, one above the
  other. The other two turns: chrome beads at 60 %, no letters.
- One push spans the cut: camera scale 1.0 at 39.60 to 2.2 at 41.60, `power2.inOut`, centred on the
  front of the lit turn between A3 and B3 (provisional (1010, 650)). Both builders evaluate the same
  curve; at the estimated cut its value is 1.457 (recompute at the measured cut). This is a match
  motion, so speed and direction continue across the join.
- No text on screen (S3's last kicker has left by 40.2). No Mercs. Dust continues (near layer).

## B to C: S6 -> S7 at act2 - 0.15 (est. 95.78)

A rest frame, so the crane down in S7a starts from stillness.

- Camera straight down the spiral's axis (`eps` 90), plan projection (orthographic), so the lit turn
  is a true circle: centre (960, 520), radius 300 (provisional). The other two turns have faded to 0
  during S6b's crane; only the A3 to A4 turn shows.
- Its twelve beads at x = 960 + 300 sin(30 s deg), y = 520 + 300 cos(30 s deg), s semitones above A,
  A at the bottom where the front was: A (960, 820), A♯ (1110.0, 779.8), B (1219.8, 670.0), C (1260.0,
  520.0), C♯ (1219.8, 370.0), D (1110.0, 260.2), D♯ (960.0, 220.0), E (810.0, 260.2), F (700.2, 370.0),
  F♯ (660.0, 520.0), G (700.2, 670.0), G♯ (810.0, 779.8). All twelve lit chrome, except A: the orange
  A4 bead drawn exactly over the blue A3 bead, a 3 px blue rim showing round it.
- The twelve gold wedges at 0 (dimmed by 95.4); "semitone" and "HALF STEP" gone.
- No kicker. No Mercs.

## Inside C: S7 -> S8, the one-octave close-up (fixed)

S7b ends on a uniform 2x push about (960, 820) of the Lesson 1 keyboard (x' = 2x - 960,
y' = 2y - 820), which frames the A3 to A4 octave, because that octave is centred on x 960 there.
S8 starts from exactly this frame:

- White keys 138.18 px wide, y 300 to 820. Left edges: A3 407.27, B3 545.45, C4 683.64, D4 821.82, E4
  960.00, F4 1098.18, G4 1236.36, A4 1374.55; centres 69.09 px to the right of each.
- Black keys 80 px wide, y 300 to 628, centred on A♯3 545.45, C♯4 821.82, D♯4 960.00, F♯4 1236.36,
  G♯4 1374.55.
- Labels A3, B3, C4, D4, E4, F4, G4, A4 on the white keys: JetBrains Mono 60 px on screen (authored at
  30 px before the push), `#2a323c`, baseline 36 px above the key bottom (y 784). The keys outside
  the octave (G♯3 and A♯4 at the frame's edges) are dimmed to 40 %.
- The "7 white + 5 black" bracket has left by 106.0.

## Inside C: S9d, keys to tiles (fixed)

Every key of the octave glides to its tile; the two edge keys outside the octave fade out. Tiles:

- 13 tiles, 112 px wide, 8 px gaps, centres x = 240 + 120 i (A3 240, A♯3 360, B3 480, C4 600, C♯4
  720, D4 840, D♯4 960, E4 1080, F4 1200, F♯4 1320, G4 1440, G♯4 1560, A4 1680), so the row runs from
  x 184 to 1736; y 420 to 700 (provisional); corner radius 10.
- White tiles `#e6edf3` at 92 % with their labels (JetBrains Mono 40 px, `#2a323c`, baseline y 676);
  dark tiles `#161b22` with the `#30363d` rim and no label.
- Under the row, at y 740: a chrome bracket under each of the 12 neighbouring pairs, labelled "1"
  (Outfit 40 px, baseline y 790).
- The A3 tile's top edge glows blue, the A4 tile's orange (the two beads' notes).
- In S10c the five dark tiles lift 300 px (to y 120 to 400) and drop back into the same slots.

## C to D: S10 -> S11 at act3 - 0.15 (est. 197.82)

- The tile row exactly as in "Inside C: S9d", every tile in its slot, the five dark tiles with no
  label, the twelve "1" brackets under the row in chrome.
- "tone", "semitone", "= 2 semitones", "WHOLE STEP" and "7 + 5 = 12" all gone (cleared by 197.6).
- Camera at rest (scale 1). No Mercs. No kicker.

## Inside D: S13b, tiles to ruler (fixed geometry, provisional timing)

- The tile row tips up 90 degrees anticlockwise (low notes end at the bottom) while it scales to
  55/120 and moves its centre from (960, 560) to (480, 490): a vertical ruler at x 480 with A3 at y
  820 and A4 at y 160, 55 px per semitone. Each tile shrinks into a 24 px tick on the right of the
  ruler line, with its name on the left in the app's sharp spelling (JetBrains Mono 30 px, ink-2,
  right-aligned at x 460): A3, A#3, B3, C4, C#4, D4, D#4, E4, F4, F#4, G4, G#4, A4. The blue bead
  rides the A3 tick, the orange bead the A4 tick.
- S13d's cents labels sit right of the ticks (JetBrains Mono 30 px, left-aligned at x 520): 0, 100
  ... 1200.

## D to E: S13 -> S14 at act4 - 0.15 (est. 286.81)

S13e ends on a push in on the ruler's A3 region, which S14a continues by drawing the lanes:

- The ruler line at x 560 (provisional), 160 px per semitone: ticks for G♯3 at y 680, A3 at 520, A♯3
  at 360, B3 at 200 (provisional); the rest of the ruler is off frame.
- Labels "G#3", "A3", "A#3", "B3" in JetBrains Mono 30 px, ink-2, right-aligned at x 540; they live
  in the top layer, so they stay 30 px through the push. No cents labels; no bead; the monitor has
  gone (285.9).
- No Mercs (Blue's MCU enters in S14a).

## E to F: S14 -> S15 at recap - 0.15 (est. 332.72)

- The canvas at 20 %: lanes from x 600 to 1560 at the four heights above (provisional), the amber
  path and orange's violet line still drawn; "Keep it gentle." gone.
- The Mercs are mid-move on one curve that spans the cut (S14g to S15a): from feet (230, 860) and
  (1690, 860) at 332.30 to (170, 860) and (1750, 860) at 333.50, scale 1.0 to 0.714 (420 px shown at
  300), `power3.inOut` (provisional). The passes are the same on both sides (m14-duo), so their
  pixels match by construction.

## Inside F: S16 -> S17 at end (est. 390.56)

- Both Mercs on the floor: Blue feet (560, 840), Orange feet (1360, 840), size 520, the same m16
  passes on both sides.
- S16's canvas (one amber band and the faded violet line) is still at 100 % at the cut and fades
  out over S17's first 0.5 s; S16's kicker and numbers have gone by 390.3.
