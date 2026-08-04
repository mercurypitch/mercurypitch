// ============================================================
// Routine mic hold — keep the device open between segments
// ============================================================
//
// A drill acquires the mic on Start and releases it on unmount, so a
// four-segment routine opens and closes the device four times. MicManager's
// 2-second linger covers a fast hand-off, but a singer who reads the next
// drill's description for ten seconds loses it and pays the reopen: another
// getUserMedia round-trip, another flicker of the recording indicator, and on
// some machines the better part of a second before the first sample arrives.
//
// This takes a SECOND reference under a `routine` id while a routine is
// running, so the drill's release stops closing the device. Two rules keep it
// from becoming a mic left on:
//
//   1. It never OPENS the device — `hold()` is a no-op unless the mic is
//      already live. The hold can only prevent a close, never cause a start,
//      so nothing here can surprise a singer with a recording indicator.
//   2. It expires on its own. The hold exists to bridge seconds between
//      segments, so an un-refreshed one lets go after HOLD_MS whatever else
//      happens — a forgotten release heals itself.
//
// It composes with the hidden-tab release in mic-manager rather than fighting
// it: that path calls forceReleaseAll(), which clears every consumer including
// this one. Backgrounding the tab still closes the mic mid-routine, which is
// the behaviour that was chosen; this only removes the gap-between-segments
// churn while the singer is actually there.

import { BACKGROUND_HOLD_IDS, micManager } from '@/lib/mic-manager'

/** Declared in mic-manager so the sentinel knows this hold has no UI. */
const CONSUMER_ID = BACKGROUND_HOLD_IDS[0]!

/**
 * How long a hold survives without being refreshed. Generous enough to cover
 * reading the next drill's description and finding Start; short enough that a
 * hold nobody released is gone long before it matters.
 */
export const HOLD_MS = 90_000

let held = false
let expiryTimer: ReturnType<typeof setTimeout> | null = null

function clearExpiry(): void {
  if (expiryTimer === null) return
  clearTimeout(expiryTimer)
  expiryTimer = null
}

/**
 * Hold the mic open for the routine, and refresh the expiry. Call it whenever
 * a routine segment's run goes active — the refresh is what makes a long
 * routine keep the device rather than losing it to the timeout mid-session.
 */
export function holdMicForRoutine(): void {
  // Rule 1: no device open, no hold. Acquiring here would start a capture the
  // singer never asked for.
  if (!micManager.isActive()) return

  clearExpiry()
  expiryTimer = setTimeout(releaseRoutineMicHold, HOLD_MS)

  if (held) return
  held = true
  // The device is already open, so this resolves off the existing stream and
  // cannot prompt. It can still reject (an OS revoke racing us), and a failed
  // hold is simply the old behaviour — never something to surface.
  void micManager.acquire(CONSUMER_ID).catch(() => {
    held = false
  })
}

/** Drop the hold. Safe to call when there is none. */
export function releaseRoutineMicHold(): void {
  clearExpiry()
  if (!held) return
  held = false
  micManager.release(CONSUMER_ID)
}

/** Exposed for tests and for the mic sentinel's dump. */
export function isRoutineMicHeld(): boolean {
  return held
}

// A forced release (another tab took the mic, or this one went to the
// background) clears every consumer without telling them. Watching the device
// keeps our flag honest, so the next segment takes a fresh hold instead of
// believing in one that no longer exists.
micManager.subscribe((state) => {
  if (!state.active && held) {
    held = false
    clearExpiry()
  }
})
