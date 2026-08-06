// ============================================================
// Streak forgiveness — pure transition tests (streak-service.ts)
// ============================================================

import { describe, expect, it } from 'vitest'
import type { StreakFields } from '@/db/services/streak-service'
import { accrueFreezes, advanceStreak, applyRepair, computeStreakState, daysBetween, MAX_FREEZES, STARTING_FREEZES, streakFieldsOf, } from '@/db/services/streak-service'

// An ANCHORED profile: one that has already joined the freeze economy, which
// is what every account looks like after its first evaluation. The anchor
// matters — a null one is the "never taken part" signal that hands over the
// opening balance, so a fixture without it cannot hold a balance of 1 or 0 on
// purpose. Tests about the opening grant set `lastFreezeEarnedDate: null`
// explicitly; every other test wants the steady state and gets it from here.
const ANCHOR = '2026-07-01'
const base: StreakFields = {
  currentStreak: 0,
  longestStreak: 0,
  streakFreezes: 0,
  lastPracticeDate: null,
  lastFreezeUsedDate: null,
  previousStreak: 0,
  streakResetDate: null,
  lastRepairDate: null,
  lastFreezeEarnedDate: ANCHOR,
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
    // Object-identical for an anchored profile inside the accrual window,
    // which is the steady state: a second run today counts nothing and banks
    // nothing. (An UNANCHORED profile is not identical — it gets its clock
    // and its opening balance. That is the opening-balance block's business.)
    const today = f({ currentStreak: 5, lastPracticeDate: '2026-07-14' })
    expect(advanceStreak(today, '2026-07-14')).toEqual(today)
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
  it('banks nothing inside the window and leaves the anchor alone', () => {
    // Anchored 2026-07-01, so 13 days in there is nothing owed yet. The
    // anchor must not creep forward on every read, or the month would
    // restart each time somebody opened the app.
    const inside = accrueFreezes(f({ streakFreezes: 1 }), '2026-07-14')
    expect(inside.streakFreezes).toBe(1)
    expect(inside.lastFreezeEarnedDate).toBe(ANCHOR)
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
  // This block used to assert `streakFieldsOf(undefined).streakFreezes ===
  // STARTING_FREEZES` and it passed for months while NO account ever received
  // a starting freeze. `streakFreezes` is `INTEGER NOT NULL DEFAULT 0`, so a
  // real profile stores a literal 0, and `0 ?? 2` is 0 — the fallback only
  // fired for a profile that did not exist, which is the one case the test
  // exercised. The grant now lives in `accrueFreezes`, and the tests below
  // cover it through a STORED profile, which is the shape that ships.
  it('mirrors the column default rather than inventing a balance', () => {
    expect(streakFieldsOf(undefined).streakFreezes).toBe(0)
    expect(streakFieldsOf({ streakFreezes: 0 }).streakFreezes).toBe(0)
  })

  it('keeps a stored balance', () => {
    expect(streakFieldsOf({ streakFreezes: 2 }).streakFreezes).toBe(2)
  })
})

describe('the opening balance', () => {
  it('grants STARTING_FREEZES to a stored profile sitting at zero', () => {
    // The exact shape dev served for the account that reported this: a real
    // row, a literal 0, no anchor, nothing ever spent.
    const out = accrueFreezes(
      f({
        streakFreezes: 0,
        lastFreezeEarnedDate: null,
        lastFreezeUsedDate: null,
      }),
      '2026-08-06',
    )
    expect(out.streakFreezes).toBe(STARTING_FREEZES)
    expect(out.lastFreezeEarnedDate).toBe('2026-08-06')
  })

  it('grants it once, not on every read', () => {
    const first = accrueFreezes(
      f({ streakFreezes: 0, lastFreezeEarnedDate: null }),
      '2026-08-06',
    )
    const second = accrueFreezes(first, '2026-08-06')
    expect(second.streakFreezes).toBe(STARTING_FREEZES)
    const later = accrueFreezes(first, '2026-08-20')
    expect(later.streakFreezes).toBe(STARTING_FREEZES)
  })

  it('does not re-gift to someone who already spent theirs', () => {
    const out = accrueFreezes(
      f({
        streakFreezes: 0,
        lastFreezeEarnedDate: null,
        lastFreezeUsedDate: '2026-07-30',
      }),
      '2026-08-06',
    )
    expect(out.streakFreezes).toBe(0)
    expect(out.lastFreezeEarnedDate).toBe('2026-08-06')
  })

  it('never takes away a balance earned under the old milestone rules', () => {
    const out = accrueFreezes(
      f({ streakFreezes: 3, lastFreezeEarnedDate: null }),
      '2026-08-06',
    )
    expect(out.streakFreezes).toBe(3)
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
