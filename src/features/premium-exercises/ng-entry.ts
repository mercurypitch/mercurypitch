// ============================================================
// Ng slides, as the Sing screen's way in describes it
// ============================================================
//
// The exercise row and the picker say three things about Ng slides before
// the singer opens it: the note the first slide starts on, the best at
// the singer's level ("Best 94% lit"), and whether its demo plays by
// itself. Each comes from the stores and rules the room itself reads
// (fitNgSlides, ng-slides-store.ts), so the way in and the room cannot
// disagree. It lives here, beside the catalogue, and reads no file of the
// room's: the room's own module graph stays out of the Sing screen's.
//
// There is no demo yet (it is PR 9 of the plan): nothing plays by itself.

import { loadLocalVoiceprints } from '@/db/services/voiceprint-service'
import { fitNgSlides } from '@/lib/glide/glide-targets'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { exerciseLevel } from '@/stores/exercise-level'
import { ngBest, rememberedNgNote } from '@/stores/ng-slides-store'
import { vocalRangePreset } from '@/stores/settings-store'

export interface NgEntry {
  /** The note the first slide starts on ("A2"), or null before there is one. */
  note: () => string | null
  /** The best at the singer's level ("Best 94% lit"), or null when none. */
  progress: () => string | null
  /** The demo plays by itself on the way in: never, until there is one. */
  demoAutoPlays: () => boolean
}

/** Reactive reads: each call reads the stores as they are now. */
export function ngEntry(): NgEntry {
  return {
    note: () => {
      const fit = fitNgSlides({
        voiceprints: loadLocalVoiceprints(),
        settledMidi: rememberedNgNote(),
        voicePreset: vocalRangePreset(),
      })
      // With neither a voiceprint nor a note kept, the singer's own easy
      // note fits the slides: there is nothing to name yet.
      return fit.source === 'preset' ? null : midiToNoteNameOctave(fit.roots[0])
    },
    progress: () => {
      const best = ngBest(exerciseLevel())
      return best === null ? null : `Best ${best.lit}% lit`
    },
    demoAutoPlays: () => false,
  }
}
