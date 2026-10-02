// Song runner movement cues — turn certified geometry into safe, playable HUD phases.

import type { CompiledRunnerActionWindow, CompiledRunnerCourse, CompiledRunnerGap, CompiledRunnerObstacle, RunnerSnapshot, } from './contracts'
import { runnerBeatToSeconds } from './tempo'

const EPSILON = 1e-9

export interface RunnerUsefulJumpWindow {
  readonly launchOpenCourseSeconds: number
  readonly launchCloseCourseSeconds: number
}

export interface RunnerMovementCue {
  readonly obstacleId: string
  readonly stage: 'gap-ahead' | 'jump' | 'landing' | 'change-lane'
}

function jumpAction(gap: CompiledRunnerGap): CompiledRunnerActionWindow | null {
  return gap.certifiedActions.find((action) => action.kind === 'jump') ?? null
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
  gap: CompiledRunnerGap,
): RunnerUsefulJumpWindow | null {
  const certified = jumpAction(gap)
  if (certified === null) return null

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

  return { launchOpenCourseSeconds, launchCloseCourseSeconds }
}

function gapCue(
  course: CompiledRunnerCourse,
  gap: CompiledRunnerGap,
  snapshot: Pick<
    RunnerSnapshot,
    'courseSeconds' | 'courseDistanceMeters' | 'player'
  >,
): RunnerMovementCue | null {
  const action = jumpAction(gap)
  const useful = runnerUsefulJumpWindow(course, gap)
  if (action === null || useful === null) return null

  const seconds = snapshot.courseSeconds
  const closeEnoughToLand =
    snapshot.courseDistanceMeters <=
    gap.landingEndCourseDistanceMeters + course.movement.bodyRadius + EPSILON
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
    seconds >= gap.telegraphFromCourseSeconds - EPSILON &&
    seconds < useful.launchOpenCourseSeconds - EPSILON
  )
    return { obstacleId: gap.id, stage: 'gap-ahead' }

  return null
}

function blockerCue(
  obstacle: Exclude<CompiledRunnerObstacle, CompiledRunnerGap>,
  snapshot: Pick<RunnerSnapshot, 'courseSeconds' | 'player'>,
): RunnerMovementCue | null {
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
        obstacle.kind === 'gap'
          ? gapCue(course, obstacle, snapshot)
          : blockerCue(obstacle, snapshot),
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
