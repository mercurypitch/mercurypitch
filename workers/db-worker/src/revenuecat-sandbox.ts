// ── RevenueCat sandbox events on production, bounded (store review) ──
//
// App Review buys in the store's sandbox, as TestFlight testers and Play's
// license testers do: every such purchase reaches RevenueCat as a SANDBOX
// event. A production deployment grants only for PRODUCTION events
// (revenuecat.ts), so a reviewer who subscribes in a build under review would
// get no songs, and the review would fail on it.
//
// While a store build is in review, production may apply sandbox events too:
// only for users that exist on it (an event naming anyone else is acknowledged
// and changes nothing, as ever), and bounded:
//   - one sandbox period grant a UTC day per account: the sandbox renews a
//     subscription every few minutes, and each renewal after the day's grant
//     gives no songs;
//   - a budget of songs a UTC day across the deployment
//     (REVENUECAT_SANDBOX_DAILY_SONGS, default 200), checked in the same batch
//     that writes a grant; past it, a grant gives none and says so in the log;
//   - the rollover cap, as for any period (songs-allowance.ts).
// A grant is written as SUBSCRIPTION_SANDBOX, and the entitlement's source is
// `revenuecat-sandbox:<product>`, so a report can tell them from paid ones.
// Refunds, reversals, expiration and transfer work as they do for paid
// periods, except that a sandbox event only ever takes or moves the songs of
// sandbox periods, only ever ends or moves a sandbox entitlement, and never
// takes over a live paid one (revenuecat.ts, KEEPS_PAID); a paid event never
// takes a sandbox period's songs (songs-allowance.ts, periodsFor).
//
// The switch is REVENUECAT_SANDBOX_ON_PRODUCTION=bounded on the production
// Worker (the word `bounded`, case and surrounding spaces ignored).
// wrangler.jsonc leaves it unset, which is the behaviour without this file;
// on a SANDBOX deployment it changes nothing. Turned on for a review, in this
// order (docs/plans/mobile-native/store-review-purchases.md):
//   1. the production Worker runs a release that has this file and
//      migration 0052, and the tag's "Deploy DB Worker" run has finished;
//   2. `pnpm exec wrangler secret put REVENUECAT_SANDBOX_ON_PRODUCTION
//      --config workers/db-worker/wrangler.jsonc --env prod`, value `bounded`;
//   3. RevenueCat's production webhook sends "Production and Sandbox" events;
//   4. the build goes to review.
// Off after the review: the webhook back to production events only, then
// `wrangler secret delete REVENUECAT_SANDBOX_ON_PRODUCTION` with the same
// flags. The switch goes on before the webhook changes because an event the
// Worker ignores is recorded as handled, and nothing brings it back.

import type { Env } from './auth'
import { LEDGER_ATTEMPTS, LEDGER_VERSION, LedgerBusy, readLedger, } from './ledger'
import type { LedgerRow } from './songs-allowance'
import { periodGrant, songAllowance, SUBSCRIPTION_SANDBOX, subscriptionSongs, } from './songs-allowance'

/** The word REVENUECAT_SANDBOX_ON_PRODUCTION turns it on with, case and
 *  surrounding spaces ignored. */
export const SANDBOX_SWITCH = 'bounded'

export const SANDBOX_DAILY_SONGS_DEFAULT = 200

/** The entitlement source a sandbox period writes, before `:<product>`. */
export const SANDBOX_SOURCE = 'revenuecat-sandbox'

/** Whether this deployment takes sandbox events on production: the word
 *  `bounded`, case and surrounding spaces ignored (a secret piped in can end
 *  in a newline). Anything else, or nothing, leaves it off. */
export function sandboxOnProduction(
  env: Pick<Env, 'REVENUECAT_SANDBOX_ON_PRODUCTION'>,
): boolean {
  return (
    env.REVENUECAT_SANDBOX_ON_PRODUCTION?.trim().toLowerCase() ===
    SANDBOX_SWITCH
  )
}

/** A budget config may be: plain decimal digits, up to four of them. */
const DAILY_SONGS_CONFIG = /^[0-9]{1,4}$/

/** The day's budget of sandbox songs: from config, a plain number of up to
 *  four digits, zero included, spaces around it ignored (a secret piped in
 *  can end in a newline). Anything else is a mistake: it says so in the log,
 *  and the budget is the default. Unset, it is the default. */
export function sandboxDailySongs(
  env: Pick<Env, 'REVENUECAT_SANDBOX_DAILY_SONGS'>,
): number {
  const value = env.REVENUECAT_SANDBOX_DAILY_SONGS
  if (value === undefined) return SANDBOX_DAILY_SONGS_DEFAULT
  const digits = value.trim()
  if (DAILY_SONGS_CONFIG.test(digits)) return Number(digits)
  console.warn(
    `[billing] revenuecat sandbox: REVENUECAT_SANDBOX_DAILY_SONGS is not a number of up to four digits; the budget is ${SANDBOX_DAILY_SONGS_DEFAULT}`,
  )
  return SANDBOX_DAILY_SONGS_DEFAULT
}

/** The UTC day a moment falls on: `YYYY-MM-DD`. */
export function sandboxDay(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10)
}

/** Whether a sandbox grant gave this account songs on `day` already. */
export function sandboxGrantedOn(
  rows: readonly LedgerRow[],
  day: string,
): boolean {
  return rows.some(
    (row) =>
      row.reason === SUBSCRIPTION_SANDBOX &&
      Number(row.delta) > 0 &&
      row.createdAt?.slice(0, 10) === day,
  )
}

/** Why a sandbox period gave no songs, when a bound is why. */
export type SandboxWithheld = 'one a day' | 'daily budget'

export interface SandboxGrant {
  granted: number
  withheld?: SandboxWithheld
}

async function sandboxSongsOn(env: Env, day: string): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT COALESCE(SUM(songs), 0) AS songs FROM revenuecatSandboxGrants WHERE day = ?',
  )
    .bind(day)
    .first<{ songs: number }>()
  return Number(row?.songs ?? 0)
}

/** A sandbox period's songs: what a paid period's would be (periodGrant,
 *  with its cap), unless the account had its grant today, or the day's
 *  budget would run out. Then it writes a row of none, which still records
 *  the period for a refund to name. Like writeOnLedger, the row lands only on
 *  the ledger it was computed from; and it lands, with the record the budget
 *  counts, in one batch, only while the budget holds. */
export async function grantSandboxPeriod(
  env: Env,
  userId: string,
  key: string,
  jobRef: string | null,
  nowMs: number = Date.now(),
): Promise<SandboxGrant> {
  const allowance = songAllowance(env)
  const budget = sandboxDailySongs(env)
  const day = sandboxDay(nowMs)
  const createdAt = new Date(nowMs).toISOString()
  let withheld: SandboxWithheld | undefined
  for (let attempt = 0; attempt < LEDGER_ATTEMPTS; attempt += 1) {
    const ledger = await readLedger(env, userId)
    const topUp = periodGrant(subscriptionSongs(ledger.rows).held, allowance)
    if (
      withheld === undefined &&
      topUp > 0 &&
      sandboxGrantedOn(ledger.rows, day)
    ) {
      withheld = 'one a day'
      console.info(
        `[billing] revenuecat sandbox: ${key} is the account's second grant today, and gives no songs`,
      )
    }
    const songs = withheld === undefined ? topUp : 0
    const id = crypto.randomUUID()
    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
         SELECT ?, ?, ?, ?, ?, ?, ?
          WHERE ${LEDGER_VERSION} = ?
            AND (? = 0 OR (SELECT COALESCE(SUM(songs), 0) FROM revenuecatSandboxGrants WHERE day = ?) + ? <= ?)`,
      ).bind(
        id,
        createdAt,
        userId,
        songs,
        SUBSCRIPTION_SANDBOX,
        jobRef,
        key,
        userId,
        ledger.version,
        songs,
        day,
        songs,
        budget,
      ),
      env.DB.prepare(
        `INSERT OR IGNORE INTO revenuecatSandboxGrants (grantId, day, songs, createdAt)
         SELECT id, ?, delta, createdAt FROM creditLedger WHERE id = ? AND delta > 0`,
      ).bind(day, id),
    ])
    const row = await env.DB.prepare(
      'SELECT delta FROM creditLedger WHERE idempotencyKey = ?',
    )
      .bind(key)
      .first<{ delta: number }>()
    if (row !== null) {
      const granted = Number(row.delta)
      return granted === 0 && withheld !== undefined
        ? { granted, withheld }
        : { granted }
    }
    // Not written: the ledger changed under it, or the day's budget ran out.
    if (songs > 0 && (await sandboxSongsOn(env, day)) + songs > budget) {
      withheld = 'daily budget'
      console.warn(
        `[billing] revenuecat sandbox: today's ${budget} songs are given; ${key} gives none`,
      )
    }
  }
  throw new LedgerBusy(`${key}: the ledger kept changing under the write`)
}
