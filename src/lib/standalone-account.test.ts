import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LaunchOffer } from '@/db/services/billing-service'

const mocks = vi.hoisted(() => ({
  tokenValid: true,
  fetchMe: vi.fn(),
  fetchBillingMe: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('@/db/services/auth-service', () => ({
  fetchMe: mocks.fetchMe,
  hasValidToken: () => mocks.tokenValid,
  logout: mocks.logout,
}))
vi.mock('@/db/services/billing-service', () => ({
  fetchBillingMe: mocks.fetchBillingMe,
}))
vi.mock('@/db/services/user-service', () => ({ authVersion: () => 0 }))

const { credits, offer, refreshAccount, refreshCredits, signOutStandalone } =
  await import('./standalone-account')

const COUNTING: LaunchOffer = {
  state: 'counting',
  used: 2,
  goal: 5,
  deadline: '2026-10-23T23:59:59.999Z',
  bonusCredits: 30,
}

function billing(overrides: Record<string, unknown> = {}) {
  return {
    creditBalance: 3,
    entitlements: [],
    stripeConfigured: true,
    offer: COUNTING,
    ...overrides,
  }
}

/** Puts an offer on the signal, as a signed-in page would have it. */
async function withOffer(): Promise<void> {
  mocks.fetchBillingMe.mockResolvedValueOnce(billing())
  await refreshCredits()
  expect(offer()).toEqual(COUNTING)
}

beforeEach(() => {
  mocks.tokenValid = true
  mocks.fetchMe.mockReset()
  mocks.fetchBillingMe.mockReset()
})

describe('the launch offer beside the credits', () => {
  it('reads the offer with the balance', async () => {
    mocks.fetchBillingMe.mockResolvedValueOnce(billing())
    await refreshCredits()
    expect(credits()).toBe(3)
    expect(offer()).toEqual(COUNTING)
  })

  it('holds no offer when /me has none, or no answer', async () => {
    await withOffer()
    mocks.fetchBillingMe.mockResolvedValueOnce(billing({ offer: null }))
    await refreshCredits()
    expect(offer()).toBeNull()

    await withOffer()
    mocks.fetchBillingMe.mockResolvedValueOnce(billing({ offer: undefined }))
    await refreshCredits()
    expect(offer()).toBeNull()

    await withOffer()
    mocks.fetchBillingMe.mockResolvedValueOnce(null)
    await refreshCredits()
    expect(offer()).toBeNull()

    await withOffer()
    mocks.fetchBillingMe.mockRejectedValueOnce(new Error('offline'))
    await refreshCredits()
    expect(offer()).toBeNull()
  })

  it('drops the offer on sign-out', async () => {
    await withOffer()
    signOutStandalone()
    expect(offer()).toBeNull()
    expect(credits()).toBeNull()
  })

  it('drops the offer when the token is gone', async () => {
    await withOffer()
    mocks.tokenValid = false
    await refreshAccount()
    expect(offer()).toBeNull()
  })

  it('drops the offer when the account cannot be read', async () => {
    await withOffer()
    mocks.fetchMe.mockResolvedValueOnce(null)
    await refreshAccount()
    expect(offer()).toBeNull()

    await withOffer()
    mocks.fetchMe.mockRejectedValueOnce(new Error('offline'))
    await refreshAccount()
    expect(offer()).toBeNull()
  })
})
