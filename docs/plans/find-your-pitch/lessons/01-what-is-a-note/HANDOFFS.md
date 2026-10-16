# Handoffs: exact frames where one builder's scene meets the next

The last frame of scene N and the first frame of scene N+1 must show every carried object on the
same pixels (within 2 px). Waves are drawn from film time T (scene start + local t) so a travelling
wave's phase matches across a cut: `T = L.scene(SID).start + t`.

Shared formulas (`assets/lib/lesson.js` helpers are fine to use):

- Cosine trace: `y(x) = mid - amp * cos(2 * PI * cyc * (x - x0 - 60 * T) / (x1 - x0))`, stroke via
  `L.glowPath` (width 4, glow 16) unless stated.
- Beads: `L.bead(svg, { r: 22, color })`; chrome bead colour `#c3ccd6`.

## A to B: S2 -> S3 at 25.62

The room only (ground, staves, vignette; no dust in the last 0.3 s of S2 or the first 0.3 s of S3)
plus one horizontal line: `<line x1="0" x2="1920" y1="540" y2="540">`, stroke
`rgba(195,204,214,0.55)`, width 3. No title, no notes, no kicker. Camera at rest (scale 1, x 0, y 0).

## B to C: S5 -> S6 at 68.82

- Trace: chrome `#c3ccd6`, x0 120, x1 1180, mid 560, amp 110, cyc 24 (the 880 Hz end of the sweep),
  film-time phase as above, with its time axis hairline at y 700 from x 120 to 1180.
- Rail: vertical line x 1560 from y 200 to y 800, stroke `rgba(195,204,214,0.45)` width 3; ticks at
  y 200, 400, 600, 800 (A5, A4, A3, A2), 24 px long, labels "880", "440", "220", "110" in JetBrains
  Mono 30 px at x 1600, ink-2.
- Chrome bead on the rail at (1560, 200).
- Readout "880 Hz" Outfit 96 px, left edge x 1340, baseline y 150 (unit in mono).
- Camera: S5 ends at rest (scale 1.03 is reset to 1 by 68.5).

S6 starts from exactly this frame and dims it.

## C to D: S8 -> S9 at 114.22

- Blue trace: x0 160, x1 1760, mid 700, amp 90, cyc 4, colour `#58a6ff`, with time axis at y 820.
- Orange trace: x0 160, x1 1760, mid 380, amp 90, cyc 8, colour `#ff7448`, time axis at y 500.
- Blue bead at the right end of the blue trace: (1760, y_blue(1760)); orange bead at
  (1760, y_orange(1760)). Both r 22.
- Readouts: "220 Hz" (blue) left edge x 160, baseline y 600; "440 Hz" (orange) left edge x 160,
  baseline y 280; Outfit 64 px, units mono.
- No kicker, no "octave" word (it has left by 114.1), no pills.
- Camera at rest.

## D to E: S12 -> S13 at 160.02

- The "as you hear it" ruler alone, centred: vertical line x 960 from y 220 to 820, stroke
  `rgba(195,204,214,0.45)` width 3; rungs (40 px wide) at y 820 (A2), 620 (A3), 420 (A4), 220 (A5);
  labels "A 110", "A 220", "A 440", "A 880" (Outfit 48 px letter, JetBrains Mono 34 px number), left edge
  x 1010, centred on each rung. Octave numbers (A2, A3...) are NOT shown before cue b27a, where S15
  explains that each numbered turn starts at C.
- Blue bead at (960, 620); orange bead at (960, 420); no chrome bead.
- No other text. Camera at rest.

S13's spiral starts as this exact line: at its progress 0 the helix has radius 0 and the same
heights (A2 at y 820, 200 px per octave), so the line simply opens into the spiral.

## E to F: S16 -> S17 at 211.26

- Keyboard: A2 to A5 inclusive, white keys only counted: 22 white keys (A2 B2 C3 ... G5 A5), x from
  200 to 1720, so each white key is 69.09 px wide; keys from y 560 to 820, white fill `#e6edf3` at
  92 %, 2 px gaps; black keys 40 px wide, from y 560 to 724, fill `#161b22` with a `#30363d` rim,
  centred on the boundary between their two white keys.
- Letter labels on the white keys: "C3", "C4", "C5" only, JetBrains Mono 30 px, colour `#2a323c`
  (dark ink on the light key, 11:1), inside the key, baseline 18 px above its bottom.
- A3 key glows: fill mixed 55 % with `#58a6ff`, a blue bead resting on the key top at its centre
  (key centre x, y 540). A4 key: same with `#ff7448` and the orange bead.
- Camera at rest.

## Inside F: S17's keyboard turn (geometry)

The E to F keyboard (A2 to A5, 22 white keys, 1520 px wide) cannot stand upright at full size in a
1080 px frame. In S17a it rotates 90 degrees anticlockwise about its centre while scaling to 0.5
(760 px tall, low notes at the bottom), and settles with its left edge at x 80 and its vertical
centre at y 470 (top y 90, bottom y 850; A2 at the bottom). The lanes extend right from the keys to
x 1840, one lane per semitone (36 lanes of 21.1 px); A lanes (A2, A3, A4, A5) brightest. The tune
lines run on the A3 and A4 rows. The Mercs sit small (size at most 300) in the bottom corners clear
of the lanes they are not singing, or appear only in 17b and leave.
