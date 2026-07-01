# Code Review — July 2026

Full-codebase review (~130k LoC). Bugs listed here were **fixed** on branch
`feat/code-review-bugfixes` with a regression test each; the refactor and
test-gap sections are a **backlog** (documented, not yet actioned).

Verification of the fixes: `tsc --noEmit`, `eslint src`, `prettier --check`,
full `vitest run` (2257 passing), and a production `vite build` all clean.

---

## Bugs fixed

| # | Area | Bug | Fix |
|---|------|-----|-----|
| 1 | `frequency-to-note.ts`, `vocal-analyzer.ts`, `note-utils.ts`, `scale-data.ts` | Note-name lookup used unguarded `midi % 12`, negative for MIDI < 0 → `"undefined-2"` names | Normalize `((n % 12) + 12) % 12`; also fixed `noteToMidi` octave parsing for multi-digit/negative octaves |
| 2 | `app-store.ts` | `updateUvrSessionOutputs` rebuilt `outputs` without `instrumentalMidi` → dropped on every refresh | Preserve the field |
| 3 | `melody-store.ts` | `playPlaylist` captured library once (stale closure) and silently stalled on a missing melody | Re-read library per iteration; skip missing entries |
| 4 | `session-store.ts` | `resetAllSessions` cleared only localStorage, not the in-memory signal | Reset `melodyStore` too |
| 5 | `stores/index.ts` | `startPracticeSession` defined twice | Dedup |
| 6 | `yousician-ball-physics.ts` | Jump `progress` reset every call → ball froze mid-arc | Persist `progress` in state; write it back in `piano-roll.ts` |
| 7 | `piano-roll.ts` | `initializeBallPhysics` stale early-return skipped rebuild on melody reload | Remove guard |
| 8 | `audio-engine.ts` | `renderMelodyToWAV` used `Math.max(...spread)` (crashes on large melodies) + a dead freq-validity gate | Loop for max; filter invalid-freq items |
| 9 | `playback-engine.ts` | Dead duplicate playback engine with its own unfixed pause/resume bug | Deleted (zero references) |
| 10 | `PitchCanvas.tsx` | Anonymous event listeners couldn't be removed → document-level leak per mount | Named handlers + `removeEventListener` |
| 11 | `DrumMachinePanel.tsx` | `createEffect` return value misused as cleanup → subscription leak | `onCleanup(unsub)` |
| 12 | `SessionEditorTimeline.tsx` | Right-click deleted an item with no confirm; duration total divided by 1000 twice | Removed right-click delete; fixed unit math |
| 13 | `OfflinePitchCanvas.tsx` | Spacebar toggled playback even while typing in an input | Skip when focus is in a text field |
| 14 | `ScaleBuilder.tsx` | `handleOpen` left stale note selection when no custom scale active | Reset to defaults |
| 15 | `caged-shapes.ts` | All 5 CAGED shapes assumed low-E-first string order (actual is high-e-first) → roots on wrong strings, unplayable frets | Reversed offsets, corrected `rootString` |
| 16 | `chord-utils.ts` | `getChordToneRole` labeled sus2/sus4's 2nd/4th as "third" (dead `? 'third' : 'third'`) | Interval-based role |
| 17 | `PitchTestingTab.tsx` | Downsample used `i * ratio` → only read first `ratio` fraction of source audio | `i / ratio` |
| 18 | `jam/service.ts` | `onPeerLeft` never removed `dataChannels`/`pendingCandidates` entries → leak on peer churn | Delete on leave |
| 19 | `JamExerciseCanvas.tsx` | Module-level `lastComputedScores`/`wasPlaying` leaked stale state across room rejoin | Component-local |
| 20 | `JamPanel.tsx` | BPM stepper not gated on `jamIsHost()` unlike sibling controls | Add host gate |
| 21 | `use-base-exercise.ts` | `stop()` skipped `disposeFns` (unlike `reset()`) → timer leak if used | Run dispose fns |
| 22 | `routine-runner`, `chord-stacker` controllers | `reset()` didn't set the controller's `_cancelled`, so an in-flight `playTone().then()` re-armed an untracked timer post-teardown; no re-entrancy guard on start | Flip `_cancelled` in the dispose callback; add `_active` guard; track chord-stacker's inter-note delays |
| 23 | `weakness-analyzer.ts` | Recent avg compared against all-time avg (a superset) → trend always `stable` | Disjoint older window (matches `trends-computer.ts`) |
| 24 | `TranscriptionTrainerState.ts` | JS poll loop re-restarted an already-natively-looping source at the loop point → audible glitch | Re-sync bookkeeping instead of recreating the source |

### Reviewer findings that were verified as **false positives** (not changed)

- **Drone-intonation "queued tone fires after stop"** — not reachable:
  `stopRounds()` clears `phaseTimer` synchronously and JS's single-threaded
  loop means a timer callback can't interleave mid-`stopRounds`.
- **`PitchTestingTab.tsx` downsample direction** — a reviewer flagged
  line 596 (`i / ratio`) as wrong; independent simulation showed 596 was
  correct and the real bug was line 436 (`i * ratio`). Fixed the actual site.
- **"ProDashboard has no entitlement check"** — `docs/plans/premium.md`
  confirms the app is intentionally donation-only with **no feature gating**
  (Phase 0/1). "Pro" here means professional-grade UI, not a paid tier.

---

## Refactor backlog (not yet done)

Ranked by value. Item R1 has its own detailed plan in
[`docs/plans/exercise-controller-refactor.md`](../plans/exercise-controller-refactor.md).

- **R1 — Exercise controllers (~17 files, heavy duplication).** Two families
  (sequence-based and round-based) each re-implement a near-identical
  play→listen→match→evaluate→advance state machine with its own
  `_cancelled`/`phaseTimer`/dispose wiring. This duplication is the root
  cause of bugs #22 (fixed in some copies, latent in others). See the
  dedicated plan.
- **R2 — Freq→cents inline in every `*Exercise.tsx`.** All ~17 components
  inline `12 * Math.log2(p.freq / 440) + 69` (and midi→freq) instead of
  importing `freqToExactMidi`/`midiToFrequency`. Lacks the `freq <= 0`
  guard the shared util has.
- **R3 — Divergent cents→score curves.** `dynamic-swell`,
  `staccato-precision`, `slide`, `interval-trainer` each hand-roll
  "penalize by `100 - avgDeviation * K`" with different `K` constants
  instead of a parameterized `scoreNoteAccuracy`.
- **R4 — Canvas boilerplate.** 8+ canvas components
  (`PitchCanvas`, `OfflinePitchCanvas`, `HistoryCanvas`,
  `PitchOverTimeCanvas`, jam canvases, guitar fretboards, pane canvases)
  each re-implement DPR-resize + RAF-loop + `onCleanup`. Extract a
  `useCanvasLoop`/`useResizingCanvas` hook — would also structurally
  prevent leaks like bug #10.
- **R5 — Duplicated helpers.** `hexToRgba` (2 jam files),
  clipboard-with-"Copied!" pattern (`JamPanel` ×2, `JamInviteModal`),
  `isUpgraded`/provider accessors (`HeaderAccount`, `AccountSection`),
  score→color helpers (5 files, divergent thresholds), `guitar-synth.ts`
  re-declaring `OPEN_MIDI`.
- **R6 — Two parallel share mechanisms.** `share-url.ts` (legacy
  query-param) and `share-codec.ts` (base64url hash) coexist with
  duplicated clipboard/base64 helpers.
- **R7 — God components.** `VocalAnalysis.tsx` (3109 L),
  `StemMixer.tsx` (4721 L, ~3000 of inline CSS-in-JS),
  `PitchTestingTab.tsx` (2426 L), `UvrPanel.tsx` (1733 L),
  `SettingsPanel.tsx` (1457 L, hand-rolled modals instead of
  `ConfirmDialog`), `JamPanel.tsx` (691 L).
- **R8 — Config leftovers.** Debug `console.log`s left in `UvrPanel.tsx`
  render paths; three parallel `Record<ActiveTab,string>` maps in
  `features/tabs/constants.ts` that must be hand-synced.

---

## Test-gap backlog (not yet done)

Highest-value zero-coverage areas (share-codec was closed in this pass):

- `src/lib/jam/service.ts`, `signaling.ts` — WebRTC glare/ICE-buffering/
  reconnect logic; needs signaling+RTC mocks.
- `src/components/jam/*` — 10 components, no tests; needs canvas 2D mock.
- `src/lib/vocal-separator.ts`, `uvr-processing-pipeline.ts` — worker
  message state machine, concurrency races.
- `src/lib/pitch-word-alignment.ts`, `transcription-alignment-utils.ts` —
  alignment/overlap math; `chunkAudioForWhisper` has an unguarded
  `overlapSec >= chunkSec` infinite-loop risk.
- `src/stores/melody-store.ts` — largest store, no dedicated test file.
- `src/lib/piano-roll.ts` MIDI import — VLQ parser has a known unhandled
  malformed-input branch (documented in-code).
- `caged-shapes.ts` `findRootForShape` loop-exhaustion fallback,
  `guitar-tab-3d` projection math (the tested `perspectiveScale` is dead
  code; the real `project`/`fretX`/`stringY` path is untested).
</content>
