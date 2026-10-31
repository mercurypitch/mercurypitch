// ============================================================
// How long until something, in words: Leagues' cut and a Legend's close
// ============================================================

import { describe, expect, it } from 'vitest'
import { durationInWords } from './duration-words'

const HOUR = 3_600_000
const MINUTE = 60_000

describe('the time left, in words', () => {
  it('is days or hours, never "3d 4h"', () => {
    expect(durationInWords(3 * 24 * HOUR + 4 * HOUR)).toBe('3 days')
    expect(durationInWords(30 * HOUR)).toBe('a day')
    expect(durationInWords(5 * HOUR + 10 * MINUTE)).toBe('5 hours')
    expect(durationInWords(HOUR + 1)).toBe('an hour')
    expect(durationInWords(20 * MINUTE)).toBe('less than an hour')
  })

  it('rounds to the nearest unit, never to half the time left', () => {
    expect(durationInWords(47 * HOUR + 59 * MINUTE)).toBe('2 days')
    expect(durationInWords(36 * HOUR)).toBe('2 days')
    expect(durationInWords(35 * HOUR)).toBe('a day')
    expect(durationInWords(23 * HOUR + 40 * MINUTE)).toBe('a day')
    expect(durationInWords(HOUR + 59 * MINUTE)).toBe('2 hours')
    expect(durationInWords(59 * MINUTE)).toBe('an hour')
    expect(durationInWords(6 * 24 * HOUR + 23 * HOUR)).toBe('7 days')
  })
})
