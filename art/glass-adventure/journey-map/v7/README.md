# Floating Museum twin connector V7

Status: approved incremental runtime replacement, integrated through the
versioned public asset path and browser-reviewed in the Twin Galleries map.
The final public GLB is
`apps/beside-cue/public/games/journey-map-v7/floating-museum-architecture-kit-v7.glb`.

This candidate tests the narrow repair recommended by the museum quality audit:
remesh the preserved 1,137,356-triangle Meshy source at approximately 100k,
retexture that result with Meshy 6 PBR, and normalize it in Blender without a
second geometry reduction. It is one connector candidate, not a new museum kit.

## Result

The provider remesh recovered the architectural silhouette materially better than
the V6 18k final. The balcony rail and balusters are straighter, the pergola ribs
are smoother, and hanging strands retain more separation. A deterministic sampled
surface comparison against the archived source reduced the source-to-candidate
normalized p95 distance from `0.005781` for V6 to `0.002104` for V7.

The provider source itself still contains dense, partly fused botanical clumps.
The 100k remesh and green PBR texture make them more legible, but the closest proof
still shows faceted leaf clusters rather than individually authored leaves. The
candidate is therefore a good architecture base and a clear improvement, but it
should not be called pristine. It has been approved as an incremental runtime
replacement candidate while a later modular foliage pass remains recommended.

If the closest gameplay camera requires cleaner foliage, keep this architecture,
remove only the fused canopy and draped clumps in the packed Blender source, and
replace them with a small reusable set of clean leaf, tendril, and flower modules.
Do not regenerate the connector or simplify its restored railings and ribs. After
that focused pass, audition a runtime texture/mesh budget and rebuild the combined
kit with the existing conservatory and stable node names.

## Review evidence

- `proofs/twin-connector-geometry-front-v7.png`: archived 1.137M source, V6 18k
  final shown as clay, and V7 102.6k remesh at the same scale.
- `proofs/twin-connector-textured-comparison-front-v7.png`: V6 and V7 provider
  textures under the same light and camera.
- `proofs/twin-connector-textured-comparison-close-v7.png`: closest direct
  before/after foliage and railing comparison.
- `proofs/floating-museum-twin-connector-front-v7.png`, `-angle-v7.png`, and
  `-close-v7.png`: isolated proofs rendered from the fresh V7 export.
- `proofs/floating-museum-architecture-kit-v7-live-map-close.png`: actual Twin
  Galleries map at maximum inspection zoom, captured from the staged QA asset on
  hardware AMD Vulkan. Its adjacent JSON records the exact served asset response.

All proofs were rendered with Cycles on CPU so they did not compete with the
project's GPU review work.

## Measured comparison

| Property                       |    V6 provider final |     V7 review export |              Delta |
| ------------------------------ | -------------------: | -------------------: | -----------------: |
| Triangles                      |               18,259 |              102,607 |     +84,348; 5.62x |
| GLB bytes                      |           17,720,364 |           18,750,424 | +1,030,060; +5.81% |
| Provider texture maps          |     four 2048px maps |     four 2048px maps |          preserved |
| Normalized dimensions          | 1.70 × 2.80 × 0.80 m | 1.70 × 2.80 × 0.80 m |          unchanged |
| Minimum sampled arch clearance |      at least 0.80 m |              0.816 m |             passed |

The public V6 file is a separately optimized 5,628,320-byte combined connector
and conservatory kit with smaller runtime maps, so it is not an apples-to-apples
file-size comparison. Runtime packing was performed only after visual approval.

## Runtime kit

`exports/floating-museum-architecture-kit-v7.glb` is the versioned combined
candidate. It is 12,263,920 bytes with SHA-256
`b427dd61cd5da0c68cd9831d2524e6d7452888d21bcb3219c0671182b1002cd4`.
It contains 102,607 connector triangles and the unchanged 22,870-triangle V6
conservatory, for 125,477 triangles total. The stable root and child nodes remain
`map_museum_polish_kit_root`, `map_twin_connector`, and `map_conservatory`.

The V6 conservatory is copied instead of re-exported. Its four geometry accessors,
mesh JSON, material JSON, texture/image JSON, eight buffer-view records, and the
first 2,955,557 binary bytes are exact. The copied binary prefix has SHA-256
`791b71a05034b0fbfbcd2d6a59f53bf7a4869983971a6f945d2d872ec824ed28`
in both V6 and V7. Its dimensions remain 2.30000019 x 2.65000010 x
2.30000019 metres and its ground anchor remains zero.

The connector keeps all 102,607 triangles and its 1.70 x 2.80 x 0.80 metre
contract. Its 2K base color is WebP quality 92 at 1,726,448 bytes; its 1K normal
and ORM WebPs are 293,578 and 237,338 bytes. No Draco or Meshopt extension is
present. `EXT_texture_webp` is the only required extension added by V7.

The CPU close-camera proof in
`proofs/twin-connector-runtime-texture-comparison-v7.png` compares the four-map
2K review source with the runtime derivative. The foreground mean absolute channel
difference is 3.04/255 and rendered PSNR is 33.76 dB. Direct inspection shows no
meaningful loss in the approved rail, rib, molding, or foliage silhouette detail.
The discarded provider emissive map was effectively black (mean 0.038/255; 99th
percentile 1/255), so removing it does not remove visible illumination.

`sources/floating-museum-architecture-kit-v7.blend` is the packed editable
runtime source. It is 11,018,215 bytes with SHA-256
`68a79742b12a211ddf8a61574c5199bf6d2760352851852fbb6a7ba777f5c074`.
Fresh Blender reimport validates exact triangle counts, UV0, node hierarchy,
dimensions, ground anchors, and a 0.816 metre minimum sampled connector opening.
glTF Transform validation reports zero errors; its two warnings state that both
normal-mapped meshes rely on runtime-generated tangent space, the same supported
Three.js path used by the existing kit.

The staged QA map loaded the GLB as `model/gltf-binary` with HTTP 200 and the
same 12,263,920-byte `b427dd61...` payload. The maximum-zoom Twin Galleries
capture used hardware ANGLE/Vulkan on an AMD Radeon RX 9070 XT, rendered 867,371
triangles across all map passes, and reported no browser errors.

## Meshy provenance and credits

The exact archived V6 `pre_remeshed_glb` was used as the remesh input. Signed
artifact URLs remained in memory and are absent from every receipt.

| Stage                 | Task                                   | Credits |      Balance |
| --------------------- | -------------------------------------- | ------: | -----------: |
| 100k triangle remesh  | `01a0c93d-d575-745f-9f91-c7206c4bab5d` |       5 | 3895 to 3890 |
| Meshy 6 PBR retexture | `01a0c946-928b-70b7-b8e0-7019de0d936e` |      10 | 3890 to 3880 |
| Total                 | one connector candidate                |      15 | 3895 to 3880 |

The native retexture download exceeded the MCP request deadline after 8,991,879
bytes. That incomplete file was hashed in the receipt and discarded after the
complete 18,749,744-byte provider GLB was recovered through bounded CDN ranges and
validated against its GLB header. No charged submission was retried.

## Preserved artifacts

- `sources/twin-connector-guide-opaque.png` and both prompt records preserve the
  inspected guide.
- `meshy/raw/twin-connector-pre-remesh-v6.glb` preserves the immutable 1.137M
  source used for the provider remesh.
- `meshy/twin-connector-remesh-100k.glb` is the untextured provider remesh.
- `meshy/twin-connector-remesh-100k-retexture-pbr.glb` is the raw provider PBR
  result.
- `sources/floating-museum-twin-connector-candidate-v7.blend` is the packed,
  normalized editable source with all four 2K maps.
- `exports/floating-museum-twin-connector-candidate-v7.glb` is the fresh
  review export with stable `map_museum_polish_kit_root` and
  `map_twin_connector` nodes.
- `exports/floating-museum-twin-connector-candidate-v7.json` records hashes,
  topology, dimensions, UV/material checks, aperture measurements, and proofs.
- `sources/floating-museum-architecture-kit-v7.blend` and
  `exports/floating-museum-architecture-kit-v7.glb` are the packed runtime source
  and review-only combined derivative.
- `exports/floating-museum-architecture-kit-v7.json` records byte-level V6
  conservatory preservation, runtime texture metrics, fresh reimport results, and
  the runtime proof receipt.
- `proofs/floating-museum-architecture-kit-v7-live-map-close.json` records the
  real map camera, renderer, metrics, screenshot hash, and served GLB hash.
- `.gitattributes` scopes Git LFS to every binary format stored by V7.

## Rebuild and validation

Run from the repository root:

```sh
rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v7/production/audit_connector_candidates.py
rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v7/production/build_connector_candidate.py
rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v7/production/render_connector_candidate.py
rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v7/production/build_architecture_kit_runtime.py
rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v7/production/render_runtime_texture_comparison.py
rtk apps/beside-cue/node_modules/.bin/gltf-transform validate art/glass-adventure/journey-map/v7/exports/floating-museum-architecture-kit-v7.glb
```

`run_connector_remesh.py` and `run_connector_retexture.py` are preserved for
provider reconciliation and provenance. Their receipts prevent accidental charged
resubmission when rerun.
