// First-person camera — stable eye framing and temporary encounter target aim.

import type { Box3, PerspectiveCamera } from 'three'
import { MathUtils, Vector3 } from 'three'

export const FIRST_PERSON_EYE_HEIGHT = 0.48
export const FIRST_PERSON_FOCUS_DISTANCE = 4
export const FIRST_PERSON_MINIMUM_PITCH = -0.92
export const FIRST_PERSON_MAXIMUM_PITCH = 0.92
const FIRST_PERSON_CHALLENGE_MAXIMUM_FOV = 96
const FIRST_PERSON_CHALLENGE_HORIZONTAL_LIMIT = 0.9
const FIRST_PERSON_CHALLENGE_TOP_LIMIT = 0.86
const FIRST_PERSON_CHALLENGE_BOTTOM_MARGIN = 0.06

interface FirstPersonFrameOptions {
  playerPosition: { x: number; y: number; z: number }
  challengeTarget?: Box3 | null
  safeBottomFraction?: number
  deltaSeconds?: number
  reducedMotion?: boolean
}

export function createFirstPersonCamera(initialYaw: number) {
  let yaw = Number.isFinite(initialYaw) ? initialYaw : 0
  let pitch = 0
  let renderedYaw = yaw
  let renderedPitch = pitch
  let renderedFov = 48
  let desiredYaw = yaw
  let desiredPitch = pitch
  let desiredFov = 48
  const eye = new Vector3()
  const focus = new Vector3()
  const center = new Vector3()

  function enter(position: Vector3, target: Vector3, fovDegrees = 48): void {
    focus.copy(target).sub(position)
    const length = focus.length()
    if (length <= 0.001) return
    focus.multiplyScalar(1 / length)
    yaw = Math.atan2(-focus.x, -focus.z)
    pitch = MathUtils.clamp(
      Math.asin(MathUtils.clamp(focus.y, -1, 1)),
      FIRST_PERSON_MINIMUM_PITCH,
      FIRST_PERSON_MAXIMUM_PITCH,
    )
    renderedYaw = yaw
    renderedPitch = pitch
    renderedFov = Number.isFinite(fovDegrees) ? fovDegrees : 48
  }

  function challengePose(
    target: Box3,
    safeBottomFraction: number,
    aspect: number,
  ): { yaw: number; pitch: number; fov: number } {
    target.getCenter(center)
    const dx = center.x - eye.x
    const dz = center.z - eye.z
    const targetYaw = Math.hypot(dx, dz) <= 0.001 ? yaw : Math.atan2(-dx, -dz)
    const sinYaw = Math.sin(targetYaw)
    const cosYaw = Math.cos(targetYaw)
    let bottomElevation = Number.POSITIVE_INFINITY
    let topElevation = Number.NEGATIVE_INFINITY
    let horizontalTangent = 0
    for (const x of [target.min.x, target.max.x])
      for (const y of [target.min.y, target.max.y])
        for (const z of [target.min.z, target.max.z]) {
          const cornerX = x - eye.x
          const cornerZ = z - eye.z
          const forwardDepth = Math.max(
            0.001,
            -cornerX * sinYaw - cornerZ * cosYaw,
          )
          const elevation = Math.atan2(y - eye.y, forwardDepth)
          bottomElevation = Math.min(bottomElevation, elevation)
          topElevation = Math.max(topElevation, elevation)
          horizontalTangent = Math.max(
            horizontalTangent,
            Math.abs((cornerX * cosYaw - cornerZ * sinYaw) / forwardDepth),
          )
        }
    const safeBottomNdc = -1 + MathUtils.clamp(safeBottomFraction, 0, 0.62) * 2
    const bottomLimit = safeBottomNdc + FIRST_PERSON_CHALLENGE_BOTTOM_MARGIN
    const safeAspect = Math.max(0.1, Number.isFinite(aspect) ? aspect : 1)
    const horizontalFov = MathUtils.radToDeg(
      2 *
        Math.atan(
          horizontalTangent /
            (FIRST_PERSON_CHALLENGE_HORIZONTAL_LIMIT * safeAspect),
        ),
    )
    let fov = MathUtils.clamp(
      Math.ceil(Math.max(48, horizontalFov) * 4) / 4,
      48,
      FIRST_PERSON_CHALLENGE_MAXIMUM_FOV,
    )
    let minimumPitch = 0
    let maximumPitch = 0
    while (true) {
      const tangent = Math.tan(MathUtils.degToRad(fov) / 2)
      minimumPitch =
        topElevation - Math.atan(FIRST_PERSON_CHALLENGE_TOP_LIMIT * tangent)
      maximumPitch = bottomElevation - Math.atan(bottomLimit * tangent)
      if (
        minimumPitch <= maximumPitch ||
        fov >= FIRST_PERSON_CHALLENGE_MAXIMUM_FOV
      )
        break
      fov = Math.min(FIRST_PERSON_CHALLENGE_MAXIMUM_FOV, fov + 0.25)
    }
    const targetPitch =
      minimumPitch <= maximumPitch
        ? (minimumPitch + maximumPitch) / 2
        : (bottomElevation + topElevation) / 2
    return {
      yaw: targetYaw,
      pitch: MathUtils.clamp(
        targetPitch,
        FIRST_PERSON_MINIMUM_PITCH,
        FIRST_PERSON_MAXIMUM_PITCH,
      ),
      fov,
    }
  }

  function frame(
    camera: PerspectiveCamera,
    renderedTarget: Vector3,
    options: FirstPersonFrameOptions,
  ): void {
    eye.set(
      options.playerPosition.x,
      options.playerPosition.y + FIRST_PERSON_EYE_HEIGHT,
      options.playerPosition.z,
    )
    const target = options.challengeTarget
    const challenge =
      target !== undefined && target !== null && !target.isEmpty()
    const pose = challenge
      ? challengePose(target, options.safeBottomFraction ?? 0, camera.aspect)
      : { yaw, pitch, fov: 48 }
    desiredFov = pose.fov
    desiredYaw = pose.yaw
    desiredPitch = pose.pitch
    const delta = MathUtils.clamp(options.deltaSeconds ?? 1 / 60, 0, 0.05)
    const blend = options.reducedMotion === true ? 1 : 1 - Math.exp(-11 * delta)
    const yawDelta = Math.atan2(
      Math.sin(pose.yaw - renderedYaw),
      Math.cos(pose.yaw - renderedYaw),
    )
    renderedYaw += yawDelta * blend
    renderedPitch = MathUtils.lerp(renderedPitch, pose.pitch, blend)
    renderedFov = MathUtils.lerp(renderedFov, desiredFov, blend)
    if (Math.abs(camera.fov - renderedFov) > 0.001) {
      camera.fov = renderedFov
      camera.updateProjectionMatrix()
    }
    const cosPitch = Math.cos(renderedPitch)
    renderedTarget
      .set(
        -Math.sin(renderedYaw) * cosPitch,
        Math.sin(renderedPitch),
        -Math.cos(renderedYaw) * cosPitch,
      )
      .multiplyScalar(FIRST_PERSON_FOCUS_DISTANCE)
      .add(eye)
    camera.position.copy(eye)
    camera.lookAt(renderedTarget)
  }

  return {
    enter,
    frame,
    orbit(dx: number, dy: number): void {
      yaw += Number.isFinite(dx) ? dx : 0
      pitch = MathUtils.clamp(
        pitch - (Number.isFinite(dy) ? dy : 0),
        FIRST_PERSON_MINIMUM_PITCH,
        FIRST_PERSON_MAXIMUM_PITCH,
      )
      renderedYaw = yaw
      renderedPitch = pitch
    },
    recenter(nextYaw: number): void {
      if (Number.isFinite(nextYaw)) yaw = nextYaw
      pitch = 0
      renderedYaw = yaw
      renderedPitch = pitch
    },
    yaw: () => yaw,
    pitch: () => pitch,
    renderedYaw: () => renderedYaw,
    settled: () =>
      Math.abs(
        Math.atan2(
          Math.sin(desiredYaw - renderedYaw),
          Math.cos(desiredYaw - renderedYaw),
        ),
      ) < 0.005 &&
      Math.abs(desiredPitch - renderedPitch) < 0.005 &&
      Math.abs(desiredFov - renderedFov) < 0.02,
  }
}
