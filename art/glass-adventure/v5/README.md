# V5 museum dressings

V5 adds a reusable crystal planter, one reusable gallery frame, three original
paintings, and procedural floor inlays to the authored museum rooms. The app
loads one combined decoration bundle plus three painting textures; individual
GLBs remain here as reviewable source derivatives.

## Provider receipts

The two Meshy 6 jobs are recorded without credentials or raw provider payloads:

| Asset           | Task ID                                | Receipt outcome | Credits |
| --------------- | -------------------------------------- | --------------- | ------: |
| Crystal planter | `01a0bfa4-acf2-744d-934a-9297eca5d7b1` | `SUCCEEDED`     |      30 |
| Gallery frame   | `01a0bfaa-d31b-71ff-ab0b-c1c747d5b8e7` | `SUCCEEDED`     |      30 |

The exact evidence is in `meshy/planter-receipt.json` and
`meshy/frame-receipt.json`: 60 credits total. The adjacent request JSON and
concept prompt files preserve the inputs used for each job.

## Geometry and material contracts

`sources/crystal-planter-final-v1.blend` preserves the 9,236-triangle donor,
packed 2048 x 2048 textures, UVs, and topology. Its stable root is
`decor_crystal_planter`; the source material is
`meshy_crystal_planter_atlas`. The receipt records a 0.97395 x 0.91236 x 1.4 m
final bound and a bottom-centre origin. Only the marble-and-brass bowl receives
a gameplay collision proxy; foliage and crystal fronds remain nonblocking.

`sources/gallery-frame-final-v1.blend` preserves the 6,965-triangle donor and
its packed 2048 x 2048 textures. Its stable root is
`decor_gallery_frame`, with a centred origin and +Z front. The receipt records
a 1.116525 x 0.076780 x 1.8 m bound. The original ornament remains on the
unique `meshy_gallery_frame_atlas` material so the jade cabochons are retained.
Exactly 55 inspected inset faces use `decor_surface`, with centred 2:3 crop UVs.
The inset is separated and flattened into an optical plane; the donor ornament
vertices, faces and UVs remain untouched. A measured inset offset keeps it
in front of a shallow overlapping donor cap while recessed inside the rim.
The runtime replaces that surface
with a painting texture or the shared probe-lit mirror material.

`sources/museum-decor-v5.blend` combines those two normalized sources without
flattening their material contracts. The exported `museum-decor.glb` contains
16,201 triangles and eight packed 1024 x 1024 runtime maps. Its receipt and
fresh reimport inventory are `exports/bundle-receipt.json` and
`exports/runtime-reimport.json`.

The Blender sources retain their 2K packed maps. The individual and combined
runtime GLBs use 1K maps. The Blender-generated
`sources/gallery-frame-final-v1.blend1` backup is intentionally not retained;
the final `.blend`, donor GLB, export, and receipts are the durable artifacts.

## Paintings

The full-bleed masters are 1024 x 1536 PNGs with their exact prompts beside
them. Runtime copies are 768 x 1152 WebP files and are assigned only to the
frame's `decor_surface` material.

| Runtime asset ID       | Runtime file             | Source master                   |
| ---------------------- | ------------------------ | ------------------------------- |
| `painting-garden-v5`   | `painting-garden.webp`   | `paintings/garden-master.png`   |
| `painting-archive-v5`  | `painting-archive.webp`  | `paintings/archive-master.png`  |
| `painting-portrait-v5` | `painting-portrait.webp` | `paintings/portrait-master.png` |

The runtime files and exact hashes are recorded in
`apps/beside-cue/public/games/adventure-v5/manifest.json`.

## Floor art

Floor inlays are generated presentation geometry rather than another binary
model. `FLOOR-ART.md` documents the reusable recipes and palettes. The current
renderer filters only actual source triangles inside each bounded centre motif;
it leaves the platform border, cornice, underside, and platforms without an
authored floor recipe intact.

## Source inventory

`../source-archive.json` records every frozen V5 PNG, GLB, and Blender source by
byte count and SHA-256. Playable copies under the app's `public` directory are
ordinary runtime files and are instead covered by the runtime manifest.

The frozen PNGs under `proofs/` are also inventoried in the source archive.
The adjacent manifests distinguish Blender inspection, actual scene captures,
shadow A/B evidence and controlled room-visibility comparisons. These captures
do not constitute physical-device performance or full gameplay acceptance.
