# Glass look checkpoint 0, 2026-10-23

Phase 0 of [`glass-look-system-2026-10-23.md`](../../../../docs/plans/glass-look-system-2026-10-23.md):
the look-development bench on today's materials, a first untuned draft of the
studio amber, and the two fixes in the game.

## The bench sheet

`bench-sheet.jpg`. The columns are the bench's lights:

- `room`, `grey` and `hdr` are image light only.
- `gallery` is today's gallery rig at its environment intensity of 0.65.
- `kit` is the gallery plus the resident spots and a lit plinth top.

Each cell's numbers are the vessel's mean CIELAB inside its mask. A row's
"max ΔE2000 across lights" says how far the look moves with the light.

| Row                                       | Max ΔE2000 across lights |
| ----------------------------------------- | ------------------------ |
| Urn, shipped (opaque Meshy)               | 9.2                      |
| Urn, rebuild, today's amber               | 11.3                     |
| Amphora, shipped                          | 9.1                      |
| Amphora, rebuild                          | 8.6                      |
| Decanter, shipped (clear)                 | 10.5                     |
| Urn, rebuild, studio amber draft, ACES    | 4.9                      |
| Urn, rebuild, studio amber draft, Neutral | 5.0                      |

What it shows:

- **The bench reproduces the game.** Today's amber turns caramel under the
  gallery light and shows the checker card through it under the image lights.
  Both opals let the checker through, and the clear decanter almost vanishes.
- **The first, untuned studio amber holds its read** under every light at
  about half the spread, and glows gold without the wall behind it.
- **Phase 1 has work to do.** The thickness map's contrast is too strong
  (orange creases, pale lobes), and the studio's dim upper half darkens the
  top of the spheres and lobes.

## The two fixes in the game

- **The authored glow survives** (`fix-amphora-court-zoom.jpg`,
  `fix-amphora-court.jpg`). The shipped opaline amphora's own emissive map now
  shows at rest:
  - its darkest 5% lifts from 96 to 109 luminance (0-255);
  - its b\* goes from 4 to 9;
  - its median barely moves (141 to 144).
- **Glass meshes no longer cast shadows.** Three's shadow map draws glass as
  solid. The plinths still cast theirs.
- **`fix-urn-warm-room.jpg` is the control.** The shipped amber urn is opaque,
  so it keeps its shadow, and nothing changes.

The camera settles a little differently on each run, so the court frames do not
match exactly.

## Re-run

```sh
node .claude/skills/blender-modeler/scripts/bench_capture.mjs --config bench.json --out <dir>
python3 .claude/skills/blender-modeler/scripts/bench_sheet.py <dir>
```

Fill in the two rebuild paths in `bench.json` from the session archive
(`final-builds/`).
