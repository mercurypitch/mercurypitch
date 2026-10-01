// ============================================================
// Song runner progress tests — untrusted saves and monotonic durable rewards.
// ============================================================

import { describe, expect, it } from 'vitest'
import { SINGING_CURRENT } from './first-course'
import { collectRunnerRewards, completeRunnerProgress, createRunnerTargetQuality, mergeRunnerTargetQuality, readSavedRunnerProgress, } from './progress'

const course = SINGING_CURRENT
const target = course.targets[0]!
const minimumReliableSeconds = target.notes.reduce(
  (total, note) => total + note.minimumReliableSeconds,
  0,
)

describe('song runner progress', () => {
  it('filters obsolete rewards and incompatible or malformed qualities', () => {
    const valid = createRunnerTargetQuality(
      course,
      target.id,
      2,
      minimumReliableSeconds,
      30,
    )
    const progress = readSavedRunnerProgress(course, {
      version: 1,
      courseId: course.id,
      courseRevision: course.revision,
      rewardsRevision: course.rewards.revision - 1,
      completed: true,
      bestTargetQualities: [
        valid,
        { ...valid, grade: 3, meanAbsoluteCents: 26 },
        { ...valid, targetId: 'retired-target' },
        { ...valid, courseRevision: course.revision - 1 },
      ],
      collectedRewardIds: [
        course.rewards.pickups[0]!.id,
        course.rewards.pickups[0]!.id,
        'retired-reward',
      ],
    })
    expect(progress.completed).toBe(true)
    expect(progress.bestTargetQualities).toEqual([valid])
    expect(progress.collectedRewardIds).toEqual([course.rewards.pickups[0]!.id])
    expect(progress.rewardsRevision).toBe(course.rewards.revision)
  })

  it('keeps the strongest validated quality and applies rewards idempotently', () => {
    let progress = readSavedRunnerProgress(course, undefined)
    const gradeOne = createRunnerTargetQuality(
      course,
      target.id,
      1,
      minimumReliableSeconds,
      5,
    )
    const gradeTwo = createRunnerTargetQuality(
      course,
      target.id,
      2,
      minimumReliableSeconds,
      40,
    )
    const gradeTwoBetter = createRunnerTargetQuality(
      course,
      target.id,
      2,
      minimumReliableSeconds + 0.1,
      20,
    )
    progress = mergeRunnerTargetQuality(progress, gradeOne)
    progress = mergeRunnerTargetQuality(progress, gradeTwo)
    progress = mergeRunnerTargetQuality(progress, gradeOne)
    progress = mergeRunnerTargetQuality(progress, gradeTwoBetter)
    expect(progress.bestTargetQualities).toEqual([gradeTwoBetter])

    const rewardId = course.rewards.finishRewardIds[0]!
    const rewarded = collectRunnerRewards(progress, [rewardId, rewardId])
    expect(rewarded.collectedRewardIds).toEqual([rewardId])
    expect(collectRunnerRewards(rewarded, [rewardId])).toBe(rewarded)
    const completed = completeRunnerProgress(rewarded)
    expect(completed.completed).toBe(true)
    expect(completeRunnerProgress(completed)).toBe(completed)
  })
})
