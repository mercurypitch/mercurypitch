// ============================================================
// What the Lessons page asks before a publish — the words of its question
// ============================================================
//
// The page asks before it publishes a lesson that waits on its sign-off,
// and before one that would go live ahead of a lesson it builds on. When
// both hold it asks once, so the one question must name both. These hold
// every form of it word for word, and when "Use default" asks too; the
// page test (AdminLessonsPage.order.test.tsx) holds when the page asks.

import { describe, expect, it } from 'vitest'
import type { LessonRow } from './lesson-admin'
import { lessonRows } from './lesson-admin'
import { defaultGoesLive, publishQuestion, publishView } from './lesson-publish'

const WAITS =
  "Lesson 10's page at /learn/10, and the vocal coach's look at the sung checkpoint"

describe('publishQuestion', () => {
  it('asks nothing of a lesson with no sign-off to wait on and nothing to get ahead of', () => {
    // Arrange: no drafts line, and every lesson it builds on is published.

    // Act
    const question = publishQuestion('Lesson 2', null, [])

    // Assert
    expect(question).toBeNull()
  })

  it('names what a draft waits on, as it always has', () => {
    // Arrange: a drafts line, and nothing to get ahead of.

    // Act
    const question = publishQuestion('Lesson 3', "the owner's go-ahead", [])

    // Assert
    expect(question).toEqual({
      title: 'Publish Lesson 3 before its sign-off?',
      message: "Lesson 3 waits on the owner's go-ahead. Publish it anyway?",
    })
  })

  it('names the lesson it would get ahead of, with no drafts line', () => {
    // Arrange: no drafts line, and Lesson 10 is not published.

    // Act
    const question = publishQuestion('Lesson 12', null, [10])

    // Assert
    expect(question).toEqual({
      title: 'Publish Lesson 12 before Lesson 10?',
      message:
        'Lesson 12 builds on Lesson 10, which is not published here. Publish it anyway?',
    })
  })

  it('names two lessons it would get ahead of together', () => {
    // Arrange
    const ahead = [2, 3]

    // Act
    const question = publishQuestion('Lesson 5', null, ahead)

    // Assert
    expect(question).toEqual({
      title: 'Publish Lesson 5 before Lessons 2 and 3?',
      message:
        'Lesson 5 builds on Lessons 2 and 3, which are not published here. Publish it anyway?',
    })
  })

  it('lists three or more lessons with commas and a last "and"', () => {
    // Arrange
    const ahead = [5, 9, 12]

    // Act
    const question = publishQuestion('Lesson 14', null, ahead)

    // Assert
    expect(question?.title).toBe(
      'Publish Lesson 14 before Lessons 5, 9 and 12?',
    )
  })

  it('asks once, naming both the sign-off and the lesson, when a draft would also get ahead of one', () => {
    // Arrange: Lesson 12's drafts line stands, and Lesson 10 is not published.

    // Act
    const question = publishQuestion('Lesson 12', WAITS, [10])

    // Assert
    expect(question).toEqual({
      title: 'Publish Lesson 12 before its sign-off and before Lesson 10?',
      message: `Lesson 12 waits on ${WAITS}. It also builds on Lesson 10, which is not published here. Publish it anyway?`,
    })
  })
})

/** Lesson `n`'s row in the season as it stands. */
function rowOf(n: number): LessonRow {
  const row = lessonRows().find((r) => r.lesson.n === n)
  if (row === undefined) throw new Error(`no row for lesson ${n}`)
  return row
}

describe('defaultGoesLive', () => {
  it('holds for a lesson unpublished here whose default is published', () => {
    // Arrange: Lesson 2 is released in code, and set unpublished here.
    const view = publishView(rowOf(2), { published: false }, null, true)

    // Act
    const live = defaultGoesLive(view)

    // Assert
    expect(live).toBe(true)
  })

  it('holds for a draft unpublished here on a site that shows drafts', () => {
    // Arrange
    const view = publishView(rowOf(3), { published: false }, null, true)

    // Act
    const live = defaultGoesLive(view)

    // Assert
    expect(live).toBe(true)
  })

  it('does not hold for a draft unpublished here on a site that leaves drafts out', () => {
    // Arrange: going back to the default leaves it unpublished.
    const view = publishView(rowOf(3), { published: false }, null, false)

    // Act
    const live = defaultGoesLive(view)

    // Assert
    expect(live).toBe(false)
  })

  it('does not hold for a draft published here on a site that leaves drafts out', () => {
    // Arrange: going back to the default unpublishes it.
    const view = publishView(rowOf(3), { published: true }, null, false)

    // Act
    const live = defaultGoesLive(view)

    // Assert
    expect(live).toBe(false)
  })

  it('does not hold for a lesson published here whose default is published too', () => {
    // Arrange: going back to the default keeps it live.
    const view = publishView(rowOf(2), { published: true }, null, true)

    // Act
    const live = defaultGoesLive(view)

    // Assert
    expect(live).toBe(false)
  })

  it('does not hold for a lesson with no page to publish, whatever its build says', () => {
    // Arrange: Lesson 2's row with no address, set unpublished here.
    const row: LessonRow = { ...rowOf(2), path: null }
    const view = publishView(row, { published: false }, null, true)

    // Act
    const live = defaultGoesLive(view)

    // Assert
    expect(live).toBe(false)
  })
})
