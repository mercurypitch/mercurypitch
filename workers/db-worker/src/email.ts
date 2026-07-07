// Transactional email — purchase "thank you" for credit-pack buyers.
//
// Two concerns, kept separate so the renderer is trivially previewable and
// unit-testable without any network:
//   • renderPurchaseThankYou(vars) → { subject, html, text }  (pure)
//   • sendPurchaseThankYou(cfg, to, vars)                     (Resend POST)
//
// Sending is best-effort and OFF until RESEND_API_KEY is set — mirrors the
// Stripe/RunPod "configured?" guards. Wire it into grantCheckoutCredits AFTER
// the ledger insert, and never let an email failure fail the credit grant
// (a customer paid; credits must land regardless). See the note at the bottom.
//
// Brand palette + footer links mirror the landing (about.mercurypitch.com).
// No emoji / no inline SVG on purpose: Gmail strips <svg> and many clients
// mangle emoji — the design leans on the OG image + colour blocks instead.

export interface PurchaseThankYouVars {
  /** Buyer's display name; falls back to a neutral greeting when absent. */
  displayName?: string | null
  /** Pack label, e.g. "Starter". */
  packLabel: string
  /** Credits granted by this purchase. */
  credits: number
  /** Balance after the grant (running total). */
  balance: number
  /** Price paid, in minor units (e.g. 500 = €5.00). */
  amountMinor: number
  /** ISO currency, e.g. "eur". */
  currency: string
  /** ISO timestamp of the order (createdAt of the ledger row). */
  orderDateIso: string
}

const APP_URL = 'https://mercurypitch.com'
const ABOUT_URL = 'https://about.mercurypitch.com'
const CREDITS_URL = 'https://mercurypitch.com/#/settings/credits'
const KARAOKE_URL = 'https://mercurypitch.com/#/karaoke'
const REPO_URL = 'https://github.com/mercurypitch/mercurypitch'
// App serves this 1200×630 card (see index.html og:image).
const OG_IMAGE_URL = 'https://mercurypitch.com/og-image.png'

// ── palette (GitHub-dark, matches the app + landing) ─────────────────
const C = {
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

function escapeHtml(s: string): string {
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

/** Pure renderer — no I/O. Safe to call from a preview script or a test. */
export function renderPurchaseThankYou(v: PurchaseThankYouVars): RenderedEmail {
  const name = v.displayName?.trim()
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,'
  const price = formatMoney(v.amountMinor, v.currency)
  const date = formatDate(v.orderDateIso)
  const pack = escapeHtml(v.packLabel)
  const credits = v.credits.toLocaleString('en-GB')
  const balance = v.balance.toLocaleString('en-GB')

  const subject = `Thanks for your ${v.packLabel} pack — ${credits} credits are ready`

  // Hidden preheader: the grey preview line inbox lists show next to the
  // subject. The trailing entities pad it so the client doesn't leak body
  // text into the preview.
  const preheader = `Your ${v.packLabel} credits are in. Thank you for supporting MercuryPitch.`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
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

          <!-- wordmark -->
          <tr>
            <td style="padding:4px 4px 16px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <a href="${APP_URL}" style="text-decoration:none; color:${C.text}; font-size:18px; font-weight:700; letter-spacing:.2px;">
                <span style="color:${C.blue};">Mercury</span><span style="color:${C.purple};">Pitch</span>
              </a>
            </td>
          </tr>

          <!-- hero -->
          <tr>
            <td style="padding:0;">
              <a href="${APP_URL}" style="text-decoration:none;">
                <img src="${OG_IMAGE_URL}" width="600" alt="MercuryPitch — see your voice"
                  style="display:block; width:100%; max-width:600px; height:auto; border-radius:14px 14px 0 0; border:1px solid ${C.border}; border-bottom:0;">
              </a>
            </td>
          </tr>

          <!-- body card -->
          <tr>
            <td style="background:${C.card}; border:1px solid ${C.border}; border-top:0; border-radius:0 0 14px 14px; padding:32px 32px 28px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:${C.text};">

              <h1 style="margin:0 0 14px; font-size:24px; line-height:1.25; font-weight:700; color:${C.text};">
                Thank you for your purchase
              </h1>

              <p style="margin:0 0 18px; font-size:16px; line-height:1.6; color:${C.text};">
                ${greeting}
              </p>
              <p style="margin:0 0 24px; font-size:16px; line-height:1.6; color:${C.muted};">
                MercuryPitch is a small, open-source project, so a real purchase genuinely
                means a lot — thank you. Your credits have been added and are ready to use.
              </p>

              <!-- credits panel -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background:${C.panel}; border:1px solid ${C.borderAccent}; border-radius:12px; margin:0 0 26px;">
                <tr>
                  <td style="padding:22px 24px;">
                    <div style="font-size:13px; letter-spacing:.4px; text-transform:uppercase; color:${C.muted}; font-weight:600;">
                      ${pack} pack
                    </div>
                    <div style="font-size:34px; line-height:1.1; font-weight:800; color:${C.green}; padding:8px 0 4px;">
                      +${credits} credits
                    </div>
                    <div style="font-size:15px; color:${C.text};">
                      New balance: <strong style="color:${C.text};">${balance} credits</strong>
                    </div>
                    <div style="font-size:13px; color:${C.muted}; padding-top:10px; border-top:1px solid ${C.border}; margin-top:14px;">
                      ${price} &middot; ${date}
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:${C.muted};">
                <strong style="color:${C.text};">1 credit = 1 song</strong> separated on our GPU
                servers — fast, high-quality vocal and instrument stems.
              </p>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 8px;">
                <tr>
                  <td align="center" bgcolor="${C.blue}" style="border-radius:10px;">
                    <a href="${KARAOKE_URL}"
                      style="display:inline-block; padding:13px 26px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:16px; font-weight:700; color:#04121f; text-decoration:none; border-radius:10px;">
                      Use Credits
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0; font-size:14px; line-height:1.6; color:${C.muted};">
                or view your balance in <a href="${CREDITS_URL}" style="color:${C.blue}; text-decoration:none;">Settings &rsaquo; Credits</a>.
              </p>

              <div style="border-top:1px solid ${C.border}; margin:26px 0 0; padding-top:18px;">
                <p style="margin:0; font-size:13px; line-height:1.6; color:${C.muted};">
                  Stripe has emailed your official receipt separately. Questions about your order?
                  Just reply to this email, or reach us at
                  <a href="${ABOUT_URL}/contact/" style="color:${C.blue}; text-decoration:none;">our contact page</a>.
                </p>
              </div>

            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="padding:24px 16px 8px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; text-align:center;">
              <p style="margin:0 0 12px; font-size:14px; color:${C.muted};">
                Learn to sing, together. Open source, built with its community.
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
                &copy; 2026 MercuryPitch &middot; AGPL-3.0 &middot; <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Just practice.</span>
              </p>
              <p style="margin:0; font-size:12px; color:${C.muted};">
                You&#39;re receiving this because you purchased credits on
                <a href="${APP_URL}" style="color:${C.muted}; text-decoration:underline;">mercurypitch.com</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `Thank you for your purchase`,
    ``,
    name ? `Hi ${name},` : `Hi there,`,
    ``,
    `MercuryPitch is a small, open-source project, so a real purchase genuinely means a lot — thank you. Your credits have been added and are ready to use.`,
    ``,
    `${v.packLabel} pack`,
    `+${credits} credits`,
    `New balance: ${balance} credits`,
    `${price} · ${date}`,
    ``,
    `1 credit = 1 song separated on our GPU servers — fast, high-quality stems.`,
    ``,
    `Use Credits (separate a song in Karaoke): ${KARAOKE_URL}`,
    `View your balance in Settings > Credits: ${CREDITS_URL}`,
    ``,
    `Stripe has emailed your official receipt separately. Questions? Reply to this email or visit ${ABOUT_URL}/contact/.`,
    ``,
    `— MercuryPitch · Learn to sing, together.`,
    `${ABOUT_URL} · ${REPO_URL}`,
    `You're receiving this because you purchased credits on mercurypitch.com.`,
  ].join('\n')

  return { subject, html, text }
}

// ── Shared footer (all emails) ───────────────────────────────────────
// `reason` is the lead-in of the "why you got this" line, e.g.
// "You're receiving this because you created an account on".
function footerHtml(reason: string): string {
  return `<tr>
            <td style="padding:24px 16px 8px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; text-align:center;">
              <p style="margin:0 0 12px; font-size:14px; color:${C.muted};">
                Learn to sing, together. Open source, built with its community.
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
                &copy; 2026 MercuryPitch &middot; AGPL-3.0 &middot; <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Just practice.</span>
              </p>
              <p style="margin:0; font-size:12px; color:${C.muted};">
                ${reason}
                <a href="${APP_URL}" style="color:${C.muted}; text-decoration:underline;">mercurypitch.com</a>.
              </p>
            </td>
          </tr>`
}

// ── Account sign-up welcome ──────────────────────────────────────────
export interface SignupWelcomeVars {
  /** Registrant display name; falls back to a neutral greeting when absent. */
  displayName?: string | null
}

/** Pure renderer for the "welcome, your account is set" email. Image-light
 *  (no hero) — better inboxing and it renders anywhere. */
export function renderSignupWelcome(v: SignupWelcomeVars): RenderedEmail {
  const name = v.displayName?.trim()
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,'
  const subject = 'Welcome to MercuryPitch'
  const preheader = 'Your account is set — a few good places to start.'

  const feature = (
    accent: string,
    title: string,
    blurb: string,
    href: string,
    cta: string,
  ): string => `
                <tr>
                  <td style="padding:0 0 14px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.panel}; border:1px solid ${C.border}; border-left:3px solid ${accent}; border-radius:10px;">
                      <tr>
                        <td style="padding:16px 18px;">
                          <div style="font-size:16px; font-weight:700; color:${C.text};">${title}</div>
                          <div style="font-size:14px; line-height:1.55; color:${C.muted}; padding:6px 0 10px;">${blurb}</div>
                          <a href="${href}" style="font-size:14px; font-weight:600; color:${C.blue}; text-decoration:none;">${cta} &rarr;</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
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
                Welcome to MercuryPitch
              </h1>
              <p style="margin:0 0 16px; font-size:16px; line-height:1.6; color:${C.text};">${greeting}</p>
              <p style="margin:0 0 24px; font-size:16px; line-height:1.6; color:${C.muted};">
                Your account is all set. MercuryPitch helps you
                <strong style="color:${C.text};">see your voice</strong> and learn to sing — in your
                browser, with nothing uploaded. A few good places to start:
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${feature(C.blue, 'Voice Mirror', 'A 60-second snapshot of your range, pitch accuracy and steadiness.', `${APP_URL}/mirror`, 'Try the Mirror')}
                ${feature(C.green, 'Practice with real-time feedback', 'Sing along and watch your pitch land on the notes, live.', `${APP_URL}/#/singing`, 'Start singing')}
                ${feature(C.purple, 'Karaoke &amp; stems', 'Separate any song into vocals and backing, then sing over it.', `${APP_URL}/#/karaoke`, 'Open Karaoke')}
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 4px;">
                <tr>
                  <td align="center" bgcolor="${C.blue}" style="border-radius:10px;">
                    <a href="${APP_URL}" style="display:inline-block; padding:13px 26px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:16px; font-weight:700; color:#04121f; text-decoration:none; border-radius:10px;">
                      Open MercuryPitch
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:18px 0 0; font-size:13px; line-height:1.6; color:${C.muted};">
                Questions or feedback? Just reply — we read every message.
              </p>
            </td>
          </tr>

          ${footerHtml('You&#39;re receiving this because you created an account on')}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `Welcome to MercuryPitch`,
    ``,
    name ? `Hi ${name},` : `Hi there,`,
    ``,
    `Your account is all set. MercuryPitch helps you see your voice and learn to sing — in your browser, nothing uploaded. A few good places to start:`,
    ``,
    `- Voice Mirror — a 60-second snapshot of your range, pitch accuracy and steadiness: ${APP_URL}/mirror`,
    `- Practice with real-time feedback — sing along and watch your pitch land on the notes: ${APP_URL}/#/singing`,
    `- Karaoke & stems — separate any song into vocals + backing and sing over it: ${APP_URL}/#/karaoke`,
    ``,
    `Open MercuryPitch: ${APP_URL}`,
    ``,
    `Questions or feedback? Just reply — we read every message.`,
    ``,
    `— MercuryPitch · Learn to sing, together.`,
    `${ABOUT_URL} · ${REPO_URL}`,
    `You're receiving this because you created an account on mercurypitch.com.`,
  ].join('\n')

  return { subject, html, text }
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

/**
 * Best-effort POST to Resend. Returns true if accepted, false if skipped
 * (no key / no recipient) or the API rejected it. NEVER throws — callers must
 * not let an email failure roll back a signup or a paid credit grant.
 */
async function resendSend(
  cfg: ResendConfig,
  to: string,
  rendered: RenderedEmail,
): Promise<boolean> {
  if (!cfg.apiKey) {
    console.log('[email] RESEND_API_KEY unset — email skipped')
    return false
  }
  if (!to || !to.includes('@')) {
    console.log('[email] no recipient email — email skipped')
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: cfg.from ?? DEFAULT_FROM,
        reply_to: cfg.replyTo ?? DEFAULT_REPLY_TO,
        to: [to],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
    })
    if (!res.ok) {
      console.error(`[email] Resend rejected (${res.status}): ${await res.text()}`)
      return false
    }
    return true
  } catch (err) {
    console.error(`[email] Resend request failed: ${String(err)}`)
    return false
  }
}

/** Send the purchase thank-you email. Best-effort; see resendSend. */
export async function sendPurchaseThankYou(
  cfg: ResendConfig,
  to: string,
  vars: PurchaseThankYouVars,
): Promise<boolean> {
  const ok = await resendSend(cfg, to, renderPurchaseThankYou(vars))
  if (ok) {
    console.log(`[email] thank-you sent to ${to} (${vars.packLabel}, +${vars.credits})`)
  }
  return ok
}

/** Send the account sign-up welcome email. Best-effort; see resendSend. */
export async function sendSignupWelcome(
  cfg: ResendConfig,
  to: string,
  vars: SignupWelcomeVars,
): Promise<boolean> {
  const ok = await resendSend(cfg, to, renderSignupWelcome(vars))
  if (ok) console.log(`[email] signup welcome sent to ${to}`)
  return ok
}

// ── Wiring ───────────────────────────────────────────────────────────
//
// Already wired: billing.ts › grantCheckoutCredits awaits sendPurchaseThankYou
// after the creditLedger insert (only on a real grant, guarded, never fatal).
// To turn it on in an environment, set the secret + verify the sender domain:
//   echo 're_…' | npx wrangler secret put RESEND_API_KEY -c workers/db-worker/wrangler.jsonc --env prod
// Until RESEND_API_KEY is set the send is skipped and credits still grant.
