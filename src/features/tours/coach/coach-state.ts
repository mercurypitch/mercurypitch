// ============================================================
// Coach state — which Merc tour is running, for the hosts that wait on it
// ============================================================
//
// Set by start.ts from the moment a tour is asked for until its layer is
// gone. The app's offers (the tour chip, the legacy walkthrough's) read it,
// so no second tour starts under a running one. A module of its own, with
// no imports beyond Solid's signal and a type, so a host can read it without
// loading the coach.

import { createSignal } from 'solid-js'
import type { TourKey } from '@/lib/tour-ids'

const [coachActive, setCoachActive] = createSignal<TourKey | null>(null)

export { coachActive, setCoachActive }
