// ============================================================
// Auto-continue — taking the next segment instead of offering it
// ============================================================
//
// The ribbon offered "Next: Scale Runner"; it did not take it. A routine is a
// sequence, and making the singer click four times to run four things is the
// friction that ends sessions early.
//
// So it now counts down and goes. The countdown is short enough not to be a
// wait and long enough to be stopped, and the two guards below are what keep
// it from being the kind of auto-advance people hate:
//
//   - It is always cancellable, and cancelling is a plain button, not a race.
//   - Cancelling twice in a session offers to turn it off for good. Someone
//     who wants to re-run a drill they scored badly on is telling us something
//     the second time; asking a third time is not listening.

import { createSignal } from 'solid-js'
import { routinePrefs } from './use-daily-routine'

/** Long enough to stop, short enough not to feel like waiting. */
export const AUTO_CONTINUE_SECONDS = 5

/** Cancels in one session before we offer to stop asking. */
export const DISMISSALS_BEFORE_OFFER = 2

const [dismissals, setDismissals] = createSignal(0)

/**
 * Whether to run the countdown at all.
 *
 * Prefs saved before this setting existed have no `autoContinue` key, and an
 * absent preference is not a decision to opt out — only an explicit `false`
 * is.
 */
export function autoContinueEnabled(): boolean {
  return routinePrefs().autoContinue !== false
}

/** Record a cancel. Session-scoped: a new visit starts the count over. */
export function noteAutoContinueDismissed(): void {
  setDismissals((n) => n + 1)
}

/** True once the singer has stopped the countdown often enough to mean it. */
export function shouldOfferToDisable(): boolean {
  return autoContinueEnabled() && dismissals() >= DISMISSALS_BEFORE_OFFER
}

/** Test seam — the counter is deliberately module state, not persisted. */
export function resetAutoContinueDismissals(): void {
  setDismissals(0)
}
