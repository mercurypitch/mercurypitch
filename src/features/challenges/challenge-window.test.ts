// ============================================================
// Weeks you can count, and a queue that re-dates itself
// ============================================================
//
// The admin form took `startsAt` and `endsAt` as raw ISO strings, so setting
// a four-week challenge was arithmetic done in your head. Worse, moving the
// live one meant hand-editing every challenge behind it without leaving a
// gap or an overlap.
//
// None of this needed a schema change: there is no "weekly" field anywhere in
// the model, only two dates, which is exactly why the period can change at
// all. What it needed was arithmetic that is right at the year boundary — ISO
// weeks are full of traps, and a challenge that opens on the wrong Monday
// opens for nobody.

import { describe, expect, it } from 'vitest'
import { CHALLENGE_PERIODS, currentWeekStart, DEFAULT_PERIOD_WEEKS, formatIsoWeek, isoWeekNumber, isoWeekYear, mondayOf, reflowChanges, reflowQueue, reorder, shiftWeeks, weeksBetween, windowFrom, windowWeeks, } from './challenge-window'

describe('finding the Monday', () => {
  it('snaps every day of a week to the same Monday', () => {
    // Sunday is the trap: `getUTCDay()` calls it 0, so a naive subtraction
    // sends it forward into the next week instead of back to its own Monday.
    const monday = '2026-08-17T00:00:00.000Z'
    for (const day of [
      '2026-08-17T00:00:00Z',
      '2026-08-17T23:59:59Z',
      '2026-08-20T12:00:00Z',
      '2026-08-23T23:59:59Z', // Sunday
    ]) {
      expect(mondayOf(day)).toBe(monday)
    }
  })

  it('drops the time of day, not just the date', () => {
    expect(mondayOf('2026-08-19T17:42:11.123Z')).toBe(
      '2026-08-17T00:00:00.000Z',
    )
  })
})

describe('ISO week numbers', () => {
  it('counts the ordinary case', () => {
    expect(isoWeekNumber('2026-01-05T00:00:00Z')).toBe(2)
    expect(isoWeekNumber('2026-08-17T00:00:00Z')).toBe(34)
  })

  it('puts late December in the next year when ISO says so', () => {
    // 2025-12-29 is a Monday, and its Thursday is 2026-01-01 — so the week
    // belongs to 2026 and is week 1, even though the date says December.
    expect(isoWeekNumber('2025-12-29T00:00:00Z')).toBe(1)
    expect(isoWeekYear('2025-12-29T00:00:00Z')).toBe(2026)
  })

  it('puts early January in the previous year when ISO says so', () => {
    // 2027-01-01 is a Friday; its week's Thursday is 2026-12-31.
    expect(isoWeekYear('2027-01-01T00:00:00Z')).toBe(2026)
    expect(isoWeekNumber('2027-01-01T00:00:00Z')).toBe(53)
  })

  it('knows a 53-week year from a 52-week one', () => {
    // 2026 is a long ISO year; 2025 is not.
    expect(isoWeekNumber('2026-12-28T00:00:00Z')).toBe(53)
    expect(isoWeekNumber('2025-12-22T00:00:00Z')).toBe(52)
  })

  it('never runs a week outside 1..53', () => {
    for (let day = 0; day < 800; day += 1) {
      const iso = new Date(
        Date.UTC(2025, 0, 1) + day * 86_400_000,
      ).toISOString()
      const week = isoWeekNumber(iso)
      expect(week, iso).toBeGreaterThanOrEqual(1)
      expect(week, iso).toBeLessThanOrEqual(53)
    }
  })

  it('reads back the way the stepper shows it', () => {
    expect(formatIsoWeek('2026-08-17T00:00:00Z')).toBe('W34 · 2026')
  })
})

describe('stepping by weeks', () => {
  it('moves forward and back, always landing on a Monday', () => {
    const start = '2026-08-19T09:00:00Z' // a Wednesday
    expect(shiftWeeks(start, 0)).toBe('2026-08-17T00:00:00.000Z')
    expect(shiftWeeks(start, 1)).toBe('2026-08-24T00:00:00.000Z')
    expect(shiftWeeks(start, -2)).toBe('2026-08-03T00:00:00.000Z')
  })

  it('crosses a year boundary without drifting', () => {
    // The reason this is whole-millisecond arithmetic and not month maths:
    // there is no DST in UTC and every week is exactly 7 days.
    expect(shiftWeeks('2026-12-28T00:00:00Z', 1)).toBe(
      '2027-01-04T00:00:00.000Z',
    )
  })

  it('measures the distance it just moved', () => {
    expect(weeksBetween('2026-08-17T00:00:00Z', '2026-09-14T00:00:00Z')).toBe(4)
    expect(weeksBetween('2026-09-14T00:00:00Z', '2026-08-17T00:00:00Z')).toBe(
      -4,
    )
  })

  it('measures from any day in the week, not just Monday', () => {
    // What the admin actually has stored is whatever was typed in.
    expect(weeksBetween('2026-08-19T13:00:00Z', '2026-09-16T04:00:00Z')).toBe(4)
  })
})

describe('a challenge window', () => {
  it('runs the number of weeks it was given', () => {
    const w = windowFrom('2026-08-19T00:00:00Z', 4)
    expect(w.startsAt).toBe('2026-08-17T00:00:00.000Z')
    expect(w.endsAt).toBe('2026-09-14T00:00:00.000Z')
    expect(windowWeeks(w)).toBe(4)
  })

  it('refuses to be zero or negative length', () => {
    // A zero-length window is live for no time at all; a negative one fails
    // the `now < endsAt` test the other way and is live forever.
    expect(windowWeeks(windowFrom('2026-08-17T00:00:00Z', 0))).toBe(1)
    expect(windowWeeks(windowFrom('2026-08-17T00:00:00Z', -3))).toBe(1)
  })

  it('offers a month as four weeks rather than calling it a month', () => {
    // A calendar month is 4.35 weeks: call it monthly and the boundary walks
    // off Monday within a year.
    expect(DEFAULT_PERIOD_WEEKS).toBe(4)
    expect(CHALLENGE_PERIODS.map((p) => p.weeks)).toContain(4)
    for (const period of CHALLENGE_PERIODS) {
      expect(period.label).not.toMatch(/month/i)
    }
  })

  it('finds this week without asking the clock twice', () => {
    expect(currentWeekStart(Date.parse('2026-08-19T11:00:00Z'))).toBe(
      '2026-08-17T00:00:00.000Z',
    )
  })
})

describe('re-dating the queue', () => {
  const liveEndsAt = '2026-09-14T00:00:00.000Z'

  it('runs each one straight after the last, with no gap', () => {
    const planned = reflowQueue({
      liveEndsAt,
      order: ['a', 'b', 'c'],
      periodWeeks: 4,
    })
    expect(planned).toEqual([
      {
        id: 'a',
        startsAt: '2026-09-14T00:00:00.000Z',
        endsAt: '2026-10-12T00:00:00.000Z',
      },
      {
        id: 'b',
        startsAt: '2026-10-12T00:00:00.000Z',
        endsAt: '2026-11-09T00:00:00.000Z',
      },
      {
        id: 'c',
        startsAt: '2026-11-09T00:00:00.000Z',
        endsAt: '2026-12-07T00:00:00.000Z',
      },
    ])
  })

  it('leaves no overlap either — one ends exactly where the next begins', () => {
    const planned = reflowQueue({
      liveEndsAt,
      order: ['a', 'b', 'c', 'd'],
      periodWeeks: 1,
    })
    for (let i = 1; i < planned.length; i += 1) {
      expect(planned[i].startsAt).toBe(planned[i - 1].endsAt)
    }
  })

  it('follows the order it is given, not the dates it finds', () => {
    // This is the whole point of the drag: order in, dates out.
    const forward = reflowQueue({
      liveEndsAt,
      order: ['a', 'b'],
      periodWeeks: 2,
    })
    const swapped = reflowQueue({
      liveEndsAt,
      order: ['b', 'a'],
      periodWeeks: 2,
    })
    expect(forward[0].id).toBe('a')
    expect(swapped[0].id).toBe('b')
    expect(swapped[0].startsAt).toBe(forward[0].startsAt)
  })

  it('does nothing at all with an empty queue', () => {
    expect(reflowQueue({ liveEndsAt, order: [], periodWeeks: 4 })).toEqual([])
  })

  it("starts from the live challenge's own Monday", () => {
    // Whatever hour is stored, the queue opens on a Monday like everything
    // else — otherwise a challenge goes live mid-afternoon on a Wednesday.
    const planned = reflowQueue({
      liveEndsAt: '2026-09-16T17:30:00Z',
      order: ['a'],
      periodWeeks: 4,
    })
    expect(planned[0].startsAt).toBe('2026-09-14T00:00:00.000Z')
  })
})

describe('what actually needs writing', () => {
  const planned = reflowQueue({
    liveEndsAt: '2026-09-14T00:00:00.000Z',
    order: ['a', 'b'],
    periodWeeks: 4,
  })

  it('skips the rows that are already where they belong', () => {
    // Every write is a request; re-saving a row that did not move is noise
    // in the audit trail and one more chance to fail halfway.
    const stored = new Map([
      ['a', { startsAt: planned[0].startsAt, endsAt: planned[0].endsAt }],
      [
        'b',
        { startsAt: '2020-01-06T00:00:00Z', endsAt: '2020-02-03T00:00:00Z' },
      ],
    ])
    expect(reflowChanges(planned, stored).map((r) => r.id)).toEqual(['b'])
  })

  it('counts a row it has never seen as a change', () => {
    expect(reflowChanges(planned, new Map()).map((r) => r.id)).toEqual([
      'a',
      'b',
    ])
  })

  it('ignores a stored time of day', () => {
    // The stored value is whatever was typed in; only the Monday matters.
    const stored = new Map([
      [
        'a',
        { startsAt: '2026-09-16T09:00:00Z', endsAt: '2026-10-14T22:00:00Z' },
      ],
      ['b', { startsAt: planned[1].startsAt, endsAt: planned[1].endsAt }],
    ])
    expect(reflowChanges(planned, stored)).toEqual([])
  })
})

describe('dragging one into place', () => {
  const order = ['a', 'b', 'c', 'd']

  it('moves it down', () => {
    expect(reorder(order, 'a', 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves it up', () => {
    expect(reorder(order, 'd', 0)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('clamps a drag that ends past the end', () => {
    expect(reorder(order, 'a', 99)).toEqual(['b', 'c', 'd', 'a'])
    expect(reorder(order, 'd', -5)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('leaves an unknown id alone rather than inventing one', () => {
    expect(reorder(order, 'zz', 1)).toEqual(order)
  })

  it('never loses or duplicates a row', () => {
    for (let to = 0; to < 6; to += 1) {
      const next = reorder(order, 'b', to)
      expect([...next].sort()).toEqual([...order].sort())
      expect(new Set(next).size).toBe(order.length)
    }
  })

  it('does not mutate what it was given', () => {
    const original = [...order]
    reorder(order, 'a', 3)
    expect(order).toEqual(original)
  })
})
