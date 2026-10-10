// ============================================================
// withdrawal-refund — a withdrawal's refund at Stripe, made once
// ============================================================
//
// The refund is a partial refund of the purchase's PaymentIntent, keyed on
// the statement (Idempotency-Key withdrawal-<id>) and tagged with it
// (metadata.withdrawalId), so Stripe makes it once (withdrawal-finish.ts
// decides when to ask).
//
// Only a definitive refusal, a 4xx other than 409 or 429, is final: the
// owner refunds by hand, and it is never asked for again. An answer that
// never came back (a network error, a timeout, a 5xx), or one Stripe is
// still working on (409) or turned away for now (429), leaves the outcome
// unknown, and the statement stays pending. A later attempt first looks for
// the refund by its metadata, over every page of the PaymentIntent's
// refunds, and asks again only when that whole look found none. A look that
// fails is unknown too: a retry after Stripe has forgotten the idempotency
// key (24 hours) can never pay twice.
//
// A refund Stripe takes can still be 'pending' or 'requires_action'. Its
// own status is kept and followed (followRefund) until it ends: 'failed' or
// 'canceled' is a refund the buyer never got.
//
// The price a refund is worked out from is never the catalogue's: the
// checkout's own record (checkoutConsents), else what the PaymentIntent
// received (paidAtStripe), else nobody knows it and the owner refunds by
// hand. Only Stripe saying so makes the price unknown: a 404, or a
// PaymentIntent with no amount received. Any other answer (a network
// error, a 5xx, a 409, a 429, or a 401 or 403 from a key that is wrong or
// lacks a permission) says nothing of the payment and leaves the price
// pending, to be asked again (withdrawal-finish.ts).
//
// Whatever leaves a refund or a price pending says what Stripe answered
// (`error`, `why`): the statement keeps it, and the owner's alerts name it.

import type { Env } from './auth'
import type { WithdrawalRefundState } from './email-withdrawal'
import type { StripeAnswer } from './stripe-api'
import { isStripeConfigured, stripeGet, stripeRequest } from './stripe-api'

export interface Price {
  amountMinor: number
  currency: string
}

export interface RefundOutcome {
  status: WithdrawalRefundState
  refundId: string | null
  /** Why it is not refunded: Stripe's refusal, or what it answered when
   *  the outcome is unknown. */
  error: string | null
  /** The refund's own status at Stripe, once it has one. */
  stripeStatus: string | null
}

/** What asking for a statement's refund needs of it. */
export interface RefundAsk {
  id: string
  purchaseId: string
  userId: string
  paymentIntentId: string | null
  refundMinor: number
}

/** Stripe's answer is not known: the statement stays pending, and keeps
 *  what Stripe did answer. */
function unknown(why: string): RefundOutcome {
  return { status: 'pending', refundId: null, error: why, stripeStatus: null }
}

/** The statuses of a refund Stripe has not finished. */
const OPEN_AT_STRIPE: ReadonlySet<string> = new Set([
  'pending',
  'requires_action',
])

/** Pages of a PaymentIntent's refunds read before the look gives up. */
const LOOKUP_PAGES = 10

export function isOpenAtStripe(status: string | null): boolean {
  return status !== null && OPEN_AT_STRIPE.has(status)
}

function byHand(error: string): RefundOutcome {
  return { status: 'manual', refundId: null, error, stripeStatus: null }
}

/** What Stripe says the PaymentIntent received: the price; none on
 *  record; or no answer yet, to ask again, with what Stripe did say. */
export type PriceAnswer =
  | { kind: 'paid'; price: Price }
  | { kind: 'not-on-record' }
  | { kind: 'no-answer'; why: string }

const NOT_ON_RECORD: PriceAnswer = { kind: 'not-on-record' }

/** A 409, a 429 or a 5xx: Stripe answered, but not about the payment. */
function isPassing(status: number): boolean {
  return status === 409 || status === 429 || status >= 500
}

/** What the PaymentIntent received. Never throws. */
export async function paidAtStripe(
  env: Env,
  paymentIntentId: string | null,
): Promise<PriceAnswer> {
  if (paymentIntentId === null || !isStripeConfigured(env)) {
    return NOT_ON_RECORD
  }
  let res: StripeAnswer
  try {
    res = await stripeGet(
      env,
      `/payment_intents/${encodeURIComponent(paymentIntentId)}`,
    )
  } catch (err) {
    return {
      kind: 'no-answer',
      why: `Stripe did not answer the price lookup: ${String(err)}`,
    }
  }
  if (res.status === 404) return NOT_ON_RECORD
  if (!res.ok) {
    return { kind: 'no-answer', why: stripeSaid('the price lookup', res) }
  }
  const amount = res.data.amount_received
  const currency = res.data.currency
  if (typeof amount !== 'number' || typeof currency !== 'string') {
    return NOT_ON_RECORD
  }
  return currency === ''
    ? NOT_ON_RECORD
    : { kind: 'paid', price: { amountMinor: amount, currency } }
}

function stripeMessage(data: Record<string, unknown>): string | null {
  const error = data.error as { message?: unknown } | undefined
  return typeof error?.message === 'string' ? error.message : null
}

function stripeError(data: Record<string, unknown>, status: number): string {
  return stripeMessage(data) ?? `Stripe answered ${status}`
}

/** What Stripe answered `what`, in words: "Stripe answered the price
 *  lookup 403: The provided key does not have the required permissions". */
function stripeSaid(what: string, res: StripeAnswer): string {
  const message = stripeMessage(res.data)
  return `Stripe answered ${what} ${res.status}${message === null ? '' : `: ${message}`}`
}

/** What a refund object says of the refund. */
function fromRefund(refund: Record<string, unknown>): RefundOutcome {
  if (typeof refund.id !== 'string') {
    return unknown('Stripe answered the refund request without a refund id')
  }
  const state = typeof refund.status === 'string' ? refund.status : null
  if (state === 'failed' || state === 'canceled') {
    const reason =
      typeof refund.failure_reason === 'string' ? refund.failure_reason : state
    return {
      status: 'failed',
      refundId: refund.id,
      error: `Stripe did not complete the refund: ${reason}`,
      stripeStatus: state,
    }
  }
  return {
    status: 'refunded',
    refundId: refund.id,
    error: null,
    stripeStatus: state,
  }
}

/** What Stripe's answer to the refund means for the statement. */
function refundAnswer(res: StripeAnswer): RefundOutcome {
  if (res.ok) return fromRefund(res.data)
  // 409: the same key is still being worked on. 429: too many requests.
  // 5xx: Stripe's own trouble. None says whether the refund was made.
  if (isPassing(res.status)) {
    return unknown(stripeSaid('the refund request', res))
  }
  return {
    status: 'failed',
    refundId: null,
    error: stripeError(res.data, res.status),
    stripeStatus: null,
  }
}

type Lookup =
  | { kind: 'found'; refund: Record<string, unknown> }
  | { kind: 'none' }
  | { kind: 'unknown'; why: string }

/** The refund this statement already has at Stripe, by its metadata, over
 *  every page of the PaymentIntent's refunds. Unknown when a page fails. */
async function refundOnRecord(env: Env, ask: RefundAsk): Promise<Lookup> {
  const base = `/refunds?payment_intent=${encodeURIComponent(ask.paymentIntentId ?? '')}&limit=100`
  let after = ''
  for (let page = 0; page < LOOKUP_PAGES; page += 1) {
    const res = await stripeGet(env, `${base}${after}`)
    const refunds = Array.isArray(res.data.data)
      ? (res.data.data as Array<Record<string, unknown>>)
      : null
    if (!res.ok || refunds === null) {
      return {
        kind: 'unknown',
        why: stripeSaid('the look for its refund', res),
      }
    }
    const ours = refunds.find(
      (refund) =>
        (refund.metadata as Record<string, unknown> | undefined)
          ?.withdrawalId === ask.id,
    )
    if (ours !== undefined) return { kind: 'found', refund: ours }
    if (res.data.has_more !== true) return { kind: 'none' }
    const last = refunds.at(-1)?.id
    if (typeof last !== 'string') {
      return { kind: 'unknown', why: 'Stripe listed a refund without an id' }
    }
    after = `&starting_after=${encodeURIComponent(last)}`
  }
  return {
    kind: 'unknown',
    why: `Stripe listed more than ${LOOKUP_PAGES} pages of refunds of the payment`,
  }
}

/** Why no refund can be asked for at all, or null when one can. */
function refundBlocked(env: Env, ask: RefundAsk): RefundOutcome | null {
  if (ask.refundMinor <= 0) {
    return { status: 'none', refundId: null, error: null, stripeStatus: null }
  }
  if (ask.paymentIntentId === null) {
    return byHand('No PaymentIntent on record for this purchase')
  }
  if (!isStripeConfigured(env)) return byHand('Stripe is not configured')
  return null
}

/**
 * Ask Stripe to refund the statement's amount, once. A `retry` looks for
 * the refund first, and asks only when Stripe has none. Never throws: an
 * answer that never came back is an unknown outcome, never a refusal.
 */
export async function refundAtStripe(
  env: Env,
  ask: RefundAsk,
  retry: boolean,
): Promise<RefundOutcome> {
  const blocked = refundBlocked(env, ask)
  if (blocked !== null) return blocked
  try {
    if (retry) {
      const earlier = await refundOnRecord(env, ask)
      if (earlier.kind === 'unknown') return unknown(earlier.why)
      if (earlier.kind === 'found') return fromRefund(earlier.refund)
    }
    return refundAnswer(
      await stripeRequest(
        env,
        '/refunds',
        {
          payment_intent: ask.paymentIntentId ?? '',
          amount: String(ask.refundMinor),
          reason: 'requested_by_customer',
          'metadata[withdrawalId]': ask.id,
          'metadata[purchaseId]': ask.purchaseId,
          'metadata[userId]': ask.userId,
        },
        `withdrawal-${ask.id}`,
      ),
    )
  } catch (err) {
    // The request went out and no answer came back: Stripe may have made
    // the refund, so it stays pending for the lookup to find.
    return unknown(`Stripe did not answer the refund request: ${String(err)}`)
  }
}

/** Where a refund Stripe took stands now, or null when Stripe does not
 *  say. Never throws. */
export async function followRefund(
  env: Env,
  refundId: string,
): Promise<RefundOutcome | null> {
  try {
    const res = await stripeGet(env, `/refunds/${encodeURIComponent(refundId)}`)
    return res.ok ? fromRefund(res.data) : null
  } catch {
    return null
  }
}
