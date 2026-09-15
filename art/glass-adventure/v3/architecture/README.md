# V3 architectural donors

Status (2026-09-15): Meshy column, arcade and canopy donors are permanently archived and
packed in Blender. All three passed structural and raw/export visual checks
for scenery auditions. Owner art approval, runtime
placement and physical-device checks remain pending. Root owns charged
submissions and the credit/task ledger. This directory owns only architectural
donor finalization.

| Asset              | Current candidate                            | Geometry                  | Canonical size (glTF XYZ) | Review                                                                   |
| ------------------ | -------------------------------------------- | ------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| Gilded column      | `exports/gilded-column-01-final-v2.glb`      | 23,148 original triangles | 0.774 × 3.000 × 0.774 m   | Agent comparison passed, owner approval pending                          |
| Garden arcade      | `exports/garden-arcade-01-final-v1.glb`      | 28,161 original triangles | 5.664 × 3.000 × 0.818 m   | Agent backdrop comparison passed, owner approval pending                 |
| Observatory canopy | `exports/observatory-canopy-01-final-v1.glb` | 40,424 original triangles | 2.621 × 3.000 × 2.622 m   | Root-reviewed distant scenery candidate; close-up rib refinement remains |

Each final candidate has a packed 2K working `.blend` in `sources/`, a JSON
manifest and structural validation in `reports/`, and actual reimported GLB
proofs in `proofs/`. Three embedded 1K PNG maps preserve the donor base color,
normal and packed metallic/roughness atlas. Each atlas is approximately 16 MiB
decoded RGBA8 with mipmaps; reuse one loaded asset/map set across instances.
The separate extracted PNGs are editable derivatives, not additional runtime
loads. None of these candidates is copied into public assets or activated in the game.

Column `final-v1` is retained solely as rejected evidence: its 12k triangle
collapse introduced visible faceting in the capital, collars and flutes. The
source-preserving final-v2 uses no decimation, has zero sampled surface deviation
from the normalized raw source, and slightly softer 1K texture detail. The gold
remains the source’s pale champagne tone under identical studio lighting; the
whole column was not tinted. Small original Meshy irregularities remain visible
in the capital closeup.

The complete arcade has two open arches, decorated rear faces, low sills and an
asymmetric small planter-like end feature. It is suitable for a visual backdrop
or boundary audition; the sills mean it is not an automatically traversable
archway. Its geometry must not replace the authored walking course.

The canopy retains six columns, open dome ribs and an open crown. Five downward
center probes first hit the podium at approximately 0.242 m, confirming that
the apparent white center in the top view is the floor below, not a roof cap.
The included steps/podium and all supports are scenery until course and camera
clearance are reviewed. Original minor rib waviness remains in the donor.

The immutable provider downloads, high-resolution pre-remesh meshes, original
maps and thumbnails remain under `../../v2/meshy/<asset-id>/`; local `raw/`
copies preserve the exact remeshed intake with SHA-256. Those 1–2M triangle
pre-remesh originals are archival sources, not runtime assets.

## First donor and visual acceptance

Use the complete `gilded-column` reference listed with its SHA-256 in
`reference-selection.json`. It has a complete readable silhouette, broad flutes,
an acanthus capital with projecting volutes, a small emerald inset, thin gold
collars, and a layered ivory/verde foot. Keep those characteristics through
optimization. A smooth replacement cylinder with a generic capital is not an
acceptable substitute for the source design.

The `garden-arcade` is a later candidate for complete arch bays or botanical
relief pieces. Its arch openings must stay open and its rear needs inspection.
The `observatory-canopy` is later and more uncertain: six distinct columns,
continuous open ribs, an open crown, and an empty central volume all require
inspection from several angles. Never fill the rib gaps with a glass roof.
Any extracted capital or relief must come from the inspected donor itself.

## Generation request for root

Project starting request, subject to the actual callable API schema:

- Standard Meshy 7 / `latest`, exact inspected column beauty reference,
  `image_enhancement=false` to preserve its appearance.
- Textured donor, `enable_pbr=true`, 2K base color plus provider normal, roughness
  and metallic maps. Keep provider maps, even if later runtime maps differ.
- Retain the pre-remesh original. Request 18–24k triangle faces when remeshing;
  the initial repeated-column 8–12k triangle audition was rejected after visual
  comparison. Retaining the source 23,148 triangles is the current choice. These are
  project targets, not a guarantee of provider output or device performance.
- For standard generation, `target_polycount` takes effect only when
  `should_remesh=true`; do not also set overriding adaptive decimation.
- `remove_lighting` is currently documented for Meshy 6 only. Do not assume
  that option removes baked highlights from a Meshy 7 texture.
- No new charged submission is made by the intake scripts in this directory.

These API constraints were checked against the official
[Image to 3D documentation](https://docs.meshy.ai/en/api/image-to-3d) on
2026-09-15. The [Remesh documentation](https://docs.meshy.ai/en/api/remesh)
explains the separate remeshing operation. The exact parameters actually used
belong in root's task ledger; this file is a recommendation, not a submitted job.

## Permanent source and inspection contract

`inspect_donor.py` accepts one already-downloaded GLB. It makes a hash-verified
immutable raw copy under `raw/<asset-id>/`, imports it into an isolated empty
Blender process, audits mesh/material/image data, packs the imported source, and
saves `sources/<asset-id>-imported.blend` plus `reports/<asset-id>-intake.json`.
It does not reconstruct geometry, remesh, retexture, normalize, export a runtime
asset or alter the interactive Blender scene. Reusing a logical asset ID with a
different donor is refused; use a new versioned ID.

Run from any directory after the parent supplies a donor path:

```sh
rtk proxy timeout 180s blender --background --factory-startup --python-exit-code 1 --python /home/maff/.codex/worktrees/00ad/mercurypitch-agent/art/glass-adventure/v3/architecture/inspect_donor.py -- --source /absolute/path/to/donor.glb --asset-id gilded-column-01
```

The success sentinel is `V3_ARCHITECTURE_INTAKE`. Inspect the JSON and saved
source, rather than trusting Blender's exit status alone. Original maps should
remain in the parent donor download archive as well; packed source preserves
working dependencies but is not a replacement for original provider files.

Inspection checklist: neutral-lit front/back/three-quarter views and closeups
of important ornaments; add unlit-texture and side views when diagnosing a flaw. Record geometry islands, stray
pieces, missing rear detail, thin surfaces, normal flips, texture seams and any
baked lighting. Classify missing UVs, absent normal maps and hollow support
surfaces explicitly; do not quietly invent them.

## Finalization after intake

1. Duplicate the imported source to a versioned working `.blend`; preserve the
   raw source. Normalize uniformly to a 3 m canonical column, foot center at
   origin, +Y up and +Z front in glTF. Do not force the original reference width
   or stretch the capital. Record measured bounds and the applied uniform scale.
2. Preserve donor silhouette, carved relief, material separation and UVs. Clean
   detached noise and genuine defects in the duplicate. Compare each decimation
   candidate against the full donor at gameplay distance and in a capital closeup.
3. Prefer the donor atlas wherever it carries valuable carved/gilded appearance.
   Identify actual ivory, gilt and verde regions before naming semantic slots.
   Use shared museum PBR only where that preserves the design; never overwrite
   the complete atlas merely because the source has one combined material.
4. Keep base color in sRGB; normal/roughness/metal data are linear. Verify normal
   orientation from the actual donor metadata and a lit check. Inspect whether
   highlights are baked into base color before adjusting the material response.
5. Repeated columns should share one texture set. Keep 2K donor masters; audition
   1K runtime maps only if the capital still reads clearly. No blanket second
   atlas per instance. The current three-map 1K RGBA8 atlas set with mipmaps is about 16 MiB,
   additional to the existing museum texture budget. Prefer a scalar metallic
   value only when the actual assigned material region is uniformly metallic.
6. Export a versioned GLB under `exports/`, with normals, UV0, tangents and
   semantic material groups intact. Preserve any additional source UV channel.
   Decide explicitly whether its unique donor atlas is embedded once or resolved
   externally; the current runtime must not silently replace that atlas.
7. Re-import the exported GLB in a fresh process and compare bounds, triangle
   count, material names/channels, texture hashes and rendered appearance. Save
   front/side/back and three-quarter proofs, and a same-camera raw/final comparison.
8. Save hashes, counts, dimensions, dependencies, edits and remaining limitations
   in the final manifest. No missing external files or linked-library dependence
   in the delivered `.blend`. Physical device and in-game placement remain later
   acceptance gates, not claims made by source inspection.

The existing dimensional floor course remains authoritative. A 3 m column donor
cannot be dropped into an existing 2.185 m column slot without an explicit uniform
fit or placement revision. Ornament does not become a floor or obstacle collider.
Keep landings, encounter anchors and follow/orbit camera clearance visible.

No runtime copy or renderer change is made by this architecture task until the
parent integrates an inspected, exported donor.

## Repeatable finalization and validation

`finalize_column.py` also accepts the arcade asset ID. It makes a versioned
packed 2K working source, uniformly normalizes the original donor to `--height`,
retains original triangles when `--target` is at least the source count, and
exports 1K PNG derivatives in one GLB. It refuses to overwrite an existing
version. No replacement mesh is modeled. `render_proof.py` reimports the final
GLB; use `--wide --views three-quarter,back,front` for an assembly.
`validate_artifact.py --stem <asset-id>-final-vN` checks packed sources, external
dependencies, image dimensions, UV/normals/tangents and fresh reimport bounds.
These source/artifact checks do not establish a device performance budget.
