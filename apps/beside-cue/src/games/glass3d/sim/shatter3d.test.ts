import { describe, expect, it } from 'vitest'
import { WORLD3D_CONFIG } from '../world3d-config'
import type { Vec3 } from './shatter3d'
import { mulberry32, shardAt, shatterDuration, solveShatter } from './shatter3d'

const S = WORLD3D_CONFIG.shatter
const BREAK: Vec3 = { x: 0, y: 1, z: 0 }

/** A ring of centroids around the break point, as a glass bowl would be. */
const ring = (count: number, radius = 0.05): Vec3[] =>
  Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2
    return {
      x: BREAK.x + Math.cos(a) * radius,
      y: BREAK.y,
      z: BREAK.z + Math.sin(a) * radius,
    }
  })

describe('solving the shatter', () => {
  it('replays exactly from the same seed, and differs from another', () => {
    const c = ring(24)
    const a = solveShatter(c, BREAK, 1, S, 1234)
    const b = solveShatter(c, BREAK, 1, S, 1234)
    const other = solveShatter(c, BREAK, 1, S, 5678)

    expect(a).toEqual(b)
    expect(a).not.toEqual(other)
  })

  it('throws every shard away from the break point', () => {
    for (const launch of solveShatter(ring(24), BREAK, 1, S, 7)) {
      const outward =
        launch.velocity.x * (launch.origin.x - BREAK.x) +
        launch.velocity.z * (launch.origin.z - BREAK.z)
      expect(outward).toBeGreaterThan(0)
    }
  })

  it('throws harder for a better-sung note', () => {
    const c = ring(24)
    const speedOf = (accuracy: number): number => {
      const launches = solveShatter(c, BREAK, accuracy, S, 3)
      const total = launches.reduce(
        (sum, l) => sum + Math.hypot(l.velocity.x, l.velocity.y, l.velocity.z),
        0,
      )
      return total / launches.length
    }
    expect(speedOf(1)).toBeGreaterThan(speedOf(0.5))
    expect(speedOf(0.5)).toBeGreaterThan(speedOf(0))
  })

  it('still throws a sloppy break, because nothing should feel dead', () => {
    const launches = solveShatter(ring(12), BREAK, 0, S, 3)
    for (const l of launches) {
      expect(Math.hypot(l.velocity.x, l.velocity.z)).toBeGreaterThan(0)
    }
  })

  it('clamps an accuracy outside 0..1 rather than trusting it', () => {
    const c = ring(8)
    expect(solveShatter(c, BREAK, 4, S, 1)).toEqual(
      solveShatter(c, BREAK, 1, S, 1),
    )
    expect(solveShatter(c, BREAK, -2, S, 1)).toEqual(
      solveShatter(c, BREAK, 0, S, 1),
    )
  })

  it('releases shards across a window, so the break is not one flat pop', () => {
    const delays = solveShatter(ring(32), BREAK, 1, S, 11).map((l) => l.delay)
    expect(Math.min(...delays)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...delays)).toBeLessThanOrEqual(S.releaseWindowSeconds)
    expect(new Set(delays).size).toBeGreaterThan(1)
  })

  it('gives a shard exactly at the break point somewhere to go', () => {
    // Otherwise this is a divide by zero and the shard renders at NaN.
    const [launch] = solveShatter([BREAK], BREAK, 1, S, 1)
    expect(Number.isFinite(launch.velocity.x)).toBe(true)
    expect(Number.isFinite(launch.velocity.y)).toBe(true)
    expect(Number.isFinite(launch.velocity.z)).toBe(true)
  })
})

describe('where a shard is at a moment', () => {
  const [launch] = solveShatter([{ x: 0.5, y: 2, z: 0 }], BREAK, 1, S, 42)

  it('has not moved before its delay elapses', () => {
    const pose = shardAt(launch, launch.delay * 0.5, S)
    expect(pose.position).toEqual(launch.origin)
    expect(pose.angle).toBe(0)
    expect(pose.progress).toBe(0)
  })

  it('is the same answer every time it is asked', () => {
    // The vertex shader will evaluate this per frame with no history, so
    // it must not depend on having been asked about earlier times.
    const t = launch.delay + 0.4
    expect(shardAt(launch, t, S)).toEqual(shardAt(launch, t, S))
  })

  it('falls, and never sinks through the floor', () => {
    for (let t = 0; t < 6; t += 0.01) {
      expect(shardAt(launch, t, S).position.y).toBeGreaterThanOrEqual(-1e-9)
    }
  })

  it('rises before it falls when thrown upward', () => {
    const up = { ...launch, delay: 0, velocity: { x: 0, y: 4, z: 0 } }
    const early = shardAt(up, 0.1, S).position.y
    const apexish = shardAt(up, 0.4, S).position.y
    expect(apexish).toBeGreaterThan(early)
    expect(shardAt(up, 2, S).position.y).toBeLessThan(apexish)
  })

  it('keeps less speed after the bounce than it arrived with', () => {
    const drop = {
      ...launch,
      delay: 0,
      origin: { x: 0, y: 2, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    }
    // Free fall from 2 m hits at t = sqrt(2*2/g).
    const tHit = Math.sqrt((2 * 2) / S.gravity)
    const rebound = shardAt(drop, tHit + 0.05, S).position.y
    const wouldHaveBeen = 0 + Math.sqrt(2 * S.gravity * 2) * 0.05
    expect(rebound).toBeGreaterThan(0)
    expect(rebound).toBeLessThan(wouldHaveBeen)
  })

  it('reaches full progress once settled, and stops there', () => {
    expect(shardAt(launch, launch.delay + S.settleSeconds, S).progress).toBe(1)
    expect(
      shardAt(launch, launch.delay + S.settleSeconds * 3, S).progress,
    ).toBe(1)
  })

  it('reports when the last shard is done, so the burst can be disposed', () => {
    const launches = solveShatter(ring(16), BREAK, 1, S, 9)
    const done = shatterDuration(launches, S)
    for (const l of launches) {
      expect(shardAt(l, done, S).progress).toBe(1)
    }
  })
})

describe('the seeded random itself', () => {
  it('stays inside the unit interval', () => {
    const rand = mulberry32(99)
    for (let i = 0; i < 5000; i++) {
      const v = rand()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
