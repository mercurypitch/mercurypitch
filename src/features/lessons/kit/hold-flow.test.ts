// ============================================================
// Hold flow tests — the plan as data: one hold, two, and the rest card after effort
// ============================================================
//
// Every branch of the rule for two holds is Lesson 5's (lesson-05/
// hold-flow.test.ts, through its plan). Here, what the plan changes: a page
// with one hold never offers a next hold and closes each Easy take with the
// rest and its reading; a second hold closes with both readings; and
// "Effortful" picks the rest card only where the plan asks for it.

import { describe, expect, it } from 'vitest'
import type { HoldPlan, HoldRecord, TakeMark } from './hold-flow'
import { afterFeeling, emptyRecord, withTake } from './hold-flow'

const ONE: HoldPlan = { lengths: [10] }
const TWO: HoldPlan = { lengths: [10, 15] }
const read = (share: number): TakeMark => ({ kind: 'read', share })

/** A record with these takes on the first hold, and on the second. */
function record(
  one: readonly TakeMark[],
  two: readonly TakeMark[] = [],
): HoldRecord {
  let r = emptyRecord()
  for (const t of one) r = withTake(r, 1, t)
  for (const t of two) r = withTake(r, 2, t)
  return r
}

describe('a plan of one hold', () => {
  it('closes Easy and Workable with the rest and the reading, Again and Done for today, and no next hold', () => {
    for (const feeling of ['easy', 'workable'] as const) {
      // Act
      const step = afterFeeling(ONE, 1, feeling, record([read(1)]))

      // Assert
      expect(step.next).toBe('rest')
      expect([step.reading, step.summary]).toEqual([true, false])
      expect(step.offers).toEqual({
        nextHold: false,
        again: true,
        done: 'today',
      })
    }
  })

  it('takes Again away after the third take, leaving Done for today', () => {
    // Act
    const step = afterFeeling(
      ONE,
      1,
      'easy',
      record([read(1), read(1), read(1)]),
    )

    // Assert
    expect(step.offers).toEqual({
      nextHold: false,
      again: false,
      done: 'today',
    })
  })
})

describe('a plan of two holds', () => {
  it('offers the next hold after the first, once a take has a reading, and closes the second with both readings', () => {
    // Act
    const first = afterFeeling(TWO, 1, 'easy', record([read(1)]))
    const second = afterFeeling(TWO, 2, 'easy', record([read(1)], [read(1)]))

    // Assert
    expect(first.offers.nextHold).toBe(true)
    expect([second.next, second.summary, second.offers.done]).toEqual([
      'end',
      true,
      'done',
    ])
  })
})

describe('"Effortful" and the rest card', () => {
  it('leaves the Voice Mirror card by default, as Lesson 5 has it', () => {
    expect(afterFeeling(TWO, 1, 'effortful', record([read(1)])).restCard).toBe(
      false,
    )
  })

  it('picks the rest card where the plan asks, with the reading, no Again and only Done for today', () => {
    // Act
    const step = afterFeeling(
      { lengths: [10], restAfterEffort: true },
      1,
      'effortful',
      record([read(1)]),
    )

    // Assert
    expect([step.next, step.restCard, step.reading, step.celebrate]).toEqual([
      'gentle',
      true,
      true,
      false,
    ])
    expect(step.offers).toEqual({
      nextHold: false,
      again: false,
      done: 'today',
    })
  })

  it('picks the rest card after "Uncomfortable" whatever the plan, with no reading and no button', () => {
    for (const plan of [ONE, TWO]) {
      // Act
      const step = afterFeeling(plan, 1, 'uncomfortable', record([read(1)]))

      // Assert
      expect([step.restCard, step.reading, step.doctor]).toEqual([
        true,
        false,
        true,
      ])
      expect(step.offers).toEqual({ nextHold: false, again: false, done: null })
    }
  })
})
