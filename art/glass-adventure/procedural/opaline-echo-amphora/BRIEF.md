# Opaline Echo Amphora: brief

A breakable hero vessel in the Twin Galleries court: the player sings to it and
it shatters. This build replaces the Meshy-made
`apps/beside-cue/public/games/adventure-v6/opaline-echo-amphora-qa-v2.glb`
without any code change, so it keeps that file's runtime contract exactly.

## Role and cameras

- Seen from the third-person gameplay camera, 3 to 6 m away, standing on a
  plinth: 100 to 250 px tall on a 1280 x 800 desktop, less on a phone. The
  `game` panel (128 px) is the honest test of what survives.
- Inspected closer only by walking up to it. "View artwork" shows paintings,
  not this asset.
- Breaks into the authored shards when sung to; the shards fly for a second or
  two, so their cut faces and wall thickness are seen briefly.

## Runtime contract (read from the shipped GLB and `catalog.ts`)

| Item        | Value                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| Root        | empty `breakable_l2_opaline_echo_amphora`, no transform, extras `asset_id`, `units: metres`                        |
| Intact      | `breakable_l2_opaline_echo_amphora_intact`, 0.92 m tall from z 0, extras `role: intact`                            |
| Shards      | `breakable_l2_opaline_echo_amphora_shard_000` to `_017` (18), origin at centroid, `role: shard`                    |
| Collider    | `COLLIDER_..._amphora`, 16-gon r 0.227244, z 0 to 0.644, flat, no material (not read by the game; kept for parity) |
| Orientation | handles along +-X; the game recentres on the intact's bounds and scales to 0.92 m                                  |
| Budget      | intact at most 8,000 triangles, shards at most 12,800 together, no textures in this version                        |

`contract.json` holds the same as gates for `validate_asset.py`.

## Reference

- Concept: `art/glass-adventure/v6-level2/concepts/opaline-echo-amphora.png`,
  shot from about 8 degrees above (the rim ellipse: half height over radius).
- Shipped donor for cross-checks: `art/glass-adventure/v6-level2/meshy/opaline-echo-amphora-donor.glb`,
  sliced in `reference/donor-measurements.json`.

## Parts and why they exist

| Part              | Why                                                                       | Material   |
| ----------------- | ------------------------------------------------------------------------- | ---------- |
| Base ring         | Stability and visual weight; the hammered gold band the vessel stands on  | gold       |
| Foot              | Lifts the body, carries the jade colour down to the floor                 | jade       |
| Stem ring         | The joint the body sits in, a ring and a bead                             | gold       |
| Body              | Milky opal glass with iridescence, hollow, an even 10 mm wall             | opal glass |
| Lower, waist band | Frame the wave register, read as structure                                | gold       |
| Collar            | Marks the neck joint                                                      | gold       |
| Neck, rim, lip    | Narrows then flares; a gold rim band runs into a rolled lip               | opal, gold |
| Handles           | Jade straps from under the rim to the shoulder, thick enough to lift it   | jade       |
| Cuffs, lining     | Gold cuff where each handle meets the neck, gold lining on its inner face | gold       |
| Tails             | Each handle ends in a gold leaf lying on the shoulder                     | gold       |
| Waves             | Six gold strokes, each curling clockwise into a spiral                    | gold       |

## Measured dimensions (true metres)

Read from the concept's segmented mask in the silhouette gate's own units
(`rows.json`), corrected for the 8 degree camera; heights are side-silhouette
heights.

| Feature      | Measurement                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Base ring    | r 0.176, top 0.072; rounded bottom edge                                                                                   |
| Foot         | r 0.164 at 0.075, 0.151 at 0.095, 0.138 at 0.105, 0.100 at 0.124                                                          |
| Stem rings   | r 0.101, z 0.124 to 0.166                                                                                                 |
| Lower body   | r 0.118 at 0.175, 0.143 at 0.20, 0.177 at 0.23, 0.202 at 0.26, 0.228 at 0.30, 0.248 at 0.34, 0.263 at 0.38, 0.273 at 0.42 |
| Belly        | widest r 0.283 at 0.48                                                                                                    |
| Bands        | lower 0.245 to 0.2615, waist 0.4205 to 0.4425                                                                             |
| Collar       | 0.690 to 0.726, r 0.149                                                                                                   |
| Neck         | narrowest r 0.1145 at 0.776                                                                                               |
| Rim          | r 0.167 at 0.91, lip crown at 0.92                                                                                        |
| Handles      | outer edge 0.310 to 0.312 at z 0.70 to 0.74; top of the arc 0.876; plumb outer edge 0.286 to 0.291 below the shoulder     |
| Wave strokes | curl centres at z 0.35, crest 0.40, trough 0.31; a curl 11 degrees right of the front, six around                         |

INFERRED (no reference shows them): the handles' thickness across the view
(0.78 of their width), the cavity, the shard pattern.

## Must survive at gameplay size

The gold bands and rim, jade handles with gold cuffs, the wave register, the
iridescent milky opal. Not modelled in this version: the hammered texture on the
gold, the sculpted relief of the wave bodies (the gold line carries the motif).

## Gates

`forms_pass` against the concept at 8 degrees, the contract gate, the Khronos
validator with 0 errors, the budgets above, and a critic SHIP on the sheets and
the runtime proof. The owner decides whether it replaces the shipped file.
