// Convex contact tests — polygon support never becomes a hidden rectangular floor.

import { describe, expect, it } from 'vitest'
import { circleInsideConvexPolygon, circleOverlapsConvexPolygon, convexPolygonError, normalizeConvexPolygon, pointInConvexPolygon, separateCircleFromConvexPolygon, sweepCircleIntoConvexPolygon, } from './convex-polygon'

const HEX = normalizeConvexPolygon([
  { x: -1, z: 0 },
  { x: -0.5, z: 0.866 },
  { x: 0.5, z: 0.866 },
  { x: 1, z: 0 },
  { x: 0.5, z: -0.866 },
  { x: -0.5, z: -0.866 },
])

describe('convex platform contact', () => {
  it('accepts either winding but rejects concave and collinear outlines', () => {
    expect(convexPolygonError([...HEX].reverse())).toBeUndefined()
    expect(
      convexPolygonError([
        { x: -1, z: -1 },
        { x: 1, z: -1 },
        { x: 0, z: 0 },
        { x: 1, z: 1 },
        { x: -1, z: 1 },
      ]),
    ).toContain('convex')
    expect(
      convexPolygonError([
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 2, z: 0 },
        { x: 0, z: 1 },
      ]),
    ).toContain('collinear')
    expect(
      convexPolygonError([
        { x: 0, z: -1 },
        { x: 0.588, z: 0.809 },
        { x: -0.951, z: -0.309 },
        { x: 0.951, z: -0.309 },
        { x: -0.588, z: 0.809 },
      ]),
    ).toContain('ordered')
  })

  it('distinguishes exact support, overlapping body and fully contained body', () => {
    const corner = { x: 0.82, z: 0.5 }
    expect(pointInConvexPolygon(corner, HEX)).toBe(false)
    expect(circleOverlapsConvexPolygon(corner, 0.16, HEX)).toBe(true)
    expect(circleInsideConvexPolygon(corner, 0.16, HEX)).toBe(false)
    expect(circleInsideConvexPolygon({ x: 0, z: 0 }, 0.16, HEX)).toBe(true)
  })

  it('separates a short landing at a diagonal edge along its physical normal', () => {
    const separated = separateCircleFromConvexPolygon(
      { x: 0.82, z: 0.5 },
      0.16,
      HEX,
    )!
    expect(circleOverlapsConvexPolygon(separated, 0.16, HEX)).toBe(false)
    expect(separated.x).toBeGreaterThan(0.82)
    expect(separated.z).toBeGreaterThan(0.5)
  })

  it('sweeps through the entire hex at high displacement without tunnelling', () => {
    const time = sweepCircleIntoConvexPolygon(
      { x: -2, z: 0.4 },
      { x: 2, z: 0.4 },
      0.16,
      HEX,
    )
    expect(time).toBeDefined()
    expect(time!).toBeGreaterThan(0.2)
    expect(time!).toBeLessThan(0.4)
  })
})
