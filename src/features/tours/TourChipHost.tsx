// ============================================================
// TourChipHost — a tab's first-visit tour offer, by the page title
// ============================================================
//
// The coach's chip at the top of the main content column. It replaces the
// corner toast that offered a tab's tour, which landed over whatever the
// singer was doing. What it keeps from the toast, each pinned in
// TourChipHost.test.tsx:
//
// - One offer per tab, ever. `pitchperfect_page_tour_offered_<tab>` is
//   written as the chip shows, and only then. Storage that cannot be written
//   means no chip: the offer could never be recorded, so it would come back
//   on every visit.
// - Nothing while `paused` (First Light, the plan, What's New, the takeover
//   still deciding) or while Merc has the screen (coachBusy: a Merc tour,
//   asked for or running, or the showcase); the legacy spotlight is checked
//   when an offer is due. The pause is a memo, so a re-read that says the
//   same thing changes nothing. When it lifts, the offer waits a microtask:
//   First Light's Map lifts it in the same handler that starts a room's
//   tour, and the offer must not land on that tour.
// - One chip at a time. A tab change, the pause rising, and a page asking
//   for the offer to go (a drill or a stage replacing what the tour walks:
//   removeNotificationsByChannel on TOUR_OFFER_CHANNEL, which bumps
//   tourOfferRetired) each retire it.
//
// What is new:
//
// - A tab with a Merc tour (COACH_TOURS) offers it with Merc's line; any
//   other tab with a legacy page tour offers that, with the toast's own line.
//   Either starts through startRoomTour (room-tour.ts), as every door does.
// - A tab change ends a running Merc tour, reported as an exit at its step,
//   and the legacy spotlight starting ends one too: the two never run
//   together (R11).
// - A contextual tour (the stem mixer's, offerTourOnce) asks through
//   requestTourChip and shows in the same place, under the same rules.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, on, Show } from 'solid-js'
import { tabLabel } from '@/features/tabs/constants'
import { coachActive, coachBusy } from '@/lib/coach-state'
import { trackTour } from '@/lib/guide-funnel'
import type { TourKey } from '@/lib/tour-ids'
import { hasPageTour, pageTourKey, tourOfferRetired, walkthroughActive, } from '@/stores'
import type { ActiveTab } from '@/types'
import { MERC_TOUR_LINE, TourChip } from './coach/TourChip'
import { COACH_TOURS } from './coach-tours'
import { startRoomTour } from './room-tour'
import styles from './TourChipHost.module.css'

/** A contextual tour's offer: shown in the tab chip's place, once ever. */
export interface TourChipRequest {
  /** The tour, as the offer is reported. */
  key: TourKey
  /** Written as the chip shows, so the tour is offered once. */
  storageKey: string
  line: string
  onStart: () => void
}

interface Chip {
  line: string
  start: () => void
}

const [request, setRequest] = createSignal<TourChipRequest | null>(null)

/** Offers a contextual tour (the stem mixer's) in the chip's place. */
export function requestTourChip(req: TourChipRequest): void {
  setRequest(req)
}

/** The tab's offer key, as the toast wrote it. */
export const tourOfferKey = (tab: ActiveTab): string =>
  `pitchperfect_page_tour_offered_${tab}`

/**
 * The coach's end (start.ts), loaded only when there is a Merc tour to end:
 * none has to be ended before one has started.
 */
const loadCoach = () => import('./coach/start')

/** Ends the Merc tour that runs or is loading. With none, nothing loads. */
function endMercTour(): void {
  if (coachActive() === null) return
  void loadCoach().then((coach) => coach.endCoachTour())
}

/** True when the offer under `key` was made already, or cannot be recorded. */
function offeredAlready(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    return true
  }
}

/** Records the offer under `key`; false when storage will not take it. */
function recordOffer(key: string): boolean {
  try {
    localStorage.setItem(key, 'true')
    return true
  } catch {
    return false
  }
}

export interface TourChipHostProps {
  tab: () => ActiveTab
  /** Something else has the screen, or is still deciding whether it will. */
  paused: () => boolean
}

export function TourChipHost(props: TourChipHostProps): JSX.Element {
  const [chip, setChip] = createSignal<Chip | null>(null)
  const pausedNow = createMemo(() => props.paused() || coachBusy())

  // Either kind of tour, started as every door starts one; a Merc tour that
  // loads after the singer has left its tab does not start.
  const startTour = (tab: ActiveTab): void => {
    startRoomTour(tab, () => props.tab() === tab)
  }

  const offer = (tab: ActiveTab): void => {
    // The microtask path can find the singer elsewhere already, or a
    // contextual offer on screen that came due as the pause lifted: that
    // one stays, and this tab's offer is not spent where nobody saw it.
    if (props.tab() !== tab || pausedNow() || chip() !== null) return
    if (walkthroughActive()) return
    const entry = COACH_TOURS[tab]
    if (entry === undefined && !hasPageTour(tab)) return
    const key = tourOfferKey(tab)
    if (offeredAlready(key) || !recordOffer(key)) return
    if (entry !== undefined) {
      setChip({ line: MERC_TOUR_LINE, start: () => startTour(tab) })
      trackTour('tour_offer', entry.key)
      return
    }
    setChip({
      line: `New to ${tabLabel(tab)}? Take a quick tour.`,
      start: () => startTour(tab),
    })
    // The offer does not depend on a key to report; only the report does.
    const tourKey = pageTourKey(tab)
    if (tourKey !== null) trackTour('tour_offer', tourKey)
  }

  // A tab change ends a Merc tour on the tab left behind.
  createEffect(on(props.tab, endMercTour, { defer: true }))
  // The legacy spotlight and a Merc tour never run together.
  createEffect(
    on(walkthroughActive, (active) => {
      if (active) endMercTour()
    }),
  )
  // A drill or a stage replaced what the offered tour walks.
  createEffect(on(tourOfferRetired, () => setChip(null), { defer: true }))

  createEffect(
    on([props.tab, pausedNow], ([tab, isPaused], prev) => {
      setChip(null)
      if (isPaused) return
      if (prev?.[1] === true) queueMicrotask(() => offer(tab))
      else offer(tab)
    }),
  )

  // A contextual offer shows when nothing holds the screen.
  createEffect(
    on([request, pausedNow], ([req, isPaused]) => {
      if (req === null || isPaused) return
      setRequest(null)
      if (walkthroughActive()) return
      if (offeredAlready(req.storageKey) || !recordOffer(req.storageKey)) {
        return
      }
      setChip({ line: req.line, start: req.onStart })
      trackTour('tour_offer', req.key)
    }),
  )

  return (
    <Show when={chip()}>
      {(shown) => (
        <div class={styles.slot}>
          <TourChip
            line={shown().line}
            onStart={() => {
              const start = shown().start
              setChip(null)
              start()
            }}
            onDismiss={() => setChip(null)}
          />
        </div>
      )}
    </Show>
  )
}
