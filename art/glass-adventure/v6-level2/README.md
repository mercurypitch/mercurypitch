# Level 2 Twin Galleries art batch

This source-only batch establishes the warm lower gallery and cool upper gallery
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
| Twin-Tone Resonance Harp | Shared-court musical/architectural landmark | 1.500 × 0.686 × 1.650 |           9,837 | Reusable decoration; base-proxy review required         |
| Opaline Echo Amphora     | Optional paired-note side exhibit           | 0.619 × 0.568 × 0.920 |           8,168 | Breakable candidate; solid/fracture validation required |

Each packed `.blend` keeps the provider's four 2048 × 2048 texture images.
Each named `exports/*-game-v1.glb` uses 1024 × 1024 derivatives, a stable root,
bottom-centre metre-space normalization, and an authored review collision proxy.
The exported bytes were reimported and checked for stable roots, collider names,
dimensions, topology counts and material names. Exact hashes and measurements are
in `exports/*-inventory.json`; `exports/batch-inventory.json` is the index.

Meshy generated concept-coloured PBR surfaces. They are useful for silhouette,
ornament and palette review, but they are not the final renderer glass materials
and may appear opaque until integration supplies the intended glass/transmission
contract. The vessel donors are not fractured. Their open/duplicated boundaries,
cavity, wall thickness, matched intact-to-shard reconstruction, shard naming,
intersection/volume checks, mount fit and post-export validation all remain to be
completed before gameplay use. Additional LODs remain unauthored pending measured
screen-space need. The collision proxies are proposals for layout review, not
approved gameplay collision.

## Paintings

| Production title     | Gallery family            | Master                                  |
| -------------------- | ------------------------- | --------------------------------------- |
| The Low Note Keeper  | Warm lower gallery        | `paintings/low-note-keeper-master.png`  |
| The High Note Muse   | Cool upper gallery        | `paintings/high-note-muse-master.png`   |
| The Interval Between | Shared court / transition | `paintings/interval-between-master.png` |

All three paintings are original fictional subjects at 1024 × 1536, full bleed,
without frames, labels or typography. They are source masters for later framed
surface review; no runtime compression or assignment is included here.

## Provenance and reproduction

The built-in image-generation records, dimensions and source hashes are in
`imagegen-receipt.json`. Meshy requests are preserved as
`meshy/*-request.json`; `meshy/job-receipts.json` records the four task IDs,
donor hashes, 30 credits per job and the exact 120-credit batch total. No
credential or signed provider URL is stored.

The Meshy requests asked the provider to retain pre-remeshed variants, but this
batch archives only the returned remeshed GLB donors named in the receipt. It
does not claim that provider pre-remesh originals were downloaded or preserved.

`finalize_assets.py` imports each preserved donor, normalizes it, packs its
authoring textures, adds a named review proxy, writes the 1K GLB derivative,
then reimports that GLB for inventory validation. `build_contact_sheet.py`
rebuilds the layout-only concept review. Binary source files in this directory
use the same Git LFS attributes as V5.

This directory is deliberately disconnected from `apps/beside-cue/public`.
No Level 2 mechanics, scene placement, material integration, fracture system,
runtime manifest or global source archive was changed by this batch.
