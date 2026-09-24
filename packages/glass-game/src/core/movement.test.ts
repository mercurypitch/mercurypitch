// Movement tests — actual course jumps, solid obstacles and input forgiveness.

import { describe, expect, it } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import type { MovementInput, PlatformDefinition } from '../contracts'
import { FLAT_COURSE_COLLIDER } from './collision'
import { createMovement, MOVEMENT, releaseMovement, stepMovement, } from './movement'

const idle: MovementInput = { moveX: 0, moveZ: 0, jumpDown: false }
const floor: PlatformDefinition = {
  id: 'floor',
  minX: -20,
  maxX: 20,
  minZ: -20,
  maxZ: 20,
  top: 0,
  thickness: 0.2,
  kind: 'deck',
  material: 'stone',
}
const pacedMovement = {
  walkSpeed: 1.55,
  runSpeed: 2.7,
  runDelaySeconds: 0.6,
  runRampSeconds: 0.8,
}

function moveFor(
  state: ReturnType<typeof createMovement>,
  input: MovementInput,
  seconds: number,
  dt = MOVEMENT.fixedStep,
  course: readonly PlatformDefinition[] = [floor],
): void {
  for (let elapsed = 0; elapsed < seconds - dt / 2; elapsed += dt)
    stepMovement(state, input, dt, course, FLAT_COURSE_COLLIDER, pacedMovement)
}

describe('manual adventure movement', () => {
  it('moves freely on x/z without a diagonal speed bonus', () => {
    const cardinal = createMovement({ x: 0, y: 0, z: 0 }, 0)
    const diagonal = createMovement({ x: 0, y: 0, z: 0 }, 0)
    for (let i = 0; i < 240; i++) {
      stepMovement(cardinal, { ...idle, moveX: 1 }, MOVEMENT.fixedStep, [floor])
      stepMovement(
        diagonal,
        { ...idle, moveX: 1, moveZ: 1 },
        MOVEMENT.fixedStep,
        [floor],
      )
    }
    expect(Math.hypot(diagonal.position.x, diagonal.position.z)).toBeCloseTo(
      cardinal.position.x,
    )
    expect(diagonal.position.x).toBeCloseTo(diagonal.position.z)
    expect(Math.hypot(diagonal.velocity.x, diagonal.velocity.z)).toBeCloseTo(
      1.15,
    )
  })

  it('preserves legacy pace without a level movement configuration', () => {
    const state = createMovement({ x: 0, y: 0, z: 0 }, 0)
    for (let i = 0; i < 360; i++)
      stepMovement(state, { ...idle, moveX: 1 }, MOVEMENT.fixedStep, [floor])

    expect(state.velocity.x).toBeCloseTo(MOVEMENT.speed)
    expect(state.position.x).toBeCloseTo(3.37, 1)
  })

  it('walks first, then ramps gently to the configured run speed', () => {
    const state = createMovement({ x: 0, y: 0, z: 0 }, 0)
    const full = { ...idle, moveX: 1 }

    moveFor(state, full, 0.5)
    expect(state.velocity.x).toBeCloseTo(pacedMovement.walkSpeed, 2)
    expect(state.runSeconds).toBeCloseTo(0.5, 2)

    moveFor(state, full, 0.5)
    expect(state.velocity.x).toBeGreaterThan(pacedMovement.walkSpeed)
    expect(state.velocity.x).toBeLessThan(pacedMovement.runSpeed)

    moveFor(state, full, 0.6)
    expect(state.velocity.x).toBeCloseTo(pacedMovement.runSpeed, 2)
    expect(state.runSeconds).toBeCloseTo(
      pacedMovement.runDelaySeconds + pacedMovement.runRampSeconds,
    )
  })

  it('keeps feathered analog movement at walking pace and normalizes a full diagonal', () => {
    const feathered = createMovement({ x: 0, y: 0, z: 0 }, 0)
    const diagonal = createMovement({ x: 0, y: 0, z: 0 }, 0)
    moveFor(feathered, { ...idle, moveX: 0.5 }, 2)
    moveFor(diagonal, { ...idle, moveX: 1, moveZ: 1 }, 2)

    expect(feathered.velocity.x).toBeCloseTo(pacedMovement.walkSpeed * 0.5)
    expect(feathered.runSeconds).toBe(0)
    expect(Math.hypot(diagonal.velocity.x, diagonal.velocity.z)).toBeCloseTo(
      pacedMovement.runSpeed,
    )
  })

  it('resets run-up on stop, reversal and lifecycle release', () => {
    const state = createMovement({ x: 0, y: 0, z: 0 }, 0)
    moveFor(state, { ...idle, moveX: 1 }, 1.6)
    expect(state.velocity.x).toBeCloseTo(pacedMovement.runSpeed, 2)

    const releasedAt = state.position.x
    moveFor(state, idle, 0.2)
    expect(state.runSeconds).toBe(0)
    expect(state.velocity.x).toBe(0)
    expect(state.position.x - releasedAt).toBeLessThan(0.25)

    moveFor(state, { ...idle, moveX: 1 }, 0.7)
    expect(state.runSeconds).toBeGreaterThan(0.6)
    moveFor(state, { ...idle, moveX: -1 }, MOVEMENT.fixedStep)
    expect(state.runSeconds).toBe(0)

    moveFor(state, { ...idle, moveX: -1 }, 0.7)
    releaseMovement(state)
    expect(state.runSeconds).toBe(0)
  })

  it('does not charge run-up while pushing into a wall', () => {
    const wall = {
      ...floor,
      id: 'run-wall',
      minX: 1,
      maxX: 1.05,
      top: 1,
      thickness: 1,
    }
    const state = createMovement({ x: 0, y: 0, z: 0 }, 0)
    moveFor(state, { ...idle, moveX: 1 }, 2, MOVEMENT.fixedStep, [floor, wall])

    expect(state.position.x).toBeCloseTo(1 - MOVEMENT.radius)
    expect(state.velocity.x).toBe(0)
    expect(state.runSeconds).toBe(0)

    moveFor(state, { ...idle, moveZ: 1 }, 0.2, MOVEMENT.fixedStep, [
      floor,
      wall,
    ])
    expect(Math.abs(state.velocity.z)).toBeLessThanOrEqual(
      pacedMovement.walkSpeed,
    )
  })

  it('reaches the same bounded run across fixed-step partitions', () => {
    const fine = createMovement({ x: 0, y: 0, z: 0 }, 0)
    const coarse = createMovement({ x: 0, y: 0, z: 0 }, 0)
    const full = { ...idle, moveZ: -1 }
    moveFor(fine, full, 1.8, 1 / 120)
    moveFor(coarse, full, 1.8, 1 / 60)

    expect(fine.velocity.z).toBeCloseTo(-pacedMovement.runSpeed, 2)
    expect(coarse.velocity.z).toBeCloseTo(fine.velocity.z, 2)
    expect(coarse.position.z).toBeCloseTo(fine.position.z, 1)
    expect(fine.runSeconds).toBeLessThanOrEqual(1.4)
    expect(coarse.runSeconds).toBeLessThanOrEqual(1.4)
  })

  it('holding jump only jumps once, including after landing', () => {
    const state = createMovement({ x: 0, y: 0, z: 0 }, 0)
    let jumps = 0
    let apex = 0
    for (let i = 0; i < 360; i++) {
      if (
        stepMovement(state, { ...idle, jumpDown: true }, MOVEMENT.fixedStep, [
          floor,
        ]).jumped
      )
        jumps++
      apex = Math.max(apex, state.position.y)
    }
    expect(jumps).toBe(1)
    expect(apex).toBeGreaterThan(0.48)
    expect(apex).toBeLessThanOrEqual(0.5)
    expect(state.grounded).toBe(true)
  })

  it('requires a fresh press after input release and buffers a press before landing', () => {
    const state = createMovement({ x: 0, y: 0, z: 0 }, 0)
    releaseMovement(state)
    expect(
      stepMovement(state, { ...idle, jumpDown: true }, MOVEMENT.fixedStep, [
        floor,
      ]).jumped,
    ).toBe(false)
    stepMovement(state, idle, MOVEMENT.fixedStep, [floor])
    expect(
      stepMovement(state, { ...idle, jumpDown: true }, MOVEMENT.fixedStep, [
        floor,
      ]).jumped,
    ).toBe(true)
    for (let i = 0; i < 82; i++)
      stepMovement(state, idle, MOVEMENT.fixedStep, [floor])
    let bufferedJump = false
    for (let i = 0; i < 20; i++)
      bufferedJump ||= stepMovement(
        state,
        { ...idle, jumpDown: true },
        MOVEMENT.fixedStep,
        [floor],
      ).jumped
    expect(bufferedJump).toBe(true)
  })

  it('allows coyote jumping shortly after walking off, but not after expiry', () => {
    for (const delay of [0.05, 0.15]) {
      const state = createMovement({ x: 0, y: 0, z: 0 }, 0)
      state.grounded = false
      state.coyoteLeft = MOVEMENT.coyoteSeconds
      for (let i = 0; i < Math.round(delay / MOVEMENT.fixedStep); i++)
        stepMovement(state, idle, MOVEMENT.fixedStep, [])
      expect(
        stepMovement(state, { ...idle, jumpDown: true }, MOVEMENT.fixedStep, [])
          .jumped,
      ).toBe(delay < MOVEMENT.coyoteSeconds)
    }
  })

  it('lands the authored raised overlook → terrace-one jump from rest', () => {
    const state = createMovement({ x: 9.8, y: 0, z: 7.16 }, 0)
    const course = GLASSWORKS.platforms.filter(
      (platform) => platform.id === 'overlook' || platform.id === 'terrace-one',
    )
    let landedOn: string | undefined
    for (let frame = 0; frame < 120; frame++) {
      const result = stepMovement(
        state,
        { moveX: 0, moveZ: -1, jumpDown: frame === 0 },
        MOVEMENT.fixedStep,
        course,
      )
      if (result.landed) {
        landedOn = result.support?.id
        break
      }
    }
    expect(landedOn).toBe('terrace-one')
    expect(state.position.y).toBe(
      course.find((platform) => platform.id === 'terrace-one')!.top,
    )
  })

  it('does not walk through a riser or bank velocity against a wall', () => {
    const wall = {
      ...floor,
      id: 'wall',
      minX: 1,
      maxX: 1.05,
      top: 1,
      thickness: 1,
    }
    const state = createMovement({ x: 0, y: 0, z: 0 }, 0)
    for (let i = 0; i < 240; i++)
      stepMovement(state, { ...idle, moveX: 1 }, MOVEMENT.fixedStep, [
        floor,
        wall,
      ])
    expect(state.position.x).toBeCloseTo(1 - MOVEMENT.radius)
    expect(state.velocity.x).toBe(0)
    expect(state.position.y).toBe(0)
  })

  it.each([
    [
      'arch-bridge',
      'overlook',
      { x: 1.2, y: 0, z: 5.101 },
      { moveX: 0, moveZ: 1 },
    ],
    [
      'hero-bridge',
      'hero-deck',
      { x: 8.599, y: 0.15, z: 2.4 },
      { moveX: -1, moveZ: 0 },
    ],
  ] as const)(
    'cannot coyote-jump across the closed %s span',
    (_bridge, destination, position, direction) => {
      const state = createMovement(position, 0)
      state.grounded = false
      state.velocity.x = direction.moveX * MOVEMENT.speed
      state.velocity.z = direction.moveZ * MOVEMENT.speed
      const course = GLASSWORKS.platforms.filter(
        (p) => p.unlockAfter === undefined,
      )
      const landed: string[] = []
      // The furthest legal launch starts at full speed and consumes late coyote time.
      for (
        let i = 0;
        i < 200 && state.position.y >= GLASSWORKS.fallBelow;
        i++
      ) {
        const result = stepMovement(
          state,
          { ...direction, jumpDown: i === 11 },
          MOVEMENT.fixedStep,
          course,
        )
        if (result.landed && result.support !== null)
          landed.push(result.support.id)
      }
      expect(landed).not.toContain(destination)
      expect(state.position.y).toBeLessThan(GLASSWORKS.fallBelow)
    },
  )

  it('hits an overhead underside instead of teleporting onto the platform', () => {
    const ceiling = { ...floor, id: 'ceiling', top: 1, thickness: 0.2 }
    const state = createMovement({ x: 0, y: 0, z: 0 }, 0)
    let apex = 0
    for (let i = 0; i < 160; i++) {
      stepMovement(state, { ...idle, jumpDown: i === 0 }, MOVEMENT.fixedStep, [
        floor,
        ceiling,
      ])
      apex = Math.max(apex, state.position.y)
    }
    expect(apex).toBeCloseTo(0.3)
    expect(state.position.y).toBe(0)
  })

  it('sweeps a thin side wall even for a displacement larger than its thickness', () => {
    const wall = { ...floor, minX: 1, maxX: 1.02, top: 1, thickness: 1 }
    const hit = FLAT_COURSE_COLLIDER.move(
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 },
      [wall],
      MOVEMENT,
    )
    expect(hit.blockedX).toBe(true)
    expect(hit.position.x).toBeCloseTo(0.84)
  })
})
