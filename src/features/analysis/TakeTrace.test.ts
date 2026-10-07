// ============================================================
// Take trace span label — how long the take ran, under the trace
// ============================================================
//
// A take half a second short of a minute rounded its seconds up to 60
// without carrying the minute, and the foot read "60s" or "2m 60s".

import { describe, expect, it } from 'vitest'
import { formatSpan } from './TakeTrace'

describe('formatSpan', () => {
  it.each([
    [179.5, '3m 0s'],
    [119.6, '2m 0s'],
    [59.6, '1m 0s'],
    [59.4, '59s'],
  ])('labels a %s s take "%s"', (seconds, label) => {
    expect(formatSpan(seconds)).toBe(label)
  })

  it.each([0, -1, Number.NaN])('shows a dash for a take of %s s', (seconds) => {
    expect(formatSpan(seconds)).toBe('—')
  })
})
