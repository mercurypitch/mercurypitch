// Runner slide certificates — prove a real low corridor, enough approach time and a clear exit runway.

import { runnerBodyHitsBlocker } from './blocker-collision'
import type { CompiledRunnerActionWindow, CompiledRunnerBlocker, CompiledRunnerCourse, RunnerLane, RunnerLateralCorridor, } from './contracts'
import type { RunnerBlockerCatalogProfile, SongRunnerCourseSource, } from './source'
import { runnerSourceFail } from './source'
import { runnerBodyLateralBounds } from './track-bounds'

const CLEARANCE = 0.02

/** Brake first, then accelerate/cruise/brake to rest at the corridor centre. */
function continuousApproachSeconds(
  movement: CompiledRunnerCourse['movement'],
  distance: number,
): number {
  if (movement.kind !== 'continuous') return 0
  const speed = movement.maxLateralSpeedMetersPerSecond
  const acceleration = movement.lateralAccelerationMetersPerSecondSquared
  const braking = movement.lateralBrakingMetersPerSecondSquared
  const peak = Math.min(
    speed,
    Math.sqrt((2 * distance) / (1 / acceleration + 1 / braking)),
  )
  const covered = peak ** 2 / (2 * acceleration) + peak ** 2 / (2 * braking)
  return (
    speed / braking +
    peak / acceleration +
    peak / braking +
    Math.max(0, distance - covered) / speed
  )
}

/** Prove all bands across the whole opening, then test an actual full-depth body sweep. */
function validateSlideCollision(
  profile: RunnerBlockerCatalogProfile,
  obstacle: CompiledRunnerBlocker,
  movement: CompiledRunnerCourse['movement'],
  corridor: RunnerLateralCorridor,
  groundFeetY: number,
  clearanceHeight: number,
  lowBodyHeight: number,
  path: string,
): void {
  const width = obstacle.maxLateralX - obstacle.minLateralX
  const centre = (obstacle.maxLateralX + obstacle.minLateralX) / 2
  const corridorCentre = (corridor.minLateralX + corridor.maxLateralX) / 2
  const shape = profile.collisionProfile
  const bands =
    shape === undefined
      ? [
          {
            minXFraction: -0.5,
            maxXFraction: 0.5,
            minimum: profile.minYOffsetMeters,
          },
        ]
      : (shape.kind === 'convex-yz'
          ? [
              {
                minXFraction: -0.5,
                maxXFraction: 0.5,
                vertices: shape.vertices,
              },
            ]
          : shape.bands
        ).map((band) => ({
          ...band,
          minimum:
            profile.minYOffsetMeters +
            Math.min(...band.vertices.map((vertex) => vertex.yFraction)) *
              (profile.maxYOffsetMeters - profile.minYOffsetMeters),
        }))
  for (const band of bands) {
    if (
      centre + band.maxXFraction * width <
        corridor.minLateralX - movement.bodyRadius ||
      centre + band.minXFraction * width >
        corridor.maxLateralX + movement.bodyRadius
    )
      continue
    if (band.minimum < clearanceHeight)
      runnerSourceFail(
        path,
        'declared slide opening intersects its actual collision profile.',
      )
  }
  const contactPiece = {
    duration: 1,
    x: corridorCentre,
    vx: 0,
    ax: 0,
    y: groundFeetY,
    vy: 0,
    ay: 0,
    z: obstacle.minCourseDistanceMeters - movement.bodyRadius - CLEARANCE,
    vz:
      obstacle.maxCourseDistanceMeters -
      obstacle.minCourseDistanceMeters +
      2 * (movement.bodyRadius + CLEARANCE),
  }
  const collisionCourse = { movement }
  if (
    !runnerBodyHitsBlocker(collisionCourse, obstacle, contactPiece) ||
    runnerBodyHitsBlocker(
      collisionCourse,
      obstacle,
      contactPiece,
      lowBodyHeight + CLEARANCE,
    )
  )
    runnerSourceFail(
      path,
      'slide route must block standing and clear the complete lowered sweep.',
    )
}

export function runnerSlideAction(
  source: SongRunnerCourseSource,
  profile: RunnerBlockerCatalogProfile,
  movement: CompiledRunnerCourse['movement'],
  obstacle: CompiledRunnerBlocker,
  secondsAtDistance: (distance: number) => number,
  path: string,
): {
  action: CompiledRunnerActionWindow
  traversal: NonNullable<CompiledRunnerBlocker['traversal']>
} {
  const slide = movement.slide
  const traversal = profile.traversal
  if (slide === undefined || traversal?.kind !== 'slide-under')
    runnerSourceFail(
      path,
      'slide-under requires the versioned slide movement capability.',
    )
  if (
    slide.bodyHeightMeters + CLEARANCE >= traversal.clearanceHeightMeters ||
    traversal.clearanceHeightMeters >= movement.bodyHeight
  )
    runnerSourceFail(
      path,
      'slide clearance must fit the low body and exclude the standing body.',
    )
  const width = obstacle.maxLateralX - obstacle.minLateralX
  const centre = (obstacle.maxLateralX + obstacle.minLateralX) / 2
  const bounds = runnerBodyLateralBounds({
    laneCenters: source.track.laneCenters,
    movement,
  })
  const corridor = {
    minLateralX: Math.max(
      bounds.minLateralX,
      centre +
        traversal.clearanceMinXFraction * width +
        movement.bodyRadius +
        CLEARANCE,
    ),
    maxLateralX: Math.min(
      bounds.maxLateralX,
      centre +
        traversal.clearanceMaxXFraction * width -
        movement.bodyRadius -
        CLEARANCE,
    ),
  }
  if (corridor.minLateralX >= corridor.maxLateralX)
    runnerSourceFail(
      path,
      'slide opening must contain the whole runner body with lateral clearance.',
    )
  validateSlideCollision(
    profile,
    obstacle,
    movement,
    corridor,
    source.track.groundFeetY,
    traversal.clearanceHeightMeters,
    slide.bodyHeightMeters,
    path,
  )
  const corridorCentre = (corridor.minLateralX + corridor.maxLateralX) / 2
  const reachableLanes = ([0, 1, 2] as const).filter(
    (lane) =>
      source.track.laneCenters[lane] >= corridor.minLateralX &&
      source.track.laneCenters[lane] <= corridor.maxLateralX,
  )
  if (reachableLanes.length === 0)
    runnerSourceFail(
      path,
      'slide opening needs a reachable authored lane centre.',
    )
  const margin = movement.fixedStepSeconds * 4
  let approachSeconds: number
  if (movement.kind === 'continuous') {
    if (
      (corridor.maxLateralX - corridor.minLateralX) / 2 <
      movement.maxLateralSpeedMetersPerSecond * margin + CLEARANCE
    )
      runnerSourceFail(
        path,
        'slide corridor is too narrow for bounded continuous steering input.',
      )
    approachSeconds = continuousApproachSeconds(
      movement,
      Math.max(
        corridorCentre - bounds.minLateralX,
        bounds.maxLateralX - corridorCentre,
      ),
    )
  } else
    approachSeconds =
      movement.laneChangeSeconds *
      Math.max(
        ...([0, 1, 2] as RunnerLane[]).map((from) =>
          Math.min(...reachableLanes.map((to) => Math.abs(to - from))),
        ),
      )
  const launchOpenCourseSeconds = obstacle.telegraphFromCourseSeconds
  const launchCloseCourseSeconds =
    secondsAtDistance(obstacle.minCourseDistanceMeters - movement.bodyRadius) -
    approachSeconds -
    slide.enterSeconds -
    margin
  if (launchCloseCourseSeconds - launchOpenCourseSeconds <= margin)
    runnerSourceFail(
      path,
      'slide does not leave a certified approach and lowering window.',
    )
  const exit = secondsAtDistance(
    obstacle.maxCourseDistanceMeters + movement.bodyRadius,
  )
  const landingCloseCourseSeconds = exit + slide.exitSeconds + margin
  const landingEndCourseDistanceMeters =
    obstacle.maxCourseDistanceMeters + traversal.exitRunwayMeters
  if (
    landingCloseCourseSeconds >=
    secondsAtDistance(landingEndCourseDistanceMeters - movement.bodyRadius)
  )
    runnerSourceFail(
      path,
      'slide exit runway cannot restore the standing body safely.',
    )
  return {
    action: {
      kind: 'slide',
      slideCorridor: corridor,
      launchOpenCourseSeconds,
      launchCloseCourseSeconds,
      landingOpenCourseSeconds: exit,
      landingCloseCourseSeconds,
      reachableLanes,
    },
    traversal: {
      kind: 'slide-under',
      landingStartCourseDistanceMeters: obstacle.maxCourseDistanceMeters,
      landingEndCourseDistanceMeters,
    },
  }
}
