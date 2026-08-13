// ============================================================
// Weekly Legend Stage Voice Take — dry replay -> exercise handoff
// ============================================================

import type { ExerciseResult } from '@/features/exercises/types'
import type { ExerciseSessionVoiceTake, ExerciseVoiceCaptureOutcome, } from '@/features/exercises/use-base-exercise'
import type { DryVoiceCaptureController, DryVoiceCaptureResult, } from '@/features/voice-history/useDryVoiceCapture'
import { encodeVoiceAtlasContour } from '@/lib/voice-contour'
import { recordExerciseResult } from '@/stores/exercise-history-store'

type ChallengeVoiceCapture = Pick<
  DryVoiceCaptureController,
  'capture' | 'state' | 'stop'
>

function unavailableCapture(
  state: ReturnType<ChallengeVoiceCapture['state']>,
): ExerciseVoiceCaptureOutcome {
  return {
    state: state === 'unsupported' ? 'unsupported' : 'error',
    take: null,
  }
}

export function buildChallengeStageVoiceTake(input: {
  capture: DryVoiceCaptureResult
  challengeId: string
  targetNotes: readonly string[]
  result: ExerciseResult
}): ExerciseSessionVoiceTake {
  return {
    blob: input.capture.blob,
    durationMs: input.capture.durationMs,
    peaks: input.capture.peaks,
    capturedAt: input.capture.capturedAt,
    contour: encodeVoiceAtlasContour(input.capture.frames),
    config: {
      type: input.result.type,
      targetNotes: [...input.targetNotes],
      pattern: `legend:${input.challengeId}`,
    },
    result: input.result,
  }
}

/**
 * Finish the stage-owned recorder before publishing the scored run. The weekly
 * result card receives the temporary replay in the same transaction as the
 * score; capture failure never prevents the score from being recorded.
 */
export async function recordChallengeStageResult(input: {
  voiceCapture: ChallengeVoiceCapture
  challengeId: string
  targetNotes: readonly string[]
  result: ExerciseResult
}): Promise<void> {
  let capture = input.voiceCapture.capture()
  try {
    capture ??= await input.voiceCapture.stop()
  } catch {
    // The score is the durable result. A recorder/decode failure is expressed
    // to the result card as an unavailable replay, never as a lost attempt.
  }

  const weeklyVoiceCapture: ExerciseVoiceCaptureOutcome =
    capture === null
      ? unavailableCapture(input.voiceCapture.state())
      : {
          state: 'ready',
          take: buildChallengeStageVoiceTake({
            capture,
            challengeId: input.challengeId,
            targetNotes: input.targetNotes,
            result: input.result,
          }),
        }

  recordExerciseResult(input.result, { weeklyVoiceCapture })
}
