// ============================================================
// Mail preview — every mail a person receives, rendered with sample data
// ============================================================
//
// GET /api/email-preview lists every variant; ?mail=<id> renders one exactly
// as Resend would receive it, and &part=text shows its plain-text part. The
// sample singer and buyer are made up and no account, token or address is
// ever read. The seller line in the credit mails is this environment's
// TRADER_* vars, so the owner can check them before a buyer sees them. The
// newsletter and notice samples are made up too, and say so: their real
// words come from the operator. Only the owner's billing alerts, plain text,
// are not here.
//
// Off unless the environment sets EMAIL_PREVIEW=1: the dev worker does, and
// a local .dev.vars can. Anywhere else this answers 404 like any unknown path.
//
// Pictures load from the app the links point at, because a browser is
// reading this page, not a mail app. ?app=http://localhost:3000 points both
// at a local vite while the pictures are not yet deployed.

import type { Env } from './auth'
import { fallbackAppOrigin, isAllowedReturnTo } from './auth'
import { traderDetails } from './checkout-consent'
import { escapeHtml } from './email'
import { renderLoginCode, renderSignUpCode } from './email-code'
import type { MailOrigins } from './email-layout'
import { renderNewsletterIssue } from './email-newsletter'
import type { AccountNoticeVars } from './email-notice'
import { renderAccountNotice } from './email-notice'
import { renderPasswordReset } from './email-password-reset'
import { renderPurchaseEmail } from './email-purchase'
import type { WithdrawalEmailVars } from './email-withdrawal'
import { renderWithdrawalEmail } from './email-withdrawal'
import { renderConfirmEmail, renderFreshLinkEmail, renderWelcomeEmail, } from './email-welcome'
import type { RenderedEmail } from './email'
import type { SignupVoiceprint } from './signup-hint'
import { parseVoiceprintHint } from './signup-hint'
import type { TraderDetails } from './withdrawal-wording'

export const EMAIL_PREVIEW_PATH = '/api/email-preview'

/** The sample singer from the approved design. Also what a fresh-link test
 *  mail or sample preview shows (confirm-reminders.ts). */
export const SAMPLE_VOICEPRINT = parseVoiceprintHint({
  twin: 'Frank Sinatra',
  lowMidi: 40,
  highMidi: 67,
  accuracy: 80,
  steadiness: 85,
}) as SignupVoiceprint

const SAMPLE_SIGNED_UP_AT = '2026-10-03T18:20:00.000Z'

/** The sample account holder, wherever a mail greets one. */
const SAMPLE_NAME = 'Sam Singer'

/** What a variant renders with: where links point, who sells, and the
 *  worker's own origin, which the newsletter's unsubscribe link is on. */
interface PreviewContext extends MailOrigins {
  trader: TraderDetails
  apiOrigin: string
}

interface Variant {
  id: string
  label: string
  render: (context: PreviewContext) => RenderedEmail
}

/** A cancelled Starter pack: 14 of its 20 credits unused, and the launch
 *  offer's 30 bonus credits with it. */
const sampleWithdrawal = (
  o: PreviewContext,
  refundState: WithdrawalEmailVars['refundState'],
): RenderedEmail =>
  renderWithdrawalEmail({
    ...o,
    name: 'Sam Singer',
    email: 'sam@example.com',
    packLabel: 'Starter',
    paidCredits: 20,
    purchasedAtIso: '2026-10-08T12:00:00.000Z',
    amountMinor: 500,
    currency: 'eur',
    submittedAtIso: '2026-10-12T14:32:00.000Z',
    unusedCredits: 14,
    bonusCredits: 30,
    refundMinor: 350,
    refundState,
    stripeRefundStatus: refundState === 'refunded' ? 'succeeded' : null,
  })

const sampleVerifyUrl = (origins: MailOrigins): string =>
  `${origins.appOrigin}/api/auth/verify-email?token=sample-token&returnTo=${encodeURIComponent(origins.appOrigin)}`

/** An issue in the shape of v0.9.10's (scripts/newsletter/). */
const sampleIssue = (o: PreviewContext): RenderedEmail =>
  renderNewsletterIssue({
    ...o,
    displayName: SAMPLE_NAME,
    subject: 'MercuryPitch 0.9.10: jam rooms keep time',
    preheader:
      'Jam rooms follow the song, and recorded drums land where you played them.',
    intro:
      'A small release, mostly about things that were a beat off. Here is what changed.',
    items: [
      {
        title: 'Jam rooms follow the song, not a stopwatch',
        body: "The shared clock was read four times a second, so everyone's playhead drifted a little against the music. It now reads the song's own clock every frame, so the lanes line up with what you hear.",
        href: `${o.appOrigin}/#/jam`,
        cta: 'Start a room',
      },
      {
        title: 'Recorded drums land where you played them',
        body: 'Hits recorded in Guitar Night were placed by when they finished rendering rather than when you played them. They now sit where they were heard.',
        href: `${o.appOrigin}/guitar-night`,
        cta: 'Open Guitar Night',
      },
      {
        title: 'Product updates, if you want them',
        body: 'There is a checkbox in Settings under Account, and on the sign-up form. It starts off. This email exists because you ticked it, and the link at the bottom unticks it in one click without signing in.',
      },
    ],
    unsubscribeUrl: `${o.apiOrigin}/api/newsletter/unsubscribe?t=sample-token`,
  })

/** A security notice with two parts. Its words say they are a sample: a
 *  notice's real words come from the operator. */
const sampleSecurityNotice = (o: PreviewContext): AccountNoticeVars => ({
  ...o,
  kind: 'security',
  subject: 'Sample security notice: a sign-in bug, fixed',
  preheader:
    'Sample text. What happened, what we changed, and what you can do.',
  intro:
    'This is sample text for the preview. A real security notice says what happened and when, and what it means for this account.\n\nA blank line starts a new paragraph,\nand a single line break stays inside one.',
  items: [
    {
      title: 'What happened',
      body: 'Sample section text: the facts, in the order they happened.',
    },
    {
      title: 'What you can do',
      body: 'Sample section text, with a link under it.',
      href: `${o.appOrigin}/#/settings`,
      cta: 'Open Settings',
    },
  ],
})

const VARIANTS: readonly Variant[] = [
  {
    id: 'welcome',
    label: 'Welcome, no voiceprint',
    render: (o) =>
      renderWelcomeEmail({ ...o, voiceprint: null, signupSource: null }),
  },
  {
    id: 'welcome-karaoke',
    label: 'Welcome, signed up on Karaoke Night',
    render: (o) =>
      renderWelcomeEmail({ ...o, voiceprint: null, signupSource: 'karaoke' }),
  },
  {
    id: 'welcome-twin',
    label: 'Welcome, with a voiceprint twin',
    render: (o) =>
      renderWelcomeEmail({
        ...o,
        voiceprint: SAMPLE_VOICEPRINT,
        signupSource: null,
      }),
  },
  {
    id: 'confirm',
    label: 'Confirm email, no voiceprint',
    render: (o) =>
      renderConfirmEmail({
        ...o,
        verifyUrl: sampleVerifyUrl(o),
        voiceprint: null,
        ttlHours: 24,
      }),
  },
  {
    id: 'confirm-twin',
    label: 'Confirm email, with a voiceprint twin',
    render: (o) =>
      renderConfirmEmail({
        ...o,
        verifyUrl: sampleVerifyUrl(o),
        voiceprint: SAMPLE_VOICEPRINT,
        ttlHours: 24,
      }),
  },
  {
    id: 'fresh-link',
    label: 'Fresh confirm link, no voiceprint',
    render: (o) =>
      renderFreshLinkEmail({
        ...o,
        verifyUrl: sampleVerifyUrl(o),
        voiceprint: null,
        ttlHours: 7 * 24,
        signedUpAt: SAMPLE_SIGNED_UP_AT,
      }),
  },
  {
    id: 'fresh-link-twin',
    label: 'Fresh confirm link, with a voiceprint twin',
    render: (o) =>
      renderFreshLinkEmail({
        ...o,
        verifyUrl: sampleVerifyUrl(o),
        voiceprint: SAMPLE_VOICEPRINT,
        ttlHours: 7 * 24,
        signedUpAt: SAMPLE_SIGNED_UP_AT,
      }),
  },
  {
    id: 'purchase',
    label: 'Credit pack bought',
    // Pack names and prices live in D1; these are only a sample.
    render: (o) =>
      renderPurchaseEmail({
        ...o,
        packLabel: 'Starter',
        credits: 20,
        balance: 23,
        amountMinor: 500,
        currency: 'eur',
        orderDateIso: '2026-10-08T12:00:00.000Z',
        terms: 'refund_unused',
      }),
  },
  {
    id: 'purchase-waiver',
    label: 'Credit pack bought, WITHDRAWAL_MODE waiver',
    render: (o) =>
      renderPurchaseEmail({
        ...o,
        packLabel: 'Starter',
        credits: 20,
        balance: 23,
        amountMinor: 500,
        currency: 'eur',
        orderDateIso: '2026-10-08T12:00:00.000Z',
        terms: 'waiver',
      }),
  },
  {
    id: 'purchase-offer',
    label: 'Credit pack bought with the launch offer',
    render: (o) =>
      renderPurchaseEmail({
        ...o,
        packLabel: 'Starter',
        credits: 20,
        bonusCredits: 30,
        balance: 53,
        amountMinor: 500,
        currency: 'eur',
        orderDateIso: '2026-10-28T12:00:00.000Z',
        terms: 'refund_unused',
      }),
  },
  {
    id: 'withdrawal',
    label: 'Credit pack cancelled, refunded through Stripe',
    render: (o) => sampleWithdrawal(o, 'refunded'),
  },
  {
    id: 'withdrawal-by-hand',
    label: 'Credit pack cancelled, refund to follow by hand',
    render: (o) => sampleWithdrawal(o, 'manual'),
  },
  {
    id: 'sign-in-code',
    label: 'Sign-in code',
    render: (o) =>
      renderLoginCode({
        ...o,
        displayName: SAMPLE_NAME,
        code: '416028',
        ttlMinutes: 10,
      }),
  },
  {
    id: 'sign-up-code',
    label: 'Sign-up code, for an address with no account',
    render: (o) => renderSignUpCode({ ...o, code: '730519', ttlMinutes: 10 }),
  },
  {
    id: 'password-reset',
    label: 'Password reset',
    render: (o) =>
      renderPasswordReset({
        ...o,
        displayName: SAMPLE_NAME,
        resetUrl: `${o.appOrigin}/#/reset-password?token=sample-token`,
        ttlHours: 2,
      }),
  },
  {
    id: 'newsletter',
    label: 'Newsletter issue, sample copy',
    render: sampleIssue,
  },
  {
    id: 'notice-security',
    label: 'Account notice: security, sample copy',
    render: (o) =>
      renderAccountNotice({
        ...sampleSecurityNotice(o),
        displayName: SAMPLE_NAME,
      }),
  },
  {
    id: 'notice-legal',
    label: 'Account notice: legal, to an account with no name',
    render: (o) =>
      renderAccountNotice({
        ...o,
        displayName: null,
        kind: 'legal',
        subject: 'Sample legal notice: the terms change on 1 December',
        preheader: 'Sample text. What changes, and from when.',
        intro:
          'This is sample text for the preview. A real legal notice says what changes, from when, and where to read the full text.',
        items: [
          {
            title: 'What changes',
            body: 'Sample section text.',
            href: 'https://about.mercurypitch.com/terms/',
            cta: 'Read the terms',
          },
        ],
      }),
  },
  {
    id: 'notice-account',
    label: 'Account notice: about the account, with no parts',
    render: (o) =>
      renderAccountNotice({
        ...o,
        displayName: SAMPLE_NAME,
        kind: 'account',
        subject: 'Sample account notice: your account is due for deletion',
        preheader: 'Sample text. Sign in before the date to keep it.',
        intro:
          'This is sample text for the preview. A real account notice says what is about to happen to this account, when, and how to stop it.',
        items: [],
      }),
  },
  {
    id: 'notice-test',
    label: "Account notice: the operator's test copy",
    render: (o) =>
      renderAccountNotice({
        ...sampleSecurityNotice(o),
        displayName: null,
        test: true,
      }),
  },
]

/** Every mail the preview route can show, by id. */
export const PREVIEW_MAIL_IDS: readonly string[] = VARIANTS.map((v) => v.id)

function page(body: string, contentType: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function indexPage(app: string): string {
  const query = (id: string, part?: string): string =>
    escapeHtml(
      `?mail=${id}${part === undefined ? '' : `&part=${part}`}&app=${encodeURIComponent(app)}`,
    )
  const rows = VARIANTS.map(
    (v) =>
      `<li><a href="${query(v.id)}">${escapeHtml(v.label)}</a> <a class="text" href="${query(v.id, 'text')}">text</a></li>`,
  ).join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mail preview</title>
<style>body{margin:0;padding:32px 16px;background:#010409;color:#e6edf3;font:16px/1.6 'Segoe UI',Roboto,Helvetica,Arial,sans-serif}main{max-width:600px;margin:0 auto}h1{font-size:22px;margin:0 0 4px}p{color:#8b949e;margin:0 0 20px}ul{padding:0;list-style:none}li{padding:10px 0;border-top:1px solid #30363d}a{color:#58a6ff;text-decoration:none}a.text{float:right;color:#8b949e;font-size:14px}</style>
</head><body><main><h1>Mail preview</h1><p>Sample data. Links and pictures point at ${escapeHtml(app)}.</p><ul>${rows}</ul></main></body></html>`
}

/** Null when this is not the route or it is switched off: index.ts carries on. */
export function handleEmailPreview(
  request: Request,
  env: Env,
  pathname: string,
): Response | null {
  if (pathname !== EMAIL_PREVIEW_PATH) return null
  // Switched off, the path is simply unknown, and index.ts answers it so.
  if (env.EMAIL_PREVIEW !== '1' || request.method !== 'GET') return null
  const url = new URL(request.url)
  const requested = url.searchParams.get('app') ?? ''
  const app = isAllowedReturnTo(requested, env)
    ? new URL(requested).origin
    : fallbackAppOrigin(env)
  const mailId = url.searchParams.get('mail')
  if (mailId === null) return page(indexPage(app), 'text/html; charset=utf-8')
  const variant = VARIANTS.find((v) => v.id === mailId)
  if (variant === undefined) {
    return page('No such mail', 'text/plain; charset=utf-8', 404)
  }
  const rendered = variant.render({
    appOrigin: app,
    assetOrigin: app,
    trader: traderDetails(env),
    apiOrigin: url.origin,
  })
  return url.searchParams.get('part') === 'text'
    ? page(
        `Subject: ${rendered.subject}\n\n${rendered.text}`,
        'text/plain; charset=utf-8',
      )
    : page(rendered.html, 'text/html; charset=utf-8')
}
