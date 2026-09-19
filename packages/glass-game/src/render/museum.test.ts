// Authored museum presentation — visible proxies share activation with collision and camera occlusion.

import type { Mesh } from 'three'
import { MeshPhysicalMaterial } from 'three'
import { expect, it } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import type { LevelDefinition } from '../contracts'
import { createGlassGame } from '../core/game'
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
