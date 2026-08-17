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
    //
    // `longestStreak: 5` is not decoration. These fixtures used to inherit the
    // base 0 and still assert object-identity, which quietly made "a 5-day run
    // whose record is 0" the expected output of this branch — the exact row
    // shape 0030_streak_high_water.sql exists to repair. A fixture describing
    // an impossible profile can only ever assert impossible behaviour, so the
    // record now matches the run and the identity claim means what it says.
    const today = f({
      currentStreak: 5,
      longestStreak: 5,
      lastPracticeDate: '2026-07-14',
    })
    expect(advanceStreak(today, '2026-07-14')).toEqual(today)
    const anchored = f({
      currentStreak: 5,
      longestStreak: 5,
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
    //
    // `longestStreak: 3` for the same reason as the idempotence fixture above
    // — a consistent profile is the only one whose unchanged output proves
    // anything.
    const clean = f({
      currentStreak: 3,
      longestStreak: 3,
      lastPracticeDate: '2026-07-14',
      lastFreezeEarnedDate: '2026-07-14',
    })
    expect(applyRepair(clean, '2026-07-14')).toEqual(clean)
  })
})

// ── The high-water invariant ─────────────────────────────────────────
//
// `longestStreak` is a record, so it can never be smaller than the run that
// set it. It was, for 60 production rows and 13 on dev: the client that owned
// streak writes before f2a5ccc wrote `currentStreak` only, the column landed
// as `INTEGER NOT NULL DEFAULT 0`, and the read-time repair that was supposed
// to cover that spelled itself `p?.longestStreak ?? p?.currentStreak` — a
// nullish coalesce, which a stored 0 walks straight past.
//
// Every fixture below starts from `(currentStreak: n, longestStreak: 0)`,
// which IS the shape those rows hold. Reverting any one guard turns the
// matching test red.
describe('the high-water invariant', () => {
  const legacy = (over: Partial<StreakFields> = {}): StreakFields =>
    f({ currentStreak: 1, longestStreak: 0, ...over })

  it('reads a stored record back as at least the run that beat it', () => {
    expect(
      streakFieldsOf({ currentStreak: 1, longestStreak: 0 }).longestStreak,
    ).toBe(1)
    expect(
      streakFieldsOf({ currentStreak: 2, longestStreak: 0 }).longestStreak,
    ).toBe(2)
  })

  it('never talks a genuine record down to the current run', () => {
    expect(
      streakFieldsOf({ currentStreak: 1, longestStreak: 7 }).longestStreak,
    ).toBe(7)
    // No profile at all is still zero, not a fabricated record.
    expect(streakFieldsOf(undefined).longestStreak).toBe(0)
  })

  it('repairs the row on a second practice the same day', () => {
    // The branch that re-persisted the violation rather than merely leaving
    // it: `advanceStreak` returned the fields untouched and `streakPatch`
    // wrote `longestStreak: 0` straight back next to `currentStreak: 1`.
    const next = advanceStreak(
      legacy({ lastPracticeDate: '2026-07-14' }),
      '2026-07-14',
    )
    expect(next.currentStreak).toBe(1)
    expect(next.longestStreak).toBe(1)
  })

  it('repairs the row when the streak breaks and restarts', () => {
    // The other non-raising branch. Practise once, break it, practise once —
    // which is what 59 of the 60 production rows had been doing — and the
    // reset drops `currentStreak` to 1 without ever touching the record.
    // The break is 42 days old and the dying run was a single day, so the
    // reset snapshots nothing for repair (see "the repair window bounds the
    // break" below).
    const next = advanceStreak(
      legacy({ lastPracticeDate: '2026-06-01', streakFreezes: 0 }),
      '2026-07-14',
    )
    expect(next.currentStreak).toBe(1)
    expect(next.previousStreak).toBe(0)
    expect(next.longestStreak).toBe(1)
  })

  it('still sets the record on the branches that raise the streak', () => {
    const yesterday = advanceStreak(
      legacy({ currentStreak: 4, lastPracticeDate: '2026-07-13' }),
      '2026-07-14',
    )
    expect(yesterday.currentStreak).toBe(5)
    expect(yesterday.longestStreak).toBe(5)

    const bridged = advanceStreak(
      legacy({
        currentStreak: 4,
        streakFreezes: 1,
        lastPracticeDate: '2026-07-12',
      }),
      '2026-07-14',
    )
    expect(bridged.currentStreak).toBe(5)
    expect(bridged.longestStreak).toBe(5)
  })

  it('repairs the row even when a repair is refused', () => {
    // `applyStreakRepair` persists whatever comes back, so the refusal path
    // is a write path too — declining must not be a way to put a violating
    // row back on the profile.
    const refused = applyRepair(
      legacy({ currentStreak: 3, lastPracticeDate: '2026-07-14' }),
      '2026-07-14',
    )
    expect(refused.currentStreak).toBe(3)
    expect(refused.longestStreak).toBe(3)
  })

  it('holds end to end, from a stored legacy profile to the next patch', () => {
    // The shape that actually ships: read the row, advance it, and the fields
    // handed to `streakPatch` are already consistent.
    const stored = { currentStreak: 2, longestStreak: 0 }
    const next = advanceStreak(streakFieldsOf(stored), '2026-07-14')
    expect(next.longestStreak).toBeGreaterThanOrEqual(next.currentStreak)
    expect(next.longestStreak).toBe(2)
  })

  it('shows the record on the card once the run is broken', () => {
    // What the singer actually saw: a 2-day run, a week off, and a Home card
    // reporting a lifetime best of 0 because `max(longestStreak, 0)` had
    // nothing to work with.
    const state = computeStreakState(
      streakFieldsOf({
        currentStreak: 2,
        longestStreak: 0,
        lastPracticeDate: '2026-07-01',
      }),
      '2026-07-14',
    )
    expect(state.currentStreak).toBe(0)
    expect(state.longestStreak).toBe(2)
  })
})

// ============================================================
// The repair window bounds the BREAK, not its detection
// ============================================================
//
// The reset branch runs lazily, on the next practice — which can be months
// after the lapse. It used to stamp `streakResetDate = today` and snapshot
// `previousStreak` unconditionally, so `hasRecordedReset`'s 72-hour window
// measured how quickly the reset was NOTICED, never how old the break was.
// Owner repro (2026-08-17, dev account): one practice day on 2026-06-14,
// the next on 2026-08-17 — a 63-day break — and the card offered "restore
// streak", gluing the June day onto August for a streak of 2.
describe('the repair window bounds the break', () => {
  it('a months-old break is not repairable after the reset records it', () => {
    // The owner's exact row, walked through the 5-minute crossing.
    const afterPractice = advanceStreak(
      f({
        currentStreak: 1,
        longestStreak: 1,
        lastPracticeDate: '2026-06-14',
      }),
      '2026-08-17',
    )
    expect(afterPractice.currentStreak).toBe(1)
    expect(afterPractice.previousStreak).toBe(0)
    expect(afterPractice.streakResetDate).toBeNull()

    const state = computeStreakState(afterPractice, '2026-08-17')
    expect(state.canRepair).toBe(false)
    expect(state.repairableStreak).toBe(0)
    expect(state.currentStreak).toBe(1)
  })

  it('a long streak lost to a stale break is equally gone', () => {
    // The window is about the break's age, not the streak's worth: a
    // 30-day run abandoned for two months is not restorable either.
    const afterPractice = advanceStreak(
      f({
        currentStreak: 30,
        longestStreak: 30,
        lastPracticeDate: '2026-06-14',
        streakFreezes: 0,
      }),
      '2026-08-17',
    )
    expect(afterPractice.previousStreak).toBe(0)
    expect(afterPractice.streakResetDate).toBeNull()
    expect(computeStreakState(afterPractice, '2026-08-17').canRepair).toBe(
      false,
    )
  })

  it('a fresh break inside the window still records and repairs', () => {
    // gap 3 → 2 missed days, no freezes: the legitimate path is untouched.
    const afterPractice = advanceStreak(
      f({
        currentStreak: 5,
        longestStreak: 5,
        lastPracticeDate: '2026-07-11',
        streakFreezes: 0,
      }),
      '2026-07-14',
    )
    expect(afterPractice.currentStreak).toBe(1)
    expect(afterPractice.previousStreak).toBe(5)
    expect(afterPractice.streakResetDate).toBe('2026-07-14')

    const state = computeStreakState(afterPractice, '2026-07-14')
    expect(state.canRepair).toBe(true)
    expect(state.repairableStreak).toBe(6)
    expect(applyRepair(afterPractice, '2026-07-14').currentStreak).toBe(6)
  })

  it('a break of exactly the window is still inside it', () => {
    // missedDays === REPAIR_WINDOW_DAYS (3): inclusive, the same `<=` the
    // pending-break predicate uses.
    const afterPractice = advanceStreak(
      f({
        currentStreak: 4,
        longestStreak: 4,
        lastPracticeDate: '2026-07-10',
        streakFreezes: 0,
      }),
      '2026-07-14',
    )
    expect(afterPractice.previousStreak).toBe(4)
    expect(computeStreakState(afterPractice, '2026-07-14').canRepair).toBe(true)
  })

  it('a one-day run does not become repairable even inside the window', () => {
    // Parity with hasPendingBreak's `currentStreak >= 2`: "repairing" a
    // 1-day run manufactures a streak of 2 out of one practised day.
    const afterPractice = advanceStreak(
      f({ currentStreak: 1, longestStreak: 1, lastPracticeDate: '2026-07-11' }),
      '2026-07-14',
    )
    expect(afterPractice.previousStreak).toBe(0)
    expect(computeStreakState(afterPractice, '2026-07-14').canRepair).toBe(
      false,
    )
  })

  it('a legacy row holding a snapshotted 1-day run is not offered repair', () => {
    // Rows written before the reset branch guarded its snapshot can still
    // carry `previousStreak: 1` with a fresh-looking reset date.
    const state = computeStreakState(
      f({
        currentStreak: 1,
        previousStreak: 1,
        streakResetDate: '2026-07-14',
        lastPracticeDate: '2026-07-14',
      }),
      '2026-07-14',
    )
    expect(state.canRepair).toBe(false)
  })
})
