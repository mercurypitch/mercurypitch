// ============================================================
// Lesson copy choices — what each lesson's hook and tease pickers offer
// ============================================================
//
// The pickers' one input: a lesson's default wording and the variants the
// lessons kit holds for it, each with the team's note on why it exists. The
// kit lists them (src/features/lessons/kit/lesson-copy.ts) and a season entry
// carries its lesson's copy, so the season's own lists reach the page as they
// are. This file says what a saved id means to a picker.
//
// The default is saved as null, never by its id, so a lesson on its default
// carries no override at all. A saved id the lesson does not hold shows the
// default on the site, as the kit's hookFor and teaseFor pick, and the picker
// says so.

import { hookChoices, teaseChoices } from '@/features/lessons/kit/lesson-copy'
import type { LessonRow } from './lesson-admin'

/**
 * One wording a picker offers, as the kit's `CopyChoice` lists it. Kept
 * here as the shape the pickers read; `copyChoicesFor` is where the
 * compiler holds the two together.
 */
export interface CopyChoice {
  /** The variant id the lesson state stores; the default's ('default') is never sent. */
  readonly id: string
  readonly text: string
  /** The team's note: why the variant exists. Empty for the default. */
  readonly note: string
  readonly isDefault: boolean
}

export interface LessonCopyChoices {
  /** The question the lesson opens with, default first. */
  readonly hooks: readonly CopyChoice[]
  /** The line on the previous lesson's next-lesson card; none for a lesson without one. */
  readonly teases: readonly CopyChoice[]
}

export type CopyChoicesFor = (lesson: LessonRow['lesson']) => LessonCopyChoices

/** The season's own choices for a lesson. */
export const copyChoicesFor: CopyChoicesFor = (lesson) => ({
  hooks: hookChoices(lesson),
  teases: teaseChoices(lesson),
})

/** The choice the lesson state names: the saved one, or the default when none is saved or this build lacks it. */
export function chosenId(
  choices: readonly CopyChoice[],
  saved: string | null | undefined,
): string | null {
  const match = choices.find((choice) => choice.id === saved)
  return match?.id ?? choices.find((choice) => choice.isDefault)?.id ?? null
}

/** A saved id this build has no wording for, so the pages show the default; null otherwise. */
export function unknownSaved(
  choices: readonly CopyChoice[],
  saved: string | null | undefined,
): string | null {
  if (saved === null || saved === undefined) return null
  return choices.some((choice) => choice.id === saved) ? null : saved
}

/** What choosing `choice` saves: its id, or null for the default. */
export function savedValue(choice: CopyChoice): string | null {
  return choice.isDefault ? null : choice.id
}
