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

export type KaraokeFunnelEvent =
  | 'karaoke_view'
  | 'karaoke_demo_start'
  | 'karaoke_demo_complete'
  | 'karaoke_upload_start'
  | 'karaoke_upload_done'
  | 'karaoke_upload_error'
  | 'karaoke_song_staged'
  | 'karaoke_playlist_deeplink'
  | 'karaoke_cta_studio'

const CLIENT_ID_KEY = 'mirror.clientId.v1' // one anonymous id per device, shared across funnels
const VIEW_SENT_KEY = 'kn.funnel.viewSent.v1'
const ONCE_SENT_PREFIX = 'kn.funnel.once.'

/** Milestones that are also Google Ads conversion actions. */
const AD_CONVERSION_BY_EVENT = new Map<KaraokeFunnelEvent, string>([
  ['karaoke_demo_complete', AD_CONVERSIONS.karaoke_demo_complete],
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
  const payload = JSON.stringify({ clientId: clientId(), event })
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
  if (sendTo !== undefined) trackAdConversion(sendTo)
}

/** Fire an event at most once per device (e.g. the demo-complete conversion —
 *  repeat plays shouldn't stack conversions from one visitor). */
export function trackKaraokeOnce(event: KaraokeFunnelEvent): void {
  try {
    const key = ONCE_SENT_PREFIX + event
    if (localStorage.getItem(key) === '1') return
    localStorage.setItem(key, '1')
  } catch {
    // no storage — fall through and send (better a rare double than none)
  }
  trackKaraoke(event)
}
