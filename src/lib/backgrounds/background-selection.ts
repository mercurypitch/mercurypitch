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
  guitar: 'pitchperfect_guitar_background',
  drum: 'pitchperfect_drum_background',
} as const satisfies Record<BackgroundSurface, string>

/**
 * Keys a surface used before it joined this catalog.
 *
 * Guitar Night chose rooms from its own module under its own key long before
 * there was a catalog to join. The identifiers are unchanged, so honouring
 * the old key is the whole migration — without it every existing player would
 * silently be moved back to the default room on the release that unifies them.
 */
const LEGACY_SELECTION_KEYS: Partial<Record<BackgroundSurface, string>> = {
  guitar: 'pitchperfect_guitar_night_backdrop',
}

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
    const keys = [
      BACKGROUND_SELECTION_KEYS[surface],
      LEGACY_SELECTION_KEYS[surface],
    ]
    for (const key of keys) {
      if (key === undefined) continue
      const definition = getBackgroundDefinition(target.getItem(key))
      // Surface-matching, not merely known: the legacy key is only trusted
      // for the surface that used to own it.
      if (definition?.surface === surface) return definition.id
    }
    return null
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
