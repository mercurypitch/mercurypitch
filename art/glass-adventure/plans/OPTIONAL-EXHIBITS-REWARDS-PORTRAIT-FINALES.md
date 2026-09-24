# Optional Exhibits, Rewards, Portraits, and Later Voice Finales

**Later proposal (2026-09-21):** The owner proposed level stars for selected replay
difficulty tiers, independent of coins/portraits. See
[REPLAY-DIFFICULTY-AND-LEVEL-STARS.md](./REPLAY-DIFFICULTY-AND-LEVEL-STARS.md).
The accuracy-star pilot below describes current behavior and historical design;
it is not yet migrated or replaced by that proposal.

**Status:** Design only; implementation deferred.
**Date:** 2026-09-20

This plan describes an optional reward layer for the longer Glass Adventure museum. It should be scheduled after the current enclosed-chamber work and fitted to the mechanics ladder in `<user-dotfiles>/besidecue/glass-adventure/MECHANICS-MAP.md` and `<user-dotfiles>/besidecue/glass-adventure/NEXT-MASTER-PLAN.md`. The existing forgiving held-note route remains the baseline. Optional rewards must enrich exploration without becoming a second progression gate.

The grading and collection ideas in `<user-dotfiles>/besidecue/glass-adventure/GRADES-COLLECTION-DESIGN.md` remain useful research, but the product language proposed here is narrower: **one, two, or three singing-quality stars**, kept separate from coins, discoveries, portraits, and route completion. Exact scoring is a later design and tuning decision.

## Product intent

The museum should reward three kinds of play without collapsing them into one opaque score:

1. **Exploration rewards** acknowledge curiosity: optional exhibits, side passages, finite coins, and app achievements.
2. **Singing-quality stars** reflect the evidence from one voice action: one, two, or three stars after a successful attempt, or `Not graded` when the capture is insufficient.
3. **Legend portraits** form the long collection: exactly one authored portrait collectible in each of ten levels.

Main-route success must remain generous. A player who completes the required voice action progresses even when the action receives one star or cannot be graded. Portraits, coins, and optional routes must never require a high-quality star result.

## Reward lanes

| Lane                  | Meaning                                                  | Earned by                                                                | Must never mean                                               |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Route completion      | The player finished the level's required learning action | Existing encounter success rules                                         | A judgment of singing talent                                  |
| Singing-quality stars | Optional feedback about the captured action              | Accepted pitch/control evidence from that attempt                        | Currency, exploration completion, or a route lock             |
| Coins                 | Finite authored exploration value                        | Visiting optional spaces, opening an exhibit, or completing a side quest | Real-money value, randomized loot, or a farmable grind        |
| App badges            | Named achievements across the adventure                  | Clear authored milestones                                                | A platform achievement promise until the host contract exists |
| Legend portrait       | One persistent collection object per level               | Reaching and completing the authored portrait reveal                     | A reward gated by two- or three-star singing                  |

The end-level scorecard may display these lanes together, but it must not sum them into a single score that hides what the player did.

## Optional exhibit vocabulary

### Voice-breakable windows

An optional resonant window can sit in a real alcove or side room. A held note, learned low/high choice, or later mechanic breaks only its designated glass. The result may open a view, reveal light, uncover a coin cache, or expose a short path.

- The window needs an obvious frame, glazing surface, and safe approach.
- Its authored collision must match the visible glazing before and after the break.
- Breaking it must not be required to recover from a checkpoint or finish the main route.
- The broken state and collected rewards need stable save IDs.
- Window difficulty should reprise a mechanic the player already learned rather than introduce an unexplained rule.

### Painting glazing

A museum painting may have a protective glass pane that responds to voice. The voice interaction breaks or releases the **glazing**, never the painting. The painting and frame remain intact and readable after the interaction.

This is a strong candidate for the level's Legend portrait reveal: the glazing clears, the frame receives a light cue, and the portrait becomes collectible or inspectable.

### Side quests

A side quest is a short authored detour, not a parallel campaign. Suitable forms include:

- restore one dark exhibit with a familiar note;
- follow a small chain of resonant panes;
- cross a modest movement challenge to reach a viewing niche;
- reprise the current level's voice mechanic with a slightly tighter optional target;
- discover a curator detail or environmental story beat.

Every side quest needs a safe return to the main route, bounded checkpoint behavior, and a declared reward. Repeating a completed quest must not mint more coins or duplicate a portrait.

### Floor-vase dressing

Floor vases can make chambers feel curated and inhabited. Most should remain visual dressing so the world does not imply that every object is breakable. A small, clearly signaled subset may become optional voice encounters using the existing vessel language.

- Decorative vases should have no collision, or a simple collision proxy that agrees with their footprint.
- Interactive vases require stable encounter and broken-state IDs.
- Placement must preserve the playable path, camera movement, and doorway clearance.
- Reuse shared vase recipes and materials with per-instance transforms; avoid unique heavy assets for every room.

## Coins and their meaning

Coins should represent museum discovery or restoration credit, not purchasing power borrowed from an unrelated economy. They are finite, authored, and level-specific. The scorecard can show `found / total`, while the collection area can show a campaign total.

The first pilot can collect coins without a spending surface. Before a larger rollout, decide whether totals remain a pure exploration record or unlock small, nonessential curation choices such as cabinet labels, plinth finishes, or gallery accents. The system should not include real-money purchases, random rewards, consumable power, loss on failure, or endlessly respawning coins.

Proposed invariants:

- every coin has a stable ID and authored location;
- collection is idempotent across reloads and checkpoints;
- coin totals never affect voice grading;
- missing coins never block the next level;
- changing a level's coin set requires a content revision and save migration policy.

## One, two, and three singing-quality stars

Stars are feedback about one successful singing action. They are not a general rating of the player. They must use valid pitch, timing, and control evidence appropriate to the authored challenge; loudness alone must never improve the result. Stars cannot mint coins or create a repeatable reward farm.

A possible language for later tuning is:

- **One star:** the action succeeded and provided usable evidence.
- **Two stars:** the note or pattern was centered and controlled for a meaningful portion of the attempt.
- **Three stars:** the attempt showed strong accuracy and control for the authored challenge.
- **Not graded:** the route action succeeded, but the system lacks enough reliable capture evidence to make a fair quality judgment.

These descriptions are placeholders for a future scoring workshop. Thresholds, feature windows, microphone confidence, transposition policy, accessibility accommodations, and whether required encounters receive stars at all remain open.

Rules that should survive that workshop:

- success and route progression remain independent from star quality;
- a collectible is granted on the intended successful interaction, never only for a high star result;
- replay may improve a personal best but never downgrade it;
- the saved result includes the challenge revision so later tuning does not silently reinterpret old attempts;
- a quality score may use bounded capture features without saving raw microphone audio;
- low-confidence input resolves to `Not graded`, not a punitive result.

### Candidate level-star aggregation

The scorecard also needs a simple level-level result distinct from the per-attempt and personal-best records. A candidate for later tuning is:

1. Use only the level's **required graded encounters**. Optional exhibits never raise or lower the level singing result.
2. Normalize the accepted evidence within each authored mechanic so levels with more repeated encounters do not overweight that mechanic.
3. Give each required mechanic equal weight when calculating the level evidence summary.
4. Map the normalized summary to one, two, or three level stars using thresholds that remain to be designed and play-tested.
5. If too few required encounters provide valid evidence, show the level as `Not graded` rather than filling missing evidence with a low score.

This is an aggregation candidate, not a settled formula. Minimum evidence coverage, mechanic normalization, best-attempt versus completed-attempt policy, and star thresholds belong in the future scoring brainstorm.

## Legend portrait collection

The campaign collection contains **ten portraits: one authored Legend portrait for each of ten levels**. Each portrait should have a stable `portraitId`, `levelId`, `legendId`, title, collection order, art recipe, descriptive copy, and representation-review status.

The normal level finale is:

1. complete the required encounter and open the final route;
2. reach the portrait presentation space;
3. perform the authored reveal or collect interaction;
4. add the portrait to the persistent collection;
5. show the end-level scorecard.

The portrait may sit behind voice-reactive glazing or within a final cabinet, but collection should depend on completing the intended action rather than earning two or three stars. A missed optional exhibit elsewhere in the level must not prevent the portrait finale.

### Portrait representation treatment

The Legends collection direction is established context. The remaining representation choice is an art treatment: a conventional portrait or caricature behind a separately breakable glazing layer, or a caricature embedded into the glass artwork itself. The first keeps collectible art and interaction layers independent; the second makes the glass object the hero asset and needs a clear collected-state presentation after it breaks.

The pilot should compare those treatments for readability, charm, asset reuse, break-state continuity, and collection-cabinet presentation. Image generation is not part of this planning task.

## App badges and achievements

Badges can acknowledge durable milestones that span levels. Candidate categories include:

- find the first optional exhibit;
- collect every coin in one level;
- collect a level's Legend portrait;
- collect all ten Legend portraits;
- complete one optional encounter for each learned mechanic;
- revisit and improve a personal star result;
- finish a level without implying that maximum stars are required.

These should begin as app-owned achievements with stable IDs and local persistence. Platform achievements, account synchronization, notifications, and cross-device state are separate host decisions. Badge names and requirements should be data-authored, localized, and revisioned.

## End-level scorecard

The scorecard should explain the completed visit at a glance:

- required level completion;
- optional exhibits found out of the authored total;
- coins found out of the authored total;
- singing-quality stars per graded challenge, with `Not graded` where appropriate;
- the level's Legend portrait state;
- newly earned badges;
- clear actions to continue, revisit the level, practice a voice challenge, or inspect the collection.

Coins and stars need separate visual rows and separate totals. Exploration completion should also remain distinct. A player should understand why each item changed without decoding a combined percentage.

## Mechanics ladder

Optional encounters should follow the established teaching order instead of racing ahead of it.

| Ladder stage                | Optional exhibit fit                                                         | Reward fit                                                            |
| --------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Held-note journey           | One resonant window or clearly marked vase using the familiar sustained note | Finite coins, one portrait reveal, basic discovery badge              |
| Low/high pair               | Two panes or two side niches that answer distinct pitch bands                | Level portrait and a low/high discovery badge                         |
| Stabilize and wave          | An exhibit that asks the player to hold steady, then vary deliberately       | Stars can distinguish control only after evidence and fairness tuning |
| Short echo phrase           | Merc presents a bounded reference and the player answers                     | Later opt-in record/replay experiment; not part of the early pilot    |
| Standing-wave or prism room | A room-scale authored response using already learned skills                  | Richer side quest and portrait finale                                 |
| Collection garden           | Inspect portraits and replay selected encounters                             | Completion display, no grind loop                                     |

The rollout should still add one small, tested encounter before building a full wing. Historical prototypes may inform the design but must not be imported wholesale into current physics, schemas, or scoring.

## Later Merc reference and opt-in recording

A later echo or phrase mechanic may let Merc demonstrate a very short reference:

- one or two words;
- one short spoken or sung line;
- one brief melodic sequence.

The player can answer live for gameplay without creating a shareable recording. Recording is a separate, explicit opt-in action.

### Authored reference and voice-production boundary

Merc's chosen speaking identity does not automatically provide a trustworthy sung reference. An ElevenLabs or other text-to-speech audition can establish speaking character, but it must not be assumed to reproduce guide pitches or rhythm accurately.

Each melodic reference should therefore begin as authored note events with explicit pitch, duration, tempo, and phrase timing. A notation or synthesis reference provides the verifiable guide. The presented vocal performance then needs a separate capability spike and an independently checked production path: a provider that can sing the authored notes reliably, an approved recorded performer, or a deliberately processed performance aligned to the guide. Speaking-voice enrollment and sung-reference production remain separate decisions.

The player should be able to select a comfortable transposition where the mechanic permits it. The same transposition must drive the guide notation or synthesis, presented reference, and scoring target. Reference lyrics should be short and original or clearly public domain; do not lift words, melody, or a recognizable sequence from an existing protected song.

Open questions include which provider or performer can meet pitch and timing tolerances, how much processing still sounds like Merc, whether spoken phrases and sung phrases share one identity, and which transposition choices preserve the learning goal. These belong in a later voice-capability and scoring brainstorm rather than the first rewards pilot.

### Recorder consent and privacy contract

1. Explain what will be recorded and why before requesting microphone capture for replay.
2. Start only after the player taps a clear `Record` control.
3. Show an unmistakable recording state with elapsed time and `Stop`.
4. Let the player replay, rerecord, or delete the take locally.
5. Never upload automatically.
6. Never share automatically.
7. Require a separate, deliberate `Share` action after preview, then use an approved host share surface.
8. Define local retention and deletion behavior before implementation; cancel should not leave an unexplained recording behind.

Pitch or phrase evaluation can operate on bounded extracted features and discard raw audio. A replayable recording is a different artifact with a different consent state. The two flows must not be conflated in UI, storage, analytics, or code contracts.

Open privacy work includes child and family use, permission copy, offline behavior, file encryption, retention duration, account synchronization, export format, moderation implications, and platform-specific sharing rules.

## Reusable authoring and runtime contracts

Names are provisional, but the responsibilities should remain reusable and level-agnostic:

```ts
interface OptionalExhibitDefinition {
  id: string
  revision: number
  kind: 'resonant-window' | 'painting-glazing' | 'side-quest' | 'vase'
  encounterId?: string
  rewardIds: string[]
  presentation: ExhibitPresentation
  collision?: ExhibitCollisionBinding
}

interface RewardDefinition {
  id: string
  kind: 'coin' | 'badge' | 'portrait'
  amount?: number
  once: true
}

interface SingingQualityResult {
  challengeId: string
  challengeRevision: number
  result: 1 | 2 | 3 | 'not-graded'
  evidenceVersion: string
}

interface PortraitCollectibleDefinition {
  portraitId: string
  levelId: string
  legendId: string
  collectionIndex: number
  assetRecipeId: string
  representationStatus: 'undecided' | 'review' | 'approved'
}

interface LevelRewardSummary {
  levelId: string
  optionalFound: number
  optionalTotal: number
  coinIds: string[]
  qualityResults: SingingQualityResult[]
  portraitId?: string
  badgeIds: string[]
}
```

Additional host-neutral contracts will be needed for achievement presentation, reference cues, recording consent, local recording storage, and explicit sharing. Core adventure content should declare intent; the app host should provide permissions, durable storage, and sharing capabilities. Avoid level-ID branches in runtime systems.

Every visual that covers a physical proxy should name the proxy explicitly. Interactive glazing or a gate must remain a separately toggled visual from permanent frames and walls. Saved exhibit state, collision state, and visible state must agree after reload.

### Save compatibility

- Existing completion saves remain valid.
- New optional rewards default to undiscovered rather than inventing past results.
- Historical completions must not receive fabricated singing stars.
- Stable IDs survive asset recipe changes.
- Removing or replacing a reward needs a migration or a documented legacy entry.
- Recording references must not enter the normal adventure save unless the player explicitly keeps a take.

## Asset production pipeline

Asset work starts only after the content and representation decisions are accepted.

1. **Portrait-treatment gate:** choose separate glazing over a portrait or a caricature embedded in the glass, then settle the visual language, labels, references, and collection presentation.
2. **Concept gate:** use image generation only for approved concept tasks such as frame motifs, glazing treatments, coin language, badge families, and portrait studies. Preserve prompts and accepted references.
3. **3D generation gate:** use Meshy where it is efficient for frames, vases, coins, ornaments, or architectural dressing. Do not use it as a substitute for authored openings, exact collision, or interactive fracture design.
4. **Blender normalization:** establish natural scale, foot-center origin, orientation, clean transforms, UVs, atlas/material assignments, LOD where justified, interaction sockets, fracture pieces where required, and named collision proxies.
5. **Source preservation:** retain original generation downloads, receipts, prompts, packed Blender sources, and an immutable source export. Produce optimized runtime GLBs separately.
6. **Runtime verification:** verify texture fidelity, front/back/interior faces, real apertures, collision agreement, broken and collected states, draw calls, triangle and texture budgets, mobile memory, and save/reload behavior in the actual game.

Shared materials and reusable recipes should carry the museum identity. Per-level distinction should come from composition, light, color accents, portrait art, and a bounded set of hero objects rather than many unique heavy meshes.

## Proposed delivery sequence

- [ ] **Decision workshop:** settle coin meaning, initial star language and level aggregation, portrait treatment, badge scope, and the recording privacy boundary.
- [ ] **Data-contract spike:** author and validate one level's optional exhibit, rewards, portrait definition, and scorecard data without building a campaign-wide system.
- [ ] **Held-note pilot:** add one optional resonant exhibit and finite coins to a future level slice; preserve the main route unchanged.
- [ ] **Portrait finale pilot:** produce one approved portrait, glazing interaction, collection entry, and end-level scorecard.
- [ ] **Collection pilot:** prove a small multi-level cabinet before committing to all ten assets.
- [ ] **Ten-level rollout:** author exactly one Legend portrait per level after the pilot and representation review pass.
- [ ] **Later echo/phrase experiment:** prototype Merc reference, explicit recording, replay, deletion, and host sharing only when that mechanic reaches its ladder stage.

These are future tasks. None should be marked complete because this plan exists.

## Acceptance gates for a future pilot

- Main-route completion works with zero optional rewards collected.
- One-star or `Not graded` success never blocks progress or the portrait.
- Coins, stars, exploration, badges, and portrait state remain visibly distinct.
- Every optional reward is finite and idempotent across checkpoint and reload.
- The portrait collectible survives reload and appears in its collection slot.
- Visual break state, collision state, and camera occlusion agree.
- Missing microphone evidence produces a fair fallback.
- Any recorder prototype remains opt-in, local by default, deletable, and incapable of automatic upload or share.
- The level meets its measured draw-call, geometry, texture, and mobile-memory budgets in the actual game.

## Decisions reserved for future brainstorming

1. Are coins a permanent exploration tally, or can they unlock nonessential museum curation choices?
2. What evidence and thresholds distinguish one, two, and three stars, and which encounters should be graded?
3. Should the star name remain “singing quality,” or use a gentler museum-specific term?
4. Should the portrait use separate breakable glazing, or should the caricature be embedded in the glass artwork?
5. Does every portrait use one visual treatment, or can level families use distinct styles?
6. Which badges are local app achievements, and which, if any, should map to platform services later?
7. Which mechanics stage first permits Merc reference recording?
8. How long can a kept recording remain local, and what exact delete/export/share controls are required?
9. Does replay preserve the original scorecard, show a new personal best, or both?
10. What coin, optional-exhibit, and asset budgets keep ten levels authored rather than repetitive?

## Explicit non-goals for this plan

- implementing these systems during the current enclosed-chamber milestone;
- generating portrait or reward art now;
- changing the current held-note success rules;
- adding leaderboards, daily streaks, randomized loot, real-money purchases, or social pressure;
- uploading microphone audio or creating a sharing backend;
- importing historical prototype physics or schemas without a bounded current-game design;
- claiming that the ten-level campaign, grading, collection, recorder, or scorecard already exists.
