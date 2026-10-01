// Camera obstruction queries — bounds-first boom clearance with optional visible-mesh fallback.

import type { Object3D } from 'three'
import { Ray, Raycaster, Vector3 } from 'three'
import type { LevelDefinition } from '../contracts'
import { createCameraPlatformOcclusion } from './camera-platform-occlusion'
import { ENCLOSURE_DISTANCE_RECOVERY_RESPONSE, ENCLOSURE_LATERAL_BOOM_MAX_YAW, ENCLOSURE_LATERAL_BOOM_RETRY_ANGLE, ENCLOSURE_LATERAL_BOOM_RETRY_DISTANCE, ENCLOSURE_LATERAL_BOOM_RETRY_SECONDS, ENCLOSURE_LATERAL_BOOM_SEARCH_STEPS, ENCLOSURE_OBSTRUCTION_RELEASE_DISTANCE, ENCLOSURE_READABLE_BOOM_DISTANCE, FOLLOW_COMPLETE_RADIANS, MAXIMUM_FOLLOW_RADIANS_PER_SECOND, OBSTRUCTION_LIFT_PITCHES, } from './camera-policy'
import type { createEnclosureFraming, EnclosureRayPurpose, } from './enclosure-framing'
import { MINIMUM_THIRD_PERSON_REACH } from './third-person-framing'

const PLACEMENT_COMPARISON_EPSILON = 0.0001
const PLACEMENT_EPSILON = 0.05
const RETAINED_WAYPOINT_AXES = [
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
  { x: 0, z: -1 },
] as const

export function createCameraObstruction(
  level: LevelDefinition,
  enclosure: ReturnType<typeof createEnclosureFraming>,
) {
  const { obstacles, updatePlatformStates, useMeshOccludersAt } =
    createCameraPlatformOcclusion(level)
  const hit = new Vector3()
  const ray = new Ray()
  const raycaster = new Raycaster()
  const candidateCameraDelta = new Vector3()
  const candidatePosition = new Vector3()
  const candidateRetainedPosition = new Vector3()
  const candidateRetainedTarget = new Vector3()
  const chosenRetainedPosition = new Vector3()
  const desiredRetainedPosition = new Vector3()
  const desiredRetainedTarget = new Vector3()
  const lateralDirection = new Vector3()
  const chosenLateralDirection = new Vector3()
  const failedRecoveryOrigin = new Vector3()
  const retainedDirection = new Vector3()
  const retainedPosition = new Vector3()
  const retainedSubjectTarget = new Vector3()
  const retainedTarget = new Vector3()
  const retainedTargetDelta = new Vector3()
  let hasRetainedPosition = false
  let retainedViewActive = false
  let retainedWaypointAxisIndex = -1
  let lateralYawOffset = 0
  let readableRecoveryPending = false
  let preferredLateralSign: -1 | 1 = 1
  let failedRecoveryActiveSolidIds: readonly string[] = []
  let failedRecoveryEnabledPlatformIds: readonly string[] = []
  let failedRecoveryElapsed = ENCLOSURE_LATERAL_BOOM_RETRY_SECONDS
  let failedRecoveryPitch = 0
  let failedRecoveryReach = 0
  let failedRecoveryValid = false
  let failedRecoveryYaw = 0
  let occluders: Object3D[] = []

  function sameIds(
    first: readonly string[],
    second: readonly string[],
  ): boolean {
    return (
      first.length === second.length &&
      first.every((value, index) => value === second[index])
    )
  }

  function clearFailedRecovery(): void {
    failedRecoveryElapsed = ENCLOSURE_LATERAL_BOOM_RETRY_SECONDS
    failedRecoveryValid = false
  }

  function safeRayDistance(
    origin: Vector3,
    rayDirection: Vector3,
    reach: number,
    _enabledPlatformIds: readonly string[],
    activeSolidIds: readonly string[],
    constrainToEnclosure: boolean,
    useMeshOccluders = true,
    purpose: EnclosureRayPurpose = 'camera-clearance',
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
        enclosure.solidDistance(
          origin,
          rayDirection,
          reach,
          activeSolidIds,
          purpose,
        ),
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

  function recoverLateralBoomDistance(options: {
    origin: Vector3
    yaw: number
    pitch: number
    reach: number
    enabledPlatformIds: readonly string[]
    activeSolidIds: readonly string[]
    constrainToEnclosure: boolean
    useMeshOccluders: boolean
    canonicalDistance: number
    deltaSeconds: number
    boomDirection: Vector3
  }): number {
    if (!options.constrainToEnclosure) {
      lateralYawOffset = 0
      readableRecoveryPending = false
      clearFailedRecovery()
      return options.canonicalDistance
    }
    const readableDistance = Math.min(
      options.reach,
      ENCLOSURE_READABLE_BOOM_DISTANCE,
    )
    const probe = (offset: number): number => {
      const boundsDistance = safeBoomDistance(
        options.origin,
        options.yaw + offset,
        options.pitch,
        options.reach,
        options.enabledPlatformIds,
        options.activeSolidIds,
        true,
        false,
        lateralDirection,
      )
      if (!options.useMeshOccluders || boundsDistance < readableDistance)
        return boundsDistance
      return safeBoomDistance(
        options.origin,
        options.yaw + offset,
        options.pitch,
        options.reach,
        options.enabledPlatformIds,
        options.activeSolidIds,
        true,
        true,
        lateralDirection,
      )
    }
    let lostReadableLateralBoom = false
    if (lateralYawOffset !== 0) {
      const releaseDistance = Math.min(
        options.reach,
        ENCLOSURE_OBSTRUCTION_RELEASE_DISTANCE,
      )
      if (options.canonicalDistance >= releaseDistance) {
        const easedOffset =
          lateralYawOffset *
          Math.exp(-ENCLOSURE_DISTANCE_RECOVERY_RESPONSE * options.deltaSeconds)
        if (Math.abs(easedOffset) <= FOLLOW_COMPLETE_RADIANS) {
          lateralYawOffset = 0
          readableRecoveryPending = false
          clearFailedRecovery()
          return options.canonicalDistance
        }
        const easedDistance = probe(easedOffset)
        if (easedDistance >= readableDistance) {
          lateralYawOffset = easedOffset
          readableRecoveryPending = false
          clearFailedRecovery()
          options.boomDirection.copy(lateralDirection)
          return easedDistance
        }
      }
      const retainedDistance = probe(lateralYawOffset)
      if (retainedDistance >= readableDistance) {
        readableRecoveryPending = false
        clearFailedRecovery()
        options.boomDirection.copy(lateralDirection)
        return retainedDistance
      }
      lateralYawOffset = 0
      clearFailedRecovery()
      readableRecoveryPending = true
      lostReadableLateralBoom = true
    }
    if (options.canonicalDistance >= readableDistance) {
      readableRecoveryPending = false
      clearFailedRecovery()
      return options.canonicalDistance
    }
    if (
      options.canonicalDistance >= MINIMUM_THIRD_PERSON_REACH &&
      !lostReadableLateralBoom &&
      !readableRecoveryPending
    ) {
      clearFailedRecovery()
      return options.canonicalDistance
    }

    const poseUnchanged =
      failedRecoveryValid &&
      failedRecoveryOrigin.distanceToSquared(options.origin) <=
        ENCLOSURE_LATERAL_BOOM_RETRY_DISTANCE ** 2 &&
      Math.abs(failedRecoveryYaw - options.yaw) <=
        ENCLOSURE_LATERAL_BOOM_RETRY_ANGLE &&
      Math.abs(failedRecoveryPitch - options.pitch) <=
        ENCLOSURE_LATERAL_BOOM_RETRY_ANGLE &&
      Math.abs(failedRecoveryReach - options.reach) <=
        ENCLOSURE_LATERAL_BOOM_RETRY_DISTANCE &&
      sameIds(failedRecoveryEnabledPlatformIds, options.enabledPlatformIds) &&
      sameIds(failedRecoveryActiveSolidIds, options.activeSolidIds)
    if (poseUnchanged) {
      failedRecoveryElapsed += Math.max(0, options.deltaSeconds)
      if (failedRecoveryElapsed < ENCLOSURE_LATERAL_BOOM_RETRY_SECONDS)
        return options.canonicalDistance
    }

    const stepYaw =
      ENCLOSURE_LATERAL_BOOM_MAX_YAW / ENCLOSURE_LATERAL_BOOM_SEARCH_STEPS
    const signs: readonly (-1 | 1)[] = [
      preferredLateralSign,
      preferredLateralSign === 1 ? -1 : 1,
    ]
    for (let step = 1; step <= ENCLOSURE_LATERAL_BOOM_SEARCH_STEPS; step++) {
      let chosenDistance = -Infinity
      let chosenOffset = 0
      for (const sign of signs) {
        const offset = sign * stepYaw * step
        const distance = probe(offset)
        if (distance < readableDistance || distance <= chosenDistance) continue
        chosenDistance = distance
        chosenOffset = offset
        chosenLateralDirection.copy(lateralDirection)
      }
      if (chosenOffset === 0) continue
      lateralYawOffset = chosenOffset
      readableRecoveryPending = false
      preferredLateralSign = chosenOffset < 0 ? -1 : 1
      clearFailedRecovery()
      options.boomDirection.copy(chosenLateralDirection)
      return chosenDistance
    }
    failedRecoveryOrigin.copy(options.origin)
    failedRecoveryYaw = options.yaw
    failedRecoveryPitch = options.pitch
    failedRecoveryReach = options.reach
    failedRecoveryEnabledPlatformIds = [...options.enabledPlatformIds]
    failedRecoveryActiveSolidIds = [...options.activeSolidIds]
    failedRecoveryElapsed = 0
    failedRecoveryValid = true
    return options.canonicalDistance
  }

  function resolveBoomDistance(
    origin: Vector3,
    yaw: number,
    pitch: number,
    reach: number,
    enabledPlatformIds: readonly string[],
    activeSolidIds: readonly string[],
    constrainToEnclosure: boolean,
    useMeshOccluders: boolean,
    deltaSeconds: number,
    boomDirection: Vector3,
  ): number {
    const canonicalDistance = safeBoomDistance(
      origin,
      yaw,
      pitch,
      reach,
      enabledPlatformIds,
      activeSolidIds,
      constrainToEnclosure,
      useMeshOccluders,
      boomDirection,
    )
    return recoverLateralBoomDistance({
      origin,
      yaw,
      pitch,
      reach,
      enabledPlatformIds,
      activeSolidIds,
      constrainToEnclosure,
      useMeshOccluders,
      canonicalDistance,
      deltaSeconds,
      boomDirection,
    })
  }

  function meshPathClear(
    origin: Vector3,
    rayDirection: Vector3,
    reach: number,
    useMeshOccluders: boolean,
  ): boolean {
    if (!useMeshOccluders) return true
    raycaster.set(origin, rayDirection)
    raycaster.far = reach
    return raycaster.intersectObjects(occluders, false).length === 0
  }

  function placeCameraPosition(options: {
    position: Vector3
    target: Vector3
    boomDirection: Vector3
    renderedDistance: number
    safeDistance: number
    subjectTarget: Vector3
    activeSolidIds: readonly string[]
    constrainToEnclosure: boolean
    deltaSeconds: number
    useMeshOccluders: boolean
  }): number | null {
    options.position
      .copy(options.target)
      .addScaledVector(options.boomDirection, options.renderedDistance)
    if (!options.constrainToEnclosure || enclosure === null) {
      hasRetainedPosition = false
      return null
    }
    const viewSafeFrom = (
      viewTarget: Vector3,
      position: Vector3,
      minimumDistance: number,
    ): boolean => {
      retainedDirection.copy(position).sub(viewTarget)
      const distance = retainedDirection.length()
      if (
        distance < minimumDistance ||
        !enclosure.cameraViewSafe(viewTarget, position, options.activeSolidIds)
      )
        return false
      retainedDirection.multiplyScalar(1 / distance)
      if (
        !meshPathClear(
          viewTarget,
          retainedDirection,
          distance,
          options.useMeshOccluders,
        )
      )
        return false
      return true
    }
    const retainedOutputSafe = (
      viewTarget: Vector3,
      position: Vector3,
    ): boolean =>
      viewSafeFrom(viewTarget, position, ENCLOSURE_READABLE_BOOM_DISTANCE) &&
      viewSafeFrom(options.subjectTarget, position, PLACEMENT_EPSILON)
    const retainedCameraPathSafe = (position: Vector3): boolean => {
      candidateCameraDelta.copy(position).sub(retainedPosition)
      const distance = candidateCameraDelta.length()
      if (distance <= PLACEMENT_COMPARISON_EPSILON) return true
      candidateCameraDelta.multiplyScalar(1 / distance)
      return (
        enclosure.cameraTravelSafe(
          retainedPosition,
          position,
          options.activeSolidIds,
        ) &&
        meshPathClear(
          retainedPosition,
          candidateCameraDelta,
          distance,
          options.useMeshOccluders,
        )
      )
    }
    const retain = (viewTarget: Vector3, position: Vector3): void => {
      retainedPosition.copy(position)
      retainedSubjectTarget.copy(options.subjectTarget)
      retainedTarget.copy(viewTarget)
      hasRetainedPosition = true
    }
    const maximumRetainedPlacementStep = (): number =>
      retainedSubjectTarget.distanceTo(options.subjectTarget) +
      options.safeDistance *
        MAXIMUM_FOLLOW_RADIANS_PER_SECOND *
        Math.max(0, options.deltaSeconds)
    const retainedHandoffRequired = (
      requestedTarget: Vector3,
      requestedPosition: Vector3,
    ): boolean => {
      if (!hasRetainedPosition) return false
      const maximumStep = maximumRetainedPlacementStep()
      return (
        retainedViewActive ||
        retainedTarget.distanceTo(requestedTarget) > maximumStep ||
        retainedPosition.distanceTo(requestedPosition) > maximumStep
      )
    }
    const placeRetainedToward = (
      requestedTarget: Vector3,
      requestedPosition: Vector3,
      canonicalDestination: boolean,
    ): boolean => {
      if (!hasRetainedPosition) return false
      desiredRetainedTarget.copy(requestedTarget)
      desiredRetainedPosition.copy(requestedPosition)
      retainedTargetDelta.copy(desiredRetainedTarget).sub(retainedTarget)
      candidateCameraDelta.copy(desiredRetainedPosition).sub(retainedPosition)
      const targetDistance = retainedTargetDelta.length()
      const cameraDistance = candidateCameraDelta.length()
      const maximumPlacementStep = maximumRetainedPlacementStep()
      const maximumTargetAlpha =
        targetDistance <= PLACEMENT_COMPARISON_EPSILON
          ? 1
          : Math.min(1, maximumPlacementStep / targetDistance)
      const maximumCameraAlpha =
        cameraDistance <= PLACEMENT_COMPARISON_EPSILON
          ? 1
          : Math.min(1, maximumPlacementStep / cameraDistance)
      for (
        let targetStep = ENCLOSURE_LATERAL_BOOM_SEARCH_STEPS;
        targetStep > 0;
        targetStep--
      ) {
        const targetAlpha =
          (maximumTargetAlpha * targetStep) /
          ENCLOSURE_LATERAL_BOOM_SEARCH_STEPS
        candidateRetainedTarget.lerpVectors(
          retainedTarget,
          desiredRetainedTarget,
          targetAlpha,
        )
        for (
          let cameraStep = ENCLOSURE_LATERAL_BOOM_SEARCH_STEPS;
          cameraStep > 0;
          cameraStep--
        ) {
          const cameraAlpha =
            (maximumCameraAlpha * cameraStep) /
            ENCLOSURE_LATERAL_BOOM_SEARCH_STEPS
          candidateRetainedPosition.lerpVectors(
            retainedPosition,
            desiredRetainedPosition,
            cameraAlpha,
          )
          if (
            !retainedCameraPathSafe(candidateRetainedPosition) ||
            !retainedOutputSafe(
              candidateRetainedTarget,
              candidateRetainedPosition,
            )
          )
            continue
          const reachedDesired =
            candidateRetainedTarget.distanceTo(desiredRetainedTarget) <=
              PLACEMENT_EPSILON &&
            candidateRetainedPosition.distanceTo(desiredRetainedPosition) <=
              PLACEMENT_EPSILON
          options.target.copy(candidateRetainedTarget)
          options.position.copy(candidateRetainedPosition)
          retain(candidateRetainedTarget, candidateRetainedPosition)
          retainedViewActive = !canonicalDestination || !reachedDesired
          retainedWaypointAxisIndex = -1
          return true
        }
      }
      if (maximumPlacementStep > PLACEMENT_COMPARISON_EPSILON) {
        for (
          let targetStep = ENCLOSURE_LATERAL_BOOM_SEARCH_STEPS;
          targetStep > 0;
          targetStep--
        ) {
          const targetAlpha =
            (maximumTargetAlpha * targetStep) /
            ENCLOSURE_LATERAL_BOOM_SEARCH_STEPS
          candidateRetainedTarget.lerpVectors(
            retainedTarget,
            desiredRetainedTarget,
            targetAlpha,
          )
          let chosenDistance = Infinity
          let chosenAxisIndex = -1
          for (
            let axisIndex = 0;
            axisIndex < RETAINED_WAYPOINT_AXES.length;
            axisIndex++
          ) {
            const axis = RETAINED_WAYPOINT_AXES[axisIndex]
            candidateRetainedPosition.set(
              retainedPosition.x + axis.x * maximumPlacementStep,
              retainedPosition.y,
              retainedPosition.z + axis.z * maximumPlacementStep,
            )
            if (
              !retainedCameraPathSafe(candidateRetainedPosition) ||
              !retainedOutputSafe(
                candidateRetainedTarget,
                candidateRetainedPosition,
              )
            )
              continue
            if (axisIndex === retainedWaypointAxisIndex) {
              chosenAxisIndex = axisIndex
              chosenRetainedPosition.copy(candidateRetainedPosition)
              break
            }
            const distance = candidateRetainedPosition.distanceToSquared(
              desiredRetainedPosition,
            )
            if (distance >= chosenDistance) continue
            chosenDistance = distance
            chosenAxisIndex = axisIndex
            chosenRetainedPosition.copy(candidateRetainedPosition)
          }
          if (chosenAxisIndex < 0) continue
          options.target.copy(candidateRetainedTarget)
          options.position.copy(chosenRetainedPosition)
          retain(candidateRetainedTarget, chosenRetainedPosition)
          retainedViewActive = true
          retainedWaypointAxisIndex = chosenAxisIndex
          return true
        }
      }
      if (!retainedOutputSafe(retainedTarget, retainedPosition)) return false
      options.target.copy(retainedTarget)
      options.position.copy(retainedPosition)
      retainedSubjectTarget.copy(options.subjectTarget)
      retainedViewActive = true
      return true
    }
    const recoveryPositionAt = (distance: number): boolean => {
      candidatePosition
        .copy(options.target)
        .addScaledVector(options.boomDirection, distance)
      return enclosure.cameraPositionSafe(
        options.target,
        candidatePosition,
        options.activeSolidIds,
      )
    }
    const readableDistance = Math.min(
      options.safeDistance,
      ENCLOSURE_READABLE_BOOM_DISTANCE,
    )
    const candidateSafe =
      options.renderedDistance > PLACEMENT_EPSILON &&
      enclosure.cameraPositionSafe(
        options.target,
        options.position,
        options.activeSolidIds,
      )
    if (candidateSafe) {
      if (options.renderedDistance >= ENCLOSURE_READABLE_BOOM_DISTANCE) {
        if (
          retainedHandoffRequired(options.target, options.position) &&
          placeRetainedToward(options.target, options.position, true)
        )
          return null
        if (retainedOutputSafe(options.target, options.position))
          retain(options.target, options.position)
        retainedViewActive = false
        retainedWaypointAxisIndex = -1
        return null
      }
    }

    if (
      readableDistance >= ENCLOSURE_READABLE_BOOM_DISTANCE &&
      recoveryPositionAt(readableDistance)
    ) {
      if (placeRetainedToward(options.target, candidatePosition, true))
        return retainedViewActive ? null : readableDistance
      options.position.copy(candidatePosition)
      if (retainedOutputSafe(options.target, candidatePosition))
        retain(options.target, candidatePosition)
      retainedViewActive = false
      retainedWaypointAxisIndex = -1
      return readableDistance
    }

    if (hasRetainedPosition) {
      desiredRetainedPosition
        .copy(retainedPosition)
        .add(options.target)
        .sub(retainedTarget)
      if (placeRetainedToward(options.target, desiredRetainedPosition, false))
        return null
    }
    if (candidateSafe) return null
    if (
      options.safeDistance >
        options.renderedDistance + PLACEMENT_COMPARISON_EPSILON &&
      recoveryPositionAt(options.safeDistance)
    ) {
      options.position.copy(candidatePosition)
      return options.safeDistance
    }
    return null
  }

  function resetCameraPlacement(): void {
    hasRetainedPosition = false
    retainedViewActive = false
    retainedWaypointAxisIndex = -1
  }

  return {
    safeRayDistance,
    safeBoomDistance,
    resolveBoomDistance,
    placeCameraPosition,
    resetCameraPlacement,
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
    meshPathClear,
    setOccluders(objects: Object3D[]): void {
      if (objects === occluders) return
      const changed =
        objects.length !== occluders.length ||
        objects.some((object, index) => object !== occluders[index])
      occluders = objects
      if (changed) clearFailedRecovery()
    },
    updatePlatformStates,
    useMeshOccludersAt,
  }
}
