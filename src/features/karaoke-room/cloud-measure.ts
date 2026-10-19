// ============================================================
// The Cloud offer and the import gate, counted (S7b §7)
// ============================================================
//
// Through the app's own funnel (src/lib/analytics.ts trackEvent): the
// phone's anonymous id and a name, nothing else. The ingest keeps no
// properties, so where the offer opened from, what the store answered and
// the gate the singer was in are each in the name.

import type { AppFunnelEvent } from '@/lib/analytics'
import type { KaraokeSubscribeOutcome } from '@/stores/native-shell-store'
import type { CloudOfferSource } from './cloud-offer-store'
import type { ImportState } from './import-gate'

/** The offer shown, by where it opened. */
export const CLOUD_VIEW_EVENT: Readonly<
  Record<CloudOfferSource, AppFunnelEvent>
> = {
  import: 'cloud_view_import',
  settings: 'cloud_view_settings',
  onboarding: 'cloud_view_onboarding',
}

/** What the store answered a Subscribe. */
export const PURCHASE_EVENT: Readonly<
  Record<KaraokeSubscribeOutcome, AppFunnelEvent>
> = {
  purchased: 'cloud_purchase_success',
  moved: 'cloud_purchase_moved',
  'held-elsewhere': 'cloud_purchase_held_elsewhere',
  pending: 'cloud_purchase_pending',
  cancelled: 'cloud_purchase_cancelled',
  unavailable: 'cloud_purchase_unavailable',
  failed: 'cloud_purchase_failed',
}

/** Import a song tapped, by the gate the singer was in. */
export const IMPORT_TAP_EVENT: Readonly<Record<ImportState, AppFunnelEvent>> = {
  'songs-left': 'import_tap_songs_left',
  'free-song': 'import_tap_free_song',
  'none-left': 'import_tap_none_left',
  'free-used': 'import_tap_free_used',
  'no-account': 'import_tap_no_account',
  unknown: 'import_tap_unknown',
}
