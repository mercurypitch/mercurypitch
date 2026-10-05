// Song runner hurdle compiler — bound a whole-body flight above a low obstacle crown.

import type { CompiledRunnerCourse } from './contracts.ts'
import type { RunnerBlockerCatalogProfile } from './source.ts'
import { runnerSourceFail } from './source.ts'

export function runnerHurdleJumpWindow(
  profile: RunnerBlockerCatalogProfile,
  movement: CompiledRunnerCourse['movement'],
  minimumDistance: number,
  maximumDistance: number,
  telegraphFromCourseSeconds: number,
  secondsAtDistance: (distance: number) => number,
  path: string,
): {
  launchOpenCourseSeconds: number
  launchCloseCourseSeconds: number
  flightSeconds: number
  landingEndCourseDistanceMeters: number
} {
  const traversal = profile.traversal
  if (traversal?.kind !== 'jump-over')
    runnerSourceFail(path, 'requires an explicit jump-over traversal profile.')
  const velocity = movement.jumpVelocityMetersPerSecond
  const gravity = movement.gravityMetersPerSecondSquared
  const discriminant = velocity ** 2 - 2 * gravity * profile.maxYOffsetMeters
  if (profile.maxYOffsetMeters <= 0 || discriminant <= 0)
    runnerSourceFail(
      path,
      'hurdle crown is not clearable with the selected jump.',
    )
  const root = Math.sqrt(discriminant)
  const riseSeconds = (velocity - root) / gravity
  const fallSeconds = (velocity + root) / gravity
  // Both checkpoint clock alignment and input quantization fit inside these
  // margins. Equality with the crown is a contact, never a successful clear.
  const margin = movement.fixedStepSeconds * 2
  const launchOpenCourseSeconds = Math.max(
    telegraphFromCourseSeconds,
    secondsAtDistance(maximumDistance + movement.bodyRadius) -
      fallSeconds +
      margin,
  )
  const launchCloseCourseSeconds =
    secondsAtDistance(minimumDistance - movement.bodyRadius) -
    riseSeconds -
    margin
  if (
    launchOpenCourseSeconds < 0 ||
    launchCloseCourseSeconds - launchOpenCourseSeconds <=
      movement.fixedStepSeconds * 3
  )
    runnerSourceFail(path, 'hurdle does not leave a certified jump window.')
  return {
    launchOpenCourseSeconds,
    launchCloseCourseSeconds,
    flightSeconds: (2 * velocity) / gravity,
    landingEndCourseDistanceMeters:
      maximumDistance + traversal.landingRunwayMeters,
  }
}
