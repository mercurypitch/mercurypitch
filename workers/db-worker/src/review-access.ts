// ── Play review access: a few songs for the store's reviewer ──
//
// Google Play's reviewers cannot buy anything, and may not create accounts or
// bring their own: they follow what Play Console's "App access" field says.
// That field carries a code, the Android app's Settings takes it, and this
// route grants a small, bounded number of songs for it. Once per account, and
// never a subscription or an entitlement.
//
//   POST /api/billing/review-access  { code }   auth; an anonymous identity is enough
//
//   501  REVIEW_ACCESS_CODE_SHA256 is unset: nothing to check a code against
//   403  not the Android app, or not the code
//   429  past the account's or the address's tries (auth.ts RATE_LIMITS)
//   409  every account the deployment allows has had its songs
//   200  { granted, left }; asked again, { granted: 0, already: true, left }
//
// The code never enters the repository. `node packages/purchase-kit/scripts/
// make-review-code.ts mercurypitch` issues one with its digest: the code goes
// to the vault and to Play Console, the digest to this Worker's secret. The
// route hashes exactly what that script hashes (purchase-kit's
// reviewUnlockDigestInput), so a code it issues is one this takes, typed in
// any case, with or without the dashes.
//
// Android only. An iOS app unlocks what it sells through in-app purchase and
// nothing else (App Store guideline 3.1.1), and Apple's reviewers can buy in
// the sandbox. The app shows the field on Android alone, and the route refuses
// every other origin as well; the code is what stands in front of the songs.
//
// Bounded three ways: the songs per grant (REVIEW_ACCESS_SONGS, 1 to 5,
// default 3), one grant per account (a UNIQUE ledger key), and the accounts
// ever granted (REVIEW_ACCESS_ACCOUNTS, default 20). Every grant is counted
// in reviewAccessGrants (migration 0051), a record that names no account and
// that deleting one does not touch: counting the ledger's rows instead let a
// deleted account's slot be taken again (review of PR 882, finding 3). The
// bound is checked, and the grant and its record written, in one batch. A
// leaked code is worth that much at most, and a new digest retires it.
//
// The songs are the app's to spend, after the subscription's, and the
// rollover cap never counts them (songs-allowance.ts, REVIEW_ACCESS). They
// are credits in the ledger, so the web counts them in the balance too, and
// spends them only once its own credits run out.

import { reviewUnlockDigestInput } from '../../../packages/purchase-kit/src/review-unlock'
import { readAppSongs } from './app-songs'
import type { Env } from './auth'
import { checkRateLimit, getAuth, timingSafeEqual } from './auth'
import { REVIEW_ACCESS } from './songs-allowance'

type Respond = (body: object | null, init?: ResponseInit) => Response

/** The app id the codes are issued under: make-review-code.ts's argument. */
export const REVIEW_APP_ID = 'mercurypitch'

/** The Android app's page, as Capacitor serves it (androidScheme https). */
const ANDROID_APP_ORIGIN = 'https://localhost'

export const REVIEW_ACCESS_DEFAULTS = Object.freeze({ songs: 3, accounts: 20 })
/** However the setting reads, a grant stays small. */
const MOST_SONGS = 5

const DIGEST = /^[0-9a-f]{64}$/u

/** A whole number above zero from config, else undefined. */
function positive(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : undefined
}

export function reviewAccessLimits(env: Env): {
  songs: number
  accounts: number
} {
  return {
    songs: Math.min(
      MOST_SONGS,
      positive(env.REVIEW_ACCESS_SONGS) ?? REVIEW_ACCESS_DEFAULTS.songs,
    ),
    accounts:
      positive(env.REVIEW_ACCESS_ACCOUNTS) ?? REVIEW_ACCESS_DEFAULTS.accounts,
  }
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  )
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Whether `code`, as typed, is the one whose digest is `expected`. */
export async function isReviewCode(
  code: string,
  expected: string,
): Promise<boolean> {
  const digest = await sha256Hex(reviewUnlockDigestInput(REVIEW_APP_ID, code))
  return timingSafeEqual(digest, expected)
}

function tooMany(respond: Respond, retryAfter: number | undefined): Response {
  const after = retryAfter ?? 60
  return respond(
    { error: `Too many tries. Try again in ${after} seconds.` },
    { status: 429, headers: { 'Retry-After': String(after) } },
  )
}

export async function handleReviewAccess(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const expected = env.REVIEW_ACCESS_CODE_SHA256?.trim().toLowerCase() ?? ''
  if (!DIGEST.test(expected)) {
    return respond(
      { error: 'Review access is not configured' },
      { status: 501 },
    )
  }
  if (request.headers.get('Origin') !== ANDROID_APP_ORIGIN) {
    return respond(
      { error: 'Review access is for the Android app' },
      { status: 403 },
    )
  }
  const auth = await getAuth(request, env)
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })

  // Before the code is looked at, so a wrong one costs a try.
  const account = await checkRateLimit(
    env.DB,
    `user:${auth.userId}`,
    'review-access',
  )
  if (!account.allowed) return tooMany(respond, account.retryAfter)
  const address = await checkRateLimit(
    env.DB,
    request.headers.get('CF-Connecting-IP') ?? '127.0.0.1',
    'review-access-ip',
  )
  if (!address.allowed) return tooMany(respond, address.retryAfter)

  const body = await request.json<{ code?: unknown } | null>().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code : ''
  if (code.trim() === '' || !(await isReviewCode(code, expected))) {
    return respond({ error: 'That code is not right.' }, { status: 403 })
  }

  const { songs, accounts } = reviewAccessLimits(env)
  const key = `${REVIEW_ACCESS}:${auth.userId}`
  const id = crypto.randomUUID()
  const now = Date.now()
  // One batch, one transaction: the account's one grant, only while fewer
  // grants than the limit were ever made, and the record that counts it.
  // The UNIQUE key makes a second grant to one account, or a race with
  // itself, write nothing, and then the record has no new row to count.
  const [written] = await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
       SELECT ?, ?, ?, ?, ?, NULL, ?
        WHERE (SELECT COUNT(*) FROM reviewAccessGrants) < ?`,
    ).bind(
      id,
      new Date(now).toISOString(),
      auth.userId,
      songs,
      REVIEW_ACCESS,
      key,
      accounts,
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO reviewAccessGrants (grantId, createdAt)
       SELECT id, createdAt FROM creditLedger WHERE id = ?`,
    ).bind(id),
  ])
  const { left } = await readAppSongs(env, auth.userId, now)
  if ((written?.meta.changes ?? 0) > 0) {
    return respond({ granted: songs, left })
  }

  const earlier = await env.DB.prepare(
    'SELECT id FROM creditLedger WHERE idempotencyKey = ?',
  )
    .bind(key)
    .first<{ id: string }>()
  if (earlier !== null) {
    return respond({ granted: 0, already: true, left })
  }
  console.warn(
    `[billing] review access: the ${accounts}-account limit is reached`,
  )
  return respond({ error: 'Review access is used up' }, { status: 409 })
}
