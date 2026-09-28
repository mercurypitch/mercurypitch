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

function edgeLandingLevel(
  spawn: Vec3,
  platforms: readonly PlatformDefinition[],
  intentionalGaps: LevelDefinition['intentionalGaps'] = [],
): LevelDefinition {
  return {
    id: 'edge-landing-fixture',
    title: 'Edge landing fixture',
    spawn: { position: spawn, facingYaw: 0 },
    platforms,
    intentionalGaps,
    checkpoints: [],
    breakables: [],
    exit: {
      minX: 10,
      maxX: 11,
      minZ: 10,
      maxZ: 11,
      top: 1,
      requiresCompleted: [],
    },
    fallBelow: -2,
  }
}

function settleAt(
  level: LevelDefinition,
  framesPerSecond: 30 | 60,
): ReturnType<ReturnType<typeof createGlassGame>['snapshot']> {
  const game = createGlassGame(level)
  const input = { moveX: 0, moveZ: 0, jumpDown: false }
  for (let frame = 0; frame < framesPerSecond / 2; frame++)
    game.step(input, 1 / framesPerSecond)
  return game.snapshot()
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

  it.each([30, 60] as const)(
    'separates a descending circular body from an overlapped platform side at %dHz',
    (framesPerSecond) => {
      const landing: PlatformDefinition = {
        id: 'landing',
        minX: 0,
        maxX: 1,
        minZ: -1,
        maxZ: 1,
        top: 0,
        thickness: 0.2,
        kind: 'deck',
        material: 'stone',
      }
      const spawn = { x: -MOVEMENT.radius / 2, y: 0.04, z: 0 }
      const snapshot = settleAt(
        edgeLandingLevel(spawn, [landing]),
        framesPerSecond,
      )

      expect(spawn.x).toBeLessThan(landing.minX)
      expect(spawn.x + MOVEMENT.radius).toBeGreaterThan(landing.minX)
      expect(snapshot.player.grounded).toBe(false)
      expect(snapshot.player.position.x).toBeCloseTo(
        landing.minX - MOVEMENT.radius,
      )
      expect(snapshot.player.position.x + MOVEMENT.radius).toBeLessThanOrEqual(
        landing.minX,
      )
      expect(snapshot.player.position.y).toBeLessThan(landing.top)
      expect(snapshot.player.supportPlatformId).toBeNull()
    },
  )

  it.each([30, 60] as const)(
    'still lands when the descending foot centre reaches the platform top at %dHz',
    (framesPerSecond) => {
      const landing: PlatformDefinition = {
        id: 'landing',
        minX: 0,
        maxX: 1,
        minZ: -1,
        maxZ: 1,
        top: 0,
        thickness: 0.2,
        kind: 'deck',
        material: 'stone',
      }
      const snapshot = settleAt(
        edgeLandingLevel({ x: 0.01, y: 0.04, z: 0 }, [landing]),
        framesPerSecond,
      )

      expect(snapshot.player.grounded).toBe(true)
      expect(snapshot.player.position.y).toBe(landing.top)
      expect(snapshot.player.supportPlatformId).toBe(landing.id)
    },
  )

  it.each([30, 60] as const)(
    'does not turn a marked same-height gap into body-width support at %dHz',
    (framesPerSecond) => {
      const left: PlatformDefinition = {
        id: 'left',
        minX: -1,
        maxX: -0.05,
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
        minX: 0.05,
        maxX: 1,
      }
      const snapshot = settleAt(
        edgeLandingLevel(
          { x: 0, y: 0.04, z: 0 },
          [left, right],
          [
            {
              id: 'marked-gap',
              minX: -0.05,
              maxX: 0.05,
              minZ: -1,
              maxZ: 1,
              top: 0,
            },
          ],
        ),
        framesPerSecond,
      )

      expect(snapshot.player.grounded).toBe(false)
      expect(snapshot.player.position.x).toBe(0)
      expect(snapshot.player.position.y).toBeLessThan(0)
      expect(snapshot.player.supportPlatformId).toBeNull()
    },
  )

  it.each([30, 60] as const)(
    'separates from the far side of a marked gap wider than the body at %dHz',
    (framesPerSecond) => {
      const departure: PlatformDefinition = {
        id: 'departure',
        minX: -1,
        maxX: -0.6,
        minZ: -1,
        maxZ: 1,
        top: 0,
        thickness: 0.2,
        kind: 'deck',
        material: 'stone',
      }
      const landing: PlatformDefinition = {
        ...departure,
        id: 'landing',
        minX: 0,
        maxX: 1,
      }
      const snapshot = settleAt(
        edgeLandingLevel(
          { x: -MOVEMENT.radius / 2, y: 0.04, z: 0 },
          [departure, landing],
          [
            {
              id: 'wide-gap',
              minX: -0.6,
              maxX: 0,
              minZ: -1,
              maxZ: 1,
              top: 0,
            },
          ],
        ),
        framesPerSecond,
      )

      expect(snapshot.player.grounded).toBe(false)
      expect(snapshot.player.position.x).toBeCloseTo(
        landing.minX - MOVEMENT.radius,
      )
      expect(snapshot.player.position.x + MOVEMENT.radius).toBeLessThanOrEqual(
        landing.minX,
      )
      expect(snapshot.player.position.y).toBeLessThan(landing.top)
    },
  )
})

describe('convex platform contact', () => {
  const polygon = [
    { x: -1, z: 0 },
    { x: -0.5, z: -0.866 },
    { x: 0.5, z: -0.866 },
    { x: 1, z: 0 },
    { x: 0.5, z: 0.866 },
    { x: -0.5, z: 0.866 },
  ] as const
  const platform: PlatformDefinition = {
    id: 'hex',
    minX: -1,
    maxX: 1,
    minZ: -0.866,
    maxZ: 0.866,
    supportPolygon: polygon,
    top: 0,
    thickness: 0.48,
    kind: 'deck',
    material: 'stone',
  }

  const translatedPolygonPlatform = (
    id: string,
    offsetX: number,
  ): PlatformDefinition => ({
    ...platform,
    id,
    minX: platform.minX + offsetX,
    maxX: platform.maxX + offsetX,
    supportPolygon: polygon.map((point) => ({
      x: point.x + offsetX,
      z: point.z,
    })),
  })

  it.each([30, 60] as const)(
    'lands on the measured hex but not its empty AABB corner at %dHz',
    (framesPerSecond) => {
      const supported = settleAt(
        edgeLandingLevel({ x: 0.65, y: 0.04, z: 0.4 }, [platform]),
        framesPerSecond,
      )
      const corner = settleAt(
        edgeLandingLevel({ x: 0.82, y: 0.04, z: 0.5 }, [platform]),
        framesPerSecond,
      )

      expect(supported.player.grounded).toBe(true)
      expect(supported.player.supportPlatformId).toBe(platform.id)
      expect(corner.player.grounded).toBe(false)
      expect(corner.player.position.y).toBeLessThan(platform.top)
      expect(corner.player.supportPlatformId).toBeNull()
    },
  )

  it('sweeps a body across the whole polygon without tunnelling at high displacement', () => {
    const result = FLAT_COURSE_COLLIDER.move(
      { x: -2, y: -0.2, z: 0.4 },
      { x: 4, y: 0, z: 0 },
      [platform],
      MOVEMENT,
    )

    expect(result.blockedX).toBe(true)
    expect(result.position.x).toBeLessThan(-0.5)
    expect(result.position.x + MOVEMENT.radius).toBeLessThanOrEqual(-0.5)
  })

  it('keeps a shortened rectangle-to-polygon sweep at the nearest contact in either solid order', () => {
    const farRectangle: PlatformDefinition = {
      ...platform,
      id: 'far-rectangle',
      minX: 1.2,
      maxX: 1.8,
      minZ: -0.5,
      maxZ: 0.5,
      supportPolygon: undefined,
    }
    const move = (solids: readonly PlatformDefinition[]) =>
      FLAT_COURSE_COLLIDER.move(
        { x: -3, y: -0.2, z: 0 },
        { x: 6, y: 0, z: 0 },
        solids,
        MOVEMENT,
      )
    const farFirst = move([farRectangle, platform])
    const nearFirst = move([platform, farRectangle])

    expect(farFirst.position.x).toBeCloseTo(-1 - MOVEMENT.radius, 8)
    expect(farFirst.position.x).toBeCloseTo(nearFirst.position.x, 10)
    expect(farFirst.blockedX).toBe(true)
    expect(nearFirst.blockedX).toBe(true)
  })

  it('keeps a shortened polygon-to-polygon sweep at the nearest contact in either solid order', () => {
    const farPolygon = translatedPolygonPlatform('far-hex', 2)
    const move = (solids: readonly PlatformDefinition[]) =>
      FLAT_COURSE_COLLIDER.move(
        { x: -3, y: -0.2, z: 0 },
        { x: 6, y: 0, z: 0 },
        solids,
        MOVEMENT,
      )
    const farFirst = move([farPolygon, platform])
    const nearFirst = move([platform, farPolygon])

    expect(farFirst.position.x).toBeCloseTo(-1 - MOVEMENT.radius, 8)
    expect(farFirst.position.x).toBeCloseTo(nearFirst.position.x, 10)
    expect(farFirst.blockedX).toBe(true)
    expect(nearFirst.blockedX).toBe(true)
  })

  it('separates a missed diagonal landing from the physical edge', () => {
    const result = FLAT_COURSE_COLLIDER.move(
      { x: 0.82, y: 0.04, z: 0.5 },
      { x: 0, y: -0.08, z: 0 },
      [platform],
      MOVEMENT,
    )

    expect(result.support).toBeNull()
    expect(result.position.y).toBeLessThan(0)
    expect(result.position.x).toBeGreaterThan(0.82)
    expect(result.position.z).toBeGreaterThan(0.5)
  })
})
