// ============================================================
// Mail preview — the welcome and confirm mails, rendered with sample data
// ============================================================
//
// GET /api/email-preview lists every variant; ?mail=<id> renders one exactly
// as Resend would receive it, and &part=text shows its plain-text part. The
// sample singer is made up and no account, token or address is ever read.
//
// Off unless the environment sets EMAIL_PREVIEW=1: the dev worker does, and
// a local .dev.vars can. Anywhere else this answers 404 like any unknown path.
//
// Pictures load from the app the links point at, because a browser is
// reading this page, not a mail app. ?app=http://localhost:3000 points both
// at a local vite while the pictures are not yet deployed.

import type { Env } from './auth'
import { fallbackAppOrigin, isAllowedReturnTo } from './auth'
import { escapeHtml } from './email'
import type { MailOrigins } from './email-layout'
import { renderPurchaseEmail } from './email-purchase'
import { renderConfirmEmail, renderFreshLinkEmail, renderWelcomeEmail, } from './email-welcome'
import type { RenderedEmail } from './email'
import type { SignupVoiceprint } from './signup-hint'
import { parseVoiceprintHint } from './signup-hint'

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

interface Variant {
  id: string
  label: string
  render: (origins: MailOrigins) => RenderedEmail
}

const sampleVerifyUrl = (origins: MailOrigins): string =>
  `${origins.appOrigin}/api/auth/verify-email?token=sample-token&returnTo=${encodeURIComponent(origins.appOrigin)}`

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
      }),
  },
]

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
  const rendered = variant.render({ appOrigin: app, assetOrigin: app })
  return url.searchParams.get('part') === 'text'
    ? page(
        `Subject: ${rendered.subject}\n\n${rendered.text}`,
        'text/plain; charset=utf-8',
      )
    : page(rendered.html, 'text/html; charset=utf-8')
}
