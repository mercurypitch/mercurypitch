// Camera obstruction regression — only live collision proxies may shorten a camera ray.

import { Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { Bounds3, LevelDefinition } from '../contracts'
import { createCameraObstruction } from './camera-obstruction'
import { createEnclosureFraming } from './enclosure-framing'
import { MINIMUM_THIRD_PERSON_REACH } from './third-person-framing'

const LEVEL: LevelDefinition = {
  id: 'camera-obstruction-test',
  title: 'Camera obstruction test',
  spawn: { position: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
  platforms: [
    {
      id: 'releasing-platform',
      minX: -0.5,
      maxX: 0.5,
      minZ: 1,
      maxZ: 2,
      top: 2,
      thickness: 2,
      kind: 'deck',
      material: 'stone',
    },
  ],
  checkpoints: [
    {
      id: 'start',
      position: { x: 0, y: 0, z: 0 },
      radius: 1,
      facingYaw: 0,
    },
  ],
  breakables: [],
  exit: {
    minX: 4,
    maxX: 5,
    minZ: 4,
    maxZ: 5,
    top: 0,
    requiresCompleted: [],
  },
  fallBelow: -2,
}

function enclosedLevel(
  cameraBounds: Bounds3,
  withGate = false,
): LevelDefinition {
  return {
    ...LEVEL,
    id: withGate ? 'camera-obstruction-gated' : 'camera-obstruction-enclosed',
    solids: withGate
      ? [
          {
            id: 'sealed-gate',
            kind: 'prop',
            shape: 'box',
            minX: 0.2,
            maxX: 3,
            minZ: -2,
            maxZ: 2,
            top: 2,
            thickness: 2,
            presentation: { role: 'gate', material: 'brass' },
          },
        ]
      : [],
    presentation: {
      worldBounds: cameraBounds,
      lightBounds: cameraBounds,
      rooms: [
        {
          id: 'enclosed-room',
          bounds: cameraBounds,
          cameraBounds,
        },
      ],
      audioRegions: [],
      visuals: [],
      assetRecipeIds: [],
    },
  }
}

const WALL_ROOM: Bounds3 = {
  minX: -5,
  maxX: 5,
  minY: 0,
  maxY: 3.4,
  minZ: -1,
  maxZ: 1,
}

describe('camera obstruction', () => {
  it('drops a released platform proxy even while it remains enabled', () => {
    const obstruction = createCameraObstruction(LEVEL, null)
    const origin = new Vector3(0, 1, 0)
    const direction = new Vector3(0, 0, 1)

    expect(
      obstruction.safeRayDistance(
        origin,
        direction,
        4,
        ['releasing-platform'],
        ['releasing-platform'],
        false,
        false,
      ),
    ).toBeLessThan(1)
    expect(
      obstruction.safeRayDistance(
        origin,
        direction,
        4,
        ['releasing-platform'],
        [],
        false,
        false,
      ),
    ).toBe(4)
  })

  it.each([
    { expectedLateralSign: -1, wallZ: 0.84 },
    { expectedLateralSign: 1, wallZ: -0.84 },
  ])(
    'recovers a readable boom beside the wall at z=$wallZ',
    ({ expectedLateralSign, wallZ }) => {
      const level = enclosedLevel(WALL_ROOM)
      const enclosure = createEnclosureFraming(level)!
      const obstruction = createCameraObstruction(level, enclosure)
      const origin = new Vector3(0, 0.42, wallZ)
      const canonicalDirection = new Vector3()
      const recoveredDirection = new Vector3()
      const canonicalDistance = obstruction.safeBoomDistance(
        origin,
        Math.PI / 2,
        0.24,
        4,
        [],
        [],
        true,
        false,
        canonicalDirection,
      )
      const recoveredDistance = obstruction.resolveBoomDistance(
        origin,
        Math.PI / 2,
        0.24,
        4,
        [],
        [],
        true,
        false,
        1 / 60,
        recoveredDirection,
      )
      const cameraPosition = origin
        .clone()
        .addScaledVector(recoveredDirection, recoveredDistance)

      expect(canonicalDistance).toBeLessThan(MINIMUM_THIRD_PERSON_REACH)
      expect(recoveredDistance).toBeGreaterThanOrEqual(1.55)
      expect(Math.sign(recoveredDirection.z)).toBe(expectedLateralSign)
      expect(cameraPosition.distanceTo(origin)).toBeCloseTo(recoveredDistance)
      expect(enclosure.cameraPositionSafe(origin, cameraPosition, [])).toBe(
        true,
      )
    },
  )

  it('retains one lateral side without repeating the full search', () => {
    const level = enclosedLevel(WALL_ROOM)
    const enclosure = createEnclosureFraming(level)!
    const volumeDistance = vi.spyOn(enclosure, 'volumeDistance')
    const obstruction = createCameraObstruction(level, enclosure)
    const origin = new Vector3(0, 0.42, 0.84)
    const direction = new Vector3()

    expect(
      obstruction.resolveBoomDistance(
        origin,
        Math.PI / 2,
        0.24,
        4,
        [],
        [],
        true,
        false,
        1 / 60,
        direction,
      ),
    ).toBeGreaterThanOrEqual(1.55)
    const lateralSign = Math.sign(direction.z)
    volumeDistance.mockClear()

    expect(
      obstruction.resolveBoomDistance(
        origin,
        Math.PI / 2,
        0.24,
        4,
        [],
        [],
        true,
        false,
        1 / 60,
        direction,
      ),
    ).toBeGreaterThanOrEqual(1.55)
    expect(Math.sign(direction.z)).toBe(lateralSign)
    expect(volumeDistance).toHaveBeenCalledTimes(2)
  })

  it('rejects a closed gate and cools down an unchanged failed search', () => {
    const level = enclosedLevel(WALL_ROOM, true)
    const enclosure = createEnclosureFraming(level)!
    const volumeDistance = vi.spyOn(enclosure, 'volumeDistance')
    const obstruction = createCameraObstruction(level, enclosure)
    const origin = new Vector3(0, 0.42, 0.84)
    const direction = new Vector3()
    const resolve = (activeSolidIds: readonly string[]) =>
      obstruction.resolveBoomDistance(
        origin,
        Math.PI / 2,
        0.24,
        4,
        [],
        activeSolidIds,
        true,
        false,
        0.01,
        direction,
      )

    expect(resolve(['sealed-gate'])).toBeLessThan(MINIMUM_THIRD_PERSON_REACH)
    volumeDistance.mockClear()
    for (let frame = 0; frame < 10; frame++)
      expect(resolve(['sealed-gate'])).toBeLessThan(MINIMUM_THIRD_PERSON_REACH)
    expect(volumeDistance).toHaveBeenCalledTimes(10)

    expect(resolve([])).toBeGreaterThanOrEqual(1.55)
  })
})
