// ============================================================
// Home note, as the exercise row, the picker and the Ear Lab describe it
// ============================================================
//
// The ways in say two things about Home note before the singer opens it:
// the best at the singer's level ("Best 5 of 6"), and that its demo does
// not play by itself (it has none yet). The best comes from the store the
// room records into (home-note-store.ts), so the way in and the room cannot
// disagree. It lives here, beside the catalogue, and reads no file of the
// room's: the room's own module graph stays out of the Sing screen's and
// the Ear Lab's.
//
// No note: each round of a run is a new key, so there is no one note to
// name before it starts.

import { exerciseLevel } from '@/stores/exercise-level'
import { homeNoteBest } from '@/stores/home-note-store'

export interface HomeEntry {
  /** Home note opens on no one note: always null. */
  note: () => string | null
  /** The best at the singer's level ("Best 5 of 6"), or null when none. */
  progress: () => string | null
  /** The demo plays by itself on the way in: never, with no demo yet. */
  demoAutoPlays: () => boolean
}

/** Reactive reads: each call reads the store as it is now. */
export function homeEntry(): HomeEntry {
  return {
    note: () => null,
    progress: () => {
      const best = homeNoteBest(exerciseLevel())
      return best === null ? null : `Best ${best.found} of ${best.rounds}`
    },
    demoAutoPlays: () => false,
  }
}
