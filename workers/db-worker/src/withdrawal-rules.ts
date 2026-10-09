// ============================================================
// withdrawal-rules — which credits of a pack are unused, and what they refund
// ============================================================
//
// The owner's rule (9 Oct 2026), pending lawyer point 5:
//
//   - Only paid credits are refundable. Free credits (the LAUNCH code,
//     gifts) and the launch offer's bonus never are.
//   - The ledger has one balance, so which credits a buyer has used is
//     counted, not recorded. They count as spent in this order: free credits
//     not tied to a purchase, oldest first; then paid credits, the oldest
//     pack first; then the bonus credits that came with a pack
//     (launch-finisher.ts), last. Spending itself does not change; the order
//     only decides what is left.
//   - Refund = amount paid x unused paid credits of the pack / paid credits
//     of the pack, rounded down to the cent.
//   - Withdrawing removes the pack's unused bonus credits too; used ones
//     stay used.
//
// The Karaoke subscription's songs and review access's are the app's.
// subscriptionSongs() (songs-allowance.ts) already decides how much of the
// balance is theirs; the rest is the web's own credits, which this file
// splits by the order above. Money that went back for a pack (a refund or a
// dispute, stripe-payments.ts) or a withdrawal takes from that pack's own
// credits before anything is counted as spent, and leaves the pack settled:
// it cannot be withdrawn again here.
//
// The 14 days count from the day the credits landed, by the calendar in
// Croatia, where the seller is: a pack bought on 9 October can be cancelled
// until the end of 23 October. The function stays open until that day has
// ended everywhere (UTC-12), so a buyer west of Croatia is never shut out
// before their own midnight.

import { REVIEW_ACCESS, SEPARATION_REFUND, SUBSCRIPTION_GRANT, SUBSCRIPTION_MOVED_IN, SUBSCRIPTION_REFUND_REVERSED, SUBSCRIPTION_SANDBOX, SUBSCRIPTION_SANDBOX_MOVED_IN, subscriptionSongs, } from './songs-allowance'
import { PACK_PURCHASE, PURCHASE_DISPUTE, PURCHASE_REFUND, WITHDRAWAL_BONUS, WITHDRAWAL_PAID, } from './stripe-payments'
import type { WithdrawalMode } from './withdrawal-wording'
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
  /** Money already went back for it (a refund or a dispute), or it was
   *  withdrawn: settled, and not withdrawable here. */
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

/** A pack being counted: its two pools and what has come off them. */
interface Pools {
  use: PackUse
  /** Paid and bonus credits still held, before anything counts as spent. */
  paidLeft: number
  bonusLeft: number
}

function eventOf(key: string | null): string | null {
  return key?.startsWith('evt:') === true ? key.slice('evt:'.length) : null
}

function newPack(row: LedgerEntry): Pools {
  const paid = Number(row.delta)
  return {
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
      settled: false,
    },
    paidLeft: paid,
    bonusLeft: 0,
  }
}

/** The pack a withdrawal row names, by its key. */
function withdrawnPack(row: LedgerEntry): string | null {
  const key = row.idempotencyKey ?? ''
  const prefix =
    row.reason === WITHDRAWAL_PAID ? withdrawalKey('') : withdrawalBonusKey('')
  return key.startsWith(prefix) ? key.slice(prefix.length) : null
}

/** A refund's or a dispute's take, split across the pack's two pools in
 *  proportion to them, as the take itself was (stripe-payments.ts). */
function takeBack(pack: Pools, credits: number): void {
  pack.use.settled = true
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

/** Sort the ledger into packs, their bonuses, what came off them, and the
 *  free credits; everything else is spending, which the balance counts. */
function sortLedger(rows: readonly LedgerEntry[]): {
  packs: Pools[]
  orphanBonus: number
  free: number
} {
  const packs: Pools[] = []
  const byPayment = new Map<string, Pools>()
  const byId = new Map<string, Pools>()
  const takes = new Map<string, number>()
  let orphanBonus = 0
  let free = 0
  for (const row of rows) {
    const delta = Number(row.delta)
    if (row.reason === PACK_PURCHASE && delta > 0) {
      const pack = newPack(row)
      packs.push(pack)
      byId.set(row.id, pack)
      if (row.paymentIntentId !== null) byPayment.set(row.paymentIntentId, pack)
    } else if (row.reason === PACK_BONUS && delta > 0) {
      const pack = byPayment.get(row.paymentIntentId ?? '')
      if (pack === undefined) {
        orphanBonus += delta
      } else {
        pack.use.bonus += delta
        pack.bonusLeft += delta
      }
    } else if (
      row.reason === WITHDRAWAL_PAID ||
      row.reason === WITHDRAWAL_BONUS
    ) {
      const pack = byId.get(withdrawnPack(row) ?? '')
      if (pack !== undefined) {
        if (row.reason === WITHDRAWAL_PAID) pack.paidLeft += delta
        else pack.bonusLeft += delta
        pack.use.settled = true
      }
    } else if (
      row.reason === PURCHASE_REFUND ||
      row.reason === PURCHASE_DISPUTE
    ) {
      const payment = row.jobRef ?? ''
      takes.set(payment, (takes.get(payment) ?? 0) - delta)
    } else if (
      delta > 0 &&
      row.reason !== SEPARATION_REFUND &&
      !APP_SONGS.has(row.reason)
    ) {
      free += delta
    }
  }
  for (const [payment, credits] of takes) {
    const pack = byPayment.get(payment)
    if (pack !== undefined) takeBack(pack, credits)
  }
  return { packs, orphanBonus, free }
}

/** The web's own credits left: the balance less the app's songs in it. */
function webCreditsLeft(rows: readonly LedgerEntry[]): number {
  const balance = rows.reduce((sum, row) => sum + Number(row.delta), 0)
  const songs = subscriptionSongs(rows)
  return Math.max(
    0,
    balance - Math.max(0, songs.held) - Math.max(0, songs.review),
  )
}

/**
 * Every pack in the ledger with what is left of it, oldest first. `rows`
 * must be the account's whole ledger in the order it was written.
 */
export function packUses(rows: readonly LedgerEntry[]): PackUse[] {
  const { packs, orphanBonus, free } = sortLedger(rows)
  for (const pack of packs) {
    pack.paidLeft = Math.max(0, pack.paidLeft)
    pack.bonusLeft = Math.max(0, pack.bonusLeft)
  }
  const held =
    free +
    orphanBonus +
    packs.reduce((sum, pack) => sum + pack.paidLeft + pack.bonusLeft, 0)
  // What has been spent, counted against the credits in the rule's order.
  let spent = Math.min(held, Math.max(0, held - webCreditsLeft(rows)))
  spent -= Math.min(spent, free)
  for (const pack of packs) {
    const used = Math.min(spent, pack.paidLeft)
    pack.use.paidUnused = pack.paidLeft - used
    spent -= used
  }
  for (const pack of packs) {
    const used = Math.min(spent, pack.bonusLeft)
    pack.use.bonusUnused = pack.bonusLeft - used
    spent -= used
  }
  return packs.map((pack) => pack.use)
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
/** From the start of a date in UTC to its end at UTC-12. */
const DAY_ENDS_EVERYWHERE_MS = 36 * 3_600_000

/** The last day a pack bought at `purchasedAtIso` can be cancelled:
 *  YYYY-MM-DD, the 14th day after the purchase in Croatia. */
export function withdrawalDeadline(purchasedAtIso: string): string {
  const bought = Date.parse(
    `${sellerDate(Date.parse(purchasedAtIso))}T00:00:00.000Z`,
  )
  return new Date(bought + WITHDRAWAL_DAYS * DAY_MS).toISOString().slice(0, 10)
}

/** Whether the pack can still be cancelled at `nowMs`: until its last day
 *  has ended everywhere. */
export function withdrawalOpen(purchasedAtIso: string, nowMs: number): boolean {
  const lastDay = Date.parse(
    `${withdrawalDeadline(purchasedAtIso)}T00:00:00.000Z`,
  )
  return nowMs < lastDay + DAY_ENDS_EVERYWHERE_MS
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

/** Whether the buyer can withdraw from this pack now. Never in waiver mode:
 *  there the buyer gave up the right at checkout. */
export function canWithdraw(
  mode: WithdrawalMode,
  pack: PackUse,
  nowMs: number,
): boolean {
  return (
    mode === 'refund_unused' &&
    !pack.settled &&
    pack.paidUnused > 0 &&
    withdrawalOpen(pack.purchasedAt, nowMs)
  )
}
