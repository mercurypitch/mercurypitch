// Runner world layout — visible support, gap language and camera framing derive from compiled gameplay.
import type { CompiledRunnerCourse, CompiledRunnerGap, } from '../runner/contracts'
import { runnerBeatToSeconds, runnerForwardSpeedAtSeconds, runnerSecondsToBeat, } from '../runner/tempo'
import { runnerTrackBounds } from '../runner/track-bounds'

export { runnerTrackBounds } from '../runner/track-bounds'

export const RUNNER_MERC_VISUAL_HEIGHT_METERS = 0.82
export const RUNNER_RESPONSIVE_MERC_VISUAL_HEIGHT_METERS = 0.95
export const RUNNER_CAMERA_LANDSCAPE_FOLLOW = 0.28
export const RUNNER_CAMERA_PORTRAIT_FOLLOW = 0.85
export const RUNNER_CONTINUOUS_CAMERA_LANDSCAPE_FOLLOW = 0.5
export const RUNNER_CONTINUOUS_CAMERA_PORTRAIT_FOLLOW = 0.95
export const RUNNER_STEERING_CLOSE_CAMERA = Object.freeze({
  heightMeters: 1.65,
  distanceMeters: 3.9,
  portraitTargetLiftMeters: 0.68,
})
export const RUNNER_GAP_APRON_METERS = 1.05
export const RUNNER_GAP_APRON_THICKNESS_METERS = 0.06
export const RUNNER_GAP_LIP_RADIUS_METERS = 0.025
const COMPACT_LANE_SPAN_METERS = 2.75
const CAMERA_FOLLOW_RESPONSE_SECONDS = 0.04

export interface RunnerCameraPose {
  readonly fovDegrees: number
  readonly x: number
  readonly y: number
  readonly z: number
  readonly targetX: number
  readonly targetY: number
  readonly targetZ: number
}

export interface RunnerGapArtConfig {
  /** Duration represented by the last ground-projected approach markers. */
  readonly projectedRunwaySeconds: number
  readonly landingBandMeters: number
}

export const DEFAULT_RUNNER_GAP_ART_CONFIG: RunnerGapArtConfig = Object.freeze({
  projectedRunwaySeconds: 0.8,
  landingBandMeters: 0.16,
})

export interface RunnerGapArtSpan {
  readonly id: string
  readonly gapId: string
  readonly chunkId: string
  readonly minX: number
  readonly maxX: number
  readonly gapStart: number
  readonly gapEnd: number
  readonly takeoffLipStart: number
  readonly takeoffLipEnd: number
  readonly projectedRunwayStart: number
  readonly projectedRunwayEnd: number
  readonly landingBandStart: number
  readonly landingBandEnd: number
}

export interface RunnerFloorCell {
  readonly chunkId: string
  readonly minX: number
  readonly maxX: number
  readonly start: number
  readonly end: number
  readonly gapApron: boolean
}

/** Visual lane seams sit halfway between the compiled collision lanes. */
export function runnerLaneDividerXs(
  course: Pick<CompiledRunnerCourse, 'laneCenters'>,
): readonly [number, number] {
  return Object.freeze([
    (course.laneCenters[0] + course.laneCenters[1]) / 2,
    (course.laneCenters[1] + course.laneCenters[2]) / 2,
  ])
}

export function runnerFloorCells(
  course: CompiledRunnerCourse,
  chunkId: string,
): RunnerFloorCell[] {
  const chunk = course.chunks.find((item) => item.id === chunkId)
  if (!chunk) throw new Error(`Unknown runner chunk: ${chunkId}`)
  const { left, right } = runnerTrackBounds(course)
  // A small solid apron surrounds the first and final standing positions.
  const start = chunk.index === 0 ? -4 : chunk.minCourseDistanceMeters
  const end =
    chunk.index === course.chunks.length - 1
      ? course.lengthMeters + 6
      : chunk.maxCourseDistanceMeters
  const gaps = course.obstacles.filter(
    (item): item is CompiledRunnerGap =>
      item.kind === 'gap' &&
      item.maxCourseDistanceMeters > start &&
      item.minCourseDistanceMeters < end,
  )
  const cuts = new Set([start, end])
  for (
    let distance = chunk.minCourseDistanceMeters;
    distance < end;
    distance += course.metersPerBeat * 4
  )
    if (distance > start) cuts.add(distance)
  for (const gap of gaps) {
    cuts.add(Math.max(start, gap.minCourseDistanceMeters))
    cuts.add(Math.min(end, gap.maxCourseDistanceMeters))
    cuts.add(
      Math.max(start, gap.minCourseDistanceMeters - RUNNER_GAP_APRON_METERS),
    )
    cuts.add(
      Math.min(end, gap.maxCourseDistanceMeters + RUNNER_GAP_APRON_METERS),
    )
  }
  const distances = [...cuts].sort((a, b) => a - b)
  const cells: RunnerFloorCell[] = []
  for (let index = 0; index < distances.length - 1; index++) {
    const a = distances[index]!,
      b = distances[index + 1]!
    const midpoint = (a + b) / 2
    const spans = gaps
      .filter(
        (gap) =>
          midpoint >= gap.minCourseDistanceMeters &&
          midpoint < gap.maxCourseDistanceMeters,
      )
      .flatMap((gap) => (gap.kind === 'gap' ? gap.lateralSpans : []))
    const xs = [
      ...new Set([
        left,
        right,
        ...spans.flatMap((span) => [
          Math.max(left, span.minLateralX),
          Math.min(right, span.maxLateralX),
        ]),
      ]),
    ].sort((x, y) => x - y)
    for (let x = 0; x < xs.length - 1; x++) {
      const minX = xs[x]!,
        maxX = xs[x + 1]!,
        middleX = (minX + maxX) / 2
      if (
        maxX <= minX ||
        spans.some(
          (span) => middleX >= span.minLateralX && middleX <= span.maxLateralX,
        )
      )
        continue
      const gapApron = gaps.some((gap) => {
        const besideGap =
          (midpoint >= gap.minCourseDistanceMeters - RUNNER_GAP_APRON_METERS &&
            midpoint < gap.minCourseDistanceMeters) ||
          (midpoint >= gap.maxCourseDistanceMeters &&
            midpoint < gap.maxCourseDistanceMeters + RUNNER_GAP_APRON_METERS)
        return Boolean(
          besideGap &&
          gap.lateralSpans.some(
            (span) =>
              middleX >= span.minLateralX && middleX <= span.maxLateralX,
          ),
        )
      })
      cells.push({ chunkId, minX, maxX, start: a, end: b, gapApron })
    }
  }
  return cells
}

function courseDistanceAtSeconds(
  course: CompiledRunnerCourse,
  seconds: number,
): number {
  return (
    runnerSecondsToBeat(course.tempoSegments, seconds) * course.metersPerBeat
  )
}

/** Builds art anchors around the exact missing support, never inside playable floor. */
export function runnerGapArtSpans(
  course: CompiledRunnerCourse,
  chunkId: string,
  config: RunnerGapArtConfig = DEFAULT_RUNNER_GAP_ART_CONFIG,
): readonly RunnerGapArtSpan[] {
  if (
    !Number.isFinite(config.projectedRunwaySeconds) ||
    config.projectedRunwaySeconds <= 0 ||
    !Number.isFinite(config.landingBandMeters) ||
    config.landingBandMeters <= 0
  )
    throw new Error('Runner gap art configuration must be finite and positive.')
  const { left, right } = runnerTrackBounds(course)
  return Object.freeze(
    course.obstacles.flatMap((obstacle) => {
      if (obstacle.kind !== 'gap' || obstacle.chunkId !== chunkId) return []
      const gap = obstacle
      const collisionEntryDistance = Math.max(
        0,
        gap.minCourseDistanceMeters - course.movement.bodyRadius,
      )
      const collisionEntrySeconds = runnerBeatToSeconds(
        course.tempoSegments,
        collisionEntryDistance / course.metersPerBeat,
      )
      const firstSeconds = course.tempoSegments[0]!.startCourseSeconds
      const runwayStartSeconds = Math.max(
        firstSeconds,
        collisionEntrySeconds - config.projectedRunwaySeconds,
      )
      const projectedRunwayStart = courseDistanceAtSeconds(
        course,
        runwayStartSeconds,
      )
      // Keep the duration meaningful even when a tempo boundary sits inside it.
      const projectedRunwayEnd = courseDistanceAtSeconds(
        course,
        collisionEntrySeconds,
      )
      const averageSpeed =
        (projectedRunwayEnd - projectedRunwayStart) /
        config.projectedRunwaySeconds
      if (
        !Number.isFinite(averageSpeed) ||
        averageSpeed <= 0 ||
        runnerForwardSpeedAtSeconds(
          course.tempoSegments,
          collisionEntrySeconds,
          course.metersPerBeat,
        ) <= 0
      )
        throw new Error(`Runner gap "${gap.id}" has no forward cue speed.`)
      return gap.lateralSpans.flatMap((span, spanIndex) => {
        const minX = Math.max(left, span.minLateralX)
        const maxX = Math.min(right, span.maxLateralX)
        if (maxX <= minX) return []
        const lipDepth = RUNNER_GAP_LIP_RADIUS_METERS * 2
        return [
          Object.freeze({
            id: `${gap.id}-${spanIndex}`,
            gapId: gap.id,
            chunkId,
            minX,
            maxX,
            gapStart: gap.minCourseDistanceMeters,
            gapEnd: gap.maxCourseDistanceMeters,
            takeoffLipStart: gap.minCourseDistanceMeters - lipDepth,
            takeoffLipEnd: gap.minCourseDistanceMeters,
            projectedRunwayStart,
            projectedRunwayEnd,
            landingBandStart: gap.maxCourseDistanceMeters,
            landingBandEnd: Math.min(
              gap.landingEndCourseDistanceMeters,
              gap.maxCourseDistanceMeters + config.landingBandMeters,
            ),
          }),
        ]
      })
    }),
  )
}

/** Responsive visual size is independent of collision; legacy visits retain their original Merc. */
export function runnerMercVisualHeightMeters(
  laneCenters: CompiledRunnerCourse['laneCenters'] = [-2, 0, 2],
  profile?: CompiledRunnerCourse['presentation']['cameraProfile'],
): number {
  return profile === 'responsive-close' ||
    profile === 'steering-close' ||
    (profile !== 'legacy-wide' &&
      laneCenters[2] - laneCenters[0] <= COMPACT_LANE_SPAN_METERS)
    ? RUNNER_RESPONSIVE_MERC_VISUAL_HEIGHT_METERS
    : RUNNER_MERC_VISUAL_HEIGHT_METERS
}

/** Camera follows the responsive runner while retaining a legacy-wide fallback. */
export function runnerCameraPose(
  aspect: number,
  laneCenters: CompiledRunnerCourse['laneCenters'] = [-2, 0, 2],
  profile?: CompiledRunnerCourse['presentation']['cameraProfile'],
): RunnerCameraPose {
  const safeAspect = Math.max(0.3, Math.min(3, aspect))
  const laneSpan = laneCenters[2] - laneCenters[0]
  if (
    profile === 'responsive-close' ||
    profile === 'steering-close' ||
    (profile !== 'legacy-wide' && laneSpan <= COMPACT_LANE_SPAN_METERS)
  ) {
    const portraitBlend = Math.max(0, Math.min(1, (1 - safeAspect) / 0.55))
    const closer = profile === 'steering-close'
    return Object.freeze({
      fovDegrees: 55 + portraitBlend * 5,
      x: 0,
      y: closer ? RUNNER_STEERING_CLOSE_CAMERA.heightMeters : 1.8,
      z: closer ? RUNNER_STEERING_CLOSE_CAMERA.distanceMeters : 4.4,
      targetX: 0,
      targetY:
        0.55 +
        portraitBlend *
          (closer
            ? RUNNER_STEERING_CLOSE_CAMERA.portraitTargetLiftMeters
            : 0.77),
      targetZ: -4.5,
    })
  }
  const distance = Math.max(5.2, 3.3 / (Math.tan(Math.PI / 6) * safeAspect))
  const portraitPullback = distance - 5.2
  return Object.freeze({
    fovDegrees: 60,
    x: 0,
    y: 2.4 + portraitPullback * 0.28,
    z: distance,
    targetX: 0,
    targetY: 0.65,
    targetZ: -4.4 - portraitPullback * 1.3,
  })
}

export function runnerCameraFollowTarget(
  lateralX: number,
  laneCenters: CompiledRunnerCourse['laneCenters'],
  aspect = 1,
  profile?: CompiledRunnerCourse['presentation']['cameraProfile'],
  continuous = false,
): number {
  if (
    profile === 'legacy-wide' ||
    (profile !== 'responsive-close' &&
      profile !== 'steering-close' &&
      laneCenters[2] - laneCenters[0] > COMPACT_LANE_SPAN_METERS)
  )
    return 0
  if (!Number.isFinite(lateralX)) return 0
  const safeAspect = Math.max(0.3, Math.min(3, aspect))
  const portraitBlend = Math.max(0, Math.min(1, (1 - safeAspect) / 0.55))
  const strength = continuous
    ? RUNNER_CONTINUOUS_CAMERA_LANDSCAPE_FOLLOW +
      portraitBlend *
        (RUNNER_CONTINUOUS_CAMERA_PORTRAIT_FOLLOW -
          RUNNER_CONTINUOUS_CAMERA_LANDSCAPE_FOLLOW)
    : RUNNER_CAMERA_LANDSCAPE_FOLLOW +
      portraitBlend *
        (RUNNER_CAMERA_PORTRAIT_FOLLOW - RUNNER_CAMERA_LANDSCAPE_FOLLOW)
  return lateralX * strength
}

/** Applies a bounded, frame-rate-independent response without overshoot. */
export function stepRunnerCameraFollow(
  currentX: number,
  targetX: number,
  deltaSeconds: number,
): number {
  if (!Number.isFinite(targetX)) return Number.isFinite(currentX) ? currentX : 0
  if (!Number.isFinite(currentX)) return targetX
  const dt = Number.isFinite(deltaSeconds)
    ? Math.max(0, Math.min(deltaSeconds, 0.1))
    : 0
  if (dt === 0) return currentX
  const response = 1 - Math.exp(-dt / CAMERA_FOLLOW_RESPONSE_SECONDS)
  return currentX + (targetX - currentX) * response
}
