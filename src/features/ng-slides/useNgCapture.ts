// ============================================================
// useNgCapture: the microphone and the audio clock for Ng slides
// ============================================================
//
// The room kit's capture (useExerciseCapture.ts: the audio lease, the mic
// opened inside the singer's tap, each acquisition numbered), under Ng
// slides' owner name. The room's tones play on the same clock the mic is
// read against.

import type { ExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { useExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { EXERCISE_NG_SLIDES_BRIDGE } from '@/lib/domain/exercise-contracts'

export { CaptureError } from '@/components/room-kit/useExerciseCapture'

export const NG_AUDIO_OWNER = EXERCISE_NG_SLIDES_BRIDGE

export function useNgCapture(): ExerciseCapture {
  return useExerciseCapture(NG_AUDIO_OWNER, 'Ng slides')
}
