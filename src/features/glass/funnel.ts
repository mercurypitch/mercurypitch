// ============================================================
// Glass — funnel instrumentation.
//
// The glass-page twin of the mirror/karaoke funnels: anonymous
// random clientId (shared across funnels), events beaconed to the
// db-worker (POST /api/mirror/event → mirrorEvents table). Counts
// plus derived NUMBERS only (results metrics) — never audio, never
// PII. Degrades silently when no API is configured (pure-local
// dev, tour/e2e builds). The names come from
// src/lib/funnel-event-catalog.ts, which the worker's ingest allowlist is
// also built from, so the two cannot drift.
// ============================================================

import { AD_CONVERSIONS } from '@/lib/consent'
import { API_BASE_URL } from '@/lib/defaults'
import { funnelEventBody, trackFunnelTags } from '@/lib/funnel'
import type { GlassFunnelEventName } from '@/lib/funnel-event-catalog'

export type GlassFunnelEvent = GlassFunnelEventName

const VIEW_SENT_KEY = 'glass.funnel.viewSent.v1'

/** Milestones that are also Google Ads conversion actions.
 *  glass_results_view → glass_complete is the campaign goal (Campaign G);
 *  the conversion action exists in the Ads account (id 7688635413) but stays
 *  secondary/observed until G launches, so this fires safely while G is paused.
 *  card_shared / app_open reuse the live cross-funnel actions. */
const AD_CONVERSION_BY_EVENT = new Map<GlassFunnelEvent, string>([
  ['glass_results_view', AD_CONVERSIONS.glass_complete],
  ['glass_card_shared', AD_CONVERSIONS.card_shared],
  ['glass_cta_app_click', AD_CONVERSIONS.app_open],
])

/** glass_view counts browser sessions, not renders/reloads. */
function viewAlreadySentThisSession(): boolean {
  try {
    if (sessionStorage.getItem(VIEW_SENT_KEY) === '1') return true
    sessionStorage.setItem(VIEW_SENT_KEY, '1')
    return false
  } catch {
    return false
  }
}

function beacon(
  event: GlassFunnelEvent,
  metrics?: Record<string, number | null>,
): void {
  if (API_BASE_URL === undefined || API_BASE_URL === '') return
  const url = `${API_BASE_URL}/api/mirror/event`
  // One body shape for every transport — acquisition included. See
  // funnelEventBody for why it is not built here.
  const payload = funnelEventBody(event, metrics)
  try {
    // keepalive fetch with credentials omitted, NOT navigator.sendBeacon —
    // sendBeacon is always credentialed and the worker answers CORS with a
    // wildcard origin, which silently drops the request (see the mirror
    // funnel's history). keepalive survives the page unloads of
    // glass_cta_app_click / glass_card_shared.
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

export function trackGlass(
  event: GlassFunnelEvent,
  metrics?: Record<string, number | null>,
): void {
  if (event === 'glass_view' && viewAlreadySentThisSession()) return
  console.info('[glass-funnel]', event)
  beacon(event, metrics)
  // Consent Mode decides whether either tag sets cookies; a no-op unless
  // the build ships them.
  trackFunnelTags(event, AD_CONVERSION_BY_EVENT.get(event))
}
