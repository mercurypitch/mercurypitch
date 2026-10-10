// Transactional email: the shared helpers (escaping, money and dates, the
// footer, the Resend client) and the mails that keep the original look:
// password reset, login code, newsletter, account notices, billing alerts.
//
// Two concerns, kept separate so each renderer is previewable and
// unit-testable without any network: render*(vars) → { subject, html, text }
// is pure, send*(cfg, to, vars) is the Resend POST.
//
// Sending is best-effort and OFF until RESEND_API_KEY is set, and an email
// failure never fails the action that sent it. The sign-up mails and the
// purchase mail have a newer look: email-layout.ts.
//
// Brand palette + footer links mirror the landing (about.mercurypitch.com).
// No emoji / no inline SVG on purpose: Gmail strips <svg> and many clients
// mangle emoji.

export const APP_URL = 'https://mercurypitch.com'
export const ABOUT_URL = 'https://about.mercurypitch.com'
export const REPO_URL = 'https://github.com/mercurypitch/mercurypitch'

// ── palette (GitHub-dark, matches the app + landing) ─────────────────
export const C = {
  page: '#010409',
  card: '#0d1117',
  panel: '#06121f',
  border: '#30363d',
  borderAccent: '#1f6feb',
  text: '#e6edf3',
  muted: '#8b949e',
  blue: '#58a6ff',
  green: '#3fb950',
  purple: '#bc8cff',
} as const

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** "€5.00" from (500, "eur"). Falls back to a plain "<major> <CUR>". */
export function formatMoney(amountMinor: number, currency: string): string {
  const major = amountMinor / 100
  try {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(major)
  } catch {
    return `${major.toFixed(2)} ${currency.toUpperCase()}`
  }
}

/** "5 July 2026" from an ISO timestamp (UTC, locale-stable). */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

// ── Shared footer (all emails) ───────────────────────────────────────
// `reason` is the lead-in of the "why you got this" line, e.g.
// "You're receiving this because you created an account on".
export function footerHtml(reason: string): string {
  return `<tr>
            <td style="padding:24px 16px 8px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; text-align:center;">
              <p style="margin:0 0 12px; font-size:14px; color:${C.muted};">
                Learn to sing and play. Practice has never been more fun.
              </p>
              <p style="margin:0 0 14px; font-size:13px;">
                <a href="${ABOUT_URL}" style="color:${C.blue}; text-decoration:none;">About</a>
                <span style="color:${C.border};">&nbsp;&middot;&nbsp;</span>
                <a href="${REPO_URL}" style="color:${C.blue}; text-decoration:none;">GitHub</a>
                <span style="color:${C.border};">&nbsp;&middot;&nbsp;</span>
                <a href="${ABOUT_URL}/terms/" style="color:${C.blue}; text-decoration:none;">Terms</a>
                <span style="color:${C.border};">&nbsp;&middot;&nbsp;</span>
                <a href="${ABOUT_URL}/privacy/" style="color:${C.blue}; text-decoration:none;">Privacy</a>
                <span style="color:${C.border};">&nbsp;&middot;&nbsp;</span>
                <a href="${ABOUT_URL}/contact/" style="color:${C.blue}; text-decoration:none;">Contact</a>
              </p>
              <p style="margin:0 0 4px; font-size:12px; color:${C.muted};">
                &copy; 2026 Mercury Pitch &middot; AGPL-3.0
              </p>
              <p style="margin:0; font-size:12px; color:${C.muted};">
                ${reason}
                <a href="${APP_URL}" style="color:${C.muted}; text-decoration:underline;">mercurypitch.com</a>.
              </p>
            </td>
          </tr>`
}

// ── Password reset (choose a new password) ───────────────────────────
export interface PasswordResetVars {
  /** Account holder's display name; falls back to a neutral greeting. */
  displayName?: string | null
  /** Absolute app link (…/#/reset-password?token=…) opening the form. */
  resetUrl: string
  /** Link lifetime, for the "expires in" copy. Keep in sync with
   *  RESET_TOKEN_TTL_MS in auth.ts (the caller passes it through). */
  ttlHours: number
}

/** Pure renderer for the "reset your password" message. Image-light like
 *  the verification email — better inboxing, renders anywhere. */
export function renderPasswordReset(v: PasswordResetVars): RenderedEmail {
  const name = v.displayName?.trim()
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,'
  const subject = 'Reset your MercuryPitch password'
  const ttl = v.ttlHours === 1 ? '1 hour' : `${v.ttlHours} hours`
  const preheader = `Choose a new password — the link expires in ${ttl}.`
  const url = escapeHtml(v.resetUrl)

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
                Reset your password
              </h1>
              <p style="margin:0 0 16px; font-size:16px; line-height:1.6; color:${C.text};">${greeting}</p>
              <p style="margin:0 0 24px; font-size:16px; line-height:1.6; color:${C.muted};">
                We received a request to reset the password for your
                MercuryPitch account. Click the button below to choose a
                new one.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 8px;">
                <tr>
                  <td align="center" bgcolor="${C.blue}" style="border-radius:10px;">
                    <a href="${url}"
                      style="display:inline-block; padding:13px 26px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:16px; font-weight:700; color:#04121f; text-decoration:none; border-radius:10px;">
                      Choose a new password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:18px 0 0; font-size:13px; line-height:1.7; color:${C.muted};">
                The link expires in ${ttl} and can be used once. If the
                button doesn&#39;t open, paste this into your browser:<br>
                <a href="${url}" style="color:${C.blue}; text-decoration:none; word-break:break-all; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px;">${url}</a>
              </p>

              <div style="border-top:1px solid ${C.border}; margin:24px 0 0; padding-top:16px;">
                <p style="margin:0; font-size:13px; line-height:1.6; color:${C.muted};">
                  Didn&#39;t request a reset? You can safely ignore this
                  email — your password won&#39;t change.
                </p>
              </div>
            </td>
          </tr>

          ${footerHtml('You&#39;re receiving this because a password reset was requested for your account on')}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `Reset your MercuryPitch password`,
    ``,
    name ? `Hi ${name},` : `Hi there,`,
    ``,
    `We received a request to reset the password for your MercuryPitch account. Open this link to choose a new one (expires in ${ttl}, single use):`,
    ``,
    v.resetUrl,
    ``,
    `Didn't request a reset? You can safely ignore this email — your password won't change.`,
    ``,
    `Mercury Pitch · Learn to sing and play. Practice has never been more fun.`,
    `${ABOUT_URL} · ${REPO_URL}`,
    `You're receiving this because a password reset was requested for your account on mercurypitch.com.`,
  ].join('\n')

  return { subject, html, text }
}

// ── Sign-in code ─────────────────────────────────────────────────────

export interface LoginCodeVars {
  /** Account holder's display name; falls back to a neutral greeting. */
  displayName?: string | null
  /** The six-digit code, exactly as the form expects it. */
  code: string
  /** Code lifetime, for the "expires in" copy. Passed through from
   *  LOGIN_CODE_TTL_MS in login-codes.ts. */
  ttlMinutes: number
}

/**
 * Pure renderer for the "here is your sign-in code" message.
 *
 * The code is set large, spaced and monospaced because the reader is copying
 * six digits between two windows, often on a phone. It appears in the subject
 * line too: on a locked phone that is often the whole interaction.
 *
 * No link. A mailed code and a mailed link are the same proof, and offering
 * both here would teach the habit of clicking sign-in links in email —
 * exactly the habit a phishing message needs.
 */
export function renderLoginCode(v: LoginCodeVars): RenderedEmail {
  const name = v.displayName?.trim()
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,'
  const code = escapeHtml(v.code)
  const subject = `${v.code} is your MercuryPitch sign-in code`
  const mins =
    v.ttlMinutes === 1 ? '1 minute' : `${Math.round(v.ttlMinutes)} minutes`
  const preheader = `Your sign-in code expires in ${mins}.`

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
                Your sign-in code
              </h1>
              <p style="margin:0 0 16px; font-size:16px; line-height:1.6; color:${C.text};">${greeting}</p>
              <p style="margin:0 0 24px; font-size:16px; line-height:1.6; color:${C.muted};">
                Type this code into the sign-in screen you just opened.
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
                  Didn&#39;t try to sign in? Ignore this email — the code is
                  useless without it, and nothing about your account has
                  changed. Nobody from MercuryPitch will ever ask you for it.
                </p>
              </div>
            </td>
          </tr>

          ${footerHtml('You&#39;re receiving this because a sign-in code was requested for your account on')}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `Your MercuryPitch sign-in code`,
    ``,
    name ? `Hi ${name},` : `Hi there,`,
    ``,
    `Type this code into the sign-in screen you just opened:`,
    ``,
    `    ${v.code}`,
    ``,
    `It expires in ${mins} and works once.`,
    ``,
    `Didn't try to sign in? Ignore this email — the code is useless without it, and nothing about your account has changed. Nobody from MercuryPitch will ever ask you for it.`,
    ``,
    `Mercury Pitch · Learn to sing and play. Practice has never been more fun.`,
    `${ABOUT_URL} · ${REPO_URL}`,
    `You're receiving this because a sign-in code was requested for your account on mercurypitch.com.`,
  ].join('\n')

  return { subject, html, text }
}

// ── Sending (Resend) ─────────────────────────────────────────────────

// ── Newsletter issue ─────────────────────────────────────────────────
//
// The one message here that is MARKETING rather than transactional, and the
// difference is the whole design. A transactional mail is sent because
// somebody just did something; this one is sent because somebody said yes
// once, possibly months ago, so every copy has to carry the way back out.
//
// The unsubscribe URL is per recipient and is minted by the worker, never by
// the operator's machine — the signing key stays a worker secret. See
// newsletter.ts.

export interface NewsletterItem {
  title: string
  body: string
  href?: string
  cta?: string
}

export interface NewsletterIssueVars {
  displayName?: string | null
  /** Subject line, and the headline, so the inbox and the page agree. */
  subject: string
  /** The grey preview line inbox lists show beside the subject. */
  preheader: string
  /** A sentence or two before the items. */
  intro: string
  items: NewsletterItem[]
  /** This recipient's one-click way out. Required: no link, no send. */
  unsubscribeUrl: string
}

/** Pure renderer for one newsletter issue. No I/O, so a script can preview it. */
export function renderNewsletterIssue(v: NewsletterIssueVars): RenderedEmail {
  const name = v.displayName?.trim()
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,'
  const unsub = escapeHtml(v.unsubscribeUrl)

  const itemsHtml = v.items
    .map((item) => {
      const link =
        item.href === undefined || item.href === ''
          ? ''
          : `<p style="margin:12px 0 0; font-size:15px;">
                       <a href="${escapeHtml(item.href)}" style="color:${C.blue}; text-decoration:none; font-weight:600;">${escapeHtml(item.cta ?? 'Take a look')} &rsaquo;</a>
                     </p>`
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                       style="background:${C.panel}; border:1px solid ${C.border}; border-radius:12px; margin:0 0 16px;">
                  <tr>
                    <td style="padding:20px 22px;">
                      <div style="font-size:17px; line-height:1.35; font-weight:700; color:${C.text};">
                        ${escapeHtml(item.title)}
                      </div>
                      <p style="margin:8px 0 0; font-size:15px; line-height:1.6; color:${C.muted};">
                        ${escapeHtml(item.body)}
                      </p>
                      ${link}
                    </td>
                  </tr>
                </table>`
    })
    .join('\n                ')

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(v.subject)}</title>
</head>
<body style="margin:0; padding:0; background:${C.page}; -webkit-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:${C.page}; font-size:1px; line-height:1px;">
    ${escapeHtml(v.preheader)}&#8203;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">

          <!-- wordmark -->
          <tr>
            <td style="padding:4px 4px 16px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <a href="${APP_URL}" style="text-decoration:none; color:${C.text}; font-size:18px; font-weight:700; letter-spacing:.2px;">
                <span style="color:${C.blue};">Mercury</span><span style="color:${C.purple};">Pitch</span>
              </a>
            </td>
          </tr>

          <!-- body card -->
          <tr>
            <td style="background:${C.card}; border:1px solid ${C.border}; border-radius:14px; padding:32px 32px 28px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:${C.text};">

              <h1 style="margin:0 0 14px; font-size:24px; line-height:1.25; font-weight:700; color:${C.text};">
                ${escapeHtml(v.subject)}
              </h1>

              <p style="margin:0 0 18px; font-size:16px; line-height:1.6; color:${C.text};">
                ${greeting}
              </p>
              <p style="margin:0 0 24px; font-size:16px; line-height:1.6; color:${C.muted};">
                ${escapeHtml(v.intro)}
              </p>

              ${itemsHtml}

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 8px;">
                <tr>
                  <td align="center" bgcolor="${C.blue}" style="border-radius:10px;">
                    <a href="${APP_URL}"
                      style="display:inline-block; padding:13px 26px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:16px; font-weight:700; color:#04121f; text-decoration:none; border-radius:10px;">
                      Open MercuryPitch
                    </a>
                  </td>
                </tr>
              </table>

              <div style="border-top:1px solid ${C.border}; margin:26px 0 0; padding-top:18px;">
                <p style="margin:0; font-size:13px; line-height:1.6; color:${C.muted};">
                  You are getting this because you asked for product updates.
                  <a href="${unsub}" style="color:${C.blue}; text-decoration:underline;">Unsubscribe</a>
                  — one click, no sign-in, and it takes effect immediately.
                </p>
              </div>

            </td>
          </tr>
${footerHtml('You can change this any time in Settings &rsaquo; Account at ')}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const itemsText = v.items
    .map((item) => {
      const link =
        item.href === undefined || item.href === '' ? '' : `\n  ${item.href}`
      return `* ${item.title}\n  ${item.body}${link}`
    })
    .join('\n\n')

  const text = [
    greeting,
    '',
    v.intro,
    '',
    itemsText,
    '',
    `Open MercuryPitch: ${APP_URL}`,
    '',
    '--',
    'You are getting this because you asked for product updates at mercurypitch.com.',
    `Unsubscribe: ${v.unsubscribeUrl}`,
  ].join('\n')

  return { subject: v.subject, html, text }
}

// ── Account notice ───────────────────────────────────────────────────
//
// The opposite of the newsletter in the one way that matters. That mail goes
// to people who said yes and carries the way back out; this one goes to every
// account holder because we owe it to them -- a breach, a change to the
// terms, an account about to be deleted for inactivity -- and there is no way
// out of it, so it carries none. No unsubscribe link, and no List-Unsubscribe
// header: offering a switch that does nothing would be the lie.
//
// What it carries instead is the reason it arrived. Somebody who unticked the
// box and still got mail from us is owed that sentence.
//
// Nothing here sells anything, on purpose. The day this template carries a
// product update is the day it needs consent it does not have.

export type AccountNoticeKind = 'security' | 'legal' | 'account'

export interface AccountNoticeVars {
  displayName?: string | null
  kind: AccountNoticeKind
  /** Subject line, and the headline, so the inbox and the page agree. */
  subject: string
  /** The grey preview line inbox lists show beside the subject. */
  preheader: string
  /** The notice itself. A blank line starts a new paragraph. */
  intro: string
  /** Optional titled parts: "What happened", "What you can do". */
  items: NewsletterItem[]
  /** The operator's rehearsal copy. Marked in the subject and the body, so a
   *  forwarded test can never be read as the notice having gone out. */
  test?: boolean
}

const NOTICE_LABEL: Record<AccountNoticeKind, string> = {
  security: 'Security notice',
  legal: 'Legal notice',
  account: 'About your account',
}

const NOTICE_REASON =
  'You are getting this because you have a MercuryPitch account. It is a service message about that account, not a product update, so it goes to every account holder whatever their newsletter setting.'

/** Said on every security notice, because the mail that follows a breach is
 *  the one a phisher most wants to imitate. */
const NOTICE_NEVER_ASKS =
  'We will never ask for your password by email. A message that does is not from us, whatever it looks like.'

const TEST_BANNER =
  'This is a test copy. The notice has not been sent to anyone else.'

/** Blank lines separate paragraphs; a single newline is a line break. */
function noticeParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
}

function paragraphsHtml(text: string, style: string): string {
  return noticeParagraphs(text)
    .map(
      (paragraph) =>
        `<p style="${style}">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`,
    )
    .join('\n              ')
}

/** Pure renderer for one account notice. No I/O, so a dry run can show it. */
export function renderAccountNotice(v: AccountNoticeVars): RenderedEmail {
  const name = v.displayName?.trim()
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,'
  // The plain-text part is not HTML, so the name goes in as typed.
  const greetingText = name ? `Hi ${name},` : 'Hi there,'
  const subject = v.test === true ? `[TEST] ${v.subject}` : v.subject
  const label = NOTICE_LABEL[v.kind]

  const itemsHtml = v.items
    .map((item) => {
      const link =
        item.href === undefined || item.href === ''
          ? ''
          : `<p style="margin:12px 0 0; font-size:15px;">
                       <a href="${escapeHtml(item.href)}" style="color:${C.blue}; text-decoration:underline;">${escapeHtml(item.cta ?? 'Read more')}</a>
                     </p>`
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                       style="background:${C.panel}; border:1px solid ${C.border}; border-radius:12px; margin:0 0 16px;">
                  <tr>
                    <td style="padding:20px 22px;">
                      <div style="font-size:17px; line-height:1.35; font-weight:700; color:${C.text};">
                        ${escapeHtml(item.title)}
                      </div>
                      ${paragraphsHtml(item.body, `margin:8px 0 0; font-size:15px; line-height:1.6; color:${C.muted};`)}
                      ${link}
                    </td>
                  </tr>
                </table>`
    })
    .join('\n                ')

  const testHtml =
    v.test === true
      ? `<p style="margin:0 0 18px; padding:10px 12px; border:1px solid ${C.borderAccent}; border-radius:8px; font-size:14px; line-height:1.5; color:${C.text};">
                ${escapeHtml(TEST_BANNER)}
              </p>`
      : ''

  const neverAsksHtml =
    v.kind === 'security'
      ? `<p style="margin:0 0 10px; font-size:13px; line-height:1.6; color:${C.text};">
                  ${escapeHtml(NOTICE_NEVER_ASKS)}
                </p>`
      : ''

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
    ${escapeHtml(v.preheader)}&#8203;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">

          <!-- wordmark -->
          <tr>
            <td style="padding:4px 4px 16px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <a href="${APP_URL}" style="text-decoration:none; color:${C.text}; font-size:18px; font-weight:700; letter-spacing:.2px;">
                <span style="color:${C.blue};">Mercury</span><span style="color:${C.purple};">Pitch</span>
              </a>
            </td>
          </tr>

          <!-- body card -->
          <tr>
            <td style="background:${C.card}; border:1px solid ${C.border}; border-radius:14px; padding:32px 32px 28px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:${C.text};">

              ${testHtml}
              <p style="margin:0 0 8px; font-size:12px; line-height:1.4; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:${C.muted};">
                ${escapeHtml(label)}
              </p>
              <h1 style="margin:0 0 14px; font-size:24px; line-height:1.25; font-weight:700; color:${C.text};">
                ${escapeHtml(v.subject)}
              </h1>

              <p style="margin:0 0 18px; font-size:16px; line-height:1.6; color:${C.text};">
                ${greeting}
              </p>
              ${paragraphsHtml(v.intro, `margin:0 0 18px; font-size:16px; line-height:1.6; color:${C.text};`)}

              ${itemsHtml}

              <p style="margin:18px 0 0; font-size:15px; line-height:1.6; color:${C.muted};">
                Questions? Reply to this email and a person will read it.
              </p>

              <div style="border-top:1px solid ${C.border}; margin:26px 0 0; padding-top:18px;">
                ${neverAsksHtml}
                <p style="margin:0; font-size:13px; line-height:1.6; color:${C.muted};">
                  ${escapeHtml(NOTICE_REASON)}
                </p>
              </div>

            </td>
          </tr>
${footerHtml('You have an account at ')}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const itemsText = v.items
    .map((item) => {
      const link =
        item.href === undefined || item.href === '' ? '' : `\n\n  ${item.href}`
      const body = noticeParagraphs(item.body)
        .map((paragraph) => `  ${paragraph.replace(/\n/g, '\n  ')}`)
        .join('\n\n')
      return `* ${item.title}\n${body}${link}`
    })
    .join('\n\n')

  const text = [
    ...(v.test === true ? [TEST_BANNER, ''] : []),
    `${label.toUpperCase()}: ${v.subject}`,
    '',
    greetingText,
    '',
    noticeParagraphs(v.intro).join('\n\n'),
    ...(itemsText === '' ? [] : ['', itemsText]),
    '',
    'Questions? Reply to this email and a person will read it.',
    '',
    '--',
    ...(v.kind === 'security' ? [NOTICE_NEVER_ASKS] : []),
    NOTICE_REASON,
  ].join('\n')

  return { subject, html, text }
}

export interface ResendConfig {
  /** Resend API key. When absent, sending is skipped (feature off). */
  apiKey?: string
  /** From header. Default hello@mercurypitch.com (Resend-verified root
   *  domain). Override to send from a different verified address. */
  from?: string
  /** Reply-To; where human replies land. */
  replyTo?: string
}

// Friendly, replies-welcome default. Resend verifies the ROOT domain
// (mercurypitch.com); send.mercurypitch.com is only its return-path/bounce
// subdomain, so sending From @send.* is rejected (403). hello@ also receives
// via Cloudflare Email Routing, so replies land. Override with EMAIL_FROM.
const DEFAULT_FROM = 'MercuryPitch <hello@mercurypitch.com>'
const DEFAULT_REPLY_TO = 'hello@mercurypitch.com'

/** What Resend said. `id` is its message id, kept only by the newsletter so a
 *  bounce can be traced back to one send. */
export interface ResendResult {
  ok: boolean
  id?: string
  /** No answer came back at all (the request threw), so whether Resend took
   *  it is unknown. Only a caller with an idempotency key can safely ask
   *  again. */
  unanswered?: boolean
  /** Resend's refusal, when it answered one: the HTTP status, and the
   *  error's `name` and `message`. */
  status?: number
  errorName?: string
  errorMessage?: string
}

export interface ResendOptions {
  /**
   * Extra RFC-5322 headers. Only the newsletter uses this, for
   * List-Unsubscribe — which Gmail and Yahoo have required of bulk senders
   * since 2024, and without which a marketing send lands in spam however
   * clean the list is.
   */
  headers?: Record<string, string>
  /**
   * Resend's Idempotency-Key request header: an identical request repeated
   * under the same key within 24 hours gets the first one's answer instead
   * of a second mail. A different body under a used key is refused (409
   * invalid_idempotent_request; see sentUnderKeyAlready). The fresh confirm
   * link uses one key per campaign and account.
   */
  idempotencyKey?: string
  /** One more recipient, out of sight of `to`: the withdrawal
   *  acknowledgement's copy to the account's own address. */
  bcc?: string
}

/**
 * Whether Resend refused the request because its Idempotency-Key went with
 * another body in the last 24 hours (409 invalid_idempotent_request). Its
 * docs (idempotency keys, October 2026): a key lasts 24 hours; the same key
 * and body again answers what the first request got and sends nothing;
 * another body under the key is this 409, which retrying never changes;
 * two requests at once under one key are 409 concurrent_idempotent_requests,
 * safe to retry later. They say nothing of a key whose first request
 * failed. A mail that is sent again renders again, and its body can differ
 * (a balance, a refund that went through since), so for a mail keyed once
 * per purchase or statement this 409 says an earlier try was taken, when
 * that try's outcome was unknown (mail-answer.ts).
 */
export function sentUnderKeyAlready(result: ResendResult): boolean {
  return (
    result.status === 409 && result.errorName === 'invalid_idempotent_request'
  )
}

/** The error's `name` and `message` from a Resend refusal, when its body
 *  has them. */
function errorOf(
  text: string,
): Pick<ResendResult, 'errorName' | 'errorMessage'> {
  try {
    const body = JSON.parse(text) as { name?: unknown; message?: unknown }
    return {
      ...(typeof body.name === 'string' ? { errorName: body.name } : {}),
      ...(typeof body.message === 'string'
        ? { errorMessage: body.message }
        : {}),
    }
  } catch {
    return {}
  }
}

/**
 * Best-effort POST to Resend. Returns ok:true if accepted, ok:false if skipped
 * (no key / no recipient) or the API rejected it. NEVER throws — callers must
 * not let an email failure roll back a signup or a paid credit grant.
 */
export async function resendPost(
  cfg: ResendConfig,
  to: string,
  rendered: RenderedEmail,
  options: ResendOptions = {},
): Promise<ResendResult> {
  const { headers, idempotencyKey, bcc } = options
  if (!cfg.apiKey) {
    console.log('[email] RESEND_API_KEY unset — email skipped')
    return { ok: false }
  }
  if (!to || !to.includes('@')) {
    console.log('[email] no recipient email — email skipped')
    return { ok: false }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey === undefined
          ? {}
          : { 'Idempotency-Key': idempotencyKey }),
      },
      body: JSON.stringify({
        from: cfg.from ?? DEFAULT_FROM,
        reply_to: cfg.replyTo ?? DEFAULT_REPLY_TO,
        to: [to],
        ...(bcc === undefined ? {} : { bcc: [bcc] }),
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...(headers === undefined ? {} : { headers }),
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`[email] Resend rejected (${res.status}): ${text}`)
      return { ok: false, status: res.status, ...errorOf(text) }
    }
    // The id is a nicety, not the verdict: a 200 with an unreadable body is
    // still a send, and treating it as a failure would mail somebody twice.
    let id: string | undefined
    try {
      const body = (await res.json()) as { id?: unknown }
      if (typeof body.id === 'string') id = body.id
    } catch {
      /* accepted, id unknown */
    }
    return { ok: true, id }
  } catch (err) {
    console.error(`[email] Resend request failed: ${String(err)}`)
    return { ok: false, unanswered: true }
  }
}

/** resendPost for the callers that only care whether it went. */
export async function resendSend(
  cfg: ResendConfig,
  to: string,
  rendered: RenderedEmail,
): Promise<boolean> {
  return (await resendPost(cfg, to, rendered)).ok
}

/** Send a plain-text ops alert (billing reconciliation). Best-effort; see
 *  resendSend. Unlike the user-facing emails this is for the operator, so
 *  it skips the branded HTML — the information is the whole point. */
export async function sendBillingAlert(
  cfg: ResendConfig,
  to: string,
  subject: string,
  lines: string[],
): Promise<boolean> {
  const text = lines.join('\n')
  const ok = await resendSend(cfg, to, {
    subject: `[MercuryPitch billing] ${subject}`,
    text,
    html: `<pre style="font: 13px/1.5 monospace">${text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')}</pre>`,
  })
  if (ok) console.log(`[email] billing alert sent to ${to}`)
  return ok
}

/** Send the reset-your-password message. Best-effort; see resendSend. */
export async function sendPasswordReset(
  cfg: ResendConfig,
  to: string,
  vars: PasswordResetVars,
): Promise<boolean> {
  const ok = await resendSend(cfg, to, renderPasswordReset(vars))
  if (ok) console.log(`[email] password reset sent to ${to}`)
  return ok
}

/** Send a sign-in code. Best-effort; see resendSend. The code itself is
 *  never logged — the log line would outlive the ten minutes it is good for. */
export async function sendLoginCode(
  cfg: ResendConfig,
  to: string,
  vars: LoginCodeVars,
): Promise<boolean> {
  const ok = await resendSend(cfg, to, renderLoginCode(vars))
  if (ok) console.log(`[email] sign-in code sent to ${to}`)
  return ok
}

/**
 * Send one newsletter issue to one recipient. Returns the provider's message
 * id so the caller can log the send; `ok:false` means nothing was sent.
 *
 * Unlike the transactional senders this sets List-Unsubscribe and
 * List-Unsubscribe-Post, which Gmail and Yahoo require of anyone sending bulk
 * mail. The POST variant is what makes the inbox's own "unsubscribe" button
 * appear, and the worker's unsubscribe route accepts POST for exactly that.
 * It is also why `unsubscribeUrl` is not optional: without a working link this
 * mail must not go out at all.
 */
export async function sendNewsletterIssue(
  cfg: ResendConfig,
  to: string,
  vars: NewsletterIssueVars,
): Promise<ResendResult> {
  const result = await resendPost(cfg, to, renderNewsletterIssue(vars), {
    headers: {
      'List-Unsubscribe': `<${vars.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })
  if (result.ok) console.log(`[email] newsletter sent to ${to}`)
  return result
}

/**
 * Send one account notice to one recipient. Returns the provider's message id
 * so the caller can log the send; `ok:false` means nothing was sent.
 *
 * Deliberately WITHOUT the List-Unsubscribe headers the newsletter sets. They
 * are for mail somebody can opt out of, and this is not: a header promising
 * an unsubscribe that the worker would then have to ignore is worse than no
 * header. Service mail is exempt from the bulk-sender rule that requires it.
 */
export async function sendAccountNotice(
  cfg: ResendConfig,
  to: string,
  vars: AccountNoticeVars,
): Promise<ResendResult> {
  const result = await resendPost(cfg, to, renderAccountNotice(vars))
  if (result.ok) console.log(`[email] account notice sent to ${to}`)
  return result
}

// ── Wiring ───────────────────────────────────────────────────────────
//
// Already wired: billing.ts › grantCheckoutCredits awaits sendPurchaseMail
// (email-purchase.ts) after the creditLedger insert (only on a real grant,
// guarded, never fatal).
// To turn it on in an environment, set the secret + verify the sender domain:
//   echo 're_…' | npx wrangler secret put RESEND_API_KEY -c workers/db-worker/wrangler.jsonc --env prod
// Until RESEND_API_KEY is set the send is skipped and credits still grant.
