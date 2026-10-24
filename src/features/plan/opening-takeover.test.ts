// ============================================================
// The opening takeover's picker: one thing takes the screen per visit
// ============================================================
//
// pickOpeningTakeover is a table of rules in order, so each row of the table
// below changes one input of a returning visitor who has nothing due and says
// which rule the row is for. Whether the plan is due is the hook's reading of
// the store and of the settings pull (useOpeningTakeover.test.ts), and the
// picker is told only the answer.

import { describe, expect, it } from 'vitest'
import type { OpeningTakeover, TakeoverState } from './opening-takeover'
import { pickOpeningTakeover } from './opening-takeover'

/** A returning visitor on the web whose plan is settled and who has nothing due. */
const QUIET: TakeoverState = {
  native: false,
  routeSuppressed: false,
  welcomeDue: false,
  planDue: false,
  whatsNewDue: false,
}

describe('pickOpeningTakeover', () => {
  it.each<[string, Partial<TakeoverState>, OpeningTakeover]>([
    ['native gives null', { native: true }, null],
    [
      'native gives null whatever else is due',
      { native: true, welcomeDue: true, planDue: true, whatsNewDue: true },
      null,
    ],
    [
      'suppressed with the welcome due gives null',
      { routeSuppressed: true, welcomeDue: true },
      null,
    ],
    [
      'suppressed with the plan due gives null',
      { routeSuppressed: true, planDue: true },
      null,
    ],
    [
      "suppressed with What's New due gives null",
      { routeSuppressed: true, whatsNewDue: true },
      null,
    ],
    ['the welcome due gives first-light', { welcomeDue: true }, 'first-light'],
    [
      'the welcome due comes before the plan',
      { welcomeDue: true, planDue: true },
      'first-light',
    ],
    [
      "the welcome due comes before What's New",
      { welcomeDue: true, whatsNewDue: true },
      'first-light',
    ],
    ['the plan due gives plan', { planDue: true }, 'plan'],
    [
      "the plan due with What's New due still gives plan, and What's New waits for the next visit",
      { planDue: true, whatsNewDue: true },
      'plan',
    ],
    [
      "a settled plan with What's New due gives whats-new",
      { whatsNewDue: true },
      'whats-new',
    ],
    ['a settled plan with nothing due gives null', {}, null],
  ])('%s', (_, change, expected) => {
    expect(pickOpeningTakeover({ ...QUIET, ...change })).toBe(expected)
  })
})
