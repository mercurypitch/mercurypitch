// ============================================================
// Voice Mirror — funnel instrumentation (spec §11).
//
// Product-usage telemetry, not audio analysis: counts how far
// visitors get (view → mic granted → tasks → results → shared) so
// completion/share rates can be measured. On results_view only the
// derived numbers ride along — never audio, never an account.
//
// The mechanism — anonymous client id, local ring buffer, keepalive
// beacon, Google Ads hand-off — lives in src/lib/funnel.ts and is
// shared with Karaoke Night, Glass and First Light. This file is only
// the vocabulary.
// ============================================================

import type { StoreId } from '@/components/shared/StoreChips'
import { AD_CONVERSIONS } from '@/lib/consent'
import { createFunnel } from '@/lib/funnel'
import type { MirrorFunnelEvent } from '@/lib/funnel-event-catalog'

export type FunnelEvent = MirrorFunnelEvent

export const trackFunnel = createFunnel<FunnelEvent>({
  storageKey: 'mirror.funnel.v1',
  label: 'mirror-funnel',
  // Milestones that are also Google Ads conversion actions (see the
  // campaigns repo `mercury/config/conversion-map.md`).
  adConversions: {
    results_view: AD_CONVERSIONS.mirror_complete,
    cta_app_click: AD_CONVERSIONS.app_open,
    card_shared: AD_CONVERSIONS.card_shared,
  },
  // The worker stores metrics for results_view only.
  metricEvents: ['results_view'],
})

/**
 * The store chips' click events, per result screen. Both screens mount the
 * same StoreChips; the name is the only place the screen survives, since the
 * worker keeps an event name and a client id and nothing else. None of these
 * is an Ads conversion: keep them out of `adConversions` above.
 */
export const STORE_CHIP_EVENTS = {
  results: {
    'app-store': 'results_app_store_click',
    'google-play': 'results_google_play_click',
  },
  freeSing: {
    'app-store': 'free_sing_app_store_click',
    'google-play': 'free_sing_google_play_click',
  },
} as const satisfies Record<string, Record<StoreId, FunnelEvent>>
