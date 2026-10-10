import { describe, expect, it } from 'vitest'
import type { BillingAlert, CreditsMoved, EventRef, MoneyBackFacts, } from './stripe-alerts'
import { earlyMoneyBackAlert, moneyBackAlert, nothingOnRecordAlert, notAppliedAlert, } from './stripe-alerts'
import type { ChargeState, DisputeState } from './stripe-charge'

function ref(type: string, livemode = true): EventRef {
  return { id: 'evt_1', type, livemode }
}

function dispute(overrides: Partial<DisputeState> = {}): DisputeState {
  return {
    id: 'dp_1',
    status: 'needs_response',
    amount: 500,
    currency: 'eur',
    reason: 'fraudulent',
    // 2026-10-30 23:59:59 UTC.
    dueBy: 1_793_404_799,
    refundable: false,
    ...overrides,
  }
}

function charge(overrides: Partial<ChargeState> = {}): ChargeState {
  return {
    chargeId: 'ch_1',
    paymentIntentId: 'pi_1',
    amount: 500,
    amountRefunded: 0,
    currency: 'eur',
    disputes: [],
    ...overrides,
  }
}

/** The event is about this dispute. */
function about(disputed: DisputeState): MoneyBackFacts {
  return { dispute: disputed, refundEnded: null }
}

const REFUND: MoneyBackFacts = { dispute: null, refundEnded: null }

function ended(how: 'failed' | 'canceled'): MoneyBackFacts {
  return { dispute: null, refundEnded: how }
}

function moved(overrides: Partial<CreditsMoved> = {}): CreditsMoved {
  return {
    userId: 'user_1',
    delta: -30,
    granted: 30,
    held: 30,
    takenOtherwise: 0,
    settledWhole: false,
    keptUsed: 0,
    balance: 0,
    ...overrides,
  }
}

function text(alert: BillingAlert | null): string {
  return alert === null ? '' : alert.lines.join('\n')
}

describe('a dispute opening', () => {
  it('names the amount and the evidence deadline, and links to the answer', () => {
    const alert = moneyBackAlert(
      ref('charge.dispute.created'),
      charge({ disputes: [dispute()] }),
      moved(),
      about(dispute()),
    )

    expect(alert?.subject).toBe(
      'Dispute opened: €5.00, evidence due 30 October 2026',
    )
    expect(text(alert)).toContain('Reason: fraudulent')
    expect(text(alert)).toContain('Evidence due: 30 October 2026, 23:59 UTC')
    expect(text(alert)).toContain('https://dashboard.stripe.com/disputes/dp_1')
    expect(text(alert)).toContain(
      'If you win, the credits come back by themselves.',
    )
  })

  it('links to the test Dashboard for a test-mode event', () => {
    const alert = moneyBackAlert(
      ref('charge.dispute.created', false),
      charge({ disputes: [dispute()] }),
      moved(),
      about(dispute()),
    )

    expect(text(alert)).toContain(
      'https://dashboard.stripe.com/test/disputes/dp_1',
    )
  })

  it('calls an inquiry an inquiry, with no money moved yet', () => {
    const alert = moneyBackAlert(
      ref('charge.dispute.created'),
      charge({ disputes: [dispute({ status: 'warning_needs_response' })] }),
      moved(),
      about(dispute({ status: 'warning_needs_response' })),
    )

    expect(alert?.subject).toMatch(/^Inquiry opened: €5\.00/)
    expect(text(alert)).toContain('No money has moved yet')
  })

  it('says so when the opening is read after the bank decided', () => {
    const alert = moneyBackAlert(
      ref('charge.dispute.created'),
      charge({ disputes: [dispute({ status: 'won' })] }),
      moved({ delta: 0, held: 0 }),
      about(dispute({ status: 'won' })),
    )

    expect(alert?.subject).toBe('Dispute opened: €5.00, closed since as won')
    expect(text(alert)).not.toContain('If you win')
  })

  it('says what was spent already and is now owed', () => {
    const alert = moneyBackAlert(
      ref('charge.dispute.created'),
      charge({ disputes: [dispute()] }),
      moved({ balance: -25 }),
      about(dispute()),
    )

    expect(text(alert)).toContain(
      'Balance after: -25 credit(s). 25 of them were already spent',
    )
  })

  it('says a whole-price withdrawal is why a dispute takes nothing', () => {
    const alert = moneyBackAlert(
      ref('charge.dispute.created'),
      charge({ amountRefunded: 500 }),
      moved({ delta: 0, held: 0, takenOtherwise: 20, settledWhole: true }),
      about(dispute()),
    )

    expect(text(alert)).toContain(
      "A withdrawal refunded this payment's price, less any earlier refund (no consent on record): the credits the buyer used stay theirs, so no refund or dispute takes any back.",
    )
  })

  it('says nothing of a whole-price withdrawal when there was none', () => {
    const alert = moneyBackAlert(
      ref('charge.dispute.created'),
      charge(),
      moved(),
      about(dispute()),
    )

    expect(text(alert)).not.toContain('whole price')
  })
})

describe('a dispute closing', () => {
  it('gives the credits back when it is won', () => {
    const alert = moneyBackAlert(
      ref('charge.dispute.closed'),
      charge({ disputes: [dispute({ status: 'won' })] }),
      moved({ delta: 30, held: 0, balance: 30 }),
      about(dispute({ status: 'won' })),
    )

    expect(alert?.subject).toBe('Dispute won: gave back 30 credit(s)')
  })

  it('says nothing came back when nothing was held', () => {
    const alert = moneyBackAlert(
      ref('charge.dispute.closed'),
      charge({ disputes: [dispute({ status: 'won' })] }),
      moved({ delta: 0, held: 0 }),
      about(dispute({ status: 'won' })),
    )

    expect(alert?.subject).toBe('Dispute won: no credits to give back')
  })

  it('keeps the credits taken when it is lost', () => {
    const alert = moneyBackAlert(
      ref('charge.dispute.closed'),
      charge({ disputes: [dispute({ status: 'lost' })] }),
      moved({ delta: 0 }),
      about(dispute({ status: 'lost' })),
    )

    expect(alert?.subject).toBe(
      'Dispute lost: €5.00 gone, 30 credit(s) stay taken back',
    )
  })

  it('treats an inquiry closed without a chargeback like a win', () => {
    const alert = moneyBackAlert(
      ref('charge.dispute.closed'),
      charge({ disputes: [dispute({ status: 'warning_closed' })] }),
      moved({ delta: 30, held: 0 }),
      about(dispute({ status: 'warning_closed' })),
    )

    expect(alert?.subject).toBe('Inquiry closed: gave back 30 credit(s)')
  })

  it('says a prevented dispute holds nothing, and why', () => {
    const alert = moneyBackAlert(
      ref('charge.dispute.closed'),
      charge({ disputes: [dispute({ status: 'prevented' })] }),
      moved({ delta: 30, held: 0 }),
      about(dispute({ status: 'prevented' })),
    )

    expect(alert?.subject).toBe('Dispute prevented: gave back 30 credit(s)')
    expect(text(alert)).toContain(
      'stopped before it became a chargeback, so it holds no credits',
    )
  })
})

describe("a dispute's money leaving the balance", () => {
  it('says an inquiry became a chargeback, and what it took back', () => {
    const escalated = dispute({ status: 'needs_response' })
    const alert = moneyBackAlert(
      ref('charge.dispute.funds_withdrawn'),
      charge({ disputes: [escalated] }),
      moved(),
      about(escalated),
    )

    expect(alert?.subject).toBe(
      'Chargeback: €5.00 taken from your Stripe balance',
    )
    expect(text(alert)).toContain(
      "turned this payment's inquiry into a chargeback",
    )
    expect(text(alert)).toContain('Taken back now: 30 credit(s)')
    expect(text(alert)).toContain(
      'If you win, the credits come back by themselves.',
    )
  })

  it("needs no alert when the chargeback's opening took the credits already", () => {
    const alert = moneyBackAlert(
      ref('charge.dispute.funds_withdrawn'),
      charge({ disputes: [dispute()] }),
      moved({ delta: 0 }),
      about(dispute()),
    )

    expect(alert).toBeNull()
  })
})

describe('a refund', () => {
  it('says what it took back and how much was refunded', () => {
    const alert = moneyBackAlert(
      ref('charge.refunded'),
      charge({ amountRefunded: 250 }),
      moved({ delta: -15, held: 15, balance: 15 }),
      REFUND,
    )

    expect(alert?.subject).toBe('Refund: took back 15 credit(s)')
    expect(text(alert)).toContain('Refunded so far: €2.50 of a €5.00 payment.')
  })

  it('says how many used credits a purchase with no consent on record leaves the buyer', () => {
    const alert = moneyBackAlert(
      ref('charge.refunded'),
      charge({ amountRefunded: 500 }),
      moved({ delta: -20, held: 20, keptUsed: 10, balance: 0 }),
      REFUND,
    )

    expect(alert?.subject).toBe('Refund: took back 20 credit(s)')
    expect(text(alert)).toContain(
      'This purchase has no consent on record, or its purchase mail has not confirmed one yet, so refunds and disputes take back only credits still unused: 10 credit(s) the buyer used stay theirs.',
    )
  })

  it('needs no alert when it moved nothing', () => {
    const alert = moneyBackAlert(
      ref('charge.refunded'),
      charge({ amountRefunded: 300 }),
      moved({ delta: 0, held: 0, takenOtherwise: 18 }),
      REFUND,
    )

    expect(alert).toBeNull()
  })

  it('gives back what a failed refund took, and says the buyer still waits', () => {
    const alert = moneyBackAlert(
      ref('refund.failed'),
      charge(),
      moved({ delta: 30, held: 0, balance: 30 }),
      ended('failed'),
    )

    expect(alert?.subject).toBe('Refund failed: gave back 30 credit(s)')
    expect(text(alert)).toContain('Pay them back another way')
  })

  it('gives back what a canceled refund took', () => {
    const alert = moneyBackAlert(
      ref('refund.updated'),
      charge(),
      moved({ delta: 15, held: 0, balance: 30 }),
      ended('canceled'),
    )

    expect(alert?.subject).toBe('Refund canceled: gave back 15 credit(s)')
    expect(text(alert)).toContain('canceled before it reached the buyer')
  })

  it('says what a withdrawal took when a hand refund of its payment fails', () => {
    const alert = moneyBackAlert(
      ref('refund.failed'),
      charge(),
      moved({ delta: 0, held: 0, takenOtherwise: 18 }),
      ended('failed'),
    )

    expect(alert?.subject).toBe('Refund failed: no credits to give back')
    expect(text(alert)).toContain(
      '18 credit(s) of this payment were taken back by a withdrawal',
    )
  })

  it('needs no alert for a refund update that ended nothing and moved nothing', () => {
    const alert = moneyBackAlert(
      ref('refund.updated'),
      charge({ amountRefunded: 500 }),
      moved({ delta: 0 }),
      REFUND,
    )

    expect(alert).toBeNull()
  })
})

describe('a payment with no credits on record', () => {
  it('says the credits are taken back if its purchase arrives later', () => {
    const alert = nothingOnRecordAlert(
      ref('charge.refunded'),
      charge({ amountRefunded: 500 }),
      null,
      REFUND,
    )

    expect(alert.subject).toBe('Refund with no credits on record')
    expect(text(alert)).toContain('so none were taken back')
    expect(text(alert)).toContain('any credits still due are taken back then')
  })

  it('says a refund failed even when no credits name its payment', () => {
    const alert = nothingOnRecordAlert(
      ref('refund.failed'),
      charge(),
      null,
      ended('failed'),
    )

    expect(alert.subject).toBe('Refund failed (no credits on record)')
    expect(text(alert)).toContain('the buyer has not received it')
    expect(text(alert)).toContain('so none were given back')
  })

  it('names the donor of a donation, and the badge that stays', () => {
    const alert = nothingOnRecordAlert(
      ref('charge.dispute.created'),
      charge({ disputes: [dispute()] }),
      { userId: 'user_9' },
      about(dispute()),
    )

    expect(alert.subject).toBe(
      'Dispute opened: €5.00, evidence due 30 October 2026',
    )
    expect(text(alert)).toContain('donation from account user_9')
    expect(text(alert)).toContain('supporter badge stays')
  })
})

describe('an event that could not be applied', () => {
  it('says which kind, and why', () => {
    const refund = notAppliedAlert(
      ref('charge.refunded'),
      'Stripe knows no charge ch_gone',
      null,
    )
    const failed = notAppliedAlert(
      ref('refund.failed'),
      'it names no charge',
      null,
    )
    const update = notAppliedAlert(
      ref('refund.updated'),
      'it names no charge',
      null,
    )
    const opened = notAppliedAlert(
      ref('charge.dispute.created'),
      'it names no charge',
      dispute(),
    )

    expect(refund.subject).toBe('Refund that could not be applied')
    expect(text(refund)).toContain(
      'no credits: Stripe knows no charge ch_gone.',
    )
    expect(failed.subject).toBe('Failed refund that could not be applied')
    expect(update.subject).toBe('Refund update that could not be applied')
    expect(opened.subject).toBe('Dispute that could not be applied')
    expect(text(opened)).toContain('Reason: fraudulent')
  })
})

describe('a purchase that landed after its money went back', () => {
  it('says what it took back at once', () => {
    const alert = earlyMoneyBackAlert(
      'evt_purchase',
      charge({ amountRefunded: 500 }),
      moved(),
    )

    expect(alert.subject).toBe(
      'Refund before its purchase: took back 30 credit(s)',
    )
    expect(text(alert)).toContain('Purchase event: evt_purchase')
  })

  it('calls it a dispute while one holds, and names each dispute', () => {
    const alert = earlyMoneyBackAlert(
      'evt_purchase',
      charge({ disputes: [dispute()] }),
      moved(),
    )

    expect(alert.subject).toBe(
      'Dispute before its purchase: took back 30 credit(s)',
    )
    expect(text(alert)).toContain('Dispute dp_1: needs_response')
  })
})

describe('every alert', () => {
  it('carries no email address, no card details and no em dash', () => {
    const all = [
      moneyBackAlert(
        ref('charge.dispute.created'),
        charge({ disputes: [dispute()] }),
        moved({ balance: -5 }),
        about(dispute()),
      ),
      moneyBackAlert(
        ref('charge.dispute.funds_withdrawn'),
        charge({ disputes: [dispute()] }),
        moved(),
        about(dispute()),
      ),
      moneyBackAlert(
        ref('charge.dispute.closed'),
        charge({ disputes: [dispute({ status: 'lost' })] }),
        moved(),
        about(dispute({ status: 'lost' })),
      ),
      moneyBackAlert(
        ref('charge.dispute.closed'),
        charge({ disputes: [dispute({ status: 'prevented' })] }),
        moved({ delta: 30 }),
        about(dispute({ status: 'prevented' })),
      ),
      moneyBackAlert(
        ref('charge.refunded'),
        charge({ amountRefunded: 500 }),
        moved(),
        REFUND,
      ),
      moneyBackAlert(
        ref('refund.failed'),
        charge(),
        moved({ delta: 30 }),
        ended('failed'),
      ),
      moneyBackAlert(
        ref('refund.updated'),
        charge(),
        moved({ delta: 30 }),
        ended('canceled'),
      ),
      nothingOnRecordAlert(ref('charge.refunded'), charge(), null, REFUND),
      nothingOnRecordAlert(
        ref('refund.failed'),
        charge(),
        null,
        ended('failed'),
      ),
      notAppliedAlert(ref('charge.refunded'), 'it names no charge', null),
      earlyMoneyBackAlert('evt_p', charge({ disputes: [dispute()] }), moved()),
    ]

    for (const alert of all) {
      const whole = `${alert?.subject ?? ''}\n${text(alert)}`
      expect(whole).not.toMatch(
        /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
      )
      expect(whole).not.toMatch(/last4|4242/)
      expect(whole).not.toContain('—')
    }
  })
})
