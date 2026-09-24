---
name: game-asset-production
description: Produce or audit game-ready 3D assets from Meshy and Blender sources, preserving silhouettes and baked detail, with validated GLB export, collision, fracture, instancing and real-runtime proof. Use for asset production or a requested 3D quality/performance audit.
---

# Game asset production

Deliver the accepted design in the real renderer at its intended camera distances.
Keep generation, authoring, export and runtime evidence distinguishable. A valid
GLB or a low triangle count does not certify the artwork.

## Choose the next useful step

1. Identify the **actual loaded asset**, node, URL/hash, scale and material policy.
   Establish its dense donor, provider derivative, Blender derivative and runtime
   lineage before blaming normals, drivers, missing textures or repository cleanup.
2. Name the visible features that must survive. Compare neutral clay, final PBR,
   normal play distance, nearest allowed inspection and any challenge/reflection
   camera. Reproduce the same transform, camera, lighting and exposure for variants.
3. Improve the responsible component. Use deliberate topology for architecture,
   preserve silhouette ornament, and transfer surface detail with controlled
   high-to-low bakes. See [production checklist](references/production-checklist.md).
   Do not smooth, subdivide or add pixels to hide destroyed forms.
4. Reopen the **exported** asset in a fresh renderer and test placement, motion,
   interactions and lifecycle. Measure actual draws, pass-inclusive triangles,
   geometry/texture memory, loading bytes and hardware frame times where relevant.
5. Archive immutable source receipts, packed Blender source, export recipe,
   versions/hashes, comparisons and acceptance findings. Record rejected candidates
   honestly. Do not replace a working asset with an unreviewed provider result.

## Non-obvious constraints

- Source meshes are not necessarily watertight solids. For fractured glass,
  distinguish outer shell, cavity and cut faces; a thin multilayer tunnel can look
  like a vase while having no valid bottom. Normal recalculation cannot fix it.
- Match collision to visible support via explicit contact anchors. Separate simple
  colliders from render detail. Preserve level IDs, encounters, motion parameters
  and save identity when replacing art.
- Shared GLB buffers or cloned nodes are **not** automatically instanced draws.
  Batch compatible repeated static meshes, preserving culling and picking. Record
  specific exceptions for skins, independently fractured glass and transparency.
- Verify modifier semantics in the installed Blender version. In Collapse,
  high vertex-group weights can make collapse cheaper rather than protect detail.
- Baking depends on frozen triangulation, UVs, corner normals and tangent basis.
  Re-bake if these change. Missing silhouettes cannot be restored by a normal map.
- A provider's requested polycount/resolution is an experiment. Inspect the actual
  output, including decoded texture memory. Keep high-resolution masters and
  choose shipping resolution by equal-camera comparison.
- Preserve a durable receipt **before** paid submission; save the task ID before
  polling. An uncertain POST requires task reconciliation, not blind resubmission.
  User authorization governs uploads and spending; this skill adds no new approval
  ceremony. Keep keys, signed URLs and request image payloads out of artifacts.

## Read-only inventory

Run `python3 scripts/glb_inventory.py <file.glb> ... --output <report.json>` from
this skill directory (requires Pillow). It reports structure, image dimensions, approximate decoded
memory, primitive counts and node reuse. Missing normals/UVs are candidates for
inspection, not automatic corruption. It cannot certify winding, self-intersection,
contact, actual instancing, appearance or physical-device performance.

`scripts/glb_geometry_audit.py` also screens exported triangle/vertex-normal
alignment, non-finite values and mirrored transforms (requires NumPy). It reports
both face count and affected area. Inspect flags in clay before correcting them:
this screen does not establish outward orientation or watertightness, and a
normal shared across a sharp curved surface can disagree with a small face.
