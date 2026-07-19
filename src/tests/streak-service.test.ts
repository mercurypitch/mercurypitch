// ============================================================
// Streak forgiveness — pure transition tests (streak-service.ts)
// ============================================================

import { describe, expect, it } from 'vitest'
import type { StreakFields } from '@/db/services/streak-service'
import { advanceStreak, applyRepair, computeStreakState, daysBetween, MAX_FREEZES, } from '@/db/services/streak-service'

const base: StreakFields = {
  currentStreak: 0,
  longestStreak: 0,
  streakFreezes: 0,
  lastPracticeDate: null,
  lastFreezeUsedDate: null,
  previousStreak: 0,
  streakResetDate: null,
  lastRepairDate: null,
}
const f = (over: Partial<StreakFields>): StreakFields => ({ ...base, ...over })

describe('daysBetween', () => {
  it('counts whole days across a month boundary', () => {
    expect(daysBetween('2026-06-30', '2026-07-01')).toBe(1)
    expect(daysBetween('2026-07-01', '2026-07-01')).toBe(0)
    expect(daysBetween('2026-07-01', '2026-07-08')).toBe(7)
    expect(daysBetween('2026-07-08', '2026-07-01')).toBe(-7)
  })
})

describe('advanceStreak', () => {
  it('starts at 1 on the first-ever practice', () => {
    const n = advanceStreak(base, '2026-07-14')
    expect(n.currentStreak).toBe(1)
    expect(n.longestStreak).toBe(1)
    expect(n.lastPracticeDate).toBe('2026-07-14')
  })

  it('is idempotent when already practiced today', () => {
    const today = f({ currentStreak: 5, lastPracticeDate: '2026-07-14' })
    expect(advanceStreak(today, '2026-07-14')).toEqual(today)
  })

  it('increments when practiced yesterday', () => {
    const n = advanceStreak(
      f({ currentStreak: 5, lastPracticeDate: '2026-07-13' }),
      '2026-07-14',
    )
    expect(n.currentStreak).toBe(6)
  })

  it('bridges a 1-day gap with a freeze instead of resetting', () => {
    const n = advanceStreak(
      f({ currentStreak: 9, streakFreezes: 1, lastPracticeDate: '2026-07-12' }),
      '2026-07-14', // missed the 13th
    )
    expect(n.currentStreak).toBe(10)
    expect(n.streakFreezes).toBe(0)
    expect(n.lastFreezeUsedDate).toBe('2026-07-14')
  })

  it('resets and snapshots when freezes cannot cover the gap', () => {
    const n = advanceStreak(
      f({ currentStreak: 9, streakFreezes: 0, lastPracticeDate: '2026-07-11' }),
      '2026-07-14', // missed 12th + 13th = 2 days, 0 freezes
    )
    expect(n.currentStreak).toBe(1)
    expect(n.previousStreak).toBe(9)
    expect(n.streakResetDate).toBe('2026-07-14')
  })

  it('earns a freeze on every 7th day, capped at MAX_FREEZES', () => {
    const day6 = f({ currentStreak: 6, lastPracticeDate: '2026-07-13' })
    expect(advanceStreak(day6, '2026-07-14').streakFreezes).toBe(1) // hit 7
    const day13 = f({
      currentStreak: 13,
      streakFreezes: 1,
      lastPracticeDate: '2026-07-13',
    })
    expect(advanceStreak(day13, '2026-07-14').streakFreezes).toBe(2) // hit 14
    const day20 = f({
      currentStreak: 20,
      streakFreezes: MAX_FREEZES,
      lastPracticeDate: '2026-07-13',
    })
    expect(advanceStreak(day20, '2026-07-14').streakFreezes).toBe(MAX_FREEZES) // capped
  })
})

describe('computeStreakState', () => {
  it('shows the streak and practicedToday when practiced today', () => {
    const s = computeStreakState(
      f({ currentStreak: 4, lastPracticeDate: '2026-07-14' }),
      '2026-07-14',
    )
    expect(s.currentStreak).toBe(4)
    expect(s.practicedToday).toBe(true)
    expect(s.atRisk).toBe(false)
  })

  it('keeps the streak but flags at-risk when last practice was yesterday', () => {
    const s = computeStreakState(
      f({ currentStreak: 4, lastPracticeDate: '2026-07-13' }),
      '2026-07-14',
    )
    expect(s.currentStreak).toBe(4)
    expect(s.atRisk).toBe(true)
  })

  it('protects the streak while freezes can still bridge the gap', () => {
    const s = computeStreakState(
      f({ currentStreak: 8, streakFreezes: 2, lastPracticeDate: '2026-07-12' }),
      '2026-07-14', // 1 missed day, 2 freezes
    )
    expect(s.currentStreak).toBe(8)
    expect(s.atRisk).toBe(true)
  })

  it('shows a broken streak (0) when freezes cannot cover the gap', () => {
    const s = computeStreakState(
      f({ currentStreak: 8, streakFreezes: 0, lastPracticeDate: '2026-07-11' }),
      '2026-07-14',
    )
    expect(s.currentStreak).toBe(0)
  })

  it('offers repair for a freshly recorded reset within the window', () => {
    const s = computeStreakState(
      f({
        currentStreak: 1,
        previousStreak: 9,
        streakResetDate: '2026-07-14',
        lastPracticeDate: '2026-07-14',
      }),
      '2026-07-14',
    )
    expect(s.canRepair).toBe(true)
    expect(s.repairableStreak).toBe(10)
  })

  it('offers repair for a pending break before the user practices again', () => {
    const s = computeStreakState(
      f({ currentStreak: 6, streakFreezes: 0, lastPracticeDate: '2026-07-11' }),
      '2026-07-14', // 2 missed days, no freeze → broken but repairable
    )
    expect(s.currentStreak).toBe(0)
    expect(s.canRepair).toBe(true)
    expect(s.repairableStreak).toBe(7)
  })

  it('blocks repair during the 30-day cooldown', () => {
    const s = computeStreakState(
      f({
        currentStreak: 1,
        previousStreak: 9,
        streakResetDate: '2026-07-14',
        lastRepairDate: '2026-07-01', // 13 days ago < 30
        lastPracticeDate: '2026-07-14',
      }),
      '2026-07-14',
    )
    expect(s.canRepair).toBe(false)
  })

  it('does not offer repair once the window has passed', () => {
    const s = computeStreakState(
      f({ currentStreak: 6, streakFreezes: 0, lastPracticeDate: '2026-07-08' }),
      '2026-07-14', // 5 missed days > 3-day window
    )
    expect(s.canRepair).toBe(false)
  })
})

describe('applyRepair', () => {
  it('restores the streak, counts today, and starts the cooldown', () => {
    const n = applyRepair(
      f({
        currentStreak: 1,
        previousStreak: 9,
        streakResetDate: '2026-07-14',
        lastPracticeDate: '2026-07-14',
      }),
      '2026-07-14',
    )
    expect(n.currentStreak).toBe(10)
    expect(n.previousStreak).toBe(0)
    expect(n.streakResetDate).toBeNull()
    expect(n.lastRepairDate).toBe('2026-07-14')
    expect(n.lastPracticeDate).toBe('2026-07-14')
  })

  it('is a no-op when repair is not available', () => {
    const clean = f({ currentStreak: 3, lastPracticeDate: '2026-07-14' })
    expect(applyRepair(clean, '2026-07-14')).toEqual(clean)
  })
})
