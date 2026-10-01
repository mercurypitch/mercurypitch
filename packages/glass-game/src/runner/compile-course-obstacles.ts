// ============================================================
// Song runner safety compiler — obstacle envelopes, routes, and checkpoints.
// ============================================================

import { RUNNER_COMPILER_EPSILON, runnerChunkId, runnerCompilerApproximatelyEqual, runnerIntervalsOverlap, } from './compile-course-helpers'
import type { RunnerProtectedWindow } from './compile-course-targets'
import type { CompiledRunnerActionWindow, CompiledRunnerCheckpoint, CompiledRunnerCourse, CompiledRunnerObstacle, RunnerLane, } from './contracts'
import { runnerFixedStepActionEnd } from './fixed-step'
import type { RunnerObstacleCatalogProfile, SongRunnerCourseCatalog, SongRunnerCourseSource, } from './source'
import { runnerSourceFail, runnerSourceUniqueIds } from './source'
import { runnerBeatToDistance, runnerBeatToSeconds } from './tempo'

function validateObstacleProfile(
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

function mergeSpans(
  spans: readonly { minLateralX: number; maxLateralX: number }[],
): readonly { minLateralX: number; maxLateralX: number }[] {
  const ordered = [...spans].sort(
    (left, right) => left.minLateralX - right.minLateralX,
  )
  const merged: { minLateralX: number; maxLateralX: number }[] = []
  for (const span of ordered) {
    const prior = merged.at(-1)
    if (
      prior &&
      span.minLateralX <= prior.maxLateralX + RUNNER_COMPILER_EPSILON
    )
      prior.maxLateralX = Math.max(prior.maxLateralX, span.maxLateralX)
    else merged.push({ ...span })
  }
  return merged
}

function possibleEpochStarts(
  course: SongRunnerCourseSource,
  tempoSegments: CompiledRunnerCourse['tempoSegments'],
  throughCourseSeconds: number,
): readonly number[] {
  const starts = new Set<number>([0])
  for (const checkpoint of course.checkpoints) {
    if (checkpoint.atBeat < 0 || checkpoint.atBeat >= course.track.lengthBeats)
      continue
    const start = runnerBeatToSeconds(tempoSegments, checkpoint.atBeat)
    if (start <= throughCourseSeconds + RUNNER_COMPILER_EPSILON)
      starts.add(start)
  }
  return [...starts]
}

function fixedStepActionBounds(
  course: SongRunnerCourseSource,
  tempoSegments: CompiledRunnerCourse['tempoSegments'],
  movement: CompiledRunnerCourse['movement'],
  launchOpenCourseSeconds: number,
  launchCloseCourseSeconds: number,
  actionDurationSeconds: number,
): { landingOpenCourseSeconds: number; landingCloseCourseSeconds: number } {
  const epochStarts = possibleEpochStarts(
    course,
    tempoSegments,
    launchOpenCourseSeconds,
  )
  return {
    landingOpenCourseSeconds: Math.min(
      ...epochStarts.map((epochStart) =>
        runnerFixedStepActionEnd(
          launchOpenCourseSeconds,
          actionDurationSeconds,
          epochStart,
          movement.fixedStepSeconds,
        ),
      ),
    ),
    landingCloseCourseSeconds: Math.max(
      ...epochStarts.map((epochStart) =>
        runnerFixedStepActionEnd(
          launchCloseCourseSeconds,
          actionDurationSeconds,
          epochStart,
          movement.fixedStepSeconds,
        ),
      ),
    ),
  }
}

export function compileRunnerObstacles(
  course: SongRunnerCourseSource,
  catalog: SongRunnerCourseCatalog,
  movement: CompiledRunnerCourse['movement'],
  tempoSegments: CompiledRunnerCourse['tempoSegments'],
  protectedWindows: readonly RunnerProtectedWindow[],
  path: string,
): {
  obstacles: readonly CompiledRunnerObstacle[]
  profiles: ReadonlyMap<string, RunnerObstacleCatalogProfile>
} {
  runnerSourceUniqueIds(
    course.obstacles.map((obstacle) => obstacle.id),
    `${path}.obstacles`,
  )
  const ordered = [...course.obstacles].sort(
    (left, right) =>
      left.atBeat - right.atBeat || left.id.localeCompare(right.id),
  )
  if (ordered.some((obstacle, index) => obstacle !== course.obstacles[index]))
    runnerSourceFail(`${path}.obstacles`, 'must be ordered by atBeat.')

  const secondsAtDistance = (distance: number): number =>
    runnerBeatToSeconds(tempoSegments, distance / course.track.metersPerBeat)
  const profiles = new Map<string, RunnerObstacleCatalogProfile>()
  const obstacles = ordered.map((obstacle, index): CompiledRunnerObstacle => {
    const obstaclePath = `${path}.obstacles[${index}]`
    if (obstacle.atBeat <= 0 || obstacle.atBeat >= course.track.lengthBeats)
      runnerSourceFail(`${obstaclePath}.atBeat`, 'must lie inside the course.')
    const profile = catalog.obstacleProfiles[obstacle.profileId]
    if (profile === undefined)
      runnerSourceFail(
        `${obstaclePath}.profileId`,
        `references unknown profile "${obstacle.profileId}".`,
      )
    validateObstacleProfile(
      profile,
      obstacle.profileId,
      `${obstaclePath}.profileId`,
    )
    profiles.set(obstacle.id, profile)
    const centerDistance = runnerBeatToDistance(
      obstacle.atBeat,
      course.track.metersPerBeat,
    )
    const telegraphFromCourseSeconds = runnerBeatToSeconds(
      tempoSegments,
      Math.max(0, obstacle.atBeat - profile.telegraphLeadBeats),
    )
    let certifiedActions: readonly CompiledRunnerActionWindow[]
    let compiled: CompiledRunnerObstacle
    if (profile.kind === 'blocker') {
      for (
        let laneIndex = 1;
        laneIndex < obstacle.laneMask.length;
        laneIndex++
      ) {
        if (
          obstacle.laneMask[laneIndex]! !==
          obstacle.laneMask[laneIndex - 1]! + 1
        )
          runnerSourceFail(
            `${obstaclePath}.laneMask`,
            'blocker lanes must be contiguous for one continuous envelope.',
          )
      }
      const safeLanes = ([0, 1, 2] as const).filter(
        (lane) => !obstacle.laneMask.includes(lane),
      )
      if (safeLanes.length === 0)
        runnerSourceFail(
          `${obstaclePath}.laneMask`,
          'blockers must leave at least one lane open.',
        )
      const minCourseDistanceMeters =
        centerDistance - profile.longitudinalHalfLengthMeters
      const maxCourseDistanceMeters =
        centerDistance + profile.longitudinalHalfLengthMeters
      const collisionEntrySeconds = secondsAtDistance(
        minCourseDistanceMeters - movement.bodyRadius,
      )
      const launchOpenCourseSeconds = runnerBeatToSeconds(
        tempoSegments,
        Math.max(0, obstacle.atBeat - profile.telegraphLeadBeats),
      )
      const maximumLaneChanges = Math.max(
        ...safeLanes.map((safe) =>
          Math.min(
            ...([0, 1, 2] as const).map((from) => Math.abs(safe - from)),
          ),
        ),
        1,
      )
      const requiredTransitionSeconds =
        movement.laneChangeSeconds * maximumLaneChanges
      const launchCloseCourseSeconds =
        collisionEntrySeconds - requiredTransitionSeconds
      if (
        launchCloseCourseSeconds <
        launchOpenCourseSeconds - RUNNER_COMPILER_EPSILON
      )
        runnerSourceFail(
          obstaclePath,
          'does not leave a certified lane-transition window.',
        )
      certifiedActions = [
        {
          kind: 'lane-transition',
          launchOpenCourseSeconds,
          launchCloseCourseSeconds,
          ...fixedStepActionBounds(
            course,
            tempoSegments,
            movement,
            launchOpenCourseSeconds,
            launchCloseCourseSeconds,
            requiredTransitionSeconds,
          ),
          reachableLanes: safeLanes,
        },
      ]
      compiled = {
        kind: 'blocker',
        id: obstacle.id,
        chunkId: runnerChunkId(
          course.id,
          course.track.chunkBeats,
          obstacle.atBeat,
        ),
        profileId: obstacle.profileId,
        telegraphFromCourseSeconds,
        minCourseDistanceMeters,
        maxCourseDistanceMeters,
        minLateralX:
          course.track.laneCenters[obstacle.laneMask[0]!] -
          profile.laneHalfWidthMeters,
        maxLateralX:
          course.track.laneCenters[obstacle.laneMask.at(-1)!] +
          profile.laneHalfWidthMeters,
        minY: course.track.groundFeetY + profile.minYOffsetMeters,
        maxY: course.track.groundFeetY + profile.maxYOffsetMeters,
        authoredLaneMask: obstacle.laneMask,
        certifiedActions,
      }
    } else {
      const minCourseDistanceMeters = centerDistance - profile.lengthMeters / 2
      const maxCourseDistanceMeters = centerDistance + profile.lengthMeters / 2
      const flightSeconds =
        (2 * movement.jumpVelocityMetersPerSecond) /
        movement.gravityMetersPerSecondSquared
      const launchOpenCourseSeconds =
        secondsAtDistance(maxCourseDistanceMeters + movement.bodyRadius) -
        flightSeconds
      const launchCloseCourseSeconds =
        secondsAtDistance(minCourseDistanceMeters - movement.bodyRadius) -
        movement.fixedStepSeconds
      if (
        launchOpenCourseSeconds < 0 ||
        launchCloseCourseSeconds <
          launchOpenCourseSeconds - RUNNER_COMPILER_EPSILON
      )
        runnerSourceFail(
          obstaclePath,
          'gap is not clearable with the selected movement profile.',
        )
      certifiedActions = [
        {
          kind: 'jump',
          launchOpenCourseSeconds,
          launchCloseCourseSeconds,
          ...fixedStepActionBounds(
            course,
            tempoSegments,
            movement,
            launchOpenCourseSeconds,
            launchCloseCourseSeconds,
            flightSeconds,
          ),
          reachableLanes: obstacle.laneMask,
        },
      ]
      const lateralSpans = mergeSpans(
        obstacle.laneMask.map((lane) => ({
          minLateralX:
            course.track.laneCenters[lane] - profile.laneHalfWidthMeters,
          maxLateralX:
            course.track.laneCenters[lane] + profile.laneHalfWidthMeters,
        })),
      )
      compiled = {
        kind: 'gap',
        id: obstacle.id,
        chunkId: runnerChunkId(
          course.id,
          course.track.chunkBeats,
          obstacle.atBeat,
        ),
        profileId: obstacle.profileId,
        telegraphFromCourseSeconds,
        minCourseDistanceMeters,
        maxCourseDistanceMeters,
        lateralSpans,
        landingStartCourseDistanceMeters: maxCourseDistanceMeters,
        landingEndCourseDistanceMeters:
          maxCourseDistanceMeters + profile.landingRunwayMeters,
        certifiedActions,
      }
    }

    for (const action of certifiedActions) {
      for (const window of protectedWindows) {
        if (
          runnerIntervalsOverlap(
            action.launchOpenCourseSeconds,
            action.landingCloseCourseSeconds,
            window.from,
            window.until,
          )
        )
          runnerSourceFail(
            obstaclePath,
            `certified action overlaps protected target "${window.targetId}".`,
          )
      }
    }
    return compiled
  })

  for (let index = 1; index < obstacles.length; index++) {
    const prior = obstacles[index - 1]!
    const current = obstacles[index]!
    if (
      prior.maxCourseDistanceMeters >=
      current.minCourseDistanceMeters - RUNNER_COMPILER_EPSILON
    )
      runnerSourceFail(
        `${path}.obstacles[${index}]`,
        `overlaps obstacle "${prior.id}".`,
      )
  }
  return { obstacles, profiles }
}

export function validateRunnerReachability(
  course: SongRunnerCourseSource,
  obstacles: readonly CompiledRunnerObstacle[],
  tempoSegments: CompiledRunnerCourse['tempoSegments'],
  movement: CompiledRunnerCourse['movement'],
  path: string,
): void {
  let reachable = new Set<RunnerLane>([course.checkpoints[0]!.respawnLane])
  let availableFromSeconds = 0
  for (const [index, obstacle] of obstacles.entries()) {
    const action = obstacle.certifiedActions[0]!
    if (obstacle.kind === 'blocker') {
      const next = new Set<RunnerLane>()
      for (const safeLane of action.reachableLanes) {
        if (
          [...reachable].some(
            (fromLane) =>
              availableFromSeconds +
                Math.abs(safeLane - fromLane) * movement.laneChangeSeconds <=
              action.landingCloseCourseSeconds + RUNNER_COMPILER_EPSILON,
          )
        )
          next.add(safeLane)
      }
      reachable = next
    }
    if (reachable.size === 0)
      runnerSourceFail(
        `${path}.obstacles[${index}]`,
        'leaves no reachable lane to the finish.',
      )
    availableFromSeconds = Math.max(
      availableFromSeconds,
      action.landingOpenCourseSeconds,
    )
  }
  const finishSeconds = runnerBeatToSeconds(
    tempoSegments,
    course.track.lengthBeats,
  )
  if (availableFromSeconds >= finishSeconds)
    runnerSourceFail(`${path}.obstacles`, 'leave no reachable finish interval.')
}

export function compileRunnerCheckpoints(
  course: SongRunnerCourseSource,
  obstacles: readonly CompiledRunnerObstacle[],
  tempoSegments: CompiledRunnerCourse['tempoSegments'],
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
      if (
        obstacle.maxCourseDistanceMeters <
          courseDistanceMeters - RUNNER_COMPILER_EPSILON ||
        obstacle.minCourseDistanceMeters >
          runwayEndDistance + RUNNER_COMPILER_EPSILON
      )
        continue
      if (obstacle.kind === 'blocker') {
        if (
          laneX >= obstacle.minLateralX - RUNNER_COMPILER_EPSILON &&
          laneX <= obstacle.maxLateralX + RUNNER_COMPILER_EPSILON
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
