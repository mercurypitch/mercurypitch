import { describe, expect, it } from 'vitest'
import { doneLessonsFrom, LESSON_DONE_KEY } from './lesson-done'

describe('the lesson pages done list', () => {
  it('keeps the numbers and skips anything else', () => {
    expect(doneLessonsFrom([1, '2', null, 3])).toEqual([1, 3])
  })

  it('reads anything that is not a list as nothing done', () => {
    expect(doneLessonsFrom('1,2')).toEqual([])
    expect(doneLessonsFrom({ 1: true })).toEqual([])
    expect(doneLessonsFrom(null)).toEqual([])
    expect(doneLessonsFrom(undefined)).toEqual([])
  })

  it('is kept under the key the lesson pages have always used', () => {
    expect(LESSON_DONE_KEY).toBe('fyp-done')
  })
})
