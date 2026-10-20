// ============================================================
// Guide funnel — which tour was offered, started, finished or left
// ============================================================
//
// One tracker for every guided tour, on the shared funnel transport. The four
// tour events carry their numbers as metrics: `tour` is the tour's permanent
// id (src/lib/tour-ids.ts) and `step` is the 1-based step the singer saw. The
// event name stays fixed and the number rides along, because a worker keeps
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

/** The metrics a tour event sends: numbers or null, never a string. */
export function tourMetrics(
  key: TourKey,
  step: number | null,
): { tour: number; step: number | null } {
  return { tour: TOUR_IDS[key], step }
}

/** Report one tour event. `step` is 1-based; leave it out when none applies. */
export function trackTour(event: TourEvent, key: TourKey, step?: number): void {
  trackGuide(event, tourMetrics(key, step ?? null))
}
