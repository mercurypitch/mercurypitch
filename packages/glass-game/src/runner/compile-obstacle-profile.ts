// Runner obstacle profiles — validate bounded, matching visible geometry and traversal capabilities.

import { runnerValidBlockerCollisionProfile } from './blocker-collision'
import { runnerCompilerApproximatelyEqual } from './compile-course-helpers'
import type { RunnerObstacleCatalogProfile } from './source'
import { runnerSourceFail } from './source'

export function validateObstacleProfile(
  profile: RunnerObstacleCatalogProfile,
  id: string,
  path: string,
): void {
  if (profile.id !== id)
    runnerSourceFail(path, 'does not match the catalog profile identity.')
  if (
    !Number.isFinite(profile.telegraphLeadBeats) ||
    profile.telegraphLeadBeats <= 0 ||
    profile.assetProfileIds.some((assetId) => assetId.length === 0)
  )
    runnerSourceFail(path, 'references a malformed obstacle profile.')
  if (profile.kind === 'blocker') {
    const positive = [
      profile.longitudinalHalfLengthMeters,
      profile.laneHalfWidthMeters,
      profile.visibleLongitudinalHalfLengthMeters,
      profile.visibleLaneHalfWidthMeters,
    ]
    if (
      positive.some((value) => !Number.isFinite(value) || value <= 0) ||
      !Number.isFinite(profile.minYOffsetMeters) ||
      !Number.isFinite(profile.maxYOffsetMeters) ||
      profile.minYOffsetMeters >= profile.maxYOffsetMeters ||
      !runnerCompilerApproximatelyEqual(
        profile.longitudinalHalfLengthMeters,
        profile.visibleLongitudinalHalfLengthMeters,
      ) ||
      !runnerCompilerApproximatelyEqual(
        profile.laneHalfWidthMeters,
        profile.visibleLaneHalfWidthMeters,
      ) ||
      !runnerCompilerApproximatelyEqual(
        profile.minYOffsetMeters,
        profile.visibleMinYOffsetMeters,
      ) ||
      !runnerCompilerApproximatelyEqual(
        profile.maxYOffsetMeters,
        profile.visibleMaxYOffsetMeters,
      )
    )
      runnerSourceFail(
        path,
        'must have matching ordered visible and collision bounds.',
      )
    if (
      profile.traversal !== undefined &&
      (profile.traversal.kind === 'jump-over'
        ? !Number.isFinite(profile.traversal.landingRunwayMeters) ||
          profile.traversal.landingRunwayMeters <= 0 ||
          profile.minYOffsetMeters !== 0
        : profile.traversal.kind !== 'slide-under' ||
          [
            profile.traversal.clearanceHeightMeters,
            profile.traversal.exitRunwayMeters,
          ].some((value) => !Number.isFinite(value) || value <= 0) ||
          !Number.isFinite(profile.traversal.clearanceMinXFraction) ||
          !Number.isFinite(profile.traversal.clearanceMaxXFraction) ||
          profile.traversal.clearanceMinXFraction < -0.5 ||
          profile.traversal.clearanceMaxXFraction > 0.5 ||
          profile.traversal.clearanceMinXFraction >=
            profile.traversal.clearanceMaxXFraction)
    )
      runnerSourceFail(
        path,
        'references a malformed obstacle traversal profile.',
      )
    if (
      profile.collisionProfile !== undefined &&
      !runnerValidBlockerCollisionProfile(profile.collisionProfile)
    )
      runnerSourceFail(
        path,
        'requires a convex Y/Z collision profile with 3 to 16 vertices, at most 8 contiguous X bands and matching normalized bounds.',
      )
    return
  }
  if (
    !Number.isFinite(profile.lengthMeters) ||
    profile.lengthMeters <= 0 ||
    !Number.isFinite(profile.laneHalfWidthMeters) ||
    profile.laneHalfWidthMeters <= 0 ||
    !Number.isFinite(profile.visibleLengthMeters) ||
    !Number.isFinite(profile.visibleLaneHalfWidthMeters) ||
    !Number.isFinite(profile.landingRunwayMeters) ||
    profile.landingRunwayMeters <= 0 ||
    !runnerCompilerApproximatelyEqual(
      profile.lengthMeters,
      profile.visibleLengthMeters,
    ) ||
    !runnerCompilerApproximatelyEqual(
      profile.laneHalfWidthMeters,
      profile.visibleLaneHalfWidthMeters,
    )
  )
    runnerSourceFail(
      path,
      'must have matching positive visible and collision spans.',
    )
}
