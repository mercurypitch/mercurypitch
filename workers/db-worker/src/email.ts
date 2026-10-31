// Transactional email: the shared helpers (escaping, money and dates, the
// footer, the Resend client) and the owner's billing alerts, which stay plain
// text. Every mail a person receives has its own module and shares the
// layout in email-layout.ts: email-code.ts, email-password-reset.ts,
// email-welcome.ts, email-purchase.ts, email-withdrawal.ts,
// email-newsletter.ts and email-notice.ts.
//
// Two concerns, kept separate so each renderer is previewable and
// unit-testable without any network: render*(vars) → { subject, html, text }
// is pure, send*(cfg, to, vars) is the Resend POST.
//
// Sending is best-effort and OFF until RESEND_API_KEY is set, and an email
// failure never fails the action that sent it.
//
// Brand palette + footer links mirror the landing (about.mercurypitch.com).
// No emoji / no inline SVG on purpose: Gmail strips <svg> and many clients
// mangle emoji.

export const APP_URL = 'https://mercurypitch.com'
export const ABOUT_URL = 'https://about.mercurypitch.com'
export const REPO_URL = 'https://github.com/mercurypitch/mercurypitch'

// ── the footer's colors (GitHub-dark, matches the app + landing) ──────
// The same values as W.line, W.muted and W.blue in email-layout.ts, which
// holds the rest of the look.
export const C = {
  border: '#30363d',
  muted: '#8b949e',
  blue: '#58a6ff',
} as const

/** The color-scheme lines in every mail's head. The mails are drawn dark but
 *  declare "light only". In dark mode, Gmail on the iPhone (a Google account,
 *  test mails of 14 Oct 2026) recolored the welcome mail while it declared
 *  "dark", turning its page white under a white wordmark, and showed it as
 *  drawn once it declared "light only". Gmail on Android and Proton on the
 *  iPhone showed it as drawn either way. A client that honors "light only"
 *  gives text with no color of its own the light defaults, black and link
 *  blue, so every line of text takes its color from the mail:
 *  email-color-scheme.test.ts checks that. */
export const COLOR_SCHEME_META = `<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">`

/** Text a client turns into a link takes the color of the words around it.
 *  Apple Mail's data detectors, and possibly the Gmail apps, link dates,
 *  addresses and the like; under "light only" such a link would be link
 *  blue on the dark card. The Gmail apps keep a head <style> and match
 *  `u + #body` (selector probe, 14 Oct 2026), which is why every mail's
 *  <body> has id="body". The Gmail rule sets the color alone, so the mail's
 *  own links keep their inline colors and underlines. */
export const AUTO_LINK_STYLE = `<style>a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important;}u + #body a{color:inherit;}</style>`

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

/** An address as a log line may show it: enough to tell two apart, not
 *  enough to write to. "maria.k@example.com" becomes "m***@***.com", and
 *  "user@[192.0.2.1]" becomes "u***@***". */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf('@')
  if (at <= 0) return '***'
  const domain = address.slice(at + 1)
  const dot = domain.lastIndexOf('.')
  // The whole first character, never half of one outside the BMP.
  const first = String.fromCodePoint(address.codePointAt(0) ?? 0x2a)
  // An address literal ("[192.0.2.1]") has no top-level domain to show.
  const tld = dot === -1 || domain.startsWith('[') ? '' : domain.slice(dot)
  return `${first}***@***${tld}`
}

// The pieces of ADDRESS. A character of an unquoted local part, of a quoted
// one (an escaped pair counting as one), and of a domain's label, and a
// domain.
const LOCAL_CHAR = String.raw`[^\s@"<>()[\]\\,;:]`
const QUOTED_CHAR = String.raw`(?:[^"\\\r\n]|\\.)`
const LABEL_CHAR = String.raw`[\p{L}\p{M}\p{N}-]`
const DOMAIN = String.raw`${LABEL_CHAR}+(?:\.${LABEL_CHAR}+)*`

// A local part, read in one of these ways. None reads the same text over
// and over, so masking takes time linear in the length of the text.
const LOCAL_PART = [
  // Quoted, for at most 64 characters, from any quote.
  String.raw`"${QUOTED_CHAR}{0,64}"`,
  // Quoted, however long, from a quote with no backslash right before it.
  // A quote inside one always has one, so none starts inside another.
  String.raw`(?<!\\)"${QUOTED_CHAR}*"`,
  // Unquoted, from where its run starts.
  String.raw`(?<!${LOCAL_CHAR})${LOCAL_CHAR}+`,
  // Unquoted, glued to the address before it, from where that address's
  // domain ends inside the run: where no domain can carry on, right after
  // an @ and a domain. A run has one such place at most, and looking back
  // for the @ stops where a domain could not reach.
  String.raw`(?!${LABEL_CHAR}|\.${LABEL_CHAR})(?<=@${DOMAIN})${LOCAL_CHAR}+`,
].join('|')

// What follows the @, read the same way.
const DOMAIN_PART = [
  // An address literal, for at most 64 characters.
  String.raw`\[[^\]\s]{0,64}\]`,
  // One however long with no "[" in it, so none starts inside another.
  String.raw`\[[^\]\s[]*\]`,
  DOMAIN,
].join('|')

/** Anything that reads like an address, in text a log line carries from
 *  elsewhere (an API's error body, a thrown error). An unquoted local part
 *  is any run of characters but a space, an @ and those that end an
 *  address in text ("<>()[]\\,;: and the double quote): letters, marks and
 *  digits in any script ("josé@exämple.com"), every other character RFC
 *  5322 allows (!#$%&'*+-/=?^_`{|}~ and the dot, so
 *  "mary.o'brien@example.com" masks whole), and a symbol or an emoji, even
 *  right before the @, all of which sign-up takes (#970 round-4 review,
 *  N-5). It is read from where its run starts or, glued to an address
 *  before it ("?to=bob@example.org&cc=carol@example.net"), from where that
 *  address ends, so it masks whole however long it is, and a long run with
 *  no @ in it (a base64 blob) is read once (#970 round-4 review, N-4). A
 *  quoted local part ("\"quoted local\"@example.com") and an address
 *  literal ("user@[192.0.2.1]") mask whole however long they are too, but
 *  for two that RFC 5321 allows neither of: a quoted local part over 64
 *  characters between its quotes with a backslash right before its opening
 *  quote, and an address literal over 64 characters between its brackets
 *  with a "[" among them. Those are left as written, apart from any piece
 *  of them that reads as an address on its own: read to their end, they
 *  would make text full of escaped quotes, or of "a@[", slow to mask again
 *  (#975 review). Punctuation a local part may hold is masked with the
 *  address when it touches it: "'jane@example.com'" logs as
 *  "'***@***.com'" (#970 review, F-7). */
const ADDRESS = new RegExp(`(?:${LOCAL_PART})@(?:${DOMAIN_PART})`, 'gu')

/** `text` with every address in it masked (maskEmail): for text a log line
 *  carries but did not write, which may name the recipient. */
export function maskAddresses(text: string): string {
  return text.replace(ADDRESS, (address) => maskEmail(address))
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
// "You're receiving this because you created an account on". The plain-text
// parts say the same in footerText (email-layout.ts).
export function footerHtml(reason: string): string {
  return `<tr>
            <td style="padding:24px 16px 8px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; text-align:center;">
              <p style="margin:0 0 12px; font-size:14px; color:${C.muted};">
                Learn to sing and play.
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

// ── Sending (Resend) ─────────────────────────────────────────────────

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
      console.error(
        `[email] Resend rejected (${res.status}): ${maskAddresses(text)}`,
      )
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
    console.error(
      `[email] Resend request failed: ${maskAddresses(String(err))}`,
    )
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
  return sendOwnerAlert(cfg, to, 'billing', subject, lines)
}

/** sendBillingAlert for any of the operator's topics: billing, and a
 *  singer's report (reports.ts). The topic leads the subject. */
export async function sendOwnerAlert(
  cfg: ResendConfig,
  to: string,
  topic: 'billing' | 'report',
  subject: string,
  lines: string[],
): Promise<boolean> {
  const text = lines.join('\n')
  const ok = await resendSend(cfg, to, {
    subject: `[MercuryPitch ${topic}] ${subject}`,
    text,
    html: `<pre style="font: 13px/1.5 monospace">${text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')}</pre>`,
  })
  if (ok) console.log(`[email] ${topic} alert sent to ${maskEmail(to)}`)
  return ok
}

// ── Wiring ───────────────────────────────────────────────────────────
//
// Already wired: billing.ts › grantCheckoutCredits awaits sendPurchaseMail
// (email-purchase.ts) after the creditLedger insert (only on a real grant,
// guarded, never fatal).
// To turn it on in an environment, set the secret + verify the sender domain:
//   echo 're_…' | npx wrangler secret put RESEND_API_KEY -c workers/db-worker/wrangler.jsonc --env prod
// Until RESEND_API_KEY is set the send is skipped and credits still grant.
