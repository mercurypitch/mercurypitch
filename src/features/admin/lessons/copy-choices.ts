// ============================================================
// Lesson copy choices — what each lesson's hook and tease pickers offer
// ============================================================
//
// The pickers' one input: a lesson's default wording and the variants the
// lessons kit holds for it, each with the team's note on why it exists. The
// kit lists the variants (src/features/lessons/kit/lesson-copy.ts) and a
// season entry carries its lesson's copy, so the season's own lists reach the
// page as they are. The notes are not in the copy: every lesson page carries
// that, and a note is the team's, so they live in kit/team-notes.ts, which
// no lesson page imports. This file joins the two, by the lesson's number and
// the variant's id, and says what a saved id means to a picker.
//
// The default is saved as null, never by its id, so a lesson on its default
// carries no override at all. A saved id the lesson does not hold shows the
// default on the site, as the kit's hookFor and teaseFor pick, and the picker
// says so.

import type { LessonCopy } from '@/features/lessons/kit/lesson-copy'
import { DEFAULT_ID } from '@/features/lessons/kit/lesson-copy'
import type { VariantNotes } from '@/features/lessons/kit/team-notes'
import { HOOK_NOTES, TEASE_NOTES } from '@/features/lessons/kit/team-notes'
import type { LessonRow } from './lesson-admin'

/** One wording a picker offers. */
export interface CopyChoice {
  /** The variant id the lesson state stores; the default's ('default') is never sent. */
  readonly id: string
  readonly text: string
  /** The team's note: why the variant exists. Empty for the default, and for a variant team-notes.ts has none for. */
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

/** A lesson's hooks: its default first, then its alternatives, each with its note from `notes`. */
export function hookChoices(
  lesson: LessonCopy,
  notes: VariantNotes = {},
): CopyChoice[] {
  return [
    { id: DEFAULT_ID, text: lesson.hook, note: '', isDefault: true },
    ...(lesson.hookAlts ?? []).map((v) => ({
      id: v.id,
      text: v.text,
      note: notes[v.id] ?? '',
      isDefault: false,
    })),
  ]
}

/** A lesson's teases, as `hookChoices` lists its hooks; none for a lesson with no tease. */
export function teaseChoices(
  lesson: LessonCopy,
  notes: VariantNotes = {},
): CopyChoice[] {
  if (lesson.tease === undefined) return []
  return [
    { id: DEFAULT_ID, text: lesson.tease, note: '', isDefault: true },
    ...(lesson.teaseAlts ?? []).map((v) => ({
      id: v.id,
      text: v.text,
      note: notes[v.id] ?? '',
      isDefault: false,
    })),
  ]
}

/** The season's own choices for a lesson, with the team's notes for its number. */
export const copyChoicesFor: CopyChoicesFor = (lesson) => ({
  hooks: hookChoices(lesson, HOOK_NOTES[lesson.n]),
  teases: teaseChoices(lesson, TEASE_NOTES[lesson.n]),
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
