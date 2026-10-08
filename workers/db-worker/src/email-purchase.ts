// ============================================================
// Purchase mail — the thank-you after a credit pack
// ============================================================
//
// Sent by the Stripe webhook once a credit pack's credits land (billing.ts,
// grantCheckoutCredits), and never for a redelivered event. Supporter
// donations and the app-store Karaoke subscription send no mail of ours.
// It shares the sign-up mails' layout (email-layout.ts).

import type { RenderedEmail, ResendConfig } from './email'
import { escapeHtml, formatDate, formatMoney, resendSend } from './email'
import type { HeroLink, Lines, MailOrigins } from './email-layout'
import { button, DISPLAY, documentHtml, eyebrow, footerText, heroRow, inlineLink, introRow, MAIL_ART, SANS, signOffRow, url, W, } from './email-layout'

export interface PurchaseEmailVars extends MailOrigins {
  /** Pack label from pricingPlans, e.g. "Starter". */
  packLabel: string
  /** Credits this purchase granted. */
  credits: number
  /** Balance after the grant. */
  balance: number
  /** Price paid, in minor units (500 is €5.00). */
  amountMinor: number
  /** ISO currency, e.g. "eur". */
  currency: string
  /** When the credits landed (the ledger row's createdAt). */
  orderDateIso: string
}

/** Karaoke Night, where a credit gets spent. */
const KARAOKE_PATH = '/karaoke'
const CREDITS_PATH = '/#/settings/credits'

const KARAOKE_LINK: HeroLink = {
  path: KARAOKE_PATH,
  label: 'Open Karaoke Night',
}

// What a song costs is left to Settings › Credits, which reads the live
// prices: a sent mail can never be corrected, and the cost varies with the
// separation and the song's length (billing-core uvrJobCost).
const SIGN_OFF =
  'Have a question about this order? Reply to this email. Merc reads every one.'
const RECEIPT_NOTE = 'Stripe emails your receipt separately.'
const REASON = "You're receiving this because you bought credits on"

const count = (n: number, one: string, many: string): string =>
  `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`

function creditsPanel(vars: PurchaseEmailVars): string {
  const added = count(vars.credits, 'credit', 'credits')
  const balance = count(vars.balance, 'credit', 'credits')
  const paid = `${escapeHtml(formatMoney(vars.amountMinor, vars.currency))} &middot; ${escapeHtml(formatDate(vars.orderDateIso))}`
  return `<tr><td style="padding:22px 24px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${W.panel};border:1px solid ${W.panelLine};border-radius:16px;"><tr><td style="padding:20px 22px;">${eyebrow('Added to your account', W.violet)}<div style="font:700 34px/1.1 ${DISPLAY};color:${W.teal};">+${added}</div><div style="margin-top:8px;font:15px/1.5 ${SANS};color:${W.text};">New balance: <strong>${balance}</strong></div><div style="margin-top:14px;padding-top:12px;border-top:1px solid ${W.panelLine};font:13px/1.5 ${SANS};color:${W.muted};">${paid}</div></td></tr></table></td></tr>`
}

function creditRow(appOrigin: string): string {
  return `<tr><td style="padding:8px 36px 4px;">${button('Try it in Karaoke Night', url(appOrigin, KARAOKE_PATH))}<p style="margin:14px 0 0;font:14px/1.6 ${SANS};color:${W.muted};">See your balance and what each song costs in ${inlineLink('Settings &rsaquo; Credits', url(appOrigin, CREDITS_PATH))}.</p></td></tr>`
}

export function renderPurchaseEmail(vars: PurchaseEmailVars): RenderedEmail {
  const credits = count(vars.credits, 'credit', 'credits')
  const subject = `Your ${credits} ${vars.credits === 1 ? 'is' : 'are'} ready`
  const preheader =
    'Thank you for supporting Mercury Pitch. Karaoke Night is ready when you are.'
  const lines: Lines = {
    eyebrow: `${vars.packLabel} pack`,
    headline: 'Thank you. Your credits are in.',
    body: 'Mercury Pitch is a small open-source project, so every purchase counts.',
  }
  const html = documentHtml(
    subject,
    preheader,
    vars,
    [
      heroRow(MAIL_ART.credits, vars, KARAOKE_LINK),
      introRow(lines),
      creditsPanel(vars),
      creditRow(vars.appOrigin),
      signOffRow(SIGN_OFF, RECEIPT_NOTE),
    ],
    REASON.replace("'", '&#39;'),
  )
  const text = [
    lines.headline,
    '',
    lines.body,
    '',
    lines.eyebrow,
    `+${credits}`,
    `New balance: ${count(vars.balance, 'credit', 'credits')}`,
    `${formatMoney(vars.amountMinor, vars.currency)} · ${formatDate(vars.orderDateIso)}`,
    '',
    `Try it in Karaoke Night: ${vars.appOrigin}${KARAOKE_PATH}`,
    `See your balance and what each song costs in Settings > Credits: ${vars.appOrigin}${CREDITS_PATH}`,
    '',
    SIGN_OFF,
    RECEIPT_NOTE,
    '',
    ...footerText(REASON),
  ].join('\n')
  return { subject, html, text }
}

/** Send the purchase mail. Best-effort; see resendSend. */
export async function sendPurchaseMail(
  cfg: ResendConfig,
  to: string,
  vars: PurchaseEmailVars,
): Promise<boolean> {
  const ok = await resendSend(cfg, to, renderPurchaseEmail(vars))
  if (ok) console.log(`[email] purchase thank-you sent to ${to}`)
  return ok
}
