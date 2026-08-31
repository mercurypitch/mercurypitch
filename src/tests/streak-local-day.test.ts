// ============================================================
// Streaks across local midnight
// ============================================================
//
// The unit-level proof lives in src/lib/local-day.test.ts. This is the
// user-visible half: two sessions on two consecutive days of the singer's own
// calendar must extend a streak, and under the old UTC day key they did not.
//
// advanceStreak is pure and takes the day key as an argument, so the bug is
// reproducible by feeding it the keys each strategy would have produced — no
// clock mocking, and the assertion is about streak behaviour rather than about
// string formatting.

import { afterEach, describe, expect, it, vi } from 'vitest'

// Each case resets the module registry and re-imports the routine under a
// different TZ, which is the only way to exercise timezone-dependent module
// init — about 2.5s of real work here, and CI runs slower still.
vi.setConfig({ testTimeout: 20000 })

import { advanceStreak, streakFieldsOf, todayDateString, } from '@/db/services/streak-service'

const ORIGINAL_TZ = process.env.TZ

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ
  vi.resetModules()
})

/** The day key the pre-fix code produced. */
const utcDayKey = (d: Date): string => d.toISOString().slice(0, 10)

describe('streaks use the singer’s calendar day', () => {
  // A singer in Zagreb (UTC+2 in summer) practising Monday evening and again
  // just after midnight on Tuesday.
  const mondayEvening = new Date('2026-07-06T19:00:00Z') // 21:00 Mon local
  const tuesdayJustAfterMidnight = new Date('2026-07-06T22:30:00Z') // 00:30 Tue

  it('extends the streak across two consecutive local days', async () => {
    process.env.TZ = 'Europe/Zagreb'
    vi.resetModules()
    const { localDayString } = await import('@/lib/local-day')

    let fields = streakFieldsOf(undefined)
    fields = advanceStreak(fields, localDayString(mondayEvening))
    expect(fields.currentStreak).toBe(1)

    fields = advanceStreak(fields, localDayString(tuesdayJustAfterMidnight))

    // Two days practised, two days of streak.
    expect(fields.currentStreak).toBe(2)
  })

  it('did not extend under the old UTC day key — the regression', async () => {
    process.env.TZ = 'Europe/Zagreb'
    vi.resetModules()

    let fields = streakFieldsOf(undefined)
    fields = advanceStreak(fields, utcDayKey(mondayEvening))
    expect(fields.currentStreak).toBe(1)

    // Both instants fall on the same UTC day, so the second session was read
    // as "already practised today" and Tuesday earned nothing.
    expect(utcDayKey(mondayEvening)).toBe(utcDayKey(tuesdayJustAfterMidnight))
    fields = advanceStreak(fields, utcDayKey(tuesdayJustAfterMidnight))

    expect(fields.currentStreak).toBe(1)
  })

  it('does not double-count two sessions on the same local day', async () => {
    // The other direction: local keys must not be so eager that a morning and
    // an evening session on one day count twice.
    process.env.TZ = 'Europe/Zagreb'
    vi.resetModules()
    const { localDayString } = await import('@/lib/local-day')

    const morning = new Date('2026-07-06T07:00:00Z') // 09:00 Mon local
    const evening = new Date('2026-07-06T19:00:00Z') // 21:00 Mon local
    expect(localDayString(morning)).toBe(localDayString(evening))

    let fields = streakFieldsOf(undefined)
    fields = advanceStreak(fields, localDayString(morning))
    fields = advanceStreak(fields, localDayString(evening))

    expect(fields.currentStreak).toBe(1)
  })

  it('todayDateString reports the local day', async () => {
    process.env.TZ = 'Asia/Tokyo'
    vi.resetModules()
    const { todayDateString: freshToday } =
      await import('@/db/services/streak-service')
    const { localDayString } = await import('@/lib/local-day')

    expect(freshToday()).toBe(localDayString(new Date()))
  })

  it('is exported and callable in the ambient timezone', () => {
    // Guards against the import above being the only thing that works.
    expect(todayDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('the daily routine rolls over at the same midnight', () => {
  // The routine is seeded by day-of-year, so it must change when the singer's
  // day changes. Under the old UTC seed a singer east of Greenwich was handed
  // yesterday's routine every morning until 02:00 local — and their streak
  // and their routine disagreed about what day it was.
  const justAfterLocalMidnight = new Date('2026-07-06T22:30:00Z')

  it('seeds from the local day-of-year, one ahead of UTC past midnight', async () => {
    process.env.TZ = 'Europe/Zagreb'
    vi.resetModules()
    const { dayOfYear } = await import('@/features/routines/use-daily-routine')

    // 00:30 on 7 July local, still 6 July in UTC.
    const utcSeed = Math.floor(
      (Date.UTC(
        justAfterLocalMidnight.getUTCFullYear(),
        justAfterLocalMidnight.getUTCMonth(),
        justAfterLocalMidnight.getUTCDate(),
      ) -
        Date.UTC(justAfterLocalMidnight.getUTCFullYear(), 0, 0)) /
        86_400_000,
    )
    expect(dayOfYear(justAfterLocalMidnight)).toBe(utcSeed + 1)
  })

  it('agrees with the streak’s idea of today', async () => {
    process.env.TZ = 'Europe/Zagreb'
    vi.resetModules()
    const { dayOfYear } = await import('@/features/routines/use-daily-routine')
    const { localDayOfYear } = await import('@/lib/local-day')

    // The point of routing both through local-day.ts: one answer, not two.
    expect(dayOfYear(justAfterLocalMidnight)).toBe(
      localDayOfYear(justAfterLocalMidnight),
    )
  })
})
