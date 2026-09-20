// Twin Galleries tests — validate the low/high teaching circuit, authored gates and optional-free traversal.

import { describe, expect, it } from 'vitest'
import { composeLevel } from '../authoring/compose-level'
import type { Bounds3, GameEvent, GlassGame, MovementInput, PitchTargetId, } from '../contracts'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import { ENCLOSED_CHAMBER_HALF } from './enclosed-museum-kit'
import { GLASSWORKS } from './glassworks'
import { TWIN_GALLERIES, TWIN_GALLERIES_PAIR_HOLD, TWIN_GALLERIES_ROUTE, TWIN_GALLERIES_SOURCE, } from './twin-galleries'
import { TWIN_GALLERIES_AUTHORING_CATALOG, TWIN_GALLERIES_COOL_ROOM, TWIN_GALLERIES_COURT_ROOM, TWIN_GALLERIES_V6_HANDOFF, TWIN_GALLERIES_WARM_ROOM, } from './twin-galleries-kit'

const idle: MovementInput = { moveX: 0, moveZ: 0, jumpDown: false }
const prefix = 'glassworks-twin-galleries/twin-galleries'
const ids = {
  lower: `${prefix}/warm/encounter/lower-urn`,
  lowerOptional: `${prefix}/warm/encounter/lower-coupe`,
  upper: `${prefix}/cool/encounter/upper-decanter`,
  upperOptional: `${prefix}/cool/encounter/upper-goblet`,
  bridgePair: `${prefix}/court/encounter/bridge-pair`,
  courtOptional: `${prefix}/court/encounter/court-echo`,
  portraitPair: `${prefix}/portrait/encounter/portrait-pair`,
  warmGate: `${prefix}/warm/solid/north-gate-body`,
  coolGate: `${prefix}/cool/solid/north-gate-body`,
  courtGate: `${prefix}/court/solid/north-gate-body`,
  harpBase: `${prefix}/court/solid/resonance-harp-base`,
  portraitGate: `${prefix}/portrait/solid/north-gate-body`,
  warmCheckpoint: `${prefix}/warm/checkpoint/entry`,
  coolCheckpoint: `${prefix}/cool/checkpoint/entry`,
  courtCheckpoint: `${prefix}/court/checkpoint/entry`,
  portraitCheckpoint: `${prefix}/portrait/checkpoint/entry`,
  panoramaCheckpoint: `${prefix}/panorama/checkpoint/panorama`,
} as const

const requiredIds = [
  ids.lower,
  ids.upper,
  ids.bridgePair,
  ids.portraitPair,
] as const
const optionalIds = [
  ids.lowerOptional,
  ids.upperOptional,
  ids.courtOptional,
] as const
const gateIds = [
  ids.warmGate,
  ids.coolGate,
  ids.courtGate,
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
    index < 9000 &&
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

function feedTarget(
  game: GlassGame,
  midi: number,
  startSequence: number,
  frameCount: number,
): GameEvent[] {
  const events: GameEvent[] = []
  for (let offset = 0; offset < frameCount; offset++) {
    const sequence = startSequence + offset
    const capturedAtMs = sequence * 25
    events.push(
      ...game.feedPitch(
        {
          sequence,
          captureSeconds: capturedAtMs / 1000,
          capturedAtMs,
          midi,
          confidence: 0.9,
        },
        capturedAtMs,
      ),
    )
  }
  return events
}

function sing(game: GlassGame, encounterId: string): void {
  expect(game.snapshot().nearbyBreakableId).toBe(encounterId)
  expect(game.beginEncounter(encounterId, { low: 55, high: 62 })).toBe(true)
  const challenge = TWIN_GALLERIES.breakables.find(
    (candidate) => candidate.id === encounterId,
  )?.challenge
  expect(challenge).toBeDefined()
  const stepsToSing =
    challenge?.kind === 'hold' ? [challenge.step] : (challenge?.steps ?? [])
  const events: GameEvent[] = []
  let sequence = 0
  for (const step of stepsToSing) {
    const midi = step.target === 'low' ? 55 : 62
    const frameCount = Math.ceil(step.hold.requiredSeconds / 0.025) + 1
    events.push(...feedTarget(game, midi, sequence, frameCount))
    sequence += frameCount
  }
  expect(events).toContainEqual({ type: 'break', id: encounterId })
  steps(game, Math.ceil(1.4 / MOVEMENT.fixedStep) + 1)
  expect(game.snapshot().phase).toBe('idle')
}

function roomCameraBounds(roomId: string): Bounds3 {
  const bounds = TWIN_GALLERIES.presentation?.rooms.find((room) =>
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

function targets(
  challenge: (typeof TWIN_GALLERIES.breakables)[number]['challenge'],
): PitchTargetId[] {
  return challenge.kind === 'hold'
    ? [challenge.step.target]
    : challenge.steps.map((step) => step.target)
}

describe('Twin Galleries blockout', () => {
  it('compiles into a distinct stable level with four required and three optional challenges', () => {
    expect(
      composeLevel(TWIN_GALLERIES_SOURCE, TWIN_GALLERIES_AUTHORING_CATALOG),
    ).toEqual(TWIN_GALLERIES)
    expect(TWIN_GALLERIES.id).toBe(prefix)
    expect(TWIN_GALLERIES.id).not.toBe(GLASSWORKS.id)
    expect(TWIN_GALLERIES.authored).toEqual({
      levelId: 'glassworks-twin-galleries',
      layoutId: 'twin-galleries',
      contentRevision: 1,
    })
    expect(TWIN_GALLERIES.guidance?.tutorial).toMatchObject({
      id: 'comfortable-pair',
      version: 1,
      pages: [{}, {}],
    })
    expect(TWIN_GALLERIES.guidance?.completionNext).toBe(
      'Return to the gallery map to choose what comes next.',
    )
    const authoredRequired = TWIN_GALLERIES.breakables
      .filter((item) => !item.optional)
      .map((item) => item.id)
    expect(authoredRequired).toHaveLength(requiredIds.length)
    expect(authoredRequired).toEqual(expect.arrayContaining([...requiredIds]))
    const authoredOptional = TWIN_GALLERIES.breakables
      .filter((item) => item.optional)
      .map((item) => item.id)
    expect(authoredOptional).toHaveLength(optionalIds.length)
    expect(authoredOptional).toEqual(expect.arrayContaining([...optionalIds]))
    expect(TWIN_GALLERIES.exit.requiresCompleted).toEqual([ids.portraitPair])
    expect(TWIN_GALLERIES.exit.requiresCompleted).not.toEqual(
      expect.arrayContaining([...optionalIds]),
    )

    const byId = new Map(
      TWIN_GALLERIES.breakables.map((item) => [item.id, item]),
    )
    expect(targets(byId.get(ids.lower)!.challenge)).toEqual(['low'])
    expect(targets(byId.get(ids.upper)!.challenge)).toEqual(['high'])
    expect(targets(byId.get(ids.bridgePair)!.challenge)).toEqual([
      'low',
      'high',
    ])
    expect(targets(byId.get(ids.portraitPair)!.challenge)).toEqual([
      'low',
      'high',
    ])
    expect(targets(byId.get(ids.lowerOptional)!.challenge)).toEqual(['low'])
    expect(targets(byId.get(ids.upperOptional)!.challenge)).toEqual(['high'])
    expect(targets(byId.get(ids.courtOptional)!.challenge)).toEqual([
      'low',
      'high',
    ])
    for (const item of TWIN_GALLERIES.breakables) {
      expect(targets(item.challenge)).not.toContain('comfortable')
      if (item.challenge.kind === 'ordered-pair') {
        expect(item.challenge.steps).toHaveLength(2)
        expect(item.challenge.wrongOrder).toBe('reset')
        expect(item.challenge.steps[0].hold).toEqual(TWIN_GALLERIES_PAIR_HOLD)
        expect(item.challenge.steps[1].hold).toEqual(TWIN_GALLERIES_PAIR_HOLD)
      }
    }
  })

  it('keeps all folded route camera volumes joined by at least 0.48m', () => {
    const route = [
      'warm',
      'warm-passage',
      'east-turn',
      'east-passage',
      'cool',
      'cool-passage',
      'north-turn',
      'listening-bridge',
      'court',
      'court-passage',
      'west-turn',
      'west-passage',
      'portrait',
      'portrait-west',
      'panorama-turn',
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

  it('uses exact gate-only visual coverage and V6 painting recipes', () => {
    const visuals = TWIN_GALLERIES.presentation?.visuals ?? []
    const solids = new Map(
      (TWIN_GALLERIES.solids ?? []).map((solid) => [solid.id, solid]),
    )
    const covered = visuals.flatMap((visual) => visual.coveredSolidIds ?? [])
    expect(new Set(covered).size).toBe(covered.length)
    expect(covered.some((id) => id.endsWith('-seal'))).toBe(false)
    for (const id of covered) {
      expect(solids.get(id), id).toBeDefined()
      expect(
        solids.get(id)?.presentation ?? solids.get(id)?.fallback,
        id,
      ).toBeDefined()
    }
    for (const gateId of gateIds)
      expect(
        visuals.find(
          (visual) => visual.coveredSolidIds?.includes(gateId) === true,
        )?.coveredSolidIds,
      ).toEqual([gateId])

    expect(
      TWIN_GALLERIES_WARM_ROOM.decorations?.find(
        (item) => item.id === 'low-note-study',
      )?.recipeId,
    ).toBe('low-note-painting-v6')
    expect(
      TWIN_GALLERIES_COOL_ROOM.decorations?.find(
        (item) => item.id === 'high-note-study',
      )?.recipeId,
    ).toBe('high-note-painting-v6')
    expect(TWIN_GALLERIES_COURT_ROOM.decorations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'interval-study',
          recipeId: 'interval-painting-v6',
        }),
        {
          id: 'resonance-harp',
          recipeId: 'twin-tone-harp-v6',
          position: { x: 2.95, y: 0, z: -0.2 },
          yaw: -Math.PI / 2,
          coversSolidIds: ['resonance-harp-base'],
        },
      ]),
    )
    expect(
      TWIN_GALLERIES_COURT_ROOM.solids.find(
        (solid) => solid.id === 'resonance-harp-base',
      ),
    ).toEqual({
      id: 'resonance-harp-base',
      kind: 'prop',
      shape: 'box',
      minX: 2.6,
      maxX: 3.3,
      minZ: -0.85,
      maxZ: 0.45,
      top: 0.24,
      thickness: 0.24,
      platformId: 'floor',
      presentation: { role: 'plinth', material: 'stone' },
    })
    expect(
      TWIN_GALLERIES.presentation?.decorations?.find((decoration) =>
        decoration.id.endsWith('/decoration/resonance-harp'),
      ),
    ).toMatchObject({
      recipeId: 'twin-tone-harp-v6',
      position: {
        x: TWIN_GALLERIES_ROUTE.court.x + 2.95,
        y: 0,
        z: TWIN_GALLERIES_ROUTE.court.z - 0.2,
      },
      yaw: -Math.PI / 2,
      coveredSolidIds: [ids.harpBase],
    })
    expect(TWIN_GALLERIES_V6_HANDOFF.exhibits).toMatchObject({
      'lower-urn': {
        currentPrefabId: 'glassworks-journey-amphora',
      },
      'upper-decanter': {
        currentPrefabId: 'glassworks-journey-fluted',
      },
    })
    expect(TWIN_GALLERIES_V6_HANDOFF.integratedExhibits).toEqual({
      'court-echo': {
        currentPrefabId: 'twin-galleries-opaline-echo',
        assetRecipeId: 'opaline-v6',
        source:
          'art/glass-adventure/v6-level2/exports/opaline-echo-amphora-fracture-v2.glb',
      },
    })
    expect(
      TWIN_GALLERIES.breakables.find((item) => item.id === ids.courtOptional),
    ).toMatchObject({
      id: ids.courtOptional,
      variant: 'opaline-v6',
      optional: true,
    })
    expect(TWIN_GALLERIES_AUTHORING_CATALOG.availableAssetRecipeIds).toEqual(
      expect.arrayContaining([
        'low-note-painting-v6',
        'high-note-painting-v6',
        'interval-painting-v6',
        'twin-tone-harp-v6',
        'opaline-v6',
      ]),
    )
  })

  it('keeps the harp base physical while leaving the court route clear', () => {
    const game = createGlassGame(TWIN_GALLERIES, {
      version: 1,
      levelId: prefix,
      checkpointId: ids.courtCheckpoint,
      completedBreakableIds: [ids.lower, ids.upper],
      finished: false,
    })
    walkAxis(game, 'z', TWIN_GALLERIES_ROUTE.court.z - 0.2)
    moveFor(game, { ...idle, moveX: 1 }, 900)
    expect(game.snapshot().activeSolidIds).toContain(ids.harpBase)
    expect(game.snapshot().player.position.x).toBeGreaterThan(
      TWIN_GALLERIES_ROUTE.court.x + 2,
    )
    expect(game.snapshot().player.position.x).toBeLessThan(
      TWIN_GALLERIES_ROUTE.court.x + 2.6,
    )
  })

  it('blocks each fresh gate, opens four required beats and exits without optional exhibits', () => {
    const game = createGlassGame(TWIN_GALLERIES)
    expect(game.snapshot().activeSolidIds).toEqual(
      expect.arrayContaining([...gateIds]),
    )

    walkAxis(game, 'x', 1)
    moveFor(game, { ...idle, moveZ: 1 }, 700)
    expect(game.snapshot().player.position.z).toBeGreaterThan(
      ENCLOSED_CHAMBER_HALF - 0.7,
    )
    expect(game.snapshot().player.position.z).toBeLessThan(
      ENCLOSED_CHAMBER_HALF - 0.15,
    )
    walkAxis(game, 'z', -0.05)
    walkAxis(game, 'x', 0)
    sing(game, ids.lower)
    expect(game.snapshot().activeSolidIds).not.toContain(ids.warmGate)

    walkAxis(game, 'x', 1)
    walkAxis(game, 'z', TWIN_GALLERIES_ROUTE.eastTurn.z)
    walkAxis(game, 'x', TWIN_GALLERIES_ROUTE.cool.x - 0.05)
    walkAxis(game, 'z', TWIN_GALLERIES_ROUTE.cool.z)
    expect(game.snapshot().checkpointId).toBe(ids.coolCheckpoint)
    walkAxis(game, 'z', TWIN_GALLERIES_ROUTE.cool.z + 1)
    moveFor(game, { ...idle, moveX: 1 }, 700)
    expect(game.snapshot().player.position.x).toBeGreaterThan(
      TWIN_GALLERIES_ROUTE.cool.x + ENCLOSED_CHAMBER_HALF - 0.7,
    )
    expect(game.snapshot().player.position.x).toBeLessThan(
      TWIN_GALLERIES_ROUTE.cool.x + ENCLOSED_CHAMBER_HALF + 0.7,
    )
    walkAxis(game, 'x', TWIN_GALLERIES_ROUTE.cool.x - 0.05)
    walkAxis(game, 'z', TWIN_GALLERIES_ROUTE.cool.z)
    sing(game, ids.upper)
    expect(game.snapshot().activeSolidIds).not.toContain(ids.coolGate)

    walkAxis(game, 'z', TWIN_GALLERIES_ROUTE.cool.z + 1)
    walkAxis(game, 'x', TWIN_GALLERIES_ROUTE.northTurn.x)
    walkAxis(game, 'z', TWIN_GALLERIES_ROUTE.court.z - 0.05)
    walkAxis(game, 'x', TWIN_GALLERIES_ROUTE.court.x)
    expect(game.snapshot().checkpointId).toBe(ids.courtCheckpoint)
    walkAxis(game, 'x', TWIN_GALLERIES_ROUTE.court.x + 1)
    moveFor(game, { ...idle, moveZ: 1 }, 700)
    expect(game.snapshot().player.position.z).toBeGreaterThan(
      TWIN_GALLERIES_ROUTE.court.z + ENCLOSED_CHAMBER_HALF - 0.7,
    )
    expect(game.snapshot().player.position.z).toBeLessThan(
      TWIN_GALLERIES_ROUTE.court.z + ENCLOSED_CHAMBER_HALF - 0.15,
    )
    walkAxis(game, 'z', TWIN_GALLERIES_ROUTE.court.z - 0.05)
    walkAxis(game, 'x', TWIN_GALLERIES_ROUTE.court.x)
    sing(game, ids.bridgePair)
    expect(game.snapshot().activeSolidIds).not.toContain(ids.courtGate)

    walkAxis(game, 'x', TWIN_GALLERIES_ROUTE.court.x + 1)
    walkAxis(game, 'z', TWIN_GALLERIES_ROUTE.westTurn.z)
    walkAxis(game, 'x', TWIN_GALLERIES_ROUTE.portrait.x + 0.05)
    walkAxis(game, 'z', TWIN_GALLERIES_ROUTE.portrait.z)
    expect(game.snapshot().checkpointId).toBe(ids.portraitCheckpoint)
    walkAxis(game, 'z', TWIN_GALLERIES_ROUTE.portrait.z + 1)
    moveFor(game, { ...idle, moveX: -1 }, 700)
    expect(game.snapshot().player.position.x).toBeLessThan(
      TWIN_GALLERIES_ROUTE.portrait.x - ENCLOSED_CHAMBER_HALF + 0.7,
    )
    expect(game.snapshot().player.position.x).toBeGreaterThan(
      TWIN_GALLERIES_ROUTE.portrait.x - ENCLOSED_CHAMBER_HALF + 0.15,
    )
    walkAxis(game, 'x', TWIN_GALLERIES_ROUTE.portrait.x + 0.05)
    walkAxis(game, 'z', TWIN_GALLERIES_ROUTE.portrait.z)
    sing(game, ids.portraitPair)
    expect(game.snapshot().activeSolidIds).not.toContain(ids.portraitGate)

    walkAxis(game, 'z', TWIN_GALLERIES_ROUTE.portrait.z + 1)
    walkAxis(game, 'x', TWIN_GALLERIES_ROUTE.panoramaTurn.x)
    const completionEvents: GameEvent[] = []
    for (let index = 0; index < 5000 && !game.snapshot().complete; index++)
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

  it('keeps the three optional anchors reachable without changing route completion', () => {
    const warm = createGlassGame(TWIN_GALLERIES)
    walkAxis(warm, 'x', -1.8)
    walkAxis(warm, 'z', 1.15)
    expect(warm.snapshot().nearbyBreakableId).toBe(ids.lowerOptional)

    const cool = createGlassGame(TWIN_GALLERIES, {
      version: 1,
      levelId: prefix,
      checkpointId: ids.coolCheckpoint,
      completedBreakableIds: [ids.lower],
      finished: false,
    })
    walkAxis(cool, 'x', TWIN_GALLERIES_ROUTE.cool.x - 0.5)
    walkAxis(cool, 'z', TWIN_GALLERIES_ROUTE.cool.z - 1.8)
    walkAxis(cool, 'x', TWIN_GALLERIES_ROUTE.cool.x + 1.15)
    expect(cool.snapshot().nearbyBreakableId).toBe(ids.upperOptional)

    const court = createGlassGame(TWIN_GALLERIES, {
      version: 1,
      levelId: prefix,
      checkpointId: ids.courtCheckpoint,
      completedBreakableIds: [ids.lower, ids.upper],
      finished: false,
    })
    walkAxis(court, 'z', TWIN_GALLERIES_ROUTE.court.z - 0.5)
    walkAxis(court, 'x', TWIN_GALLERIES_ROUTE.court.x - 1.8)
    walkAxis(court, 'z', TWIN_GALLERIES_ROUTE.court.z + 1.15)
    expect(court.snapshot().nearbyBreakableId).toBe(ids.courtOptional)
    expect(court.snapshot().complete).toBe(false)
  })

  it('restores chapter checkpoints only after their required preceding beat', () => {
    const chapters = [
      [ids.coolCheckpoint, ids.lower, []],
      [ids.courtCheckpoint, ids.upper, [ids.lower]],
      [ids.portraitCheckpoint, ids.bridgePair, [ids.lower, ids.upper]],
      [
        ids.panoramaCheckpoint,
        ids.portraitPair,
        [ids.lower, ids.upper, ids.bridgePair],
      ],
    ] as const

    for (const [
      checkpointId,
      prerequisiteId,
      completedBreakableIds,
    ] of chapters) {
      expect(
        TWIN_GALLERIES.checkpoints.find(
          (checkpoint) => checkpoint.id === checkpointId,
        )?.requiresCompleted,
      ).toEqual([prerequisiteId])
      const restored = createGlassGame(TWIN_GALLERIES, {
        version: 1,
        levelId: prefix,
        checkpointId,
        completedBreakableIds: [...completedBreakableIds],
        finished: false,
      })
      expect(restored.snapshot().checkpointId).toBe(ids.warmCheckpoint)
      expect(restored.snapshot().player.position).toEqual(
        TWIN_GALLERIES.spawn.position,
      )
    }
  })
})
