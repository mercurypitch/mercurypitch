// ============================================================
// Fresh confirm links — one more confirm link for accounts that never confirmed
// ============================================================
//
// GET  /api/confirm-reminders/audience   counts, never addresses
// POST /api/confirm-reminders/send       a dry run unless dryRun is literally false
//
// The newsletter and the account notices leave an unconfirmed address alone,
// and for a good reason: some of those addresses were typed by somebody else,
// and a stranger's complaint costs the sending domain its reputation. This
// door mails exactly those addresses. It is only acceptable as ONE short,
// transactional mail per account, with nothing to sell in it, and with a
// promise it keeps: "ignore this and we won't write to this address again".
// Every rule here follows from that.
//
// - **One per account, ever.** Any row in confirmReminderSends, under any
//   campaign, takes the account out for good (migration 0056). The claim is
//   one INSERT ... SELECT that re-checks the account as it writes, so two
//   pages running at once cannot mail anybody twice.
// - **Written before it goes.** The ledger row comes first. A send the
//   provider refuses takes the row and its unsent link back out, so a refused
//   address is still owed its link and the account is left as it was.
// - **A lost answer is asked again, word for word.** When Resend does not
//   answer at all, the same request goes once more under the same
//   idempotency key (campaign + account), and Resend answers it with the
//   first send if that one went out. Only an identical request gets that:
//   a different body under a used key is refused with a 409, which is why
//   the retry happens here, with the link already in it, and not on a later
//   page with a new one.
// - **A window.** At least 24 hours since the account's newest confirm link
//   (so it has expired), at most 90 days (older addresses bounce more, and
//   bounces cost reputation). A hand-picked selection skips the floor, so
//   somebody who writes in today can be helped today.
// - **The worker sends.** The Resend key is a worker secret and the address
//   list never leaves D1. The console that drives this gets back counts.
// - **Nothing sends on its own.** No cron, no queue, no trigger.
//
// When an account "signed up": users.createdAt is NOT it. Registering on a
// device that already had an anonymous identity upgrades that identity in
// place and keeps its createdAt, which can be months older than the sign-up.
// The newest confirm link minted for the account is the closest record D1
// has, so that is the clock here, with createdAt as the fallback for an
// account with no link on record. The mail's "You signed up on" date reads
// the same clock.
//
// Dispatched from index.ts, which owns the admin policy. Who a link reaches,
// and the ledger, are confirm-reminder-audience.ts. The mail itself is
// renderFreshLinkEmail in email-welcome.ts.

import type { Env } from './auth'
import { fallbackAppOrigin, mailOrigins, mintEmailVerification } from './auth'
import type { SendWindow, Target, TargetScope, } from './confirm-reminder-audience'
import { campaignHistory, campaignStats, claimAccount, countReminderAudience, countTargets, listTargets, readWindow, skippedFromSelection, } from './confirm-reminder-audience'
import type { RenderedEmail, ResendResult } from './email'
import { resendPost } from './email'
import type { MailOrigins } from './email-layout'
import { SAMPLE_VOICEPRINT } from './email-preview'
import { renderFreshLinkEmail } from './email-welcome'
import type { SignupVoiceprint } from './signup-hint'
import { readAccountVoiceprint } from './signup-hint'

type Respond = (body: object | null, init?: ResponseInit) => Response

/** Same page and gap as the notices: a Worker invocation does not get for
 *  ever, and Resend allows two requests a second. The console calls again
 *  until nobody is left. */
export const SEND_PAGE_MAX = 25
const SEND_GAP_MS = 600
/** The most account ids one request may name. */
export const SELECTION_MAX = 100
/** How long a fresh link works. The sign-up link keeps its 24 hours. */
export const FRESH_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── The mail ─────────────────────────────────────────────────────────

/** Where the mail's links go: the confirm link to this worker's public
 *  host, everything else to this environment's app. */
interface MailLinks {
  apiOrigin: string
  origins: MailOrigins
}

/** The public origin, never the host the request came in on: the console
 *  calls through the Access-gated studio host (see Env.PUBLIC_API_ORIGIN). */
function publicApiOrigin(request: Request, env: Env): string {
  const configured = (env.PUBLIC_API_ORIGIN ?? '').trim()
  if (configured !== '') {
    try {
      return new URL(configured).origin
    } catch {
      /* a malformed var falls back to the request, which tests can see */
    }
  }
  return new URL(request.url).origin
}

function mailLinks(request: Request, env: Env): MailLinks {
  return {
    apiOrigin: publicApiOrigin(request, env),
    origins: mailOrigins(fallbackAppOrigin(env), env),
  }
}

function verifyUrl(links: MailLinks, token: string): string {
  return (
    `${links.apiOrigin}/api/auth/verify-email` +
    `?token=${encodeURIComponent(token)}&returnTo=${encodeURIComponent(links.origins.appOrigin)}`
  )
}

export function idempotencyKey(campaign: string, userId: string): string {
  return `fresh-link-${campaign}-${userId}`
}

function renderFor(
  links: MailLinks,
  token: string,
  voiceprint: SignupVoiceprint | null,
  signedUpAt: string,
): RenderedEmail {
  return renderFreshLinkEmail({
    ...links.origins,
    verifyUrl: verifyUrl(links, token),
    voiceprint,
    ttlHours: FRESH_LINK_TTL_MS / HOUR_MS,
    signedUpAt,
  })
}

/** Which copy a sample shows: R1 without a voiceprint, R2 with the sample
 *  singer. A sample reads no account at all. */
type Variant = 'plain' | 'voiceprint'

function renderSample(
  links: MailLinks,
  token: string,
  variant: Variant,
  now: number,
): RenderedEmail {
  return renderFor(
    links,
    token,
    variant === 'voiceprint' ? SAMPLE_VOICEPRINT : null,
    new Date(now - 10 * DAY_MS).toISOString(),
  )
}

// ── One account ──────────────────────────────────────────────────────

type Outcome = 'sent' | 'failed' | 'skipped'

async function remindOne(
  env: Env,
  links: MailLinks,
  campaign: string,
  target: Target,
): Promise<Outcome> {
  // The claim, written before anything goes. Refused means somebody else got
  // there first, or the account changed since the page was read.
  if (!(await claimAccount(env.DB, campaign, target))) return 'skipped'

  let minted: { token: string; tokenHash: string } | null = null
  let delivered = false
  try {
    minted = await mintEmailVerification(
      env.DB,
      target.userId,
      target.email,
      FRESH_LINK_TTL_MS,
    )
    // The account's own newest twin, read here, never a hint: the mail says
    // only what the account already holds about itself.
    const voiceprint = await readAccountVoiceprint(env.DB, target.userId).catch(
      () => null,
    )
    const mail = renderFor(links, minted.token, voiceprint, target.signedUpAt)
    const post = (): Promise<ResendResult> =>
      resendPost(
        { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
        target.email,
        mail,
        { idempotencyKey: idempotencyKey(campaign, target.userId) },
      )
    let result = await post()
    if (result.unanswered === true) {
      // Asked again word for word, after the usual gap (see the header).
      await new Promise((resolve) => setTimeout(resolve, SEND_GAP_MS))
      result = await post()
    }
    delivered = result.ok
    if (delivered) {
      await env.DB.prepare(
        `UPDATE confirmReminderSends SET resendId = ? WHERE campaign = ? AND userId = ?`,
      )
        .bind(result.id ?? null, campaign, target.userId)
        .run()
      // The fresh link supersedes every older one, now that it has gone.
      await env.DB.prepare(
        `DELETE FROM emailVerifications WHERE userId = ? AND tokenHash <> ?`,
      )
        .bind(target.userId, minted.tokenHash)
        .run()
    }
  } catch (err) {
    // The id, not the address: enough to find the account.
    console.error(
      `[fresh-link] ${campaign} went wrong for ${target.userId}: ${String(err)}`,
    )
  }
  if (delivered) return 'sent'

  // Not sent. Take back the claim and the unsent link, so the account is as
  // it was and still owed its link next time.
  try {
    await env.DB.prepare(
      `DELETE FROM confirmReminderSends WHERE campaign = ? AND userId = ?`,
    )
      .bind(campaign, target.userId)
      .run()
    if (minted !== null) {
      await env.DB.prepare(`DELETE FROM emailVerifications WHERE tokenHash = ?`)
        .bind(minted.tokenHash)
        .run()
    }
  } catch (err) {
    console.error(
      `[fresh-link] ${campaign} could not take back ${target.userId}: ${String(err)}`,
    )
  }
  console.error(`[fresh-link] ${campaign} not accepted for ${target.userId}`)
  return 'failed'
}

// ── Routes ───────────────────────────────────────────────────────────

const AUDIENCE_PATH = '/api/confirm-reminders/audience'
const SEND_PATH = '/api/confirm-reminders/send'

interface SendBody {
  campaign?: unknown
  dryRun?: unknown
  test?: unknown
  only?: unknown
  userIds?: unknown
  minAgeHours?: unknown
  maxAgeDays?: unknown
  limit?: unknown
  variant?: unknown
}

/** A selection, or null for everyone, or what is wrong with it. Ids only:
 *  an address in a selection is refused, not looked up. */
export function readSelection(raw: unknown): string[] | null | string {
  if (raw === undefined || raw === null) return null
  if (!Array.isArray(raw)) return 'userIds must be a list of account ids'
  if (raw.length === 0) return 'the selection is empty'
  if (raw.length > SELECTION_MAX) {
    return `a selection is at most ${SELECTION_MAX} accounts`
  }
  const ids = new Set<string>()
  for (const id of raw) {
    if (typeof id !== 'string' || !UUID_RE.test(id)) {
      return 'userIds must be account ids, never addresses'
    }
    // As given: an id is compared exactly, and a device id may be uppercase.
    ids.add(id)
  }
  return [...ids]
}

const SLUG_ERROR = 'campaign must be lowercase letters, digits and dashes'

/** What a send asked for, read and checked. */
interface SendRequest {
  campaign: string
  window: SendWindow
  selection: string[] | null
  /** A sample's copy, or null for the account's own. */
  variant: Variant | null
  /** A send cannot be taken back, so the default is the harmless one:
   *  anything other than a literal `false` is a rehearsal. */
  dryRun: boolean
  /** One real mail to the operator that leaves no trace: sample data, a
   *  link that leads nowhere, no claim, no token. */
  test: boolean
  /** Where a test goes. */
  only: string
  limit: number
}

/** At most a page, at least one account. */
function readLimit(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw)
    ? Math.min(Math.max(Math.round(raw), 1), SEND_PAGE_MAX)
    : SEND_PAGE_MAX
}

/** The send, or what is wrong with it. */
function readSendRequest(body: SendBody): SendRequest | string {
  const campaign = typeof body.campaign === 'string' ? body.campaign.trim() : ''
  if (!campaign)
    return 'campaign is required (a slug, e.g. "fresh-link-2026-10")'
  if (!SLUG_RE.test(campaign)) return SLUG_ERROR
  const window = readWindow(body)
  if (typeof window === 'string') return window
  const selection = readSelection(body.userIds)
  if (typeof selection === 'string') return selection
  const variant = body.variant ?? null
  if (variant !== null && variant !== 'plain' && variant !== 'voiceprint') {
    return 'variant must be "plain" or "voiceprint"'
  }
  const test = body.test === true
  const only = typeof body.only === 'string' ? body.only.trim() : ''
  if (test && !EMAIL_RE.test(only)) {
    return 'a test needs the one address to send it to'
  }
  return {
    campaign,
    window,
    selection,
    variant,
    dryRun: body.dryRun !== false,
    test,
    only,
    limit: readLimit(body.limit),
  }
}

/** Counts, and no addresses. The console needs to know how many; nothing
 *  outside this worker needs to know who. */
async function handleAudience(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const params = new URL(request.url).searchParams
  const campaign = params.get('campaign') ?? ''
  if (campaign && !SLUG_RE.test(campaign)) {
    return respond({ error: SLUG_ERROR }, { status: 400 })
  }
  const window = readWindow({
    minAgeHours: params.get('minAgeHours') ?? undefined,
    maxAgeDays: params.get('maxAgeDays') ?? undefined,
  })
  if (typeof window === 'string') {
    return respond({ error: window }, { status: 400 })
  }
  const stats = campaign ? await campaignStats(env.DB, campaign) : null
  return respond({
    campaign: campaign || null,
    window,
    ...(await countReminderAudience(env.DB, window)),
    sentThisCampaign: stats?.sent ?? 0,
    confirmedAfter: stats?.confirmedAfter ?? 0,
    pageMax: SEND_PAGE_MAX,
    selectionMax: SELECTION_MAX,
    canSend: { resend: !!env.RESEND_API_KEY },
    history: await campaignHistory(env.DB),
  })
}

/** What a send would do, and the mail the first account would get, with a
 *  link that confirms nothing. Or a sample, when asked or when there is
 *  nobody to render for. */
async function rehearse(
  env: Env,
  links: MailLinks,
  send: SendRequest,
): Promise<object> {
  const now = Date.now()
  const { selection, window, variant } = send
  const scope: TargetScope = { selection, window, now }
  const first =
    variant === null ? (await listTargets(env.DB, scope, 1))[0] : undefined
  const preview =
    first === undefined
      ? renderSample(links, 'preview', variant ?? 'plain', now)
      : renderFor(
          links,
          'preview',
          await readAccountVoiceprint(env.DB, first.userId).catch(() => null),
          first.signedUpAt,
        )
  const wouldReach = await countTargets(env.DB, scope)
  return {
    campaign: send.campaign,
    dryRun: true,
    test: send.test,
    window,
    selected: selection?.length ?? null,
    wouldReach,
    skippedBy:
      selection === null
        ? null
        : await skippedFromSelection(env.DB, selection, window, now),
    sent: 0,
    failed: 0,
    remaining: wouldReach,
    morePossible: false,
    previewFor: first === undefined ? 'sample' : 'account',
    preview,
  }
}

/** One copy to the operator. Only to somebody with an account whose address
 *  they confirmed, as the notices' test: an admin route must not mail an
 *  address of its choosing. */
async function sendTestCopy(
  env: Env,
  links: MailLinks,
  send: SendRequest,
): Promise<object> {
  const holder = await env.DB.prepare(
    `SELECT 1 AS ok FROM users
      WHERE lower(email) = lower(?) AND emailVerified = 1 AND authProvider <> 'anonymous'`,
  )
    .bind(send.only)
    .first<{ ok: number }>()
  let sent = 0
  let failed = 0
  if (holder !== null) {
    const rendered = renderSample(
      links,
      'test-copy',
      send.variant ?? 'plain',
      Date.now(),
    )
    const result = await resendPost(
      { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
      send.only,
      { ...rendered, subject: `[TEST] ${rendered.subject}` },
    )
    if (result.ok) sent = 1
    else failed = 1
  }
  return { campaign: send.campaign, dryRun: false, test: true, sent, failed }
}

/** One page of the real thing, oldest sign-up first, with the gap after
 *  every account that went to Resend. */
async function sendPage(
  env: Env,
  links: MailLinks,
  send: SendRequest,
): Promise<object> {
  const { selection, window } = send
  const scope: TargetScope = { selection, window, now: Date.now() }
  const targets = await listTargets(env.DB, scope, send.limit)
  const tally: Record<Outcome, number> = { sent: 0, failed: 0, skipped: 0 }
  for (const [index, target] of targets.entries()) {
    const outcome = await remindOne(env, links, send.campaign, target)
    tally[outcome] += 1
    if (outcome !== 'skipped' && index < targets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, SEND_GAP_MS))
    }
  }
  const remaining = await countTargets(env.DB, { ...scope, now: Date.now() })
  return {
    campaign: send.campaign,
    dryRun: false,
    test: false,
    ...tally,
    remaining,
    // The console calls again while this is true, and stops by itself when
    // a whole page goes by with nobody accepted.
    morePossible: remaining > 0,
  }
}

async function handleSend(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const body =
    (await request.json<SendBody>().catch(() => null as SendBody | null)) ?? {}
  const send = readSendRequest(body)
  if (typeof send === 'string') {
    return respond({ error: send }, { status: 400 })
  }
  if (!send.dryRun && !env.RESEND_API_KEY) {
    return respond(
      {
        error: 'RESEND_API_KEY is unset on this worker, so nothing can be sent',
      },
      { status: 503 },
    )
  }
  const links = mailLinks(request, env)
  if (send.dryRun) return respond(await rehearse(env, links, send))
  if (send.test) return respond(await sendTestCopy(env, links, send))
  return respond(await sendPage(env, links, send))
}

export async function handleConfirmReminderRoute(
  request: Request,
  env: Env,
  pathname: string,
  respond: Respond,
  /** Resolved by index.ts. Required rather than defaulted: a route that
   *  mails accounts must not be able to open itself by someone forgetting
   *  an argument. */
  isAdmin: () => Promise<boolean>,
): Promise<Response | null> {
  if (pathname !== AUDIENCE_PATH && pathname !== SEND_PATH) return null
  const audience = pathname === AUDIENCE_PATH
  if (request.method !== (audience ? 'GET' : 'POST')) {
    return respond({ error: 'Method not allowed' }, { status: 405 })
  }
  if (!(await isAdmin())) {
    return respond({ error: 'Forbidden' }, { status: 403 })
  }
  return audience
    ? handleAudience(request, env, respond)
    : handleSend(request, env, respond)
}
