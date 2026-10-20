// ============================================================
// Lesson publishing rules — the state on this site, why, and the words for it
// ============================================================
//
// The page draws what these rules say, so they hold the facts the owner acts
// on: an override wins over the code, a lesson with no page is never
// published, who set an override is the newest change of that field, and
// every line the page prints after a save is the one it should be. Against
// the season's own data, drafts shown, as on the dev site.

import { describe, expect, it } from 'vitest'
import type { Lesson } from '@/features/lessons/kit/season'
import { LESSONS } from '@/features/lessons/kit/season'
import type { LessonStateChange } from '@/lib/lesson-state'
import type { LessonRow } from './lesson-admin'
import { lessonRows } from './lesson-admin'
import { changeLine, changeTime, defaultSentence, failedMessage, publishView, reasonLine, savedMessage, stateWord, } from './lesson-publish'
import { AT, logged } from './lesson-site.test-fixtures'

/** A line as it reads: the no-break spaces in a time read as spaces. */
const plain = (line: string): string => line.replace(/\u00a0/g, ' ')

function rowFor(
  n: number,
  rows: readonly LessonRow[] = lessonRows(),
): LessonRow {
  const row = rows.find((r) => r.lesson.n === n)
  if (row === undefined) throw new Error(`no row for lesson ${n}`)
  return row
}

/** A season entry as a build that leaves drafts out folds it: no page. */
function withoutPage(lesson: Lesson): Lesson {
  const folded: { -readonly [K in keyof Lesson]: Lesson[K] } = { ...lesson }
  delete folded.page
  delete folded.minutes
  return folded
}

const released = rowFor(1)
const shownDraft = rowFor(3)
const hiddenDraft = rowFor(
  3,
  lessonRows([withoutPage(LESSONS[3])], { 3: 'a sign-off' }),
)
const planned = rowFor(6)
const trailer = rowFor(0)

describe('publishView', () => {
  it("reads the code's default where nothing is set here: released, a draft this site shows, a draft it hides", () => {
    const views = [released, shownDraft, hiddenDraft].map((row) =>
      publishView(row, {}, null),
    )

    expect(
      views.map((view) => [view.published, view.reason, view.overridden]),
    ).toEqual([
      [true, 'released', false],
      [true, 'draft-shown', false],
      [false, 'draft-hidden', false],
    ])
  })

  it('lets an override set here win over the code, either way', () => {
    expect(publishView(released, { published: false }, null)).toMatchObject({
      published: false,
      byDefault: true,
      reason: 'set',
      overridden: true,
    })
    expect(publishView(hiddenDraft, { published: true }, null)).toMatchObject({
      published: true,
      byDefault: false,
      reason: 'set',
    })
  })

  it('never publishes a lesson with no page, whatever is stored for it', () => {
    const view = publishView(planned, { published: true }, null)

    expect(view).toMatchObject({
      published: false,
      canPublish: false,
      reason: 'no-page',
      overridden: true,
    })
    expect(stateWord(view)).toBe('No page yet')
    expect(stateWord(publishView(trailer, {}, null))).toBe('No page')
  })

  it('takes who set it from the newest change of the publish field, past newer wording changes', () => {
    const log: LessonStateChange[] = [
      logged({ id: 3, lesson: 1, field: 'hook', newValue: 'short' }),
      logged({
        id: 2,
        lesson: 1,
        field: 'published',
        newValue: false,
        changedBy: 'coach@example',
      }),
      logged({ id: 1, lesson: 1, field: 'published', newValue: true }),
    ]

    const view = publishView(released, { published: false }, log)

    expect(view.change?.id).toBe(2)
    expect(plain(reasonLine(view))).toBe(
      'Set here by coach@example, Oct 20, 2:02 PM',
    )
  })

  it('says "Set here" alone until the log is read', () => {
    expect(reasonLine(publishView(released, { published: false }, null))).toBe(
      'Set here',
    )
  })
})

describe('the words', () => {
  it('writes each change as one line: what, by whom, and when', () => {
    const lines = [
      logged({ lesson: 1, field: 'published', newValue: true }),
      logged({
        lesson: 1,
        field: 'published',
        newValue: false,
        changedBy: null,
      }),
      logged({ lesson: 1, field: 'published', newValue: null }),
      logged({ lesson: 1, field: 'hook', newValue: 'figures' }),
      logged({ lesson: 1, field: 'tease', newValue: null, oldValue: 'stair' }),
    ].map((change) => plain(changeLine(change)))

    expect(lines).toEqual([
      'Published by owner@example, Oct 20, 2:02 PM',
      'Unpublished with the shared admin key, Oct 20, 2:02 PM',
      'Publishing set back to the default by owner@example, Oct 20, 2:02 PM',
      'Hook set to “figures” by owner@example, Oct 20, 2:02 PM',
      'Tease set back to the default by owner@example, Oct 20, 2:02 PM',
    ])
  })

  it('breaks a time only after its comma, so "2:02 PM" never splits across lines', () => {
    expect(changeTime(AT)).toBe('Oct\u00a020, 2:02\u00a0PM')
  })

  it('keeps a time it cannot read as the text it was given', () => {
    expect(
      changeLine(
        logged({
          lesson: 1,
          field: 'published',
          newValue: true,
          changedAt: 'yesterday',
        }),
      ),
    ).toBe('Published by owner@example, yesterday')
    expect(AT).toMatch(/^2026-10-20T/)
  })

  it('states the default on this site for each kind of lesson', () => {
    expect(
      [released, shownDraft, hiddenDraft, planned].map(defaultSentence),
    ).toEqual([
      'The default here is published: it is released in code.',
      'The default here is published: this site shows drafts.',
      'The default here is unpublished: this site leaves drafts out.',
      'It has no page yet, so there is nothing to publish.',
    ])
  })

  it('says what a save did, and that the site follows within about a minute', () => {
    expect([
      savedMessage('Lesson 3', 'published', true, true, true),
      savedMessage('Lesson 3', 'published', null, true, false),
      savedMessage('Lesson 3', 'hook', 'figures', true, true),
      savedMessage('Trailer', 'hook', null, true, false),
      savedMessage('Lesson 3', 'tease', 'stair', false, true),
    ]).toEqual([
      'Lesson 3 is published here. The site follows within about a minute.',
      'Lesson 3 is back to the default here: unpublished. The site follows within about a minute.',
      "Lesson 3's hook is now “figures”. The site follows within about a minute.",
      "The trailer's hook is back to the default. The site follows within about a minute.",
      'Lesson 3 already had that, so nothing changed.',
    ])
  })

  it("says why a save failed: a refused key and how to unlock, the API's own words, or no connection", () => {
    expect([
      failedMessage('Lesson 3', {
        kind: 'forbidden',
        message: 'Admin key required',
      }),
      failedMessage('Lesson 3', {
        kind: 'refused',
        status: 400,
        message: 'Set at least one of published, hook, or tease',
      }),
      failedMessage('Lesson 3', { kind: 'offline', message: 'unused' }),
    ]).toEqual([
      'Lesson 3 was not saved: the admin key was not accepted. Change admin key to unlock the studio again.',
      'Lesson 3 was not saved: Set at least one of published, hook, or tease.',
      'Lesson 3 was not saved: the content API could not be reached. Check the connection, then try again.',
    ])
  })
})
