# Replay difficulty and level stars — proposal

Status: planning only. Owner requested on 2026-09-21 alongside the challenge-camera
and Conservatory sway fixes. Those fixes are current work; difficulty selection,
new star awards and Legend mode are not implemented or approved by this document.

## Product direction

First visits use the easy authored lesson. Finishing that route earns one level
star. Later visits offer explicit two-star and three-star challenges on the same
beautiful level. A player chooses the goal before entering; an easier replay stays
available. Coins measure discoveries, and the level portrait is a completion
collectible, neither multiplied nor taken away by replay difficulty.

This changes the earlier star meaning. The current Journey pilot grades ONLY the
final portrait's time-weighted pitch accuracy, using one to three stars. It does
not grade an entire route or support difficulty tiers. Never silently reinterpret
those saved results as proof of a harder level clear.

Proposed language: First visit / Two-star challenge / Three-star challenge.
Names such as Explorer / Performer / Virtuoso are optional art copy, not settled.
The entry card explains the actual skill requirement, not just an opaque difficulty
label. The level-end card shows highest completed tier, optional discoveries and
portrait ownership in separate rows. Accuracy feedback can remain subordinate
feedback without a second competing row of stars.

## Candidate parameters to audition

These are design candidates, not clinical targets or validated difficulty values.
The owner's proposed 2–3 / 5 / 10 second holds are preserved for comparison; do not
apply a global multiplier to every encounter. A ten-second demand repeated across
all vases could become tedious and test stamina more than the skill being taught.

| Lesson           | One-star first visit                            | Two-star replay candidate                          | Three-star replay candidate                                                                         |
| ---------------- | ----------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Comfortable hold | 2–3 seconds near target, forgiving grace        | Around 5 seconds on selected main exhibits         | Compare one 6–10 second finale against two shorter accurate phrases with a breath between           |
| Low/high pair    | Comfortable calibrated pair; patient transition | Same interval, more stable short notes             | More precise arrival/centering and an authored short sequence; no automatic extreme range expansion |
| Gentle sway      | Settle, then two clearly taught broad sways     | Repeatable sways with a broadly consistent centre  | Better control of return and consistency, with a demonstrated pattern; not arbitrary speed          |
| Later melody     | Short original demonstrated contour             | Add one familiar phrase or tighten a timing window | Authored musical phrase with accuracy and expression goals; recording remains separately opt-in     |

Keep confidence, sample freshness, detector latency and minimum microphone quality
rules independent of difficulty: a harder tier must not reward stale samples or
punish a noisy device more severely. Authored profiles may tune target tolerance,
required voiced time, allowed dropout/grace and taught pattern complexity. Do not
change all knobs at once; name the learning objective for each tier.

A player's comfortable range remains calibrated across tiers. Loudness is never a
scoring target. The 30-second uninterrupted Legend hold is retained as an owner
brainstorm, not a proposed default. Recommend testing a sequence of short connected
phrases with breath breaks as the Legend finale instead. NIDCD recommends resting
the voice and avoiding vocal extremes; it does not establish these proposed game
hold durations. [Voice-care source](https://www.nidcd.nih.gov/health/taking-care-your-voice).

## Level-clear rules

- Default first visit is easy. Subsequent visits can freely replay easy; the
  higher tiers unlock after the first clear, with both visible for comparison.
- A selected tier must clear every required encounter and the exit under that
  profile. Optional vases never prevent the star or portrait award.
- Save checkpoints within that exact attempt/profile. A hard replay cannot inherit
  broken easy vases and therefore complete without singing the harder challenges.
- Failed or abandoned attempts keep earlier best clears, coins and portraits.
  Switching difficulty starts a fresh attempt and preserves the other checkpoint.
- A three-star clear awards the highest tier directly; whether users must clear
  two stars first is a decision, not a technical requirement. Recommended: no grind.
- Custom practice settings are allowed later but do not certify a ranked tier unless
  they exactly match an authored profile. Label practice clearly.
- Legend is a distinct gold crest above the three-star set, with a bespoke finale
  or optional Cloudway Trial. It never blocks the normal museum route or portrait.

## Existing architecture and proposed seam

Current shared paths are all under `packages/glass-game/src/`:

| Existing component                                         | Proposed extension                                                                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `authoring/contracts.ts`, `authoring/compose-level.ts`     | Data-owned profile catalogue and explicit encounter overrides keyed by stable local IDs; resolve once before composing a run           |
| `contracts.ts` ChallengeDefinition                         | Reuse typed hold/pair/settle-wave parameters; future judges add explicit variants rather than checking level IDs                       |
| `core/hold.ts`, `core/challenge.ts`, `core/settle-wave.ts` | Judge the resolved immutable profile; no difficulty branching in render code                                                           |
| `core/progress.ts`, `browser` host persistence             | Distinguish durable collection from attempt state; checkpoint key includes level/profile/revision and cannot merge breaks across tiers |
| `core/rewards.ts`                                          | New level-tier completion evidence; retain existing accuracy records as historical practice evidence                                   |
| `ui/GlassCampaign.tsx`, `ui/MuseumJourneyProgress.ts`      | Accessible replay selection and distinct highest-tier/portrait/discovery presentation                                                  |
| Native and web adapters                                    | Same schema/migration; no duplicate host-specific star rules                                                                           |

Proposed concepts, not final code: `DifficultyProfile{id, revision, overrides}`,
`RunIdentity{levelId, contentRevision, profileId, profileRevision}` and
`LevelClear{runIdentity, requiredEncounterIds, completedAt, earnedTier}`. Validation
rejects missing encounter overrides, invalid timing ranges or unknown profile IDs.
Runtime writes are idempotent. A profile change is a new policy revision rather
than silently retuning old results. Versioning and optional analytics never imply
raw voice storage; ordinary pitch analysis remains ephemeral.

## Save migration

Current progress version 2 merges completed-breakable IDs and durable rewards.
That union is useful for ordinary exploration but is unsafe across tier attempts.
Introduce a versioned envelope with independent `collection`, `bestClears` and
`activeAttempts`. Never use the current cross-run completion union to certify tiers.

Legacy completed routes can be marked as a historical easy route completion under
an explicit legacy policy. Preserve original accuracy stars and evidence metadata
without labelling them hard-tier stars. The product decision on whether the first
level-star is shown immediately or after replay must be approved and tested; do
not erase anyone's prior three-star portrait result. A migration notice can explain
that portrait performance lives in the collection and level stars now track replays.
Back up/round-trip old saves before migration, reject corrupt tiers, and test native
and web reload/offline/duplicate-award paths.

## Build sequence after approval

1. Audition one hold exhibit at the candidate durations on desktop and two real
   microphones. Measure comprehension, success, fatigue feedback and retry time.
2. Agree on first-clear/accuracy migration and clear UI copy with the owner.
3. Implement profile resolution plus validation without changing existing levels.
4. Add revisioned attempt persistence and clear evidence, with old-save fixtures.
5. Pilot replay selection on Glassworks Journey only. Default route unchanged.
6. Add pair and sway profiles only after reliable real-microphone playtests.
7. Explore the separate Legend crest and custom practice after the pilot works.

Tests: easy cannot certify hard; completed easy targets remain required in hard;
profile switching and old saves preserve collectibles; reload resumes exact profile;
old accuracy results are not fabricated difficulty clears; duplicate exits do not
award twice; custom settings do not produce ranked stars; clear waits for all
required encounters, never optional ones.

## Decisions for the later workshop

- Are three-star holds primarily longer, more accurate, or a short musical phrase?
- Can a player jump directly from one to three stars? Recommendation: yes.
- Show historical portrait accuracy separately, or archive it behind Details?
- Should Legend be a musical finale, a Cloudway Trial, or let players choose?

None of these decisions blocks the current camera and sway fixes.
