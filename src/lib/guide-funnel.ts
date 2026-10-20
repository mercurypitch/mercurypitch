// ============================================================
// Guide funnel — which tour was offered, started, finished or left
// ============================================================
//
// One tracker for every guided tour, on the shared funnel transport. The four
// tour events carry their numbers as metrics: `tour` is the tour's permanent
// id (src/lib/tour-ids.ts), `step` is the 1-based step the singer saw, and
// `of` is how many steps that run showed. A phone shows fewer steps than a
// desktop, so step 3 of 3 and step 3 of 7 are different places. The event
// name stays fixed and the numbers ride along, because a worker keeps
// numbers and an event name and nothing else.
//
// `metricEvents` is TOUR_FUNNEL_EVENTS itself, the list the db-worker builds
// its allowlist from, so the client and the worker cannot drift apart.
// ============================================================

import { createFunnel } from '@/lib/funnel'
import type { GuideFunnelEvent, TourFunnelEvent, } from '@/lib/funnel-event-catalog'
import { TOUR_FUNNEL_EVENTS } from '@/lib/funnel-event-catalog'
import type { TourKey } from '@/lib/tour-ids'
import { TOUR_IDS } from '@/lib/tour-ids'

/** The local ring buffer `createFunnel` keeps for this tracker. */
export const GUIDE_FUNNEL_STORAGE_KEY = 'guide.funnel.v1'

export const trackGuide = createFunnel<GuideFunnelEvent>({
  storageKey: GUIDE_FUNNEL_STORAGE_KEY,
  label: 'guide-funnel',
  metricEvents: TOUR_FUNNEL_EVENTS,
})

export type TourEvent = TourFunnelEvent

/** Where a running tour stands: the 1-based step on screen, of how many shown. */
export interface TourPlace {
  step?: number
  of: number
}

/** The metrics a tour event sends: numbers or null, never a string. */
export function tourMetrics(
  key: TourKey,
  step: number | null,
  of: number | null,
): { tour: number; step: number | null; of: number | null } {
  return { tour: TOUR_IDS[key], step, of }
}

/**
 * Report one tour event at `place`, where the tour stands. An offer comes
 * before a tour has steps on screen, so it sends no place.
 */
export function trackTour(
  event: TourEvent,
  key: TourKey,
  place?: TourPlace,
): void {
  trackGuide(event, tourMetrics(key, place?.step ?? null, place?.of ?? null))
}
