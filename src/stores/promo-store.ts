// ============================================================
// promo-store — the promo code the app offers with one click
// ============================================================
//
// The server decides which code is featured and whether it is open
// (GET /api/billing/promo/featured); the header pill and the claim card in
// Settings → Credits both read this one answer, asked once per page load.
// Nothing about the offer is built into the app any more, so a new code, a
// moved end date or a switched-off code needs no release.
//
// A tab left open past the offer's end stops showing it at the next read,
// without asking the server again.

import { createSignal } from 'solid-js'
import type { FeaturedPromo } from '@/db/services/billing-service'
import { fetchFeaturedPromo } from '@/db/services/billing-service'

const [featured, setFeatured] = createSignal<FeaturedPromo | null>(null)
let request: Promise<void> | null = null

/** Ask the server for the featured promo. Later calls share the first
 *  answer. Never rejects: `fetchFeaturedPromo` answers null on failure. */
export function loadFeaturedPromo(): Promise<void> {
  request ??= fetchFeaturedPromo().then((promo) => {
    setFeatured(promo)
  })
  return request
}

/** The promo on offer, or null when there is none or it has ended since
 *  the page loaded. Reactive: reads the store's signal. */
export function offeredPromo(now: number = Date.now()): FeaturedPromo | null {
  const promo = featured()
  if (promo === null) return null
  if (promo.expiresAt !== null && now > Date.parse(promo.expiresAt)) {
    return null
  }
  return promo
}
