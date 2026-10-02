// ============================================================
// Song runner progress tests — untrusted saves and monotonic durable rewards.
// ============================================================

import { describe, expect, it } from 'vitest'
import { SINGING_CURRENT, SINGING_CURRENT_CURRENT, SINGING_CURRENT_LEARNING, SINGING_CURRENT_TRIALS, } from './first-course'
import { collectRunnerRewards, completeRunnerProgress, createRunnerTargetQuality, mergeRunnerTargetQuality, readSavedRunnerProgress, } from './progress'

const course = SINGING_CURRENT
const target = course.targets[0]!
const minimumReliableSeconds = target.notes.reduce(
  (total, note) => total + note.minimumReliableSeconds,
  0,
)

describe('song runner progress', () => {
  it('migrates canonical revision-one completion and rewards without stale qualities', () => {
    const currentTarget = SINGING_CURRENT_CURRENT.targets[0]!
    const currentReliableSeconds = currentTarget.notes.reduce(
      (total, note) => total + note.minimumReliableSeconds,
      0,
    )
    const currentQuality = createRunnerTargetQuality(
      SINGING_CURRENT_CURRENT,
      currentTarget.id,
      3,
      currentReliableSeconds,
      20,
    )
    const rewardIds = [
      SINGING_CURRENT_CURRENT.rewards.pickups[0]!.id,
      SINGING_CURRENT_CURRENT.rewards.finishRewardIds[0]!,
    ]
    const migrated = readSavedRunnerProgress(SINGING_CURRENT_LEARNING, {
      version: 1,
      courseId: SINGING_CURRENT_CURRENT.id,
      courseRevision: SINGING_CURRENT_CURRENT.revision,
      rewardsRevision: SINGING_CURRENT_CURRENT.rewards.revision,
      completed: true,
      bestTargetQualities: [currentQuality],
      collectedRewardIds: [...rewardIds, 'retired-reward'],
    })
    expect(migrated).toEqual({
      version: 1,
      courseId: 'the-singing-current-v1',
      courseRevision: 2,
      rewardsRevision: 1,
      completed: true,
      bestTargetQualities: [],
      collectedRewardIds: [...rewardIds].sort(),
    })
  })

  it('does not mix canonical saves into either isolated trial identity', () => {
    const canonical = {
      version: 1,
      courseId: SINGING_CURRENT.id,
      courseRevision: SINGING_CURRENT.revision,
      rewardsRevision: SINGING_CURRENT.rewards.revision,
      completed: true,
      bestTargetQualities: [],
      collectedRewardIds: [SINGING_CURRENT.rewards.pickups[0]!.id],
    }
    for (const trial of Object.values(SINGING_CURRENT_TRIALS)) {
      expect(readSavedRunnerProgress(trial, canonical)).toEqual({
        version: 1,
        courseId: trial.id,
        courseRevision: trial.revision,
        rewardsRevision: trial.rewards.revision,
        completed: false,
        bestTargetQualities: [],
        collectedRewardIds: [],
      })
    }
  })

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

  it('migrates legacy scheduled fingerprints but rejects stale charge policy quality', () => {
    const scheduledTarget = SINGING_CURRENT_CURRENT.targets[0]!
    const scheduled = createRunnerTargetQuality(
      SINGING_CURRENT_CURRENT,
      scheduledTarget.id,
      3,
      scheduledTarget.notes[0]!.minimumReliableSeconds,
      10,
    )
    const { completionFingerprint: _legacyOmitted, ...legacyScheduled } =
      scheduled
    expect(
      readSavedRunnerProgress(SINGING_CURRENT_CURRENT, {
        version: 1,
        courseId: SINGING_CURRENT_CURRENT.id,
        courseRevision: SINGING_CURRENT_CURRENT.revision,
        rewardsRevision: SINGING_CURRENT_CURRENT.rewards.revision,
        completed: false,
        bestTargetQualities: [legacyScheduled],
        collectedRewardIds: [],
      }).bestTargetQualities,
    ).toEqual([scheduled])

    const charge = createRunnerTargetQuality(
      course,
      target.id,
      1,
      minimumReliableSeconds - 5e-10,
      course.voice.judge.centsTolerance + 5e-10,
    )
    const stale = readSavedRunnerProgress(course, {
      version: 1,
      courseId: course.id,
      courseRevision: course.revision,
      rewardsRevision: course.rewards.revision,
      completed: false,
      bestTargetQualities: [
        { ...charge, completionFingerprint: 'charge-v1:retired' },
      ],
      collectedRewardIds: [],
    })
    expect(stale.bestTargetQualities).toEqual([])

    const current = readSavedRunnerProgress(course, {
      ...stale,
      bestTargetQualities: [charge],
    })
    expect(current.bestTargetQualities).toEqual([charge])
  })
})
