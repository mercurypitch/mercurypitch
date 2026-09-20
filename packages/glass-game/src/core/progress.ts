// Adventure progress — validate stable content IDs and restore only reachable checkpoints.

import type { CheckpointDefinition, LevelDefinition, SavedProgress, } from '../contracts'
import { emptyRewardProgress, mergeRewardProgress, readRewardProgress, } from './rewards'

export function requirementsMet(
  required: readonly string[] | undefined,
  completed: ReadonlySet<string>,
): boolean {
  return required === undefined || required.every((id) => completed.has(id))
}

export function readProgress(
  level: LevelDefinition,
  raw: unknown,
): SavedProgress {
  const fallback: SavedProgress = {
    version: 2,
    levelId: level.id,
    checkpointId: level.spawn.checkpointId ?? level.checkpoints[0]?.id ?? '',
    completedBreakableIds: [],
    finished: false,
    rewards: emptyRewardProgress(),
  }
  if (typeof raw !== 'object' || raw === null) return fallback
  const data = raw as Partial<SavedProgress>
  if (
    (data.version !== 1 && data.version !== 2) ||
    data.levelId !== level.id ||
    !Array.isArray(data.completedBreakableIds)
  )
    return fallback
  const requested = new Set(
    data.completedBreakableIds.filter(
      (id): id is string => typeof id === 'string',
    ),
  )
  const completed = new Set<string>()
  // Dependency order is deliberately not tied to content array order.
  for (let pass = 0; pass < level.breakables.length; pass++) {
    for (const target of level.breakables) {
      if (
        requested.has(target.id) &&
        requirementsMet(target.requiresCompleted, completed)
      )
        completed.add(target.id)
    }
  }
  const checkpoint = level.checkpoints.find(
    (p) =>
      p.id === data.checkpointId &&
      requirementsMet(p.requiresCompleted, completed),
  )
  return {
    version: 2,
    levelId: level.id,
    checkpointId: checkpoint?.id ?? fallback.checkpointId,
    completedBreakableIds: [...completed],
    finished:
      data.finished === true &&
      requirementsMet(level.exit.requiresCompleted, completed),
    rewards: readRewardProgress(
      level,
      data.rewards,
      completed,
      data.version === 1,
    ),
  }
}

/** Replays can start fresh while writes retain the strongest durable route and rewards. */
export function mergeSavedProgress(
  level: LevelDefinition,
  leftRaw: unknown,
  rightRaw: unknown,
): SavedProgress {
  const left = readProgress(level, leftRaw)
  const right = readProgress(level, rightRaw)
  return readProgress(level, {
    version: 2,
    levelId: level.id,
    checkpointId: right.checkpointId,
    completedBreakableIds: [
      ...left.completedBreakableIds,
      ...right.completedBreakableIds,
    ],
    finished: left.finished === true || right.finished === true,
    rewards: mergeRewardProgress(level, left.rewards, right.rewards),
  })
}

export function findCheckpoint(
  level: LevelDefinition,
  id: string,
  completed: ReadonlySet<string>,
): CheckpointDefinition | undefined {
  return level.checkpoints.find(
    (p) => p.id === id && requirementsMet(p.requiresCompleted, completed),
  )
}
