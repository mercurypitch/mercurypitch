// ============================================================
// Lesson copy choices — what the pickers offer, and what a saved id means
// ============================================================
//
// The lists are the kit's (lesson-copy.test.ts holds their rules) and the
// notes are team-notes.ts's (team-notes.test.ts holds them to the lists);
// what is tested here is that the season's own lists reach the pickers, each
// variant with its own note, and that a picker reads a saved id exactly as
// the site does, through the kit's own resolvers: the variant it names, or
// the default for none, for 'default' and for an id this build does not hold.

import { describe, expect, it } from 'vitest'
import type { LessonCopy } from '@/features/lessons/kit/lesson-copy'
import { DEFAULT_ID, hookFor, teaseFor, } from '@/features/lessons/kit/lesson-copy'
import type { Lesson } from '@/features/lessons/kit/season'
import { LESSONS } from '@/features/lessons/kit/season'
import { HOOK_NOTES, TEASE_NOTES } from '@/features/lessons/kit/team-notes'
import type { CopyChoice } from './copy-choices'
import { chosenId, copyChoicesFor, hookChoices, savedValue, teaseChoices, unknownSaved, } from './copy-choices'

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
/** A lesson the kit gives an alternative tease. */
const TEASE_VARIED = seasonLesson(
  (lesson) => (lesson.teaseAlts ?? []).length > 0,
  'alternative teases',
)
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

/** A lesson's copy for a list test: a default hook, two alternatives, a tease with one alternative. */
const copy: LessonCopy = {
  hook: 'Why the default?',
  hookAlts: [
    { id: 'plain', text: 'Is 3 < 4 & so on?' },
    {
      id: 'styled',
      text: 'Why 440 Hz?',
      html: 'Why <span class="hz o">440&#8239;Hz</span>?',
    },
  ],
  tease: 'The default tease.',
  teaseAlts: [{ id: 'short', text: 'A shorter tease.' }],
}

describe('hookChoices and teaseChoices', () => {
  it('list the default first, then every alternative with the note filed under its id', () => {
    // Act
    const hooks = hookChoices(copy, {
      plain: 'An alternative with no markup.',
      styled: 'An alternative with markup of its own.',
    })
    const teases = teaseChoices(copy, { short: 'Shorter.' })

    // Assert
    expect(hooks).toEqual([
      { id: 'default', text: 'Why the default?', note: '', isDefault: true },
      {
        id: 'plain',
        text: 'Is 3 < 4 & so on?',
        note: 'An alternative with no markup.',
        isDefault: false,
      },
      {
        id: 'styled',
        text: 'Why 440 Hz?',
        note: 'An alternative with markup of its own.',
        isDefault: false,
      },
    ])
    expect(teases).toEqual([
      { id: 'default', text: 'The default tease.', note: '', isDefault: true },
      {
        id: 'short',
        text: 'A shorter tease.',
        note: 'Shorter.',
        isDefault: false,
      },
    ])
  })

  it('still offer a variant that has no note, with none', () => {
    // Act: a note for some other id, and none at all
    const hooks = hookChoices(copy, { gone: 'A note for no variant.' })
    const teases = teaseChoices(copy)

    // Assert
    expect(hooks.map((c) => [c.id, c.note])).toEqual([
      ['default', ''],
      ['plain', ''],
      ['styled', ''],
    ])
    expect(teases.map((c) => [c.id, c.note])).toEqual([
      ['default', ''],
      ['short', ''],
    ])
  })

  it('offer a lesson with no alternatives its default hook alone, and no tease at all', () => {
    // Act
    const hooks = hookChoices({ hook: 'Why?' })
    const teases = teaseChoices({ hook: 'Why?' })

    // Assert
    expect(hooks).toEqual([
      { id: 'default', text: 'Why?', note: '', isDefault: true },
    ])
    expect(teases).toEqual([])
  })
})

describe('copyChoicesFor', () => {
  it("offers a lesson's own hook first, then each alternative the kit holds, with the team's note for it", () => {
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
        note: HOOK_NOTES[VARIED.n]?.[alt.id],
        isDefault: false,
      })),
    )
    expect(hooks.slice(1).every((choice) => choice.note !== '')).toBe(true)
  })

  it("offers Lesson 5's neutral hook, `steady`, after its own, with the team's note", () => {
    const L5 = seasonLesson((lesson) => lesson.n === 5, 'the number 5')

    const { hooks } = copyChoicesFor(L5)

    expect(hooks.map((choice) => [choice.id, choice.isDefault])).toEqual([
      [DEFAULT_ID, true],
      ['steady', false],
    ])
    expect(hooks[1]).toEqual({
      id: 'steady',
      text: 'Singers are told to “support” a long note. What keeps it steady?',
      note: HOOK_NOTES[5]?.steady,
      isDefault: false,
    })
    expect(hooks[1].note).not.toBe('')
  })

  it("gives each tease alternative the team's note from the tease notes", () => {
    const { teases } = copyChoicesFor(TEASE_VARIED)

    expect(teases.slice(1)).toEqual(
      (TEASE_VARIED.teaseAlts ?? []).map((alt) => ({
        id: alt.id,
        text: alt.text,
        note: TEASE_NOTES[TEASE_VARIED.n]?.[alt.id],
        isDefault: false,
      })),
    )
    expect(teases.slice(1).every((choice) => choice.note !== '')).toBe(true)
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
