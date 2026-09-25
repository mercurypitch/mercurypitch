# Crackle donor feasibility

Rose Quartz now has a source-preserving semantic candidate and an independent
fresh-open audit. It is suitable for visual review, but it is not approved for
runtime binding. Amethyst remains an audit-only donor; no derivative was made.

## Evidence rules

Both provider assets arrive as one mesh, one primitive, and one opaque material.
Their apparent loose components are UV and normal chart splits. Exact-position
welding reconnects each donor into one closed, oriented surface, so disconnected
index groups are not mechanical or material parts.

The Rose mask combines a warm-gold base-color test with metallic support. It does
not classify from metallic pixels alone. Complete corner assemblies use a separate
geometry-space override so ivory inlay and dark recesses retain the provider PBR.
The candidate contains no `platform_adapter_json` or other runtime binding.

## Rose Quartz Crackle Fast

The donor has 277,628 vertices and 518,742 triangles. An exact float32 seam weld
produces 259,335 unique vertices and 778,113 edges; every edge has two incident
faces and consistent orientation. No triangle collapses, no source face is cut,
no cap is added to the dense surface, and no decimation occurs.

The top is a defensible flat contact candidate. A 31 by 31 ray grid hit the source
at all 961 samples; 99.5838% of hits are within 2 mm of the authored landing plane
and all are within 5 mm. The candidate therefore includes a new, explicit 1.64 m
square contact plane at Blender Z=0 rather than using the visual mesh as collision.

The candidate roles are:

| Role                 | Object                                | Origin                                             | Rest state                                                                                                       |
| -------------------- | ------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Closed crystal body  | `RoseCrystalBody`                     | Exact-weld dense donor surface                     | Visible with true transmission and a pale-rose lift; opaque provider roughness is excluded from the glass branch |
| Persistent framework | `RoseGoldFramework`                   | Same dense surface with the reviewed semantic mask | Hidden because the rest composite binds glass and framework on one surface; shown after fracture                 |
| Contact              | `RoseContactPlane`                    | New authored quad                                  | Hidden review/gameplay contract geometry                                                                         |
| Shard candidate      | `RoseShardCandidate` with 12 children | New closed Voronoi prisms                          | Hidden review geometry; not an accepted fracture kit                                                             |

The rest composite avoids two coincident visible meshes, which removed the black
depth seams seen in an earlier proof. The provider base color is retained for both
regions, with a documented pale-rose screen lift on crystal. Provider metallic and
roughness maps remain on the opaque framework; the provider roughness map is not
silently applied to transmissive glass. The separate framework object is available
only for the fracture-state concept.

The 512-sample pastel-sky beauty views use the same 48-degree game camera and close
camera as the provider comparisons. They use no spatial blur, so lattice and corner
edges remain inspectable. The checker views remain separate evidence that the body
transmits a background.

- [Reference, provider, beauty, and clay comparison](../source-assets/proofs/blender/rose-quartz-crackle-fast/semantic-candidate/rose-semantic-game-comparison.png)
- [Beauty, transmission, mask, and shard comparison](../source-assets/proofs/blender/rose-quartz-crackle-fast/semantic-candidate/rose-semantic-detail-comparison.png)
- [Fresh-open audit](reports/rose-quartz-crackle-fast-semantic-candidate-audit.json)
- [Candidate build report](reports/rose-quartz-crackle-fast-semantic-candidate.json)

The lattice and complete corner assemblies survive, and the beauty view is cleaner
and more luminous than the checker witness. It still does not match the exact
reference's crystalline sparkle and internal faceting. The top gold lines also read
broader and paler than the reference. Two small pale tabs behind the nearest corner
are fused donor transition faces: widening the geometry-space corner region made a
large jagged crystal wedge opaque, so that attempted mask expansion was rejected.
Those tabs remain a visible acceptance issue instead of being hidden by a false
semantic claim. The authored shards are closed and correctly bounded, but their
simple prism silhouettes are only a fracture-shape study.

**Decision:** the Rose split is technically defensible as a semantic and contact
prototype. It is not a finished beauty asset and must not be exported or registered
until visual review accepts a deliberate boundary treatment and shard language.

## Amethyst Crackle Slow

The donor has 787,132 vertices and 1,433,588 triangles. Exact-position welding
produces 716,088 vertices and 2,150,382 consistently oriented two-face edges in one
closed component. Its visibly raised gold lattice is still fused into that component
and shares the donor's single opaque PBR slot, so Rose's mask cannot be copied over.

The contact evidence is weaker than Rose. The 31 by 31 ray grid has full coverage,
but only 90.1145% of top hits are within 2 mm of the review plane, with a local dip
of 12.4886 mm. A future contact plane needs an asset-specific footprint and a visual
review of that depression.

**Decision:** Amethyst remains read-only evidence. It needs its own deliberate
crystal/lattice boundary study, closed shard design, and contact review before any
semantic derivative is justified.

## Acceptance boundary

The next Rose gate is visual acceptance of the retained framework boundary, the
remaining corner tabs, and the shard silhouettes. Only after that gate should an
export recipe add exact runtime role names and versioned adapter metadata. Amethyst
must repeat the semantic study independently; the Rose thresholds are not reusable
evidence.
