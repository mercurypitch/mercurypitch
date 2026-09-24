# Level 2 Twin Galleries art batch

This production-source batch establishes the warm lower gallery and cool upper gallery
families for Level 2. It contains four isolated Meshy-ready concept masters,
four untouched remeshed-output Meshy 6 donor GLBs, four normalized packed
Blender sources and 1K-texture GLB derivatives, plus three original full-bleed
2:3 gallery paintings.

The compact visual review is
[`proofs/review-contact-sheet.png`](proofs/review-contact-sheet.png). The sheet
only lays out scaled copies for comparison; the untouched generated PNG masters
remain in `concepts/` and `paintings/` with their exact prompts beside them.

## Three-dimensional assets

| Asset                    | Intended role                               | Normalized bounds (m) | Donor triangles | Current status                                          |
| ------------------------ | ------------------------------------------- | --------------------: | --------------: | ------------------------------------------------------- |
| Amber Cadence Urn        | Lower-gallery low-note hero vessel          | 0.932 × 0.932 × 0.720 |           9,340 | Breakable candidate; solid/fracture validation required |
| Celadon Lark Decanter    | Upper-gallery high-note hero vessel         | 0.381 × 0.383 × 1.150 |           9,186 | Breakable candidate; solid/fracture validation required |
| Twin-Tone Resonance Harp | Shared-court musical/architectural landmark | 1.500 × 0.686 × 1.650 |           9,837 | Integrated; measured base proxy and scene proof         |
| Opaline Echo Amphora     | Optional paired-note side exhibit           | 0.619 × 0.568 × 0.920 |           8,168 | V2 integrated; cavity, 18 shards and scene proof        |

Each packed `.blend` keeps the provider's four 2048 × 2048 texture images.
Each named `exports/*-game-v1.glb` uses 1024 × 1024 derivatives, a stable root,
bottom-centre metre-space normalization, and an authored review collision proxy.
The exported bytes were reimported and checked for stable roots, collider names,
dimensions, topology counts and material names. Exact hashes and measurements are
in `exports/*-inventory.json`; `exports/batch-inventory.json` is the index.

Meshy generated concept-coloured PBR surfaces. They are useful for silhouette,
ornament and palette review, but they are not the final renderer glass materials
and may appear opaque until integration supplies the intended glass/transmission
contract. The original vessel donors are not fractured. Each production derivative must
pass cavity, wall thickness, intact-to-shard reconstruction, naming, intersection,
volume and post-export checks before gameplay use. Opaline V2 has passed those
gates; Amber and Celadon remain candidates. Additional LODs remain unauthored
pending measured screen-space need. The V1 review proxies do not automatically
become gameplay collision.

## Paintings

| Production title     | Gallery family            | Master                                  |
| -------------------- | ------------------------- | --------------------------------------- |
| The Low Note Keeper  | Warm lower gallery        | `paintings/low-note-keeper-master.png`  |
| The High Note Muse   | Cool upper gallery        | `paintings/high-note-muse-master.png`   |
| The Interval Between | Shared court / transition | `paintings/interval-between-master.png` |

All three paintings are original fictional subjects at 1024 × 1536, full bleed,
without frames, labels or typography. The masters remain unchanged. `export_paintings.py` now writes full-resolution
quality-88 WebP derivatives and a hashed manifest to
`apps/beside-cue/public/games/adventure-v6`. Twin Galleries uses the paintings in
the accepted V5 frame/inset, and the shared gallery chooser uses the interval
painting. This integration does not change the 3D candidates’ status.

## Provenance and reproduction

The built-in image-generation records, dimensions and source hashes are in
`imagegen-receipt.json`. Meshy requests are preserved as
`meshy/*-request.json`; `meshy/job-receipts.json` records the four task IDs,
donor hashes, 30 credits per job and the exact 120-credit batch total. No
credential or signed provider URL is stored.

The original Meshy requests asked the provider to retain pre-remeshed variants,
but that first batch archived only the returned remeshed GLB donors named in
`meshy/job-receipts.json`.

The subsequent production audit recovered the Celadon decanter's original
pre-remesh GLB without another generation charge. A separate 50,000-triangle
Meshy remesh cost five credits and is retained for structural comparison.
`meshy/celadon-source-recovery.json` and
`meshy/celadon-remesh-50k-receipt.json` record those additions separately from
the original 120-credit batch. Neither recovery nor remeshing alone approves
the decanter for gameplay; the original donors remain unchanged.

`finalize_assets.py` imports each preserved donor, normalizes it, packs its
authoring textures, adds a named review proxy, writes the 1K GLB derivative,
then reimports that GLB for inventory validation. `build_contact_sheet.py`
rebuilds the layout-only concept review. Binary source files in this directory
use the same Git LFS attributes as V5.

`finalize_harp.py` now delivers the production V2 harp alongside the paintings.
The original V1 source/export/proof hashes remain unchanged. The packed V2 source
keeps the 2K atlases and review proxy; its 2.81 MB runtime derivative has 1K maps,
9,837 triangles and no collider mesh. The runtime recipe places it against the
listening court's east wall, with a measured 1.30 × 0.70 × 0.24 m base solid and
clearance from the central route and optional exhibit. `proofs/harp-court-final/`
records actual scene pixels and load checks; it is not device FPS evidence.

Vessel production remains separate from static decoration acceptance. Opaline V2
has an open cavity and matched 18-piece fracture with a fresh GLB geometry gate.
Its continuous opal shell, gold trim and jade handles passed visual review;
texture-space transmission avoids V1's triangle-shaped opacity patches. V1 stays
preserved as rejected material evidence. The V2 packed sources, fracture inputs,
export/validation receipts and intact/mouth/exploded proofs are saved alongside
the untouched original donor. It now replaces the optional court exhibit, with
actual intact/shattering scene proofs in `proofs/opaline-runtime-v2/`. Amber remains a candidate.
The extra Celadon 50k remesh closely matches the original silhouette but fails
closed topology: 68 boundary edges, 116 non-manifold edges and 62 non-adjacent
self-intersection pairs. A bounded repair worsened its topology and was rejected.
`production/celadon-*` receipts preserve that evidence. Start a future repair from
the recovered closed high-resolution source, then derive an LOD after validation.
Twin Galleries retains approved existing recipes for Amber and Celadon until
each replacement passes geometry, material and actual runtime inspection.
See `../plans/TWIN-GALLERIES-IMPLEMENTATION.md` for the current runtime scope.
