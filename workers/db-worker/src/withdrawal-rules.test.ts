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
import { canWithdraw, packUses, refundMinor, withdrawalBonusKey, withdrawalDeadline, withdrawalKey, withdrawalOpen, } from './withdrawal-rules'

const STARTED = Date.parse('2026-10-09T10:00:00.000Z')

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
    expect(canWithdraw('refund_unused', use, STARTED)).toBe(false)
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

  it('counts a free credit granted after the pack before the pack too', () => {
    const book = ledger()
    const pack = book.pack(140, 'pi_a')
    book.spend(7, 'job-1')
    book.promo(5)

    // 7 used: the 5 free credits first, then 2 of the pack's.
    expect(useOf(book.rows, pack).paidUnused).toBe(138)
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
  it('is settled once money went back for it, and cannot be withdrawn', () => {
    const book = ledger()
    const pack = book.pack(140, 'pi_a')
    book.refunded(70, 'pi_a')

    const use = useOf(book.rows, pack)

    expect(use.settled).toBe(true)
    expect(canWithdraw('refund_unused', use, STARTED)).toBe(false)
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

  it('stays open until the last day has ended everywhere, and not a moment after', () => {
    const bought = '2026-10-09T10:00:00.000Z'

    // The end of 23 October at UTC-12 is noon on the 24th, UTC.
    expect(withdrawalOpen(bought, Date.parse('2026-10-24T11:59:59.999Z'))).toBe(
      true,
    )
    expect(withdrawalOpen(bought, Date.parse('2026-10-24T12:00:00.000Z'))).toBe(
      false,
    )
  })

  it('lets a pack be withdrawn inside the window only', () => {
    const book = ledger()
    const use = useOf(book.rows, book.pack(140, 'pi_a'))

    expect(
      canWithdraw('refund_unused', use, Date.parse(use.purchasedAt) + 1000),
    ).toBe(true)
    expect(
      canWithdraw(
        'refund_unused',
        use,
        Date.parse(`${withdrawalDeadline(use.purchasedAt)}T12:00:00.000Z`) +
          86_400_000,
      ),
    ).toBe(false)
  })
})

describe('waiver mode', () => {
  it('offers no withdrawal of a pack that refund_unused would refund', () => {
    const book = ledger()
    const use = useOf(book.rows, book.pack(140, 'pi_a'))
    const now = Date.parse(use.purchasedAt) + 1000

    expect(canWithdraw('refund_unused', use, now)).toBe(true)
    expect(canWithdraw('waiver', use, now)).toBe(false)
  })
})
