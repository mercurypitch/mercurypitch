# Cloudway and museum polish — 22 September 2026

## Decision and scope

The current first trial must meet the approved concept's visual quality before
any additional levels are built. The working frost, raft and crackle timing stay
the baseline. No new levels, rivals, currencies or difficulty systems in this pass.
The full diagnosis is in [the visual audit](CLOUDWAY-VISUAL-QUALITY-REVIEW.md).

## Correctness batch

- [x] Reproduce a zero-break visitor reaching a safe landing without getting a
      checkpoint. Remove singing prerequisites from Cloudway's static recovery
      landings; keep encounter and exit prerequisites. Prove forward traversal,
      falling, save/reload and returning from the finale to the first missed goblet.
- [x] Replace the overflowing uncalibrated target text with an accessible target
      SVG. Keep actual note names once calibrated and plain instructions outside the
      circle. Check the real 320 px phone panel.
- [x] Fix portrait camera selection: the painted front and back cannot score
      equally. Prefer an elevated side view that separates Merc and the portrait,
      with room above the live instruction panel. Retain smooth entry and restoration.
- [x] Stop wrapping Cloudway's flat sky illustration over a sphere. Display it as
      an aspect-correct backdrop, avoiding the longitude seam and magnification.
- [x] Add radial distance fog that blends into the actual fitted sky plate.
      Review real rendered arrival, left/right orbit and approach views; remove
      the white silhouettes left by plain pale fog and the finale reveal caused
      by axial depth when orbiting.
- [x] Commit and push checkpoint, target-icon and portrait-camera corrections as
      `67bec9a5`. All 40 checks passed, including camera and Cloudway suites; the preview
      deployment passed after retrying a Cloudflare connection failure.
- [x] Review final sky and asset raster proofs, including the actual V7 map
      close-up and V3 tablet portrait challenge; both loaded the exact new hashes.
- [x] Leave a stable no-HMR HTTPS playtest server at port 5300 (HTTP 200 verified).
- [ ] Push the reviewed remaining polish and inspect the resulting CI checks.

Checkpoint saves remain per browser origin. Switching HTTP/HTTPS, host name or
port opens another local save; MercuryPitch and Beside Cue also intentionally
use different host namespaces. The fix cannot recover a landing that the old
build never saved. Reaching it once in the corrected build will save it.

## Art repair and acceptance order

1. **Repair the platform surfaces.** Produce V3 from the original textured Meshy
   donors instead of the heavily reduced 7k shells. Preserve marble veining,
   celadon inlay and foliage silhouettes; remove the plain cover that hid them.
   Keep collision dimensions and all crackle state names unchanged. Compare
   original donor, old export and candidate under the same light and camera.
2. **Repair the museum connector.** Test one higher-detail textured remesh from
   its preserved dense source before replacing the family. Inspect the exact
   close view reported by the user: straight balusters, clean ribs, distinct
   leaves and flowers. Extra triangles are useful only if those shapes improve.
3. **Dress this existing route.** Add coherent starting and ending islands,
   planted edges, small pond or fountain accents, flower clusters, cypresses and
   a few distant architectural silhouettes. Keep the jumping edge visually clear
   and keep ornamental overhangs distinct from the usable floor. Use instanced
   modules and authored placements rather than scattering decoration at random.
4. **Shape the reveals.** Evaluate the new fog at the start, raft and finale.
   Use cloud banks and distant framing to hide the final destination without
   hiding the next safe landing, crack warning or moving raft. Consider a gentle
   turn in this same route only after validating the present movement spacing.
5. **Accept the complete scene.** Compare concept, actual player view and closest
   permitted zoom on desktop and tablet. Check lighting, shadows, foliage edges,
   texture detail and cloud transitions. Record draw calls, triangles and frame
   timings on a device; technical GLB validation does not constitute art approval.

The first repair candidates retain about 35–40k triangles per unique platform
shell and 102,607 triangles for the museum connector. These are visual repair
budgets, not a claim that the complete scene meets tablet performance targets.
Keep a separate runtime texture derivative, measure its bytes, and inspect it
beside the source before installation. The connector's new Meshy remesh and PBR
texture used 15 credits in total; receipts and the editable project are under
`art/glass-adventure/journey-map/v7/`. The preserved dense source still contains
some fused foliage, so the replacement is an incremental repair, not final
acceptance of the reference artwork.

## Installed repair batch

- Cloudway V3 keeps 35–40k triangles in each unique detailed platform shell,
  with the donor landing adjusted to the collision plane rather than hidden
  beneath an opaque cover. Centre and edge contact errors are below 1 cm.
- Its runtime GLB is 10,338,088 bytes (75.9% smaller than the source-quality
  export), with SHA-256
  `e96bb26369cb037dffcfab3d0c71911dc7e872c2b8f766db8cb73599a6d51c62`.
  Runtime geometry matches the approved source; only texture delivery and
  redundant tangent attributes change. Three.js derives tangent space.
- Museum V7 retains 102,607 connector triangles and the unchanged 22,870-triangle
  conservatory. The runtime is 12,263,920 bytes, with SHA-256
  `b427dd61cd5da0c68cd9831d2524e6d7452888d21bcb3219c0671182b1002cd4`.
- Both use 2K base colour and 1K normal/ORM WebP maps. New public paths avoid
  cached older art while authored asset IDs remain stable. Obsolete public
  duplicates are removed; original exports and packed Blender files are retained.
- Actual V3 desktop arrival and tablet portrait-singing screenshots are archived
  under `art/glass-adventure/proofs/polish-2026-09-22/`. These are real raster
  captures, with the finale seeded only for camera/art inspection.
- Focused fog/render tests (17), platform/asset tests (9), host asset-delivery
  tests (3), package typecheck and the phone/tablet/desktop lobby loading test
  passed. Device frame-time measurement remains pending.

**Still to improve before calling the trial pristine:** the original Frost
texture has a diagonal seam; some source museum foliage remains fused; this
route still needs the authored planted islands and scenic framing described
above. Replacement GLBs repair the assets but do not complete that composition.

## Playtest handoff

Open `https://192.168.178.33:5300/glass-game/?layout=cloudway` for the trial or
`https://192.168.178.33:5300/glass-game/?campaign=1` for the museum map.
The 22 September server starts around 14:13 UTC and has a three-hour lifetime.
Hot reload and file watching are disabled. Restart from any directory with:

```sh
rtk proxy timeout 10800 /home/maff/.nvm/versions/node/v22.22.2/bin/node /home/maff/.codex/worktrees/00ad/mercurypitch-agent/apps/beside-cue/scripts/glass-playtest.ts --https --host 0.0.0.0 --port 5300
```

Stop with Ctrl-C. Reaching a safe landing without singing, reloading the same
URL, inspecting the portrait challenge, and zooming into the repaired balcony
are the useful acceptance checks for this batch.

## Evidence and ownership

The old public models match their archived exports and committed LFS hashes;
dotfiles cleanup did not remove their data. The defect was already visible in
the old frozen proofs. Preserve those proofs so the comparison stays honest.
Raw donors, guides, receipts, reproducible scripts, packed Blender projects and
review candidates belong in the repository's versioned art directories. Public
runtime assets change only after a visual and technical review of the candidate.

The existing draft PR is #807 on `feat/glass-museum-level-one`. Commit separate
correctness and art stages. Do not merge or deploy from this follow-up.

Technical reference: Three.js distinguishes a flat texture backdrop from a
surrounding environment; see its [background guide](https://threejs.org/manual/fr/backgrounds.html).
