// ============================================================
// Sing flow tests — a page's own line, and the rule every page shares
// ============================================================
//
// The rule's every branch is Lesson 12's tests' (lesson-12/
// sing-flow.test.ts, through its binding); here, what a page binds: its
// own line after Easy and Workable, under its own key, with Lesson 3's
// lines and the rest card after Effortful, as Lesson 15 binds it.

import { describe, expect, it } from 'vitest'
import type { Feeling } from './comfort'
import type { SingEvent, SingState } from './sing-flow'
import { nextState, openState, singFlow, STATUS } from './sing-flow'

const flow = singFlow({
  sung: 'steps',
  line: 'Do, re, mi, fa, so: five notes, one step up the staff each time.',
})

/** The state after `events`, from a first visit's. */
const after = (events: readonly SingEvent[]): SingState =>
  events.reduce(nextState, openState(null))

/** A visit that sings one sweep to its end and answers `f`. */
const sungAndFelt = (f: Feeling): SingState =>
  after([
    { type: 'comfort', comfort: 'sing' },
    { type: 'voice', voice: 'lower' },
    { type: 'played', heard: true },
    { type: 'sweepStart' },
    { type: 'sweepEnd' },
    { type: 'feel', feeling: f },
  ])

describe('a page’s own flow', () => {
  it('gives its own line, under its own key, after Easy and Workable, and keeps the guide', () => {
    for (const f of ['easy', 'workable'] as const) {
      // Act
      const v = flow.singView(sungAndFelt(f))

      // Assert
      expect(v.after, f).toBe('steps')
      expect(v.status, f).toBe(flow.AFTER.steps)
      expect(v.singParts, f).toBe(true)
      expect(v.card, f).toBe('practise')
    }
  })

  it("gives Lesson 3's lines after Effortful and Uncomfortable, puts the guide away and picks the rest card", () => {
    // Act
    const effort = flow.singView(sungAndFelt('effortful'))
    const pain = flow.singView(sungAndFelt('uncomfortable'))

    // Assert
    expect([effort.after, pain.after]).toEqual(['gentle', 'enough'])
    expect([effort.singParts, pain.singParts]).toEqual([false, false])
    expect([effort.card, pain.card]).toEqual(['rest', 'rest'])
    expect(pain.doctor).toBe(true)
  })

  it('picks the rest card for Just listen today, and opens on the comfort check', () => {
    // Assert
    expect(flow.singView(openState('higher')).status).toBe(STATUS.comfort)
    expect(
      flow.singView(after([{ type: 'comfort', comfort: 'listen' }])).card,
    ).toBe('rest')
  })

  it('holds its own line and the two closing lines', () => {
    expect(Object.keys(flow.AFTER).sort()).toEqual([
      'enough',
      'gentle',
      'steps',
    ])
  })
})
