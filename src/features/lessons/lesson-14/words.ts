// ============================================================
// Lesson 14 four words — phrase, legato, swell, cadence
// ============================================================
//
// Lesson 1's strip of figure, word, definition and button (WEB-SPEC, Toys
// 3), each figure a small still of the song line in the strip's size, drawn
// in the markup. Phrase plays the first line as take 2 sings it, its breath
// after "star"; Legato plays it as one voice, then again, a beat later,
// with a 0.3 s break before every note but the first; Swell plays Step 3's
// swell; Cadence plays "what you are", the end of the second line, over its
// last two chords, V to I (FACTS 88). All in the chosen voice. Each is a
// Stop while it sounds, and the page's one sound (plays.ts): a press stops
// the sound before it, anywhere on the page, and a newer one stops it. The
// Merc of the chosen voice sings Merc's notes; the swell belongs to no
// Merc, as on Step 3.

import { qa } from '@/features/lessons/kit/dom'
import type { Run } from '@/features/lessons/kit/run'
import { allOf, playLine, playLines, playNotes, } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import { mercOf, VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { PlayButton } from './plays'
import { bindPlay, singAlong, singNotes } from './plays'
import type { SongNote } from './song'
import { cadenceNotes, doOf, legatoNotes, sungLines, swellContour, takeNotes, } from './song'

/** Merc's notes and their sound, with him singing them, as one run. */
function sung(notes: readonly SongNote[], run: Run, audible: boolean): Run {
  const quiet = singAlong(notes, mercOf(VoiceChoice.voice ?? 'lower'), audible)
  void run.done.then(quiet)
  return run
}

/** What each word's button plays, in the chosen voice. */
export function wordRun(word: string, audible: boolean): Run | null {
  const doMidi = doOf(VoiceChoice.voice ?? 'lower')
  switch (word) {
    case 'phrase': {
      const notes = takeNotes(2, doMidi)
      return sung(notes, singNotes(notes, audible), audible)
    }
    case 'legato': {
      const notes = legatoNotes(doMidi)
      const end = notes[notes.length - 1].to
      return sung(
        notes,
        playLines(sungLines(notes), { audible, length: end }),
        audible,
      )
    }
    case 'swell':
      return playLine(swellContour(doMidi), { audible })
    case 'cadence': {
      const { sung: notes, chords } = cadenceNotes(doMidi)
      return sung(
        notes,
        allOf([singNotes(notes, audible), playNotes(chords, { audible })]),
        audible,
      )
    }
    default:
      return null
  }
}

/** Binds the four words' buttons, each a Stop while it sounds. */
export function initWords(): PlayButton[] {
  return qa<HTMLButtonElement>('[data-word-play]').map((b) =>
    bindPlay(b, () => wordRun(b.dataset.wordPlay ?? '', Sound.canPlay())),
  )
}
