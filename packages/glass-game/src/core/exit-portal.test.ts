// Exit portal tests — authored bounds stay authoritative for rotated, airborne crossings.

import { describe, expect, it } from 'vitest'
import type { LevelDefinition, Vec3 } from '../contracts'
import { crossesExitPortal, deriveExitPortalGeometry, EXIT_PORTAL_HEIGHT, } from './exit-portal'

type ExitDefinition = LevelDefinition['exit']

const northExit: ExitDefinition = {
  minX: -0.65,
  maxX: 0.65,
  minZ: 2.4,
  maxZ: 2.6,
  top: 0.2,
  requiresCompleted: [],
}

function crosses(exit: ExitDefinition, previous: Vec3, current: Vec3): boolean {
  return crossesExitPortal(previous, current, deriveExitPortalGeometry(exit), {
    height: 0.5,
    radius: 0.16,
  })
}

describe('exit portal geometry', () => {
  it('derives a north-facing aperture from the thin authored axis', () => {
    const geometry = deriveExitPortalGeometry(northExit)
    expect(geometry).toMatchObject({
      center: { x: 0, y: 0.95, z: 2.5 },
      normalAxis: 'z',
      lateralAxis: 'x',
      yaw: 0,
      width: 1.3,
      height: EXIT_PORTAL_HEIGHT,
      minLateral: -0.65,
      maxLateral: 0.65,
      bottom: 0.2,
      top: 1.7,
    })
    expect(geometry.depth).toBeCloseTo(0.2)
  })

  it('accepts ascending, apex and descending crossings in either direction', () => {
    expect(
      crosses(northExit, { x: 0, y: 0.1, z: 2.7 }, { x: 0, y: 0.3, z: 2.3 }),
    ).toBe(true)
    expect(
      crosses(northExit, { x: 0, y: 0.7, z: 2.7 }, { x: 0, y: 0.7, z: 2.5 }),
    ).toBe(true)
    expect(
      crosses(northExit, { x: 0, y: 0.7, z: 2.3 }, { x: 0, y: 0.3, z: 2.7 }),
    ).toBe(true)
  })

  it('rejects same-side motion, edge brushing and vertical misses', () => {
    expect(
      crosses(northExit, { x: 0, y: 0.2, z: 2.9 }, { x: 0, y: 0.2, z: 2.7 }),
    ).toBe(false)
    expect(
      crosses(
        northExit,
        { x: 0.49, y: 0.2, z: 2.7 },
        { x: 0.49, y: 0.2, z: 2.3 },
      ),
    ).toBe(false)
    expect(
      crosses(
        northExit,
        { x: 0.48, y: 0.2, z: 2.7 },
        { x: 0.48, y: 0.2, z: 2.3 },
      ),
    ).toBe(true)
    expect(
      crosses(northExit, { x: 0, y: 1.7, z: 2.7 }, { x: 0, y: 1.7, z: 2.3 }),
    ).toBe(false)
    expect(
      crosses(northExit, { x: 0, y: -0.3, z: 2.7 }, { x: 0, y: -0.3, z: 2.3 }),
    ).toBe(false)
  })

  it('rotates the same crossing contract onto an east-facing authored exit', () => {
    const eastExit: ExitDefinition = {
      minX: 4.9,
      maxX: 5.1,
      minZ: -0.8,
      maxZ: 0.8,
      top: 0,
      requiresCompleted: [],
    }
    const geometry = deriveExitPortalGeometry(eastExit)

    expect(geometry).toMatchObject({
      center: { x: 5, y: 0.75, z: 0 },
      normalAxis: 'x',
      lateralAxis: 'z',
      yaw: Math.PI / 2,
      width: 1.6,
    })
    expect(
      crosses(eastExit, { x: 4.8, y: 0, z: 0.2 }, { x: 5.2, y: 0, z: 0.2 }),
    ).toBe(true)
  })
})
