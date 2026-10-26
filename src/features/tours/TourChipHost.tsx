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
//   written, and tour_offer sent, once the chip has been seen (at least half
//   of it on screen: TourChip's onSeen), and never for a chip that was not:
//   Path restores its scroll below the chip, and an offer scrolled away
//   comes back on the next visit. Storage that cannot be written takes the
//   chip down as it is seen: the offer could never be recorded, so it would
//   come back on every visit. A tour started by another door (the
//   showcase's end, First Light's Map) spends the offer too (room-tour.ts),
//   so the chip never offers a tour that was just shown.
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
// - The chip itself (src/components/coach/TourChip.tsx) loads with the first
//   offer, not with the app. Karaoke Night shows the same chip, which makes
//   it a chunk of its own, and most visits never see an offer. An offer
//   waits for it, so the offer is still written as the chip shows: one that
//   cannot load is not spent, and comes back on the next visit. The watch
//   that says the chip was seen lives in that chunk too.

import type { Component, JSX } from 'solid-js'
import { createComponent, createEffect, createMemo, createSignal, on, Show, } from 'solid-js'
import type { TourChipProps } from '@/components/coach/TourChip'
import { tabLabel } from '@/features/tabs/constants'
import { coachActive, coachBusy } from '@/lib/coach-state'
import { trackTour } from '@/lib/guide-funnel'
import type { TourKey } from '@/lib/tour-ids'
import { hasPageTour, pageTourKey, tourOfferRetired, walkthroughActive, } from '@/stores'
import type { ActiveTab } from '@/types'
import { COACH_TOURS } from './coach-tours'
import { startRoomTour, tourOfferKey } from './room-tour'
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
  /** A legacy or contextual tour's own line; a Merc tour's is the chip's. */
  line?: string
  start: () => void
  /** The chip has been on screen: spend the offer and report it. */
  seen: () => void
}

const [request, setRequest] = createSignal<TourChipRequest | null>(null)

/** Offers a contextual tour (the stem mixer's) in the chip's place. */
export function requestTourChip(req: TourChipRequest): void {
  setRequest(req)
}

const [chipView, setChipView] = createSignal<Component<TourChipProps> | null>(
  null,
)
let chipLoading: Promise<boolean> | null = null

/**
 * Loads the chip, once: true when it is there to draw. A load that fails is
 * tried again by the next offer.
 */
export function warmTourChip(): Promise<boolean> {
  chipLoading ??= import('@/components/coach/TourChip').then(
    (chipModule) => {
      setChipView(() => chipModule.TourChip)
      return true
    },
    () => {
      chipLoading = null
      return false
    },
  )
  return chipLoading
}

/** The chip, once it has loaded; an offer is only made when it has. */
function LoadedTourChip(props: TourChipProps): JSX.Element {
  const view = chipView()
  return view === null ? null : createComponent(view, props)
}

/**
 * The coach's end (start.ts), loaded only when there is a Merc tour to end:
 * none has to be ended before one has started.
 */
const loadCoach = () => import('@/components/coach/start')

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

  // Spends the offer under `key` once the chip is seen, and reports it for
  // `tour` (none to report for a tab without a key); storage that will not
  // take it takes the chip down.
  const spend = (key: string, tour: TourKey | null) => (): void => {
    if (!recordOffer(key)) setChip(null)
    else if (tour !== null) trackTour('tour_offer', tour)
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
    if (offeredAlready(key)) return
    // The chip first, then the offer, so it is written as the chip is seen.
    if (chipView() === null) {
      void warmTourChip().then((ready) => {
        if (ready) offer(tab)
      })
      return
    }
    setChip({
      line: entry ? undefined : `New to ${tabLabel(tab)}? Take a quick tour.`,
      start: () => startTour(tab),
      // The offer does not depend on a key to report; only the report does.
      seen: spend(key, entry ? entry.key : pageTourKey(tab)),
    })
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

  // A contextual offer shows when nothing holds the screen, and the chip is
  // there to draw: its load makes this run again.
  createEffect(
    on([request, pausedNow, chipView], ([req, isPaused, view]) => {
      if (req === null || isPaused) return
      if (view === null) {
        void warmTourChip()
        return
      }
      setRequest(null)
      if (walkthroughActive() || offeredAlready(req.storageKey)) return
      setChip({
        line: req.line,
        start: req.onStart,
        seen: spend(req.storageKey, req.key),
      })
    }),
  )

  // Keyed: each offer is a chip of its own, watched for being seen anew.
  return (
    <Show when={chip()} keyed>
      {(shown) => (
        <div class={styles.slot}>
          <LoadedTourChip
            line={shown.line}
            onSeen={shown.seen}
            onStart={() => {
              setChip(null)
              shown.start()
            }}
            onDismiss={() => setChip(null)}
          />
        </div>
      )}
    </Show>
  )
}
