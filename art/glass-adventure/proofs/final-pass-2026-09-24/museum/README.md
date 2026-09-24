# Floating Museum: island contact and bridge inspection

These are actual game screenshots from matched cameras at a 1500 × 1000 CSS
viewport. The receipt records Chromium using the Radeon RX 9070 XT through
ANGLE/Vulkan. All five inspected views loaded without page or console errors.
This is a placement and architecture assembly pass; it does not claim new
retopology or new baked textures for the accepted Meshy models.

## Per-island findings and corrections

| View                                              | Before                                                                                                                          | Corrected result                                                                                                                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [First Light](before/first-light.png)             | Pond read as an unbounded water decal; nearby planting relied on an incorrect terrace transform.                                | [After](after/first-light.png): open marble coping and a shallow stone bed, with planting seated on the terrace outside architecture and stairs.                                                                    |
| [Glassworks](before/glassworks.png)               | The departing bridge consisted of tilted, overlapping blocks with outer seams; golden route markers followed a different curve. | [After](after/glassworks.png): level curved treads, joined boundaries, a continuous rail, and route markers seated along the same centerline.                                                                       |
| [Twin Galleries](before/twin-galleries.png)       | The broad pond crossed underneath the processional stair footprint.                                                             | [After](after/twin-galleries.png): smaller pond in the right side garden, matching waterfall source, and clear stair approaches. The wider [connection view](after/bridge-connections.png) includes its entire lip. |
| [Conservatory](before/conservatory.png)           | The pond crossed the imported circular temple base and had no physical border.                                                  | [After](after/conservatory.png): an outboard supported basin, visible clearance around its coping, an open waterfall lip, and planting outside the architectural approach.                                          |
| [Both connections](before/bridge-connections.png) | Tilted boxes created wedge-shaped gaps and uneven arrivals.                                                                     | [After](after/bridge-connections.png): closed horizontal treads share their boundaries, meet the authored landing heights, and have supported rail posts and under-deck arches.                                     |

The architectural stair blocks now extend down to their common supporting base.
Plants and stairs share one authored footprint definition. Correct Three.js
inverse-yaw transforms replace the previous reversed rotation, and terrace
clearance uses the actual platform bounds rather than applying an additional
0.75 depth scale. Repeated pond beds, copings, rail posts, finials and planters
use instances. Mesh and material disposal stays with the owning assembly.

## Verification

The pond/stair intersection check failed for the original Twin Galleries pool
and passes after relocation. Bridge raycasts sample 361 points per bridge,
checking continuous support, upward faces, bounded risers and landing heights.
Rotated footprint tests use independent Three.js transforms. Existing botanical
coverage still requires all six flower donors and supported planter placement.
Independent review caught a remaining Conservatory overlap beyond the procedural
stairs. A regression now measures the low plinth directly from the shipped V8
GLB, then compares the complete pond border against its conservative footprint.
It failed on the old placement (about 15 cm overlap); the corrected pond has
about 14 cm minimum sampled clearance and retains its east waterfall connection.

```text
Working directory: packages/glass-game
rtk proxy timeout 120 pnpm exec vitest run src/journey/architecture.test.ts src/journey/bridges.test.ts src/journey/terrace-layout.test.ts src/journey/vegetation.test.ts src/journey/models.test.ts src/journey/water.test.ts src/journey/ponds.test.ts src/content/museum-journey.test.ts
8 files passed, 38 tests passed.
Scoped ESLint: passed.
```

Run `node art/glass-adventure/proofs/final-pass-2026-09-24/museum/capture.mjs after`
against the local app on port 5613, or set `GLASS_QA_URL` to another local URL.
The capture script uses real navigation, wheel and drag input, then verifies the
camera state before each screenshot. HTML overlays are hidden only for the
island detail captures. `overview.png` retains the complete interface.

`source-receipt.json` preserves source hashes and measured platform bounds. The
V1 base, V8 architecture and V10 botanical GLBs are unchanged. Existing close-up
triangulation in the source architecture is not represented as repaired here;
the later high-detail asset pass remains separate from these contact fixes.
Physical-device navigation, visual preference and thermal behavior remain owner
acceptance checks.
