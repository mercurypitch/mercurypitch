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
- [ ] Prepare fitted V4 marble runtime derivative and compare 2K/4K materials.
- [ ] Generate V5 frost and moving-platform source auditions (two 35-credit
      estimates). Review before deciding their runtime integration.
- [ ] Independently review export geometry, collision alignment and art.
- [ ] Integrate accepted derivative(s), verify actual browser assets and run
      focused asset/loader checks.
- [x] Fix the root-browser cover decode check at `4c0ef3c3`; both affected tests pass concurrently locally and all four root-browser CI shards now pass. All 40 PR checks pass on that revision.
- [ ] Commit/push the asset stage and give the owner a stable refreshed preview.
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

The next bounded comparison derives a roughly 240k shell directly from the
preserved dense donor, protecting ornament and retaining its UVs and provider
normal map. This avoids the faulty projection onto the provider remesh. It
must pass clay, PBR, contact, tangent and real-game 2K/4K review; the higher scene
cost must be reported. The bundle assembler independently verifies exact
preservation of all five non-marble V3 roots and shared resources. Public
platforms remain V3 until a replacement passes these gates.

## External request checkpoint

The marble remesh was submitted and completed for 5 credits. The two new V5
source auditions were prepared but automatic approval review rejected the
first upload before process start: it requires specific approval for the Frost
and Glide guide PNGs and their two 35-credit jobs. An async owner question names
both exact V2 guide files, destination `api.meshy.ai`, and 70-credit total.
Neither V5 job has a task ID or spent credits. Do not retry or work around this
rejection without the answer. All local preparation and the existing marble
work can continue.

## Next learning follow-up: melody ribbon

The owner proposes a normal learning island, not voice-controlled traversal.
Merc stops at a portrait or special vase and traces an authored melody with
their voice. The display previews notes connected by smooth pitch glides;
successful singing fills one continuous ribbon from its beginning to its end.
Start with three notes and a small comfortable range, audition five/seven-note
phrases, then consider seven-to-ten-note phrases and later vibrato ornaments.

The next specification must cover musical authorship, comfortable transposition,
one shared curve for display/reference/judging, forward-only live alignment,
fair timing and breath breaks, existing microphone ownership, lesson placement,
and replay difficulty. First audition the melodies and visual language. A
reference-playback demo must be clearly distinguished from microphone judging.

Related: [master plan](NEXT-MASTER-PLAN.md),
[source audition](MESHY-71-ULTRA-4K-AUDITION.md),
[asset audit](GAME-ASSET-QUALITY-AUDIT.md),
[camera and route backlog](CAMERA-AND-ROUTE-FOLLOWUPS-2026-09-23.md).
