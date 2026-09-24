# Twin Galleries — implementation and acceptance

Updated 2026-09-20. Local verification complete on `feat/glass-museum-level-one`, draft PR #807.
This is an implementation checkpoint, not permission to merge or publish.

## Scope

Complete the owner's mirror stripe and artwork-button fixes, then deliver the
N3 shared lesson/campaign foundation and N4's first playable Twin Galleries
route. Existing held-note levels, save identities, ordinary movement, selected
Merc voice, music and games-off store builds remain the acceptance baseline.

The owner accepted the previous hands, wall mounting, artwork inspection,
room decoration and tablet controls. Previous revision `b9892888` completed
CI with 33 successful checks and one skipped production check. The diagonal mirror stripe came from the selected frame backing entering
the reflection camera clip plane; the same-pose proof now shows the correction.

## Architecture

- `ChallengeDefinition` belongs to each placed exhibit, independently of the
  visual vessel prefab. It dispatches either a held pitch or an ordered pair.
  Both reuse the original capture-clock hold judge and freshness checks.
- Runtime target roles are `comfortable`, `low`, `high`. The player supplies
  comfortable pitches; the level supplies hold duration/tolerance. A lower/higher
  pair must be distinguishable without imposing a fixed key or interval.
- A shared voice controller owns calibration, reference playback, microphone
  subscription, cancellation and one generation token. It locks movement during
  preparation. Playback frames cannot assess themselves; cancelled or old visits
  cannot grant progress or resurrect recording.
- An ordered pair emits transient step/reset feedback. Only the final successful
  response shatters the exhibit, saves its completion ID and opens a route gate.
  Partial notes are never durable progress. Silence allows a comfortable pause;
  a sustained wrong-order note resets the current response.
- `SavedProgress` stays at version 1 with independently namespaced level IDs.
  Tutorials gain a gallery/lesson/revision preference. The old global dismissal
  migrates only to the original held-note teaching, never the new pair lesson.
- The shared campaign component mounts exactly one adventure and disposes it
  before changing levels. First Light, Glassworks Journey and Twin Galleries
  can be entered independently, continued, replayed, or visited sequentially.
  Replay starts from an in-memory fresh save; load failure or leaving before any
  new gameplay save cannot erase the completed durable visit.
- Web preview uses `?campaign=1`; direct development previews remain available.
  BesideCue's games-enabled entry uses the same chooser. Default store builds
  remain games-off. Final public MercuryPitch route/CTA is a later delivery task.

## Handcrafted route

Eighteen room/presentation placements form a folded museum route with forgiving,
continuous floors and quarter-turn connections. No new slope or jump requirement
is introduced while teaching the new voice mechanic.

| Section                   | Required challenge                                  | Optional discovery   | Art and pacing                                            |
| ------------------------- | --------------------------------------------------- | -------------------- | --------------------------------------------------------- |
| Warm lower gallery        | Find and hold a comfortable lower pitch             | Another lower hold   | Amber palette, Low Note Keeper, familiar garden dressing  |
| Cool upper gallery        | Find and hold a comfortable higher pitch            | Another higher hold  | Celadon palette, High Note Muse, archive ornaments        |
| Windowed listening bridge | Transition; no timed singing while moving           | Views outside        | Breathing room before the paired response                 |
| Shared court              | Sing lower, then higher                             | Repeat the same pair | The Interval Between painting, open listening pad         |
| Portrait gallery          | Repeat the same pair, without increasing difficulty | —                    | Portrait exhibit, live mirror, next passage reveal        |
| Panorama terrace          | Walk/jump through the resonance veil                | View the journey     | Existing completion celebration and campaign continuation |

Four main exhibits and three optional exhibits. Room checkpoints retain opened
paths. The 10–15 minute first-visit goal remains a target until a real playtest
measures traversal, teaching and microphone retries.

## Art status

The three original V6 paintings now have full-resolution WebP derivatives,
source/output hashes and a reproducible exporter. They reuse the measured V5
frame and inset, with original inspection stories; the campaign uses the interval
painting. Runtime downloads include only assigned paintings.

Twin-Tone Harp is integrated against the listening court's east wall, with a
measured base solid and actual renderer proof. Opaline Echo Amphora V2 has an
open cavity, 18 closed fracture pieces and reviewed opal/gold/jade materials;
it is integrated at the optional court exhibit, with actual intact and
shattering render proofs. Amber Cadence Urn and Celadon
Lark Decanter remain production candidates, with approved existing recipes
keeping those encounters playable. A five-credit Celadon remesh failed topology
and is preserved as rejected input. No candidate replaces a live breakable
until geometry, materials and the actual runtime rendering pass review.

## Acceptance checklist

- [x] Shared hold/ordered-pair contracts, typed events, target preflight and authoring migration.
- [x] Existing hold parity and core final-only-save regressions.
- [x] Three V6 painting derivatives with preserved source masters.
- [x] Campaign phone/tablet/desktop fit, deferred model loading and late-load retirement tests.
- [x] Top-center artwork offer; neighboring help remains clickable/tappable.
- [x] Shared voice controller and comfortable pair calibration integration.
- [x] Tutorial independence, level swap/replay and progress restoration checks.
- [x] Full Twin route traversal, gate/anchor/checkpoint tests and scene screenshots.
- [x] Mirror stripe causal fix, same-pose render proof and targeted regression.
- [x] Real PCM low/high/pair browser exercise, references excluded from assessment.
- [x] Compiled UI/style inspection and relevant typecheck.
- [x] PR preparation/index/format; four strict lint findings corrected with targeted rechecks.
- [x] Prepare reviewed commits for the existing PR; no merge or release.
- [ ] Confirm pushed-revision CI; canonical HANDOFF records the exact revision/status.
- [x] Owner completed Twin Galleries and accepted the lower/higher/pair learning sequence.
- [ ] Recheck latest visual polish; measure sustained performance separately.

## Next after this batch

1. Tune the player's low/high calibration, teaching clarity and journey pacing
   from device feedback. Do not expand mechanics before this feels comfortable.
2. Finish the remaining V6 vessel fracture/material production; substitute content
   recipes without rewriting challenge or route logic.
3. Design the singing-quality/collection pilot with the owner before implementing
   grades, coins or stars. Keep exploration rewards separate from vocal evidence.
4. Build the Resonance Conservatory's settle-then-wave lesson on the same runner.
5. Continue the portrait album, optional window/art side quests and Coda Echo
   melody/opt-in recording ideas from their saved plans. They are not included here.

## Device test for this batch

Open `/glass-game/?campaign=1`, then enter **Twin Galleries**. The direct development
route is `/glass-game/?layout=twin-galleries`. The older Journey and First Light
remain separate choices and retain their progress.

1. Follow the warm gallery to its lower-note exhibit. Use an easy lower note;
   the game remembers it independently of the original comfortable-note lesson.
2. Follow the opened route into the cool gallery. Pick a comfortable higher note
   that sounds clearly different. If the two ranges overlap, try a little higher
   without straining, or use **Find my notes again**.
3. At the court, listen to both references and answer lower then higher. A breath
   between them is fine. **Hear both notes again** resets that attempt; the first
   note alone must not open the exhibit. The portrait repeats the same pair.
4. Try the three optional exhibits, walk through the final veil, return to the
   chooser, and revisit another gallery. Reload once to check the saved checkpoint.
5. Check the mirror close up and while moving away. **View artwork** should be
   centered in the first header row, above guidance and clear of Help on tablet.
   The exit rim and its finish sparkles should remain above the floor.

Record whether the second note feels comfortable, whether directions are clear,
and the approximate first-visit duration. Sustained tablet heat/frame pacing and
real microphone behavior remain the most useful owner evidence.

## Evidence and limits

The subsequent owner-feedback polish has separate actual scene proofs at
`../proofs/polish-2026-09-20/`: adaptive mirror capture and the ready/flourishing
exit. Compiled header layout is checked from 320 through 1440 CSS pixels, with
actual mouse/touch interaction tests. Close mirrors use bounded 1024/512 targets;
distant mirrors retain cheaper 384/256 targets. Selection hysteresis prevents
resolution chatter. These are correctness proofs, not physical-device frame-time
or thermal measurements. The earlier evidence below records the playable
campaign baseline.

- Shared glass package: 43 files / 347 tests passed, plus its TypeScript check.
- Root `pnpm beside-cue:typecheck`: passed across the shared/mobile packages.
- Artwork controls: four browser cases passed, including actual mouse/touch at
  320, 1024 and 1440 widths. The final four campaign cases pass for responsive
  entry, checkpoint/tutorial independence, retired loading visits and failed
  replay preserving a completed save. The new campaign suite is in the PR gate.
- Mirror: actual identical-pose before/after captures are archived at
  `../v5/proofs/mirror-backing-sept20/`; selected frame/backing visibility is
  restored even if reflection rendering throws. No mesh re-triangulation was
  needed after the causal A/B isolated the backing.
- Twin full-route simulation covers gates, optional anchors, physical joins,
  checkpoints and completion. Actual warm/cool/court render evidence is at
  `../v6-level2/proofs/twin-galleries/` (zero reported asset/page errors).
- Games-enabled compiled host and styles built successfully. Its native asset
  verification passed; `../v6-level2/proofs/campaign/` contains phone/tablet/
  desktop campaign and calibration-panel checks. Those UI checks suppress raster
  work; the separate scene proofs render geometry. Neither measures device FPS.
- Replay failure browser regression passes and retains the exact completed save.
  PR preparation formatted the changed branch files and found four strict lint
  issues; explicit null checks and a constant declaration fix them. Targeted
  lint and whitespace checks pass. Real PCM Twin cases pass: overlapping range
  rejection/recovery, ordered response, partial non-save, reference replay, full
  completion and microphone shutdown. The final full voice browser suite passes
  all nine cases in 3.4 minutes, including all seven prior permission, interruption
  and control regressions. Two fresh-visit helper regressions and its targeted
  package typecheck also pass. Independent campaign/controller review found no
  remaining actionable issue. Pushed-revision CI remains the next gate.
