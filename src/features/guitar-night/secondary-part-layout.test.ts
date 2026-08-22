import { describe, expect, it } from 'vitest'
import { resolveSecondaryPartLayout, secondaryPartRectsOverlap, secondaryPartWidthRange, } from './secondary-part-layout'

describe('secondary-part layout', () => {
  it('keeps the panel inside the stage at every edge', () => {
    const layout = resolveSecondaryPartLayout(
      { x: 2_000, y: -400, width: 380 },
      150,
      { width: 1_000, height: 600 },
      [],
    )

    expect(layout.x).toBeGreaterThanOrEqual(12)
    expect(layout.y).toBeGreaterThanOrEqual(12)
    expect(layout.x + layout.width).toBeLessThanOrEqual(988)
  })

  it('moves around the protected stage header instead of covering it', () => {
    const protectedHeader = { x: 0, y: 0, width: 1_000, height: 78 }
    const layout = resolveSecondaryPartLayout(
      { x: 320, y: 20, width: 320 },
      150,
      { width: 1_000, height: 600 },
      [protectedHeader],
    )

    expect(
      secondaryPartRectsOverlap(
        { ...layout, height: 150 },
        protectedHeader,
        10,
      ),
    ).toBe(false)
    expect(layout.y).toBeGreaterThanOrEqual(88)
  })

  it('avoids a bottom-right orbit hint while staying near the requested point', () => {
    const orbitHint = { x: 730, y: 535, width: 250, height: 45 }
    const layout = resolveSecondaryPartLayout(
      { x: 690, y: 460, width: 300 },
      120,
      { width: 1_000, height: 600 },
      [orbitHint],
    )

    expect(
      secondaryPartRectsOverlap({ ...layout, height: 120 }, orbitHint, 10),
    ).toBe(false)
  })

  it('uses a responsive, bounded horizontal resize range', () => {
    expect(secondaryPartWidthRange(1_400)).toEqual({ min: 240, max: 560 })
    expect(secondaryPartWidthRange(600)).toEqual({ min: 240, max: 372 })
    expect(secondaryPartWidthRange(220)).toEqual({ min: 136.4, max: 136.4 })
  })

  it('chooses the least-overlapping valid position when the stage is crowded', () => {
    const layout = resolveSecondaryPartLayout(
      { x: 12, y: 12, width: 300 },
      180,
      { width: 500, height: 260 },
      [{ x: 0, y: 0, width: 500, height: 260 }],
    )

    expect(layout.x).toBeGreaterThanOrEqual(12)
    expect(layout.y).toBeGreaterThanOrEqual(12)
    expect(layout.x + layout.width).toBeLessThanOrEqual(488)
  })
})
