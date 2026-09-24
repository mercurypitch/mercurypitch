// Adventure progress — validate stable content IDs and restore only reachable checkpoints.

import type { CheckpointDefinition, LevelDefinition, SavedProgress, } from '../contracts'
import { emptyRewardProgress, mergeRewardProgress, readRewardProgress, } from './rewards'

export function requirementsMet(
  required: readonly string[] | undefined,
  completed: ReadonlySet<string>,
): boolean {
  return required === undefined || required.every((id) => completed.has(id))
}

/** Optional encounters remain rewards even if an exit lists one by mistake. */
export function getRequiredExitBreakableIds(
  level: LevelDefinition,
): readonly string[] {
  const optional = new Set(
    level.breakables
      .filter((target) => target.optional)
      .map((target) => target.id),
  )
  return level.exit.requiresCompleted.filter((id) => !optional.has(id))
}

/** Dependency-first route rooted at the exit, excluding optional side work. */
export function getRequiredRouteBreakableIds(
  level: LevelDefinition,
): readonly string[] {
  const targets = new Map(level.breakables.map((target) => [target.id, target]))
  const optional = new Set(
    level.breakables
      .filter((target) => target.optional)
      .map((target) => target.id),
  )
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const ordered: string[] = []
  const visit = (id: string): void => {
    if (visited.has(id) || optional.has(id)) return
    // Authored content rejects cycles. Keep direct LevelDefinition fixtures
    // finite while still retaining every member as a blocking requirement.
    if (visiting.has(id)) return
    visiting.add(id)
    for (const dependency of targets.get(id)?.requiresCompleted ?? [])
      visit(dependency)
    visiting.delete(id)
    visited.add(id)
    ordered.push(id)
  }
  for (const id of getRequiredExitBreakableIds(level)) visit(id)
  return ordered
}

export function exitRequirementsMet(
  level: LevelDefinition,
  completed: ReadonlySet<string>,
): boolean {
  return requirementsMet(getRequiredRouteBreakableIds(level), completed)
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
    finished: data.finished === true && exitRequirementsMet(level, completed),
    rewards: readRewardProgress(
      level,
      data.rewards,
      completed,
      // A validated final exhibit is sufficient evidence of portrait ownership,
      // including v2 visits made before that gallery gained its collection card.
      true,
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
