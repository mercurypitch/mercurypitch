// Third-person passage framing — shortens the boom when bounded walls or ceilings crowd the view.

import { MathUtils, Vector3 } from 'three'

export const PASSAGE_CLEARANCE_SAMPLE_DISTANCE = 2.4
export const PASSAGE_CAMERA_MARGIN = 0.22
export const MINIMUM_THIRD_PERSON_REACH = 0.72
const MINIMUM_READABLE_PASSAGE_WIDTH = 0.9

export interface ThirdPersonClearance {
  left: number
  right: number
  headroom: number
}

export interface ThirdPersonReachOptions {
  requestedReach: number
  aspect: number
  fovDegrees: number
  pitch: number
  clearance: ThirdPersonClearance
}

export type ClearanceProbe = (direction: Vector3, reach: number) => number

export function sampleThirdPersonClearance(
  facingYaw: number,
  probe: ClearanceProbe,
): ThirdPersonClearance {
  const left = new Vector3(Math.cos(facingYaw), 0, -Math.sin(facingYaw))
  const right = left.clone().multiplyScalar(-1)
  return {
    left: probe(left, PASSAGE_CLEARANCE_SAMPLE_DISTANCE),
    right: probe(right, PASSAGE_CLEARANCE_SAMPLE_DISTANCE),
    headroom: probe(new Vector3(0, 1, 0), PASSAGE_CLEARANCE_SAMPLE_DISTANCE),
  }
}

function usable(value: number): number {
  return Number.isFinite(value)
    ? Math.max(0, value - PASSAGE_CAMERA_MARGIN)
    : PASSAGE_CLEARANCE_SAMPLE_DISTANCE
}

export function contextualThirdPersonReach(
  options: ThirdPersonReachOptions,
): number {
  const requested = Math.max(
    MINIMUM_THIRD_PERSON_REACH,
    Number.isFinite(options.requestedReach) ? options.requestedReach : 4,
  )
  const aspect = Math.max(
    0.2,
    Number.isFinite(options.aspect) ? options.aspect : 1,
  )
  const fov = MathUtils.degToRad(
    MathUtils.clamp(
      Number.isFinite(options.fovDegrees) ? options.fovDegrees : 48,
      20,
      100,
    ),
  )
  const left = usable(options.clearance.left)
  const right = usable(options.clearance.right)
  const boundedOnBothSides =
    options.clearance.left < PASSAGE_CLEARANCE_SAMPLE_DISTANCE - 0.01 &&
    options.clearance.right < PASSAGE_CLEARANCE_SAMPLE_DISTANCE - 0.01 &&
    options.clearance.left + options.clearance.right >=
      MINIMUM_READABLE_PASSAGE_WIDTH
  const lateralReach = boundedOnBothSides
    ? Math.min(left, right) / (Math.tan(fov / 2) * aspect)
    : requested
  const rise = Math.max(0.001, Math.sin(Math.max(0, options.pitch)))
  const ceilingReach =
    options.clearance.headroom >= 0.35 &&
    options.clearance.headroom < PASSAGE_CLEARANCE_SAMPLE_DISTANCE - 0.01
      ? usable(options.clearance.headroom) / rise
      : requested
  return MathUtils.clamp(
    Math.min(requested, lateralReach, ceilingReach),
    MINIMUM_THIRD_PERSON_REACH,
    requested,
  )
}

export function createThirdPersonFraming() {
  let renderedReach: number | null = null
  return {
    reset(): void {
      renderedReach = null
    },
    snap(reach: number): void {
      renderedReach = Number.isFinite(reach) ? Math.max(0, reach) : null
    },
    update(options: {
      requestedReach: number
      contextualReach: number
      minimumReadableReach?: number
      safeReach: number
      deltaSeconds: number
      snap: boolean
    }): number {
      const minimumReadableReach = Number.isFinite(options.minimumReadableReach)
        ? Math.max(0, options.minimumReadableReach!)
        : 0
      const contextualReach = Math.max(
        options.contextualReach,
        Math.min(minimumReadableReach, options.safeReach),
      )
      const desired = Math.min(
        options.requestedReach,
        contextualReach,
        options.safeReach,
      )
      if (options.snap || renderedReach === null) renderedReach = desired
      else {
        // A physical obstruction is a hard cap. Contextual narrowing and open
        // space recovery ease so crossing a room boundary cannot pop the eye.
        renderedReach = Math.min(renderedReach, options.safeReach)
        const response = 2.8
        renderedReach = MathUtils.lerp(
          renderedReach,
          desired,
          1 - Math.exp(-response * options.deltaSeconds),
        )
      }
      return Math.min(options.safeReach, renderedReach)
    },
  }
}
