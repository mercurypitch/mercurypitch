// ============================================================
// useLipCapture: the microphone and the audio clock for Lip roll
// ============================================================
//
// The room kit's capture (useExerciseCapture.ts: the audio lease, the mic
// opened inside the singer's tap, each acquisition numbered), under Lip
// roll's owner name. The room's tones play on the same clock the mic is
// read against.

import type { ExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { useExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { EXERCISE_LIP_ROLL_BAY } from '@/lib/domain/exercise-contracts'

export { CaptureError } from '@/components/room-kit/useExerciseCapture'

export const LIP_AUDIO_OWNER = EXERCISE_LIP_ROLL_BAY

export function useLipCapture(): ExerciseCapture {
  return useExerciseCapture(LIP_AUDIO_OWNER, 'Lip roll')
}
