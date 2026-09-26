// Camera platform occlusion — centralizes cheap platform bounds and the below-deck mesh cutoff.

import { Box3 } from 'three'
import type { LevelDefinition, PlatformRuntimeSnapshot } from '../contracts'
import { platformBoundsAtRuntime } from '../core/platform-runtime'

interface CameraPlatformObstacle {
  id: string
  box: Box3
}

interface MutableCameraPlatformObstacle extends CameraPlatformObstacle {
  platform: LevelDefinition['platforms'][number]
}

export interface CameraPlatformOcclusion {
  obstacles: readonly CameraPlatformObstacle[]
  updatePlatformStates(
    states:
      | readonly Pick<
          PlatformRuntimeSnapshot,
          'id' | 'offset' | 'lengthRatio'
        >[]
      | undefined,
  ): void
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
  const setBox = (
    box: Box3,
    platform: LevelDefinition['platforms'][number],
    runtime:
      | Pick<PlatformRuntimeSnapshot, 'offset' | 'lengthRatio'>
      | undefined,
  ) => {
    const bounds = platformBoundsAtRuntime(platform, runtime)
    box.min.set(bounds.minX - 0.08, bounds.minY - 0.08, bounds.minZ - 0.08)
    box.max.set(bounds.maxX + 0.08, bounds.maxY + 0.08, bounds.maxZ + 0.08)
  }
  const obstacles: MutableCameraPlatformObstacle[] = level.platforms.map(
    (platform) => {
      const box = new Box3()
      setBox(box, platform, undefined)
      return { id: platform.id, box, platform }
    },
  )
  const runtimeStates = new Map<
    string,
    Pick<PlatformRuntimeSnapshot, 'offset' | 'lengthRatio'>
  >()

  return {
    obstacles,
    updatePlatformStates(states) {
      runtimeStates.clear()
      for (const state of states ?? []) runtimeStates.set(state.id, state)
      for (const obstacle of obstacles)
        setBox(obstacle.box, obstacle.platform, runtimeStates.get(obstacle.id))
    },
    // Below every authored platform Merc cannot recover before the fall reset,
    // so dense decorative render meshes no longer need camera raycasts.
    useMeshOccludersAt: (playerY) => playerY >= lowestPlatformBottom,
  }
}
