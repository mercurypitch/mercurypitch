# Glass look, amber round 1, 2026-10-24

Phase 1 of [`glass-look-system-2026-10-23.md`](../../../../docs/plans/glass-look-system-2026-10-23.md):
three ambers on the rebuilt urn under the bench's five lights, each under ACES
and Neutral tone mapping.

- **A**: the urn's own `amber_glass`, as the game draws it today.
- **B**: Three's transmission, over an emissive liner inside the body near 1.45
  radiance (`SCREEN_AMBER_V1`).
- **C**: glass that carries its own light: studio refraction bent like a thin
  wall, a glow that grows with the path through the glass, and back-light
  (`STUDIO_AMBER_V1`).

Both B and C keep 40% of the urn's thickness map over a 35 mm floor, and use a
white base with the concept's gold as their only tint
(`packages/glass-game/src/bench/bench-looks.ts`).

The live bench, with these looks and both vessels, is a private page:
https://claude.ai/artifact/KB4bBm9HSJufmJ9DPvrJSr (built by the skill's
`bench_publish.mjs`).

## Numbers

Each number is the largest colour change across the five lights (CIEDE2000 of
the vessel's masked mean colour). Lower means the look holds better.

| Look          | ACES | Neutral |
| ------------- | ---- | ------- |
| A · today     | 11.3 | 12.4    |
| B · lit liner | 3.9  | 4.5     |
| C · own light | 4.6  | 5.0     |

## What the sheet shows

- **A** shows the checker card through the amber and turns caramel in the
  gallery.
- **B** glows like a lantern, with orange stripes in the creases. It still shows
  whatever sits behind it, as the swatches do with the checker card.
- **C** reads as one deep amber body in every light and never shows the room.
- **Tone mapping**: Neutral keeps the amber golden; ACES pushes it toward pale
  honey.

An earlier C refracted at a single surface. Its upward-facing lobes looked into
the studio's bright dome and turned whitish, so C now bends the view ray 30%
of the way (`refractionStrength`). The A rows come from the same capture
config before that change; A does not use the setting.

## To decide

B or C (or both into round 2), and Neutral or ACES.

## Re-run

```sh
node .claude/skills/blender-modeler/scripts/bench_capture.mjs --config bench.json --out <dir>
python3 .claude/skills/blender-modeler/scripts/bench_sheet.py <dir>
node .claude/skills/blender-modeler/scripts/bench_publish.mjs --out <site> \
  --hero "Amber Cadence Urn, rebuild=<path>.glb" --notes <notes.html>
```
