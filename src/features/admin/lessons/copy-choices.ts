// ============================================================
// Lesson copy choices — each lesson's hook and tease wordings, for the pickers
// ============================================================
//
// The pickers' one input: a lesson's default wording and the variants its
// code holds, each with the team's note on why it exists. The default is
// saved as null, never by its id, so a lesson on its default carries no
// override at all.
//
// STUB: the season's variants are being added beside season.ts, in a pure
// module that lists each lesson's choices in exactly this shape. Until it
// lands, `copyChoicesFor` reads only what the season holds today: each
// lesson's default hook, and no teases. Swap its body for that module's
// lists then; the page and its tests take any `CopyChoicesFor`.

import type { LessonRow } from './lesson-admin'

/** One wording a picker offers. */
export interface CopyChoice {
  /** The variant id the lesson state stores; the default's is never stored. */
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

/** The id the default wording goes by in a list; a save of it sends null. */
export const DEFAULT_CHOICE_ID = 'default'

export const copyChoicesFor: CopyChoicesFor = (lesson) => ({
  hooks: [
    { id: DEFAULT_CHOICE_ID, text: lesson.hook, note: '', isDefault: true },
  ],
  teases: [],
})

/** The choice the lesson state names: the saved variant, or the default when none, or one this build lacks. */
export function chosenId(
  choices: readonly CopyChoice[],
  saved: string | null | undefined,
): string | null {
  const variant = choices.find(
    (choice) => !choice.isDefault && choice.id === saved,
  )
  return variant?.id ?? choices.find((choice) => choice.isDefault)?.id ?? null
}

/** A saved variant id this build has no wording for, so the pages show the default; null otherwise. */
export function unknownSaved(
  choices: readonly CopyChoice[],
  saved: string | null | undefined,
): string | null {
  if (saved === null || saved === undefined) return null
  return choices.some((choice) => !choice.isDefault && choice.id === saved)
    ? null
    : saved
}

/** What choosing `choice` saves: its id, or null for the default. */
export function savedValue(choice: CopyChoice): string | null {
  return choice.isDefault ? null : choice.id
}
