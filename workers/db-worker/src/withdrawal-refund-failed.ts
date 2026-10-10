// ============================================================
// withdrawal-refund-failed — a refund that fails after Stripe said it went
// ============================================================
//
// Stripe can fail a refund it had reported 'succeeded': the buyer's bank
// sends the money back, up to 30 days on, or the card has gone. The sweep
// stops following a refund once it succeeded (withdrawal-finish.ts), so the
// refund webhook hands each such refund here, by its metadata.withdrawalId,
// whenever Stripe reports it 'failed' or 'canceled'.
//
// The statement's refund becomes 'failed', with Stripe's status and reason,
// and the owner is told to refund by hand: the buyer is still owed the
// money (CRD Art. 13(1)). Nothing goes back to the balance: the withdrawal
// took the credits, and they stay taken.
//
// Recorded only once Resend has taken that alert, and recorded as handed
// over (refundHandedOverAt), so no sweep tells again: until then this
// throws, so the webhook answers 500 and Stripe sends the event again. Once per
// statement and Stripe status: the same failure again answers 'already'
// and tells nobody. A statement that is gone (its account was deleted after
// the refund went through) has nothing to mark: the owner is told, from
// what the webhook knows, each time it is called.

import type { Env } from './auth'
import { formatMoney } from './email'
import type { StatementRow } from './withdrawal-row'
import { alert, priceKnown, refundLine, statementFacts } from './withdrawal-row'

/** A withdrawal refund Stripe failed after it succeeded, as the refund
 *  webhook reads it from the refund object. */
export interface FailedRefund {
  /** metadata.withdrawalId: the statement the refund was made for. */
  withdrawalId: string
  /** The refund's id, re_... */
  refundId: string
  /** The refund's status at Stripe now: 'failed' or 'canceled'. */
  stripeStatus: string
  /** Stripe's failure_reason, when it gave one. */
  reason?: string | null
  /** What the refund object says, for the alert when the statement is
   *  gone. */
  paymentIntentId?: string | null
  amountMinor?: number | null
  currency?: string | null
}

/** What became of it: recorded and the owner told; recorded already for
 *  this status, nobody told; or no such statement, the owner told. */
export type FailedRefundAnswer = 'recorded' | 'already' | 'not-found'

/** The owner's alert did not go, so nothing was recorded. */
export class RefundFailureNotTold extends Error {
  constructor(withdrawalId: string) {
    super(
      `withdrawal ${withdrawalId}: the alert about its failed refund did not go`,
    )
    this.name = 'RefundFailureNotTold'
  }
}

function whyFailed(failure: FailedRefund): string {
  return `Stripe ${failure.stripeStatus} the refund after it succeeded: ${failure.reason ?? 'no reason given'}`
}

const BY_HAND = [
  '',
  'The buyer is still owed this refund (CRD Art. 13(1)). Refund it by hand',
  'to a card or account they can use now, and tell them. Nothing goes back',
  'to their balance: the withdrawal took the credits, and they stay taken.',
]

/** The alert, from the statement as this records it: its refund failed. */
function failedLines(row: StatementRow, failure: FailedRefund): string[] {
  return [
    ...statementFacts(row),
    refundLine({
      ...row,
      refundStatus: 'failed',
      stripeRefundStatus: failure.stripeStatus,
    }),
    `Stripe refund: ${failure.refundId}, now ${failure.stripeStatus}`,
    `Why: ${failure.reason ?? 'Stripe gave no reason'}`,
    ...BY_HAND,
  ]
}

function goneLines(failure: FailedRefund): string[] {
  const money =
    failure.amountMinor == null
      ? 'amount not given'
      : formatMoney(failure.amountMinor, failure.currency ?? 'eur')
  return [
    `Statement: ${failure.withdrawalId}, no longer on record (the account was deleted?)`,
    `PaymentIntent: ${failure.paymentIntentId ?? 'not given'}`,
    `Stripe refund: ${failure.refundId}, ${money}, now ${failure.stripeStatus}`,
    `Why: ${failure.reason ?? 'Stripe gave no reason'}`,
    ...BY_HAND,
  ]
}

/**
 * Mark a withdrawal's refund failed after Stripe had reported it
 * succeeded, and tell the owner to refund it by hand. Gives no credits
 * back. Idempotent per statement and Stripe status. Throws
 * RefundFailureNotTold when the owner's alert did not go, with nothing
 * recorded, so the caller can answer 500 and be called again.
 */
export async function markWithdrawalRefundFailed(
  env: Env,
  failure: FailedRefund,
): Promise<FailedRefundAnswer> {
  const row = await env.DB.prepare('SELECT * FROM withdrawals WHERE id = ?')
    .bind(failure.withdrawalId)
    .first<StatementRow>()
  if (row === null) {
    const told = await alert(
      env,
      'Withdrawal: refund FAILED after it went through, statement gone, refund by hand',
      goneLines(failure),
    )
    if (!told) throw new RefundFailureNotTold(failure.withdrawalId)
    return 'not-found'
  }
  if (
    row.refundStatus === 'failed' &&
    row.stripeRefundStatus === failure.stripeStatus
  ) {
    return 'already'
  }
  const money = priceKnown(row)
    ? ` ${formatMoney(row.refundMinor, row.currency)}`
    : ''
  const subject = `Withdrawal: refund FAILED after it went through, refund${money} by hand`
  if (!(await alert(env, subject, failedLines(row, failure)))) {
    throw new RefundFailureNotTold(failure.withdrawalId)
  }
  await env.DB.prepare(
    `UPDATE withdrawals
        SET refundStatus = 'failed', stripeRefundStatus = ?,
            stripeRefundId = COALESCE(stripeRefundId, ?), refundError = ?,
            refundHandedOverAt = ?
      WHERE id = ? AND NOT (refundStatus = 'failed' AND stripeRefundStatus IS ?)`,
  )
    .bind(
      failure.stripeStatus,
      failure.refundId,
      whyFailed(failure),
      new Date().toISOString(),
      row.id,
      failure.stripeStatus,
    )
    .run()
  return 'recorded'
}
