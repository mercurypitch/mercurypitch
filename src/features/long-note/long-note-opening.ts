// ============================================================
// The note Long note opens on
// ============================================================
//
// One rule for the room (useLongNoteController) and the Sing screen's way
// in (long-note-entry.ts), so the two never name different notes: the note
// the singer chose last time, else the voiceprint's pick (hold-target.ts),
// else the note held last time, else (in the Warm-up) the note an earlier
// stop started from.

import type { HoldTarget } from '@/lib/hold/hold-target'
import { chosenLongNote, rememberedLongNote } from './remembered-note'

export function longNoteOpening(
  picked: HoldTarget,
  root: number | null = null,
): number | null {
  return (
    chosenLongNote() ??
    (picked.source === 'voiceprint' ? picked.midi : null) ??
    rememberedLongNote() ??
    root
  )
}

/**
 * Whether a note held to a result was the singer's own choice: anything but
 * the voiceprint's pick held as offered. With no voiceprint every note is
 * theirs, sung or moved to.
 */
export function heldNoteChosen(target: number, picked: HoldTarget): boolean {
  return picked.source !== 'voiceprint' || target !== picked.midi
}
