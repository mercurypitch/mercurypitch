// ============================================================
// Voice Mirror — funnel instrumentation (spec §11).
//
// Product-usage telemetry, not audio analysis: counts how far
// visitors get (view → mic granted → tasks → results → shared)
// so completion/share rates can be measured. Events are beaconed
// to the db-worker (POST /api/mirror/event → mirrorEvents table)
// keyed by an anonymous random clientId — no account, no audio,
// and on results_view only the derived numbers. A local console +
// localStorage log is kept for debugging, and everything degrades
// silently when no API is configured (pure-local dev).
// ============================================================

import { API_BASE_URL } from '@/lib/defaults'

export type FunnelEvent =
  | 'mirror_view'
  | 'mic_granted'
  | 'mic_denied'
  | 'task_glide_done'
  | 'task_hold_done'
  | 'task_match_done'
  | 'results_view'
  | 'card_generated'
  | 'card_shared'
  | 'cta_app_click'

const STORAGE_KEY = 'mirror.funnel.v1'
const CLIENT_ID_KEY = 'mirror.clientId.v1'
const MAX_STORED_EVENTS = 200

interface StoredEvent {
  event: FunnelEvent
  at: number
}

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

function beacon(
  event: FunnelEvent,
  metrics?: Record<string, number | null>,
): void {
  if (API_BASE_URL === undefined || API_BASE_URL === '') return
  const url = `${API_BASE_URL}/api/mirror/event`
  const payload = JSON.stringify({ clientId: clientId(), event, metrics })
  try {
    // sendBeacon survives page unloads (card_shared / cta_app_click fire
    // right before navigation); fall back to keepalive fetch.
    if (
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(
        url,
        new Blob([payload], { type: 'application/json' }),
      )
    ) {
      return
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Telemetry must never break the product.
  }
}

export function trackFunnel(
  event: FunnelEvent,
  metrics?: Record<string, number | null>,
): void {
  const entry: StoredEvent = { event, at: Date.now() }
  console.info('[mirror-funnel]', entry.event)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const events: StoredEvent[] = raw !== null ? JSON.parse(raw) : []
    events.push(entry)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(events.slice(-MAX_STORED_EVENTS)),
    )
  } catch {
    // Telemetry must never break the product.
  }
  beacon(event, metrics)
}
