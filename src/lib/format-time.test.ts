// ── Display time tests ────────────────────────────────────────────────
// Read off a transport by a person mid-song, so the failure mode that
// matters is a label that looks broken rather than one that is wrong by
// a second.

import { describe, expect, it } from 'vitest'
import { formatClock } from '@/lib/format-time'

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
