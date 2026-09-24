// ============================================================
// Challenge camera — plan and animate a reversible two-subject museum shot.
// ============================================================
//
// The voice flow starts before the simulation owns an active encounter. This
// module therefore deals only in an explicit encounter id, real display bounds
// and camera poses; scoring and challenge timing remain in the game core.

import type { Box3 } from 'three'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'

export type ChallengeCameraMode =
  | 'exploration'
  | 'entering'
  | 'holding'
  | 'restoring'

export interface ChallengeCameraPose {
  position: Vector3
  target: Vector3
  fovDegrees: number
}

export interface ChallengeCameraSubjects {
  encounterId: string
  merc: Box3
  target: Box3
  /** World-space normal for a flat exhibit whose face must stay readable. */
  targetFacing?: Vector3
}

export interface ChallengeCameraScreenFrame {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface ChallengeCameraShot {
  pose: ChallengeCameraPose
  mercFrame: ChallengeCameraScreenFrame
  targetFrame: ChallengeCameraScreenFrame
  combinedFrame: ChallengeCameraScreenFrame
  safeBottomNdc: number
  side: -1 | 1
  clearance: number
  occluded: boolean
}

export interface ChallengeCameraPlanOptions {
  aspect: number
  fovDegrees: number
  near: number
  far: number
  safeBottomFraction: number
  currentPosition: Vector3
  /** Keeps live-panel reframes on their established side when it still fits. */
  preferredSide?: -1 | 1
  /** Restricts a desired centre to real room and wall clearance. */
  constrainPosition?: (focus: Vector3, desired: Vector3) => Vector3
  /** True when authored geometry blocks a subject from this centre. */
  isOccluded?: (position: Vector3, subject: Vector3) => boolean
}

export interface ChallengeCameraDirectorSnapshot {
  mode: ChallengeCameraMode
  encounterId: string | null
  progress: number
}

interface ChallengeCameraDirectorInput {
  encounterId: string | null
  paused: boolean
  deltaSeconds: number
  explorationPose: ChallengeCameraPose
  /** Player displacement while restoring; keeps the saved orbit player-relative. */
  returnOffset?: Vector3
  shot: ChallengeCameraShot | null
}

const HORIZONTAL_LIMIT = 0.88
const TOP_LIMIT = 0.86
const BOTTOM_MARGIN = 0.07
const MINIMUM_DISTANCE = 1.45
const MAXIMUM_DISTANCE = 8.5
const DISTANCE_STEP = 0.18
const THREE_QUARTER_BIASES = [0.3, 0.95, 1.25] as const
const PLANAR_THREE_QUARTER_BIASES = [0.48, 0.62, 0.76] as const
const ENTRY_SECONDS = 0.82
const RESTORE_SECONDS = 0.72
const MAXIMUM_PORTRAIT_FOV_BOOST = 10

const corners = Array.from({ length: 8 }, () => new Vector3())

function boxCorners(box: Box3): readonly Vector3[] {
  let index = 0
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) corners[index++].set(x, y, z)
  return corners
}

export function projectChallengeBounds(
  box: Box3,
  camera: PerspectiveCamera,
): ChallengeCameraScreenFrame {
  camera.updateMatrixWorld(true)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const corner of boxCorners(box)) {
    corner.project(camera)
    minX = Math.min(minX, corner.x)
    maxX = Math.max(maxX, corner.x)
    minY = Math.min(minY, corner.y)
    maxY = Math.max(maxY, corner.y)
  }
  return { minX, maxX, minY, maxY }
}

function unionFrame(
  first: ChallengeCameraScreenFrame,
  second: ChallengeCameraScreenFrame,
): ChallengeCameraScreenFrame {
  return {
    minX: Math.min(first.minX, second.minX),
    maxX: Math.max(first.maxX, second.maxX),
    minY: Math.min(first.minY, second.minY),
    maxY: Math.max(first.maxY, second.maxY),
  }
}

function frameOverflow(
  frame: ChallengeCameraScreenFrame,
  safeBottomNdc: number,
): number {
  return (
    Math.max(0, -HORIZONTAL_LIMIT - frame.minX) +
    Math.max(0, frame.maxX - HORIZONTAL_LIMIT) +
    Math.max(0, safeBottomNdc - frame.minY) +
    Math.max(0, frame.maxY - TOP_LIMIT)
  )
}

function finiteFrame(frame: ChallengeCameraScreenFrame): boolean {
  return (
    Number.isFinite(frame.minX) &&
    Number.isFinite(frame.maxX) &&
    Number.isFinite(frame.minY) &&
    Number.isFinite(frame.maxY)
  )
}

function configureProbe(
  camera: PerspectiveCamera,
  pose: ChallengeCameraPose,
): void {
  camera.fov = pose.fovDegrees
  camera.updateProjectionMatrix()
  camera.position.copy(pose.position)
  camera.lookAt(pose.target)
  camera.updateMatrixWorld(true)
}

function aimForSafeArea(
  camera: PerspectiveCamera,
  position: Vector3,
  focus: Vector3,
  combined: Box3,
  safeBottomNdc: number,
): ChallengeCameraPose {
  const target = focus.clone()
  const desiredCentreY = (safeBottomNdc + TOP_LIMIT) / 2
  for (let attempt = 0; attempt < 2; attempt++) {
    configureProbe(camera, {
      position,
      target,
      fovDegrees: camera.fov,
    })
    const frame = projectChallengeBounds(combined, camera)
    if (!finiteFrame(frame)) break
    const currentCentreY = (frame.minY + frame.maxY) / 2
    const worldHalfHeight =
      position.distanceTo(target) * Math.tan(MathUtils.degToRad(camera.fov) / 2)
    target.y -= (desiredCentreY - currentCentreY) * worldHalfHeight
  }
  return { position: position.clone(), target, fovDegrees: camera.fov }
}

function candidateDirections(
  mercCentre: Vector3,
  targetCentre: Vector3,
  focus: Vector3,
  currentPosition: Vector3,
  targetFacing?: Vector3,
): { side: -1 | 1; direction: Vector3 }[] {
  const subjectLine = targetCentre.clone().sub(mercCentre)
  subjectLine.y = 0
  if (subjectLine.lengthSq() < 0.0001) {
    subjectLine.copy(focus).sub(currentPosition)
    subjectLine.y = 0
  }
  if (subjectLine.lengthSq() < 0.0001) subjectLine.set(0, 0, -1)
  subjectLine.normalize()
  const planarTarget = targetFacing !== undefined && targetFacing.lengthSq() > 0
  // A flat exhibit has a real front. Build its shot from that front rather
  // than from Merc toward the exhibit: the latter places the eye behind the
  // painting when both subjects stand on the same line, as on Cloudway.
  const approach = planarTarget ? targetFacing : subjectLine
  const side = new Vector3(-approach.z, 0, approach.x)
  const biases = planarTarget
    ? PLANAR_THREE_QUARTER_BIASES
    : THREE_QUARTER_BIASES
  return ([-1, 1] as const).flatMap((sign) =>
    biases.map((bias) => ({
      side: sign,
      // Tight portrait rooms need a more oblique three-quarter view to put
      // subject separation into depth. The shallow option remains available
      // for wide rooms where a clearer side profile fits.
      direction: side
        .clone()
        .multiplyScalar(sign)
        .addScaledVector(approach, bias)
        .normalize(),
    })),
  )
}

/**
 * Chooses the clearer three-quarter side, then finds the nearest elevated centre
 * that fits Merc and the authored exhibit above the measured singing panel.
 */
export function planChallengeCameraShot(
  subjects: ChallengeCameraSubjects,
  options: ChallengeCameraPlanOptions,
): ChallengeCameraShot {
  const merc = subjects.merc.clone()
  const target = subjects.target.clone()
  const combined = merc.clone().union(target)
  const mercCentre = merc.getCenter(new Vector3())
  const targetCentre = target.getCenter(new Vector3())
  const targetFacing = subjects.targetFacing?.clone()
  if (targetFacing !== undefined) {
    targetFacing.y = 0
    if (targetFacing.lengthSq() < 0.0001) targetFacing.set(0, 0, 0)
    else targetFacing.normalize()
  }
  const focus = combined.getCenter(new Vector3())
  const size = combined.getSize(new Vector3())
  const safeBottomFraction = MathUtils.clamp(
    Number.isFinite(options.safeBottomFraction)
      ? options.safeBottomFraction
      : 0,
    0,
    0.62,
  )
  const safeBottomNdc = Math.min(
    TOP_LIMIT - 0.3,
    -1 + safeBottomFraction * 2 + BOTTOM_MARGIN,
  )
  const cinematicFov =
    options.fovDegrees +
    MathUtils.clamp(
      (1 - Math.max(0.2, options.aspect)) * 18,
      0,
      MAXIMUM_PORTRAIT_FOV_BOOST,
    )
  const camera = new PerspectiveCamera(
    cinematicFov,
    Math.max(0.2, options.aspect),
    options.near,
    options.far,
  )
  camera.updateProjectionMatrix()
  const cameraY = merc.max.y + MathUtils.clamp(size.y * 0.15, 0.12, 0.28)
  const subjectSeparation = Math.hypot(
    targetCentre.x - mercCentre.x,
    targetCentre.z - mercCentre.z,
  )
  const initialDistance = Math.max(
    MINIMUM_DISTANCE,
    subjectSeparation * 1.25,
    Math.max(size.x, size.y, size.z) * 1.45,
  )
  const firstDistance = Math.min(initialDistance, MAXIMUM_DISTANCE)
  let best: (ChallengeCameraShot & { score: number }) | undefined

  for (const candidate of candidateDirections(
    mercCentre,
    targetCentre,
    focus,
    options.currentPosition,
    targetFacing,
  )) {
    let previousActualDistance = -1
    for (
      let requestedDistance = firstDistance;
      requestedDistance <= MAXIMUM_DISTANCE + 0.001;
      requestedDistance += DISTANCE_STEP
    ) {
      const desired = focus
        .clone()
        .addScaledVector(candidate.direction, requestedDistance)
      desired.y = cameraY
      const constrained = options.constrainPosition?.(focus, desired) ?? desired
      const actualDistance = constrained.distanceTo(focus)
      const pose = aimForSafeArea(
        camera,
        constrained,
        focus,
        combined,
        safeBottomNdc,
      )
      configureProbe(camera, pose)
      const mercFrame = projectChallengeBounds(merc, camera)
      const targetFrame = projectChallengeBounds(target, camera)
      const combinedFrame = unionFrame(mercFrame, targetFrame)
      const overflow = finiteFrame(combinedFrame)
        ? frameOverflow(combinedFrame, safeBottomNdc)
        : 100
      const occluded =
        options.isOccluded?.(pose.position, mercCentre) === true ||
        options.isOccluded?.(pose.position, targetCentre) === true
      const clearance = MathUtils.clamp(
        actualDistance / Math.max(requestedDistance, 0.001),
        0,
        1,
      )
      const screenSeparation = Math.abs(
        (mercFrame.minX + mercFrame.maxX) / 2 -
          (targetFrame.minX + targetFrame.maxX) / 2,
      )
      const targetView = pose.position.clone().sub(targetCentre)
      targetView.y = 0
      const faceReadability =
        targetFacing === undefined || targetFacing.lengthSq() === 0
          ? 1
          : targetView.normalize().dot(targetFacing)
      const fits = overflow <= 0.001
      const readableFaceScore =
        targetFacing === undefined
          ? 0
          : faceReadability * 26 - Math.max(0, 0.45 - faceReadability) * 80
      const preferredSideScore =
        fits && !occluded && candidate.side === options.preferredSide ? 18 : 0
      const score =
        (fits ? 100 : 0) -
        overflow * 120 -
        (occluded ? 80 : 0) +
        clearance * 8 +
        screenSeparation * 3 -
        pose.position.distanceTo(options.currentPosition) * 0.12 +
        readableFaceScore +
        preferredSideScore
      if (best === undefined || score > best.score)
        best = {
          pose,
          mercFrame,
          targetFrame,
          combinedFrame,
          safeBottomNdc,
          side: candidate.side,
          clearance,
          occluded,
          score,
        }
      if (overflow <= 0.001 && !occluded && clearance > 0.98) break
      if (
        Math.abs(previousActualDistance - actualDistance) < 0.001 &&
        requestedDistance - actualDistance > DISTANCE_STEP
      )
        break
      previousActualDistance = actualDistance
    }
  }

  if (best === undefined)
    throw new Error(
      `Unable to plan challenge camera for ${subjects.encounterId}`,
    )
  return {
    pose: best.pose,
    mercFrame: best.mercFrame,
    targetFrame: best.targetFrame,
    combinedFrame: best.combinedFrame,
    safeBottomNdc: best.safeBottomNdc,
    side: best.side,
    clearance: best.clearance,
    occluded: best.occluded,
  }
}

function copyPose(pose: ChallengeCameraPose): ChallengeCameraPose {
  return {
    position: pose.position.clone(),
    target: pose.target.clone(),
    fovDegrees: pose.fovDegrees,
  }
}

function interpolatePose(
  from: ChallengeCameraPose,
  to: ChallengeCameraPose,
  amount: number,
): ChallengeCameraPose {
  const t = MathUtils.clamp(amount, 0, 1)
  const target = from.target.clone().lerp(to.target, t)
  const fromOffset = from.position.clone().sub(from.target)
  const toOffset = to.position.clone().sub(to.target)
  const fromYaw = Math.atan2(fromOffset.x, fromOffset.z)
  const toYaw = Math.atan2(toOffset.x, toOffset.z)
  const yaw =
    fromYaw +
    Math.atan2(Math.sin(toYaw - fromYaw), Math.cos(toYaw - fromYaw)) * t
  const horizontal = MathUtils.lerp(
    Math.hypot(fromOffset.x, fromOffset.z),
    Math.hypot(toOffset.x, toOffset.z),
    t,
  )
  const vertical = MathUtils.lerp(fromOffset.y, toOffset.y, t)
  return {
    position: target
      .clone()
      .add(
        new Vector3(
          Math.sin(yaw) * horizontal,
          vertical,
          Math.cos(yaw) * horizontal,
        ),
      ),
    target,
    fovDegrees: MathUtils.lerp(from.fovDegrees, to.fovDegrees, t),
  }
}

function easeInOutCubic(value: number): number {
  const t = MathUtils.clamp(value, 0, 1)
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/** Owns only the cinematic lifecycle; exploration orbit state stays outside. */
export function createChallengeCameraDirector(options: {
  reducedMotion: boolean
}) {
  let mode: ChallengeCameraMode = 'exploration'
  let encounterId: string | null = null
  let progress = 0
  let elapsed = 0
  let fromPose: ChallengeCameraPose | null = null
  let shotPose: ChallengeCameraPose | null = null
  let returnPose: ChallengeCameraPose | null = null
  let currentPose: ChallengeCameraPose | null = null

  function begin(
    id: string,
    explorationPose: ChallengeCameraPose,
    shot: ChallengeCameraShot,
  ): void {
    encounterId = id
    mode = 'entering'
    elapsed = 0
    progress = 0
    fromPose = copyPose(currentPose ?? explorationPose)
    returnPose ??= copyPose(explorationPose)
    shotPose = copyPose(shot.pose)
    currentPose = copyPose(fromPose)
  }

  function restore(): void {
    if (returnPose === null || currentPose === null) {
      mode = 'exploration'
      encounterId = null
      return
    }
    mode = 'restoring'
    elapsed = 0
    progress = 0
    fromPose = copyPose(currentPose)
  }

  return {
    active: () => mode !== 'exploration',
    snapshot: (): ChallengeCameraDirectorSnapshot => ({
      mode,
      encounterId,
      progress,
    }),
    update(input: ChallengeCameraDirectorInput): ChallengeCameraPose | null {
      if (!input.paused) {
        if (
          input.encounterId !== null &&
          input.shot !== null &&
          (mode === 'exploration' || encounterId !== input.encounterId)
        )
          begin(input.encounterId, input.explorationPose, input.shot)
        else if (
          input.encounterId !== null &&
          input.shot !== null &&
          mode === 'restoring'
        )
          begin(input.encounterId, input.explorationPose, input.shot)
        else if (
          input.encounterId === null &&
          (mode === 'entering' || mode === 'holding')
        )
          restore()
        else if (
          input.encounterId !== null &&
          input.shot !== null &&
          encounterId === input.encounterId &&
          mode !== 'restoring'
        )
          shotPose = copyPose(input.shot.pose)
      }

      if (mode === 'exploration') return null
      if (input.paused)
        return currentPose === null ? null : copyPose(currentPose)

      const safeDelta = Number.isFinite(input.deltaSeconds)
        ? MathUtils.clamp(input.deltaSeconds, 0, 0.05)
        : 0
      if (mode === 'holding') {
        progress = 1
        if (shotPose !== null && currentPose !== null)
          currentPose = interpolatePose(
            currentPose,
            shotPose,
            options.reducedMotion ? 1 : 1 - Math.exp(-8 * safeDelta),
          )
        else if (shotPose !== null) currentPose = copyPose(shotPose)
        return currentPose === null ? null : copyPose(currentPose)
      }

      const duration = options.reducedMotion
        ? 0
        : mode === 'entering'
          ? ENTRY_SECONDS
          : RESTORE_SECONDS
      elapsed += safeDelta
      progress = duration === 0 ? 1 : MathUtils.clamp(elapsed / duration, 0, 1)
      let destination = mode === 'entering' ? shotPose : returnPose
      if (
        mode === 'restoring' &&
        destination !== null &&
        input.returnOffset !== undefined
      )
        destination = {
          position: destination.position.clone().add(input.returnOffset),
          target: destination.target.clone().add(input.returnOffset),
          fovDegrees: destination.fovDegrees,
        }
      if (fromPose === null || destination === null) {
        mode = 'exploration'
        encounterId = null
        currentPose = null
        return null
      }
      currentPose = interpolatePose(
        fromPose,
        destination,
        easeInOutCubic(progress),
      )
      if (progress < 1) return copyPose(currentPose)
      currentPose = copyPose(destination)
      if (mode === 'entering') {
        mode = 'holding'
        progress = 1
        return copyPose(currentPose)
      }

      const restored = copyPose(currentPose)
      mode = 'exploration'
      encounterId = null
      progress = 0
      elapsed = 0
      fromPose = null
      shotPose = null
      returnPose = null
      currentPose = null
      return restored
    },
    clear(): void {
      mode = 'exploration'
      encounterId = null
      progress = 0
      elapsed = 0
      fromPose = null
      shotPose = null
      returnPose = null
      currentPose = null
    },
  }
}
