// ============================================================
// The Account screen: what an account adds, or who is signed in
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthMeService from '@/db/services/auth-me-service'
import { readMe } from '@/db/services/auth-me-service'
import { setAuthToken } from '@/db/services/user-service'
import { actAsIpad } from '@/tests/helpers/ipad-navigator'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { ACCOUNT_OFFLINE, ACCOUNT_SIGNED_OUT, accountPromises, } from './account-copy'
import { refreshAccount, resetAccountState } from './account-state'
import { AccountScreen } from './AccountScreen'
import { resetSignIn, signInOpen } from './sign-in-state'

vi.mock('@/db/services/auth-me-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthMeService>()),
  readMe: vi.fn(),
}))

const readMeMock = vi.mocked(readMe)

function token(provider: string): string {
  const body = btoa(
    JSON.stringify({
      sub: 'user-1',
      provider,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}

const ALEX = {
  status: 'ok' as const,
  me: {
    user: {
      id: 'user-1',
      createdAt: '',
      updatedAt: '',
      authProvider: 'google' as const,
      email: 'singer@example.test',
      emailVerified: true,
      lastLoginAt: null,
      isTestAccount: false,
      testAccountExpiresAt: null,
    },
    profile: { displayName: 'Alex' },
  },
}

let view: RenderedShell | null = null

function text(): string {
  return view?.container.textContent ?? ''
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}

beforeEach(() => {
  localStorage.clear()
  setAuthToken(null)
  resetAccountState()
  readMeMock.mockReset()
})

afterEach(() => {
  view?.unmount()
  view = null
  setAuthToken(null)
  resetAccountState()
})

describe('the Account screen', () => {
  it('says what an account adds while there is none', () => {
    view = renderShell(() => <AccountScreen />)

    expect(text()).toContain(ACCOUNT_SIGNED_OUT.title)
    for (const promise of accountPromises()) expect(text()).toContain(promise)
    expect(readMeMock).not.toHaveBeenCalled()
  })

  it('opens the sign-in sheet from its one button while there is no account', () => {
    resetSignIn()
    view = renderShell(() => <AccountScreen />)

    view.container
      .querySelector<HTMLButtonElement>('[data-testid="account-sign-in"]')
      ?.click()

    expect(signInOpen()).toBe(true)
    resetSignIn()
  })

  it('keeps a signed-in singer signed in with no network, and says why the card is thin (D1)', async () => {
    setAuthToken(token('google'))
    readMeMock.mockResolvedValue({ status: 'unreachable' })

    view = renderShell(() => <AccountScreen />)
    await settle()

    expect(text()).toContain(ACCOUNT_OFFLINE.title)
    expect(text()).toContain(ACCOUNT_OFFLINE.body)
    expect(text()).toContain('Signed in with Google')
    expect(text()).not.toContain(ACCOUNT_SIGNED_OUT.title)
    expect(text()).not.toMatch(/signed out/iu)
  })

  it('reads the account again on Try again, and drops the note once it answers', async () => {
    setAuthToken(token('google'))
    readMeMock.mockResolvedValueOnce({ status: 'unreachable' })
    view = renderShell(() => <AccountScreen />)
    await settle()
    readMeMock.mockResolvedValueOnce(ALEX)

    view.container
      .querySelector<HTMLButtonElement>('[data-testid="account-retry"]')
      ?.click()
    await settle()

    expect(readMeMock).toHaveBeenCalledTimes(2)
    expect(text()).not.toContain(ACCOUNT_OFFLINE.title)
    expect(text()).toContain('Alex')
    expect(text()).toContain('singer@example.test')
  })

  it('names the account from what the phone kept before the network went', async () => {
    setAuthToken(token('google'))
    readMeMock.mockResolvedValueOnce(ALEX)
    await refreshAccount()
    readMeMock.mockResolvedValueOnce({ status: 'unreachable' })

    view = renderShell(() => <AccountScreen />)
    await settle()

    expect(text()).toContain('Alex')
    expect(text()).toContain(ACCOUNT_OFFLINE.title)
  })
})

describe('on an iPad', () => {
  it('says the practice is kept on this iPad, and what an account adds to it', () => {
    const restore = actAsIpad()
    try {
      view = renderShell(() => <AccountScreen />)

      expect(text()).toContain('Everything you practice is kept on this iPad.')
      expect(text()).toContain(
        'Your whole history, not only what this iPad keeps',
      )
      expect(text()).toContain('On your next iPad, and on the web')
      expect(text()).toContain('Still yours if this iPad is lost')
      expect(text()).toContain('Takes stay on this iPad.')
      expect(text()).not.toMatch(/\bphones?\b/iu)
    } finally {
      restore()
    }
  })
})
