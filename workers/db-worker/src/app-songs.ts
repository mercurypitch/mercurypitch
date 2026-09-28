// ── The songs the native app spends (owner, 28 Sep: plan S7 D9 and D5) ──
//
// Credits bought on the web are not spendable in the native app in V1. A
// request the app makes sees and spends the Karaoke subscription's songs,
// and a signed-in singer's one free song a month (songs-allowance.ts). The
// web keeps seeing and spending the whole balance, exactly as before.
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
// app can spend.
//
// The app's debit spends only what the app can, so it is computed from the
// ledger as read and written only on that same ledger (ledger.ts): a
// separation, a grant or a web debit written in between makes it read again.
// The subscription songs it spends are the ones the ledger walk says the
// debit took, because the walk spends them first, and the write is only made
// while they cover it. The month's free song goes first, as it does not
// carry over: its claim is written in the same transaction as the debit, and
// only if the debit was.

import type { Env } from './auth'
import { uvrDebitKey } from './billing-core'
import type { Ledger } from './ledger'
import { LEDGER_ATTEMPTS, LEDGER_VERSION, readLedger } from './ledger'
import type { AppSongs } from './songs-allowance'
import { appSongs, FREE_SONG, FREE_SONG_BACK } from './songs-allowance'
import { CAPACITOR_ORIGINS } from './turnstile'

export type Spender = 'web' | 'app'

/** Who is spending: the native app, by its origin or the main worker's word
 *  for it (`said`), else the web. */
export function spenderOf(request: Request, said?: unknown): Spender {
  const origin = request.headers.get('Origin')
  if (origin !== null && CAPACITOR_ORIGINS.includes(origin)) return 'app'
  return said === 'app' ? 'app' : 'web'
}

/** Whether the singer gets the month's free song: signed in (an anonymous
 *  identity gets none), and the free song not switched off. `provider` is
 *  the token's, as the promo codes read it. */
function getsFreeSong(env: Env, provider: string): boolean {
  return (
    provider !== 'anonymous' &&
    env.FREE_MONTHLY_SONG?.trim().toLowerCase() !== 'off'
  )
}

export interface AppLedger extends AppSongs {
  ledger: Ledger
}

/** The songs the app can spend, and the ledger they were read from. */
export async function readAppSongs(
  env: Env,
  userId: string,
  provider: string,
  nowMs: number,
): Promise<AppLedger> {
  const ledger = await readLedger(env, userId)
  return {
    ...appSongs(ledger.rows, userId, nowMs, getsFreeSong(env, provider)),
    ledger,
  }
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
  provider: string,
  jobRef: string,
  cost: number,
): Promise<AppDebit> {
  const key = uvrDebitKey(jobRef)
  for (let attempt = 0; attempt < LEDGER_ATTEMPTS; attempt += 1) {
    const nowMs = Date.now()
    const songs = await readAppSongs(env, userId, provider, nowMs)
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
    if (fromSongs > songs.held) return { outcome: 'short', left: songs.left }

    const id = crypto.randomUUID()
    const createdAt = new Date(nowMs).toISOString()
    const writes = [
      env.DB.prepare(
        `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
         SELECT ?, ?, ?, ?, 'uvr-job', ?, ?
          WHERE ${LEDGER_VERSION} = ?`,
      ).bind(
        id,
        createdAt,
        userId,
        0 - fromSongs,
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
  throw new Error(`${key}: the ledger kept changing under the app's debit`)
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
