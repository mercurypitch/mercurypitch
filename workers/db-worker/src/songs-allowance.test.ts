// The Karaoke subscription's arithmetic: what a period grants, what config
// may change, and what /me reports. The ledger's own grant runs the same
// arithmetic in SQL; node-tests/revenuecat-songs-integration.test.ts holds
// the two to the same numbers through the real engine.

import { describe, expect, it } from 'vitest'
import { periodGrant, songAllowance, songsSummary } from './songs-allowance'

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
