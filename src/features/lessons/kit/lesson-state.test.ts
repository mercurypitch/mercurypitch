// ============================================================
// Lesson state tests — where each lesson stands, and its one action
// ============================================================

import { describe, expect, it } from 'vitest'
import type { Viewer } from './lesson-state'
import { lessonViews, upNext } from './lesson-state'
import type { StepMarks } from './position'
import { defaultPageState, seasonFor } from './publish'
import type { Lesson } from './season'
import { LESSONS } from './season'

/** Lesson `n` of a season for a state test, live when `live`; its prerequisites are the real season's. */
const lesson = (n: number, live: boolean): Lesson => ({
  n,
  lane: 'theory',
  title: `Lesson ${n}`,
  short: `Lesson ${n}`,
  topics: [],
  hook: 'Why?',
  pr: {},
  ...(live ? { minutes: 10, page: `/learn/0${n}` } : {}),
})

/** The trailer and Lesson 5 coming later, Lessons 1 to 4 live. */
const SEASON = [0, 1, 2, 3, 4, 5].map((n) => lesson(n, n >= 1 && n <= 4))

const viewer = (
  current: number,
  done: readonly number[] = [],
  steps: StepMarks = {},
): Viewer => ({ current, done: new Set(done), steps })

describe('lessonViews', () => {
  it('reads each lesson as done, here, in progress, up next, ready or coming later', () => {
    // Arrange: on Lesson 2's page, Lesson 1 done, Lesson 4 left at step 3
    const on2 = viewer(2, [1], { 4: { step: 3, of: 6 } })

    // Act
    const states = lessonViews(SEASON, on2).map((v) => v.state)

    // Assert
    expect(states).toEqual([
      'later',
      'done',
      'here',
      'next',
      'progress',
      'later',
    ])
  })

  it('gives each live lesson one action: start at its top, continue at its step, or read it again', () => {
    // Arrange: on Lesson 3's page
    const on3 = viewer(3, [1], { 2: { step: 4, of: 6 } })

    // Act
    const actions = lessonViews(SEASON, on3).map((v) => v.action)

    // Assert
    expect(actions).toEqual([
      null,
      { kind: 'again', label: 'Read again', href: '/learn/01' },
      { kind: 'continue', label: 'Continue: step 4', href: '/learn/02#step-4' },
      { kind: 'start', label: 'Start lesson', href: '#top' },
      { kind: 'start', label: 'Start lesson', href: '/learn/04' },
      null,
    ])
  })

  it("keeps the page's own lesson within the page, done or not", () => {
    // Act
    const begun = lessonViews(
      SEASON,
      viewer(2, [], { 2: { step: 3, of: 6 } }),
    )[2]
    const done = lessonViews(SEASON, viewer(2, [2]))[2]

    // Assert
    expect([begun.state, begun.action?.href]).toEqual(['here', '#step-3'])
    expect([done.state, done.done, done.action]).toEqual([
      'here',
      true,
      { kind: 'again', label: 'Read again', href: '#top' },
    ])
  })

  it('starts a lesson left on its first step from the top', () => {
    // Act
    const L4 = lessonViews(SEASON, viewer(1, [], { 4: { step: 1, of: 6 } }))[4]

    // Assert
    expect([L4.state, L4.step, L4.action?.label]).toEqual([
      'ready',
      null,
      'Start lesson',
    ])
  })

  it('forgets a step kept for a lesson that is done or has no page', () => {
    // Arrange
    const steps = { 4: { step: 3, of: 6 }, 5: { step: 2, of: 6 } }

    // Act
    const [L4, L5] = lessonViews(SEASON, viewer(1, [4], steps)).slice(4)

    // Assert
    expect([L4.state, L4.step, L4.action?.kind]).toEqual([
      'done',
      null,
      'again',
    ])
    expect([L5.state, L5.step, L5.action]).toEqual(['later', null, null])
  })
})

describe('upNext', () => {
  it("recommends the first live lesson whose prerequisites are all done, never this page's own", () => {
    // Act
    const picks = [
      viewer(1),
      viewer(2),
      viewer(1, [1]),
      viewer(2, [1]),
      viewer(3, [1, 2, 3]),
      viewer(1, [1, 2, 3, 4]),
    ].map((v) => upNext(SEASON, v))

    // Assert: Lesson 5 is coming later, so nothing is left once 1 to 4 are done
    expect(picks).toEqual([null, 1, 2, 3, 4, null])
  })

  it("never offers Lesson 8 on Lesson 1's page before Lesson 1 is done", () => {
    // Arrange: the real season, every lesson with a page live, as on dev
    const season = seasonFor(LESSONS, defaultPageState(true))
    expect(season.find((L) => L.n === 8)?.page).toBe('/learn/08')

    // Act
    const next = upNext(season, viewer(1))

    // Assert: Lesson 8 needs Lesson 1 (CURRICULUM § 3.3), as every lesson after it does
    expect(next).toBeNull()
  })
})

describe('a lesson held back (publish.ts)', () => {
  it('is coming later, with no action, even with a step the viewer reached while it was shown', () => {
    // Arrange: drafts held back, as on mercurypitch.com, and a step kept from a dev visit
    const season = seasonFor(LESSONS, defaultPageState(false))

    // Act
    const L3 = lessonViews(season, viewer(1, [1], { 3: { step: 3, of: 6 } }))[3]

    // Assert
    expect([L3.state, L3.step, L3.action]).toEqual(['later', null, null])
  })

  it('is never up next, a released lesson the console holds back as much as a draft', () => {
    // Arrange: Lesson 2 held back; Lesson 1 done, so Lessons 2 and 3 are open to it
    const season = seasonFor(LESSONS, {
      ...defaultPageState(false),
      lessons: { 2: { published: false } },
    })

    // Act
    const views = lessonViews(season, viewer(1, [1]))
    const next = upNext(season, viewer(1, [1]))

    // Assert
    expect([views[2].state, views[2].action]).toEqual(['later', null])
    expect(next).not.toBe(2)
    expect(next).not.toBe(3)
  })
})
