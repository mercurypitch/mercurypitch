// ============================================================
// The premium exercises the Sing screen offers, one entry each
// ============================================================
//
// The exercise row and the picker read only this list: a name, one line
// about the exercise, its glyph, and three live reads (the note it opens
// on, its best there, and whether its demo plays by itself). This is the
// one file that reaches into an exercise's own feature, so a new exercise
// is one entry here and nothing in the row or the picker. Echo's, Lip
// roll's and Ng slides' reads sit beside it (echo-entry.ts, lip-entry.ts,
// ng-entry.ts): they need their stores, not their rooms.
//
// Each entry names its group, and the picker draws the groups under
// headings in the Karaoke library's style: Pitch (Long note, Echo), then
// Warm-ups (Lip roll above Ng slides). Catalogue order is the order the
// picker lists them, so a group's entries sit together here, in its
// heading's order (catalogue.test.ts holds that).
// There is no card for an exercise that is not built: a card that does
// nothing is a dead tap.

import type { Component } from 'solid-js'
import { longNoteEntry } from '@/features/long-note/long-note-entry'
import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import { EXERCISE_ECHO_STARS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, } from '@/lib/domain/exercise-contracts'
import { echoEntry } from './echo-entry'
import { BridgeGlyph, EchoGlyph, LanternGlyph, WaveGlyph } from './glyphs'
import { lipEntry } from './lip-entry'
import { ngEntry } from './ng-entry'

/** The headings the picker sorts its cards under. */
export type ExerciseGroupId = 'pitch' | 'warm-ups'

export interface ExerciseGroup {
  readonly id: ExerciseGroupId
  /** The heading's words, as a screen reader says them (CSS sets the caps). */
  readonly title: string
}

/** The picker's headings, in the order it draws them. */
export const EXERCISE_GROUPS: readonly ExerciseGroup[] = [
  { id: 'pitch', title: 'Pitch' },
  { id: 'warm-ups', title: 'Warm-ups' },
]

export interface PremiumExercise {
  readonly id: PremiumExerciseId
  readonly name: string
  /** The heading its card sits under in the picker. */
  readonly group: ExerciseGroupId
  /** One line about it, under the name on its card. */
  readonly line: string
  readonly Glyph: Component
  /** The note it opens on ("A3"), or null. */
  note: () => string | null
  /** Its best, as its result card prints it ("Best 9.4 s"), or null. */
  progress: () => string | null
  /**
   * Its best belongs to the note it opens on (Long note: "Best 9.4 s on
   * A3"), not to the level (Echo: "Best 18 of 20", at the card's level).
   */
  readonly bestOnNote: boolean
  /** Its demo plays by itself on the way in. */
  demoAutoPlays: () => boolean
}

export const EXERCISE_CATALOGUE: readonly PremiumExercise[] = [
  {
    id: EXERCISE_LONG_NOTE_LANTERN,
    name: 'Long note',
    group: 'pitch',
    line: 'Hold one note and fill the lantern with light.',
    Glyph: LanternGlyph,
    bestOnNote: true,
    ...longNoteEntry(),
  },
  {
    id: EXERCISE_ECHO_STARS,
    name: 'Echo',
    group: 'pitch',
    line: 'Merc sings a phrase. Sing it back and light the stars.',
    Glyph: EchoGlyph,
    bestOnNote: false,
    ...echoEntry(),
  },
  {
    id: EXERCISE_LIP_ROLL_BAY,
    name: 'Lip roll',
    group: 'warm-ups',
    line: 'Buzz your lips over three waves and light the bay.',
    Glyph: WaveGlyph,
    bestOnNote: false,
    ...lipEntry(),
  },
  {
    id: EXERCISE_NG_SLIDES_BRIDGE,
    name: 'Ng slides',
    group: 'warm-ups',
    line: 'Hum five slides up a fifth and back, and light the bridge.',
    Glyph: BridgeGlyph,
    bestOnNote: false,
    ...ngEntry(),
  },
]

export function catalogueEntry(id: PremiumExerciseId): PremiumExercise | null {
  return EXERCISE_CATALOGUE.find((exercise) => exercise.id === id) ?? null
}

/** A heading and its cards, in catalogue order. */
export interface CatalogueGroup extends ExerciseGroup {
  readonly exercises: readonly PremiumExercise[]
}

/**
 * The catalogue under its headings, in the headings' order. A heading with
 * no card is left out: a heading over nothing reads as a missing list.
 */
export function catalogueGroups(): readonly CatalogueGroup[] {
  return EXERCISE_GROUPS.map((group) => ({
    ...group,
    exercises: EXERCISE_CATALOGUE.filter((one) => one.group === group.id),
  })).filter((group) => group.exercises.length > 0)
}
