// Glassworks floor-contact regressions — authored joins stay walkable without adding invisible support.

import { describe, expect, it } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import type { GameEvent, LevelDefinition, MovementInput, PlatformDefinition, Vec3, } from '../contracts'
import { FLAT_COURSE_COLLIDER } from './collision'
import { createGlassGame } from './game'
import { MOVEMENT } from './movement'

interface Approach {
  name: string
  spawn: Vec3
  input: MovementInput
  reached: (position: Vec3) => boolean
  top: number
}

const joinedApproaches: readonly Approach[] = [
  {
    name: 'arrival to goblet deck',
    spawn: { x: 1.2, y: 0, z: 2.3 },
    input: { moveX: 0, moveZ: 1, jumpDown: false },
    reached: (position) => position.z >= 3.1,
    top: 0,
  },
  {
    name: 'goblet deck to arrival',
    spawn: { x: 1.2, y: 0, z: 3.1 },
    input: { moveX: 0, moveZ: -1, jumpDown: false },
    reached: (position) => position.z <= 2.3,
    top: 0,
  },
  {
    name: 'arrival to goblet deck diagonally',
    spawn: { x: 0.9, y: 0, z: 2.3 },
    input: { moveX: 0.35, moveZ: 1, jumpDown: false },
    reached: (position) => position.z >= 3.1,
    top: 0,
  },
  {
    name: 'goblet deck to arrival diagonally',
    spawn: { x: 1.5, y: 0, z: 3.1 },
    input: { moveX: -0.35, moveZ: -1, jumpDown: false },
    reached: (position) => position.z <= 2.3,
    top: 0,
  },
  {
    name: 'terrace one to terrace two',
    spawn: { x: 9.8, y: 0.15, z: 5.9 },
    input: { moveX: 0, moveZ: -1, jumpDown: false },
    reached: (position) => position.z <= 5,
    top: 0.15,
  },
  {
    name: 'terrace two to terrace one',
    spawn: { x: 9.8, y: 0.15, z: 5 },
    input: { moveX: 0, moveZ: 1, jumpDown: false },
    reached: (position) => position.z >= 5.9,
    top: 0.15,
  },
  {
    name: 'terrace one to terrace two diagonally',
    spawn: { x: 9.45, y: 0.15, z: 5.9 },
    input: { moveX: 0.35, moveZ: -1, jumpDown: false },
    reached: (position) => position.z <= 5,
    top: 0.15,
  },
  {
    name: 'terrace two to terrace one diagonally',
    spawn: { x: 10.15, y: 0.15, z: 5 },
    input: { moveX: -0.35, moveZ: 1, jumpDown: false },
    reached: (position) => position.z >= 5.9,
    top: 0.15,
  },
]

const exposedRoutes: readonly Omit<Approach, 'reached' | 'top'>[] = [
  {
    name: 'the 0.6m loop-west to loop-east gap',
    spawn: { x: 4.8, y: 0.15, z: 3.6 },
    input: { moveX: 1, moveZ: 0, jumpDown: false },
  },
  {
    name: 'the exposed arrival edge',
    spawn: { x: 0.35, y: 0, z: 1.2 },
    input: { moveX: -1, moveZ: 0, jumpDown: false },
  },
]

function glassworksAt(spawn: Vec3): LevelDefinition {
  return {
    ...GLASSWORKS,
    spawn: { position: spawn, facingYaw: 0 },
    checkpoints: [],
  }
}

function run(
  approach: Pick<Approach, 'spawn' | 'input'>,
  framesPerSecond: 30 | 60,
  stop: (events: readonly GameEvent[], position: Vec3) => boolean,
) {
  const game = createGlassGame(glassworksAt(approach.spawn))
  const events: GameEvent[] = []
  for (let frame = 0; frame < framesPerSecond * 3; frame++) {
    events.push(...game.step(approach.input, 1 / framesPerSecond))
    if (stop(events, game.snapshot().player.position)) break
  }
  return { events, snapshot: game.snapshot() }
}

describe('Glassworks floor contact', () => {
  it.each([30, 60] as const)(
    'walks the two same-height joins in both directions and diagonally at %dHz',
    (framesPerSecond) => {
      const arrival = GLASSWORKS.platforms.find(
        (platform) => platform.id === 'arrival',
      )!
      const goblet = GLASSWORKS.platforms.find(
        (platform) => platform.id === 'goblet-deck',
      )!
      const terraceOne = GLASSWORKS.platforms.find(
        (platform) => platform.id === 'terrace-one',
      )!
      const terraceTwo = GLASSWORKS.platforms.find(
        (platform) => platform.id === 'terrace-two',
      )!
      expect(arrival.maxZ).toBe(goblet.minZ)
      expect(terraceTwo.maxZ).toBe(terraceOne.minZ)

      for (const approach of joinedApproaches) {
        const { events, snapshot } = run(
          approach,
          framesPerSecond,
          (_events, position) => approach.reached(position),
        )
        expect(approach.reached(snapshot.player.position), approach.name).toBe(
          true,
        )
        expect(
          events.some((event) => event.type === 'respawn'),
          approach.name,
        ).toBe(false)
        expect(snapshot.player.grounded, approach.name).toBe(true)
        expect(snapshot.player.position.y, approach.name).toBe(approach.top)
      }
    },
  )

  it.each([30, 60] as const)(
    'still falls through authored gaps and exposed edges at %dHz',
    (framesPerSecond) => {
      for (const approach of exposedRoutes) {
        const { events } = run(approach, framesPerSecond, (nextEvents) =>
          nextEvents.some((event) => event.type === 'respawn'),
        )
        expect(
          events.some((event) => event.type === 'respawn'),
          approach.name,
        ).toBe(true)
      }
    },
  )

  it('does not seam-forgive an explicitly marked same-height gap', () => {
    const left: PlatformDefinition = {
      id: 'left',
      minX: -1,
      maxX: 0,
      minZ: -1,
      maxZ: 1,
      top: 0,
      thickness: 0.2,
      kind: 'deck',
      material: 'stone',
    }
    const right: PlatformDefinition = {
      ...left,
      id: 'right',
      minX: 0.004,
      maxX: 1,
    }
    const position = { x: -0.001, y: 0, z: 0 }
    const displacement = { x: 0.006, y: -0.001, z: 0 }
    const ordinarySeam = FLAT_COURSE_COLLIDER.move(
      position,
      displacement,
      [left, right],
      MOVEMENT,
    )
    const markedGap = FLAT_COURSE_COLLIDER.move(
      position,
      displacement,
      [left, right],
      MOVEMENT,
      [
        {
          id: 'intentional-gap',
          minX: 0,
          maxX: 0.004,
          minZ: -1,
          maxZ: 1,
          top: 0,
        },
      ],
    )

    expect(ordinarySeam.support?.id).toBe('right')
    expect(ordinarySeam.position.y).toBe(0)
    expect(markedGap.support).toBeNull()
    expect(markedGap.position.y).toBeLessThan(0)
  })
})
