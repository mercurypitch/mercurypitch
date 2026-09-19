// ── /api/newsletter/* — who asked to hear from us ────────────────────
//
// One checkbox, two places to tick it, and a link in every email that
// unticks it without a sign-in.
//
// The list is this column, not a list held somewhere else. A mirror in a
// mailing provider would be a second source of truth for consent, and the two
// would drift the first time somebody unsubscribed from an email: Settings
// would go on saying they were subscribed until something reconciled them. A
// checkbox that lies about consent is the one state this must never reach.
// Keeping it here also means account erasure already covers it, and that the
// switch still works on a day the mail provider does not.
//
// Nothing in this file sends anything. The sender is a script run by hand
// (docs/plans/newsletter-registered-users.md); a cron that mails people is a
// newsletter sent by accident.
//
// Dispatched from index.ts rather than from handleAuth, so the import runs one
// way — this file imports auth.ts, never the reverse.

import type { Env } from './auth'
import { b64urlEncode, checkRateLimit, getAuth } from './auth'
import type { NewsletterConsent } from './newsletter-consent'
import { readNewsletterConsent, setNewsletterConsent, } from './newsletter-consent'

type Respond = (body: object | null, init?: ResponseInit) => Response

export type { NewsletterConsent }

// ── The link in the email ────────────────────────────────────────────

/**
 * A token that unsubscribes one account, and only that account.
 *
 * `<userId>.<hmac>`, signed over the id AND the moment they opted in. Four
 * properties matter, and each one is a rule somebody has broken before:
 *
 * - **Unguessable.** An unsubscribe link built from a bare user id lets
 *   anyone with a list of ids unsubscribe strangers.
 * - **Idempotent.** Opting out does not move `newsletterOptInAt`, so the
 *   same link keeps verifying afterwards. A mail client that prefetches it,
 *   or a person who clicks twice, must not see an error.
 * - **Self-invalidating.** Opting back in DOES move it, which retires every
 *   link in every email sent before. Otherwise an old newsletter could
 *   silently undo a fresh yes.
 * - **Silent.** Verification never says whether the account exists; the route
 *   answers the same page either way. An endpoint that answers differently
 *   for a real address is an address oracle.
 *
 * The secret is its own, not JWT_SECRET: rotating the thing that signs
 * sessions must not break links that are already in somebody's inbox, and a
 * secret that leaves the worker in a URL should never be the one that mints
 * credentials.
 */
export async function unsubscribeToken(
  secret: string,
  userId: string,
  optInAt: string | null,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`newsletter:${userId}:${optInAt ?? ''}`),
  )
  return `${userId}.${b64urlEncode(sig)}`
}

/** Constant-time compare. Local rather than imported so this file has no
 *  reason to reach further into auth.ts than the encoder. */
function sameSignature(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  let diff = ab.length ^ bb.length
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ (bb[i] ?? 0)
  return diff === 0
}

/**
 * The account a token names, or null.
 *
 * Reads the row to learn the `newsletterOptInAt` the signature must cover, so
 * a token minted before a fresh opt-in no longer verifies.
 */
export async function resolveUnsubscribeToken(
  db: D1Database,
  secret: string,
  token: string,
): Promise<string | null> {
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const userId = token.slice(0, dot)
  const consent = await readNewsletterConsent(db, userId)
  if (!consent) return null
  const expected = await unsubscribeToken(secret, userId, consent.optInAt)
  return sameSignature(expected, token) ? userId : null
}

// ── Routes ───────────────────────────────────────────────────────────

const PAGE_STYLE = `body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1115;color:#e8e6e3;font:16px/1.6 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}main{max-width:32rem;padding:2.5rem 1.5rem;text-align:center}h1{font-size:1.4rem;margin:0 0 .6rem}p{margin:0 0 1.2rem;color:#a9a6a1}a{color:#7cc4a6}`

function page(title: string, body: string): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>${PAGE_STYLE}</style></head><body><main><h1>${title}</h1>${body}</main></body></html>`,
    {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  )
}

/**
 * The same answer for a good token, a stale one and a forged one.
 *
 * Telling them apart would turn this into a way to ask whether an address has
 * an account, which is exactly what a list broker wants from an unsubscribe
 * endpoint.
 */
function unsubscribedPage(): Response {
  return page(
    'You are unsubscribed',
    `<p>You will not get any more product updates from MercuryPitch. Nothing else about your account has changed.</p><p>Changed your mind? Turn updates back on under Account in Settings.</p>`,
  )
}

export async function handleNewsletterRoute(
  request: Request,
  env: Env,
  pathname: string,
  respond: Respond,
): Promise<Response | null> {
  if (pathname === '/api/newsletter/preference') {
    if (request.method !== 'POST') {
      return respond({ error: 'Method not allowed' }, { status: 405 })
    }
    const auth = await getAuth(request, env)
    if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkRateLimit(
      env.DB,
      request.headers.get('CF-Connecting-IP') ?? '127.0.0.1',
      'newsletter-preference',
    )
    if (!rl.allowed) {
      return respond(
        {
          error: `Too many requests. Retry after ${rl.retryAfter ?? 60} seconds.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfter ?? 60) },
        },
      )
    }

    const body = await request
      .json<{ optIn?: unknown }>()
      .catch(() => null as { optIn?: unknown } | null)
    // Only a real boolean counts. A string, a number or a missing field is a
    // client that does not know what it is asking for, and consent is not a
    // place to guess a default.
    if (typeof body?.optIn !== 'boolean') {
      return respond({ error: 'optIn must be true or false' }, { status: 400 })
    }

    await setNewsletterConsent(env.DB, auth.userId, body.optIn, 'settings')
    return respond({ ok: true, optIn: body.optIn })
  }

  if (pathname === '/api/newsletter/unsubscribe') {
    // GET is the link a person clicks. POST is what a mail client sends for
    // List-Unsubscribe-Post, form-encoded rather than JSON, which is why
    // nothing here reads a body.
    if (request.method !== 'GET' && request.method !== 'POST') {
      return respond({ error: 'Method not allowed' }, { status: 405 })
    }
    if (!env.NEWSLETTER_LINK_SECRET) {
      // Unset simply means this environment cannot mint or honour links, and
      // nothing has been sent from it either. Saying so beats pretending the
      // unsubscribe worked.
      return respond({ error: 'Not configured' }, { status: 503 })
    }

    const rl = await checkRateLimit(
      env.DB,
      request.headers.get('CF-Connecting-IP') ?? '127.0.0.1',
      'newsletter-unsubscribe',
    )
    if (!rl.allowed) {
      return respond(
        {
          error: `Too many requests. Retry after ${rl.retryAfter ?? 60} seconds.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfter ?? 60) },
        },
      )
    }

    const token = new URL(request.url).searchParams.get('t') ?? ''
    const userId = token
      ? await resolveUnsubscribeToken(env.DB, env.NEWSLETTER_LINK_SECRET, token)
      : null
    if (userId) {
      await setNewsletterConsent(env.DB, userId, false, 'email')
    }
    return unsubscribedPage()
  }

  return null
}
