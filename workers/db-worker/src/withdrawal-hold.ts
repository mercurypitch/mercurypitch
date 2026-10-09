// ============================================================
// withdrawal-hold — no account deletion while a withdrawal refund is open
// ============================================================
//
// Deleting an account erases its withdrawal statements with it
// (USER_OWNED_TABLES in auth.ts), and with them the only record that a
// refund is still owed: the sweep could never make or follow it again
// (withdrawal-finish.ts). So while one of the account's refunds is pending,
// or taken by Stripe and not finished, DELETE /api/auth/me refuses, says
// why, and tells the owner. Once the refund has gone through, deletion is
// what it always was.

import type { Env } from './auth'
import { sendBillingAlert } from './email'
import type { StatementRow } from './withdrawal-finish'

/** What the buyer reads when deletion waits for a refund. */
export const DELETION_HELD =
  'Your refund for a cancelled credit pack is still in progress. You can delete your account once it has gone through.'

/** The account's oldest statement whose refund is still open. Binds: the
 *  account. */
export const OPEN_REFUND_SQL = `SELECT * FROM withdrawals
      WHERE userId = ?
        AND (refundStatus = 'pending'
             OR (refundStatus = 'refunded'
                 AND stripeRefundStatus IN ('pending', 'requires_action')))
      ORDER BY submittedAt LIMIT 1`

async function openRefundOf(
  env: Env,
  userId: string,
): Promise<StatementRow | null> {
  return env.DB.prepare(OPEN_REFUND_SQL).bind(userId).first<StatementRow>()
}

/**
 * Whether the account has to wait for a withdrawal refund before it can be
 * deleted. Tells the owner when it does. Throws when the statements cannot
 * be read, so deletion never goes ahead unchecked.
 */
export async function deletionHeld(env: Env, userId: string): Promise<boolean> {
  const open = await openRefundOf(env, userId)
  if (open === null) return false
  console.warn(
    `[billing] account deletion held: withdrawal ${open.id} still owes its refund (user=${userId})`,
  )
  const atStripe =
    open.stripeRefundStatus === null
      ? ''
      : `, ${open.stripeRefundStatus} at Stripe`
  await sendBillingAlert(
    { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
    env.BILLING_ALERT_EMAIL ?? '',
    'Account deletion held: a withdrawal refund is open',
    [
      `Account: ${userId}`,
      `Statement: ${open.id}, submitted ${open.submittedAt}`,
      `Purchase: ${open.purchaseId} (${open.packLabel})`,
      `PaymentIntent: ${open.paymentIntentId ?? 'none on record'}`,
      `Refund: ${open.refundStatus}${atStripe}`,
      '',
      'The buyer asked to delete their account while this refund is open.',
      'Deleting it would erase the statement, and the sweep could no longer',
      'make or follow the refund, so the deletion was refused. They were',
      'told to try again once the refund has gone through.',
    ],
  ).catch(() => false)
  return true
}
