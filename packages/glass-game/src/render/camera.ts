// ============================================================
// Adventure camera — a player-owned orbit with bounded floor obstruction.
// ============================================================

import type { Object3D } from 'three'
import { MathUtils, PerspectiveCamera, Ray, Raycaster, Vector3 } from 'three'
import type { GameSnapshot, LevelDefinition, MovementReferenceKind, } from '../contracts'
import { shortestAngleDelta, stepAngularResponse, stopAngularResponse, } from './angular-response'
import { createCameraHeadingIntent } from './camera-heading-intent'
import { createCameraPlatformOcclusion } from './camera-platform-occlusion'
import type { AdventureCameraOptions, ChallengeCameraMetrics, } from './camera-policy'
import { addFiniteOffset, createFallbackChallengeSubjects, ENCLOSURE_DISTANCE_RECOVERY_RESPONSE, ENCLOSURE_OBSTRUCTION_RELEASE_DISTANCE, ENCLOSURE_OBSTRUCTION_TRIGGER_DISTANCE, ENCLOSURE_READABLE_BOOM_DISTANCE, EXPLORATION_FOV_DEGREES, FOLLOW_COMPLETE_RADIANS, frameUnion, MAXIMUM_FOLLOW_RADIANS_PER_SECOND, MAXIMUM_OBSTRUCTION_PITCH, MOVING_SPEED, OBSTRUCTION_LIFT_PITCHES, OBSTRUCTION_LIFT_RESPONSE, OBSTRUCTION_RELEASE_DISTANCE, OBSTRUCTION_TRIGGER_DISTANCE, ORBIT_FOLLOW_GRACE_SECONDS, selectFocusedChallengeId, validFollowSmoothness, validRouteYaw, } from './camera-policy'
import type { ChallengeCameraScreenFrame, ChallengeCameraShot, ChallengeCameraSubjects, } from './challenge-camera'
import { createChallengeCameraDirector, planChallengeCameraShot, projectChallengeBounds, } from './challenge-camera'
import { createEnclosureFraming } from './enclosure-framing'
import { createRouteCameraDirector } from './route-camera'

export {
  CAMERA_FOLLOW_SMOOTHNESS,
  cameraRelativeMovement,
} from './camera-policy'
export type {
  AdventureCameraOptions,
  ChallengeCameraMetrics,
} from './camera-policy'

export function createAdventureCamera(
  level: LevelDefinition,
  options: AdventureCameraOptions = {},
) {
  const camera = new PerspectiveCamera(EXPLORATION_FOV_DEGREES, 1, 0.05, 180)
  const routeDirector = createRouteCameraDirector(level.camera)
  let activeRouteSection = routeDirector.section()
  const target = new Vector3()
    .copy(level.spawn.position)
    .add(new Vector3(0, 0.42, 0))
  addFiniteOffset(target, activeRouteSection?.targetOffset)
  const renderedTarget = target.clone()
  const bodyTarget = new Vector3()
  const desired = new Vector3()
  const direction = new Vector3()
  const retainedDirection = new Vector3()
  const retainedPosition = new Vector3()
  const hit = new Vector3()
  const ray = new Ray()
  const raycaster = new Raycaster()
  const challengeDirection = new Vector3()
  const challengePosition = new Vector3()
  const challengeReturnOffset = new Vector3()
  let occluders: Object3D[] = []
  let yaw =
    options.reducedMotion === true
      ? level.spawn.facingYaw
      : (validRouteYaw(activeRouteSection) ?? level.spawn.facingYaw)
  const followResponse = { angle: yaw, velocity: 0 }
  const headingIntent = createCameraHeadingIntent()
  let followSmoothnessSeconds = validFollowSmoothness(
    options.followSmoothnessSeconds,
  )
  let pitch = 0.36
  let renderedPitch = pitch
  let distance = 4
  let facing = level.spawn.facingYaw
  // Movement keeps a stable heading between deliberate input choices. Feeding
  // every following view frame back into input would turn a strafe into a
  // self-reinforcing circle.
  let movementReferenceYaw = yaw
  let orbitQuietSeconds = ORBIT_FOLLOW_GRACE_SECONDS
  let committedHeading: number | null = null
  let movementActive = false
  let orbitActive = false
  let manualOrbitOverride = false
  let obstructionLifted = false
  let enclosureDistance: number | null = null
  let recoveringEnclosureDistance = false
  let zoomChanged = false
  let hasRetainedPosition = false
  let firstFrame = true
  let requestedChallengeId: string | null = null
  let challengeSubjects: ChallengeCameraSubjects | null = null
  let challengeShot: ChallengeCameraShot | null = null
  let challengePlanKey = ''
  let challengeSafeBottomFraction = 0
  let challengePlanningPosition: Vector3 | null = null
  let challengePlayerOrigin: Vector3 | null = null
  let renderedChallengeYaw = yaw
  const challengeDirector = createChallengeCameraDirector({
    reducedMotion: options.reducedMotion === true,
  })
  const enclosure = createEnclosureFraming(level)
  const { obstacles, useMeshOccludersAt } = createCameraPlatformOcclusion(level)

  function pointBoom(atPitch: number): void {
    direction.set(
      Math.sin(yaw) * Math.cos(atPitch),
      Math.sin(atPitch),
      Math.cos(yaw) * Math.cos(atPitch),
    )
  }

  function safeRayDistance(
    origin: Vector3,
    rayDirection: Vector3,
    reach: number,
    enabledPlatformIds: readonly string[],
    activeSolidIds: readonly string[],
    constrainToEnclosure: boolean,
    useMeshOccluders = true,
  ): number {
    ray.set(origin, rayDirection)
    let safeDistance = reach
    for (const obstacle of obstacles) {
      if (!enabledPlatformIds.includes(obstacle.id)) continue
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
    atPitch: number,
    reach: number,
    enabledPlatformIds: readonly string[],
    activeSolidIds: readonly string[],
    constrainToEnclosure: boolean,
    useMeshOccluders: boolean,
  ): number {
    pointBoom(atPitch)
    return safeRayDistance(
      target,
      direction,
      reach,
      enabledPlatformIds,
      activeSolidIds,
      constrainToEnclosure,
      useMeshOccluders,
    )
  }

  function chooseLiftedPitch(
    reach: number,
    enabledPlatformIds: readonly string[],
    activeSolidIds: readonly string[],
    constrainToEnclosure: boolean,
    normalDistance: number,
    useMeshOccluders: boolean,
  ): number {
    let bestPitch = pitch
    let bestDistance = normalDistance
    for (const candidate of OBSTRUCTION_LIFT_PITCHES) {
      if (candidate <= pitch) continue
      const candidateDistance = safeBoomDistance(
        candidate,
        reach,
        enabledPlatformIds,
        activeSolidIds,
        constrainToEnclosure,
        useMeshOccluders,
      )
      if (candidateDistance > bestDistance) {
        bestPitch = candidate
        bestDistance = candidateDistance
      }
      // A bounded room needs enough boom for Merc and the landing, but taking
      // the absolute longest ray makes ordinary corridors read as top-down.
      // Keep the first modest lift that restores useful third-person framing.
      if (
        constrainToEnclosure &&
        candidateDistance >= ENCLOSURE_READABLE_BOOM_DISTANCE
      )
        return candidate
    }
    return bestPitch
  }

  const focusedChallengeId = (snapshot: GameSnapshot): string | null =>
    selectFocusedChallengeId(requestedChallengeId, snapshot)

  function challengePositionConstraint(
    snapshot: GameSnapshot,
    focus: Vector3,
    requested: Vector3,
  ): Vector3 {
    challengeDirection.copy(requested).sub(focus)
    const reach = challengeDirection.length()
    if (reach <= 0.001) return challengePosition.copy(focus)
    challengeDirection.multiplyScalar(1 / reach)
    const activeSolidIds =
      snapshot.activeSolidIds ?? snapshot.enabledPlatformIds
    const safeDistance = safeRayDistance(
      focus,
      challengeDirection,
      reach,
      snapshot.enabledPlatformIds,
      activeSolidIds,
      true,
    )
    return challengePosition
      .copy(focus)
      .addScaledVector(challengeDirection, safeDistance)
  }

  function challengeSubjectOccluded(
    snapshot: GameSnapshot,
    position: Vector3,
    subject: Vector3,
  ): boolean {
    challengeDirection.copy(subject).sub(position)
    const reach = challengeDirection.length()
    if (reach <= 0.001) return false
    challengeDirection.multiplyScalar(1 / reach)
    const activeSolidIds =
      snapshot.activeSolidIds ?? snapshot.enabledPlatformIds
    if (
      enclosure !== null &&
      enclosure.solidDistance(
        position,
        challengeDirection,
        reach,
        activeSolidIds,
      ) <
        reach - 0.08
    )
      return true
    ray.set(position, challengeDirection)
    for (const obstacle of obstacles) {
      if (!snapshot.enabledPlatformIds.includes(obstacle.id)) continue
      if (ray.intersectBox(obstacle.box, hit)) {
        const distance = position.distanceTo(hit)
        if (distance < reach - 0.08) return true
      }
    }
    raycaster.set(position, challengeDirection)
    raycaster.far = Math.max(0, reach - 0.08)
    return raycaster.intersectObjects(occluders, false).length > 0
  }

  function updateChallengePlan(
    encounterId: string,
    snapshot: GameSnapshot,
  ): void {
    challengeSubjects ??= createFallbackChallengeSubjects(
      level,
      encounterId,
      snapshot,
    )
    if (challengeSubjects.encounterId !== encounterId)
      challengeSubjects = createFallbackChallengeSubjects(
        level,
        encounterId,
        snapshot,
      )
    challengePlanningPosition ??= camera.position.clone()
    challengePlayerOrigin ??= new Vector3().copy(snapshot.player.position)
    const planKey = [
      encounterId,
      camera.aspect.toFixed(4),
      challengeSafeBottomFraction.toFixed(4),
    ].join(':')
    if (planKey === challengePlanKey && challengeShot !== null) return
    challengeShot = planChallengeCameraShot(challengeSubjects, {
      aspect: camera.aspect,
      fovDegrees: EXPLORATION_FOV_DEGREES,
      near: camera.near,
      far: camera.far,
      safeBottomFraction: challengeSafeBottomFraction,
      currentPosition: challengePlanningPosition,
      preferredSide: challengeShot?.side,
      constrainPosition: (focus, requested) =>
        challengePositionConstraint(snapshot, focus, requested),
      isOccluded: (position, subject) =>
        challengeSubjectOccluded(snapshot, position, subject),
    })
    challengePlanKey = planKey
  }

  function challengeInputLocked(): boolean {
    return requestedChallengeId !== null || challengeDirector.active()
  }

  function metrics(): ChallengeCameraMetrics {
    const state = challengeDirector.snapshot()
    const presenting = state.mode !== 'exploration'
    const settled =
      state.mode === 'holding' &&
      challengeShot !== null &&
      camera.position.distanceTo(challengeShot.pose.position) < 0.005 &&
      renderedTarget.distanceTo(challengeShot.pose.target) < 0.005 &&
      Math.abs(camera.fov - challengeShot.pose.fovDegrees) < 0.01
    let mercFrame: ChallengeCameraScreenFrame | null = null
    let targetFrame: ChallengeCameraScreenFrame | null = null
    let combinedFrame: ChallengeCameraScreenFrame | null = null
    if (presenting && challengeSubjects !== null) {
      mercFrame = projectChallengeBounds(challengeSubjects.merc, camera)
      targetFrame = projectChallengeBounds(challengeSubjects.target, camera)
      combinedFrame = frameUnion(mercFrame, targetFrame)
    }
    return {
      ...state,
      settled,
      safeBottomFraction: challengeSafeBottomFraction,
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      target: {
        x: renderedTarget.x,
        y: renderedTarget.y,
        z: renderedTarget.z,
      },
      mercFrame,
      targetFrame,
      combinedFrame,
      safeBottomNdc: presenting ? (challengeShot?.safeBottomNdc ?? null) : null,
      side: presenting ? (challengeShot?.side ?? null) : null,
      clearance: presenting ? (challengeShot?.clearance ?? null) : null,
      occluded: presenting ? (challengeShot?.occluded ?? null) : null,
    }
  }

  return {
    camera,
    setOccluders(objects: Object3D[]) {
      occluders = objects
    },
    setChallengeEncounter(encounterId: string | null) {
      if (
        encounterId !== null &&
        encounterId !== requestedChallengeId &&
        encounterId !== challengeSubjects?.encounterId
      ) {
        challengeSubjects = null
        challengeShot = null
        challengePlanKey = ''
        challengePlanningPosition = null
        challengePlayerOrigin = null
      }
      requestedChallengeId = encounterId
      if (encounterId !== null) {
        orbitActive = false
        stopAngularResponse(followResponse, yaw)
      }
    },
    setChallengeSafeBottomFraction(fraction: number) {
      if (!Number.isFinite(fraction)) return
      challengeSafeBottomFraction = MathUtils.clamp(fraction, 0, 0.62)
    },
    setChallengeSubjects(subjects: ChallengeCameraSubjects) {
      const currentEncounterId =
        requestedChallengeId ?? challengeDirector.snapshot().encounterId
      if (
        (currentEncounterId !== null &&
          subjects.encounterId !== currentEncounterId) ||
        subjects.merc.isEmpty() ||
        subjects.target.isEmpty()
      )
        return
      if (challengeSubjects?.encounterId === subjects.encounterId) return
      challengeSubjects = {
        encounterId: subjects.encounterId,
        merc: subjects.merc.clone(),
        target: subjects.target.clone(),
        targetFacing: subjects.targetFacing?.clone(),
      }
      challengeShot = null
      challengePlanKey = ''
    },
    focusedChallengeId,
    getChallengeMetrics: metrics,
    clearChallenge() {
      requestedChallengeId = null
      challengeSubjects = null
      challengeShot = null
      challengePlanKey = ''
      challengePlanningPosition = null
      challengePlayerOrigin = null
      challengeSafeBottomFraction = 0
      challengeDirector.clear()
      orbitActive = false
      stopAngularResponse(followResponse, yaw)
    },
    yaw: () => (challengeDirector.active() ? renderedChallengeYaw : yaw),
    movementYaw: () => movementReferenceYaw,
    setMovementActive(active: boolean) {
      movementActive = active
      if (!active) movementReferenceYaw = yaw
    },
    rebaseMovement(kind: MovementReferenceKind = 'keyboard') {
      movementReferenceYaw = yaw
      committedHeading = null
      manualOrbitOverride = false
      headingIntent.rebase(kind)
      const routeYaw = validRouteYaw(activeRouteSection)
      if (routeYaw !== null && options.reducedMotion !== true)
        committedHeading = routeYaw
    },
    cancelHeadingFollow() {
      committedHeading = null
      movementActive = false
      movementReferenceYaw = yaw
      manualOrbitOverride = false
      headingIntent.reset()
      stopAngularResponse(followResponse, yaw)
    },
    setFollowSmoothness(seconds: number) {
      followSmoothnessSeconds = validFollowSmoothness(seconds)
    },
    setOrbitActive(active: boolean) {
      if (challengeInputLocked()) {
        if (!active) orbitActive = false
        return
      }
      orbitActive = active
      orbitQuietSeconds = 0
      if (active) {
        committedHeading = null
        stopAngularResponse(followResponse, yaw)
      }
    },
    orbit(dx: number, dy: number) {
      if (challengeInputLocked()) return
      const safeX = Number.isFinite(dx) ? dx : 0
      const safeY = Number.isFinite(dy) ? dy : 0
      yaw += safeX
      const nextPitch = MathUtils.clamp(pitch + safeY, 0.14, 1.1)
      renderedPitch = MathUtils.clamp(
        renderedPitch + nextPitch - pitch,
        0.14,
        MAXIMUM_OBSTRUCTION_PITCH,
      )
      pitch = nextPitch
      if (safeX !== 0 || safeY !== 0) {
        manualOrbitOverride = true
        if (!movementActive) movementReferenceYaw = yaw
        orbitQuietSeconds = 0
        committedHeading = null
        headingIntent.reset()
        stopAngularResponse(followResponse, yaw)
      }
    },
    zoom(delta: number) {
      if (challengeInputLocked()) return
      if (Number.isFinite(delta) && delta !== 0) {
        distance = MathUtils.clamp(distance + delta, 1.8, 6.5)
        zoomChanged = true
      }
    },
    recenter() {
      if (challengeInputLocked()) return
      const recenterYaw = validRouteYaw(activeRouteSection) ?? facing
      yaw += shortestAngleDelta(yaw, recenterYaw)
      movementReferenceYaw = yaw
      orbitQuietSeconds = ORBIT_FOLLOW_GRACE_SECONDS
      committedHeading = null
      manualOrbitOverride = false
      headingIntent.reset()
      stopAngularResponse(followResponse, yaw)
    },
    update(snapshot: GameSnapshot, dt: number, presentationPaused = false) {
      const safeDt =
        !presentationPaused && Number.isFinite(dt)
          ? MathUtils.clamp(dt, 0, 0.05)
          : 0
      if (Number.isFinite(snapshot.player.facingYaw))
        facing = snapshot.player.facingYaw
      const challengeId = focusedChallengeId(snapshot)
      // A pause or encounter can clear a held stick without delivering a
      // release frame. Discard its pending heading before any cinematic early
      // return so resuming cannot commit stale pre-interruption intent.
      if (
        presentationPaused ||
        snapshot.paused ||
        snapshot.phase !== 'idle' ||
        challengeId !== null
      ) {
        committedHeading = null
        headingIntent.reset()
        stopAngularResponse(followResponse, yaw)
      }
      if (challengeId !== null) updateChallengePlan(challengeId, snapshot)
      const cinematicPose = challengeDirector.update({
        encounterId: challengeId,
        paused: presentationPaused,
        deltaSeconds: safeDt,
        explorationPose: {
          position: camera.position,
          target,
          fovDegrees: EXPLORATION_FOV_DEGREES,
        },
        returnOffset:
          challengePlayerOrigin === null
            ? undefined
            : challengeReturnOffset
                .copy(snapshot.player.position)
                .sub(challengePlayerOrigin),
        shot: challengeId === null ? null : challengeShot,
      })
      if (cinematicPose !== null) {
        if (camera.fov !== cinematicPose.fovDegrees) {
          camera.fov = cinematicPose.fovDegrees
          camera.updateProjectionMatrix()
        }
        camera.position.copy(cinematicPose.position)
        renderedTarget.copy(cinematicPose.target)
        if (!challengeDirector.active()) target.copy(cinematicPose.target)
        camera.lookAt(renderedTarget)
        const offset = camera.position.clone().sub(renderedTarget)
        renderedChallengeYaw = Math.atan2(offset.x, offset.z)
        return
      }
      if (challengeId === null && !challengeDirector.active()) {
        challengeSubjects = null
        challengeShot = null
        challengePlanKey = ''
        challengePlanningPosition = null
        challengePlayerOrigin = null
      }
      const activeSolidIds =
        snapshot.activeSolidIds ?? snapshot.enabledPlatformIds
      const useMeshOccluders = useMeshOccludersAt(snapshot.player.position.y)
      const routeAvailable =
        !presentationPaused &&
        !snapshot.paused &&
        snapshot.phase === 'idle' &&
        snapshot.activeEncounter === null
      const routeUpdate = routeDirector.update(
        routeAvailable
          ? snapshot.player
          : { grounded: false, supportPlatformId: null },
        safeDt,
      )
      activeRouteSection = routeUpdate.section
      bodyTarget.copy(snapshot.player.position)
      bodyTarget.y += 0.42
      let framedTarget = false
      if (activeRouteSection === null) {
        framedTarget =
          enclosure?.frameTarget(bodyTarget, facing, activeSolidIds, desired) ??
          false
        if (!framedTarget) desired.copy(bodyTarget)
      } else {
        desired.copy(bodyTarget)
        addFiniteOffset(desired, activeRouteSection.targetOffset)
      }
      const teleport = desired.distanceToSquared(target) > 9
      const snapPitch = firstFrame || teleport
      if (teleport) hasRetainedPosition = false
      if (snapPitch) target.copy(desired)
      else {
        const horizontalResponse = activeRouteSection === null ? 12 : 5.5
        const horizontalBlend = 1 - Math.exp(-horizontalResponse * safeDt)
        const verticalBlend = 1 - Math.exp(-12 * safeDt)
        target.x = MathUtils.lerp(target.x, desired.x, horizontalBlend)
        target.z = MathUtils.lerp(target.z, desired.z, horizontalBlend)
        target.y = MathUtils.lerp(target.y, desired.y, verticalBlend)
      }
      if (framedTarget)
        framedTarget = enclosure!.constrainTarget(
          bodyTarget,
          target,
          activeSolidIds,
          target,
        )
      firstFrame = false
      if (!snapshot.paused && !orbitActive)
        orbitQuietSeconds = Math.min(
          ORBIT_FOLLOW_GRACE_SECONDS,
          orbitQuietSeconds + safeDt,
        )
      const moving =
        Math.hypot(snapshot.player.velocity.x, snapshot.player.velocity.z) >
        MOVING_SPEED
      const followsHeading =
        options.reducedMotion !== true &&
        !snapshot.paused &&
        snapshot.phase === 'idle' &&
        !teleport
      const routeHeadingFrozen =
        activeRouteSection !== null && !snapshot.player.grounded
      if (!followsHeading) {
        committedHeading = null
        headingIntent.reset()
        stopAngularResponse(followResponse, yaw)
      } else if (!orbitActive && !manualOrbitOverride) {
        const routeYaw = validRouteYaw(activeRouteSection)
        if (routeYaw !== null) {
          if (routeUpdate.changed || movementActive) committedHeading = routeYaw
        } else {
          const requestedHeading = headingIntent.target({
            elapsedSeconds: safeDt,
            facingYaw: facing,
            movementActive,
            movementReferenceYaw,
            moving,
          })
          if (requestedHeading !== null) committedHeading = requestedHeading
        }
      }
      // Input intent, rather than velocity, defines one movement contact. A
      // collision can stop Merc without releasing the held key/stick; keeping
      // the basis there avoids turning a wall contact into camera feedback.
      if (!movementActive) movementReferenceYaw = yaw
      if (routeHeadingFrozen) stopAngularResponse(followResponse, yaw)
      if (
        followsHeading &&
        committedHeading !== null &&
        !orbitActive &&
        !manualOrbitOverride &&
        !routeHeadingFrozen &&
        orbitQuietSeconds >= ORBIT_FOLLOW_GRACE_SECONDS
      ) {
        const settled = stepAngularResponse(
          followResponse,
          committedHeading,
          safeDt,
          {
            maximumSpeed: MAXIMUM_FOLLOW_RADIANS_PER_SECOND,
            maximumAcceleration:
              MAXIMUM_FOLLOW_RADIANS_PER_SECOND / followSmoothnessSeconds,
            completeRadians: FOLLOW_COMPLETE_RADIANS,
          },
        )
        yaw = followResponse.angle
        if (settled) {
          committedHeading = null
        }
      }
      const portrait = camera.aspect < 1 ? 1.15 : 1
      const reach = distance * portrait
      const normalDistance = safeBoomDistance(
        pitch,
        reach,
        snapshot.enabledPlatformIds,
        activeSolidIds,
        framedTarget,
        useMeshOccluders,
      )
      const obstructionTrigger = framedTarget
        ? ENCLOSURE_OBSTRUCTION_TRIGGER_DISTANCE
        : OBSTRUCTION_TRIGGER_DISTANCE
      const obstructionRelease = framedTarget
        ? ENCLOSURE_OBSTRUCTION_RELEASE_DISTANCE
        : OBSTRUCTION_RELEASE_DISTANCE
      if (!framedTarget && enclosure !== null) obstructionLifted = false
      if (!obstructionLifted && normalDistance < obstructionTrigger)
        obstructionLifted = true
      else if (obstructionLifted && normalDistance > obstructionRelease)
        obstructionLifted = false
      const targetPitch = obstructionLifted
        ? chooseLiftedPitch(
            reach,
            snapshot.enabledPlatformIds,
            activeSolidIds,
            framedTarget,
            normalDistance,
            useMeshOccluders,
          )
        : pitch
      renderedPitch = snapPitch
        ? targetPitch
        : MathUtils.lerp(
            renderedPitch,
            targetPitch,
            1 - Math.exp(-OBSTRUCTION_LIFT_RESPONSE * safeDt),
          )
      const safeDistance = safeBoomDistance(
        renderedPitch,
        reach,
        snapshot.enabledPlatformIds,
        activeSolidIds,
        framedTarget,
        useMeshOccluders,
      )
      let renderedDistance = safeDistance
      if (framedTarget) {
        const constrained = safeDistance < reach - 0.01
        if (snapPitch || enclosureDistance === null || zoomChanged) {
          enclosureDistance = safeDistance
          recoveringEnclosureDistance = constrained
        } else if (safeDistance < enclosureDistance) {
          enclosureDistance = safeDistance
          recoveringEnclosureDistance = true
        } else if (constrained || recoveringEnclosureDistance) {
          enclosureDistance = MathUtils.lerp(
            enclosureDistance,
            safeDistance,
            1 - Math.exp(-ENCLOSURE_DISTANCE_RECOVERY_RESPONSE * safeDt),
          )
          recoveringEnclosureDistance =
            constrained || Math.abs(enclosureDistance - safeDistance) > 0.01
        } else {
          enclosureDistance = safeDistance
        }
        renderedDistance = Math.min(safeDistance, enclosureDistance)
      } else {
        enclosureDistance = null
        recoveringEnclosureDistance = false
        hasRetainedPosition = false
      }
      zoomChanged = false
      let retained = false
      if (
        framedTarget &&
        renderedDistance <= 0.05 &&
        hasRetainedPosition &&
        enclosure!.cameraPositionSafe(target, retainedPosition, activeSolidIds)
      ) {
        retainedDirection.copy(retainedPosition).sub(target)
        const retainedDistance = retainedDirection.length()
        retainedDirection.multiplyScalar(1 / retainedDistance)
        raycaster.set(target, retainedDirection)
        raycaster.far = retainedDistance
        if (
          !useMeshOccluders ||
          raycaster.intersectObjects(occluders, false).length === 0
        ) {
          camera.position.copy(retainedPosition)
          retained = true
        }
      }
      if (!retained) {
        camera.position
          .copy(target)
          .addScaledVector(direction, renderedDistance)
        if (
          framedTarget &&
          renderedDistance > 0.05 &&
          enclosure!.cameraPositionSafe(target, camera.position, activeSolidIds)
        ) {
          retainedPosition.copy(camera.position)
          hasRetainedPosition = true
        }
      }
      renderedTarget.copy(target)
      camera.lookAt(renderedTarget)
    },
  }
}
