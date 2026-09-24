# Cloudway — Meshy 7.1 material and geometry trial

Owner authorization: continue the high-quality trial in the existing mini-game
before deciding whether it merits use in the main galleries. Meshy credits and
transfer of the prepared guides are authorized. Work remains on draft PR #807;
no merge or release. Keep the owner's no-HMR playtest running during production.

## Deliverable and boundaries

1. Fit the accepted V4 marble donor to the established landing envelope, prepare
   its runtime topology and materials in Blender, then compare it in Cloudway.
2. Produce exactly two independent 7.1 / Ultra 4K / PBR 4K source auditions for
   frost and the moving platform. Preserve guides, task receipts, original GLBs,
   texture maps and review evidence under `platform-trials/v5`.
3. Install only visually accepted, validated derivatives at versioned public
   URLs. Keep the six authored root names and existing collision, pacing and
   checkpoint contracts. Preserve previous exports under art.
4. Report close-up quality, delivered bytes and measured rendering cost. The
   owner decides whether the improvement merits main-gallery production.

The completed museum V8/V9 repair stays unchanged for comparison. Do not extend
the route or add a new released level during this pass. Fog is owner accepted.

## Source-to-game checks

- Bind each submitted request to its guide hash and record its task ID before
  follow-up calls. Do not repeat a known submission or expose credentials or
  signed provider URLs in receipts.
- Explicitly request `meshy-7.1`, `geometry_resolution: 4k` and independent PBR
  texture resolution. Record what was requested separately from what the
  provider confirms. Ultra geometry does not mean 4,000 triangles.
- Preserve the dense original. Review silhouette and clay geometry before
  accepting remeshing; texture detail cannot repair missing arches or planting.
- Keep the landing rectangle 1.70 × 1.30 m and top at Y=0. Fit the derivative
  deliberately; the width-matched V4 source was too shallow. No opaque cover
  that hides the new top artwork.
- Preserve UVs where possible; bake high-to-low normal/AO where needed. Compare
  the bake against the provider normal instead of assuming either is better.
- Compare 2K and 4K derivatives at identical real-game camera distances. Select
  by visible benefit and delivered cost, not resolution labels alone.
- Audit normals, tangents, degenerate geometry, surface contact and all six
  roots. Repeated platforms continue to reuse loaded geometry/materials.
- Capture actual WebGL frames and loaded-byte hashes on desktop and a tablet
  viewport. Desktop viewport testing does not establish physical-tablet speed.
- Keep source, packed Blender project, export script, receipts and all accepted
  and rejected comparison candidates. LFS holds binaries; planning mirrors into
  dotfiles. Never reformat hash-bound production receipts.

## Task checkpoint

- [x] Previous V4 source accepted: 1,256,556 triangles; 4K base/normal maps.
- [x] Capture the existing V3 arrival and close-up views in the actual game.
- [x] Prepare two fitted V4 derivative approaches and review 2K/4K raw exports.
      Both fail visual review; neither is approved for runtime integration.
- [x] Generate and archive both V5 sources for 70 credits total; render all eight
      matched clay/PBR comparisons and preserve packed Blender review scenes.
      Independent source acceptance is recorded under V5; no runtime derivative yet.
- [x] Independently review export geometry, collision alignment and art; reject
      the 90k bake path and direct 238k path despite structural validation.
- [x] Isolate the first destructive operation with exact fit/flatten/collapse stages
      and a geometry-identical normal control. Whole-shell collapse after flattening
      damages topology; resetting normals does not repair it. Flattening separately
      erases top relief and clips foliage.
- [ ] Prove one clean left-front arch/fascia component before another whole-platform
      derivative. Preserve the visible surface; keep collision contact separate.
- [ ] Integrate a future accepted derivative, verify actual browser assets and
      run focused asset/loader checks. Deferred: this batch has no accepted low mesh.
- [x] Fix the root-browser cover decode check at `4c0ef3c3`; both affected tests pass concurrently locally and all four root-browser CI shards pass. All 40 PR checks also passed at `f3899370`; inspect CI again after this evidence update.
- [x] Finalize production evidence and plans for the PR. The stable preview retains V3;
      no rejected candidate should be installed merely to finish this checklist.
- [x] Specify the melody-contour learning follow-up and make a listening/visual
      audition while the asset bake runs. Desktop, tablet and phone reviews pass.
      This is reference playback; microphone judging remains a later stage.

## Marble review checkpoint

The 5-credit provider remesh retains 89,984 shell triangles (90,016 with the
landing boundary). Fitted contact error is below 9 mm, but this candidate is
rejected for runtime appearance. It remains archived as production evidence.

Neutral-clay review exposed incompatible nearest-polygon normal transfer and
provider corner normals opposed to their own geometric faces. Geometric-face
gating corrects that basis; it does not fix the separate whole-shell projection
problem. An 18 mm bake cage hit opposite nearby sheets. A bounded 4 mm trial
reduced wrong-facing samples but lost coverage and retained black artifacts.
Simply disabling the normal map leaves lumpy broad faces and arches, so that
fallback is also rejected. No weakened normal strength or clamped normal map
is accepted as a repair.

The direct derivative now has 238,000 shell triangles plus the existing
32-triangle landing boundary. It retains the provider atlas/PBR, with one
documented half-pixel repair of a degenerate UV triangle, rather than using the
rejected projection. High-detail protection weights use Blender Collapse's
verified inverted-group convention. Overall contact error is 7.168 mm; central
contact error is 0.9 mm. Both raw 2K/4K exports pass Khronos with zero errors or
warnings. Seven singular exported tangent rows are reconstructed from their
actual triangle UV derivatives with measured handedness; all other tangent
bytes and the exported positions, normals, UVs and indices remain exact.
This does not claim full MikkTSpace continuity or a successful normal bake.

Matched clay and PBR review decisively rejects the direct 238k candidate too:
broad-slab triangular shading defects, rough arches and damaged-looking top
artwork remain. Both 2K and 4K fail; texture resolution is not a repair. The
combined fitting/flattening/simplification/normal-finalization pipeline is
implicated, but these final comparisons alone do not isolate its first faulty
step. Do not claim that seven repaired tangents caused or solved these much
larger surface defects.

Stop this bounded experiment here. No optimization, assembled V4 bundle or
public installation follows a failed visual gate. The prepared assembler can
verify preservation of the other five V3 roots in a future accepted build;
its existence does not establish acceptance. The original source, packed
direct Blender project, rejected paths and hash-resolved archive index remain
under V4. Marble source plus provider remesh cost 40 credits total.

The actual V3 grazing-view baseline submits 63 draw calls and 1,125,424
pass-inclusive triangles per animation-frame interval. QA-only wrappers observe
native WebGL calls; they do not suppress drawing or change app runtime code.
Fog hides distant platforms visually, but all six marble instances still incur
vertex work. The rejected candidate was not installed or performance-measured.
Measure a future visually accepted candidate with the same view. Review distance
LOD or instance visibility against physical-tablet evidence before extending
geometry density across the main galleries.

### Isolated cause and next production step

The [dated causal report](../platform-trials/v4/proofs/diagnostics/marble-stage-isolation-2026-09-23/final-conclusion.json)
rebuilds exact production stages from the untouched dense donor. Fit-only keeps
straight fascia and smooth arches. Contact flattening moves 134,483 visible
vertices, erases relief and clips foliage, although the broad front remains clean.
The subsequent weighted whole-shell collapse is the first stage that reproduces
the broad triangular damage. Its silhouette can remain almost identical while
interior surface quality fails; silhouette metrics alone are insufficient.

A control keeps collapsed positions, triangle indices, UVs and material indices
byte-identical, removes custom normals and calculates smooth normals with a
30-degree hard-edge threshold. It eliminates 40,142 non-positive corner normals,
but the top fractures and long-triangle fascia/arch defects remain. Correcting
normals improves contrast slightly; it does not repair the damaged topology.
No later bake or normal-finalization loop was run.

Next, extract the measured left-front arch bay and adjacent fascia from the
fit-only source. Preserve sculpted ornaments as source components and author a
clean lower-resolution surface with deliberate straight edges/radial arch loops.
Any projection must be restricted to that component pair. Keep visual detail
separate from the invisible landing/collision surface. Accept matched clay first,
then normal/PBR proofs, before extending the method or installing anything.

### V5 Frost and Glide source results

Both explicitly requested Meshy 7.1 / Ultra 4K tasks completed:

| Source | Task ID                                | Triangles |  GLB bytes | Credits |
| ------ | -------------------------------------- | --------: | ---------: | ------: |
| Frost  | `01a0d008-eb11-7661-bca6-4fb4f1986fff` |   632,256 | 46,738,536 |      35 |
| Glide  | `01a0d009-7173-7142-8f57-0c4c8be24adf` |   145,370 | 30,284,496 |      35 |

Actual base-colour/normal maps are 4K; metallic/roughness maps are 2K. The provider
confirms Ultra geometry resolution but does not echo the requested model version.
The original GLBs, separate maps, receipts, eight matched proofs and packed Blender
review projects are saved under [V5](../platform-trials/v5/README.md).

The original transfers stopped near 1 MB. Complete-length and format checks now
precede archive promotion, and bounded retries recover from the same task ID.
Rejected original partial GLBs are quarantined; two later short normal-map
transfers were caught too. Six network-free regressions pass. No duplicate jobs
were created. New-source total: 70 credits; previous marble source/remesh: 40.

Independent review accepts both only as dense source donors with limitations.
The new source surfaces and corners are cleaner, but fit/material work remains.
At matched width, Frost is 30.60% shallower than V3 and Glide 40.21% shallower.
Frost has a few raised bubble-like bumps; Glide's motif is mainly texture. Both
use opaque PBR rather than actual transmission, so glass shading needs deliberate
finishing, with masks/partitions separating glass from the shared gold material.
Neither is a runtime-approved replacement yet. Retain V3 in the owner
playtest while preparing and validating those derivatives.

## Next learning follow-up: melody ribbon

The owner proposes a normal learning island, not voice-controlled traversal.
Merc stops at a portrait or special vase and traces an authored melody with
their voice. The display previews notes connected by smooth pitch glides;
successful singing fills one continuous ribbon from its beginning to its end.
Start with three notes and a small comfortable range, audition five/seven-note
phrases, then consider seven-to-ten-note phrases and later vibrato ornaments.

The saved [specification](MELODY-RIBBON-LEARNING-SPEC.md) covers musical
authorship, comfortable transposition, one shared curve for display/reference/
judging, forward-only live alignment, fair timing and breath breaks, existing
microphone ownership, lesson placement and replay difficulty. The separate
listening visualizer is ready for musical review. It is reference playback;
microphone judging and the next learning gallery are not implemented.

Related: [master plan](NEXT-MASTER-PLAN.md),
[source audition](MESHY-71-ULTRA-4K-AUDITION.md),
[asset audit](GAME-ASSET-QUALITY-AUDIT.md),
[camera and route backlog](CAMERA-AND-ROUTE-FOLLOWUPS-2026-09-23.md).
