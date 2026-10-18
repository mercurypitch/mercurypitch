// ============================================================
// Code mails — the sign-in code and the sign-up code
// ============================================================
//
// Six digits mailed by POST /api/auth/email-code/request (auth.ts): a
// sign-in code to an address with an account, and a sign-up code to one
// without, when the phone asks for it (login-codes.ts, NO_ACCOUNT_YET). Both
// open with the letter, the picture of every mail whose job is a code or a
// link to act on, and share the layout in email-layout.ts.
//
// No link in either. A mailed code and a mailed link are the same proof, and
// offering both would teach the habit of clicking sign-in links in mail,
// exactly the habit a phishing message needs. So the picture is only a
// picture, and the wordmark, which opens the app, is the one link.

import type { RenderedEmail, ResendConfig } from './email'
import { escapeHtml, maskEmail, resendSend } from './email'
import type { Lines, MailOrigins } from './email-layout'
import { closingRow, codeRow, documentHtml, footerText, heroRow, introRow, MAIL_ART, } from './email-layout'

export interface LoginCodeVars extends MailOrigins {
  /** Account holder's display name; with none the mail greets nobody. */
  displayName?: string | null
  /** The six-digit code, exactly as the form expects it. */
  code: string
  /** Code lifetime, for the "expires in" copy. Passed through from
   *  LOGIN_CODE_TTL_MS in login-codes.ts. */
  ttlMinutes: number
}

export interface SignUpCodeVars extends MailOrigins {
  /** The six-digit code, exactly as the form expects it. */
  code: string
  /** Code lifetime, for the "expires in" copy (LOGIN_CODE_TTL_MS). */
  ttlMinutes: number
}

/** "10 minutes", "1 minute". */
function minutes(ttl: number): string {
  return ttl === 1 ? '1 minute' : `${Math.round(ttl)} minutes`
}

const NEVER_ASKS = 'Nobody from MercuryPitch will ever ask you for this code.'

/** What sets one code mail apart from the other. */
interface CodeCopy {
  subject: string
  preheader: string
  lines: Lines
  code: string
  /** How long the code lasts, under it. */
  expires: string
  /** The text part's instruction, which ends on the code. */
  textAsk: string
  /** The text part's line under the code. */
  textNote: string
  /** What somebody who did not ask for it should do. */
  ignore: string
  reason: string
}

function codeMail(origins: MailOrigins, v: CodeCopy): RenderedEmail {
  const html = documentHtml(
    v.subject,
    v.preheader,
    origins,
    [
      heroRow(MAIL_ART.letter, origins, null),
      introRow(v.lines),
      codeRow(v.code, v.expires),
      closingRow(escapeHtml(v.ignore), escapeHtml(NEVER_ASKS)),
    ],
    v.reason.replace("'", '&#39;'),
  )
  // The code sits on a line of its own, indented, so a text-only client
  // shows it apart from the words around it.
  const text = [
    v.lines.headline,
    '',
    v.textAsk,
    '',
    `    ${v.code}`,
    '',
    v.textNote,
    '',
    v.ignore,
    NEVER_ASKS,
    '',
    ...footerText(v.reason),
  ].join('\n')
  return { subject: v.subject, html, text }
}

/**
 * The "here is your sign-in code" mail.
 *
 * The code is set large, spaced and monospaced because the reader is copying
 * six digits between two windows, often on a phone. It leads the subject
 * too: on a locked phone that is often the whole interaction.
 */
export function renderLoginCode(v: LoginCodeVars): RenderedEmail {
  const name = v.displayName?.trim()
  const ask = name
    ? `Hi ${name}, type this code into the sign-in screen you just opened`
    : 'Type this code into the sign-in screen you just opened'
  const mins = minutes(v.ttlMinutes)
  const expires = `It expires in ${mins} and works once.`
  return codeMail(v, {
    subject: `${v.code} is your MercuryPitch sign-in code`,
    preheader: `Your sign-in code expires in ${mins}.`,
    lines: {
      eyebrow: 'Sign in',
      headline: 'Your sign-in code',
      body: `${ask}.`,
    },
    code: v.code,
    expires,
    textAsk: `${ask}:`,
    textNote: expires,
    ignore:
      "Didn't try to sign in? Ignore this email. Without this code, whoever asked can't finish signing in, and nothing about your account has changed.",
    reason:
      "You're receiving this because a sign-in code was requested for your account on",
  })
}

/**
 * The code that sets up an account.
 *
 * Mailed to an address with no account, when the phone asks for a code there.
 * The address has no name to greet and no account for "nothing has changed"
 * to be true of, so it is its own message rather than the sign-in one
 * reworded. Somebody else can type any address into that sheet, so the fine
 * print says plainly that the sign-up can't be finished without the code.
 */
export function renderSignUpCode(v: SignUpCodeVars): RenderedEmail {
  const mins = minutes(v.ttlMinutes)
  const expires = `It expires in ${mins} and works once.`
  const noPassword = 'There is no password to make.'
  return codeMail(v, {
    subject: `${v.code} is your MercuryPitch sign-up code`,
    preheader: `Your sign-up code expires in ${mins}.`,
    lines: {
      eyebrow: 'Sign up',
      headline: 'Your sign-up code',
      body: `Type this code into MercuryPitch to set up your account. ${noPassword}`,
    },
    code: v.code,
    expires,
    textAsk: 'Type this code into MercuryPitch to set up your account:',
    textNote: `${noPassword} ${expires}`,
    ignore:
      "Didn't ask for this? Ignore this email. Without this code, whoever asked can't finish signing up, and no account has been made.",
    reason:
      "You're receiving this because a sign-up code was requested for this address on",
  })
}

/** Send a sign-in code. Best-effort; see resendSend. The code itself is
 *  never logged: the log line would outlive the ten minutes it is good for. */
export async function sendLoginCode(
  cfg: ResendConfig,
  to: string,
  vars: LoginCodeVars,
): Promise<boolean> {
  const ok = await resendSend(cfg, to, renderLoginCode(vars))
  if (ok) console.log(`[email] sign-in code sent to ${maskEmail(to)}`)
  return ok
}

/** Send a sign-up code. Best-effort; see resendSend. Like the sign-in code,
 *  the code itself is never logged. */
export async function sendSignUpCode(
  cfg: ResendConfig,
  to: string,
  vars: SignUpCodeVars,
): Promise<boolean> {
  const ok = await resendSend(cfg, to, renderSignUpCode(vars))
  if (ok) console.log(`[email] sign-up code sent to ${maskEmail(to)}`)
  return ok
}
