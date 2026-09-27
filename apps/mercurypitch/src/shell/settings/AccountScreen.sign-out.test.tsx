// ============================================================
// Signing out of the phone: one question, and an honest card after
// ============================================================
//
// S6 step 4 (4f, REQ-NAM-054). Sign out asks once. Only this phone's session
// ends: the token goes, the card the phone kept goes, and every record the
// phone holds stays. The card that follows says the account's history is not
// shown rather than gone, with the same promise about the phone's practice.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthMeService from '@/db/services/auth-me-service'
import { readMe } from '@/db/services/auth-me-service'
import type * as AuthService from '@/db/services/auth-service'
import { logout } from '@/db/services/auth-service'
import { setAuthToken } from '@/db/services/user-service'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { ACCOUNT_SIGNED_OUT, ACCOUNT_SIGNED_OUT_HERE, SIGN_OUT_QUESTION, } from './account-copy'
import { markAccountFillDue } from './account-fill'
import { accountCard, refreshAccount, resetAccountState } from './account-state'
import { AccountScreen } from './AccountScreen'
import { confirmSettingsAlert, dismissSettingsAlert, resetSettingsAlert, settingsAlert, } from './settings-alert'
import { SettingsAlert } from './SettingsAlert'

const stand = vi.hoisted(() => ({ signedOutHere: false }))

vi.mock('@/db/services/auth-me-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthMeService>()),
  readMe: vi.fn(),
}))
vi.mock('@/db/services/auth-mfa-service', () => ({
  fetchTwofaStatus: vi.fn(async () => ({
    enabled: false,
    recoveryCodesLeft: 0,
    available: true,
  })),
}))
vi.mock('@/db/services/auth-sessions-service', () => ({
  fetchSessions: vi.fn(async () => []),
}))
vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthService>()),
  logout: vi.fn(),
  needsSignIn: () => stand.signedOutHere,
}))

const readMeMock = vi.mocked(readMe)
const logoutMock = vi.mocked(logout)

function token(): string {
  const body = btoa(
    JSON.stringify({
      sub: 'user-1',
      provider: 'google',
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
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

beforeEach(async () => {
  localStorage.clear()
  stand.signedOutHere = false
  resetSettingsAlert()
  resetAccountState()
  readMeMock.mockReset()
  readMeMock.mockResolvedValue(ALEX)
  // The real logout, as far as this screen can see it, in its order: the
  // phone remembers that an account signed out here, then the token goes.
  logoutMock.mockReset()
  logoutMock.mockImplementation(() => {
    stand.signedOutHere = true
    setAuthToken(null)
  })
  setAuthToken(token())
  await refreshAccount()
  view = renderShell(() => (
    <>
      <AccountScreen />
      <SettingsAlert />
    </>
  ))
  await settle()
})

afterEach(() => {
  view?.unmount()
  view = null
  resetSettingsAlert()
  setAuthToken(null)
  resetAccountState()
})

describe('signing out', () => {
  it('asks first, in the words of 4f', () => {
    view?.container
      .querySelector<HTMLButtonElement>('[data-testid="account-sign-out"]')
      ?.click()

    const alert = document.querySelector('[role="alertdialog"]')
    expect(alert?.textContent).toContain(SIGN_OUT_QUESTION.title)
    expect(alert?.textContent).toContain(SIGN_OUT_QUESTION.text)
    expect(logoutMock).not.toHaveBeenCalled()
  })

  it('keeps the session when the answer is Cancel', () => {
    view?.container
      .querySelector<HTMLButtonElement>('[data-testid="account-sign-out"]')
      ?.click()

    dismissSettingsAlert()

    expect(settingsAlert()).toBeNull()
    expect(logoutMock).not.toHaveBeenCalled()
    expect(text()).toContain('Alex')
  })

  it('ends only this session, forgets the kept card, and says Signed out', async () => {
    markAccountFillDue('user-1')
    view?.container
      .querySelector<HTMLButtonElement>('[data-testid="account-sign-out"]')
      ?.click()

    confirmSettingsAlert()
    await settle()

    expect(logoutMock).toHaveBeenCalledTimes(1)
    expect(accountCard()).toBeNull()
    expect(localStorage.getItem('mp:account-card')).toBeNull()
    expect(localStorage.getItem('mp:account-fill-due')).toBeNull()
    expect(text()).toContain(ACCOUNT_SIGNED_OUT_HERE.title)
    expect(text()).toContain(ACCOUNT_SIGNED_OUT_HERE.body)
    expect(text()).not.toContain(ACCOUNT_SIGNED_OUT.title)
  })

  it('answers Cancel with the alert button on the left', () => {
    view?.container
      .querySelector<HTMLButtonElement>('[data-testid="account-sign-out"]')
      ?.click()

    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '[role="alertdialog"] button',
      ),
    ]
    buttons[0]?.click()

    expect(buttons.map((b) => b.textContent)).toEqual([
      'Cancel',
      SIGN_OUT_QUESTION.confirm,
    ])
    expect(settingsAlert()).toBeNull()
    expect(logoutMock).not.toHaveBeenCalled()
  })
})
