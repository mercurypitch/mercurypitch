// Fresh visit host — replay from the entrance without erasing durable progress during loading.
import type { LevelDefinition } from '../contracts'
import { readProgress } from '../core/progress'
import type { GlassGameHost } from '../host'

export function createFreshVisitHost(
  host: GlassGameHost,
  level: LevelDefinition,
): GlassGameHost {
  const initialProgress = readProgress(level, undefined)
  return {
    ...host,
    loadProgress: (levelId) =>
      levelId === level.id ? initialProgress : host.loadProgress(levelId),
  }
}
