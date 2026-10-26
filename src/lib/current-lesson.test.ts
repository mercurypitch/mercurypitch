import { afterEach, describe, expect, it, vi } from 'vitest'
import { DRAFT_LESSONS } from '@/features/lessons/kit/drafts'
import { LESSONS } from '@/features/lessons/kit/season'
import { currentLesson, currentLessonHref, LESSONS_HUB, readDoneLessons, RELEASED_LESSONS, } from './current-lesson'
import { LESSON_DONE_KEY } from './lesson-done'

/** The lesson pages' own list, as their quiz and explorer write it. */
const markDone = (value: string) =>
  window.localStorage.setItem(LESSON_DONE_KEY, value)

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('the released lessons', () => {
  it('are the season lessons with a page that are not drafts, as the season titles them', () => {
    // Arrange: what the lesson kit's own data says is released as built.
    const released = LESSONS.filter(
      (L) => L.page !== undefined && DRAFT_LESSONS[L.n] === undefined,
    ).map(({ n, title, page }) => ({ n, title, page }))

    // Assert
    expect(RELEASED_LESSONS).toEqual(released)
  })

  it('hold no draft', () => {
    expect(
      RELEASED_LESSONS.filter((L) => DRAFT_LESSONS[L.n] !== undefined),
    ).toEqual([])
  })
})

describe('currentLessonHref', () => {
  it('opens Lesson 1 when nothing is done', () => {
    expect(currentLessonHref()).toBe('/learn/01')
  })

  it('opens Lesson 2 once Lesson 1 is done', () => {
    // Arrange
    markDone('[1]')

    // Act
    const href = currentLessonHref()

    // Assert
    expect(href).toBe('/learn/02')
  })

  it('opens the hub once Lessons 1 and 2 are done', () => {
    markDone('[2,1]')

    expect(currentLessonHref()).toBe(LESSONS_HUB)
    expect(LESSONS_HUB).toBe('/learn/')
  })

  it('never opens a draft, even when it is the next number', () => {
    // Arrange: Lesson 3 has a page and comes next, but waits on a sign-off.
    const lesson3 = LESSONS.find((L) => L.n === 3)
    markDone('[1,2]')

    // Act
    const href = currentLessonHref()

    // Assert
    expect(lesson3?.page).toBe('/learn/03')
    expect(DRAFT_LESSONS[3]).toBeDefined()
    expect(href).toBe('/learn/')
  })

  it('opens the first lesson not done, whatever order they were marked in', () => {
    markDone('[2]')

    expect(currentLessonHref()).toBe('/learn/01')
  })

  it.each([
    ['not JSON', 'done'],
    ['an object', '{"1":true}'],
    ['numbers written as strings', '["1","2"]'],
    ['null', 'null'],
  ])('reads %s as nothing done, as the lesson pages do', (_, stored) => {
    markDone(stored)

    expect(currentLessonHref()).toBe('/learn/01')
  })

  it('reads a storage that throws as nothing done', () => {
    // Arrange: a private window or blocked site data.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })

    // Act
    const href = currentLessonHref()

    // Assert
    expect(href).toBe('/learn/01')
  })

  it('takes a done list in place of the stored one', () => {
    markDone('[1,2]')

    expect(currentLessonHref([])).toBe('/learn/01')
    expect(currentLesson([1])).toEqual({
      n: 2,
      title: 'Twelve notes',
      page: '/learn/02',
    })
    expect(currentLesson([1, 2])).toBeNull()
  })
})

describe('the done list', () => {
  it('is read under the lesson pages key', () => {
    markDone('[4]')

    expect(LESSON_DONE_KEY).toBe('fyp-done')
    expect(readDoneLessons()).toEqual([4])
  })
})
