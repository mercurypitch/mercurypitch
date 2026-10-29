// ============================================================
// Local-save navigation reason — what a held navigation is told when the holding surface says why
// ============================================================
//
// The lock in ./local-save-navigation-lock.ts holds navigation, and the app's
// own wording for a held request ("this take finishes saving") fits a voice
// take, which a wait always ends. Studio's project stays held after a save
// fails, until it is saved, copied or discarded, and waiting never ends
// that: Studio says why it holds, and the app quotes it.
//
// This lives apart from the lock because Drum Night, Piano Night and Guitar
// Night load the lock in their first paint, and Drum Night's first paint is
// held to a byte budget (scripts/assert-drum-night-bundle.mjs). Only the app
// and Studio load this.

import type { Accessor } from 'solid-js'
import { createEffect, onCleanup } from 'solid-js'
import { acquireLocalSaveNavigationLock } from './local-save-navigation-lock'

const reasons = new Map<symbol, Accessor<string>>()

/**
 * useLocalSaveNavigationLock for a surface that says why it holds. `reason`
 * is read when a navigation is blocked, so it can follow the surface's state.
 */
export function useLocalSaveNavigationLockWithReason(
  shouldLock: Accessor<boolean>,
  owner: string,
  reason: Accessor<string>,
): void {
  createEffect(() => {
    if (!shouldLock()) return
    const token = Symbol(owner)
    const release = acquireLocalSaveNavigationLock(owner)
    reasons.set(token, reason)
    onCleanup(() => {
      reasons.delete(token)
      release()
    })
  })
}

/** What the newest hold that says why says, or null while none does. */
export function localSaveNavigationReason(): string | null {
  let said: string | null = null
  for (const reason of reasons.values()) said = reason()
  return said
}
