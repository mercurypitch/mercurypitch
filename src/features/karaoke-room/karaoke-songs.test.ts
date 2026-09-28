// ============================================================
// The Karaoke room's songs: what is left, and how it is said
// ============================================================
//
// Songs, never credits (plan S8 §6.7). A subscriber reads "18 of 20 songs
// left this month". The server counts only the songs the app can spend,
// never credits bought on the web (owner, S7 D9), so the balance is never
// read as songs here; a worker that says nothing leaves them unknown.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BillingMe } from '@/db/services/billing-service'

const billing = vi.hoisted(() => ({
  me: null as BillingMe | null,
  fetches: 0,
  identified: 0,
}))
vi.mock('@/db/services/billing-service', () => ({
  fetchBillingMe: vi.fn(async () => {
    billing.fetches += 1
    return Promise.resolve(billing.me)
  }),
}))
vi.mock('@/db/services/auth-service', () => ({
  requireAuth: vi.fn(async () => {
    billing.identified += 1
    return Promise.resolve(true)
  }),
}))

import type { KaraokeSongs } from './karaoke-songs'
import { awaitSubscription, collectLine, confirmCostLine, importLine, karaokeSongs, refreshKaraokeSongs, resetKaraokeSongsForTests, restoreNote, songsComeBackLine, songsLeftSentence, songsOnTheWay, songsOptionRow, STEMS_KEPT_DAYS, subscriptionStatusLine, } from './karaoke-songs'

const subscriber: KaraokeSongs = {
  left: 18,
  subscribed: true,
  renewsAt: '2026-10-27T10:00:00.000Z',
  perPeriod: 20,
}

beforeEach(() => {
  billing.me = null
  billing.fetches = 0
  billing.identified = 0
  resetKaraokeSongsForTests()
})

describe('asking the server', () => {
  it("reads a subscriber's songs from /me", async () => {
    billing.me = {
      creditBalance: 18,
      entitlements: [],
      stripeConfigured: false,
      songs: { ...subscriber, left: 18, cap: 50 },
    }

    await refreshKaraokeSongs()

    expect(karaokeSongs()).toEqual(subscriber)
  })

  it('never reads the balance as songs: web credits are not the app’s', async () => {
    resetKaraokeSongsForTests(subscriber)
    billing.me = {
      creditBalance: 5,
      entitlements: [],
      stripeConfigured: false,
    }

    await refreshKaraokeSongs()

    expect(karaokeSongs()).toEqual({
      left: null,
      subscribed: false,
      renewsAt: null,
      perPeriod: 20,
    })
  })

  it('keeps what it knew when the server does not answer', async () => {
    resetKaraokeSongsForTests(subscriber)

    await expect(refreshKaraokeSongs()).resolves.toEqual(subscriber)
    expect(karaokeSongs()).toEqual(subscriber)
  })

  it('gives the phone its identity first only when asked to', async () => {
    await refreshKaraokeSongs()
    expect(billing.identified).toBe(0)

    await refreshKaraokeSongs({ identify: true })
    expect(billing.identified).toBe(1)
    expect(billing.fetches).toBe(2)
  })
})

describe('the words', () => {
  it('say songs, never credits, anywhere', () => {
    const lines = [
      songsLeftSentence(subscriber),
      importLine(subscriber),
      confirmCostLine(subscriber, 1),
      songsComeBackLine(subscriber),
      subscriptionStatusLine(subscriber),
      JSON.stringify(songsOptionRow(subscriber)),
    ]
    for (const line of lines) expect(line).not.toMatch(/credit/i)
  })

  it("count a subscriber's month", () => {
    expect(songsLeftSentence(subscriber)).toBe(
      '18 of 20 songs left this month.',
    )
    expect(importLine(subscriber)).toBe(
      'Songs from Files: MP3, M4A, WAV or FLAC, up to 12 minutes. 18 of 20 songs left this month.',
    )
    expect(songsOptionRow(subscriber)).toEqual({
      label: 'Songs this month',
      value: '18 of 20 left',
    })
    expect(confirmCostLine(subscriber, 1)).toBe(
      'Uses 1 of your 20 songs this month. 17 left after this.',
    )
    expect(confirmCostLine(subscriber, 3)).toBe(
      'Uses 3 of your 20 songs this month. 15 left after this.',
    )
  })

  it('count songs carried over past the month as a plain number', () => {
    const carried = { ...subscriber, left: 35 }

    expect(songsLeftSentence(carried)).toBe('35 songs left.')
    expect(songsOptionRow(carried)).toEqual({
      label: 'Songs',
      value: '35 left',
    })
    expect(confirmCostLine(carried, 1)).toBe(
      'Uses 1 of your songs. 34 left after this.',
    )
  })

  it('count an account without a subscription as its songs, not a month', () => {
    const dev = { left: 1, subscribed: false, renewsAt: null, perPeriod: 20 }

    expect(songsLeftSentence(dev)).toBe('1 song left.')
    expect(confirmCostLine(dev, 1)).toBe(
      'Uses 1 of your songs. 0 left after this.',
    )
  })

  it('offer the subscription where nothing is left and nothing renews', () => {
    const none = { left: 0, subscribed: false, renewsAt: null, perPeriod: 20 }

    expect(importLine(none)).toBe(
      'Any song from Files. Our server separates the voice from the music, and the song then lives on this phone. Part of the subscription.',
    )
    expect(songsOptionRow(none)).toEqual({ label: 'Songs', value: 'None left' })
  })

  it('say only what a song is while the count is not known', () => {
    const unknown = {
      left: null,
      subscribed: false,
      renewsAt: null,
      perPeriod: 20,
    }

    expect(songsLeftSentence(unknown)).toBeNull()
    expect(songsOptionRow(unknown)).toBeNull()
    expect(importLine(unknown)).toBe(
      'Songs from Files: MP3, M4A, WAV or FLAC, up to 12 minutes.',
    )
    expect(confirmCostLine(unknown, 2)).toBe('Uses 2 of your songs.')
  })

  it('say what the store answered to Restore purchases, the same wherever it is asked', () => {
    expect(restoreNote('restored')).toBe(
      'Your Mercury Pitch Cloud subscription is restored.',
    )
    expect(restoreNote('nothing')).toBe(
      'No Mercury Pitch Cloud subscription was found to restore.',
    )
    expect(restoreNote('unavailable')).toBe('Purchases are not available yet.')
    expect(restoreNote('failed')).toBe(
      'The store could not restore purchases. Try again in a moment.',
    )
  })

  it('say when the songs come back, and how the subscription stands', () => {
    expect(songsComeBackLine(subscriber)).toBe(
      'Your 20 songs come back on 27 October.',
    )
    expect(subscriptionStatusLine(subscriber)).toBe(
      'Subscribed, renews on 27 October',
    )
    expect(subscriptionStatusLine({ ...subscriber, subscribed: false })).toBe(
      'Not subscribed',
    )
    expect(songsComeBackLine({ ...subscriber, renewsAt: null })).toBe(
      'Your 20 songs come back next month.',
    )
  })
})

describe('how long a separated song waits', () => {
  // Owner, 28 Sep: never promise 48 hours. The copy asks for the song to be
  // collected within what the stems' R2 lifecycle rule actually keeps.
  it('asks for about a day, the one the stems are kept', () => {
    expect(STEMS_KEPT_DAYS).toBe(1)
    expect(collectLine(1)).toBe(
      'Open Mercury Pitch within about a day to save it to this phone.',
    )
    expect(collectLine(3)).toBe(
      'Open Mercury Pitch within about a day to save them to this phone.',
    )
  })

  it('is the lifecycle rule the bucket is documented to carry', () => {
    const runbook = readFileSync(
      resolve(__dirname, '../../../docs/claude/RUNPOD.md'),
      'utf8',
    )
    expect(runbook).toContain(`--expire-days ${STEMS_KEPT_DAYS}`)
    expect(runbook).toMatch(
      new RegExp(`\`runpod-dev/\` objects after ${STEMS_KEPT_DAYS} day`, 'u'),
    )
  })
})

describe('after the store says yes', () => {
  // A purchase or a restore reaches the server through RevenueCat's
  // webhook, usually within seconds, so /me is asked again until it has.
  const waiting: KaraokeSongs = {
    left: 0,
    subscribed: false,
    renewsAt: null,
    perPeriod: 20,
  }

  it('asks again until the server has heard, and says so meanwhile', async () => {
    const answers = [waiting, waiting, subscriber]
    const seen: boolean[] = []
    const refresh = vi.fn(async () => {
      seen.push(songsOnTheWay())
      return Promise.resolve(answers.shift() ?? subscriber)
    })
    const wait = vi.fn(async () => Promise.resolve())

    await expect(awaitSubscription(refresh, { wait })).resolves.toEqual(
      subscriber,
    )
    expect(refresh).toHaveBeenCalledTimes(3)
    expect(wait).toHaveBeenCalledTimes(2)
    expect(seen).toEqual([true, true, true])
    expect(songsOnTheWay()).toBe(false)
  })

  it('settles for what it last heard after a few tries', async () => {
    const refresh = vi.fn(async () => Promise.resolve(waiting))

    await expect(
      awaitSubscription(refresh, { tries: 3, wait: async () => undefined }),
    ).resolves.toEqual(waiting)
    expect(refresh).toHaveBeenCalledTimes(3)
    expect(songsOnTheWay()).toBe(false)
  })
})
