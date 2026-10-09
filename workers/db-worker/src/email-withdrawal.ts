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
import { escapeHtml, formatDate, formatMoney, resendPost } from './email'
import type { Lines, MailOrigins } from './email-layout'
import { documentHtml, eyebrow, footerText, introRow, SANS, signOffRow, W, } from './email-layout'
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
  /** What the pack cost, in minor units. */
  amountMinor: number
  currency: string
  /** When the statement reached us. */
  submittedAtIso: string
  /** Paid credits and bonus credits the withdrawal took off the balance. */
  unusedCredits: number
  bonusCredits: number
  refundMinor: number
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
  const pack = `${vars.packLabel} pack, ${count(vars.paidCredits, 'credit', 'credits')}, bought ${formatDate(vars.purchasedAtIso)} for ${formatMoney(vars.amountMinor, vars.currency)}`
  return [
    ['Statement', 'I withdraw from my contract for this purchase.'],
    ['Purchase', pack],
    ['Name', vars.name],
    ['Confirmation to', vars.email],
    ['Submitted', submittedAt(vars.submittedAtIso)],
  ]
}

/** What happens to the money and the credits. */
export function nextSteps(vars: WithdrawalEmailVars): string[] {
  const money = formatMoney(vars.refundMinor, vars.currency)
  const refund =
    vars.refundState === 'none'
      ? 'There was nothing left to refund.'
      : vars.refundState === 'refunded'
        ? `We've refunded ${money} to the card or account you paid with. Banks usually show it within 5 to 10 business days.`
        : `We'll refund ${money} to the card or account you paid with within 14 days.`
  const credits = `The ${count(vars.unusedCredits, 'unused credit', 'unused credits')} from this purchase ${vars.unusedCredits === 1 ? 'has' : 'have'} left your balance`
  const bonus =
    vars.bonusCredits > 0
      ? `, and so ${vars.bonusCredits === 1 ? 'has the bonus credit' : `have the ${count(vars.bonusCredits, 'bonus credit', 'bonus credits')}`} that came with it.`
      : '.'
  return [refund, `${credits}${bonus}`]
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

/** Send the acknowledgement. Best-effort; the caller records whether it
 *  went (withdrawal.ts). `idempotencyKey` makes a second send of the same
 *  statement's mail within a day a no-op at Resend. */
export async function sendWithdrawalMail(
  cfg: ResendConfig,
  vars: WithdrawalEmailVars,
  idempotencyKey: string,
): Promise<boolean> {
  const { ok } = await resendPost(
    cfg,
    vars.email,
    renderWithdrawalEmail(vars),
    { idempotencyKey },
  )
  if (ok) console.log('[email] withdrawal acknowledgement sent')
  return ok
}
