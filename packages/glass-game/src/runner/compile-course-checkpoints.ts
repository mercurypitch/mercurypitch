// Runner checkpoint compiler — validate count-ins and safe spawn runways independently from obstacle generation.

import { RUNNER_COMPILER_EPSILON } from './compile-course-helpers.ts'
import type { CompiledRunnerCheckpoint, CompiledRunnerCourse, CompiledRunnerObstacle, } from './contracts.ts'
import { RUNNER_MAXIMUM_COUNT_IN_BEATS, RUNNER_MAXIMUM_COUNT_IN_SECONDS, } from './resource-limits.ts'
import type { SongRunnerCourseSource } from './source.ts'
import { runnerSourceFail, runnerSourceUniqueIds } from './source.ts'
import { runnerBeatToDistance, runnerBeatToSeconds } from './tempo.ts'

export function compileRunnerCheckpoints(
  course: SongRunnerCourseSource,
  obstacles: readonly CompiledRunnerObstacle[],
  tempoSegments: CompiledRunnerCourse['tempoSegments'],
  movement: CompiledRunnerCourse['movement'],
  path: string,
): readonly CompiledRunnerCheckpoint[] {
  runnerSourceUniqueIds(
    course.checkpoints.map((checkpoint) => checkpoint.id),
    `${path}.checkpoints`,
  )
  if (course.checkpoints.length === 0 || course.checkpoints[0]!.atBeat !== 0)
    runnerSourceFail(`${path}.checkpoints`, 'must begin at beat 0.')
  return course.checkpoints.map((checkpoint, index) => {
    const checkpointPath = `${path}.checkpoints[${index}]`
    if (
      !Number.isInteger(checkpoint.countInBeats) ||
      checkpoint.countInBeats < 1 ||
      checkpoint.countInBeats > RUNNER_MAXIMUM_COUNT_IN_BEATS
    )
      runnerSourceFail(
        `${checkpointPath}.countInBeats`,
        `must be an integer between 1 and ${RUNNER_MAXIMUM_COUNT_IN_BEATS}.`,
      )
    if (
      checkpoint.atBeat < 0 ||
      checkpoint.atBeat >= course.track.lengthBeats ||
      checkpoint.atBeat % course.meter.beatsPerBar !== 0
    )
      runnerSourceFail(
        `${checkpointPath}.atBeat`,
        'must lie on a bar inside the course.',
      )
    if (index > 0 && checkpoint.atBeat <= course.checkpoints[index - 1]!.atBeat)
      runnerSourceFail(`${checkpointPath}.atBeat`, 'must increase strictly.')
    const tempo = tempoSegments.find(
      (segment) =>
        checkpoint.atBeat >= segment.startBeat &&
        checkpoint.atBeat < segment.endBeat,
    )!
    const countInSeconds = checkpoint.countInBeats * (60 / tempo.bpm)
    if (
      !Number.isFinite(countInSeconds) ||
      countInSeconds > RUNNER_MAXIMUM_COUNT_IN_SECONDS
    )
      runnerSourceFail(
        `${checkpointPath}.countInBeats`,
        `must produce at most ${RUNNER_MAXIMUM_COUNT_IN_SECONDS} seconds of count-in audio.`,
      )
    const courseDistanceMeters = runnerBeatToDistance(
      checkpoint.atBeat,
      course.track.metersPerBeat,
    )
    const laneX = course.track.laneCenters[checkpoint.respawnLane]
    const runwayEndBeat = Math.min(
      course.track.lengthBeats,
      checkpoint.atBeat + course.track.spawnRunwayBeats,
    )
    const runwayEndDistance = runnerBeatToDistance(
      runwayEndBeat,
      course.track.metersPerBeat,
    )
    for (const obstacle of obstacles) {
      const blockerRadius =
        obstacle.kind === 'blocker' ? movement.bodyRadius : 0
      if (
        obstacle.maxCourseDistanceMeters <
          courseDistanceMeters - blockerRadius - RUNNER_COMPILER_EPSILON ||
        obstacle.minCourseDistanceMeters >
          runwayEndDistance + blockerRadius + RUNNER_COMPILER_EPSILON
      )
        continue
      if (obstacle.kind === 'blocker') {
        if (
          laneX >=
            obstacle.minLateralX - blockerRadius - RUNNER_COMPILER_EPSILON &&
          laneX <=
            obstacle.maxLateralX + blockerRadius + RUNNER_COMPILER_EPSILON
        )
          runnerSourceFail(
            checkpointPath,
            `runway intersects blocker "${obstacle.id}".`,
          )
      } else if (
        obstacle.lateralSpans.some(
          (span) =>
            laneX >= span.minLateralX - RUNNER_COMPILER_EPSILON &&
            laneX <= span.maxLateralX + RUNNER_COMPILER_EPSILON,
        )
      )
        runnerSourceFail(
          checkpointPath,
          `runway intersects gap "${obstacle.id}".`,
        )
    }
    return {
      id: checkpoint.id,
      beat: checkpoint.atBeat,
      courseSeconds: runnerBeatToSeconds(tempoSegments, checkpoint.atBeat),
      courseDistanceMeters,
      respawnLane: checkpoint.respawnLane,
      respawnFeetY: course.track.groundFeetY,
      countInBeats: checkpoint.countInBeats,
      runwayEndBeat,
      runwayEndCourseSeconds: runnerBeatToSeconds(tempoSegments, runwayEndBeat),
    }
  })
}
