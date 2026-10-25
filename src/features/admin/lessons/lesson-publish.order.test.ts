// ============================================================
// What the Lessons page asks before a publish — the words of its question
// ============================================================
//
// The page asks before it publishes a lesson that waits on its sign-off,
// and before one that would go live ahead of a lesson it builds on. When
// both hold it asks once, so the one question must name both. These hold
// every form of it word for word; the page test
// (AdminLessonsPage.order.test.tsx) holds when the page asks.

import { describe, expect, it } from 'vitest'
import { publishQuestion } from './lesson-publish'

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
