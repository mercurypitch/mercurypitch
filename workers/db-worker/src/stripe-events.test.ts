import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HANDLED_EVENTS, isCheckoutPaidEvent, isHandledEvent, isMoneyBackEvent, parseStripeEvent, readWebhookEvent, } from './stripe-events'

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

  it('handles the eight types the sweep lists, and no other', () => {
    expect([...HANDLED_EVENTS].sort()).toEqual([
      'charge.dispute.closed',
      'charge.dispute.created',
      'charge.dispute.funds_withdrawn',
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
