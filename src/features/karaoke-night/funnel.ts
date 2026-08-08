// ============================================================
// Karaoke Night — funnel instrumentation.
//
// The night-page twin of src/features/mirror/funnel.ts: anonymous
// random clientId (shared with the mirror funnel's transport),
// events beaconed to the db-worker (POST /api/mirror/event →
// mirrorEvents table), counts only — no payload, no PII. Degrades
// silently when no API is configured (pure-local dev, tour/e2e
// builds). karaoke_demo_complete additionally fires the Google
// Ads conversion (Campaign E's future bid target).
// ============================================================

import { AD_CONVERSIONS, trackAdConversion } from '@/lib/consent'
import { API_BASE_URL } from '@/lib/defaults'
import { funnelEventBody } from '@/lib/funnel'
import type { KaraokeFunnelEventName } from '@/lib/funnel-event-catalog'

export type KaraokeFunnelEvent = KaraokeFunnelEventName

const VIEW_SENT_KEY = 'kn.funnel.viewSent.v1'
const ONCE_SENT_PREFIX = 'kn.funnel.once.'
const SESSION_ONCE_SENT_PREFIX = 'kn.funnel.sessionOnce.'
const deviceOnceMemory = new Set<KaraokeFunnelEvent>()
const sessionOnceMemory = new Set<KaraokeFunnelEvent>()

/** Milestones that are also Google Ads conversion actions. */
const AD_CONVERSION_BY_EVENT = new Map<KaraokeFunnelEvent, string>([
  ['karaoke_demo_complete', AD_CONVERSIONS.karaoke_demo_complete],
  // Campaign E's better-matched goal: the visitor brought their OWN song to the
  // stage (vocal-remover intent → upload → sing), which this traffic does far
  // more than the demo. See mercury/config/conversion-map.md.
  //
  // `karaoke_example_staged` is deliberately absent. Tapping a seeded example
  // is worth counting first-party, but bidding on it would teach the campaign
  // to buy visitors who never bring a song — the exact behaviour the campaign
  // exists to find.
  ['karaoke_song_staged', AD_CONVERSIONS.karaoke_song_staged],
])

const AD_SENT_PREFIX = 'kn.funnel.adSent.'

/** karaoke_view counts browser sessions, not renders/reloads. */
function viewAlreadySentThisSession(): boolean {
  try {
    if (sessionStorage.getItem(VIEW_SENT_KEY) === '1') return true
    sessionStorage.setItem(VIEW_SENT_KEY, '1')
    return false
  } catch {
    return false
  }
}

function beacon(event: KaraokeFunnelEvent): void {
  if (API_BASE_URL === undefined || API_BASE_URL === '') return
  const url = `${API_BASE_URL}/api/mirror/event`
  // One body shape for every transport — acquisition included. See
  // funnelEventBody for why it is not built here.
  const payload = funnelEventBody(event)
  try {
    // keepalive fetch with credentials omitted, NOT navigator.sendBeacon —
    // sendBeacon is always credentialed and the worker answers CORS with a
    // wildcard origin, which silently drops the request (see the mirror
    // funnel's history). keepalive survives the page unloads of
    // karaoke_cta_studio.
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

export function trackKaraoke(event: KaraokeFunnelEvent): void {
  if (event === 'karaoke_view' && viewAlreadySentThisSession()) return
  console.info('[kn-funnel]', event)
  beacon(event)
  // Consent Mode decides whether the Ads conversion sets cookies; a no-op
  // unless the build ships an ad tag.
  const sendTo = AD_CONVERSION_BY_EVENT.get(event)
  if (sendTo !== undefined) fireAdConversionOncePerDevice(event, sendTo)
}

/**
 * Fire an event's Ads conversion at most once per device. Events like
 * karaoke_song_staged beacon on every occurrence (a rich first-party staging
 * count), but the Ads conversion should count one per visitor. Ads' own
 * ONE_PER_CLICK counting already dedups per ad click; this also avoids
 * redundant pings within a session. Demo-complete reaches here via
 * {@link trackKaraokeOnce}, so it is already one-shot — this guard is a
 * harmless second layer for it.
 */
function fireAdConversionOncePerDevice(
  event: KaraokeFunnelEvent,
  sendTo: string,
): void {
  try {
    const key = AD_SENT_PREFIX + event
    if (localStorage.getItem(key) === '1') return
    localStorage.setItem(key, '1')
  } catch {
    // No storage — fire anyway (Ads ONE_PER_CLICK still dedups per click).
  }
  trackAdConversion(sendTo)
}

/** Fire an event at most once per device (e.g. the demo-complete conversion —
 *  repeat plays shouldn't stack conversions from one visitor). */
export function trackKaraokeOnce(event: KaraokeFunnelEvent): void {
  if (deviceOnceMemory.has(event)) return
  try {
    const key = ONCE_SENT_PREFIX + event
    if (localStorage.getItem(key) === '1') return
    localStorage.setItem(key, '1')
  } catch {
    // no storage — fall through and send (better a rare double than none)
  }
  deviceOnceMemory.add(event)
  trackKaraoke(event)
}

/**
 * Fire an activation milestone once per browser session. The denominator is
 * `karaoke_view`, which is also session-scoped: using a lifetime guard here
 * would make returning sessions look like views that never activate.
 */
export function trackKaraokeSessionOnce(event: KaraokeFunnelEvent): void {
  if (sessionOnceMemory.has(event)) return
  try {
    const key = SESSION_ONCE_SENT_PREFIX + event
    if (sessionStorage.getItem(key) === '1') return
    sessionStorage.setItem(key, '1')
  } catch {
    // In-memory fallback still prevents repeated RAF/render emissions during
    // this page lifetime when sessionStorage is unavailable.
  }
  sessionOnceMemory.add(event)
  trackKaraoke(event)
}
