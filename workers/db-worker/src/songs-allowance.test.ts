// The Karaoke subscription's arithmetic: what a period grants, which songs
// the cap counts, what config may change, and what /me reports.
// node-tests/revenuecat-songs-integration.test.ts runs the same numbers
// through the webhook and the real engine.

import { describe, expect, it } from 'vitest'
import type { LedgerRow } from './songs-allowance'
import { appSongs, freeSong, periodGrant, refundReversal, songAllowance, songMonth, songsSummary, subscriptionSongs, } from './songs-allowance'

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
  // subscription and not yet spent. Spending takes them first, oldest period
  // first; every other credit is the singer's own and never counts.
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

  it('spends them first, the oldest period first', () => {
    const songs = subscriptionSongs([
      row(10, 'purchase'),
      grant(20),
      grant(20),
      row(-25, 'uvr-job', 'job-a'),
    ])
    expect(songs.held).toBe(15)
    expect(songs.periods.map((period) => period.left)).toEqual([0, 15])
  })

  it('spends the singer’s own credits once the songs run out', () => {
    const songs = subscriptionSongs([
      row(10, 'purchase'),
      grant(5),
      row(-8, 'uvr-job', 'job-b'),
      grant(20),
    ])
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
    { delta: -4, reason: 'uvr-job', jobRef: 'job', idempotencyKey: 'uvr:job' },
  ]

  it('are the subscription songs and the free song, never bought credits', () => {
    expect(appSongs(rows, USER, NOW_MS, true)).toEqual({
      held: 16,
      free: 1,
      left: 17,
      freeKey: `free-song:${USER}:2026-09:0`,
    })
  })

  it('are only the subscription songs for an anonymous singer', () => {
    expect(appSongs(rows, USER, NOW_MS, false)).toMatchObject({
      held: 16,
      free: 0,
      left: 16,
    })
  })

  it('say so in /me: the songs left, and the free one among them', () => {
    const app = appSongs(rows, USER, NOW_MS, true)
    expect(
      songsSummary([], 46, { perPeriod: 20, cap: 50 }, NOW_MS, app),
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
