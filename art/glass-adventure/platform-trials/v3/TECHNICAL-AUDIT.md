# Cloudway v3 technical audit

Status: source-quality and runtime review candidates validated. No public asset
was replaced in this directory.

## Result

V2 reduced each textured Meshy shell to about 7,000 triangles, reduced its PBR
atlases to 1K, and hid most of the donor landing under an opaque procedural
slab. V3 starts from the preserved textured donors, keeps 35,000–40,000 shell
triangles, exposes their original UV/PBR surfaces, and preserves all six roots,
colliders, and crackle states.

The source-quality file remains the editable visual ceiling. The runtime file
keeps the same rendered triangle geometry, roots, visual bounds, UV/PBR surface,
and gameplay metadata; texture delivery and the unused tangent payload differ.

| Property              |                                                  V2 public runtime |                                                  V3 source quality |                                                         V3 runtime |
| --------------------- | -----------------------------------------------------------------: | -----------------------------------------------------------------: | -----------------------------------------------------------------: |
| GLB bytes             |                                                          7,921,368 |                                                         42,929,408 |                                                         10,338,088 |
| SHA-256               | `05deefa049031550b3aa7897a6d7a3345718b2e10a7595a272ea513195bb9e3e` | `5daf655fd51f8c4ac93342c20024d3df803ecef0cbc6d2a4c48bcb85bedf25fe` | `e96bb26369cb037dffcfab3d0c71911dc7e872c2b8f766db8cb73599a6d51c62` |
| Marble root triangles |                                                              7,741 |                                                             40,032 |                                                             40,032 |
| Frost root triangles  |                                                              7,845 |                                                             35,032 |                                                             35,032 |
| Glide root triangles  |                                                              7,964 |                                                             35,032 |                                                             35,032 |
| Donor atlases         |                                                                 1K |                                            2K color / normal / ORM |                                          2K color; 1K normal / ORM |
| Donor landing         |                                                       Opaque cover |                                               UV/PBR donor surface |                                   Same geometry and UV/PBR surface |
| Exact collider        |                                              1.70m x 1.30m x 0.24m |                                                          Unchanged |                                                          Unchanged |
| Crackle triangles     |                                                2,472 / 2,616 / 308 |                                                          Unchanged |                                                          Unchanged |

The runtime derivative saves 32,591,320 bytes (75.918%) from the source-quality
file. The fixed-angle detail renders differ by 0.502 RGB levels per channel on
average (0–255 scale), with 2.183 RGB RMSE. The comparison is visually
indistinguishable at the authored review camera.

## Exact payload breakdown

| Payload                 | V3 source quality | V3 runtime |      Change |
| ----------------------- | ----------------: | ---------: | ----------: |
| Embedded images         |        34,024,062 |  4,299,334 | -29,724,728 |
| Geometry and attributes |         8,885,530 |  6,019,242 |  -2,866,288 |
| Container and JSON      |            19,816 |     19,512 |        -304 |
| Total                   |        42,929,408 | 10,338,088 | -32,591,320 |

Runtime base color stays at 2048 x 2048 and totals 3,188,718 bytes. The three
1024 x 1024 normal maps total 783,668 bytes; the three 1024 x 1024 packed
metallic-roughness maps total 326,948 bytes. The runtime export removes 2,638,064
logical bytes of tangent attributes. The app's current Three.js material path
derives the tangent frame for these normal maps: `three@0.185.1` implements
`getTangentFrame` from screen-space/UV derivatives whenever `USE_TANGENT` is
absent. No runtime decoder was added. Neither GLB uses Draco or Meshopt
compression.

Khronos validation reports no errors. The source-quality GLB has no warnings.
The runtime GLB has three expected portability warnings because each
normal-mapped donor omits an authored tangent stream; this is deliberate for
the current Three.js renderer and is recorded rather than hidden.

## Walkable contact

The build flattens only vertices belonging to the broad upward-facing donor
landing around y=0. UV coordinates and material assignments remain intact;
foliage, gold trim, understructure, and silhouette geometry are excluded. A
fresh import measures supported upward faces in the full, center, and edge
zones, with every included face corner within 1 cm of the exact collider top.

| Donor  | Flattened vertices | Supported area | Center height range | Edge height range | Max error |
| ------ | -----------------: | -------------: | ------------------: | ----------------: | --------: |
| Marble |              8,860 |       2.122 m² |    -4.665…+2.920 mm |  -9.887…+9.219 mm |  9.887 mm |
| Frost  |              1,163 |       2.179 m² |      0.000…0.000 mm |  -0.516…+8.736 mm |  8.736 mm |
| Glide  |              9,015 |       2.187 m² |    -4.577…+0.423 mm |  -5.026…+9.601 mm |  9.601 mm |

The source-quality and runtime fresh imports have the same per-root triangle
geometry hashes, visual bounds, contact measurements, collider JSON, landing
metadata, and closed/outward-wound crackle shard topology.

## Preserved lineage

| Donor  | Original triangles | V3 shell triangles | Retained | Source SHA-256                                                     |
| ------ | -----------------: | -----------------: | -------: | ------------------------------------------------------------------ |
| Marble |             90,378 |             40,000 |  44.259% | `b415c9287dff10444ebe7ba55935163fa7632ba60e8ad7babd30528565b6c3db` |
| Frost  |             79,445 |             35,000 |  44.056% | `a7a1ca61f5f927ce4d96a758947ce914cc5fe66e3c5efef6a6a05a86a95863b8` |
| Glide  |             83,606 |             35,000 |  41.863% | `87c555d358064841b09b38e8f671c18c37eb97ae2c2130f4cd0da50894a5acb9` |

The packed editable source is
`sources/cloudway-platform-kit-v3.blend` (66,795,847 bytes, SHA-256
`ec40b5f7ae6eaf17b4023eebb7cf3a8c3797d96c0f803aa583daed9e3e028412`).
All image data is packed; there are no missing external textures.

## Visual evidence and remaining issue

- `proofs/cloudway-platform-kit-v2-v3-comparison.png` shows the former flat V2
  covers beside the exposed V3 donor art.
- `proofs/cloudway-platform-kit-v3-source-runtime-comparison.png` compares the
  42.9 MB source ceiling and 10.3 MB runtime derivative at one camera.
- `proofs/cloudway-platform-kit-v3-contact-measurements.png` overlays the y=0
  datum view with measured center and edge ranges.
- `proofs/cloudway-platform-kit-v3.png` and
  `proofs/cloudway-platform-kit-v3-crackle.png` cover all six roots.

The diagonal dark line on Frost is already visible in the archived original
79k donor proof at `../v2/proofs/meshy-frost-donor.png`. It is a donor
texture/UV bake seam, not a winding break introduced by reduction, landing
flattening, or runtime texture compression. Source and runtime renders retain
the same line. It remains a focused donor-art cleanup item after this playable
incremental repair.

Machine-readable evidence is in
`proofs/cloudway-platform-kit-v3-validation.json`, `exports/manifest.json`, and
`production/cloudway-platform-kit-v3-build.json`.

## Rebuild

```sh
rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v3/production/build_platform_kit_v3.py
rtk bash art/glass-adventure/platform-trials/v3/production/optimize_platform_kit_v3.sh
rtk bash art/glass-adventure/platform-trials/v3/production/optimize_platform_kit_v3_runtime.sh
rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v3/production/validate_platform_kit_v3.py
rtk python3 art/glass-adventure/platform-trials/v3/production/build_comparison.py
```
