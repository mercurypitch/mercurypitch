// ============================================================
// Product funnels — one implementation, several event vocabularies
// ============================================================
//
// The Voice Mirror, Karaoke Night, Glass and First Light each count
// how far a visitor gets. They had grown four near-identical copies of
// the same ~110 lines: the anonymous client id, the localStorage ring
// buffer, the keepalive beacon, the Google Ads hand-off. Only the
// event names, the storage key and the ad-conversion map ever differed.
//
// Four copies of a beacon is four places to fix the next time we learn
// something about it — and we have already learned two things the hard
// way, both recorded below. This is now the single place that knows
// them.
//
// Anonymous by construction: a random client id, no account, no audio.
// Everything degrades silently when no API is configured (pure-local
// dev), because telemetry must never break the product.

import { getFunnelAcquisition } from '@/lib/acquisition'
import { trackAdConversion } from '@/lib/consent'
import { API_BASE_URL } from '@/lib/defaults'

/**
 * One anonymous id per DEVICE, deliberately shared by every funnel.
 * Someone who lands on /mirror, then tries Glass, then opens the app is
 * one person; splitting them across per-feature ids would make the
 * combined funnel unreadable.
 */
const CLIENT_ID_KEY = 'mirror.clientId.v1'
const LEGACY_APP_CLIENT_ID_KEY = 'mp.analytics.clientId.v1'

/**
 * The shared anonymous event sink. Named for the Voice Mirror because
 * that is where it started; it now serves every funnel, and the
 * worker's FUNNEL_EVENTS allowlist is the union of their vocabularies.
 */
const ENDPOINT = '/api/mirror/event'

const MAX_STORED_EVENTS = 200

interface StoredEvent {
  event: string
  at: number
}

export interface FunnelOptions<E extends string> {
  /** localStorage key for the local debug ring buffer. */
  storageKey: string
  /** Console tag, e.g. `mirror-funnel`. */
  label: string
  /**
   * Milestone events that are also Google Ads conversion actions.
   * Consent Mode decides whether anything is actually set; a no-op
   * unless the build ships an ad tag.
   */
  adConversions?: Partial<Record<E, string>>
  /**
   * Events permitted to carry a metrics payload. The worker only
   * stores metrics for specific events and drops the rest, so sending
   * them elsewhere is wasted bytes.
   */
  metricEvents?: readonly E[]
}

export type FunnelMetrics = Record<string, number | null>

export type TrackFn<E extends string> = (
  event: E,
  metrics?: FunnelMetrics,
) => void

/**
 * Return the anonymous id shared by every product funnel.
 *
 * `mp.analytics.clientId.v1` predates the shared funnel transport. Adopt it
 * when it is the only id on an existing app-only device; otherwise the shared
 * id wins and is mirrored back to the legacy key so an older cached bundle
 * cannot split the same browser into a second visitor.
 */
export function getFunnelClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY)
    if (id === null || id === '') {
      id = localStorage.getItem(LEGACY_APP_CLIENT_ID_KEY)
      if (id === null || id === '') id = globalThis.crypto.randomUUID()
      localStorage.setItem(CLIENT_ID_KEY, id)
    }
    if (localStorage.getItem(LEGACY_APP_CLIENT_ID_KEY) !== id) {
      localStorage.setItem(LEGACY_APP_CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    return 'no-storage'
  }
}

function beacon(event: string, metrics?: FunnelMetrics): void {
  if (API_BASE_URL === undefined || API_BASE_URL === '') return
  try {
    // NOT navigator.sendBeacon: it is always credentialed, and the
    // worker answers CORS with a wildcard origin — the browser then
    // drops the request after a passing preflight while sendBeacon
    // still reports success, which silently lost every cross-origin
    // event. keepalive fetch with credentials omitted survives page
    // unloads (share / cta events fire right before navigation) and is
    // compatible with the wildcard.
    void fetch(`${API_BASE_URL}${ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: getFunnelClientId(),
        event,
        metrics,
        // Rides along on every event rather than once, deliberately: a
        // "send it with the first event" flag drifts the moment an
        // event is dropped in flight, and the first event is exactly
        // the one most likely to race a page unload. The worker keeps
        // only the first row per client, so repetition is free.
        acq: getFunnelAcquisition(),
      }),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined)
  } catch {
    // Telemetry must never break the product.
  }
}

/**
 * Build a funnel tracker over one feature's event vocabulary. The
 * event type parameter is what keeps each feature's names distinct at
 * the call site while they share this implementation.
 */
export function createFunnel<E extends string>(
  options: FunnelOptions<E>,
): TrackFn<E> {
  const metricEvents = new Set<string>(options.metricEvents ?? [])

  return function track(event: E, metrics?: FunnelMetrics): void {
    const entry: StoredEvent = { event, at: Date.now() }
    console.info(`[${options.label}]`, entry.event)

    try {
      const raw = localStorage.getItem(options.storageKey)
      const events: StoredEvent[] = raw !== null ? JSON.parse(raw) : []
      events.push(entry)
      localStorage.setItem(
        options.storageKey,
        JSON.stringify(events.slice(-MAX_STORED_EVENTS)),
      )
    } catch {
      // Telemetry must never break the product.
    }

    beacon(event, metricEvents.has(event) ? metrics : undefined)

    const sendTo = options.adConversions?.[event]
    if (sendTo !== undefined) trackAdConversion(sendTo)
  }
}
