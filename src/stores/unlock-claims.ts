// ============================================================
// Unlock claims: a room that shows its own badges, and the tap you feel
// ============================================================
//
// The notifications store's half of routing an unlock (its header explains
// the whole route). A premium room claims every unlock announced while it
// is on screen and shows them in the chip under its result
// (room-kit/room-unlocks.ts); `showNotification` asks `currentClaim()`
// before it raises anything. Re-exported from notifications-store.ts, which
// is where callers find it.

import type { UnlockItem } from '@/lib/unlock-copy'

/** An unlock, as it was announced, handed to the room that claimed it. */
export interface ClaimedUnlock {
  readonly message: string
  /** The notice's type, as `Notification['type']` (no import: a cycle). */
  readonly type: 'info' | 'success' | 'warning' | 'error'
  readonly unlock: UnlockItem
}

type Receiver = (claimed: ClaimedUnlock) => void

const claims: Receiver[] = []

/**
 * Take every unlock announced from now on, until the returned release is
 * called. The latest claim wins; releasing it hands unlocks back to the one
 * before, or to the notices.
 *
 * A grant pass that is still in flight when its room is left lands after
 * the release, and so raises a notice like any other: nothing is lost by
 * leaving early.
 */
export function claimUnlocks(receive: Receiver): () => void {
  claims.push(receive)
  return () => {
    const at = claims.lastIndexOf(receive)
    if (at >= 0) claims.splice(at, 1)
  }
}

/** The claim an unlock announced now goes to, if any. */
export function currentClaim(): Receiver | undefined {
  return claims.at(-1)
}

// ── Unlocks on screen: a tap you can feel ─────────────────────

const unlockListeners = new Set<() => void>()

/**
 * Call `listener` whenever an unlock reaches the screen, in a pill or in a
 * room's chip. The native shell answers with a light haptic; `src/` cannot
 * reach the device's haptics itself (native-shell-store.ts explains why).
 */
export function onUnlockShown(listener: () => void): () => void {
  unlockListeners.add(listener)
  return () => {
    unlockListeners.delete(listener)
  }
}

/** Something just put an unlock on screen. */
export function unlockShown(): void {
  for (const listener of unlockListeners) listener()
}

/** Forget every claim and listener. For tests, through resetNotifications. */
export function resetUnlockClaims(): void {
  claims.length = 0
  unlockListeners.clear()
}
