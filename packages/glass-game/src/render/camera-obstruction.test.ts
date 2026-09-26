// Camera obstruction regression — only live collision proxies may shorten a camera ray.

import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { LevelDefinition } from '../contracts'
import { createCameraObstruction } from './camera-obstruction'

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
})
