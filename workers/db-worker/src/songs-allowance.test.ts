// The Karaoke subscription's arithmetic: what a period grants, which songs
// the cap counts, what config may change, and what /me reports.
// node-tests/revenuecat-songs-integration.test.ts runs the same numbers
// through the webhook and the real engine.

import { describe, expect, it } from 'vitest'
import type { LedgerRow } from './songs-allowance'
import { periodGrant, songAllowance, songsSummary, subscriptionSongs, } from './songs-allowance'

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
