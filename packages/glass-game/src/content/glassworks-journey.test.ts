// Glassworks Journey tests — validate authored gates, camera joins and a complete optional-free traversal.

import { describe, expect, it } from 'vitest'
import { composeLevel } from '../authoring/compose-level'
import type { Bounds3, GameEvent, GlassGame, MovementInput } from '../contracts'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import { SHATTER_LIFECYCLE_SECONDS } from '../core/shatter-presentation'
import { ENCLOSED_CHAMBER_HALF, ENCLOSED_CHAMBER_ROOM, } from './enclosed-museum-kit'
import { GLASSWORKS } from './glassworks'
import { GLASSWORKS_JOURNEY, GLASSWORKS_JOURNEY_ROUTE, GLASSWORKS_JOURNEY_SOURCE, } from './glassworks-journey'
import { GLASSWORKS_JOURNEY_ARCHIVE_ROOM, GLASSWORKS_JOURNEY_AUTHORING_CATALOG, GLASSWORKS_JOURNEY_GARDEN_ROOM, GLASSWORKS_JOURNEY_PORTRAIT_ROOM, } from './glassworks-journey-kit'
import { MUSEUM_FRAMED_ART_INWARD_OFFSET } from './museum-room-dressings'

const idle: MovementInput = { moveX: 0, moveZ: 0, jumpDown: false }
const prefix = 'glassworks-journey/journey'
const ids = {
  vestibule: `${prefix}/vestibule/encounter/vestibule-goblet`,
  garden: `${prefix}/garden/encounter/garden-decanter`,
  archive: `${prefix}/archive/encounter/archive-carafe`,
  portrait: `${prefix}/portrait/encounter/portrait-finale`,
  gardenAmphora: `${prefix}/garden/encounter/garden-amphora`,
  gardenCoupe: `${prefix}/garden/encounter/garden-coupe`,
  archiveGlazing: `${prefix}/archive/encounter/archive-glazing`,
  panoramaAmphora: `${prefix}/panorama/encounter/panorama-amphora`,
  panoramaCoupe: `${prefix}/panorama/encounter/panorama-coupe`,
  vestibuleGate: `${prefix}/vestibule/solid/east-center-body`,
  gardenGate: `${prefix}/garden/solid/north-gate-body`,
  archiveGate: `${prefix}/archive/solid/north-gate-body`,
  portraitGate: `${prefix}/portrait/solid/north-gate-body`,
  vestibuleCheckpoint: `${prefix}/vestibule/checkpoint/arrival`,
  gardenCheckpoint: `${prefix}/garden/checkpoint/entry`,
  archiveCheckpoint: `${prefix}/archive/checkpoint/entry`,
  portraitCheckpoint: `${prefix}/portrait/checkpoint/entry`,
  panoramaCheckpoint: `${prefix}/panorama/checkpoint/panorama`,
} as const

const requiredIds = [
  ids.vestibule,
  ids.garden,
  ids.archive,
  ids.portrait,
] as const
const optionalIds = [
  ids.archiveGlazing,
  ids.gardenAmphora,
  ids.gardenCoupe,
  ids.panoramaAmphora,
  ids.panoramaCoupe,
] as const
const gateIds = [
  ids.vestibuleGate,
  ids.gardenGate,
  ids.archiveGate,
  ids.portraitGate,
] as const

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
    index < 5000 &&
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
  steps(game, Math.ceil(SHATTER_LIFECYCLE_SECONDS / MOVEMENT.fixedStep) + 1)
  expect(game.snapshot().phase).toBe('idle')
}

function roomCameraBounds(roomId: string): Bounds3 {
  const bounds = GLASSWORKS_JOURNEY.presentation?.rooms.find((room) =>
    room.id.includes(`/${roomId}/room/`),
  )?.cameraBounds
  expect(bounds, roomId).toBeDefined()
  return bounds!
}

function overlap(left: Bounds3, right: Bounds3, axis: 'x' | 'z'): number {
  const minKey = axis === 'x' ? 'minX' : 'minZ'
  const maxKey = axis === 'x' ? 'maxX' : 'maxZ'
  return (
    Math.min(left[maxKey], right[maxKey]) -
    Math.max(left[minKey], right[minKey])
  )
}

function passNorthGate(
  game: GlassGame,
  roomX: number,
  anchorZ: number,
  gateZ: number,
  encounterId: string,
  gateId: string,
): void {
  walkAxis(game, 'x', roomX + 1)
  moveFor(game, { ...idle, moveZ: 1 }, 700)
  expect(game.snapshot().player.position.z).toBeGreaterThan(gateZ - 0.7)
  expect(game.snapshot().player.position.z).toBeLessThan(gateZ - 0.15)
  walkAxis(game, 'z', anchorZ - 0.25)
  walkAxis(game, 'x', roomX)
  walkAxis(game, 'z', anchorZ)
  sing(game, encounterId)
  expect(game.snapshot().activeSolidIds).not.toContain(gateId)
  walkAxis(game, 'x', roomX + 1)
  walkAxis(game, 'z', gateZ + 0.65)
  walkAxis(game, 'x', roomX)
}

describe('Glassworks Journey blockout', () => {
  it('validates into a distinct stable level with four required and five optional exhibits', () => {
    expect(
      composeLevel(
        GLASSWORKS_JOURNEY_SOURCE,
        GLASSWORKS_JOURNEY_AUTHORING_CATALOG,
      ),
    ).toEqual(GLASSWORKS_JOURNEY)
    expect(GLASSWORKS_JOURNEY.id).toBe(prefix)
    expect(GLASSWORKS_JOURNEY.id).not.toBe(GLASSWORKS.id)
    expect(GLASSWORKS_JOURNEY.authored).toEqual({
      levelId: 'glassworks-journey',
      layoutId: 'journey',
      contentRevision: 3,
    })
    expect(GLASSWORKS_JOURNEY).toMatchObject({
      title: 'Glassworks Journey',
      guidance: {
        subtitle: 'From first light to open sky',
        completionNext: 'Take a moment. You made every gallery sing.',
      },
    })
    expect(GLASSWORKS_JOURNEY.movement).toEqual({
      walkSpeed: 1.55,
      runSpeed: 2.7,
      runDelaySeconds: 0.6,
      runRampSeconds: 0.8,
    })
    const authoredRequired = GLASSWORKS_JOURNEY.breakables
      .filter((item) => !item.optional)
      .map((item) => item.id)
    expect(authoredRequired).toHaveLength(requiredIds.length)
    expect(authoredRequired).toEqual(expect.arrayContaining([...requiredIds]))
    expect(
      GLASSWORKS_JOURNEY.breakables
        .filter((item) => item.optional)
        .map((item) => item.id),
    ).toEqual(optionalIds)
    expect(GLASSWORKS_JOURNEY.exit.requiresCompleted).toEqual([ids.portrait])
    expect(GLASSWORKS_JOURNEY.exit.requiresCompleted).not.toEqual(
      expect.arrayContaining([...optionalIds]),
    )
    expect(GLASSWORKS_JOURNEY.rewards).toMatchObject({
      revision: 1,
      grading: [
        {
          encounterId: ids.portrait,
          minimumReliableSeconds: 0.9,
          threeStarMaxMeanCents: 35,
          twoStarMaxMeanCents: 75,
        },
      ],
      portrait: {
        portraitId: 'glassworks-awakened-muse',
        imageAssetId: 'painting-portrait-v5',
        awardAfterEncounterId: ids.portrait,
      },
    })
    expect(GLASSWORKS_JOURNEY.rewards?.discoveries).toHaveLength(
      optionalIds.length,
    )
    expect(
      GLASSWORKS_JOURNEY.rewards?.discoveries.map((item) => item.encounterId),
    ).toEqual(expect.arrayContaining([...optionalIds]))
  })

  it('keeps every connected camera volume joined by at least 0.48m before clearance', () => {
    const route = [
      'vestibule',
      'window-east',
      'window-turn',
      'window-north',
      'garden',
      'garden-passage',
      'east-turn',
      'east-passage',
      'north-turn',
      'archive-approach',
      'archive',
      'portrait-passage',
      'portrait',
      'panorama-passage',
      'panorama',
      'panorama-camera',
    ]
    for (let index = 1; index < route.length; index++) {
      const previous = roomCameraBounds(route[index - 1])
      const next = roomCameraBounds(route[index])
      expect(
        overlap(previous, next, 'x'),
        `${route[index - 1]} → ${route[index]}`,
      ).toBeGreaterThanOrEqual(0.48)
      expect(
        overlap(previous, next, 'z'),
        `${route[index - 1]} → ${route[index]}`,
      ).toBeGreaterThanOrEqual(0.48)
    }
  })

  it('uses existing wall recipes with exact gate-only visual coverage', () => {
    const visuals = GLASSWORKS_JOURNEY.presentation?.visuals ?? []
    expect(visuals).toHaveLength(61)
    expect(
      visuals.filter((visual) => visual.recipeId === 'museum-window-v4'),
    ).toHaveLength(34)
    expect(
      visuals.filter((visual) => visual.recipeId === 'museum-screen-v4'),
    ).toHaveLength(27)

    const solids = new Map(
      (GLASSWORKS_JOURNEY.solids ?? []).map((solid) => [solid.id, solid]),
    )
    const covered = visuals.flatMap((visual) => visual.coveredSolidIds ?? [])
    expect(new Set(covered).size).toBe(covered.length)
    expect(covered.some((id) => id.endsWith('-seal'))).toBe(false)
    for (const id of covered) {
      const solid = solids.get(id)
      expect(solid, id).toBeDefined()
      expect(solid?.presentation ?? solid?.fallback, id).toBeDefined()
    }
    for (const gateId of gateIds)
      expect(
        visuals.find(
          (visual) => visual.coveredSolidIds?.includes(gateId) === true,
        )?.coveredSolidIds,
      ).toEqual([gateId])
  })

  it('authors distinct gallery dressings without blocking the continuous route', () => {
    const decorations = GLASSWORKS_JOURNEY.presentation?.decorations ?? []
    expect(decorations).toHaveLength(13)
    expect(
      decorations.filter((item) => item.recipeId === 'crystal-planter-v5'),
    ).toHaveLength(6)
    expect(
      decorations.filter((item) => item.recipeId === 'gallery-mirror-v5'),
    ).toHaveLength(2)
    expect(GLASSWORKS_JOURNEY.presentation?.floorArt).toHaveLength(16)

    const solids = new Map(
      (GLASSWORKS_JOURNEY.solids ?? []).map((solid) => [solid.id, solid]),
    )
    const covered = decorations.flatMap(
      (decoration) => decoration.coveredSolidIds ?? [],
    )
    expect(covered).toHaveLength(6)
    expect(new Set(covered).size).toBe(covered.length)
    for (const id of covered)
      expect(solids.get(id)).toMatchObject({
        shape: 'cylinder',
        radiusTop: 0.29,
        radiusBottom: 0.17,
        thickness: 0.48,
      })

    const gardenPlanters = decorations.filter(
      (item) =>
        item.recipeId === 'crystal-planter-v5' && item.id.includes('/garden/'),
    )
    expect(gardenPlanters).toHaveLength(4)
    for (const planter of gardenPlanters) {
      expect(
        Math.abs(planter.position.x - GLASSWORKS_JOURNEY_ROUTE.garden.x),
      ).toBeGreaterThan(3)
      expect(
        Math.abs(planter.position.x - GLASSWORKS_JOURNEY_ROUTE.garden.x),
      ).toBeLessThan(4)
    }
  })

  it('seats every framed decoration into the measured screen-bay surface', () => {
    const decorations = [
      ENCLOSED_CHAMBER_ROOM,
      GLASSWORKS_JOURNEY_GARDEN_ROOM,
      GLASSWORKS_JOURNEY_ARCHIVE_ROOM,
      GLASSWORKS_JOURNEY_PORTRAIT_ROOM,
    ].flatMap((room) =>
      (room.decorations ?? []).filter(
        (decoration) => decoration.recipeId !== 'crystal-planter-v5',
      ),
    )

    expect(decorations).toHaveLength(7)
    for (const decoration of decorations) {
      const inwardOffset =
        decoration.yaw === Math.PI
          ? ENCLOSED_CHAMBER_HALF - decoration.position.z
          : decoration.yaw === Math.PI / 2
            ? decoration.position.x + ENCLOSED_CHAMBER_HALF
            : ENCLOSED_CHAMBER_HALF - decoration.position.x
      expect(inwardOffset, decoration.id).toBeCloseTo(
        MUSEUM_FRAMED_ART_INWARD_OFFSET,
        12,
      )
      const frameRear = inwardOffset - 0.03839010372757912
      expect(-0.0783090591430664 - frameRear, decoration.id).toBeCloseTo(
        0.002,
        12,
      )
    }
  })

  it('blocks each fresh gate, opens the four required route beats and exits without optional exhibits', () => {
    const game = createGlassGame(GLASSWORKS_JOURNEY)
    expect(game.snapshot().activeSolidIds).toEqual(
      expect.arrayContaining([...gateIds]),
    )

    walkAxis(game, 'z', 0)
    moveFor(game, { ...idle, moveX: 1 }, 700)
    expect(game.snapshot().player.position.x).toBeGreaterThan(4)
    expect(game.snapshot().player.position.x).toBeLessThan(4.3)
    walkAxis(game, 'x', 0)
    walkAxis(game, 'z', -0.05)
    sing(game, ids.vestibule)
    expect(game.snapshot().activeSolidIds).not.toContain(ids.vestibuleGate)

    walkAxis(game, 'z', 0)
    walkAxis(game, 'x', GLASSWORKS_JOURNEY_ROUTE.windowTurn.x)
    walkAxis(game, 'z', GLASSWORKS_JOURNEY_ROUTE.garden.z - 0.05)
    expect(game.snapshot().checkpointId).toBe(ids.gardenCheckpoint)
    passNorthGate(
      game,
      GLASSWORKS_JOURNEY_ROUTE.garden.x,
      GLASSWORKS_JOURNEY_ROUTE.garden.z - 0.05,
      GLASSWORKS_JOURNEY_ROUTE.garden.z + ENCLOSED_CHAMBER_HALF,
      ids.garden,
      ids.gardenGate,
    )

    walkAxis(game, 'z', GLASSWORKS_JOURNEY_ROUTE.eastTurn.z)
    walkAxis(game, 'x', GLASSWORKS_JOURNEY_ROUTE.northTurn.x)
    walkAxis(game, 'z', GLASSWORKS_JOURNEY_ROUTE.archive.z - 0.05)
    expect(game.snapshot().checkpointId).toBe(ids.archiveCheckpoint)
    passNorthGate(
      game,
      GLASSWORKS_JOURNEY_ROUTE.archive.x,
      GLASSWORKS_JOURNEY_ROUTE.archive.z - 0.05,
      GLASSWORKS_JOURNEY_ROUTE.archive.z + ENCLOSED_CHAMBER_HALF,
      ids.archive,
      ids.archiveGate,
    )

    walkAxis(game, 'z', GLASSWORKS_JOURNEY_ROUTE.portrait.z - 0.05)
    expect(game.snapshot().checkpointId).toBe(ids.portraitCheckpoint)
    passNorthGate(
      game,
      GLASSWORKS_JOURNEY_ROUTE.portrait.x,
      GLASSWORKS_JOURNEY_ROUTE.portrait.z - 0.05,
      GLASSWORKS_JOURNEY_ROUTE.portrait.z + ENCLOSED_CHAMBER_HALF,
      ids.portrait,
      ids.portraitGate,
    )

    const completionEvents: GameEvent[] = []
    for (let index = 0; index < 2400 && !game.snapshot().complete; index++)
      completionEvents.push(
        ...game.step({ ...idle, moveZ: 1 }, MOVEMENT.fixedStep),
      )
    expect(completionEvents).toContainEqual({ type: 'complete' })
    expect(game.snapshot().complete).toBe(true)
    expect(game.snapshot().checkpointId).toBe(ids.panoramaCheckpoint)
    expect(game.saveProgress().completedBreakableIds).toEqual(requiredIds)
    for (const optionalId of optionalIds)
      expect(game.saveProgress().completedBreakableIds).not.toContain(
        optionalId,
      )
  })

  it('keeps all five optional anchors physically reachable outside the main route', () => {
    const garden = createGlassGame(GLASSWORKS_JOURNEY, {
      version: 1,
      levelId: prefix,
      checkpointId: ids.gardenCheckpoint,
      completedBreakableIds: [ids.vestibule],
      finished: false,
    })
    walkAxis(garden, 'z', GLASSWORKS_JOURNEY_ROUTE.garden.z - 0.6)
    walkAxis(garden, 'x', GLASSWORKS_JOURNEY_ROUTE.garden.x - 1.8)
    walkAxis(garden, 'z', GLASSWORKS_JOURNEY_ROUTE.garden.z + 1.15)
    expect(garden.snapshot().nearbyBreakableId).toBe(ids.gardenAmphora)
    walkAxis(garden, 'z', GLASSWORKS_JOURNEY_ROUTE.garden.z - 0.6)
    walkAxis(garden, 'x', GLASSWORKS_JOURNEY_ROUTE.garden.x + 1.8)
    walkAxis(garden, 'z', GLASSWORKS_JOURNEY_ROUTE.garden.z + 1.15)
    expect(garden.snapshot().nearbyBreakableId).toBe(ids.gardenCoupe)

    const archive = createGlassGame(GLASSWORKS_JOURNEY, {
      version: 1,
      levelId: prefix,
      checkpointId: ids.archiveCheckpoint,
      completedBreakableIds: [ids.vestibule, ids.garden],
      finished: false,
    })
    walkAxis(archive, 'x', GLASSWORKS_JOURNEY_ROUTE.archive.x - 1.8)
    walkAxis(archive, 'z', GLASSWORKS_JOURNEY_ROUTE.archive.z + 1.15)
    expect(archive.snapshot().nearbyBreakableId).toBe(ids.archiveGlazing)

    const panorama = createGlassGame(GLASSWORKS_JOURNEY, {
      version: 1,
      levelId: prefix,
      checkpointId: ids.panoramaCheckpoint,
      completedBreakableIds: [...requiredIds],
      finished: false,
    })
    walkAxis(panorama, 'z', GLASSWORKS_JOURNEY_ROUTE.panorama.z + 2.55)
    walkAxis(panorama, 'x', GLASSWORKS_JOURNEY_ROUTE.panorama.x - 1.55)
    expect(panorama.snapshot().nearbyBreakableId).toBe(ids.panoramaAmphora)
    walkAxis(panorama, 'x', GLASSWORKS_JOURNEY_ROUTE.panorama.x + 1.55)
    expect(panorama.snapshot().nearbyBreakableId).toBe(ids.panoramaCoupe)
    expect(panorama.snapshot().complete).toBe(false)
  })

  it('restores chapter checkpoints and only the gates earned by stable progress IDs', () => {
    const restored = createGlassGame(GLASSWORKS_JOURNEY, {
      version: 1,
      levelId: prefix,
      checkpointId: ids.archiveCheckpoint,
      completedBreakableIds: [ids.vestibule, ids.garden],
      finished: false,
    })
    expect(restored.snapshot().activeSolidIds).not.toContain(ids.vestibuleGate)
    expect(restored.snapshot().activeSolidIds).not.toContain(ids.gardenGate)
    expect(restored.snapshot().activeSolidIds).toEqual(
      expect.arrayContaining([ids.archiveGate, ids.portraitGate]),
    )
    expect(restored.snapshot().player.position).toMatchObject({
      x: GLASSWORKS_JOURNEY_ROUTE.archive.x,
      y: 0,
      z: GLASSWORKS_JOURNEY_ROUTE.archive.z - 2.8,
    })
  })

  it('rejects chapter checkpoints restored before their preceding route beat', () => {
    const chapters = [
      [ids.gardenCheckpoint, ids.vestibule, []],
      [ids.archiveCheckpoint, ids.garden, [ids.vestibule]],
      [ids.portraitCheckpoint, ids.archive, [ids.vestibule, ids.garden]],
      [
        ids.panoramaCheckpoint,
        ids.portrait,
        [ids.vestibule, ids.garden, ids.archive],
      ],
    ] as const

    for (const [
      checkpointId,
      prerequisiteId,
      completedBreakableIds,
    ] of chapters) {
      expect(
        GLASSWORKS_JOURNEY.checkpoints.find(
          (checkpoint) => checkpoint.id === checkpointId,
        )?.requiresCompleted,
      ).toEqual([prerequisiteId])

      const restored = createGlassGame(GLASSWORKS_JOURNEY, {
        version: 1,
        levelId: prefix,
        checkpointId,
        completedBreakableIds: [...completedBreakableIds],
        finished: false,
      })
      expect(restored.snapshot().checkpointId).toBe(ids.vestibuleCheckpoint)
      expect(restored.snapshot().player.position).toEqual(
        GLASSWORKS_JOURNEY.spawn.position,
      )
    }
  })
})
