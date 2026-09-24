// Fresh visit host — replay from the entrance without erasing durable progress during loading.
import type { LevelDefinition } from '../contracts'
import { mergeSavedProgress, readProgress } from '../core/progress'
import type { GlassGameHost } from '../host'

export function createFreshVisitHost(
  host: GlassGameHost,
  level: LevelDefinition,
): GlassGameHost {
  let durableProgress = readProgress(level, host.loadProgress(level.id))
  const initialProgress = {
    ...readProgress(level, undefined),
    rewards: durableProgress.rewards,
  }
  return {
    ...host,
    loadProgress: (levelId) =>
      levelId === level.id ? initialProgress : host.loadProgress(levelId),
    saveProgress: (progress) => {
      if (progress.levelId !== level.id) {
        host.saveProgress(progress)
        return
      }
      durableProgress = mergeSavedProgress(level, durableProgress, progress)
      host.saveProgress(durableProgress)
    },
  }
}
