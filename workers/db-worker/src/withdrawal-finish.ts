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
// A statement made while Stripe did not answer the price lookup waits with
// its price pending: the refund step asks again first, and refunds once
// Stripe answers. Only Stripe saying it has no such payment sends it to the
// owner to refund by hand.
//
// A refund Stripe refused is never asked for again: the owner refunds it
// by hand, and a second request could refund it twice. The owner is alerted
// whenever a request moves the refund, and when the acknowledgement first
// goes or fails; a retry that fails again tells nothing new. A refund still
// not through 5 days after its statement is news once more, once.
//
// The acknowledgement goes to the address the statement names, with a
// hidden copy to the account's own address when that is another.
//
// The sweep takes each duty on its own, at most SWEEP_BATCH a run, the
// longest untried first: acknowledgements not sent, refunds still pending,
// and refunds Stripe has not finished. Rows that keep failing never hold
// back a later one. It sends a failed acknowledgement again until
// MAIL_ATTEMPTS tries or GIVE_UP_AFTER_MS after the statement, then stops
// and alerts the owner once.

import type { Env } from './auth'
import { fallbackAppOrigin } from './auth'
import { GAVE_UP, GIVE_UP_AFTER_MS, MAIL_ATTEMPTS, SWEEP_BATCH, traderDetails, UNFINISHED_AFTER_MS, } from './checkout-consent'
import { formatMoney, sendBillingAlert } from './email'
import type { WithdrawalRefundState } from './email-withdrawal'
import { sendWithdrawalMail } from './email-withdrawal'
import type { Price, RefundOutcome } from './withdrawal-refund'
import { followRefund, isOpenAtStripe, paidAtStripe, refundAtStripe, } from './withdrawal-refund'
import type { RefundBasis } from './withdrawal-rules'
import { refundFor } from './withdrawal-rules'

/** Where a statement's price came from: the checkout's record, what the
 *  PaymentIntent received, nowhere, or not known yet (Stripe did not answer
 *  the lookup, which is asked again). */
export type PriceSource = 'checkout' | 'stripe' | 'none' | 'pending'

/** Why a statement with no known price is refunded by hand. */
export const PRICE_NOT_ON_RECORD = 'The price paid is not on record'

/** A refund not through this long after its statement alerts the owner
 *  once more. */
export const ESCALATE_AFTER_MS = 5 * 86_400_000

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

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

// ── The price ────────────────────────────────────────────────────────

/** The refund a statement owes once its price is known, from what the
 *  statement counted when it was made. */
function refundOnPrice(row: StatementRow, price: Price): number {
  return refundFor(row.refundBasis ?? 'unused', price.amountMinor, {
    paid: row.paidCredits,
    paidUnused: row.unusedCredits,
    bonus: 0,
    takenBack: 0,
  })
}

interface RefundStep {
  row: StatementRow
  /** The owner should hear of it. */
  moved: boolean
}

/** Ask Stripe again for the price of a statement made while it did not
 *  answer, and keep the answer if nobody priced the statement since. Only
 *  Stripe saying it has none sends it to the owner, by hand. */
async function priceStatement(
  env: Env,
  row: StatementRow,
): Promise<RefundStep> {
  const answer = await paidAtStripe(env, row.paymentIntentId)
  if (answer.kind === 'no-answer') return { row, moved: false }
  const priced: StatementRow =
    answer.kind === 'paid'
      ? {
          ...row,
          amountMinor: answer.price.amountMinor,
          refundMinor: refundOnPrice(row, answer.price),
          currency: answer.price.currency,
          priceSource: 'stripe',
        }
      : {
          ...row,
          priceSource: 'none',
          refundStatus: 'manual',
          refundError: PRICE_NOT_ON_RECORD,
        }
  const res = await env.DB.prepare(
    `UPDATE withdrawals
        SET amountMinor = ?, refundMinor = ?, currency = ?, priceSource = ?,
            refundStatus = ?, refundError = ?
      WHERE id = ? AND priceSource = 'pending'`,
  )
    .bind(
      priced.amountMinor,
      priced.refundMinor,
      priced.currency,
      priced.priceSource,
      priced.refundStatus,
      priced.refundError,
      row.id,
    )
    .run()
  if (res.meta.changes > 0) {
    return { row: priced, moved: priced.refundStatus === 'manual' }
  }
  const now = await env.DB.prepare('SELECT * FROM withdrawals WHERE id = ?')
    .bind(row.id)
    .first<StatementRow>()
  return { row: now ?? row, moved: false }
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

/** When the refund was last asked about: what the sweep orders by. Best
 *  effort, as it only orders. */
async function markRefundTried(env: Env, row: StatementRow): Promise<void> {
  await env.DB.prepare('UPDATE withdrawals SET refundTriedAt = ? WHERE id = ?')
    .bind(new Date().toISOString(), row.id)
    .run()
    .catch((err: unknown) => {
      console.error(
        `[billing] withdrawal ${row.id}: refund try not recorded: ${String(err)}`,
      )
    })
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

/** Ask for a pending refund, pricing the statement first when Stripe did
 *  not answer the price before. */
async function askForRefund(
  env: Env,
  row: StatementRow,
  retry: boolean,
): Promise<RefundStep> {
  let current = row
  if (current.priceSource === 'pending') {
    const priced = await priceStatement(env, current)
    if (
      priced.moved ||
      priced.row.priceSource === 'pending' ||
      priced.row.refundStatus !== 'pending'
    ) {
      return priced
    }
    current = priced.row
  }
  const outcome = await refundAtStripe(env, current, retry)
  if (outcome.status === 'pending') return { row: current, moved: false }
  if (!(await recordRefund(env, current, outcome))) {
    return { row: current, moved: false }
  }
  return { row: withOutcome(current, outcome), moved: true }
}

/** The refund step: ask while it is pending, follow while Stripe has not
 *  finished it. */
async function settleRefund(
  env: Env,
  row: StatementRow,
  retry: boolean,
): Promise<RefundStep> {
  if (!refundOpen(row)) return { row, moved: false }
  await markRefundTried(env, row)
  if (row.refundStatus === 'pending') return askForRefund(env, row, retry)
  return row.stripeRefundId === null
    ? { row, moved: false }
    : followUp(env, row)
}

// ── The acknowledgement ──────────────────────────────────────────────

/** Take the acknowledgement for this request, so two requests never both
 *  send it: one not yet sent, one that failed, or a claim gone stale. */
async function claimMail(env: Env, row: StatementRow): Promise<boolean> {
  const now = Date.now()
  const res = await env.DB.prepare(
    `UPDATE withdrawals
        SET mailStatus = 'sending', mailAt = ?, mailAttempts = mailAttempts + 1
      WHERE id = ?
        AND (mailStatus IS NULL OR mailStatus = 'failed'
             OR (mailStatus = 'sending' AND mailAt < ?))`,
  )
    .bind(iso(now), row.id, iso(now - UNFINISHED_AFTER_MS))
    .run()
  return res.meta.changes > 0
}

/** The account's own address, when the statement names another: the
 *  acknowledgement's hidden copy goes there. */
async function accountCopy(
  env: Env,
  row: StatementRow,
): Promise<string | undefined> {
  const user = await env.DB.prepare('SELECT email FROM users WHERE id = ?')
    .bind(row.userId)
    .first<{ email: string | null }>()
    .catch(() => null)
  const account = (user?.email ?? '').trim()
  const same = account.toLowerCase() === row.email.trim().toLowerCase()
  return account === '' || same ? undefined : account
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
      await accountCopy(env, row),
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
  if (row.priceSource === 'pending') {
    return 'Withdrawal: refund waits for the price paid'
  }
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

/** What the refund is, in words for the owner. */
function refundLine(row: StatementRow): string {
  const whole = row.refundBasis === 'full'
  const share = whole
    ? 'everything that was paid'
    : `${row.unusedCredits}/${row.paidCredits} of what was paid, rounded down to the cent`
  if (row.priceSource === 'pending') {
    return `Refund: ${share}; Stripe has not said what was paid yet, and is asked again every 6 hours`
  }
  if (!priceKnown(row)) {
    return whole
      ? 'Refund: everything that was paid (no consent on record); the price paid is not on record'
      : `Refund: ${share}; the price paid is not on record`
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
      ? [
          `The sweep tries again every 6 hours, ${MAIL_ATTEMPTS} tries in all over at most 3 days.`,
        ]
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

/** Whether to stop sending an acknowledgement that keeps failing: after
 *  MAIL_ATTEMPTS tries, or GIVE_UP_AFTER_MS after the statement. */
function mailExpired(row: StatementRow, nowMs: number): boolean {
  if (!mailUnsent(row, nowMs)) return false
  return (
    Number(row.mailAttempts ?? 0) >= MAIL_ATTEMPTS ||
    Date.parse(row.submittedAt) <= nowMs - GIVE_UP_AFTER_MS
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
    `The acknowledgement did not go in ${MAIL_ATTEMPTS} tries or 3 days, and the sweep`,
    'has stopped trying. CRD Art. 11a(4) asks for one on a durable medium',
    'without undue delay: send the buyer their statement and when it',
    'reached us.',
  ])
  return { ...row, mailStatus: GAVE_UP }
}

function escalationLines(row: StatementRow): string[] {
  const atStripe = row.refundStatus === 'refunded'
  return [
    ...statementFacts(row),
    refundLine(row),
    ...(atStripe
      ? [
          `Stripe refund: ${row.stripeRefundId ?? 'id not given'}, still ${row.stripeRefundStatus ?? 'open'}`,
          '',
          'Check it in the Stripe dashboard: a refund that requires action',
          'waits for you or the buyer.',
        ]
      : [
          'Stripe has not confirmed the refund. The sweep asks again every 6',
          'hours, under the same idempotency key and metadata, so do not',
          'refund it by hand while it waits: it would go twice. Find out why',
          'Stripe is not answering.',
        ]),
    '',
    'The buyer must have the money back within 14 days of the statement',
    '(CRD Art. 13(1)). This is the only reminder for this statement.',
  ]
}

/** Tell the owner, once, of a refund still not through ESCALATE_AFTER_MS
 *  after its statement. */
async function escalate(
  env: Env,
  row: StatementRow,
  nowMs: number,
): Promise<void> {
  if (!refundOpen(row) || (row.refundEscalatedAt ?? null) !== null) return
  if (Date.parse(row.submittedAt) > nowMs - ESCALATE_AFTER_MS) return
  const res = await env.DB.prepare(
    'UPDATE withdrawals SET refundEscalatedAt = ? WHERE id = ? AND refundEscalatedAt IS NULL',
  )
    .bind(iso(nowMs), row.id)
    .run()
  if (res.meta.changes === 0) return
  const money = priceKnown(row)
    ? ` of ${formatMoney(row.refundMinor, row.currency)}`
    : ''
  await alert(
    env,
    `Withdrawal: refund${money} still open after 5 days`,
    escalationLines(row),
  )
}

/** Acknowledgements not sent: never tried first, then by their last try.
 *  Binds: the cut-off twice, then the batch size. */
const UNSENT_ACKNOWLEDGEMENTS_SQL = `SELECT * FROM withdrawals
      WHERE submittedAt < ?
        AND (mailStatus IS NULL OR mailStatus = 'failed'
             OR (mailStatus = 'sending' AND mailAt < ?))
      ORDER BY mailAt, submittedAt LIMIT ?`

/** Refunds not asked for, or not answered, yet: by their last try. */
const PENDING_REFUNDS_SQL = `SELECT * FROM withdrawals
      WHERE submittedAt < ? AND refundStatus = 'pending'
      ORDER BY refundTriedAt, submittedAt LIMIT ?`

/** Refunds Stripe took and has not finished: by their last look. */
const OPEN_REFUNDS_SQL = `SELECT * FROM withdrawals
      WHERE submittedAt < ? AND refundStatus = 'refunded'
        AND stripeRefundStatus IN ('pending', 'requires_action')
      ORDER BY refundTriedAt, submittedAt LIMIT ?`

/** The statements each duty takes this run, each statement once. A duty
 *  whose query fails leaves the others to run. */
async function unfinished(env: Env, before: string): Promise<StatementRow[]> {
  const duties = await Promise.allSettled([
    env.DB.prepare(UNSENT_ACKNOWLEDGEMENTS_SQL)
      .bind(before, before, SWEEP_BATCH)
      .all<StatementRow>(),
    env.DB.prepare(PENDING_REFUNDS_SQL)
      .bind(before, SWEEP_BATCH)
      .all<StatementRow>(),
    env.DB.prepare(OPEN_REFUNDS_SQL)
      .bind(before, SWEEP_BATCH)
      .all<StatementRow>(),
  ])
  const byId = new Map<string, StatementRow>()
  for (const duty of duties) {
    if (duty.status === 'rejected') {
      console.error(`[cron] withdrawal duty FAILED: ${String(duty.reason)}`)
      continue
    }
    for (const row of duty.value.results) {
      if (!byId.has(row.id)) byId.set(row.id, row)
    }
  }
  return [...byId.values()]
}

/**
 * What requests left unfinished, for statements older than
 * UNFINISHED_AFTER_MS: an acknowledgement not sent, a refund still pending,
 * and one Stripe has not finished, each duty at most SWEEP_BATCH a run, the
 * longest untried first (withdrawal.ts, sweepWithdrawals). A refund still
 * open 5 days after its statement alerts the owner once.
 */
export async function sweepStatements(env: Env, nowMs: number): Promise<void> {
  for (const row of await unfinished(env, iso(nowMs - UNFINISHED_AFTER_MS))) {
    try {
      const current = mailExpired(row, nowMs)
        ? await giveUpAcknowledgement(env, row, nowMs)
        : row
      await escalate(env, await finish(env, current, true), nowMs)
    } catch (err) {
      console.error(`[cron] withdrawal ${row.id}: sweep FAILED: ${String(err)}`)
    }
  }
}
