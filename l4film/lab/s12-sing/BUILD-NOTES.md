# Build notes: group E (s12-sing, s13-your-turn)

Running notes so a container restart or a usage-limit pause can resume. Builder E owns
`compositions/s12-sing.html`, `compositions/s13-your-turn.html`, `lab/s12-sing/` and
`lab/s13-your-turn/` only. Clock: Kokoro scratch, 483.73 s (cues.json = tools/board-cues.json).

## Spans

- s12-sing 341.242 to 372.917 (D 31.675); cuts on act4 (341.392) 0.15 s early.
- s13-your-turn 372.917 to 405.494 (D 32.577); ends 0.15 s before recap (405.644).

## Merc passes (mine: m12-blue, m12-orange; 8,438 frames each, filmStart 343.2, size 520)

- 09:50: both still rendering (.part.webm). L.mercGate warns and uses 30 until whole.js lists them.

## Plan (09:50)

- S12: kit L.stairs + L.strip for the D-to-E frame; my own rows (the kit's look, the kit's
  keep-out mask) so they can stretch into lanes; my own tread rects that become the band.
- Tip (provisional): rows on one affine map (x 220-1680 -> 600-1440, 26 -> 46 px); treads to
  segments; blocks collapse up into their treads while they fade; names and bottom house ride
  their stair and fade; top house rides to (1381, 116).
- S13: the S12 guide drawn from the same formulas (G(u) for the move), then the plain guide; the
  reverse tip: lanes to C's rows, segments to C's treads, blocks grow down from them (the kit's
  own block elements, geometry overridden until the morph lands), names ride the growing foot.

## Log
