// ============================================================
// Lesson 5 hold flow tests — every branch after a held note, with no microphone
// ============================================================
//
// WEB-SPEC's flow tests (Toys 6, Tests): what each answer to "How did that
// feel?" offers after the ten- and the fifteen-second hold, the three-take
// limit, the counted takes and when Merc celebrates.

import { describe, expect, it } from 'vitest'
import { MAX_TRIES } from '@/features/lessons/kit/take'
import type { HoldNo, HoldRecord, TakeMark } from './hold-flow'
import { afterFeeling, afterTake, counted, emptyRecord, HOLD_SEC, TAKES_PER_HOLD, withCelebration, withTake, } from './hold-flow'

const read = (share: number): TakeMark => ({ kind: 'read', share })
const unsteady: TakeMark = { kind: 'unsteady', share: 0 }
const silent: TakeMark = { kind: 'silent', share: 0 }

/** A record with these takes on each hold. */
function record(
  one: readonly TakeMark[],
  two: readonly TakeMark[] = [],
): HoldRecord {
  let r = emptyRecord()
  for (const t of one) r = withTake(r, 1, t)
  for (const t of two) r = withTake(r, 2, t)
  return r
}

describe('the holds (FACTS 44, 52, 63)', () => {
  it('are ten seconds, then fifteen, three takes each, as Lesson 3 allows three tries a note', () => {
    expect(HOLD_SEC).toEqual({ 1: 10, 2: 15 })
    expect(TAKES_PER_HOLD).toBe(MAX_TRIES)
  })
})

describe('after a ten-second take', () => {
  it('offers Hold for 15 seconds, Again and Done for today after Easy and after Workable', () => {
    // Arrange
    const r = record([read(1)])

    for (const feeling of ['easy', 'workable'] as const) {
      // Act
      const step = afterFeeling(1, feeling, r)

      // Assert
      expect(step.next).toBe('rest')
      expect(step.offers).toEqual({ hold15: true, again: true, done: 'today' })
      expect([step.reading, step.summary, step.restCard]).toEqual([
        true,
        false,
        false,
      ])
    }
  })

  it('offers only Done for today after Effortful: no Again, no longer hold, no celebration', () => {
    // Act
    const step = afterFeeling(1, 'effortful', record([read(1)]))

    // Assert
    expect(step.offers).toEqual({ hold15: false, again: false, done: 'today' })
    expect([step.next, step.celebrate, step.tricky, step.reading]).toEqual([
      'gentle',
      false,
      false,
      true,
    ])
  })

  it('offers no hold and no Again after Uncomfortable, with the doctor lines and the rest card', () => {
    // Act
    const step = afterFeeling(1, 'uncomfortable', record([read(1)]))

    // Assert
    expect(step.offers).toEqual({ hold15: false, again: false, done: null })
    expect([step.next, step.reading, step.doctor, step.restCard]).toEqual([
      'enough',
      false,
      true,
      true,
    ])
    expect(step.celebrate).toBe(false)
  })

  it('leaves out Hold for 15 seconds while the first hold has no take with a reading', () => {
    // Act
    const step = afterFeeling(1, 'easy', record([unsteady]))

    // Assert
    expect(step.offers.hold15).toBe(false)
    expect(step.offers.again).toBe(true)
  })

  it('takes Again away after the third take of a hold', () => {
    // Act
    const second = afterFeeling(1, 'easy', record([read(0.9), read(0.9)]))
    const third = afterFeeling(
      1,
      'easy',
      record([read(0.9), read(0.9), read(0.9)]),
    )

    // Assert
    expect(second.offers.again).toBe(true)
    expect(third.offers.again).toBe(false)
    expect(third.offers.hold15).toBe(true)
  })

  it("adds rule 15's line only for a take in the band for less than half of it", () => {
    // Act + Assert
    expect(afterFeeling(1, 'easy', record([read(0.49)])).tricky).toBe(true)
    expect(afterFeeling(1, 'easy', record([read(0.5)])).tricky).toBe(false)
    expect(afterFeeling(1, 'workable', record([unsteady])).tricky).toBe(false)
  })
})

describe('after a fifteen-second take', () => {
  it("gives both readings with Again and Done after Easy, from each hold's counted take", () => {
    // Arrange: the first hold's counted take is its second, the one with a reading
    const r = record([read(0.84), unsteady], [read(0.86)])

    // Act
    const step = afterFeeling(2, 'easy', r)

    // Assert
    expect(step.next).toBe('end')
    expect([step.summary, step.reading]).toEqual([true, false])
    expect(step.offers).toEqual({ hold15: false, again: true, done: 'done' })
    expect(counted(r.takes[1])).toEqual(read(0.84))
  })

  it("adds rule 15's line when either hold's counted take was in the band for less than half", () => {
    // Act + Assert
    expect(
      afterFeeling(2, 'easy', record([read(0.4)], [read(0.9)])).tricky,
    ).toBe(true)
    expect(
      afterFeeling(2, 'easy', record([read(0.9)], [read(0.3)])).tricky,
    ).toBe(true)
    expect(
      afterFeeling(2, 'easy', record([read(0.9)], [read(0.9)])).tricky,
    ).toBe(false)
  })

  it('offers only Done for today after Effortful, with the readings and no celebration', () => {
    // Act
    const step = afterFeeling(2, 'effortful', record([read(1)], [read(1)]))

    // Assert
    expect(step.offers).toEqual({ hold15: false, again: false, done: 'today' })
    expect([step.summary, step.celebrate]).toEqual([true, false])
  })

  it('takes Again away after the third fifteen-second take', () => {
    // Act
    const step = afterFeeling(
      2,
      'workable',
      record([read(1)], [read(1), read(1), read(1)]),
    )

    // Assert
    expect(step.offers.again).toBe(false)
    expect(step.offers.done).toBe('done')
  })
})

describe("Merc's celebration", () => {
  it('comes only after Easy or Workable, for a take at least 80 % in the band', () => {
    // Arrange
    const hit = record([read(0.8)])
    const near = record([read(0.79)])

    // Act + Assert
    expect(afterFeeling(1, 'easy', hit).celebrate).toBe(true)
    expect(afterFeeling(1, 'workable', hit).celebrate).toBe(true)
    expect(afterFeeling(1, 'easy', near).celebrate).toBe(false)
    expect(afterFeeling(1, 'effortful', hit).celebrate).toBe(false)
    expect(afterFeeling(1, 'uncomfortable', hit).celebrate).toBe(false)
  })

  it('comes at most once a hold, and never because a hold was longer', () => {
    // Arrange
    const once = withCelebration(record([read(1), read(1)]), 1)
    const longer = withCelebration(record([read(1)], [read(0.7)]), 1)

    // Act + Assert
    expect(afterFeeling(1, 'easy', once).celebrate).toBe(false)
    expect(afterFeeling(2, 'easy', longer).celebrate).toBe(false)
    expect(
      afterFeeling(2, 'easy', withTake(longer, 2 as HoldNo, read(0.9)))
        .celebrate,
    ).toBe(true)
  })
})

describe('straight after a take', () => {
  it('asks "How did that feel?" after any take that heard a voice', () => {
    expect(afterTake(1, record([read(0.2)]))).toEqual({
      ask: true,
      again: false,
    })
    expect(afterTake(1, record([unsteady])).ask).toBe(true)
  })

  it('asks nothing when no voice came, offering Again while the hold has had fewer than three takes', () => {
    expect(afterTake(1, record([silent]))).toEqual({ ask: false, again: true })
    expect(afterTake(2, record([read(1)], [silent, silent, silent]))).toEqual({
      ask: false,
      again: false,
    })
  })
})
