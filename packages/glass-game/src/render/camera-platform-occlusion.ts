// Camera platform occlusion — centralizes cheap platform bounds and the below-deck mesh cutoff.

import { Box3, Vector3 } from 'three'
import type { LevelDefinition } from '../contracts'

interface CameraPlatformObstacle {
  id: string
  box: Box3
}

export interface CameraPlatformOcclusion {
  obstacles: readonly CameraPlatformObstacle[]
  useMeshOccludersAt(playerY: number): boolean
}

export function createCameraPlatformOcclusion(
  level: LevelDefinition,
): CameraPlatformOcclusion {
  const lowestPlatformBottom =
    level.platforms.length === 0
      ? Number.NEGATIVE_INFINITY
      : Math.min(
          ...level.platforms.map(
            (platform) => platform.top - platform.thickness,
          ),
        )
  const obstacles = level.platforms.map((platform) => ({
    id: platform.id,
    box: new Box3(
      new Vector3(
        platform.minX - 0.08,
        platform.top - platform.thickness - 0.08,
        platform.minZ - 0.08,
      ),
      new Vector3(
        platform.maxX + 0.08,
        platform.top + 0.08,
        platform.maxZ + 0.08,
      ),
    ),
  }))

  return {
    obstacles,
    // Below every authored platform Merc cannot recover before the fall reset,
    // so dense decorative render meshes no longer need camera raycasts.
    useMeshOccludersAt: (playerY) => playerY >= lowestPlatformBottom,
  }
}
