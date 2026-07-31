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

import { AD_CONVERSIONS } from '@/lib/consent'
import { createFunnel } from '@/lib/funnel'

export type FunnelEvent =
  | 'mirror_view'
  | 'howto_view'
  | 'howto_done'
  | 'mic_granted'
  | 'mic_denied'
  | 'task_intro_done'
  | 'task_glide_done'
  | 'task_hold_done'
  | 'task_match_done'
  | 'results_view'
  | 'card_generated'
  | 'card_shared'
  | 'cta_app_click'
  | 'free_sing_done'
  | 'cosmic_done'
  | 'twin_revealed'
  | 'cta_glass_click'

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
