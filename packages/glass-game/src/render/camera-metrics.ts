// Challenge camera metrics — projects the active camera pose into stable test and UI diagnostics.

import type { PerspectiveCamera, Vector3 } from 'three'
import type { AdventureCameraMode, ChallengeCameraMetrics, } from './camera-policy'
import { frameUnion } from './camera-policy'
import type { ChallengeCameraDirectorSnapshot, ChallengeCameraScreenFrame, ChallengeCameraShot, ChallengeCameraSubjects, } from './challenge-camera'
import { projectChallengeBounds } from './challenge-camera'

interface ChallengeCameraMetricOptions {
  cameraMode: AdventureCameraMode
  firstPersonEncounterId: string | null
  firstPersonSettled: boolean
  director: ChallengeCameraDirectorSnapshot
  shot: ChallengeCameraShot | null
  subjects: ChallengeCameraSubjects | null
  camera: PerspectiveCamera
  renderedTarget: Vector3
  safeBottomFraction: number
}

export function measureChallengeCamera(
  options: ChallengeCameraMetricOptions,
): ChallengeCameraMetrics {
  const firstPersonPresenting =
    options.cameraMode === 'first-person' &&
    options.firstPersonEncounterId !== null
  const state = firstPersonPresenting
    ? {
        mode: 'holding' as const,
        encounterId: options.firstPersonEncounterId,
        progress: 1,
      }
    : options.director
  const presenting = state.mode !== 'exploration'
  const settled = firstPersonPresenting
    ? options.firstPersonSettled
    : state.mode === 'holding' &&
      options.shot !== null &&
      options.camera.position.distanceTo(options.shot.pose.position) < 0.005 &&
      options.renderedTarget.distanceTo(options.shot.pose.target) < 0.005 &&
      Math.abs(options.camera.fov - options.shot.pose.fovDegrees) < 0.01
  let mercFrame: ChallengeCameraScreenFrame | null = null
  let targetFrame: ChallengeCameraScreenFrame | null = null
  let combinedFrame: ChallengeCameraScreenFrame | null = null
  if (presenting && options.subjects !== null) {
    targetFrame = projectChallengeBounds(
      options.subjects.target,
      options.camera,
    )
    if (!firstPersonPresenting) {
      mercFrame = projectChallengeBounds(options.subjects.merc, options.camera)
      combinedFrame = frameUnion(mercFrame, targetFrame)
    } else combinedFrame = targetFrame
  }
  return {
    ...state,
    settled,
    safeBottomFraction: options.safeBottomFraction,
    position: {
      x: options.camera.position.x,
      y: options.camera.position.y,
      z: options.camera.position.z,
    },
    target: {
      x: options.renderedTarget.x,
      y: options.renderedTarget.y,
      z: options.renderedTarget.z,
    },
    mercFrame,
    targetFrame,
    combinedFrame,
    safeBottomNdc: firstPersonPresenting
      ? -1 + options.safeBottomFraction * 2
      : presenting
        ? (options.shot?.safeBottomNdc ?? null)
        : null,
    side: firstPersonPresenting
      ? null
      : presenting
        ? (options.shot?.side ?? null)
        : null,
    clearance: firstPersonPresenting
      ? null
      : presenting
        ? (options.shot?.clearance ?? null)
        : null,
    occluded: firstPersonPresenting
      ? false
      : presenting
        ? (options.shot?.occluded ?? null)
        : null,
  }
}
