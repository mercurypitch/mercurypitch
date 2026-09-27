// ── RevenueCat webhook: the Karaoke subscription (plan S8, Stage 2) ──
//
// POST /api/billing/revenuecat. RevenueCat posts every subscription event
// here, with the Authorization header set in its dashboard; the header must
// equal REVENUECAT_WEBHOOK_AUTH. While that secret is unset the route answers
// 501: the subscription is not live, and nothing may grant songs.
//
// The app gives RevenueCat the server's own user id as its App User ID (plan
// S7 §3.9), so an event names our user directly. When the app user id is
// RevenueCat's own anonymous one, the aliases are tried. An event for a user
// this database does not know (another environment's, say) is acknowledged
// and changes nothing.
//
// Handled, as plan S8 §6.7 lists them:
//   INITIAL_PURCHASE, RENEWAL  the entitlement, and one period's songs, rolled
//                              over to the cap, which counts subscription
//                              songs only (songs-allowance.ts)
//   EXPIRATION                 the entitlement ends; the songs left stay.
//                              An expiration before the stored end is an
//                              older period's, late, and changes nothing
//   CANCELLATION, when its     a refund, which RevenueCat reports for the
//   cancel_reason is           latest period only: the entitlement ends now,
//   CUSTOMER_SUPPORT           and what is left of that period's songs is
//                              taken back. Any other cancellation only stops
//                              the renewal; the period runs to its end
//   TRANSFER                   the entitlement moves to the account it names,
//                              and so do the songs of an anonymous identity:
//                              a singer who subscribed before signing in to an
//                              account they already had. A real account keeps
//                              its own credits: they may have been bought.
// Everything else is acknowledged without action.
//
// Every event names its store environment. Only the one this deployment is
// for (REVENUECAT_ENVIRONMENT: SANDBOX on dev, PRODUCTION on prod, and
// PRODUCTION when unset) changes anything; an event from the other, such as
// a TestFlight purchase reaching prod, is acknowledged and ignored.
//
// Idempotent on the event id, as the Stripe webhook is on Stripe's: `rc:<id>`
// goes into billingEvents once the event is processed, and every ledger write
// carries a UNIQUE idempotency key derived from it, so a redelivery, or two
// deliveries at once, writes nothing twice. A grant computes its songs from
// the ledger as read, and its write lands only on that same ledger: if
// anything was written in between, it reads again (writeOnLedger).

import type { Env } from './auth'
import { timingSafeEqualStr } from './billing-core'
import type { LedgerRow } from './songs-allowance'
import { periodGrant, songAllowance, SONGS_ENTITLEMENT, SUBSCRIPTION_GRANT, SUBSCRIPTION_MOVED_IN, SUBSCRIPTION_REFUND, subscriptionSongs, } from './songs-allowance'

type Respond = (body: object | null, init?: ResponseInit) => Response

/** The fields of a RevenueCat event this worker reads. */
interface RevenueCatEvent {
  id?: unknown
  type?: unknown
  app_user_id?: unknown
  original_app_user_id?: unknown
  aliases?: unknown
  cancel_reason?: unknown
  product_id?: unknown
  transaction_id?: unknown
  entitlement_ids?: unknown
  environment?: unknown
  expiration_at_ms?: unknown
  transferred_from?: unknown
  transferred_to?: unknown
}

interface Outcome {
  ignored?: string
  granted?: number
  moved?: number
  clawedBack?: number
}

const RC_ANONYMOUS_PREFIX = '$RCAnonymousID:'

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/** The ids an event may name our user by, in the order they are tried. */
function candidates(event: RevenueCatEvent): string[] {
  const ids = [
    text(event.app_user_id),
    ...strings(event.aliases),
    text(event.original_app_user_id),
  ]
  return [
    ...new Set(
      ids.filter(
        (id): id is string =>
          id !== null && !id.startsWith(RC_ANONYMOUS_PREFIX),
      ),
    ),
  ]
}

interface KnownUser {
  id: string
  authProvider: string | null
}

async function findUser(env: Env, id: string): Promise<KnownUser | null> {
  return env.DB.prepare('SELECT id, authProvider FROM users WHERE id = ?')
    .bind(id)
    .first<KnownUser>()
}

async function firstKnownUser(
  env: Env,
  ids: readonly string[],
): Promise<KnownUser | null> {
  for (const id of ids) {
    const user = await findUser(env, id)
    if (user !== null) return user
  }
  return null
}

/** In an upsert: the incoming end is at or after the stored one. */
const LATER_END = `(excluded.expiresAt IS NULL OR (entitlements.expiresAt IS NOT NULL AND excluded.expiresAt >= entitlements.expiresAt))`

/** The store environment this deployment grants for. Anything but an
 *  explicit SANDBOX is PRODUCTION, so a deployment nobody configured never
 *  grants songs for a test purchase. */
function deploymentEnvironment(env: Env): 'SANDBOX' | 'PRODUCTION' {
  return env.REVENUECAT_ENVIRONMENT?.trim().toUpperCase() === 'SANDBOX'
    ? 'SANDBOX'
    : 'PRODUCTION'
}

function unlocksSongs(event: RevenueCatEvent): boolean {
  return strings(event.entitlement_ids).includes(SONGS_ENTITLEMENT)
}

function periodEnd(event: RevenueCatEvent): string | null {
  return typeof event.expiration_at_ms === 'number' &&
    Number.isFinite(event.expiration_at_ms)
    ? new Date(event.expiration_at_ms).toISOString()
    : null
}

/** The entitlement until `expiresAt`, never shorter than it already is.
 *  RevenueCat retries a failed delivery, so an older period's event can
 *  arrive after a newer one (review S3): the later end wins, and with it the
 *  product that set it. No end at all (null) is the latest there is. */
async function upsertEntitlement(
  env: Env,
  userId: string,
  source: string | null,
  expiresAt: string | null,
): Promise<void> {
  const now = new Date().toISOString()
  await env.DB.prepare(
    `INSERT INTO entitlements (id, createdAt, updatedAt, userId, feature, source, expiresAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(userId, feature) DO UPDATE SET
       updatedAt = excluded.updatedAt,
       source    = CASE WHEN ${LATER_END} THEN excluded.source ELSE entitlements.source END,
       expiresAt = CASE WHEN ${LATER_END} THEN excluded.expiresAt ELSE entitlements.expiresAt END`,
  )
    .bind(
      crypto.randomUUID(),
      now,
      now,
      userId,
      SONGS_ENTITLEMENT,
      source,
      expiresAt,
    )
    .run()
}

interface Ledger {
  rows: LedgerRow[]
  /** What a write checks the ledger still is: its rows, its last row and its
   *  balance. */
  version: string
}

/** The same fingerprint as Ledger.version, taken by the write itself. */
const LEDGER_VERSION = `(SELECT COUNT(*) || ':' || COALESCE(MAX(rowid), 0) || ':' || COALESCE(SUM(delta), 0)
    FROM creditLedger WHERE userId = ?)`

/** Reads before a write that loses to a concurrent one, before giving up
 *  and letting RevenueCat deliver the event again. */
const LEDGER_ATTEMPTS = 5

async function readLedger(env: Env, userId: string): Promise<Ledger> {
  const { results } = await env.DB.prepare(
    `SELECT rowid AS seq, delta, reason, jobRef, idempotencyKey
       FROM creditLedger WHERE userId = ? ORDER BY rowid`,
  )
    .bind(userId)
    .all<LedgerRow & { seq: number }>()
  const balance = results.reduce((sum, row) => sum + Number(row.delta), 0)
  const last = results.length === 0 ? 0 : results[results.length - 1].seq
  return { rows: results, version: `${results.length}:${last}:${balance}` }
}

/** Write the row `key` names, as `rowFor` computes it from the ledger as
 *  read, only if the ledger is still what was read; else read it again.
 *  Returns the row's delta, also when an earlier delivery wrote it. */
async function writeOnLedger(
  env: Env,
  userId: string,
  key: string,
  reason: string,
  rowFor: (ledger: Ledger) => { delta: number; jobRef: string | null },
): Promise<number> {
  for (let attempt = 0; attempt < LEDGER_ATTEMPTS; attempt += 1) {
    const ledger = await readLedger(env, userId)
    const { delta, jobRef } = rowFor(ledger)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
       SELECT ?, ?, ?, ?, ?, ?, ?
        WHERE ${LEDGER_VERSION} = ?`,
    )
      .bind(
        crypto.randomUUID(),
        new Date().toISOString(),
        userId,
        delta,
        reason,
        jobRef,
        key,
        userId,
        ledger.version,
      )
      .run()
    const row = await env.DB.prepare(
      'SELECT delta FROM creditLedger WHERE idempotencyKey = ?',
    )
      .bind(key)
      .first<{ delta: number }>()
    if (row !== null) return row.delta
  }
  throw new Error(`${key}: the ledger kept changing under the write`)
}

/** One period's songs, topping the subscription's songs up to the cap.
 *  Bought, promo and testing credits never count (owner, 28 Sep). The row
 *  names the store transaction the period was bought in, which a refund
 *  names too. A zero grant still writes its row: the row is the claim that
 *  makes a redelivery a no-op. */
async function grantPeriod(
  env: Env,
  userId: string,
  event: RevenueCatEvent,
): Promise<number> {
  const allowance = songAllowance(env)
  return writeOnLedger(
    env,
    userId,
    `rc:${String(event.id)}`,
    SUBSCRIPTION_GRANT,
    (ledger) => ({
      delta: periodGrant(subscriptionSongs(ledger.rows).held, allowance),
      jobRef: text(event.transaction_id) ?? text(event.product_id),
    }),
  )
}

/** A refund: take back what is left of the refunded period's songs, the
 *  period the event's transaction names. RevenueCat reports a refund for
 *  the latest period only, so without a transaction it is the latest.
 *  Returns the songs taken back. */
async function clawBack(
  env: Env,
  userId: string,
  event: RevenueCatEvent,
): Promise<number> {
  const transaction = text(event.transaction_id)
  const taken = await writeOnLedger(
    env,
    userId,
    `rc:${String(event.id)}:clawback`,
    SUBSCRIPTION_REFUND,
    (ledger) => {
      const { periods } = subscriptionSongs(ledger.rows)
      const period =
        periods.find(
          (entry) => transaction !== null && entry.transaction === transaction,
        ) ?? periods[periods.length - 1]
      return { delta: -(period?.left ?? 0), jobRef: period?.key ?? null }
    },
  )
  return -taken
}

/** Move an anonymous identity's songs to the account, in one transaction:
 *  out of one, and exactly that many into the other. The subscription songs
 *  among them stay subscription songs there, for its cap to count; the rest
 *  arrive as the account's own credits. */
async function moveSongs(
  env: Env,
  eventId: string,
  fromId: string,
  toId: string,
): Promise<number> {
  const now = new Date().toISOString()
  const outKey = `rc:${eventId}:out:${fromId}`
  const inKey = `rc:${eventId}:in:${fromId}`
  const songsInKey = `rc:${eventId}:in-songs:${fromId}`
  const held = subscriptionSongs((await readLedger(env, fromId)).rows).held
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
       SELECT ?, ?, ?, -MAX(0, COALESCE(SUM(delta), 0)), 'transfer-out', ?, ?
         FROM creditLedger WHERE userId = ?`,
    ).bind(crypto.randomUUID(), now, fromId, toId, outKey, fromId),
    env.DB.prepare(
      `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
       SELECT ?, ?, ?, MIN(?, -delta), ?, ?, ?
         FROM creditLedger WHERE idempotencyKey = ?`,
    ).bind(
      crypto.randomUUID(),
      now,
      toId,
      held,
      SUBSCRIPTION_MOVED_IN,
      fromId,
      songsInKey,
      outKey,
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
       SELECT ?, ?, ?, -delta - MIN(?, -delta), 'transfer-in', ?, ?
         FROM creditLedger WHERE idempotencyKey = ?`,
    ).bind(crypto.randomUUID(), now, toId, held, fromId, inKey, outKey),
  ])
  const row = await env.DB.prepare(
    'SELECT COALESCE(SUM(delta), 0) AS moved FROM creditLedger WHERE idempotencyKey IN (?, ?)',
  )
    .bind(inKey, songsInKey)
    .first<{ moved: number }>()
  return Number(row?.moved ?? 0)
}

async function transfer(env: Env, event: RevenueCatEvent): Promise<Outcome> {
  const eventId = String(event.id)
  const to = await firstKnownUser(env, strings(event.transferred_to))
  if (to === null) return { ignored: 'unknown user' }

  let moved = 0
  for (const fromId of strings(event.transferred_from)) {
    const from = await findUser(env, fromId)
    if (from === null || from.id === to.id) continue
    const held = await env.DB.prepare(
      'SELECT source, expiresAt FROM entitlements WHERE userId = ? AND feature = ?',
    )
      .bind(from.id, SONGS_ENTITLEMENT)
      .first<{ source: string | null; expiresAt: string | null }>()
    if (held !== null) {
      await upsertEntitlement(env, to.id, held.source, held.expiresAt)
      await env.DB.prepare(
        'DELETE FROM entitlements WHERE userId = ? AND feature = ?',
      )
        .bind(from.id, SONGS_ENTITLEMENT)
        .run()
    }
    if (from.authProvider === 'anonymous') {
      moved += await moveSongs(env, eventId, from.id, to.id)
    }
  }
  return { moved }
}

async function applyEvent(
  env: Env,
  event: RevenueCatEvent,
  type: string,
): Promise<Outcome> {
  if (type === 'TRANSFER') return transfer(env, event)
  const refund =
    type === 'CANCELLATION' && text(event.cancel_reason) === 'CUSTOMER_SUPPORT'
  if (
    type !== 'INITIAL_PURCHASE' &&
    type !== 'RENEWAL' &&
    type !== 'EXPIRATION' &&
    !refund
  ) {
    return { ignored: type }
  }
  if (!unlocksSongs(event)) return { ignored: 'another entitlement' }
  const user = await firstKnownUser(env, candidates(event))
  if (user === null) return { ignored: 'unknown user' }

  if (type === 'EXPIRATION') {
    // Only an expiration at or after the stored end is about the current
    // period. An earlier one is an older period's, delivered late (review S3),
    // and must not end the subscription that has since renewed.
    const now = new Date().toISOString()
    const ended = periodEnd(event) ?? now
    await env.DB.prepare(
      `UPDATE entitlements SET expiresAt = ?, updatedAt = ?
        WHERE userId = ? AND feature = ?
          AND (expiresAt IS NULL OR expiresAt <= ?)`,
    )
      .bind(ended, now, user.id, SONGS_ENTITLEMENT, ended)
      .run()
    return {}
  }

  if (refund) {
    // The refunded period is over now, whatever it would have run to.
    const now = new Date().toISOString()
    await env.DB.prepare(
      `UPDATE entitlements SET expiresAt = ?, updatedAt = ?
        WHERE userId = ? AND feature = ?
          AND (expiresAt IS NULL OR expiresAt > ?)`,
    )
      .bind(now, now, user.id, SONGS_ENTITLEMENT, now)
      .run()
    return { clawedBack: await clawBack(env, user.id, event) }
  }

  const productId = text(event.product_id)
  await upsertEntitlement(
    env,
    user.id,
    `revenuecat:${productId ?? 'unknown'}`,
    periodEnd(event),
  )
  return { granted: await grantPeriod(env, user.id, event) }
}

export async function handleRevenueCatWebhook(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const expected = env.REVENUECAT_WEBHOOK_AUTH
  if (expected == null || expected === '') {
    return respond({ error: 'RevenueCat is not configured' }, { status: 501 })
  }
  const given = request.headers.get('Authorization') ?? ''
  if (!timingSafeEqualStr(given, expected)) {
    return respond({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { event?: RevenueCatEvent } | null
  try {
    body = await request.json<{ event?: RevenueCatEvent } | null>()
  } catch {
    return respond({ error: 'Invalid payload' }, { status: 400 })
  }
  const event = body?.event
  const eventId = text(event?.id)
  const type = text(event?.type)
  if (event === undefined || eventId === null || type === null) {
    return respond({ error: 'Missing event id' }, { status: 400 })
  }

  const eventKey = `rc:${eventId}`
  const seen = await env.DB.prepare('SELECT id FROM billingEvents WHERE id = ?')
    .bind(eventKey)
    .first<{ id: string }>()
  if (seen !== null) return respond({ received: true, duplicate: true })

  const outcome: Outcome =
    text(event.environment) === deploymentEnvironment(env)
      ? await applyEvent(env, event, type)
      : { ignored: 'another store environment' }
  await env.DB.prepare(
    'INSERT OR IGNORE INTO billingEvents (id, createdAt, type) VALUES (?, ?, ?)',
  )
    .bind(eventKey, new Date().toISOString(), `revenuecat:${type}`)
    .run()
  if (outcome.ignored !== undefined) {
    console.info(
      `[billing] revenuecat ${eventId} (${type}): ${outcome.ignored}`,
    )
  }
  return respond({ received: true, ...outcome })
}
