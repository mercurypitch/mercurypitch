// ============================================================
// Adventure camera — a player-owned orbit with bounded floor obstruction.
// ============================================================

import type { Object3D } from 'three'
import { Box3, MathUtils, PerspectiveCamera, Ray, Raycaster, Vector3, } from 'three'
import type { GameSnapshot, LevelDefinition } from '../contracts'

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

export function createAdventureCamera(level: LevelDefinition) {
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
  let distance = 4
  let facing = level.spawn.facingYaw
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

  return {
    camera,
    setOccluders(objects: Object3D[]) {
      occluders = objects
    },
    yaw: () => yaw,
    orbit(dx: number, dy: number) {
      yaw += Number.isFinite(dx) ? dx : 0
      pitch = MathUtils.clamp(pitch + (Number.isFinite(dy) ? dy : 0), 0.14, 1.1)
    },
    zoom(delta: number) {
      if (Number.isFinite(delta))
        distance = MathUtils.clamp(distance + delta, 1.8, 6.5)
    },
    recenter() {
      yaw = facing
      pitch = 0.36
      distance = 4
    },
    update(snapshot: GameSnapshot, dt: number) {
      facing = snapshot.player.facingYaw
      desired.copy(snapshot.player.position)
      desired.y += 0.42
      // Follow position, never secretly rotate the player's chosen view.
      const teleport = desired.distanceToSquared(target) > 9
      target.lerp(desired, firstFrame || teleport ? 1 : 1 - Math.exp(-12 * dt))
      firstFrame = false
      const portrait = camera.aspect < 1 ? 1.15 : 1
      const reach = distance * portrait
      direction.set(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch),
      )
      ray.set(target, direction)
      let safeDistance = reach
      for (const obstacle of obstacles) {
        if (!snapshot.enabledPlatformIds.includes(obstacle.id)) continue
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
      camera.position.copy(target).addScaledVector(direction, safeDistance)
      camera.lookAt(target)
    },
  }
}
