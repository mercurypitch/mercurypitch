// ============================================================
// PracticeTimerPill — readout formatting
// ============================================================

import { describe, expect, it } from 'vitest'
import { formatRemaining } from './PracticeTimerPill'

describe('formatRemaining', () => {
  it('pads the seconds', () => {
    expect(formatRemaining(65_000)).toBe('1:05')
  })

  it('shows whole minutes without a remainder', () => {
    expect(formatRemaining(120_000)).toBe('2:00')
  })

  // Rounding up keeps a still-running phase off 0:00, which reads as finished.
  it('rounds a part-second up', () => {
    expect(formatRemaining(200)).toBe('0:01')
  })

  it('shows zero only when the phase really is spent', () => {
    expect(formatRemaining(0)).toBe('0:00')
  })

  it('does not collapse long intervals', () => {
    expect(formatRemaining(20 * 60_000)).toBe('20:00')
  })
})
