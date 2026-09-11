import { describe, expect, it } from 'vitest'
import { createMouthTap, MOUTH_QUIET_SECONDS } from './mouth-tap'

describe('a tap when a mouth opens', () => {
  it('only notes what it is told first, open or shut', () => {
    expect(createMouthTap()(true, 0)).toBe(false)
    expect(createMouthTap()(false, 0)).toBe(false)
  })

  it('is felt when a mouth that has been shut a while opens', () => {
    const felt = createMouthTap()
    felt(false, 0)
    expect(felt(true, 1)).toBe(true)
  })

  it('is felt once for a mouth that stays open', () => {
    const felt = createMouthTap()
    felt(false, 0)
    const taps = [1, 1.01, 1.5, 3].map((t) => felt(true, t))
    expect(taps).toEqual([true, false, false, false])
  })

  it('is never felt on a closing', () => {
    const felt = createMouthTap()
    felt(true, 0)
    expect(felt(false, 1)).toBe(false)
  })

  // The wavering voice: open, a blink shut, open again. One tap.
  it('does not buzz on a mouth the voice lets flicker', () => {
    const felt = createMouthTap()
    felt(false, 0)
    expect(felt(true, 1)).toBe(true)
    expect(felt(false, 1.05)).toBe(false)
    expect(felt(true, 1.1)).toBe(false)
    expect(felt(false, 1.12)).toBe(false)
    expect(felt(true, 1.2)).toBe(false)
  })

  it('is felt again once the mouth has been shut for the quiet spell', () => {
    const felt = createMouthTap()
    felt(false, 0)
    felt(true, 1)
    felt(false, 2)
    expect(felt(true, 2 + MOUTH_QUIET_SECONDS)).toBe(true)
  })
})
