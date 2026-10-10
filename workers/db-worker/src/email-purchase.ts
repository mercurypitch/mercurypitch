// ============================================================
// Purchase mail — the thank-you after a credit pack
// ============================================================
//
// Sent by the Stripe webhook once a credit pack's credits land (billing.ts,
// grantCheckoutCredits, through checkout-consent.ts), once per purchase: a
// redelivered event, or the 6-hourly sweep, sends it only while it has not
// gone. Supporter donations and the app-store Karaoke subscription send no
// mail of ours. It shares the sign-up mails' layout (email-layout.ts).
//
// It is also the legal confirmation of the consent the buyer gave at
// checkout (CRD Art. 8(7)): the "Your right to cancel" panel says what the
// checkbox asked for, under the withdrawal model the session was opened
// with, or, with no ticked box on record, claims no consent at all; and who
// sold the credits. Its sentences live in withdrawal-wording.ts, with the
// checkbox's. The date in it is the 14th day, moved off a weekend
// (withdrawal-rules.ts).

import type { RenderedEmail, ResendConfig, ResendResult } from './email'
import { escapeHtml, formatDate, formatMoney, resendPost } from './email'
import type { HeroLink, Lines, MailOrigins } from './email-layout'
import { button, DISPLAY, documentHtml, eyebrow, footerText, heroRow, inlineLink, introRow, MAIL_ART, SANS, signOffRow, url, W, } from './email-layout'
import { deadlineToShow, DEFAULT_GRACE_WEEKDAYS } from './withdrawal-rules'
import type { PurchaseTerms, TraderDetails } from './withdrawal-wording'
import { CANCEL_PATH_LABEL, RIGHT_TO_CANCEL_TITLE, rightToCancelLines, TERMS_LINE, traderLine, WITHDRAWAL_TERMS_URL, } from './withdrawal-wording'

export interface PurchaseEmailVars extends MailOrigins {
  /** Pack label from pricingPlans, e.g. "Starter". */
  packLabel: string
  /** Credits this purchase granted. */
  credits: number
  /** Extra credits the launch offer added to this pack (launch-finisher.ts),
   *  or 0. One line says so; nothing else in the mail changes (D7). */
  bonusCredits?: number
  /** Balance after the grant. */
  balance: number
  /** Price paid, in minor units (500 is €5.00). */
  amountMinor: number
  /** ISO currency, e.g. "eur". */
  currency: string
  /** When the credits landed (the ledger row's createdAt). The 14 days to
   *  cancel count from it (withdrawal-rules.ts). */
  orderDateIso: string
  /** What the buyer agreed to at checkout (checkout-consent.ts,
   *  purchaseTerms). */
  terms: PurchaseTerms
  /** WITHDRAWAL_GRACE_WEEKDAYS: the shown date never passes the last day
   *  the function is open. */
  graceWeekdays?: number
  /** Who sold the credits: the TRADER_* vars (checkout-consent.ts). */
  trader: TraderDetails
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

/** The launch offer's line, or null for a pack bought without it. */
function bonusLine(vars: PurchaseEmailVars): string | null {
  const bonus = vars.bonusCredits ?? 0
  return bonus > 0
    ? `Your launch offer added ${count(bonus, 'extra credit', 'extra credits')}.`
    : null
}

function creditsPanel(vars: PurchaseEmailVars): string {
  const added = count(vars.credits, 'credit', 'credits')
  const balance = count(vars.balance, 'credit', 'credits')
  const paid = `${escapeHtml(formatMoney(vars.amountMinor, vars.currency))} &middot; ${escapeHtml(formatDate(vars.orderDateIso))}`
  const bonus = bonusLine(vars)
  const bonusHtml =
    bonus === null
      ? ''
      : `<div style="margin-top:8px;font:600 15px/1.5 ${SANS};color:${W.text};">${escapeHtml(bonus)}</div>`
  return `<tr><td style="padding:22px 24px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${W.panel};border:1px solid ${W.panelLine};border-radius:16px;"><tr><td style="padding:20px 22px;">${eyebrow('Added to your account', W.violet)}<div style="font:700 34px/1.1 ${DISPLAY};color:${W.teal};">+${added}</div>${bonusHtml}<div style="margin-top:8px;font:15px/1.5 ${SANS};color:${W.text};">New balance: <strong>${balance}</strong></div><div style="margin-top:14px;padding-top:12px;border-top:1px solid ${W.panelLine};font:13px/1.5 ${SANS};color:${W.muted};">${paid}</div></td></tr></table></td></tr>`
}

/** The right to cancel, in the words of the purchase's terms, with the
 *  last day as a buyer is told it. */
function cancelLines(vars: PurchaseEmailVars): string[] {
  const deadline = deadlineToShow(
    vars.orderDateIso,
    Date.parse(vars.orderDateIso),
    vars.graceWeekdays ?? DEFAULT_GRACE_WEEKDAYS,
  )
  return rightToCancelLines(vars.terms, {
    deadline: formatDate(`${deadline}T12:00:00.000Z`),
    credits: vars.credits,
  })
}

function cancelPanel(vars: PurchaseEmailVars): string {
  const settings = inlineLink(
    'Settings &rsaquo; Credits',
    url(vars.appOrigin, CREDITS_PATH),
  )
  const body = cancelLines(vars)
    .map(
      (line, i) =>
        `<p style="margin:${i === 0 ? 0 : 10}px 0 0;font:14px/1.6 ${SANS};color:${W.text};">${escapeHtml(line).replace(CANCEL_PATH_LABEL, settings)}</p>`,
    )
    .join('')
  const seller = `<p style="margin:14px 0 0;padding-top:12px;border-top:1px solid ${W.panelLine};font:12px/1.6 ${SANS};color:${W.muted};">${escapeHtml(traderLine(vars.trader))} ${escapeHtml(TERMS_LINE)} ${inlineLink('about.mercurypitch.com/terms', escapeHtml(WITHDRAWAL_TERMS_URL))}</p>`
  return `<tr><td style="padding:14px 24px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${W.panel};border:1px solid ${W.panelLine};border-radius:16px;"><tr><td style="padding:18px 22px;">${eyebrow(RIGHT_TO_CANCEL_TITLE, W.violet)}${body}${seller}</td></tr></table></td></tr>`
}

function creditRow(appOrigin: string): string {
  return `<tr><td style="padding:8px 36px 4px;">${button('Try it in Karaoke Night', url(appOrigin, KARAOKE_PATH))}<p style="margin:14px 0 0;font:14px/1.6 ${SANS};color:${W.muted};">See your balance and what each song costs in ${inlineLink('Settings &rsaquo; Credits', url(appOrigin, CREDITS_PATH))}.</p></td></tr>`
}

/** The panel as the plain-text part says it. */
function cancelText(vars: PurchaseEmailVars): string[] {
  const settings = `Settings > Credits (${vars.appOrigin}${CREDITS_PATH})`
  return [
    RIGHT_TO_CANCEL_TITLE,
    ...cancelLines(vars).map((line) =>
      line.replace(CANCEL_PATH_LABEL, settings),
    ),
    traderLine(vars.trader),
    `${TERMS_LINE} ${WITHDRAWAL_TERMS_URL}`,
  ]
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
      cancelPanel(vars),
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
    ...(bonusLine(vars) === null ? [] : [bonusLine(vars) as string]),
    `New balance: ${count(vars.balance, 'credit', 'credits')}`,
    `${formatMoney(vars.amountMinor, vars.currency)} · ${formatDate(vars.orderDateIso)}`,
    '',
    ...cancelText(vars),
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

/** Send the purchase mail; Resend's answer, which the caller reads
 *  (mail-answer.ts) and records (checkout-consent.ts). Never throws; see
 *  resendPost. `idempotencyKey` makes a second send of the same purchase's
 *  mail within a day a no-op at Resend. */
export async function sendPurchaseMail(
  cfg: ResendConfig,
  to: string,
  vars: PurchaseEmailVars,
  idempotencyKey?: string,
): Promise<ResendResult> {
  const result = await resendPost(cfg, to, renderPurchaseEmail(vars), {
    idempotencyKey,
  })
  if (result.ok) console.log(`[email] purchase thank-you sent to ${to}`)
  return result
}
