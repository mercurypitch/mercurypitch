import { describe, expect, it } from 'vitest'
import { creditsToTake, isCheckoutPaidEvent, isMoneyBackEvent, paymentIntentOf, refundedShare, } from './stripe-payments'

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

  it('takes back on a refund and on a dispute, and on nothing else', () => {
    expect(isMoneyBackEvent('charge.refunded')).toBe(true)
    expect(isMoneyBackEvent('charge.dispute.created')).toBe(true)
    expect(isMoneyBackEvent('charge.dispute.closed')).toBe(false)
    expect(isMoneyBackEvent('charge.refund.updated')).toBe(false)
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

describe('refundedShare', () => {
  it('is the whole payment for a dispute, whatever the event says', () => {
    expect(refundedShare('charge.dispute.created', { amount: 100 })).toBe(1)
  })

  it('reads the refunded amount so far against the charge', () => {
    const charge = { amount: 500, amount_refunded: 250, refunded: false }
    expect(refundedShare('charge.refunded', charge)).toBe(0.5)
    expect(
      refundedShare('charge.refunded', { ...charge, refunded: true }),
    ).toBe(1)
  })

  it('never passes the whole payment, nor reads a broken charge as any', () => {
    expect(
      refundedShare('charge.refunded', { amount: 500, amount_refunded: 900 }),
    ).toBe(1)
    expect(
      refundedShare('charge.refunded', { amount: 0, amount_refunded: 0 }),
    ).toBe(0)
    expect(refundedShare('charge.refunded', {})).toBe(0)
  })
})

describe('creditsToTake', () => {
  it('takes the share of what was granted, rounded down', () => {
    expect(
      creditsToTake({ granted: 65, share: 0.5, taken: 0, balance: 100 }),
    ).toEqual({ take: 32, owed: 32 })
  })

  it('takes only what earlier events left owing', () => {
    expect(
      creditsToTake({ granted: 30, share: 1, taken: 15, balance: 100 }),
    ).toEqual({ take: 15, owed: 15 })
    expect(
      creditsToTake({ granted: 30, share: 0.5, taken: 30, balance: 100 }),
    ).toEqual({ take: 0, owed: 0 })
  })

  it('never takes the balance below zero', () => {
    expect(
      creditsToTake({ granted: 30, share: 1, taken: 0, balance: 4 }),
    ).toEqual({ take: 4, owed: 30 })
    expect(
      creditsToTake({ granted: 30, share: 1, taken: 0, balance: -2 }),
    ).toEqual({ take: 0, owed: 30 })
  })
})
