// ============================================================
// Lip roll, as the Sing screen's way in describes it
// ============================================================
//
// The exercise row and the picker say three things about Lip roll before
// the singer opens it: the note the first wave starts on, the best at the
// singer's level ("Best 88% lit"), and whether its demo plays by itself.
// Each comes from the stores and rules the room itself reads (fitLipRoll,
// lip-roll-store.ts), so the way in and the room cannot disagree. It lives
// here, beside the catalogue, and reads no file of the room's: the room's
// own module graph stays out of the Sing screen's. There is no demo yet
// (PR 12), so it never plays by itself.

import { loadLocalVoiceprints } from '@/db/services/voiceprint-service'
import { fitLipRoll } from '@/lib/glide/glide-targets'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { exerciseLevel } from '@/stores/exercise-level'
import { lipBest, rememberedLipNote } from '@/stores/lip-roll-store'
import { vocalRangePreset } from '@/stores/settings-store'

export interface LipEntry {
  /** The note the first wave starts on ("C3"), or null before there is one. */
  note: () => string | null
  /** The best at the singer's level ("Best 88% lit"), or null when none. */
  progress: () => string | null
  /** The demo plays by itself on the way in: never, until it is built. */
  demoAutoPlays: () => boolean
}

/** Reactive reads: each call reads the stores as they are now. */
export function lipEntry(): LipEntry {
  return {
    note: () => {
      const fit = fitLipRoll({
        voiceprints: loadLocalVoiceprints(),
        settledMidi: rememberedLipNote(),
        voicePreset: vocalRangePreset(),
      })
      // With neither a voiceprint nor a note kept, the singer's own easy
      // note fits the waves: there is nothing to name yet.
      return fit.source === 'preset' ? null : midiToNoteNameOctave(fit.roots[0])
    },
    progress: () => {
      const best = lipBest(exerciseLevel())
      return best === null ? null : `Best ${best.lit}% lit`
    },
    demoAutoPlays: () => false,
  }
}
