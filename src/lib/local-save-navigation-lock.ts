// ============================================================
// Local-save navigation lock — keeps temporary work mounted until persistence settles
// ============================================================
//
// Voice captures live only in their mounted surface until an explicit Keep
// finishes. A feature can disable its own buttons, but app-wide tabs, hash
// routes, voice navigation, and browser unloads sit outside that feature. This
// small registry gives those navigation boundaries one neutral answer without
// making App import Exercise, Karaoke, or Challenge internals.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, onCleanup } from 'solid-js'

const activeLocks = new Map<symbol, string>()
const [activeLockCount, setActiveLockCount] = createSignal(0)

/** Whether at least one mounted surface is persisting irreplaceable local work. */
export function isLocalSaveNavigationLocked(): boolean {
  return activeLockCount() > 0
}

/**
 * Hold app and document navigation until the caller releases the returned
 * lease. Releases are idempotent, and separate callers never unlock each
 * other even when they use the same diagnostic label.
 */
export function acquireLocalSaveNavigationLock(owner: string): () => void {
  const token = Symbol(owner)
  activeLocks.set(token, owner)
  setActiveLockCount(activeLocks.size)

  let released = false
  return () => {
    if (released) return
    released = true
    activeLocks.delete(token)
    setActiveLockCount(activeLocks.size)
  }
}

/**
 * Bind a navigation-lock lease to a reactive save state. Turning the accessor
 * false or disposing its Solid owner releases exactly this component's lease.
 */
export function useLocalSaveNavigationLock(
  shouldLock: Accessor<boolean>,
  owner: string,
): void {
  createEffect(() => {
    if (!shouldLock()) return
    const release = acquireLocalSaveNavigationLock(owner)
    onCleanup(release)
  })
}

interface LocalSaveNavigationVetoOptions {
  onBlocked: () => void
  onResolved: (accepted: boolean) => void
}

/**
 * Resolve a navigation request as rejected while a local save is active.
 * Returns false when the caller should continue through its other guards.
 */
export function vetoNavigationDuringLocalSave(
  options: LocalSaveNavigationVetoOptions,
): boolean {
  if (!isLocalSaveNavigationLocked()) return false
  options.onBlocked()
  options.onResolved(false)
  return true
}
