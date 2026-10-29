// ============================================================
// Local-save navigation lock — keeps temporary work mounted until persistence settles
// ============================================================
//
// Voice captures live only in their mounted surface until an explicit Keep
// finishes. A feature can disable its own buttons, but app-wide tabs, hash
// routes, voice navigation, and browser unloads sit outside that feature. This
// small registry gives those navigation boundaries one neutral answer without
// making App import Exercise, Karaoke, or Challenge internals.
//
// A lock may also say why it holds, for a surface whose hold the app's own
// wording ("this take finishes saving") does not describe: Studio's project
// stays held after a save fails, until it is saved, copied or discarded, and
// waiting would never end that.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, onCleanup } from 'solid-js'

interface ActiveLock {
  owner: string
  message?: Accessor<string>
}

const activeLocks = new Map<symbol, ActiveLock>()
const [activeLockCount, setActiveLockCount] = createSignal(0)

/** Whether at least one mounted surface is persisting irreplaceable local work. */
export function isLocalSaveNavigationLocked(): boolean {
  return activeLockCount() > 0
}

/**
 * Hold app and document navigation until the caller releases the returned
 * lease. Releases are idempotent, and separate callers never unlock each
 * other even when they use the same diagnostic label. `message`, when given,
 * is what a blocked navigation is told about this hold.
 */
export function acquireLocalSaveNavigationLock(
  owner: string,
  message?: Accessor<string>,
): () => void {
  const token = Symbol(owner)
  activeLocks.set(token, { owner, message })
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
 * `message` is read when a navigation is blocked, so it can follow the state.
 */
export function useLocalSaveNavigationLock(
  shouldLock: Accessor<boolean>,
  owner: string,
  message?: Accessor<string>,
): void {
  createEffect(() => {
    if (!shouldLock()) return
    const release = acquireLocalSaveNavigationLock(owner, message)
    onCleanup(release)
  })
}

interface LocalSaveNavigationVetoOptions {
  /** Told what the newest hold that says anything says, or null when none does. */
  onBlocked: (message: string | null) => void
  onResolved: (accepted: boolean) => void
}

function blockedMessage(): string | null {
  let said: string | null = null
  for (const lock of activeLocks.values())
    if (lock.message !== undefined) said = lock.message()
  return said
}

/**
 * Resolve a navigation request as rejected while a local save is active.
 * Returns false when the caller should continue through its other guards.
 */
export function vetoNavigationDuringLocalSave(
  options: LocalSaveNavigationVetoOptions,
): boolean {
  if (!isLocalSaveNavigationLocked()) return false
  options.onBlocked(blockedMessage())
  options.onResolved(false)
  return true
}
