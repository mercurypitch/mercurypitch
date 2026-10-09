import { describe, expect, it } from 'vitest'
import type { FinisherConfig, FinisherFacts } from './offer-rules'
import { creditsUsed, finisherConfig, finisherState, finisherWindow, } from './offer-rules'
import type { LedgerRow } from './songs-allowance'

const DAY = 24 * 60 * 60 * 1000
const SHIP_DAY = Date.parse('2026-10-15T00:00:00.000Z')
const CONFIG: FinisherConfig = {
  promoId: 'promo-2026-q4',
  startsAt: SHIP_DAY,
  windowDays: 14,
  bonusCredits: 30,
}
const CLAIM = Date.parse('2026-10-20T15:30:00.000Z')

function job(at: string, credits: number, jobRef: string): LedgerRow {
  return {
    createdAt: at,
    delta: -credits,
    reason: 'uvr-job',
    jobRef,
    idempotencyKey: `uvr:${jobRef}`,
  }
}

function refund(at: string, credits: number, jobRef: string): LedgerRow {
  return {
    createdAt: at,
    delta: credits,
    reason: 'uvr-refund',
    jobRef,
    idempotencyKey: `uvr-refund:${jobRef}`,
  }
}

function facts(rows: LedgerRow[], more: Partial<FinisherFacts> = {}) {
  return {
    claimedAt: CLAIM,
    goal: 5,
    rows,
    unlocked: false,
    bonusGranted: false,
    ...more,
  }
}

describe('finisherConfig', () => {
  it('is off until a start day is set', () => {
    expect(finisherConfig({})).toBeNull()
    expect(finisherConfig({ OFFER_START_AT: '' })).toBeNull()
    expect(finisherConfig({ OFFER_START_AT: 'soon' })).toBeNull()
  })

  it('starts on the day set, with the launch defaults', () => {
    expect(finisherConfig({ OFFER_START_AT: '2026-10-15' })).toEqual(CONFIG)
    // A time of day starts the offer at that day's start, in UTC.
    expect(
      finisherConfig({ OFFER_START_AT: '2026-10-15T18:00:00Z' })?.startsAt,
    ).toBe(SHIP_DAY)
  })

  it('reads its numbers and campaign from vars, and ignores nonsense', () => {
    expect(
      finisherConfig({
        OFFER_START_AT: '2026-10-15',
        OFFER_FINISHER_DAYS: '7',
        OFFER_BONUS_CREDITS: '20',
        OFFER_PROMO_ID: 'promo-next',
      }),
    ).toEqual({
      promoId: 'promo-next',
      startsAt: SHIP_DAY,
      windowDays: 7,
      bonusCredits: 20,
    })
    expect(
      finisherConfig({
        OFFER_START_AT: '2026-10-15',
        OFFER_FINISHER_DAYS: '-3',
        OFFER_BONUS_CREDITS: 'lots',
      }),
    ).toEqual(CONFIG)
  })
})

describe('the window', () => {
  it('runs from the claim day to the end of the day 14 days later, in UTC', () => {
    const window = finisherWindow(CLAIM, CONFIG)
    expect(new Date(window.start).toISOString()).toBe(
      '2026-10-20T00:00:00.000Z',
    )
    expect(new Date(window.end).toISOString()).toBe('2026-11-03T23:59:59.999Z')
  })

  it('starts on ship day for an account that claimed before it', () => {
    const early = Date.parse('2026-10-03T09:00:00.000Z')
    const window = finisherWindow(early, CONFIG)
    expect(window.start).toBe(SHIP_DAY)
    expect(new Date(window.end).toISOString()).toBe('2026-10-29T23:59:59.999Z')
  })
})

describe('creditsUsed', () => {
  const window = finisherWindow(CLAIM, CONFIG)

  it('counts a full band and two 2-stem songs as five', () => {
    expect(
      creditsUsed(
        [
          job('2026-10-20T16:00:00.000Z', 3, 'band'),
          job('2026-10-21T10:00:00.000Z', 1, 'two-a'),
          job('2026-10-22T10:00:00.000Z', 1, 'two-b'),
        ],
        window,
      ),
    ).toBe(5)
  })

  it('counts both ends of the window, and nothing outside it', () => {
    expect(
      creditsUsed(
        [
          job('2026-10-19T23:59:59.999Z', 1, 'before'),
          job('2026-10-20T00:00:00.000Z', 1, 'first-moment'),
          job('2026-11-03T23:59:59.999Z', 1, 'last-moment'),
          job('2026-11-04T00:00:00.000Z', 1, 'after'),
        ],
        window,
      ),
    ).toBe(2)
  })

  it('does not count a job that failed and gave its credits back', () => {
    expect(
      creditsUsed(
        [
          job('2026-10-21T10:00:00.000Z', 1, 'kept'),
          job('2026-10-21T11:00:00.000Z', 3, 'failed'),
          refund('2026-10-21T11:01:00.000Z', 3, 'failed'),
        ],
        window,
      ),
    ).toBe(1)
  })

  it('counts credits whatever paid for them, a pack bought mid-window too', () => {
    const rows: LedgerRow[] = [
      {
        createdAt: '2026-10-22T09:00:00.000Z',
        delta: 30,
        reason: 'purchase',
        jobRef: 'pack-starter',
        idempotencyKey: 'evt:evt_1',
      },
      job('2026-10-22T10:00:00.000Z', 4, 'long-band'),
      job('2026-10-23T10:00:00.000Z', 1, 'two'),
    ]
    expect(creditsUsed(rows, window)).toBe(5)
  })

  it('leaves out what the app spends from its own songs', () => {
    expect(
      creditsUsed(
        [
          {
            createdAt: '2026-10-21T10:00:00.000Z',
            delta: -1,
            reason: 'uvr-job-app',
            jobRef: 'in-the-app',
            idempotencyKey: 'uvr:in-the-app',
          },
        ],
        window,
      ),
    ).toBe(0)
  })
})

describe('finisherState', () => {
  const during = Date.parse('2026-10-25T12:00:00.000Z')

  it('counts towards the reward while the window is open', () => {
    expect(
      finisherState(
        facts([job('2026-10-21T10:00:00.000Z', 2, 'two')]),
        CONFIG,
        during,
      ),
    ).toEqual({
      state: 'counting',
      used: 2,
      goal: 5,
      deadline: '2026-11-03T23:59:59.999Z',
      bonusCredits: 30,
    })
  })

  it('unlocks the reward once all five are used', () => {
    const state = finisherState(
      facts([
        job('2026-10-20T16:00:00.000Z', 3, 'band'),
        job('2026-10-21T10:00:00.000Z', 1, 'two-a'),
        job('2026-10-22T10:00:00.000Z', 1, 'two-b'),
      ]),
      CONFIG,
      during,
    )
    expect(state).toMatchObject({ state: 'unlocked', used: 5, goal: 5 })
  })

  it('unlocks on spends inside the window, read after it closed', () => {
    const later = Date.parse('2026-12-01T00:00:00.000Z')
    expect(
      finisherState(
        facts([job('2026-10-21T10:00:00.000Z', 5, 'long-band')]),
        CONFIG,
        later,
      ).state,
    ).toBe('unlocked')
  })

  it('never takes an unlock back, and the reward never expires', () => {
    const muchLater = Date.parse('2027-06-01T00:00:00.000Z')
    expect(
      finisherState(facts([], { unlocked: true }), CONFIG, muchLater),
    ).toMatchObject({ state: 'unlocked', used: 5 })
  })

  it('lapses when the window closes short of five', () => {
    const after = Date.parse('2026-11-04T00:00:00.000Z')
    expect(
      finisherState(
        facts([job('2026-10-21T10:00:00.000Z', 4, 'four')]),
        CONFIG,
        after,
      ),
    ).toMatchObject({ state: 'lapsed', used: 4 })
    // The last moment of the last day is still inside.
    const lastMoment = Date.parse('2026-11-03T23:59:59.999Z')
    expect(
      finisherState(
        facts([job('2026-10-21T10:00:00.000Z', 4, 'four')]),
        CONFIG,
        lastMoment,
      ).state,
    ).toBe('counting')
  })

  it('is used once the bonus has landed on a pack', () => {
    expect(
      finisherState(
        facts([], { unlocked: true, bonusGranted: true }),
        CONFIG,
        during,
      ),
    ).toMatchObject({ state: 'used' })
  })

  it('gives a pre-ship claimer the fortnight from ship day', () => {
    const early = Date.parse('2026-10-03T09:00:00.000Z')
    const state = finisherState(
      facts(
        [
          // Spent before the offer existed: does not count.
          job('2026-10-04T10:00:00.000Z', 5, 'early-band'),
          job('2026-10-16T10:00:00.000Z', 2, 'after-ship'),
        ],
        { claimedAt: early },
      ),
      CONFIG,
      Date.parse('2026-10-20T00:00:00.000Z'),
    )
    expect(state).toEqual({
      state: 'counting',
      used: 2,
      goal: 5,
      deadline: '2026-10-29T23:59:59.999Z',
      bonusCredits: 30,
    })
  })

  it('caps what it reports as used at the goal', () => {
    expect(
      finisherState(
        facts([job('2026-10-21T10:00:00.000Z', 9, 'many')]),
        CONFIG,
        during,
      ).used,
    ).toBe(5)
  })

  it('makes a window of no extra days the claim day alone', () => {
    const window = finisherWindow(CLAIM, { ...CONFIG, windowDays: 0 })
    expect(window.end - window.start).toBe(DAY - 1)
  })
})
