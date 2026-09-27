// ── Songs: the Karaoke subscription's allowance (plan S8, Stage 2) ──
//
// A singer sees songs, never credits. Under the hood a song up to 12 minutes
// is one credit in the ledger (billing-core.ts, uvrJobCost), so the songs
// left are the credit balance, and a subscription period grants songs into
// that same append-only ledger (revenuecat.ts).
//
// Unused songs roll over, up to a cap: a period tops the subscription's songs
// up by at most its own songs and never past the cap. The owner's numbers
// (27 Sep) are 20 a month and a cap of 50. Both are config, SONGS_PER_PERIOD
// and SONGS_ROLLOVER_CAP, so the open S7 decisions can move them without code.
//
// Only subscription songs count toward the cap (owner, 28 Sep, review S2).
// Credits bought on the web, promo credits and testing allowances are the
// singer's own and never make a period grant less. The ledger has one
// balance, so which songs a separation spent is a rule, not a record:
// subscriptionSongs() walks the ledger and spends the subscription's songs
// first, the oldest period first, and a refunded separation gives back the
// songs it took.

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

/** The songs a period grants on top of the subscription songs `held`. */
export function periodGrant(held: number, allowance: SongAllowance): number {
  return Math.max(0, Math.min(allowance.perPeriod, allowance.cap - held))
}

/** The ledger reason of a period's grant (revenuecat.ts). */
export const SUBSCRIPTION_GRANT = 'subscription'
/** The ledger reason of subscription songs moved in from another identity:
 *  they stay subscription songs on the account (revenuecat.ts, TRANSFER). */
export const SUBSCRIPTION_MOVED_IN = 'subscription-transfer-in'

/** The ledger reason of the songs a refund takes back: what was left of the
 *  refunded period's grant, which the row names by its key (revenuecat.ts). */
export const SUBSCRIPTION_REFUND = 'subscription-refund'

/** A creditLedger row, as the songs walk reads it. */
export interface LedgerRow {
  delta: number
  reason: string | null
  jobRef: string | null
  idempotencyKey: string | null
}

/** One period's grant, and what is left of it. */
export interface PeriodSongs {
  /** The grant's ledger key: `rc:<event id>`. */
  key: string
  /** The store transaction the period was bought in, when known. */
  transaction: string | null
  /** Its songs not yet spent. */
  left: number
}

export interface SubscriptionSongs {
  /** Subscription songs not yet spent: what the rollover cap counts. */
  held: number
  /** Every period's grant with what is left of it, oldest first. */
  periods: PeriodSongs[]
}

/** The walk's state: every period so far, and what each separation took. */
interface SongsWalk {
  held: number
  periods: PeriodSongs[]
  /** Per separation job, the periods it spent and how many songs of each. */
  takenBy: Map<string, Array<[PeriodSongs, number]>>
}

/** Spends `songs` from the periods, the oldest first; says what each gave. */
function spendSongs(
  walk: SongsWalk,
  songs: number,
): Array<[PeriodSongs, number]> {
  const taken: Array<[PeriodSongs, number]> = []
  let owed = songs
  for (const period of walk.periods) {
    if (owed <= 0) break
    const take = Math.min(period.left, owed)
    if (take > 0) {
      period.left -= take
      owed -= take
      walk.held -= take
      taken.push([period, take])
    }
  }
  return taken
}

/** A store refund takes back what was left of its own period, and spends
 *  the rest of what it takes like any other debit. */
function refundPeriod(walk: SongsWalk, row: LedgerRow, songs: number): void {
  const period = walk.periods.find((entry) => entry.key === row.jobRef)
  const take = Math.min(period?.left ?? 0, songs)
  if (period !== undefined) {
    period.left -= take
    walk.held -= take
  }
  spendSongs(walk, songs - take)
}

/** A separation's refund gives back exactly the songs it took. */
function giveBack(walk: SongsWalk, row: LedgerRow, songs: number): void {
  const job = row.jobRef ?? ''
  let back = songs
  for (const [period, spent] of walk.takenBy.get(job) ?? []) {
    const give = Math.min(spent, back)
    period.left += give
    walk.held += give
    back -= give
  }
  walk.takenBy.delete(job)
}

function isPeriodGrant(row: LedgerRow): boolean {
  return (
    row.reason === SUBSCRIPTION_GRANT || row.reason === SUBSCRIPTION_MOVED_IN
  )
}

/** One ledger row's effect on the subscription songs. */
function readRow(walk: SongsWalk, row: LedgerRow): void {
  const delta = Number(row.delta)
  if (isPeriodGrant(row) && delta >= 0) {
    walk.periods.push({
      key: row.idempotencyKey ?? '',
      transaction: row.reason === SUBSCRIPTION_GRANT ? row.jobRef : null,
      left: delta,
    })
    walk.held += delta
  } else if (row.reason === SUBSCRIPTION_REFUND && delta < 0) {
    refundPeriod(walk, row, -delta)
  } else if (row.reason === 'uvr-job' && delta < 0) {
    const taken = spendSongs(walk, -delta)
    if (row.jobRef !== null) walk.takenBy.set(row.jobRef, taken)
  } else if (row.reason === 'uvr-refund' && delta > 0) {
    giveBack(walk, row, delta)
  } else if (delta < 0) {
    spendSongs(walk, -delta)
  }
}

/** The subscription songs a ledger holds, walking it in the order it was
 *  written. A separation spends the subscription's songs first, the oldest
 *  period first, and its refund gives back exactly the songs it took. A
 *  store refund takes back what was left of its own period. Any other debit
 *  spends them first too, so a move away takes them all. Other
 *  credits never become subscription songs, so the songs held are never
 *  more than the balance. */
export function subscriptionSongs(
  rows: readonly LedgerRow[],
): SubscriptionSongs {
  const walk: SongsWalk = { held: 0, periods: [], takenBy: new Map() }
  for (const row of rows) readRow(walk, row)
  return { held: walk.held, periods: walk.periods }
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
