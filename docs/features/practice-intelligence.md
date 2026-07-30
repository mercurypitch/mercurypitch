---
doc_id: practice-intelligence
title: Practice intelligence
area: practice
status: current
sources:
  - src/features/practice-intelligence/**/*.ts
  - '!src/features/practice-intelligence/**/*.test.ts'
related:
  - src/stores/exercise-history-store.ts
  - src/stores/practice-session-store.ts
  - src/features/exercises/types.ts
anchor:
  content: sha256:d9c66d1616ef63b8
  api: sha256:0b46627fc416c914
  files: 7
  reviewed: 2026-07-30
  commit: 6fa4769
---

# Practice intelligence

Turns practice history into three things: a difficulty level that follows the
user, a report on what they are bad at, and drills that target it. Everything
here is derived — the feature owns no history of its own, it reads
`exercise-history-store` and `practice-session-store`.

## Adaptive difficulty

`adaptive-difficulty.ts` keeps each exercise type at a level the user can
actually clear.

`computeEma(type)` takes the last 10 entries of that type (history is
newest-first, so they are reversed to oldest-first) and runs an exponential
moving average with `alpha = 2 / (10 + 1)`, about 0.1818. Returns `null` when
there is no history.

`suggestedDifficulty(ema, current)` maps that to a level in 1–10: at or above 90
step up, at or below 50 step down, otherwise hold. One step at a time, and it
clamps at the ends. `getSuggestedDifficulty(type, current)` does both in one call.

`clampDifficulty` and `difficultyLabel` are the shared helpers — labels are
Beginner (≤2), Easy (≤4), Medium (≤6), Hard (≤8), Expert above that.

`difficulty-scaling.ts` is the separate concern of *applying* a level:
`difficultyT` normalizes 1–10 to 0–1, `lerpDifficulty` / `lerpDifficultyInt`
interpolate a parameter across that range, and `difficultyFactor` gives a
multiplicative factor (default 8% per step). Exercises use these so difficulty
means the same thing everywhere.

`difficulty-store.ts` persists the per-type map and is the only writer:
`getDifficulty`, `setDifficulty`, `updateDifficultyFromEma`, `resetAllDifficulties`,
`getAllDifficulties`.

## Weakness analysis

`weakness-analyzer.ts` produces a `WeaknessReport` from three passes.

`findWeakExercises()` groups scores by type and compares the most recent 10
against the *next* 10 older plays. The disjoint window matters: comparing recent
against an all-time average that contains it mutes the signal, and for anyone with
10 or fewer plays the two sets would be identical, so the trend could only ever
read `stable`. A type is weak below 65 average; the trend is `improving` /
`declining` past a 5-point gap, else `stable`. Sorted worst-first.
`trends-computer.ts` uses the same windowing.

`findWeakPitches()` reads `collectNoteAccuracySamples()`, averages absolute cents
deviation per MIDI note, and flags notes above 20 cents with at least 3
occurrences.

`findWeakIntervals()` flags interval-trainer categories below 60% accuracy.

`generateWeaknessReport()` bundles all three with a `generatedAt` stamp;
`hasWeaknesses()` is the cheap "is there anything to show" check.

## Drills

`drill-generator.ts` turns a report into `MicroDrill`s. Each generator returns
`null` when it has nothing to work with, and each drops difficulty below the
user's current level so a drill is a win, not another failure:

| Generator | Exercise | Difficulty | Targets |
| --- | --- | --- | --- |
| `generatePrecisionDrill` | the weak type itself | current − 2 | a low-scoring exercise |
| `generateRangeDrill` | scale runner | current − 1 | the top 3 weak notes |
| `generateIntervalDrill` | interval trainer | current − 2 | the worst interval category |
| `generateStaminaDrill` | long note | current − 1 | the single weakest note |

Every drill carries a `reason` string quoting the user's own numbers, which is
what makes the suggestion legible rather than arbitrary. `generateDrills`
composes the full set.

`launch-override.ts` is how a drill actually reaches an exercise:
`setLaunchOverride` stashes the drill's config, the exercise reads it through
`launchDifficulty` / `launchTargetNote` / `launchTargetNotes` / `launchPattern`,
and `clearLaunchOverride` resets it.

## Trends

`trends-computer.ts` is the reporting surface: `computeWeeklyTrends`,
`computeMonthlyTrends`, `computeRollingAverage`, `computeImprovementRate`,
`computePracticeStats`, `computePerExerciseStats`, `getRecentScores`. Components
(`CalendarHeatmap`, `SparklineChart`, `WeaknessPanel`) render these and hold no
analysis logic.

## Gotchas

- Thresholds are module-private constants, not settings. The numbers quoted above
  are the contract this doc describes — `docs-sync` fingerprints exported values,
  but a change to a private threshold will not flag this page. Update it by hand.
- `findWeakExercises` and `computeEma` both window over the last 10 entries but
  disagree on purpose: the EMA weights recency inside the window, the weakness
  pass takes a flat mean and needs the older window for a trend.
- Drills subtract from *current* difficulty, which adaptive difficulty may have
  already lowered. A struggling user can compound down to level 1 across several
  drills; that is the floor, and it is intended.
