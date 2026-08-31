// ============================================================
// Exercise Voice Capture Contracts — temporary replay handoff
// ============================================================
//
// Exercise runners, challenge results, and history persistence exchange this
// data after the originating UI can unmount. The contract therefore belongs
// below every one of those feature and state layers.

import type { VoiceAtlasContourPayloadV1 } from '@/lib/voice-contour'
import type { ExerciseConfig, ExerciseResult } from './exercise-contracts'

export type ExerciseVoiceCaptureState =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'ready'
  | 'unsupported'
  | 'error'

export interface ExerciseSessionVoiceTake {
  blob: Blob
  durationMs: number
  peaks: Float32Array
  capturedAt: string
  contour: VoiceAtlasContourPayloadV1
  config: ExerciseConfig
  result: ExerciseResult
}

export type ExerciseVoiceCaptureOutcome =
  | { state: 'ready'; take: ExerciseSessionVoiceTake }
  | {
      state: 'unsupported' | 'error' | 'discarded'
      take: null
    }

export interface ExerciseVoiceCaptureController {
  state: () => ExerciseVoiceCaptureState
  take: () => ExerciseSessionVoiceTake | null
  /** Resolve the current run's processed take without polling reactive state. */
  awaitOutcome: () => Promise<ExerciseVoiceCaptureOutcome>
  discard: () => void
}
