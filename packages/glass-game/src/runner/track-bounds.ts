// Runner track bounds — one authored deck rule shared by physics and presentation.

import type { CompiledRunnerCourse, RunnerLateralCorridor, } from './contracts.ts'

export function runnerTrackBounds(
  course: Pick<CompiledRunnerCourse, 'laneCenters'>,
) {
  const halfLane = (course.laneCenters[2] - course.laneCenters[0]) / 4
  return Object.freeze({
    left: course.laneCenters[0] - halfLane,
    right: course.laneCenters[2] + halfLane,
  })
}

export function runnerBodyLateralBounds(
  course: Pick<CompiledRunnerCourse, 'laneCenters' | 'movement'>,
): RunnerLateralCorridor {
  const track = runnerTrackBounds(course)
  return {
    minLateralX: track.left + course.movement.bodyRadius,
    maxLateralX: track.right - course.movement.bodyRadius,
  }
}
