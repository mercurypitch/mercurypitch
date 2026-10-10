// ============================================================
// withdrawal-rules — which credits of a pack are unused, and what they refund
// ============================================================
//
// The owner's rule (9 Oct 2026), pending lawyer point 5:
//
//   - Only paid credits are refundable. Free credits (the LAUNCH code,
//     gifts) and the launch offer's bonus never are.
//   - The ledger has one balance, so which credits a buyer has used is
//     counted, not recorded, in the order things happened (10 Oct): each
//     spend takes from the credits there were at that moment, free credits
//     not tied to a purchase first; then paid credits, the oldest pack
//     first; then the bonus credits that came with a pack
//     (launch-finisher.ts), last. Credits that land later never pay for an
//     earlier spend, so free credits granted after a pack ran out never
//     bring its cancellation back: the checkbox says that once the buyer
//     has used them all, they can no longer cancel. A failed separation's
//     refund gives its credits back where they came from. Spending itself
//     does not change; the order only decides what is left.
//   - Refund = amount paid x unused paid credits of the pack / paid credits
//     of the pack, rounded down to the cent.
//   - Withdrawing removes the pack's unused bonus credits too; used ones
//     stay used.
//
// The Karaoke subscription's songs and review access's are the app's.
// webCreditsAfterEach() (songs-allowance.ts) already decides how much of
// the balance is theirs after each row; the rest is the web's own credits,
// which this file splits by the order above. Money that went back for a
// pack (a refund or a dispute, stripe-payments.ts) takes from that pack's
// own credits first, when it went back. A partial refund leaves the rest of
// the pack cancellable: the credits it took are gone, so the unused share
// is what is left to refund. A dispute, a refund that took back every
// credit the payment granted, or a withdrawal settles the pack: it cannot
// be withdrawn again here.
//
// A buyer who never ticked the checkbox at checkout (every pack bought
// before it shipped) never asked for the credits straight away, so the
// right stays whole (CRD Art. 14(4)(b)): the function stays open for the 14
// days even with every credit used, and refunds the whole price. So does a
// buyer whose purchase mail, the confirmation of the box, has not gone
// (checkout-consent.ts, consentTerms).
//
// The 14 days count from the day the credits landed, by the calendar in
// Croatia, where the seller is: a pack bought on 9 October has 23 October as
// its 14th day. A period whose last day is a Saturday, a Sunday or a public
// holiday runs on to the end of the next working day (Regulation 1182/71,
// Art. 3(4)), and holidays differ between countries, so the function stays
// open a few weekdays more (WITHDRAWAL_GRACE_WEEKDAYS, 3 by default): enough
// for 24 to 26 December, or Good Friday to Easter Monday. It closes once the
// last of those days has ended everywhere (UTC-12), so a buyer west of
// Croatia is never shut out before their own midnight. The mails and the
// Terms still say 14 days.

import { APP_SEPARATION, REVIEW_ACCESS, SEPARATION_REFUND, SUBSCRIPTION_GRANT, SUBSCRIPTION_MOVED_IN, SUBSCRIPTION_REFUND_REVERSED, SUBSCRIPTION_SANDBOX, SUBSCRIPTION_SANDBOX_MOVED_IN, WEB_SEPARATION, webCreditsAfterEach, } from './songs-allowance'
import { PACK_PURCHASE, PURCHASE_DISPUTE, PURCHASE_REFUND, WITHDRAWAL_BONUS, WITHDRAWAL_PAID, } from './stripe-payments'
import type { PurchaseTerms } from './withdrawal-wording'
import { WITHDRAWAL_DAYS } from './withdrawal-wording'

/** The launch offer's bonus rows (launch-finisher.ts, OFFER_BONUS). */
const PACK_BONUS = 'offer-bonus'

/** A creditLedger row, read in the order it was written (rowid). */
export interface LedgerEntry {
  id: string
  createdAt: string
  delta: number
  reason: string | null
  jobRef: string | null
  idempotencyKey: string | null
  paymentIntentId: string | null
}

/** One pack, and what is left of it by the rule above. */
export interface PackUse {
  /** The pack's ledger row id, which names the purchase. */
  purchaseId: string
  /** When its credits landed. */
  purchasedAt: string
  /** The pricing plan it was bought from (the row's jobRef). */
  planId: string | null
  paymentIntentId: string | null
  /** The Stripe event that granted it, from the row's `evt:` key. */
  eventId: string | null
  /** Credits the pack added, and of those the ones still unused. */
  paid: number
  paidUnused: number
  /** Bonus credits that came with it, and of those the ones still unused. */
  bonus: number
  bonusUnused: number
  /** Credits that refunds and disputes of its payment took back: what
   *  they took off this pack and anything else on the balance
   *  (stripe-payments.ts). */
  takenBack: number
  /** Money went back for all of it (a dispute, or refunds that took back
   *  every credit the payment granted), or it was withdrawn: settled, and
   *  not withdrawable here. */
  settled: boolean
}

/** The ledger key of the paid credits a withdrawal removes: one per pack. */
export function withdrawalKey(purchaseId: string): string {
  return `withdrawal:${purchaseId}`
}

/** The ledger key of the bonus credits the same withdrawal removes. */
export function withdrawalBonusKey(purchaseId: string): string {
  return `withdrawal-bonus:${purchaseId}`
}

/** Rows that are the app's songs, which the songs walk accounts for. */
const APP_SONGS: ReadonlySet<string | null> = new Set([
  SUBSCRIPTION_GRANT,
  SUBSCRIPTION_MOVED_IN,
  SUBSCRIPTION_SANDBOX,
  SUBSCRIPTION_SANDBOX_MOVED_IN,
  SUBSCRIPTION_REFUND_REVERSED,
  REVIEW_ACCESS,
])

/** A pack being counted: its two pools, as they stand so far. */
interface Pools {
  use: PackUse
  /** Paid and bonus credits still held. */
  paidLeft: number
  bonusLeft: number
}

/** Where a spend took credits from: free credits, bonus credits with no
 *  pack in this ledger, or one of a pack's two pools. */
type Source = 'free' | 'orphan' | { pack: Pools; part: 'paid' | 'bonus' }

/** The web's own credits, split by where they came from, as the ledger is
 *  read a row at a time. */
interface Walk {
  packs: Pools[]
  byPayment: Map<string, Pools>
  byId: Map<string, Pools>
  /** Free credits not tied to a purchase, still held. */
  free: number
  /** Bonus credits whose pack is not in this ledger, still held. */
  orphanBonus: number
  /** Per separation job, what its spend took from where, for its refund
   *  to give back. */
  spentBy: Map<string, Array<[Source, number]>>
}

function eventOf(key: string | null): string | null {
  return key?.startsWith('evt:') === true ? key.slice('evt:'.length) : null
}

function addPack(walk: Walk, row: LedgerEntry): void {
  const paid = Number(row.delta)
  const pack: Pools = {
    use: {
      purchaseId: row.id,
      purchasedAt: row.createdAt,
      planId: row.jobRef,
      paymentIntentId: row.paymentIntentId,
      eventId: eventOf(row.idempotencyKey),
      paid,
      paidUnused: 0,
      bonus: 0,
      bonusUnused: 0,
      takenBack: 0,
      settled: false,
    },
    paidLeft: paid,
    bonusLeft: 0,
  }
  walk.packs.push(pack)
  walk.byId.set(row.id, pack)
  if (row.paymentIntentId !== null)
    walk.byPayment.set(row.paymentIntentId, pack)
}

function addBonus(walk: Walk, row: LedgerEntry, credits: number): void {
  const pack = walk.byPayment.get(row.paymentIntentId ?? '')
  if (pack === undefined) {
    walk.orphanBonus += credits
    return
  }
  pack.use.bonus += credits
  pack.bonusLeft += credits
}

/** The pack a withdrawal row names, by its key. */
function withdrawnPack(row: LedgerEntry): string | null {
  const key = row.idempotencyKey ?? ''
  const prefix =
    row.reason === WITHDRAWAL_PAID ? withdrawalKey('') : withdrawalBonusKey('')
  return key.startsWith(prefix) ? key.slice(prefix.length) : null
}

/** A withdrawal's own row: what it took off the pack it names. */
function withdraw(walk: Walk, row: LedgerEntry, delta: number): void {
  const pack = walk.byId.get(withdrawnPack(row) ?? '')
  if (pack === undefined) return
  if (row.reason === WITHDRAWAL_PAID) {
    pack.paidLeft = Math.max(0, pack.paidLeft + delta)
  } else {
    pack.bonusLeft = Math.max(0, pack.bonusLeft + delta)
  }
  pack.use.settled = true
}

/** A refund's or a dispute's take, split across the pack's two pools in
 *  proportion to what they hold, as the take itself was (stripe-payments.ts). */
function takeBack(pack: Pools, credits: number): void {
  const held = pack.paidLeft + pack.bonusLeft
  if (held <= 0 || credits <= 0) return
  const take = Math.min(credits, held)
  const share = Math.min(
    pack.bonusLeft,
    Math.round((take * pack.bonusLeft) / held),
  )
  const fromPaid = Math.min(pack.paidLeft, take - share)
  // What the paid credits could not cover comes off the bonus.
  const fromBonus = Math.min(pack.bonusLeft, take - fromPaid)
  pack.paidLeft -= fromPaid
  pack.bonusLeft -= fromBonus
}

/** Money that went back for the pack its payment bought: the take comes
 *  off that pack first. A dispute settles the pack, and so do refunds once
 *  they have taken back every credit the payment granted. */
function moneyBack(walk: Walk, row: LedgerEntry, credits: number): void {
  const pack = walk.byPayment.get(row.jobRef ?? '')
  if (pack === undefined) return
  takeBack(pack, credits)
  pack.use.takenBack += credits
  const all = pack.use.paid + pack.use.bonus
  if (row.reason === PURCHASE_DISPUTE || pack.use.takenBack >= all) {
    pack.use.settled = true
  }
}

/** What a row adds to, or takes off, a pack or the free credits by its
 *  kind. Spending is left to settle(). */
function readPackRow(walk: Walk, row: LedgerEntry): void {
  const delta = Number(row.delta)
  if (row.reason === PACK_PURCHASE && delta > 0) {
    addPack(walk, row)
  } else if (row.reason === PACK_BONUS && delta > 0) {
    addBonus(walk, row, delta)
  } else if (
    row.reason === WITHDRAWAL_PAID ||
    row.reason === WITHDRAWAL_BONUS
  ) {
    withdraw(walk, row, delta)
  } else if (
    row.reason === PURCHASE_REFUND ||
    row.reason === PURCHASE_DISPUTE
  ) {
    moneyBack(walk, row, -delta)
  } else if (
    delta > 0 &&
    row.reason !== SEPARATION_REFUND &&
    !APP_SONGS.has(row.reason)
  ) {
    walk.free += delta
  }
}

function heldOf(walk: Walk): number {
  return walk.packs.reduce(
    (sum, pack) => sum + pack.paidLeft + pack.bonusLeft,
    walk.free + walk.orphanBonus,
  )
}

/** Take `credits` in the rule's order: free credits, then each pack's paid
 *  credits, the oldest first, then their bonus, then bonus with no pack.
 *  Says what came from where. */
function spend(walk: Walk, credits: number): Array<[Source, number]> {
  const taken: Array<[Source, number]> = []
  let owed = credits
  const take = (source: Source, available: number): number => {
    const amount = Math.min(owed, available)
    if (amount <= 0) return 0
    taken.push([source, amount])
    owed -= amount
    return amount
  }
  walk.free -= take('free', walk.free)
  for (const pack of walk.packs) {
    pack.paidLeft -= take({ pack, part: 'paid' }, pack.paidLeft)
  }
  for (const pack of walk.packs) {
    pack.bonusLeft -= take({ pack, part: 'bonus' }, pack.bonusLeft)
  }
  walk.orphanBonus -= take('orphan', walk.orphanBonus)
  return taken
}

function addTo(walk: Walk, source: Source, credits: number): void {
  if (source === 'free') walk.free += credits
  else if (source === 'orphan') walk.orphanBonus += credits
  else if (source.part === 'paid') source.pack.paidLeft += credits
  else source.pack.bonusLeft += credits
}

/** A failed separation's refund gives its credits back where its spend
 *  took them; anything more is the buyer's, as free credits. */
function giveBack(walk: Walk, job: string, credits: number): void {
  let left = credits
  for (const [source, spent] of walk.spentBy.get(job) ?? []) {
    const back = Math.min(spent, left)
    addTo(walk, source, back)
    left -= back
  }
  walk.spentBy.delete(job)
  walk.free += left
}

function isSeparation(row: LedgerEntry): boolean {
  return row.reason === WEB_SEPARATION || row.reason === APP_SEPARATION
}

/** Bring the pools to `web`, the web's credits after the row: what they
 *  lost was spent, by the rule's order, from what there was then; what
 *  they gained is a failed separation's refund, else free credits. */
function settle(walk: Walk, row: LedgerEntry, web: number): void {
  const gap = heldOf(walk) - web
  if (gap > 0) {
    const taken = spend(walk, gap)
    if (isSeparation(row) && row.jobRef !== null) {
      walk.spentBy.set(row.jobRef, taken)
    }
  } else if (gap < 0) {
    const gained = -gap
    if (row.reason === SEPARATION_REFUND)
      giveBack(walk, row.jobRef ?? '', gained)
    else walk.free += gained
  }
}

/**
 * Every pack in the ledger with what is left of it, oldest first. `rows`
 * must be the account's whole ledger in the order it was written: it is
 * read in that order, each spend counted against what there was then.
 */
export function packUses(rows: readonly LedgerEntry[]): PackUse[] {
  const walk: Walk = {
    packs: [],
    byPayment: new Map(),
    byId: new Map(),
    free: 0,
    orphanBonus: 0,
    spentBy: new Map(),
  }
  const web = webCreditsAfterEach(rows)
  rows.forEach((row, index) => {
    readPackRow(walk, row)
    settle(walk, row, web[index] ?? 0)
  })
  return walk.packs.map((pack) => ({
    ...pack.use,
    paidUnused: Math.max(0, pack.paidLeft),
    bonusUnused: Math.max(0, pack.bonusLeft),
  }))
}

// ── The 14 days ──────────────────────────────────────────────────────

const SELLER_CALENDAR = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Zagreb',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The date in Croatia at `ms`: YYYY-MM-DD. */
function sellerDate(ms: number): string {
  const parts = Object.fromEntries(
    SELLER_CALENDAR.formatToParts(new Date(ms)).map((part) => [
      part.type,
      part.value,
    ]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

const DAY_MS = 86_400_000
/** From the start of a date in UTC to its end at UTC-12, the last place on
 *  Earth where it ends. */
const DAY_ENDS_EVERYWHERE_MS = 36 * 3_600_000
/** From the start of a date in UTC to its end at UTC+14, the first place on
 *  Earth where it ends. */
const DAY_ENDS_SOMEWHERE_MS = 10 * 3_600_000

/** Weekdays (Monday to Friday) the function stays open past the 14th day,
 *  unless WITHDRAWAL_GRACE_WEEKDAYS says otherwise. */
export const DEFAULT_GRACE_WEEKDAYS = 3

function startOf(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`)
}

function dayAt(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function isWeekend(ms: number): boolean {
  const day = new Date(ms).getUTCDay()
  return day === 0 || day === 6
}

/** The 14th day after a pack bought at `purchasedAtIso`, in Croatia:
 *  YYYY-MM-DD. */
export function withdrawalDeadline(purchasedAtIso: string): string {
  const bought = startOf(sellerDate(Date.parse(purchasedAtIso)))
  return dayAt(bought + WITHDRAWAL_DAYS * DAY_MS)
}

/** The 14th day as a buyer is told it: moved to the Monday when it falls
 *  on a Saturday or a Sunday. */
export function shownDeadline(purchasedAtIso: string): string {
  let day = startOf(withdrawalDeadline(purchasedAtIso))
  while (isWeekend(day)) day += DAY_MS
  return dayAt(day)
}

/** The last day the function is open: the `graceWeekdays`-th weekday
 *  (Monday to Friday) after the 14th day, or the 14th day itself with no
 *  grace. */
export function lastOpenDay(
  purchasedAtIso: string,
  graceWeekdays: number,
): string {
  let day = startOf(withdrawalDeadline(purchasedAtIso))
  for (let left = Math.max(0, Math.floor(graceWeekdays)); left > 0; ) {
    day += DAY_MS
    if (!isWeekend(day)) left -= 1
  }
  return dayAt(day)
}

/** Whether the pack can still be cancelled at `nowMs`: until its last open
 *  day has ended everywhere. */
export function withdrawalOpen(
  purchasedAtIso: string,
  nowMs: number,
  graceWeekdays: number,
): boolean {
  const last = lastOpenDay(purchasedAtIso, graceWeekdays)
  return nowMs < startOf(last) + DAY_ENDS_EVERYWHERE_MS
}

/**
 * The date to show a buyer as the last day to cancel: the 14th day, moved
 * off a weekend, until that date has ended somewhere on Earth; from then on
 * the last open day, so a buyer never reads a date already gone. Never one
 * the function does not reach.
 */
export function deadlineToShow(
  purchasedAtIso: string,
  nowMs: number,
  graceWeekdays: number,
): string {
  const last = lastOpenDay(purchasedAtIso, graceWeekdays)
  const shown = shownDeadline(purchasedAtIso)
  const first = shown < last ? shown : last
  return nowMs < startOf(first) + DAY_ENDS_SOMEWHERE_MS ? first : last
}

/** The refund for the pack's unused paid credits, in minor units: the price
 *  times the unused share, rounded down to the cent. */
export function refundMinor(
  amountMinor: number,
  pack: Pick<PackUse, 'paid' | 'paidUnused'>,
): number {
  if (!(pack.paid > 0) || !(amountMinor > 0)) return 0
  const unused = Math.max(0, Math.min(pack.paidUnused, pack.paid))
  return Math.floor((amountMinor * unused) / pack.paid)
}

/** What a withdrawal refunds: the unused paid credits' share of the price,
 *  or the whole price for a purchase with no consent on record. */
export type RefundBasis = 'unused' | 'full'

export function refundBasis(terms: PurchaseTerms): RefundBasis {
  return terms === 'no_consent' ? 'full' : 'unused'
}

/** What refundFor reads of a pack. */
export type RefundFacts = Pick<
  PackUse,
  'paid' | 'paidUnused' | 'bonus' | 'takenBack'
>

/**
 * The refund a withdrawal owes, in minor units, by its basis. The whole
 * price is what an earlier partial refund left of it: the share of the
 * payment's credits it did not take back, rounded down to the cent. A
 * refund that took less than it was due (the credits were spent) leaves
 * more than Stripe holds, and Stripe refuses it for the owner to refund by
 * hand.
 */
export function refundFor(
  basis: RefundBasis,
  amountMinor: number,
  pack: RefundFacts,
): number {
  if (basis === 'unused') return refundMinor(amountMinor, pack)
  if (!(amountMinor > 0)) return 0
  const granted = pack.paid + pack.bonus
  if (!(pack.takenBack > 0) || !(granted > 0)) return Math.floor(amountMinor)
  const left = Math.max(0, granted - pack.takenBack)
  return Math.floor((amountMinor * left) / granted)
}

/**
 * Whether the buyer can withdraw from this pack now, under the terms its
 * own checkout recorded. Never under the waiver: there the buyer gave up the
 * right at checkout. Under refund_unused only while the pack holds unused
 * paid credits; with no consent on record, used or not.
 */
export function canWithdraw(
  terms: PurchaseTerms,
  pack: PackUse,
  nowMs: number,
  graceWeekdays: number,
): boolean {
  if (terms === 'waiver' || pack.settled) return false
  if (!withdrawalOpen(pack.purchasedAt, nowMs, graceWeekdays)) return false
  return terms === 'no_consent' || pack.paidUnused > 0
}
