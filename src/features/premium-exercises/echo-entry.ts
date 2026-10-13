// ============================================================
// Echo, as the Sing screen's way in describes it
// ============================================================
//
// The exercise row and the picker say three things about Echo before the
// singer opens it (DESIGN-echo.md 7): the note its first phrase starts on,
// the best at the singer's level ("Best 18 of 20"), and whether its demo
// plays by itself. Each comes from the stores and rules the room itself
// reads (echoWindow, echo-store.ts), so the way in and the room cannot
// disagree. It lives here, beside the catalogue, and reads no file of the
// room's: the room's own module graph stays out of the Sing screen's.

import { loadLocalVoiceprints } from '@/db/services/voiceprint-service'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { echoWindow } from '@/lib/sequence/phrase-fit'
import { echoBest, rememberedEchoRoot } from '@/stores/echo-store'
import { exerciseLevel } from '@/stores/exercise-level'
import { vocalRangePreset } from '@/stores/settings-store'

export interface EchoEntry {
  /** The note the first phrase starts on ("C4"), or null before there is one. */
  note: () => string | null
  /** The best at the singer's level ("Best 18 of 20"), or null when none. */
  progress: () => string | null
  /** The demo plays by itself on the way in. */
  demoAutoPlays: () => boolean
}

/** Reactive reads: each call reads the stores as they are now. */
export function echoEntry(): EchoEntry {
  return {
    note: () => {
      const window = echoWindow({
        voiceprints: loadLocalVoiceprints(),
        settledMidi: rememberedEchoRoot(),
        voicePreset: vocalRangePreset(),
      })
      // With neither a voiceprint nor a root kept, the singer's own first
      // note starts the phrases: there is nothing to name yet.
      return window.source === 'preset'
        ? null
        : midiToNoteNameOctave(window.firstRoot)
    },
    progress: () => {
      const best = echoBest(exerciseLevel())
      return best === null ? null : `Best ${best.landed} of ${best.notes}`
    },
    // Echo's demo comes in a PR of its own; until then nothing plays.
    demoAutoPlays: () => false,
  }
}
