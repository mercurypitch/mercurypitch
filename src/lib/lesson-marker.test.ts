// ============================================================
// Lesson marker: the links the lessons print, and nothing else
// ============================================================

import { describe, expect, it } from 'vitest'
import { LESSONS } from '@/features/lessons/kit/season'
import { lessonFromSearch } from './lesson-marker'

describe('lessonFromSearch', () => {
  it.each([
    ['?lesson=01', 1],
    ['?lesson=02', 2],
    ['?lesson=09', 9],
    ['?lesson=10', 10],
    ['?lesson=14', 14],
  ])('reads %s as lesson %i', (search, lesson) => {
    expect(lessonFromSearch(search)).toBe(lesson)
  })

  it('reads the marker beside other parameters, in any order', () => {
    expect(lessonFromSearch('?utm_source=youtube&lesson=06')).toBe(6)
    expect(lessonFromSearch('?lesson=06&mp_internal=1')).toBe(6)
  })

  it.each([
    ['no query at all', ''],
    ['another parameter only', '?utm_source=youtube'],
    ['an empty value', '?lesson='],
    ['a bare key', '?lesson'],
    ['one digit', '?lesson=2'],
    ['three digits', '?lesson=002'],
    ['lesson 00', '?lesson=00'],
    ['past Season 1', '?lesson=15'],
    ['far past Season 1', '?lesson=99'],
    ['trailing junk', '?lesson=02x'],
    ['a trailing space', '?lesson=02%20'],
    ['a sign', '?lesson=+2'],
    ['a decimal', '?lesson=2.0'],
    ['another key', '?lessons=02'],
    ['another case', '?LESSON=02'],
  ])('ignores %s', (_case, search) => {
    expect(lessonFromSearch(search)).toBeNull()
  })

  it('reads only the first marker when a link carries two', () => {
    // URLSearchParams.get: the first one is the link's own.
    expect(lessonFromSearch('?lesson=03&lesson=07')).toBe(3)
    expect(lessonFromSearch('?lesson=99&lesson=07')).toBeNull()
  })

  it('never reads a hash route, which belongs to the router', () => {
    // location.search is empty when the only `?` is inside the fragment.
    const url = new URL('https://mercurypitch.com/#/ear-lab?lesson=02')

    expect(url.search).toBe('')
    expect(lessonFromSearch(url.search)).toBeNull()
  })
})

describe('the links the lessons print', () => {
  // A contract with the lesson kit: change how season.ts writes its marker
  // and this goes red before a lesson link stops working in the app.
  const linked = LESSONS.filter((lesson) => lesson.pr.link !== undefined)

  it('has the links to read', () => {
    // A guard: with no links, every case below would pass by not running.
    // Eight lessons link a drill today.
    expect(linked.length).toBeGreaterThanOrEqual(8)
  })

  it.each(linked.map((lesson) => [lesson.n, lesson.pr.link?.href ?? '']))(
    "reads lesson %i's own number off its practise link %s",
    (n, href) => {
      const url = new URL(href, 'https://mercurypitch.com')

      expect(lessonFromSearch(url.search)).toBe(n)
    },
  )

  it("accepts every Season 1 lesson's number and none beyond the season", () => {
    const numbered = LESSONS.filter((lesson) => lesson.n > 0).map(
      (lesson) => lesson.n,
    )
    const marker = (n: number): string =>
      `?lesson=${String(n).padStart(2, '0')}`

    expect(numbered.map((n) => lessonFromSearch(marker(n)))).toEqual(numbered)
    expect(lessonFromSearch(marker(numbered.length + 1))).toBeNull()
  })
})
