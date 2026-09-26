// Camera obstruction queries — bounds-first boom clearance with optional visible-mesh fallback.

import type { Object3D } from 'three'
import { Ray, Raycaster, Vector3 } from 'three'
import type { LevelDefinition } from '../contracts'
import { createCameraPlatformOcclusion } from './camera-platform-occlusion'
import { ENCLOSURE_READABLE_BOOM_DISTANCE, OBSTRUCTION_LIFT_PITCHES, } from './camera-policy'
import type { createEnclosureFraming } from './enclosure-framing'

export function createCameraObstruction(
  level: LevelDefinition,
  enclosure: ReturnType<typeof createEnclosureFraming>,
) {
  const { obstacles, updatePlatformStates, useMeshOccludersAt } =
    createCameraPlatformOcclusion(level)
  const hit = new Vector3()
  const ray = new Ray()
  const raycaster = new Raycaster()
  let occluders: Object3D[] = []

  function safeRayDistance(
    origin: Vector3,
    rayDirection: Vector3,
    reach: number,
    _enabledPlatformIds: readonly string[],
    activeSolidIds: readonly string[],
    constrainToEnclosure: boolean,
    useMeshOccluders = true,
  ): number {
    ray.set(origin, rayDirection)
    let safeDistance = reach
    for (const obstacle of obstacles) {
      if (!activeSolidIds.includes(obstacle.id)) continue
      if (ray.intersectBox(obstacle.box, hit))
        safeDistance = Math.min(
          safeDistance,
          Math.max(0.35, origin.distanceTo(hit) - 0.1),
        )
    }
    if (enclosure !== null) {
      safeDistance = Math.min(
        safeDistance,
        enclosure.solidDistance(origin, rayDirection, reach, activeSolidIds),
      )
      if (constrainToEnclosure) {
        const volumeDistance = enclosure.volumeDistance(
          origin,
          rayDirection,
          reach,
        )
        if (volumeDistance !== null)
          safeDistance = Math.min(safeDistance, volumeDistance)
      }
    }
    if (useMeshOccluders) {
      raycaster.set(origin, rayDirection)
      raycaster.far = safeDistance
      const obstruction = raycaster.intersectObjects(occluders, false)[0]
      if (obstruction !== undefined) {
        const meshDistance = Math.max(0.35, obstruction.distance - 0.1)
        safeDistance =
          enclosure === null
            ? meshDistance
            : Math.min(safeDistance, meshDistance)
      }
    }
    return safeDistance
  }

  function safeBoomDistance(
    origin: Vector3,
    yaw: number,
    pitch: number,
    reach: number,
    enabledPlatformIds: readonly string[],
    activeSolidIds: readonly string[],
    constrainToEnclosure: boolean,
    useMeshOccluders: boolean,
    boomDirection: Vector3,
  ): number {
    boomDirection.set(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    )
    return safeRayDistance(
      origin,
      boomDirection,
      reach,
      enabledPlatformIds,
      activeSolidIds,
      constrainToEnclosure,
      useMeshOccluders,
    )
  }

  return {
    safeRayDistance,
    safeBoomDistance,
    chooseLiftedPitch(options: {
      basePitch: number
      origin: Vector3
      yaw: number
      reach: number
      enabledPlatformIds: readonly string[]
      activeSolidIds: readonly string[]
      constrainToEnclosure: boolean
      normalDistance: number
      useMeshOccluders: boolean
      boomDirection: Vector3
    }): number {
      let bestPitch = options.basePitch
      let bestDistance = options.normalDistance
      for (const candidate of OBSTRUCTION_LIFT_PITCHES) {
        if (candidate <= options.basePitch) continue
        const candidateDistance = safeBoomDistance(
          options.origin,
          options.yaw,
          candidate,
          options.reach,
          options.enabledPlatformIds,
          options.activeSolidIds,
          options.constrainToEnclosure,
          options.useMeshOccluders,
          options.boomDirection,
        )
        if (candidateDistance > bestDistance) {
          bestPitch = candidate
          bestDistance = candidateDistance
        }
        if (
          options.constrainToEnclosure &&
          candidateDistance >= ENCLOSURE_READABLE_BOOM_DISTANCE
        )
          return candidate
      }
      return bestPitch
    },
    meshPathClear(
      origin: Vector3,
      rayDirection: Vector3,
      reach: number,
      useMeshOccluders: boolean,
    ): boolean {
      if (!useMeshOccluders) return true
      raycaster.set(origin, rayDirection)
      raycaster.far = reach
      return raycaster.intersectObjects(occluders, false).length === 0
    },
    setOccluders(objects: Object3D[]): void {
      occluders = objects
    },
    updatePlatformStates,
    useMeshOccludersAt,
  }
}
