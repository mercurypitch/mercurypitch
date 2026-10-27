import { describe, expect, it } from 'vitest'
import { midiToF0 } from '@/lib/glass/test-frames'
import type { TrailGeometry, TrailPoint } from './voice-trail'
import { foldedCents, headOf, TRAIL_REACH_CENTS, TRAIL_SECONDS, trailPath, trailPoint, trailY, } from './voice-trail'

const GEOMETRY: TrailGeometry = {
  headX: 260,
  lineY: 300,
  width: 220,
  reach: 150,
}

describe("the voice's trail", () => {
  it('reads the voice against the nearest octave of home', () => {
    expect(foldedCents(60, 60)).toBe(0)
    // An octave under home is home.
    expect(foldedCents(48, 60)).toBe(0)
    // A fifth above, and a fourth under, sit where they are.
    expect(foldedCents(67, 60)).toBe(-500)
    expect(foldedCents(55, 60)).toBe(-500)
    expect(foldedCents(60.3, 60)).toBeCloseTo(30)
    expect(foldedCents(47.7, 60)).toBeCloseTo(-30)
  })

  it('reads a frame as folded cents, and silence as a break', () => {
    const voiced = trailPoint(
      { t: 1, f0: midiToF0(48.2), conf: 0.9, rms: 0.4 },
      60,
    )
    expect(voiced.t).toBe(1)
    expect(voiced.cents).toBeCloseTo(20)
    expect(
      trailPoint({ t: 2, f0: 0, conf: 0, rms: 0.001 }, 60).cents,
    ).toBeNull()
  })

  it('draws up for higher, held inside its reach', () => {
    expect(trailY(0, GEOMETRY)).toBe(300)
    expect(trailY(TRAIL_REACH_CENTS, GEOMETRY)).toBe(150)
    expect(trailY(-TRAIL_REACH_CENTS, GEOMETRY)).toBe(450)
    expect(trailY(5000, GEOMETRY)).toBe(150)
  })

  it('draws the last few seconds, one stroke per voiced run', () => {
    const points: TrailPoint[] = [
      { t: 0, cents: 100 },
      { t: TRAIL_SECONDS - 0.5, cents: 0 },
      { t: TRAIL_SECONDS - 0.4, cents: 0 },
      { t: TRAIL_SECONDS - 0.3, cents: null },
      { t: TRAIL_SECONDS - 0.2, cents: -100 },
      { t: TRAIL_SECONDS, cents: -100 },
    ]
    const path = trailPath(points, TRAIL_SECONDS + 0.1, GEOMETRY)
    // The first reading has left the trail; the break starts a new stroke.
    expect(path.match(/M/g)).toHaveLength(2)
    expect(path.startsWith('M')).toBe(true)
    expect(path).not.toContain('NaN')
    expect(trailPath([], 1, GEOMETRY)).toBe('')
  })

  it("puts the trail's head on its newest reading, while it is fresh", () => {
    const points: TrailPoint[] = [
      { t: 1, cents: 40 },
      { t: 1.1, cents: 50 },
    ]
    expect(headOf(points, 1.2)).toEqual({ t: 1.1, cents: 50 })
    expect(headOf(points, 2)).toBeNull()
    expect(headOf([...points, { t: 1.15, cents: null }], 1.2)).toBeNull()
  })
})
