# Melody ribbon M2/M3 implementation checkpoint

Updated: 2026-09-24

## Scope

- Implement the pure configurable melody contour compiler and live pitch judge
  as new modules in `packages/glass-game`.
- Keep authored 3, 5, 7 and 10-note melody data separate from engine policy.
- Reuse `PitchObservation` capture sequence, capture clock, wall-clock freshness
  and confidence. Reference playback is never evidence.
- Add a self-contained practice controller, browser reference player and Solid
  panel. Do not change central challenge contracts, gallery/campaign integration,
  rewards, generated indexes or master planning documents in this task.

## Files owned by this task

- `packages/glass-game/src/core/melody-contour.ts`
- `packages/glass-game/src/core/melody-contour.test.ts`
- `packages/glass-game/src/core/melody-judge.ts`
- `packages/glass-game/src/core/melody-judge.test.ts`
- `packages/glass-game/src/core/melody-reference.ts`
- `packages/glass-game/src/content/melodies.ts`
- `packages/glass-game/src/content/melodies.test.ts`
- `packages/glass-game/src/browser/melody-reference.ts`
- `packages/glass-game/src/browser/melody-reference.test.ts`
- `packages/glass-game/src/ui/melody-practice.ts`
- `packages/glass-game/src/ui/melody-practice.test.ts`
- `packages/glass-game/src/ui/MelodyPractice.tsx`
- `packages/glass-game/src/ui/MelodyPractice.module.css`
- `art/glass-adventure/plans/MELODY-IMPLEMENTATION-2026-09-23.md`

## Current state

- [x] Read repository workflow, agent index, conventions, relevant mistakes,
      learning spec, M1 contour audition and current capture/judge seams.
- [x] Confirmed the existing microphone owner emits raw captured observations
      independently of render frames.
- [x] Add validated melody data and a shared contour representation.
- [x] Add the forward-only capture-clock judge.
- [x] Cover required synthetic behavioral cases with focused tests.
- [x] Run the M2 focused tests (16 passing) and package typecheck.
- [x] Add a self-contained microphone practice controller with calibration,
      reference isolation, replay, foreground cancellation and optional recording.
- [x] Add a Web Audio reference player whose schedule, visual progress and timeout
      all derive from the compiled duration, including the 10-note two-phrase run.
- [x] Add the standalone Solid ribbon panel with opt-in pace/transposition controls,
      root recalibration, live pitch guidance and reduced-motion/mobile styling.
- [x] Add controller/reference lifecycle tests (10 passing) and rerun package
      typecheck after the M3 modules.
- [x] Format owned files, run the combined focused suite (27 passing), package
      typecheck and diff whitespace check, then hand the stable import/adapter
      seam to the root integration owner.

The final package typecheck invocation on 2026-09-24 reports only the concurrent
root-owned `browser/musical-memory-store.ts` unused `MusicalMemory` import. The
package typecheck was clean after the melody panel landed, and the final melody
suite compiles all owned modules through Vitest.

## Design decisions

- Compilation resolves authored offsets, feel, pace and transposition into one
  immutable timeline used by display, reference sound and judge sampling.
- Breath and separate-note gaps are explicit silent segments. Their visual time
  exists, but they cannot earn singing progress and never require a fixed breath.
- Alignment carries a bounded set of locally reachable forward candidates. This
  preserves legal tempo variation without allowing repeated notes to skip the
  intervening contour.
- Brief unvoiced gaps may bridge only within configured capture-clock grace.
  Voiced mismatches freeze; sustained gaps or mismatch retry the current phrase.
- Completion latches once. It does not decay and later silence emits no event.
- The judge has no amplitude or loudness input.

## Integration seams

`MelodyPractice` accepts the existing host subset, a browser reference factory,
the existing `beforeCapture`/`onReleaseVoice` silence handoff, and optional
callbacks. The controller creates exactly one `GlassVoiceSession`; reference
frames are ignored, and a fresh evidence boundary is taken from both the wall
clock and `session.latest()` after reference playback completes on the audio
clock. The exact `CompiledMelody` object is passed to the reference player,
displayed by the SVG and retained by the judge.

Opt-in local recording uses this separate host-owned adapter:

```ts
interface MelodyPracticeRecordingAdapter {
  start(session: GlassVoiceSession): void
  stop(session: GlassVoiceSession, outcome: 'complete' | 'cancelled'): void
}
```

`start` runs synchronously only when the controller enters live judged capture,
after calibration and after the reference quiet boundary. `stop` runs
synchronously before `session.stop()` on completion, cancel, replay, error,
backgrounding or disposal. The adapter receives the already-acquired session;
it must use the host's optional recording method on that session and must never
open another microphone. No adapter means zero recording behavior. The root
integration can call `finish(): Promise<Blob>` for `complete` or `discard()` for
`cancelled` inside the adapter before the underlying audio track is released.
Adapter exceptions are contained so recording cleanup cannot prevent the
microphone session from being stopped.

Gallery selection, consent UI, saved takes and the existing adventure mount stay
with the root integration owner.
