import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MeRead } from '@/db/services/auth-me-service'
import type { MeResponse } from '@/db/services/auth-service'
import type { LaunchOffer } from '@/db/services/billing-service'
import { NO_ANSWER_TEXT } from '@/lib/no-answer-copy'

const mocks = vi.hoisted(() => ({
  tokenValid: true,
  // A page that loads with a token asks at once (the authVersion effect).
  readMe: vi.fn(async (): Promise<MeRead> => ({ status: 'signed-out' })),
  fetchBillingMe: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('@/db/services/auth-service', () => ({
  hasValidToken: () => mocks.tokenValid,
  logout: mocks.logout,
}))
vi.mock('@/db/services/auth-me-service', () => ({ readMe: mocks.readMe }))
vi.mock('@/db/services/billing-service', () => ({
  fetchBillingMe: mocks.fetchBillingMe,
}))
vi.mock('@/db/services/user-service', () => ({ authVersion: () => 0 }))

const {
  accountReady,
  credits,
  ensureAccountKnown,
  offer,
  refreshAccount,
  refreshCredits,
  signedIn,
  signOutStandalone,
} = await import('./standalone-account')

const SIGNED_IN: MeResponse = {
  user: {
    id: 'user-1',
    email: 'singer@example.test',
    authProvider: 'google',
  } as MeResponse['user'],
  profile: null,
}

/** What the next read of /api/auth/me comes back with. */
function serverSays(read: MeRead): void {
  mocks.readMe.mockResolvedValueOnce(read)
}

/** A page that has read a signed-in account, with an offer beside it. */
async function signedInHere(): Promise<void> {
  serverSays({ status: 'ok', me: SIGNED_IN })
  mocks.fetchBillingMe.mockResolvedValue(billing())
  await refreshAccount()
  await refreshCredits()
  expect(signedIn()).toBe(true)
  expect(accountReady()).toBe(true)
}

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
  mocks.readMe.mockReset()
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

  it('drops the offer when the server says nobody is signed in', async () => {
    await withOffer()
    serverSays({ status: 'signed-out' })
    await refreshAccount()
    expect(offer()).toBeNull()
  })

  it('keeps the offer when /me got no answer', async () => {
    await signedInHere()
    serverSays({ status: 'unreachable' })
    await refreshAccount()
    expect(offer()).toEqual(COUNTING)
  })
})

// The band split's preflight decides from this state. A read of /me that got
// no answer (offline, or refused while the API is out of reach) is not a
// signed-out answer: read as one, it sent a signed-in singer to sign in, and
// the page did not ask again until something signed in or out.
describe('who is signed in', () => {
  it('keeps the account when /me got no answer, and asks again next time', async () => {
    await signedInHere()

    serverSays({ status: 'unreachable' })
    await refreshAccount()

    expect(signedIn()).toBe(true)
    expect(accountReady()).toBe(false)
  })

  it('reads a session the server refused as signed out', async () => {
    await signedInHere()

    serverSays({ status: 'signed-out' })
    await refreshAccount()

    expect(signedIn()).toBe(false)
    expect(accountReady()).toBe(true)
  })

  it('asks as the press when a press has to know, and not once it knows', async () => {
    await signedInHere()
    serverSays({ status: 'unreachable' })
    await refreshAccount()
    mocks.readMe.mockClear()

    serverSays({ status: 'ok', me: SIGNED_IN })
    await ensureAccountKnown()
    await ensureAccountKnown()

    expect(mocks.readMe).toHaveBeenCalledExactlyOnceWith({ userAction: true })
    expect(accountReady()).toBe(true)
  })

  it('says it could not reach our servers when a press still cannot know', async () => {
    await signedInHere()
    serverSays({ status: 'unreachable' })
    await refreshAccount()

    serverSays({ status: 'unreachable' })
    await expect(ensureAccountKnown()).rejects.toThrow(NO_ANSWER_TEXT)
    expect(signedIn()).toBe(true)
  })
})
