import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BillingAlert } from './stripe-alerts'
import type { StripeGet } from './stripe-charge'
import type { StripeEventInput, StripeEventResult } from './stripe-payments'
import { HANDLED_EVENTS } from './stripe-payments'
import type { EventRecord, SweepPorts } from './stripe-sweep'
import { SWEEP_MAX_PAGES, SWEEP_MONEY_BACK_PER_RUN, sweepStripeEvents, } from './stripe-sweep'

const NOW = 1_790_000_000

function item(id: string, created: number, type = 'charge.refunded') {
  return {
    id,
    object: 'event',
    type,
    created,
    livemode: false,
    data: { object: {} },
  }
}

interface Fake {
  ports: SweepPorts
  paths: string[]
  applied: string[]
  /** The ids of each question put to billingEvents. */
  asked: string[][]
  alerts: Array<{ subject: string; lines: string[] }>
}

/** Ports over `pages` (each a page Stripe answers, or a status it fails
 *  with), an `apply` that answers per event id, and what billingEvents
 *  holds (`records`). */
function fake(
  pages: Array<Array<ReturnType<typeof item>> | number>,
  answer: (
    event: StripeEventInput,
    held: BillingAlert[] | undefined,
  ) => StripeEventResult = () => ({
    kind: 'applied',
  }),
  records: Record<string, EventRecord> = {},
): Fake {
  const queue = [...pages]
  const paths: string[] = []
  const applied: string[] = []
  const asked: string[][] = []
  const alerts: Fake['alerts'] = []
  const get: StripeGet = async (path) => {
    paths.push(path)
    const page = queue.shift() ?? []
    if (typeof page === 'number') return { ok: false, status: page, data: {} }
    return {
      ok: true,
      status: 200,
      data: { object: 'list', data: page, has_more: queue.length > 0 },
    }
  }
  return {
    paths,
    applied,
    asked,
    alerts,
    ports: {
      get,
      recorded: async (ids) => {
        asked.push(ids)
        return new Map(
          ids.flatMap(
            (id): Array<[string, EventRecord]> =>
              records[id] === undefined ? [] : [[id, records[id]]],
          ),
        )
      },
      apply: async (event, held) => {
        applied.push(event.id)
        return answer(event, held)
      },
      alert: async (subject, lines) => {
        alerts.push({ subject, lines })
      },
      nowSec: NOW,
    },
  }
}

function query(path: string): URLSearchParams {
  return new URL(`https://api.stripe.com/v1${path}`).searchParams
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('what the sweep lists', () => {
  it('asks for every handled type, from 30 days ago to ten minutes ago', async () => {
    const stripe = fake([[]])

    await sweepStripeEvents(stripe.ports)

    const asked = query(stripe.paths[0])
    expect(asked.getAll('types[]')).toEqual([...HANDLED_EVENTS])
    expect(asked.get('created[gte]')).toBe(String(NOW - 30 * 24 * 60 * 60))
    expect(asked.get('created[lte]')).toBe(String(NOW - 600))
    expect(asked.get('limit')).toBe('100')
  })

  it('pages on from the last event of each page', async () => {
    const stripe = fake([
      [item('evt_3', 3), item('evt_2', 2)],
      [item('evt_1', 1)],
    ])

    await sweepStripeEvents(stripe.ports)

    expect(query(stripe.paths[1]).get('starting_after')).toBe('evt_2')
  })

  it('applies the events oldest first', async () => {
    const stripe = fake([
      [item('evt_c', 30), item('evt_b2', 20), item('evt_b1', 20)],
      [item('evt_a', 10)],
    ])

    await sweepStripeEvents(stripe.ports)

    expect(stripe.applied).toEqual(['evt_a', 'evt_b1', 'evt_b2', 'evt_c'])
  })

  it('passes over an item that is not an event', async () => {
    const stripe = fake([[item('evt_1', 1), { object: 'event' } as never]])

    const report = await sweepStripeEvents(stripe.ports)

    expect(stripe.applied).toEqual(['evt_1'])
    expect(report.listed).toBe(1)
  })
})

describe('what the sweep reports', () => {
  it('tells the owner what it applied, since the webhook missed it', async () => {
    const stripe = fake(
      [[item('evt_2', 2), item('evt_1', 1, 'checkout.session.completed')]],
      (event) =>
        event.id === 'evt_1'
          ? { kind: 'applied', detail: '+30 credits, user=user_1' }
          : { kind: 'applied' },
    )

    await sweepStripeEvents(stripe.ports)

    expect(stripe.alerts).toHaveLength(1)
    expect(stripe.alerts[0].subject).toBe('Sweep recovered 2 missed event(s)')
    expect(stripe.alerts[0].lines).toContain(
      'evt_1 (checkout.session.completed): +30 credits, user=user_1',
    )
    expect(stripe.alerts[0].lines).toContain('evt_2 (charge.refunded)')
  })

  it('lists an event it could only acknowledge with the reason', async () => {
    const stripe = fake([[item('evt_1', 1)]], () => ({
      kind: 'ignored',
      reason: 'charge not found',
    }))

    await sweepStripeEvents(stripe.ports)

    expect(stripe.alerts[0].lines).toContain(
      'evt_1 (charge.refunded): acknowledged, charge not found',
    )
  })

  it('stays quiet about what was recorded already or is still unpaid', async () => {
    const stripe = fake([[item('evt_2', 2), item('evt_1', 1)]], (event) =>
      event.id === 'evt_1' ? { kind: 'duplicate' } : { kind: 'unpaid' },
    )

    const report = await sweepStripeEvents(stripe.ports)

    expect(stripe.alerts).toEqual([])
    expect(report.recovered).toEqual([])
  })

  it('goes on past an event that fails, and leaves it for the next run', async () => {
    const stripe = fake([[item('evt_2', 2), item('evt_1', 1)]], (event) => {
      if (event.id === 'evt_1') throw new Error('D1_ERROR: stubbed outage')
      return { kind: 'applied' }
    })

    const report = await sweepStripeEvents(stripe.ports)

    expect(stripe.applied).toEqual(['evt_1', 'evt_2'])
    expect(report.failed).toEqual([
      'evt_1 (charge.refunded): Error: D1_ERROR: stubbed outage',
    ])
    expect(stripe.alerts.map((alert) => alert.subject)).toEqual([
      'Sweep recovered 1 missed event(s)',
      'Sweep could not apply 1 event(s)',
    ])
  })
})

describe('what the sweep asks D1', () => {
  it('asks about a page of events in one question, and applies only the ones not recorded', async () => {
    const stripe = fake(
      [[item('evt_3', 3), item('evt_2', 2), item('evt_1', 1)]],
      undefined,
      { evt_2: 'recorded' },
    )

    await sweepStripeEvents(stripe.ports)

    expect(stripe.asked).toEqual([['evt_1', 'evt_2', 'evt_3']])
    expect(stripe.applied).toEqual(['evt_1', 'evt_3'])
  })

  it('asks once for every hundred events', async () => {
    const events = Array.from({ length: 150 }, (_, n) =>
      item(`evt_${n}`, 1000 - n, 'checkout.session.completed'),
    )
    const stripe = fake([events.slice(0, 100), events.slice(100)], () => ({
      kind: 'duplicate',
    }))

    await sweepStripeEvents(stripe.ports)

    expect(stripe.asked.map((ids) => ids.length)).toEqual([100, 50])
  })
})

describe('how much one run applies', () => {
  it('applies at most SWEEP_MONEY_BACK_PER_RUN refunds and disputes, and leaves the rest for the next run, past which it still applies purchases', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const refunds = Array.from(
      { length: SWEEP_MONEY_BACK_PER_RUN + 2 },
      (_, n) => item(`evt_refund_${n}`, 10 + n),
    )
    const late = item('evt_purchase', 1000, 'checkout.session.completed')
    const stripe = fake([[late, ...[...refunds].reverse()]])

    const report = await sweepStripeEvents(stripe.ports)

    expect(stripe.applied).toEqual([
      ...refunds.slice(0, SWEEP_MONEY_BACK_PER_RUN).map((event) => event.id),
      'evt_purchase',
    ])
    expect(report.left).toBe(2)
    expect(warn).toHaveBeenCalledWith(
      `[billing] sweep: applied ${SWEEP_MONEY_BACK_PER_RUN} refund and dispute event(s), the most one run applies; 2 left for the next run`,
    )
  })

  it('counts no recorded event against the cap', async () => {
    const recorded = Array.from({ length: SWEEP_MONEY_BACK_PER_RUN }, (_, n) =>
      item(`evt_done_${n}`, 10 + n),
    )
    const fresh = item('evt_fresh', 1000)
    const stripe = fake(
      [[fresh, ...[...recorded].reverse()]],
      undefined,
      Object.fromEntries(
        recorded.map((event): [string, EventRecord] => [event.id, 'recorded']),
      ),
    )

    const report = await sweepStripeEvents(stripe.ports)

    expect(stripe.applied).toEqual(['evt_fresh'])
    expect(report.left).toBe(0)
  })
})

describe('events migration 0065 reopened', () => {
  const tookBack: BillingAlert = {
    subject: 'Refund: took back 30 credit(s)',
    lines: ['Account: user_1', 'Balance after: 0 credit(s).'],
  }

  it('applies them with their alerts held, and sums them up in one alert that blames no webhook', async () => {
    const stripe = fake(
      [[item('evt_2', 2), item('evt_1', 1)]],
      (event, held) => {
        if (event.id === 'evt_1') held?.push(tookBack)
        return { kind: 'applied' }
      },
      { evt_1: 'reopened', evt_2: 'reopened' },
    )

    const report = await sweepStripeEvents(stripe.ports)

    expect(report.recovered).toEqual([])
    expect(report.reapplied).toEqual([
      'evt_1 (charge.refunded): Refund: took back 30 credit(s)',
      'evt_2 (charge.refunded): nothing moved now',
    ])
    expect(stripe.alerts.map((alert) => alert.subject)).toEqual([
      'Reapplied 2 event(s) after migration 0065',
    ])
    expect(stripe.alerts[0].lines).toEqual(
      expect.arrayContaining([
        'evt_1 (charge.refunded): Refund: took back 30 credit(s)',
        '  Account: user_1',
        '  Balance after: 0 credit(s).',
        'evt_2 (charge.refunded): nothing moved now',
      ]),
    )
    expect(stripe.alerts[0].lines.join('\n')).not.toContain('webhook delivery')
  })

  it('hands a missed event its alert, and reports it as missed, beside a reopened one', async () => {
    const heldFor: Record<string, boolean> = {}
    const stripe = fake(
      [[item('evt_2', 2), item('evt_1', 1)]],
      (event, held) => {
        heldFor[event.id] = held !== undefined
        return { kind: 'applied' }
      },
      { evt_1: 'reopened' },
    )

    await sweepStripeEvents(stripe.ports)

    expect(heldFor).toEqual({ evt_1: true, evt_2: false })
    expect(stripe.alerts.map((alert) => alert.subject)).toEqual([
      'Sweep recovered 1 missed event(s)',
      'Reapplied 1 event(s) after migration 0065',
    ])
  })

  it('still alerts a reopened event that fails', async () => {
    const stripe = fake(
      [[item('evt_1', 1)]],
      () => {
        throw new Error('D1_ERROR: stubbed outage')
      },
      { evt_1: 'reopened' },
    )

    const report = await sweepStripeEvents(stripe.ports)

    expect(report.failed).toEqual([
      'evt_1 (charge.refunded): Error: D1_ERROR: stubbed outage',
    ])
    expect(stripe.alerts.map((alert) => alert.subject)).toEqual([
      'Sweep could not apply 1 event(s)',
    ])
  })

  it('says in the summary how many refunds and disputes wait for the next run', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const events = Array.from(
      { length: SWEEP_MONEY_BACK_PER_RUN + 3 },
      (_, n) => item(`evt_${n}`, 10 + n),
    )
    const stripe = fake(
      [[...events].reverse()],
      undefined,
      Object.fromEntries(
        events.map((event): [string, EventRecord] => [event.id, 'reopened']),
      ),
    )

    await sweepStripeEvents(stripe.ports)

    expect(stripe.alerts[0].subject).toBe(
      `Reapplied ${SWEEP_MONEY_BACK_PER_RUN} event(s) after migration 0065`,
    )
    expect(stripe.alerts[0].lines).toContain(
      '3 more refund and dispute event(s) are left for the next run, in six hours.',
    )
  })
})

describe('a list Stripe will not give', () => {
  it('asks again once, and goes on when the second answer comes', async () => {
    const stripe = fake([503, [item('evt_1', 1)]])

    const report = await sweepStripeEvents(stripe.ports)

    expect(stripe.paths).toHaveLength(2)
    expect(report.incomplete).toBeNull()
    expect(stripe.applied).toEqual(['evt_1'])
  })

  it('says the sweep failed when the second answer fails too', async () => {
    const stripe = fake([500, 500])

    const report = await sweepStripeEvents(stripe.ports)

    expect(report.incomplete).toBe('Stripe answered 500 to the events list')
    expect(stripe.alerts.map((alert) => alert.subject)).toEqual([
      'Sweep failed: Stripe answered 500 to the events list',
    ])
  })

  it('applies what it listed before a later page failed, and says it stopped short', async () => {
    const stripe = fake([[item('evt_2', 2)], 502, 502])

    const report = await sweepStripeEvents(stripe.ports)

    expect(stripe.applied).toEqual(['evt_2'])
    expect(report.incomplete).toBe('Stripe answered 502 to the events list')
  })

  it('says Stripe could not be reached when the request throws', async () => {
    const stripe = fake([])
    stripe.ports.get = async () => {
      throw new TypeError('fetch failed')
    }

    const report = await sweepStripeEvents(stripe.ports)

    expect(report.incomplete).toBe(
      'Stripe could not be reached for the events list (TypeError: fetch failed)',
    )
  })

  it('stops at the page cap, and says the oldest were not listed', async () => {
    const pages = Array.from({ length: SWEEP_MAX_PAGES + 1 }, (_, page) => [
      item(`evt_${page}`, 100 - page),
    ])
    const stripe = fake(pages)

    const report = await sweepStripeEvents(stripe.ports)

    expect(stripe.paths).toHaveLength(SWEEP_MAX_PAGES)
    expect(report.incomplete).toBe(
      'more than 1000 events in 30 days, and the oldest were not listed',
    )
  })
})
