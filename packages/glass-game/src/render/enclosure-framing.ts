// Enclosure framing keeps the camera centre inside connected authored room volumes.

import { Box3, Vector3 } from 'three'
import type { Bounds3, LevelDefinition, SolidPropDefinition, } from '../contracts'

export const CAMERA_CLEARANCE_RADIUS = 0.24
export const CAMERA_TARGET_LOOK_AHEAD = 0.45

const INTERVAL_EPSILON = 0.0001
const SURFACE_INSET = 0.01

interface RayInterval {
  maximum: number
  minimum: number
}

interface SolidObstacle {
  cameraBox: Box3
  id: string
  targetBox: Box3
  visibilityBox: Box3
}

function boxFromBounds(bounds: Bounds3): Box3 {
  return new Box3(
    new Vector3(bounds.minX, bounds.minY, bounds.minZ),
    new Vector3(bounds.maxX, bounds.maxY, bounds.maxZ),
  )
}

function shrinkCameraVolume(bounds: Bounds3): Box3 | null {
  const box = boxFromBounds(bounds).expandByScalar(-CAMERA_CLEARANCE_RADIUS)
  return box.isEmpty() ? null : box
}

function solidObstacle(solid: SolidPropDefinition): SolidObstacle {
  const minY = solid.top - solid.thickness
  const maxY = solid.top
  let targetBox: Box3
  if (solid.shape === 'box') {
    targetBox = new Box3(
      new Vector3(solid.minX, minY, solid.minZ),
      new Vector3(solid.maxX, maxY, solid.maxZ),
    )
  } else {
    const radius = Math.max(solid.radiusTop, solid.radiusBottom)
    targetBox = new Box3(
      new Vector3(solid.x - radius, minY, solid.z - radius),
      new Vector3(solid.x + radius, maxY, solid.z + radius),
    )
  }
  const cameraBox = targetBox.clone().expandByScalar(CAMERA_CLEARANCE_RADIUS)
  const visibilityBox = targetBox.clone()
  if (solid.presentation?.role === 'gate') {
    // A closed progress gate owns the doorway even when the camera could
    // otherwise pitch over its visible top into the unrevealed room.
    cameraBox.min.y = -1_000_000
    cameraBox.max.y = 1_000_000
    visibilityBox.min.y = -1_000_000
    visibilityBox.max.y = 1_000_000
  }
  return { cameraBox, id: solid.id, targetBox, visibilityBox }
}

function rayBoxInterval(
  origin: Vector3,
  direction: Vector3,
  box: Box3,
): RayInterval | null {
  let minimum = Number.NEGATIVE_INFINITY
  let maximum = Number.POSITIVE_INFINITY
  for (const axis of ['x', 'y', 'z'] as const) {
    const axisDirection = direction[axis]
    const axisOrigin = origin[axis]
    const axisMinimum = box.min[axis]
    const axisMaximum = box.max[axis]
    if (Math.abs(axisDirection) <= Number.EPSILON) {
      if (axisOrigin < axisMinimum || axisOrigin > axisMaximum) return null
      continue
    }
    let entry = (axisMinimum - axisOrigin) / axisDirection
    let exit = (axisMaximum - axisOrigin) / axisDirection
    if (entry > exit) [entry, exit] = [exit, entry]
    minimum = Math.max(minimum, entry)
    maximum = Math.min(maximum, exit)
    if (minimum > maximum) return null
  }
  return { maximum, minimum }
}

function containsPoint(box: Box3, point: Vector3): boolean {
  return (
    point.x >= box.min.x - INTERVAL_EPSILON &&
    point.x <= box.max.x + INTERVAL_EPSILON &&
    point.y >= box.min.y - INTERVAL_EPSILON &&
    point.y <= box.max.y + INTERVAL_EPSILON &&
    point.z >= box.min.z - INTERVAL_EPSILON &&
    point.z <= box.max.z + INTERVAL_EPSILON
  )
}

/** Returns null when the origin is outside every authored camera volume. */
function continuousDistanceThroughVolumes(
  volumes: readonly Box3[],
  origin: Vector3,
  direction: Vector3,
  reach: number,
  initialEntryLimit = INTERVAL_EPSILON,
  initialVolumeIndices?: ReadonlySet<number>,
): number | null {
  const intervals = volumes
    .map((volume, index) => ({
      index,
      interval: rayBoxInterval(origin, direction, volume),
    }))
    .filter(
      (candidate): candidate is { index: number; interval: RayInterval } =>
        candidate.interval !== null &&
        candidate.interval.maximum >= -INTERVAL_EPSILON,
    )

  let continuousMaximum = Number.NEGATIVE_INFINITY
  for (const candidate of intervals) {
    if (
      initialVolumeIndices !== undefined &&
      !initialVolumeIndices.has(candidate.index)
    )
      continue
    if (candidate.interval.minimum > initialEntryLimit) continue
    continuousMaximum = Math.max(continuousMaximum, candidate.interval.maximum)
  }
  if (!Number.isFinite(continuousMaximum)) return null

  let extended = true
  while (extended) {
    extended = false
    for (const candidate of intervals) {
      if (
        candidate.interval.minimum > continuousMaximum + INTERVAL_EPSILON ||
        candidate.interval.maximum <= continuousMaximum
      )
        continue
      continuousMaximum = candidate.interval.maximum
      extended = true
    }
  }
  if (continuousMaximum >= reach) return reach
  return Math.max(0, continuousMaximum - SURFACE_INSET)
}

export interface EnclosureFraming {
  /** Adds a modest facing look-ahead while keeping the target in one connected volume. */
  frameTarget(
    bodyTarget: Vector3,
    facingYaw: number,
    activeSolidIds: readonly string[],
    result: Vector3,
  ): boolean
  /** Revalidates a smoothed target against the room union and physical solids. */
  constrainTarget(
    bodyTarget: Vector3,
    requestedTarget: Vector3,
    activeSolidIds: readonly string[],
    result: Vector3,
  ): boolean
  /** Restricts the boom to the continuous union starting at its target. */
  volumeDistance(
    origin: Vector3,
    direction: Vector3,
    reach: number,
  ): number | null
  /** Treats active authored walls and gates as camera-radius obstacles. */
  solidDistance(
    origin: Vector3,
    direction: Vector3,
    reach: number,
    activeSolidIds: readonly string[],
  ): number
  /** Checks a retained camera centre before using it as a zero-boom fallback. */
  cameraPositionSafe(
    target: Vector3,
    position: Vector3,
    activeSolidIds: readonly string[],
  ): boolean
}

export function createEnclosureFraming(
  level: LevelDefinition,
): EnclosureFraming | null {
  const volumePairs =
    level.presentation?.rooms
      .map((room) => room.cameraBounds)
      .filter((bounds): bounds is Bounds3 => bounds !== undefined)
      .map((bounds) => ({
        camera: shrinkCameraVolume(bounds),
        raw: boxFromBounds(bounds),
      }))
      .filter(
        (
          pair,
        ): pair is {
          camera: Box3
          raw: Box3
        } => pair.camera !== null,
      ) ?? []
  const rawVolumes = volumePairs.map((pair) => pair.raw)
  const cameraVolumes = volumePairs.map((pair) => pair.camera)
  if (cameraVolumes.length === 0) return null

  const solidObstacles: SolidObstacle[] = (level.solids ?? []).map(
    solidObstacle,
  )
  const desiredTarget = new Vector3()
  const targetDirection = new Vector3()

  function constrainTarget(
    bodyTarget: Vector3,
    requestedTarget: Vector3,
    activeSolidIds: readonly string[],
    result: Vector3,
  ): boolean {
    const containingRawVolumes = new Set<number>()
    for (let index = 0; index < rawVolumes.length; index++) {
      if (containsPoint(rawVolumes[index], bodyTarget))
        containingRawVolumes.add(index)
    }
    if (containingRawVolumes.size === 0) {
      result.copy(bodyTarget)
      return false
    }
    targetDirection.copy(requestedTarget).sub(bodyTarget)
    const requestedDistance = targetDirection.length()
    if (requestedDistance <= INTERVAL_EPSILON) {
      result.copy(bodyTarget)
      return true
    }
    targetDirection.multiplyScalar(1 / requestedDistance)
    const volumeDistance = continuousDistanceThroughVolumes(
      rawVolumes,
      bodyTarget,
      targetDirection,
      requestedDistance,
      INTERVAL_EPSILON,
      containingRawVolumes,
    )
    if (volumeDistance === null) {
      result.copy(bodyTarget)
      return false
    }
    let safeDistance = volumeDistance
    for (const obstacle of solidObstacles) {
      if (!activeSolidIds.includes(obstacle.id)) continue
      const interval = rayBoxInterval(
        bodyTarget,
        targetDirection,
        obstacle.targetBox,
      )
      if (interval === null || interval.maximum < 0) continue
      if (interval.minimum <= 0) safeDistance = 0
      else
        safeDistance = Math.min(
          safeDistance,
          Math.max(0, interval.minimum - SURFACE_INSET),
        )
    }
    result.copy(bodyTarget).addScaledVector(targetDirection, safeDistance)
    return true
  }

  return {
    frameTarget(bodyTarget, facingYaw, activeSolidIds, result) {
      desiredTarget.set(
        bodyTarget.x - Math.sin(facingYaw) * CAMERA_TARGET_LOOK_AHEAD,
        bodyTarget.y,
        bodyTarget.z - Math.cos(facingYaw) * CAMERA_TARGET_LOOK_AHEAD,
      )
      return constrainTarget(bodyTarget, desiredTarget, activeSolidIds, result)
    },
    constrainTarget,
    volumeDistance(origin, direction, reach) {
      const containingRawVolumes = new Set<number>()
      for (let index = 0; index < rawVolumes.length; index++) {
        if (containsPoint(rawVolumes[index], origin))
          containingRawVolumes.add(index)
      }
      if (containingRawVolumes.size === 0) return null
      return (
        continuousDistanceThroughVolumes(
          cameraVolumes,
          origin,
          direction,
          reach,
          CAMERA_CLEARANCE_RADIUS * Math.sqrt(3) + SURFACE_INSET,
          containingRawVolumes,
        ) ?? 0
      )
    },
    solidDistance(origin, direction, reach, activeSolidIds) {
      let visibilityDistance = reach
      const forbidden: RayInterval[] = []
      for (const obstacle of solidObstacles) {
        if (!activeSolidIds.includes(obstacle.id)) continue
        const visibilityInterval = rayBoxInterval(
          origin,
          direction,
          obstacle.visibilityBox,
        )
        if (visibilityInterval !== null && visibilityInterval.maximum >= 0) {
          if (visibilityInterval.minimum <= 0) visibilityDistance = 0
          else
            visibilityDistance = Math.min(
              visibilityDistance,
              Math.max(0, visibilityInterval.minimum - SURFACE_INSET),
            )
        }
        const cameraInterval = rayBoxInterval(
          origin,
          direction,
          obstacle.cameraBox,
        )
        if (cameraInterval !== null && cameraInterval.maximum >= 0)
          forbidden.push(cameraInterval)
      }
      let safeDistance = visibilityDistance
      let changed = true
      while (changed && safeDistance > 0) {
        changed = false
        for (const interval of forbidden) {
          if (
            safeDistance < interval.minimum - INTERVAL_EPSILON ||
            safeDistance > interval.maximum + INTERVAL_EPSILON
          )
            continue
          safeDistance = Math.max(0, interval.minimum - SURFACE_INSET)
          changed = true
        }
      }
      return safeDistance
    },
    cameraPositionSafe(target, position, activeSolidIds) {
      targetDirection.copy(position).sub(target)
      const candidateDistance = targetDirection.length()
      if (candidateDistance <= INTERVAL_EPSILON) return false
      targetDirection.multiplyScalar(1 / candidateDistance)
      const volumeDistance = this.volumeDistance(
        target,
        targetDirection,
        candidateDistance,
      )
      if (
        volumeDistance === null ||
        volumeDistance < candidateDistance - INTERVAL_EPSILON
      )
        return false
      return (
        this.solidDistance(
          target,
          targetDirection,
          candidateDistance,
          activeSolidIds,
        ) >=
        candidateDistance - INTERVAL_EPSILON
      )
    },
  }
}
