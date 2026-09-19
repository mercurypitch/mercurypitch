// Foundation route tests — both prefab placements remain playable through real controls and held notes.

import { describe, expect, it } from 'vitest'
import type { GameEvent, GlassGame, LevelDefinition, MovementInput, } from '../contracts'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import { FOUNDATION_QUARTER_TURN_SOURCE, FOUNDATION_STRAIGHT_SOURCE, GLASS_FOUNDATION_QUARTER_TURN, GLASS_FOUNDATION_STRAIGHT, } from './foundation-routes'

const idle: MovementInput = { moveX: 0, moveZ: 0, jumpDown: false }

function steps(game: GlassGame, count: number): GameEvent[] {
  const events: GameEvent[] = []
  for (let index = 0; index < count; index++)
    events.push(...game.step(idle, MOVEMENT.fixedStep))
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
    index < 2000 &&
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
  expect(game.snapshot().phase).toBe('shattering')
  steps(game, Math.ceil(1.4 / MOVEMENT.fixedStep) + 1)
  expect(game.snapshot().phase).toBe('idle')
}

function walkIntoExit(
  game: GlassGame,
  axis: 'x' | 'z',
  direction: -1 | 1,
): void {
  const input: MovementInput = {
    ...idle,
    moveX: axis === 'x' ? direction : 0,
    moveZ: axis === 'z' ? direction : 0,
  }
  const events: GameEvent[] = []
  for (let index = 0; index < 300 && !game.snapshot().complete; index++)
    events.push(...game.step(input, MOVEMENT.fixedStep))
  expect(events.filter((event) => event.type === 'complete')).toHaveLength(1)
  expect(game.snapshot().complete).toBe(true)
}

function ids(level: LevelDefinition): {
  first: string
  second: string
  optional: string
  gate: string
} {
  const prefix = level.id
  return {
    first: `${prefix}/arrival/encounter/arrival-goblet`,
    second: `${prefix}/gallery/encounter/gallery-decanter`,
    optional: `${prefix}/gallery/encounter/gallery-optional`,
    gate: `${prefix}/connection/gate/arrival-gate`,
  }
}

describe('foundation proof routes', () => {
  it('compiles one room kit into straight and quarter-turn layouts with distinct audio regions', () => {
    expect(
      FOUNDATION_STRAIGHT_SOURCE.rooms.map((room) => room.prefabId),
    ).toEqual(['foundation-gallery', 'foundation-gallery'])
    expect(
      FOUNDATION_QUARTER_TURN_SOURCE.rooms.map((room) => room.prefabId),
    ).toEqual(['foundation-gallery', 'foundation-gallery'])
    expect(GLASS_FOUNDATION_STRAIGHT.presentation?.audioRegions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringContaining('/arrival/audio/'),
          sceneId: 'museum',
        }),
        expect.objectContaining({
          id: expect.stringContaining('/gallery/audio/'),
          sceneId: 'gallery',
        }),
      ]),
    )
    expect(
      GLASS_FOUNDATION_QUARTER_TURN.presentation?.rooms
        .find((room) => room.id.includes('/gallery/'))
        ?.ports?.find((port) => port.id.endsWith('/north')),
    ).toMatchObject({
      position: { x: 9, y: 0, z: 0 },
      facingYaw: -Math.PI / 2,
    })
    expect(GLASS_FOUNDATION_QUARTER_TURN.presentation?.visuals).toEqual([])
    expect(GLASS_FOUNDATION_QUARTER_TURN.presentation?.assetRecipeIds).toEqual([
      'decanter',
      'deck',
      'goblet',
    ])
  })

  it('walks, sings and exits the straight route while leaving its side exhibit optional', () => {
    const level = GLASS_FOUNDATION_STRAIGHT
    const route = ids(level)
    const blocked = createGlassGame(level)
    walkAxis(blocked, 'x', 1)
    walkAxis(blocked, 'z', 2.5)
    walkAxis(blocked, 'x', 0)
    for (let index = 0; index < 300; index++)
      blocked.step({ ...idle, moveZ: 1 }, MOVEMENT.fixedStep)
    const game = createGlassGame(level)

    expect(blocked.snapshot().player.position.z).toBeLessThan(2.9)
    expect(game.snapshot().activeSolidIds).toContain(route.gate)
    walkAxis(game, 'z', 0.45)
    sing(game, route.first)
    expect(game.snapshot().activeSolidIds).not.toContain(route.gate)
    walkAxis(game, 'x', 1)
    walkAxis(game, 'z', 2.5)
    walkAxis(game, 'x', 0)
    walkAxis(game, 'z', 5.8)
    walkAxis(game, 'x', 1.25)
    walkAxis(game, 'z', 6.25)
    sing(game, route.second)
    walkAxis(game, 'z', 6.4)
    walkAxis(game, 'x', 0)
    walkAxis(game, 'z', 8)
    walkIntoExit(game, 'z', 1)

    expect(game.saveProgress().completedBreakableIds).toEqual([
      route.first,
      route.second,
    ])
    expect(game.saveProgress().completedBreakableIds).not.toContain(
      route.optional,
    )
  })

  it('walks, turns and exits the quarter-turn route through the same encounter rules', () => {
    const level = GLASS_FOUNDATION_QUARTER_TURN
    const route = ids(level)
    const game = createGlassGame(level)

    expect(game.snapshot().activeSolidIds).toContain(route.gate)
    walkAxis(game, 'x', -1.25)
    walkAxis(game, 'z', 0.25)
    sing(game, route.first)
    expect(game.snapshot().activeSolidIds).not.toContain(route.gate)
    walkAxis(game, 'z', 0)
    walkAxis(game, 'x', 6.45)
    sing(game, route.second)
    walkAxis(game, 'z', 0.8)
    walkAxis(game, 'x', 8)
    walkAxis(game, 'z', 0)
    walkIntoExit(game, 'x', 1)

    expect(game.saveProgress().completedBreakableIds).toEqual([
      route.first,
      route.second,
    ])
    expect(game.saveProgress().completedBreakableIds).not.toContain(
      route.optional,
    )
  })
})
