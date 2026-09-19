// Level composer tests — prove cardinal transforms, stable identity and authored spawn selection.

import { describe, expect, it } from 'vitest'
import { FOUNDATION_AUTHORING_CATALOG } from '../content/foundation-room-kit'
import { FOUNDATION_STRAIGHT_SOURCE, GLASS_FOUNDATION_STRAIGHT, } from '../content/foundation-routes'
import { createGlassGame } from '../core/game'
import { composeLevel } from './compose-level'
import type { AuthoredLevelSource, LevelAuthoringCatalog, RoomPrefab, } from './contracts'

function transformedFixture(): {
  source: AuthoredLevelSource
  catalog: LevelAuthoringCatalog
} {
  const room: RoomPrefab = {
    id: 'asymmetric-room',
    bounds: {
      minX: -2,
      maxX: 3,
      minY: -0.25,
      maxY: 2,
      minZ: -1,
      maxZ: 2,
    },
    cameraBounds: {
      minX: -2.5,
      maxX: 3.5,
      minY: 0,
      maxY: 3,
      minZ: -1.5,
      maxZ: 2.5,
    },
    platforms: [
      {
        id: 'floor',
        kind: 'deck',
        minX: -2,
        maxX: 3,
        minZ: -1,
        maxZ: 2,
        top: 0,
        thickness: 0.25,
        material: 'stone',
        renderId: 'deck',
        presentation: { role: 'floor', material: 'stone' },
      },
    ],
    solids: [
      {
        id: 'wall',
        kind: 'prop',
        shape: 'box',
        minX: 1,
        maxX: 1.4,
        minZ: 1.5,
        maxZ: 1.9,
        top: 1,
        thickness: 1,
        presentation: { role: 'wall', material: 'stone' },
      },
      {
        id: 'column',
        kind: 'prop',
        shape: 'cylinder',
        x: -1.5,
        z: 1.5,
        radiusTop: 0.2,
        radiusBottom: 0.3,
        top: 1.2,
        thickness: 1.2,
        presentation: { role: 'wall', material: 'stone' },
      },
      {
        id: 'north-seal',
        kind: 'prop',
        shape: 'box',
        minX: -0.6,
        maxX: 0.6,
        minZ: 1.9,
        maxZ: 2,
        top: 1.5,
        thickness: 1.5,
        presentation: { role: 'wall', material: 'stone' },
      },
    ],
    checkpoints: [
      {
        id: 'zeta',
        position: { x: -0.5, y: 0, z: -0.5 },
        facingYaw: 0,
        radius: 0.4,
      },
      {
        id: 'alpha',
        position: { x: 0.5, y: 0, z: -0.5 },
        facingYaw: Math.PI / 2,
        radius: 0.4,
      },
    ],
    ports: [
      {
        id: 'north',
        position: { x: 0, y: 0, z: 2 },
        facingYaw: Math.PI,
        width: 1.2,
        height: 1.5,
        sealSolidId: 'north-seal',
      },
    ],
    exhibitMounts: [
      {
        id: 'display',
        position: { x: 0, y: 0, z: 0.8 },
        anchor: { x: 0, y: 0, z: 0 },
        facingYaw: Math.PI,
        platformId: 'floor',
      },
    ],
    exits: [
      {
        id: 'exit',
        minX: -0.5,
        maxX: 0.5,
        minZ: 1.2,
        maxZ: 1.6,
        top: 0,
      },
    ],
    visuals: [
      {
        id: 'marker',
        recipeId: 'marker',
        position: { x: 1, y: 0, z: -0.5 },
        yaw: 0,
      },
    ],
    audioRegions: [
      {
        id: 'room-tone',
        bounds: {
          minX: -1.8,
          maxX: 2.8,
          minY: 0,
          maxY: 1.8,
          minZ: -0.8,
          maxZ: 1.8,
        },
        sceneId: 'gallery',
      },
    ],
  }
  const source: AuthoredLevelSource = {
    levelId: 'transform-proof',
    layoutId: 'turned',
    contentRevision: 3,
    title: 'Transform proof',
    rooms: [
      {
        id: 'room-z',
        prefabId: room.id,
        translate: { x: 10, y: 2, z: -4 },
        yawQuarterTurns: 1,
        audioSceneId: 'museum',
      },
    ],
    exhibits: [
      {
        id: 'vessel',
        roomId: 'room-z',
        mountId: 'display',
        prefabId: 'goblet',
        label: 'Proof goblet',
        optional: false,
      },
    ],
    connections: [],
    spawnCheckpoint: 'room-z.zeta',
    exit: { zone: 'room-z.exit', requiresCompleted: ['vessel'] },
    fallBelow: -5,
    worldBounds: {
      minX: 7,
      maxX: 14,
      minY: -5,
      maxY: 6,
      minZ: -8,
      maxZ: 0,
    },
    lightBounds: {
      minX: 8,
      maxX: 13,
      minY: 1,
      maxY: 6,
      minZ: -7,
      maxZ: -1,
    },
  }
  return {
    source,
    catalog: {
      rooms: { [room.id]: room },
      exhibits: {
        goblet: {
          id: 'goblet',
          variant: 'goblet',
          hold: {
            requiredSeconds: 1,
            toleranceCents: 100,
            confidenceFloor: 0.5,
            dropoutGraceSeconds: 0.1,
            decayPerSecond: 0.2,
            maximumSampleGapSeconds: 0.1,
            maximumSampleAgeMs: 150,
          },
          plinth: {
            height: 0.7,
            radiusTop: 0.22,
            radiusBottom: 0.28,
            presentation: { role: 'plinth', material: 'stone' },
          },
        },
      },
      availableAssetRecipeIds: ['deck', 'goblet', 'marker'],
    },
  }
}

describe('composeLevel', () => {
  it('applies one translated quarter turn to every gameplay and presentation datum', () => {
    const { source, catalog } = transformedFixture()

    const level = composeLevel(source, catalog)
    const fresh = createGlassGame(level)
    const reset = createGlassGame(level, {
      version: 1,
      levelId: level.id,
      checkpointId: 'unknown-checkpoint',
      completedBreakableIds: [],
    })

    expect(level.id).toBe('transform-proof/turned')
    expect(level.spawn).toEqual({
      position: { x: 9.5, y: 2, z: -3.5 },
      facingYaw: Math.PI / 2,
      checkpointId: 'transform-proof/turned/room-z/checkpoint/zeta',
    })
    expect(fresh.snapshot().checkpointId).toBe(level.spawn.checkpointId)
    expect(reset.snapshot().checkpointId).toBe(level.spawn.checkpointId)
    expect(fresh.snapshot().player.position).toEqual(level.spawn.position)
    expect(reset.snapshot().player.position).toEqual(level.spawn.position)
    expect(level.platforms[0]).toMatchObject({
      minX: 9,
      maxX: 12,
      minZ: -7,
      maxZ: -2,
      top: 2,
    })
    expect(
      level.solids?.find((solid) => solid.id.endsWith('/wall')),
    ).toMatchObject({
      shape: 'box',
      minX: 11.5,
      maxX: 11.9,
      minZ: -5.4,
      maxZ: -5,
    })
    expect(
      level.solids?.find((solid) => solid.id.endsWith('/column')),
    ).toMatchObject({
      shape: 'cylinder',
      x: 11.5,
      z: -2.5,
      radiusTop: 0.2,
      radiusBottom: 0.3,
    })
    expect(level.breakables[0]).toMatchObject({
      position: { x: 10.8, y: 2, z: -4 },
      anchor: { x: 10, y: 2, z: -4 },
      mount: { facingYaw: -Math.PI / 2 },
    })
    expect(level.exit).toMatchObject({
      minX: 11.2,
      maxX: 11.6,
      minZ: -4.5,
      maxZ: -3.5,
      top: 2,
    })
    expect(level.presentation?.rooms[0].ports?.[0]).toMatchObject({
      position: { x: 12, y: 2, z: -4 },
      facingYaw: -Math.PI / 2,
    })
    expect(level.presentation?.audioRegions[0]).toMatchObject({
      sceneId: 'museum',
      bounds: { minX: 9.2, maxX: 11.8, minZ: -6.8, maxZ: -2.2 },
    })
    expect(level.presentation?.visuals[0]).toMatchObject({
      position: { x: 9.5, y: 2, z: -5 },
      yaw: Math.PI / 2,
    })
  })

  it('keeps runtime identity and authored spawn selection independent of array order', () => {
    const room = FOUNDATION_AUTHORING_CATALOG.rooms['foundation-gallery']
    if (room === undefined)
      throw new Error('Foundation room fixture is missing.')
    const reorderedCatalog: LevelAuthoringCatalog = {
      ...FOUNDATION_AUTHORING_CATALOG,
      rooms: {
        'foundation-gallery': {
          ...room,
          platforms: [...room.platforms].reverse(),
          solids: [...room.solids].reverse(),
          checkpoints: [...room.checkpoints].reverse(),
          ports: [...room.ports].reverse(),
          exhibitMounts: [...room.exhibitMounts].reverse(),
          exits: [...room.exits].reverse(),
          visuals: [...room.visuals].reverse(),
          audioRegions: [...room.audioRegions].reverse(),
        },
      },
    }
    const reorderedSource: AuthoredLevelSource = {
      ...FOUNDATION_STRAIGHT_SOURCE,
      rooms: [...FOUNDATION_STRAIGHT_SOURCE.rooms].reverse(),
      exhibits: [...FOUNDATION_STRAIGHT_SOURCE.exhibits].reverse(),
      connections: [...FOUNDATION_STRAIGHT_SOURCE.connections].reverse(),
    }

    const level = composeLevel(reorderedSource, reorderedCatalog)
    const fresh = createGlassGame(level)
    const reset = createGlassGame(level, {
      version: 1,
      levelId: 'another-level',
      checkpointId: 'wrong',
      completedBreakableIds: [],
    })

    expect(level).toEqual(GLASS_FOUNDATION_STRAIGHT)
    expect(level.spawn.checkpointId).toBe(
      'glass-foundation/straight/arrival/checkpoint/entry',
    )
    expect(fresh.snapshot().checkpointId).toBe(level.spawn.checkpointId)
    expect(reset.snapshot().checkpointId).toBe(level.spawn.checkpointId)
    expect(fresh.snapshot().player.position).toEqual(level.spawn.position)
    expect(reset.snapshot().player.position).toEqual(level.spawn.position)
  })
})
