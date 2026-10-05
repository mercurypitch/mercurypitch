// Continuous runner certificates — conservative reachable corridors and checkpoint-to-finish ordering.

import type { ContinuousRunnerMovementProfile } from './continuous-lateral.ts'
import { runnerContinuousReachSeconds } from './continuous-lateral.ts'
import type { CompiledRunnerCourse, CompiledRunnerObstacle, RunnerContinuousCertificate, } from './contracts.ts'
import type { SongRunnerCourseSource } from './source.ts'
import { runnerSourceFail } from './source.ts'
import { runnerBeatToSeconds } from './tempo.ts'
import { runnerBodyLateralBounds } from './track-bounds.ts'

const CLEARANCE = 0.02

export function runnerContinuousBlockerCertificate(
  source: SongRunnerCourseSource,
  movement: ContinuousRunnerMovementProfile,
  minLateralX: number,
  maxLateralX: number,
): RunnerContinuousCertificate {
  const entry = runnerBodyLateralBounds({
    laneCenters: source.track.laneCenters,
    movement,
  })
  const safeCorridors: RunnerContinuousCertificate['safeCorridors'][number][] =
    []
  const left = minLateralX - movement.bodyRadius - CLEARANCE
  const right = maxLateralX + movement.bodyRadius + CLEARANCE
  if (left > entry.minLateralX)
    safeCorridors.push({
      minLateralX: entry.minLateralX,
      maxLateralX: left,
      axis: -1,
    })
  if (right < entry.maxLateralX)
    safeCorridors.push({
      minLateralX: right,
      maxLateralX: entry.maxLateralX,
      axis: 1,
    })
  const requiredManeuverSeconds = Math.min(
    ...safeCorridors.map((corridor) =>
      runnerContinuousReachSeconds(
        movement,
        corridor.axis === 1
          ? corridor.minLateralX - entry.minLateralX
          : entry.maxLateralX - corridor.maxLateralX,
      ),
    ),
  )
  return {
    version: 1,
    entry,
    maximumEntrySpeedMetersPerSecond: movement.maxLateralSpeedMetersPerSecond,
    safeCorridors,
    requiredManeuverSeconds,
    inputMarginSeconds: movement.fixedStepSeconds * 2,
  }
}

/** The chosen held direction must remain attainable from actual X and velocity. */
export function runnerReachableContinuousCorridor(
  course: CompiledRunnerCourse,
  obstacle: Extract<CompiledRunnerObstacle, { kind: 'blocker' }>,
  lateralX: number,
  velocity: number,
  seconds: number,
): RunnerContinuousCertificate['safeCorridors'][number] | null {
  if (course.movement.kind !== 'continuous') return null
  const movement = course.movement
  const certificate = obstacle.certifiedActions[0]?.continuous
  if (certificate === undefined) return null
  const contact = runnerBeatToSeconds(
    course.tempoSegments,
    (obstacle.minCourseDistanceMeters - course.movement.bodyRadius) /
      course.metersPerBeat,
  )
  return (
    certificate.safeCorridors.find((corridor) => {
      const distance =
        corridor.axis === 1
          ? corridor.minLateralX - lateralX
          : lateralX - corridor.maxLateralX
      // A clear position with inward momentum still needs a turn before claiming safety.
      const awaySpeed = Math.max(0, -velocity * corridor.axis)
      const excursion =
        awaySpeed ** 2 /
        (2 * movement.lateralAccelerationMetersPerSecondSquared)
      if (distance < -excursion) return true
      return (
        runnerContinuousReachSeconds(
          movement,
          Math.max(0, distance),
          velocity * corridor.axis,
        ) +
          certificate.inputMarginSeconds <=
        contact - seconds + 1e-9
      )
    }) ?? null
  )
}

/** Whole-domain certificates compose only when the previous physical hazard is clear. */
export function validateContinuousRunnerReachability(
  source: SongRunnerCourseSource,
  obstacles: readonly CompiledRunnerObstacle[],
  tempo: CompiledRunnerCourse['tempoSegments'],
  movement: ContinuousRunnerMovementProfile,
  path: string,
): void {
  for (const [checkpointIndex, checkpoint] of source.checkpoints.entries()) {
    let available = runnerBeatToSeconds(tempo, checkpoint.atBeat)
    const start = checkpoint.atBeat * source.track.metersPerBeat
    for (const [index, obstacle] of obstacles.entries()) {
      if (obstacle.maxCourseDistanceMeters + movement.bodyRadius < start)
        continue
      const action = obstacle.certifiedActions[0]!
      if (
        Math.max(available, action.launchOpenCourseSeconds) >
        action.launchCloseCourseSeconds
      )
        runnerSourceFail(
          `${path}.checkpoints[${checkpointIndex}]`,
          `has no certified continuous route through obstacle ${index} "${obstacle.id}".`,
        )
      available =
        obstacle.kind === 'gap'
          ? action.landingCloseCourseSeconds
          : runnerBeatToSeconds(
              tempo,
              (obstacle.maxCourseDistanceMeters + movement.bodyRadius) /
                source.track.metersPerBeat,
            ) + movement.fixedStepSeconds
      if (available >= runnerBeatToSeconds(tempo, source.track.lengthBeats))
        runnerSourceFail(
          `${path}.obstacles[${index}]`,
          'leaves no continuous landing interval before the finish.',
        )
    }
  }
}
