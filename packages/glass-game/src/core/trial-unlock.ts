// Trial unlocks — require completed island chapters and their saved pitch stars.
import type { LevelDefinition } from '../contracts'
import { readProgress } from './progress'

export interface TrialChapterRequirement {
  chapterId: string
  title: string
  level: LevelDefinition
}

export interface TrialChapterUnlock {
  chapterId: string
  title: string
  completed: boolean
  graded: boolean
  earnedStars: 0 | 1 | 2 | 3
  ready: boolean
  previouslyUnlocked?: boolean
}

export interface TrialUnlock {
  unlocked: boolean
  chapters: readonly TrialChapterUnlock[]
}

/** An unknown/empty island fails closed; an ungraded tutorial needs completion. */
export function evaluateTrialUnlock(
  requiredChapterIds: readonly string[],
  chapters: readonly TrialChapterRequirement[],
  loadProgress: (levelId: string) => unknown,
  replayEligibility?: (
    levelId: string,
  ) => { stars: 0 | 1 | 2 | 3; previouslyUnlocked: boolean } | undefined,
): TrialUnlock {
  const requirements = [...new Set(requiredChapterIds)].map((chapterId) => {
    const chapter = chapters.find((item) => item.chapterId === chapterId)
    if (chapter === undefined)
      return {
        chapterId,
        title: 'Gallery unavailable',
        completed: false,
        graded: false,
        earnedStars: 0,
        ready: false,
      } satisfies TrialChapterUnlock
    const progress = readProgress(chapter.level, loadProgress(chapter.level.id))
    const policies = chapter.level.rewards?.grading ?? []
    const completed = progress.finished === true
    const replay = replayEligibility?.(chapter.level.id)
    const graded = replay !== undefined || policies.length > 0
    const grades = policies.map((policy) => {
      const result = progress.rewards?.qualityResults.find(
        (item) => item.encounterId === policy.encounterId,
      )
      // Historical, validated pitch stars remain earned; these are not replay tiers.
      if (
        result === undefined ||
        result.grade === 'not-graded' ||
        result.reliableSeconds <= 0 ||
        result.meanAbsoluteCents === undefined ||
        !progress.completedBreakableIds.includes(policy.encounterId)
      )
        return 0
      return result.grade
    })
    const earnedStars = (
      replay !== undefined ? replay.stars : graded ? Math.min(...grades) : 0
    ) as 0 | 1 | 2 | 3
    return {
      chapterId,
      title: chapter.title,
      completed,
      graded,
      earnedStars,
      ready:
        completed &&
        (!graded || earnedStars === 3 || replay?.previouslyUnlocked === true),
      ...(replay?.previouslyUnlocked === true
        ? { previouslyUnlocked: true }
        : {}),
    } satisfies TrialChapterUnlock
  })
  return {
    unlocked:
      requirements.length > 0 && requirements.every((item) => item.ready),
    chapters: requirements,
  }
}
