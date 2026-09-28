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
//                              taken back, unless the store already reversed
//                              it (a reversal delivered first: nothing is
//                              taken, nothing ends). Any other cancellation
//                              only stops the renewal; the period runs to
//                              its end
//   TRANSFER                   the entitlement moves to the account it names,
//                              and so do the songs of an anonymous identity:
//                              a singer who subscribed before signing in to an
//                              account they already had. A real account keeps
//                              its own credits: they may have been bought.
//   REFUND_REVERSED            Apple took back a refund it had granted (App
//                              Store only): the songs the refund took go back
//                              to their period, in full, and the entitlement
//                              runs to the period's end again. Never more than
//                              the refund took, so a second reversal of one
//                              refund gives back nothing. One that arrives
//                              before its refund gives back nothing either,
//                              and its row names the period, so the refund
//                              that follows takes nothing.
// Everything else is acknowledged without action.
//
// Every event names its store environment. Only the one this deployment is
// for (REVENUECAT_ENVIRONMENT: SANDBOX on dev, PRODUCTION on prod, and
// PRODUCTION when unset) changes anything; an event from the other, such as
// a TestFlight purchase reaching prod, is acknowledged and ignored. The one
// exception is switched on for a store review only: production applying
// sandbox events, for its own users and bounded, with a ledger reason and an
// entitlement source of their own (revenuecat-sandbox.ts, which says how it
// is switched on and off). A sandbox event there takes or moves only the
// songs of sandbox periods, and ends or moves only a sandbox entitlement; a
// paid event never takes a sandbox period's songs.
//
// Idempotent on the event id, as the Stripe webhook is on Stripe's: `rc:<id>`
// goes into billingEvents once the event is processed, and every ledger write
// carries a UNIQUE idempotency key derived from it, so a redelivery, or two
// deliveries at once, writes nothing twice. A grant computes its songs from
// the ledger as read, and its write lands only on that same ledger: if
// anything was written in between, it reads again (writeOnLedger).

import type { Env } from './auth'
import { timingSafeEqualStr } from './billing-core'
import { readLedger, writeOnLedger } from './ledger'
import type { SandboxWithheld } from './revenuecat-sandbox'
import { grantSandboxPeriod, SANDBOX_SOURCE, sandboxOnProduction, } from './revenuecat-sandbox'
import { periodGrant, periodsFor, refundReversal, refundReversedFirst, sandboxHeld, songAllowance, SONGS_ENTITLEMENT, SUBSCRIPTION_GRANT, SUBSCRIPTION_MOVED_IN, SUBSCRIPTION_REFUND, SUBSCRIPTION_REFUND_REVERSED, SUBSCRIPTION_SANDBOX_MOVED_IN, SUBSCRIPTION_SANDBOX_MOVED_OUT, subscriptionSongs, } from './songs-allowance'

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
  /** A sandbox period that gave no songs, and the bound that is why. */
  withheld?: SandboxWithheld
  moved?: number
  clawedBack?: number
  /** A refund whose reversal was delivered first: it took nothing. */
  reversedAlready?: boolean
  restored?: number
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

/** How this deployment takes an event from `environment`: as its own; as a
 *  sandbox event on production, while that is switched on
 *  (revenuecat-sandbox.ts); or not at all. */
function takes(env: Env, environment: string | null): 'own' | 'sandbox' | null {
  const own = deploymentEnvironment(env)
  if (environment === own) return 'own'
  return own === 'PRODUCTION' &&
    environment === 'SANDBOX' &&
    sandboxOnProduction(env)
    ? 'sandbox'
    : null
}

/** An entitlement's source: the product, and whether the sandbox sold it. */
function sourceOf(event: RevenueCatEvent, sandbox: boolean): string {
  return `${sandbox ? SANDBOX_SOURCE : 'revenuecat'}:${text(event.product_id) ?? 'unknown'}`
}

function isSandboxSource(source: string | null): boolean {
  return source?.startsWith(`${SANDBOX_SOURCE}:`) === true
}

/** In an entitlement update a sandbox event makes: its own kind only, so it
 *  never ends a paid subscription. */
function entitlementsFor(sandbox: boolean): string {
  return sandbox ? `AND source LIKE '${SANDBOX_SOURCE}:%'` : ''
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
 *  the latest period only, so without a transaction it is the latest. A
 *  refund the store reversed before it got here takes nothing
 *  (refundReversedFirst). A sandbox refund looks among sandbox periods only,
 *  and a paid one among paid periods (periodsFor). Returns the songs taken
 *  back, and whether it was reversed already. */
async function clawBack(
  env: Env,
  userId: string,
  event: RevenueCatEvent,
  sandbox: boolean,
): Promise<{ songs: number; reversed: boolean }> {
  const transaction = text(event.transaction_id)
  let reversed = false
  const taken = await writeOnLedger(
    env,
    userId,
    `rc:${String(event.id)}:clawback`,
    SUBSCRIPTION_REFUND,
    (ledger) => {
      const periods = periodsFor(
        subscriptionSongs(ledger.rows).periods,
        sandbox,
      )
      const period =
        periods.find(
          (entry) => transaction !== null && entry.transaction === transaction,
        ) ?? periods[periods.length - 1]
      reversed =
        period !== undefined && refundReversedFirst(ledger.rows, period.key)
      return {
        delta: reversed ? 0 : -(period?.left ?? 0),
        jobRef: period?.key ?? null,
      }
    },
  )
  return { songs: -taken, reversed }
}

/** A reversed refund: give back what the refund took from its period, less
 *  anything a reversal gave back already (songs-allowance.ts,
 *  refundReversal). In full, even past the rollover cap: they were the
 *  singer's before the refund, and the cap only limits what a period grants.
 *  Returns the songs given back. */
async function restoreRefund(
  env: Env,
  userId: string,
  event: RevenueCatEvent,
  sandbox: boolean,
): Promise<number> {
  return writeOnLedger(
    env,
    userId,
    `rc:${String(event.id)}:restore`,
    SUBSCRIPTION_REFUND_REVERSED,
    (ledger) => {
      const owed = refundReversal(
        ledger.rows,
        text(event.transaction_id),
        sandbox,
      )
      return { delta: owed.songs, jobRef: owed.period }
    },
  )
}

/** Move an anonymous identity's songs to the account, in one transaction:
 *  out of one, and exactly that many into the other. The subscription songs
 *  among them stay subscription songs there, for its cap to count, and the
 *  sandbox's stay the sandbox's; the rest arrive as the account's own
 *  credits. */
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
  const sandboxInKey = `rc:${eventId}:in-sandbox-songs:${fromId}`
  const songs = subscriptionSongs((await readLedger(env, fromId)).rows)
  const held = songs.held
  const sandboxSongs = sandboxHeld(songs.periods)
  const paidHeld = Math.max(0, held - sandboxSongs)
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
       SELECT ?, ?, ?, -MAX(0, COALESCE(SUM(delta), 0)), 'transfer-out', ?, ?
         FROM creditLedger WHERE userId = ?`,
    ).bind(crypto.randomUUID(), now, fromId, toId, outKey, fromId),
    env.DB.prepare(
      `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
       SELECT ?, ?, ?, MIN(?, -delta), ?, ?, ?
         FROM creditLedger WHERE idempotencyKey = ? AND ? > 0`,
    ).bind(
      crypto.randomUUID(),
      now,
      toId,
      sandboxSongs,
      SUBSCRIPTION_SANDBOX_MOVED_IN,
      fromId,
      sandboxInKey,
      outKey,
      sandboxSongs,
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
       SELECT ?, ?, ?, MIN(?, -delta - MIN(?, -delta)), ?, ?, ?
         FROM creditLedger WHERE idempotencyKey = ?`,
    ).bind(
      crypto.randomUUID(),
      now,
      toId,
      paidHeld,
      sandboxSongs,
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
    'SELECT COALESCE(SUM(delta), 0) AS moved FROM creditLedger WHERE idempotencyKey IN (?, ?, ?)',
  )
    .bind(inKey, songsInKey, sandboxInKey)
    .first<{ moved: number }>()
  return Number(row?.moved ?? 0)
}

/** A sandbox transfer moves the sandbox's songs only: out of the sandbox
 *  periods of one identity, and exactly that many into the other, still the
 *  sandbox's. Paid songs and credits stay where they are, for a paid
 *  transfer to move. The move out lands only on the ledger it was computed
 *  from (writeOnLedger), and the move in copies it, so a redelivery
 *  finishes a move that stopped between the two. */
async function moveSandboxSongs(
  env: Env,
  eventId: string,
  fromId: string,
  toId: string,
): Promise<number> {
  const outKey = `rc:${eventId}:out-sandbox-songs:${fromId}`
  const inKey = `rc:${eventId}:in-sandbox-songs:${fromId}`
  const out = await writeOnLedger(
    env,
    fromId,
    outKey,
    SUBSCRIPTION_SANDBOX_MOVED_OUT,
    (ledger) => {
      const songs = sandboxHeld(subscriptionSongs(ledger.rows).periods)
      return { delta: songs > 0 ? -songs : 0, jobRef: toId }
    },
  )
  const songs = -Number(out)
  if (songs <= 0) return 0
  await env.DB.prepare(
    `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
     SELECT ?, ?, ?, -delta, ?, ?, ?
       FROM creditLedger WHERE idempotencyKey = ?`,
  )
    .bind(
      crypto.randomUUID(),
      new Date().toISOString(),
      toId,
      SUBSCRIPTION_SANDBOX_MOVED_IN,
      fromId,
      inKey,
      outKey,
    )
    .run()
  return songs
}

async function transfer(
  env: Env,
  event: RevenueCatEvent,
  sandbox: boolean,
): Promise<Outcome> {
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
    // A sandbox transfer moves the sandbox's entitlement, never a paid one.
    if (held !== null && (!sandbox || isSandboxSource(held.source))) {
      await upsertEntitlement(env, to.id, held.source, held.expiresAt)
      await env.DB.prepare(
        'DELETE FROM entitlements WHERE userId = ? AND feature = ?',
      )
        .bind(from.id, SONGS_ENTITLEMENT)
        .run()
    }
    if (from.authProvider === 'anonymous') {
      moved += sandbox
        ? await moveSandboxSongs(env, eventId, from.id, to.id)
        : await moveSongs(env, eventId, from.id, to.id)
    }
  }
  return { moved }
}

async function applyEvent(
  env: Env,
  event: RevenueCatEvent,
  type: string,
  sandbox: boolean,
): Promise<Outcome> {
  if (type === 'TRANSFER') return transfer(env, event, sandbox)
  const refund =
    type === 'CANCELLATION' && text(event.cancel_reason) === 'CUSTOMER_SUPPORT'
  if (
    type !== 'INITIAL_PURCHASE' &&
    type !== 'RENEWAL' &&
    type !== 'EXPIRATION' &&
    type !== 'REFUND_REVERSED' &&
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
          AND (expiresAt IS NULL OR expiresAt <= ?) ${entitlementsFor(sandbox)}`,
    )
      .bind(ended, now, user.id, SONGS_ENTITLEMENT, ended)
      .run()
    return {}
  }

  if (refund) {
    const back = await clawBack(env, user.id, event, sandbox)
    if (back.reversed) return { clawedBack: 0, reversedAlready: true }
    // The refunded period is over now, whatever it would have run to.
    const now = new Date().toISOString()
    await env.DB.prepare(
      `UPDATE entitlements SET expiresAt = ?, updatedAt = ?
        WHERE userId = ? AND feature = ?
          AND (expiresAt IS NULL OR expiresAt > ?) ${entitlementsFor(sandbox)}`,
    )
      .bind(now, now, user.id, SONGS_ENTITLEMENT, now)
      .run()
    return { clawedBack: back.songs }
  }

  if (type === 'REFUND_REVERSED') {
    const restored = await restoreRefund(env, user.id, event, sandbox)
    // The period runs to its end again. Without an end in the event, the
    // entitlement is left as the refund left it: an open-ended one would
    // outlast the period it restores.
    const end = periodEnd(event)
    if (end !== null) {
      await upsertEntitlement(env, user.id, sourceOf(event, sandbox), end)
    }
    return { restored }
  }

  await upsertEntitlement(
    env,
    user.id,
    sourceOf(event, sandbox),
    periodEnd(event),
  )
  if (!sandbox) return { granted: await grantPeriod(env, user.id, event) }
  const grant = await grantSandboxPeriod(
    env,
    user.id,
    `rc:${String(event.id)}`,
    text(event.transaction_id) ?? text(event.product_id),
  )
  return grant.withheld === undefined
    ? { granted: grant.granted }
    : { granted: grant.granted, withheld: grant.withheld }
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

  const taken = takes(env, text(event.environment))
  const sandbox = taken === 'sandbox'
  const outcome: Outcome =
    taken === null
      ? { ignored: 'another store environment' }
      : await applyEvent(env, event, type, sandbox)
  await env.DB.prepare(
    'INSERT OR IGNORE INTO billingEvents (id, createdAt, type) VALUES (?, ?, ?)',
  )
    .bind(
      eventKey,
      new Date().toISOString(),
      `${sandbox ? SANDBOX_SOURCE : 'revenuecat'}:${type}`,
    )
    .run()
  if (outcome.ignored !== undefined) {
    console.info(
      `[billing] revenuecat ${eventId} (${type}): ${outcome.ignored}`,
    )
  }
  return respond({
    received: true,
    ...(sandbox ? { sandbox: true } : {}),
    ...outcome,
  })
}
