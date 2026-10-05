// ============================================================
// Song runner safety compiler — obstacle envelopes, routes, and checkpoints.
// ============================================================

import { runnerValidBlockerCollisionProfile } from './blocker-collision.ts'
import { RUNNER_COMPILER_EPSILON, runnerChunkId, runnerCompilerApproximatelyEqual, runnerIntervalsOverlap, } from './compile-course-helpers.ts'
import type { RunnerProtectedWindow } from './compile-course-targets.ts'
import { runnerHurdleJumpWindow } from './compile-hurdle.ts'
import { runnerContinuousBlockerCertificate, validateContinuousRunnerReachability, } from './continuous-certificates.ts'
import type { CompiledRunnerActionWindow, CompiledRunnerCheckpoint, CompiledRunnerCourse, CompiledRunnerObstacle, RunnerLane, } from './contracts.ts'
import { runnerFixedStepActionEnd, runnerFixedStepAtOrAfter, } from './fixed-step.ts'
import { RUNNER_MAXIMUM_COUNT_IN_BEATS, RUNNER_MAXIMUM_COUNT_IN_SECONDS, } from './resource-limits.ts'
import type { RunnerObstacleCatalogProfile, SongRunnerCourseCatalog, SongRunnerCourseSource, } from './source.ts'
import { runnerSourceFail, runnerSourceUniqueIds } from './source.ts'
import { runnerBeatToDistance, runnerBeatToSeconds, runnerSecondsToBeat, } from './tempo.ts'
import { runnerBodyLateralBounds } from './track-bounds.ts'

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
    if (
      profile.traversal !== undefined &&
      (profile.traversal.kind !== 'jump-over' ||
        !Number.isFinite(profile.traversal.landingRunwayMeters) ||
        profile.traversal.landingRunwayMeters <= 0 ||
        profile.minYOffsetMeters !== 0)
    )
      runnerSourceFail(
        path,
        'references a malformed jump-over traversal profile.',
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
  minimumActionDurationSeconds = actionDurationSeconds,
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
          minimumActionDurationSeconds,
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
      const unmaskedLanes = ([0, 1, 2] as const).filter(
        (lane) => !obstacle.laneMask.includes(lane),
      )
      if (unmaskedLanes.length === 0 && profile.traversal === undefined)
        runnerSourceFail(
          `${obstaclePath}.laneMask`,
          'blockers must leave at least one lane open.',
        )
      const minLateralX =
        course.track.laneCenters[obstacle.laneMask[0]!] -
        profile.laneHalfWidthMeters
      const maxLateralX =
        course.track.laneCenters[obstacle.laneMask.at(-1)!] +
        profile.laneHalfWidthMeters
      // Movement sweeps a body, so an unmasked center can still hit the box.
      const safeLanes = unmaskedLanes.filter((lane) => {
        const laneX = course.track.laneCenters[lane]
        return (
          laneX < minLateralX - movement.bodyRadius - RUNNER_COMPILER_EPSILON ||
          laneX > maxLateralX + movement.bodyRadius + RUNNER_COMPILER_EPSILON
        )
      })
      if (safeLanes.length === 0 && profile.traversal === undefined)
        runnerSourceFail(
          `${obstaclePath}.laneMask`,
          'blockers must leave at least one lane clear of the runner body.',
        )
      const minCourseDistanceMeters =
        centerDistance - profile.longitudinalHalfLengthMeters
      const maxCourseDistanceMeters =
        centerDistance + profile.longitudinalHalfLengthMeters
      let traversal: Extract<
        CompiledRunnerObstacle,
        { kind: 'blocker' }
      >['traversal']
      if (profile.traversal?.kind === 'jump-over') {
        const jump = runnerHurdleJumpWindow(
          profile,
          movement,
          minCourseDistanceMeters,
          maxCourseDistanceMeters,
          telegraphFromCourseSeconds,
          secondsAtDistance,
          obstaclePath,
        )
        const landing = fixedStepActionBounds(
          course,
          tempoSegments,
          movement,
          jump.launchOpenCourseSeconds,
          jump.launchCloseCourseSeconds,
          jump.flightSeconds,
        )
        if (
          landing.landingCloseCourseSeconds >
          secondsAtDistance(
            jump.landingEndCourseDistanceMeters - movement.bodyRadius,
          )
        )
          runnerSourceFail(
            obstaclePath,
            'hurdle jump exceeds the authored landing runway.',
          )
        const entry = runnerBodyLateralBounds({
          laneCenters: course.track.laneCenters,
          movement,
        })
        certifiedActions = [
          {
            kind: 'jump',
            ...(movement.kind !== 'continuous'
              ? {}
              : {
                  continuous: {
                    version: 1 as const,
                    entry,
                    maximumEntrySpeedMetersPerSecond:
                      movement.maxLateralSpeedMetersPerSecond,
                    safeCorridors: ([-1, 1] as const).map((axis) => ({
                      ...entry,
                      axis,
                    })),
                    requiredManeuverSeconds: jump.flightSeconds,
                    inputMarginSeconds: movement.fixedStepSeconds * 2,
                  },
                }),
            launchOpenCourseSeconds: jump.launchOpenCourseSeconds,
            launchCloseCourseSeconds: jump.launchCloseCourseSeconds,
            ...landing,
            reachableLanes: ([0, 1, 2] as const).filter(
              (lane) =>
                course.track.laneCenters[lane] >=
                  minLateralX - movement.bodyRadius &&
                course.track.laneCenters[lane] <=
                  maxLateralX + movement.bodyRadius,
            ),
          },
        ]
        traversal = {
          kind: 'jump-over',
          landingStartCourseDistanceMeters: maxCourseDistanceMeters,
          landingEndCourseDistanceMeters: jump.landingEndCourseDistanceMeters,
        }
      } else {
        const collisionEntrySeconds = secondsAtDistance(
          minCourseDistanceMeters - movement.bodyRadius,
        )
        const launchOpenCourseSeconds = runnerBeatToSeconds(
          tempoSegments,
          Math.max(0, obstacle.atBeat - profile.telegraphLeadBeats),
        )
        const maximumLaneChanges = Math.max(
          ...([0, 1, 2] as const).map((from) =>
            Math.min(...safeLanes.map((safe) => Math.abs(safe - from))),
          ),
          1,
        )
        const continuous =
          movement.kind === 'continuous'
            ? runnerContinuousBlockerCertificate(
                course,
                movement,
                minLateralX,
                maxLateralX,
              )
            : undefined
        const requiredTransitionSeconds =
          continuous === undefined
            ? movement.laneChangeSeconds * maximumLaneChanges
            : continuous.requiredManeuverSeconds + continuous.inputMarginSeconds
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
            kind:
              continuous === undefined ? 'lane-transition' : 'continuous-steer',
            ...(continuous === undefined ? {} : { continuous }),
            launchOpenCourseSeconds,
            launchCloseCourseSeconds,
            ...fixedStepActionBounds(
              course,
              tempoSegments,
              movement,
              launchOpenCourseSeconds,
              launchCloseCourseSeconds,
              requiredTransitionSeconds,
              continuous === undefined
                ? movement.laneChangeSeconds
                : requiredTransitionSeconds,
            ),
            reachableLanes: safeLanes,
          },
        ]
      }
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
        minLateralX,
        maxLateralX,
        minY: course.track.groundFeetY + profile.minYOffsetMeters,
        maxY: course.track.groundFeetY + profile.maxYOffsetMeters,
        authoredLaneMask: obstacle.laneMask,
        ...(profile.collisionProfile === undefined
          ? {}
          : { collisionProfile: profile.collisionProfile }),
        ...(traversal === undefined ? {} : { traversal }),
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
          ...(movement.kind !== 'continuous'
            ? {}
            : {
                continuous: {
                  version: 1 as const,
                  entry: runnerBodyLateralBounds({
                    laneCenters: course.track.laneCenters,
                    movement,
                  }),
                  maximumEntrySpeedMetersPerSecond:
                    movement.maxLateralSpeedMetersPerSecond,
                  safeCorridors: ([-1, 1] as const).map((axis) => ({
                    ...runnerBodyLateralBounds({
                      laneCenters: course.track.laneCenters,
                      movement,
                    }),
                    axis,
                  })),
                  requiredManeuverSeconds: flightSeconds,
                  inputMarginSeconds: movement.fixedStepSeconds,
                },
              }),
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
      if (
        movement.kind === 'continuous' &&
        certifiedActions[0]!.landingCloseCourseSeconds >
          secondsAtDistance(
            maxCourseDistanceMeters + profile.landingRunwayMeters,
          )
      )
        runnerSourceFail(
          obstaclePath,
          'continuous jump exceeds the authored landing runway.',
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

  for (const [index, obstacle] of obstacles.entries()) {
    if (obstacle.kind !== 'blocker' || obstacle.traversal === undefined)
      continue
    const action = obstacle.certifiedActions[0]!
    const takeoffStart =
      runnerBeatToDistance(
        runnerSecondsToBeat(tempoSegments, action.launchOpenCourseSeconds),
        course.track.metersPerBeat,
      ) - movement.bodyRadius
    const takeoffEnd =
      runnerBeatToDistance(
        runnerSecondsToBeat(tempoSegments, action.launchCloseCourseSeconds),
        course.track.metersPerBeat,
      ) + movement.bodyRadius
    for (const other of obstacles) {
      if (other === obstacle) continue
      if (
        other.kind === 'gap' &&
        runnerIntervalsOverlap(
          takeoffStart,
          takeoffEnd,
          other.minCourseDistanceMeters,
          other.maxCourseDistanceMeters,
        )
      )
        runnerSourceFail(
          `${path}.obstacles[${index}]`,
          `hurdle takeoff intersects gap "${other.id}".`,
        )
      if (
        runnerIntervalsOverlap(
          obstacle.traversal.landingStartCourseDistanceMeters,
          obstacle.traversal.landingEndCourseDistanceMeters,
          other.minCourseDistanceMeters,
          other.maxCourseDistanceMeters,
        )
      )
        runnerSourceFail(
          `${path}.obstacles[${index}]`,
          `hurdle landing runway intersects obstacle "${other.id}".`,
        )
    }
  }

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
    if (current.kind !== 'blocker') continue
    for (const earlier of obstacles.slice(0, index)) {
      if (
        earlier.kind !== 'blocker' ||
        earlier.maxCourseDistanceMeters + movement.bodyRadius <
          current.minCourseDistanceMeters -
            movement.bodyRadius -
            RUNNER_COMPILER_EPSILON
      )
        continue
      if (earlier.traversal !== undefined || current.traversal !== undefined)
        runnerSourceFail(
          `${path}.obstacles[${index}]`,
          `jump-over body collision envelope overlaps obstacle "${earlier.id}".`,
        )
      if (
        !earlier.certifiedActions[0]!.reachableLanes.some((lane) =>
          current.certifiedActions[0]!.reachableLanes.includes(lane),
        )
      )
        runnerSourceFail(
          `${path}.obstacles[${index}]`,
          `body collision envelope overlaps obstacle "${earlier.id}" without a shared clear lane.`,
        )
    }
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
  if (movement.kind === 'continuous') {
    validateContinuousRunnerReachability(
      course,
      obstacles,
      tempoSegments,
      movement,
      path,
    )
    return
  }
  const finishSeconds = runnerBeatToSeconds(
    tempoSegments,
    course.track.lengthBeats,
  )
  const lengthMeters = course.track.lengthBeats * course.track.metersPerBeat
  const secondsAtDistance = (distance: number): number =>
    runnerBeatToSeconds(
      tempoSegments,
      Math.max(0, Math.min(lengthMeters, distance)) /
        course.track.metersPerBeat,
    )
  for (const [checkpointIndex, checkpoint] of course.checkpoints.entries()) {
    const epochStart = runnerBeatToSeconds(tempoSegments, checkpoint.atBeat)
    const checkpointDistance = checkpoint.atBeat * course.track.metersPerBeat
    let reachable = new Set<RunnerLane>([checkpoint.respawnLane])
    let availableFromSeconds = epochStart
    for (const [index, obstacle] of obstacles.entries()) {
      const collisionExitDistance =
        obstacle.maxCourseDistanceMeters + movement.bodyRadius
      if (collisionExitDistance < checkpointDistance - RUNNER_COMPILER_EPSILON)
        continue
      const action = obstacle.certifiedActions[0]!
      if (action.kind !== 'jump') {
        const collisionEntrySeconds = secondsAtDistance(
          obstacle.minCourseDistanceMeters - movement.bodyRadius,
        )
        const next = new Set<RunnerLane>()
        for (const safeLane of action.reachableLanes) {
          for (const fromLane of reachable) {
            // The same clear lane remains usable while blocker bodies overlap.
            if (safeLane === fromLane) {
              next.add(safeLane)
              break
            }
            let transitionEnd = Math.max(
              availableFromSeconds,
              action.launchOpenCourseSeconds,
            )
            for (let hop = 0; hop < Math.abs(safeLane - fromLane); hop++)
              transitionEnd = runnerFixedStepActionEnd(
                transitionEnd,
                movement.laneChangeSeconds,
                epochStart,
                movement.fixedStepSeconds,
              )
            if (
              transitionEnd <=
              collisionEntrySeconds - RUNNER_COMPILER_EPSILON
            ) {
              next.add(safeLane)
              break
            }
          }
        }
        reachable = next
        // A successful early dodge does not release the blocked space. Wait
        // until the complete body has passed before changing across that box.
        availableFromSeconds = Math.max(
          availableFromSeconds,
          runnerFixedStepAtOrAfter(
            secondsAtDistance(collisionExitDistance) +
              movement.fixedStepSeconds,
            epochStart,
            movement.fixedStepSeconds,
          ),
        )
      } else {
        const launchSeconds = runnerFixedStepAtOrAfter(
          Math.max(availableFromSeconds, action.launchOpenCourseSeconds),
          epochStart,
          movement.fixedStepSeconds,
        )
        if (
          launchSeconds >
          action.launchCloseCourseSeconds + RUNNER_COMPILER_EPSILON
        )
          reachable = new Set(
            [...reachable].filter(
              (lane) => !action.reachableLanes.includes(lane),
            ),
          )
        else {
          const flightSeconds =
            (2 * movement.jumpVelocityMetersPerSecond) /
            movement.gravityMetersPerSecondSquared
          availableFromSeconds = runnerFixedStepActionEnd(
            launchSeconds,
            flightSeconds,
            epochStart,
            movement.fixedStepSeconds,
          )
          if (availableFromSeconds >= finishSeconds)
            runnerSourceFail(
              `${path}.obstacles`,
              'leave no reachable finish interval.',
            )
        }
      }
      if (reachable.size === 0)
        runnerSourceFail(
          checkpointIndex === 0
            ? `${path}.obstacles[${index}]`
            : `${path}.checkpoints[${checkpointIndex}]`,
          checkpointIndex === 0
            ? 'leaves no reachable lane to the finish.'
            : `leaves no reachable lane through obstacle "${obstacle.id}".`,
        )
    }
  }
}

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
