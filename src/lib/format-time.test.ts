// ── Display time tests ────────────────────────────────────────────────
// Read off a transport by a person mid-song, so the failure mode that
// matters is a label that looks broken rather than one that is wrong by
// a second.

import { describe, expect, it } from 'vitest'
import { formatClock, roundedMinutesSeconds } from '@/lib/format-time'

describe('formatClock', () => {
  it('formats the common case', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(9)).toBe('0:09')
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(246)).toBe('4:06')
  })

  it('grows an hours field only when there are hours', () => {
    // A four-minute song should not read 0:04:06.
    expect(formatClock(3599)).toBe('59:59')
    expect(formatClock(3600)).toBe('1:00:00')
    expect(formatClock(3725)).toBe('1:02:05')
  })

  it('truncates rather than rounding up', () => {
    // Rounding shows 1:00 while the song is still at 59 seconds, which
    // looks like the clock jumped ahead of the music.
    expect(formatClock(59.9)).toBe('0:59')
  })

  it('reads 0:00 for nonsense rather than NaN:NaN', () => {
    // duration is NaN until an audio element has loaded metadata.
    expect(formatClock(Number.NaN)).toBe('0:00')
    expect(formatClock(-5)).toBe('0:00')
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe('0:00')
  })
})

describe('roundedMinutesSeconds', () => {
  // Rounding only the seconds left over once the minutes were split off
  // read 179.5 as 2 minutes and 60 seconds, which every caller printed as
  // "2:60".
  it.each([
    { at: 179.5, minutes: 3, seconds: 0 },
    { at: 119.6, minutes: 2, seconds: 0 },
    { at: 59.6, minutes: 1, seconds: 0 },
  ])('carries $at s up into minute $minutes', ({ at, minutes, seconds }) => {
    expect(roundedMinutesSeconds(at)).toEqual({ minutes, seconds })
  })

  it.each([
    { at: 59.4, minutes: 0, seconds: 59 },
    { at: 179.4, minutes: 2, seconds: 59 },
  ])('keeps $at s within its minute', ({ at, minutes, seconds }) => {
    expect(roundedMinutesSeconds(at)).toEqual({ minutes, seconds })
  })

  it('counts minutes past the hour instead of growing an hours field', () => {
    // A length reads m:ss. The h:mm:ss form belongs to formatClock.
    expect(roundedMinutesSeconds(3725)).toEqual({ minutes: 62, seconds: 5 })
  })

  it('never reads 60 seconds at any tenth of a second up to two hours', () => {
    const wrong: number[] = []
    for (let tenths = 0; tenths <= 72_000; tenths++) {
      const at = tenths / 10
      const { minutes, seconds } = roundedMinutesSeconds(at)
      if (seconds > 59 || minutes * 60 + seconds !== Math.round(at)) {
        wrong.push(at)
      }
    }

    expect(wrong).toEqual([])
  })
})
