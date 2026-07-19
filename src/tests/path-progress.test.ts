// ============================================================
// The Ascent — path progress engine tests (path-progress.ts)
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { ASCENT_WEEKS, DAYS_PER_WEEK } from '@/features/path/path-content'
import { activePathExercises, ENDOWED_DAY, pathComplete, pathFreeRoam, pathProgress, recordPathPracticeDay, resetAscent, ringFill, setPathFreeRoam, startAscent, weekState, } from '@/features/path/path-progress'

const day = (n: number): string => `2026-08-${String(n).padStart(2, '0')}` // distinct local dates

beforeEach(() => {
  localStorage.clear()
  resetAscent()
  setPathFreeRoam(false) // the in-memory signal survives localStorage.clear()
})

describe('startAscent', () => {
  it('begins week 1 with the endowed segment pre-lit', () => {
    startAscent()
    expect(pathProgress()?.currentWeek).toBe(1)
    expect(ringFill(1)).toBe(1) // endowed head start — never an empty ring
    expect(pathProgress()?.weekDays[1]).toEqual([ENDOWED_DAY])
  })

  it('is idempotent — restarting never wipes progress', () => {
    startAscent()
    recordPathPracticeDay(day(1))
    startAscent()
    expect(ringFill(1)).toBe(2)
  })
})

describe('recordPathPracticeDay', () => {
  it('no-ops before the path is started', () => {
    recordPathPracticeDay(day(1))
    expect(pathProgress()).toBeNull()
  })

  it('adds one segment per distinct day, deduped', () => {
    startAscent()
    recordPathPracticeDay(day(1))
    recordPathPracticeDay(day(1)) // same day again — no double fill
    expect(ringFill(1)).toBe(2) // endowed + day 1
    recordPathPracticeDay(day(2))
    expect(ringFill(1)).toBe(3)
  })

  it('completes the week at 7 segments and unlocks the next', () => {
    startAscent()
    // endowed counts as one — six real days finish week 1.
    for (let i = 1; i <= 6; i++) recordPathPracticeDay(day(i))
    expect(ringFill(1)).toBe(DAYS_PER_WEEK)
    expect(weekState(1)).toBe('complete')
    expect(pathProgress()?.currentWeek).toBe(2)
    expect(weekState(2)).toBe('active')
    expect(weekState(3)).toBe('locked')
  })

  it('week 2 has no endowed segment — seven real days required', () => {
    startAscent()
    for (let i = 1; i <= 6; i++) recordPathPracticeDay(day(i))
    expect(ringFill(2)).toBe(0)
    for (let i = 7; i <= 13; i++) recordPathPracticeDay(day(i))
    expect(weekState(2)).toBe('complete')
    expect(pathProgress()?.currentWeek).toBe(3)
  })

  it('completes the whole path and stops counting', () => {
    startAscent()
    // 6 (endowed week) + 7 * 6 remaining weeks = 48 practice days total.
    for (let i = 1; i <= 48; i++) recordPathPracticeDay(day(i))
    expect(pathComplete()).toBe(true)
    expect(pathProgress()?.completedWeeks).toHaveLength(ASCENT_WEEKS.length)
    // Further days are a no-op — nothing left to fill.
    recordPathPracticeDay(day(49))
    expect(pathComplete()).toBe(true)
  })
})

describe('weekState', () => {
  it('shows week 1 available (not locked) before starting', () => {
    expect(weekState(1)).toBe('available')
    expect(weekState(2)).toBe('locked')
  })
})

describe('free-roam', () => {
  it('defaults off under test (sequential lock stays intact)', () => {
    expect(pathFreeRoam()).toBe(false)
  })

  it('opens unreached weeks without touching real states', () => {
    // Explicit param keeps the assertion pure (no global toggle).
    expect(weekState(3, null, false)).toBe('locked')
    expect(weekState(3, null, true)).toBe('available')

    startAscent()
    for (let i = 1; i <= 6; i++) recordPathPracticeDay(day(i)) // finish week 1
    // Completed + active weeks are unchanged; only future weeks open up.
    expect(weekState(1, pathProgress(), true)).toBe('complete')
    expect(weekState(2, pathProgress(), true)).toBe('active')
    expect(weekState(5, pathProgress(), false)).toBe('locked')
    expect(weekState(5, pathProgress(), true)).toBe('available')
  })

  it('the reactive flag flips weekState for the whole path', () => {
    startAscent()
    expect(weekState(5)).toBe('locked')
    setPathFreeRoam(true)
    expect(weekState(5)).toBe('available')
    expect(weekState(1)).toBe('active') // still honours real progress
  })
})

describe('activePathExercises', () => {
  it('is null before start and after completion', () => {
    expect(activePathExercises()).toBeNull()
    startAscent()
    for (let i = 1; i <= 48; i++) recordPathPracticeDay(day(i))
    expect(activePathExercises()).toBeNull()
  })

  it("returns the active week's bound exercises", () => {
    startAscent()
    expect(activePathExercises()).toEqual(ASCENT_WEEKS[0]!.exercises)
    for (let i = 1; i <= 6; i++) recordPathPracticeDay(day(i))
    expect(activePathExercises()).toEqual(ASCENT_WEEKS[1]!.exercises)
  })
})

describe('path content sanity', () => {
  it('has sequential orders and non-empty exercise pools', () => {
    expect(ASCENT_WEEKS.map((w) => w.order)).toEqual([1, 2, 3, 4, 5, 6, 7])
    for (const w of ASCENT_WEEKS) {
      expect(w.exercises.length).toBeGreaterThan(0)
      expect(w.title.length).toBeGreaterThan(0)
      expect(w.focus.length).toBeGreaterThan(20)
      expect(w.goals.length).toBeGreaterThanOrEqual(2)
    }
  })
})
