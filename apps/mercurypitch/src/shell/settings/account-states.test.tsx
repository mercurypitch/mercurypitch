// ============================================================
// The account states, read the same way by Settings and Account
// ============================================================
//
// S6 step 12. The four states the build list names, and the one a sign-out
// leaves behind, each through the Settings root and the Account screen:
//
//   no token          no account yet: the offer tops Settings, and Account
//                     says what one adds
//   anonymous token   the same: the phone's own identity is not an account
//   signed in         the name, how it signs in, and Delete account
//   offline           still signed in (D1, REQ-NAM-049): the card the phone
//                     kept, a note, and nothing that reads as signed out
//   signed out here   the Account row with Sign in and no offer; Account
//                     says Signed out (REQ-NAM-054)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthMeService from '@/db/services/auth-me-service'
import { readMe } from '@/db/services/auth-me-service'
import { fetchTwofaStatus } from '@/db/services/auth-mfa-service'
import type * as AuthService from '@/db/services/auth-service'
import { fetchSessions } from '@/db/services/auth-sessions-service'
import { setAuthToken } from '@/db/services/user-service'
import type * as VoiceTakeService from '@/db/services/voice-take-service'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { resetRunShell } from '../run-shell-store'
import { ACCOUNT_OFFLINE, ACCOUNT_ROW, ACCOUNT_SIGNED_OUT, ACCOUNT_SIGNED_OUT_HERE, accountPromises, } from './account-copy'
import { forgetAccountOffer } from './account-offer'
import { refreshAccount, resetAccountState } from './account-state'
import { AccountScreen } from './AccountScreen'
import type * as DeviceFactsModule from './device-facts'
import { SettingsScreen } from './SettingsScreen'
import { resetSignIn } from './sign-in-state'

const stand = vi.hoisted(() => ({ signedOutHere: false }))

vi.mock('@/db/services/auth-me-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthMeService>()),
  readMe: vi.fn(),
}))
vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthService>()),
  needsSignIn: () => stand.signedOutHere,
}))
vi.mock('@/db/services/auth-mfa-service', () => ({
  fetchTwofaStatus: vi.fn(),
}))
vi.mock('@/db/services/auth-sessions-service', () => ({
  fetchSessions: vi.fn(),
}))
vi.mock('@/db/services/voice-take-service', async (importOriginal) => ({
  ...(await importOriginal<typeof VoiceTakeService>()),
  getVoiceStorageSnapshot: vi.fn(async () => ({
    takeCount: 0,
    voiceBytes: 0,
    browserUsage: null,
    browserQuota: null,
    persistent: null,
  })),
}))
vi.mock('./device-facts', async (importOriginal) => ({
  ...(await importOriginal<typeof DeviceFactsModule>()),
  loadDeviceFacts: vi.fn(async () => null),
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

type State = 'none' | 'anonymous' | 'signed-in' | 'offline' | 'signed-out-here'

async function enter(state: State): Promise<void> {
  if (state === 'anonymous') setAuthToken(token('anonymous'))
  if (state === 'signed-out-here') stand.signedOutHere = true
  if (state === 'signed-in' || state === 'offline') {
    setAuthToken(token('google'))
    readMeMock.mockResolvedValue(ALEX)
    await refreshAccount()
  }
  // The network goes after the phone has read the account once.
  if (state === 'offline')
    readMeMock.mockResolvedValue({ status: 'unreachable' })
}

let view: RenderedShell | null = null

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

interface Seen {
  offer: boolean
  accountRow: string | null
  deleteRow: boolean
  account: string
  signInButton: boolean
  signOutButton: boolean
}

/** Settings, then the Account screen, as the singer would open them. */
async function look(): Promise<Seen> {
  view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)
  await settle()
  const root = view.container
  const settings = {
    offer: root.querySelector('[data-testid="offer-card"]') !== null,
    accountRow:
      root.querySelector('[data-settings-row="account"]')?.textContent ?? null,
    deleteRow:
      root.querySelector('[data-settings-row="delete-account"]') !== null,
  }
  view.unmount()
  view = renderShell(() => <AccountScreen />)
  await settle()
  return {
    ...settings,
    account: view.container.textContent ?? '',
    signInButton:
      view.container.querySelector('[data-testid="account-sign-in"]') !== null,
    signOutButton:
      view.container.querySelector('[data-testid="account-sign-out"]') !== null,
  }
}

function clean(): void {
  view?.unmount()
  view = null
  localStorage.clear()
  setAuthToken(null)
  resetAccountState()
  resetRunShell()
  resetSignIn()
  forgetAccountOffer()
  readMeMock.mockReset()
  stand.signedOutHere = false
}

beforeEach(() => {
  clean()
  vi.mocked(fetchTwofaStatus).mockResolvedValue({
    enabled: false,
    recoveryCodesLeft: 0,
    available: true,
  })
  vi.mocked(fetchSessions).mockResolvedValue([])
})

afterEach(clean)

describe('the account states', () => {
  it('no account yet: the offer tops Settings, and Account says what one adds', async () => {
    await enter('none')

    const seen = await look()

    expect(seen.offer).toBe(true)
    expect(seen.accountRow).toBeNull()
    expect(seen.deleteRow).toBe(false)
    expect(seen.account).toContain(ACCOUNT_SIGNED_OUT.title)
    for (const promise of accountPromises()) {
      expect(seen.account).toContain(promise)
    }
    expect(seen.signInButton).toBe(true)
  })

  it("anonymous: the phone's own identity reads as no account yet", async () => {
    await enter('anonymous')

    const seen = await look()

    expect(seen.offer).toBe(true)
    expect(seen.accountRow).toBeNull()
    expect(seen.deleteRow).toBe(false)
    expect(seen.account).toContain(ACCOUNT_SIGNED_OUT.title)
    expect(seen.signInButton).toBe(true)
    expect(seen.signOutButton).toBe(false)
  })

  it('signed in: the name, how it signs in, Delete account, and no offer', async () => {
    await enter('signed-in')

    const seen = await look()

    expect(seen.offer).toBe(false)
    expect(seen.accountRow).toContain('Alex')
    expect(seen.accountRow).toContain('Signed in with Google')
    expect(seen.deleteRow).toBe(true)
    expect(seen.account).toContain('singer@example.test')
    expect(seen.account).not.toContain(ACCOUNT_OFFLINE.title)
    expect(seen.signOutButton).toBe(true)
    expect(seen.signInButton).toBe(false)
  })

  it('offline: still signed in, from the card the phone kept, with a note (D1)', async () => {
    await enter('offline')

    const seen = await look()

    expect(seen.offer).toBe(false)
    expect(seen.accountRow).toContain('Alex')
    expect(seen.accountRow).not.toContain(ACCOUNT_ROW.signedOutValue)
    expect(seen.deleteRow).toBe(true)
    expect(seen.account).toContain(ACCOUNT_OFFLINE.title)
    expect(seen.account).toContain('Alex')
    expect(seen.account).not.toContain(ACCOUNT_SIGNED_OUT.title)
    expect(seen.account).not.toContain(ACCOUNT_SIGNED_OUT_HERE.title)
    expect(seen.signInButton).toBe(false)
  })

  it('signed out here: the Account row with Sign in, no offer, and Signed out', async () => {
    await enter('signed-out-here')

    const seen = await look()

    expect(seen.offer).toBe(false)
    expect(seen.accountRow).toContain(ACCOUNT_ROW.signedOutValue)
    expect(seen.deleteRow).toBe(false)
    expect(seen.account).toContain(ACCOUNT_SIGNED_OUT_HERE.title)
    expect(seen.account).not.toContain(ACCOUNT_SIGNED_OUT.title)
    expect(seen.signInButton).toBe(true)
  })
})
