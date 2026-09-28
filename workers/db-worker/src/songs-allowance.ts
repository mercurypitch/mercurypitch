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
// subscriptionSongs() walks the ledger. A separation on the web spends the
// web's credits first, and the subscription's songs only once they run out
// (owner, 28 Sep); one in the app spends the subscription's songs, the
// oldest period first; and a refunded separation gives back what it took.
//
// The native app spends only these songs (owner, S7 D9: credits bought on
// the web are not spendable in the app in V1), plus the one free song a
// month of a signed-in singer without the subscription (S7 D5), which is
// never a credit: appSongs() below, and app-songs.ts for the requests that
// spend them. Songs granted for Play's review (review-access.ts) are the
// app's to spend too: after the subscription's, and never counted by the
// cap. The web touches them as it does the subscription's songs, only once
// its own credits run out.

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

/** The ledger reason of a separation paid for on the web: the web's own
 *  credits first, the subscription's songs once they run out (billing.ts). */
export const WEB_SEPARATION = 'uvr-job'
/** The ledger reason of a separation the native app paid for: the
 *  subscription's songs only (app-songs.ts). The two share one idempotency
 *  key per job, so a job is paid for once, by one of them. */
export const APP_SEPARATION = 'uvr-job-app'
/** The ledger reason of a failed separation's refund (billing.ts). */
export const SEPARATION_REFUND = 'uvr-refund'

/** The ledger reason of the month's free song, claimed: a row of no credits
 *  naming the separation it paid for (app-songs.ts). */
export const FREE_SONG = 'free-song'
/** The ledger reason of a free song given back: the separation it paid for
 *  failed or was cancelled (billing.ts, the refund). */
export const FREE_SONG_BACK = 'free-song-back'

/** The ledger reason of the songs Play's review access grants, once per
 *  account (review-access.ts). */
export const REVIEW_ACCESS = 'review-access'

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
  /** Review access's songs not yet spent: the app's, never capped. */
  review: number
}

/** Where a separation's songs came from: a period, or review access's. */
type Source = PeriodSongs | 'review'

/** The walk's state: every period so far, and what each separation took. */
interface SongsWalk {
  held: number
  /** The whole ledger's balance so far, before the row being read. */
  balance: number
  periods: PeriodSongs[]
  review: number
  /** Per separation job, what it spent from where. */
  takenBy: Map<string, Array<[Source, number]>>
}

/** Spends `songs` from the periods, the oldest first, then from review
 *  access's; says what each gave. */
function spendSongs(walk: SongsWalk, songs: number): Array<[Source, number]> {
  const taken: Array<[Source, number]> = []
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
  const fromReview = Math.min(walk.review, Math.max(0, owed))
  if (fromReview > 0) {
    walk.review -= fromReview
    taken.push(['review', fromReview])
  }
  return taken
}

/** A debit on the web's side: the credits that are not the app's songs pay
 *  first, and the songs only what those do not cover (owner, 28 Sep). */
function spendOnTheWeb(
  walk: SongsWalk,
  songs: number,
): Array<[Source, number]> {
  const credits = Math.max(0, walk.balance - walk.held - walk.review)
  return spendSongs(walk, Math.max(0, songs - credits))
}

/** A store refund takes back what was left of its own period, and spends
 *  the rest of what it takes from the other periods. */
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
  for (const [source, spent] of walk.takenBy.get(job) ?? []) {
    const give = Math.min(spent, back)
    if (source === 'review') {
      walk.review += give
    } else {
      source.left += give
      walk.held += give
    }
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

/** A row that adds songs: a period's grant, a reversed refund's, review
 *  access's, or a separation's refund. Other credits are the singer's own. */
function readCredit(walk: SongsWalk, row: LedgerRow, delta: number): void {
  if (isPeriodGrant(row)) {
    walk.periods.push({
      key: row.idempotencyKey ?? '',
      transaction: row.reason === SUBSCRIPTION_GRANT ? row.jobRef : null,
      left: delta,
    })
    walk.held += delta
  } else if (delta === 0) {
    return
  } else if (row.reason === SUBSCRIPTION_REFUND_REVERSED) {
    restorePeriod(walk, row, delta)
  } else if (row.reason === REVIEW_ACCESS) {
    walk.review += delta
  } else if (row.reason === SEPARATION_REFUND) {
    giveBack(walk, row, delta)
  }
}

/** A separation remembers what it took, for its refund to give back. */
function tookFor(
  walk: SongsWalk,
  row: LedgerRow,
  taken: Array<[Source, number]>,
): void {
  if (row.jobRef !== null) walk.takenBy.set(row.jobRef, taken)
}

/** A row that takes songs: a store refund, from its own period first; a
 *  separation in the app, from the songs; any other debit, on the web's
 *  side, from the credits first. */
function readDebit(walk: SongsWalk, row: LedgerRow, songs: number): void {
  if (row.reason === SUBSCRIPTION_REFUND) {
    refundPeriod(walk, row, songs)
  } else if (row.reason === APP_SEPARATION) {
    tookFor(walk, row, spendSongs(walk, songs))
  } else if (row.reason === WEB_SEPARATION) {
    tookFor(walk, row, spendOnTheWeb(walk, songs))
  } else {
    spendOnTheWeb(walk, songs)
  }
}

/** One ledger row's effect on the subscription songs. */
function readRow(walk: SongsWalk, row: LedgerRow): void {
  const delta = Number(row.delta)
  if (delta < 0) readDebit(walk, row, -delta)
  else readCredit(walk, row, delta)
  walk.balance += delta
}

/** The subscription songs a ledger holds, walking it in the order it was
 *  written, with review access's beside them. A separation on the web
 *  spends the web's own credits first, and only once they run out the
 *  subscription's songs, the oldest period first, then review access's;
 *  one in the app spends those songs in that same order; either's refund
 *  gives back exactly what it took. A store refund takes back what was left
 *  of its own period, and its reversal gives that back. Any other debit is
 *  the web's, credits first, so a move away, which takes the whole balance,
 *  takes the songs too. Other credits never become subscription songs, so
 *  the songs held are never more than the balance. */
export function subscriptionSongs(
  rows: readonly LedgerRow[],
): SubscriptionSongs {
  const walk: SongsWalk = {
    held: 0,
    balance: 0,
    periods: [],
    review: 0,
    takenBy: new Map(),
  }
  for (const row of rows) readRow(walk, row)
  return { held: walk.held, periods: walk.periods, review: walk.review }
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

/** Whether the store reversed this period's refund before the refund got
 *  here: the store's last word on the period is a reversal (review of PR
 *  880, finding 4). RevenueCat retries a failed delivery, so the reversal
 *  can arrive first; a refund that follows it is already taken back, and
 *  takes nothing. A refund that took songs after the reversal is the
 *  store's last word again. The one refund this lets through untaken is a
 *  second refund of a period after its reversal, which the stores are not
 *  known to make: the singer keeps that period, rather than a paying singer
 *  losing theirs to a delivery out of order. */
export function refundReversedFirst(
  rows: readonly LedgerRow[],
  period: string,
): boolean {
  let reversed = false
  for (const row of rows) {
    if (row.jobRef !== period) continue
    if (row.reason === SUBSCRIPTION_REFUND_REVERSED) reversed = true
    else if (isRefundOf(row, period) && Number(row.delta) < 0) reversed = false
  }
  return reversed
}

// ── The month's free song (owner, 28 Sep: S7 D5, and its answers) ──
//
// A signed-in singer without the subscription gets one cloud-split song a
// month, refilling on the 1st (UTC). Signed in means the account, never the
// token: not anonymous, with its email confirmed. An anonymous identity
// gets none, and neither does a subscriber, who has the month's songs.
// Which is decided when the app asks: a subscription that ends mid-month
// brings the month's free song the moment it ends, unless it was spent that
// month before subscribing. It is never a credit: the balance, the web and
// the rollover cap never see it, and an unused one does not carry over.
// Spending it writes a claim, a row of no credits that names the separation
// it paid for, under a key unique to the account, the month and the claim's
// number in that month: at most one claim stands at a time. A failed
// separation gives it back with a row of its own, and the next claim that
// month takes the next number.

/** A subscription that has not ended: an entitlement with no end, or one
 *  still to come. */
export function isSubscribed(
  entitlement: { expiresAt: string | null } | null | undefined,
  nowMs: number,
): boolean {
  if (entitlement === null || entitlement === undefined) return false
  return (
    entitlement.expiresAt === null || Date.parse(entitlement.expiresAt) > nowMs
  )
}

/** The account, as the month's free song asks about it (app-songs.ts). */
export interface FreeSongAccount {
  /** users.authProvider: the account's, never a token's. */
  authProvider: string
  email: string | null
  /** users.emailVerified: 1 once the confirm link was opened. */
  emailVerified: number
  /** Its subscription has not ended (isSubscribed). */
  subscribed: boolean
}

/** Whether an account gets the month's free song (owner, 28 Sep). */
export function getsFreeSong(account: FreeSongAccount): boolean {
  if (account.authProvider === 'anonymous') return false
  // A confirmed email, as a promo code asks too (billing.ts): relaxing it
  // is this one line.
  if (account.email === null || account.emailVerified !== 1) return false
  return !account.subscribed
}

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

/** The month's free song. `monthly` is whether this singer gets one at all
 *  (getsFreeSong, and the free song not switched off). */
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

/** The songs the native app can spend: the subscription's, review
 *  access's, and the month's free song. Credits bought on the web, promo
 *  credits and testing allowances are not among them (owner, S7 D9). */
export interface AppSongs {
  /** Subscription songs not yet spent. */
  held: number
  /** Review access's songs not yet spent. */
  review: number
  /** The month's free song, while it is there: 1, else 0. */
  free: number
  /** What the app can spend: all three together. */
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
  const songs = subscriptionSongs(rows)
  const held = Math.max(0, songs.held)
  const review = Math.max(0, songs.review)
  const free = freeSong(rows, userId, songMonth(nowMs), monthly)
  return {
    held,
    review,
    free: free.left,
    left: held + review + free.left,
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
  const subscribed = isSubscribed(row, nowMs)
  return {
    subscribed,
    left: app === undefined ? Math.max(0, balance) : app.left,
    ...(app === undefined ? {} : { free: app.free }),
    renewsAt: subscribed ? endsAt : null,
    perPeriod: allowance.perPeriod,
    cap: allowance.cap,
  }
}
