// ============================================================
// stripe-events — the Stripe events the worker applies, as it reads them
// ============================================================
//
// Which event types grant credits (a paid checkout) and which move money
// back (refunds and disputes), how the webhook and the sweep read an event
// from a webhook body or an events-list item, and what applying one came
// to. The webhook (billing.ts) and the sweep (stripe-sweep.ts) both apply
// events through billing.ts, applyStripeEvent; what an event does to the
// credits is stripe-payments.ts's.

import { isRecord } from './stripe-charge'

/** The checkout events whose session may be paid: the webhook and the
 *  reconciliation sweep grant from both. */
export const CHECKOUT_PAID_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
] as const

export function isCheckoutPaidEvent(type: unknown): boolean {
  return (CHECKOUT_PAID_EVENTS as readonly unknown[]).includes(type)
}

/** The Stripe events that move money back to the buyer, or end a move: a
 *  refund and what becomes of it, a dispute opening and closing.
 *  charge.refund.updated is not one: Stripe deprecated it for
 *  refund.updated. */
export const MONEY_BACK_EVENTS = [
  'charge.refunded',
  'refund.updated',
  'refund.failed',
  'charge.dispute.created',
  'charge.dispute.closed',
] as const

export type MoneyBackEvent = (typeof MONEY_BACK_EVENTS)[number]

export function isMoneyBackEvent(type: unknown): type is MoneyBackEvent {
  return (MONEY_BACK_EVENTS as readonly unknown[]).includes(type)
}

/** Every event type the webhook and the sweep apply. Any other type is
 *  acknowledged without a write. */
export const HANDLED_EVENTS: readonly string[] = [
  ...CHECKOUT_PAID_EVENTS,
  ...MONEY_BACK_EVENTS,
]

export function isHandledEvent(type: unknown): boolean {
  return isCheckoutPaidEvent(type) || isMoneyBackEvent(type)
}

/** A Stripe event, as the webhook reads it from its body and the sweep from
 *  the events list. */
export interface StripeEventInput {
  id: string
  type: string
  livemode: boolean
  /** When Stripe created it, in seconds since 1970; 0 when it did not say. */
  created: number
  object: Record<string, unknown>
}

/** The event a parsed webhook body or events-list item holds, or why it
 *  holds none. */
export function parseStripeEvent(
  value: unknown,
): StripeEventInput | { ignored: 'malformed payload' | 'missing event id' } {
  if (!isRecord(value)) return { ignored: 'malformed payload' }
  if (typeof value.id !== 'string' || value.id === '') {
    return { ignored: 'missing event id' }
  }
  const data = isRecord(value.data) ? value.data : {}
  return {
    id: value.id,
    type: typeof value.type === 'string' ? value.type : '',
    livemode: value.livemode === true,
    created:
      typeof value.created === 'number' && Number.isFinite(value.created)
        ? value.created
        : 0,
    object: isRecord(data.object) ? data.object : {},
  }
}

/**
 * The event in a webhook body Stripe signed, or why it is acknowledged
 * without being applied: a body nobody can read, an event with no id, or a
 * type nothing here handles. Each of those is final, so the webhook answers
 * 200 and Stripe stops sending it; none of them touches D1.
 */
export function readWebhookEvent(
  payload: string,
): StripeEventInput | { ignored: string } {
  let body: unknown
  try {
    body = JSON.parse(payload)
  } catch {
    body = null
  }
  const event = parseStripeEvent(body)
  if ('ignored' in event) {
    console.warn(`[billing] webhook: ${event.ignored}, acknowledged unread`)
    return event
  }
  return isHandledEvent(event.type)
    ? event
    : { ignored: 'unhandled event type' }
}

/** What applying one Stripe event came to (billing.ts, applyStripeEvent):
 *  what the webhook answers, and what the sweep reports. */
export type StripeEventResult =
  /** Applied now, and recorded. */
  | { kind: 'applied'; detail?: string }
  /** Final, and nothing could be applied: acknowledged, recorded when the
   *  type is handled, and never tried again. */
  | { kind: 'ignored'; reason: string }
  /** Recorded before, or another delivery holds it right now. */
  | { kind: 'duplicate' }
  /** A checkout not paid yet: recorded, nothing granted. */
  | { kind: 'unpaid' }

/** What applying a money-back event came to. */
export type MoneyBackResult = Extract<
  StripeEventResult,
  { kind: 'applied' | 'ignored' }
>
