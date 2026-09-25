// ============================================================
// Adventure message scheduler — reserve two contextual HUD rows without stale queues.
// ============================================================
//
// Narration always keeps a visible row while its matching audio can play. A
// precise transient notice comes next. Derived route guidance waits for a free
// row and is re-read from current game state, so hidden guidance cannot go stale.

export type AdventureMessageKind = 'narration' | 'notice' | 'guidance'

export interface AdventureMessageAvailability {
  narration: boolean
  notice: boolean
  guidance: boolean
}

export const ADVENTURE_MESSAGE_ROW_LIMIT = 2

const MESSAGE_PRIORITY: readonly AdventureMessageKind[] = [
  'narration',
  'notice',
  'guidance',
]

export function scheduleAdventureMessageKinds(
  available: AdventureMessageAvailability,
): readonly AdventureMessageKind[] {
  return MESSAGE_PRIORITY.filter((kind) => available[kind]).slice(
    0,
    ADVENTURE_MESSAGE_ROW_LIMIT,
  )
}
