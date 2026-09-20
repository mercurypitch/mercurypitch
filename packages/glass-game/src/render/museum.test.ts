// Authored museum presentation — visible proxies share activation with collision and camera occlusion.

import type { Mesh } from 'three'
import { BoxGeometry, Group, Mesh as ThreeMesh, MeshPhysicalMaterial, } from 'three'
import { expect, it, vi } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import type { LevelDefinition } from '../contracts'
import { createGlassGame } from '../core/game'
import { disposeObject } from './dispose'
import type { MuseumMaterials } from './materials'
import { createMuseum } from './museum'
import { createVessel } from './vessels'

const level: LevelDefinition = {
  id: 'render-authored-room',
  title: 'Render authored room',
  authored: {
    levelId: 'render-authored-room',
    layoutId: 'quarter-turn',
    contentRevision: 1,
  },
  spawn: {
    position: { x: 20, y: 0, z: -10 },
    facingYaw: Math.PI / 2,
    checkpointId: 'arrival',
  },
  platforms: [
    {
      id: 'room-floor',
      minX: 18,
      maxX: 30,
      minZ: -14,
      maxZ: -6,
      top: 0,
      thickness: 0.4,
      kind: 'deck',
      material: 'stone',
      renderId: 'deck',
      presentation: { role: 'floor', material: 'stone' },
    },
  ],
  solids: [
    {
      id: 'room-gate',
      kind: 'prop',
      shape: 'box',
      minX: 23.8,
      maxX: 24.2,
      minZ: -14,
      maxZ: -6,
      top: 2.8,
      thickness: 2.8,
      activation: { noneCompleted: ['decanter'] },
      presentation: { role: 'gate', material: 'brass' },
    },
    {
      id: 'long-wall',
      kind: 'prop',
      shape: 'box',
      minX: 18,
      maxX: 30,
      minZ: -14,
      maxZ: -13.7,
      top: 2.8,
      thickness: 2.8,
      presentation: { role: 'wall', material: 'stone' },
    },
    {
      id: 'decanter-plinth',
      kind: 'prop',
      shape: 'cylinder',
      x: 21,
      z: -9,
      top: 0.65,
      thickness: 0.65,
      radiusTop: 0.32,
      radiusBottom: 0.38,
      presentation: { role: 'plinth', material: 'brass' },
    },
  ],
  checkpoints: [
    {
      id: 'arrival',
      position: { x: 20, y: 0, z: -10 },
      radius: 0.8,
      facingYaw: Math.PI / 2,
    },
  ],
  breakables: [
    {
      id: 'decanter',
      label: 'Decanter',
      position: { x: 21, y: 0, z: -9 },
      anchor: { x: 20.3, y: 0, z: -9 },
      mount: {
        kind: 'plinth',
        solidId: 'decanter-plinth',
        height: 0.65,
        radiusTop: 0.32,
        radiusBottom: 0.38,
        facingYaw: Math.PI / 2,
        presentation: { role: 'plinth', material: 'brass' },
      },
      variant: 'decanter',
      optional: false,
      hold: {
        requiredSeconds: 1,
        toleranceCents: 30,
        confidenceFloor: 0.7,
        dropoutGraceSeconds: 0.2,
        decayPerSecond: 1,
        maximumSampleGapSeconds: 0.1,
        maximumSampleAgeMs: 150,
      },
    },
  ],
  exit: {
    minX: 29,
    maxX: 30,
    minZ: -10,
    maxZ: -9,
    top: 0,
    requiresCompleted: ['decanter'],
  },
  fallBelow: -3,
  presentation: {
    worldBounds: {
      minX: 18,
      maxX: 30,
      minY: -3,
      maxY: 4,
      minZ: -14,
      maxZ: -6,
    },
    lightBounds: {
      minX: 18,
      maxX: 30,
      minY: -1,
      maxY: 4,
      minZ: -14,
      maxZ: -6,
    },
    rooms: [],
    audioRegions: [],
    visuals: [],
    assetRecipeIds: ['deck', 'decanter'],
  },
}

const coveredVisualLevel: LevelDefinition = {
  ...level,
  presentation: {
    ...level.presentation!,
    visuals: [
      {
        id: 'gate-screen',
        recipeId: 'museum-screen-v4',
        position: { x: 24, y: 0, z: -10 },
        yaw: 0,
        coveredSolidIds: ['room-gate'],
      },
      {
        id: 'wall-screen',
        recipeId: 'museum-screen-v4',
        position: { x: 20, y: 0, z: -14 },
        yaw: Math.PI / 2,
        coveredSolidIds: ['long-wall'],
      },
    ],
    assetRecipeIds: [...level.presentation!.assetRecipeIds, 'museum-screen-v4'],
  },
}

function createMaterials(): MuseumMaterials {
  return Object.fromEntries(
    ['marble', 'teal', 'limestone', 'gold', 'rock', 'glass'].map((id) => [
      id,
      new MeshPhysicalMaterial(),
    ]),
  ) as MuseumMaterials
}

it('keeps gate visibility and camera occlusion aligned with restored collision state', () => {
  const materials = createMaterials()
  const museum = createMuseum(level, materials)
  const gate = museum.root.getObjectByName('solid-room-gate') as Mesh
  const wall = museum.root.getObjectByName('solid-long-wall') as Mesh
  const plinth = museum.root.getObjectByName('solid-decanter-plinth') as Mesh
  expect(gate.material).toBe(materials.gold)
  expect(wall.material).toBe(materials.marble)
  expect(plinth.material).toBe(materials.gold)
  expect(museum.root.getObjectByName('legacy-plinth-decanter')).toBeUndefined()

  const closed = createGlassGame(level).snapshot()
  museum.update(closed)
  const closedOccluders = museum.cameraOccluders()
  expect(closed.activeSolidIds).toContain('room-gate')
  expect(gate.visible).toBe(true)
  expect(closedOccluders).toContain(gate)
  expect(museum.cameraOccluders()).toBe(closedOccluders)

  const restored = createGlassGame(level, {
    version: 1,
    levelId: level.id,
    checkpointId: 'arrival',
    completedBreakableIds: ['decanter'],
  }).snapshot()
  expect(restored.breakables[0]?.brokenAt).toBeNull()
  expect(restored.activeSolidIds).not.toContain('room-gate')
  museum.update(restored)
  const openOccluders = museum.cameraOccluders()
  expect(gate.visible).toBe(false)
  expect(openOccluders).not.toContain(gate)
  expect(openOccluders).not.toBe(closedOccluders)

  // Older render fixtures omit activeSolidIds; derive the same predicate from
  // completion rather than reviving a restored gate.
  museum.update({ ...restored, activeSolidIds: undefined })
  expect(gate.visible).toBe(false)
  museum.update({ ...closed, activeSolidIds: undefined })
  expect(gate.visible).toBe(true)

  const uv = wall.geometry.getAttribute('uv')
  let largestCoordinate = 0
  for (let i = 0; i < uv.count; i++)
    largestCoordinate = Math.max(
      largestCoordinate,
      Math.abs(uv.getX(i)),
      Math.abs(uv.getY(i)),
    )
  expect(largestCoordinate).toBeGreaterThan(4)

  museum.materialLibrary.dispose()
  Object.values(materials).forEach((material) => material.dispose())
})

it('places an authored vessel on its declared mount height and facing', () => {
  const vessel = createVessel(level.breakables[0]!, true)
  expect(vessel.root.position.y).toBeCloseTo(0.65)
  expect(vessel.root.rotation.y).toBeCloseTo(Math.PI / 2)
  vessel.dispose()
})

it('rejects bundles missing declared platform or decoration nodes', () => {
  const platformMaterials = createMaterials()
  const platformMuseum = createMuseum(level, platformMaterials)
  expect(() => platformMuseum.setKit(new Group(), 'museum-kit')).toThrow(
    'Museum platform "room-floor" could not find node "platform_terrace"',
  )
  disposeObject(platformMuseum.root, platformMuseum.materialLibrary.materials)
  platformMuseum.materialLibrary.dispose()
  Object.values(platformMaterials).forEach((material) => material.dispose())

  const decorationLevel: LevelDefinition = {
    ...level,
    id: 'glassworks',
    presentation: undefined,
    platforms: [
      {
        ...level.platforms[0]!,
        kind: 'catch',
        renderId: 'catch',
      },
    ],
  }
  const decorationMaterials = createMaterials()
  const decorationMuseum = createMuseum(decorationLevel, decorationMaterials)
  expect(() => decorationMuseum.setKit(new Group(), 'museum-kit')).toThrow(
    'Museum decoration could not find node "museum_arch"',
  )
  disposeObject(
    decorationMuseum.root,
    decorationMuseum.materialLibrary.materials,
  )
  decorationMuseum.materialLibrary.dispose()
  Object.values(decorationMaterials).forEach((material) => material.dispose())
})

it('replaces only declared proxies after exact art installs and shares an owned template', () => {
  const materials = createMaterials()
  const museum = createMuseum(coveredVisualLevel, materials)
  const gateProxy = museum.root.getObjectByName('solid-room-gate') as Mesh
  const wallProxy = museum.root.getObjectByName('solid-long-wall') as Mesh
  const closed = createGlassGame(coveredVisualLevel).snapshot()
  museum.update(closed)
  expect(gateProxy.visible).toBe(true)
  expect(wallProxy.visible).toBe(true)
  expect(() => museum.setKit(new Group(), 'museum-screen-v4')).toThrow(
    'could not find node',
  )
  expect(gateProxy.visible).toBe(true)
  expect(wallProxy.visible).toBe(true)

  const sourceScene = new Group()
  const source = new Group()
  source.name = 'meshy_museum_screen_bay'
  const sourceGeometry = new BoxGeometry(3.2, 3.6, 0.2)
  const atlas = new MeshPhysicalMaterial()
  atlas.name = 'meshy_museum_screen_bay_atlas'
  source.add(new ThreeMesh(sourceGeometry, atlas))
  sourceScene.add(source)

  museum.setKit(sourceScene, 'museum-screen-v4')

  const gateArt = museum.root.getObjectByName('visual-gate-screen')!
  const wallArt = museum.root.getObjectByName('visual-wall-screen')!
  const gateMesh = gateArt.getObjectByProperty('isMesh', true) as Mesh
  const wallMesh = wallArt.getObjectByProperty('isMesh', true) as Mesh
  expect(gateProxy.visible).toBe(false)
  expect(wallProxy.visible).toBe(false)
  expect(gateArt.visible).toBe(true)
  expect(wallArt.visible).toBe(true)
  expect(gateMesh.geometry).toBe(wallMesh.geometry)
  expect(gateMesh.geometry).not.toBe(sourceGeometry)
  expect((gateMesh.material as MeshPhysicalMaterial).name).toBe(
    'meshy_museum_screen_bay_atlas',
  )
  expect(gateMesh.material).not.toBe(materials.marble)
  expect(closed.activeSolidIds).toEqual(
    expect.arrayContaining(['room-gate', 'long-wall']),
  )

  const sharedGeometryDispose = vi.spyOn(gateMesh.geometry, 'dispose')
  disposeObject(sourceScene)
  expect(sharedGeometryDispose).not.toHaveBeenCalled()

  const restored = createGlassGame(coveredVisualLevel, {
    version: 1,
    levelId: coveredVisualLevel.id,
    checkpointId: 'arrival',
    completedBreakableIds: ['decanter'],
  }).snapshot()
  museum.update(restored)
  expect(gateArt.visible).toBe(false)
  expect(wallArt.visible).toBe(true)
  expect(gateProxy.visible).toBe(false)
  expect(wallProxy.visible).toBe(false)
  expect(museum.cameraOccluders()).not.toContain(gateMesh)
  expect(museum.cameraOccluders()).toContain(wallMesh)

  disposeObject(museum.root, museum.materialLibrary.materials)
  expect(sharedGeometryDispose).toHaveBeenCalledTimes(1)
  museum.materialLibrary.dispose()
  Object.values(materials).forEach((material) => material.dispose())
})

it('preserves legacy floor recipe materials when no presentation override exists', () => {
  const materials = createMaterials()
  const museum = createMuseum(GLASSWORKS, materials)
  const catchFloor = museum.root.getObjectByName('floor-catch-arrival')!
  const bridgeFloor = museum.root.getObjectByName('floor-arch-bridge')!
  expect((catchFloor.children[0] as Mesh).material).toBe(materials.teal)
  expect((bridgeFloor.children[0] as Mesh).material).toBe(materials.marble)
  museum.materialLibrary.dispose()
  Object.values(materials).forEach((material) => material.dispose())
})
