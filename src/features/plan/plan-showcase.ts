// ============================================================
// plan-showcase: "Show me around", from the plan's hosts to the coach
// ============================================================
//
// Both hosts of the plan (First Light's BeatPlan, the app's PlanLayer) answer
// the `showcase` exit the same way: they close, then call runPlanShowcase,
// which loads Merc's showcase (src/features/tours/coach/start-showcase.ts)
// and hands it the plan. At the showcase's end, done or skipped, Start here is
// begun as its card begins it (the controller's `begin`: counted, marked
// opened, the menu made whole) and opened with its room's tour (enterStop).
//
// - The offers wait from the first moment. showcaseOn goes up here, in the
//   host's own handler, so the tour chip's offer that the close lets go (a
//   microtask later) finds Merc busy and is not spent on a tab nobody is
//   looking at.
// - A showcase that cannot load still opens Start here, as the interim
//   "Show me around" did, so the button never leads nowhere.
// - Warming: the plan screen fetches the showcase and the coach while the
//   plan is read, where Merc can be drawn live (warmPlanShowcase).

import { untrack } from 'solid-js'
import { setShowcaseOn } from '@/lib/coach-state'
import { isNarrow } from '@/lib/use-viewport'
import { practiceScope, uiMode } from '@/stores/settings-store'
import type { Plan, PlanStop } from './build-plan'
import { enterStop } from './enter-stop'

const loadShowcase = () => import('@/features/tours/coach/start-showcase')

/** Runs Merc's showcase for `plan`, then begins and opens its Start here. */
export function runPlanShowcase(plan: Plan, begin: () => void): void {
  setShowcaseOn(true)
  let opened = false
  const enterStart = (stop: PlanStop): void => {
    if (opened) return
    opened = true
    begin()
    enterStop(stop, true)
  }
  loadShowcase()
    .then(({ startShowcase }) =>
      startShowcase(plan, {
        phone: isNarrow(),
        scope: untrack(practiceScope),
        mode: untrack(uiMode),
        enterStart,
      }),
    )
    .catch(() => {
      setShowcaseOn(false)
      enterStart(plan.start)
    })
}

/** Fetches the showcase and the coach ahead of "Show me around". */
export function warmPlanShowcase(): void {
  loadShowcase()
    .then(({ warmShowcase }) => warmShowcase())
    .catch(() => undefined)
}
