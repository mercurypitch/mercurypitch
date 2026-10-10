// ============================================================
// withdrawal-ack — the acknowledgement of a withdrawal statement
// ============================================================
//
// The mail CRD Art. 11a(4) asks for (email-withdrawal.ts): the statement and
// when it reached us, sent to the address the statement names, with a hidden
// copy to the account's own address when that is another.
// withdrawal-finish.ts takes this step after the refund step, from the
// request that wrote the statement, a later request for the same pack, or
// the 6-hourly sweep.
//
// One request at a time sends it (claimMail), and each try keeps what
// Resend answered (mail-answer.ts):
//
//   - sent: done.
//   - unknown ('failed'): every sweep sends it again, as long as it takes.
//     The owner hears once if it has still not gone 3 days after the
//     statement (warnAcknowledgement), and nothing more unless Resend
//     refuses it.
//   - refused: never sent again. The owner is told to send it by hand, and
//     it is 'gave-up' only once Resend has taken that alert; until then
//     every sweep, and every request for the pack, tells again.

import type { Env } from './auth'
import { fallbackAppOrigin } from './auth'
import { traderDetails, UNFINISHED_AFTER_MS } from './checkout-consent'
import { sendWithdrawalMail } from './email-withdrawal'
import type { MailAnswer } from './mail-answer'
import { GAVE_UP, mailAnswer, REFUSED, statusAfter, WARN_AFTER_MS, } from './mail-answer'
import type { StatementRow } from './withdrawal-row'
import { alert, iso, priceKnown, statementFacts } from './withdrawal-row'

export const ACK_GIVEN_UP_SUBJECT =
  'Withdrawal: acknowledgement NOT sent, send it by hand'
const ACK_STUCK_SUBJECT =
  'Withdrawal: acknowledgement still not sent after 3 days'

/** Take the acknowledgement for this request, so two never both send it:
 *  one not yet sent, one whose last try ended unknown, or a claim gone
 *  stale. Only while it stands as `row` read it, so the try knows what the
 *  one before it ended in. */
async function claimMail(env: Env, row: StatementRow): Promise<boolean> {
  const now = Date.now()
  const res = await env.DB.prepare(
    `UPDATE withdrawals
        SET mailStatus = 'sending', mailAt = ?, mailAttempts = mailAttempts + 1
      WHERE id = ? AND mailStatus IS ?
        AND (mailStatus IS NULL OR mailStatus = 'failed'
             OR (mailStatus = 'sending' AND mailAt < ?))`,
  )
    .bind(iso(now), row.id, row.mailStatus, iso(now - UNFINISHED_AFTER_MS))
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

/** Send the acknowledgement: what Resend's answer says of it, or null when
 *  Resend is not configured here. `afterUnknown`: the try before this one
 *  ended without a known outcome. Never throws. */
async function sendAcknowledgement(
  env: Env,
  row: StatementRow,
  afterUnknown: boolean,
): Promise<MailAnswer | null> {
  const apiKey = env.RESEND_API_KEY ?? ''
  if (apiKey === '') return null
  const app = fallbackAppOrigin(env)
  const known = priceKnown(row)
  try {
    const result = await sendWithdrawalMail(
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
        stripeRefundStatus: row.stripeRefundStatus,
        trader: traderDetails(env),
      },
      `withdrawal-${row.id}`,
      await accountCopy(env, row),
    )
    return mailAnswer(result, afterUnknown)
  } catch (err) {
    return {
      kind: 'unknown',
      why: `the mail could not be sent: ${String(err)}`,
    }
  }
}

/** Keep what the try ended in, unless another request took the mail since.
 *  A record that fails leaves the claim to go stale, and the sweep tries
 *  again. */
async function recordMail(env: Env, row: StatementRow): Promise<void> {
  await env.DB.prepare(
    `UPDATE withdrawals SET mailStatus = ?, mailAt = ?, mailError = ?
      WHERE id = ? AND mailStatus = 'sending'`,
  )
    .bind(row.mailStatus, row.mailAt, row.mailError ?? null, row.id)
    .run()
    .catch((err: unknown) => {
      console.error(
        `[billing] withdrawal ${row.id}: mail record FAILED: ${String(err)}`,
      )
    })
}

function givenUpLines(row: StatementRow): string[] {
  return [
    ...statementFacts(row),
    `Send it to: ${row.email}`,
    `Resend refused it: ${row.mailError ?? 'no answer kept'}`,
    '',
    'Resend refused the acknowledgement for good, so nothing sends it',
    'again. CRD Art. 11a(4) asks for one on a durable medium without undue',
    'delay: send the buyer their statement and when it reached us. The',
    'withdrawal stands either way.',
  ]
}

/**
 * Tell the owner to send a refused acknowledgement by hand. It is given up
 * only once Resend has taken that alert; until then it stays refused, and
 * the next sweep tells again. Never sends the acknowledgement itself.
 */
export async function giveUpAcknowledgement(
  env: Env,
  row: StatementRow,
): Promise<StatementRow> {
  const nowMs = Date.now()
  if (!(await alert(env, ACK_GIVEN_UP_SUBJECT, givenUpLines(row)))) {
    // Last in the sweep's line, so a refused alert never holds back others.
    await env.DB.prepare(
      'UPDATE withdrawals SET mailAt = ? WHERE id = ? AND mailStatus = ?',
    )
      .bind(iso(nowMs), row.id, REFUSED)
      .run()
      .catch(() => undefined)
    return row
  }
  await env.DB.prepare(
    'UPDATE withdrawals SET mailStatus = ?, mailAt = ? WHERE id = ? AND mailStatus = ?',
  )
    .bind(GAVE_UP, iso(nowMs), row.id, REFUSED)
    .run()
  return { ...row, mailStatus: GAVE_UP }
}

/**
 * The acknowledgement step of finish(): send it unless it went, is being
 * sent, or was refused; tell the owner again of one refused. `firstTry`:
 * this request made the first try, so the owner's alert about the
 * statement says how it went.
 */
export async function acknowledgeStep(
  env: Env,
  row: StatementRow,
): Promise<{ row: StatementRow; firstTry: boolean }> {
  if (row.mailStatus === REFUSED) {
    return { row: await giveUpAcknowledgement(env, row), firstTry: false }
  }
  if (!(await claimMail(env, row))) return { row, firstTry: false }
  const firstTry = row.mailStatus === null || row.mailStatus === 'sending'
  const answer = await sendAcknowledgement(env, row, row.mailStatus !== null)
  const tried: StatementRow = {
    ...row,
    mailStatus: answer === null ? 'not-configured' : statusAfter(answer),
    mailAt: iso(Date.now()),
    mailError: answer === null || answer.kind === 'sent' ? null : answer.why,
    mailAttempts: (row.mailAttempts ?? 0) + 1,
  }
  await recordMail(env, tried)
  if (tried.mailStatus !== REFUSED) return { row: tried, firstTry }
  return { row: await giveUpAcknowledgement(env, tried), firstTry }
}

function stuckLines(row: StatementRow): string[] {
  return [
    ...statementFacts(row),
    `Send it to: ${row.email}`,
    `Tries: ${row.mailAttempts ?? 0}, the last at ${row.mailAt ?? 'none'}: ${row.mailError ?? 'no answer kept'}`,
    '',
    'Resend has neither taken nor refused the acknowledgement in 3 days.',
    'The sweep keeps sending it every 6 hours, under the same key, until',
    'Resend takes it; you hear again only if Resend refuses it. Sent by',
    'hand meanwhile, it may reach the buyer twice.',
  ]
}

/**
 * Tell the owner, once, of an acknowledgement still not sent WARN_AFTER_MS
 * after its statement, while the sweep keeps sending it. Recorded only once
 * Resend has taken the alert, so a refused one goes again at the next
 * sweep.
 */
export async function warnAcknowledgement(
  env: Env,
  row: StatementRow,
  nowMs: number,
): Promise<void> {
  const unknown = row.mailStatus === 'failed' || row.mailStatus === 'sending'
  if (!unknown || (row.mailWarnedAt ?? null) !== null) return
  if (Date.parse(row.submittedAt) > nowMs - WARN_AFTER_MS) return
  if (!(await alert(env, ACK_STUCK_SUBJECT, stuckLines(row)))) return
  await env.DB.prepare(
    'UPDATE withdrawals SET mailWarnedAt = ? WHERE id = ? AND mailWarnedAt IS NULL',
  )
    .bind(iso(nowMs), row.id)
    .run()
}

/** The acknowledgement, in words for the owner's alert about the
 *  statement. */
export function mailLines(row: StatementRow): string[] {
  const why = row.mailError ?? 'no answer kept'
  switch (row.mailStatus) {
    case 'sent':
      return ['Acknowledgement mail: sent']
    case 'failed':
      return [
        `Acknowledgement mail: not sent yet (${why})`,
        'The sweep sends it again every 6 hours until Resend takes it, and',
        'tells you if it has still not gone 3 days after the statement.',
      ]
    case REFUSED:
    case GAVE_UP:
      return [
        `Acknowledgement mail: NOT sent, Resend refused it (${why}): see the alert to send it by hand`,
      ]
    case 'not-configured':
      return ['Acknowledgement mail: not sent, RESEND_API_KEY is not set']
    default:
      return ['Acknowledgement mail: not sent yet']
  }
}
