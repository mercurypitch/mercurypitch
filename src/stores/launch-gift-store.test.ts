import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as LaunchGiftStore from './launch-gift-store'

interface Offer {
  code: string
  credits: number
  expiresAt: string | null
}

const LAUNCH: Offer = {
  code: 'LAUNCH',
  credits: 5,
  expiresAt: '2027-01-01T23:59:59.000Z',
}
const NOW = Date.parse('2026-10-20T12:00:00.000Z')
const MINUTE = 60_000

const mocks = vi.hoisted(() => ({
  signedIn: true,
  accountId: 'user-1' as string | null,
  fetchBillingMe: vi.fn(),
  trackEvent: vi.fn(),
  showNotification: vi.fn(),
  loadFeaturedPromo: vi.fn(async () => {}),
  offer: null as Offer | null,
}))

vi.mock('@/db/services/auth-service', () => ({
  hasValidToken: () => mocks.signedIn,
  currentAccountId: () => mocks.accountId,
}))
vi.mock('@/db/services/billing-service', () => ({
  fetchBillingMe: mocks.fetchBillingMe,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: mocks.trackEvent }))
vi.mock('./notifications-store', () => ({
  showNotification: mocks.showNotification,
}))
vi.mock('./promo-store', () => ({
  offeredPromo: () => mocks.offer,
  loadFeaturedPromo: mocks.loadFeaturedPromo,
}))

function me(claims: { code: string; credits: number; claimedAt: string }[]) {
  return {
    creditBalance: claims.reduce((sum, claim) => sum + claim.credits, 0),
    entitlements: [],
    redeemedPromos: claims.map((claim) => claim.code),
    promoClaims: claims,
    stripeConfigured: true,
  }
}

function claimedAgo(ms: number) {
  return {
    code: 'LAUNCH',
    credits: 5,
    claimedAt: new Date(NOW - ms).toISOString(),
  }
}

const CONFIRMED = { upgraded: true, verified: true }

async function freshStore(): Promise<typeof LaunchGiftStore> {
  vi.resetModules()
  return import('./launch-gift-store')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  localStorage.clear()
  mocks.signedIn = true
  mocks.accountId = 'user-1'
  mocks.offer = LAUNCH
  mocks.fetchBillingMe.mockResolvedValue(me([]))
})

describe('the claims of the account signed in here', () => {
  it('knows nothing until /me has answered', async () => {
    const store = await freshStore()
    expect(store.giftClaimed()).toBe(false)
    expect(store.giftWaiting()).toBeNull()
  })

  it('knows the code on offer is claimed once /me lists it', async () => {
    mocks.fetchBillingMe.mockResolvedValue(me([claimedAgo(3 * 60 * MINUTE)]))
    const store = await freshStore()

    await store.syncPromoClaims(CONFIRMED)

    expect(store.giftClaimed()).toBe(true)
    expect(store.giftWaiting()).toBeNull()
  })

  it('offers the one-tap claim to a confirmed account that has not claimed', async () => {
    const store = await freshStore()

    await store.syncPromoClaims(CONFIRMED)

    expect(store.giftClaimed()).toBe(false)
    expect(store.giftWaiting()).toEqual(LAUNCH)
  })

  it('offers no claim to an account whose email is not confirmed', async () => {
    const store = await freshStore()

    await store.syncPromoClaims({ upgraded: true, verified: false })

    expect(store.giftWaiting()).toBeNull()
  })

  it('forgets the account at sign-out, without asking /me', async () => {
    mocks.fetchBillingMe.mockResolvedValue(me([claimedAgo(3 * 60 * MINUTE)]))
    const store = await freshStore()
    await store.syncPromoClaims(CONFIRMED)

    mocks.signedIn = false
    await store.syncPromoClaims(null)

    expect(store.giftClaimed()).toBe(false)
    expect(mocks.fetchBillingMe).toHaveBeenCalledTimes(1)
  })

  it('never asks /me for an anonymous account', async () => {
    const store = await freshStore()
    await store.syncPromoClaims({ upgraded: false, verified: false })
    expect(mocks.fetchBillingMe).not.toHaveBeenCalled()
  })
})

describe('saying the gift landed', () => {
  it('says a fresh claim once, and counts it once', async () => {
    mocks.fetchBillingMe.mockResolvedValue(me([claimedAgo(2 * MINUTE)]))
    const store = await freshStore()

    await store.syncPromoClaims(CONFIRMED)
    await store.syncPromoClaims(CONFIRMED)

    expect(mocks.showNotification).toHaveBeenCalledTimes(1)
    expect(mocks.showNotification).toHaveBeenCalledWith(
      '5 credits added. Try one in Karaoke Night.',
      'success',
    )
    expect(mocks.trackEvent).toHaveBeenCalledTimes(1)
    expect(mocks.trackEvent).toHaveBeenCalledWith('promo_claimed')
  })

  it('stays quiet about a claim the singer has had for hours', async () => {
    mocks.fetchBillingMe.mockResolvedValue(me([claimedAgo(31 * MINUTE)]))
    const store = await freshStore()

    await store.syncPromoClaims(CONFIRMED)

    expect(mocks.showNotification).not.toHaveBeenCalled()
    expect(mocks.trackEvent).not.toHaveBeenCalled()
  })

  it('stays quiet about a claim made with the Claim button', async () => {
    const store = await freshStore()
    store.recordPromoClaim(claimedAgo(0))
    mocks.fetchBillingMe.mockResolvedValue(me([claimedAgo(0)]))

    await store.syncPromoClaims(CONFIRMED)

    expect(mocks.showNotification).not.toHaveBeenCalled()
    expect(mocks.trackEvent).toHaveBeenCalledTimes(1)
    expect(store.giftClaimed()).toBe(true)
  })

  it('lets the confirm link say it, in its own words, and only once', async () => {
    mocks.fetchBillingMe.mockResolvedValue(me([claimedAgo(MINUTE)]))
    const store = await freshStore()

    const confirmed = store.confirmedGiftMessage()
    const synced = store.syncPromoClaims(CONFIRMED)
    const [message] = await Promise.all([confirmed, synced])

    expect(message).toBe('Email confirmed. 5 credits added.')
    expect(mocks.showNotification).not.toHaveBeenCalled()
    expect(mocks.trackEvent).toHaveBeenCalledTimes(1)
  })

  it('leaves the plain confirm toast when the link opened signed out', async () => {
    mocks.signedIn = false
    const store = await freshStore()

    expect(await store.confirmedGiftMessage()).toBeNull()
    expect(mocks.fetchBillingMe).not.toHaveBeenCalled()
  })
})

describe('a sign-up made beside the gift', () => {
  it('says the credits wait for the confirm link', async () => {
    const store = await freshStore()
    expect(store.signUpGiftMessage()).toBe(
      'Confirm your email and your 5 credits arrive.',
    )
  })

  it('says nothing of credits when none are on offer', async () => {
    mocks.offer = null
    const store = await freshStore()
    expect(store.signUpGiftMessage()).toBeNull()
  })

  it('hears the gift ran out when it did before the link was opened', async () => {
    const store = await freshStore()
    store.signUpGiftMessage()
    mocks.offer = null

    expect(await store.confirmedGiftMessage()).toBe(
      'The launch gift has run out. Your account is ready.',
    )
    expect(mocks.trackEvent).not.toHaveBeenCalled()
  })

  it('hears it ran out after a Google sign-up too, once', async () => {
    const store = await freshStore()
    store.rememberGiftOffered(LAUNCH)
    mocks.offer = null

    await store.syncPromoClaims(CONFIRMED)
    await store.syncPromoClaims(CONFIRMED)

    expect(mocks.showNotification).toHaveBeenCalledTimes(1)
    expect(mocks.showNotification).toHaveBeenCalledWith(
      'The launch gift has run out. Your account is ready.',
      'info',
    )
  })

  it('hears nothing of a run-out while the code is still on offer', async () => {
    // This address claimed it on an account since deleted: nothing to say.
    const store = await freshStore()
    store.signUpGiftMessage()

    expect(await store.confirmedGiftMessage()).toBeNull()
    expect(mocks.showNotification).not.toHaveBeenCalled()
  })

  it('waits for an unconfirmed account rather than calling it run out', async () => {
    const store = await freshStore()
    store.rememberGiftOffered(LAUNCH)
    mocks.offer = null

    await store.syncPromoClaims({ upgraded: true, verified: false })

    expect(mocks.showNotification).not.toHaveBeenCalled()
  })

  it('forgets a promise more than two weeks old', async () => {
    const store = await freshStore()
    store.rememberGiftOffered(LAUNCH, NOW - store.GIFT_EXPECTED_MS - MINUTE)
    mocks.offer = null

    expect(await store.confirmedGiftMessage()).toBeNull()
  })
})

// The header and the confirm banner call these without waiting on them, so a
// failed read must end in no toast, never in an unhandled rejection.
describe('a read that fails', () => {
  it('leaves the header with nothing to say, and no rejection', async () => {
    const store = await freshStore()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.fetchBillingMe.mockRejectedValue(new Error('offline'))

    await expect(store.syncPromoClaims(CONFIRMED)).resolves.toBeUndefined()
    expect(store.giftClaimed()).toBe(false)
    expect(mocks.showNotification).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('leaves the confirm link its plain toast', async () => {
    const store = await freshStore()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.fetchBillingMe.mockRejectedValue(new Error('offline'))

    await expect(store.confirmedGiftMessage()).resolves.toBeNull()
    // And the next sync is not held back by a confirm that never finished.
    mocks.fetchBillingMe.mockResolvedValue(me([claimedAgo(MINUTE)]))
    await store.syncPromoClaims(CONFIRMED)
    expect(mocks.showNotification).toHaveBeenCalledWith(
      '5 credits added. Try one in Karaoke Night.',
      'success',
    )
    warn.mockRestore()
  })
})
