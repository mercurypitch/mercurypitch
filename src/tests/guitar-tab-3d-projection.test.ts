import type { HighwayLayout } from '@/features/guitar-tab-3d/renderer/projection'
import { beatsToDepth, DEFAULT_LAYOUT, laneU, perspectiveScale, projectBoardPoint, } from '@/features/guitar-tab-3d/renderer/projection'

const layout: HighwayLayout = { ...DEFAULT_LAYOUT, width: 1000, height: 800 }

describe('perspectiveScale', () => {
  it('is 1 at the hit line and shrinks with depth', () => {
    expect(perspectiveScale(0, 3)).toBe(1)
    expect(perspectiveScale(1, 3)).toBeCloseTo(0.25)
    expect(perspectiveScale(0.5, 3)).toBeLessThan(perspectiveScale(0.25, 3))
  })
})

describe('laneU', () => {
  it('spreads strings symmetrically across [-1, 1]', () => {
    expect(laneU(0, 6, false)).toBeCloseTo(-1 + 1 / 6)
    expect(laneU(5, 6, false)).toBeCloseTo(1 - 1 / 6)
    expect(laneU(0, 6, false)).toBeCloseTo(-laneU(5, 6, false))
  })

  it('mirrors for left-handed players', () => {
    expect(laneU(0, 6, true)).toBeCloseTo(-laneU(0, 6, false))
  })
})

describe('projectBoardPoint', () => {
  it('puts the near edge at the hit line spanning the full board width', () => {
    const left = projectBoardPoint(layout, -1, 0)
    const right = projectBoardPoint(layout, 1, 0)
    expect(left.y).toBeCloseTo(800 * DEFAULT_LAYOUT.hitLineRatio)
    expect(left.x).toBeCloseTo(500 - 1000 * DEFAULT_LAYOUT.nearHalfWidthRatio)
    expect(right.x).toBeCloseTo(500 + 1000 * DEFAULT_LAYOUT.nearHalfWidthRatio)
  })

  it('converges toward the centre and rises toward the horizon with depth', () => {
    const near = projectBoardPoint(layout, 1, 0)
    const far = projectBoardPoint(layout, 1, 1)
    expect(far.y).toBeLessThan(near.y)
    expect(Math.abs(far.x - 500)).toBeLessThan(Math.abs(near.x - 500))
  })
})

describe('beatsToDepth', () => {
  it('normalises beats-ahead by the visible window', () => {
    expect(beatsToDepth(4, 8)).toBeCloseTo(0.5)
    expect(beatsToDepth(0, 8)).toBe(0)
    expect(beatsToDepth(5, 0)).toBe(0)
  })
})
