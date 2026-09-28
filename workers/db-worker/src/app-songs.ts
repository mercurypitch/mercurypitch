// ── The songs the native app spends (owner, 28 Sep: plan S7 D9 and D5) ──
//
// Credits bought on the web are not spendable in the native app in V1. A
// request the app makes sees and spends the Karaoke subscription's songs,
// and the one free song a month of a signed-in singer without the
// subscription (songs-allowance.ts). The web keeps seeing and spending the
// whole balance, its own credits first.
//
// Which requests are the app's is the server's call, from two signals. The
// app is a page on capacitor://localhost (iOS) or https://localhost
// (Android), and a WebView never lets a page send another origin, so the
// app cannot leave its origin out. The main worker spends on the app's
// behalf from a server with no origin, and says so in the body
// (`from: 'app'`). Both are trusted only to narrow: the app's songs are part
// of the balance, and the free song is the account's to spend from the app
// in any case. A request with neither signal spends the whole balance,
// which is what the web already can; nothing a request says widens what the
// app can spend. Whether the account gets the free song is the account's
// own record, never its token's: an anonymous identity that adds a passkey
// signs in with the provider "passkey" and is still anonymous.
//
// The app's debit spends only what the app can, so it is computed from the
// ledger as read and written only on that same ledger (ledger.ts): a
// separation, a grant or a web debit written in between makes it read again.
// Its row says it is the app's (APP_SEPARATION), and the ledger walk spends
// such a debit from the subscription's songs, then review access's; the
// write is only made while they cover it. The month's free song goes first,
// as it does not carry over: its claim is written in the same transaction as
// the debit, and only if the debit was. A ledger that keeps changing is
// answered with "try again" (LedgerBusy), and the main worker does, once.

import type { Env } from './auth'
import { uvrDebitKey } from './billing-core'
import type { Ledger } from './ledger'
import { LEDGER_ATTEMPTS, LEDGER_VERSION, LedgerBusy, readLedger, } from './ledger'
import type { AppSongs } from './songs-allowance'
import { APP_SEPARATION, appSongs, FREE_SONG, FREE_SONG_BACK, getsFreeSong, isSubscribed, SONGS_ENTITLEMENT, } from './songs-allowance'
import { CAPACITOR_ORIGINS } from './turnstile'

export type Spender = 'web' | 'app'

/** Who is spending: the native app, by its origin or the main worker's word
 *  for it (`said`), else the web. */
export function spenderOf(request: Request, said?: unknown): Spender {
  const origin = request.headers.get('Origin')
  if (origin !== null && CAPACITOR_ORIGINS.includes(origin)) return 'app'
  return said === 'app' ? 'app' : 'web'
}

/** Whether the account gets the month's free song now (getsFreeSong):
 *  read from the account and its subscription, unless the free song is
 *  switched off. */
async function freeSongDue(
  env: Env,
  userId: string,
  nowMs: number,
): Promise<boolean> {
  if (env.FREE_MONTHLY_SONG?.trim().toLowerCase() === 'off') return false
  const account = await env.DB.prepare(
    `SELECT u.authProvider, u.email, u.emailVerified,
            e.userId IS NOT NULL AS cloud, e.expiresAt AS cloudEndsAt
       FROM users u
       LEFT JOIN entitlements e ON e.userId = u.id AND e.feature = ?
      WHERE u.id = ?`,
  )
    .bind(SONGS_ENTITLEMENT, userId)
    .first<{
      authProvider: string
      email: string | null
      emailVerified: number
      cloud: number
      cloudEndsAt: string | null
    }>()
  if (account === null) return false
  return getsFreeSong({
    authProvider: account.authProvider,
    email: account.email,
    emailVerified: Number(account.emailVerified),
    subscribed: isSubscribed(
      Number(account.cloud) === 1 ? { expiresAt: account.cloudEndsAt } : null,
      nowMs,
    ),
  })
}

export interface AppLedger extends AppSongs {
  ledger: Ledger
}

/** The songs the app can spend, and the ledger they were read from. */
export async function readAppSongs(
  env: Env,
  userId: string,
  nowMs: number,
): Promise<AppLedger> {
  const [ledger, monthly] = await Promise.all([
    readLedger(env, userId),
    freeSongDue(env, userId, nowMs),
  ])
  return { ...appSongs(ledger.rows, userId, nowMs, monthly), ledger }
}

export type AppDebit =
  /** Written: `free` of the songs were the month's free song. */
  | { outcome: 'debited'; free: number; left: number }
  /** This job was debited already: `songs` is what it took then. */
  | { outcome: 'duplicate'; songs: number; left: number }
  /** The app's songs do not cover it. Nothing was written. */
  | { outcome: 'short'; left: number }

/** Debit a separation's `cost` from the songs the app can spend, the month's
 *  free song first. Idempotent per job: a retried debit is reported, never
 *  written twice, and never refused for the songs it already took. */
export async function debitAppSongs(
  env: Env,
  userId: string,
  jobRef: string,
  cost: number,
): Promise<AppDebit> {
  const key = uvrDebitKey(jobRef)
  for (let attempt = 0; attempt < LEDGER_ATTEMPTS; attempt += 1) {
    const nowMs = Date.now()
    const songs = await readAppSongs(env, userId, nowMs)
    const { rows, version } = songs.ledger
    const earlier = rows.find((row) => row.idempotencyKey === key)
    if (earlier !== undefined) {
      const freeClaim = rows.some(
        (row) => row.reason === FREE_SONG && row.jobRef === jobRef,
      )
      return {
        outcome: 'duplicate',
        songs: -Number(earlier.delta) + (freeClaim ? 1 : 0),
        left: songs.left,
      }
    }
    const free = Math.min(songs.free, cost)
    const fromSongs = cost - free
    if (fromSongs > songs.held + songs.review) {
      return { outcome: 'short', left: songs.left }
    }

    const id = crypto.randomUUID()
    const createdAt = new Date(nowMs).toISOString()
    const writes = [
      env.DB.prepare(
        `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
         SELECT ?, ?, ?, ?, ?, ?, ?
          WHERE ${LEDGER_VERSION} = ?`,
      ).bind(
        id,
        createdAt,
        userId,
        0 - fromSongs,
        APP_SEPARATION,
        jobRef,
        key,
        userId,
        version,
      ),
    ]
    if (free > 0) {
      // A plain INSERT: were the month's claim somehow taken already, the
      // transaction fails and the debit with it, rather than the job
      // running on a free song it did not get.
      writes.push(
        env.DB.prepare(
          `INSERT INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
           SELECT ?, ?, ?, 0, ?, ?, ?
            WHERE EXISTS (SELECT 1 FROM creditLedger WHERE id = ?)`,
        ).bind(
          crypto.randomUUID(),
          createdAt,
          userId,
          FREE_SONG,
          jobRef,
          songs.freeKey,
          id,
        ),
      )
    }
    await env.DB.batch(writes)
    const written = await env.DB.prepare(
      'SELECT id FROM creditLedger WHERE idempotencyKey = ?',
    )
      .bind(key)
      .first<{ id: string }>()
    if (written?.id === id) {
      return { outcome: 'debited', free, left: songs.left - cost }
    }
  }
  throw new LedgerBusy(`${key}: the ledger kept changing under the app's debit`)
}

/** Give the month's free song back when the separation it paid for failed:
 *  a row of no credits, once per job. A job it did not pay for writes
 *  nothing. Returns whether this call gave it back. */
export async function giveFreeSongBack(
  env: Env,
  userId: string,
  jobRef: string,
): Promise<boolean> {
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
     SELECT ?, ?, userId, 0, ?, jobRef, ?
       FROM creditLedger WHERE userId = ? AND reason = ? AND jobRef = ?
      LIMIT 1`,
  )
    .bind(
      crypto.randomUUID(),
      new Date().toISOString(),
      FREE_SONG_BACK,
      `${FREE_SONG_BACK}:${jobRef}`,
      userId,
      FREE_SONG,
      jobRef,
    )
    .run()
  return result.meta.changes > 0
}
