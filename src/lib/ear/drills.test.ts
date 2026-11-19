// The drill catalogue's one rounding for a threshold reading
// (formatThresholdReading): whole milliseconds and notes, a tempo's tenth
// only under 3 %, a tenth of a cent or a decibel, and a tenth for a drill
// the catalogue does not hold. Every place that prints a reading holds to
// it (features/ear-lab/merc/one-rounding.test.tsx).

import { describe, expect, it } from 'vitest'
import { formatThresholdReading } from './drills'

describe('formatThresholdReading', () => {
  it('keeps a tenth of a cent', () => {
    expect(formatThresholdReading('hairline', 9.44)).toBe('9.4')
    expect(formatThresholdReading('beat-hunt', 12)).toBe('12.0')
  })

  it('writes milliseconds and notes whole', () => {
    expect(formatThresholdReading('the-grid', 18.6)).toBe('19')
    expect(formatThresholdReading('span', 5.2)).toBe('5')
  })

  it("keeps a tempo's tenth only under 3 %", () => {
    expect(formatThresholdReading('drift', 2.44)).toBe('2.4')
    expect(formatThresholdReading('drift', 3)).toBe('3')
    expect(formatThresholdReading('drift', 7.6)).toBe('8')
  })

  it('keeps a tenth for a decibel and for a drill the catalogue lacks', () => {
    expect(formatThresholdReading('colour', 3.25)).toBe('3.3')
    expect(formatThresholdReading('desk-weight', 1.04)).toBe('1.0')
  })
})
