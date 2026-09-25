// Adventure notice — keep restored visits from replaying stale opening guidance.

import type { GameSnapshot, LevelDefinition } from '../contracts'

const FALLBACK_OPENING_NOTICE =
  'Explore the museum and approach a glass exhibit.'

/** Opening copy belongs only to a fresh spawn; restored progress uses live guidance. */
export function initialAdventureNotice(
  level: LevelDefinition,
  snapshot: GameSnapshot,
): string {
  const spawnCheckpointId =
    level.spawn.checkpointId ?? level.checkpoints[0]?.id ?? ''
  const restored =
    snapshot.complete ||
    snapshot.completedBreakableIds.length > 0 ||
    snapshot.checkpointId !== spawnCheckpointId
  if (restored) return ''
  return level.guidance?.openingNotice ?? FALLBACK_OPENING_NOTICE
}
