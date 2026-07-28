// ============================================================
// First Light — funnel instrumentation
// ============================================================
//
// Counts how far a new visitor gets through onboarding: which beats
// they reached, which track they chose, whether the mic was granted,
// which room they left through, and whether they made an account.
// Without this we cannot tell whether the flow works.
//
// Shares the db-worker's anonymous event sink with the Voice Mirror,
// Karaoke Night and Glass funnels (POST /api/onboarding-shaped events
// to /api/mirror/event → mirrorEvents). Event names must stay in sync
// with FUNNEL_EVENTS in workers/db-worker/src/index.ts. Keyed by a
// random clientId — no account, no audio, no metrics payload.
//
// Everything degrades silently when no API is configured (pure-local
// dev), and telemetry must never break the product.

import { API_BASE_URL } from '@/lib/defaults'

export type OnboardingEvent =
  // One per beat entered.
  | 'onboarding_sky'
  | 'onboarding_first_light'
  | 'onboarding_fork'
  | 'onboarding_voiceprint'
  | 'onboarding_twin'
  | 'onboarding_map'
  | 'onboarding_keep'
  // Choices and outcomes.
  | 'onboarding_track_short'
  | 'onboarding_track_full'
  | 'onboarding_mic_granted'
  | 'onboarding_mic_denied'
  | 'onboarding_map_room'
  | 'onboarding_skipped'
  | 'onboarding_done'
  | 'onboarding_account_created'
  | 'onboarding_account_dismissed'

const STORAGE_KEY = 'onboarding.funnel.v1'
const CLIENT_ID_KEY = 'mirror.clientId.v1'
const MAX_STORED_EVENTS = 200

interface StoredEvent {
  event: OnboardingEvent
  at: number
}

/**
 * Anonymous, stable-per-device id. Deliberately the SAME key the Voice
 * Mirror uses: a visitor who lands on /mirror first and then opens the
 * app is one person, and splitting them across two ids would make the
 * combined funnel unreadable.
 */
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

function beacon(event: OnboardingEvent): void {
  if (API_BASE_URL === undefined || API_BASE_URL === '') return
  try {
    // keepalive fetch, credentials omitted — not navigator.sendBeacon,
    // which is always credentialed and is silently dropped against the
    // worker's wildcard CORS origin. Same lesson as the Mirror funnel.
    void fetch(`${API_BASE_URL}/api/mirror/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: clientId(), event }),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined)
  } catch {
    // Telemetry must never break the product.
  }
}

export function trackOnboarding(event: OnboardingEvent): void {
  const entry: StoredEvent = { event, at: Date.now() }
  console.info('[onboarding-funnel]', entry.event)
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
  beacon(event)
}

/** The per-beat event for a beat id. */
export const BEAT_EVENT: Record<string, OnboardingEvent> = {
  sky: 'onboarding_sky',
  'first-light': 'onboarding_first_light',
  fork: 'onboarding_fork',
  voiceprint: 'onboarding_voiceprint',
  twin: 'onboarding_twin',
  map: 'onboarding_map',
  keep: 'onboarding_keep',
}
