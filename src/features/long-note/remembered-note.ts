// ============================================================
// Remembered note — the note Long note opens on next time
// ============================================================
//
// The last note the singer held to a result. It outranks the voiceprint's
// pick: the singer chose it, or sang it as their own, and held it.

import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import { createPersistedSignal } from '@/lib/storage'

function isRememberedNote(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= HOLD_TARGET_MIN_MIDI &&
      value <= HOLD_TARGET_MAX_MIDI)
  )
}

const [note, setNote] = createPersistedSignal<number | null>(
  'pitchperfect_long_note_lantern_note',
  null,
  { validator: isRememberedNote },
)

/** The note held last time, or null before the first result. */
export function rememberedLongNote(): number | null {
  return note()
}

export function rememberLongNote(midi: number): void {
  if (isRememberedNote(midi)) setNote(midi)
}
