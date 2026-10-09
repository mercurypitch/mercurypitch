// ============================================================
// funnel-retention — the cron's deletes for funnel and rate-limit data
// ============================================================
//
// Privacy plan section 4: the funnel tables, the rate-limit counters and the
// promo codes' email records were kept forever. Each cron tick (every 6
// hours) now applies four periods:
//
//   funnelAcquisition.gclid         cleared after RETENTION_CLICK_ID_DAYS (90);
//                                   the row and its campaign labels stay
//   mirrorEvents, funnelAcquisition deleted after RETENTION_FUNNEL_MONTHS (13)
//   auth_ratelimit                  deleted after RETENTION_RATE_LIMIT_DAYS (2)
//   promoEmailClaims                deleted RETENTION_PROMO_EMAIL_DAYS (30)
//                                   after their code's expiresAt; a code
//                                   with no expiresAt, or one that does not
//                                   parse, never closes and keeps them
//
// The defaults and the parsing live in src/lib/retention-periods.ts, shared
// with the browser, which applies the same periods to the ids it holds
// (src/lib/funnel.ts, src/lib/acquisition.ts). The lawyer sets the final
// numbers (Q2); each is a var in wrangler.jsonc, set in every env block. A
// value that is not a whole number of at least 1 means the default, so a typo
// never deletes more than the notice says.
//
// Dates: mirrorEvents and funnelAcquisition hold createdAt as ISO text from
// toISOString(), which sorts as it reads, so the cutoff is compared as ISO
// text too. auth_ratelimit.windowStart is epoch milliseconds.
// promoCodes.expiresAt is checked here rather than compared as text: only
// the one shape the admin API writes (promo-rules.ts isInstant) counts, so a
// seeded or hand-edited row in another reads as "not closed", never as
// "closed long ago".
//
// Bounded: each rule deletes (or updates) at most batchRows rows per
// statement and runs at most maxBatches statements per tick, oldest first.
// A first run over a backlog drains over several ticks instead of one long
// statement. Migration 0063 indexes the three date columns so each batch
// reads only the rows it removes; promoEmailClaims needs none, as its key
// leads with promoCodeId. One rule failing is logged and the others
// still run.

import { DEFAULT_CLICK_ID_DAYS, DEFAULT_FUNNEL_MONTHS, DEFAULT_PROMO_EMAIL_DAYS, DEFAULT_RATE_LIMIT_DAYS, MAX_PERIOD_DAYS, MAX_PERIOD_MONTHS, daysBefore, monthsBefore, parsePeriod, } from '../../../src/lib/retention-periods'
import { LONGEST_RATE_LIMIT_WINDOW_MS } from './auth'
import type { Env } from './auth'
import { isInstant } from './promo-rules'

export type RetentionEnv = Pick<
  Env,
  | 'RETENTION_CLICK_ID_DAYS'
  | 'RETENTION_FUNNEL_MONTHS'
  | 'RETENTION_RATE_LIMIT_DAYS'
  | 'RETENTION_PROMO_EMAIL_DAYS'
>

export interface RetentionConfig {
  /** Days a Google click id is kept on its acquisition row. */
  clickIdDays: number
  /** Calendar months a funnel event or acquisition row is kept. */
  funnelMonths: number
  /** Days a rate-limit row is kept after its window started. */
  rateLimitDays: number
  /** Days a promo code's email records are kept after the code closes. */
  promoEmailDays: number
}

/** The periods from the env, and a line for each var that was set to
 *  something unusable (logged by the cron). */
export function retentionConfig(env: RetentionEnv): {
  config: RetentionConfig
  problems: string[]
} {
  const problems: string[] = []
  const read = (
    name: keyof RetentionEnv,
    fallback: number,
    max: number,
  ): number => {
    const parsed = parsePeriod(env[name], fallback, max)
    if (parsed.problem !== null) problems.push(`${name}: ${parsed.problem}`)
    return parsed.value
  }
  return {
    config: {
      clickIdDays: read(
        'RETENTION_CLICK_ID_DAYS',
        DEFAULT_CLICK_ID_DAYS,
        MAX_PERIOD_DAYS,
      ),
      funnelMonths: read(
        'RETENTION_FUNNEL_MONTHS',
        DEFAULT_FUNNEL_MONTHS,
        MAX_PERIOD_MONTHS,
      ),
      rateLimitDays: read(
        'RETENTION_RATE_LIMIT_DAYS',
        DEFAULT_RATE_LIMIT_DAYS,
        MAX_PERIOD_DAYS,
      ),
      promoEmailDays: read(
        'RETENTION_PROMO_EMAIL_DAYS',
        DEFAULT_PROMO_EMAIL_DAYS,
        MAX_PERIOD_DAYS,
      ),
    },
    problems,
  }
}

export interface RetentionCutoffs {
  /** A gclid on a row created before this (ISO) is cleared. */
  clickIdBefore: string
  /** Funnel rows created before this (ISO) are deleted. */
  funnelBefore: string
  /** Rate-limit rows whose window started before this (epoch ms) go. */
  rateLimitBefore: number
  /** A promo code that closed before this (epoch ms) loses its email
   *  records. */
  promoClosedBefore: number
}

/**
 * The moments each rule deletes before. A row exactly on a cutoff stays.
 *
 * The rate-limit cutoff is never later than the longest rate-limit window
 * allows: a row inside its window is a live counter, and deleting it would
 * reset a limit early. With today's longest window of one day and periods
 * of whole days this never binds; it guards a future longer window.
 */
export function retentionCutoffs(
  config: RetentionConfig,
  nowMs: number,
): RetentionCutoffs {
  return {
    clickIdBefore: new Date(
      daysBefore(nowMs, config.clickIdDays),
    ).toISOString(),
    funnelBefore: new Date(
      monthsBefore(nowMs, config.funnelMonths),
    ).toISOString(),
    rateLimitBefore: Math.min(
      daysBefore(nowMs, config.rateLimitDays),
      nowMs - LONGEST_RATE_LIMIT_WINDOW_MS,
    ),
    promoClosedBefore: daysBefore(nowMs, config.promoEmailDays),
  }
}

/** The promo codes whose expiresAt parses and is before `closedBefore`. */
async function closedPromoCodes(
  db: D1Database,
  closedBefore: number,
): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT id, expiresAt FROM promoCodes WHERE expiresAt IS NOT NULL')
    .all<{ id: string; expiresAt: string }>()
  return results
    .filter((row) => {
      // Only the one shape the admin API writes; Date.parse alone reads
      // "some time in 2025" as a date.
      if (!isInstant(row.expiresAt)) return false
      return Date.parse(row.expiresAt) < closedBefore
    })
    .map((row) => row.id)
}

export interface SweepLimits {
  /** Rows one statement may change. */
  batchRows: number
  /** Statements one rule may run per tick. */
  maxBatches: number
}

/** 5,000 rows per rule per tick, as the plan proposes (4.3), in statements
 *  of 1,000. Four ticks a day drain 20,000 per rule. */
export const DEFAULT_SWEEP_LIMITS: SweepLimits = {
  batchRows: 1_000,
  maxBatches: 5,
}

export interface SweepResult {
  clickIdsCleared: number
  mirrorEventsDeleted: number
  acquisitionsDeleted: number
  rateLimitsDeleted: number
  promoEmailsDeleted: number
  /** True when no rule hit its cap, so nothing past a cutoff is left. */
  drained: boolean
  /** Rules that threw, by name. */
  failed: string[]
}

type RuleName =
  | 'acquisitions'
  | 'clickIds'
  | 'mirrorEvents'
  | 'rateLimits'
  | 'promoEmails'

/** Every statement takes the cutoff as ?1 and the batch size as ?2, and
 *  picks its rows oldest first through the date index. The promo rule's ?1
 *  is the JSON array of closed codes instead, and its rows come through the
 *  table's key, which leads with promoCodeId. */
const RULES: ReadonlyArray<{ name: RuleName; sql: string }> = [
  // Deletes first, so the update below does not clear click ids on rows
  // that are about to go anyway.
  {
    name: 'acquisitions',
    sql: `DELETE FROM funnelAcquisition WHERE rowid IN (
            SELECT rowid FROM funnelAcquisition
             WHERE createdAt < ?1 ORDER BY createdAt LIMIT ?2)`,
  },
  {
    name: 'clickIds',
    sql: `UPDATE funnelAcquisition SET gclid = NULL WHERE rowid IN (
            SELECT rowid FROM funnelAcquisition
             WHERE createdAt < ?1 AND gclid IS NOT NULL
             ORDER BY createdAt LIMIT ?2)`,
  },
  {
    name: 'mirrorEvents',
    sql: `DELETE FROM mirrorEvents WHERE rowid IN (
            SELECT rowid FROM mirrorEvents
             WHERE createdAt < ?1 ORDER BY createdAt LIMIT ?2)`,
  },
  {
    name: 'rateLimits',
    sql: `DELETE FROM auth_ratelimit WHERE rowid IN (
            SELECT rowid FROM auth_ratelimit
             WHERE windowStart < ?1 ORDER BY windowStart LIMIT ?2)`,
  },
  {
    name: 'promoEmails',
    sql: `DELETE FROM promoEmailClaims WHERE rowid IN (
            SELECT rowid FROM promoEmailClaims
             WHERE promoCodeId IN (SELECT value FROM json_each(?1))
             LIMIT ?2)`,
  },
]

/**
 * One tick of the retention sweep. Returns what it changed; never throws
 * for a failing rule (it is logged and named in `failed`).
 */
export async function sweepFunnelRetention(
  db: D1Database,
  config: RetentionConfig,
  nowMs: number,
  limits: SweepLimits = DEFAULT_SWEEP_LIMITS,
): Promise<SweepResult> {
  const cutoffs = retentionCutoffs(config, nowMs)
  const cutoffOf: Record<RuleName, () => Promise<string | number | null>> = {
    acquisitions: async () => cutoffs.funnelBefore,
    clickIds: async () => cutoffs.clickIdBefore,
    mirrorEvents: async () => cutoffs.funnelBefore,
    rateLimits: async () => cutoffs.rateLimitBefore,
    // null skips the rule: no code is closed, so nothing can go.
    promoEmails: async () => {
      const closed = await closedPromoCodes(db, cutoffs.promoClosedBefore)
      return closed.length === 0 ? null : JSON.stringify(closed)
    },
  }
  const changed: Record<RuleName, number> = {
    acquisitions: 0,
    clickIds: 0,
    mirrorEvents: 0,
    rateLimits: 0,
    promoEmails: 0,
  }
  const failed: string[] = []
  let drained = true

  for (const rule of RULES) {
    try {
      const cutoff = await cutoffOf[rule.name]()
      if (cutoff === null) continue
      let batches = 0
      let lastBatch = 0
      do {
        const result = await db
          .prepare(rule.sql)
          .bind(cutoff, limits.batchRows)
          .run()
        lastBatch = result.meta.changes
        changed[rule.name] += lastBatch
        batches += 1
      } while (lastBatch >= limits.batchRows && batches < limits.maxBatches)
      // A full last batch at the cap may have left rows behind.
      if (lastBatch >= limits.batchRows) drained = false
    } catch (error) {
      failed.push(rule.name)
      console.error(`[cron] retention sweep: ${rule.name} failed:`, error)
    }
  }

  return {
    clickIdsCleared: changed.clickIds,
    mirrorEventsDeleted: changed.mirrorEvents,
    acquisitionsDeleted: changed.acquisitions,
    rateLimitsDeleted: changed.rateLimits,
    promoEmailsDeleted: changed.promoEmails,
    drained,
    failed,
  }
}
