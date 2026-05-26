# Exercise System Audit

**Date**: 2026-05-26
**Scope**: All 16 exercises, shared infrastructure, components, and tooling

## Summary

| Category | Status |
|---|---|
| TypeScript (`tsc --noEmit`) | 5 pre-existing errors (none from recent changes) |
| Prettier | 30 files in `src/features/exercises/` need formatting |
| ESLint | Config broken — exits with code 2, no output |
| Test coverage | 7/16 exercises have tests |
| Architecture | Good foundation, several DRY violations |

---

## 1. TypeScript — 5 Pre-existing Errors

None introduced by the recent UX changes.

| File | Error |
|---|---|
| `src/lib/whisper-worker.ts` | Missing `@huggingface/transformers` types |
| `vite.config.ts` | Missing `vite-plugin-qrcode` types |
| `src/features/exercises/mirror-melody/exercise-mirror-melody.test.ts` | Null assignability |
| `src/components/ExercisePitchTracker.tsx` | `PitchOverTimeCanvas` expects `noteName` in samples, `pitchHistory` doesn't include it |

The `ExercisePitchTracker` type mismatch is the only one related to our changes and should be fixed. Either add `noteName` to the pitch history type or make the prop optional in `PitchOverTimeCanvas`.

---

## 2. Prettier — 30 Files Unformatted

Running `npx prettier --check "src/features/exercises/**/*.{ts,tsx}"` shows 30 files with code style deviations. These are formatting-only issues (indentation, line wrapping, quote style).

**Fix**: `npx prettier --write "src/features/exercises/**/*.{ts,tsx}"`

---

## 3. ESLint — Config Broken

`npx eslint src/features/exercises` exits with code 2 and produces no output. This suggests the flat config's `files` option doesn't match any of the passed files. Likely a glob pattern mismatch in `eslint.config.js`.

**Recommended**: Audit the `files` arrays in the eslint config against the actual file paths being passed on the CLI.

---

## 4. Test Coverage — 7/16 Exercises Tested

### Tested (7)
- long-note
- scale-runner
- pitch-pursuit
- vibrato
- pitch-hold
- mirror-melody
- drone-intonation

### Untested (9)
- slide
- arpeggio-jumper
- call-response
- chord-stacker
- dynamic-swell
- interval-trainer
- routine-runner
- siren
- staccato-precision

### Test Quality Notes
- Most tests are unit-level controller tests using mocked `BaseExercise`
- No integration tests verifying the full exercise lifecycle (mic → controller → result)
- No UI-level tests (Playwright/component tests) for exercise components

---

## 5. Architecture & Design Issues

### 5.1 `midiToFreq` Copy-Pasted in 8+ Controllers

The same `midiToFreq(midi: number): number` function is defined locally in:
- `use-long-note-controller.ts`
- `use-pitch-hold-controller.ts`
- `use-slide-controller.ts`
- `use-siren-controller.ts`
- `use-mirror-melody-controller.ts`
- `use-arpeggio-jumper-controller.ts`
- `use-drone-intonation-controller.ts`
- `use-interval-trainer-controller.ts`

**Fix**: Move to `src/lib/frequency-to-note.ts` as `midiToFrequency(midi: number): number` and import from all controllers. This also makes it available for tests.

### 5.2 `ExerciseState.metrics` is `Record<string, number>`

No per-exercise type safety. Each controller writes arbitrary string keys. A typo like `{ stablity: 0.9 }` instead of `{ stability: 0.9 }` would silently produce NaN scores.

**Recommended**: Define per-exercise metric types in `types.ts`:
```ts
interface LongNoteMetrics { pitchStabilityCents: number; steadyZonePct: number; durationSec: number; }
interface PitchPursuitMetrics { hits: number; misses: number; combo: number; ... }
```

### 5.3 `volumeConsistency` Hardcoded to 0

In `use-long-note-controller.ts`, `volumeConsistency` is set to `0` with no implementation. This means the long-note score never accounts for volume steadiness despite it being part of the scoring rubric.

### 5.4 `onCleanup` Doesn't Dispose Controller Timers

`useBaseExercise` registers dispose functions via `_registerDispose(fn)`, but the `onCleanup` callback (line 217) only stops the mic and sets a running flag — it never calls `disposeFns`. Controller timers (setInterval, rAF loops) could leak if the component unmounts while active.

**Fix**: Call `disposeFns.forEach(fn => fn())` in the `onCleanup` block.

### 5.5 Inconsistent Controller Return Patterns

Controllers have no standardized interface. Some return `{ startX, stopX }`, others `{ startGame, stopGame }`, others expose `setTarget`, `setScale`, `getNotes`, etc. While some variation is inherent to the exercise differences, a base `ExerciseController` interface with optional extensions would make the codebase more navigable.

### 5.6 `vocal-range.ts` Not Reactive

`getDefaultNote(vocalRangePreset())` is called once at component initialization. If the user changes their voice type in Settings and navigates back without a full page reload, the note selector still shows the old range. The signal subscription should be in a reactive context.

**Fix**: Either track `vocalRangePreset()` in a `createEffect` or derive the note options as a signal.

### 5.7 Scoring Inconsistency

Different exercises use different scoring philosophies:
- Some use weighted multi-factor formulas
- Some use simple accuracy percentages
- Some use best-window analysis
- Some use raw hit/miss counts

This isn't necessarily wrong, but there's no shared scoring utility or documented rationale for when to use which approach.

---

## 6. SolidJS Reactivity Review

### Working Correctly
- Re-entrancy guards (`completeDepth`, `resetDepth`, `startDepth`) prevent cascading signal updates
- `_cancelled` flag pattern correctly aborts async timer callbacks
- `batch()` used appropriately for grouped updates
- `untrack()` used correctly around `recordExerciseResult` calls to avoid re-subscriptions

### Potential Issues
- **`vocal-range` reactivity** (see 5.6 above)
- **`createEffect` in PitchPursuit** — the `createEffect` for score pops and combo pulse are reading `met()` which reads `base.state().metrics` — if `metrics` is replaced wholesale (not mutated in place), these effects may over-fire
- **`tick()` signal in PitchPursuit** — used as a manual invalidation trigger inside `currentNote()` and `notesView()` — this is a common SolidJS pattern but means these functions recompute every 33ms regardless of whether their dependencies changed

---

## 7. Code Smells

| Smell | Location | Severity |
|---|---|---|
| Magic numbers | Multiple controllers — 5000ms game duration, 50 cent tolerance, 0.88 target zone | Low |
| `as` type casts in score class computation | All exercise components | Low |
| `!` non-null assertions on `base.result()!` | All exercise result overlays | Low |
| `void handleStart()` everywhere | All exercise components | Low |
| Duplicate result overlay JSX | All 16 exercises — identical structure | Medium |
| Duplicate celebration + record pattern | All 16 exercises | Medium |
| `let` mutable refs (`lastCombo`, `lastPopTotal`, `popId`) | PitchPursuit | Medium |

---

## 8. UI/UX Observations

### Improved
- Pitch tracker canvas now available in all exercises (toggleable)
- Note pill selectors are more intuitive than dropdowns
- Voice-type-aware defaults reduce setup friction

### Remaining Gaps
- No loading state between "Start" click and mic activation
- No audible feedback on correct/incorrect notes (only visual)
- PitchPursuit note bars can overlap at the target zone making them hard to distinguish
- Result screen is identical across all exercises — could benefit from exercise-specific result visualizations
- No way to review pitch tracker data after exercise completes

---

## 9. Recommended Priority Order

1. **Fix ESLint config** — ensures lint rules are actually enforced
2. **Run Prettier** — 30 files, 1 command, zero risk
3. **Extract `midiToFreq`** — removes 8 copy-pasted definitions
4. **Fix `onCleanup` dispose bug** — prevents potential timer leaks
5. **Fix `ExercisePitchTracker` type error** — either add `noteName` or make prop optional
6. **Add `volumeConsistency` implementation** or remove the metric
7. **Add tests for untested exercises** — prioritize the 9 with zero coverage
8. **Make `vocal-range` reactive** — hear user's voice type changes
9. **Extract shared result overlay component** — removes 16x duplicated JSX
10. **Add per-exercise metric types** — catches key typos at compile time
