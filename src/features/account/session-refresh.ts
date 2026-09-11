// ============================================================
// Keeping a phone signed in across the weeks it sits unopened
// ============================================================
//
// The session JWT lasts thirty days and, until `POST /api/auth/refresh`
// existed, had no renewal path: it simply expired, and the singer met a
// sign-in screen with no anonymous fallback. On a phone, with no passkey and
// possibly no password, that is a churn event on exactly the people a native
// app exists to retain. So every return to the foreground is a chance to
// trade a still-live session for a fresh thirty days.
//
// Seven days, not thirty minus a bit. Refreshing on every foreground would
// spend a round trip on every app switch for no benefit, and refreshing only
// near the end would miss the device that is opened once a fortnight — which
// is the device this is for.
//
// `visibilitychange` rather than a Capacitor app-state listener, deliberately
// and for now: `packages/mobile-runtime` exposes no app-state port on `main`,
// and a WebView fires `visibilitychange` on background and foreground on both
// platforms. When the platform sibling lands its `appState` event, this is the
// ONE place that changes — which is why the listener is here and not inline in
// the entry point.

import { refreshSession, tokenIssuedAt } from '@/db/services/auth-service'

/** How old a token has to be before a foreground is worth a round trip. */
export const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000

/** True when the held session is old enough to be worth reissuing. */
export function sessionNeedsRefresh(now = Date.now()): boolean {
  const issued = tokenIssuedAt()
  if (issued === null) return false
  return now - issued >= REFRESH_AFTER_MS
}

/**
 * Refresh on every foreground where the session has aged past the threshold.
 *
 * Returns the teardown. Never throws and never rejects: `refreshSession`
 * answers null rather than throwing, and a visibility handler has nowhere to
 * report a rejection to anyway.
 */
export function installForegroundSessionRefresh(): () => void {
  if (typeof document === 'undefined') return () => {}

  let inFlight = false
  const maybeRefresh = (): void => {
    if (inFlight) return
    if (document.visibilityState !== 'visible') return
    if (!sessionNeedsRefresh()) return
    inFlight = true
    void refreshSession().finally(() => {
      inFlight = false
    })
  }

  document.addEventListener('visibilitychange', maybeRefresh)
  // A cold start IS a foreground arrival, and it is the one that follows the
  // longest gap — the app that has not been opened in three weeks never fires
  // a visibility change at all before its token runs out.
  maybeRefresh()

  return () => {
    document.removeEventListener('visibilitychange', maybeRefresh)
  }
}
