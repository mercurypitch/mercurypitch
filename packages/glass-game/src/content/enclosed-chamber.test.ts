// Enclosed chamber tests — exact wall apertures, camera joins and both held-note gates stay playable.

import { describe, expect, it } from 'vitest'
import type { Bounds3, GameEvent, GlassGame, MovementInput, SolidPropDefinition, } from '../contracts'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import { ENCLOSED_CHAMBER_SOURCE, GLASS_ENCLOSED_CHAMBER, } from './enclosed-chamber'
import { ENCLOSED_CHAMBER_BAY_CENTER, ENCLOSED_CHAMBER_ROOM, } from './enclosed-museum-kit'
import { MUSEUM_WALL_TOP, MUSEUM_WINDOW_APERTURE_HALF_WIDTH, MUSEUM_WINDOW_LINTEL_BOTTOM, MUSEUM_WINDOW_SILL_TOP, } from './enclosed-wall-kit'
import { GLASSWORKS } from './glassworks'

const idle: MovementInput = { moveX: 0, moveZ: 0, jumpDown: false }
const prefix = 'glassworks-chamber/chamber'
const ids = {
  first: `${prefix}/chamber/encounter/threshold-goblet`,
  optional: `${prefix}/chamber/encounter/window-coupe`,
  second: `${prefix}/reveal/encounter/passage-decanter`,
  firstGate: `${prefix}/chamber/solid/east-center-body`,
  secondGate: `${prefix}/reveal/solid/north-gate-body`,
  arrival: `${prefix}/chamber/checkpoint/arrival`,
  reveal: `${prefix}/reveal/checkpoint/entry`,
} as const

function steps(game: GlassGame, count: number): GameEvent[] {
  const events: GameEvent[] = []
  for (let index = 0; index < count; index++)
    events.push(...game.step(idle, MOVEMENT.fixedStep))
  return events
}

function moveFor(
  game: GlassGame,
  input: MovementInput,
  count: number,
): GameEvent[] {
  const events: GameEvent[] = []
  for (let index = 0; index < count; index++)
    events.push(...game.step(input, MOVEMENT.fixedStep))
  steps(game, 24)
  return events
}

function walkAxis(game: GlassGame, axis: 'x' | 'z', destination: number): void {
  const direction = Math.sign(
    destination - game.snapshot().player.position[axis],
  )
  const input: MovementInput = {
    ...idle,
    moveX: axis === 'x' ? direction : 0,
    moveZ: axis === 'z' ? direction : 0,
  }
  for (
    let index = 0;
    index < 2600 &&
    direction * (destination - game.snapshot().player.position[axis]) > 0;
    index++
  ) {
    expect(
      game
        .step(input, MOVEMENT.fixedStep)
        .some((event) => event.type === 'respawn'),
    ).toBe(false)
  }
  expect(
    direction * (destination - game.snapshot().player.position[axis]),
  ).toBeLessThanOrEqual(0)
  steps(game, 24)
}

function sing(game: GlassGame, encounterId: string): void {
  expect(game.snapshot().nearbyBreakableId).toBe(encounterId)
  expect(game.beginEncounter(encounterId, 57)).toBe(true)
  const events: GameEvent[] = []
  for (let sequence = 0; sequence <= 48; sequence++) {
    const capturedAtMs = sequence * 25
    events.push(
      ...game.feedPitch(
        {
          sequence,
          captureSeconds: capturedAtMs / 1000,
          capturedAtMs,
          midi: 57,
          confidence: 0.9,
        },
        capturedAtMs,
      ),
    )
  }
  expect(events).toContainEqual({ type: 'break', id: encounterId })
  steps(game, Math.ceil(1.4 / MOVEMENT.fixedStep) + 1)
  expect(game.snapshot().phase).toBe('idle')
}

function expectBounds(actual: Bounds3 | undefined, expected: Bounds3): void {
  expect(actual).toBeDefined()
  for (const key of ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ'] as const)
    expect(actual![key]).toBeCloseTo(expected[key], 12)
}

function cameraBounds(roomId: string): Bounds3 | undefined {
  return GLASS_ENCLOSED_CHAMBER.presentation?.rooms.find((room) =>
    room.id.includes(`/${roomId}/room/`),
  )?.cameraBounds
}

function overlap(left: Bounds3, right: Bounds3, axis: 'x' | 'z'): number {
  const minKey = axis === 'x' ? 'minX' : 'minZ'
  const maxKey = axis === 'x' ? 'maxX' : 'maxZ'
  return (
    Math.min(left[maxKey], right[maxKey]) -
    Math.max(left[minKey], right[minKey])
  )
}

describe('enclosed chamber content', () => {
  it('compiles a distinct level with 19 measured visual bays and exact solid coverage', () => {
    const level = GLASS_ENCLOSED_CHAMBER
    expect(level.id).toBe(prefix)
    expect(level.id).not.toBe(GLASSWORKS.id)
    expect(level.authored).toEqual({
      levelId: 'glassworks-chamber',
      layoutId: 'chamber',
      contentRevision: 4,
    })
    expect(level.spawn).toMatchObject({
      position: { x: 0, y: 0, z: -2.8 },
      checkpointId: ids.arrival,
    })
    expect(level.exit).toMatchObject({
      minZ: 12.549835195541384,
      maxZ: 12.949835195541382,
      requiresCompleted: [ids.second],
    })

    const visuals = level.presentation?.visuals ?? []
    expect(visuals).toHaveLength(19)
    expect(
      visuals.filter((visual) => visual.recipeId === 'museum-window-v4'),
    ).toHaveLength(11)
    expect(
      visuals.filter((visual) => visual.recipeId === 'museum-screen-v4'),
    ).toHaveLength(8)

    const solids = new Map(
      (level.solids ?? []).map((solid) => [solid.id, solid]),
    )
    const covered = visuals.flatMap((visual) => visual.coveredSolidIds ?? [])
    expect(new Set(covered).size).toBe(covered.length)
    expect(covered.some((id) => id.endsWith('-seal'))).toBe(false)
    for (const id of covered) {
      const solid = solids.get(id)
      expect(solid, id).toBeDefined()
      expect(solid?.presentation ?? solid?.fallback, id).toBeDefined()
    }
    expect(
      visuals.find((visual) => visual.id.includes('/east-center'))
        ?.coveredSolidIds,
    ).toEqual([ids.firstGate])
    expect(
      visuals.find((visual) => visual.id.includes('/north-gate'))
        ?.coveredSolidIds,
    ).toEqual([ids.secondGate])
    expect(level.presentation?.decorations).toHaveLength(2)
    expect(level.presentation?.floorArt).toHaveLength(6)
    expect(
      level.presentation?.floorArt?.find((item) =>
        item.platformId.includes('/chamber/platform/floor'),
      ),
    ).toMatchObject({ recipeId: 'hero-petal', palette: 'neutral' })
  })

  it('keeps every window as four real collision pieces with an open central aperture', () => {
    const visual = ENCLOSED_CHAMBER_ROOM.visuals.find(
      (item) => item.id === 'south-west-window',
    )
    expect(visual?.coversSolidIds).toEqual([
      'south-west-window-left-jamb',
      'south-west-window-right-jamb',
      'south-west-window-sill',
      'south-west-window-lintel',
    ])
    const pieces = (visual?.coversSolidIds ?? []).map((id) =>
      ENCLOSED_CHAMBER_ROOM.solids.find((solid) => solid.id === id),
    )
    expect(pieces.every((solid) => solid?.shape === 'box')).toBe(true)

    const byId = new Map(
      pieces.map((solid) => [solid!.id, solid as SolidPropDefinition]),
    )
    expect(byId.get('south-west-window-sill')).toMatchObject({
      top: MUSEUM_WINDOW_SILL_TOP,
      thickness: MUSEUM_WINDOW_SILL_TOP,
    })
    expect(byId.get('south-west-window-lintel')).toMatchObject({
      top: MUSEUM_WALL_TOP,
      thickness: MUSEUM_WALL_TOP - MUSEUM_WINDOW_LINTEL_BOTTOM,
    })
    const centre = -ENCLOSED_CHAMBER_BAY_CENTER
    const fullHeightBarrier = pieces.some(
      (solid) =>
        solid?.shape === 'box' &&
        solid.minX <= centre - MUSEUM_WINDOW_APERTURE_HALF_WIDTH &&
        solid.maxX >= centre + MUSEUM_WINDOW_APERTURE_HALF_WIDTH &&
        solid.top === MUSEUM_WALL_TOP &&
        solid.thickness === MUSEUM_WALL_TOP,
    )
    expect(fullHeightBarrier).toBe(false)
  })

  it('publishes convex camera volumes with every route handoff overlapping by 0.72m', () => {
    const expected = {
      chamber: {
        minX: -4.266310536098481,
        maxX: 4.266310536098481,
        minY: 0,
        maxY: 3.44,
        minZ: -4.266310536098481,
        maxZ: 4.266310536098481,
      },
      entry: {
        minX: 3.546310536098481,
        maxX: 11.39592929201126,
        minY: 0,
        maxY: 3.44,
        minZ: -1.4201082198143005,
        maxZ: 1.4201082198143005,
      },
      corner: {
        minX: 10.675929292011261,
        maxX: 13.516145731639863,
        minY: 0,
        maxY: 3.44,
        minZ: -1.4201082198143005,
        maxZ: 1.4201082198143005,
      },
      reveal: {
        minX: 10.675929292011261,
        maxX: 13.516145731639863,
        minY: 0,
        maxY: 3.44,
        minZ: 0.7001082198143016,
        maxZ: 8.549726975727083,
      },
      terrace: {
        minX: 10.675929292011261,
        maxX: 13.516145731639863,
        minY: 0,
        maxY: 3.44,
        minZ: 7.829726975727082,
        maxZ: 11.44,
      },
      'terrace-panorama': {
        minX: 5.096037511825562,
        maxX: 19.09603751182556,
        minY: 0,
        maxY: 10,
        minZ: 10.72,
        maxZ: 16.249835195541383,
      },
    } satisfies Record<string, Bounds3>
    for (const [roomId, bounds] of Object.entries(expected))
      expectBounds(cameraBounds(roomId), bounds)

    expect(overlap(expected.chamber, expected.entry, 'x')).toBeCloseTo(0.72, 12)
    expect(overlap(expected.entry, expected.corner, 'x')).toBeCloseTo(0.72, 12)
    expect(overlap(expected.corner, expected.reveal, 'z')).toBeCloseTo(0.72, 12)
    expect(overlap(expected.reveal, expected.terrace, 'z')).toBeCloseTo(
      0.72,
      12,
    )
    expect(
      overlap(expected.terrace, expected['terrace-panorama'], 'z'),
    ).toBeCloseTo(0.72, 12)
  })

  it('blocks both fresh gates, earns the required holds and reaches the terrace without the optional coupe', () => {
    const game = createGlassGame(GLASS_ENCLOSED_CHAMBER)
    expect(game.snapshot().activeSolidIds).toEqual(
      expect.arrayContaining([ids.firstGate, ids.secondGate]),
    )

    walkAxis(game, 'z', 0)
    expect(
      moveFor(game, { ...idle, moveX: 1 }, 700).some(
        (event) => event.type === 'respawn',
      ),
    ).toBe(false)
    expect(game.snapshot().player.position.x).toBeGreaterThan(4)
    expect(game.snapshot().player.position.x).toBeLessThan(4.3)
    walkAxis(game, 'x', 0)
    walkAxis(game, 'z', -0.05)
    sing(game, ids.first)
    expect(game.snapshot().activeSolidIds).not.toContain(ids.firstGate)

    walkAxis(game, 'z', 0)
    walkAxis(game, 'x', 12.096037511825562)
    walkAxis(game, 'z', 2.624917597770692)
    expect(game.snapshot().checkpointId).toBe(ids.reveal)
    moveFor(game, { ...idle, moveZ: 1 }, 700)
    expect(game.snapshot().player.position.z).toBeGreaterThan(7)
    expect(game.snapshot().player.position.z).toBeLessThan(7.5)
    walkAxis(game, 'z', 5.424917597770692)
    sing(game, ids.second)
    expect(game.snapshot().activeSolidIds).not.toContain(ids.secondGate)

    const completionEvents: GameEvent[] = []
    for (let index = 0; index < 1200 && !game.snapshot().complete; index++)
      completionEvents.push(
        ...game.step({ ...idle, moveZ: 1 }, MOVEMENT.fixedStep),
      )
    expect(completionEvents).toContainEqual({ type: 'complete' })
    expect(game.snapshot().complete).toBe(true)
    expect(game.saveProgress().completedBreakableIds).toEqual([
      ids.first,
      ids.second,
    ])
    expect(game.saveProgress().completedBreakableIds).not.toContain(
      ids.optional,
    )
  })

  it('restores each earned screen independently from stable progress IDs', () => {
    const afterFirst = createGlassGame(GLASS_ENCLOSED_CHAMBER, {
      version: 1,
      levelId: prefix,
      checkpointId: ids.arrival,
      completedBreakableIds: [ids.first],
      finished: false,
    })
    expect(afterFirst.snapshot().activeSolidIds).not.toContain(ids.firstGate)
    expect(afterFirst.snapshot().activeSolidIds).toContain(ids.secondGate)

    const afterBoth = createGlassGame(GLASS_ENCLOSED_CHAMBER, {
      version: 1,
      levelId: prefix,
      checkpointId: ids.reveal,
      completedBreakableIds: [ids.first, ids.second],
      finished: false,
    })
    expect(afterBoth.snapshot().activeSolidIds).not.toContain(ids.firstGate)
    expect(afterBoth.snapshot().activeSolidIds).not.toContain(ids.secondGate)
    const restoredPosition = afterBoth.snapshot().player.position
    expect(restoredPosition.x).toBeCloseTo(12.096037511825562, 12)
    expect(restoredPosition.y).toBe(0)
    expect(restoredPosition.z).toBeCloseTo(2.624917597770692, 12)
  })

  it('keeps authored encounter and activation references explicit', () => {
    expect(ENCLOSED_CHAMBER_SOURCE.exhibits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'threshold-goblet', optional: false }),
        expect.objectContaining({ id: 'window-coupe', optional: true }),
        expect.objectContaining({
          id: 'passage-decanter',
          optional: false,
          requiresCompleted: ['threshold-goblet'],
        }),
      ]),
    )
    expect(ENCLOSED_CHAMBER_SOURCE.solidActivations).toEqual([
      {
        solid: 'chamber.east-center-body',
        activation: { noneCompleted: ['threshold-goblet'] },
        requiredForRoute: true,
      },
      {
        solid: 'reveal.north-gate-body',
        activation: { noneCompleted: ['passage-decanter'] },
        requiredForRoute: true,
      },
    ])
  })
})
