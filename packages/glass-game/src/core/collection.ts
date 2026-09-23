// Museum collection — derive finite discoveries, portrait ownership and badges from saved evidence.
import type { LevelDefinition, LevelRewardSummary } from '../contracts'
import type { ReplayProgress } from './replay-progress'
import { highestReplayTier } from './replay-progress'
import { summarizeRewards } from './rewards'

export interface CollectionEntry {
  levelId: string
  levelTitle: string
  stars: 0 | 1 | 2 | 3
  summary: LevelRewardSummary
}

export interface CollectionBadge {
  id: string
  title: string
  description: string
  earned: boolean
}

export function collectionEntry(
  level: LevelDefinition,
  progress: ReplayProgress,
): CollectionEntry | undefined {
  if (level.id !== progress.levelId) return undefined
  const summary = summarizeRewards(level, progress.collection)
  if (summary?.portrait === undefined) return undefined
  return {
    levelId: level.id,
    levelTitle: level.title,
    stars: highestReplayTier(progress),
    summary,
  }
}

export function collectionBadges(
  entries: readonly CollectionEntry[],
): CollectionBadge[] {
  return [
    {
      id: 'first-museum-portrait',
      title: 'A beautiful beginning',
      description: 'Collect your first gallery portrait.',
      earned: entries.some((item) => item.summary.portrait?.collected === true),
    },
    {
      id: 'museum-curious-listener',
      title: 'Curious listener',
      description: 'Find every discovery token in one gallery.',
      earned: entries.some(
        (item) =>
          item.summary.coinsTotal > 0 &&
          item.summary.coinsFound === item.summary.coinsTotal,
      ),
    },
    {
      id: 'museum-three-star-voice',
      title: 'A voice that shines',
      description: 'Complete a three-star gallery challenge.',
      earned: entries.some((item) => item.stars === 3),
    },
    {
      id: 'museum-first-three-portraits',
      title: 'The opening collection',
      description: 'Collect the first three gallery portraits.',
      earned:
        new Set(
          entries
            .filter(
              (item) =>
                item.summary.portrait?.collected === true &&
                item.summary.portrait.collectionIndex >= 1 &&
                item.summary.portrait.collectionIndex <= 3,
            )
            .map((item) => item.summary.portrait!.collectionIndex),
        ).size === 3,
    },
  ]
}
