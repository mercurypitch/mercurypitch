# Exercise Controller Refactor Plan

Status: **proposed** (not started). Tracks backlog item **R1** from
[`docs/reports/code-review-2026-07.md`](../reports/code-review-2026-07.md).

## Why

There are 17 exercise controllers under `src/features/exercises/*/`
(`use-*-controller.ts`, ~130–300 lines each). They fall into two families
that each re-implement the same play → listen → match → evaluate → advance
state machine, with per-controller copies of the timer/cancellation/dispose
plumbing:

- **Sequence family** — step through a fixed list of target notes one at a
  time: `scale-runner`, `arpeggio-jumper`, `interval-trainer`,
  `chord-stacker`.
- **Round family** — repeat N independent rounds, each "play tone(s) → open
  a match window → score the window": `routine-runner`, `drone-intonation`,
  `siren`, `dynamic-swell`, `staccato-precision`. (`call-response`,
  `mirror-melody`, `sight-singing`, `pitch-pursuit`, `slide`, `long-note`,
  `pitch-hold`, `vibrato` are more bespoke — see Phase 4.)

Every controller in both families independently declares and manages:

```ts
let phaseTimer: ReturnType<typeof setTimeout> | undefined
base._registerDispose(() => { clearTimeout(phaseTimer); phaseTimer = undefined })
let _cancelled = false
// ...
function stopX() { _cancelled = true; clearTimeout(phaseTimer); base._setRunning(false); finish() }
```

### This duplication is the root cause of real bugs

The July 2026 review found bug #22 (see report) in `routine-runner` and
`chord-stacker`: `base.reset()` (fired on unmount / "Change Key") ran the
registered dispose fn but the controller's own `_cancelled` flag was only
flipped by its `stopX()`, so an in-flight `playTone().then()` continuation
resumed and re-armed an **untracked** timer on a torn-down exercise. It was
fixed in those two, but the same shape is copy-pasted into the others and is
one careless edit away from regressing anywhere. There was also no
re-entrancy guard against a double-invoked `startX()`.

A shared abstraction that **owns** the timer + cancellation + dispose
lifecycle makes these classes of bug structurally impossible to reintroduce
per-exercise, and removes an estimated ~600–900 lines of duplication.

## Hard constraint: preserve behavior exactly

These controllers are carefully tuned. In particular every one reproduces
its baseline timings **exactly at difficulty 5** (`difficultyFactor(5) === 1`).
The refactor is **mechanical/structural only** — no scoring formula, timing
constant, metric key, or difficulty curve may change. The existing
`src/tests/exercise-*.test.ts` suites (one per exercise) are the safety net;
they must stay green at every step with **zero edits to their assertions**.
If a test needs editing to pass, the refactor changed behavior — stop and
reassess.

---

## Phase 0 — Lock in the safety net (no product code changes)

Before touching any controller, close the test blind spots the review found,
so a behavioral regression can't slip through silently.

1. Confirm every exercise has a controller test that drives a **full run**
   end-to-end with fake timers (most already do; `pitch-hold`, `long-note`,
   `vibrato` use interval/RAF loops — verify their runs are asserted).
2. Add, where missing, the two cases bug #22 was about (already present for
   `routine-runner`/`chord-stacker` after the fix, use them as the template):
   - `base.reset()` mid-run does not schedule further work
     (assert no metric/tone calls fire after the dispose fn runs).
   - double `startX()` doesn't double-run (assert phase-start metrics fire once).
3. Snapshot each exercise's `computeResult()` for a fixed synthetic pitch
   history (a golden value per exercise). These guard the scoring math
   through the migration.

Exit criterion: `vitest run src/tests/exercise-*.test.ts` green, and each
controller has a reset-mid-run test + a double-start test + a result snapshot.

## Phase 1 — Extract the sequence runner

Create `src/features/exercises/use-sequence-exercise.ts` exposing a
`useSequenceRunner(base, audioEngine, opts)` helper that owns the shared
machine. Proposed shape (names illustrative):

```ts
interface SequenceRunnerOptions {
  // Timings (callers pass their own difficulty-scaled values so the
  // difficulty-5 == baseline invariant stays with each exercise).
  notePlayDurationMs: number
  gapBetweenNotesMs: number
  matchWindowMs: number
  interNoteRestMs?: number // the trailing setTimeout(..., 400) before next note
  // Per-note hooks — the only parts that actually differ between exercises.
  onNoteStart?(midi: number, index: number): void      // metrics/target pitch
  scoreNote(midi: number, index: number): number       // usually scoreNoteAccuracy(...)
  onNoteScored?(score: number, index: number): void    // metrics
  onFinish(): void                                      // build + commit result
}

function useSequenceRunner(base, audioEngine, opts) {
  // Owns: _cancelled, _active (re-entrancy guard), phaseTimer,
  // base._registerDispose(() => { clearTimeout; _cancelled = true; _active = false })
  // Exposes: start(notes: number[]), stop()
}
```

Key properties the shared runner must have (all learned from bug #22):

- The dispose callback flips `_cancelled = true` (not just `stop()`).
- `start()` is a no-op re-entrant call while `_active`.
- **All** scheduled delays go through the tracked `phaseTimer` (including any
  `await`-style gaps — chord-stacker's inter-note pauses must not be raw
  `setTimeout`).
- Every `playTone(...)` promise chain has a `.catch()`.

Migrate the four sequence controllers **one at a time**, each its own commit:

1. `scale-runner` (simplest; `scoreNote` = `scoreNoteAccuracy`, `onNoteStart`
   sets target + `phase: 1/2` metrics, `computeResult` unchanged).
2. `arpeggio-jumper` (same shape).
3. `interval-trainer` (note its stricter `valid.length < 3 → 0` scoring — keep
   it as a custom `scoreNote`; see also R3, addressed separately in Phase 3).
4. `chord-stacker` (the one with the arpeggiated multi-note "play" phase —
   its per-round note playback maps to `onNoteStart` emitting each chord tone;
   confirm the golden result snapshot from Phase 0 is unchanged).

After each: run that exercise's test file. It must pass unedited.

## Phase 2 — Extract the round runner

Create `use-round-exercise.ts` with `useRoundRunner(base, audioEngine, opts)`
for the round family:

```ts
interface RoundRunnerOptions {
  rounds: number
  matchWindowMs: number
  interRoundRestMs?: number
  playRound(roundIndex: number): Promise<void> | void  // start tone(s), set target/metrics
  evaluateRound(roundIndex: number): number            // score the just-finished window
  onRoundScored?(score: number, index: number): void
  onFinish(): void
}
```

Same lifecycle guarantees as Phase 1. Migrate one per commit:
`routine-runner` (already partly hardened — migrate carefully, it has the
per-phase fatigue checkpoints), `drone-intonation`, `dynamic-swell`,
`staccato-precision`, `siren`. Each keeps its own `evaluateRound` scoring and
`computeResult` verbatim.

## Phase 3 — Converge the scoring helpers (backlog R2 + R3)

Now that the machines are shared, unify the scoring math:

- Add an optional `k` (cents penalty) parameter to `scoreNoteAccuracy` in
  `exercise-scoring-utils.ts` (default `1.5`, preserving current behavior).
  Migrate `dynamic-swell`, `staccato-precision`, `slide`, `interval-trainer`
  off their hand-rolled `100 - avgDeviation * K` loops onto it, passing each
  one's existing `K` so results don't change.
- Replace the inline `12 * Math.log2(p.freq / 440) + 69` in every
  `*Exercise.tsx` (R2) with `freqToExactMidi` import. Do this as its own
  sweep commit; it's independent of the controller extraction and low-risk.

Guard: the Phase 0 result snapshots must not move.

## Phase 4 — Optional: shared component shell for `*Exercise.tsx`

Each `*Exercise.tsx` duplicates the same wiring: `startNote` signal seeded
from `launchTargetNote`, `useBaseExercise` setup, controller creation (with
the `eslint-disable solid/reactivity` block), `handleStart`/`handleStop`,
`onCleanup(() => base.reset())`, `onMount` auto-start, and the
`createEffect` that records the result + calls `updateDifficultyFromEma`.

Extract a `useExerciseHost({ type, buildController })` hook (and/or fold the
result-recording effect into `ExerciseShell`). This is the largest surface
and the least mechanical, so it is explicitly **out of scope for the first
pass** — do it only after Phases 1–3 have shipped and settled. The bespoke
exercises (`slide`, `long-note`, `pitch-hold`, `vibrato`, `mirror-melody`,
`call-response`, `sight-singing`, `pitch-pursuit`) can adopt the host hook
without needing the sequence/round runner.

---

## Sequencing & risk

- Land Phase 0 first and alone. Everything after depends on it.
- One controller per commit in Phases 1–2 (`feat/`-prefixed branch); each
  commit is independently revertable and leaves the suite green.
- Do **not** batch multiple controllers into one commit — the whole point is
  that a per-controller migration is verifiable in isolation against its
  existing tests.
- Stop-and-reassess trigger: if any existing `exercise-*.test.ts` assertion
  needs to change to stay green, the extraction altered behavior.

## Estimated impact

- ~600–900 lines removed across the 9 sequence+round controllers.
- Bug classes #21/#22 (timer leaks, reset races, missing re-entrancy guards,
  untracked delays) become impossible to express per-exercise.
- New exercises in either family become a `scoreNote`/`evaluateRound` +
  `computeResult`, not a full state-machine copy-paste.
</content>
