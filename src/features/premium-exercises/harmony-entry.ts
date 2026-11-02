// ============================================================
// Harmony, as the exercise row, the picker and the Ear Lab describe it
// ============================================================
//
// The ways in say two things about Harmony before the singer opens it: the
// best at the singer's level ("Best 4 of 6", lines sung in harmony), and
// that its demo does not play by itself (it has none yet). The best comes
// from the store the room records into (harmony-store.ts), so the way in
// and the room cannot disagree. It lives here, beside the catalogue, and
// reads no file of the room's: the room's own module graph stays out of the
// Sing screen's and the Ear Lab's.
//
// No note: each line of a run starts on a new note, in its own key, so
// there is no one note to name before it starts.

import { exerciseLevel } from '@/stores/exercise-level'
import { harmonyBest } from '@/stores/harmony-store'

export interface HarmonyEntry {
  /** Harmony opens on no one note: always null. */
  note: () => string | null
  /** The best at the singer's level ("Best 4 of 6"), or null when none. */
  progress: () => string | null
  /** The demo plays by itself on the way in: never, with no demo yet. */
  demoAutoPlays: () => boolean
}

/** Reactive reads: each call reads the store as it is now. */
export function harmonyEntry(): HarmonyEntry {
  return {
    note: () => null,
    progress: () => {
      const best = harmonyBest(exerciseLevel())
      return best === null ? null : `Best ${best.inHarmony} of ${best.lines}`
    },
    demoAutoPlays: () => false,
  }
}
