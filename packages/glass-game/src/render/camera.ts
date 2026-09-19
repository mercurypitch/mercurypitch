// ============================================================
// Adventure camera — a player-owned orbit with bounded floor obstruction.
// ============================================================

import type { Object3D } from 'three'
import { Box3, MathUtils, PerspectiveCamera, Ray, Raycaster, Vector3, } from 'three'
import type { GameSnapshot, LevelDefinition } from '../contracts'

const FOLLOW_RESUME_SECONDS = 1.75
const FOLLOW_RESPONSE = 5
const MAXIMUM_FOLLOW_RADIANS_PER_SECOND = 2.8
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
  const desired = new Vector3()
  const direction = new Vector3()
  const hit = new Vector3()
  const ray = new Ray()
  const raycaster = new Raycaster()
  let occluders: Object3D[] = []
  let yaw = level.spawn.facingYaw
  let pitch = 0.36
  let renderedPitch = pitch
  let distance = 4
  let facing = level.spawn.facingYaw
  // Movement uses a stable heading while a contact is held. Feeding the
  // following view back into camera-relative input would turn a strafe into a
  // self-reinforcing circle.
  let movementReferenceYaw = yaw
  let manualQuietSeconds = FOLLOW_RESUME_SECONDS
  let movementActive = false
  let orbitActive = false
  let obstructionLifted = false
  let firstFrame = true
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
    raycaster.set(target, direction)
    raycaster.far = safeDistance
    const obstruction = raycaster.intersectObjects(occluders, false)[0]
    if (obstruction !== undefined)
      safeDistance = Math.max(0.35, obstruction.distance - 0.1)
    return safeDistance
  }

  function chooseLiftedPitch(
    reach: number,
    enabledPlatformIds: readonly string[],
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
      )
      if (candidateDistance > bestDistance) {
        bestPitch = candidate
        bestDistance = candidateDistance
      }
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
    setOrbitActive(active: boolean) {
      orbitActive = active
      manualQuietSeconds = 0
      if (active) movementReferenceYaw = yaw
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
        manualQuietSeconds = 0
      }
    },
    zoom(delta: number) {
      if (Number.isFinite(delta) && delta !== 0) {
        distance = MathUtils.clamp(distance + delta, 1.8, 6.5)
        manualQuietSeconds = 0
      }
    },
    recenter() {
      yaw += shortestAngleDelta(yaw, facing)
      movementReferenceYaw = yaw
      manualQuietSeconds = FOLLOW_RESUME_SECONDS
    },
    update(snapshot: GameSnapshot, dt: number) {
      const safeDt = Number.isFinite(dt) ? MathUtils.clamp(dt, 0, 0.05) : 0
      if (Number.isFinite(snapshot.player.facingYaw))
        facing = snapshot.player.facingYaw
      desired.copy(snapshot.player.position)
      desired.y += 0.42
      const teleport = desired.distanceToSquared(target) > 9
      const snapPitch = firstFrame || teleport
      target.lerp(desired, snapPitch ? 1 : 1 - Math.exp(-12 * safeDt))
      firstFrame = false
      if (!snapshot.paused && !orbitActive)
        manualQuietSeconds = Math.min(
          FOLLOW_RESUME_SECONDS,
          manualQuietSeconds + safeDt,
        )
      const moving =
        Math.hypot(snapshot.player.velocity.x, snapshot.player.velocity.z) >
        MOVING_SPEED
      // Input intent, rather than velocity, defines one movement contact. A
      // collision can stop Merc without releasing the held key/stick; keeping
      // the basis there avoids turning a wall contact into camera feedback.
      if (!movementActive) movementReferenceYaw = yaw
      if (
        options.reducedMotion !== true &&
        moving &&
        !orbitActive &&
        !snapshot.paused &&
        snapshot.phase === 'idle' &&
        manualQuietSeconds >= FOLLOW_RESUME_SECONDS
      ) {
        const delta = shortestAngleDelta(yaw, facing)
        const blended = delta * (1 - Math.exp(-FOLLOW_RESPONSE * safeDt))
        const maximumStep = MAXIMUM_FOLLOW_RADIANS_PER_SECOND * safeDt
        yaw += MathUtils.clamp(blended, -maximumStep, maximumStep)
      }
      const portrait = camera.aspect < 1 ? 1.15 : 1
      const reach = distance * portrait
      const normalDistance = safeBoomDistance(
        pitch,
        reach,
        snapshot.enabledPlatformIds,
      )
      if (!obstructionLifted && normalDistance < OBSTRUCTION_TRIGGER_DISTANCE)
        obstructionLifted = true
      else if (
        obstructionLifted &&
        normalDistance > OBSTRUCTION_RELEASE_DISTANCE
      )
        obstructionLifted = false
      const targetPitch = obstructionLifted
        ? chooseLiftedPitch(reach, snapshot.enabledPlatformIds, normalDistance)
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
      )
      camera.position.copy(target).addScaledVector(direction, safeDistance)
      camera.lookAt(target)
    },
  }
}
