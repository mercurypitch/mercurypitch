# Final five passes before device acceptance

The owner approved all five passes, then a combined review and polish before
physical-device testing. This supersedes earlier pending design decisions for
these five items. No new islands, public release or merge is included.

Worktree: `feat/glass-mobile-playability`, PR #861, starting at `3eb1ccf5`.
The foundation and native testing profile are already merged through #807/#860.
Commit and push each coherent stage; keep #861 open for owner acceptance.

## Execution checklist

- [x] 1. Camera comfort: forward-biased follow during brief diagonal steering,
  smooth sustained turns, stable zoom/manual orbit and keyboard/touch behavior.
  Verify real input sequences and side-framed challenge transitions.
- [x] 2. Portrait finale: the picture and glass shatter together, while the frame
  remains and the earned collection portrait stays intact. Preserve protective
  glazing for archive discoveries. Inspect before/during/after rendered frames.
- [ ] 3. Merc musical phrases: three attractive short original phrases in the
  selected Gentle Whimsical D2 voice, configurable 3/5/7-note contours, reference
  playback matching the same key and pace judged by the microphone exercise.
  Preserve masters/receipts and a listenable audition; validate decoded references
  and negative controls through the actual pitch/judge path.
- [x] 4. Mobile rendering: measure pass and pixel costs, implement bounded quality
  policy and avoid redundant work without blindly decimating accepted source art.
  Compare matched frames and preserve shadows, glass and animation. Desktop
  counters and screenshots do not establish physical-tablet FPS or heat.
- [x] 5. Floating Museum: capture each island and both inter-island connections;
  inspect water source ponds, architectural steps, bridge landings, intersections,
  resting contact and focal silhouettes. Correct placement and improve stairs
  with coherent curved treads and natural arrivals. Preserve raw asset lineage.
- [ ] Review all five changes together; resolve findings and inspect polished
  phone/tablet/desktop layouts and actual rendered art at matched cameras.
- [ ] Run focused behavior/regression checks, required proportional pre-push gates,
  commit/push stages and review exact-head CI. Update the PR description.
- [ ] Provide the owner a current preview/build and concise device test route.
  Device singing, sustained performance and camera feel remain owner acceptance.

## Ownership and boundaries

Astra/root owns the museum placements, per-island inspection, integration review,
durable tasks, git and CI. Existing GPT 5.6 SOL max implementers own camera and
portrait, musical production, and measured rendering respectively. Coordinate
shared UI/runtime edits before touching them. Each uses an isolated test port and
output folder. The owner's existing HTTPS preview is left running during work.

## Acceptance details

Camera: brief W+A/D chords must not cause a second surprise swing on release;
manual orbit and zoom must remain predictable. Portrait: actual image-bearing
shards are visible, upright before the effect, and the reward is never destroyed.
Melodies: audible words, recognizable voice and comfortable musical contours;
no claim that accurate pitch alone proves good singing. Lazy-loaded references
must not play at a mismatched target key/pace. Mobile: record exact policies and
pass counts, with high quality available and no software-FPS-driven auto changes.
Museum: each pond has a readable source/lip, not a broad pool underneath stairs;
bridges meet usable terraces with consistent tread orientation and height.

Proofs live under `art/glass-adventure/proofs/final-pass-2026-09-24/` and source
productions retain their original manifests and Blender projects. Final comparison
images must come from the real runtime, not only offline render scenes.

## Checkpoints

- Started: clean worktree at `3eb1ccf5`; #861 had 42 passing applicable checks.
  Three bounded implementation tasks dispatched. Museum baseline inspection
  and shared plan started. None of this new batch is claimed complete yet.

- Camera stage: brief W+A/D chords and 150 ms side taps now preserve yaw;
  sustained lateral intent earns smooth follow after 240 ms. Root reviewed the
  intent boundary and integration. 39 focused unit cases and two real keyboard/
  touch browser cases passed; physical-device comfort remains owner acceptance.

- Mobile quality stage: root reviewed the stable Auto/High/Balanced selection,
  one-frame shadow reuse and immediate invalidation. 43 focused unit tests,
  real touch/persistence/320–1280 px host checks, actual-raster comparison and a
  production app build passed. Measured Balanced two-frame work fell 18.15% in
  submitted triangles and 40.93% in target pixels; this is not device FPS.
  UI copy was polished and the selector screenshot refreshed after review.
- Portrait stage: twenty focused unit cases and the final actual-runtime browser
  proof passed. All six desktop/tablet captures are populated and upright;
  picture-bearing shards remain visible without the panorama banner, mirrors
  reflect the room, and the earned image/save return intact. Independent review
  found no remaining source or proof issue.
- Museum implementation and matched per-island captures are complete; independent
  review caught and resolved the imported Conservatory plinth overlap. All 38
  focused tests and scoped lint pass, with refreshed screenshots and signoff.
- Combined review: portrait raster proof now rejects blank captures and includes
  a populated mirror; the banner/shard overlap is fixed. Sung
  references exposed consonant-dropout resets. Experimental tone carriers are
  excluded from delivery; the lyrical Encore will require real voiced evidence
  at every anchor while permitting a bounded consonant gap. First-gesture audio
  unlock, delayed-fetch cancellation and stale replay ownership are also under
  regression review. The provisional voice-bank count is not a delivery receipt.
- The required combined pre-push preparation/typecheck has not run for this new
  five-pass batch yet. Earlier gate receipts belong to the starting `3eb1ccf5`
  mobile-flow batch and must not be mistaken for final validation of these edits.
