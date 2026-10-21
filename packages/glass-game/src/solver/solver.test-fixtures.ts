// Solver fixtures — small physical courses with real encounter and floor contracts.
import { GLASSWORKS } from '../content/glassworks'
import type { LevelDefinition, PlatformDefinition } from '../contracts'

export function deck(
  id: string,
  minZ: number,
  maxZ: number,
  extra: Partial<PlatformDefinition> = {},
): PlatformDefinition {
  return {
    id,
    minX: -2,
    maxX: 2,
    minZ,
    maxZ,
    top: 0,
    thickness: 0.2,
    kind: 'deck',
    material: 'stone',
    ...extra,
  }
}

export function testLevel(
  extra: Partial<LevelDefinition> = {},
): LevelDefinition {
  return {
    id: 'solver-fixture',
    title: 'Solver fixture',
    spawn: { position: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
    platforms: [deck('floor', -2, 8)],
    checkpoints: [],
    solids: [],
    breakables: [
      {
        ...GLASSWORKS.breakables[0],
        id: 'target',
        anchor: { x: 0, y: 0, z: 2 },
        position: { x: 0, y: 0, z: 2.5 },
      },
    ],
    exit: {
      minX: 20,
      maxX: 21,
      minZ: 20,
      maxZ: 21,
      top: 0,
      requiresCompleted: ['target'],
    },
    fallBelow: -2,
    ...extra,
  }
}
