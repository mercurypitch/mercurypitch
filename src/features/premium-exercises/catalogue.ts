// ============================================================
// The premium exercises the Sing screen offers, one entry each
// ============================================================
//
// The exercise row and the picker read only this list: a name, one line
// about the exercise, its glyph, and three live reads (the note it opens
// on, its best there, and whether its demo plays by itself). This is the
// one file that reaches into an exercise's own feature, so a new exercise
// is one entry here and nothing in the row or the picker.
//
// Catalogue order is the order the picker lists them. At four or more the
// picker gains group headings (Pitch, Warm-ups) in the Karaoke library's
// style; with fewer, headings over one card each would only add height.
// There is no card for an exercise that is not built: a card that does
// nothing is a dead tap.

import type { Component } from 'solid-js'
import { longNoteEntry } from '@/features/long-note/long-note-entry'
import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import { EXERCISE_LONG_NOTE_LANTERN } from '@/lib/domain/exercise-contracts'
import { LanternGlyph } from './glyphs'

export interface PremiumExercise {
  readonly id: PremiumExerciseId
  readonly name: string
  /** One line about it, under the name on its card. */
  readonly line: string
  readonly Glyph: Component
  /** The note it opens on ("A3"), or null. */
  note: () => string | null
  /** Its best there, as its result card prints it ("Best 9.4 s"), or null. */
  progress: () => string | null
  /** Its demo plays by itself on the way in. */
  demoAutoPlays: () => boolean
}

export const EXERCISE_CATALOGUE: readonly PremiumExercise[] = [
  {
    id: EXERCISE_LONG_NOTE_LANTERN,
    name: 'Long note',
    line: 'Hold one note and fill the lantern with light.',
    Glyph: LanternGlyph,
    ...longNoteEntry(),
  },
]

export function catalogueEntry(id: PremiumExerciseId): PremiumExercise | null {
  return EXERCISE_CATALOGUE.find((exercise) => exercise.id === id) ?? null
}
