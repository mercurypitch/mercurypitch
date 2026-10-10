// ============================================================
// withdrawal-refund-failed — a withdrawal refund Stripe fails or cancels
// ============================================================
//
// Stripe can fail a refund it had reported 'succeeded': the buyer's bank
// sends the money back, up to 30 days on, or the card has gone. The sweep
// stops following a refund once it succeeded (withdrawal-finish.ts), so the
// refund webhook hands each refund here, by its metadata.withdrawalId,
// whenever Stripe reports it 'failed' or 'canceled': one that had
// succeeded, and one still pending, whose webhook may come before the
// sweep notices.
//
// The statement's refund becomes 'failed', with Stripe's status and reason,
// and the owner is told to refund by hand: the buyer is still owed the
// money (CRD Art. 13(1)). The alert says the refund failed "after it went
// through" only when the statement records that Stripe had said it
// succeeded. Nothing goes back to the balance: the withdrawal took the
// credits, and they stay taken.
//
// Recorded only once Resend has taken that alert, and recorded as handed
// over (refundHandedOverAt), so no sweep tells again: until then this
// throws, so the webhook answers 500 and Stripe sends the event again. Once per
// statement and Stripe status: the same failure again answers 'already'
// and tells nobody. Stripe sends refund.failed and refund.updated for a
// failure at the same moment, and may deliver either twice, so a delivery
// claims the statement before it alerts (migration 0068), and only the one
// that claimed it tells the owner. Another event about the same failure
// leaves it to that one and answers 'already'; the same event, delivered
// again while its twin holds the claim, throws, so Stripe sends it once
// more. A claim goes back when its alert does not go, so a delivery that
// finds it gone and the failure not recorded throws as well. One older
// than CLAIM_STALE_MS belongs to a delivery that died and is taken over.
// A statement that is gone (its account was deleted since) has nothing to
// mark, and nothing to say whether the refund had gone through: the owner
// is told, from what the webhook knows, each time it is called.

import type { Env } from './auth'
import { formatMoney } from './email'
import type { StatementRow } from './withdrawal-row'
import { alert, priceKnown, refundLine, statementFacts } from './withdrawal-row'

/** A withdrawal refund Stripe failed or canceled, as the refund webhook
 *  reads it from the refund object. */
export interface FailedRefund {
  /** metadata.withdrawalId: the statement the refund was made for. */
  withdrawalId: string
  /** The refund's id, re_... */
  refundId: string
  /** The refund's status at Stripe now: 'failed' or 'canceled'. */
  stripeStatus: string
  /** Stripe's failure_reason, when it gave one. */
  reason?: string | null
  /** The Stripe event that says so, which claims the statement while it
   *  tells the owner. */
  eventId?: string
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

/** How long a claim on a statement holds: longer than any delivery takes
 *  to alert and record, so an older one belongs to a delivery that died. */
const CLAIM_STALE_MS = 10 * 60_000

/** Whether the statement records this failure already. */
function recorded(
  row: Pick<StatementRow, 'refundStatus' | 'stripeRefundStatus'>,
  failure: FailedRefund,
): boolean {
  return (
    row.refundStatus === 'failed' &&
    row.stripeRefundStatus === failure.stripeStatus
  )
}

interface Claim {
  by: string
  at: string
}

/** Claim the statement to tell the owner of its failed refund: null when
 *  another delivery holds a claim that is not stale, or the failure is
 *  recorded already. */
async function claim(
  env: Env,
  row: StatementRow,
  failure: FailedRefund,
): Promise<Claim | null> {
  const mine = {
    by: failure.eventId ?? crypto.randomUUID(),
    at: new Date().toISOString(),
  }
  const stale = new Date(Date.now() - CLAIM_STALE_MS).toISOString()
  const res = await env.DB.prepare(
    `UPDATE withdrawals
        SET refundFailureClaimedAt = ?, refundFailureClaimedBy = ?
      WHERE id = ? AND NOT (refundStatus = 'failed' AND stripeRefundStatus IS ?)
        AND (refundFailureClaimedAt IS NULL OR refundFailureClaimedAt < ?)`,
  )
    .bind(mine.at, mine.by, row.id, failure.stripeStatus, stale)
    .run()
  return res.meta.changes > 0 ? mine : null
}

/** Give a claim back, if it is still this delivery's. */
function release(env: Env, row: StatementRow, mine: Claim) {
  return env.DB.prepare(
    `UPDATE withdrawals
        SET refundFailureClaimedAt = NULL, refundFailureClaimedBy = NULL
      WHERE id = ? AND refundFailureClaimedBy = ? AND refundFailureClaimedAt = ?`,
  ).bind(row.id, mine.by, mine.at)
}

/** What a delivery that found the statement claimed answers: 'already'
 *  when the failure is recorded, or another event about it holds the
 *  claim and tells the owner (or is delivered again if it cannot). The
 *  same event, held by its twin, throws, so Stripe sends it once more, and
 *  so does any event that finds the claim given back with the failure not
 *  recorded: the holder's alert did not go. */
async function claimedElsewhere(
  env: Env,
  row: StatementRow,
  failure: FailedRefund,
): Promise<FailedRefundAnswer> {
  const now = await env.DB.prepare(
    'SELECT refundStatus, stripeRefundStatus, refundFailureClaimedBy FROM withdrawals WHERE id = ?',
  )
    .bind(row.id)
    .first<
      Pick<
        StatementRow,
        'refundStatus' | 'stripeRefundStatus' | 'refundFailureClaimedBy'
      >
    >()
  if (now === null || recorded(now, failure)) return 'already'
  if (
    failure.eventId !== undefined &&
    (now.refundFailureClaimedBy === failure.eventId ||
      now.refundFailureClaimedBy === null)
  ) {
    throw new RefundFailureNotTold(failure.withdrawalId)
  }
  return 'already'
}

/** Whether Stripe had said the statement's refund went through. */
function wentThrough(row: StatementRow): boolean {
  return row.stripeRefundStatus === 'succeeded'
}

function whyFailed(failure: FailedRefund, afterSuccess: boolean): string {
  const when = afterSuccess ? ' after it succeeded' : ''
  return `Stripe ${failure.stripeStatus} the refund${when}: ${failure.reason ?? 'no reason given'}`
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
 * Mark a withdrawal's refund failed, whether or not Stripe had reported it
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
      'Withdrawal: refund FAILED, statement gone, refund by hand',
      goneLines(failure),
    )
    if (!told) throw new RefundFailureNotTold(failure.withdrawalId)
    return 'not-found'
  }
  if (recorded(row, failure)) return 'already'
  const mine = await claim(env, row, failure)
  if (mine === null) return claimedElsewhere(env, row, failure)
  const money = priceKnown(row)
    ? ` ${formatMoney(row.refundMinor, row.currency)}`
    : ''
  const afterSuccess = wentThrough(row)
  const when = afterSuccess ? ' after it went through' : ''
  const subject = `Withdrawal: refund FAILED${when}, refund${money} by hand`
  if (!(await alert(env, subject, failedLines(row, failure)))) {
    await release(env, row, mine).run()
    throw new RefundFailureNotTold(failure.withdrawalId)
  }
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE withdrawals
          SET refundStatus = 'failed', stripeRefundStatus = ?,
              stripeRefundId = COALESCE(stripeRefundId, ?), refundError = ?,
              refundHandedOverAt = ?,
              refundFailureClaimedAt = NULL, refundFailureClaimedBy = NULL
        WHERE id = ? AND NOT (refundStatus = 'failed' AND stripeRefundStatus IS ?)`,
    ).bind(
      failure.stripeStatus,
      failure.refundId,
      whyFailed(failure, afterSuccess),
      new Date().toISOString(),
      row.id,
      failure.stripeStatus,
    ),
    release(env, row, mine),
  ])
  return 'recorded'
}
