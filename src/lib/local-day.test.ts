// ============================================================
// local-day — the calendar the singer actually lives in
// ============================================================
//
// These pin the exact defect that made streaks break: a day key derived from
// toISOString() names the UTC day, so practice near local midnight banks to the
// wrong one. The cases below run under a real timezone rather than mocking a
// date library, because the bug only exists in the gap between local and UTC
// and a mocked clock would hide it.
//
// TZ is set per-test via vi.stubEnv + a re-import: Node reads process.env.TZ
// when it first resolves a Date, so the module has to be loaded after the stub.

import { afterEach, describe, expect, it, vi } from 'vitest'

/** Load local-day with a specific IANA zone in force. */
async function withTimezone(tz: string) {
  process.env.TZ = tz
  vi.resetModules()
  return await import('./local-day')
}

const ORIGINAL_TZ = process.env.TZ

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ
  vi.resetModules()
})

describe('localDayString', () => {
  it('names the local day, not the UTC day, east of Greenwich', async () => {
    const { localDayString } = await withTimezone('Asia/Tokyo')
    // 2026-03-02T15:30:00Z is 2026-03-03 00:30 in Tokyo (UTC+9).
    // toISOString() would say 2026-03-02 — the previous day for that singer.
    const instant = new Date('2026-03-02T15:30:00Z')

    expect(localDayString(instant)).toBe('2026-03-03')
    expect(instant.toISOString().slice(0, 10)).toBe('2026-03-02')
  })

  it('names the local day, not the UTC day, west of Greenwich', async () => {
    const { localDayString } = await withTimezone('America/Los_Angeles')
    // 2026-03-03T02:30:00Z is 2026-03-02 18:30 in LA (UTC-8).
    // toISOString() would say 2026-03-03 — tomorrow, for an evening session.
    const instant = new Date('2026-03-03T02:30:00Z')

    expect(localDayString(instant)).toBe('2026-03-02')
    expect(instant.toISOString().slice(0, 10)).toBe('2026-03-03')
  })

  it('gives two sessions on the same local day the same key', async () => {
    // THE REGRESSION. At UTC+2 a Monday 20:00 and a Tuesday 01:00 session both
    // produced the UTC day 'Monday', so Tuesday earned no credit and the streak
    // broke after practising two days running.
    const { localDayString } = await withTimezone('Europe/Zagreb')
    const mondayEvening = new Date('2026-03-02T19:00:00Z') // 20:00 Mon local
    const tuesdayNight = new Date('2026-03-02T23:00:00Z') // 00:00 Tue local

    expect(localDayString(mondayEvening)).toBe('2026-03-02')
    expect(localDayString(tuesdayNight)).toBe('2026-03-03')
    // Under the old UTC key both of these were '2026-03-02'.
    expect(mondayEvening.toISOString().slice(0, 10)).toBe(
      tuesdayNight.toISOString().slice(0, 10),
    )
  })

  it('pads month and day to two digits so keys sort and compare', async () => {
    const { localDayString } = await withTimezone('UTC')
    expect(localDayString(new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05')
  })

  it('agrees with the heatmap key, which already used local time', async () => {
    // practice-activity.ts:localDayKey was right all along. The streak
    // disagreeing with the heatmap on screen was the visible symptom.
    process.env.TZ = 'Asia/Tokyo'
    vi.resetModules()
    const { localDayString } = await import('./local-day')
    const { localDayKey } =
      await import('@/features/practice-intelligence/practice-activity')
    const iso = '2026-03-02T15:30:00Z'

    expect(localDayString(new Date(iso))).toBe(localDayKey(iso))
  })
})

describe('localDayOfYear', () => {
  it('rolls over at local midnight, not UTC midnight', async () => {
    const { localDayOfYear } = await withTimezone('Asia/Tokyo')
    const beforeLocalMidnight = new Date('2026-03-02T14:30:00Z') // 23:30 Mon
    const afterLocalMidnight = new Date('2026-03-02T15:30:00Z') // 00:30 Tue

    expect(afterLocalMidnight.getTime()).toBeGreaterThan(
      beforeLocalMidnight.getTime(),
    )
    expect(localDayOfYear(afterLocalMidnight)).toBe(
      localDayOfYear(beforeLocalMidnight) + 1,
    )
  })

  it('counts 1 for the first of January in local time', async () => {
    const { localDayOfYear } = await withTimezone('Europe/Zagreb')
    expect(localDayOfYear(new Date('2026-01-01T12:00:00Z'))).toBe(1)
  })

  it('stays stable across a DST spring-forward', async () => {
    // Europe/Zagreb springs forward on 2026-03-29. That local day is 23 hours,
    // so a naive getTime() difference would report a fractional day and floor
    // to the wrong index. Consecutive local days must stay consecutive.
    const { localDayOfYear } = await withTimezone('Europe/Zagreb')
    const before = localDayOfYear(new Date('2026-03-28T12:00:00Z'))
    const during = localDayOfYear(new Date('2026-03-29T12:00:00Z'))
    const after = localDayOfYear(new Date('2026-03-30T12:00:00Z'))

    expect(during).toBe(before + 1)
    expect(after).toBe(during + 1)
  })

  it('stays stable across a DST fall-back', async () => {
    // 2026-10-25 is 25 hours long in Zagreb — the mirror of the case above.
    const { localDayOfYear } = await withTimezone('Europe/Zagreb')
    const before = localDayOfYear(new Date('2026-10-24T12:00:00Z'))
    const during = localDayOfYear(new Date('2026-10-25T12:00:00Z'))
    const after = localDayOfYear(new Date('2026-10-26T12:00:00Z'))

    expect(during).toBe(before + 1)
    expect(after).toBe(during + 1)
  })
})
