// ============================================================
// Exercise replay note — the result card's line when no take was recorded
// ============================================================
//
// A take that was recorded is offered by Merc's notice on the stage
// (stage/take-notice.ts). One that never was, because the browser cannot
// record or nothing came through, has nothing to keep and nothing to ask:
// the result card says so in one quiet line at its foot, and the run's
// score, where it has one, is untouched. An ungraded drill (the Guided
// Warmup) and a run stopped before its end show no score, so their lines
// never promise that one is unchanged.

import type { ExerciseVoiceCaptureState } from './use-base-exercise'

export function exerciseReplayNote(
  captureState: ExerciseVoiceCaptureState | null,
  unscored: boolean,
): string | null {
  if (captureState === 'unsupported') {
    return unscored
      ? 'This browser cannot record a replay.'
      : 'This browser can score the run but cannot record a replay.'
  }
  if (captureState === 'error') {
    return unscored
      ? 'No replay was captured.'
      : 'No replay was captured. Your score is unchanged.'
  }
  return null
}
