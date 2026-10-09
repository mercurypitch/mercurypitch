// ============================================================
// The refund rule — which credits of a pack are unused, and what they pay back
// ============================================================
//
// The owner's rule of 9 Oct 2026, pending lawyer point 5: only paid credits
// are refundable; credits count as spent free first, then paid (the oldest
// pack first), then the bonus that came with a pack; the refund is the price
// times the unused share, rounded down to the cent. Each fixture is a ledger
// as the worker writes it, row by row.

import { describe, expect, it } from 'vitest'
import type { LedgerEntry, PackUse } from './withdrawal-rules'
import { canWithdraw, deadlineToShow, lastOpenDay, packUses, refundBasis, refundFor, refundMinor, shownDeadline, withdrawalBonusKey, withdrawalDeadline, withdrawalKey, withdrawalOpen, } from './withdrawal-rules'

const STARTED = Date.parse('2026-10-09T10:00:00.000Z')
const DAY = 86_400_000
const at = (iso: string): number => Date.parse(iso)

/** A ledger written one row a minute, as the worker would write it. */
function ledger() {
  const rows: LedgerEntry[] = []
  const add = (row: Partial<LedgerEntry> & { delta: number }): LedgerEntry => {
    const n = rows.length + 1
    const entry: LedgerEntry = {
      id: `row-${n}`,
      createdAt: new Date(STARTED + n * 60_000).toISOString(),
      reason: null,
      jobRef: null,
      idempotencyKey: `key-${n}`,
      paymentIntentId: null,
      ...row,
    }
    rows.push(entry)
    return entry
  }
  return {
    rows,
    pack: (credits: number, paymentIntent: string) =>
      add({
        delta: credits,
        reason: 'purchase',
        jobRef: 'pack-starter',
        idempotencyKey: `evt:evt_${paymentIntent}`,
        paymentIntentId: paymentIntent,
      }),
    bonus: (credits: number, paymentIntent: string) =>
      add({
        delta: credits,
        reason: 'offer-bonus',
        jobRef: 'launch-finisher',
        paymentIntentId: paymentIntent,
      }),
    promo: (credits: number) => add({ delta: credits, reason: 'promo' }),
    gift: (credits: number) => add({ delta: credits, reason: 'gift' }),
    spend: (credits: number, job: string) =>
      add({
        delta: -credits,
        reason: 'uvr-job',
        jobRef: job,
        idempotencyKey: `uvr:${job}`,
      }),
    failedJob: (credits: number, job: string) =>
      add({
        delta: credits,
        reason: 'uvr-refund',
        jobRef: job,
        idempotencyKey: `uvr-refund:${job}`,
      }),
    subscription: (songs: number) =>
      add({ delta: songs, reason: 'subscription', jobRef: 'txn-1' }),
    appSeparation: (songs: number, job: string) =>
      add({
        delta: -songs,
        reason: 'uvr-job-app',
        jobRef: job,
        idempotencyKey: `uvr:${job}`,
      }),
    refunded: (credits: number, paymentIntent: string) =>
      add({
        delta: -credits,
        reason: 'purchase-refund',
        jobRef: paymentIntent,
      }),
    disputed: (credits: number, paymentIntent: string) =>
      add({
        delta: -credits,
        reason: 'purchase-dispute',
        jobRef: paymentIntent,
      }),
    /** A dispute's row (stripe-payments.ts): negative when it opens, and
     *  positive when it is won and gives the credits back. */
    disputeRow: (delta: number, paymentIntent: string) =>
      add({ delta, reason: 'purchase-dispute', jobRef: paymentIntent }),
    withdrawn: (purchase: LedgerEntry, paid: number, bonus: number) => {
      add({
        delta: -paid,
        reason: 'withdrawal',
        jobRef: purchase.paymentIntentId,
        idempotencyKey: withdrawalKey(purchase.id),
      })
      if (bonus > 0) {
        add({
          delta: -bonus,
          reason: 'withdrawal-bonus',
          jobRef: purchase.paymentIntentId,
          idempotencyKey: withdrawalBonusKey(purchase.id),
        })
      }
    },
  }
}

function useOf(rows: readonly LedgerEntry[], purchase: LedgerEntry): PackUse {
  const use = packUses(rows).find((pack) => pack.purchaseId === purchase.id)
  if (use === undefined) throw new Error(`no pack for ${purchase.id}`)
  return use
}

/** €20.00 for 140 credits, the research's worked example. */
const PRICE = 2000

describe('what a pack refunds', () => {
  it('refunds the whole price of a pack with nothing used', () => {
    const book = ledger()
    const pack = book.pack(140, 'pi_a')

    const use = useOf(book.rows, pack)

    expect(use).toMatchObject({ paid: 140, paidUnused: 140, settled: false })
    expect(refundMinor(PRICE, use)).toBe(2000)
  })

  it('refunds the unused share of a partly used pack', () => {
    const book = ledger()
    const pack = book.pack(140, 'pi_a')
    book.spend(14, 'job-1')

    const use = useOf(book.rows, pack)

    expect(use.paidUnused).toBe(126)
    expect(refundMinor(PRICE, use)).toBe(1800)
  })

  it('rounds the refund down to the cent', () => {
    const book = ledger()
    const pack = book.pack(140, 'pi_a')
    book.spend(1, 'job-1')

    // 2000 x 139 / 140 = 1985.71...
    expect(refundMinor(PRICE, useOf(book.rows, pack))).toBe(1985)
  })

  it('offers nothing for a pack whose credits are all used', () => {
    const book = ledger()
    const pack = book.pack(140, 'pi_a')
    book.spend(140, 'job-1')

    const use = useOf(book.rows, pack)

    expect(use.paidUnused).toBe(0)
    expect(refundMinor(PRICE, use)).toBe(0)
    expect(canWithdraw('refund_unused', use, STARTED, 3)).toBe(false)
  })
})

describe('the order credits count as spent', () => {
  it('counts free credits as spent first, so a few used leave the pack whole', () => {
    const book = ledger()
    book.promo(5)
    const pack = book.pack(140, 'pi_a')
    book.spend(3, 'job-1')

    expect(useOf(book.rows, pack).paidUnused).toBe(140)
  })

  it('never refunds more than the pack cost, however many free credits are held', () => {
    const book = ledger()
    book.promo(5)
    book.gift(50)
    const pack = book.pack(140, 'pi_a')

    const use = useOf(book.rows, pack)

    expect(use.paidUnused).toBe(140)
    expect(refundMinor(PRICE, use)).toBe(2000)
  })

  it('never counts a free credit granted after a spend toward that spend', () => {
    const book = ledger()
    const pack = book.pack(140, 'pi_a')
    book.spend(7, 'job-1')
    book.promo(5)

    // The 7 came off the pack: the 5 free credits were not there yet.
    expect(useOf(book.rows, pack).paidUnused).toBe(133)
  })

  it('never brings back a pack used up before free credits landed', () => {
    const book = ledger()
    const pack = book.pack(30, 'pi_a')
    book.spend(30, 'job-1')
    book.promo(30)

    const use = useOf(book.rows, pack)

    expect(use.paidUnused).toBe(0)
    expect(
      canWithdraw('refund_unused', use, at(use.purchasedAt) + 1000, 3),
    ).toBe(false)
  })

  it('spends what there was at each moment: free credits that land between two spends pay for the second', () => {
    const book = ledger()
    const pack = book.pack(140, 'pi_a')
    book.spend(10, 'job-1')
    book.promo(20)
    book.spend(15, 'job-2')

    expect(useOf(book.rows, pack).paidUnused).toBe(130)
  })

  it('spends the pack before its bonus: 20 of 140 + 30 used leaves the bonus whole', () => {
    const book = ledger()
    const pack = book.pack(140, 'pi_a')
    book.bonus(30, 'pi_a')
    book.spend(20, 'job-1')

    const use = useOf(book.rows, pack)

    expect(use).toMatchObject({
      paid: 140,
      paidUnused: 120,
      bonus: 30,
      bonusUnused: 30,
    })
    // 2000 x 120 / 140 = 1714.28...
    expect(refundMinor(PRICE, use)).toBe(1714)
  })

  it('spends the bonus last of all, after every pack', () => {
    const book = ledger()
    const first = book.pack(140, 'pi_a')
    book.bonus(30, 'pi_a')
    const second = book.pack(140, 'pi_b')
    book.spend(290, 'job-1')

    expect(useOf(book.rows, first)).toMatchObject({
      paidUnused: 0,
      bonusUnused: 20,
    })
    expect(useOf(book.rows, second).paidUnused).toBe(0)
  })

  it('takes two packs oldest first', () => {
    const book = ledger()
    const older = book.pack(140, 'pi_a')
    const newer = book.pack(140, 'pi_b')
    book.spend(50, 'job-1')

    expect(useOf(book.rows, older).paidUnused).toBe(90)
    expect(useOf(book.rows, newer).paidUnused).toBe(140)

    book.spend(100, 'job-2')

    expect(useOf(book.rows, older).paidUnused).toBe(0)
    expect(useOf(book.rows, newer).paidUnused).toBe(130)
  })

  it("gives a failed job's credits back to the pack", () => {
    const book = ledger()
    const pack = book.pack(140, 'pi_a')
    book.spend(10, 'job-1')
    book.failedJob(10, 'job-1')

    expect(useOf(book.rows, pack).paidUnused).toBe(140)
  })

  it("leaves the pack alone when the app spends the subscription's songs", () => {
    const book = ledger()
    book.subscription(20)
    const pack = book.pack(140, 'pi_a')
    book.appSeparation(5, 'app-job-1')
    // A separation on the web spends the web's credits before the songs.
    book.spend(10, 'web-job-1')

    expect(useOf(book.rows, pack).paidUnused).toBe(130)
  })
})

describe('a pack already settled', () => {
  it('stays open after a partial refund, with the share the refund left', () => {
    const book = ledger()
    const pack = book.pack(140, 'pi_a')
    book.refunded(70, 'pi_a')

    const use = useOf(book.rows, pack)

    expect(use).toMatchObject({ settled: false, paidUnused: 70, takenBack: 70 })
    expect(canWithdraw('refund_unused', use, STARTED, 3)).toBe(true)
    expect(refundFor('unused', PRICE, use)).toBe(1000)
  })

  it('is settled once a refund took back every credit the payment granted', () => {
    const book = ledger()
    const pack = book.pack(140, 'pi_a')
    book.bonus(30, 'pi_a')
    book.refunded(170, 'pi_a')

    const use = useOf(book.rows, pack)

    expect(use.settled).toBe(true)
    expect(canWithdraw('no_consent', use, STARTED, 3)).toBe(false)
  })

  it('is settled by a dispute, whatever it could take back', () => {
    const book = ledger()
    const pack = book.pack(140, 'pi_a')
    book.spend(100, 'job-1')
    book.disputed(40, 'pi_a')

    const use = useOf(book.rows, pack)

    expect(use.settled).toBe(true)
    expect(canWithdraw('no_consent', use, STARTED, 3)).toBe(false)
  })

  it("gives a won dispute's credits back to its pack, and keeps the pack settled", () => {
    const book = ledger()
    const disputed = book.pack(140, 'pi_a')
    book.disputeRow(-140, 'pi_a')
    book.disputeRow(140, 'pi_a')
    const next = book.pack(140, 'pi_b')
    book.spend(10, 'job-1')

    const use = useOf(book.rows, disputed)

    // The give-back is the pack's own credits again, never free credits:
    // the 10 spent count against the older pack first.
    expect(use).toMatchObject({ settled: true, paidUnused: 130 })
    expect(canWithdraw('refund_unused', use, STARTED, 3)).toBe(false)
    expect(useOf(book.rows, next).paidUnused).toBe(140)
  })

  it('keeps a withdrawn pack withdrawn, and counts what it used for the next pack', () => {
    const book = ledger()
    const first = book.pack(140, 'pi_a')
    book.bonus(30, 'pi_a')
    book.spend(14, 'job-1')
    book.withdrawn(first, 126, 30)
    const second = book.pack(140, 'pi_b')
    book.spend(10, 'job-2')

    expect(useOf(book.rows, first)).toMatchObject({
      settled: true,
      paidUnused: 0,
      bonusUnused: 0,
    })
    expect(useOf(book.rows, second).paidUnused).toBe(130)
  })
})

describe('the 14 days', () => {
  it('ends with the 14th day after the purchase, by the calendar in Croatia', () => {
    expect(withdrawalDeadline('2026-10-09T10:00:00.000Z')).toBe('2026-10-23')
    // 23:59 in Zagreb is still the 9th; midnight there is the 10th.
    expect(withdrawalDeadline('2026-10-09T21:59:59.000Z')).toBe('2026-10-23')
    expect(withdrawalDeadline('2026-10-09T22:00:00.000Z')).toBe('2026-10-24')
  })

  it('follows Croatia off summer time', () => {
    // Clocks go back on 25 October 2026: UTC+2 before, UTC+1 after.
    expect(withdrawalDeadline('2026-10-25T22:30:00.000Z')).toBe('2026-11-08')
    expect(withdrawalDeadline('2026-10-25T23:30:00.000Z')).toBe('2026-11-09')
  })

  it('stays open three weekdays past the 14th day, until that day has ended everywhere', () => {
    // Bought Friday 9 October: the 14th day is Friday 23 October, and the
    // third weekday after it Wednesday 28 October, which ends at UTC-12 at
    // noon UTC on the 29th.
    const bought = '2026-10-09T10:00:00.000Z'

    expect(lastOpenDay(bought, 3)).toBe('2026-10-28')
    expect(withdrawalOpen(bought, at('2026-10-29T11:59:59.999Z'), 3)).toBe(true)
    expect(withdrawalOpen(bought, at('2026-10-29T12:00:00.000Z'), 3)).toBe(
      false,
    )
  })

  it('closes with the 14th day itself when there is no grace', () => {
    const bought = '2026-10-09T10:00:00.000Z'

    expect(lastOpenDay(bought, 0)).toBe('2026-10-23')
    expect(withdrawalOpen(bought, at('2026-10-24T11:59:59.999Z'), 0)).toBe(true)
    expect(withdrawalOpen(bought, at('2026-10-24T12:00:00.000Z'), 0)).toBe(
      false,
    )
  })

  it('shows a Saturday 14th day as the Monday, and stays open to the Wednesday', () => {
    // Bought Saturday 10 October 2026: the 14th day is Saturday 24 October.
    const bought = '2026-10-10T09:00:00.000Z'

    expect(withdrawalDeadline(bought)).toBe('2026-10-24')
    expect(shownDeadline(bought)).toBe('2026-10-26')
    expect(lastOpenDay(bought, 3)).toBe('2026-10-28')
    expect(withdrawalOpen(bought, at('2026-10-29T11:59:59.999Z'), 3)).toBe(true)
    expect(withdrawalOpen(bought, at('2026-10-29T12:00:00.000Z'), 3)).toBe(
      false,
    )
  })

  it('shows a Sunday 14th day as the Monday too', () => {
    // Bought Sunday 11 October 2026: the 14th day is Sunday 25 October.
    const bought = '2026-10-11T09:00:00.000Z'

    expect(shownDeadline(bought)).toBe('2026-10-26')
    expect(lastOpenDay(bought, 3)).toBe('2026-10-28')
  })

  it('carries a Wednesday 24 December over Christmas to Monday 29 December', () => {
    // Bought Wednesday 10 December 2025: the 14th day is Wednesday 24
    // December, and 25 and 26 December are holidays in most of the EU.
    const bought = '2025-12-10T12:00:00.000Z'

    expect(withdrawalDeadline(bought)).toBe('2025-12-24')
    expect(shownDeadline(bought)).toBe('2025-12-24')
    expect(lastOpenDay(bought, 3)).toBe('2025-12-29')
    expect(withdrawalOpen(bought, at('2025-12-30T11:59:59.999Z'), 3)).toBe(true)
    expect(withdrawalOpen(bought, at('2025-12-30T12:00:00.000Z'), 3)).toBe(
      false,
    )
  })

  it('carries Good Friday over Easter Monday to the Wednesday', () => {
    // Bought Friday 12 March 2027: the 14th day is Good Friday, 26 March.
    // Where Easter Monday is a holiday, the period runs to Tuesday 30 March.
    const bought = '2027-03-12T12:00:00.000Z'

    expect(withdrawalDeadline(bought)).toBe('2027-03-26')
    expect(shownDeadline(bought)).toBe('2027-03-26')
    expect(lastOpenDay(bought, 3)).toBe('2027-03-31')
    expect(withdrawalOpen(bought, at('2027-04-01T11:59:59.999Z'), 3)).toBe(true)
    expect(withdrawalOpen(bought, at('2027-04-01T12:00:00.000Z'), 3)).toBe(
      false,
    )
  })
})

describe('the date a buyer sees', () => {
  it('is the 14th day until that day has ended somewhere, then the last open day', () => {
    // Friday 23 October ends first at UTC+14: 10:00 UTC.
    const bought = '2026-10-09T10:00:00.000Z'

    expect(deadlineToShow(bought, at('2026-10-23T09:59:59.999Z'), 3)).toBe(
      '2026-10-23',
    )
    expect(deadlineToShow(bought, at('2026-10-23T10:00:00.000Z'), 3)).toBe(
      '2026-10-28',
    )
  })

  it('is the Monday through a weekend 14th day, then the last open day', () => {
    const bought = '2026-10-10T09:00:00.000Z'

    expect(deadlineToShow(bought, at(bought), 3)).toBe('2026-10-26')
    expect(deadlineToShow(bought, at('2026-10-25T12:00:00.000Z'), 3)).toBe(
      '2026-10-26',
    )
    expect(deadlineToShow(bought, at('2026-10-26T10:00:00.000Z'), 3)).toBe(
      '2026-10-28',
    )
  })

  it('is never a Monday the function does not reach', () => {
    // With no grace, a Saturday 14th day is the last day it is open.
    const bought = '2026-10-10T09:00:00.000Z'

    expect(deadlineToShow(bought, at(bought), 0)).toBe('2026-10-24')
  })
})

describe('who can withdraw a pack', () => {
  it('lets a pack be withdrawn inside the window only', () => {
    const book = ledger()
    const use = useOf(book.rows, book.pack(140, 'pi_a'))
    const closes = at(`${lastOpenDay(use.purchasedAt, 3)}T12:00:00.000Z`) + DAY

    expect(
      canWithdraw('refund_unused', use, at(use.purchasedAt) + 1000, 3),
    ).toBe(true)
    expect(canWithdraw('refund_unused', use, closes - 1, 3)).toBe(true)
    expect(canWithdraw('refund_unused', use, closes, 3)).toBe(false)
  })

  it('offers no withdrawal of a pack bought under the waiver', () => {
    const book = ledger()
    const use = useOf(book.rows, book.pack(140, 'pi_a'))
    const now = at(use.purchasedAt) + 1000

    expect(canWithdraw('refund_unused', use, now, 3)).toBe(true)
    expect(canWithdraw('waiver', use, now, 3)).toBe(false)
  })

  it('keeps a pack with no consent on record open with every credit used', () => {
    const book = ledger()
    const pack = book.pack(30, 'pi_a')
    book.spend(30, 'job-1')
    const use = useOf(book.rows, pack)
    const now = at(use.purchasedAt) + 1000

    expect(use.paidUnused).toBe(0)
    expect(canWithdraw('refund_unused', use, now, 3)).toBe(false)
    expect(canWithdraw('no_consent', use, now, 3)).toBe(true)
  })

  it('closes a pack with no consent on record with the window too', () => {
    const book = ledger()
    const use = useOf(book.rows, book.pack(30, 'pi_a'))
    const closes = at(`${lastOpenDay(use.purchasedAt, 3)}T12:00:00.000Z`) + DAY

    expect(canWithdraw('no_consent', use, closes, 3)).toBe(false)
  })
})

describe('what a pack with no consent on record refunds', () => {
  it('refunds the whole price, credits used or not', () => {
    expect(refundBasis('no_consent')).toBe('full')
    expect(refundBasis('refund_unused')).toBe('unused')
    const pack = { paid: 30, bonus: 0, takenBack: 0 }
    expect(refundFor('full', 500, { ...pack, paidUnused: 0 })).toBe(500)
    expect(refundFor('unused', 500, { ...pack, paidUnused: 0 })).toBe(0)
    expect(refundFor('unused', 500, { ...pack, paidUnused: 15 })).toBe(250)
  })

  it('refunds what an earlier partial refund left of the price', () => {
    const book = ledger()
    const pack = book.pack(140, 'pi_a')
    book.spend(100, 'job-1')
    // A 10% refund took 14 credits back.
    book.refunded(14, 'pi_a')

    expect(refundFor('full', PRICE, useOf(book.rows, pack))).toBe(1800)
  })
})
