// ============================================================
// Current Singing Current — shared entry identity and explicit legacy credit migration.
// ============================================================

import type { CompiledRunnerTarget, SavedRunnerProgress } from './contracts'
import { SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY } from './crystal-obstacle-study'
import { SINGING_CURRENT, SINGING_CURRENT_CURRENT, SINGING_CURRENT_LEARNING, } from './first-course'
import { collectRunnerRewards, completeRunnerProgress, mergeRunnerTargetQuality, readSavedRunnerProgress, } from './progress'

// Keep the shipped Crystal Current identity: its existing progress already
// describes this geometry. Camera changes are presentation only.
export const CURRENT_SINGING_COURSE = {
  ...SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY,
  presentation: {
    ...SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY.presentation,
    cameraProfile: 'steering-angled' as const,
  },
}

const LEGACY_REWARDS: Readonly<Record<string, string>> = {
  'pearl-left-60': 'crystal-continuous-study-pearl-left-60',
  'pearl-right-62': 'crystal-continuous-study-pearl-right-62',
  'pearl-right-114': 'crystal-continuous-study-pearl-right-114',
  'pearl-left-118': 'crystal-continuous-study-pearl-left-118',
  'portrait-first-song-run': 'study-crystal-continuous-finish',
}
const LEGACY_COURSES = [
  SINGING_CURRENT_CURRENT,
  SINGING_CURRENT_LEARNING,
  SINGING_CURRENT,
]

/** Validate historical scores under their original rules, never today's judge. */
export function readEarlierSingingRecord(
  raw: unknown,
): SavedRunnerProgress | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    return undefined
  const source = raw as Record<string, unknown>
  if (source.version !== 1 || source.courseId !== SINGING_CURRENT.id)
    return undefined
  const course = LEGACY_COURSES.find(
    (candidate) => candidate.revision === source.courseRevision,
  )
  if (course === undefined) return undefined
  const progress = readSavedRunnerProgress(course, source)
  return progress.completed ||
    progress.bestTargetQualities.length > 0 ||
    progress.collectedRewardIds.length > 0
    ? progress
    : undefined
}

function singingTargetIdentity(target: CompiledRunnerTarget): string {
  // Chunk IDs contain the course ID. Every challenge field (including notes,
  // timing, judge window and completion fingerprint) must otherwise match.
  const { chunkId: _chunkId, ...challenge } = target
  return JSON.stringify(challenge)
}

/** Merge earned credit, not route position. Old saves remain readable and untouched. */
export function mergeCurrentSingingProgress(
  currentRaw: unknown,
  earlierRaw: unknown,
): SavedRunnerProgress {
  const course = CURRENT_SINGING_COURSE
  let progress = readSavedRunnerProgress(course, currentRaw)
  const earlier = readEarlierSingingRecord(earlierRaw)
  if (earlier === undefined) return progress
  const source = LEGACY_COURSES.find(
    (candidate) => candidate.revision === earlier.courseRevision,
  )!
  // Completion and rewards are lifetime credit, as in the existing revision
  // migration contract. They never finish a live run or move its checkpoint.
  if (earlier.completed) progress = completeRunnerProgress(progress)
  progress = collectRunnerRewards(
    progress,
    earlier.collectedRewardIds.flatMap((id) => LEGACY_REWARDS[id] ?? []),
  )
  if (JSON.stringify(source.voice) !== JSON.stringify(course.voice))
    return progress
  const compatible = earlier.bestTargetQualities.flatMap((quality) => {
    const before = source.targets.find(
      (target) => target.id === quality.targetId,
    )
    const after = course.targets.find(
      (target) => target.id === quality.targetId,
    )
    return before &&
      after &&
      singingTargetIdentity(before) === singingTargetIdentity(after)
      ? [{ ...quality, courseRevision: course.revision }]
      : []
  })
  const validated = readSavedRunnerProgress(course, {
    ...progress,
    bestTargetQualities: compatible,
  })
  for (const quality of validated.bestTargetQualities)
    progress = mergeRunnerTargetQuality(progress, quality)
  return progress
}
