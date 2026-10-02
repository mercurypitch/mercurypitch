// ============================================================
// Song runner compiler — assemble strict source into finite runtime courses.
// ============================================================

import { runnerChunkId } from './compile-course-helpers.ts'
import { compileRunnerCheckpoints, compileRunnerObstacles, validateRunnerReachability, } from './compile-course-obstacles.ts'
import { compileRunnerTargets, validateRunnerMovement, validateRunnerVoice, } from './compile-course-targets.ts'
import type { CompiledRunnerChunk, CompiledRunnerCourse, CompiledRunnerObstacle, CompiledRunnerTarget, } from './contracts.ts'
import { RUNNER_MAXIMUM_COURSE_SECONDS } from './resource-limits.ts'
import type { RunnerObstacleCatalogProfile, SongRunnerCourseCatalog, SongRunnerCourseSource, } from './source.ts'
import { runnerSourceArray, runnerSourceExactKeys, runnerSourceFail, runnerSourceRecord, runnerSourceUniqueIds, } from './source.ts'
import { parseRunnerCourseSource } from './source-parser.ts'
import { compileRunnerTempoSegments, runnerBeatToDistance, runnerBeatToSeconds, } from './tempo.ts'

const MAXIMUM_COURSES = 16
export const RUNNER_MAXIMUM_CHUNKS = 256

function compileChunks(
  course: SongRunnerCourseSource,
  tempoSegments: CompiledRunnerCourse['tempoSegments'],
  targets: readonly CompiledRunnerTarget[],
  obstacles: readonly CompiledRunnerObstacle[],
  pickups: readonly {
    id: string
    chunkId: string
  }[],
  catalog: SongRunnerCourseCatalog,
  targetAssets: ReadonlyMap<string, readonly string[]>,
  obstacleProfiles: ReadonlyMap<string, RunnerObstacleCatalogProfile>,
  pickupAssets: readonly string[],
): readonly CompiledRunnerChunk[] {
  const count = Math.ceil(course.track.lengthBeats / course.track.chunkBeats)
  const environmentAssets =
    catalog.environmentProfiles[course.presentation.environmentProfileId]!
      .assetProfileIds
  return Array.from({ length: count }, (_, index) => {
    const startBeat = index * course.track.chunkBeats
    const endBeat = Math.min(
      course.track.lengthBeats,
      startBeat + course.track.chunkBeats,
    )
    const id = runnerChunkId(course.id, course.track.chunkBeats, startBeat)
    const chunkTargets = targets.filter((target) => target.chunkId === id)
    const chunkObstacles = obstacles.filter(
      (obstacle) => obstacle.chunkId === id,
    )
    const chunkPickups = pickups.filter((pickup) => pickup.chunkId === id)
    const assetProfileIds = new Set<string>(environmentAssets)
    for (const target of chunkTargets)
      for (const assetId of targetAssets.get(target.id) ?? [])
        assetProfileIds.add(assetId)
    for (const obstacle of chunkObstacles)
      for (const assetId of obstacleProfiles.get(obstacle.id)
        ?.assetProfileIds ?? [])
        assetProfileIds.add(assetId)
    if (chunkPickups.length > 0)
      for (const assetId of pickupAssets) assetProfileIds.add(assetId)
    return {
      id,
      index,
      startBeat,
      endBeat,
      startCourseSeconds: runnerBeatToSeconds(tempoSegments, startBeat),
      endCourseSeconds: runnerBeatToSeconds(tempoSegments, endBeat),
      minCourseDistanceMeters: runnerBeatToDistance(
        startBeat,
        course.track.metersPerBeat,
      ),
      maxCourseDistanceMeters: runnerBeatToDistance(
        endBeat,
        course.track.metersPerBeat,
      ),
      targetIds: chunkTargets.map((target) => target.id),
      obstacleIds: chunkObstacles.map((obstacle) => obstacle.id),
      rewardIds: chunkPickups.map((pickup) => pickup.id),
      assetProfileIds: [...assetProfileIds].sort(),
    }
  })
}

export function compileSongRunnerCourse(
  raw: unknown,
  catalog: SongRunnerCourseCatalog,
  path = '$.courses[0]',
): CompiledRunnerCourse {
  const course = parseRunnerCourseSource(raw, path)
  if (course.revision <= 0)
    runnerSourceFail(`${path}.revision`, 'must be positive.')
  if (course.track.lengthBeats > 2048)
    runnerSourceFail(`${path}.track.lengthBeats`, 'is too large.')
  const lengthMeters = runnerBeatToDistance(
    course.track.lengthBeats,
    course.track.metersPerBeat,
  )
  if (!Number.isFinite(lengthMeters))
    runnerSourceFail(
      `${path}.track.metersPerBeat`,
      'must produce a finite course length.',
    )
  if (
    Math.ceil(course.track.lengthBeats / course.track.chunkBeats) >
    RUNNER_MAXIMUM_CHUNKS
  )
    runnerSourceFail(
      `${path}.track.chunkBeats`,
      `must produce at most ${RUNNER_MAXIMUM_CHUNKS} chunks.`,
    )
  if (
    course.track.chunkBeats > course.track.lengthBeats ||
    course.track.lengthBeats % course.track.chunkBeats !== 0
  )
    runnerSourceFail(
      `${path}.track.chunkBeats`,
      'must divide the course length exactly.',
    )
  if (course.track.vocalEmphasisBeats > course.track.vocalLookaheadBeats)
    runnerSourceFail(
      `${path}.track.vocalEmphasisBeats`,
      'cannot exceed vocalLookaheadBeats.',
    )
  for (const [index, point] of course.tempoMap.entries()) {
    if (point.atBeat % course.meter.beatsPerBar !== 0)
      runnerSourceFail(
        `${path}.tempoMap[${index}].atBeat`,
        'must lie on a bar.',
      )
  }
  const tempoSegments = compileRunnerTempoSegments(
    course.tempoMap,
    course.track.lengthBeats,
    `${path}.tempoMap`,
  )
  for (const [index, segment] of tempoSegments.entries()) {
    if (segment.endCourseSeconds > RUNNER_MAXIMUM_COURSE_SECONDS)
      runnerSourceFail(
        `${path}.tempoMap[${index}].bpm`,
        `must keep the course duration at most ${RUNNER_MAXIMUM_COURSE_SECONDS} seconds.`,
      )
  }
  const movement = validateRunnerMovement(course, catalog, path)
  const { voice, profile: voiceProfile } = validateRunnerVoice(
    course,
    catalog,
    path,
  )
  const { targets, windows, glassAssets } = compileRunnerTargets(
    course,
    voice,
    voiceProfile,
    tempoSegments,
    catalog,
    path,
  )
  const { obstacles, profiles: obstacleProfiles } = compileRunnerObstacles(
    course,
    catalog,
    movement,
    tempoSegments,
    windows,
    path,
  )
  const checkpoints = compileRunnerCheckpoints(
    course,
    obstacles,
    tempoSegments,
    movement,
    path,
  )
  validateRunnerReachability(course, obstacles, tempoSegments, movement, path)

  const pickupProfile = catalog.pickupProfiles[course.rewards.pickupProfileId]
  if (pickupProfile === undefined)
    runnerSourceFail(
      `${path}.rewards.pickupProfileId`,
      `references unknown profile "${course.rewards.pickupProfileId}".`,
    )
  if (
    pickupProfile.id !== course.rewards.pickupProfileId ||
    !Number.isFinite(pickupProfile.radiusMeters) ||
    pickupProfile.radiusMeters <= 0
  )
    runnerSourceFail(
      `${path}.rewards.pickupProfileId`,
      'references a malformed pickup profile.',
    )
  runnerSourceUniqueIds(
    course.rewards.pickups.map((pickup) => pickup.id),
    `${path}.rewards.pickups`,
  )
  const pickups = course.rewards.pickups.map((pickup, index) => {
    if (pickup.atBeat < 0 || pickup.atBeat >= course.track.lengthBeats)
      runnerSourceFail(
        `${path}.rewards.pickups[${index}].atBeat`,
        'must lie inside the course.',
      )
    return {
      id: pickup.id,
      chunkId: runnerChunkId(course.id, course.track.chunkBeats, pickup.atBeat),
      beat: pickup.atBeat,
      courseSeconds: runnerBeatToSeconds(tempoSegments, pickup.atBeat),
      courseDistanceMeters: runnerBeatToDistance(
        pickup.atBeat,
        course.track.metersPerBeat,
      ),
      lateralX: course.track.laneCenters[pickup.lane],
      radius: pickupProfile.radiusMeters,
    }
  })
  const targetIdSet = new Set(targets.map((target) => target.id))
  runnerSourceUniqueIds(
    course.rewards.singingStarTargetIds,
    `${path}.rewards.singingStarTargetIds`,
  )
  for (const [index, targetId] of course.rewards.singingStarTargetIds.entries())
    if (!targetIdSet.has(targetId))
      runnerSourceFail(
        `${path}.rewards.singingStarTargetIds[${index}]`,
        `references unknown target "${targetId}".`,
      )
  if (course.rewards.finishRewardIds.length === 0)
    runnerSourceFail(`${path}.rewards.finishRewardIds`, 'must not be empty.')
  runnerSourceUniqueIds(
    [...pickups.map((pickup) => pickup.id), ...course.rewards.finishRewardIds],
    `${path}.rewards`,
  )

  const environment =
    catalog.environmentProfiles[course.presentation.environmentProfileId]
  if (environment === undefined)
    runnerSourceFail(
      `${path}.presentation.environmentProfileId`,
      `references unknown profile "${course.presentation.environmentProfileId}".`,
    )
  if (!catalog.musicProfileIds.includes(course.presentation.musicProfileId))
    runnerSourceFail(
      `${path}.presentation.musicProfileId`,
      `references unknown profile "${course.presentation.musicProfileId}".`,
    )
  if (
    !catalog.notationProfileIds.includes(course.presentation.notationProfileId)
  )
    runnerSourceFail(
      `${path}.presentation.notationProfileId`,
      `references unknown profile "${course.presentation.notationProfileId}".`,
    )

  const chunks = compileChunks(
    course,
    tempoSegments,
    targets,
    obstacles,
    pickups,
    catalog,
    glassAssets,
    obstacleProfiles,
    pickupProfile.assetProfileIds,
  )
  const preloadAssetProfileIds = new Set<string>(environment.assetProfileIds)
  for (const chunk of chunks)
    for (const assetId of chunk.assetProfileIds)
      preloadAssetProfileIds.add(assetId)

  return {
    schema: 'mercurypitch.song-runner.compiled',
    version: 1,
    id: course.id,
    revision: course.revision,
    title: course.title,
    seed: course.seed,
    meter: course.meter,
    lengthBeats: course.track.lengthBeats,
    lengthCourseSeconds: runnerBeatToSeconds(
      tempoSegments,
      course.track.lengthBeats,
    ),
    metersPerBeat: course.track.metersPerBeat,
    lengthMeters,
    groundFeetY: course.track.groundFeetY,
    fallBelowFeetY: course.track.fallBelowFeetY,
    laneCenters: course.track.laneCenters,
    tempoSegments,
    movement,
    voice,
    checkpoints,
    targets,
    obstacles,
    chunks,
    rewards: {
      revision: course.rewards.revision,
      pickups,
      singingStarTargetIds: course.rewards.singingStarTargetIds,
      finishRewardIds: course.rewards.finishRewardIds,
    },
    presentation: course.presentation,
    preloadAssetProfileIds: [...preloadAssetProfileIds].sort(),
  }
}

export function compileSongRunnerCourseDocument(
  raw: unknown,
  catalog: SongRunnerCourseCatalog,
): readonly CompiledRunnerCourse[] {
  const document = runnerSourceRecord(raw, '$')
  runnerSourceExactKeys(document, '$', ['schema', 'version', 'courses'])
  if (document.schema !== 'mercurypitch.song-runner-course')
    runnerSourceFail('$.schema', 'must be mercurypitch.song-runner-course.')
  if (document.version !== 1) runnerSourceFail('$.version', 'must be 1.')
  const courses = runnerSourceArray(
    document.courses,
    '$.courses',
    MAXIMUM_COURSES,
  )
  if (courses.length === 0) runnerSourceFail('$.courses', 'must not be empty.')
  const compiled = courses.map((course, index) =>
    compileSongRunnerCourse(course, catalog, `$.courses[${index}]`),
  )
  runnerSourceUniqueIds(
    compiled.map((course) => course.id),
    '$.courses',
  )
  return compiled
}
