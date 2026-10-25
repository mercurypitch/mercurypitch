// ============================================================
// Coach state — what Merc is doing, for the hosts that wait on him
// ============================================================
//
// coachActive is set by a tour's start (the coach's start.ts and room-tour.ts,
// in src/features/tours) from the moment the tour is asked for until its layer
// is gone. showcaseOn is set from "Show me around" until the showcase has
// handed over; the plan raises it as its layer closes (plan-showcase.ts). The
// app's offers (the tour chip, the legacy walkthrough's) and the deferred
// survey read coachBusy, so nothing new starts under Merc.
//
// A module of its own in lib, with no imports beyond Solid's signal and a
// type, so the app and the plan read and raise it without importing the tours
// or loading the coach.

import { createSignal } from 'solid-js'
import type { TourKey } from '@/lib/tour-ids'

const [coachActive, setCoachActive] = createSignal<TourKey | null>(null)
const [showcaseOn, setShowcaseOn] = createSignal(false)

/** Merc has the screen: a tour, asked for or running, or the showcase. */
const coachBusy = (): boolean => coachActive() !== null || showcaseOn()

export { coachActive, coachBusy, setCoachActive, setShowcaseOn, showcaseOn }
