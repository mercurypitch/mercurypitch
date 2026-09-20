// ============================================================
// Adventure camera — a player-owned orbit with bounded floor obstruction.
// ============================================================

import type { Object3D } from 'three'
import { Box3, MathUtils, PerspectiveCamera, Ray, Raycaster, Vector3, } from 'three'
import type { GameSnapshot, LevelDefinition } from '../contracts'
import { createEnclosureFraming } from './enclosure-framing'

const ORBIT_FOLLOW_GRACE_SECONDS = 0.2
const FOLLOW_RESPONSE = 5
const MAXIMUM_FOLLOW_RADIANS_PER_SECOND = 2.8
const FOLLOW_COMPLETE_RADIANS = 0.01
const MOVING_SPEED = 0.05
const MAXIMUM_OBSTRUCTION_PITCH = 1.35
const OBSTRUCTION_LIFT_PITCHES = [
  0.72,
  0.9,
  1.08,
  1.22,
  MAXIMUM_OBSTRUCTION_PITCH,
] as const
const OBSTRUCTION_LIFT_RESPONSE = 9
const OBSTRUCTION_RELEASE_DISTANCE = 1.35
const OBSTRUCTION_TRIGGER_DISTANCE = 0.9
const ENCLOSURE_OBSTRUCTION_RELEASE_DISTANCE = 1.6
const ENCLOSURE_OBSTRUCTION_TRIGGER_DISTANCE = 1.15
const ENCLOSURE_READABLE_BOOM_DISTANCE = 1.55
const ENCLOSURE_DISTANCE_RECOVERY_RESPONSE = 7

export interface AdventureCameraOptions {
  /** Avoid unsolicited view rotation for vestibular-sensitive players. */
  reducedMotion?: boolean
}

function shortestAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

/** Positive forward means away from the eye along the ground plane. */
export function cameraRelativeMovement(
  x: number,
  forward: number,
  yaw: number,
) {
  const length = Math.max(1, Math.hypot(x, forward))
  return {
    moveX: (x * Math.cos(yaw) - forward * Math.sin(yaw)) / length,
    moveZ: (-x * Math.sin(yaw) - forward * Math.cos(yaw)) / length,
  }
}

export function createAdventureCamera(
  level: LevelDefinition,
  options: AdventureCameraOptions = {},
) {
  const camera = new PerspectiveCamera(48, 1, 0.05, 180)
  const target = new Vector3()
    .copy(level.spawn.position)
    .add(new Vector3(0, 0.42, 0))
  const bodyTarget = new Vector3()
  const desired = new Vector3()
  const direction = new Vector3()
  const retainedDirection = new Vector3()
  const retainedPosition = new Vector3()
  const hit = new Vector3()
  const ray = new Ray()
  const raycaster = new Raycaster()
  let occluders: Object3D[] = []
  let yaw = level.spawn.facingYaw
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
  let obstructionLifted = false
  let enclosureDistance: number | null = null
  let recoveringEnclosureDistance = false
  let zoomChanged = false
  let hasRetainedPosition = false
  let firstFrame = true
  const enclosure = createEnclosureFraming(level)
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

  function pointBoom(atPitch: number): void {
    direction.set(
      Math.sin(yaw) * Math.cos(atPitch),
      Math.sin(atPitch),
      Math.cos(yaw) * Math.cos(atPitch),
    )
  }

  function safeBoomDistance(
    atPitch: number,
    reach: number,
    enabledPlatformIds: readonly string[],
    activeSolidIds: readonly string[],
    constrainToEnclosure: boolean,
  ): number {
    pointBoom(atPitch)
    ray.set(target, direction)
    let safeDistance = reach
    for (const obstacle of obstacles) {
      if (!enabledPlatformIds.includes(obstacle.id)) continue
      if (ray.intersectBox(obstacle.box, hit))
        safeDistance = Math.min(
          safeDistance,
          Math.max(0.35, target.distanceTo(hit) - 0.1),
        )
    }
    if (enclosure !== null) {
      safeDistance = Math.min(
        safeDistance,
        enclosure.solidDistance(target, direction, reach, activeSolidIds),
      )
      if (constrainToEnclosure) {
        const volumeDistance = enclosure.volumeDistance(
          target,
          direction,
          reach,
        )
        if (volumeDistance !== null)
          safeDistance = Math.min(safeDistance, volumeDistance)
      }
    }
    raycaster.set(target, direction)
    raycaster.far = safeDistance
    const obstruction = raycaster.intersectObjects(occluders, false)[0]
    if (obstruction !== undefined) {
      const meshDistance = Math.max(0.35, obstruction.distance - 0.1)
      safeDistance =
        enclosure === null ? meshDistance : Math.min(safeDistance, meshDistance)
    }
    return safeDistance
  }

  function chooseLiftedPitch(
    reach: number,
    enabledPlatformIds: readonly string[],
    activeSolidIds: readonly string[],
    constrainToEnclosure: boolean,
    normalDistance: number,
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

  return {
    camera,
    setOccluders(objects: Object3D[]) {
      occluders = objects
    },
    yaw: () => yaw,
    movementYaw: () => movementReferenceYaw,
    setMovementActive(active: boolean) {
      movementActive = active
      if (!active) movementReferenceYaw = yaw
    },
    rebaseMovement() {
      movementReferenceYaw = yaw
      committedHeading = null
    },
    cancelHeadingFollow() {
      committedHeading = null
      movementActive = false
      movementReferenceYaw = yaw
    },
    setOrbitActive(active: boolean) {
      orbitActive = active
      orbitQuietSeconds = 0
      if (active) {
        movementReferenceYaw = yaw
        committedHeading = null
      }
    },
    orbit(dx: number, dy: number) {
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
        movementReferenceYaw = yaw
        orbitQuietSeconds = 0
        committedHeading = null
      }
    },
    zoom(delta: number) {
      if (Number.isFinite(delta) && delta !== 0) {
        distance = MathUtils.clamp(distance + delta, 1.8, 6.5)
        zoomChanged = true
      }
    },
    recenter() {
      yaw += shortestAngleDelta(yaw, facing)
      movementReferenceYaw = yaw
      orbitQuietSeconds = ORBIT_FOLLOW_GRACE_SECONDS
      committedHeading = null
    },
    update(snapshot: GameSnapshot, dt: number) {
      const safeDt = Number.isFinite(dt) ? MathUtils.clamp(dt, 0, 0.05) : 0
      if (Number.isFinite(snapshot.player.facingYaw))
        facing = snapshot.player.facingYaw
      const activeSolidIds =
        snapshot.activeSolidIds ?? snapshot.enabledPlatformIds
      bodyTarget.copy(snapshot.player.position)
      bodyTarget.y += 0.42
      let framedTarget =
        enclosure?.frameTarget(bodyTarget, facing, activeSolidIds, desired) ??
        false
      if (!framedTarget) desired.copy(bodyTarget)
      const teleport = desired.distanceToSquared(target) > 9
      const snapPitch = firstFrame || teleport
      if (teleport) hasRetainedPosition = false
      target.lerp(desired, snapPitch ? 1 : 1 - Math.exp(-12 * safeDt))
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
      if (!followsHeading) committedHeading = null
      else if (movementActive && moving && !orbitActive)
        committedHeading = facing
      // Input intent, rather than velocity, defines one movement contact. A
      // collision can stop Merc without releasing the held key/stick; keeping
      // the basis there avoids turning a wall contact into camera feedback.
      if (!movementActive) movementReferenceYaw = yaw
      if (
        followsHeading &&
        committedHeading !== null &&
        !orbitActive &&
        orbitQuietSeconds >= ORBIT_FOLLOW_GRACE_SECONDS
      ) {
        const delta = shortestAngleDelta(yaw, committedHeading)
        const blended = delta * (1 - Math.exp(-FOLLOW_RESPONSE * safeDt))
        const maximumStep = MAXIMUM_FOLLOW_RADIANS_PER_SECOND * safeDt
        yaw += MathUtils.clamp(blended, -maximumStep, maximumStep)
        if (
          Math.abs(shortestAngleDelta(yaw, committedHeading)) <=
          FOLLOW_COMPLETE_RADIANS
        ) {
          yaw += shortestAngleDelta(yaw, committedHeading)
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
        if (raycaster.intersectObjects(occluders, false).length === 0) {
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
      camera.lookAt(target)
    },
  }
}
