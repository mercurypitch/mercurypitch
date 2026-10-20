// ============================================================
// Lesson state tests — where each lesson stands, and its one action
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as State from './lesson-state'
import type { Viewer } from './lesson-state'
import { lessonViews, upNext } from './lesson-state'
import type { StepMarks } from './position'
import type * as Season from './season'
import type { Lesson } from './season'

/** Lesson `n` of a season for a state test, live when `live`; its prerequisites are the real season's. */
const lesson = (n: number, live: boolean): Lesson => ({
  n,
  lane: 'theory',
  title: `Lesson ${n}`,
  short: `Lesson ${n}`,
  topics: [],
  hook: 'Why?',
  sig: 'A figure.',
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
})

describe('a hidden draft (drafts.ts)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('is coming later, with no action, even with a step the viewer reached while it was shown', async () => {
    // Arrange: a build that hides drafts, and a step kept from a dev visit
    vi.stubEnv('VITE_DRAFT_LESSONS', '0')
    vi.resetModules()
    const season: typeof Season = await import('./season')
    const state: typeof State = await import('./lesson-state')

    // Act
    const L3 = state.lessonViews(
      season.LESSONS,
      viewer(1, [1], { 3: { step: 3, of: 6 } }),
    )[3]

    // Assert
    expect([L3.state, L3.step, L3.action]).toEqual(['later', null, null])
  })
})
