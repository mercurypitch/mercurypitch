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

import { forgetFunnelAcquisition, funnelIdMonths, getFunnelAcquisition, } from '@/lib/acquisition'
import { trackAdConversion, trackGa4Event } from '@/lib/consent'
import { API_BASE_URL } from '@/lib/defaults'
import { monthsBefore, storedDate } from '@/lib/retention-periods'

/**
 * One anonymous id per DEVICE, deliberately shared by every funnel.
 * Someone who lands on /mirror, then tries Glass, then opens the app is
 * one person; splitting them across per-feature ids would make the
 * combined funnel unreadable.
 */
const CLIENT_ID_KEY = 'mirror.clientId.v1'
const LEGACY_APP_CLIENT_ID_KEY = 'mp.analytics.clientId.v1'
/**
 * When the id was issued, epoch ms. A key of its own rather than a field in
 * the id's value, so a bundle from before the date existed (an open tab, a
 * cached service worker) still reads the id as the plain string it expects.
 */
const CLIENT_ID_ISSUED_KEY = 'mirror.clientId.issuedAt.v1'

/**
 * The issue date of an id stored before ids were dated: the UTC day of the
 * first commit that wrote either id key (5a9158dc7, 1 Jul 2026, for
 * mirror.clientId.v1; the legacy app key followed on 10 Jul), found with
 * `git log -S`. No stored id can be older, and all of them are renewed 13
 * months after it, not 13 months after the deploy that started dating them.
 */
export const LEGACY_CLIENT_ID_ISSUED_AT = Date.UTC(2026, 6, 1)

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

/** Best-effort: an id whose date cannot be saved still works, and reads as
 *  the legacy day next time, so its clock never restarts. */
function saveIssuedAt(ms: number): void {
  try {
    localStorage.setItem(CLIENT_ID_ISSUED_KEY, String(ms))
  } catch {
    // Telemetry must never break the product.
  }
}

/**
 * Return the anonymous id shared by every product funnel.
 *
 * `mp.analytics.clientId.v1` predates the shared funnel transport. Adopt it
 * when it is the only id on an existing app-only device; otherwise the shared
 * id wins and is mirrored back to the legacy key so an older cached bundle
 * cannot split the same browser into a second visitor.
 *
 * The id is renewed 13 months after it was issued (privacy plan 4.2,
 * VITE_RETENTION_FUNNEL_ID_MONTHS), and visits do not extend it. The server
 * deletes funnel rows on the same clock; an id kept longer would bring a
 * deleted row back with its next event. An id stored before the date
 * existed is dated LEGACY_CLIENT_ID_ISSUED_AT: not now, which would give it
 * a fresh 13 months, and not "expired", which would make every returning
 * visitor a new one at deploy.
 */
export function getFunnelClientId(): string {
  try {
    const nowMs = Date.now()
    let id = localStorage.getItem(CLIENT_ID_KEY)
    const storedIssuedAt = localStorage.getItem(CLIENT_ID_ISSUED_KEY)
    let minted = false
    if (id === null || id === '') {
      id = localStorage.getItem(LEGACY_APP_CLIENT_ID_KEY)
      if (id === null || id === '') {
        id = globalThis.crypto.randomUUID()
        minted = true
      }
      localStorage.setItem(CLIENT_ID_KEY, id)
    }
    // A date left over from an id that is gone belongs to that id, not to a
    // new one. A missing, unreadable or far-future date is the legacy day.
    const issuedAt = minted
      ? nowMs
      : storedDate(storedIssuedAt, nowMs, LEGACY_CLIENT_ID_ISSUED_AT)
    if (String(issuedAt) !== storedIssuedAt) saveIssuedAt(issuedAt)
    if (issuedAt <= monthsBefore(nowMs, funnelIdMonths())) {
      id = globalThis.crypto.randomUUID()
      localStorage.setItem(CLIENT_ID_KEY, id)
      saveIssuedAt(nowMs)
      forgetFunnelAcquisition()
    }
    if (localStorage.getItem(LEGACY_APP_CLIENT_ID_KEY) !== id) {
      localStorage.setItem(LEGACY_APP_CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    return 'no-storage'
  }
}

/**
 * The wire body for one funnel event — THE body, for every transport.
 *
 * The karaoke, glass and app funnels still carry their own beacon (their
 * dedup rules differ), and the first version of acquisition capture was
 * added only to this file's transport. Nobody noticed until review that
 * /karaoke-night — the page Campaign E pays for — therefore never
 * recorded a source. A body built in four places is four places to
 * forget; every transport now calls this instead.
 *
 * Acquisition rides along on every event rather than once, deliberately:
 * a "send it with the first event" flag drifts the moment an event is
 * dropped in flight, and the first event is exactly the one most likely
 * to race a page unload. The worker keeps only the first row per client,
 * so repetition is free.
 */
export function funnelEventBody(
  event: string,
  metrics?: FunnelMetrics,
): string {
  const clientId = getFunnelClientId()
  return JSON.stringify({
    clientId,
    event,
    metrics,
    acq: getFunnelAcquisition(clientId),
  })
}

/**
 * The Google side of one funnel event — THE place both tags are fired.
 *
 * Four transports exist (this file's, karaoke's, glass's and the app's)
 * because their dedup rules differ, and the acquisition bug taught us
 * what happens when a cross-cutting concern is added to one of them:
 * the page Campaign E pays for silently missed it. Ads conversions and
 * the GA4 mirror travel together here so the next transport cannot get
 * one without the other.
 *
 * `sendTo` is undefined for the many events that are not Ads
 * conversions; the GA4 mirror fires for all of them either way.
 */
export function trackFunnelTags(event: string, sendTo?: string): void {
  if (sendTo !== undefined) trackAdConversion(sendTo)
  trackGa4Event(event)
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
      body: funnelEventBody(event, metrics),
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

    trackFunnelTags(event, options.adConversions?.[event])
  }
}
