// ============================================================
// useEchoCapture: the microphone and the audio clock for Echo
// ============================================================
//
// The room kit's capture (useExerciseCapture.ts: the audio lease, the mic
// opened inside the singer's tap, each acquisition numbered), under Echo's
// owner name. Merc's call plays on the same clock the mic is read against.

import type { ExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { useExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { EXERCISE_ECHO_STARS } from '@/lib/domain/exercise-contracts'

export { CaptureError } from '@/components/room-kit/useExerciseCapture'

export const ECHO_AUDIO_OWNER = EXERCISE_ECHO_STARS

export function useEchoCapture(): ExerciseCapture {
  return useExerciseCapture(ECHO_AUDIO_OWNER, 'Echo')
}
