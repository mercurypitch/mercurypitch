// ============================================================
// The Cloud offer's caps, and what is asked before it opens (S7 §3.9, §5)
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Notifications from '@/stores/notifications-store'
import type * as Songs from './karaoke-songs'
import type { KaraokeSongs } from './karaoke-songs'

const identity = vi.hoisted(() => ({
  order: [] as string[],
  answer: Promise.resolve(true) as Promise<boolean>,
}))
vi.mock('@/db/services/singer-identity', () => ({
  ensureSingerIdentity: vi.fn(async () => {
    identity.order.push('identity')
    return identity.answer
  }),
}))

const server = vi.hoisted(() => ({ next: null as KaraokeSongs | null }))
vi.mock('./karaoke-songs', async (importOriginal) => {
  const actual = await importOriginal<typeof Songs>()
  return {
    ...actual,
    refreshKaraokeSongs: vi.fn(async () => {
      identity.order.push('server')
      if (server.next !== null) actual.resetKaraokeSongsForTests(server.next)
      return Promise.resolve(actual.karaokeSongs())
    }),
    awaitSubscription: vi.fn(async () =>
      Promise.resolve(actual.karaokeSongs()),
    ),
  }
})

// The app's counts (S7b §7), heard on their way to the funnel.
const counts = vi.hoisted(() => ({ sent: [] as string[] }))
vi.mock('@/lib/analytics', () => ({
  trackEvent: (event: string) => counts.sent.push(event),
}))

const said = vi.hoisted(() => ({ lines: [] as string[] }))
vi.mock('@/stores/notifications-store', async (importOriginal) => ({
  ...(await importOriginal<typeof Notifications>()),
  showNotification: vi.fn((line: string) => {
    said.lines.push(line)
  }),
}))

import { setMicActive } from '@/stores/mic-store'
import type { KaraokeCarryOutcome } from '@/stores/native-shell-store'
import { registerRunControls, registerShellApi, } from '@/stores/native-shell-store'
import { askBeforeOffering, BEFORE_OFFER_MS, CARRIED_LINE, closeCloudOffer, cloudOffer, forgetUnaskedOffers, NOT_NOW_QUIET_MS, openCloudOffer, resetCloudOfferForTests, settleCloudAfterSignIn, showCloudSubscribed, unaskedRefusal, } from './cloud-offer-store'
import { awaitSubscription, resetKaraokeSongsForTests } from './karaoke-songs'

const NOW = Date.UTC(2026, 9, 16, 12)
const DAY_MS = 24 * 60 * 60 * 1000

const free: KaraokeSongs = {
  left: 0,
  subscribed: false,
  renewsAt: null,
  perPeriod: 20,
}

beforeEach(() => {
  resetCloudOfferForTests()
  resetKaraokeSongsForTests(free)
  identity.order = []
  identity.answer = Promise.resolve(true)
  server.next = null
  said.lines = []
  counts.sent = []
  vi.mocked(awaitSubscription).mockClear()
})

afterEach(() => {
  resetCloudOfferForTests()
  setMicActive(false)
  vi.useRealTimers()
})

describe('an offer the singer asked for', () => {
  it('opens from Import and from See the plan, whatever came before', () => {
    expect(openCloudOffer('onboarding', 'offer', NOW)).toBe(true)
    closeCloudOffer('not-now', NOW)

    expect(openCloudOffer('import', 'offer', NOW + 1)).toBe(true)
    closeCloudOffer('not-now', NOW + 1)
    expect(openCloudOffer('settings', 'offer', NOW + 2)).toBe(true)
    expect(cloudOffer()).toEqual({ source: 'settings', view: 'offer' })
  })
})

describe('an offer nobody asked for', () => {
  it('opens once a session', () => {
    expect(openCloudOffer('onboarding', 'offer', NOW)).toBe(true)
    closeCloudOffer('done', NOW)

    expect(unaskedRefusal(NOW + 1)).toBe('session')
    expect(openCloudOffer('onboarding', 'offer', NOW + 1)).toBe(false)
    expect(cloudOffer()).toBeNull()
  })

  it('stays away for 7 days after a Not now, from any offer', () => {
    openCloudOffer('import', 'offer', NOW)
    closeCloudOffer('not-now', NOW)

    expect(unaskedRefusal(NOW + 6 * DAY_MS)).toBe('not-now')
    expect(openCloudOffer('onboarding', 'offer', NOW + 6 * DAY_MS)).toBe(false)
    expect(unaskedRefusal(NOW + NOT_NOW_QUIET_MS)).toBeNull()
    expect(openCloudOffer('onboarding', 'offer', NOW + NOT_NOW_QUIET_MS)).toBe(
      true,
    )
  })

  it('remembers the Not now across a restart, on this phone', () => {
    openCloudOffer('import', 'offer', NOW)
    closeCloudOffer('not-now', NOW)

    // A new session: nothing offered yet, the Not now still kept.
    const kept = localStorage.getItem('mp:cloud-offer-not-now')
    resetCloudOfferForTests()
    if (kept !== null) localStorage.setItem('mp:cloud-offer-not-now', kept)

    expect(unaskedRefusal(NOW + DAY_MS)).toBe('not-now')
  })

  it('starts over for a replayed onboarding: nothing offered, no Not now', () => {
    openCloudOffer('onboarding', 'offer', NOW)
    closeCloudOffer('not-now', NOW)
    expect(unaskedRefusal(NOW + 1)).toBe('session')

    forgetUnaskedOffers()

    expect(unaskedRefusal(NOW + 1)).toBeNull()
    expect(localStorage.getItem('mp:cloud-offer-not-now')).toBeNull()
    expect(openCloudOffer('onboarding', 'offer', NOW + 1)).toBe(true)
  })

  it('takes a closing after a yes from the store as no Not now', () => {
    openCloudOffer('import', 'offer', NOW)
    showCloudSubscribed(false)
    closeCloudOffer('not-now', NOW)

    expect(unaskedRefusal(NOW + 1)).toBeNull()
  })

  it('never opens while the microphone is listening', () => {
    setMicActive(true)

    expect(unaskedRefusal(NOW)).toBe('singing')
    expect(openCloudOffer('onboarding', 'offer', NOW)).toBe(false)
  })

  it('never opens while a song plays, or a run is paused or counting in', () => {
    const run = { playing: true, paused: false, counting: false }
    const unregister = registerRunControls({
      tab: 'singing',
      roomLabel: 'Sing',
      isPlaying: () => run.playing,
      isPaused: () => run.paused,
      isCountingIn: () => run.counting,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      park: vi.fn(),
    })
    try {
      expect(unaskedRefusal(NOW)).toBe('singing')
      run.playing = false
      run.paused = true
      expect(unaskedRefusal(NOW)).toBe('singing')
      run.paused = false
      run.counting = true
      expect(unaskedRefusal(NOW)).toBe('singing')
      run.counting = false
      expect(unaskedRefusal(NOW)).toBeNull()
    } finally {
      unregister()
    }
  })

  it('never opens for a subscriber', () => {
    resetKaraokeSongsForTests({ ...free, left: 12, subscribed: true })

    expect(unaskedRefusal(NOW)).toBe('subscribed')
    expect(openCloudOffer('onboarding', 'offer', NOW)).toBe(false)
  })
})

describe('counted (S7b §7)', () => {
  it('counts the offer each time it shows, by where it opened', () => {
    openCloudOffer('onboarding', 'offer', NOW)
    closeCloudOffer('done', NOW)
    openCloudOffer('settings', 'offer', NOW)
    closeCloudOffer('not-now', NOW)
    openCloudOffer('import', 'offer', NOW)

    expect(counts.sent).toEqual([
      'cloud_view_onboarding',
      'cloud_view_settings',
      'cloud_view_import',
    ])
  })

  it('counts no offer for what follows a yes, nor for one the caps hold back', () => {
    openCloudOffer('import', 'subscribed', NOW)
    closeCloudOffer('done', NOW)
    openCloudOffer('onboarding', 'offer', NOW)
    closeCloudOffer('not-now', NOW)
    counts.sent = []

    expect(openCloudOffer('onboarding', 'offer', NOW + DAY_MS)).toBe(false)
    expect(counts.sent).toEqual([])
  })
})

describe('askBeforeOffering', () => {
  it('makes the identity first, then asks the server and the store', async () => {
    const storeSubscribed = vi.fn(async () => {
      identity.order.push('store')
      return Promise.resolve(true)
    })
    const unregister = registerShellApi({
      pushSettings: vi.fn(),
      karaokeSubscription: {
        subscribe: async () => Promise.resolve('cancelled' as const),
        restore: async () => Promise.resolve('nothing' as const),
        storeSubscribed,
      },
    })
    server.next = { ...free, left: 1, free: 1 }
    try {
      const facts = await askBeforeOffering()

      expect(identity.order[0]).toBe('identity')
      expect(identity.order.slice(1).sort()).toEqual(['server', 'store'])
      expect(facts.storeHolds).toBe(true)
      expect(facts.songs.left).toBe(1)
    } finally {
      unregister()
    }
  })

  it('answers within its bound with what is known, and no store', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    identity.answer = new Promise<boolean>(() => undefined)

    const asking = askBeforeOffering()
    await vi.advanceTimersByTimeAsync(BEFORE_OFFER_MS)

    await expect(asking).resolves.toEqual({ songs: free, storeHolds: false })
  })

  it('takes a store that cannot say as holding nothing', async () => {
    const unregister = registerShellApi({
      pushSettings: vi.fn(),
      karaokeSubscription: {
        subscribe: async () => Promise.resolve('cancelled' as const),
        restore: async () => Promise.resolve('nothing' as const),
        storeSubscribed: async () => Promise.reject(new Error('no store')),
      },
    })
    try {
      await expect(askBeforeOffering()).resolves.toMatchObject({
        storeHolds: false,
      })
    } finally {
      unregister()
    }
  })
})

describe('after a sign-in', () => {
  /** A store whose carry answers `carried`, or fails with it. */
  function store(carried: () => Promise<KaraokeCarryOutcome>): () => void {
    return registerShellApi({
      pushSettings: vi.fn(),
      karaokeSubscription: {
        subscribe: async () => Promise.resolve('cancelled' as const),
        restore: async () => Promise.resolve('nothing' as const),
        carryToAccount: carried,
      },
    })
  }

  it('says the subscription came along, and waits for the songs', async () => {
    const unregister = store(async () => Promise.resolve('moved'))
    try {
      await expect(settleCloudAfterSignIn()).resolves.toBe('moved')
    } finally {
      unregister()
    }

    expect(said.lines).toEqual([CARRIED_LINE])
    expect(CARRIED_LINE).toBe(
      'Your Mercury Pitch Cloud subscription is on this account now.',
    )
    expect(awaitSubscription).toHaveBeenCalledTimes(1)
  })

  it("asks the server for the account's songs when nothing came along", async () => {
    const unregister = store(async () => Promise.resolve('nothing'))
    try {
      await expect(settleCloudAfterSignIn()).resolves.toBe('nothing')
    } finally {
      unregister()
    }

    expect(said.lines).toEqual([])
    expect(identity.order).toEqual(['server'])
  })

  it('still asks the server when the store fails', async () => {
    const unregister = store(async () => Promise.reject(new Error('offline')))
    try {
      await expect(settleCloudAfterSignIn()).resolves.toBe('failed')
    } finally {
      unregister()
    }

    expect(said.lines).toEqual([])
    expect(identity.order).toEqual(['server'])
  })

  it('asks the server alone on a phone without a store', async () => {
    await expect(settleCloudAfterSignIn()).resolves.toBe('nothing')

    expect(identity.order).toEqual(['server'])
  })
})
