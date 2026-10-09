import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ledger, LedgerEntry } from './ledger'
import type { ChargeState } from './stripe-charge'
import { HANDLED_EVENTS, isCheckoutPaidEvent, isHandledEvent, isMoneyBackEvent, parseStripeEvent, paymentIntentOf, readWebhookEvent, settle, settlement, } from './stripe-payments'

describe('the events that grant and the events that take back', () => {
  it('grants from a completed checkout and from a delayed payment that arrived', () => {
    expect(isCheckoutPaidEvent('checkout.session.completed')).toBe(true)
    expect(
      isCheckoutPaidEvent('checkout.session.async_payment_succeeded'),
    ).toBe(true)
    expect(isCheckoutPaidEvent('checkout.session.async_payment_failed')).toBe(
      false,
    )
    expect(isCheckoutPaidEvent(undefined)).toBe(false)
  })

  it('moves credits on a refund and what becomes of it, and on a dispute opening or closing', () => {
    expect(isMoneyBackEvent('charge.refunded')).toBe(true)
    expect(isMoneyBackEvent('refund.updated')).toBe(true)
    expect(isMoneyBackEvent('refund.failed')).toBe(true)
    expect(isMoneyBackEvent('charge.dispute.created')).toBe(true)
    expect(isMoneyBackEvent('charge.dispute.closed')).toBe(true)
    expect(isMoneyBackEvent('charge.refund.updated')).toBe(false)
    expect(isMoneyBackEvent('charge.dispute.updated')).toBe(false)
    expect(isMoneyBackEvent('charge.succeeded')).toBe(false)
  })

  it('handles the seven types the sweep lists, and no other', () => {
    expect([...HANDLED_EVENTS].sort()).toEqual([
      'charge.dispute.closed',
      'charge.dispute.created',
      'charge.refunded',
      'checkout.session.async_payment_succeeded',
      'checkout.session.completed',
      'refund.failed',
      'refund.updated',
    ])
    for (const type of HANDLED_EVENTS) expect(isHandledEvent(type)).toBe(true)
    expect(isHandledEvent('customer.created')).toBe(false)
    expect(isHandledEvent(undefined)).toBe(false)
  })
})

describe('paymentIntentOf', () => {
  it('reads the id a webhook carries, or the id of an expanded object', () => {
    expect(paymentIntentOf({ payment_intent: 'pi_1' })).toBe('pi_1')
    expect(paymentIntentOf({ payment_intent: { id: 'pi_2' } })).toBe('pi_2')
  })

  it('is null for a session with no payment behind it', () => {
    expect(paymentIntentOf({ payment_intent: null })).toBeNull()
    expect(paymentIntentOf({ payment_intent: '' })).toBeNull()
    expect(paymentIntentOf({})).toBeNull()
  })
})

/** A EUR 5.00 pack of 30 credits, nothing gone back, nothing held. */
const PACK = {
  granted: 30,
  gone: 0,
  paid: 500,
  heldByMoneyBack: 0,
  takenOtherwise: 0,
  mayGiveBack: false,
}

describe('settlement', () => {
  it('takes the share of what was granted that the money gone back makes due', () => {
    expect(settlement({ ...PACK, gone: 500 })).toEqual({ delta: -30, held: 30 })
    expect(settlement({ ...PACK, gone: 250 })).toEqual({ delta: -15, held: 15 })
  })

  it('rounds the share down, so a payment never loses a credit it kept', () => {
    expect(settlement({ ...PACK, gone: 100 })).toEqual({ delta: -6, held: 6 })
    expect(settlement({ ...PACK, gone: 1 })).toEqual({ delta: 0, held: 0 })
  })

  it('counts exactly in whole cents: a third of the money is a third of the credits', () => {
    const third = settlement({ ...PACK, granted: 30, paid: 300, gone: 100 })

    expect(third).toEqual({ delta: -10, held: 10 })
  })

  it('takes only what earlier events left owing', () => {
    const second = settlement({ ...PACK, gone: 500, heldByMoneyBack: 15 })

    expect(second).toEqual({ delta: -15, held: 30 })
  })

  it('never holds more than the payment granted, whatever Stripe reports', () => {
    expect(settlement({ ...PACK, gone: 900 })).toEqual({ delta: -30, held: 30 })
    expect(settlement({ ...PACK, gone: -50 })).toEqual({ delta: 0, held: 0 })
  })

  it('takes nothing from a payment that says it took no money', () => {
    expect(settlement({ ...PACK, paid: 0, gone: 500 })).toEqual({
      delta: 0,
      held: 0,
    })
  })

  it('counts what a withdrawal took as taken already', () => {
    // The withdrawal took 18 unused credits and refunded their share.
    const refundOfWithdrawal = settlement({
      ...PACK,
      gone: 300,
      takenOtherwise: 18,
    })

    expect(refundOfWithdrawal).toEqual({ delta: 0, held: 0 })
  })

  it('takes the rest after a withdrawal when the whole payment goes back', () => {
    const disputed = settlement({ ...PACK, gone: 500, takenOtherwise: 18 })

    expect(disputed).toEqual({ delta: -12, held: 12 })
  })

  it('gives back what is held past the due only for an event that may', () => {
    const won = { ...PACK, gone: 0, heldByMoneyBack: 30 }

    expect(settlement({ ...won, mayGiveBack: true })).toEqual({
      delta: 30,
      held: 0,
    })
    expect(settlement({ ...won, mayGiveBack: false })).toEqual({
      delta: 0,
      held: 30,
    })
  })
})

describe('settle', () => {
  function row(
    delta: number,
    reason: string,
    extra: Partial<LedgerEntry> = {},
  ): LedgerEntry {
    return { delta, reason, jobRef: null, idempotencyKey: null, ...extra }
  }

  /** A EUR 5.00 pack of 30 credits: 10 used, the other 20 taken by a
   *  withdrawal of it. */
  const withdrawn: Ledger = {
    version: '4:4:0',
    rows: [
      row(30, 'purchase', { paymentIntentId: 'pi_1' }),
      row(-10, 'uvr-job', { jobRef: 'job-1' }),
      row(-20, 'withdrawal', { jobRef: 'pi_1' }),
    ],
  }

  function charge(overrides: Partial<ChargeState> = {}): ChargeState {
    return {
      chargeId: 'ch_1',
      paymentIntentId: 'pi_1',
      amount: 500,
      amountRefunded: 500,
      currency: 'eur',
      disputes: [],
      ...overrides,
    }
  }

  const disputed = charge({
    disputes: [
      {
        id: 'dp_1',
        status: 'needs_response',
        amount: 500,
        currency: 'eur',
        reason: 'fraudulent',
        dueBy: null,
      },
    ],
  })

  /** A purchase with a consent on record, settled by its event alone. */
  const CONSENTED = {
    mayGiveBack: false,
    settledWhole: false,
    unusedWithoutConsent: null,
  }

  it('takes what the buyer used when a whole-payment refund follows a withdrawal of the unused credits', () => {
    const next = settle(withdrawn, 'pi_1', charge(), CONSENTED)

    expect(next).toEqual({
      delta: -10,
      granted: 30,
      held: 10,
      takenOtherwise: 20,
      settledWhole: false,
      keptUsed: false,
    })
  })

  it('takes nothing more from a payment a withdrawal refunded whole, by refund or dispute', () => {
    const terms = { ...CONSENTED, settledWhole: true }

    expect(settle(withdrawn, 'pi_1', charge(), terms)).toEqual({
      delta: 0,
      granted: 30,
      held: 0,
      takenOtherwise: 20,
      settledWhole: true,
      keptUsed: false,
    })
    expect(settle(withdrawn, 'pi_1', disputed, terms).delta).toBe(0)
  })

  it('leaves a buyer who used every credit owing nothing after a whole-price withdrawal', () => {
    const usedUp: Ledger = {
      version: '3:3:0',
      rows: [
        row(30, 'purchase', { paymentIntentId: 'pi_1' }),
        row(-30, 'uvr-job', { jobRef: 'job-1' }),
        row(0, 'withdrawal', { jobRef: 'pi_1' }),
      ],
    }

    const next = settle(usedUp, 'pi_1', charge(), {
      ...CONSENTED,
      settledWhole: true,
    })

    expect(next.delta).toBe(0)
    expect(next.held).toBe(0)
  })

  /** The same EUR 5.00 pack of 30, 10 used, nothing withdrawn: bought with
   *  no consent on record. */
  const partUsed: Ledger = {
    version: '2:2:20',
    rows: [
      row(30, 'purchase', { paymentIntentId: 'pi_1' }),
      row(-10, 'uvr-job', { jobRef: 'job-1' }),
    ],
  }
  const NO_CONSENT = { ...CONSENTED, unusedWithoutConsent: 20 }

  it('takes back only what is unused when the whole price of a purchase with no consent on record is refunded', () => {
    expect(settle(partUsed, 'pi_1', charge(), NO_CONSENT)).toEqual({
      delta: -20,
      granted: 30,
      held: 20,
      takenOtherwise: 0,
      settledWhole: false,
      keptUsed: true,
    })
  })

  it('takes nothing more once the unused credits are gone', () => {
    const taken: Ledger = {
      version: '3:3:0',
      rows: [...partUsed.rows, row(-20, 'purchase-refund', { jobRef: 'pi_1' })],
    }

    const next = settle(taken, 'pi_1', disputed, {
      ...NO_CONSENT,
      unusedWithoutConsent: 0,
    })

    expect(next.delta).toBe(0)
    expect(next.held).toBe(20)
  })

  it('settles a part refund of a purchase with no consent on record by its share', () => {
    const half = settle(partUsed, 'pi_1', charge({ amountRefunded: 250 }), {
      ...NO_CONSENT,
    })

    expect(half).toMatchObject({ delta: -15, held: 15, keptUsed: false })
  })

  it('takes every credit back, used ones too, when the buyer gave the consent', () => {
    const whole = settle(partUsed, 'pi_1', charge(), CONSENTED)

    expect(whole).toMatchObject({ delta: -30, held: 30, keptUsed: false })
  })
})

describe('parseStripeEvent', () => {
  it('reads the id, type, mode, time and object of an event', () => {
    const event = parseStripeEvent({
      id: 'evt_1',
      type: 'charge.refunded',
      livemode: true,
      created: 1_790_000_000,
      data: { object: { id: 'ch_1' } },
    })

    expect(event).toEqual({
      id: 'evt_1',
      type: 'charge.refunded',
      livemode: true,
      created: 1_790_000_000,
      object: { id: 'ch_1' },
    })
  })

  it('fills what an event leaves out with values that apply nothing', () => {
    expect(parseStripeEvent({ id: 'evt_2' })).toEqual({
      id: 'evt_2',
      type: '',
      livemode: false,
      created: 0,
      object: {},
    })
  })

  it('says why it holds no event', () => {
    expect(parseStripeEvent(null)).toEqual({ ignored: 'malformed payload' })
    expect(parseStripeEvent([{ id: 'evt_3' }])).toEqual({
      ignored: 'malformed payload',
    })
    expect(parseStripeEvent({ id: '' })).toEqual({
      ignored: 'missing event id',
    })
    expect(parseStripeEvent({ id: 42 })).toEqual({
      ignored: 'missing event id',
    })
  })
})

describe('readWebhookEvent', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads an event of a handled type', () => {
    const payload = JSON.stringify({
      id: 'evt_1',
      type: 'charge.dispute.closed',
      data: { object: { id: 'dp_1' } },
    })

    expect(readWebhookEvent(payload)).toMatchObject({
      id: 'evt_1',
      type: 'charge.dispute.closed',
    })
  })

  it('acknowledges a type nothing here handles without reading further', () => {
    const payload = JSON.stringify({ id: 'evt_2', type: 'invoice.paid' })

    expect(readWebhookEvent(payload)).toEqual({
      ignored: 'unhandled event type',
    })
  })

  it('acknowledges a body nobody can read, and logs none of it', () => {
    const warn = vi.spyOn(console, 'warn')

    expect(readWebhookEvent('{"id": "evt_3", "type": "charge.ref')).toEqual({
      ignored: 'malformed payload',
    })
    expect(warn).toHaveBeenCalledWith(
      '[billing] webhook: malformed payload, acknowledged unread',
    )
  })
})
