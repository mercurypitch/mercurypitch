// ============================================================
// Song runner progress — validate untrusted saves and apply monotonic rewards.
// ============================================================

import type { CompiledRunnerCourse, RunnerQualityGrade, SavedRunnerProgress, SavedRunnerTargetQuality, } from './contracts'

function emptyProgress(course: CompiledRunnerCourse): SavedRunnerProgress {
  return {
    version: 1,
    courseId: course.id,
    courseRevision: course.revision,
    rewardsRevision: course.rewards.revision,
    completed: false,
    bestTargetQualities: [],
    collectedRewardIds: [],
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function validQuality(
  course: CompiledRunnerCourse,
  value: unknown,
): SavedRunnerTargetQuality | null {
  const source = record(value)
  if (source === null) return null
  const target = course.targets.find(
    (candidate) => candidate.id === source.targetId,
  )
  const grade = source.grade
  const reliableSeconds = source.reliableSeconds
  const meanAbsoluteCents = source.meanAbsoluteCents
  if (
    target === undefined ||
    (grade !== 1 && grade !== 2 && grade !== 3) ||
    source.courseRevision !== course.revision ||
    source.judgeProfileId !== course.voice.judge.id ||
    source.judgeProfileRevision !== course.voice.judge.revision ||
    source.evidenceVersion !== course.voice.judge.evidenceVersion ||
    typeof reliableSeconds !== 'number' ||
    !Number.isFinite(reliableSeconds) ||
    reliableSeconds <
      target.notes.reduce(
        (total, note) => total + note.minimumReliableSeconds,
        0,
      ) ||
    typeof meanAbsoluteCents !== 'number' ||
    !Number.isFinite(meanAbsoluteCents) ||
    meanAbsoluteCents < 0
  )
    return null
  const band = course.voice.judge.gradeBands.find(
    (candidate) => candidate.grade === grade,
  )
  if (
    band === undefined ||
    meanAbsoluteCents > band.maximumMeanAbsoluteCents ||
    meanAbsoluteCents > course.voice.judge.centsTolerance
  )
    return null
  return {
    targetId: target.id,
    grade,
    courseRevision: course.revision,
    judgeProfileId: course.voice.judge.id,
    judgeProfileRevision: course.voice.judge.revision,
    evidenceVersion: course.voice.judge.evidenceVersion,
    reliableSeconds,
    meanAbsoluteCents,
  }
}

export function isBetterRunnerTargetQuality(
  candidate: SavedRunnerTargetQuality,
  previous: SavedRunnerTargetQuality,
): boolean {
  return (
    candidate.grade > previous.grade ||
    (candidate.grade === previous.grade &&
      (candidate.meanAbsoluteCents < previous.meanAbsoluteCents ||
        (candidate.meanAbsoluteCents === previous.meanAbsoluteCents &&
          candidate.reliableSeconds > previous.reliableSeconds)))
  )
}

export function readSavedRunnerProgress(
  course: CompiledRunnerCourse,
  raw: unknown,
): SavedRunnerProgress {
  const source = record(raw)
  if (source === null || source.version !== 1 || source.courseId !== course.id)
    return emptyProgress(course)
  const currentRewardIds = new Set([
    ...course.rewards.pickups.map((pickup) => pickup.id),
    ...course.rewards.finishRewardIds,
  ])
  const collectedRewardIds = Array.isArray(source.collectedRewardIds)
    ? [
        ...new Set(
          source.collectedRewardIds.filter(
            (id): id is string =>
              typeof id === 'string' && currentRewardIds.has(id),
          ),
        ),
      ]
    : []
  const qualities = new Map<string, SavedRunnerTargetQuality>()
  if (
    source.courseRevision === course.revision &&
    Array.isArray(source.bestTargetQualities)
  ) {
    for (const value of source.bestTargetQualities) {
      const quality = validQuality(course, value)
      if (quality === null) continue
      const prior = qualities.get(quality.targetId)
      if (prior === undefined || isBetterRunnerTargetQuality(quality, prior))
        qualities.set(quality.targetId, quality)
    }
  }
  return {
    version: 1,
    courseId: course.id,
    courseRevision: course.revision,
    rewardsRevision: course.rewards.revision,
    completed: source.completed === true,
    bestTargetQualities: [...qualities.values()].sort((left, right) =>
      left.targetId.localeCompare(right.targetId),
    ),
    collectedRewardIds: collectedRewardIds.sort(),
  }
}

export function mergeRunnerTargetQuality(
  progress: SavedRunnerProgress,
  quality: SavedRunnerTargetQuality,
): SavedRunnerProgress {
  const qualities = new Map(
    progress.bestTargetQualities.map((candidate) => [
      candidate.targetId,
      candidate,
    ]),
  )
  const prior = qualities.get(quality.targetId)
  if (prior !== undefined && !isBetterRunnerTargetQuality(quality, prior))
    return progress
  qualities.set(quality.targetId, quality)
  return {
    ...progress,
    bestTargetQualities: [...qualities.values()].sort((left, right) =>
      left.targetId.localeCompare(right.targetId),
    ),
  }
}

export function collectRunnerRewards(
  progress: SavedRunnerProgress,
  rewardIds: readonly string[],
): SavedRunnerProgress {
  const collected = new Set(progress.collectedRewardIds)
  let changed = false
  for (const rewardId of rewardIds) {
    if (!collected.has(rewardId)) {
      collected.add(rewardId)
      changed = true
    }
  }
  return changed
    ? { ...progress, collectedRewardIds: [...collected].sort() }
    : progress
}

export function completeRunnerProgress(
  progress: SavedRunnerProgress,
): SavedRunnerProgress {
  return progress.completed ? progress : { ...progress, completed: true }
}

export function createRunnerTargetQuality(
  course: CompiledRunnerCourse,
  targetId: string,
  grade: RunnerQualityGrade,
  reliableSeconds: number,
  meanAbsoluteCents: number,
): SavedRunnerTargetQuality {
  return {
    targetId,
    grade,
    courseRevision: course.revision,
    judgeProfileId: course.voice.judge.id,
    judgeProfileRevision: course.voice.judge.revision,
    evidenceVersion: course.voice.judge.evidenceVersion,
    reliableSeconds,
    meanAbsoluteCents,
  }
}
