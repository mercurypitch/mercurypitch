// ============================================================
// What the Lessons page asks before a publish — the words of its question
// ============================================================
//
// The page asks before it publishes a lesson that waits on its sign-off,
// and before one that would go live ahead of a lesson it builds on or a
// lesson its recall asks. However many hold it asks once, so the one
// question must name them all, each as what it is to the lesson. These
// hold every form of it word for word, and when "Use default" asks too;
// the page test (AdminLessonsPage.order.test.tsx) holds when the page asks.

import { describe, expect, it } from 'vitest'
import type { LessonRow } from './lesson-admin'
import { lessonRows } from './lesson-admin'
import { defaultGoesLive, publishQuestion, publishView } from './lesson-publish'

const WAITS =
  "Lesson 10's page at /learn/10, and the vocal coach's look at the sung checkpoint"

const SIGN_OFF = "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"

/** Lessons ahead of it: those it builds on, and those only its recall asks. */
const ahead = (buildsOn: number[], recalled: number[] = []) => ({
  buildsOn,
  recalled,
})

const NONE = ahead([])

describe('publishQuestion', () => {
  it('asks nothing of a lesson with no sign-off to wait on and nothing to get ahead of', () => {
    // Arrange: no drafts line, and every lesson it names is published.

    // Act
    const question = publishQuestion('Lesson 2', null, NONE)

    // Assert
    expect(question).toBeNull()
  })

  it('names what a draft waits on, as it always has', () => {
    // Arrange: a drafts line, and nothing to get ahead of.

    // Act
    const question = publishQuestion('Lesson 3', "the owner's go-ahead", NONE)

    // Assert
    expect(question).toEqual({
      title: 'Publish Lesson 3 before its sign-off?',
      message: "Lesson 3 waits on the owner's go-ahead. Publish it anyway?",
    })
  })

  it('names the lesson it would get ahead of, with no drafts line', () => {
    // Arrange: no drafts line, and Lesson 10 is not published.

    // Act
    const question = publishQuestion('Lesson 12', null, ahead([10]))

    // Assert
    expect(question).toEqual({
      title: 'Publish Lesson 12 before Lesson 10?',
      message:
        'Lesson 12 builds on Lesson 10, which is not published here. Publish it anyway?',
    })
  })

  it('names two lessons it would get ahead of together', () => {
    // Arrange
    const held = ahead([2, 3])

    // Act
    const question = publishQuestion('Lesson 5', null, held)

    // Assert
    expect(question).toEqual({
      title: 'Publish Lesson 5 before Lessons 2 and 3?',
      message:
        'Lesson 5 builds on Lessons 2 and 3, which are not published here. Publish it anyway?',
    })
  })

  it('lists three or more lessons with commas and a last "and"', () => {
    // Arrange
    const held = ahead([5, 9, 12])

    // Act
    const question = publishQuestion('Lesson 14', null, held)

    // Assert
    expect(question?.title).toBe(
      'Publish Lesson 14 before Lessons 5, 9 and 12?',
    )
  })

  it('asks once, naming both the sign-off and the lesson, when a draft would also get ahead of one', () => {
    // Arrange: Lesson 12's drafts line stands, and Lesson 10 is not published.

    // Act
    const question = publishQuestion('Lesson 12', WAITS, ahead([10]))

    // Assert
    expect(question).toEqual({
      title: 'Publish Lesson 12 before its sign-off and before Lesson 10?',
      message: `Lesson 12 waits on ${WAITS}. It also builds on Lesson 10, which is not published here. Publish it anyway?`,
    })
  })
})

describe('publishQuestion, for a lesson its recall asks', () => {
  it('says the recall asks its questions, never that the lesson builds on it', () => {
    // Arrange: no drafts line; Lesson 1 is live, Lesson 2 is not.

    // Act
    const question = publishQuestion('Lesson 3', null, ahead([], [2]))

    // Assert
    expect(question).toEqual({
      title: 'Publish Lesson 3 before Lesson 2?',
      message:
        "Lesson 3's recall asks Lesson 2's questions, and Lesson 2 is not published here. Publish it anyway?",
    })
  })

  it('says what each lesson is to it when it would get ahead of both kinds', () => {
    // Arrange: no drafts line; Lessons 1 and 6 are not published.

    // Act
    const question = publishQuestion('Lesson 8', null, ahead([1], [6]))

    // Assert
    expect(question).toEqual({
      title: 'Publish Lesson 8 before Lessons 1 and 6?',
      message:
        "Lesson 8 builds on Lesson 1, which is not published here. Its recall also asks Lesson 6's questions, and Lesson 6 is not published here. Publish it anyway?",
    })
  })

  it('names every lesson in the title in lesson order, whichever kind each is', () => {
    // Arrange: it builds on Lesson 6, and its recall asks Lesson 2.
    const held = ahead([6], [2])

    // Act
    const question = publishQuestion('Lesson 9', null, held)

    // Assert
    expect(question?.title).toBe('Publish Lesson 9 before Lessons 2 and 6?')
  })

  it('asks a draft once, naming its sign-off and the lesson its recall asks', () => {
    // Arrange: Lesson 3's drafts line stands; Lesson 2 is not published.

    // Act
    const question = publishQuestion('Lesson 3', SIGN_OFF, ahead([], [2]))

    // Assert
    expect(question).toEqual({
      title: 'Publish Lesson 3 before its sign-off and before Lesson 2?',
      message: `Lesson 3 waits on ${SIGN_OFF}. Its recall also asks Lesson 2's questions, and Lesson 2 is not published here. Publish it anyway?`,
    })
  })

  it('asks a draft once, naming its sign-off and every lesson of both kinds', () => {
    // Arrange: Lesson 8's drafts line stands; Lessons 1 and 6 are not published.

    // Act
    const question = publishQuestion('Lesson 8', SIGN_OFF, ahead([1], [6]))

    // Assert
    expect(question).toEqual({
      title: 'Publish Lesson 8 before its sign-off and before Lessons 1 and 6?',
      message: `Lesson 8 waits on ${SIGN_OFF}. It also builds on Lesson 1, which is not published here. Its recall also asks Lesson 6's questions, and Lesson 6 is not published here. Publish it anyway?`,
    })
  })

  it('names two lessons a recall asks together', () => {
    // Arrange
    const held = ahead([], [2, 3])

    // Act
    const question = publishQuestion('Lesson 9', null, held)

    // Assert
    expect(question).toEqual({
      title: 'Publish Lesson 9 before Lessons 2 and 3?',
      message:
        "Lesson 9's recall asks questions from Lessons 2 and 3, which are not published here. Publish it anyway?",
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
