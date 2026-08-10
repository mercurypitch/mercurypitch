// ============================================================
// Background selection persistence — route-neutral preferred identifiers
// ============================================================
//
// Storage remembers only a known, surface-matching identifier. Entitlement
// remains a separate server-evidenced decision at every restore.

import type { BackgroundId, BackgroundSurface } from './background-catalog'
import { getBackgroundDefinition } from './background-catalog'

export const BACKGROUND_SELECTION_KEYS = {
  karaoke: 'pitchperfect_karaoke_background',
  jam: 'pitchperfect_jam_background',
  piano: 'pitchperfect_piano_background',
} as const satisfies Record<BackgroundSurface, string>

export interface BackgroundSelectionStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function browserStorage(): BackgroundSelectionStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readPersistedBackgroundId(
  surface: BackgroundSurface,
  storage: BackgroundSelectionStorage | null | undefined = undefined,
): BackgroundId | null {
  const target = storage === undefined ? browserStorage() : storage
  if (target === null) return null
  try {
    const stored = target.getItem(BACKGROUND_SELECTION_KEYS[surface])
    const definition = getBackgroundDefinition(stored)
    return definition?.surface === surface ? definition.id : null
  } catch {
    return null
  }
}

/** Persist preference only; callers must still resolve access on every read. */
export function persistBackgroundId(
  surface: BackgroundSurface,
  id: unknown,
  storage: BackgroundSelectionStorage | null | undefined = undefined,
): boolean {
  const target = storage === undefined ? browserStorage() : storage
  const definition = getBackgroundDefinition(id)
  if (target === null || definition?.surface !== surface) return false
  try {
    target.setItem(BACKGROUND_SELECTION_KEYS[surface], definition.id)
    return true
  } catch {
    return false
  }
}
