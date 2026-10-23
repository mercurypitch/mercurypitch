// ============================================================
// Plan precedence — which plan record stands when a device meets the account
// ============================================================
//
// The record syncs, so a value written on this device can meet a different
// one from the account: the settings sync asks preferPlanRecord which one
// stands. Every rule here is run both ways round, with this device's value
// first and then the account's, because a rule that holds one way only
// would let the order of a pull decide the person's plan. Each row puts the
// winner first, so with it on the account's side the answer is 'remote'; a
// row whose two values tie says 'remote' both ways: the account's stands.
// The rule reads a record by its shape, not through isPlanRecordV1, so a v1
// record with choices this client does not know still ranks by its status.

import { describe, expect, it } from 'vitest'
import { preferPlanRecord } from './plan-precedence'
import type { PlanRecordV1 } from './plan-record'

const EARLY = '2026-10-20T12:00:00.000Z'
const LATE = '2026-10-21T09:30:00.000Z'

/** A record as the store writes it, serialized as it is stored and synced. */
function stored(over: Partial<PlanRecordV1>): string {
  const record: PlanRecordV1 = {
    v: 1,
    status: 'answered',
    choices: { q1: 'singing', q2: 'audition', q3: ['tune'], q4: [] },
    at: EARLY,
    via: 'first-light',
    ...over,
  }
  return JSON.stringify(record)
}

const ANSWERED = stored({})
const DECLINED = stored({
  status: 'declined',
  choices: { q1: null, q2: null, q3: [], q4: [] },
})
const SHOWN = stored({
  status: 'shown',
  choices: { q1: null, q2: null, q3: [], q4: [] },
})
/** Not text a record can be read from. */
const DAMAGED = '{"v":1,"status":"answ'
/** A newer client's record: whole, and not one this client reads. */
const NEWER_CLIENT = JSON.stringify({ ...JSON.parse(ANSWERED), v: 2 })
/** A v1 shown record whose choices isPlanRecordV1 rejects: an id no column offers. */
const SHOWN_UNKNOWN_CHOICE = JSON.stringify({
  ...JSON.parse(SHOWN),
  choices: { q1: 'kazoo', q2: null, q3: [], q4: [] },
})

/** An answered record with one field that is not text, so it cannot be ranked. */
function answeredWith(
  field: 'status' | 'at' | 'syncedAt',
  value: unknown,
): string {
  return JSON.stringify({ ...JSON.parse(ANSWERED), [field]: value })
}

/** `first` wins whichever side it is on; a `tie` leaves the account's value standing. */
const ROWS: {
  rule: string
  first: string
  second: string
  wins: 'first' | 'tie'
}[] = [
  {
    rule: 'the same value',
    first: ANSWERED,
    second: ANSWERED,
    wins: 'tie',
  },
  {
    rule: 'the same unreadable value',
    first: DAMAGED,
    second: DAMAGED,
    wins: 'tie',
  },
  {
    rule: 'an answered plan over damage',
    first: ANSWERED,
    second: DAMAGED,
    wins: 'first',
  },
  {
    rule: "an answered plan over a newer client's record",
    first: ANSWERED,
    second: NEWER_CLIENT,
    wins: 'first',
  },
  {
    rule: 'damage over a shown record',
    first: DAMAGED,
    second: SHOWN,
    wins: 'first',
  },
  {
    rule: "a newer client's record over a declined one",
    first: NEWER_CLIENT,
    second: DECLINED,
    wins: 'first',
  },
  {
    rule: 'an answered plan over one whose status is not text',
    first: ANSWERED,
    second: answeredWith('status', ['answered']),
    wins: 'first',
  },
  {
    rule: 'an answered plan over one whose date is not text',
    first: ANSWERED,
    second: answeredWith('at', 20261020),
    wins: 'first',
  },
  {
    rule: 'an answered plan over one whose received date is not text',
    first: ANSWERED,
    second: answeredWith('syncedAt', 1),
    wins: 'first',
  },
  {
    rule: 'two unreadable values',
    first: DAMAGED,
    second: NEWER_CLIENT,
    wins: 'tie',
  },
  {
    rule: 'a v1 record with choices this client does not know, by its status',
    first: DECLINED,
    second: SHOWN_UNKNOWN_CHOICE,
    wins: 'first',
  },
  {
    rule: 'answered over declined',
    first: ANSWERED,
    second: DECLINED,
    wins: 'first',
  },
  {
    rule: 'answered over shown',
    first: ANSWERED,
    second: SHOWN,
    wins: 'first',
  },
  {
    rule: 'declined over shown',
    first: DECLINED,
    second: SHOWN,
    wins: 'first',
  },
  {
    rule: 'an older answered plan over a later decline',
    first: ANSWERED,
    second: stored({ status: 'declined', at: LATE }),
    wins: 'first',
  },
  {
    rule: 'the later of two answered plans',
    first: stored({
      at: LATE,
      choices: { q1: 'guitar', q2: null, q3: [], q4: [] },
    }),
    second: ANSWERED,
    wins: 'first',
  },
  {
    rule: 'the later of two declines',
    first: stored({ status: 'declined', at: LATE }),
    second: DECLINED,
    wins: 'first',
  },
  {
    rule: 'the later of two shown records',
    first: stored({ status: 'shown', at: LATE, via: 'layer' }),
    second: SHOWN,
    wins: 'first',
  },
  {
    rule: 'on the same date, the one the account received',
    first: stored({ syncedAt: LATE }),
    second: ANSWERED,
    wins: 'first',
  },
  {
    rule: 'on the same date, both received',
    first: stored({ syncedAt: LATE }),
    second: stored({ syncedAt: EARLY }),
    wins: 'tie',
  },
  {
    rule: 'on the same date, neither received',
    first: stored({ via: 'layer' }),
    second: ANSWERED,
    wins: 'tie',
  },
]

describe('preferPlanRecord', () => {
  it.each(ROWS)('$rule: this device first', ({ first, second, wins }) => {
    expect(preferPlanRecord(first, second)).toBe(
      wins === 'first' ? 'local' : 'remote',
    )
  })

  it.each(ROWS)("$rule: the account's first", ({ first, second }) => {
    expect(preferPlanRecord(second, first)).toBe('remote')
  })
})
