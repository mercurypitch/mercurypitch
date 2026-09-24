# Current game asset audit

This audit covers the **25 GLBs selected by the shared runtime asset contract**,
not every historical source in the art archive. Final hashes, structural results,
mesh/image inventories and geometry screens are in [`final/`](final/).
The reports outside that folder preserve the initial findings before repairs.

## Result and repairs

- All 25 current runtime exports pass Khronos validation with **zero errors**.
  Warnings and informational messages remain visible in each report rather than
  being hidden behind a pass label.
- Seven older vessel exports had invalid tangent streams on primitives whose
  materials never use normal maps. The repair removes only those unused streams;
  protected geometry, index, normal, UV and color bytes match the source. The
  ramp's invalid texture-coordinate reference is repaired with authored UV0.
  See [`attribute-repair-v1`](../../attribute-repair-v1/README.md).
- Celadon receives the same material-aware treatment after fracture export.
  Its normal-mapped exterior retains tangents; unused cavity/cut/gold tangents
  are removed. The accepted hollow foot and 18 closed shards remain unchanged.
  See [the Celadon production record](../../v6-level2/celadon-production-v4/README.md).
- The new Camellia source uses a controlled dense-to-remesh bake. Only 126 zero
  tangents at UV-degenerate corners receive a finite orthogonal fallback. Other
  geometry, normals, UVs and tangents are preserved. Quantization stays below an
  unscaled semantic placement root. See [V10 production](../../journey-map/v10/README.md).
- The face/normal screen finds no non-finite vertex or normal values. One inherited
  cliff has opposed face/average-vertex-normal directions on 134 of 7,975 faces,
  covering 0.33% of its surface. This is a local shading-review signal, not proof
  of an inverted whole object. See the [museum inspection](museum-architecture-audit.md)
  for the visual decision; no blanket normal reset or silhouette decimation was
  applied to existing museum architecture.

These repairs address exported attributes. They do not establish a cause for the
owner's earlier intermittent corruption across Chrome and Meshy.

## Family coverage

| Family                                          | Evidence and runtime treatment                                                                                                                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merc                                            | Existing accepted rig retained; static validation, skins/animation inventory and loaded runtime proof. No bind-pose or topology change in this art pass.                                                          |
| Early museum floor/garden/columns/arcade/canopy | Attribute validation and geometry screen; explicit colliders stay separate from visible ornament. Arbitrary global decimation was rejected.                                                                       |
| Windows/screens                                 | Existing authored frame, glazing, thickness and visible edge treatment retained. Reflections and oblique views make a hidden edge in one view insufficient reason to delete it.                                   |
| Wine glasses, amphorae and decanters            | Attribute-only fixes preserve silhouettes and independent fracture roots. Celadon adds the measured hollow shell, planar support and closed shard proof.                                                          |
| Wall paintings and mirrors                      | Unique artwork maps and live planar-reflection targets keep individual materials, picking and disposal. Three earned portrait types have actual intact/fractured runtime captures.                                |
| Museum islands/temples/cliffs/water             | Fresh actual-map views, measured planting clearances and the companion architecture/contact audit. Eleven non-botanical V9 nodes retain byte-identical geometry and embedded images in V10.                       |
| Camellia garden                                 | 117,800 triangles per shared source; six real instances. Controlled rebake, equal-camera 1K/2K selection, packed Blender source and retained dense/remesh donors.                                                 |
| Cloudway platform set                           | Dense marble form retained; fitted Frost/Glide and existing Crackle behavior. Compatible donor parts are instanced; conservative fog culling reduces submitted instances without modifying support or simulation. |
| Repeated room planters                          | New batching within each room preserves covered-solid activation and transforms. Six actual export copies use one draw instead of six, with all 55,416 submitted triangles preserved.                             |

## Instancing boundaries

Shared buffers alone are not an instancing claim. Museum compatible vegetation,
Cloudway donor parts and repeated opaque room decorations use `InstancedMesh`.
The room-planter proof is in [`static-planters/`](static-planters/): equal-camera
images differ by 0.000812 mean 8-bit channel units, concentrated at raster edges.
Instance buffers are explicitly released during disposal.

Some apparent repeats deliberately retain separate draws:

- Different room floors have different dimensions, UV layout, inlays and room
  visibility. A single global batch would destroy the current culling boundary.
- Wall artwork has different texture content; mirrors own separate reflection
  targets and inspection surfaces.
- Breakable glass has independent anticipation, fracture, material and shard
  lifecycles. Transparent/refractive props must also preserve sorting behavior.
- Merc is skinned. Source parts with skins, morphs or hidden children are excluded
  from the static-prop batching helper.
- Older open-museum dressing and authored window/screen visual instances share
  donor buffers but keep separate placement/activation roots. This audit does
  **not** claim that every repeated object is a single draw call.

## Cost interpretation

The final inventory reports unique asset triangles and embedded image storage,
not whole-frame triangles or total GPU memory. For example, Cloudway's combined
kit contains about 2.04 million unique triangles and 208 MiB of estimated decoded
RGBA mip storage; the V10 map kit contains 260,531 triangles and 140 MiB of such
storage. These values include multiple source nodes and are shared across their
instances. Texture download compression does not remove decoded texture cost.

Actual renderer submissions, camera cost and fog-visible instances are measured
separately in the [V7 runtime evidence](../../platform-trials/v7/runtime/).
SwiftShader screenshots prove appearance and rendering behavior, not physical
tablet frame rate, memory headroom or thermal stability. The owner device pass
is the agreed stop boundary before adding campaign content.

## Reproduce and reuse

From the repository root, with the installed glTF Transform CLI and Python
Pillow/NumPy dependencies:

```sh
rtk proxy timeout 240 python3 art/glass-adventure/production/audit_runtime_assets.py --output art/glass-adventure/proofs/asset-audit-2026-09-24/final
```

The command reads the logical-ID asset allowlist, inventories only loaded GLBs,
runs the geometry screen and validates each export. It writes reports and never
changes the assets. Files are identified by SHA-256 and validator version.

The reusable procedure and primary Blender, Meshy, Three.js and Khronos references
live in [the production skill](../../../../.agents/skills/game-asset-production/SKILL.md).
The skill distinguishes a parser pass, a topology screen, a visual comparison and
a real-device acceptance test; none substitutes for the others.
