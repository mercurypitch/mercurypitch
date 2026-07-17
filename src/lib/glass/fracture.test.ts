// ============================================================
// Glass fracture — deterministic geometry, physics stepping and
// the performance-scaled shatter timeline.
// ============================================================

import { describe, expect, it } from 'vitest'
import { GLASS_CONFIG } from './config'
import type { Point } from './fracture'
import { buildShardBodies, computeShatterTimeline, generateFracture, polyCentroid, splitPoly, stepShardBodies, } from './fracture'

const W = 420
const H = 546
const IMPACT: Point = [W / 2, H / 2]

describe('generateFracture', () => {
  it('is deterministic for a given seed', () => {
    const a = generateFracture(W, H, IMPACT, 42)
    const b = generateFracture(W, H, IMPACT, 42)
    expect(a).toEqual(b)
  })

  it('produces different patterns for different seeds', () => {
    const a = generateFracture(W, H, IMPACT, 1)
    const b = generateFracture(W, H, IMPACT, 2)
    expect(a).not.toEqual(b)
  })

  it('conserves the pane area across the shards', () => {
    const shards = generateFracture(W, H, IMPACT, 7)
    const total = shards.reduce((sum, p) => sum + polyCentroid(p).area, 0)
    expect(total).toBeGreaterThan(W * H * 0.999)
    expect(total).toBeLessThan(W * H * 1.001)
  })

  it('respects the shard cap and produces a real burst', () => {
    const shards = generateFracture(W, H, IMPACT, 3)
    expect(shards.length).toBeGreaterThan(20)
    expect(shards.length).toBeLessThanOrEqual(
      GLASS_CONFIG.shatter.maxShards + 1,
    )
  })

  it('clusters smaller shards near the impact', () => {
    const shards = generateFracture(W, H, IMPACT, 11)
    const near: number[] = []
    const far: number[] = []
    for (const poly of shards) {
      const { cx, cy, area } = polyCentroid(poly)
      const dist = Math.hypot(cx - IMPACT[0], cy - IMPACT[1])
      ;(dist < W * 0.3 ? near : far).push(area)
    }
    const avg = (xs: number[]): number =>
      xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)
    expect(avg(near)).toBeLessThan(avg(far))
  })
})

describe('splitPoly / polyCentroid', () => {
  it('splits a square through its center into two equal halves', () => {
    const square: Point[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]
    const halves = splitPoly(square, 5, 5, Math.PI / 2)
    expect(halves).not.toBeNull()
    const [a, b] = halves!
    expect(polyCentroid(a).area).toBeCloseTo(50, 5)
    expect(polyCentroid(b).area).toBeCloseTo(50, 5)
  })

  it('returns null for a line that misses the polygon', () => {
    const square: Point[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]
    expect(splitPoly(square, 50, 50, 0)).toBeNull()
  })
})

describe('buildShardBodies + stepShardBodies', () => {
  it('bursts outward from the impact and falls under gravity', () => {
    const shards = generateFracture(W, H, IMPACT, 5)
    const bodies = buildShardBodies(shards, IMPACT, H, 5)
    expect(bodies.length).toBe(shards.length)

    const right = bodies.find((b) => b.x > IMPACT[0] + 60)
    expect(right).toBeDefined()
    expect(right!.vx).toBeGreaterThan(0) // moving away from the impact

    const before = bodies.map((b) => b.vy)
    stepShardBodies(bodies, 0.1)
    bodies.forEach((b, i) => {
      expect(b.vy).toBeGreaterThan(before[i]) // gravity pulls down
    })
  })

  it('is deterministic for a given seed', () => {
    const shards = generateFracture(W, H, IMPACT, 9)
    const a = buildShardBodies(shards, IMPACT, H, 9)
    const b = buildShardBodies(shards, IMPACT, H, 9)
    expect(a).toEqual(b)
  })
})

describe('computeShatterTimeline', () => {
  it('interpolates the config endpoints by epicness', () => {
    const s = GLASS_CONFIG.shatter
    const epic = computeShatterTimeline(1)
    const raw = computeShatterTimeline(0)
    expect(epic.slowMoFactor).toBeCloseTo(s.slowMoFactorEpic)
    expect(epic.slowMoSeconds).toBeCloseTo(s.slowMoSecondsEpic)
    expect(raw.slowMoFactor).toBeCloseTo(s.slowMoFactorRaw)
    expect(raw.slowMoSeconds).toBeCloseTo(s.slowMoSecondsRaw)
    // More epic = slower and longer.
    expect(epic.slowMoFactor).toBeLessThan(raw.slowMoFactor)
    expect(epic.slowMoSeconds).toBeGreaterThan(raw.slowMoSeconds)
  })

  it('ramps the time scale back to 1 after the slow-mo', () => {
    const tl = computeShatterTimeline(1)
    expect(tl.timeScaleAt(0)).toBeCloseTo(tl.slowMoFactor)
    expect(tl.timeScaleAt(tl.slowMoSeconds + 0.6)).toBeCloseTo(1)
    expect(tl.timeScaleAt(tl.slowMoSeconds + 0.3)).toBeGreaterThan(
      tl.slowMoFactor,
    )
  })

  it('collapses to a quick, flat timeline under reduced motion', () => {
    const tl = computeShatterTimeline(1, GLASS_CONFIG, { reduceMotion: true })
    expect(tl.flashSeconds).toBe(0)
    expect(tl.timeScaleAt(0)).toBe(1)
    expect(tl.totalSeconds).toBeLessThan(1.2)
  })
})
