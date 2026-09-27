// Shatter motion regressions — every profile is deterministic, distinct and bounded by installed scale.

import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { ShatterProfile } from './shatter-motion'
import { planShatterMicroBurst, planShatterShardMotion, SHATTER_MICRO_COUNTS, } from './shatter-motion'

const VESSEL_BOUNDS = new Box3(
  new Vector3(-0.28, 0, -0.24),
  new Vector3(0.28, 0.72, 0.24),
)
const WALL_BOUNDS = new Box3(
  new Vector3(-2.4, 0, -0.08),
  new Vector3(2.4, 2.8, 0.08),
)

function speed(particle: { velocity: Vector3 }): number {
  return particle.velocity.length()
}

describe('profile-driven shatter motion', () => {
  it.each<ShatterProfile>(['crown', 'radial', 'sheet', 'ice-wall'])(
    'keeps the %s plan deterministic and within its fixed draw budget',
    (profile) => {
      const bounds = profile === 'ice-wall' ? WALL_BOUNDS : VESSEL_BOUNDS
      const first = planShatterMicroBurst('same-target', profile, bounds)
      const second = planShatterMicroBurst('same-target', profile, bounds)

      expect(first).toEqual(second)
      expect(first.chips).toHaveLength(SHATTER_MICRO_COUNTS[profile].chips)
      expect(first.glints).toHaveLength(SHATTER_MICRO_COUNTS[profile].glints)
      expect(new Set(first.chips.map((chip) => chip.shape))).toEqual(
        new Set([0, 1, 2]),
      )
      expect(
        Math.max(...first.chips.map((chip) => chip.delay)),
      ).toBeLessThanOrEqual(0.18)
      expect(
        first.chips.every((chip) =>
          [
            ...chip.origin.toArray(),
            ...chip.velocity.toArray(),
            ...chip.spin.toArray(),
            ...chip.scale.toArray(),
          ].every(Number.isFinite),
        ),
      ).toBe(true)
    },
  )

  it('launches a goblet crown upward from its upper bowl', () => {
    const plan = planShatterMicroBurst('goblet', 'crown', VESSEL_BOUNDS)
    const averageOriginY =
      plan.chips.reduce((sum, chip) => sum + chip.origin.y, 0) /
      plan.chips.length
    const averageVerticalSpeed =
      plan.chips.reduce((sum, chip) => sum + chip.velocity.y, 0) /
      plan.chips.length
    const averageHorizontalSpeed =
      plan.chips.reduce(
        (sum, chip) => sum + Math.hypot(chip.velocity.x, chip.velocity.z),
        0,
      ) / plan.chips.length

    expect(averageOriginY).toBeGreaterThan(0.42)
    expect(averageVerticalSpeed).toBeGreaterThan(averageHorizontalSpeed)
  })

  it('launches a rounded vessel radially around its body', () => {
    const plan = planShatterMicroBurst('vase', 'radial', VESSEL_BOUNDS)
    const outward = plan.chips.filter((chip) => {
      const fromCenter = new Vector3(chip.origin.x, 0, chip.origin.z)
      const horizontalVelocity = new Vector3(
        chip.velocity.x,
        0,
        chip.velocity.z,
      )
      return fromCenter.dot(horizontalVelocity) > 0
    })

    expect(outward.length / plan.chips.length).toBeGreaterThan(0.9)
  })

  it('spreads sheet fragments across the pane and pushes them through its face', () => {
    const plan = planShatterMicroBurst('portrait', 'sheet', VESSEL_BOUNDS)
    const xValues = plan.chips.map((chip) => chip.origin.x)
    const yValues = plan.chips.map((chip) => chip.origin.y)

    expect(Math.min(...xValues)).toBeLessThan(-0.2)
    expect(Math.max(...xValues)).toBeGreaterThan(0.2)
    expect(Math.min(...yValues)).toBeLessThan(0.12)
    expect(Math.max(...yValues)).toBeGreaterThan(0.6)
    expect(plan.chips.every((chip) => chip.velocity.z > 0)).toBe(true)
  })

  it('scales a wall burst from its actual installed bounds without unbounded counts', () => {
    const vessel = planShatterMicroBurst('ice', 'ice-wall', VESSEL_BOUNDS)
    const wall = planShatterMicroBurst('ice', 'ice-wall', WALL_BOUNDS)
    const average = (particles: typeof wall.chips) =>
      particles.reduce((sum, particle) => sum + speed(particle), 0) /
      particles.length

    expect(wall.chips).toHaveLength(vessel.chips.length)
    expect(average(wall.chips)).toBeGreaterThan(average(vessel.chips) * 2)
    expect(
      Math.max(...wall.chips.map((chip) => Math.max(...chip.scale.toArray()))),
    ).toBeLessThanOrEqual(0.32)
  })

  it('seeds authored shard launch, spin and stagger from the target id', () => {
    const centre = new Vector3(0.18, 0.54, 0.08)
    const first = planShatterShardMotion(
      'target-a',
      'radial',
      VESSEL_BOUNDS,
      centre,
      3,
    )
    const repeat = planShatterShardMotion(
      'target-a',
      'radial',
      VESSEL_BOUNDS,
      centre,
      3,
    )
    const other = planShatterShardMotion(
      'target-b',
      'radial',
      VESSEL_BOUNDS,
      centre,
      3,
    )

    expect(first).toEqual(repeat)
    expect(first).not.toEqual(other)
    expect(
      first.velocity.x * centre.x + first.velocity.z * centre.z,
    ).toBeGreaterThan(0)
    expect(first.delay).toBeGreaterThanOrEqual(0)
    expect(first.delay).toBeLessThanOrEqual(0.075)
  })
})
