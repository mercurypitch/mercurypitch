// The Karaoke subscription's arithmetic: what a period grants, which songs
// the cap counts, what config may change, and what /me reports.
// node-tests/revenuecat-songs-integration.test.ts runs the same numbers
// through the webhook and the real engine.

import { describe, expect, it } from 'vitest'
import type { LedgerRow } from './songs-allowance'
import { appSongs, freeSong, getsFreeSong, isSubscribed, periodGrant, REVIEW_ACCESS, refundReversal, refundReversedFirst, songAllowance, songMonth, songsSummary, subscriptionSongs, } from './songs-allowance'

const NOW = Date.parse('2026-09-27T12:00:00.000Z')

describe('the allowance', () => {
  it('is the owner’s 20 a period, rolling over to 50, unless config says', () => {
    expect(songAllowance({})).toEqual({ perPeriod: 20, cap: 50 })
    expect(
      songAllowance({ SONGS_PER_PERIOD: '30', SONGS_ROLLOVER_CAP: '60' }),
    ).toEqual({ perPeriod: 30, cap: 60 })
  })

  it('ignores config that is not a whole number of songs', () => {
    for (const bad of ['', ' ', 'twenty', '-5', '2.5', 'NaN']) {
      expect(
        songAllowance({ SONGS_PER_PERIOD: bad, SONGS_ROLLOVER_CAP: bad }),
        bad,
      ).toEqual({ perPeriod: 20, cap: 50 })
    }
  })

  it('never caps below one period', () => {
    expect(
      songAllowance({ SONGS_PER_PERIOD: '30', SONGS_ROLLOVER_CAP: '10' }),
    ).toEqual({ perPeriod: 30, cap: 30 })
  })
})

describe('a period’s grant', () => {
  const allowance = { perPeriod: 20, cap: 50 }

  it('is the period in full while there is room under the cap', () => {
    expect(periodGrant(0, allowance)).toBe(20)
    expect(periodGrant(30, allowance)).toBe(20)
  })

  it('tops up to the cap, and no further', () => {
    expect(periodGrant(45, allowance)).toBe(5)
    expect(periodGrant(50, allowance)).toBe(0)
    expect(periodGrant(70, allowance)).toBe(0)
  })

  it('makes up a balance overdrawn below zero only by the period', () => {
    expect(periodGrant(-3, allowance)).toBe(20)
  })
})

describe('the subscription songs a ledger holds', () => {
  // What the rollover cap counts (owner, 28 Sep): songs granted by the
  // subscription and not yet spent, the oldest period spent first; every
  // other credit is the singer's own and never counts. The app spends the
  // songs; the web spends its own credits first, and the songs only once
  // they run out (owner, 28 Sep).
  let n = 0
  const row = (
    delta: number,
    reason: string,
    jobRef: string | null = null,
  ): LedgerRow => {
    n += 1
    return { delta, reason, jobRef, idempotencyKey: `key-${n}` }
  }
  const grant = (songs: number, transaction: string | null = null) =>
    row(songs, 'subscription', transaction)

  it('holds each period’s songs, and none of the other credits', () => {
    const songs = subscriptionSongs([
      row(50, 'purchase'),
      row(5, 'promo'),
      row(3, 'Managed testing allowance'),
      grant(20, 'txn-1'),
      grant(15, 'txn-2'),
      row(9, 'transfer-in', 'someone'),
    ])
    expect(songs.held).toBe(35)
    expect(songs.periods.map((period) => period.left)).toEqual([20, 15])
    expect(songs.periods.map((period) => period.transaction)).toEqual([
      'txn-1',
      'txn-2',
    ])
  })

  it('are what a separation in the app spends, the oldest period first', () => {
    const songs = subscriptionSongs([
      row(10, 'purchase'),
      grant(20),
      grant(20),
      row(-25, 'uvr-job-app', 'job-a'),
    ])
    expect(songs.held).toBe(15)
    expect(songs.periods.map((period) => period.left)).toEqual([0, 15])
  })

  it('are left alone by the web while its own credits last', () => {
    const songs = subscriptionSongs([
      row(10, 'purchase'),
      grant(5),
      row(-8, 'uvr-job', 'job-b'),
      grant(20),
    ])
    expect(songs.held).toBe(25)
  })

  it('are spent by the web once its credits run out, the oldest first', () => {
    const songs = subscriptionSongs([
      row(10, 'purchase'),
      grant(20),
      grant(20),
      row(-25, 'uvr-job', 'job-a'),
    ])
    expect(songs.held).toBe(25)
    expect(songs.periods.map((period) => period.left)).toEqual([5, 20])
  })

  it('keep the app to its songs, and the web to its credits first', () => {
    const songs = subscriptionSongs([
      row(3, 'purchase'),
      grant(20),
      row(-2, 'uvr-job-app', 'job-app'),
      row(-5, 'uvr-job', 'job-web'),
    ])
    // The app's two songs, then the web's three credits and two songs.
    expect(songs.held).toBe(16)
  })

  it('are spent by any other debit only once the credits run out', () => {
    const songs = subscriptionSongs([
      row(7, 'promo'),
      grant(20),
      row(-5, 'Managed testing allowance'),
      row(-4, 'adjustment'),
    ])
    expect(songs.held).toBe(18)
  })

  it('give a web job’s refund back where it came from', () => {
    const songs = subscriptionSongs([
      row(2, 'purchase'),
      grant(20),
      row(-5, 'uvr-job', 'job-g'),
      row(5, 'uvr-refund', 'job-g'),
      row(-2, 'uvr-job', 'job-h'),
    ])
    // Job g took the two credits and three songs, and gave both back; job h
    // then finds the credits again.
    expect(songs.held).toBe(20)
  })

  it('gives a refunded job’s songs back where they came from', () => {
    const songs = subscriptionSongs([
      grant(3),
      grant(20),
      row(-5, 'uvr-job', 'job-c'),
      row(-1, 'uvr-job', 'job-d'),
      row(5, 'uvr-refund', 'job-c'),
    ])
    expect(songs.held).toBe(22)
    expect(songs.periods.map((period) => period.left)).toEqual([3, 19])
  })

  it('gives nothing back for a job the singer’s own credits paid', () => {
    const songs = subscriptionSongs([
      row(4, 'purchase'),
      row(-4, 'uvr-job', 'job-e'),
      grant(20),
      row(4, 'uvr-refund', 'job-e'),
    ])
    expect(songs.held).toBe(20)
  })

  it('holds nothing once the songs have moved to another account', () => {
    const songs = subscriptionSongs([
      row(7, 'promo'),
      grant(20),
      row(-27, 'transfer-out', 'account'),
    ])
    expect(songs.held).toBe(0)
  })

  it('takes subscription songs moved in as songs', () => {
    const songs = subscriptionSongs([
      row(12, 'subscription-transfer-in', 'device'),
      row(7, 'transfer-in', 'device'),
    ])
    expect(songs.held).toBe(12)
  })

  it('keeps a period granted nothing, for the refund that names it', () => {
    const songs = subscriptionSongs([grant(50), grant(0, 'txn-at-cap')])
    expect(songs.periods.map((period) => period.transaction)).toEqual([
      null,
      'txn-at-cap',
    ])
    expect(songs.held).toBe(50)
  })

  it('takes a refunded period’s songs back from that period', () => {
    const refunded: LedgerRow = {
      delta: 20,
      reason: 'subscription',
      jobRef: 'txn-2',
      idempotencyKey: 'rc:renewal',
    }
    const songs = subscriptionSongs([
      grant(20, 'txn-1'),
      row(-15, 'uvr-job', 'job-f'),
      refunded,
      {
        delta: -20,
        reason: 'subscription-refund',
        jobRef: 'rc:renewal',
        idempotencyKey: 'rc:refund:clawback',
      },
    ])
    expect(songs.held).toBe(5)
    expect(songs.periods.map((period) => period.left)).toEqual([5, 0])
  })

  it('never holds more songs than the balance', () => {
    const songs = subscriptionSongs([grant(20), row(-30, 'adjustment')])
    expect(songs.held).toBe(0)
  })
})

describe('the songs /me reports', () => {
  const allowance = { perPeriod: 20, cap: 50 }

  it('are the balance, with the renewal date while subscribed', () => {
    expect(
      songsSummary(
        [
          { feature: 'supporter', expiresAt: '2026-12-01T00:00:00.000Z' },
          { feature: 'cloud', expiresAt: '2026-10-27T12:00:00.000Z' },
        ],
        17,
        allowance,
        NOW,
      ),
    ).toEqual({
      subscribed: true,
      left: 17,
      renewsAt: '2026-10-27T12:00:00.000Z',
      perPeriod: 20,
      cap: 50,
    })
  })

  it('say subscribed, with no date, for a subscription that never ends', () => {
    expect(
      songsSummary([{ feature: 'cloud', expiresAt: null }], 3, allowance, NOW),
    ).toMatchObject({ subscribed: true, renewsAt: null })
  })

  it('say not subscribed once the period is over, and never go below zero', () => {
    expect(
      songsSummary(
        [{ feature: 'cloud', expiresAt: '2026-09-27T11:59:59.000Z' }],
        -2,
        allowance,
        NOW,
      ),
    ).toEqual({
      subscribed: false,
      left: 0,
      renewsAt: null,
      perPeriod: 20,
      cap: 50,
    })
  })

  it('are not a subscription for another entitlement', () => {
    expect(
      songsSummary(
        [{ feature: 'supporter', expiresAt: null }],
        4,
        allowance,
        NOW,
      ).subscribed,
    ).toBe(false)
  })
})

describe('a refund the store reversed', () => {
  // Apple reverses a refund it granted (RevenueCat's REFUND_REVERSED): the
  // songs the refund took back are the period's again, and stay songs.
  const grant: LedgerRow = {
    delta: 20,
    reason: 'subscription',
    jobRef: 'txn-1',
    idempotencyKey: 'rc:purchase',
  }
  const sung: LedgerRow = {
    delta: -5,
    reason: 'uvr-job',
    jobRef: 'job-r',
    idempotencyKey: 'uvr:job-r',
  }
  const clawback: LedgerRow = {
    delta: -15,
    reason: 'subscription-refund',
    jobRef: 'rc:purchase',
    idempotencyKey: 'rc:refund:clawback',
  }
  const restore = (songs: number, key = 'rc:reversal:restore'): LedgerRow => ({
    delta: songs,
    reason: 'subscription-refund-reversed',
    jobRef: 'rc:purchase',
    idempotencyKey: key,
  })

  it('gives the period back the songs the refund took', () => {
    const songs = subscriptionSongs([grant, sung, clawback, restore(15)])
    expect(songs.held).toBe(15)
    expect(songs.periods.map((period) => period.left)).toEqual([15])
  })

  it('keeps them songs even when their period is not in the ledger', () => {
    const songs = subscriptionSongs([{ ...restore(7), jobRef: 'rc:gone' }])
    expect(songs.held).toBe(7)
  })

  it('owes what the refund took from the period the store names', () => {
    expect(refundReversal([grant, sung, clawback], 'txn-1')).toEqual({
      period: 'rc:purchase',
      songs: 15,
    })
  })

  it('owes the latest refund’s songs when the store names no period', () => {
    expect(refundReversal([grant, sung, clawback], null)).toEqual({
      period: 'rc:purchase',
      songs: 15,
    })
    expect(refundReversal([grant, sung, clawback], 'txn-unknown')).toEqual({
      period: 'rc:purchase',
      songs: 15,
    })
  })

  it('owes nothing once the songs are back, or when nothing was taken', () => {
    expect(
      refundReversal([grant, sung, clawback, restore(15)], 'txn-1').songs,
    ).toBe(0)
    expect(refundReversal([grant, sung], 'txn-1')).toEqual({
      period: 'rc:purchase',
      songs: 0,
    })
    expect(refundReversal([], null)).toEqual({ period: null, songs: 0 })
  })

  // Review of PR 880 and 882, a nit on finding 4: a reversal no refund here
  // explains is for a refund still to come, which will take from the latest
  // period, as clawBack finds it. So it names that period, and owes nothing.
  it('names the latest period when no refund here owes anything', () => {
    const renewal: LedgerRow = {
      delta: 20,
      reason: 'subscription',
      jobRef: 'txn-2',
      idempotencyKey: 'rc:renewal',
    }
    expect(refundReversal([grant, sung], null)).toEqual({
      period: 'rc:purchase',
      songs: 0,
    })
    expect(refundReversal([grant, sung], 'txn-unknown')).toEqual({
      period: 'rc:purchase',
      songs: 0,
    })
    expect(
      refundReversal([grant, sung, clawback, restore(15), renewal], null),
    ).toEqual({ period: 'rc:renewal', songs: 0 })
  })

  // Review of PR 880, finding 4: RevenueCat retries a failed delivery, so a
  // reversal can arrive before the refund it reverses.
  it('is the last word on its period when it arrived before the refund', () => {
    expect(refundReversedFirst([grant, sung, restore(0)], 'rc:purchase')).toBe(
      true,
    )
    expect(refundReversedFirst([grant, sung], 'rc:purchase')).toBe(false)
    expect(
      refundReversedFirst([grant, sung, restore(0)], 'rc:another-period'),
    ).toBe(false)
  })

  it('stays the last word after the refund it voided, of no songs', () => {
    const voided: LedgerRow = { ...clawback, delta: 0 }
    expect(
      refundReversedFirst([grant, restore(0), voided], 'rc:purchase'),
    ).toBe(true)
  })

  it('is no longer the last word once a refund took songs after it', () => {
    expect(
      refundReversedFirst(
        [grant, sung, clawback, restore(15), { ...clawback, delta: -15 }],
        'rc:purchase',
      ),
    ).toBe(false)
    expect(
      refundReversedFirst([grant, sung, clawback, restore(15)], 'rc:purchase'),
    ).toBe(true)
  })
})

describe('a subscription that has not ended', () => {
  it('is an entitlement with no end, or an end still to come', () => {
    expect(isSubscribed({ expiresAt: null }, NOW)).toBe(true)
    expect(
      isSubscribed({ expiresAt: new Date(NOW + 1000).toISOString() }, NOW),
    ).toBe(true)
  })

  it('is not one that ended, or none at all', () => {
    expect(isSubscribed({ expiresAt: new Date(NOW).toISOString() }, NOW)).toBe(
      false,
    )
    expect(isSubscribed(null, NOW)).toBe(false)
    expect(isSubscribed(undefined, NOW)).toBe(false)
  })
})

describe('who gets the month’s free song', () => {
  // Owner, 28 Sep: an account that is not anonymous, with its email
  // confirmed, and no subscription that has not ended. Asked of the account:
  // a token can say "passkey" for an anonymous one (review of PR 880, 1).
  const signedIn = {
    authProvider: 'password',
    email: 'singer@example.com',
    emailVerified: 1,
    subscribed: false,
  }

  it('is a signed-in account with its email confirmed and no subscription', () => {
    expect(getsFreeSong(signedIn)).toBe(true)
    expect(getsFreeSong({ ...signedIn, authProvider: 'google' })).toBe(true)
  })

  it('is never an anonymous account, whatever it has', () => {
    expect(getsFreeSong({ ...signedIn, authProvider: 'anonymous' })).toBe(false)
  })

  it('is never an account without a confirmed email', () => {
    expect(getsFreeSong({ ...signedIn, emailVerified: 0 })).toBe(false)
    expect(getsFreeSong({ ...signedIn, email: null })).toBe(false)
  })

  it('is never a subscriber, who has the month’s songs', () => {
    expect(getsFreeSong({ ...signedIn, subscribed: true })).toBe(false)
  })
})

describe('the month’s free song', () => {
  // Owner, 28 Sep (S7 D5): a signed-in singer gets one cloud-split song a
  // month, refilling on the 1st; an anonymous one gets none. It is never a
  // credit: a claim is a row of no credits naming the job it paid for.
  const USER = 'user-free'
  const claim = (month: string, n: number, job: string): LedgerRow => ({
    delta: 0,
    reason: 'free-song',
    jobRef: job,
    idempotencyKey: `free-song:${USER}:${month}:${n}`,
  })
  const back = (job: string): LedgerRow => ({
    delta: 0,
    reason: 'free-song-back',
    jobRef: job,
    idempotencyKey: `free-song-back:${job}`,
  })

  it('belongs to the UTC month, so it refills on the 1st', () => {
    expect(songMonth(Date.parse('2026-09-30T23:59:59.999Z'))).toBe('2026-09')
    expect(songMonth(Date.parse('2026-10-01T00:00:00.000Z'))).toBe('2026-10')
  })

  it('is there for a signed-in singer who has not used it this month', () => {
    expect(freeSong([], USER, '2026-09', true)).toEqual({
      left: 1,
      nextKey: `free-song:${USER}:2026-09:0`,
    })
  })

  it('is gone once a job this month used it', () => {
    expect(
      freeSong([claim('2026-09', 0, 'job-1')], USER, '2026-09', true).left,
    ).toBe(0)
  })

  it('comes back when the job it paid for failed, under a new claim key', () => {
    expect(
      freeSong(
        [claim('2026-09', 0, 'job-1'), back('job-1')],
        USER,
        '2026-09',
        true,
      ),
    ).toEqual({ left: 1, nextKey: `free-song:${USER}:2026-09:1` })
  })

  it('is there again next month, and never two at once', () => {
    expect(
      freeSong([claim('2026-09', 0, 'job-1')], USER, '2026-10', true),
    ).toEqual({ left: 1, nextKey: `free-song:${USER}:2026-10:0` })
  })

  it('is not there for an anonymous singer, or while switched off', () => {
    expect(freeSong([], USER, '2026-09', false).left).toBe(0)
  })

  it('is never a credit, so the cap never counts it', () => {
    const songs = subscriptionSongs([
      {
        delta: 20,
        reason: 'subscription',
        jobRef: null,
        idempotencyKey: 'rc:p',
      },
      claim('2026-09', 0, 'job-1'),
      back('job-1'),
    ])
    expect(songs.held).toBe(20)
  })
})

describe('the songs the app can spend', () => {
  // Owner, S7 D9: credits bought on the web are not spendable in the native
  // app in V1. The app spends subscription songs, and a signed-in singer's
  // free song of the month.
  const USER = 'user-app'
  const NOW_MS = Date.parse('2026-09-28T12:00:00.000Z')
  const rows: LedgerRow[] = [
    { delta: 30, reason: 'purchase', jobRef: null, idempotencyKey: 'buy' },
    {
      delta: 20,
      reason: 'subscription',
      jobRef: 'txn',
      idempotencyKey: 'rc:p',
    },
    {
      delta: -4,
      reason: 'uvr-job-app',
      jobRef: 'job',
      idempotencyKey: 'uvr:job',
    },
    // A web separation, paid for with the bought credits.
    { delta: -3, reason: 'uvr-job', jobRef: 'web', idempotencyKey: 'uvr:web' },
  ]

  it('are the subscription songs and the free song, never bought credits', () => {
    expect(appSongs(rows, USER, NOW_MS, true)).toEqual({
      held: 16,
      review: 0,
      free: 1,
      left: 17,
      freeKey: `free-song:${USER}:2026-09:0`,
    })
  })

  it('are only the subscription songs for a singer without the free song', () => {
    expect(appSongs(rows, USER, NOW_MS, false)).toMatchObject({
      held: 16,
      free: 0,
      left: 16,
    })
  })

  it('say so in /me: the songs left, and the free one among them', () => {
    const app = appSongs(rows, USER, NOW_MS, true)
    expect(
      songsSummary([], 43, { perPeriod: 20, cap: 50 }, NOW_MS, app),
    ).toEqual({
      subscribed: false,
      left: 17,
      free: 1,
      renewsAt: null,
      perPeriod: 20,
      cap: 50,
    })
  })
})

describe('the songs Play review access grants', () => {
  // review-access.ts: a few songs for Google Play's reviewer, once per
  // account. The app spends them after the subscription's, the web only
  // once its own credits run out, and the rollover cap never counts them.
  const USER = 'user-review'
  const NOW_MS = Date.parse('2026-09-28T12:00:00.000Z')
  let n = 0
  const row = (
    delta: number,
    reason: string,
    jobRef: string | null = null,
  ): LedgerRow => {
    n += 1
    return { delta, reason, jobRef, idempotencyKey: `review-key-${n}` }
  }
  const review = (songs: number) => row(songs, REVIEW_ACCESS)

  it('are the app’s to spend, and no subscription songs', () => {
    const rows = [row(30, 'purchase'), review(3)]

    expect(subscriptionSongs(rows)).toMatchObject({ held: 0, review: 3 })
    expect(appSongs(rows, USER, NOW_MS, false)).toMatchObject({
      held: 0,
      review: 3,
      left: 3,
    })
  })

  it('are spent after the subscription’s songs', () => {
    const songs = subscriptionSongs([
      row(20, 'subscription', 'txn'),
      review(3),
      row(-1, 'uvr-job-app', 'job-1'),
    ])

    expect(songs).toMatchObject({ held: 19, review: 3 })
  })

  it('are spent once the subscription’s run out, and come back to where they were taken from', () => {
    const spent = [
      row(2, 'subscription', 'txn'),
      review(3),
      row(-4, 'uvr-job-app', 'job-2'),
    ]
    expect(subscriptionSongs(spent)).toMatchObject({ held: 0, review: 1 })

    const refunded = [...spent, row(4, 'uvr-refund', 'job-2')]
    expect(subscriptionSongs(refunded)).toMatchObject({ held: 2, review: 3 })
  })

  it('are no credits of the web’s, and left alone while its own last', () => {
    const songs = subscriptionSongs([
      row(30, 'purchase'),
      row(20, 'subscription', 'txn'),
      review(3),
      row(-33, 'uvr-job', 'job-web'),
    ])

    expect(songs).toMatchObject({ held: 17, review: 3 })
  })

  it('are the last the web spends, and come back to where they were taken from', () => {
    const spent = [
      row(2, 'purchase'),
      row(2, 'subscription', 'txn'),
      review(3),
      row(-5, 'uvr-job', 'job-web'),
    ]
    expect(subscriptionSongs(spent)).toMatchObject({ held: 0, review: 2 })

    const refunded = [...spent, row(5, 'uvr-refund', 'job-web')]
    expect(subscriptionSongs(refunded)).toMatchObject({ held: 2, review: 3 })
  })

  it('never count toward the rollover cap', () => {
    const allowance = { perPeriod: 20, cap: 50 }
    const songs = subscriptionSongs([
      row(20, 'subscription', 'txn-1'),
      row(20, 'subscription', 'txn-2'),
      row(9, 'subscription', 'txn-3'),
      review(5),
    ])

    expect(periodGrant(songs.held, allowance)).toBe(1)
  })

  it('are never a refund, a grant of the store’s, or anything but credits', () => {
    // Only a positive row of its own reason adds review songs.
    expect(subscriptionSongs([row(-3, REVIEW_ACCESS)]).review).toBe(0)
    expect(subscriptionSongs([row(3, 'promo')]).review).toBe(0)
  })
})
