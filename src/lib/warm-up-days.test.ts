// ============================================================
// The days warmed up: the union on pull, the newest 90, the week's dots
// ============================================================
//
// DESIGN-warm-up.md §12, 13e's tests: the merge on pull is a union in
// both orders, and a week's dots read right across a month boundary.

import { describe, expect, it } from 'vitest'
import type { WarmUpDays } from './warm-up-days'
import { isDay, isWarmUpDays, keptDays, mergeWarmUpDays, mergeWarmUpDaysOnPull, WARM_UP_DAYS_KEPT, weekDots, weekOf, weekSaid, withDay, } from './warm-up-days'

/** `count` consecutive days from 1 Jan 2026, oldest first. */
function daysFrom2026(count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
  )
}

const parse = (raw: string): unknown => JSON.parse(raw)

describe('a day, and a list of them', () => {
  it('reads a real calendar day, and nothing else', () => {
    expect(isDay('2026-10-19')).toBe(true)
    expect(isDay('2028-02-29')).toBe(true)
    expect(isDay('2026-02-29')).toBe(false)
    expect(isDay('2026-13-01')).toBe(false)
    expect(isDay('2026-1-9')).toBe(false)
    expect(isDay(20261019)).toBe(false)
  })

  it('reads a list of days in any order, and refuses anything else', () => {
    expect(isWarmUpDays([])).toBe(true)
    expect(isWarmUpDays(['2026-10-19', '2026-10-01'])).toBe(true)
    expect(isWarmUpDays(['2026-10-19', 'today'])).toBe(false)
    expect(isWarmUpDays({ '2026-10-19': true })).toBe(false)
    expect(isWarmUpDays(null)).toBe(false)
  })

  it('keeps each day once, oldest first, and only the newest 90', () => {
    expect(keptDays(['2026-10-19', '2026-10-01', '2026-10-19'])).toEqual([
      '2026-10-01',
      '2026-10-19',
    ])
    const many = daysFrom2026(WARM_UP_DAYS_KEPT + 10)
    const kept = keptDays([...many].reverse())
    expect(kept).toHaveLength(WARM_UP_DAYS_KEPT)
    expect(kept[0]).toBe(many[10])
    expect(kept.at(-1)).toBe(many.at(-1))
  })
})

describe('withDay', () => {
  it('adds a day in its place', () => {
    expect(withDay(['2026-10-01', '2026-10-21'], '2026-10-19')).toEqual([
      '2026-10-01',
      '2026-10-19',
      '2026-10-21',
    ])
  })

  it('hands back the same list when there is nothing to write', () => {
    const days: WarmUpDays = ['2026-10-19']
    expect(withDay(days, '2026-10-19')).toBe(days)
    expect(withDay(days, 'not a day')).toBe(days)
    // Older than the 90 a full list keeps: it would be dropped at once.
    const full = daysFrom2026(WARM_UP_DAYS_KEPT).slice()
    expect(withDay(full, '2025-12-31')).toBe(full)
  })

  it('drops the oldest once a list is full', () => {
    const full = daysFrom2026(WARM_UP_DAYS_KEPT)
    const next = withDay(full, '2026-10-19')
    expect(next).toHaveLength(WARM_UP_DAYS_KEPT)
    expect(next[0]).toBe(full[1])
    expect(next.at(-1)).toBe('2026-10-19')
  })
})

describe('the merge on pull: a union, in both orders', () => {
  const phone = ['2026-10-01', '2026-10-05', '2026-10-19']
  const tablet = ['2026-10-02', '2026-10-05', '2026-10-20']
  const union = [
    '2026-10-01',
    '2026-10-02',
    '2026-10-05',
    '2026-10-19',
    '2026-10-20',
  ]

  it('keeps every day from either side, whichever side is which', () => {
    expect(mergeWarmUpDays(phone, tablet)).toEqual(union)
    expect(mergeWarmUpDays(tablet, phone)).toEqual(union)
    const a = JSON.stringify(phone)
    const b = JSON.stringify(tablet)
    expect(parse(mergeWarmUpDaysOnPull(a, b))).toEqual(union)
    expect(parse(mergeWarmUpDaysOnPull(b, a))).toEqual(union)
  })

  it('keeps the newest 90 of the union, in both orders', () => {
    const all = daysFrom2026(120)
    const evens = all.filter((_, i) => i % 2 === 0)
    const odds = all.filter((_, i) => i % 2 === 1)
    const want = all.slice(-WARM_UP_DAYS_KEPT)
    expect(
      parse(mergeWarmUpDaysOnPull(JSON.stringify(evens), JSON.stringify(odds))),
    ).toEqual(want)
    expect(
      parse(mergeWarmUpDaysOnPull(JSON.stringify(odds), JSON.stringify(evens))),
    ).toEqual(want)
  })

  it('sends back a side that already holds the union as its own string', () => {
    const cloud = JSON.stringify(union)
    const local = JSON.stringify(phone)
    expect(mergeWarmUpDaysOnPull(local, cloud)).toBe(cloud)
    expect(mergeWarmUpDaysOnPull(cloud, local)).toBe(cloud)
  })

  it('gives way to the side that reads, the account when neither does', () => {
    const good = JSON.stringify(phone)
    expect(mergeWarmUpDaysOnPull(null, good)).toBe(good)
    expect(mergeWarmUpDaysOnPull('not json', good)).toBe(good)
    expect(mergeWarmUpDaysOnPull(good, '{"days":1}')).toBe(good)
    expect(mergeWarmUpDaysOnPull('[1]', '[2]')).toBe('[2]')
  })
})

describe('the week', () => {
  it('runs Monday to Sunday', () => {
    // 19 Oct 2026 is a Monday, 25 Oct the Sunday after it.
    const week = weekOf('2026-10-21')
    expect(week[0]).toBe('2026-10-19')
    expect(week.at(-1)).toBe('2026-10-25')
    expect(weekOf('2026-10-25')).toEqual(week)
    expect(weekOf('2026-10-26')[0]).toBe('2026-10-26')
  })

  it('crosses a month, a year and the clocks going back', () => {
    // Thursday 1 Oct 2026: the week began in September.
    expect(weekOf('2026-10-01')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
    expect(weekOf('2027-01-01')[0]).toBe('2026-12-28')
    expect(weekOf('2027-01-01').at(-1)).toBe('2027-01-03')
    // Europe's clocks go back on Sunday 25 Oct 2026: seven days still.
    expect(new Set(weekOf('2026-10-25')).size).toBe(7)
  })

  it('has no days for a day that is not one', () => {
    expect(weekOf('2026-02-30')).toEqual([])
  })
})

describe("the week's dots", () => {
  it("fill the week's days warmed up across a month boundary, and ring today", () => {
    // Today is Thursday 1 Oct; Monday and Wednesday were in September.
    const dots = weekDots(
      ['2026-09-27', '2026-09-28', '2026-09-30', '2026-10-01'],
      '2026-10-01',
    )
    expect(dots?.map((dot) => dot.day)).toEqual(weekOf('2026-10-01'))
    expect(dots?.map((dot) => dot.warmed)).toEqual([
      true,
      false,
      true,
      true,
      false,
      false,
      false,
    ])
    expect(dots?.map((dot) => dot.today)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ])
  })

  it('show today ringed and empty once an earlier day is warmed up', () => {
    const dots = weekDots(['2026-09-29'], '2026-10-01')
    expect(dots?.[1]).toEqual({ day: '2026-09-29', warmed: true, today: false })
    expect(dots?.[3]).toEqual({ day: '2026-10-01', warmed: false, today: true })
  })

  it('are not shown before a day of the week is warmed up', () => {
    // Sunday 27 Sep belongs to the week before.
    expect(weekDots(['2026-09-27'], '2026-10-01')).toBeNull()
    expect(weekDots([], '2026-10-01')).toBeNull()
  })

  it('are said by the days warmed up, and nothing about the others', () => {
    const today = weekDots(['2026-10-01'], '2026-10-01')!
    expect(weekSaid(today)).toBe('Warmed up this week: today')
    const two = weekDots(['2026-09-28', '2026-10-01'], '2026-10-01')!
    expect(weekSaid(two)).toBe('Warmed up this week: Monday and today')
    const three = weekDots(
      ['2026-09-28', '2026-09-29', '2026-09-30'],
      '2026-10-01',
    )!
    expect(weekSaid(three)).toBe(
      'Warmed up this week: Monday, Tuesday and Wednesday',
    )
  })
})
