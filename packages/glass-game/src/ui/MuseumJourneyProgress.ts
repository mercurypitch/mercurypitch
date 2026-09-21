// Museum journey progress — project validated saves into honest map labels and keepsakes.

import type { GalleryChapter } from '../content/campaign'
import { readProgress } from '../core/progress'
import { emptyRewardProgress, qualityResultMatchesPolicy, summarizeRewards, } from '../core/rewards'
import type { MuseumJourneyChapterView } from './MuseumJourney'

export function projectMuseumJourneyChapter(
  chapter: GalleryChapter,
  stageId: string,
  rawProgress: unknown,
  assetUrl: (id: string) => string,
): MuseumJourneyChapterView {
  const progress = readProgress(chapter.level, rawProgress)
  const required = chapter.level.breakables.filter((item) => !item.optional)
  const completed = required.filter((item) =>
    progress.completedBreakableIds.includes(item.id),
  ).length
  const visited =
    progress.completedBreakableIds.length > 0 ||
    progress.checkpointId !==
      (chapter.level.spawn.checkpointId ?? chapter.level.checkpoints[0]?.id)
  const action =
    progress.finished === true ? 'Replay' : visited ? 'Continue' : 'Enter'
  const rewards = summarizeRewards(
    chapter.level,
    progress.rewards ?? emptyRewardProgress(),
  )
  const quality = rewards?.qualityResults[0]
  const policy =
    quality === undefined
      ? undefined
      : chapter.level.rewards?.grading.find(
          (candidate) => candidate.encounterId === quality.encounterId,
        )
  const stars =
    quality?.grade === 1 || quality?.grade === 2 || quality?.grade === 3
      ? quality.grade
      : undefined
  const portrait = rewards?.portrait

  return {
    stageId,
    chapterId: chapter.id,
    chapterLabel: chapter.chapter,
    lesson: chapter.lesson,
    title: chapter.level.title,
    description: chapter.description,
    imageUrl: assetUrl(chapter.imageAsset),
    action,
    progressLabel:
      progress.finished === true
        ? 'Gallery complete'
        : completed > 0
          ? `${completed} of ${required.length} exhibits opened`
          : `${required.length} voice discoveries`,
    ...(stars === undefined ? {} : { stars }),
    historicalGrade:
      quality !== undefined &&
      policy !== undefined &&
      !qualityResultMatchesPolicy(quality, policy),
    notGraded: quality?.grade === 'not-graded',
    ...(portrait?.collected === true
      ? {
          portrait: {
            title: portrait.title,
            imageUrl: assetUrl(portrait.imageAssetId),
          },
        }
      : {}),
  }
}
