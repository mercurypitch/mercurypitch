// Runner slide stance — bounded body lowering and ceiling-safe release shared by both movement solvers.

import type { RunnerBlockerMotionPiece } from './blocker-collision'
import { runnerBodyHitsBlocker } from './blocker-collision'
import type { CompiledRunnerCourse, RunnerSlideSnapshot } from './contracts'
import type { RunnerMovementState } from './movement-contracts'

export function runnerSlideBodyHeight(
  course: CompiledRunnerCourse,
  state: Pick<RunnerMovementState, 'slideProgress'>,
): number {
  const standing = course.movement.bodyHeight
  return (
    standing -
    (standing - (course.movement.slide?.bodyHeightMeters ?? standing)) *
      state.slideProgress
  )
}

export function runnerSlideSnapshot(
  course: CompiledRunnerCourse,
  state: RunnerMovementState,
): RunnerSlideSnapshot | undefined {
  if (course.movement.slide === undefined) return undefined
  return {
    phase: state.slidePhase,
    progress: state.slideProgress,
    bodyHeightMeters: runnerSlideBodyHeight(course, state),
  }
}

/** Return the largest body during the sweep: shortening cannot retroactively clear contact. */
export function advanceRunnerSlide(
  course: CompiledRunnerCourse,
  state: RunnerMovementState,
  piece: RunnerBlockerMotionPiece,
): number {
  const profile = course.movement.slide
  if (profile === undefined) return course.movement.bodyHeight
  const startHeight = runnerSlideBodyHeight(course, state)
  if (!state.grounded) state.slideHeld = false
  if (state.slideHeld) {
    state.slideProgress = Math.min(
      1,
      state.slideProgress + piece.duration / profile.enterSeconds,
    )
    state.slidePhase = state.slideProgress >= 1 ? 'sliding' : 'lowering'
  } else if (state.slideProgress > 0) {
    // Test the complete standing silhouette, not just headroom at the end of
    // a frame. Release/cancel under the arch remains low until safely outside.
    const blocked = course.obstacles.some(
      (obstacle) =>
        obstacle.kind === 'blocker' &&
        runnerBodyHitsBlocker(course, obstacle, piece),
    )
    if (!blocked)
      state.slideProgress = Math.max(
        0,
        state.slideProgress - piece.duration / profile.exitSeconds,
      )
    state.slidePhase =
      state.slideProgress === 0 ? 'standing' : blocked ? 'sliding' : 'rising'
  } else state.slidePhase = 'standing'
  return Math.max(startHeight, runnerSlideBodyHeight(course, state))
}
