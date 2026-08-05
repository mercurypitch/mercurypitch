// ============================================================
// Streak forgiveness — pure transition tests (streak-service.ts)
// ============================================================

import { describe, expect, it } from 'vitest'
import type { StreakFields } from '@/db/services/streak-service'
import { accrueFreezes, advanceStreak, applyRepair, computeStreakState, daysBetween, MAX_FREEZES, STARTING_FREEZES, streakFieldsOf, } from '@/db/services/streak-service'

const base: StreakFields = {
  currentStreak: 0,
  longestStreak: 0,
  streakFreezes: 0,
  lastPracticeDate: null,
  lastFreezeUsedDate: null,
  previousStreak: 0,
  streakResetDate: null,
  lastRepairDate: null,
  lastFreezeEarnedDate: null,
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
    // Idempotent in the streak, which is what the caller relies on — a second
    // run today must not count twice. It is NOT object-identical: an accrual
    // clock that has never been anchored gets anchored, and a freeze that came
    // due today is kept rather than discarded because the streak had nothing
    // to do.
    const today = f({ currentStreak: 5, lastPracticeDate: '2026-07-14' })
    expect(advanceStreak(today, '2026-07-14')).toEqual({
      ...today,
      lastFreezeEarnedDate: '2026-07-14',
    })
    const anchored = f({
      currentStreak: 5,
      lastPracticeDate: '2026-07-14',
      lastFreezeEarnedDate: '2026-07-14',
    })
    expect(advanceStreak(anchored, '2026-07-14')).toEqual(anchored)
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

  it('no longer earns a freeze for reaching a streak milestone', () => {
    // The old rule granted one at every 7th day. It was replaced because it
    // rewarded the singers who needed forgiveness least; day 7 now earns
    // nothing on its own.
    const day6 = f({
      currentStreak: 6,
      lastPracticeDate: '2026-07-13',
      lastFreezeEarnedDate: '2026-07-13',
    })
    expect(advanceStreak(day6, '2026-07-14').streakFreezes).toBe(0)
  })

  it('accrues what the clock owes BEFORE deciding whether the gap breaks', () => {
    // Five weeks away. The absence is itself the waiting that earns a freeze,
    // so it should pay for part of itself rather than breaking the streak and
    // then handing over the freeze that would have saved it.
    const away = f({
      currentStreak: 12,
      streakFreezes: 0,
      lastPracticeDate: '2026-07-13',
      lastFreezeEarnedDate: '2026-06-14',
    })
    // One period (30 days) has elapsed by 2026-07-14, so one freeze is banked;
    // the gap from 07-13 to 07-14 is a single day and needs none of it.
    const next = advanceStreak(away, '2026-07-14')
    expect(next.currentStreak).toBe(13)
    expect(next.streakFreezes).toBe(1)
  })
})

describe('freeze accrual', () => {
  it('starts the clock without granting anything when there is no anchor', () => {
    // A profile created this morning has not waited a month. STARTING_FREEZES
    // is what covers day one, not the accrual.
    const fresh = accrueFreezes(f({ streakFreezes: 0 }), '2026-07-14')
    expect(fresh.streakFreezes).toBe(0)
    expect(fresh.lastFreezeEarnedDate).toBe('2026-07-14')
  })

  it('grants one per whole thirty days and carries the remainder', () => {
    const owed = accrueFreezes(
      f({ streakFreezes: 0, lastFreezeEarnedDate: '2026-06-01' }),
      '2026-07-14', // 43 days: one period, 13 days carried
    )
    expect(owed.streakFreezes).toBe(1)
    expect(owed.lastFreezeEarnedDate).toBe('2026-07-01')
  })

  it('grants nothing before the thirty days are up', () => {
    const early = f({ streakFreezes: 1, lastFreezeEarnedDate: '2026-07-01' })
    expect(accrueFreezes(early, '2026-07-14')).toEqual(early)
  })

  it('accrues for an idle month — no practice required', () => {
    // The whole reason this is its own field. A singer who has not practised
    // since May still comes back to a freeze.
    const idle = f({
      currentStreak: 0,
      streakFreezes: 0,
      lastPracticeDate: '2026-05-02',
      lastFreezeEarnedDate: '2026-05-02',
    })
    expect(accrueFreezes(idle, '2026-07-14').streakFreezes).toBe(2)
  })

  it('caps at MAX_FREEZES, and time spent at the cap is not banked', () => {
    // Six months at the cap must not turn into six freezes the moment one is
    // spent — otherwise the cap is a formality.
    const parked = accrueFreezes(
      f({ streakFreezes: MAX_FREEZES, lastFreezeEarnedDate: '2026-01-01' }),
      '2026-07-14',
    )
    expect(parked.streakFreezes).toBe(MAX_FREEZES)
    const afterSpending = accrueFreezes(
      { ...parked, streakFreezes: MAX_FREEZES - 1 },
      '2026-07-15',
    )
    expect(afterSpending.streakFreezes).toBe(MAX_FREEZES - 1)
  })

  it('is idempotent within a day', () => {
    const once = accrueFreezes(
      f({ streakFreezes: 0, lastFreezeEarnedDate: '2026-06-01' }),
      '2026-07-14',
    )
    expect(accrueFreezes(once, '2026-07-14')).toEqual(once)
  })

  it('ignores an anchor in the future rather than granting from it', () => {
    const skewed = f({ streakFreezes: 1, lastFreezeEarnedDate: '2027-01-01' })
    expect(accrueFreezes(skewed, '2026-07-14')).toEqual(skewed)
  })
})

describe('streakFieldsOf', () => {
  it('starts a profile with no stored count at STARTING_FREEZES', () => {
    expect(streakFieldsOf(undefined).streakFreezes).toBe(STARTING_FREEZES)
  })

  it('respects a stored zero — that account spent them', () => {
    // The one-time top-up for accounts predating this is a release script, not
    // a fallback here; a live zero must stay zero or spending has no meaning.
    expect(streakFieldsOf({ streakFreezes: 0 }).streakFreezes).toBe(0)
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

  it('never offers both forgiveness paths at once', () => {
    // The confusion this fixes: freezes are spent for you, repair is a button,
    // and a card showing both invited the reasonable guess that the button
    // spends a freeze. While the freezes can still bridge the gap they are the
    // path, so repair stays out of sight.
    const s = computeStreakState(
      f({ currentStreak: 8, streakFreezes: 2, lastPracticeDate: '2026-07-12' }),
      '2026-07-14', // 1 missed day, 2 freezes — the freezes have this
    )
    expect(s.atRisk).toBe(true)
    expect(s.currentStreak).toBe(8)
    expect(s.canRepair).toBe(false)
  })

  it('still offers repair when the freezes cannot save THIS streak', () => {
    // The case a literal "only when freezes are empty" rule would strand: two
    // freezes cannot bridge three missed days, so the streak is genuinely
    // broken and repair is the only path left — holding freezes must not hide
    // it.
    const s = computeStreakState(
      f({ currentStreak: 6, streakFreezes: 2, lastPracticeDate: '2026-07-11' }),
      '2026-07-14', // 2 missed days... freezes cover 2, so bump the gap
    )
    // Freezes DO cover this one; the card shows the freeze path.
    expect(s.canRepair).toBe(false)

    const broken = computeStreakState(
      f({ currentStreak: 6, streakFreezes: 1, lastPracticeDate: '2026-07-11' }),
      '2026-07-14', // 2 missed days against 1 freeze → broken
    )
    expect(broken.currentStreak).toBe(0)
    expect(broken.canRepair).toBe(true)
    expect(broken.repairableStreak).toBe(7)
  })

  it('reports a freeze that came due while the singer was away', () => {
    const s = computeStreakState(
      f({
        currentStreak: 4,
        streakFreezes: 0,
        lastPracticeDate: '2026-07-13',
        lastFreezeEarnedDate: '2026-06-01',
      }),
      '2026-07-14',
    )
    expect(s.freezes).toBe(1)
    expect(s.maxFreezes).toBe(MAX_FREEZES)
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

  it('is a no-op for the streak when repair is not available', () => {
    // Same distinction as advanceStreak's idempotence: nothing about the
    // streak moves, but a never-anchored accrual clock still starts. A repair
    // that silently reset the clock would be worse than one that starts it.
    const clean = f({
      currentStreak: 3,
      lastPracticeDate: '2026-07-14',
      lastFreezeEarnedDate: '2026-07-14',
    })
    expect(applyRepair(clean, '2026-07-14')).toEqual(clean)
  })
})
