// Slide guidance — align with the real opening, hold through contact, then release after the rear edge.
import type { CompiledRunnerCourse, CompiledRunnerObstacle, RunnerSnapshot, } from './contracts'

export interface RunnerSlideCue {
  readonly obstacleId: string
  readonly stage: 'slide-align' | 'slide' | 'sliding' | 'release-slide'
  readonly direction?: 'left' | 'right'
}

export function runnerSlideCue(
  course: CompiledRunnerCourse,
  obstacle: CompiledRunnerObstacle,
  snapshot: Pick<
    RunnerSnapshot,
    'courseSeconds' | 'courseDistanceMeters' | 'player'
  >,
): RunnerSlideCue | null {
  const action = obstacle.certifiedActions.find(
    (candidate) => candidate.kind === 'slide',
  )
  const corridor = action?.slideCorridor
  if (
    !action ||
    !corridor ||
    snapshot.courseSeconds < obstacle.telegraphFromCourseSeconds ||
    snapshot.courseSeconds > action.landingCloseCourseSeconds + 0.6
  )
    return null
  if (
    snapshot.courseDistanceMeters >
    obstacle.maxCourseDistanceMeters + course.movement.bodyRadius
  ) {
    return (snapshot.player.slide?.progress ?? 0) > 0
      ? { obstacleId: obstacle.id, stage: 'release-slide' }
      : null
  }
  const x = snapshot.player.lateralX
  const velocity = snapshot.player.lateralVelocityMetersPerSecond
  const stop =
    course.movement.kind === 'continuous'
      ? x +
        (Math.sign(velocity) * velocity ** 2) /
          (2 * course.movement.lateralBrakingMetersPerSecondSquared)
      : course.laneCenters[snapshot.player.targetLane]
  const outside = (position: number) =>
    position < corridor.minLateralX || position > corridor.maxLateralX
  // Lane transitions already have a committed destination. Continuous movement
  // still needs to reach the opening before correcting residual momentum.
  const alignment =
    course.movement.kind === 'continuous' && outside(x) ? x : stop
  if (outside(alignment)) {
    return {
      obstacleId: obstacle.id,
      stage: 'slide-align',
      direction:
        alignment < (corridor.minLateralX + corridor.maxLateralX) / 2
          ? 'right'
          : 'left',
    }
  }
  return {
    obstacleId: obstacle.id,
    stage: (snapshot.player.slide?.progress ?? 0) > 0 ? 'sliding' : 'slide',
  }
}
