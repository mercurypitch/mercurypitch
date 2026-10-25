// ============================================================
// Lesson admin's publish order — the lessons a publish would get ahead of
// ============================================================
//
// A lesson's page points back to the lessons it builds on: its
// prerequisite chips name them. Published before one of them, the page
// still works, but it names a lesson the learner cannot open, so the
// Lessons page asks first. These hold the rule it asks by, against the
// season's own map (season.ts PREREQ): every lesson that builds on another,
// not only the one that asked for it. In its own file, beside
// lesson-admin.test.ts.

import { describe, expect, it } from 'vitest'
import { LESSONS } from '@/features/lessons/kit/season'
import { aheadOf } from './lesson-admin'

const nonePublished = (): boolean => false
const allPublished = (): boolean => true

describe('aheadOf', () => {
  it('names the lesson a lesson builds on while it is not published', () => {
    // Arrange: nothing is published.

    // Act
    const ahead = [aheadOf(12, nonePublished), aheadOf(10, nonePublished)]

    // Assert: Lesson 12 recalls Lesson 10, and Lesson 10 recalls Lesson 6.
    expect(ahead).toEqual([[10], [6]])
  })

  it('names nothing once every lesson it builds on is published', () => {
    // Arrange
    const published = (n: number): boolean => n === 10 || n === 6

    // Act
    const ahead = [aheadOf(12, published), aheadOf(10, published)]

    // Assert
    expect(ahead).toEqual([[], []])
  })

  it('names only the ones not published, in lesson order', () => {
    // Arrange: Lesson 14 builds on Lessons 5, 8, 9 and 12; only 8 is live.
    const published = (n: number): boolean => n === 8

    // Act
    const ahead = aheadOf(14, published)

    // Assert
    expect(ahead).toEqual([5, 9, 12])
  })

  it('sorts what a map lists out of order', () => {
    // Arrange
    const map = { 7: [5, 2, 3] }

    // Act
    const ahead = aheadOf(7, nonePublished, map)

    // Assert
    expect(ahead).toEqual([2, 3, 5])
  })

  it('looks only at the lessons it builds on directly, not further back', () => {
    // Arrange: Lesson 10 is live, Lesson 6 behind it is not.
    const published = (n: number): boolean => n !== 6

    // Act
    const ahead = aheadOf(12, published)

    // Assert
    expect(ahead).toEqual([])
  })

  it('names nothing for the trailer and Lesson 1, which build on no lesson', () => {
    // Arrange: nothing is published.

    // Act
    const ahead = [aheadOf(0, nonePublished), aheadOf(1, nonePublished)]

    // Assert
    expect(ahead).toEqual([[], []])
  })

  it('covers every lesson that builds on another, from Lesson 2 to Lesson 14', () => {
    // Arrange: nothing is published.

    // Act
    const asked = LESSONS.filter(
      (lesson) => aheadOf(lesson.n, nonePublished).length > 0,
    ).map((lesson) => lesson.n)

    // Assert
    expect(asked).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
  })

  it('names nothing for any lesson once every lesson is published', () => {
    // Arrange: everything is published.

    // Act
    const ahead = LESSONS.flatMap((lesson) => aheadOf(lesson.n, allPublished))

    // Assert
    expect(ahead).toEqual([])
  })
})
