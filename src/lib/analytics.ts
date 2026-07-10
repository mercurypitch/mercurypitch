// ============================================================
// App funnel instrumentation — product-usage counters.
//
// The app-side twin of src/features/mirror/funnel.ts: anonymous
// random clientId, events beaconed to the db-worker
// (POST /api/mirror/event → mirrorEvents table, shared with the
// Voice Mirror funnel), and everything degrades silently when no
// API is configured (pure-local dev, tour builds). Events carry
// no payload — counts only, no PII, no scores.
// ============================================================

import { API_BASE_URL } from '@/lib/defaults'

export type AppFunnelEvent =
  | 'app_open'
  | 'signup'
  | 'session_complete'
  | 'challenge_attempt'
  | 'pricing_view'
  | 'checkout_start'

const CLIENT_ID_KEY = 'mp.analytics.clientId.v1'
const APP_OPEN_SENT_KEY = 'mp.analytics.appOpenSent.v1'

/** Anonymous, stable-per-device id — random, never tied to an account. */
function clientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY)
    if (id === null || id === '') {
      id = globalThis.crypto.randomUUID()
      localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    return 'no-storage'
  }
}

/** app_open counts browser sessions, not renders/reloads. */
function alreadySentThisSession(): boolean {
  try {
    if (sessionStorage.getItem(APP_OPEN_SENT_KEY) === '1') return true
    sessionStorage.setItem(APP_OPEN_SENT_KEY, '1')
    return false
  } catch {
    return false
  }
}

function beacon(event: AppFunnelEvent): void {
  if (API_BASE_URL === undefined || API_BASE_URL === '') return
  const url = `${API_BASE_URL}/api/mirror/event`
  const payload = JSON.stringify({ clientId: clientId(), event })
  try {
    // NOT navigator.sendBeacon: it is always credentialed, and the worker
    // answers CORS with a wildcard origin — the browser then drops the
    // request after a passing preflight while sendBeacon still reports
    // success. keepalive fetch with credentials omitted survives page
    // unloads (checkout_start fires right before the Stripe redirect)
    // and is compatible with the wildcard.
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined)
  } catch {
    // Telemetry must never break the product.
  }
}

export function trackEvent(event: AppFunnelEvent): void {
  if (event === 'app_open' && alreadySentThisSession()) return
  console.info('[funnel]', event)
  beacon(event)
}
