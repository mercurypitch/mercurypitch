// ============================================================
// Daily-goal accumulator tests (practice-minutes.ts)
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { updatePracticeStreak, getCurrentStreak } = vi.hoisted(() => ({
  updatePracticeStreak: vi.fn(async () => 7),
  getCurrentStreak: vi.fn(async () => 3),
}))

vi.mock('@/db/services/streak-service', () => ({
  updatePracticeStreak,
  getCurrentStreak,
  todayDateString: () => '2026-07-14',
}))

import { addScoredMs, DAILY_GOAL_MS, getTodayScoredMinutes, isDailyGoalMet, } from '@/db/services/practice-minutes'

beforeEach(() => {
  localStorage.clear()
  updatePracticeStreak.mockClear()
  getCurrentStreak.mockClear()
})
afterEach(() => vi.restoreAllMocks())

describe('addScoredMs', () => {
  it('does not bump the streak before the daily goal is met', async () => {
    const streak = await addScoredMs(60_000) // 1 min < 5
    expect(updatePracticeStreak).not.toHaveBeenCalled()
    expect(getCurrentStreak).toHaveBeenCalled()
    expect(streak).toBe(3)
    expect(isDailyGoalMet()).toBe(false)
  })

  it('bumps the streak exactly once when the goal is first crossed', async () => {
    await addScoredMs(DAILY_GOAL_MS - 1000) // just under
    expect(updatePracticeStreak).not.toHaveBeenCalled()

    const streak = await addScoredMs(2000) // crosses the goal
    expect(updatePracticeStreak).toHaveBeenCalledTimes(1)
    expect(streak).toBe(7)
    expect(isDailyGoalMet()).toBe(true)

    // Further practice the same day does not bump again.
    await addScoredMs(60_000)
    expect(updatePracticeStreak).toHaveBeenCalledTimes(1)
  })

  it('accumulates minutes across calls', async () => {
    await addScoredMs(90_000)
    await addScoredMs(90_000)
    expect(getTodayScoredMinutes()).toBe(3)
  })

  it('ignores non-positive or non-finite durations', async () => {
    await addScoredMs(-5000)
    await addScoredMs(Number.NaN)
    expect(getTodayScoredMinutes()).toBe(0)
  })

  it('re-attempts the bump if a prior crossing failed to record it', async () => {
    updatePracticeStreak.mockResolvedValueOnce(0) // first bump "fails"
    await addScoredMs(DAILY_GOAL_MS) // crosses, bump returns 0 (not counted)
    expect(updatePracticeStreak).toHaveBeenCalledTimes(1)

    updatePracticeStreak.mockResolvedValueOnce(7)
    await addScoredMs(1000) // already met, but not yet counted → retry
    expect(updatePracticeStreak).toHaveBeenCalledTimes(2)
  })
})
