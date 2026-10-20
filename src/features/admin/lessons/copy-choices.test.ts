// ============================================================
// Lesson copy choices — what the pickers offer, and what a saved id means
// ============================================================
//
// The lists are the kit's (lesson-copy.test.ts holds their rules); what is
// tested here is that the season's own lists reach the pickers, and that a
// picker reads a saved id exactly as the site does, through the kit's own
// resolvers: the variant it names, or the default for none, for 'default'
// and for an id this build does not hold.

import { describe, expect, it } from 'vitest'
import { DEFAULT_ID, hookFor, teaseFor, } from '@/features/lessons/kit/lesson-copy'
import type { Lesson } from '@/features/lessons/kit/season'
import { LESSONS } from '@/features/lessons/kit/season'
import type { CopyChoice } from './copy-choices'
import { chosenId, copyChoicesFor, savedValue, unknownSaved, } from './copy-choices'

function seasonLesson(test: (lesson: Lesson) => boolean, what: string): Lesson {
  const lesson = LESSONS.find(test)
  if (lesson === undefined) throw new Error(`no lesson with ${what}`)
  return lesson
}

/** A lesson the kit gives alternative hooks, and one it gives a tease. */
const VARIED = seasonLesson(
  (lesson) => (lesson.hookAlts ?? []).length > 0,
  'alternative hooks',
)
const TEASED = seasonLesson((lesson) => lesson.tease !== undefined, 'a tease')
const UNTEASED = seasonLesson(
  (lesson) => lesson.n > 0 && lesson.tease === undefined,
  'no tease',
)

const SAVED_IDS = [
  ...(VARIED.hookAlts ?? []).map((alt) => alt.id),
  DEFAULT_ID,
  'gone',
  null,
  undefined,
]

describe('copyChoicesFor', () => {
  it("offers a lesson's own hook first, then each alternative the kit holds, with its note", () => {
    const { hooks } = copyChoicesFor(VARIED)

    expect(hooks[0]).toEqual({
      id: DEFAULT_ID,
      text: VARIED.hook,
      note: '',
      isDefault: true,
    })
    expect(hooks.slice(1)).toEqual(
      (VARIED.hookAlts ?? []).map((alt) => ({
        id: alt.id,
        text: alt.text,
        note: alt.note,
        isDefault: false,
      })),
    )
  })

  it('offers a tease only for a lesson that has one, its own first', () => {
    expect(copyChoicesFor(TEASED).teases[0]).toEqual({
      id: DEFAULT_ID,
      text: TEASED.tease,
      note: '',
      isDefault: true,
    })
    expect(copyChoicesFor(UNTEASED).teases).toEqual([])
  })
})

describe('what a saved id means to a picker', () => {
  it('presses what the site shows: the variant a saved id names, or the default', () => {
    const { hooks } = copyChoicesFor(VARIED)
    const { teases } = copyChoicesFor(TEASED)

    for (const saved of SAVED_IDS) {
      expect(chosenId(hooks, saved)).toBe(hookFor(VARIED, saved).id)
      expect(chosenId(teases, saved)).toBe(teaseFor(TEASED, saved)?.id)
    }
  })

  it("names a saved id the build does not hold, and takes 'default' for the default", () => {
    const { hooks } = copyChoicesFor(VARIED)
    const [alt] = VARIED.hookAlts ?? []

    expect(unknownSaved(hooks, 'gone')).toBe('gone')
    expect(unknownSaved(hooks, alt?.id)).toBeNull()
    expect(unknownSaved(hooks, DEFAULT_ID)).toBeNull()
    expect(unknownSaved(hooks, null)).toBeNull()
    expect(unknownSaved([], DEFAULT_ID)).toBe(DEFAULT_ID)
  })

  it('saves a variant by its id and the default as null', () => {
    const variant: CopyChoice = {
      id: 'figures',
      text: 'Which of two notes is higher?',
      note: 'Leads with the numbers.',
      isDefault: false,
    }
    const byDefault: CopyChoice = {
      ...variant,
      id: DEFAULT_ID,
      isDefault: true,
    }

    expect(savedValue(variant)).toBe('figures')
    expect(savedValue(byDefault)).toBeNull()
    expect(chosenId([], null)).toBeNull()
  })
})
