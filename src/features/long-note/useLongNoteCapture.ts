// ============================================================
// useLongNoteCapture: the microphone and the audio clock for Long note
// ============================================================
//
// The room kit's capture (useExerciseCapture.ts: the audio lease, the mic
// opened inside the singer's tap, each acquisition numbered), under Long
// note's owner name.

import type { ExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { useExerciseCapture } from '@/components/room-kit/useExerciseCapture'

export type { CaptureFailure } from '@/components/room-kit/useExerciseCapture'
export { CaptureError } from '@/components/room-kit/useExerciseCapture'

export const LONG_NOTE_AUDIO_OWNER = 'long-note-lantern'

export type LongNoteCapture = ExerciseCapture

export function useLongNoteCapture(): LongNoteCapture {
  return useExerciseCapture(LONG_NOTE_AUDIO_OWNER, 'Long note')
}
