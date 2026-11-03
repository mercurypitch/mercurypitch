// ============================================================
// First note, as the exercise row, the picker and the Ear Lab describe it
// ============================================================
//
// The ways in say two things about First note before the singer opens it:
// the best at the singer's level ("Best 4 of 6", entries sung on the note),
// and whether its demo plays by itself on the way in (a first visit). Both
// come from the store the room records into (first-note-store.ts), so the
// way in and the room cannot disagree. It lives here, beside the
// catalogue, and reads no file of the room's: the room's own module graph
// stays out of the Sing screen's and the Ear Lab's.
//
// No note: each entry of a run is a new note, so there is no one note to
// name before it starts.

import { exerciseLevel } from '@/stores/exercise-level'
import { firstNoteBest, firstNoteDemoAutoPlays, } from '@/stores/first-note-store'

export interface FirstEntry {
  /** First note opens on no one note: always null. */
  note: () => string | null
  /** The best at the singer's level ("Best 4 of 6"), or null when none. */
  progress: () => string | null
  /** The demo plays by itself on the way in: a first visit. */
  demoAutoPlays: () => boolean
}

/** Reactive reads: each call reads the store as it is now. */
export function firstEntry(): FirstEntry {
  return {
    note: () => null,
    progress: () => {
      const best = firstNoteBest(exerciseLevel())
      return best === null ? null : `Best ${best.onNote} of ${best.rounds}`
    },
    demoAutoPlays: firstNoteDemoAutoPlays,
  }
}
