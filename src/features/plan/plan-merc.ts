// ============================================================
// plan-merc: Merc as the plan's two hosts draw him
// ============================================================
//
// The plan is hosted twice: as a beat of First Light (BeatPlan) and as a layer
// over the app (PlanLayer). Both put one Merc above the same two screens, so
// what his picture is, which still goes with which pose and how large he
// stands are written here once, and neither host holds a copy to drift from
// the other.
//
// - His box is sized in pixels, because MercPresence sets it inline and a class
//   could not win. The questions and the plan have a size each, both smaller on
//   a phone so the first question still fits above the fold. The numbers are
//   from the approved mock.
// - Which window counts as a phone is the question screens' own: the
//   complement of their `min-width: 720px` (PlanQuestions.module.css, pinned in
//   plan-merc.test.ts). The match follows a turn of the phone and stops
//   listening when the host that asked goes.
// - Where he cannot be drawn live, a still stands in for him, and it follows
//   his pose: the listening Merc on the third question, the cheering one on the
//   plan, and the one pointing the way on every other.

import type { MercState } from '@/lib/merc/constants'
import { createReactiveMatch } from '@/lib/use-viewport'
import type { PlanPhase } from './usePlanFlowController'

/** His box, in px, on the questions and on the plan: from the approved mock. */
const MERC_PX = {
  questions: { phone: 96, wide: 136 },
  plan: { phone: 84, wide: 92 },
} as const satisfies Record<PlanPhase, Record<'phone' | 'wide', number>>

/** The question screens' phone layout: the complement of their `min-width: 720px`. */
export const PHONE_QUERY = '(max-width: 719.98px)'

/** His stills, by pose: the listening one on Q3, the cheering one on the plan, else pointing the way. */
const STILLS: Partial<Record<MercState, string>> = {
  listen: '/onboarding/coach/merc-listen.webp',
  celebrate: '/onboarding/coach/merc-celebrate.webp',
}
const STILL_POINT = '/onboarding/coach/merc-point.webp'

/** The still that stands in for him in `pose`. */
export const stillFor = (pose: MercState): string => STILLS[pose] ?? STILL_POINT

/** His box's side in px: what the flow is on, and whether the window is a phone's. */
export const mercSizeFor = (phase: PlanPhase, phone: boolean): number =>
  MERC_PX[phase][phone ? 'phone' : 'wide']

/**
 * His box's side as a live accessor: the size for the phase the flow is on, in
 * the window as it is now. Follows a turn of the phone, and stops listening
 * when the host that called this goes.
 */
export function createMercSize(phase: () => PlanPhase): () => number {
  const phone = createReactiveMatch(PHONE_QUERY)
  return () => mercSizeFor(phase(), phone())
}
