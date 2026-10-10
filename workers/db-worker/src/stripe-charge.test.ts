import { describe, expect, it } from 'vitest'
import type { ChargeState, DisputeState, ReadFor, StripeGet, } from './stripe-charge'
import { chargeFrom, chargeIdOf, disputeFrom, disputeHolds, moneyGoneBack, readCharge, refundBarredByDispute, StripeUnavailable, } from './stripe-charge'

const CHARGE = {
  id: 'ch_1',
  object: 'charge',
  amount: 500,
  amount_refunded: 0,
  refunded: false,
  disputed: false,
  currency: 'eur',
  payment_intent: 'pi_1',
  // What a real charge carries and nothing here may copy.
  receipt_email: 'buyer@example.test',
  billing_details: { email: 'buyer@example.test', name: 'Fake Buyer' },
  payment_method_details: { card: { brand: 'visa', last4: '4242' } },
}

const DISPUTE = {
  id: 'dp_1',
  object: 'dispute',
  amount: 500,
  charge: 'ch_1',
  currency: 'eur',
  reason: 'fraudulent',
  status: 'needs_response',
  evidence_details: { due_by: 1_793_404_799 },
  is_charge_refundable: false,
}

function refund(id: string, amount: number, status: string) {
  return { id, object: 'refund', amount, charge: 'ch_1', status }
}

function state(overrides: Partial<ChargeState> = {}): ChargeState {
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

function dispute(overrides: Partial<DisputeState> = {}): DisputeState {
  return {
    id: 'dp_1',
    status: 'needs_response',
    amount: 500,
    currency: 'eur',
    reason: 'fraudulent',
    dueBy: null,
    refundable: false,
    ...overrides,
  }
}

const NOTHING: ReadFor = { refund: false, dispute: null }

type Page = Record<string, unknown> | number

/** A Stripe that answers each path from `pages`: the charge at
 *  /charges/ch_1, and a list page (or a failing status) per read of
 *  /refunds and /disputes. */
function stripe(pages: Record<string, Page[]>) {
  const paths: string[] = []
  const get: StripeGet = async (path) => {
    paths.push(path)
    const answer = pages[path.split('?')[0]]?.shift()
    if (answer === undefined) throw new Error(`unexpected read ${path}`)
    if (typeof answer === 'number') {
      return { ok: false, status: answer, data: {} }
    }
    return { ok: true, status: 200, data: answer }
  }
  return { get, paths }
}

function list(data: object[], hasMore = false): Record<string, unknown> {
  return { object: 'list', data, has_more: hasMore }
}

describe('chargeFrom', () => {
  it('reads the ids and the amounts, and nothing about the buyer', () => {
    const charge = chargeFrom({ ...CHARGE, amount_refunded: 200 })

    expect(charge).toEqual({
      chargeId: 'ch_1',
      paymentIntentId: 'pi_1',
      amount: 500,
      amountRefunded: 200,
      currency: 'eur',
      disputes: [],
    })
    expect(JSON.stringify(charge)).not.toContain('example.test')
    expect(JSON.stringify(charge)).not.toContain('4242')
  })

  it('reads nothing from an object that is not a charge', () => {
    expect(chargeFrom(null)).toBeNull()
    expect(chargeFrom({ id: 'ch_1' })).toBeNull()
    expect(chargeFrom({ amount: 500 })).toBeNull()
  })
})

describe('chargeIdOf', () => {
  it('finds the charge each money-back event is about', () => {
    expect(chargeIdOf('charge.refunded', { id: 'ch_1' })).toBe('ch_1')
    expect(chargeIdOf('charge.dispute.created', { charge: 'ch_2' })).toBe(
      'ch_2',
    )
    expect(
      chargeIdOf('charge.dispute.closed', { charge: { id: 'ch_3' } }),
    ).toBe('ch_3')
    expect(chargeIdOf('refund.failed', { id: 're_1', charge: 'ch_4' })).toBe(
      'ch_4',
    )
    expect(chargeIdOf('refund.updated', { id: 're_1', charge: 'ch_5' })).toBe(
      'ch_5',
    )
  })

  it('refuses an id that would change the path it is read from', () => {
    expect(
      chargeIdOf('charge.refunded', { id: '../customers/cus_1' }),
    ).toBeNull()
    expect(
      chargeIdOf('charge.refunded', { id: 'ch_1?expand[]=customer' }),
    ).toBeNull()
    expect(chargeIdOf('refund.failed', { charge: 'ch_1&limit=1' })).toBeNull()
    expect(chargeIdOf('charge.dispute.created', { charge: '' })).toBeNull()
    expect(chargeIdOf('charge.dispute.created', {})).toBeNull()
  })
})

describe('readCharge', () => {
  it('reads only the charge when it says nothing went back', async () => {
    const api = stripe({ '/charges/ch_1': [CHARGE] })

    const charge = await readCharge(api.get, 'ch_1', NOTHING)

    expect(api.paths).toEqual(['/charges/ch_1'])
    expect(charge).toEqual(state())
  })

  it('adds up the refunds that did not fail or get canceled', async () => {
    const api = stripe({
      '/charges/ch_1': [{ ...CHARGE, amount_refunded: 450 }],
      '/refunds': [
        list([
          refund('re_4', 50, 'pending'),
          refund('re_3', 100, 'canceled'),
          refund('re_2', 100, 'failed'),
          refund('re_1', 200, 'succeeded'),
        ]),
      ],
    })

    const charge = await readCharge(api.get, 'ch_1', NOTHING)

    expect(api.paths).toEqual([
      '/charges/ch_1',
      '/refunds?charge=ch_1&limit=100',
    ])
    expect(charge).toMatchObject({ amountRefunded: 250, disputes: [] })
  })

  it('counts a refund in a status it does not know as gone', async () => {
    const api = stripe({
      '/charges/ch_1': [{ ...CHARGE, amount_refunded: 500 }],
      '/refunds': [list([refund('re_1', 500, 'requires_action')])],
    })

    const charge = await readCharge(api.get, 'ch_1', NOTHING)

    expect(charge).toMatchObject({ amountRefunded: 500 })
  })

  it('reads the refunds for a refund event even when the charge says none', async () => {
    const api = stripe({
      '/charges/ch_1': [CHARGE],
      '/refunds': [list([refund('re_1', 500, 'failed')])],
    })

    const charge = await readCharge(api.get, 'ch_1', {
      refund: true,
      dispute: null,
    })

    expect(api.paths).toContain('/refunds?charge=ch_1&limit=100')
    expect(charge).toMatchObject({ amountRefunded: 0 })
  })

  it('pages through the refunds from the last one read', async () => {
    const api = stripe({
      '/charges/ch_1': [{ ...CHARGE, amount_refunded: 300 }],
      '/refunds': [
        list([refund('re_2', 100, 'succeeded')], true),
        list([refund('re_1', 200, 'succeeded')]),
      ],
    })

    const charge = await readCharge(api.get, 'ch_1', NOTHING)

    expect(api.paths.at(-1)).toBe(
      '/refunds?charge=ch_1&limit=100&starting_after=re_2',
    )
    expect(charge).toMatchObject({ amountRefunded: 300 })
  })

  it('lists the disputes of a charge that says it is disputed', async () => {
    const api = stripe({
      '/charges/ch_1': [{ ...CHARGE, disputed: true }],
      '/disputes': [list([DISPUTE])],
    })

    const charge = await readCharge(api.get, 'ch_1', NOTHING)

    expect(api.paths).toEqual([
      '/charges/ch_1',
      '/disputes?charge=ch_1&limit=100',
    ])
    expect(charge).toMatchObject({
      disputes: [
        {
          id: 'dp_1',
          status: 'needs_response',
          amount: 500,
          currency: 'eur',
          reason: 'fraudulent',
          dueBy: 1_793_404_799,
          refundable: false,
        },
      ],
    })
  })

  it('reads the dispute from Stripe, not from the event that carried it', async () => {
    const api = stripe({
      '/charges/ch_1': [{ ...CHARGE, disputed: true }],
      '/disputes': [list([{ ...DISPUTE, status: 'won' }])],
    })

    const charge = await readCharge(api.get, 'ch_1', {
      refund: false,
      dispute: dispute({ status: 'needs_response' }),
    })

    expect(charge).toMatchObject({ disputes: [{ id: 'dp_1', status: 'won' }] })
  })

  it("keeps the event's dispute when Stripe's list lacks it", async () => {
    const api = stripe({
      '/charges/ch_1': [CHARGE],
      '/disputes': [list([])],
    })

    const charge = await readCharge(api.get, 'ch_1', {
      refund: false,
      dispute: dispute({ id: 'dp_new' }),
    })

    expect(charge).toMatchObject({ disputes: [{ id: 'dp_new' }] })
  })

  it('says the charge is missing when Stripe knows no such charge', async () => {
    const api = stripe({ '/charges/ch_gone': [404] })

    expect(await readCharge(api.get, 'ch_gone', NOTHING)).toBe('missing')
  })

  it('throws, so the event is tried again, when Stripe cannot answer', async () => {
    for (const status of [401, 429, 500, 503]) {
      const api = stripe({ '/charges/ch_1': [status] })

      await expect(readCharge(api.get, 'ch_1', NOTHING)).rejects.toBeInstanceOf(
        StripeUnavailable,
      )
    }
  })

  it('throws when Stripe will not list the refunds or the disputes', async () => {
    const refunds = stripe({
      '/charges/ch_1': [{ ...CHARGE, amount_refunded: 500 }],
      '/refunds': [503],
    })
    const disputes = stripe({
      '/charges/ch_1': [{ ...CHARGE, disputed: true }],
      '/disputes': [404],
    })

    await expect(
      readCharge(refunds.get, 'ch_1', NOTHING),
    ).rejects.toBeInstanceOf(StripeUnavailable)
    await expect(
      readCharge(disputes.get, 'ch_1', NOTHING),
    ).rejects.toBeInstanceOf(StripeUnavailable)
  })

  it('throws when Stripe answers with something it does not read', async () => {
    const notACharge = stripe({ '/charges/ch_1': [{ object: 'list' }] })
    const notAList = stripe({
      '/charges/ch_1': [{ ...CHARGE, amount_refunded: 500 }],
      '/refunds': [{ object: 'refund' }],
    })

    await expect(
      readCharge(notACharge.get, 'ch_1', NOTHING),
    ).rejects.toBeInstanceOf(StripeUnavailable)
    await expect(
      readCharge(notAList.get, 'ch_1', NOTHING),
    ).rejects.toBeInstanceOf(StripeUnavailable)
  })

  it('gives up on a list that never ends', async () => {
    const pages = Array.from({ length: 6 }, (_, page) =>
      list([refund(`re_${page}`, 1, 'succeeded')], true),
    )
    const api = stripe({
      '/charges/ch_1': [{ ...CHARGE, amount_refunded: 6 }],
      '/refunds': pages,
    })

    await expect(readCharge(api.get, 'ch_1', NOTHING)).rejects.toThrow(
      'ch_1 lists more refunds than 500',
    )
    expect(api.paths).toHaveLength(6)
  })
})

describe('disputeHolds', () => {
  it('holds from the moment a chargeback opens, and for good once it is lost', () => {
    for (const status of ['needs_response', 'under_review', 'lost']) {
      expect(disputeHolds(dispute({ status }))).toBe(true)
    }
  })

  it('holds nothing for an inquiry, where no money has moved', () => {
    for (const status of ['warning_needs_response', 'warning_under_review']) {
      expect(disputeHolds(dispute({ status, refundable: true }))).toBe(false)
    }
  })

  it('lets go once it ends in the merchant’s favor, or never became a chargeback', () => {
    expect(disputeHolds(dispute({ status: 'won' }))).toBe(false)
    expect(disputeHolds(dispute({ status: 'warning_closed' }))).toBe(false)
    expect(disputeHolds(dispute({ status: 'prevented' }))).toBe(false)
  })

  it('holds for a status Stripe adds later', () => {
    expect(disputeHolds(dispute({ status: 'escalated_somehow' }))).toBe(true)
  })
})

describe('whether Stripe will refund a disputed payment', () => {
  it("reads Stripe's is_charge_refundable, and nothing when it is not said", () => {
    expect(disputeFrom(DISPUTE)?.refundable).toBe(false)
    expect(
      disputeFrom({ ...DISPUTE, is_charge_refundable: true })?.refundable,
    ).toBe(true)
    const { is_charge_refundable: _, ...unsaid } = DISPUTE
    expect(disputeFrom(unsaid)?.refundable).toBeNull()
  })

  it('is barred by any dispute that says the payment cannot be refunded', () => {
    expect(refundBarredByDispute(state())).toBe(false)
    expect(
      refundBarredByDispute(
        state({
          disputes: [
            dispute({ status: 'warning_needs_response', refundable: true }),
          ],
        }),
      ),
    ).toBe(false)
    expect(
      refundBarredByDispute(
        state({ disputes: [dispute({ refundable: null })] }),
      ),
    ).toBe(false)
    expect(refundBarredByDispute(state({ disputes: [dispute()] }))).toBe(true)
  })
})

describe('moneyGoneBack', () => {
  it('is what was refunded so far', () => {
    expect(moneyGoneBack(state({ amountRefunded: 250 }))).toEqual({
      gone: 250,
      paid: 500,
    })
  })

  it('adds what an open or lost dispute holds, never past the payment', () => {
    const disputedAfterRefund = state({
      amountRefunded: 250,
      disputes: [dispute({ amount: 500 })],
    })

    expect(moneyGoneBack(disputedAfterRefund)).toEqual({ gone: 500, paid: 500 })
  })

  it('counts a partial dispute as its own amount', () => {
    const partial = state({ disputes: [dispute({ amount: 200 })] })

    expect(moneyGoneBack(partial).gone).toBe(200)
  })

  it('counts a dispute in another currency as the whole payment', () => {
    const converted = state({
      disputes: [dispute({ amount: 480, currency: 'usd' })],
    })

    expect(moneyGoneBack(converted).gone).toBe(500)
  })

  it('counts nothing for a dispute that was won', () => {
    const won = state({ disputes: [dispute({ status: 'won' })] })

    expect(moneyGoneBack(won).gone).toBe(0)
  })

  it('counts only the disputes that hold, when a charge has more than one', () => {
    const twice = state({
      disputes: [
        dispute({ id: 'dp_2', status: 'needs_response', amount: 300 }),
        dispute({ id: 'dp_1', status: 'warning_closed', amount: 500 }),
      ],
    })

    expect(moneyGoneBack(twice).gone).toBe(300)
  })
})
