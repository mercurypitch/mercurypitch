// ── A Stripe account in memory, for the payment tests ──────────────────
//
// It keeps charges, refunds and disputes the way Stripe does, writes the
// event Stripe would send for each change, and answers the reads the worker
// makes: GET /v1/events (with types[], created[gte], created[lte], limit
// and starting_after, newest first), GET /v1/charges/:id, and GET
// /v1/refunds and /v1/disputes (with charge, limit and starting_after,
// newest first). A test changes the account, then decides what the worker
// sees: the event delivered, delivered twice, out of order, or never (left
// for the sweep).
//
// Like Stripe's, a charge has no dispute on it, only `disputed`, and asking
// to expand one is an error. A failed refund leaves the charge's
// amount_refunded as it was, so the worker has to read the refunds to see
// it failed.
//
// Charges carry the card and billing details a real charge does, so a test
// can prove none of it reaches a log or an alert. All of it is fake.

export interface StripeEvent {
  id: string
  object: 'event'
  type: string
  created: number
  livemode: boolean
  data: { object: Record<string, unknown> }
}

interface Charge {
  id: string
  object: 'charge'
  amount: number
  amount_refunded: number
  refunded: boolean
  currency: string
  payment_intent: string
  disputed: boolean
  status: 'succeeded'
  receipt_email: string
  billing_details: { email: string; name: string }
  payment_method_details: { card: { brand: string; last4: string } }
}

interface Refund {
  id: string
  object: 'refund'
  amount: number
  charge: string
  payment_intent: string
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'canceled'
}

interface Dispute {
  id: string
  object: 'dispute'
  amount: number
  charge: string
  payment_intent: string
  currency: string
  reason: string
  status: string
  is_charge_refundable: boolean
  evidence_details: { due_by: number | null }
}

/** The buyer's details on every fake charge: what must never be logged. */
export const BUYER_EMAIL = 'buyer.private@example.test'
export const CARD_LAST4 = '4242'

export interface CheckoutOptions {
  /** The pack's credits, as handleCheckout writes them in the metadata. */
  credits?: number
  /** What the charge took, in cents. */
  amount?: number
  type?: string
  /** False for a delayed payment still on its way. */
  paid?: boolean
  /** The launch offer's bonus on this pack. */
  bonus?: number
  planId?: string
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export class FakeStripe {
  readonly events: StripeEvent[] = []
  private readonly charges = new Map<string, Charge>()
  private readonly byIntent = new Map<string, string>()
  private readonly refunds = new Map<string, Refund>()
  private readonly disputes = new Map<string, Dispute>()
  private readonly failures: Array<{ prefix: string; status: number }> = []
  private serial = 0
  /** Event time, a second apart per event, an hour in the past: older than
   *  the sweep's grace period, inside its 30-day window. */
  private clock = Math.floor(Date.now() / 1000) - 3600

  private next(prefix: string): string {
    this.serial += 1
    return `${prefix}_${String(this.serial).padStart(4, '0')}`
  }

  private emit(type: string, object: object): StripeEvent {
    this.clock += 1
    const event: StripeEvent = {
      id: this.next('evt'),
      object: 'event',
      type,
      created: this.clock,
      livemode: false,
      data: { object: clone(object) as Record<string, unknown> },
    }
    this.events.push(event)
    return event
  }

  private charge(paymentIntent: string): Charge {
    const id = this.byIntent.get(paymentIntent)
    const charge = id === undefined ? undefined : this.charges.get(id)
    if (charge === undefined) throw new Error(`no charge for ${paymentIntent}`)
    return charge
  }

  /** A pack bought through Checkout: the PaymentIntent, its card charge (when
   *  paid) and the Checkout Session event. Returns the event; its session's
   *  payment_intent names everything that follows. */
  checkout(userId: string, options: CheckoutOptions = {}): StripeEvent {
    const amount = options.amount ?? 500
    const paymentIntent = this.next('pi')
    if (options.paid !== false) {
      const charge: Charge = {
        id: this.next('ch'),
        object: 'charge',
        amount,
        amount_refunded: 0,
        refunded: false,
        currency: 'eur',
        payment_intent: paymentIntent,
        disputed: false,
        status: 'succeeded',
        receipt_email: BUYER_EMAIL,
        billing_details: { email: BUYER_EMAIL, name: 'Fake Buyer' },
        payment_method_details: { card: { brand: 'visa', last4: CARD_LAST4 } },
      }
      this.charges.set(charge.id, charge)
      this.byIntent.set(paymentIntent, charge.id)
    }
    return this.emit(options.type ?? 'checkout.session.completed', {
      id: this.next('cs'),
      object: 'checkout.session',
      mode: 'payment',
      payment_status: options.paid === false ? 'unpaid' : 'paid',
      payment_intent: paymentIntent,
      amount_total: amount,
      currency: 'eur',
      customer_details: { email: BUYER_EMAIL },
      // The withdrawal checkbox every pack's Checkout asks for
      // (checkout-consent.ts), ticked.
      consent: { terms_of_service: 'accepted' },
      metadata: {
        userId,
        planId: options.planId ?? 'pack-starter',
        credits: String(options.credits ?? 30),
        ...(options.bonus === undefined
          ? {}
          : { offer: 'launch-finisher', bonusCredits: String(options.bonus) }),
      },
    })
  }

  /** The delayed payment of an unpaid session arrives: its charge exists
   *  from now on. */
  paySession(session: StripeEvent): StripeEvent {
    const object = session.data.object
    const paymentIntent = String(object.payment_intent)
    const amount = Number(object.amount_total)
    const charge: Charge = {
      id: this.next('ch'),
      object: 'charge',
      amount,
      amount_refunded: 0,
      refunded: false,
      currency: 'eur',
      payment_intent: paymentIntent,
      disputed: false,
      status: 'succeeded',
      receipt_email: BUYER_EMAIL,
      billing_details: { email: BUYER_EMAIL, name: 'Fake Buyer' },
      payment_method_details: { card: { brand: 'visa', last4: CARD_LAST4 } },
    }
    this.charges.set(charge.id, charge)
    this.byIntent.set(paymentIntent, charge.id)
    return this.emit('checkout.session.async_payment_succeeded', {
      ...object,
      payment_status: 'paid',
    })
  }

  /** A refund of `amount` cents, made in the Dashboard (or by a withdrawal).
   *  The event carries the charge as it is now: amount_refunded is the total
   *  so far, never this refund's own. */
  refund(paymentIntent: string, amount: number): StripeEvent {
    const charge = this.charge(paymentIntent)
    const refund: Refund = {
      id: this.next('re'),
      object: 'refund',
      amount,
      charge: charge.id,
      payment_intent: paymentIntent,
      currency: charge.currency,
      status: 'succeeded',
    }
    this.refunds.set(refund.id, refund)
    charge.amount_refunded += amount
    charge.refunded = charge.amount_refunded >= charge.amount
    return this.emit('charge.refunded', charge)
  }

  private lastRefund(paymentIntent: string): Refund {
    const charge = this.charge(paymentIntent)
    const refund = [...this.refunds.values()]
      .filter((entry) => entry.charge === charge.id)
      .at(-1)
    if (refund === undefined) throw new Error(`no refund on ${paymentIntent}`)
    return refund
  }

  /** The newest refund on the payment fails, and its money comes back to the
   *  merchant. Stripe sends refund.updated and refund.failed for it; the
   *  charge's amount_refunded stays as it was. */
  failLastRefund(paymentIntent: string): {
    updated: StripeEvent
    failed: StripeEvent
  } {
    const refund = this.lastRefund(paymentIntent)
    refund.status = 'failed'
    return {
      updated: this.emit('refund.updated', refund),
      failed: this.emit('refund.failed', refund),
    }
  }

  /** The newest refund on the payment is canceled before it reaches the
   *  buyer: refund.updated, to `canceled`. */
  cancelLastRefund(paymentIntent: string): StripeEvent {
    const refund = this.lastRefund(paymentIntent)
    refund.status = 'canceled'
    return this.emit('refund.updated', refund)
  }

  /** An update to the newest refund that changes nothing about its money,
   *  as when its trace number arrives. */
  touchLastRefund(paymentIntent: string): StripeEvent {
    return this.emit('refund.updated', this.lastRefund(paymentIntent))
  }

  /** The buyer's bank opens a dispute, by default for the whole charge. */
  dispute(
    paymentIntent: string,
    options: { amount?: number; reason?: string; status?: string } = {},
  ): StripeEvent {
    const charge = this.charge(paymentIntent)
    const dispute: Dispute = {
      id: this.next('dp'),
      object: 'dispute',
      amount: options.amount ?? charge.amount,
      charge: charge.id,
      payment_intent: paymentIntent,
      currency: charge.currency,
      reason: options.reason ?? 'fraudulent',
      status: options.status ?? 'needs_response',
      is_charge_refundable: false,
      // 2026-10-30 23:59:59 UTC.
      evidence_details: { due_by: 1_793_404_799 },
    }
    this.disputes.set(dispute.id, dispute)
    charge.disputed = true
    return this.emit('charge.dispute.created', dispute)
  }

  /** The bank decides the newest dispute on the payment. */
  closeDispute(paymentIntent: string, status: string): StripeEvent {
    const charge = this.charge(paymentIntent)
    const dispute = [...this.disputes.values()]
      .filter((entry) => entry.charge === charge.id)
      .at(-1)
    if (dispute === undefined) throw new Error(`no dispute on ${paymentIntent}`)
    dispute.status = status
    return this.emit('charge.dispute.closed', dispute)
  }

  /** The next request whose path starts with `prefix` gets `status`. */
  failNext(prefix: string, status: number): void {
    this.failures.push({ prefix, status })
  }

  /** The answer to a request to api.stripe.com, or null for anything else. */
  answer(url: string): Response | null {
    const parsed = new URL(url)
    if (parsed.host !== 'api.stripe.com') return null
    const failure = this.failures.findIndex((entry) =>
      parsed.pathname.startsWith(entry.prefix),
    )
    if (failure !== -1) {
      const [{ status }] = this.failures.splice(failure, 1)
      return Response.json(
        { error: { type: 'api_error', message: 'stubbed failure' } },
        { status },
      )
    }
    if (parsed.pathname === '/v1/events') return this.listEvents(parsed)
    if (parsed.pathname === '/v1/refunds') {
      return this.listOfCharge([...this.refunds.values()], parsed)
    }
    if (parsed.pathname === '/v1/disputes') {
      return this.listOfCharge([...this.disputes.values()], parsed)
    }
    const charge = /^\/v1\/charges\/([^/]+)$/.exec(parsed.pathname)
    if (charge !== null) return this.readCharge(charge[1], parsed)
    throw new Error(`unexpected Stripe request in a test: ${url}`)
  }

  /** A page of one charge's refunds or disputes, newest first. */
  private listOfCharge(
    all: Array<{ id: string; charge: string }>,
    url: URL,
  ): Response {
    const known = new Set(['charge', 'limit', 'starting_after'])
    const unknown = [...url.searchParams.keys()].filter(
      (key) => !known.has(key),
    )
    if (unknown.length > 0 || !url.searchParams.has('charge')) {
      throw new Error(`unexpected Stripe list query in a test: ${url.href}`)
    }
    const limit = Number(url.searchParams.get('limit') ?? 10)
    const after = url.searchParams.get('starting_after')
    const newestFirst = all
      .filter((item) => item.charge === url.searchParams.get('charge'))
      .reverse()
    const start =
      after === null
        ? 0
        : newestFirst.findIndex((item) => item.id === after) + 1
    return Response.json({
      object: 'list',
      data: clone(newestFirst.slice(start, start + limit)),
      has_more: start + limit < newestFirst.length,
    })
  }

  private listEvents(url: URL): Response {
    const types = url.searchParams.getAll('types[]')
    const from = Number(url.searchParams.get('created[gte]') ?? 0)
    const to = Number(url.searchParams.get('created[lte]') ?? Infinity)
    const limit = Number(url.searchParams.get('limit') ?? 10)
    const after = url.searchParams.get('starting_after')
    const newestFirst = this.events
      .map((event, order) => ({ event, order }))
      .filter(
        ({ event }) =>
          (types.length === 0 || types.includes(event.type)) &&
          event.created >= from &&
          event.created <= to,
      )
      .sort((a, b) => b.event.created - a.event.created || b.order - a.order)
      .map(({ event }) => event)
    const start =
      after === null
        ? 0
        : newestFirst.findIndex((event) => event.id === after) + 1
    const page = newestFirst.slice(start, start + limit)
    return Response.json({
      object: 'list',
      data: clone(page),
      has_more: start + limit < newestFirst.length,
    })
  }

  private readCharge(id: string, url: URL): Response {
    if (url.searchParams.has('expand[]')) {
      // What Stripe answers: a Charge has no dispute to expand.
      return Response.json(
        {
          error: {
            type: 'invalid_request_error',
            message: `This property cannot be expanded (${url.searchParams.get('expand[]')}).`,
          },
        },
        { status: 400 },
      )
    }
    const charge = this.charges.get(decodeURIComponent(id))
    if (charge === undefined) {
      return Response.json(
        {
          error: {
            type: 'invalid_request_error',
            code: 'resource_missing',
            message: `No such charge: '${id}'`,
          },
        },
        { status: 404 },
      )
    }
    return Response.json(clone(charge))
  }
}
