// ============================================================
// Plan progress — when Home's card shows, and which stops it ticks
// ============================================================
//
// The card is a pure function of four things: the plan record, whether the
// person hid the card, the clock and what each stop's room has given them.
// homePlanCardState takes the clock and the record as arguments, so each rule
// is tried at a day of its own without a clock to fake, and with a `done`
// handed in wherever the rule under test is not about ticking.
//
// What a tick is made of is the real thing: stopDone reads the first values
// the rooms record (src/lib/first-value.ts) and the stops opened from the
// plan (plan-store), so the cases that tick a stop use those, not a stand-in.
// The table of what finishes each stop is written out here, a row to
// a destination, so a destination that gains or changes a rule fails by name.
// The answers and the clean slate are plan-choices.fixture.ts's: the store is a
// module signal, so each case starts from `fresh()`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FirstValueKind } from '@/lib/first-value'
import { resetFirstValueForTests, trackFirstValue } from '@/lib/first-value'
import type { PlanDest, PlanStop, PlanView } from './build-plan'
import { buildPlan, PLAN_DESTS, planStops } from './build-plan'
import { PLAN_CARD_DAYS } from './plan-card-rules'
import { AUDITION, DAY, fresh, seeFirstValue, SINGING_ONLY, STARTING, TOGETHER, } from './plan-choices.fixture'
import type { HomePlanCardState } from './plan-progress'
import { homePlanCardState, nextPlanStop, stopDone } from './plan-progress'
import type { PlanRecordV1, PlanStatus } from './plan-record'
import { markStopOpened } from './plan-store'
import type { PlanChoices } from './questions'
import { EMPTY_CHOICES } from './questions'

// ── Fixtures ───────────────────────────────────────────────────────────

const AT = '2026-10-20T12:00:00.000Z'
const AT_MS = Date.parse(AT)

/** `n` days after the record was written, as the clock reads it. */
const day = (n: number): number => AT_MS + n * DAY

/** A guitar player just starting, who practices alone: Start here Guitar Night, Learn Lesson 2. */
const GUITAR_ALONE: PlanChoices = {
  q1: 'guitar',
  q2: null,
  q3: ['alone'],
  q4: ['starting'],
}
const GUITAR_ONLY: PlanView = { scope: 'guitar', mode: 'advanced' }

function recordOf(
  status: PlanStatus,
  over: Partial<PlanRecordV1> = {},
): PlanRecordV1 {
  return { v: 1, status, choices: AUDITION, at: AT, via: 'layer', ...over }
}
const answered = (over: Partial<PlanRecordV1> = {}): PlanRecordV1 =>
  recordOf('answered', over)

const NONE_DONE = (): boolean => false
const ALL_DONE = (): boolean => true

/** The rows of a card that is the plan; a card that is not fails with what it was. */
function rowsOf(card: HomePlanCardState): { stop: PlanStop; done: boolean }[] {
  if (card?.kind !== 'plan') {
    throw new Error(`Expected the plan, got ${JSON.stringify(card)}`)
  }
  return card.stops
}

/** The first values, as the rooms write them. */
const KINDS: readonly FirstValueKind[] = [
  'sing',
  'karaoke',
  'drill',
  'ear',
  'guitar',
  'piano',
]

beforeEach(() => {
  // The funnel logs each event it is told about.
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  fresh()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── When a stop is done ────────────────────────────────────────────────

describe('stopDone', () => {
  /**
   * What finishes each stop: the first values that do, or null for a room
   * that has none, which counts as done once it is opened from the plan.
   */
  const FINISHED_BY: Record<PlanDest, readonly FirstValueKind[] | null> = {
    sing: ['sing'],
    homeSession: ['sing', 'drill'],
    ascent: ['sing', 'drill'],
    exercises: ['drill'],
    guitar: ['guitar'],
    guitarNight: ['guitar'],
    piano: ['piano'],
    pianoNight: ['piano'],
    earLab: ['ear'],
    karaokeNight: ['karaoke'],
    jam: null,
    lesson1: null,
    lesson2: null,
    hearYourself: null,
  }
  const DESTS = Object.keys(PLAN_DESTS) as PlanDest[]
  const BY_FIRST_VALUE = DESTS.filter((d) => FINISHED_BY[d] !== null)
  const BY_OPENING = DESTS.filter((d) => FINISHED_BY[d] === null)

  it('has a rule for every stop the plan can name', () => {
    expect(Object.keys(FINISHED_BY).sort()).toEqual([...DESTS].sort())
    expect(BY_FIRST_VALUE).toHaveLength(10)
    expect([...BY_OPENING].sort()).toEqual([
      'hearYourself',
      'jam',
      'lesson1',
      'lesson2',
    ])
  })

  /** Which of these stops the rooms' first values, as they stand, have ticked. */
  const doneAmong = (dests: PlanDest[]): PlanDest[] =>
    dests.filter((dest) => stopDone(dest))

  it('ticks each stop on exactly the first values that finish it, and on no other', () => {
    expect(doneAmong(BY_FIRST_VALUE)).toEqual([])

    // One first value at a time: which stops does each one tick?
    const ticked: Partial<Record<PlanDest, FirstValueKind[]>> = {}
    for (const kind of KINDS) {
      resetFirstValueForTests()
      seeFirstValue(kind)
      for (const dest of doneAmong(BY_FIRST_VALUE)) {
        ticked[dest] = [...(ticked[dest] ?? []), kind]
      }
    }

    expect(ticked).toEqual(
      Object.fromEntries(
        BY_FIRST_VALUE.map((dest) => [dest, FINISHED_BY[dest]]),
      ),
    )
  })

  it('does not tick a stop that has a first value because it was opened', () => {
    for (const dest of BY_FIRST_VALUE) markStopOpened(dest)

    expect(doneAmong(BY_FIRST_VALUE)).toEqual([])
  })

  it('ticks a stop that has none once it is opened, whatever the rooms have given', () => {
    seeFirstValue(...KINDS)
    expect(doneAmong(BY_OPENING)).toEqual([])

    for (const dest of BY_OPENING) markStopOpened(dest)

    expect(doneAmong(BY_OPENING)).toEqual(BY_OPENING)
  })

  it('opens one stop without ticking another', () => {
    markStopOpened('lesson1')

    expect(stopDone('lesson1')).toBe(true)
    expect(stopDone('lesson2')).toBe(false)
    expect(stopDone('jam')).toBe(false)
  })
})

// ── The card's state ───────────────────────────────────────────────────

describe('homePlanCardState', () => {
  const state = (
    record: PlanRecordV1 | null,
    now: number,
    over: Partial<Parameters<typeof homePlanCardState>[0]> = {},
  ): HomePlanCardState =>
    homePlanCardState({ record, dismissed: false, now, ...over })

  it("counts the week from the record's own date, for the plan and for the ask alike", () => {
    // [status, written at, the clock as days after AT, what the card is then]
    const weeks: [PlanStatus, string, number, 'plan' | 'ask' | null][] = [
      ['answered', '2026-10-25T08:30:00.000Z', 7.1, 'plan'],
      ['answered', '2026-10-25T08:30:00.000Z', 12.5, null],
      ['declined', '2026-10-23T09:00:00.000Z', 8, 'ask'],
      ['declined', '2026-10-23T09:00:00.000Z', 10.5, null],
    ]

    for (const [status, at, days, kind] of weeks) {
      const card = state(recordOf(status, { at }), day(days), {
        done: NONE_DONE,
      })

      expect([status, at, days, card?.kind ?? null]).toEqual([
        status,
        at,
        days,
        kind,
      ])
    }
  })

  describe('the plan', () => {
    it('shows the plan for seven days after answering', () => {
      const stops = planStops(buildPlan(AUDITION)).map((stop) => ({
        stop,
        done: false,
      }))

      expect(PLAN_CARD_DAYS).toBe(7)
      expect(state(answered(), day(0), { done: NONE_DONE })).toEqual({
        kind: 'plan',
        stops,
      })
      expect(state(answered(), day(6.9), { done: NONE_DONE })).toEqual({
        kind: 'plan',
        stops,
      })
      expect(state(answered(), day(7.1), { done: NONE_DONE })).toBeNull()
    })

    it('counts the week as seven whole days: the seventh day is over', () => {
      expect(state(answered(), day(7) - 1, { done: NONE_DONE })?.kind).toBe(
        'plan',
      )
      expect(state(answered(), day(7), { done: NONE_DONE })).toBeNull()
    })

    it('lists up to three stops: Start here, then Learn and Play', () => {
      const rows = rowsOf(state(answered(), day(1), { done: NONE_DONE }))

      expect(rows.map((r) => [r.stop.kind, r.stop.dest])).toEqual([
        ['start', 'sing'],
        ['learn', 'hearYourself'],
        ['play', 'karaokeNight'],
      ])
    })

    it('rebuilds the plan from the stored answers and the voiceprint the record kept', () => {
      const kept = { room: 'exercises', detail: 'Steady the wobble' } as const
      const record = answered({ choices: SINGING_ONLY, voiceprint: kept })

      const [first] = rowsOf(state(record, day(1), { done: NONE_DONE }))

      expect(first.stop).toEqual(
        buildPlan(SINGING_ONLY, { voiceprint: kept }).start,
      )
      expect([first.stop.dest, first.stop.title]).toEqual([
        'exercises',
        'Steady the wobble',
      ])
    })

    it('shows the plan a record without a voiceprint makes', () => {
      const [first] = rowsOf(
        state(answered({ choices: GUITAR_ALONE }), day(1), { done: NONE_DONE }),
      )

      expect(first.stop).toEqual(buildPlan(GUITAR_ALONE).start)
      expect(first.stop.dest).toBe('guitarNight')
    })

    it('builds for the menu it is given, so a room the menu hides gets no row', () => {
      const record = answered({ choices: TOGETHER })
      const dests = (view?: PlanView): string[] =>
        rowsOf(state(record, day(1), { done: NONE_DONE, view })).map(
          (r) => r.stop.dest,
        )

      expect(dests()).toEqual(['sing', 'jam'])
      expect(dests({ scope: 'all', mode: 'advanced' })).toEqual(['sing', 'jam'])
      expect(dests(GUITAR_ONLY)).toEqual(['sing'])
    })
  })

  describe('ticks', () => {
    it('ticks a stop off when its room reaches a first value', () => {
      const guitarNight = (): boolean =>
        rowsOf(state(answered({ choices: GUITAR_ALONE }), day(1)))[0].done
      expect(guitarNight()).toBe(false)

      expect(trackFirstValue('guitar', { native: false })).toBe(true)

      expect(guitarNight()).toBe(true)
    })

    it('ticks a lesson off once it is opened', () => {
      const lesson = (): boolean | undefined =>
        rowsOf(state(answered({ choices: STARTING }), day(1))).find(
          (r) => r.stop.dest === 'lesson1',
        )?.done
      expect(lesson()).toBe(false)

      markStopOpened('lesson1')

      expect(lesson()).toBe(true)
    })

    it('ticks each stop by itself and keeps the others as they were', () => {
      const rows = rowsOf(
        state(answered(), day(1), { done: (dest) => dest === 'hearYourself' }),
      )

      expect(rows.map((r) => r.done)).toEqual([false, true, false])
    })

    it('asks the room, not the plan, so a first value from before the answers counts', () => {
      seeFirstValue('sing')

      const rows = rowsOf(state(answered(), day(1)))

      expect(rows.map((r) => r.done)).toEqual([true, false, false])
    })

    it('goes away when every stop is done', () => {
      expect(state(answered(), day(1), { done: ALL_DONE })).toBeNull()
    })

    it('stays while one stop is left', () => {
      const rows = rowsOf(
        state(answered(), day(1), { done: (d) => d !== 'karaokeNight' }),
      )

      expect(rows.map((r) => r.done)).toEqual([true, true, false])
    })

    it('goes away when the real rooms have given every stop its value', () => {
      seeFirstValue('sing', 'karaoke')
      markStopOpened('hearYourself')

      expect(state(answered(), day(1))).toBeNull()
    })
  })

  describe('the ask', () => {
    it('asks skippers and decliners during their first week', () => {
      for (const status of ['shown', 'declined'] as const) {
        const record = recordOf(status, { choices: EMPTY_CHOICES })

        expect([status, state(record, day(0))]).toEqual([
          status,
          { kind: 'ask' },
        ])
        expect([status, state(record, day(6.9))]).toEqual([
          status,
          { kind: 'ask' },
        ])
        expect([status, state(record, day(7.1))]).toEqual([status, null])
      }
    })

    it('never asks someone who has answered, however many stops are left', () => {
      expect(state(answered(), day(1), { done: NONE_DONE })?.kind).toBe('plan')
      expect(state(answered(), day(20), { done: NONE_DONE })).toBeNull()
    })

    it('says the same to a skipper whatever menu they have', () => {
      const narrow: PlanView = { scope: 'piano', mode: 'simple' }

      expect(state(recordOf('shown'), day(1), { view: narrow })).toEqual({
        kind: 'ask',
      })
    })
  })

  describe('nothing', () => {
    it('has nothing to say before a record exists', () => {
      expect(state(null, day(0))).toBeNull()
      expect(state(null, day(3))).toBeNull()
    })

    it('stays away once dismissed', () => {
      for (const status of ['answered', 'shown', 'declined'] as const) {
        const dismissed = state(recordOf(status), day(1), { dismissed: true })
        const shown = state(recordOf(status), day(1), { dismissed: false })

        expect([status, dismissed]).toEqual([status, null])
        expect([status, shown === null]).toEqual([status, false])
      }
    })

    it.each<PlanStatus>(['answered', 'shown', 'declined'])(
      'gives no card for a date that does not read: %s',
      (status) => {
        for (const at of ['', 'yesterday', 'not a date', '2026-13-45']) {
          expect([at, state(recordOf(status, { at }), day(1))]).toEqual([
            at,
            null,
          ])
        }
      },
    )

    it('gives no card for a date a week or more ahead of the clock, which would never end', () => {
      const future = recordOf('shown', { at: '2027-10-20T12:00:00.000Z' })

      expect(state(future, day(1))).toBeNull()
    })

    it('still shows for a date a little ahead of the clock, as two devices disagree', () => {
      const ahead = recordOf('shown', {
        at: new Date(day(1) + 60_000).toISOString(),
      })

      expect(state(ahead, day(1))).toEqual({ kind: 'ask' })
    })
  })
})

// ── The next stop ──────────────────────────────────────────────────────

describe('nextPlanStop', () => {
  const plan = buildPlan(AUDITION)
  const [START, LEARN, PLAY] = planStops(plan)

  it('names the next stop not yet done', () => {
    expect(nextPlanStop(plan, NONE_DONE)).toBe(START)
    expect(nextPlanStop(plan, (d) => d === 'sing')).toBe(LEARN)
    expect(
      nextPlanStop(plan, (d) => d === 'sing' || d === 'hearYourself'),
    ).toBe(PLAY)
  })

  it('names none when every stop is done', () => {
    expect(nextPlanStop(plan, ALL_DONE)).toBeNull()
  })

  it('reads on past a stop that is done, in the order Start here, Learn, Play', () => {
    expect(nextPlanStop(plan, (d) => d === 'hearYourself')).toBe(START)
    expect(
      nextPlanStop(plan, (d) => d === 'sing' || d === 'karaokeNight'),
    ).toBe(LEARN)
  })

  it('reads the rooms when no way to tell is handed in', () => {
    expect(nextPlanStop(plan)).toBe(START)

    seeFirstValue('sing')
    expect(nextPlanStop(plan)).toBe(LEARN)

    markStopOpened('hearYourself')
    expect(nextPlanStop(plan)).toBe(PLAY)

    seeFirstValue('sing', 'karaoke')
    expect(nextPlanStop(plan)).toBeNull()
  })

  it('names the only stop of a plan that has one', () => {
    const solo = buildPlan(SINGING_ONLY)

    expect(planStops(solo)).toHaveLength(1)
    expect(nextPlanStop(solo, NONE_DONE)).toBe(solo.start)
    expect(nextPlanStop(solo, ALL_DONE)).toBeNull()
  })
})
