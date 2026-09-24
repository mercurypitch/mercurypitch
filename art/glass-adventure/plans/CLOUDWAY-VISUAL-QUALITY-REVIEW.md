# Glassworks art-quality audit — 2026-09-22

## Conclusion

This is not a missing-file, loader, texture-download, or dotfiles-cleanup regression. The poor foliage, warped balusters, and flat Cloudway slabs are present in the frozen asset proofs themselves. At the start of the investigation the working tree was clean at `816bcd029e48b2aa147b751ce135283e81e9c86f`; both public GLBs are regular files, match their archived exports byte-for-byte, and match the Git LFS object IDs committed with the assets. Neither public GLB has been modified since its initial asset commit.

| Runtime asset          |     Bytes | Current/export/Git LFS SHA-256                                     | Introduced | Later asset changes |
| ---------------------- | --------: | ------------------------------------------------------------------ | ---------- | ------------------- |
| Floating Museum V6 kit | 5,628,320 | `32143c948457c0c8acef7c9b6a9f977874e131c59dd3b19bcc7d6f71ff23e5be` | `4d3795f7` | none                |
| Cloudway V1 kit        | 7,921,368 | `05deefa049031550b3aa7897a6d7a3345718b2e10a7595a272ea513195bb9e3e` | `6fe969de` | none                |

The supplied screenshot matches the archived `journey-map/v6/proofs/runtime/twin-close.png` capture: the same chunky vine silhouette, fused hanging foliage, and uneven railing are already visible there.

## Floating Museum V6: geometry loss is the primary cause

The clean 978×1608 connector guide shows individual leaves, flowers, straight balusters, and crisp moldings. Meshy was asked to return an approximately 18k-triangle textured connector and a 24k-triangle conservatory. Those requested counts, rather than a later Blender optimization, are where most shape detail disappeared.

| Asset          |              Preserved pre-remesh | Textured Meshy final used by Blender |      Geometry retained | Runtime textures                             |
| -------------- | --------------------------------: | -----------------------------------: | ---------------------: | -------------------------------------------- |
| Twin connector | 1,137,356 tris / 567,712 vertices |                          18,259 tris | 1.61% (98.39% removed) | 1024² base, 512² normal + ORM                |
| Conservatory   | 1,201,474 tris / 591,793 vertices |                          22,870 tris | 1.90% (98.10% removed) | 1024² base, 512² normal + ORM + transmission |

The preserved pre-remesh GLBs contain position geometry only: no UVs, normals, materials, or textures. They are useful as high-resolution remesh/retopology inputs, but cannot safely replace the runtime GLB directly. The textured Meshy finals had 2048² source atlases. Blender welded duplicate vertices, normalized the models, and widened the connector aperture, but its recorded LOD `collapseRatio` is `1.0` for both assets; it did not reduce the triangle counts further. JPEG/texture reduction softens close zoom, but cannot explain the broken silhouette. The isolated Blender proof already shows the same melted leaves and bent rails, proving the defect predates Three.js and runtime loading.

Recommended museum repair: request a fresh high-quality textured remesh from each preserved pre-remesh source at a materially higher budget, then finish in Blender. Start around 80k–120k triangles per landmark and inspect before choosing the final count. Do not regenerate the whole level or ship the 1.1M raw mesh. If the higher remesh still fuses vegetation, keep the Meshy architecture as the authored base and replace only vines, leaf clusters, and flowers with clean Blender-finalized modular plant geometry; do not preserve dense melted foliage merely because it has more polygons. Rebuild/straighten the balustrade and primary ribs if the remesh cannot recover them. Validate at the player's closest allowed zoom, not only an overview.

## Cloudway: an explicit 7k remesh plus an opaque top cover caused the downgrade

The original textured platform donors are substantially richer than the runtime shells:

| Platform | Original textured donor | 7k runtime remesh | Final root (shell + authored pieces) | Donor triangles removed |
| -------- | ----------------------: | ----------------: | -----------------------------------: | ----------------------: |
| Marble   |                  90,378 |             6,969 |                                7,741 |                  92.29% |
| Frost    |                  79,445 |             7,149 |                                7,845 |                  91.00% |
| Glide    |                  83,606 |             7,068 |                                7,964 |                  91.55% |

Each remesh was explicitly submitted with `target_polycount: 7000`. Its three 4096² PBR maps were reduced to 1024², then encoded as near-lossless WebP quality 88. The final optimizer only deduplicates, prunes, welds, regenerates tangents, and compresses textures; it does not simplify geometry.

The larger visual loss is the landing surface. The Blender build moves the textured donor landing down by 18 mm, then places an opaque exact-size grid skin at the collider datum using constant ivory/frost/celadon materials and simple line inlays. That cover hides the donor's marble, water/ice, and gold surface pattern. The runtime screenshots therefore show flat teal/white slabs even where the preserved donor proof has detailed stone, water, and ornament. The marble donor's attached foliage is also reduced to a jagged strip by the 7k remesh. This is deterministic authored output, not texture corruption.

The concept image also contains complete scenic islands, pedestals, planters, cypresses, flowers, bridges, and distant museum structures. The current level contains a narrow sequence of repeated platform roots with no equivalent environment kit. Raising texture resolution alone cannot close that composition gap.

Recommended Cloudway repair: build a review-only V3 kit from the preserved 79k–90k textured donors, decimating selectively to roughly 25k–40k triangles per unique shell, retaining 2k PBR maps for close zoom, and keeping the existing exact collider/landing metadata and all six stable root names. Keep the textured donor top at the collider datum and use only a clean border/inlay overlay so its marble/celadon/gold detail remains visible. Preserve the current crackle behavior. Remove or replace any fused donor foliage with clean Blender-finalized modular foliage rather than carrying a dense melted plant mesh. Do not replace the public V1 asset until side-by-side beauty proofs and technical validation pass.

## Acceptance order for the current first trial

1. Freeze new-level work. Treat the generated concept and closest gameplay camera as the visual bar for this level.
2. Replace Cloudway V1 with a review-only V3 candidate from the existing high-resolution donors; compare donor, V1, and V3 at identical lighting/camera.
3. Rebuild Museum V6 from higher-quality textured remeshes and perform focused Blender cleanup on foliage, rails, and ribs.
4. Add reusable clean vegetation and scenic set dressing to the existing Cloudway route: start/finale island edges, planters, cypresses, flowers, pedestals, and distant silhouettes. These are art additions to the current level, not a new level.
5. Gate each asset on close-up beauty frames, silhouette quality, material response, exact runtime hash/load, and a measured device budget. Structural manifests alone are insufficient; the existing manifests passed while the visible result was poor.

No repository files were changed during this diagnosis.
