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

const identity = vi.hoisted(() => ({ made: 0 }))
vi.mock('@/db/services/singer-identity', () => ({
  ensureSingerIdentity: vi.fn(async () => {
    identity.made += 1
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

import { closeCloudOffer, cloudOffer, openCloudOffer, resetCloudOfferForTests, } from '@/features/karaoke-room/cloud-offer-store'
import { resetKaraokeSongsForTests } from '@/features/karaoke-room/karaoke-songs'
import { setMicActive } from '@/stores/mic-store'
import { registerShellApi } from '@/stores/native-shell-store'
import { HOLDOUT_SHARE, OFFER_GROUP_KEY, OFFER_SHOWN_KEY, onboardingOfferGroup, onboardingOfferShown, openOnboardingOffer, prepareOnboardingOffer, replayOnboardingOffer, resetOnboardingOfferForTests, } from './onboarding-offer'

const free: KaraokeSongs = {
  left: 0,
  subscribed: false,
  renewsAt: null,
  perPeriod: 20,
}

/** Beat 9 as the onboarding runs it: the asks, then the offer. */
const beatNine = async (): Promise<boolean> =>
  openOnboardingOffer(prepareOnboardingOffer())

let unregister: (() => void) | null = null

beforeEach(() => {
  localStorage.clear()
  resetOnboardingOfferForTests()
  resetCloudOfferForTests()
  resetKaraokeSongsForTests(free)
  identity.made = 0
  server.next = null
  build.cloud = true
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
  })

  it('offers it to the other nine', () => {
    expect(onboardingOfferGroup(() => 0.1)).toBe('offer')
    expect(onboardingOfferGroup(() => 0)).toBe('offer')
  })

  it('reads a group already kept, as a walk seeds it', () => {
    localStorage.setItem(OFFER_GROUP_KEY, 'holdout')
    expect(onboardingOfferGroup(() => 0.9)).toBe('holdout')
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
    unregister = registerShellApi({
      pushSettings: vi.fn(),
      karaokeSubscription: {
        subscribe: async () => Promise.resolve('cancelled' as const),
        restore: async () => Promise.resolve('nothing' as const),
        storeSubscribed: async () => Promise.resolve(true),
      },
    })
    await expect(prepareOnboardingOffer()).resolves.toBe('entitled')
    expect(await beatNine()).toBe(false)
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

describe('a layer left while the asks answer', () => {
  it('opens no offer over what is under it, and marks nothing', async () => {
    onboardingOfferGroup(() => 0.5)
    expect(await openOnboardingOffer(prepareOnboardingOffer(), () => false)).toBe(
      false,
    )
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
