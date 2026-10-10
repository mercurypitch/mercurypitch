// ── Stripe's charge reads, for suites that stub fetch by hand ──────────
//
// The worker applies a refund or a dispute from what Stripe reports now
// (stripe-charge.ts): GET /v1/charges/:id, then the charge's refunds and
// disputes from GET /v1/refunds?charge= and GET /v1/disputes?charge=. A
// suite that keeps its own charges, by id, answers those reads here: the
// refunds list holds one refund of the charge's amount_refunded, and the
// disputes list holds what `disputesOf` keeps for the charge (none by
// default). The payment suites that need more use FakeStripe
// (stripe-fake.ts).

/** The charges a suite keeps: a map by id, or a lookup that can also work
 *  one out (a PaymentIntent's charge, with the refunds made so far). */
export type ChargeLookup =
  | ReadonlyMap<string, Record<string, unknown>>
  | ((chargeId: string) => Record<string, unknown> | undefined)

function chargeOf(
  charges: ChargeLookup,
  chargeId: string,
): Record<string, unknown> | undefined {
  return typeof charges === 'function'
    ? charges(chargeId)
    : charges.get(chargeId)
}

/** The answer to one of the worker's charge reads, or null when `url` is
 *  not one, or names a charge the suite does not keep. */
export function chargeReads(
  charges: ChargeLookup,
  url: string,
  disputesOf: (chargeId: string) => Array<Record<string, unknown>> = () => [],
): Response | null {
  const parsed = new URL(url)
  if (parsed.host !== 'api.stripe.com') return null
  const path = /^\/v1\/charges\/([^/]+)$/.exec(parsed.pathname)
  if (path !== null) {
    const charge = chargeOf(charges, path[1])
    return charge === undefined ? null : Response.json(charge)
  }
  const chargeId = parsed.searchParams.get('charge') ?? ''
  const charge = chargeOf(charges, chargeId)
  if (charge === undefined) return null
  if (parsed.pathname === '/v1/refunds') {
    const refunded = Number(charge.amount_refunded ?? 0)
    const refund = {
      id: `re_${chargeId}`,
      object: 'refund',
      amount: refunded,
      charge: chargeId,
      status: 'succeeded',
    }
    return Response.json({
      object: 'list',
      data: refunded > 0 ? [refund] : [],
      has_more: false,
    })
  }
  if (parsed.pathname === '/v1/disputes') {
    return Response.json({
      object: 'list',
      data: disputesOf(chargeId),
      has_more: false,
    })
  }
  return null
}
