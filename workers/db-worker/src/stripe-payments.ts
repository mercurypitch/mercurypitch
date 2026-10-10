// ============================================================
// stripe-payments — what a Stripe payment does to the credits ledger
// ============================================================
//
// Only paid money grants. A checkout grants when its session is paid: at
// `checkout.session.completed` for a card, and at
// `checkout.session.async_payment_succeeded` for a delayed payment method,
// which completes the session before the money arrives (billing.ts,
// grantForCheckout). Both write the session's PaymentIntent id on the rows
// they grant: a pack's credits, and the launch offer's bonus credits on the
// same payment.
//
// And money that goes back takes its credits back:
//
//   - charge.refunded, a refund made in the Stripe dashboard: in proportion
//     to the money refunded so far. A full refund takes all of it; half the
//     money takes half the credits, rounded down.
//   - charge.dispute.created, a chargeback: all of it. The bank pulls the
//     payment back the moment the dispute opens.
//
// The balance never goes below zero: credits already spent stay spent, and
// the billing alert says how many could not be taken back. What one payment
// loses, over every refund and dispute of it, never passes what it granted,
// so two partial refunds, or a refund and then a dispute, add up to the
// payment at most.
//
// Every take is a ledger row, `purchase-refund` or `purchase-dispute`, with
// the PaymentIntent in jobRef and keyed on the Stripe event, so a redelivered
// event takes nothing twice.
//
// A withdrawal (withdrawal.ts) takes a pack's unused credits itself, as
// `withdrawal` and `withdrawal-bonus` rows with the PaymentIntent in jobRef,
// and then refunds the unused credits' share of the price. Its own
// charge.refunded counts those rows as taken already (takenFrom), and the
// share it refunds never adds up to more credits than they removed, so it
// takes nothing more. A refund made by hand for a withdrawal Stripe refused
// does the same. A withdrawal that refunds the whole price (a purchase with
// no consent on record) settles the payment outright: what the buyer used
// stays theirs (CRD Art. 14(4)(b)). Each one sends the billing alert
// (BILLING_ALERT_EMAIL), and so does a payment with nothing on record to take:
// a donation, or a purchase from before PaymentIntent ids were stored
// (migration 0058).
//
// A dispute that is won later gives nothing back by itself; the alert says
// so, and the credits go back by hand. The 6-hourly reconciliation sweep
// recovers missed checkout events only: a refund event the webhook never
// received takes nothing back.

import type { Env } from './auth'
import type { ResendConfig } from './email'
import { sendBillingAlert } from './email'
import type { Ledger } from './ledger'
import { writeOnLedger } from './ledger'

/** The ledger reason of a pack's credits, granted when its checkout is paid
 *  (billing.ts, grantCheckoutCredits). */
export const PACK_PURCHASE = 'purchase'
/** The ledger reason of the credits a refund takes back. */
export const PURCHASE_REFUND = 'purchase-refund'
/** The ledger reason of the credits a dispute takes back. */
export const PURCHASE_DISPUTE = 'purchase-dispute'
/** The ledger reasons of what a withdrawal removes (withdrawal.ts): the
 *  pack's unused paid credits, and the unused bonus that came with it. The
 *  refund the withdrawal asks Stripe for comes back as charge.refunded, and
 *  these rows are what that event finds already taken. */
export const WITHDRAWAL_PAID = 'withdrawal'
export const WITHDRAWAL_BONUS = 'withdrawal-bonus'

/** Rows that took a payment's credits back: refunds, disputes and
 *  withdrawals. Each names the PaymentIntent in its jobRef. */
const TAKEN_BACK: ReadonlySet<string | null> = new Set([
  PURCHASE_REFUND,
  PURCHASE_DISPUTE,
  WITHDRAWAL_PAID,
  WITHDRAWAL_BONUS,
])

/** The checkout events whose session may be paid: the webhook and the
 *  reconciliation sweep grant from both. */
export const CHECKOUT_PAID_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
] as const

export function isCheckoutPaidEvent(type: unknown): boolean {
  return (CHECKOUT_PAID_EVENTS as readonly unknown[]).includes(type)
}

/** The Stripe events that move money back to the buyer. */
export type MoneyBackEvent = 'charge.refunded' | 'charge.dispute.created'

export function isMoneyBackEvent(type: unknown): type is MoneyBackEvent {
  return type === 'charge.refunded' || type === 'charge.dispute.created'
}

/** The PaymentIntent a Checkout Session, a Charge or a Dispute names: an id
 *  in a webhook, an object when a caller expanded it. */
export function paymentIntentOf(
  object: Record<string, unknown>,
): string | null {
  const value = object.payment_intent
  if (typeof value === 'string' && value !== '') return value
  if (value !== null && typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' && id !== '') return id
  }
  return null
}

/** How much of the payment has gone back, from 0 to 1. A dispute is the
 *  whole payment; a refund is what the charge says was refunded so far. */
export function refundedShare(
  type: MoneyBackEvent,
  object: Record<string, unknown>,
): number {
  if (type === 'charge.dispute.created') return 1
  if (object.refunded === true) return 1
  const amount = Number(object.amount)
  const refunded = Number(object.amount_refunded)
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(refunded)) {
    return 0
  }
  return Math.min(1, Math.max(0, refunded / amount))
}

export interface TakeBack {
  /** Credits this event takes now. */
  take: number
  /** Credits this payment still owes, before this event takes any. */
  owed: number
}

/** What one event takes back: the payment's credits in proportion to the
 *  money gone back, less what earlier events took, and never more than the
 *  balance holds. */
export function creditsToTake(input: {
  granted: number
  share: number
  taken: number
  balance: number
}): TakeBack {
  const due = Math.floor(input.granted * input.share)
  const owed = Math.max(0, due - input.taken)
  return { take: Math.min(owed, Math.max(0, input.balance)), owed }
}

/** Credits already taken back from the payment `paymentIntent` names: by
 *  earlier refunds and disputes, and by a withdrawal, whose own refund must
 *  not take its credits a second time. */
function takenFrom(ledger: Ledger, paymentIntent: string): number {
  return ledger.rows
    .filter((row) => TAKEN_BACK.has(row.reason) && row.jobRef === paymentIntent)
    .reduce((sum, row) => sum - Number(row.delta), 0)
}

function balanceOf(ledger: Ledger): number {
  return ledger.rows.reduce((sum, row) => sum + Number(row.delta), 0)
}

export interface ClawBack {
  /** An earlier delivery of this event took its credits already. */
  duplicate: boolean
  /** Credits taken back by this event. */
  taken: number
  /** Credits the payment still owed that the balance could not cover. */
  short: number
  /** The account the payment's credits went to, or null when nothing on
   *  record names this payment. */
  userId: string | null
}

/**
 * Take back what the payment behind a refund or a dispute granted. Safe to
 * call again for the same event: the row is keyed on it. Throws when the
 * ledger cannot be written, so Stripe delivers the event again.
 */
export async function clawBackPayment(
  env: Env,
  eventId: string,
  type: MoneyBackEvent,
  object: Record<string, unknown>,
): Promise<ClawBack> {
  const key = `clawback:${eventId}`
  const done = await env.DB.prepare(
    'SELECT delta FROM creditLedger WHERE idempotencyKey = ?',
  )
    .bind(key)
    .first<{ delta: number }>()
  if (done !== null) {
    return { duplicate: true, taken: -done.delta, short: 0, userId: null }
  }

  const paymentIntent = paymentIntentOf(object)
  const grant =
    paymentIntent === null
      ? null
      : await env.DB.prepare(
          `SELECT userId, SUM(delta) AS granted FROM creditLedger
            WHERE paymentIntentId = ? AND delta > 0
            GROUP BY userId LIMIT 1`,
        )
          .bind(paymentIntent)
          .first<{ userId: string; granted: number }>()
  if (paymentIntent === null || grant === null) {
    console.warn(
      `[billing] ${type} ${eventId}: no credits on record for ${paymentIntent ?? 'a payment with no PaymentIntent'}, nothing taken back`,
    )
    await alertNothingOnRecord(env, eventId, type, paymentIntent)
    return { duplicate: false, taken: 0, short: 0, userId: null }
  }

  const share = refundedShare(type, object)
  const settledWhole = await env.DB.prepare(
    "SELECT 1 AS hit FROM withdrawals WHERE paymentIntentId = ? AND refundBasis = 'full'",
  )
    .bind(paymentIntent)
    .first()
  let owed = 0
  const delta = await writeOnLedger(
    env,
    grant.userId,
    key,
    type === 'charge.dispute.created' ? PURCHASE_DISPUTE : PURCHASE_REFUND,
    (ledger) => {
      const back = creditsToTake({
        granted: Number(grant.granted),
        share,
        taken:
          settledWhole === null
            ? takenFrom(ledger, paymentIntent)
            : Number(grant.granted),
        balance: balanceOf(ledger),
      })
      owed = back.owed
      return { delta: -back.take, jobRef: paymentIntent }
    },
  )
  const outcome: ClawBack = {
    duplicate: false,
    taken: -delta,
    short: Math.max(0, owed + delta),
    userId: grant.userId,
  }
  console.log(
    `[billing] ${type} ${eventId}: ${paymentIntent} took back ${outcome.taken} credit(s) from user=${grant.userId}` +
      (outcome.short > 0 ? `, ${outcome.short} already spent` : ''),
  )
  await alertTakenBack(env, eventId, type, paymentIntent, {
    granted: Number(grant.granted),
    share,
    outcome,
  })
  return outcome
}

function alertConfig(env: Env): ResendConfig {
  return { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }
}

function what(type: MoneyBackEvent): string {
  return type === 'charge.dispute.created' ? 'Dispute' : 'Refund'
}

async function alertTakenBack(
  env: Env,
  eventId: string,
  type: MoneyBackEvent,
  paymentIntent: string,
  facts: { granted: number; share: number; outcome: ClawBack },
): Promise<void> {
  const { granted, share, outcome } = facts
  await sendBillingAlert(
    alertConfig(env),
    env.BILLING_ALERT_EMAIL ?? '',
    `${what(type)}: took back ${outcome.taken} credit(s)`,
    [
      `Stripe event: ${eventId} (${type})`,
      `PaymentIntent: ${paymentIntent}`,
      `Account: ${outcome.userId ?? 'unknown'}`,
      `The payment granted ${granted} credit(s), its pack and any launch bonus.`,
      `Gone back so far: ${Math.round(share * 100)}% of the payment.`,
      `Taken back now: ${outcome.taken} credit(s).`,
      ...(outcome.short > 0
        ? [
            `Not taken back: ${outcome.short} credit(s), already spent. The balance never goes below zero.`,
          ]
        : []),
      ...(type === 'charge.dispute.created'
        ? [
            '',
            'If the dispute is won, the credits do not come back by themselves:',
            'give them back by hand.',
          ]
        : []),
    ],
  )
}

async function alertNothingOnRecord(
  env: Env,
  eventId: string,
  type: MoneyBackEvent,
  paymentIntent: string | null,
): Promise<void> {
  await sendBillingAlert(
    alertConfig(env),
    env.BILLING_ALERT_EMAIL ?? '',
    `${what(type)} with no credits on record`,
    [
      `Stripe event: ${eventId} (${type})`,
      `PaymentIntent: ${paymentIntent ?? 'none on the event'}`,
      '',
      'No credits on record name this payment, so nothing was taken back.',
      'It is a donation, or a purchase from before PaymentIntent ids were',
      'stored on the ledger (migration 0058). Check it in the Stripe',
      'dashboard and take the credits back by hand if they should go.',
    ],
  )
}
