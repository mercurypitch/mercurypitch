# Amber Cadence Urn: brief

## What it is and where it lives

A breakable vessel in the Twin Galleries' warm gallery (the "lower urn"
encounter): the player sings to it and it shatters. This build is meant to
replace the Meshy-made
`apps/beside-cue/public/games/adventure-v6/amber-cadence-urn-qa-v2.glb` without
any code change. It keeps that file's runtime contract; the swap updates the
file's receipt in `adventure-v6/manifest.json` (sha256, bytes, counts, source),
which `catalog.test.ts` checks. The owner decides whether it replaces the
shipped file.

## Role and cameras

- Seen from the third-person camera 3 to 6 m away on a plinth, about 100 to
  220 px wide on a 1280 x 800 desktop; the `game` panel (128 px) is the test.
- Inspected closer only by walking up to it.
- Breaks into the authored shards, which fly for a second or two.

## Runtime contract (read from the shipped GLB and the manifest)

| Item        | Value                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root        | empty `breakable_l2_low_amber_urn`, no transform, extras `asset_id: amber-cadence-urn`, `units: metres`                                                                                     |
| Intact      | `breakable_l2_low_amber_urn_intact`, 0.72 m tall from z 0, extras `role: intact`, `asset_id`                                                                                                |
| Shards      | `breakable_l2_low_amber_urn_shard_000` to `_015` (16), origin at centroid, `role: shard`                                                                                                    |
| Collider    | `COLLIDER_breakable_l2_low_amber_urn`, 16-gon r 0.372619 at phase 0, z 0 to 0.504, no material (kept for parity)                                                                            |
| Orientation | the cabochon and bead face -Y (the front); the game recentres on the intact's bounds and scales to its height                                                                               |
| Budget      | intact at most 9,800 triangles (shipped 9,864), shards at most 16,000 (shipped 16,624); textures at most 512 px; the GLB under the 3.74 MB of the shipped file, which carries four textures |

`contract.json` holds the same as gates.

## Reference

- Concept: `art/glass-adventure/v6-level2/concepts/amber-cadence-urn.png`. The
  rim opening is an ellipse of half height 21 px over a half width of 271 px:
  the camera is about 4 degrees above the rim.
- The concept is taller for its width than the shipped mesh: its projected
  height at 4 degrees gives 0.886 m across at 0.72 m tall, where the Meshy file
  is 0.932 m across. The build follows the concept; the silhouette gate checks
  the proportion.
- `reference/measure_concept.py` writes `reference/concept-mask.png`, the mask
  the silhouette gate uses (the cream marble is close to the backdrop and the
  generic segmentation drops it; the soft floor shadow is cut by symmetry).
- Shipped donor for cross-checks: `art/glass-adventure/v6-level2/meshy/amber-cadence-urn-donor.glb`.

## Parts and why they exist

| Part          | Why                                                                                                       | Material     |
| ------------- | --------------------------------------------------------------------------------------------------------- | ------------ |
| Foot          | A cream marble disc with rounded edges: stability and the plinth the urn sits on                          | marble       |
| Lower band    | Gold fillets framing a dark recess with laurel leaves running out both ways from a gold bead at the front | gold, laurel |
| Body          | Amber glass in eight melon lobes, deep creases between them, hollow with an even wall                     | amber glass  |
| Shoulder band | Gold fillets and laurel as below, with a jade cabochon in a gold bezel at the front                       | gold, laurel |
| Neck and rim  | Cream marble, concave, flaring to a rolled lip                                                            | marble       |
| Cabochon      | A domed oval jade stone in a gold bezel                                                                   | jade, gold   |

## Measured dimensions (true metres)

Read from `reference/concept-mask.png` at 0.000764 m per pixel and 4 degrees;
heights are side-silhouette heights, fitted again against the gate.

| Feature    | Measurement                                       |
| ---------- | ------------------------------------------------- |
| Total      | 0.72 m tall, 0.886 m across the lobe crests       |
| Foot       | r 0.29 to 0.30, rounded, 0 to about 0.07          |
| Lower band | r about 0.25, about 0.07 to 0.12                  |
| Body       | widest about 0.443 near mid height; eight lobes   |
| Shoulder   | the band about 0.56 to 0.61, r about 0.27 to 0.29 |
| Neck       | narrowest about 0.18, flaring to the rim          |
| Rim        | r about 0.23, lip crown at 0.72                   |

INFERRED: the lobe depth (the creases read about 12 per cent of the radius),
the wall thickness (10 mm), the cavity, the shard pattern.

## Must survive at gameplay size

The amber glass and its lobes, the cream marble neck and foot, both gold bands
with the dark laurel recess, the green cabochon. The laurel leaves are a
texture (colour and normal), not geometry.

## Gates

`forms_pass` against `reference/concept-mask.png` at 4 degrees, the contract
gate, the Khronos validator with 0 errors, the budgets above, the three.js
preview and runtime proof, and a critic SHIP. The owner decides the swap.
