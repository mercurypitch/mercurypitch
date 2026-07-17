// ============================================================
// Glass — funnel instrumentation.
//
// The glass-page twin of the mirror/karaoke funnels: anonymous
// random clientId (shared across funnels), events beaconed to the
// db-worker (POST /api/mirror/event → mirrorEvents table). Counts
// plus derived NUMBERS only (results metrics) — never audio, never
// PII. Degrades silently when no API is configured (pure-local
// dev, tour/e2e builds). Keep the event list in sync with the
// db-worker FUNNEL_EVENTS allowlist.
// ============================================================

import { AD_CONVERSIONS, trackAdConversion } from '@/lib/consent'
import { API_BASE_URL } from '@/lib/defaults'

export type GlassFunnelEvent =
  | 'glass_view'
  | 'glass_mic_granted'
  | 'glass_mic_denied'
  | 'glass_calibrate_done'
  | 'glass_rep_done'
  | 'glass_playback_done'
  | 'glass_shatter'
  | 'glass_results_view'
  | 'glass_fx_change'
  | 'glass_monitor_on'
  | 'glass_monitor_off'
  | 'glass_card_generated'
  | 'glass_card_shared'
  | 'glass_cta_app_click'

const CLIENT_ID_KEY = 'mirror.clientId.v1' // one anonymous id per device, shared across funnels
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
  const payload = JSON.stringify({ clientId: clientId(), event, metrics })
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
  // Consent Mode decides whether the Ads conversion sets cookies; a no-op
  // unless the build ships an ad tag.
  const sendTo = AD_CONVERSION_BY_EVENT.get(event)
  if (sendTo !== undefined) trackAdConversion(sendTo)
}
