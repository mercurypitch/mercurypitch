// Solid scenery regressions — real exhibit landing and honest round-edge contact.
import { describe, expect, it } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import type { CourseSolid, MovementInput, SolidPropDefinition, } from '../contracts'
import { FLAT_COURSE_COLLIDER } from './collision'
import { createGlassGame } from './game'
import { createMovement, MOVEMENT, stepMovement } from './movement'

const idle: MovementInput = { moveX: 0, moveZ: 0, jumpDown: false }
const plinth: SolidPropDefinition = {
  id: 'plinth',
  kind: 'prop',
  shape: 'cylinder',
  x: 0,
  z: 0,
  top: 0.24,
  thickness: 0.24,
  radiusTop: 0.25,
  radiusBottom: 0.29,
}
const floor: CourseSolid = {
  id: 'floor',
  kind: 'deck',
  material: 'stone',
  minX: -4,
  maxX: 4,
  minZ: -4,
  maxZ: 4,
  top: 0,
  thickness: 0.2,
}

describe('Glassworks solid exhibits', () => {
  it('lands on the visible first exhibit plinth instead of falling through to the deck', () => {
    const target = GLASSWORKS.breakables[0]
    const game = createGlassGame({
      ...GLASSWORKS,
      checkpoints: [],
      spawn: {
        position: { ...target.position, y: target.position.y + 0.8 },
        facingYaw: 0,
      },
    })
    for (let frame = 0; frame < 240; frame++)
      game.step({ moveX: 0, moveZ: 0, jumpDown: false }, MOVEMENT.fixedStep)
    expect(game.snapshot().player.position.y).toBeCloseTo(0.24)
    expect(game.snapshot().player.grounded).toBe(true)
    expect(game.snapshot().nearbyBreakableId).toBeNull()
    expect(game.saveProgress().completedBreakableIds).toEqual([])
  })

  it.each(GLASSWORKS.breakables)(
    'keeps $label standable after its saved break',
    (target) => {
      const game = createGlassGame(
        {
          ...GLASSWORKS,
          checkpoints: [],
          spawn: {
            position: { ...target.position, y: target.position.y + 0.8 },
            facingYaw: 0,
          },
        },
        {
          version: 1,
          levelId: GLASSWORKS.id,
          checkpointId: 'arrival',
          completedBreakableIds: GLASSWORKS.breakables.map((item) => item.id),
        },
      )
      for (let frame = 0; frame < 180; frame++)
        game.step(idle, MOVEMENT.fixedStep)
      expect(game.snapshot().player.position.y).toBeCloseTo(
        target.position.y + 0.24,
      )
      expect(game.snapshot().player.grounded).toBe(true)
      expect(game.snapshot().nearbyBreakableId).toBeNull()
      expect(game.saveProgress().completedBreakableIds).toContain(target.id)
    },
  )

  it.each([false, true])(
    'activates a platform-owned solid only with its floor: open=%s',
    (open) => {
      const level = {
        ...GLASSWORKS,
        checkpoints: [],
        spawn: { position: { x: 1.2, y: 0.8, z: 1.2 }, facingYaw: 0 },
        solids: [{ ...plinth, x: 1.2, z: 1.2, platformId: 'arch-bridge' }],
      }
      const game = createGlassGame(level, {
        version: 1,
        levelId: level.id,
        checkpointId: 'arrival',
        completedBreakableIds: open ? [GLASSWORKS.breakables[0].id] : [],
      })
      for (let frame = 0; frame < 180; frame++)
        game.step(idle, MOVEMENT.fixedStep)
      expect(game.snapshot().player.position.y).toBeCloseTo(open ? 0.24 : 0)
    },
  )

  it('jumps onto a plinth, rests there, then falls back to the deck after leaving its round edge', () => {
    const state = createMovement({ x: -0.55, y: 0, z: 0 }, 0)
    let landedOn: string | undefined
    for (let frame = 0; frame < 160; frame++) {
      const result = stepMovement(
        state,
        {
          ...idle,
          moveX: state.position.x < -0.04 ? 1 : 0,
          jumpDown: frame === 0,
        },
        MOVEMENT.fixedStep,
        [floor, plinth],
      )
      if (result.landed) landedOn = result.support?.id
    }
    expect(landedOn).toBe('plinth')
    expect(state.position.y).toBeCloseTo(0.24)
    expect(state.grounded).toBe(true)
    let leftTop = false
    for (let frame = 0; frame < 150; frame++) {
      stepMovement(state, { ...idle, moveX: 1 }, MOVEMENT.fixedStep, [
        floor,
        plinth,
      ])
      leftTop ||= !state.grounded
    }
    expect(leftTop).toBe(true)
    expect(state.position.x).toBeGreaterThan(0.5)
    expect(state.position.y).toBe(0)
    expect(state.grounded).toBe(true)
  })

  it('blocks fast side movement at the curved base and diagonal profile without square corners', () => {
    for (const z of [0, 0.3]) {
      const hit = FLAT_COURSE_COLLIDER.move(
        { x: -1, y: 0, z },
        { x: 2, y: 0, z: 0 },
        [plinth],
        MOVEMENT,
      )
      expect(hit.blockedX).toBe(true)
      expect(Math.hypot(hit.position.x, z)).toBeCloseTo(0.29 + MOVEMENT.radius)
    }
    const clear = FLAT_COURSE_COLLIDER.move(
      { x: -1, y: 0, z: 0.46 },
      { x: 2, y: 0, z: 0 },
      [plinth],
      MOVEMENT,
    )
    expect(clear.blockedX).toBe(false)
    expect(clear.position.x).toBe(1)
  })

  it('never banks horizontal velocity against a plinth side', () => {
    const state = createMovement({ x: -1, y: 0, z: 0 }, 0)
    for (let frame = 0; frame < 240; frame++)
      stepMovement(state, { ...idle, moveX: 1 }, MOVEMENT.fixedStep, [
        floor,
        plinth,
      ])
    expect(state.position.x).toBeCloseTo(-0.45)
    expect(state.velocity.x).toBe(0)
    expect(state.position.y).toBe(0)
  })

  it.each(['cylinder', 'box'] as const)(
    'cannot reverse into a %s prop after stepping just off its top',
    (shape) => {
      const prop: SolidPropDefinition =
        shape === 'cylinder'
          ? plinth
          : {
              id: 'trough',
              kind: 'prop',
              shape: 'box',
              minX: -0.25,
              maxX: 0.25,
              minZ: -0.25,
              maxZ: 0.25,
              top: 0.24,
              thickness: 0.24,
            }
      const edge = FLAT_COURSE_COLLIDER.move(
        { x: 0.249, y: 0.24, z: 0 },
        { x: 0.012, y: -0.001, z: 0 },
        [floor, prop],
        MOVEMENT,
      )
      const reversed = FLAT_COURSE_COLLIDER.move(
        edge.position,
        { x: -0.02, y: -0.01, z: 0 },
        [floor, prop],
        MOVEMENT,
      )
      expect(reversed.position.x).toBeGreaterThanOrEqual(0.25)
      expect(reversed.blockedX).toBe(true)
      const state = createMovement(reversed.position, 0)
      state.grounded = false
      for (let frame = 0; frame < 160; frame++)
        stepMovement(state, { ...idle, moveX: -1 }, MOVEMENT.fixedStep, [
          floor,
          prop,
        ])
      expect(state.position.y).toBe(0)
      expect(state.position.x).toBeCloseTo(
        (shape === 'cylinder' ? 0.29 : 0.25) + MOVEMENT.radius,
      )
    },
  )

  it('hits a round underside without teleporting onto its top', () => {
    const raised = { ...plinth, top: 1, thickness: 0.2 }
    const hit = FLAT_COURSE_COLLIDER.move(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0.7, z: 0 },
      [raised],
      MOVEMENT,
    )
    expect(hit.ceiling).toBe(true)
    expect(hit.support).toBeNull()
    expect(hit.position.y).toBeCloseTo(0.3)
  })

  it('does not float on the invisible square corner outside a round top', () => {
    const state = createMovement({ x: 0.24, y: 0.8, z: 0.24 }, 0)
    const supports: string[] = []
    for (let frame = 0; frame < 160; frame++) {
      const result = stepMovement(state, idle, MOVEMENT.fixedStep, [
        floor,
        plinth,
      ])
      if (result.support) supports.push(result.support.id)
    }
    expect(supports).not.toContain('plinth')
    expect(state.position.y).toBe(0)
  })

  it('keeps all singing anchors free and the near arch passage open', () => {
    const solids = [
      ...GLASSWORKS.platforms.filter((p) => p.kind === 'deck'),
      ...GLASSWORKS.solids!,
    ]
    for (const target of GLASSWORKS.breakables)
      for (const axis of ['x', 'z'] as const)
        for (const sign of [-1, 1]) {
          const offset = { x: 0, y: -0.01, z: 0, [axis]: sign * 0.08 }
          const hit = FLAT_COURSE_COLLIDER.move(
            target.anchor,
            offset,
            solids,
            MOVEMENT,
          )
          expect(hit.blockedX, target.id).toBe(false)
          expect(hit.blockedZ, target.id).toBe(false)
          expect(hit.position.y, target.id).toBe(target.anchor.y)
        }
    const hit = FLAT_COURSE_COLLIDER.move(
      { x: 1.2, y: 0, z: 4.1 },
      { x: 0, y: 0, z: 1.5 },
      GLASSWORKS.solids!.filter((p) => p.id.startsWith('arch-')),
      MOVEMENT,
    )
    expect(hit.blockedZ).toBe(false)
    expect(hit.position.z).toBeCloseTo(5.6)
  })

  it('makes measured planter rims and arch piers solid without extending to foliage', () => {
    const planter = GLASSWORKS.solids!.find(
      (p) => p.id === 'planter:arrival:-1',
    )!
    expect(planter.shape).toBe('box')
    if (planter.shape !== 'box') throw new Error('Expected trough box')
    const x = (planter.minX + planter.maxX) / 2
    const z = (planter.minZ + planter.maxZ) / 2
    const landed = FLAT_COURSE_COLLIDER.move(
      { x, y: 0.5, z },
      { x: 0, y: -0.6, z: 0 },
      [planter],
      MOVEMENT,
    )
    expect(landed.position.y).toBeCloseTo(0.084)
    const throughFoliage = FLAT_COURSE_COLLIDER.move(
      { x: x - 1, y: 0.09, z },
      { x: 2, y: 0, z: 0 },
      [planter],
      MOVEMENT,
    )
    expect(throughFoliage.blockedX).toBe(false)
    const pier = GLASSWORKS.solids!.find((p) => p.id === 'arch-pier:-1')!
    const side = FLAT_COURSE_COLLIDER.move(
      { x: 0.305, y: 0.1, z: 4 },
      { x: 0, y: 0, z: 2 },
      [pier],
      MOVEMENT,
    )
    expect(side.blockedZ).toBe(true)
    expect(side.position.z).toBeCloseTo(4.85 - 0.175 - MOVEMENT.radius)
  })
})
