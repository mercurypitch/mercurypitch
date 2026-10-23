// Splat backdrop world — deterministic scenery that stays outside the playable route.
import { describe, expect, it } from 'vitest'
import { createSplatBackdropWorld } from './splat-backdrop-world'

const options = {
  seed: 1,
  centre: { x: 2, y: 1, z: -6 },
  routeRadius: 12,
  density: 1,
}

describe('createSplatBackdropWorld', () => {
  const world = createSplatBackdropWorld(options)

  it('is the same world for the same seed and a different one for another', () => {
    const again = createSplatBackdropWorld(options)
    expect(again.count).toBe(world.count)
    expect(again.centres).toEqual(world.centres)
    expect(again.colors).toEqual(world.colors)
    const other = createSplatBackdropWorld({ ...options, seed: 2 })
    expect(other.centres).not.toEqual(world.centres)
  })

  it('builds a full archipelago within a phone-friendly budget', () => {
    expect(world.count).toBeGreaterThan(40_000)
    expect(world.count).toBeLessThan(250_000)
  })

  it('keeps every splat outside the playable route', () => {
    let nearest = Infinity
    for (let i = 0; i < world.count; i++) {
      const dx = world.centres[i * 3] - options.centre.x
      const dz = world.centres[i * 3 + 2] - options.centre.z
      nearest = Math.min(nearest, Math.hypot(dx, dz))
    }
    expect(nearest).toBeGreaterThan(options.routeRadius + 3)
  })

  it('writes finite geometry, unit rotations and colors in range', () => {
    let worstRotation = 0
    let invalid = 0
    for (let i = 0; i < world.count; i++) {
      const q = world.quaternions.subarray(i * 4, i * 4 + 4)
      worstRotation = Math.max(
        worstRotation,
        Math.abs(Math.hypot(q[0], q[1], q[2], q[3]) - 1),
      )
      for (let k = 0; k < 3; k++) {
        const color = world.colors[i * 3 + k]
        if (
          !Number.isFinite(world.centres[i * 3 + k]) ||
          !(world.scales[i * 3 + k] > 0) ||
          !(color >= 0 && color <= 1)
        )
          invalid++
      }
      const opacity = world.opacities[i]
      if (!(opacity > 0 && opacity <= 1)) invalid++
    }
    expect(worstRotation).toBeLessThan(1e-4)
    expect(invalid).toBe(0)
  })

  it('thins every element evenly at a lower density', () => {
    const balanced = createSplatBackdropWorld({ ...options, density: 0.6 })
    expect(balanced.count / world.count).toBeGreaterThan(0.5)
    expect(balanced.count / world.count).toBeLessThan(0.7)
  })
})
