// ── Songs: the Karaoke subscription's allowance (plan S8, Stage 2) ──
//
// A singer sees songs, never credits. Under the hood a song up to 12 minutes
// is one credit in the ledger (billing-core.ts, uvrJobCost), so the songs
// left are the credit balance, and a subscription period grants songs into
// that same append-only ledger (revenuecat.ts).
//
// Unused songs roll over, up to a cap: a period tops the balance up by at
// most its own songs and never past the cap. The owner's numbers (27 Sep) are
// 20 a month and a cap of 50. Both are config, SONGS_PER_PERIOD and
// SONGS_ROLLOVER_CAP, so the open S7 decisions can move them without code.

/** The RevenueCat entitlement the subscription unlocks, and the server's
 *  `entitlements.feature` that mirrors it (plan S7 §3.9). */
export const SONGS_ENTITLEMENT = 'cloud'

export const SONG_ALLOWANCE_DEFAULTS = Object.freeze({ perPeriod: 20, cap: 50 })

export interface SongAllowance {
  /** Songs one period grants, at most. */
  perPeriod: number
  /** The balance a grant never takes the songs past. */
  cap: number
}

export interface SongAllowanceEnv {
  SONGS_PER_PERIOD?: string
  SONGS_ROLLOVER_CAP?: string
}

/** A whole, non-negative number of songs from config, else the default. */
function configured(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback
  const songs = Number(value)
  return Number.isInteger(songs) && songs >= 0 ? songs : fallback
}

export function songAllowance(env: SongAllowanceEnv): SongAllowance {
  const perPeriod = configured(
    env.SONGS_PER_PERIOD,
    SONG_ALLOWANCE_DEFAULTS.perPeriod,
  )
  // A cap under one period would make every renewal grant less than the
  // period promises, so the cap is never smaller than the period.
  const cap = Math.max(
    perPeriod,
    configured(env.SONGS_ROLLOVER_CAP, SONG_ALLOWANCE_DEFAULTS.cap),
  )
  return { perPeriod, cap }
}

/** The songs a period grants on top of `balance`. The ledger's own grant is
 *  the same arithmetic in SQL (revenuecat.ts), computed as it writes. */
export function periodGrant(balance: number, allowance: SongAllowance): number {
  return Math.max(0, Math.min(allowance.perPeriod, allowance.cap - balance))
}

export interface SongsSummary {
  /** A subscription that has not ended. */
  subscribed: boolean
  /** Songs the singer can still separate: the balance, never below zero. */
  left: number
  /** When the period ends and the next songs arrive, while subscribed. */
  renewsAt: string | null
  perPeriod: number
  cap: number
}

/** What `/api/billing/me` says about songs. Without a subscription the
 *  songs left are whatever the account already has (plan S8, owner 27 Sep:
 *  on dev, Import spends the account's existing credits). */
export function songsSummary(
  entitlements: ReadonlyArray<{ feature: string; expiresAt: string | null }>,
  balance: number,
  allowance: SongAllowance,
  nowMs: number,
): SongsSummary {
  const row = entitlements.find(
    (entitlement) => entitlement.feature === SONGS_ENTITLEMENT,
  )
  const endsAt = row?.expiresAt ?? null
  const subscribed =
    row !== undefined && (endsAt === null || Date.parse(endsAt) > nowMs)
  return {
    subscribed,
    left: Math.max(0, balance),
    renewsAt: subscribed ? endsAt : null,
    perPeriod: allowance.perPeriod,
    cap: allowance.cap,
  }
}
