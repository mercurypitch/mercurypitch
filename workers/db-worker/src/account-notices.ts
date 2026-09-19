// ── /api/notices/* — mail we owe every account holder ────────────────
//
// A data breach. A change to the terms. An account about to be deleted
// because nobody has opened it in two years. None of these is a product
// update and none of them waits for a yes, so none of them may go through
// the newsletter: that list is a list of consent, and mailing it a breach
// notice would miss exactly the people who unticked the box.
//
// So this is a second door with a different audience and the same walls:
//
// - **Everybody with an address somebody confirmed.** Not `newsletterOptIn`,
//   and not only active accounts either -- a suspended account is still an
//   account whose data we hold. An unconfirmed address is left out for the
//   reason the newsletter leaves it out: it may belong to a stranger, and a
//   breach notice is the last mail to send to the wrong person. The count of
//   those comes back with the audience, so the operator knows who mail alone
//   will not reach.
// - **The worker sends.** The Resend key is a worker secret and the address
//   list never leaves D1. The console that drives this gets back counts.
// - **Nothing sends on its own.** No cron, no queue, no trigger. Anything
//   other than a literal `dryRun: false` is a rehearsal.
// - **One slug, one wording.** The notice is written down the moment the
//   first copy goes, and a later page whose wording differs is refused. See
//   migration 0049 for why that row outlives the accounts it was sent to.
//
// What it must never become is a way round consent. There is no marketing
// template here, no call to action, and no audience filter -- "everyone with
// a plan", "everyone who sang this month" -- because a notice aimed at a
// segment is a campaign. `kind` is a closed list for the same reason.
//
// Dispatched from index.ts, which owns the admin policy.

import type { Env } from './auth'
import type { AccountNoticeKind, NewsletterItem } from './email'
import { renderAccountNotice, sendAccountNotice } from './email'
import { MANAGED_TEST_EMAIL_DOMAIN } from './testing-account-state'

type Respond = (body: object | null, init?: ResponseInit) => Response

/** Same page and gap as the newsletter, for the same reasons: a Worker
 *  invocation does not get for ever, and Resend allows two requests a
 *  second. The console calls again until nobody is left. */
const SEND_PAGE_MAX = 25
const SEND_GAP_MS = 600

const KINDS: readonly AccountNoticeKind[] = ['security', 'legal', 'account']
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

// Caps, because the wording is stored. Generous for a legal text, small
// enough that one row cannot be made to hold a book.
const MAX_SUBJECT = 200
const MAX_PREHEADER = 250
const MAX_TEXT = 8000
const MAX_ITEMS = 20

export interface NoticeContent {
  notice: string
  kind: AccountNoticeKind
  subject: string
  preheader: string
  intro: string
  items: NewsletterItem[]
}

interface NoticeRequestBody {
  notice?: unknown
  kind?: unknown
  subject?: unknown
  preheader?: unknown
  intro?: unknown
  items?: unknown
  only?: unknown
  test?: unknown
  dryRun?: unknown
  limit?: unknown
}

/** Reads the notice out of a request body, or says what is wrong with it. */
export function readNoticeContent(
  body: NoticeRequestBody,
): NoticeContent | string {
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
  const notice = str(body.notice)
  const kind = str(body.kind) as AccountNoticeKind
  const subject = str(body.subject)
  const preheader = str(body.preheader)
  const intro = str(body.intro)
  if (!notice) return 'notice is required (a slug, e.g. "2026-09-terms-update")'
  if (!SLUG_RE.test(notice)) {
    return 'notice must be lowercase letters, digits and dashes'
  }
  if (!KINDS.includes(kind)) {
    return `kind must be one of: ${KINDS.join(', ')}`
  }
  if (!subject) return 'subject is required'
  if (subject.length > MAX_SUBJECT) return 'subject is too long'
  if (!preheader) return 'preheader is required'
  if (preheader.length > MAX_PREHEADER) return 'preheader is too long'
  if (!intro) return 'intro is required'
  if (intro.length > MAX_TEXT) return 'intro is too long'

  // Sections are optional here, unlike a newsletter: a two-sentence notice
  // is a complete notice.
  const rawItems = body.items ?? []
  if (!Array.isArray(rawItems)) return 'items must be an array'
  if (rawItems.length > MAX_ITEMS) return 'too many sections'
  const items: NewsletterItem[] = []
  for (const raw of rawItems) {
    const item = raw as {
      title?: unknown
      body?: unknown
      href?: unknown
      cta?: unknown
    }
    const title = str(item.title)
    const text = str(item.body)
    const href = str(item.href)
    const cta = str(item.cta)
    if (!title || !text) return 'every section needs a title and a body'
    if (title.length > MAX_SUBJECT || text.length > MAX_TEXT) {
      return 'a section is too long'
    }
    // https only. The mail after a breach is the one a phisher imitates, and
    // ours must not be the one that teaches people to follow an http link.
    if (href && !/^https:\/\/[^\s]+$/.test(href)) {
      return 'a section link must be an https URL'
    }
    items.push({
      title,
      body: text,
      ...(href ? { href } : {}),
      ...(cta ? { cta } : {}),
    })
  }
  return { notice, kind, subject, preheader, intro, items }
}

/** The wording, in one fixed shape, so the same notice always hashes the
 *  same whatever order a client sent its keys in. */
function canonicalContent(content: NoticeContent): string {
  return JSON.stringify({
    kind: content.kind,
    subject: content.subject,
    preheader: content.preheader,
    intro: content.intro,
    items: content.items.map((item) => ({
      title: item.title,
      body: item.body,
      href: item.href ?? '',
      cta: item.cta ?? '',
    })),
  })
}

export async function noticeContentHash(
  content: NoticeContent,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalContent(content)),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export interface NoticeRecord {
  notice: string
  kind: string
  subject: string
  contentHash: string
  firstSentAt: string
  lastSentAt: string
}

async function readNoticeRecord(
  db: D1Database,
  notice: string,
): Promise<NoticeRecord | null> {
  return db
    .prepare(
      `SELECT notice, kind, subject, contentHash, firstSentAt, lastSentAt
         FROM accountNotices WHERE notice = ?`,
    )
    .bind(notice)
    .first<NoticeRecord>()
}

// ── Who it reaches ───────────────────────────────────────────────────

/** Managed testing accounts are confirmed by construction and live at an
 *  address that does not exist. Mailing them is a bounce per account, and a
 *  run of bounces is what costs a sending domain its reputation. */
const TEST_ADDRESS_PATTERN = `%@${MANAGED_TEST_EMAIL_DOMAIN}`

const REACHABLE = `u.email IS NOT NULL
                AND u.emailVerified = 1
                AND lower(u.email) NOT LIKE ?`

interface NoticeRecipient {
  userId: string
  email: string
  displayName: string | null
}

async function listNoticeRecipients(
  db: D1Database,
  opts: { notice?: string; only?: string; limit?: number },
): Promise<NoticeRecipient[]> {
  const binds: unknown[] = [TEST_ADDRESS_PATTERN]
  let sql = `SELECT u.id AS userId, u.email AS email, p.displayName AS displayName
               FROM users u
               LEFT JOIN userProfiles p ON p.id = u.id
              WHERE ${REACHABLE}`
  if (opts.notice) {
    sql += ` AND NOT EXISTS (SELECT 1 FROM accountNoticeSends s
                              WHERE s.notice = ? AND s.userId = u.id)`
    binds.push(opts.notice)
  }
  if (opts.only) {
    sql += ` AND lower(u.email) = lower(?)`
    binds.push(opts.only)
  }
  // Oldest account first, so a mailing stopped half way has reached the
  // people who have been here longest, and a re-run carries on from there.
  sql += ` ORDER BY u.createdAt ASC, u.id ASC LIMIT ?`
  binds.push(Math.min(Math.max(opts.limit ?? SEND_PAGE_MAX, 1), SEND_PAGE_MAX))

  const rows = await db
    .prepare(sql)
    .bind(...binds)
    .all<NoticeRecipient>()
  return rows.results ?? []
}

export interface NoticeAudience {
  /** Confirmed, real addresses that have not had this notice. */
  willReceive: number
  /** Accounts already logged against this slug. */
  alreadySent: number
  /** Accounts with an address nobody confirmed. Mail will not reach them,
   *  and for a breach that is a number somebody has to act on another way. */
  unverified: number
}

export async function countNoticeAudience(
  db: D1Database,
  notice?: string,
): Promise<NoticeAudience> {
  const pending = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM users u
        WHERE ${REACHABLE}
          AND NOT EXISTS (SELECT 1 FROM accountNoticeSends s
                           WHERE s.notice = ? AND s.userId = u.id)`,
    )
    .bind(TEST_ADDRESS_PATTERN, notice ?? '')
    .first<{ n: number }>()
  const sent = notice
    ? await db
        .prepare(
          `SELECT COUNT(*) AS n FROM accountNoticeSends WHERE notice = ?`,
        )
        .bind(notice)
        .first<{ n: number }>()
    : null
  const unverified = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM users u
        WHERE u.email IS NOT NULL
          AND u.emailVerified = 0
          AND lower(u.email) NOT LIKE ?`,
    )
    .bind(TEST_ADDRESS_PATTERN)
    .first<{ n: number }>()
  return {
    willReceive: pending?.n ?? 0,
    alreadySent: sent?.n ?? 0,
    unverified: unverified?.n ?? 0,
  }
}

// ── Routes ───────────────────────────────────────────────────────────

export async function handleAccountNoticeRoute(
  request: Request,
  env: Env,
  pathname: string,
  respond: Respond,
  /** Resolved by index.ts. Required rather than defaulted: a route that
   *  mails every account must not be able to open itself by someone
   *  forgetting an argument. */
  isAdmin: () => Promise<boolean>,
): Promise<Response | null> {
  if (pathname === '/api/notices/audience') {
    if (request.method !== 'GET') {
      return respond({ error: 'Method not allowed' }, { status: 405 })
    }
    if (!(await isAdmin())) {
      return respond({ error: 'Forbidden' }, { status: 403 })
    }
    const notice = new URL(request.url).searchParams.get('notice') ?? ''
    if (notice && !SLUG_RE.test(notice)) {
      return respond(
        { error: 'notice must be lowercase letters, digits and dashes' },
        { status: 400 },
      )
    }
    // Counts, and no addresses. The console needs to know how many; nothing
    // outside this worker needs to know who.
    return respond({
      notice: notice || null,
      ...(await countNoticeAudience(env.DB, notice || undefined)),
      pageMax: SEND_PAGE_MAX,
      record: notice ? await readNoticeRecord(env.DB, notice) : null,
      canSend: { resend: !!env.RESEND_API_KEY },
    })
  }

  if (pathname !== '/api/notices/send') return null

  if (request.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, { status: 405 })
  }
  if (!(await isAdmin())) {
    return respond({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request
    .json<NoticeRequestBody>()
    .catch(() => null as NoticeRequestBody | null)
  const content = readNoticeContent(body ?? {})
  if (typeof content === 'string') {
    return respond({ error: content }, { status: 400 })
  }

  // A send cannot be taken back, so the default is the harmless one:
  // anything other than a literal `false` is a rehearsal.
  const dryRun = body?.dryRun !== false
  // A test is one real email that leaves no trace: nothing logged, nothing
  // recorded, and marked as a test in the mail itself.
  const test = body?.test === true
  const only = typeof body?.only === 'string' ? body.only.trim() : ''
  if (test && !only) {
    return respond(
      { error: 'a test needs the one address to send it to' },
      { status: 400 },
    )
  }
  if (!dryRun && !env.RESEND_API_KEY) {
    return respond(
      { error: 'RESEND_API_KEY is unset — refusing to send' },
      { status: 503 },
    )
  }

  const hash = await noticeContentHash(content)
  const existing = await readNoticeRecord(env.DB, content.notice)
  const sameWording = existing === null || existing.contentHash === hash
  const real = !dryRun && !test
  if (real && !sameWording) {
    return respond(
      {
        error:
          'this notice has already gone out with different wording — send a correction under a new slug, so everyone under one slug holds the same text',
      },
      { status: 409 },
    )
  }

  const recipients = await listNoticeRecipients(env.DB, {
    // A test ignores the log: nothing it sends is logged, and the operator
    // must still be able to test after the real mailing has reached them.
    notice: test ? undefined : content.notice,
    only: only || undefined,
    limit: typeof body?.limit === 'number' ? body.limit : undefined,
  })

  // Written before the first copy goes rather than after, so the wording is
  // locked for the length of the page. Taken back below if nothing went.
  const now = new Date().toISOString()
  let wroteRecord = false
  if (real && recipients.length > 0 && existing === null) {
    const inserted = await env.DB.prepare(
      `INSERT OR IGNORE INTO accountNotices
         (notice, kind, subject, content, contentHash, firstSentAt, lastSentAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        content.notice,
        content.kind,
        content.subject,
        canonicalContent(content),
        hash,
        now,
        now,
      )
      .run()
    wroteRecord = (inserted.meta?.changes ?? 0) > 0
    if (!wroteRecord) {
      // Somebody else wrote it between the read and the insert. Theirs is
      // the wording of record, so ours has to match it.
      const theirs = await readNoticeRecord(env.DB, content.notice)
      if (theirs !== null && theirs.contentHash !== hash) {
        return respond(
          { error: 'this notice is already going out with different wording' },
          { status: 409 },
        )
      }
    }
  }

  let sent = 0
  let failed = 0
  let preview: { subject: string; html: string; text: string } | null = null

  for (const [index, person] of recipients.entries()) {
    const vars = {
      displayName: person.displayName,
      kind: content.kind,
      subject: content.subject,
      preheader: content.preheader,
      intro: content.intro,
      items: content.items,
      test,
    }

    if (dryRun) {
      preview ??= renderAccountNotice(vars)
      continue
    }

    const result = await sendAccountNotice(
      { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
      person.email,
      vars,
    )
    if (!result.ok) {
      failed += 1
      // The id, not the address: enough to find the account, and a log line
      // is not a place for a list of who was told about a breach.
      console.error(
        `[notice] ${content.notice} not accepted for ${person.userId}`,
      )
    } else {
      sent += 1
      if (!test) {
        // Logged only after the provider accepted it. A row written first
        // would, on a failure, mark somebody as told who never was -- and
        // the re-run would then skip them.
        await env.DB.prepare(
          `INSERT OR IGNORE INTO accountNoticeSends (notice, userId, sentAt, providerId)
                VALUES (?, ?, ?, ?)`,
        )
          .bind(
            content.notice,
            person.userId,
            new Date().toISOString(),
            result.id ?? null,
          )
          .run()
      }
    }

    if (index < recipients.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, SEND_GAP_MS))
    }
  }

  if (real) {
    if (sent > 0) {
      await env.DB.prepare(
        `UPDATE accountNotices SET lastSentAt = ? WHERE notice = ?`,
      )
        .bind(new Date().toISOString(), content.notice)
        .run()
    } else if (wroteRecord) {
      // The provider refused the whole first page. A record that says a
      // notice went out, with nobody it went to, would be a false one.
      await env.DB.prepare(
        `DELETE FROM accountNotices
          WHERE notice = ?
            AND NOT EXISTS (SELECT 1 FROM accountNoticeSends s WHERE s.notice = ?)`,
      )
        .bind(content.notice, content.notice)
        .run()
    }
  }

  // A dry run with nobody left to render for still owes the operator a look
  // at the mail, so it renders for nobody in particular.
  if (dryRun && preview === null) {
    preview = renderAccountNotice({
      displayName: null,
      kind: content.kind,
      subject: content.subject,
      preheader: content.preheader,
      intro: content.intro,
      items: content.items,
      test,
    })
  }

  const audience = test
    ? null
    : await countNoticeAudience(env.DB, content.notice)
  const remaining = audience?.willReceive ?? 0
  // Counted rather than inferred from a full page. Somebody the provider
  // refused is still owed the notice, and "the page was not full" would
  // have called the mailing finished with them left out.
  const morePossible =
    !only && (real ? remaining > 0 : remaining > recipients.length)

  return respond({
    notice: content.notice,
    dryRun,
    test,
    sent,
    failed,
    // Whether this wording matches what already went out under the slug.
    // A rehearsal reports it so the console can say so BEFORE anybody types
    // the word; a real send with a mismatch never gets this far.
    sameWording,
    // The console calls again while this is true, and stops by itself when
    // a whole page goes by with nobody accepted.
    morePossible,
    ...(audience ? { remaining } : {}),
    ...(preview ? { preview } : {}),
  })
}
