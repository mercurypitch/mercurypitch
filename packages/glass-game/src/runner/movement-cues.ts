// Song runner movement cues — turn certified geometry into safe, playable HUD phases.

import { runnerReachableContinuousCorridor } from './continuous-certificates'
import type { CompiledRunnerActionWindow, CompiledRunnerCourse, CompiledRunnerGap, CompiledRunnerObstacle, RunnerSnapshot, } from './contracts'
import { runnerSlideCue } from './slide-cues'
import { runnerBeatToSeconds } from './tempo'

const EPSILON = 1e-9

export interface RunnerUsefulJumpWindow {
  readonly launchOpenCourseSeconds: number
  readonly launchCloseCourseSeconds: number
}

export interface RunnerMovementCue {
  readonly obstacleId: string
  readonly stage:
    | 'gap-ahead'
    | 'jump'
    | 'landing'
    | 'change-lane'
    | 'slide-align'
    | 'slide'
    | 'sliding'
    | 'release-slide'
  readonly direction?: 'left' | 'right'
}

function jumpAction(
  obstacle: CompiledRunnerObstacle,
): CompiledRunnerActionWindow | null {
  return (
    obstacle.certifiedActions.find((action) => action.kind === 'jump') ?? null
  )
}

function courseSecondsAtDistance(
  course: CompiledRunnerCourse,
  distanceMeters: number,
): number {
  return runnerBeatToSeconds(
    course.tempoSegments,
    distanceMeters / course.metersPerBeat,
  )
}

/**
 * Returns an inner, tested slice of the playable jump interval.
 *
 * The compiler certificate requires Merc's whole circular foot to clear each
 * edge. Runtime support is intentionally more forgiving: any foot overlap is
 * support, followed by coyote time. Move each edge to that real support
 * boundary, then keep one fixed step inside it so a displayed cue does not
 * depend on floating-point or input-quantization luck.
 */
export function runnerUsefulJumpWindow(
  course: CompiledRunnerCourse,
  gap: CompiledRunnerObstacle,
): RunnerUsefulJumpWindow | null {
  const certified = jumpAction(gap)
  if (certified === null) return null
  if (gap.kind === 'blocker') {
    if (gap.traversal?.kind !== 'jump-over') return null
    return {
      launchOpenCourseSeconds:
        certified.launchOpenCourseSeconds + course.movement.fixedStepSeconds,
      launchCloseCourseSeconds:
        certified.launchCloseCourseSeconds - course.movement.fixedStepSeconds,
    }
  }

  const flightSeconds =
    (2 * course.movement.jumpVelocityMetersPerSecond) /
    course.movement.gravityMetersPerSecondSquared
  const innerStep = course.movement.fixedStepSeconds
  const partialLandingSeconds = courseSecondsAtDistance(
    course,
    gap.maxCourseDistanceMeters - course.movement.bodyRadius,
  )
  const partialTakeoffSeconds = courseSecondsAtDistance(
    course,
    gap.minCourseDistanceMeters + course.movement.bodyRadius,
  )
  const launchOpenCourseSeconds =
    partialLandingSeconds - flightSeconds + innerStep
  const launchCloseCourseSeconds =
    partialTakeoffSeconds + course.movement.coyoteSeconds - innerStep

  if (
    !Number.isFinite(launchOpenCourseSeconds) ||
    !Number.isFinite(launchCloseCourseSeconds) ||
    launchCloseCourseSeconds <= launchOpenCourseSeconds + EPSILON
  )
    return {
      launchOpenCourseSeconds: certified.launchOpenCourseSeconds,
      launchCloseCourseSeconds: certified.launchCloseCourseSeconds,
    }

  if (course.movement.kind === 'continuous')
    return {
      launchOpenCourseSeconds: Math.max(
        launchOpenCourseSeconds,
        certified.launchOpenCourseSeconds + innerStep,
      ),
      launchCloseCourseSeconds: Math.min(
        launchCloseCourseSeconds,
        certified.launchCloseCourseSeconds - innerStep,
      ),
    }
  return { launchOpenCourseSeconds, launchCloseCourseSeconds }
}

function jumpCue(
  course: CompiledRunnerCourse,
  gap: CompiledRunnerObstacle,
  snapshot: Pick<
    RunnerSnapshot,
    'courseSeconds' | 'courseDistanceMeters' | 'player'
  >,
): RunnerMovementCue | null {
  const action = jumpAction(gap)
  const useful = runnerUsefulJumpWindow(course, gap)
  if (action === null || useful === null) return null

  const seconds = snapshot.courseSeconds
  const landingEnd =
    gap.kind === 'gap'
      ? gap.landingEndCourseDistanceMeters
      : gap.traversal?.landingEndCourseDistanceMeters
  if (landingEnd === undefined) return null
  const closeEnoughToLand =
    snapshot.courseDistanceMeters <=
    landingEnd + course.movement.bodyRadius + EPSILON
  if (
    !snapshot.player.grounded &&
    seconds >= gap.telegraphFromCourseSeconds - EPSILON &&
    seconds <=
      action.landingCloseCourseSeconds +
        course.movement.coyoteSeconds +
        course.movement.fixedStepSeconds +
        EPSILON &&
    closeEnoughToLand
  )
    return { obstacleId: gap.id, stage: 'landing' }

  if (
    snapshot.player.grounded &&
    seconds >= useful.launchOpenCourseSeconds - EPSILON &&
    seconds <= useful.launchCloseCourseSeconds + EPSILON
  )
    return { obstacleId: gap.id, stage: 'jump' }

  if (
    gap.kind === 'gap' &&
    seconds >= gap.telegraphFromCourseSeconds - EPSILON &&
    seconds < useful.launchOpenCourseSeconds - EPSILON
  )
    return { obstacleId: gap.id, stage: 'gap-ahead' }

  return null
}

function blockerCue(
  course: CompiledRunnerCourse,
  obstacle: Exclude<CompiledRunnerObstacle, CompiledRunnerGap>,
  snapshot: Pick<RunnerSnapshot, 'courseSeconds' | 'player'>,
): RunnerMovementCue | null {
  if (course.movement.kind === 'continuous') {
    if (snapshot.courseSeconds < obstacle.telegraphFromCourseSeconds - EPSILON)
      return null
    const x = snapshot.player.lateralX
    const velocity = snapshot.player.lateralVelocityMetersPerSecond
    const stoppingDistance =
      velocity ** 2 / (2 * course.movement.lateralBrakingMetersPerSecondSquared)
    const stopX = x + Math.sign(velocity) * stoppingDistance
    if (
      obstacle.certifiedActions[0]?.continuous?.safeCorridors.some(
        (corridor) =>
          x >= corridor.minLateralX &&
          x <= corridor.maxLateralX &&
          stopX >= corridor.minLateralX &&
          stopX <= corridor.maxLateralX,
      ) === true
    )
      return null
    const corridor = runnerReachableContinuousCorridor(
      course,
      obstacle,
      x,
      velocity,
      snapshot.courseSeconds,
    )
    if (corridor === null) return null
    return {
      obstacleId: obstacle.id,
      stage: 'change-lane',
      direction: corridor.axis === 1 ? 'right' : 'left',
    }
  }
  const action = obstacle.certifiedActions.find(
    (candidate) => candidate.kind === 'lane-transition',
  )
  if (
    action === undefined ||
    snapshot.courseSeconds < obstacle.telegraphFromCourseSeconds - EPSILON ||
    snapshot.courseSeconds > action.launchCloseCourseSeconds + EPSILON ||
    action.reachableLanes.includes(snapshot.player.targetLane)
  )
    return null
  return { obstacleId: obstacle.id, stage: 'change-lane' }
}

/** The nearest current physical hazard wins; vocal previews are layered by the UI. */
export function runnerMovementCue(
  course: CompiledRunnerCourse,
  snapshot: Pick<
    RunnerSnapshot,
    'courseSeconds' | 'courseDistanceMeters' | 'player'
  >,
): RunnerMovementCue | null {
  const candidates = course.obstacles
    .map((obstacle) => ({
      obstacle,
      cue:
        obstacle.kind === 'blocker' &&
        obstacle.traversal?.kind === 'slide-under'
          ? runnerSlideCue(course, obstacle, snapshot)
          : obstacle.kind === 'gap' || obstacle.traversal?.kind === 'jump-over'
            ? jumpCue(course, obstacle, snapshot)
            : blockerCue(course, obstacle, snapshot),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        obstacle: CompiledRunnerObstacle
        cue: RunnerMovementCue
      } => candidate.cue !== null,
    )
    .sort((left, right) => {
      if (left.cue.stage === 'landing' && right.cue.stage !== 'landing')
        return -1
      if (right.cue.stage === 'landing' && left.cue.stage !== 'landing')
        return 1
      return (
        Math.abs(
          left.obstacle.minCourseDistanceMeters - snapshot.courseDistanceMeters,
        ) -
        Math.abs(
          right.obstacle.minCourseDistanceMeters -
            snapshot.courseDistanceMeters,
        )
      )
    })
  return candidates[0]?.cue ?? null
}
