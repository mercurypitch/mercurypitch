// ============================================================
// withdrawal-row — a withdrawal statement as withdrawals stores it
// ============================================================
//
// The row the request writes (withdrawal.ts) and everything after it reads
// and moves: the refund (withdrawal-finish.ts), the acknowledgement
// (withdrawal-ack.ts), a refund that fails later
// (withdrawal-refund-failed.ts) and the account deletion hold
// (withdrawal-hold.ts). Also the words the owner's alerts share.

import type { Env } from './auth'
import { formatMoney, sendBillingAlert } from './email'
import type { WithdrawalRefundState } from './email-withdrawal'
import { isOpenAtStripe } from './withdrawal-refund'
import type { RefundBasis } from './withdrawal-rules'

/** Where a statement's price came from: the checkout's record, what the
 *  PaymentIntent received, nowhere, or not known yet (Stripe did not answer
 *  the lookup, which is asked again). */
export type PriceSource = 'checkout' | 'stripe' | 'none' | 'pending'

/** Why a statement with no known price is refunded by hand. */
export const PRICE_NOT_ON_RECORD = 'The price paid is not on record'

/** A statement as withdrawals stores it. */
export interface StatementRow {
  id: string
  userId: string
  purchaseId: string
  paymentIntentId: string | null
  submittedAt: string
  name: string
  email: string
  packLabel: string
  purchasedAt: string
  paidCredits: number
  unusedCredits: number
  bonusCredits: number
  amountMinor: number
  refundMinor: number
  currency: string
  refundStatus: WithdrawalRefundState
  stripeRefundId: string | null
  refundError: string | null
  mailStatus: string | null
  mailAt: string | null
  /** NULL on a statement from before migration 0061: 'unused'. */
  refundBasis: RefundBasis | null
  priceSource: PriceSource | null
  stripeRefundStatus: string | null
  /** Migration 0062: the refund's last try, the 5-day alert, and the
   *  acknowledgement's tries. */
  refundTriedAt?: string | null
  refundEscalatedAt?: string | null
  mailAttempts?: number
  /** Migration 0066: what Resend answered the acknowledgement's last try,
   *  the 3-day alert that it has not gone, and the alert that handed the
   *  refund to the owner (byHandUntold, withdrawal-finish.ts). */
  mailError?: string | null
  mailWarnedAt?: string | null
  refundHandedOverAt?: string | null
  /** Migration 0068: the claim of the delivery telling the owner that the
   *  refund failed (withdrawal-refund-failed.ts). */
  refundFailureClaimedAt?: string | null
  refundFailureClaimedBy?: string | null
}

/** Whether the statement knows what was paid. */
export function priceKnown(row: Pick<StatementRow, 'priceSource'>): boolean {
  return row.priceSource !== 'none' && row.priceSource !== 'pending'
}

/** Whether the buyer is still waiting for the refund: not asked for, or
 *  not answered, yet, or taken by Stripe but not finished. */
export function refundOpen(
  row: Pick<StatementRow, 'refundStatus' | 'stripeRefundStatus'>,
): boolean {
  return (
    row.refundStatus === 'pending' ||
    (row.refundStatus === 'refunded' && isOpenAtStripe(row.stripeRefundStatus))
  )
}

/** Whether the refund is the owner's to make by hand: Stripe refused or
 *  failed it, or it was never Stripe's to make. */
export function byHand(row: Pick<StatementRow, 'refundStatus'>): boolean {
  return row.refundStatus === 'failed' || row.refundStatus === 'manual'
}

/** A refund to make by hand that the owner has not heard of yet: told again
 *  at every sweep, and the account cannot be deleted meanwhile. */
export function byHandUntold(
  row: Pick<StatementRow, 'refundStatus' | 'refundHandedOverAt'>,
): boolean {
  return byHand(row) && (row.refundHandedOverAt ?? null) === null
}

export function iso(ms: number): string {
  return new Date(ms).toISOString()
}

/** Alert the owner (BILLING_ALERT_EMAIL). True once Resend took it: what
 *  hangs on the owner hearing is recorded only then. Never throws. */
export function alert(
  env: Env,
  subject: string,
  lines: string[],
): Promise<boolean> {
  return sendBillingAlert(
    { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
    env.BILLING_ALERT_EMAIL ?? '',
    subject,
    lines,
  ).catch(() => false)
}

export function statementFacts(row: StatementRow): string[] {
  return [
    `Statement: ${row.id}, submitted ${row.submittedAt}`,
    `Account: ${row.userId}`,
    `Purchase: ${row.purchaseId} (${row.packLabel}, ${row.paidCredits} credits, bought ${row.purchasedAt})`,
    `PaymentIntent: ${row.paymentIntentId ?? 'none on record'}`,
  ]
}

/** The refund, as the owner's subjects name it: " of €5.00", or nothing
 *  while the price is not known. */
export function refundMoney(row: StatementRow): string {
  return priceKnown(row)
    ? ` of ${formatMoney(row.refundMinor, row.currency)}`
    : ''
}

/** Why the refund of a pack with no consent on record is what it is: the
 *  whole price, what an earlier refund left of it, or, while the amount is
 *  not known, the price less any earlier refund. */
function wholeBasis(row: StatementRow): string {
  if (!priceKnown(row)) {
    return 'the price less any earlier refund: no consent on record'
  }
  return row.refundMinor === row.amountMinor
    ? 'the whole price: no consent on record'
    : "what's left of the price: no consent on record"
}

/** What the refund is, in words for the owner. */
export function refundLine(row: StatementRow): string {
  const whole = row.refundBasis === 'full'
  const share = whole
    ? wholeBasis(row)
    : `${row.unusedCredits}/${row.paidCredits} of what was paid, rounded down to the cent`
  if (row.priceSource === 'pending') {
    // Asked again only while the refund waits for it (withdrawal-finish.ts).
    return row.refundStatus === 'pending'
      ? `Refund: ${share}; Stripe has not said what was paid yet, and is asked again every 6 hours`
      : `Refund: ${share}; Stripe has not said what was paid`
  }
  if (!priceKnown(row)) {
    return `Refund: ${share}; the price paid is not on record`
  }
  const basis = whole ? `, ${wholeBasis(row)}` : ''
  return `Refund: ${formatMoney(row.refundMinor, row.currency)} of ${formatMoney(row.amountMinor, row.currency)}, ${row.refundStatus}${basis}`
}
