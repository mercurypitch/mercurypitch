// ============================================================
// Lesson 5 hold flow — ten seconds, then fifteen, on the kit's rule
// ============================================================
//
// Sing it holds one note twice: 10 seconds, then 15 only after an "Easy" or
// "Workable" first hold and a rest the singer ends (WEB-SPEC, Toys 6;
// FACTS 52). The rule is the kit's (kit/hold-flow.ts), which takes the
// holds' lengths as data; this is Lesson 5's plan for it, with the card's
// own name for the second hold's button, Hold for 15 seconds (`hold15`).
// "Effortful" leaves the Voice Mirror card, the kit's default.

import type { Feeling } from '@/features/lessons/kit/comfort'
import type { FlowStep as KitStep, HoldNo, HoldPlan, HoldRecord, } from '@/features/lessons/kit/hold-flow'
import { afterFeeling as kitAfterFeeling } from '@/features/lessons/kit/hold-flow'

export type {
  HoldNo,
  HoldRecord,
  TakeMark,
} from '@/features/lessons/kit/hold-flow'
export {
  afterTake,
  againAllowed,
  counted,
  emptyRecord,
  TAKES_PER_HOLD,
  withCelebration,
  withTake,
} from '@/features/lessons/kit/hold-flow'

/** Seconds of each hold: ten, then fifteen (FACTS 44, 63). */
export const HOLD_SEC: Readonly<Record<HoldNo, number>> = { 1: 10, 2: 15 }

/** The kit's plan for Lesson 5's two holds. */
export const PLAN: HoldPlan = { lengths: [HOLD_SEC[1], HOLD_SEC[2]] }

/** The kit's step, its next hold named for the card's Hold for 15 seconds. */
export type FlowStep = Omit<KitStep, 'offers'> & {
  readonly offers: {
    readonly hold15: boolean
    readonly again: boolean
    readonly done: KitStep['offers']['done']
  }
}

/** The answer to "How did that feel?" after a take on `hold` (the record holds that take). */
export function afterFeeling(
  hold: HoldNo,
  feeling: Feeling,
  r: HoldRecord,
): FlowStep {
  const { offers, ...step } = kitAfterFeeling(PLAN, hold, feeling, r)
  return {
    ...step,
    offers: { hold15: offers.nextHold, again: offers.again, done: offers.done },
  }
}
