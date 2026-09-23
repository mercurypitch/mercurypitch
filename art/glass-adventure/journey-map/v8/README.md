# Floating Museum conservatory V8 source gate

Status: the V8 conservatory geometry and PBR candidate are complete. The
Meshy-normal candidate is visually accepted for runtime assembly and pinned by
`proofs/conservatory-candidate-selection-v8.json`. The separate dense-donor
normal bake was produced and reviewed, but it is retained only as audit source
because it introduces visible projection artifacts. Combined runtime assembly
and public installation remain outside this source-and-candidate stage.

This folder isolates the conservatory repair from the approved V7 connector. The
intended sequence is one receipt-guarded provider remesh, same-camera CPU clay
review, one PBR retexture only after that review, exact Blender normalization,
fresh export/reimport validation, then a V8 combined derivative that preserves the
V7 connector byte-for-byte. Public installation and browser review are outside
this folder.

## Preserved source gate

The original V6 provider task is
`01a0c42e-51f6-77d1-85d5-1167fe7e5324`. Its archived
`pre_remeshed_glb` is preserved as
`meshy/raw/conservatory-pre-remesh-v6.glb`:

- 21,519,992 bytes
- SHA-256 `7f9eefd963e7fdb7b4d9863a4588ad293d3f8a17c27a68fd359306d647b5b6f4`
- 1,201,474 triangles and 591,793 vertices
- normalized review contract: 2.30 x 2.65 x 2.30 metres, ground anchor zero

The V8 copy is byte-identical to the V6 archive and to the hash in the V6 Meshy
receipt. The guide PNG and prompt Markdown in `sources/` are also byte-identical
copies of the V6 source records.

The CPU Cycles proofs show that the dense donor retains the gazebo ribs, roof
bays, garlands, planters, central urn, finial, open colonnade, and circular plinth.
The V6 22,870-triangle result retains only 1.9035% of the source triangles and
visibly collapses the roof relief, foliage, moldings, and column detail.

- `proofs/conservatory-preserved-pre-remesh-front-v8.png`
- `proofs/conservatory-preserved-pre-remesh-angle-v8.png`
- `proofs/conservatory-v6-remesh-front-v8.png`
- `proofs/conservatory-v6-remesh-angle-v8.png`
- `proofs/conservatory-source-audit-v8.json`

Rebuild the read-only source audit from the repository root:

```sh
rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v8/production/audit_conservatory_source.py
```

## Provider production

The receipt-guarded 110,000-triangle remesh completed as provider task
`01a0ceb5-4dd4-7530-a1d0-6e920c57b326` and consumed 5 credits. Its archived GLB
is `meshy/conservatory-remesh-110k.glb`, 8,188,772 bytes, SHA-256
`f936106d6eed572666b21b511efcbec35c342ae6be0c2402ea94aac6f133febf`,
with 109,636 triangles. The matching receipt is
`meshy/conservatory-remesh-110k-receipt.json`.

The 2K PBR retexture completed as provider task
`01a0cebe-365f-7743-8e07-98ea3f53c7b3` and consumed 10 credits. Its archived
GLB is `meshy/conservatory-remesh-110k-retexture-pbr.glb`, 20,430,664 bytes,
SHA-256 `e82ced33f896eb4468af828006eaed8231e7bb2a8a9eee19cc0b64013ef9e0f6`.
The matching receipt is
`meshy/conservatory-remesh-110k-retexture-pbr-receipt.json`. The PBR source
retains the remesh geometry exactly.

Both producer scripts reconcile provider tasks before submission, persist the
returned task ID before a post-submit balance check, never retry a submission,
and keep signed artifact URLs out of receipts and logs. Rebuild only when a new
provider task is deliberately required:

```sh
rtk proxy timeout 1200 python3 art/glass-adventure/journey-map/v8/production/run_conservatory_remesh.py
rtk proxy timeout 1200 python3 art/glass-adventure/journey-map/v8/production/run_conservatory_retexture.py
```

The remesh script uses the authenticated Meshy MCP launcher already present on the
machine. It obtains the original task's signed `pre_remeshed_glb` URL in memory,
requires the `assets.meshy.ai` host, and never reads, prints, changes, or stores a
credential or signed URL.

## Geometry review

The same-camera clay review compares the preserved donor, the reduced V6 result,
and the V8 remesh. The V8 candidate improves roof roundness, column fluting, and
leaf clumps while preserving the openings and platform profile. Its exact GLB
hash and proof hashes are accepted in
`proofs/conservatory-remesh-clay-review-v8.json`. Residual rough foliage comes
from the source and is not described as pristine.

Rebuild the clay gate with:

```sh
rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v8/production/render_conservatory_geometry_comparison.py
```

## Blender finish and normal selection

`production/finish_conservatory_candidate.py` normalized both low and dense
meshes to the 2.30 x 2.65 x 2.30 metre, ground-zero contract, then produced a
64-sample, eight-thread CPU selected-to-active tangent normal and AO bake. The
bounding-box normalization is not treated as proof of surface registration.
`proofs/conservatory-pbr-bake-projection-v8.json` records the independent
surface audit: nearest dense-surface p50 0.93 mm, p95 3.90 mm, p99 5.59 mm, and
an approximate cage-ray miss fraction of 0.583%.

The packed editable source is
`sources/floating-museum-conservatory-candidate-v8.blend`, SHA-256
`bd47184b3c0174e01d721e573d1ec533f4585013e218bda2e03508c821991d6a`.
It retains the dense donor and packs the 2K provider maps, dense normal, dense AO,
derived ORM, and transmission mask.

Both review GLBs contain 109,636 triangles, UV0, normals, tangents, 2K base color,
normal and ORM bindings, occlusion, transmission, and the exact normalized bounds:

- accepted: `exports/floating-museum-conservatory-candidate-v8-meshy-normal.glb`,
  SHA-256 `4295d8a324f86048f9832306b3a1c74e15d601a0ea07dfa1ee33f593b223f697`
- audit only: `exports/floating-museum-conservatory-candidate-v8-dense-bake-normal.glb`,
  SHA-256 `8b3465883aea800de84c3d9237d2752af405e049d64a3bece4052f283772530f`

Blender's first glTF export emitted zero tangent XYZ at referenced vertices
36,434, 143,188, and 150,705. The finisher now repairs only such rows after
export using the incident triangle's UV derivative, Gram-Schmidt projection
against the preserved split normal, and derivative-verified handedness. The
three repaired W values are -1, +1, and -1. POSITION, NORMAL, TEXCOORD_0,
indices, embedded images, topology, and the packed source compare exactly with
the reviewed pre-repair candidate. Every exported tangent is finite and unit
length within glTF float quantization.

The dense bake is real and nonblank, but same-camera front, angle, and close
renders show dark halos along the lower roof-panel arcs and harsher patches on
ribs and columns. The Meshy normal retains coherent relief and was selected for
runtime assembly. The dense bake and comparison remain archived evidence rather
than being blended into the accepted map. Known source limitations remain fused
or crumpled foliage and visible variation in the translucent roof surface.

Rebuild and review with:

```sh
rtk proxy timeout 3600 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v8/production/finish_conservatory_candidate.py
rtk proxy timeout 300 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v8/production/repair_conservatory_candidate_tangents.py
rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v8/production/render_conservatory_normal_comparison.py
```

The generated candidate manifest is
`exports/floating-museum-conservatory-candidate-v8.json`; the later visual
decision is authoritative in
`proofs/conservatory-candidate-selection-v8.json`. Binary assets in this folder
are covered by the local `.gitattributes` Git LFS rules.

## Remaining scope

The accepted candidate is ready for the V8 architecture-kit assembler. That step
must preserve the approved V7 connector payload, material, images, node transform,
and accessor data while replacing only `map_conservatory`. Public installation,
catalog updates, and browser proof remain separate integration work.

The checked-in normal-transform fixture passes in Blender 5.2.2 for flat and
custom slanted normals under rotated, nonuniform scale. It compares with
Blender's encoded representation of the independently calculated inverse
transpose; stored-normal quantization is about 0.00011 in this fixture. A
singular transform must fail before changing vertices. Run locally with:

```sh
rtk proxy timeout 90 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v8/production/check_conservatory_normals.py
```
