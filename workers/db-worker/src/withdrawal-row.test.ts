import { describe, expect, it } from 'vitest'
import type { StatementRow } from './withdrawal-row'
import { refundLine } from './withdrawal-row'

/** A EUR 5.00 Starter pack cancelled with no consent on record (refundBasis
 *  'full'): every credit used, the whole price owed. */
function statement(overrides: Partial<StatementRow> = {}): StatementRow {
  return {
    id: 'statement-1',
    userId: 'user-1',
    purchaseId: 'purchase-1',
    paymentIntentId: 'pi_test_1',
    submittedAt: '2026-10-22T14:32:09.000Z',
    name: 'Sam Example',
    email: 'sam@example.test',
    packLabel: 'Starter',
    purchasedAt: '2026-10-21T10:00:00.000Z',
    paidCredits: 30,
    unusedCredits: 0,
    bonusCredits: 0,
    amountMinor: 500,
    refundMinor: 500,
    currency: 'eur',
    refundStatus: 'pending',
    stripeRefundId: null,
    refundError: null,
    mailStatus: null,
    mailAt: null,
    refundBasis: 'full',
    priceSource: 'checkout',
    stripeRefundStatus: null,
    ...overrides,
  }
}

describe('refundLine, for a pack with no consent on record', () => {
  it('names the whole price when the refund is the whole price', () => {
    expect(refundLine(statement())).toBe(
      'Refund: €5.00 of €5.00, pending, the whole price: no consent on record',
    )
  })

  it('names what is left of the price after an earlier refund', () => {
    // EUR 2.00 went back in the dashboard before the cancel.
    expect(refundLine(statement({ refundMinor: 300 }))).toBe(
      "Refund: €3.00 of €5.00, pending, what's left of the price: no consent on record",
    )
  })

  it('says the price less any earlier refund when the price is not on record', () => {
    expect(
      refundLine(
        statement({ priceSource: 'none', amountMinor: 0, refundMinor: 0 }),
      ),
    ).toBe(
      'Refund: the price less any earlier refund: no consent on record; the price paid is not on record',
    )
  })

  it('says the price less any earlier refund while Stripe has not said what was paid', () => {
    expect(
      refundLine(
        statement({ priceSource: 'pending', amountMinor: 0, refundMinor: 0 }),
      ),
    ).toBe(
      'Refund: the price less any earlier refund: no consent on record; Stripe has not said what was paid yet, and is asked again every 6 hours',
    )
    expect(
      refundLine(
        statement({
          priceSource: 'pending',
          amountMinor: 0,
          refundMinor: 0,
          refundStatus: 'manual',
        }),
      ),
    ).toBe(
      'Refund: the price less any earlier refund: no consent on record; Stripe has not said what was paid',
    )
  })
})

describe('refundLine, for a pack whose unused credits are refunded', () => {
  it('gives the share and no aside about consent', () => {
    expect(
      refundLine(
        statement({
          refundBasis: 'unused',
          unusedCredits: 21,
          refundMinor: 350,
        }),
      ),
    ).toBe('Refund: €3.50 of €5.00, pending')
  })
})
