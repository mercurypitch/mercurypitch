// Melody station marker tests — contour, order and progress remain legible without collision art.

import type { InstancedMesh, Mesh } from 'three'
import { Box3, MeshPhysicalMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import type { GameSnapshot, LevelDefinition, MelodyStationMarkerDefinition, } from '../contracts'
import { createGlassGame } from '../core/game'
import { disposeObject } from './dispose'
import type { MuseumMaterials } from './materials'
import { createMelodyStationMarkers } from './melody-station-markers'
import { createMuseum } from './museum'

const OFFSETS = [0, 2, 4, 2, 0] as const

function materials(): MuseumMaterials {
  return Object.fromEntries(
    ['gold', 'glass', 'teal'].map((id) => [
      id,
      new MeshPhysicalMaterial({ name: id }),
    ]),
  ) as MuseumMaterials
}

function definitions(): MelodyStationMarkerDefinition[] {
  return OFFSETS.map((pitchOffsetSemitones, index) => ({
    id: `station-${index + 1}`,
    roomId: `room-${index + 1}`,
    encounterId: `encounter-${index + 1}`,
    anchorId: `anchor-${index + 1}`,
    position: { x: index * 1.2, y: 0.35, z: index * -0.8 },
    yaw: index * 0.2,
    pitchOffsetSemitones,
  }))
}

function level(): LevelDefinition {
  return {
    id: 'melody-marker-proof',
    title: 'Melody marker proof',
    spawn: { position: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
    platforms: [],
    checkpoints: [],
    breakables: [],
    exit: {
      minX: 0,
      maxX: 1,
      minZ: 0,
      maxZ: 1,
      top: 0,
      requiresCompleted: [],
    },
    fallBelow: -3,
    presentation: {
      worldBounds: {
        minX: -1,
        maxX: 7,
        minY: -1,
        maxY: 2,
        minZ: -5,
        maxZ: 1,
      },
      lightBounds: {
        minX: -1,
        maxX: 7,
        minY: -1,
        maxY: 2,
        minZ: -5,
        maxZ: 1,
      },
      rooms: definitions().map((definition) => ({
        id: definition.roomId,
        bounds: {
          minX: definition.position.x - 1,
          maxX: definition.position.x + 1,
          minY: definition.position.y,
          maxY: definition.position.y + 1,
          minZ: definition.position.z - 1,
          maxZ: definition.position.z + 1,
        },
      })),
      audioRegions: [],
      visuals: [],
      melodyMarkers: definitions(),
      assetRecipeIds: [],
    },
  }
}

function snapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    ...createGlassGame(level()).snapshot(),
    ...overrides,
  }
}

describe('melody station markers', () => {
  it('roots every cue at its authored floor pose and traces the phrase below knee height', () => {
    const palette = materials()
    const markers = createMelodyStationMarkers(level(), palette)
    const heads = definitions().map(
      (definition) =>
        markers.root.getObjectByName(
          `melody-marker-head-${definition.id}`,
        ) as Mesh,
    )

    expect(
      markers.instances.map(({ roomId, root }) => ({
        roomId,
        position: root.position.toArray(),
        yaw: root.rotation.y,
      })),
    ).toEqual(
      definitions().map((definition) => ({
        roomId: definition.roomId,
        position: [
          definition.position.x,
          definition.position.y,
          definition.position.z,
        ],
        yaw: definition.yaw,
      })),
    )
    expect(heads.map((head) => head.position.y)).toEqual([
      0.24, 0.3, 0.36, 0.3, 0.24,
    ])
    for (const definition of definitions()) {
      const marker = markers.root.getObjectByName(
        `melody-marker-${definition.id}`,
      )!
      marker.updateMatrixWorld(true)
      const bounds = new Box3().setFromObject(marker)
      expect(bounds.min.y).toBeCloseTo(definition.position.y, 6)
      expect(bounds.max.y).toBeLessThan(definition.position.y + 0.45)
    }

    disposeObject(markers.root, new Set(Object.values(palette)))
    Object.values(palette).forEach((material) => material.dispose())
  })

  it('uses one through five physical studs and keeps every cue out of camera collision', () => {
    const palette = materials()
    const markers = createMelodyStationMarkers(level(), palette)
    definitions().forEach((definition, index) => {
      const order = markers.root.getObjectByName(
        `melody-marker-order-${definition.id}`,
      ) as InstancedMesh
      expect(order.count).toBe(index + 1)
      markers.root
        .getObjectByName(`melody-marker-${definition.id}`)!
        .traverse((object) => {
          if ((object as Mesh).isMesh)
            expect(object.userData.excludeFromCameraCollision).toBe(true)
        })
    })

    disposeObject(markers.root, new Set(Object.values(palette)))
    Object.values(palette).forEach((material) => material.dispose())
  })

  it('highlights only the next station and preserves distinct repeated-pitch completion', () => {
    const palette = materials()
    const markers = createMelodyStationMarkers(level(), palette)
    const head = (index: number) =>
      markers.root.getObjectByName(
        `melody-marker-head-station-${index}`,
      ) as Mesh
    const halo = (index: number) =>
      markers.root.getObjectByName(`melody-marker-halo-station-${index}`)!

    markers.update(
      snapshot({
        completedBreakableIds: ['encounter-1'],
        nextRequiredBreakableId: 'encounter-2',
      }),
    )
    expect((head(1).material as MeshPhysicalMaterial).name).toBe('teal')
    expect(halo(1).visible).toBe(true)
    expect((head(2).material as MeshPhysicalMaterial).name).toBe('gold')
    expect(halo(2).visible).toBe(true)
    expect((head(3).material as MeshPhysicalMaterial).name).toBe('glass')
    expect(halo(3).visible).toBe(false)
    expect((head(5).material as MeshPhysicalMaterial).name).toBe('glass')

    markers.update(
      snapshot({
        completedBreakableIds: ['encounter-1', 'encounter-5'],
        nextRequiredBreakableId: null,
      }),
    )
    expect((head(1).material as MeshPhysicalMaterial).name).toBe('teal')
    expect((head(5).material as MeshPhysicalMaterial).name).toBe('teal')
    expect((head(2).material as MeshPhysicalMaterial).name).toBe('glass')

    disposeObject(markers.root, new Set(Object.values(palette)))
    Object.values(palette).forEach((material) => material.dispose())
  })

  it('installs each cue under its authored room owner in the museum renderer', () => {
    const palette = materials()
    const museum = createMuseum(level(), palette)

    definitions().forEach((definition) => {
      expect(
        museum.root
          .getObjectByName(`room-${definition.roomId}`)
          ?.getObjectByName(`melody-marker-${definition.id}`),
      ).toBeDefined()
    })
    museum.update(
      snapshot({
        completedBreakableIds: ['encounter-1'],
        nextRequiredBreakableId: 'encounter-2',
      }),
    )
    expect(
      (museum.root.getObjectByName('melody-marker-head-station-2') as Mesh)
        .material,
    ).toBe(palette.gold)

    museum.dispose()
    disposeObject(museum.root, new Set(Object.values(palette)))
    Object.values(palette).forEach((material) => material.dispose())
  })
})
