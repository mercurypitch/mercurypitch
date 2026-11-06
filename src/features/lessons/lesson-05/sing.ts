// ============================================================
// Lesson 5 Sing it — one comfortable note, ten seconds, then fifteen
// ============================================================
//
// The checkpoint (WEB-SPEC, Toys 6) is the kit's held-note checkpoint
// (kit/hold-sing.ts), which began as this page's and moved into the kit
// with options for Lesson 22. This is Lesson 5's plan for it: ten seconds,
// then fifteen only after an "Easy" or "Workable" first hold and a rest the
// singer ends (hold-flow.ts), the card's own name for the second hold's
// button, Hold for 15 seconds (`hold15`), today's hold reader, the band
// state shown live during a take, and "Effortful" leaving the Voice Mirror
// card, the kit's default. Merc holds the note for 10 or 15 seconds in the
// listening mode, one button each in the markup.

import type { HoldNo } from '@/features/lessons/kit/hold-flow'
import type { HoldSingPlan } from '@/features/lessons/kit/hold-sing'
import { initHoldSing } from '@/features/lessons/kit/hold-sing'
import type { RingStills } from '@/features/lessons/kit/sing'
import { PLAN } from './hold-flow'

/** Each hold's name, as its head and its status lines say it. */
export const HOLD_HEAD: Readonly<Record<HoldNo, string>> = {
  1: 'Hold 1: ten seconds',
  2: 'Hold 2: fifteen seconds',
}

/** Lesson 5's plan for the kit's checkpoint. */
export const SING: HoldSingPlan = {
  consumer: 'lesson-05',
  warmupKey: 'fyp-l05-warmup',
  holds: PLAN,
  heads: HOLD_HEAD,
  nextHold: 'hold15',
}

export function initSing(stills: RingStills): void {
  initHoldSing(stills, SING)
}
