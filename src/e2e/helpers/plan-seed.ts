// ============================================================
// The plan seed: a plan record the opening takeover reads as settled
// ============================================================
//
// The opening takeover puts the plan layer in front of a returning visitor who
// has no plan record. A spec that spends First Light's welcome with
// dismissOverlays and then reloads is that visitor, and the layer would cover
// what the spec is driving. The takeover leaves a run alone that sets
// `window.E2E_TEST_MODE`, and about half the specs do not, so the helper
// settles the plan as well, with the record built here: a plan that was turned
// down, a long time ago.
//
// - The takeover finds a record, so it has no plan to ask.
// - The record's date is years out of Home's card week (plan-card-rules.ts), so
//   Home draws no plan card.
// - It was turned down, not answered, and only an answered plan is sent
//   (plan-sync.ts), so nothing syncs.
//
// Built in this one place, and importing no Playwright, so that
// src/tests/e2e-plan-seed.test.ts can load it and hold it to the plan's own
// reader. A change to the record's format then fails that one test, and not
// every spec that calls dismissOverlays.

import { PLAN_RECORD_KEY } from '@/features/plan/plan-keys'
import type { PlanRecordV1 } from '@/features/plan/plan-record'

/** What to store, and where: the key and the value as the plan's own store writes them. */
export interface PlanSeed {
  key: string
  value: string
}

/** When the seeded plan was turned down: years before any run, so out of Home's card week whenever a spec runs. */
const TURNED_DOWN_AT = '2020-01-01T00:00:00.000Z'

/** A turned-down plan with nothing picked, dated long ago. */
export function settledPlanSeed(): PlanSeed {
  const record: PlanRecordV1 = {
    v: 1,
    status: 'declined',
    choices: { q1: null, q2: null, q3: [], q4: [] },
    at: TURNED_DOWN_AT,
    via: 'layer',
  }
  return { key: PLAN_RECORD_KEY, value: JSON.stringify(record) }
}
