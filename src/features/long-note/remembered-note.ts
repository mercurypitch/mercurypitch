// ============================================================
// Remembered note — the note Long note opens on next time
// ============================================================
//
// The last note the singer held to a result, and whether they chose it. A
// chosen note (moved off the voiceprint's pick with the arrows, or sung as
// their own where there was no pick) outranks the voiceprint's pick
// (long-note-opening.ts). A note only accepted, the pick held as offered,
// does not: when the pick moves (a new voiceprint, or a better rule for
// placing it), the room moves with it.

import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import { createPersistedSignal } from '@/lib/storage'

interface HeldNote {
  readonly midi: number
  readonly chosen: boolean
}

/**
 * As stored. A bare number is a record from before `chosen` was kept, read
 * as accepted: the pick it was held on has since moved (November 2026,
 * exercises no longer counted up from a growl), and it should move too.
 */
type StoredNote = HeldNote | number | null

const isOfferable = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= HOLD_TARGET_MIN_MIDI &&
  value <= HOLD_TARGET_MAX_MIDI

function isStoredNote(value: unknown): value is StoredNote {
  if (value === null || isOfferable(value)) return true
  if (typeof value !== 'object') return false
  const held = value as Partial<HeldNote>
  return isOfferable(held.midi) && typeof held.chosen === 'boolean'
}

const [note, setNote] = createPersistedSignal<StoredNote>(
  'pitchperfect_long_note_lantern_note',
  null,
  { validator: isStoredNote },
)

/** The note held last time, or null before the first result. */
export function rememberedLongNote(): number | null {
  const held = note()
  return held === null || typeof held === 'number' ? held : held.midi
}

/** The note held last time when the singer chose it; else null. */
export function chosenLongNote(): number | null {
  const held = note()
  return held !== null && typeof held === 'object' && held.chosen
    ? held.midi
    : null
}

export function rememberLongNote(midi: number, chosen: boolean): void {
  if (isOfferable(midi)) setNote({ midi, chosen })
}
