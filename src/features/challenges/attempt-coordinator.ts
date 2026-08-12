// ============================================================
// Scored attempt coordinator — exactly one challenge can own a finished run
// ============================================================

export type ScoredAttemptKind = 'challenge' | 'weekly'

const clearers: Partial<Record<ScoredAttemptKind, () => void>> = {}
let armedKind: ScoredAttemptKind | null = null

/**
 * Arm one scored destination and clear whichever destination was armed before
 * it. This keeps a stale personal-challenge context from double-recording the
 * same exercise that a singer has just launched from the weekly challenge.
 */
export function armScoredAttempt(
  kind: ScoredAttemptKind,
  clearOwnAttempt: () => void,
): void {
  clearers[kind] = clearOwnAttempt
  if (armedKind !== null && armedKind !== kind) {
    clearers[armedKind]?.()
  }
  armedKind = kind
}

/** Release ownership only when this is still the currently armed path. */
export function disarmScoredAttempt(kind: ScoredAttemptKind): void {
  if (armedKind === kind) armedKind = null
}
