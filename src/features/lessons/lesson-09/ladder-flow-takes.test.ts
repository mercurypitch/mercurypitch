// ============================================================
// Lesson 9 ladder flow tests — after a take: the retry rules and the answers
// ============================================================
//
// The WEB-SPEC's Tests 7, from the first take on: a take with no voice asks
// nothing and offers Start again, leaving the one Again, and after the last
// take its line drops its cue; "Easy" and "Workable" offer Again once a
// visit, with Again smaller after the full ladder; after a smaller ladder
// the full one is gone; an abandoned take counts and uses the Again if it
// had voice; "Effortful" and "Uncomfortable" end the singing and pick the
// rest card, "Uncomfortable" without the lines and the count; Merc
// celebrates once a visit; the feelings lock once answered.

import { describe, expect, it } from 'vitest'
import type { LadderEvent, LadderOffers } from './ladder-flow'
import { againName, kindOf, LADDERS, next, offers } from './ladder-flow'
import { begin, briefed, DONE, feel, run, take, took, } from './ladder-flow.test-fixtures'

describe('after a take', () => {
  /** A card after the events from the briefing, by what it offers and says. */
  const CARDS: readonly (readonly [
    string,
    readonly LadderEvent[],
    Partial<LadderOffers>,
  ])[] = [
    [
      'asks nothing after a take with no voice, and offers Start again on either ladder, with its cue',
      take('full', 'none'),
      {
        stage: 'noVoice',
        ask: false,
        startAgain: true,
        ladders: ['full', 'smaller'],
        done: true,
        noVoiceLine: 'noVoice',
      },
    ],
    [
      'leaves the one Again for the next sung ladder after a take with no voice',
      [...take('full', 'none'), ...take('smaller', 'some'), feel('easy')],
      { again: ['smaller'] },
    ],
    [
      "offers no Start again after the last take with no voice, and drops the line's cue",
      [
        ...take('full', 'none'),
        ...take('full', 'none'),
        ...take('full', 'none'),
      ],
      {
        startAgain: false,
        ladders: [],
        again: [],
        done: true,
        noVoiceLine: 'noVoiceLast',
      },
    ],
    [
      "drops the no-voice line's cue once Done for today is pressed",
      [...take('full', 'none'), DONE],
      { startAgain: false, done: false, noVoiceLine: 'noVoiceLast' },
    ],
    [
      'asks "How did that feel?" after a sung ladder, with its lines, and nothing else until it is answered',
      take('full', 'some'),
      {
        stage: 'reading',
        ask: true,
        locked: false,
        lines: true,
        count: false,
        again: [],
        done: false,
      },
    ],
    ...(['easy', 'workable'] as const).map(
      (f) =>
        [
          `offers Again and Again smaller after "${f}" on the full ladder`,
          [...take('full', 'all'), feel(f)],
          {
            again: ['full', 'smaller'],
            moveDo: true,
            done: true,
            count: true,
            card: 'practise',
          },
        ] as const,
    ),
    ...LADDERS.map(
      (l) =>
        [
          `offers no second Again after Again on the ${l} ladder`,
          [
            ...take('full', 'all'),
            feel('easy'),
            begin(l),
            took('all'),
            feel('workable'),
          ],
          { again: [], done: true },
        ] as const,
    ),
    [
      'offers only the smaller ladder again after a smaller one',
      [...take('smaller', 'some'), feel('easy')],
      { again: ['smaller'] },
    ],
    [
      'counts a take abandoned after its voice, back to Start on the smaller ladder only',
      take('smaller', 'leftVoiced'),
      { stage: 'briefing', start: true, ask: false, ladders: ['smaller'] },
    ],
    [
      'counts a take abandoned before any voice, back to Start on either ladder',
      take('smaller', 'leftSilent'),
      {
        stage: 'briefing',
        start: true,
        ask: false,
        ladders: ['full', 'smaller'],
      },
    ],
    [
      'offers no Again after a take abandoned after its voice',
      [
        ...take('smaller', 'leftVoiced'),
        ...take('smaller', 'all'),
        feel('easy'),
      ],
      { again: [] },
    ],
    [
      'offers the one Again after a take abandoned before any voice',
      [
        ...take('smaller', 'leftSilent'),
        ...take('smaller', 'all'),
        feel('easy'),
      ],
      { again: ['smaller'] },
    ],
    [
      'offers Done for today alone once an abandoned take leaves no take to make',
      [...take('full', 'some'), feel('easy'), ...take('full', 'leftVoiced')],
      { stage: 'spent', start: false, done: true },
    ],
    [
      'says "If that felt tricky" when fewer than all the heard notes landed',
      [...take('full', 'some'), feel('workable')],
      { tricky: true },
    ],
    ...(['all', 'unsteady'] as const).map(
      (kind) =>
        [
          `says nothing of tricky after a take that came to ${kind}`,
          [...take('full', kind), feel('workable')],
          { tricky: false },
        ] as const,
    ),
    [
      'has Merc celebrate after "Easy" or "Workable" when every heard note landed',
      [...take('full', 'all'), feel('easy')],
      { celebrate: true },
    ],
    [
      'has Merc celebrate once a visit',
      [
        ...take('full', 'all'),
        feel('easy'),
        ...take('full', 'all'),
        feel('workable'),
      ],
      { celebrate: false },
    ],
    ...(['effortful', 'uncomfortable'] as const).map(
      (f) =>
        [
          `has Merc celebrate nothing answered "${f}"`,
          [...take('full', 'all'), feel(f)],
          { celebrate: false },
        ] as const,
    ),
    [
      'ends the singing after "Effortful", keeping the lines and the count, with the gentle line and the rest card',
      [...take('full', 'some'), feel('effortful')],
      {
        again: [],
        ladders: [],
        moveDo: false,
        lines: true,
        count: true,
        tricky: false,
        closing: 'gentle',
        doctor: false,
        done: true,
        card: 'rest',
      },
    ],
    [
      'ends the singing after "Uncomfortable", taking the lines and the count away, with the doctor lines',
      [...take('full', 'all'), feel('uncomfortable')],
      {
        again: [],
        lines: false,
        count: false,
        closing: 'enough',
        doctor: true,
        done: false,
        card: 'rest',
      },
    ],
    [
      'frees the answers for the next take',
      [...take('full', 'some'), feel('easy'), ...take('full', 'some')],
      { ask: true, locked: false },
    ],
    [
      'offers nothing more after Done for today, and keeps the lines and the answer',
      [...take('full', 'some'), feel('easy'), DONE],
      {
        ask: true,
        locked: true,
        lines: true,
        count: true,
        again: [],
        moveDo: false,
        done: false,
      },
    ],
  ]

  it.each(CARDS)('%s', (_, events, card) => {
    // Act
    const o = offers(run(events, briefed()))

    // Assert
    expect(o).toMatchObject(card)
  })

  it.each([
    ['after a take with no voice', take('full', 'none')],
    ['until an Again is pressed', [...take('full', 'all'), feel('easy')]],
    ['after a take abandoned before any voice', take('full', 'leftSilent')],
  ] as const)('leaves the one Again unused %s', (_, events) => {
    // Act
    const v = run(events, briefed())

    // Assert
    expect(v.againUsed).toBe(false)
  })

  it('uses the one Again up with a take abandoned after its voice, and counts the take', () => {
    // Act
    const v = run(take('smaller', 'leftVoiced'), briefed())

    // Assert
    expect(v).toMatchObject({
      againUsed: true,
      takes: [{ ladder: 'smaller', kind: 'leftVoiced' }],
    })
  })

  it.each(LADDERS)('uses the one Again up with Again on the %s ladder', (l) => {
    // Arrange
    const v = run([...take('full', 'all'), feel('workable')], briefed())

    // Act
    const again = next(v, begin(l))

    // Assert
    expect(again).toMatchObject({ taking: l, againUsed: true })
  })

  it('refuses the full ladder after a sung smaller one', () => {
    // Arrange
    const v = run([...take('smaller', 'some'), feel('easy')], briefed())

    // Act
    const refused = next(v, begin('full'))

    // Assert
    expect(refused).toBe(v)
  })

  it('locks an answer once given', () => {
    // Arrange
    const answered = run([...take('full', 'some'), feel('easy')], briefed())

    // Act
    const changed = next(answered, feel('uncomfortable'))

    // Assert
    expect(changed).toBe(answered)
    expect(offers(answered).locked).toBe(true)
  })

  it.each([
    ['full', 'full', 'Again: do-mi-so-do'],
    ['smaller', 'full', 'Again, smaller ladder'],
    ['smaller', 'smaller', 'Again: the smaller ladder'],
  ] as const)(
    'names Again on the %s ladder after the %s one "%s"',
    (ladder, last, name) => {
      // Act
      const named = againName(ladder, last)

      // Assert
      expect(named).toBe(name)
    },
  )

  it.each([
    [{ heard: false } as const, 'none'],
    [{ heard: true, count: { heard: 0, landed: 0 } } as const, 'unsteady'],
    [{ heard: true, count: { heard: 3, landed: 2 } } as const, 'some'],
    [{ heard: true, count: { heard: 3, landed: 3 } } as const, 'all'],
  ])(
    "reads the ladder reader's result %j as a take that came to %s",
    (reading, kind) => {
      // Act
      const read = kindOf(reading)

      // Assert
      expect(read).toBe(kind)
    },
  )
})
