// ============================================================
// Beat 9: the Cloud offer, once, after the line, never to a subscriber
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Songs from '@/features/karaoke-room/karaoke-songs'
import type { KaraokeSongs } from '@/features/karaoke-room/karaoke-songs'

// A build with Cloud, as every build with the onboarding is.
const build = vi.hoisted(() => ({ cloud: true }))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  get KARAOKE_IMPORT() {
    return build.cloud
  },
}))

const identity = vi.hoisted(() => ({
  made: 0,
  hold: null as Promise<void> | null,
}))
vi.mock('@/db/services/singer-identity', () => ({
  ensureSingerIdentity: vi.fn(async () => {
    identity.made += 1
    if (identity.hold !== null) await identity.hold
    return Promise.resolve(true)
  }),
}))

const server = vi.hoisted(() => ({ next: null as KaraokeSongs | null }))
vi.mock('@/features/karaoke-room/karaoke-songs', async (importOriginal) => {
  const actual = await importOriginal<typeof Songs>()
  return {
    ...actual,
    refreshKaraokeSongs: vi.fn(async () => {
      if (server.next !== null) actual.resetKaraokeSongsForTests(server.next)
      return Promise.resolve(actual.karaokeSongs())
    }),
  }
})

import { BEFORE_OFFER_MS, closeCloudOffer, cloudOffer, cloudPlan, openCloudOffer, resetCloudOfferForTests, } from '@/features/karaoke-room/cloud-offer-store'
import { resetKaraokeSongsForTests } from '@/features/karaoke-room/karaoke-songs'
import { setMicActive } from '@/stores/mic-store'
import type { KaraokeSubscriptionApi } from '@/stores/native-shell-store'
import { registerShellApi } from '@/stores/native-shell-store'
import { askOfferPrice, HOLDOUT_SHARE, OFFER_GROUP_KEY, OFFER_SHOWN_KEY, offerSkipNow, onboardingOfferGroup, onboardingOfferShown, openOnboardingOffer, prepareOnboardingOffer, replayOnboardingOffer, resetOnboardingOfferForTests, } from './onboarding-offer'

const free: KaraokeSongs = {
  left: 0,
  subscribed: false,
  renewsAt: null,
  perPeriod: 20,
}

/** The month's plan as the store prices it. */
const PLAN = { priceText: '€4.99', title: 'Mercury Pitch Cloud' }

/** A store with the plan to sell, priced; any call may be swapped. */
function store(
  overrides: Partial<KaraokeSubscriptionApi> = {},
): KaraokeSubscriptionApi {
  return {
    subscribe: async () => Promise.resolve('cancelled' as const),
    restore: async () => Promise.resolve('nothing' as const),
    offer: async () => Promise.resolve(PLAN),
    ...overrides,
  }
}

/** Beat 9 as the onboarding runs it: the asks, then the offer. */
const beatNine = async (): Promise<boolean> =>
  openOnboardingOffer(prepareOnboardingOffer())

// The onboarding's counts (S7b §7), heard on their way to the funnel.
const funnel = vi.hoisted(() => ({ sent: [] as string[] }))
vi.mock('@/features/onboarding/funnel', () => ({
  trackNativeOnboarding: (event: string) => funnel.sent.push(event),
}))

let unregister: (() => void) | null = null

/** The shell's API, with `api` as its store. */
function withStore(api: KaraokeSubscriptionApi = store()): void {
  unregister?.()
  unregister = registerShellApi({
    pushSettings: vi.fn(),
    karaokeSubscription: api,
  })
}

beforeEach(() => {
  localStorage.clear()
  resetOnboardingOfferForTests()
  resetCloudOfferForTests()
  resetKaraokeSongsForTests(free)
  identity.made = 0
  identity.hold = null
  server.next = null
  build.cloud = true
  funnel.sent = []
})

afterEach(() => {
  unregister?.()
  unregister = null
  resetCloudOfferForTests()
  resetOnboardingOfferForTests()
  setMicActive(false)
  localStorage.clear()
})

describe('the holdout', () => {
  it('holds one install in ten out, drawn once and kept', () => {
    expect(HOLDOUT_SHARE).toBe(0.1)
    expect(onboardingOfferGroup(() => 0.05)).toBe('holdout')
    expect(localStorage.getItem(OFFER_GROUP_KEY)).toBe('holdout')
    // Kept: a later draw changes nothing.
    expect(onboardingOfferGroup(() => 0.99)).toBe('holdout')
    // Counted once, as it is drawn, so its retention can be read apart.
    expect(funnel.sent).toEqual(['native_onboarding_group_holdout'])
  })

  it('offers it to the other nine', () => {
    expect(onboardingOfferGroup(() => 0.1)).toBe('offer')
    expect(onboardingOfferGroup(() => 0)).toBe('offer')
    expect(funnel.sent).toEqual(['native_onboarding_group_offer'])
  })

  it('reads a group already kept, as a walk seeds it, and counts no draw', () => {
    localStorage.setItem(OFFER_GROUP_KEY, 'holdout')
    expect(onboardingOfferGroup(() => 0.9)).toBe('holdout')
    expect(funnel.sent).toEqual([])
  })

  it('opens no offer for the holdout, and makes no identity for it', async () => {
    onboardingOfferGroup(() => 0)
    await expect(prepareOnboardingOffer()).resolves.toBe('holdout')
    expect(await beatNine()).toBe(false)
    expect(cloudOffer()).toBeNull()
    expect(identity.made).toBe(0)
  })
})

describe('beat 9 for the offer group', () => {
  beforeEach(() => {
    onboardingOfferGroup(() => 0.5)
    withStore()
  })

  it('opens the Cloud offer, as the onboarding, once per install', async () => {
    expect(await beatNine()).toBe(true)
    expect(cloudOffer()).toEqual({ source: 'onboarding', view: 'offer' })
    expect(identity.made).toBe(1)
    expect(localStorage.getItem(OFFER_SHOWN_KEY)).toBe('shown')

    closeCloudOffer('done')
    resetCloudOfferForTests()
    await expect(prepareOnboardingOffer()).resolves.toBe('shown')
    expect(await beatNine()).toBe(false)
  })

  it('opens none when the server says the subscription is held', async () => {
    server.next = { ...free, subscribed: true, left: 20 }
    expect(await beatNine()).toBe(false)
    expect(cloudOffer()).toBeNull()
    expect(onboardingOfferShown()).toBe(false)
  })

  it('opens none when the store holds it, before the server has heard', async () => {
    withStore(store({ storeSubscribed: async () => Promise.resolve(true) }))
    await expect(prepareOnboardingOffer()).resolves.toBe('entitled')
    expect(await beatNine()).toBe(false)
  })

  it('hands the sheet the price it saw, so the offer opens on it', async () => {
    expect(await beatNine()).toBe(true)
    expect(cloudPlan()).toEqual(PLAN)
  })

  it('opens none in the week after a Not now, from any offer', async () => {
    // Settings' "See the plan", asked for, then Not now.
    expect(openCloudOffer('settings')).toBe(true)
    closeCloudOffer('not-now')
    await expect(prepareOnboardingOffer()).resolves.toBe('not-now')
    expect(await beatNine()).toBe(false)
    expect(identity.made).toBe(0)
  })

  it('waits out a mic still closing as the score shows, and opens none over a live one', async () => {
    setMicActive(true)
    const prepared = prepareOnboardingOffer()
    await expect(prepared).resolves.toBeNull()
    // Still listening as the offer would open: the sheet's own cap holds.
    expect(await openOnboardingOffer(prepared)).toBe(false)
    expect(onboardingOfferShown()).toBe(false)
    setMicActive(false)
    expect(await openOnboardingOffer(prepared)).toBe(true)
  })
})

describe('nothing to buy at a price', () => {
  beforeEach(() => {
    onboardingOfferGroup(() => 0.5)
  })

  it('opens none with no store here, says so at once, and makes no identity', async () => {
    await expect(prepareOnboardingOffer()).resolves.toBe('unavailable')
    expect(offerSkipNow()).toBe('unavailable')
    expect(await beatNine()).toBe(false)
    expect(cloudOffer()).toBeNull()
    expect(onboardingOfferShown()).toBe(false)
    expect(identity.made).toBe(0)
  })

  it('opens none when the store has no plan to sell yet', async () => {
    withStore(store({ offer: async () => Promise.resolve(null) }))
    expect(offerSkipNow()).toBeNull()
    await expect(prepareOnboardingOffer()).resolves.toBe('unavailable')
    expect(await beatNine()).toBe(false)
    expect(identity.made).toBe(0)
  })

  it('opens none when the store cannot say what it costs', async () => {
    withStore(
      store({ offer: async () => Promise.reject(new Error('offline')) }),
    )
    await expect(prepareOnboardingOffer()).resolves.toBe('unavailable')
    expect(await beatNine()).toBe(false)
    expect(identity.made).toBe(0)
  })

  it('opens none when the store is still silent after the wait', async () => {
    vi.useFakeTimers()
    try {
      withStore(store({ offer: async () => new Promise(() => undefined) }))
      const prepared = prepareOnboardingOffer()
      await vi.advanceTimersByTimeAsync(BEFORE_OFFER_MS)
      await expect(prepared).resolves.toBe('unavailable')
      expect(identity.made).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('the price, asked early, and one wait for it all', () => {
  beforeEach(() => {
    onboardingOfferGroup(() => 0.5)
  })

  it('asks the store for the price as the onboarding opens, and makes no identity', async () => {
    const offer = vi.fn(async () => Promise.resolve(PLAN))
    withStore(store({ offer }))

    const price = askOfferPrice()

    expect(offer).toHaveBeenCalledTimes(1)
    await expect(price).resolves.toBe(true)
    expect(identity.made).toBe(0)
  })

  it('goes on that price at the end, and asks the store no more', async () => {
    const offer = vi.fn(async () => Promise.resolve(PLAN))
    withStore(store({ offer }))
    const price = askOfferPrice()

    await expect(prepareOnboardingOffer(price)).resolves.toBeNull()

    expect(offer).toHaveBeenCalledTimes(1)
  })

  it('asks nothing for the install held out', () => {
    // Drawn into it, as the onboarding first opened.
    resetOnboardingOfferForTests()
    localStorage.setItem(OFFER_GROUP_KEY, 'holdout')
    const offer = vi.fn(async () => Promise.resolve(PLAN))
    withStore(store({ offer }))

    expect(askOfferPrice()).toBeNull()
    expect(offer).not.toHaveBeenCalled()
  })

  it('waits three seconds in all for a late price and the asks after it, not three each', async () => {
    vi.useFakeTimers()
    try {
      withStore(
        store({
          offer: async () =>
            new Promise((resolve) => {
              setTimeout(() => resolve(PLAN), BEFORE_OFFER_MS - 100)
            }),
        }),
      )
      // The server never answers.
      identity.hold = new Promise<void>(() => undefined)
      let decided = false
      const prepared = prepareOnboardingOffer().then((why) => {
        decided = true
        return why
      })

      await vi.advanceTimersByTimeAsync(BEFORE_OFFER_MS - 1)
      const waiting = !decided
      await vi.advanceTimersByTimeAsync(1)

      expect(waiting).toBe(true)
      expect(decided).toBe(true)
      // On what is known: the offer opens.
      await expect(prepared).resolves.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('a layer left while the asks answer', () => {
  it('opens no offer over what is under it, and marks nothing', async () => {
    onboardingOfferGroup(() => 0.5)
    withStore()
    expect(
      await openOnboardingOffer(prepareOnboardingOffer(), () => false),
    ).toBe(false)
    expect(cloudOffer()).toBeNull()
    expect(onboardingOfferShown()).toBe(false)
  })
})

describe('a build without Cloud', () => {
  it('has nothing to offer, and asks nothing', async () => {
    build.cloud = false
    onboardingOfferGroup(() => 0.5)
    await expect(prepareOnboardingOffer()).resolves.toBe('no-cloud')
    expect(await beatNine()).toBe(false)
    expect(identity.made).toBe(0)
  })
})

describe('replaying the onboarding', () => {
  it('brings beat 9 back, in the group that is offered it', () => {
    onboardingOfferGroup(() => 0)
    localStorage.setItem(OFFER_SHOWN_KEY, 'shown')
    replayOnboardingOffer()
    expect(onboardingOfferGroup()).toBe('offer')
    expect(onboardingOfferShown()).toBe(false)
  })
})
