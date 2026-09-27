// ============================================================
// The native account state: the token decides, the server fills the card
// ============================================================
//
// S6 audit D1: the web card fell through to "You are signed out" whenever
// /me could not be read, so a phone without a network told a signed-in
// singer they were signed out. Here the token the phone holds answers
// "signed in"; the read only fills in the name, and its failure is named as
// a failure to reach the account (REQ-NAM-049).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthService from '@/db/services/auth-service'
import { readMe } from '@/db/services/auth-service'
import { getAuthToken, setAuthToken } from '@/db/services/user-service'
import { accountCard, accountDisplayName, accountProviderLine, accountReach, accountSignedIn, forgetAccountCard, refreshAccount, resetAccountState, } from './account-state'

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthService>()),
  readMe: vi.fn(),
}))

const readMeMock = vi.mocked(readMe)

function token(sub: string, provider: string): string {
  const body = btoa(
    JSON.stringify({
      sub,
      provider,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}

function me(id: string, name: string, email: string, provider: string) {
  return {
    status: 'ok' as const,
    me: {
      user: {
        id,
        createdAt: '',
        updatedAt: '',
        authProvider: provider as 'apple',
        email,
        emailVerified: true,
        lastLoginAt: null,
        isTestAccount: false,
        testAccountExpiresAt: null,
      },
      profile: { displayName: name },
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  setAuthToken(null)
  resetAccountState()
  readMeMock.mockReset()
})

afterEach(() => {
  setAuthToken(null)
  resetAccountState()
})

describe('the account state', () => {
  it('stays signed in when the account cannot be reached (D1)', async () => {
    setAuthToken(token('user-1', 'apple'))
    readMeMock.mockResolvedValue({ status: 'unreachable' })

    await refreshAccount()

    expect(accountSignedIn()).toBe(true)
    expect(accountReach()).toBe('unreachable')
    expect(getAuthToken()).not.toBeNull()
  })

  it('fills the card from the account when it answers', async () => {
    setAuthToken(token('user-1', 'apple'))
    readMeMock.mockResolvedValue(
      me('user-1', 'Alex', 'singer@example.test', 'apple'),
    )

    await refreshAccount()

    expect(accountReach()).toBe('ok')
    expect(accountCard()).toEqual({
      id: 'user-1',
      name: 'Alex',
      email: 'singer@example.test',
      provider: 'apple',
    })
    expect(accountDisplayName()).toBe('Alex')
    expect(accountProviderLine()).toBe('Signed in with Apple')
  })

  it('keeps the card it had for the same account while it cannot reach it', async () => {
    setAuthToken(token('user-1', 'google'))
    readMeMock.mockResolvedValueOnce(
      me('user-1', 'Alex', 'singer@example.test', 'google'),
    )
    await refreshAccount()
    readMeMock.mockResolvedValueOnce({ status: 'unreachable' })

    await refreshAccount()

    expect(accountReach()).toBe('unreachable')
    expect(accountDisplayName()).toBe('Alex')
  })

  it('shows the card after a restart with no network, from what this phone kept', async () => {
    setAuthToken(token('user-1', 'apple'))
    readMeMock.mockResolvedValueOnce(
      me('user-1', 'Alex', 'singer@example.test', 'apple'),
    )
    await refreshAccount()

    resetAccountState({ keepStored: true })

    expect(accountDisplayName()).toBe('Alex')
  })

  it("never shows another account's card", async () => {
    setAuthToken(token('user-1', 'apple'))
    readMeMock.mockResolvedValueOnce(
      me('user-1', 'Alex', 'singer@example.test', 'apple'),
    )
    await refreshAccount()

    setAuthToken(token('user-2', 'google'))

    expect(accountCard()).toBeNull()
    expect(accountDisplayName()).toBe('Your account')
    expect(accountProviderLine()).toBe('Signed in with Google')
  })

  it('asks the phone to sign in again when the server refuses its session', async () => {
    setAuthToken(token('user-1', 'apple'))
    readMeMock.mockResolvedValue({ status: 'signed-out' })

    await refreshAccount()

    expect(accountSignedIn()).toBe(false)
    expect(getAuthToken()).toBeNull()
  })

  it('asks nothing of the server while nothing is signed in', async () => {
    setAuthToken(token('device-1', 'anonymous'))

    await refreshAccount()

    expect(accountSignedIn()).toBe(false)
    expect(accountReach()).toBe('idle')
    expect(readMeMock).not.toHaveBeenCalled()
  })

  it('forgets the kept card on the way out', async () => {
    setAuthToken(token('user-1', 'apple'))
    readMeMock.mockResolvedValueOnce(
      me('user-1', 'Alex', 'singer@example.test', 'apple'),
    )
    await refreshAccount()

    forgetAccountCard()
    resetAccountState({ keepStored: true })

    expect(accountCard()).toBeNull()
  })
})
