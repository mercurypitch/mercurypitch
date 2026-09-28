// Campaign access — validated earlier visits unlock the next gallery without inventing rewards.
import type { LevelDefinition } from '../contracts'
import { readProgress } from './progress'

interface CampaignChapter {
  id: string
  level: LevelDefinition
}

export interface CampaignAccess {
  unlocked: boolean
  blockedBy?: { chapterId: string; title: string }
}

/** All preceding chapters matter, including the prologue. Unknown routes fail closed. */
export function campaignChapterAccess(
  chapterId: string,
  chapters: readonly CampaignChapter[],
  loadProgress: (levelId: string) => unknown,
  developmentUnlock = false,
): CampaignAccess {
  const index = chapters.findIndex((chapter) => chapter.id === chapterId)
  if (index < 0) return { unlocked: false }
  if (developmentUnlock) return { unlocked: true }
  const unfinished = chapters
    .slice(0, index)
    .find(
      (chapter) =>
        readProgress(chapter.level, loadProgress(chapter.level.id)).finished !==
        true,
    )
  return unfinished === undefined
    ? { unlocked: true }
    : {
        unlocked: false,
        blockedBy: {
          chapterId: unfinished.id,
          title: unfinished.level.title,
        },
      }
}
