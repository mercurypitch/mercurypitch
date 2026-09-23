# Meshy → Blender → game asset quality audit

Requested 2026-09-21. Follow-up after the challenge camera and beginner sway
polish. This is an audit plan and initial checklist, not a claim that the existing
assets pass, nor permission to overwrite raw sources. It precedes further scene
density increases in the next landscape batch.

Update 2026-09-23: the museum repair is the active representative audit. See
[geometry lineage](./MUSEUM-SHAPE-AUDIT-2026-09-23.md) and the production contract
below. The owner specifically requires detail-preserving game assets; passing
structural checks or increasing a triangle count does not establish acceptance.

## Outcome and sequence

1. Inventory the actual exported GLBs, materials, texture maps, collision shapes,
   animations and runtime placement code. Link each to its Meshy donor, generation
   guide, packed `.blend`, export script, source/version receipt and license.
2. Establish a reproducible baseline in each gallery and the floating map: fixed
   views, draw calls, triangles, textures, geometry count, loading bytes, reflection
   and transmission passes, plus sustained physical-tablet frame time and heat.
   Software screenshots establish appearance, not hardware performance.
3. Audit one representative of each family: floor/window/column, repeated planting,
   frame/mirror/painting, intact glass, fractured glass, animated Merc and waterfall.
   Record exact asset/node/placement IDs, severity, evidence, proposed correction,
   before/after measurements and any exception. Then expand to every shipped asset.
4. Repair by family in reviewable commits. Re-export and verify the final GLB in the
   real shared web/native host, not only Blender. Preserve source donors; change
   authoring recipes so regenerating the asset retains the correction.
5. Turn the proven procedure into a reusable game-asset audit skill with a short
   `SKILL.md`, detailed references, inventory/report templates and optional read-only
   checks. Use the skill-creator workflow at that stage. Keep project incidents in
   `docs/agent/MISTAKES.md`; link the skill rather than duplicating long instructions.

## Per-asset checklist

| Check                        | Evidence and acceptance                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hidden bevels and geometry   | Inspect from all reachable gameplay, inspection and cinematic views, reflections and after breaking/moving. Remove detail that never affects silhouette, shading, refraction or revealed fracture edges. A window edge inside an opaque frame is a candidate, not an automatic deletion; avoid blanket decimation of glass thickness. |
| Intersections                | Check mounted frames, glazing, trim, vegetation, plinths and glass at rest and through motion. Fix unintended penetration, coplanar flicker and visible joins; record intentional overlaps. Broad-phase bounds may flag candidates but do not prove mesh intersection.                                                                |
| Resting on surfaces          | Validate the asset's contact anchor against the actual support plane, collider and shadow. Inspect front/side/underside and motion endpoints. Avoid per-instance arbitrary offsets that conceal a bad shared pivot or normalization.                                                                                                  |
| Normals and winding          | Inspect face orientation, split normals and tangent-space normal maps before and after export. Check mirrored/negative-scale objects. Correct unintended inward faces; hollow glass has intentionally inward-facing interior surfaces. Do not hide defects by making every material double-sided.                                     |
| Repetition and ownership     | Inventory repeated geometry/material combinations and their actual renderer objects. Shared Blender mesh data, a cloned GLB and shared GPU buffers do not by themselves prove one instanced draw. Group compatible repetitions into measured batches, retaining per-room visibility and picking IDs. Document exceptions.             |
| Topology                     | Check loose/duplicate/degenerate geometry, non-manifold edges where a closed shell is required, tiny slivers and self-intersections. Verify deliberate open sheets, leaves and architectural apertures separately. Inspect the triangulated export, not just Blender's polygon count.                                                 |
| Scale, transforms and pivots | Consistent units and axes, predictable contact/motion pivots, reproducible export transforms, conservative bounds. Applying transforms to an existing rig must preserve animation and inverse-bind behavior.                                                                                                                          |
| Materials and textures       | Verify UVs, texel density, seams, padding/mips, color-space assignments, normal/roughness/metallic interpretation, glass thickness and alpha/transmission. Match accepted art; do not bake specular highlights into generic base color. Assess resolution/compression by screen coverage and device evidence.                         |
| Collision and movement       | Simple authored collision proxies match visible support, openings and moving platforms. Test Merc jumping/landing near edges, camera clearance and contact after a motion cycle. Render mesh complexity is not a reason to make collision expensive.                                                                                  |
| Shattering                   | Intact and fragment states match before release; pivots, interior faces/materials and thickness are plausible. No startup cracks, floating fragments, explosive overlaps or unbounded tiny debris. Verify timing, cleanup, pause, replay and retained encounter identity.                                                             |
| Rigging and animation        | Check deformation, contact, clipping, animation bounds, root motion, transitions and reduced-motion behavior. Reuse the accepted Merc rig unless a measured defect justifies a replacement.                                                                                                                                           |
| Lighting and reflections     | Contact shadows, intended highlights, shadow caster cost, exposure consistency and reflection visibility all work from real cameras. Avoid fixing bad normals with extra lights. Compare with and without expensive passes to identify their actual contribution.                                                                     |
| LOD, batching and lifecycle  | Set budgets per family and device tier from measurements. Verify hidden-room culling, distant simplification, disposal, retries and cache ownership. Do not add blanket numerical ratchets without a measured regression to prevent.                                                                                                  |
| Final export                 | Validate GLB structure/resources and exact asset hashes, reopen in a fresh viewer, then inspect in both built hosts. Archive source, export settings/tool versions and proof views beside the production artifact.                                                                                                                    |

## Instancing and fracture architecture

For bevel removal, include shadow silhouette, baked normal/lightmap dependencies,
reflection/refraction and collision in the comparison, plus exported split-vertex
cost. Ordinary camera visibility alone does not establish that detail is redundant.
For glass normals, reason about the solid volume: the outer shell faces outward,
cavity faces point into the cavity, and fracture cuts face outward from each shard.
Explicit inner shells depend on the chosen glass representation; do not blindly
combine them with a shader thickness model and double-sided rendering.

Aim to instance compatible repetitions, with a written reason for exceptions.
For static opaque repeats, use shared geometry/material and per-instance transforms
and IDs, grouped by room or another useful culling unit. Confirm the reduction in
actual draw calls. A single giant batch that keeps all rooms visible can be worse.
Three.js `InstancedMesh` is designed for common geometry/material with distinct
transforms; changed instance transforms require appropriate buffer/bounds updates.
[Official Three.js reference](https://threejs.org/docs/pages/InstancedMesh.html).

Transparent glass ordering, individual fracture transitions, unique materials and
skinned animation need explicit evaluation rather than an unqualified “instance
everything.” A proposed breakable lifecycle can keep compatible intact vessels
instanced and activate a pooled fragment representation on break. Per-instance
removal, picking, progress IDs, bounds and material ownership must remain correct.
This is an audit hypothesis, not a runtime change approved or implemented here.

Inventory material/lightmap variants, negative-scale transforms, transparency
ordering, per-instance culling/picking and update frequency before choosing a
batch. Require a net physical-device benefit; fewer draw calls alone is insufficient.
Fracture pooling is a per-family experiment: compatible intact vessels do not imply
identical shard topology. Reusing lifecycle containers or materials differs from
sharing fragment geometry. Require correctly oriented closed shard volumes where
intended, an atomic intact-to-fragment swap without z-fighting, bounded transparent
fragment cost/order, cleanup and no state leakage between encounter IDs.

## Lessons already worth preserving

- Inspect accepted concepts against actual final meshes. The Celadon production
  trial failed geometry acceptance despite a useful guide; archive failed donors
  and their reasons rather than replacing a working fallback automatically.
- The singing camera exposes low side views that overhead exploration does not.
  Hidden-edge, contact and normal checks must include that view and the full shatter.
- Tablet inspection and real reflection views revealed defects missed in isolated
  art previews. Verify in the actual host with its camera, light and UI composition.
- Adding physical canopies increased pass-inclusive map draws/triangles in V6.
  Added realism needs a measured device budget before more decoration is layered on.
- Inspect the preserved dense source, the provider's textured output and our
  exported derivative separately. The museum temple was reduced from 1,789,350
  triangles to 21,839 before a local reduction to 9,993; the tree went from
  663,730 to 7,136 to 1,192. Restoring only the last reduction cannot restore the
  original form. Hash/position comparisons isolated this from the later normals
  cleanup. A material split additionally changed some dome normals: preserve
  those corner attributes when assigning variants.

## Detail-preserving production contract — current repair

This is our proposed acceptance procedure for the temple, cypress and
Conservatory, based on the actual failed assets. It does not certify candidates
that have not yet been generated. Installed tools checked on 23 September:
Blender 5.2.2 LTS, Three.js 0.185.1; retain exact versions in export receipts.

### Shape first

Keep dense raw models immutable. Archive a neutral clay view from the nearest
allowed inspection camera, a normal playing view and a grazing side view. Name
the features that must survive: dome ribs, open arches, column/flute rhythm,
statue profile, branch silhouette and gaps in foliage. If those are already
fused in the dense model, replace or repair that component before reduction.

Prepare a lower-cost candidate against those features, with more geometry at
visible curves and outlines and less on broad hidden surfaces. The first Meshy
targets are 110k for the Conservatory, 90k for the temple and 20k for the tree.
They are starting experiments, not fixed shipping budgets. Inspect triangle
distribution and thin apertures, not just totals. Do not uniformly subdivide a
melted mesh or run a second blind percentage reduction after review.

Meshy's triangle mode performs decimation; quad mode produces quad-dominant
topology. A requested polygon count may differ from the result. Neither output
is automatically approved topology for our game. [Meshy Remesh API](https://docs.meshy.ai/en/api/remesh).

### Transfer detail onto the accepted surface

The established workflow is **retopology plus high-to-low baking**. Blender can
project dense-surface shading onto a selected lower-resolution target, using
a cage/ray range and tangent-space normals. UV-border padding protects seams
under filtering and mipmaps. [Blender baking manual](https://docs.blender.org/manual/id/5.0/render/cycles/baking.html).

Our implementation gates:

- Keep high and low candidates in the same coordinate system. Freeze final
  triangulation, UVs and intended corner normals before baking. Record hashes
  so later geometry/material edits cannot silently invalidate the transfer.
- Review a UV checker at actual game scale. Protect visible faces and narrow
  trim from low texel density. Deliberate shared/mirrored UVs need a documented
  reason; unique statue/portrait surfaces must not pick up unrelated details.
- Bake one focal region first. Use a controlled cage/ray distance and isolate
  nearby components when rays would hit the wrong column, leaf or inner wall.
  Inspect black misses, inverted relief, wavy projection and seams before a
  full bake. The bake cannot restore a missing outline or reopen a sealed arch.
- Compare dense-to-candidate normal detail with Meshy's generated normal map.
  A PBR retexture is not proof of geometric detail transfer. Do not add the two
  maps as RGB or double the same relief; select or deliberately compose the
  appropriate detail with a verified tangent-space method.
- Keep baked occlusion separate from base colour. Avoid frozen lighting and
  excessively dark creases. Preserve material identity: marble, metal, foliage
  and glazing need distinct roughness/metallic responses, not one glossy coat.
- Retain full-resolution source maps and the packed `.blend`. Choose runtime
  map resolution/compression only after equal-camera comparison. Prefer a crisp
  smaller asset over unnecessary upscaling of a blurry source atlas.

Meshy can generate base colour plus normal/roughness/metallic maps with
`enable_pbr`; original UV reuse is configurable. Record actual output maps,
UV changes and resolution rather than assuming the flag proves export quality.
[Meshy Retexture API](https://docs.meshy.ai/en/api/retexture).

### Verify what the game actually loads

For glTF, use tangent-space +Y normal maps, marked Non-Color in Blender, through
a Normal Map node. Occlusion uses R; roughness/metallic can share G/B in a packed
texture. UV/shading discontinuities can split exported vertices. Shared Blender
mesh data can support instance export, but does not alone prove runtime batching.
[Blender glTF manual](https://docs.blender.org/manual/id/5.0/addons/import_export/scene_gltf2.html).

- Reimport into a fresh Blender scene and load the exact derivative in the
  shared Three.js game. Verify normal direction and highlights across the dome
  material split, UV borders, silhouette, apertures and ground contact.
- Preserve current logical IDs, node names, coordinates and the accepted V7
  connector. Keep temple variants sharing geometry; retain the runtime tree
  `InstancedMesh`. Multiply a tree's triangle cost by visible instances and
  rendered passes: instancing reduces submissions, not all vertex work.
- Capture the same camera, lighting, DPR and viewport as the archived baseline;
  show current/dense/candidate views and an actual textured in-game close-up.
  A clay pass, validator pass or screenshot alone cannot stand in for the others.
- Record bytes, draw calls, pass-inclusive triangles, geometry and texture
  counts, plus sustained owner tablet frame time/heat separately. A hardware
  desktop capture does not establish tablet performance.
- If close detail is good but cost is high, profile then prepare a separately
  reviewed distance LOD from the accepted source. Do not reduce the inspection
  model globally to satisfy a distant-view budget. Texture compression requires
  loader support and visual proof before introducing another format.

Each accepted asset needs a small receipt: source/candidate/export hashes,
feature checklist, topology/UV/bake settings, texture channels and sizes,
Blender source, fresh-import check, exact runtime proof and remaining exceptions.
Do not publish a replacement on polygon count or provider success alone.

## Research to complete before formalizing the skill

Use official Blender/glTF/Three.js documentation for operational claims; check
the project's installed versions. Supplement with attributed production articles,
public talks and legally accessible book excerpts for artistic judgment. Community
forum advice is a hypothesis to reproduce, not a universal optimization rule. Never
copy books or long tutorials into the repository. Keep concise original summaries,
links, tested versions and examples from our own assets.

Starting sources:

- [Blender Mesh Analysis](https://docs.blender.org/manual/en/latest/modeling/meshes/mesh_analysis.html)
  — candidate inspection tooling. Search index located it; full manual fetch was
  unavailable during this planning pass. Verify the installed-version workflow.
- [Blender glTF exporter](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
  — exporter settings, supported materials, instance export and split vertices.
  Full fetch likewise unavailable; confirm before encoding export rules in a skill.
- [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)
  — inspected 2026-09-21; runtime batching, bounds and instance-data ownership.
- Find authoritative glTF validation, Blender normals/bevel/cleanup guidance and
  fracture production examples; compare with our actual exporter and runtime.

## Follow-up task list

- [ ] Research and record version-specific references and any unresolved conflicts.
- [ ] Produce asset/runtime inventory and baseline measurements.
- [ ] Review the large authored modules `enclosed-museum-kit.ts`,
      `journey/architecture.ts` and `journey/water.ts` while mapping asset ownership.
      Extract reusable families only where they improve authoring or lifecycle clarity;
      the current code-health baseline records their deliberate growth above 800 lines.
- [ ] Audit representative families, then every shipped asset and placement.
- [ ] Prioritize visible defects, interaction defects, then measured cost regressions.
- [ ] Repair the highest-priority family; verify before/after and commit separately.
- [ ] Publish the lessons/report template and reusable skill after the first audit.
- [ ] Extend the audit to new Meshy generation, fracture and animation deliveries.

This document is the checklist, not proof of a completed whole-project audit.
Current model production and approval state live in
[MUSEUM-COMPONENT-REPAIR-2026-09-22.md](./MUSEUM-COMPONENT-REPAIR-2026-09-22.md).
The reusable skill remains a follow-up after this procedure has been exercised.
