// ============================================================
// Voice Mirror — funnel instrumentation (spec §11).
//
// Product-usage telemetry, not audio analysis: counts how far
// visitors get (view → mic granted → tasks → results → shared)
// so completion/share rates can be measured. From-scratch and
// local-only for the demo: events go to the console and a small
// localStorage ring buffer. Swapping `emit` for a beacon to a
// worker endpoint later changes nothing at the call sites.
// ============================================================

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
const MAX_STORED_EVENTS = 200

interface StoredEvent {
  event: FunnelEvent
  at: number
}

export function trackFunnel(event: FunnelEvent): void {
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
}
