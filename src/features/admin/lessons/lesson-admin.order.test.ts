// ============================================================
// Lesson admin's publish order — the lessons a publish would get ahead of
// ============================================================
//
// A lesson's page points back to the lessons it builds on, which its
// prerequisite chips name, and to the lesson its recall asks. Published
// before one of them, the page still works, but it names a lesson the
// learner cannot open, so the Lessons page asks first. These hold the rule
// it asks by, against the season's own map (season.ts PREREQ) and the
// console's list of the recalls outside it (RECALLS): every lesson that
// names another, not only the one that asked for it. In its own file,
// beside lesson-admin.test.ts.

import { describe, expect, it } from 'vitest'
import { LESSONS, PREREQ } from '@/features/lessons/kit/season'
import { aheadOf, RECALLS } from './lesson-admin'

const nonePublished = (): boolean => false
const allPublished = (): boolean => true

/** Lessons ahead of it that it builds on, and none its recall asks. */
const buildsOn = (...ns: number[]) => ({ buildsOn: ns, recalled: [] })

const NONE = buildsOn()

describe('RECALLS', () => {
  it("holds Lesson 3's recall of Lesson 2 and Lesson 8's of Lesson 6", () => {
    // Arrange: the console's list as it stands.

    // Act
    const lines = Object.entries(RECALLS)

    // Assert
    expect(lines).toEqual([
      ['3', [2]],
      ['8', [6]],
    ])
  })

  it('names only lessons the season map leaves out of what each lesson builds on', () => {
    // Arrange
    const lines = Object.entries(RECALLS).map(([n, ks]) => ({
      n: Number(n),
      ks: ks ?? [],
    }))

    // Act
    const onTheMap = lines.flatMap(({ n, ks }) =>
      ks.filter((k) => PREREQ[n]?.includes(k) === true),
    )

    // Assert
    expect(onTheMap).toEqual([])
  })
})

describe('aheadOf', () => {
  it('names the lesson a lesson builds on while it is not published', () => {
    // Arrange: nothing is published.

    // Act
    const ahead = [aheadOf(12, nonePublished), aheadOf(10, nonePublished)]

    // Assert: Lesson 12 recalls Lesson 10, and Lesson 10 recalls Lesson 6.
    expect(ahead).toEqual([buildsOn(10), buildsOn(6)])
  })

  it('names nothing once every lesson it builds on is published', () => {
    // Arrange
    const published = (n: number): boolean => n === 10 || n === 6

    // Act
    const ahead = [aheadOf(12, published), aheadOf(10, published)]

    // Assert
    expect(ahead).toEqual([NONE, NONE])
  })

  it('names only the ones not published, in lesson order', () => {
    // Arrange: Lesson 14 builds on Lessons 5, 8, 9 and 12; only 8 is live.
    const published = (n: number): boolean => n === 8

    // Act
    const ahead = aheadOf(14, published)

    // Assert
    expect(ahead).toEqual(buildsOn(5, 9, 12))
  })

  it('sorts what a map lists out of order', () => {
    // Arrange
    const map = { 7: [5, 2, 3] }

    // Act
    const ahead = aheadOf(7, nonePublished, map)

    // Assert
    expect(ahead).toEqual(buildsOn(2, 3, 5))
  })

  it('looks only at the lessons it builds on directly, not further back', () => {
    // Arrange: Lesson 10 is live, Lesson 6 behind it is not.
    const published = (n: number): boolean => n !== 6

    // Act
    const ahead = aheadOf(12, published)

    // Assert
    expect(ahead).toEqual(NONE)
  })

  it('names nothing for the trailer and Lesson 1, which name no lesson', () => {
    // Arrange: nothing is published.

    // Act
    const ahead = [aheadOf(0, nonePublished), aheadOf(1, nonePublished)]

    // Assert
    expect(ahead).toEqual([NONE, NONE])
  })

  it('covers every lesson that names another, from Lesson 2 to Lesson 14', () => {
    // Arrange: nothing is published.

    // Act
    const asked = LESSONS.filter((lesson) => {
      const ahead = aheadOf(lesson.n, nonePublished)
      return ahead.buildsOn.length + ahead.recalled.length > 0
    }).map((lesson) => lesson.n)

    // Assert
    expect(asked).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
  })

  it('names nothing for any lesson once every lesson is published', () => {
    // Arrange: everything is published.

    // Act
    const ahead = LESSONS.map((lesson) => aheadOf(lesson.n, allPublished))

    // Assert
    expect(ahead).toEqual(LESSONS.map(() => NONE))
  })
})

describe('aheadOf, for a recall outside the map', () => {
  it('names the lesson the recall asks beside the one the lesson builds on', () => {
    // Arrange: nothing is published.

    // Act
    const ahead = [aheadOf(3, nonePublished), aheadOf(8, nonePublished)]

    // Assert: both build on Lesson 1; Lesson 3's recall asks Lesson 2's
    // questions, and Lesson 8's asks Lesson 6's.
    expect(ahead).toEqual([
      { buildsOn: [1], recalled: [2] },
      { buildsOn: [1], recalled: [6] },
    ])
  })

  it('names the lesson the recall asks while it is not published, and only then', () => {
    // Arrange: Lesson 1 is live; Lesson 2 is live, Lesson 6 is not.
    const published = (n: number): boolean => n === 1 || n === 2

    // Act
    const ahead = [aheadOf(3, published), aheadOf(8, published)]

    // Assert
    expect(ahead).toEqual([NONE, { buildsOn: [], recalled: [6] }])
  })

  it('counts a lesson both built on and recalled once, as one it builds on', () => {
    // Arrange: Lesson 5 builds on Lessons 2 and 3, and its recall asks 3 and 4.
    const map = { 5: [2, 3] }
    const recalls = { 5: [3, 4] }

    // Act
    const ahead = aheadOf(5, nonePublished, map, recalls)

    // Assert
    expect(ahead).toEqual({ buildsOn: [2, 3], recalled: [4] })
  })

  it('names each recalled lesson once, in lesson order', () => {
    // Arrange
    const recalls = { 7: [5, 2, 5] }

    // Act
    const ahead = aheadOf(7, nonePublished, {}, recalls)

    // Assert
    expect(ahead).toEqual({ buildsOn: [], recalled: [2, 5] })
  })
})
