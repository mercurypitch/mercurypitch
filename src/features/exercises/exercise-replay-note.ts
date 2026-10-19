// ============================================================
// Exercise replay note — the line under a finished run's replay heading
// ============================================================
//
// What the result card says about the run's temporary local replay, by the
// keep action's state and the capture's. An ungraded drill (the Guided
// Warmup) shows no score, so its lines never promise that one is unchanged.

import type { ExerciseVoiceCaptureState } from './use-base-exercise'

export type ExerciseReplayKeepState = 'idle' | 'saving' | 'saved' | 'error'

export function exerciseReplayNote(
  keepState: ExerciseReplayKeepState,
  captureState: ExerciseVoiceCaptureState,
  ungraded: boolean,
): string {
  if (keepState === 'saving') return 'Saving locally…'
  if (keepState === 'saved') return 'Available in Hear Yourself on this device.'
  if (keepState === 'error') {
    return 'Could not keep it. The temporary replay is still available.'
  }
  if (captureState === 'processing') {
    return 'Preparing the temporary local replay…'
  }
  if (captureState === 'ready') {
    return 'It stays temporary unless you explicitly keep it on this device.'
  }
  if (captureState === 'unsupported') {
    return ungraded
      ? 'This browser cannot record a replay.'
      : 'This browser can score the run but cannot record a replay.'
  }
  const scoreLine = ungraded ? '' : ' Your score is unchanged.'
  return captureState === 'error'
    ? `No replay was captured.${scoreLine}`
    : `Replay discarded.${scoreLine}`
}
