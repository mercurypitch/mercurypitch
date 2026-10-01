// ============================================================
// Adventure camera — a player-owned orbit with bounded floor obstruction.
// ============================================================

import type { Object3D } from 'three'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import type { GameSnapshot, LevelDefinition, MovementReferenceKind, } from '../contracts'
import { shortestAngleDelta, stepAngularResponse, stopAngularResponse, } from './angular-response'
import { createCameraHeadingIntent } from './camera-heading-intent'
import { measureChallengeCamera } from './camera-metrics'
import { createCameraObstruction } from './camera-obstruction'
import type { AdventureCameraMode, AdventureCameraOptions, ChallengeCameraMetrics, } from './camera-policy'
import { addFiniteOffset, createFallbackChallengeSubjects, ENCLOSURE_OBSTRUCTION_RELEASE_DISTANCE, ENCLOSURE_OBSTRUCTION_TRIGGER_DISTANCE, ENCLOSURE_READABLE_BOOM_DISTANCE, enclosureCompositionPitch, EXPLORATION_FOV_DEGREES, FOLLOW_COMPLETE_RADIANS, MAXIMUM_FOLLOW_RADIANS_PER_SECOND, MAXIMUM_OBSTRUCTION_PITCH, MOVING_SPEED, OBSTRUCTION_LIFT_RESPONSE, OBSTRUCTION_RELEASE_DISTANCE, OBSTRUCTION_TRIGGER_DISTANCE, ORBIT_FOLLOW_GRACE_SECONDS, selectFocusedChallengeId, validFollowSmoothness, validRouteYaw, } from './camera-policy'
import type { ChallengeCameraShot, ChallengeCameraSubjects, } from './challenge-camera'
import { createChallengeCameraDirector, planChallengeCameraShot, } from './challenge-camera'
import { createEnclosureFraming } from './enclosure-framing'
import { createFirstPersonCamera } from './first-person-camera'
import { createRouteCameraDirector } from './route-camera'
import { contextualThirdPersonReach, createThirdPersonFraming, sampleThirdPersonClearance, } from './third-person-framing'

export {
  CAMERA_FOLLOW_SMOOTHNESS,
  cameraRelativeMovement,
} from './camera-policy'
export type {
  AdventureCameraMode,
  AdventureCameraOptions,
  ChallengeCameraMetrics,
} from './camera-policy'

// Match the movement clock's maximum foreground catch-up while keeping the
// obstruction/framing solve on one bounded render step. Angular response has
// its own 50 ms stability bound, so delayed frames are advanced in slices.
const MAXIMUM_CAMERA_CATCH_UP_SECONDS = 0.25
const CAMERA_RESPONSE_SLICE_SECONDS = 0.05

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
  const previousPlayerPosition = new Vector3().copy(level.spawn.position)
  const desired = new Vector3()
  const direction = new Vector3()
  const challengeDirection = new Vector3()
  const challengePosition = new Vector3()
  const challengeReturnOffset = new Vector3()
  let yaw =
    options.reducedMotion === true
      ? level.spawn.facingYaw
      : (validRouteYaw(activeRouteSection) ?? level.spawn.facingYaw)
  let cameraMode: AdventureCameraMode =
    options.mode === 'first-person' ? 'first-person' : 'third-person'
  const firstPerson = createFirstPersonCamera(yaw)
  const thirdPersonFraming = createThirdPersonFraming()
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
  let movementHeading: number | null = null
  let movementActive = false
  let orbitActive = false
  let manualOrbitOverride = false
  let obstructionLifted = false
  let zoomChanged = false
  let firstFrame = true
  let requestedChallengeId: string | null = null
  let challengeSubjects: ChallengeCameraSubjects | null = null
  let challengeShot: ChallengeCameraShot | null = null
  let challengePlanKey = ''
  let challengeSafeBottomFraction = 0
  let challengePlanningPosition: Vector3 | null = null
  let challengePlayerOrigin: Vector3 | null = null
  let renderedChallengeYaw = yaw
  let firstPersonChallengeId: string | null = null
  const challengeDirector = createChallengeCameraDirector({
    reducedMotion: options.reducedMotion === true,
  })
  const enclosure = createEnclosureFraming(level)
  const obstruction = createCameraObstruction(level, enclosure)

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
    const safeDistance = obstruction.safeRayDistance(
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
      obstruction.safeRayDistance(
        position,
        challengeDirection,
        reach,
        snapshot.enabledPlatformIds,
        activeSolidIds,
        true,
        false,
        'subject-visibility',
      ) <
      reach - 0.08
    )
      return true
    return !obstruction.meshPathClear(
      position,
      challengeDirection,
      Math.max(0, reach - 0.08),
      true,
    )
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
    return (
      requestedChallengeId !== null ||
      firstPersonChallengeId !== null ||
      challengeDirector.active()
    )
  }

  function metrics(): ChallengeCameraMetrics {
    return measureChallengeCamera({
      cameraMode,
      firstPersonEncounterId: firstPersonChallengeId,
      firstPersonSettled: firstPerson.settled(),
      director: challengeDirector.snapshot(),
      shot: challengeShot,
      subjects: challengeSubjects,
      camera,
      renderedTarget,
      safeBottomFraction: challengeSafeBottomFraction,
    })
  }

  return {
    camera,
    mode: () => cameraMode,
    setMode(mode: AdventureCameraMode) {
      if (mode === cameraMode) return
      if (mode === 'first-person')
        firstPerson.enter(camera.position, renderedTarget, camera.fov)
      else {
        yaw = firstPerson.yaw()
        pitch = MathUtils.clamp(-firstPerson.pitch(), 0.14, 1.1)
        renderedPitch = pitch
        if (camera.fov !== EXPLORATION_FOV_DEGREES) {
          camera.fov = EXPLORATION_FOV_DEGREES
          camera.updateProjectionMatrix()
        }
        firstFrame = true
        thirdPersonFraming.reset()
        obstruction.resetCameraPlacement()
      }
      cameraMode = mode
      firstPersonChallengeId = null
      yaw = firstPerson.yaw()
      movementReferenceYaw = yaw
      manualOrbitOverride = false
      committedHeading = null
      movementHeading = null
      headingIntent.reset()
      challengeDirector.clear()
      challengeShot = null
      challengePlanKey = ''
      stopAngularResponse(followResponse, yaw)
    },
    setOccluders(objects: Object3D[]) {
      obstruction.setOccluders(objects)
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
    challengePresentationActive: challengeInputLocked,
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
      firstPersonChallengeId = null
      orbitActive = false
      stopAngularResponse(followResponse, yaw)
    },
    yaw: () =>
      cameraMode === 'first-person'
        ? firstPerson.renderedYaw()
        : challengeDirector.active()
          ? renderedChallengeYaw
          : yaw,
    movementYaw: () => movementReferenceYaw,
    setMovementActive(active: boolean) {
      movementActive = active
      if (!active)
        movementReferenceYaw =
          cameraMode === 'first-person' ? firstPerson.yaw() : yaw
    },
    rebaseMovement(
      kind: MovementReferenceKind = 'keyboard',
      travelOffsetRadians?: number,
    ) {
      // A deliberate look while moving owns only the view. Direction changes
      // inside that same held contact stay on its original world-space basis;
      // an idle orbit has already kept the basis aligned to the latest view.
      if (!manualOrbitOverride)
        movementReferenceYaw =
          cameraMode === 'first-person' ? firstPerson.yaw() : yaw
      movementHeading =
        typeof travelOffsetRadians === 'number' &&
        Number.isFinite(travelOffsetRadians)
          ? movementReferenceYaw + travelOffsetRadians
          : null
      committedHeading = null
      headingIntent.rebase(kind)
      const routeYaw = validRouteYaw(activeRouteSection)
      if (routeYaw !== null && options.reducedMotion !== true)
        committedHeading = routeYaw
    },
    cancelHeadingFollow() {
      committedHeading = null
      movementActive = false
      movementReferenceYaw =
        cameraMode === 'first-person' ? firstPerson.yaw() : yaw
      manualOrbitOverride = false
      movementHeading = null
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
      if (cameraMode === 'first-person') {
        firstPerson.orbit(safeX, safeY)
        movementReferenceYaw = firstPerson.yaw()
        orbitQuietSeconds = 0
        return
      }
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
      if (challengeInputLocked() || cameraMode === 'first-person') return
      if (Number.isFinite(delta) && delta !== 0) {
        distance = MathUtils.clamp(distance + delta, 1.8, 6.5)
        zoomChanged = true
      }
    },
    recenter() {
      if (challengeInputLocked()) return
      const recenterYaw = validRouteYaw(activeRouteSection) ?? facing
      if (cameraMode === 'first-person') {
        firstPerson.recenter(recenterYaw)
        movementReferenceYaw = firstPerson.yaw()
        return
      }
      yaw += shortestAngleDelta(yaw, recenterYaw)
      movementReferenceYaw = yaw
      orbitQuietSeconds = ORBIT_FOLLOW_GRACE_SECONDS
      committedHeading = null
      movementHeading = null
      manualOrbitOverride = false
      headingIntent.reset()
      stopAngularResponse(followResponse, yaw)
    },
    update(snapshot: GameSnapshot, dt: number, presentationPaused = false) {
      obstruction.updatePlatformStates(snapshot.platformStates)
      const displacementDistance = Math.hypot(
        snapshot.player.position.x - previousPlayerPosition.x,
        snapshot.player.position.z - previousPlayerPosition.z,
      )
      previousPlayerPosition.copy(snapshot.player.position)
      const elapsed =
        !presentationPaused && Number.isFinite(dt) ? Math.max(0, dt) : 0
      const safeDt =
        !presentationPaused && Number.isFinite(dt)
          ? MathUtils.clamp(dt, 0, 0.05)
          : 0
      const followDt = Math.min(elapsed, MAXIMUM_CAMERA_CATCH_UP_SECONDS)
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
      const routeAvailable =
        !presentationPaused &&
        !snapshot.paused &&
        snapshot.phase === 'idle' &&
        snapshot.activeEncounter === null
      const routeSample = routeAvailable
        ? snapshot.player
        : { grounded: false, supportPlatformId: null }
      if (cameraMode === 'first-person') {
        activeRouteSection = routeDirector.update(routeSample, safeDt).section
        firstPersonChallengeId = challengeId
        if (
          challengeId !== null &&
          challengeSubjects?.encounterId !== challengeId
        )
          challengeSubjects = createFallbackChallengeSubjects(
            level,
            challengeId,
            snapshot,
          )
        firstPerson.frame(camera, renderedTarget, {
          playerPosition: snapshot.player.position,
          challengeTarget:
            challengeId === null ? null : challengeSubjects?.target,
          safeBottomFraction: challengeSafeBottomFraction,
          deltaSeconds: safeDt,
          reducedMotion: options.reducedMotion === true,
        })
        renderedChallengeYaw = firstPerson.renderedYaw()
        if (challengeId === null) challengeSubjects = null
        return
      }
      if (challengeId !== null) updateChallengePlan(challengeId, snapshot)
      const cinematicPose = challengeDirector.update({
        encounterId: challengeId,
        paused: presentationPaused,
        deltaSeconds: followDt,
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
      const useMeshOccluders = obstruction.useMeshOccludersAt(
        snapshot.player.position.y,
      )
      const routeUpdate = routeDirector.update(routeSample, safeDt)
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
      if (teleport) obstruction.resetCameraPlacement()
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
          orbitQuietSeconds + followDt,
        )
      const moving =
        Math.hypot(snapshot.player.velocity.x, snapshot.player.velocity.z) >
        MOVING_SPEED
      const effectiveHeading = moving
        ? Math.atan2(-snapshot.player.velocity.x, -snapshot.player.velocity.z)
        : null
      const headingSample = {
        allowForwardDiagonalFollow: framedTarget,
        displacementDistance: teleport ? 0 : displacementDistance,
        elapsedSeconds: followDt,
        effectiveHeading,
        facingYaw: facing,
        keyboardHeading: movementHeading,
        movementActive,
        movementReferenceYaw,
        moving,
      }
      const followsHeading =
        options.reducedMotion !== true &&
        !snapshot.paused &&
        snapshot.phase === 'idle' &&
        !teleport
      let headingSampled = false
      if (followsHeading && manualOrbitOverride && !orbitActive) {
        headingSampled = true
        const requestedHeading = headingIntent.target({
          ...headingSample,
          reacquireManualView: true,
        })
        if (requestedHeading !== null) committedHeading = requestedHeading
      }
      if (
        followsHeading &&
        manualOrbitOverride &&
        !orbitActive &&
        orbitQuietSeconds >= ORBIT_FOLLOW_GRACE_SECONDS &&
        committedHeading !== null
      ) {
        manualOrbitOverride = false
        if (!moving && committedHeading !== null) committedHeading = facing
      }
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
        } else if (!headingSampled) {
          const requestedHeading = headingIntent.target(headingSample)
          if (requestedHeading !== null) committedHeading = requestedHeading
        }
      }
      // Input intent defines one stable movement contact. The camera may adopt
      // a confirmed corridor slide, but its turn never changes this basis and
      // therefore cannot feed back into the held world-space travel direction.
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
        let remainingFollowSeconds = followDt
        let settled = false
        while (remainingFollowSeconds > 1e-9 && !settled) {
          const slice = Math.min(
            remainingFollowSeconds,
            CAMERA_RESPONSE_SLICE_SECONDS,
          )
          settled = stepAngularResponse(
            followResponse,
            committedHeading,
            slice,
            {
              maximumSpeed: MAXIMUM_FOLLOW_RADIANS_PER_SECOND,
              maximumAcceleration:
                MAXIMUM_FOLLOW_RADIANS_PER_SECOND / followSmoothnessSeconds,
              completeRadians: FOLLOW_COMPLETE_RADIANS,
            },
          )
          remainingFollowSeconds -= slice
        }
        yaw = followResponse.angle
        if (settled) {
          committedHeading = null
        }
      }
      const portrait = camera.aspect < 1 ? 1.15 : 1
      const reach = distance * portrait
      const contextualReach = framedTarget
        ? contextualThirdPersonReach({
            requestedReach: reach,
            aspect: camera.aspect,
            fovDegrees: camera.fov,
            pitch,
            clearance: sampleThirdPersonClearance(facing, (probe, length) =>
              obstruction.safeRayDistance(
                bodyTarget,
                probe,
                length,
                snapshot.enabledPlatformIds,
                activeSolidIds,
                false,
                false,
              ),
            ),
          })
        : reach
      const preferredPitch =
        framedTarget && !manualOrbitOverride
          ? enclosureCompositionPitch(pitch, contextualReach)
          : pitch
      const normalDistance = obstruction.safeBoomDistance(
        target,
        yaw,
        preferredPitch,
        reach,
        snapshot.enabledPlatformIds,
        activeSolidIds,
        framedTarget,
        useMeshOccluders,
        direction,
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
        ? obstruction.chooseLiftedPitch({
            basePitch: preferredPitch,
            origin: target,
            yaw,
            reach,
            enabledPlatformIds: snapshot.enabledPlatformIds,
            activeSolidIds,
            constrainToEnclosure: framedTarget,
            normalDistance,
            useMeshOccluders,
            boomDirection: direction,
          })
        : preferredPitch
      renderedPitch = snapPitch
        ? targetPitch
        : MathUtils.lerp(
            renderedPitch,
            targetPitch,
            1 - Math.exp(-OBSTRUCTION_LIFT_RESPONSE * safeDt),
          )
      const safeDistance = obstruction.resolveBoomDistance(
        target,
        yaw,
        renderedPitch,
        reach,
        snapshot.enabledPlatformIds,
        activeSolidIds,
        framedTarget,
        useMeshOccluders,
        safeDt,
        direction,
      )
      let renderedDistance = safeDistance
      if (framedTarget) {
        renderedDistance = thirdPersonFraming.update({
          requestedReach: reach,
          contextualReach,
          minimumReadableReach: ENCLOSURE_READABLE_BOOM_DISTANCE,
          safeReach: safeDistance,
          deltaSeconds: safeDt,
          snap: snapPitch || zoomChanged,
        })
      } else {
        thirdPersonFraming.reset()
      }
      zoomChanged = false
      const rebasedDistance = obstruction.placeCameraPosition({
        position: camera.position,
        target,
        boomDirection: direction,
        renderedDistance,
        safeDistance,
        activeSolidIds,
        constrainToEnclosure: framedTarget,
        useMeshOccluders,
      })
      if (rebasedDistance !== null) thirdPersonFraming.snap(rebasedDistance)
      renderedTarget.copy(target)
      camera.lookAt(renderedTarget)
    },
  }
}
