import { beatsToDepth, perspectiveScale, } from '@/features/guitar-tab-3d/renderer/projection'

describe('perspectiveScale', () => {
  it('is 1 at the hit line and shrinks with depth', () => {
    expect(perspectiveScale(0, 5)).toBe(1)
    expect(perspectiveScale(1, 5)).toBeCloseTo(1 / 6)
    expect(perspectiveScale(0.5, 5)).toBeLessThan(perspectiveScale(0.25, 5))
  })
})

describe('beatsToDepth', () => {
  it('normalises beats-ahead by the visible window', () => {
    expect(beatsToDepth(4, 8)).toBeCloseTo(0.5)
    expect(beatsToDepth(0, 8)).toBe(0)
    expect(beatsToDepth(5, 0)).toBe(0)
  })
})
