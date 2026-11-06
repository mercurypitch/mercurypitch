// ============================================================
// Lesson 5 hold flow — ten seconds, then fifteen, on the kit's rule
// ============================================================
//
// Sing it holds one note twice: 10 seconds, then 15 only after an "Easy" or
// "Workable" first hold and a rest the singer ends (WEB-SPEC, Toys 6;
// FACTS 52). The rule is the kit's (kit/hold-flow.ts), which takes the
// holds' lengths as data; this is Lesson 5's plan for it. "Effortful"
// leaves the Voice Mirror card, the kit's default.

import type { Feeling } from '@/features/lessons/kit/comfort'
import type { FlowStep, HoldNo, HoldPlan, HoldRecord, } from '@/features/lessons/kit/hold-flow'
import { afterFeeling as kitAfterFeeling } from '@/features/lessons/kit/hold-flow'

/** Seconds of each hold: ten, then fifteen (FACTS 44, 63). */
export const HOLD_SEC: Readonly<Record<HoldNo, number>> = { 1: 10, 2: 15 }

/** The kit's plan for Lesson 5's two holds. */
export const PLAN: HoldPlan = { lengths: [HOLD_SEC[1], HOLD_SEC[2]] }

/** The answer to "How did that feel?" after a take on `hold` of Lesson 5's plan (the record holds that take). */
export const afterFeeling = (
  hold: HoldNo,
  feeling: Feeling,
  r: HoldRecord,
): FlowStep => kitAfterFeeling(PLAN, hold, feeling, r)
