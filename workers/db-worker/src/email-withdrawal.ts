// ============================================================
// Withdrawal mail — the acknowledgement of a cancelled credit pack
// ============================================================
//
// Sent the moment a buyer confirms a withdrawal in Settings › Credits
// (withdrawal.ts), to the address the statement names. It is the
// acknowledgement CRD Art. 11a(4) asks for, on a durable medium: the
// statement's content and the date and time it reached us. It also says
// what happens to the money and the credits, and who received it. Shares
// the purchase mail's layout (email-layout.ts).

import type { RenderedEmail, ResendConfig } from './email'
import { escapeHtml, formatDate, formatMoney, resendPost, sentUnderKeyAlready, } from './email'
import type { Lines, MailOrigins } from './email-layout'
import { documentHtml, eyebrow, footerText, introRow, SANS, signOffRow, W, } from './email-layout'
import type { RefundBasis } from './withdrawal-rules'
import type { TraderDetails } from './withdrawal-wording'
import { traderLine, WITHDRAWAL_RECEIVED } from './withdrawal-wording'

/** What happened to the refund: Stripe took it, or the owner refunds by
 *  hand, or nothing was owed. */
export type WithdrawalRefundState =
  | 'pending'
  | 'refunded'
  | 'failed'
  | 'manual'
  | 'none'

export interface WithdrawalEmailVars extends MailOrigins {
  name: string
  /** Where this acknowledgement goes, as the statement gave it. */
  email: string
  packLabel: string
  paidCredits: number
  purchasedAtIso: string
  /** What the pack cost, in minor units; null when the price paid is not on
   *  record and the owner refunds by hand. */
  amountMinor: number | null
  currency: string
  /** When the statement reached us. */
  submittedAtIso: string
  /** Paid credits and bonus credits the withdrawal took off the balance. */
  unusedCredits: number
  bonusCredits: number
  /** The refund, in minor units; null when the price is not on record. */
  refundMinor: number | null
  /** 'full' for a purchase with no consent on record: the whole price. */
  basis?: RefundBasis
  refundState: WithdrawalRefundState
  trader: TraderDetails
}

const SIGN_OFF = 'Questions about this? Reply to this email.'
const REASON = "You're receiving this because you cancelled a purchase on"

const count = (n: number, one: string, many: string): string =>
  `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`

const CLOCK = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

/** "9 October 2026 at 14:32 UTC". */
export function submittedAt(iso: string): string {
  return `${formatDate(iso)} at ${CLOCK.format(new Date(iso))} UTC`
}

/** The statement as it reached us, line by line: label and value. */
function statementRows(vars: WithdrawalEmailVars): Array<[string, string]> {
  const price =
    vars.amountMinor === null
      ? ''
      : ` for ${formatMoney(vars.amountMinor, vars.currency)}`
  const pack = `${vars.packLabel} pack, ${count(vars.paidCredits, 'credit', 'credits')}, bought ${formatDate(vars.purchasedAtIso)}${price}`
  return [
    ['Statement', 'I withdraw from my contract for this purchase.'],
    ['Purchase', pack],
    ['Name', vars.name],
    ['Confirmation to', vars.email],
    ['Submitted', submittedAt(vars.submittedAtIso)],
  ]
}

/** What the refund will be, said before it is made. */
function refundToCome(vars: WithdrawalEmailVars): string {
  if (vars.refundMinor !== null)
    return formatMoney(vars.refundMinor, vars.currency)
  return vars.basis === 'full'
    ? 'what you paid'
    : 'what you paid for the unused credits'
}

function refundSentence(vars: WithdrawalEmailVars): string {
  if (vars.refundState === 'none') return 'There was nothing left to refund.'
  if (vars.refundState === 'refunded' && vars.refundMinor !== null) {
    return `We've refunded ${formatMoney(vars.refundMinor, vars.currency)} to the card or account you paid with. Banks usually show it within 5 to 10 business days.`
  }
  return `We'll refund ${refundToCome(vars)} to the card or account you paid with within 14 days.`
}

function creditsSentence(vars: WithdrawalEmailVars): string {
  const bonus = count(vars.bonusCredits, 'bonus credit', 'bonus credits')
  if (vars.unusedCredits === 0) {
    return vars.bonusCredits === 0
      ? "You'd used every credit from this purchase, so your balance stays as it is."
      : `The ${bonus} that came with this purchase ${vars.bonusCredits === 1 ? 'has' : 'have'} left your balance.`
  }
  const credits = `The ${count(vars.unusedCredits, 'unused credit', 'unused credits')} from this purchase ${vars.unusedCredits === 1 ? 'has' : 'have'} left your balance`
  if (vars.bonusCredits === 0) return `${credits}.`
  return `${credits}, and so ${vars.bonusCredits === 1 ? 'has the bonus credit' : `have the ${bonus}`} that came with it.`
}

/** What happens to the money and the credits. */
export function nextSteps(vars: WithdrawalEmailVars): string[] {
  return [refundSentence(vars), creditsSentence(vars)]
}

function statementPanel(vars: WithdrawalEmailVars): string {
  const rows = statementRows(vars)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;font:13px/1.5 ${SANS};color:${W.muted};vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:4px 0;font:14px/1.5 ${SANS};color:${W.text};">${escapeHtml(value)}</td></tr>`,
    )
    .join('')
  return `<tr><td style="padding:22px 24px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${W.panel};border:1px solid ${W.panelLine};border-radius:16px;"><tr><td style="padding:18px 22px;">${eyebrow('Your statement', W.violet)}<table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr></table></td></tr>`
}

function nextPanel(vars: WithdrawalEmailVars): string {
  const lines = nextSteps(vars)
    .map(
      (line, i) =>
        `<p style="margin:${i === 0 ? 0 : 10}px 0 0;font:14px/1.6 ${SANS};color:${W.text};">${escapeHtml(line)}</p>`,
    )
    .join('')
  const seller = `<p style="margin:14px 0 0;padding-top:12px;border-top:1px solid ${W.panelLine};font:12px/1.6 ${SANS};color:${W.muted};">${escapeHtml(traderLine(vars.trader))}</p>`
  return `<tr><td style="padding:14px 24px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${W.panel};border:1px solid ${W.panelLine};border-radius:16px;"><tr><td style="padding:18px 22px;">${eyebrow('What happens next', W.violet)}${lines}${seller}</td></tr></table></td></tr>`
}

export function renderWithdrawalEmail(
  vars: WithdrawalEmailVars,
): RenderedEmail {
  const subject = WITHDRAWAL_RECEIVED
  const preheader = `Your ${vars.packLabel} pack is cancelled. Here is what you sent us.`
  const lines: Lines = {
    eyebrow: `${vars.packLabel} pack`,
    headline: WITHDRAWAL_RECEIVED,
    body: 'Here is the statement you sent us, and what happens next.',
  }
  const html = documentHtml(
    subject,
    preheader,
    vars,
    [
      introRow(lines),
      statementPanel(vars),
      nextPanel(vars),
      signOffRow(SIGN_OFF, null),
    ],
    REASON.replace("'", '&#39;'),
  )
  const text = [
    lines.headline,
    '',
    lines.body,
    '',
    'Your statement',
    ...statementRows(vars).map(([label, value]) => `${label}: ${value}`),
    '',
    'What happens next',
    ...nextSteps(vars),
    '',
    traderLine(vars.trader),
    '',
    SIGN_OFF,
    '',
    ...footerText(REASON),
  ].join('\n')
  return { subject, html, text }
}

/** Send the acknowledgement to the address the statement names, with a
 *  hidden copy to `copyTo`, the account's own address, when that is
 *  another. Best-effort; the caller records whether it went
 *  (withdrawal-finish.ts). `idempotencyKey` makes a second send of the same
 *  statement's mail within a day a no-op at Resend, and Resend refusing a
 *  second body under it means the first went (sentUnderKeyAlready). */
export async function sendWithdrawalMail(
  cfg: ResendConfig,
  vars: WithdrawalEmailVars,
  idempotencyKey: string,
  copyTo?: string,
): Promise<boolean> {
  const result = await resendPost(
    cfg,
    vars.email,
    renderWithdrawalEmail(vars),
    { idempotencyKey, bcc: copyTo },
  )
  const sent = result.ok || sentUnderKeyAlready(result)
  if (sent) console.log('[email] withdrawal acknowledgement sent')
  return sent
}
