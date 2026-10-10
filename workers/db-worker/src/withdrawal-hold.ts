// ============================================================
// withdrawal-hold — no account deletion while a withdrawal owes its buyer
// ============================================================
//
// Deleting an account erases its withdrawal statements with it
// (USER_OWNED_TABLES in auth.ts), and with them the only record of what a
// statement still owes: a refund the sweep could never make or follow
// again, a refund to make by hand the owner has not heard of, or an
// acknowledgement it could never send (withdrawal-finish.ts,
// withdrawal-ack.ts). So while one of the account's statements owes any of
// them (a refund pending, or taken by Stripe and not finished; a refund to
// make by hand not yet handed over; an acknowledgement neither sent nor
// given up), DELETE /api/auth/me refuses, says why, and tells the owner.
//
// The check runs before the deletion, and every statement of the deletion
// batch carries it too (unlessOwed): a withdrawal written while the
// deletion runs makes the whole batch change nothing, and the request is
// refused like the check refuses it. Once nothing is owed, deletion is what
// it always was.

import type { Env } from './auth'
import type { StatementRow } from './withdrawal-row'
import { alert, byHandUntold, refundOpen } from './withdrawal-row'

/** What the buyer reads when deletion waits for a refund. */
export const DELETION_HELD =
  'Your refund for a cancelled credit pack is still in progress. You can delete your account once it has gone through.'

/** What the buyer reads when deletion waits for the acknowledgement. */
export const DELETION_HELD_FOR_MAIL =
  "The confirmation email for your cancelled credit pack hasn't gone out yet. You can delete your account once it has."

/** A statement that still owes its buyer: a refund not through, one to
 *  make by hand the owner has not heard of, or an acknowledgement neither
 *  sent nor given up. */
const OWES = `(refundStatus = 'pending'
         OR (refundStatus = 'refunded'
             AND stripeRefundStatus IN ('pending', 'requires_action'))
         OR (refundStatus IN ('failed', 'manual') AND refundHandedOverAt IS NULL)
         OR mailStatus IS NULL
         OR mailStatus IN ('sending', 'failed', 'refused'))`

/** The account's oldest statement that still owes its buyer. Binds: the
 *  account. */
export const OWED_STATEMENT_SQL = `SELECT * FROM withdrawals
      WHERE userId = ? AND ${OWES}
      ORDER BY submittedAt LIMIT 1`

/** True while no statement of the account bound at `param` owes anything. */
export function nothingOwed(param: string): string {
  return `NOT EXISTS (SELECT 1 FROM withdrawals WHERE userId = ${param} AND ${OWES})`
}

/**
 * `sql`, a DELETE or UPDATE ending in its WHERE, made to change nothing
 * while a statement of the account bound at `param` owes its buyer. One
 * batch of these erases all of the account or none of it.
 */
export function unlessOwed(sql: string, param: string): string {
  const where = /\sWHERE\s/.exec(sql)
  if (where === null) throw new Error(`unlessOwed: no WHERE in ${sql}`)
  const head = sql.slice(0, where.index).trimEnd()
  const condition = sql.slice(where.index + where[0].length).trim()
  return `${head} WHERE (${condition}) AND ${nothingOwed(param)}`
}

function heldLines(userId: string, owed: StatementRow): string[] {
  const facts = [
    `Account: ${userId}`,
    `Statement: ${owed.id}, submitted ${owed.submittedAt}`,
    `Purchase: ${owed.purchaseId} (${owed.packLabel})`,
    `PaymentIntent: ${owed.paymentIntentId ?? 'none on record'}`,
  ]
  if (byHandUntold(owed)) {
    return [
      ...facts,
      `Refund: ${owed.refundStatus}, yours to make by hand (${owed.refundError ?? 'no reason kept'})`,
      '',
      'The buyer asked to delete their account before the alert that hands',
      'you this refund went. Deleting it would erase the statement, the only',
      'record of the refund they are owed, so the deletion was refused. The',
      'sweep sends that alert again every 6 hours; once it has gone, the',
      'account can be deleted.',
    ]
  }
  if (refundOpen(owed)) {
    const atStripe =
      owed.stripeRefundStatus === null
        ? ''
        : `, ${owed.stripeRefundStatus} at Stripe`
    return [
      ...facts,
      `Refund: ${owed.refundStatus}${atStripe}`,
      '',
      'The buyer asked to delete their account while this refund is open.',
      'Deleting it would erase the statement, and the sweep could no longer',
      'make or follow the refund, so the deletion was refused. They were',
      'told to try again once the refund has gone through.',
    ]
  }
  return [
    ...facts,
    `Acknowledgement: ${owed.mailStatus ?? 'not tried yet'} (${owed.mailError ?? 'no answer kept'})`,
    '',
    'The buyer asked to delete their account before the acknowledgement of',
    'this withdrawal went. Deleting it would erase the statement, and the',
    'sweep could no longer send the acknowledgement (CRD Art. 11a(4)), so',
    'the deletion was refused. They were told to try again once it has.',
  ]
}

/**
 * What the buyer reads when the account has to wait for one of its
 * withdrawal statements, or null when it need not. Tells the owner when it
 * does. Throws when the statements cannot be read, so deletion never goes
 * ahead unchecked.
 */
export async function deletionHeld(
  env: Env,
  userId: string,
): Promise<string | null> {
  const owed = await env.DB.prepare(OWED_STATEMENT_SQL)
    .bind(userId)
    .first<StatementRow>()
  if (owed === null) return null
  const refund = refundOpen(owed) || byHandUntold(owed)
  console.warn(
    `[billing] account deletion held: withdrawal ${owed.id} still owes its ${refund ? 'refund' : 'acknowledgement'} (user=${userId})`,
  )
  await alert(env, heldSubject(owed), heldLines(userId, owed))
  return refund ? DELETION_HELD : DELETION_HELD_FOR_MAIL
}

function heldSubject(owed: StatementRow): string {
  if (byHandUntold(owed)) {
    return 'Account deletion held: a withdrawal refund is yours to make by hand'
  }
  return refundOpen(owed)
    ? 'Account deletion held: a withdrawal refund is open'
    : 'Account deletion held: a withdrawal acknowledgement has not gone'
}
