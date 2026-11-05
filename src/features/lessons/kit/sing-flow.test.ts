// ============================================================
// Sing flow tests — a page's own line, and the rule every page shares
// ============================================================
//
// The rule's every branch is Lesson 12's tests' (lesson-12/
// sing-flow.test.ts, through its binding); here, what a page binds: its
// own line after Easy and Workable, under its own key, with Lesson 3's
// lines and the rest card after Effortful, as Lesson 15 binds it; and what
// Merc sings named in the lines, and a cap on the sweeps a visit holds,
// with Again after the first, as Lesson 17 binds it.

import { describe, expect, it } from 'vitest'
import type { Feeling } from './comfort'
import type { SingEvent, SingState } from './sing-flow'
import { HINT, nextState, openState, singFlow, STATUS } from './sing-flow'

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

/** Lesson 17's binding: Merc's bars, and two sweeps a visit. */
const capped = singFlow({
  sung: 'done',
  line: "That's it: two bars on one note, done.",
  notes: "Merc's bars",
  guides: 2,
})

/** The state after `events` through `capped`'s rule, from a first visit's. */
const cappedAfter = (events: readonly SingEvent[]): SingState =>
  events.reduce(capped.nextState, openState(null))

const ready: readonly SingEvent[] = [
  { type: 'comfort', comfort: 'sing' },
  { type: 'voice', voice: 'lower' },
  { type: 'played', heard: true },
]
const sweep: readonly SingEvent[] = [
  { type: 'sweepStart' },
  { type: 'sweepEnd' },
]

describe('what Merc sings, named', () => {
  it('words the lines and hints with the page’s name, and keeps the series’ by default', () => {
    // Act
    const listen = capped.singView(
      cappedAfter([
        { type: 'comfort', comfort: 'listen' },
        { type: 'voice', voice: 'higher' },
      ]),
    )
    const first = capped.singView(cappedAfter(ready.slice(0, 2)))

    // Assert
    expect(listen.status).toBe(
      "Just listening today: press Play Merc's bars to hear them.",
    )
    expect(first.status).toBe(
      "Play Merc's bars first: Merc sings them, then the guide is yours.",
    )
    expect(capped.STATUS.ready).toBe(
      "Start the guide when you're ready, or play Merc's bars again.",
    )
    expect(capped.HINT).toEqual({
      first: "Play Merc's bars first",
      silent:
        "Sound is off: nothing played. Turn sound on to hear Merc's bars, then start the guide.",
    })
    expect([flow.STATUS, flow.HINT]).toEqual([STATUS, HINT])
  })
})

describe('a cap on the sweeps a visit holds', () => {
  it('shows Start the guide until the first sweep, then Again only once Easy or Workable answers it', () => {
    // Act
    const before = capped.singView(cappedAfter(ready))
    const unanswered = cappedAfter([...ready, ...sweep])
    const refused = capped.nextState(unanswered, { type: 'sweepStart' })
    const easy = cappedAfter([
      ...ready,
      ...sweep,
      { type: 'feel', feeling: 'easy' },
    ])

    // Assert
    expect([before.startShown, before.againShown]).toEqual([true, false])
    const asked = capped.singView(unanswered)
    expect([asked.startShown, asked.againShown]).toEqual([false, false])
    expect(refused).toBe(unanswered)
    const fine = capped.singView(easy)
    expect([fine.startShown, fine.againShown, fine.status]).toEqual([
      false,
      true,
      capped.AFTER.done,
    ])
  })

  it('runs no sweep past the cap, and none after a hard answer', () => {
    // Arrange
    const twice = cappedAfter([
      ...ready,
      ...sweep,
      { type: 'feel', feeling: 'workable' },
      ...sweep,
      { type: 'feel', feeling: 'easy' },
    ])
    const effort = cappedAfter([
      ...ready,
      ...sweep,
      { type: 'feel', feeling: 'effortful' },
    ])

    // Act
    const third = capped.nextState(twice, { type: 'sweepStart' })
    const afterEffort = capped.nextState(effort, { type: 'sweepStart' })

    // Assert
    expect(twice.sweeps).toBe(2)
    expect(third).toBe(twice)
    expect(capped.singView(twice).againShown).toBe(false)
    expect(afterEffort).toBe(effort)
    expect(capped.singView(effort).againShown).toBe(false)
  })

  it('hides Again while its guide runs, and offers it once more after one cut short, which counts for nothing', () => {
    // Act
    const running = cappedAfter([
      ...ready,
      ...sweep,
      { type: 'feel', feeling: 'easy' },
      { type: 'sweepStart' },
    ])
    const cut = capped.nextState(running, { type: 'sweepCut' })

    // Assert
    expect(capped.singView(running).againShown).toBe(false)
    expect(cut.sweeps).toBe(1)
    expect(capped.singView(cut).againShown).toBe(true)
  })

  it('leaves a flow with no cap as it was: Start the guide stays, and no Again', () => {
    // Act
    const felt = sungAndFelt('easy')
    const v = flow.singView(felt)
    const again = flow.nextState(felt, { type: 'sweepStart' })

    // Assert
    expect([v.startShown, v.againShown]).toEqual([true, false])
    expect(again.sweeping).toBe(true)
  })
})
