// ============================================================
// withdrawal-finish — after a statement: the refund, the acknowledgement
// ============================================================
//
// What follows a withdrawal statement (withdrawal.ts), from the request
// that wrote it, a later request for the same pack, or the 6-hourly sweep
// (sweepStatements): the refund while it is pending, then followed while
// Stripe has not finished it (withdrawal-refund.ts); and the
// acknowledgement mail (withdrawal-ack.ts) until it is sent or given up.
// The two steps stand apart, so an error in one never skips the other, and
// one request at a time takes each.
//
// A statement made while Stripe did not answer the price lookup waits with
// its price pending: the refund step asks again first, and refunds once
// Stripe answers. Only Stripe saying it has no such payment sends it to the
// owner to refund by hand. Whatever leaves the refund pending, the
// statement keeps what Stripe answered (refundError), and the owner's
// alerts name it.
//
// A refund Stripe refused is never asked for again: the owner refunds it
// by hand, and a second request could refund it twice. The owner is alerted
// whenever a request moves the refund, and when the acknowledgement is
// first tried. A refund that becomes the owner's to make by hand counts as
// handed over (refundHandedOverAt) only once Resend has taken that alert;
// until then every sweep tells again (retellByHand), and the account cannot
// be deleted (withdrawal-hold.ts). A refund still open 5 days after its
// statement is news once more; one still open after 11 days is handed to
// the owner to finish by day 14 (CRD Art. 13(1)), and a pending one is no
// longer asked for, so it can never go twice. Each of those is recorded
// only once Resend has taken its alert: until then the next sweep sends it
// again.
//
// The sweep takes each duty on its own, at most SWEEP_BATCH a run, the
// longest untried first: acknowledgements not sent or not yet given up,
// refunds still pending, refunds Stripe has not finished, and refunds to
// make by hand the owner has not heard of. Rows that keep failing never
// hold back a later one.

import type { Env } from './auth'
import { SWEEP_BATCH, UNFINISHED_AFTER_MS } from './checkout-consent'
import { formatDate, formatMoney } from './email'
import { acknowledgeStep, mailLines, warnAcknowledgement, } from './withdrawal-ack'
import type { Price, RefundOutcome } from './withdrawal-refund'
import { followRefund, paidAtStripe, refundAtStripe } from './withdrawal-refund'
import type { StatementRow } from './withdrawal-row'
import { alert, byHand, byHandUntold, iso, PRICE_NOT_ON_RECORD, priceKnown, refundLine, refundMoney, refundOpen, statementFacts, } from './withdrawal-row'
import { refundFor } from './withdrawal-rules'

/** A refund not through this long after its statement alerts the owner
 *  once more. */
export const ESCALATE_AFTER_MS = 5 * 86_400_000
/** A refund still not through this long after its statement goes to the
 *  owner to finish by REFUND_DUE_MS. */
export const HAND_OVER_AFTER_MS = 11 * 86_400_000
/** The buyer has the money back within this of the statement (CRD
 *  Art. 13(1)). */
const REFUND_DUE_MS = 14 * 86_400_000

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

/** Keep what Stripe answered a price lookup or a refund that left the
 *  statement pending, for the owner. Best effort: it only explains. */
async function notePending(
  env: Env,
  row: StatementRow,
  why: string | null,
): Promise<StatementRow> {
  if (why === null || why === row.refundError) return row
  await env.DB.prepare(
    `UPDATE withdrawals SET refundError = ? WHERE id = ? AND refundStatus = 'pending'`,
  )
    .bind(why, row.id)
    .run()
    .catch((err: unknown) => {
      console.error(
        `[billing] withdrawal ${row.id}: refund note not recorded: ${String(err)}`,
      )
    })
  return { ...row, refundError: why }
}

/** Ask Stripe again for the price of a statement made while it did not
 *  answer, and keep the answer if nobody priced the statement since. Only
 *  Stripe saying it has none sends it to the owner, by hand. */
async function priceStatement(
  env: Env,
  row: StatementRow,
): Promise<RefundStep> {
  const answer = await paidAtStripe(env, row.paymentIntentId)
  if (answer.kind === 'no-answer') {
    return { row: await notePending(env, row, answer.why), moved: false }
  }
  const priced: StatementRow =
    answer.kind === 'paid'
      ? {
          ...row,
          amountMinor: answer.price.amountMinor,
          refundMinor: refundOnPrice(row, answer.price),
          currency: answer.price.currency,
          priceSource: 'stripe',
          refundError: null,
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
    // A refund that has just become the owner's has not been handed over.
    refundHandedOverAt: byHand({ refundStatus: outcome.status })
      ? null
      : row.refundHandedOverAt,
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

/** Keep where a refund Stripe took has got to, if nobody moved it since. A
 *  refund Stripe failed is the owner's to make by hand, and not handed over
 *  until they hear of it, even when the day-11 alert went. */
async function recordFollowUp(
  env: Env,
  row: StatementRow,
  outcome: RefundOutcome,
): Promise<boolean> {
  const res = await env.DB.prepare(
    `UPDATE withdrawals
        SET refundStatus = ?, refundError = ?, stripeRefundStatus = ?,
            refundHandedOverAt = CASE WHEN ? THEN NULL ELSE refundHandedOverAt END
      WHERE id = ? AND refundStatus = 'refunded' AND stripeRefundStatus IS ?`,
  )
    .bind(
      outcome.status,
      outcome.error,
      outcome.stripeStatus,
      byHand({ refundStatus: outcome.status }) ? 1 : 0,
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
  if (outcome.status === 'pending') {
    return { row: await notePending(env, current, outcome.error), moved: false }
  }
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

// ── The owner's alert ────────────────────────────────────────────────

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

/** The day the buyer must have the money back by, 14 days after the
 *  statement (CRD Art. 13(1)). */
function dueDate(row: StatementRow): string {
  return formatDate(iso(Date.parse(row.submittedAt) + REFUND_DUE_MS))
}

function alertLines(row: StatementRow): string[] {
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
    ...mailLines(row),
    ...(byHand(row)
      ? [
          '',
          `The statement stands: refund this in the Stripe dashboard by ${dueDate(row)},`,
          '14 days after the statement (CRD Art. 13(1)). That refund takes no',
          'more credits; the withdrawal took them already.',
        ]
      : []),
  ]
}

/** Keep that the owner has heard the refund is theirs, so no sweep tells
 *  again: only while it stands as `row`, what the alert described. One
 *  that fails to record, or has moved since, is told again at the next
 *  sweep. */
async function recordHandedOver(
  env: Env,
  row: StatementRow,
  nowMs: number,
): Promise<StatementRow> {
  try {
    const res = await env.DB.prepare(
      `UPDATE withdrawals SET refundHandedOverAt = ?
        WHERE id = ? AND refundStatus = ? AND stripeRefundStatus IS ?
          AND refundHandedOverAt IS NULL`,
    )
      .bind(iso(nowMs), row.id, row.refundStatus, row.stripeRefundStatus)
      .run()
    return res.meta.changes > 0
      ? { ...row, refundHandedOverAt: iso(nowMs) }
      : row
  } catch (err) {
    console.error(
      `[billing] withdrawal ${row.id}: hand-over not recorded: ${String(err)}`,
    )
    return row
  }
}

/**
 * Everything after the statement is written, or whatever an earlier
 * request left undone: the refund step, then the acknowledgement until it
 * is sent or given up, each on its own. Alerts the owner when this request
 * moved the refund, or made the acknowledgement's first try; a refund to
 * make by hand is handed over only once Resend has taken that alert.
 * Never throws.
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
    const mail = await acknowledgeStep(env, done)
    done = mail.row
    moved = moved || mail.firstTry
  } catch (err) {
    console.error(
      `[billing] withdrawal ${row.id}: acknowledgement step failed: ${String(err)}`,
    )
  }
  if (!moved) return done
  const told = await alert(env, alertSubject(done), alertLines(done))
  return told && byHandUntold(done)
    ? recordHandedOver(env, done, Date.now())
    : done
}

// ── What the owner hears later ───────────────────────────────────────

function escalationLines(row: StatementRow): string[] {
  const atStripe = row.refundStatus === 'refunded'
  return [
    ...statementFacts(row),
    refundLine(row),
    ...(row.refundError === null ? [] : [`Why not: ${row.refundError}`]),
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
          'Stripe is not answering: its last answer is above.',
        ]),
    '',
    'The buyer must have the money back within 14 days of the statement',
    '(CRD Art. 13(1)). If it is still open 11 days after the statement, you',
    'hear once more, with the date to finish it by.',
  ]
}

/** Tell the owner, once, of a refund still not through ESCALATE_AFTER_MS
 *  after its statement. Recorded only once Resend took the alert. */
async function escalate(
  env: Env,
  row: StatementRow,
  nowMs: number,
): Promise<void> {
  if (!refundOpen(row) || (row.refundEscalatedAt ?? null) !== null) return
  const submitted = Date.parse(row.submittedAt)
  // Past 11 days the hand-over says it all (handOver).
  if (submitted > nowMs - ESCALATE_AFTER_MS) return
  if (submitted <= nowMs - HAND_OVER_AFTER_MS) return
  const subject = `Withdrawal: refund${refundMoney(row)} still open after 5 days`
  if (!(await alert(env, subject, escalationLines(row)))) return
  await env.DB.prepare(
    'UPDATE withdrawals SET refundEscalatedAt = ? WHERE id = ? AND refundEscalatedAt IS NULL',
  )
    .bind(iso(nowMs), row.id)
    .run()
}

function handOverLines(row: StatementRow, due: string): string[] {
  const facts = [...statementFacts(row), refundLine(row)]
  if (row.refundStatus === 'refunded') {
    return [
      ...facts,
      `Stripe refund: ${row.stripeRefundId ?? 'id not given'}, still ${row.stripeRefundStatus ?? 'open'}`,
      '',
      `The buyer must have the money back by ${due} (CRD Art. 13(1)), and`,
      'Stripe has not finished this refund. Check it in the Stripe',
      'dashboard: one that requires action waits for you or the buyer.',
    ]
  }
  return [
    ...facts,
    `Why not: ${row.refundError ?? 'Stripe has not answered'}`,
    '',
    `Refund this by hand by ${due}, 14 days after the statement (CRD`,
    'Art. 13(1)). The sweep has stopped asking Stripe for it, so it can',
    'never go twice. Look in the Stripe dashboard first for a refund of',
    `this PaymentIntent with metadata withdrawalId ${row.id}: if there is`,
    'one, it went already. The withdrawal took the credits already; the',
    'refund takes no more.',
  ]
}

/**
 * Hand a refund still not through HAND_OVER_AFTER_MS after its statement
 * to the owner, to finish by day 14: by hand when Stripe never took it, in
 * the Stripe dashboard when Stripe has it open. A pending one becomes
 * 'manual', so the sweep never asks for it again and it can never go
 * twice, and its alert says so. Once, and only once Resend has taken the
 * alert, and only for the refund the alert described: one that moved while
 * the alert went (Stripe failed it, say) is left for the next sweep, which
 * tells the owner what it is now.
 */
async function handOver(
  env: Env,
  row: StatementRow,
  nowMs: number,
): Promise<void> {
  if (!refundOpen(row) || (row.refundHandedOverAt ?? null) !== null) {
    return
  }
  if (Date.parse(row.submittedAt) > nowMs - HAND_OVER_AFTER_MS) return
  const due = dueDate(row)
  const pending = row.refundStatus === 'pending'
  const subject = pending
    ? `Withdrawal: refund${refundMoney(row)} by hand by ${due}`
    : `Withdrawal: refund${refundMoney(row)} not finished at Stripe, due by ${due}`
  const told = pending ? { ...row, refundStatus: 'manual' as const } : row
  if (!(await alert(env, subject, handOverLines(told, due)))) return
  await env.DB.prepare(
    `UPDATE withdrawals
        SET refundHandedOverAt = ?,
            refundStatus = CASE refundStatus WHEN 'pending' THEN 'manual' ELSE refundStatus END
      WHERE id = ? AND refundHandedOverAt IS NULL
        AND refundStatus = ? AND stripeRefundStatus IS ?`,
  )
    .bind(iso(nowMs), row.id, row.refundStatus, row.stripeRefundStatus)
    .run()
}

/**
 * Tell the owner again of a refund to make by hand they have not heard of:
 * the alert sent when it became theirs did not go. Handed over only once
 * Resend has taken this one; until then it goes last in the sweep's line,
 * so it never holds back another.
 */
async function retellByHand(
  env: Env,
  row: StatementRow,
  nowMs: number,
): Promise<void> {
  if (!byHandUntold(row)) return
  if (await alert(env, alertSubject(row), alertLines(row))) {
    await recordHandedOver(env, row, nowMs)
    return
  }
  await markRefundTried(env, row)
}

/** What the owner hears of a statement the sweep took: an acknowledgement
 *  still not sent after 3 days, a refund still open after 5 days and after
 *  11, and a refund to make by hand they have not heard of yet. Each on its
 *  own, so one that fails never holds back another. */
async function tellOwner(
  env: Env,
  row: StatementRow,
  nowMs: number,
): Promise<void> {
  for (const tell of [warnAcknowledgement, escalate, handOver, retellByHand]) {
    try {
      await tell(env, row, nowMs)
    } catch (err) {
      console.error(
        `[cron] withdrawal ${row.id}: owner alert FAILED: ${String(err)}`,
      )
    }
  }
}

// ── The sweep ────────────────────────────────────────────────────────

/** Acknowledgements not sent, or refused and not yet given up: never tried
 *  first, then by their last try. Binds: the cut-off twice, then the batch
 *  size. */
const UNSENT_ACKNOWLEDGEMENTS_SQL = `SELECT * FROM withdrawals
      WHERE submittedAt < ?
        AND (mailStatus IS NULL OR mailStatus IN ('failed', 'refused')
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

/** Refunds to make by hand the owner has not heard of: by their last
 *  try. */
const BY_HAND_UNTOLD_SQL = `SELECT * FROM withdrawals
      WHERE submittedAt < ? AND refundStatus IN ('failed', 'manual')
        AND refundHandedOverAt IS NULL
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
    env.DB.prepare(BY_HAND_UNTOLD_SQL)
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
 * UNFINISHED_AFTER_MS: an acknowledgement not sent or not yet given up, a
 * refund still pending, one Stripe has not finished, and one to make by
 * hand the owner has not heard of, each duty at most SWEEP_BATCH a run, the
 * longest untried first (withdrawal.ts, sweepWithdrawals); then what the
 * owner has to hear of each.
 */
export async function sweepStatements(env: Env, nowMs: number): Promise<void> {
  for (const row of await unfinished(env, iso(nowMs - UNFINISHED_AFTER_MS))) {
    try {
      await tellOwner(env, await finish(env, row, true), nowMs)
    } catch (err) {
      console.error(`[cron] withdrawal ${row.id}: sweep FAILED: ${String(err)}`)
    }
  }
}
