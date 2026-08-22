// Loop-range rail geometry tests keep A at zero and focused editing mathematically honest.
// ============================================================

import { describe, expect, it } from 'vitest'
import { focusedLoopRangeViewport, loopRangeNeedsFocus, loopRangePercent, loopRangeValueAtRatio, normalizeLoopRangeSpan, } from './loop-range-rail'

describe('loop range rail geometry', () => {
  it('keeps zero as a real A mark rather than an unset sentinel', () => {
    expect(normalizeLoopRangeSpan(0, 4, { start: 0, end: 64 })).toEqual({
      start: 0,
      end: 4,
    })
  })

  it('maps values through an arbitrary viewport in both directions', () => {
    const viewport = { start: 20, end: 40 }
    expect(loopRangePercent(25, viewport)).toBe(25)
    expect(loopRangeValueAtRatio(0.25, viewport)).toBe(25)
  })

  it('offers focus only when the full-song handles are too close', () => {
    const domain = { start: 0, end: 240 }
    expect(loopRangeNeedsFocus(domain, { start: 60, end: 64 }, 600)).toBe(true)
    expect(loopRangeNeedsFocus(domain, { start: 60, end: 120 }, 600)).toBe(
      false,
    )
  })

  it('centres a focused loop and clamps it at both timeline edges', () => {
    expect(
      focusedLoopRangeViewport(
        { start: 0, end: 240 },
        { start: 0, end: 4 },
        400,
      ),
    ).toEqual({ start: 0, end: expect.any(Number) })
    const atEnd = focusedLoopRangeViewport(
      { start: 0, end: 240 },
      { start: 236, end: 240 },
      400,
    )
    expect(atEnd.end).toBe(240)
    expect(loopRangePercent(236, atEnd)).toBeGreaterThanOrEqual(30)
  })
})
