// ============================================================
// Cloudway platform culling — expanded camera visibility with conservative shadow reach.
// ============================================================
//
// Platform donors are much larger than their collision decks and every donor
// casts a directional shadow. A platform is therefore removable only when
// neither its final art bounds nor its shadow sweep onto an installed receiver
// can reach the camera's fog-visible volume.

import type { InstancedMesh, Mesh, Object3D, PerspectiveCamera } from 'three'
import { Box3, Frustum, Matrix4, Vector3 } from 'three'
import type { Vec3 } from '../contracts'
import { CLOUDWAY_FOG_FAR } from './cloudway-scene'

export const CLOUDWAY_PLATFORM_FOG_CULL_MARGIN = 2
export const CLOUDWAY_PLATFORM_FRUSTUM_CULL_MARGIN = 1.25

const DEFAULT_CULL_DISTANCE =
  CLOUDWAY_FOG_FAR + CLOUDWAY_PLATFORM_FOG_CULL_MARGIN
const MINIMUM_DOWNWARD_LIGHT = 1e-5
const MINIMUM_DIRECTION_COMPONENT = 1e-8

interface CloudwayPlatformViewSelectorOptions {
  frustumMargin?: number
  maxDistance?: number
  shadowDirection: Vec3
  shadowReceiverMinimumY: number
}

function isFiniteBox(bounds: Box3): boolean {
  return (
    Number.isFinite(bounds.min.x) &&
    Number.isFinite(bounds.min.y) &&
    Number.isFinite(bounds.min.z) &&
    Number.isFinite(bounds.max.x) &&
    Number.isFinite(bounds.max.y) &&
    Number.isFinite(bounds.max.z)
  )
}

interface SweepInterval {
  enter: number
  exit: number
}

function restrictSweepAxis(
  casterMin: number,
  casterMax: number,
  receiverMin: number,
  receiverMax: number,
  velocity: number,
  interval: SweepInterval,
): boolean {
  if (Math.abs(velocity) < MINIMUM_DIRECTION_COMPONENT)
    return casterMax >= receiverMin && casterMin <= receiverMax
  let axisEnter = (receiverMin - casterMax) / velocity
  let axisExit = (receiverMax - casterMin) / velocity
  if (axisEnter > axisExit) [axisEnter, axisExit] = [axisExit, axisEnter]
  interval.enter = Math.max(interval.enter, axisEnter)
  interval.exit = Math.min(interval.exit, axisExit)
  return interval.enter <= interval.exit && interval.exit >= 0
}

/** Bounds the actual receiver contact of a box translated along one ray. */
function shadowSweepReceiverIntersection(
  caster: Box3,
  receiver: Box3,
  direction: Vector3,
  interval: SweepInterval,
  offset: Vector3,
  translated: Box3,
  intersection: Box3,
): boolean {
  interval.enter = 0
  interval.exit = Number.POSITIVE_INFINITY
  if (
    !restrictSweepAxis(
      caster.min.x,
      caster.max.x,
      receiver.min.x,
      receiver.max.x,
      direction.x,
      interval,
    ) ||
    !restrictSweepAxis(
      caster.min.y,
      caster.max.y,
      receiver.min.y,
      receiver.max.y,
      direction.y,
      interval,
    ) ||
    !restrictSweepAxis(
      caster.min.z,
      caster.max.z,
      receiver.min.z,
      receiver.max.z,
      direction.z,
      interval,
    )
  )
    return false

  offset.copy(direction).multiplyScalar(Math.max(0, interval.enter))
  intersection.copy(caster).translate(offset).intersect(receiver)
  offset.copy(direction).multiplyScalar(interval.exit)
  translated.copy(caster).translate(offset).intersect(receiver)
  intersection.union(translated)
  return !intersection.isEmpty()
}

export interface CloudwayPlatformViewSelector {
  update(
    camera: PerspectiveCamera | undefined,
    shadowReceiverBounds?: readonly Box3[],
  ): void
  includes(bounds: Box3): boolean
}

/** Collects every installed museum mesh that can receive a platform shadow. */
export function collectShadowReceiverBounds(
  root: Object3D,
  excludedRoot?: Object3D,
  target: Box3[] = [],
): Box3[] {
  const instanceMatrix = new Matrix4()
  const instanceWorldMatrix = new Matrix4()
  const worldBounds = new Box3()
  target.length = 0
  root.updateWorldMatrix(true, true)
  for (const child of root.children) {
    if (child === excludedRoot) continue
    child.traverse((candidate) => {
      const mesh = candidate as Mesh
      if (!mesh.isMesh || !mesh.receiveShadow) return
      if ((mesh as InstancedMesh).isInstancedMesh) {
        const instanced = mesh as InstancedMesh
        if (instanced.count === 0) return
        instanced.geometry.computeBoundingBox()
        const localBounds = instanced.geometry.boundingBox
        if (localBounds === null || localBounds.isEmpty()) return
        for (let index = 0; index < instanced.count; index++) {
          instanced.getMatrixAt(index, instanceMatrix)
          instanceWorldMatrix.multiplyMatrices(
            instanced.matrixWorld,
            instanceMatrix,
          )
          target.push(
            worldBounds
              .copy(localBounds)
              .applyMatrix4(instanceWorldMatrix)
              .clone(),
          )
        }
        return
      }
      mesh.geometry.computeBoundingBox()
      const localBounds = mesh.geometry.boundingBox
      if (localBounds === null || localBounds.isEmpty()) return
      worldBounds.copy(localBounds).applyMatrix4(mesh.matrixWorld)
      target.push(worldBounds.clone())
    })
  }
  return target
}

/**
 * One selector belongs to one renderer so its scratch bounds stay allocation
 * free while the camera and moving platform transforms change every frame.
 */
export function createCloudwayPlatformViewSelector(
  options: CloudwayPlatformViewSelectorOptions,
): CloudwayPlatformViewSelector {
  const frustumMargin = Math.max(
    0,
    options.frustumMargin ?? CLOUDWAY_PLATFORM_FRUSTUM_CULL_MARGIN,
  )
  const maxDistance = Math.max(0, options.maxDistance ?? DEFAULT_CULL_DISTANCE)
  const fallbackReceiverMinimumY = Number.isFinite(
    options.shadowReceiverMinimumY,
  )
    ? options.shadowReceiverMinimumY
    : Number.NEGATIVE_INFINITY
  const shadowDirection = new Vector3(
    options.shadowDirection.x,
    options.shadowDirection.y,
    options.shadowDirection.z,
  )
  const validShadowDirection =
    Number.isFinite(shadowDirection.x) &&
    Number.isFinite(shadowDirection.y) &&
    Number.isFinite(shadowDirection.z) &&
    shadowDirection.lengthSq() > 0
  if (validShadowDirection) shadowDirection.normalize()
  const canBoundShadowReach =
    validShadowDirection && shadowDirection.y < -MINIMUM_DOWNWARD_LIGHT

  const viewpoint = new Vector3()
  const viewProjection = new Matrix4()
  const frustum = new Frustum()
  const sweepInterval: SweepInterval = {
    enter: 0,
    exit: Number.POSITIVE_INFINITY,
  }
  const shadowOffset = new Vector3()
  const translatedBounds = new Box3()
  const sweptShadowBounds = new Box3()
  const visibleReceiverBounds: Box3[] = []
  let cameraReady = false
  let measuredReceiversReady = false

  function intersectsVisibleVolume(candidate: Box3): boolean {
    return (
      candidate.distanceToPoint(viewpoint) <= maxDistance &&
      frustum.intersectsBox(candidate)
    )
  }

  return {
    update(camera, shadowReceiverBounds): void {
      if (camera === undefined) {
        cameraReady = false
        return
      }
      camera.updateMatrixWorld(true)
      viewProjection.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      )
      if (
        !Number.isFinite(camera.position.x) ||
        !Number.isFinite(camera.position.y) ||
        !Number.isFinite(camera.position.z) ||
        !viewProjection.elements.every(Number.isFinite)
      ) {
        cameraReady = false
        return
      }
      viewpoint.copy(camera.position)
      frustum.setFromProjectionMatrix(viewProjection)
      for (const plane of frustum.planes) plane.constant += frustumMargin
      cameraReady = true
      measuredReceiversReady = shadowReceiverBounds !== undefined
      visibleReceiverBounds.length = 0
      for (const receiver of shadowReceiverBounds ?? []) {
        if (receiver.isEmpty() || !isFiniteBox(receiver)) {
          measuredReceiversReady = false
          visibleReceiverBounds.length = 0
          break
        }
        if (intersectsVisibleVolume(receiver))
          visibleReceiverBounds.push(receiver)
      }
    },
    includes(bounds): boolean {
      if (!cameraReady) return true
      if (bounds.isEmpty()) return false
      if (intersectsVisibleVolume(bounds)) return true

      // If the authored light cannot be bounded safely, retain the caster.
      // Cloudway's real key light points downward, so this is only a guard for
      // malformed or future lighting rather than a cost in the shipped route.
      if (!canBoundShadowReach) return true
      if (measuredReceiversReady) {
        for (const receiver of visibleReceiverBounds) {
          if (
            shadowSweepReceiverIntersection(
              bounds,
              receiver,
              shadowDirection,
              sweepInterval,
              shadowOffset,
              translatedBounds,
              sweptShadowBounds,
            ) &&
            intersectsVisibleVolume(sweptShadowBounds)
          )
            return true
        }
        return false
      }
      // Missing or malformed receiver data keeps the earlier world-bound
      // fallback rather than risking a visible shadow disappearing.
      if (!Number.isFinite(fallbackReceiverMinimumY)) return true
      const drop = Math.max(0, bounds.max.y - fallbackReceiverMinimumY)
      const travel = drop / -shadowDirection.y
      shadowOffset.copy(shadowDirection).multiplyScalar(travel)
      translatedBounds.copy(bounds).translate(shadowOffset)
      sweptShadowBounds.copy(bounds).union(translatedBounds)
      return intersectsVisibleVolume(sweptShadowBounds)
    },
  }
}
