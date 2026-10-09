// ── The sign-up code email ───────────────────────────────────────────
//
// Mailed to an address with no account, when the phone asks for a code there
// (login-codes.ts, NO_ACCOUNT_YET). It lives beside email.ts rather than in
// it: email.ts keeps one template per message and is long already, and this
// one only borrows its palette, footer and sender.

import type { RenderedEmail, ResendConfig } from './email'
import { ABOUT_URL, APP_URL, C, escapeHtml, footerHtml, maskEmail, REPO_URL, resendSend, } from './email'

export interface SignUpCodeVars {
  /** The six-digit code, exactly as the form expects it. */
  code: string
  /** Code lifetime, for the "expires in" copy (LOGIN_CODE_TTL_MS). */
  ttlMinutes: number
}

/**
 * Pure renderer for the code that sets up an account.
 *
 * Mailed to an address with no account, when the phone asks for a code there.
 * The address has no name to greet and no account for "nothing has changed"
 * to be true of, so it is its own message rather than the sign-in one
 * reworded. Somebody else can type any address into that sheet, so the fine
 * print says plainly that nothing happens unless the code is typed in.
 *
 * No link, for the same reason as the sign-in code.
 */
export function renderSignUpCode(v: SignUpCodeVars): RenderedEmail {
  const code = escapeHtml(v.code)
  const subject = `${v.code} is your MercuryPitch sign-up code`
  const mins =
    v.ttlMinutes === 1 ? '1 minute' : `${Math.round(v.ttlMinutes)} minutes`
  const preheader = `Your sign-up code expires in ${mins}.`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background:${C.page}; -webkit-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:${C.page}; font-size:1px; line-height:1px;">
    ${escapeHtml(preheader)}&#8203;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">

          <tr>
            <td style="padding:4px 4px 16px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <a href="${APP_URL}" style="text-decoration:none; color:${C.text}; font-size:18px; font-weight:700; letter-spacing:.2px;">
                <span style="color:${C.blue};">Mercury</span><span style="color:${C.purple};">Pitch</span>
              </a>
            </td>
          </tr>

          <tr>
            <td style="background:${C.card}; border:1px solid ${C.border}; border-radius:14px; padding:32px 32px 28px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:${C.text};">

              <h1 style="margin:0 0 14px; font-size:24px; line-height:1.25; font-weight:700; color:${C.text};">
                Your sign-up code
              </h1>
              <p style="margin:0 0 16px; font-size:16px; line-height:1.6; color:${C.text};">Hi there,</p>
              <p style="margin:0 0 24px; font-size:16px; line-height:1.6; color:${C.muted};">
                Type this code into MercuryPitch to set up your account. There
                is no password to make.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 8px;">
                <tr>
                  <td align="center" bgcolor="${C.panel}" style="border:1px solid ${C.borderAccent}; border-radius:10px; padding:16px 28px;">
                    <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:34px; font-weight:700; letter-spacing:10px; color:${C.blue};">${code}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:18px 0 0; font-size:13px; line-height:1.7; color:${C.muted};">
                It expires in ${mins} and works once.
              </p>

              <div style="border-top:1px solid ${C.border}; margin:24px 0 0; padding-top:16px;">
                <p style="margin:0; font-size:13px; line-height:1.6; color:${C.muted};">
                  Didn&#39;t ask for this? Ignore this email. No account is
                  made unless the code is typed in, and nobody from
                  MercuryPitch will ever ask you for it.
                </p>
              </div>
            </td>
          </tr>

          ${footerHtml('You&#39;re receiving this because a sign-up code was requested for this address on')}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `Your MercuryPitch sign-up code`,
    ``,
    `Hi there,`,
    ``,
    `Type this code into MercuryPitch to set up your account:`,
    ``,
    `    ${v.code}`,
    ``,
    `There is no password to make. The code expires in ${mins} and works once.`,
    ``,
    `Didn't ask for this? Ignore this email. No account is made unless the code is typed in, and nobody from MercuryPitch will ever ask you for it.`,
    ``,
    `Mercury Pitch · Learn to sing and play. Practice has never been more fun.`,
    `${ABOUT_URL} · ${REPO_URL}`,
    `You're receiving this because a sign-up code was requested for this address on mercurypitch.com.`,
  ].join('\n')

  return { subject, html, text }
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
