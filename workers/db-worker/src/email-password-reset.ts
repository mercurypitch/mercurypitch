// ============================================================
// Password reset mail — the link that chooses a new password
// ============================================================
//
// Mailed by POST /api/auth/forgot-password (auth.ts) to the account's
// address. The link opens the app's #/reset-password form, works once and
// expires (RESET_TOKEN_TTL_MS in auth.ts). It opens with the letter, like
// the confirm mail, and like there the picture is not a link: choosing a new
// password is always a deliberate tap on the button. Shares the layout in
// email-layout.ts.

import type { RenderedEmail, ResendConfig } from './email'
import { escapeHtml, maskEmail, resendSend } from './email'
import type { Lines, MailOrigins } from './email-layout'
import { button, documentHtml, footerText, heroRow, introRow, MAIL_ART, MONO, SANS, signOffRow, W, } from './email-layout'

export interface PasswordResetVars extends MailOrigins {
  /** Account holder's display name; with none the mail greets nobody. */
  displayName?: string | null
  /** Absolute app link (…/#/reset-password?token=…) opening the form. */
  resetUrl: string
  /** Link lifetime, for the "expires in" copy. Keep in sync with
   *  RESET_TOKEN_TTL_MS in auth.ts (the caller passes it through). */
  ttlHours: number
}

const IGNORE =
  "Didn't request a reset? You can safely ignore this email. Your password won't change."
const REASON =
  "You're receiving this because a password reset was requested for your account on"

/** The button, and the link as text for a client that will not open it. */
function resetBlock(href: string, ttl: string): string {
  return `${button('Choose a new password', href)}<p style="margin:12px 0 0;font:13px/1.6 ${SANS};color:${W.muted};">The link expires in ${ttl} and can be used once. If the button doesn&#39;t open, paste this into your browser:<br><a href="${href}" style="color:${W.blue};text-decoration:none;word-break:break-all;font:12px/1.6 ${MONO};">${href}</a></p>`
}

export function renderPasswordReset(v: PasswordResetVars): RenderedEmail {
  const name = v.displayName?.trim()
  const ttl = v.ttlHours === 1 ? '1 hour' : `${v.ttlHours} hours`
  const subject = 'Reset your MercuryPitch password'
  const preheader = `Choose a new password. The link expires in ${ttl}.`
  const asked = name
    ? `Hi ${name}, we received a request to reset the password for your MercuryPitch account.`
    : 'We received a request to reset the password for your MercuryPitch account.'
  const lines: Lines = {
    eyebrow: 'Your account',
    headline: 'Reset your password',
    body: `${asked} Use the button below to choose a new one.`,
  }
  const html = documentHtml(
    subject,
    preheader,
    v,
    [
      heroRow(MAIL_ART.letter, v, null),
      introRow(lines, resetBlock(escapeHtml(v.resetUrl), ttl)),
      signOffRow(IGNORE, null),
    ],
    REASON.replace("'", '&#39;'),
  )
  const text = [
    lines.headline,
    '',
    `${asked} Open this link to choose a new one:`,
    '',
    v.resetUrl,
    '',
    `It expires in ${ttl} and can be used once.`,
    '',
    IGNORE,
    '',
    ...footerText(REASON),
  ].join('\n')
  return { subject, html, text }
}

/** Send the reset-your-password message. Best-effort; see resendSend. */
export async function sendPasswordReset(
  cfg: ResendConfig,
  to: string,
  vars: PasswordResetVars,
): Promise<boolean> {
  const ok = await resendSend(cfg, to, renderPasswordReset(vars))
  if (ok) console.log(`[email] password reset sent to ${maskEmail(to)}`)
  return ok
}
