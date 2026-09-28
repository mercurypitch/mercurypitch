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
//
// The native app spends only these songs (owner, S7 D9: credits bought on
// the web are not spendable in the app in V1), plus a signed-in singer's one
// free song a month (S7 D5), which is never a credit: appSongs() below, and
// app-songs.ts for the requests that spend them.

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

/** The ledger reason of the songs a reversed refund gives back to the
 *  period it took them from (revenuecat.ts, REFUND_REVERSED). */
export const SUBSCRIPTION_REFUND_REVERSED = 'subscription-refund-reversed'

/** The ledger reason of the month's free song, claimed: a row of no credits
 *  naming the separation it paid for (app-songs.ts). */
export const FREE_SONG = 'free-song'
/** The ledger reason of a free song given back: the separation it paid for
 *  failed or was cancelled (billing.ts, the refund). */
export const FREE_SONG_BACK = 'free-song-back'

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

/** A reversed refund gives its period back the songs the refund took. Where
 *  that period is not in this ledger, they are a period of their own: they
 *  stay subscription songs either way. */
function restorePeriod(walk: SongsWalk, row: LedgerRow, songs: number): void {
  const period = walk.periods.find((entry) => entry.key === row.jobRef)
  if (period === undefined) {
    walk.periods.push({
      key: row.idempotencyKey ?? '',
      transaction: null,
      left: songs,
    })
  } else {
    period.left += songs
  }
  walk.held += songs
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
  } else if (row.reason === SUBSCRIPTION_REFUND_REVERSED && delta > 0) {
    restorePeriod(walk, row, delta)
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
 *  store refund takes back what was left of its own period, and its reversal
 *  gives that back. Any other debit spends them first too, so a move away
 *  takes them all. Other credits never become subscription songs, so the
 *  songs held are never more than the balance. */
export function subscriptionSongs(
  rows: readonly LedgerRow[],
): SubscriptionSongs {
  const walk: SongsWalk = { held: 0, periods: [], takenBy: new Map() }
  for (const row of rows) readRow(walk, row)
  return { held: walk.held, periods: walk.periods }
}

/** What a reversed refund owes: the songs its refund took from the period,
 *  less any already given back. */
export interface RefundReversal {
  /** The period's key (`rc:<event id>`), or null when nothing was refunded. */
  period: string | null
  songs: number
}

function isRefundOf(row: LedgerRow, period: string): boolean {
  return row.reason === SUBSCRIPTION_REFUND && row.jobRef === period
}

/** The refund a store reversed: the period whose transaction the reversal
 *  names, else the one the latest refund took from, as RevenueCat reports a
 *  refund for the latest period only. It owes back what that period's
 *  refunds took and no reversal has given back yet, so a second reversal of
 *  one refund owes nothing. */
export function refundReversal(
  rows: readonly LedgerRow[],
  transaction: string | null,
): RefundReversal {
  const named = subscriptionSongs(rows).periods.find(
    (period) => transaction !== null && period.transaction === transaction,
  )
  const latest = rows.filter((row) => row.reason === SUBSCRIPTION_REFUND).at(-1)
  const period = named?.key ?? latest?.jobRef ?? null
  if (period === null) return { period: null, songs: 0 }
  let owed = 0
  for (const row of rows) {
    if (isRefundOf(row, period)) owed -= Number(row.delta)
    if (row.reason === SUBSCRIPTION_REFUND_REVERSED && row.jobRef === period) {
      owed -= Number(row.delta)
    }
  }
  return { period, songs: Math.max(0, owed) }
}

// ── The month's free song (owner, 28 Sep: S7 D5) ──
//
// A signed-in singer gets one cloud-split song a month, refilling on the 1st
// (UTC); an anonymous one gets none. It is never a credit: the balance, the
// web and the rollover cap never see it, and an unused one does not carry
// over. Spending it writes a claim, a row of no credits that names the
// separation it paid for, under a key unique to the account, the month and
// the claim's number in that month: at most one claim stands at a time.
// A failed separation gives it back with a row of its own, and the next
// claim that month takes the next number.

/** The month a free song belongs to: `YYYY-MM`, in UTC. */
export function songMonth(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 7)
}

export interface FreeSong {
  /** The month's free song, while it is not spent: 1, else 0. */
  left: number
  /** The idempotency key the month's next claim is written under. */
  nextKey: string
}

/** The month's free song. `monthly` is whether this singer gets one at all:
 *  signed in, and the free song not switched off. */
export function freeSong(
  rows: readonly LedgerRow[],
  userId: string,
  month: string,
  monthly: boolean,
): FreeSong {
  const prefix = `${FREE_SONG}:${userId}:${month}:`
  const claims = rows.filter(
    (row) =>
      row.reason === FREE_SONG &&
      row.idempotencyKey?.startsWith(prefix) === true,
  )
  const givenBack = new Set(
    rows
      .filter((row) => row.reason === FREE_SONG_BACK)
      .map((row) => row.jobRef),
  )
  const spent = claims.some((claim) => !givenBack.has(claim.jobRef))
  return {
    left: monthly && !spent ? 1 : 0,
    nextKey: `${prefix}${claims.length}`,
  }
}

/** The songs the native app can spend: the subscription's, and the month's
 *  free song. Credits bought on the web, promo credits and testing
 *  allowances are not among them (owner, S7 D9). */
export interface AppSongs {
  /** Subscription songs not yet spent. */
  held: number
  /** The month's free song, while it is there: 1, else 0. */
  free: number
  /** What the app can spend: both together. */
  left: number
  /** The key the free song's claim is written under, if the app spends it. */
  freeKey: string
}

export function appSongs(
  rows: readonly LedgerRow[],
  userId: string,
  nowMs: number,
  monthly: boolean,
): AppSongs {
  const held = Math.max(0, subscriptionSongs(rows).held)
  const free = freeSong(rows, userId, songMonth(nowMs), monthly)
  return {
    held,
    free: free.left,
    left: held + free.left,
    freeKey: free.nextKey,
  }
}

export interface SongsSummary {
  /** A subscription that has not ended. */
  subscribed: boolean
  /** Songs the singer can still separate: on the web the balance, never
   *  below zero; in the app its own songs (appSongs). */
  left: number
  /** In the app: the month's free song among the songs left, 1 or 0. */
  free?: number
  /** When the period ends and the next songs arrive, while subscribed. */
  renewsAt: string | null
  perPeriod: number
  cap: number
}

/** What `/api/billing/me` says about songs. On the web, the songs left are
 *  whatever the account has. In the app (`app`) they are the songs it can
 *  spend: never credits bought on the web (owner, S7 D9). */
export function songsSummary(
  entitlements: ReadonlyArray<{ feature: string; expiresAt: string | null }>,
  balance: number,
  allowance: SongAllowance,
  nowMs: number,
  app?: Pick<AppSongs, 'left' | 'free'>,
): SongsSummary {
  const row = entitlements.find(
    (entitlement) => entitlement.feature === SONGS_ENTITLEMENT,
  )
  const endsAt = row?.expiresAt ?? null
  const subscribed =
    row !== undefined && (endsAt === null || Date.parse(endsAt) > nowMs)
  return {
    subscribed,
    left: app === undefined ? Math.max(0, balance) : app.left,
    ...(app === undefined ? {} : { free: app.free }),
    renewsAt: subscribed ? endsAt : null,
    perPeriod: allowance.perPeriod,
    cap: allowance.cap,
  }
}
