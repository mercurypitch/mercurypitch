// ============================================================
// Hold flow tests — the plan as data: one hold, two, and the rest card after effort
// ============================================================
//
// Every branch of the rule for two holds is Lesson 5's (lesson-05/
// hold-flow.test.ts, through its plan). Here, what the plan changes: a page
// with one hold never offers a next hold and closes each Easy take with the
// rest and its reading; a second hold closes with both readings; and
// "Effortful" picks the rest card only where the plan asks for it. Lesson
// 24's plan holds sets of notes (`sets`): a set's take is marked from its
// notes (`setMark`), and the set's rules follow (its WEB-SPEC, Toys 6).

import { describe, expect, it } from 'vitest'
import type { HoldPlan, HoldRecord, TakeMark } from './hold-flow'
import { afterFeeling, afterTake, emptyRecord, setMark, withCelebration, withTake, } from './hold-flow'

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

describe("Lesson 24's sets: three notes of five seconds, then two of ten", () => {
  const SETS: HoldPlan = { lengths: [5, 10], sets: true, restAfterEffort: true }
  const silent: TakeMark = { kind: 'silent', share: 0 }
  const unsteady: TakeMark = { kind: 'unsteady', share: 0 }

  it('marks a set from its notes: read if any was, its share the lowest read, whole only if every note was read', () => {
    // Assert
    expect(setMark([read(0.9), read(0.8), read(0.95)], 3)).toEqual({
      kind: 'read',
      share: 0.8,
      whole: true,
      ended: false,
    })
    expect(setMark([read(0.9), unsteady, read(0.7)], 3)).toEqual({
      kind: 'read',
      share: 0.7,
      whole: false,
      ended: false,
    })
    expect(setMark([unsteady, unsteady, unsteady], 3)).toEqual({
      kind: 'unsteady',
      share: 0,
      whole: false,
      ended: false,
    })
  })

  it('marks a set a silent note ended as ended, and one with nothing sung as silent', () => {
    // Assert: a note with no voice in 6 s ends the set there
    expect(setMark([read(0.9), silent], 3)).toEqual({
      kind: 'read',
      share: 0.9,
      whole: false,
      ended: true,
    })
    expect(setMark([silent], 3)).toEqual({
      kind: 'silent',
      share: 0,
      whole: false,
      ended: true,
    })
  })

  it('asks how it felt after any set a note of which was sung, and offers Again and Done for today after one with nothing sung', () => {
    // Arrange
    const partway = record([setMark([read(0.9), silent], 3)])
    const nothing = record([setMark([silent], 3)])

    // Assert: the kit's no-start line shows on the page meanwhile
    expect(afterTake(1, partway)).toEqual({ ask: true, again: false })
    expect(afterTake(1, nothing)).toEqual({ ask: false, again: true })
  })

  it('celebrates only a set whose every note was read and in the band for 80 % of its length, once a set', () => {
    // Arrange
    const all = record([setMark([read(0.9), read(0.85), read(0.8)], 3)])
    const oneUnread = record([setMark([read(0.9), unsteady, read(0.9)], 3)])
    const oneLow = record([setMark([read(0.9), read(0.79), read(0.9)], 3)])

    // Act
    const steps = [all, oneUnread, oneLow].map(
      (r) => afterFeeling(SETS, 1, 'easy', r).celebrate,
    )
    const again = afterFeeling(
      SETS,
      1,
      'workable',
      withCelebration(
        withTake(all, 1, setMark([read(1), read(1), read(1)], 3)),
        1,
      ),
    )

    // Assert
    expect(steps).toEqual([true, false, false])
    expect(again.celebrate).toBe(false)
  })

  it('offers the ten-second set after Easy or Workable on a whole first set, with Again while takes are left', () => {
    for (const feeling of ['easy', 'workable'] as const) {
      // Act
      const step = afterFeeling(
        SETS,
        1,
        feeling,
        record([setMark([read(0.9), read(0.6), read(0.7)], 3)]),
      )

      // Assert
      expect(step.next).toBe('rest')
      expect(step.offers).toEqual({
        nextHold: true,
        again: true,
        done: 'today',
      })
    }
  })

  it('never offers the next set after a set a silent note ended, only Again while takes are left and Done for today', () => {
    // Act
    const step = afterFeeling(
      SETS,
      1,
      'easy',
      record([setMark([read(0.9), silent], 3)]),
    )

    // Assert
    expect(step.offers).toEqual({
      nextHold: false,
      again: true,
      done: 'today',
    })
  })

  it('reads the tricky line from the take alone, after either set', () => {
    // Arrange: a low first set, then a good second
    const r = record(
      [setMark([read(0.3), read(0.9), read(0.9)], 3)],
      [setMark([read(0.9), read(0.9)], 2)],
    )

    // Act
    const first = afterFeeling(SETS, 1, 'easy', r)
    const second = afterFeeling(SETS, 2, 'easy', r)

    // Assert
    expect([first.tricky, second.tricky]).toEqual([true, false])
  })

  it('closes the second set with its summary, Again while takes are left, and Done for today', () => {
    // Act
    const step = afterFeeling(
      SETS,
      2,
      'easy',
      record(
        [setMark([read(0.9), read(0.9), read(0.9)], 3)],
        [setMark([read(0.91), read(0.86)], 2)],
      ),
    )

    // Assert
    expect([step.next, step.summary]).toEqual(['end', true])
    expect(step.offers).toEqual({ nextHold: false, again: true, done: 'done' })
  })

  it("keeps each note's reading after Effortful, with no summary, no more singing and the rest card", () => {
    for (const hold of [1, 2] as const) {
      // Act
      const step = afterFeeling(
        SETS,
        hold,
        'effortful',
        record(
          [setMark([read(0.9), read(0.9), read(0.9)], 3)],
          [setMark([read(0.9), read(0.9)], 2)],
        ),
      )

      // Assert
      expect([step.next, step.reading, step.summary]).toEqual([
        'gentle',
        true,
        false,
      ])
      expect(step.restCard).toBe(true)
      expect(step.offers).toEqual({
        nextHold: false,
        again: false,
        done: 'today',
      })
    }
  })
})
