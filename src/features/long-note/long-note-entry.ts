// ============================================================
// Long note, as the Sing screen's way in describes it
// ============================================================
//
// The Sing screen's exercise row and picker (src/features/premium-exercises)
// say three things about Long note before the singer opens it: the note it
// opens on, the best on that note, and whether its demo plays by itself.
// Each comes from the room's own stores and rules, so the way in and the
// room cannot disagree. The seconds use the result card's own formatter.

import { midiToNoteNameOctave } from '@/lib/note-utils'
import { longNoteDemoAutoPlays } from './demo/demo-auto-play'
import { longNoteBest } from './long-note-best'
import { rememberedLongNote } from './remembered-note'

/**
 * Seconds as the result card prints them ("9.4 s"): floored to the tenth,
 * so a run is never shown longer than it was.
 */
export function formatHoldSeconds(seconds: number): string {
  return `${(Math.floor(seconds * 10) / 10).toFixed(1)} s`
}

export interface LongNoteEntry {
  /** The note the room opens on ("A3"), or null before the first result. */
  note: () => string | null
  /** The best on that note ("Best 9.4 s"), or null when it has none. */
  progress: () => string | null
  /** The demo plays by itself on the way in. */
  demoAutoPlays: () => boolean
}

/** Reactive reads: each call reads the stores as they are now. */
export function longNoteEntry(): LongNoteEntry {
  return {
    note: () => {
      const midi = rememberedLongNote()
      return midi === null ? null : midiToNoteNameOctave(midi)
    },
    progress: () => {
      const midi = rememberedLongNote()
      const best = midi === null ? null : longNoteBest(midi)
      return best === null
        ? null
        : `Best ${formatHoldSeconds(best.inBandSeconds)}`
    },
    demoAutoPlays: longNoteDemoAutoPlays,
  }
}
