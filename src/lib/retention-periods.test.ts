// ============================================================
// Retention periods — parsing a config value, and the cutoffs
// ============================================================
//
// The rule that matters most: a bad value never makes a period shorter than
// the default. A typo in wrangler.jsonc or an env file must not delete data
// the privacy notice says is kept.

import { describe, expect, it } from 'vitest'
import { DAY_MS, daysBefore, monthsBefore, parsePeriod, storedDate, } from './retention-periods'

describe('parsePeriod', () => {
  it('takes a plain whole number', () => {
    expect(parsePeriod('90', 13, 1000)).toEqual({ value: 90, problem: null })
    expect(parsePeriod(' 7 ', 13, 1000)).toEqual({ value: 7, problem: null })
    expect(parsePeriod(5, 13, 1000)).toEqual({ value: 5, problem: null })
  })

  it('uses the default, quietly, when nothing is set', () => {
    expect(parsePeriod(undefined, 13, 1000)).toEqual({
      value: 13,
      problem: null,
    })
    expect(parsePeriod(null, 13, 1000)).toEqual({ value: 13, problem: null })
    expect(parsePeriod('', 13, 1000)).toEqual({ value: 13, problem: null })
    expect(parsePeriod('   ', 13, 1000)).toEqual({ value: 13, problem: null })
  })

  it.each([
    ['0'],
    ['-5'],
    ['-0'],
    ['1.5'],
    ['0.5'],
    ['1e3'],
    ['0x10'],
    ['13 months'],
    ['18m'],
    ['abc'],
    ['NaN'],
    ['Infinity'],
  ])('falls back to the default for %j, and says so', (raw) => {
    const parsed = parsePeriod(raw, 13, 1000)
    expect(parsed.value).toBe(13)
    expect(parsed.problem).not.toBeNull()
  })

  it('caps a huge value instead of refusing it, since it keeps more', () => {
    const parsed = parsePeriod('99999999', 13, 1200)
    expect(parsed.value).toBe(1200)
    expect(parsed.problem).not.toBeNull()
  })
})

describe('daysBefore', () => {
  it('counts whole days back', () => {
    const now = Date.UTC(2026, 9, 11, 6, 17)
    expect(daysBefore(now, 90)).toBe(now - 90 * DAY_MS)
    expect(new Date(daysBefore(now, 2)).toISOString()).toBe(
      '2026-10-09T06:17:00.000Z',
    )
  })
})

describe('monthsBefore', () => {
  const iso = (ms: number): string => new Date(ms).toISOString()

  it('keeps the day and the time of day', () => {
    expect(iso(monthsBefore(Date.parse('2027-11-11T06:17:05.123Z'), 13))).toBe(
      '2026-10-11T06:17:05.123Z',
    )
  })

  it('crosses years in both directions of the month count', () => {
    expect(iso(monthsBefore(Date.parse('2027-01-15T00:00:00.000Z'), 13))).toBe(
      '2025-12-15T00:00:00.000Z',
    )
    expect(iso(monthsBefore(Date.parse('2027-01-15T00:00:00.000Z'), 1))).toBe(
      '2026-12-15T00:00:00.000Z',
    )
  })

  it('lands on the last day of a shorter month', () => {
    expect(iso(monthsBefore(Date.parse('2027-03-31T12:00:00.000Z'), 13))).toBe(
      '2026-02-28T12:00:00.000Z',
    )
    expect(iso(monthsBefore(Date.parse('2029-03-31T12:00:00.000Z'), 13))).toBe(
      '2028-02-29T12:00:00.000Z',
    )
  })

  it('stays in range at the largest period a config can ask for', () => {
    expect(Number.isFinite(monthsBefore(Date.now(), 1200))).toBe(true)
  })
})

describe('storedDate', () => {
  const NOW = Date.parse('2026-10-11T08:00:00.000Z')
  const LEGACY = Date.parse('2026-07-01T00:00:00.000Z')

  it('believes a stored date, as a number or as text', () => {
    const then = NOW - 5 * DAY_MS
    expect(storedDate(then, NOW, LEGACY)).toBe(then)
    expect(storedDate(String(then), NOW, LEGACY)).toBe(then)
  })

  it.each([
    ['missing', undefined],
    ['null', null],
    ['empty', ''],
    ['text', 'last tuesday'],
    ['zero', 0],
    ['negative', -5],
    ['NaN', Number.NaN],
  ])('gives the legacy day, never now, for %s', (_label, value) => {
    expect(storedDate(value, NOW, LEGACY)).toBe(LEGACY)
  })

  it('takes up to a day ahead as clock skew, and no more', () => {
    expect(storedDate(NOW + DAY_MS, NOW, LEGACY)).toBe(NOW + DAY_MS)
    expect(storedDate(NOW + DAY_MS + 1, NOW, LEGACY)).toBe(LEGACY)
  })
})
