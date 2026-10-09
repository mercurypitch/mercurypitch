// ============================================================
// withdrawal-finish — after a statement: the refund, the acknowledgement
// ============================================================
//
// What follows a withdrawal statement (withdrawal.ts), from the request
// that wrote it, a later request for the same pack, or the 6-hourly sweep
// (sweepStatements): the refund while it is pending, then followed while
// Stripe has not finished it (withdrawal-refund.ts); and the
// acknowledgement mail (email-withdrawal.ts), with the statement and the
// time it reached us, until it is sent. The two steps stand apart, so an
// error in one never skips the other, and one request at a time takes each.
//
// A refund Stripe refused is never asked for again: the owner refunds it
// by hand, and a second request could refund it twice. The owner is alerted
// whenever a request moves the refund, and when the acknowledgement first
// goes or fails; a retry that fails again tells nothing new. The sweep picks
// up a statement left unfinished for UNFINISHED_AFTER_MS, sends a failed
// acknowledgement again until GIVE_UP_AFTER_MS after the statement, then
// stops and alerts the owner once.

import type { Env } from './auth'
import { fallbackAppOrigin } from './auth'
import { GAVE_UP, GIVE_UP_AFTER_MS, SWEEP_BATCH, traderDetails, UNFINISHED_AFTER_MS, } from './checkout-consent'
import { formatMoney, sendBillingAlert } from './email'
import type { WithdrawalRefundState } from './email-withdrawal'
import { sendWithdrawalMail } from './email-withdrawal'
import type { RefundOutcome } from './withdrawal-refund'
import { followRefund, isOpenAtStripe, refundAtStripe, } from './withdrawal-refund'
import type { RefundBasis } from './withdrawal-rules'

/** Where a statement's price came from: the checkout's record, what the
 *  PaymentIntent received, or nowhere. */
export type PriceSource = 'checkout' | 'stripe' | 'none'

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
}

/** Whether the statement knows what was paid. */
export function priceKnown(row: Pick<StatementRow, 'priceSource'>): boolean {
  return row.priceSource !== 'none'
}

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

// ── The refund ───────────────────────────────────────────────────────

function withOutcome(row: StatementRow, outcome: RefundOutcome): StatementRow {
  return {
    ...row,
    refundStatus: outcome.status,
    stripeRefundId: outcome.refundId ?? row.stripeRefundId,
    refundError: outcome.error,
    stripeRefundStatus: outcome.stripeStatus,
  }
}

/** Keep what Stripe answered. Only a pending statement takes it, so a late
 *  answer never overwrites a refund already recorded. False when another
 *  request recorded it first. */
async function recordRefund(
  env: Env,
  row: StatementRow,
  outcome: RefundOutcome,
): Promise<boolean> {
  const res = await env.DB.prepare(
    `UPDATE withdrawals
        SET refundStatus = ?, stripeRefundId = ?, refundError = ?, refundedAt = ?, stripeRefundStatus = ?
      WHERE id = ? AND refundStatus = 'pending'`,
  )
    .bind(
      outcome.status,
      outcome.refundId,
      outcome.error,
      outcome.status === 'refunded' ? new Date().toISOString() : null,
      outcome.stripeStatus,
      row.id,
    )
    .run()
  return res.meta.changes > 0
}

/** Keep where a refund Stripe took has got to, if nobody moved it since. */
async function recordFollowUp(
  env: Env,
  row: StatementRow,
  outcome: RefundOutcome,
): Promise<boolean> {
  const res = await env.DB.prepare(
    `UPDATE withdrawals SET refundStatus = ?, refundError = ?, stripeRefundStatus = ?
      WHERE id = ? AND refundStatus = 'refunded' AND stripeRefundStatus IS ?`,
  )
    .bind(
      outcome.status,
      outcome.error,
      outcome.stripeStatus,
      row.id,
      row.stripeRefundStatus,
    )
    .run()
  return res.meta.changes > 0
}

interface RefundStep {
  row: StatementRow
  /** The owner should hear of it. */
  moved: boolean
}

/** Follow a refund Stripe took but has not finished. Only an end that
 *  takes the money back from the buyer is news. */
async function followUp(env: Env, row: StatementRow): Promise<RefundStep> {
  const outcome = await followRefund(env, row.stripeRefundId ?? '')
  if (
    outcome === null ||
    outcome.status === 'pending' ||
    outcome.stripeStatus === row.stripeRefundStatus ||
    !(await recordFollowUp(env, row, outcome))
  ) {
    return { row, moved: false }
  }
  return { row: withOutcome(row, outcome), moved: outcome.status === 'failed' }
}

/** The refund step: ask while it is pending, follow while Stripe has not
 *  finished it. */
async function settleRefund(
  env: Env,
  row: StatementRow,
  retry: boolean,
): Promise<RefundStep> {
  if (row.refundStatus === 'pending') {
    const outcome = await refundAtStripe(env, row, retry)
    if (outcome.status === 'pending') return { row, moved: false }
    if (!(await recordRefund(env, row, outcome))) return { row, moved: false }
    return { row: withOutcome(row, outcome), moved: true }
  }
  if (
    row.refundStatus === 'refunded' &&
    row.stripeRefundId !== null &&
    isOpenAtStripe(row.stripeRefundStatus)
  ) {
    return followUp(env, row)
  }
  return { row, moved: false }
}

// ── The acknowledgement ──────────────────────────────────────────────

/** Take the acknowledgement for this request, so two requests never both
 *  send it: one not yet sent, one that failed, or a claim gone stale. */
async function claimMail(env: Env, row: StatementRow): Promise<boolean> {
  const now = Date.now()
  const res = await env.DB.prepare(
    `UPDATE withdrawals SET mailStatus = 'sending', mailAt = ?
      WHERE id = ?
        AND (mailStatus IS NULL OR mailStatus = 'failed'
             OR (mailStatus = 'sending' AND mailAt < ?))`,
  )
    .bind(iso(now), row.id, iso(now - UNFINISHED_AFTER_MS))
    .run()
  return res.meta.changes > 0
}

/** Send the acknowledgement and record whether it went. Never throws. */
async function acknowledge(env: Env, row: StatementRow): Promise<string> {
  let status = 'not-configured'
  const apiKey = env.RESEND_API_KEY ?? ''
  if (apiKey !== '') {
    const app = fallbackAppOrigin(env)
    const known = priceKnown(row)
    const sent = await sendWithdrawalMail(
      { apiKey, from: env.EMAIL_FROM },
      {
        appOrigin: app,
        assetOrigin: app,
        name: row.name,
        email: row.email,
        packLabel: row.packLabel,
        paidCredits: row.paidCredits,
        purchasedAtIso: row.purchasedAt,
        amountMinor: known ? row.amountMinor : null,
        currency: row.currency,
        submittedAtIso: row.submittedAt,
        unusedCredits: row.unusedCredits,
        bonusCredits: row.bonusCredits,
        refundMinor: known ? row.refundMinor : null,
        basis: row.refundBasis ?? 'unused',
        refundState: row.refundStatus,
        trader: traderDetails(env),
      },
      `withdrawal-${row.id}`,
    ).catch(() => false)
    status = sent ? 'sent' : 'failed'
  }
  await env.DB.prepare(
    'UPDATE withdrawals SET mailStatus = ?, mailAt = ? WHERE id = ?',
  )
    .bind(status, new Date().toISOString(), row.id)
    .run()
    .catch((err: unknown) => {
      console.error(
        `[billing] withdrawal ${row.id}: mail record FAILED: ${String(err)}`,
      )
    })
  return status
}

// ── The owner's alert ────────────────────────────────────────────────

function alert(env: Env, subject: string, lines: string[]): Promise<boolean> {
  return sendBillingAlert(
    { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
    env.BILLING_ALERT_EMAIL ?? '',
    subject,
    lines,
  ).catch(() => false)
}

function alertSubject(row: StatementRow): string {
  if (!priceKnown(row)) {
    return 'Withdrawal: refund by hand, the price paid is not on record'
  }
  const money = formatMoney(row.refundMinor, row.currency)
  switch (row.refundStatus) {
    case 'refunded':
      return `Withdrawal: refunded ${money}`
    case 'none':
      return 'Withdrawal: nothing to refund'
    case 'pending':
      return `Withdrawal: refund of ${money} still open`
    case 'failed':
      return `Withdrawal: refund FAILED, refund ${money} by hand`
    default:
      return `Withdrawal: refund ${money} by hand`
  }
}

function refundLine(row: StatementRow): string {
  const whole = row.refundBasis === 'full'
  if (!priceKnown(row)) {
    return whole
      ? 'Refund: everything that was paid (no consent on record); the price paid is not on record'
      : `Refund: ${row.unusedCredits}/${row.paidCredits} of what was paid, rounded down to the cent; the price paid is not on record`
  }
  const basis = whole ? ', the whole price: no consent on record' : ''
  return `Refund: ${formatMoney(row.refundMinor, row.currency)} of ${formatMoney(row.amountMinor, row.currency)}, ${row.refundStatus}${basis}`
}

function statementFacts(row: StatementRow): string[] {
  return [
    `Statement: ${row.id}, submitted ${row.submittedAt}`,
    `Account: ${row.userId}`,
    `Purchase: ${row.purchaseId} (${row.packLabel}, ${row.paidCredits} credits, bought ${row.purchasedAt})`,
    `PaymentIntent: ${row.paymentIntentId ?? 'none on record'}`,
  ]
}

function alertLines(row: StatementRow, mail: string): string[] {
  const byHand = row.refundStatus === 'failed' || row.refundStatus === 'manual'
  return [
    ...statementFacts(row),
    `Credits removed: ${row.unusedCredits} paid, ${row.bonusCredits} bonus`,
    refundLine(row),
    ...(row.stripeRefundId === null
      ? []
      : [
          `Stripe refund: ${row.stripeRefundId}, ${row.stripeRefundStatus ?? 'status not given'}`,
        ]),
    ...(row.refundError === null ? [] : [`Why not: ${row.refundError}`]),
    `Acknowledgement mail: ${mail}`,
    ...(mail === 'failed'
      ? ['The sweep sends it again every 6 hours for 3 days.']
      : []),
    ...(byHand
      ? [
          '',
          'The statement stands: refund this in the Stripe dashboard within',
          '14 days of the statement. That refund takes no more credits; the',
          'withdrawal took them already.',
        ]
      : []),
  ]
}

/**
 * Everything after the statement is written, or whatever an earlier
 * request left undone: the refund step, then the acknowledgement until it
 * is sent, each on its own. Alerts the owner when this request moved the
 * refund, or sent or failed the acknowledgement the first time. Never
 * throws.
 */
export async function finish(
  env: Env,
  row: StatementRow,
  retry: boolean,
): Promise<StatementRow> {
  let done = row
  let moved = false
  try {
    const step = await settleRefund(env, row, retry)
    done = step.row
    moved = step.moved
  } catch (err) {
    console.error(
      `[billing] withdrawal ${row.id}: refund step failed: ${String(err)}`,
    )
  }
  try {
    const firstTry = row.mailStatus === null || row.mailStatus === 'sending'
    if (await claimMail(env, done)) {
      done = { ...done, mailStatus: await acknowledge(env, done) }
      moved = moved || firstTry
    }
  } catch (err) {
    console.error(
      `[billing] withdrawal ${row.id}: acknowledgement step failed: ${String(err)}`,
    )
  }
  if (moved) {
    await alert(
      env,
      alertSubject(done),
      alertLines(done, done.mailStatus ?? 'not sent yet'),
    )
  }
  return done
}

// ── The sweep ────────────────────────────────────────────────────────

function mailUnsent(row: StatementRow, nowMs: number): boolean {
  if (row.mailStatus === null || row.mailStatus === 'failed') return true
  return (
    row.mailStatus === 'sending' &&
    Date.parse(row.mailAt ?? '') < nowMs - UNFINISHED_AFTER_MS
  )
}

/** Stop sending an acknowledgement that kept failing: once, with one
 *  alert. */
async function giveUpAcknowledgement(
  env: Env,
  row: StatementRow,
  nowMs: number,
): Promise<StatementRow> {
  const res = await env.DB.prepare(
    `UPDATE withdrawals SET mailStatus = ?, mailAt = ?
      WHERE id = ?
        AND (mailStatus IS NULL OR mailStatus = 'failed'
             OR (mailStatus = 'sending' AND mailAt < ?))`,
  )
    .bind(GAVE_UP, iso(nowMs), row.id, iso(nowMs - UNFINISHED_AFTER_MS))
    .run()
  if (res.meta.changes === 0) return row
  await alert(env, 'Withdrawal: acknowledgement NOT sent, send it by hand', [
    ...statementFacts(row),
    `Send it to: ${row.email}`,
    '',
    'The acknowledgement has not gone for 3 days, and the sweep has stopped',
    'trying. CRD Art. 11a(4) asks for one on a durable medium without undue',
    'delay: send the buyer their statement and when it reached us.',
  ])
  return { ...row, mailStatus: GAVE_UP }
}

/**
 * What requests left unfinished, for statements older than
 * UNFINISHED_AFTER_MS: a refund still pending, one Stripe has not finished,
 * and an acknowledgement not sent. At most SWEEP_BATCH a run, oldest first
 * (withdrawal.ts, sweepWithdrawals).
 */
export async function sweepStatements(env: Env, nowMs: number): Promise<void> {
  const before = iso(nowMs - UNFINISHED_AFTER_MS)
  const { results } = await env.DB.prepare(
    `SELECT * FROM withdrawals
      WHERE submittedAt < ?
        AND (refundStatus = 'pending'
             OR (refundStatus = 'refunded'
                 AND stripeRefundStatus IN ('pending', 'requires_action'))
             OR mailStatus IS NULL OR mailStatus = 'failed'
             OR (mailStatus = 'sending' AND mailAt < ?))
      ORDER BY submittedAt LIMIT ?`,
  )
    .bind(before, before, SWEEP_BATCH)
    .all<StatementRow>()
  for (const row of results) {
    try {
      const expired = Date.parse(row.submittedAt) <= nowMs - GIVE_UP_AFTER_MS
      const current =
        expired && mailUnsent(row, nowMs)
          ? await giveUpAcknowledgement(env, row, nowMs)
          : row
      await finish(env, current, true)
    } catch (err) {
      console.error(`[cron] withdrawal ${row.id}: sweep FAILED: ${String(err)}`)
    }
  }
}
