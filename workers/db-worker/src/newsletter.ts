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
// Sending lives here too, behind X-Admin-Key, because the secrets do: the
// unsubscribe signing key and the Resend key are worker secrets, and an
// operator's laptop should not need a copy of either to mail a release note.
// What is NOT here is anything that sends on its own — no cron, no queue, no
// trigger. Someone runs scripts/send-newsletter.mjs, reads the recipient list
// back, and then sends. A newsletter that can send itself is a newsletter
// sent by accident.
//
// Dispatched from index.ts rather than from handleAuth, so the import runs one
// way — this file imports auth.ts, never the reverse.

import type { Env } from './auth'
import { b64urlEncode, checkRateLimit, getAuth } from './auth'
import type { NewsletterItem } from './email'
import { renderNewsletterIssue, sendNewsletterIssue } from './email'
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

// ── Sending ──────────────────────────────────────────────────────────
//
// The operator's script holds no secrets. It sends CONTENT to the worker and
// the worker does the rest: it reads the consent column, mints each link with
// NEWSLETTER_LINK_SECRET, and calls Resend with RESEND_API_KEY. Both of those
// stay where they already are, and the machine running the script never has a
// copy of either.
//
// Still not a cron. Someone types the command, reads back the recipient list,
// and sends. See scripts/send-newsletter.mjs.

/**
 * How many recipients one call will mail.
 *
 * Small on purpose. Each send is a request to Resend plus the gap below, so a
 * page is roughly `SEND_PAGE_MAX * (SEND_GAP_MS + latency)` of wall clock and
 * a Worker invocation does not get for ever. Twenty-five keeps a page well
 * under half a minute; the script calls again until nobody is left, which is
 * safe because every accepted send is already logged.
 */
const SEND_PAGE_MAX = 25

/** Resend's free tier allows 2 requests a second. Sending flat out would get
 *  the back half of a list rejected, which the log would then record as a
 *  send that did not happen. */
const SEND_GAP_MS = 600

export interface NewsletterRecipient {
  userId: string
  email: string
  displayName: string | null
}

/**
 * Everyone who asked to hear from us and can actually be reached.
 *
 * Three conditions, none of them optional:
 *
 * - `newsletterOptIn = 1` — the consent column is the list.
 * - `email IS NOT NULL` — anonymous accounts have no address.
 * - `emailVerified = 1` — an address nobody confirmed may belong to whoever
 *   was typed in by mistake. Mailing it is how a typo becomes a complaint
 *   from a stranger, and a stranger's complaint is what costs a sending
 *   domain its reputation.
 *
 * `issue` excludes anyone already logged as sent, so a run that stopped half
 * way is safe to repeat.
 */
export async function listNewsletterRecipients(
  db: D1Database,
  opts: { issue?: string; only?: string; limit?: number } = {},
): Promise<NewsletterRecipient[]> {
  const binds: unknown[] = []
  let sql = `SELECT u.id AS userId, u.email AS email, p.displayName AS displayName
               FROM users u
               LEFT JOIN userProfiles p ON p.id = u.id
              WHERE u.newsletterOptIn = 1
                AND u.email IS NOT NULL
                AND u.emailVerified = 1`
  if (opts.issue) {
    sql += ` AND NOT EXISTS (SELECT 1 FROM newsletterSends s
                              WHERE s.issue = ? AND s.userId = u.id)`
    binds.push(opts.issue)
  }
  if (opts.only) {
    sql += ` AND lower(u.email) = lower(?)`
    binds.push(opts.only)
  }
  sql += ` ORDER BY u.newsletterOptInAt ASC, u.id ASC LIMIT ?`
  binds.push(Math.min(Math.max(opts.limit ?? SEND_PAGE_MAX, 1), SEND_PAGE_MAX))

  const rows = await db
    .prepare(sql)
    .bind(...binds)
    .all<{ userId: string; email: string; displayName: string | null }>()
  return rows.results ?? []
}

interface SendRequestBody {
  issue?: unknown
  subject?: unknown
  preheader?: unknown
  intro?: unknown
  items?: unknown
  only?: unknown
  dryRun?: unknown
  limit?: unknown
}

interface IssueContent {
  issue: string
  subject: string
  preheader: string
  intro: string
  items: NewsletterItem[]
}

/** Reads the issue out of a request body, or says what is missing. A send is
 *  not the place to accept a half-filled form and mail the gaps. */
function readIssueContent(body: SendRequestBody): IssueContent | string {
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
  const issue = str(body.issue)
  const subject = str(body.subject)
  const preheader = str(body.preheader)
  const intro = str(body.intro)
  if (!issue) return 'issue is required (a slug, e.g. "v0-9-10")'
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(issue)) {
    return 'issue must be lowercase letters, digits and dashes'
  }
  if (!subject) return 'subject is required'
  if (!preheader) return 'preheader is required'
  if (!intro) return 'intro is required'
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return 'items must be a non-empty array'
  }
  const items: NewsletterItem[] = []
  for (const raw of body.items) {
    const item = raw as {
      title?: unknown
      body?: unknown
      href?: unknown
      cta?: unknown
    }
    const title = str(item.title)
    const text = str(item.body)
    if (!title || !text) return 'every item needs a title and a body'
    items.push({
      title,
      body: text,
      ...(str(item.href) ? { href: str(item.href) } : {}),
      ...(str(item.cta) ? { cta: str(item.cta) } : {}),
    })
  }
  return { issue, subject, preheader, intro, items }
}

interface SendOutcome {
  email: string
  status: 'sent' | 'failed' | 'preview'
}

export async function handleNewsletterRoute(
  request: Request,
  env: Env,
  pathname: string,
  respond: Respond,
  /** Resolved by index.ts, which owns the admin policy. Required rather than
   *  defaulted: a route that mails people must not be able to open itself by
   *  someone forgetting an argument. */
  isAdmin: () => Promise<boolean>,
): Promise<Response | null> {
  if (pathname === '/api/newsletter/recipients') {
    if (request.method !== 'GET') {
      return respond({ error: 'Method not allowed' }, { status: 405 })
    }
    if (!(await isAdmin())) {
      return respond({ error: 'Forbidden' }, { status: 403 })
    }
    const params = new URL(request.url).searchParams
    const recipients = await listNewsletterRecipients(env.DB, {
      issue: params.get('issue') ?? undefined,
      only: params.get('only') ?? undefined,
      limit: Number(params.get('limit')) || undefined,
    })
    return respond({
      recipients,
      count: recipients.length,
      // So the operator can tell "nobody left" from "one page of many".
      pageMax: SEND_PAGE_MAX,
      canSend: {
        link: !!env.NEWSLETTER_LINK_SECRET,
        resend: !!env.RESEND_API_KEY,
      },
    })
  }

  if (pathname === '/api/newsletter/send') {
    if (request.method !== 'POST') {
      return respond({ error: 'Method not allowed' }, { status: 405 })
    }
    if (!(await isAdmin())) {
      return respond({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request
      .json<SendRequestBody>()
      .catch(() => null as SendRequestBody | null)
    const content = readIssueContent(body ?? {})
    if (typeof content === 'string') {
      return respond({ error: content }, { status: 400 })
    }

    // A send cannot be taken back, so the default is the harmless one:
    // anything other than a literal `false` is a rehearsal.
    const dryRun = body?.dryRun !== false

    if (!env.NEWSLETTER_LINK_SECRET) {
      // Not "send it without a link". Mail with no working unsubscribe is
      // what Gmail and Yahoo's bulk-sender rules exist to stop, and it is
      // also just wrong.
      return respond(
        { error: 'NEWSLETTER_LINK_SECRET is unset — refusing to send' },
        { status: 503 },
      )
    }
    if (!dryRun && !env.RESEND_API_KEY) {
      return respond(
        { error: 'RESEND_API_KEY is unset — refusing to send' },
        { status: 503 },
      )
    }

    const recipients = await listNewsletterRecipients(env.DB, {
      issue: content.issue,
      only: typeof body?.only === 'string' ? body.only : undefined,
      limit: typeof body?.limit === 'number' ? body.limit : undefined,
    })

    const origin = new URL(request.url).origin
    const outcomes: SendOutcome[] = []
    let preview: { subject: string; html: string; text: string } | null = null

    for (const [index, person] of recipients.entries()) {
      const consent = await readNewsletterConsent(env.DB, person.userId)
      // Re-read rather than trust the list: somebody may have unsubscribed
      // between the page being built and their turn coming round.
      if (!consent?.optIn) continue

      const token = await unsubscribeToken(
        env.NEWSLETTER_LINK_SECRET,
        person.userId,
        consent.optInAt,
      )
      const vars = {
        displayName: person.displayName,
        subject: content.subject,
        preheader: content.preheader,
        intro: content.intro,
        items: content.items,
        unsubscribeUrl: `${origin}/api/newsletter/unsubscribe?t=${encodeURIComponent(token)}`,
      }

      if (dryRun) {
        preview ??= renderNewsletterIssue(vars)
        outcomes.push({ email: person.email, status: 'preview' })
        continue
      }

      const result = await sendNewsletterIssue(
        { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
        person.email,
        vars,
      )
      if (!result.ok) {
        outcomes.push({ email: person.email, status: 'failed' })
        continue
      }
      // Logged only after Resend accepted it. A row written first would,
      // on a failure, mark somebody as mailed who never was — and the
      // re-run would then skip them.
      await env.DB.prepare(
        `INSERT OR IGNORE INTO newsletterSends (issue, userId, sentAt, providerId)
              VALUES (?, ?, ?, ?)`,
      )
        .bind(
          content.issue,
          person.userId,
          new Date().toISOString(),
          result.id ?? null,
        )
        .run()
      outcomes.push({ email: person.email, status: 'sent' })

      if (index < recipients.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, SEND_GAP_MS))
      }
    }

    return respond({
      issue: content.issue,
      dryRun,
      sent: outcomes.filter((o) => o.status === 'sent').length,
      failed: outcomes.filter((o) => o.status === 'failed').length,
      recipients: outcomes,
      // A full page back means there may be more; the script calls again.
      morePossible: recipients.length >= SEND_PAGE_MAX,
      ...(preview ? { preview } : {}),
    })
  }

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
