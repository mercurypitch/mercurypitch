// ============================================================
// The Account screen, signed in: who, how, and what the account holds
// ============================================================
//
// S6 step 4. The identity card with the Apple relay note and a way to copy
// the address (4c), then the account's own settings: the name, two-step
// sign-in as a state set up on the web (decision 04 A), the devices, and
// product news. Whatever needs the server waits for it: with no network
// those rows are not drawn at all rather than drawn wrong (4g, REQ-NAM-049).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthMeService from '@/db/services/auth-me-service'
import { readMe } from '@/db/services/auth-me-service'
import { fetchTwofaStatus } from '@/db/services/auth-mfa-service'
import { fetchSessions } from '@/db/services/auth-sessions-service'
import { setNewsletterOptIn } from '@/db/services/newsletter-service'
import { setAuthToken } from '@/db/services/user-service'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { pushed, resetRunShell } from '../run-shell-store'
import { RELAY_NOTE, TWO_STEP } from './account-copy'
import { resetAccountState } from './account-state'
import { AccountScreen } from './AccountScreen'

vi.mock('@/db/services/auth-me-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthMeService>()),
  readMe: vi.fn(),
}))
vi.mock('@/db/services/auth-mfa-service', () => ({
  fetchTwofaStatus: vi.fn(),
}))
vi.mock('@/db/services/auth-sessions-service', () => ({
  fetchSessions: vi.fn(),
}))
vi.mock('@/db/services/newsletter-service', () => ({
  setNewsletterOptIn: vi.fn(),
}))

const readMeMock = vi.mocked(readMe)
const twofaMock = vi.mocked(fetchTwofaStatus)
const sessionsMock = vi.mocked(fetchSessions)
const newsMock = vi.mocked(setNewsletterOptIn)

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

function account(email: string, provider: 'apple' | 'google', news = false) {
  return {
    status: 'ok' as const,
    me: {
      user: {
        id: 'user-1',
        createdAt: '',
        updatedAt: '',
        authProvider: provider,
        email,
        emailVerified: true,
        lastLoginAt: null,
        isTestAccount: false,
        testAccountExpiresAt: null,
        newsletterOptIn: news,
      },
      profile: { displayName: 'Alex' },
    },
  }
}

function session(id: string, current: boolean) {
  return {
    id,
    provider: 'google',
    label: current ? 'Safari on iPhone' : 'Chrome on Mac',
    ip: null,
    createdAt: '2026-09-01T10:00:00Z',
    lastSeenAt: '2026-09-20T10:00:00Z',
    current,
  }
}

let view: RenderedShell | null = null

function q(selector: string): HTMLElement | null {
  return view?.container.querySelector<HTMLElement>(selector) ?? null
}

function row(id: string): HTMLElement | null {
  return q(`[data-settings-row="${id}"]`)
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

async function open(
  provider: 'apple' | 'google',
  email: string,
): Promise<void> {
  setAuthToken(token(provider))
  readMeMock.mockResolvedValue(account(email, provider))
  view = renderShell(() => <AccountScreen />)
  await settle()
}

beforeEach(() => {
  localStorage.clear()
  setAuthToken(null)
  resetAccountState()
  resetRunShell()
  readMeMock.mockReset()
  twofaMock.mockReset()
  sessionsMock.mockReset()
  newsMock.mockReset()
  twofaMock.mockResolvedValue({
    enabled: false,
    recoveryCodesLeft: 0,
    available: true,
  })
  sessionsMock.mockResolvedValue([session('s-1', true), session('s-2', false)])
})

afterEach(() => {
  view?.unmount()
  view = null
  setAuthToken(null)
  resetAccountState()
  resetRunShell()
  vi.unstubAllGlobals()
})

describe('the identity card', () => {
  it('tells an Apple singer to keep a note of a private address, and copies it', async () => {
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    await open('apple', 'q7mz2kx4pd@privaterelay.appleid.com')

    q('[data-testid="account-copy-address"]')?.click()
    await settle()

    expect(q('[data-testid="account-relay-note"]')?.textContent).toBe(
      RELAY_NOTE,
    )
    expect(writeText).toHaveBeenCalledWith(
      'q7mz2kx4pd@privaterelay.appleid.com',
    )
  })

  it('has no relay note for an address the singer typed', async () => {
    await open('google', 'singer@example.test')

    expect(q('[data-testid="account-relay-note"]')).toBeNull()
    expect(q('[data-testid="account-copy-address"]')).toBeNull()
  })
})

describe("the account's own settings", () => {
  it('shows the name, and pushes the screen that changes it', async () => {
    await open('google', 'singer@example.test')

    row('account-name')?.click()

    expect(row('account-name')?.textContent).toContain('Alex')
    expect(pushed()).toBe('account-name')
  })

  it('reads two-step sign-in as Off, with where to turn it on (decision 04 A)', async () => {
    await open('google', 'singer@example.test')

    const twoStep = row('two-step')

    expect(twoStep?.textContent).toContain(TWO_STEP.label)
    expect(twoStep?.textContent).toContain(TWO_STEP.offSub)
    expect(twoStep?.textContent).toContain('Off')
    expect(twoStep?.tagName).not.toBe('BUTTON')
  })

  it('reads two-step sign-in as On for an account that has it', async () => {
    twofaMock.mockResolvedValue({
      enabled: true,
      recoveryCodesLeft: 8,
      available: true,
    })

    await open('google', 'singer@example.test')

    expect(row('two-step')?.textContent).toContain(TWO_STEP.onSub)
    expect(row('two-step')?.textContent).toContain('On')
  })

  it('leaves two-step sign-in out where the server has none', async () => {
    twofaMock.mockResolvedValue({
      enabled: false,
      recoveryCodesLeft: 0,
      available: false,
    })

    await open('google', 'singer@example.test')

    expect(row('two-step')).toBeNull()
  })

  it('counts this phone and the others under Devices, and pushes the list', async () => {
    await open('google', 'singer@example.test')

    row('devices')?.click()

    expect(row('devices')?.textContent).toContain('This phone and 1 other')
    expect(pushed()).toBe('devices')
  })

  it('turns product news on through the account', async () => {
    newsMock.mockResolvedValue(undefined)
    await open('google', 'singer@example.test')
    readMeMock.mockResolvedValue(account('singer@example.test', 'google', true))

    q('[data-testid="account-news"]')?.click()
    await settle()

    expect(newsMock).toHaveBeenCalledWith(true)
    expect(
      q('[data-testid="account-news"]')?.getAttribute('aria-checked'),
    ).toBe('true')
  })

  it('snaps product news back when the account refuses it', async () => {
    newsMock.mockRejectedValue(new Error('Could not save that'))
    await open('google', 'singer@example.test')

    q('[data-testid="account-news"]')?.click()
    await settle()

    expect(
      q('[data-testid="account-news"]')?.getAttribute('aria-checked'),
    ).toBe('false')
    expect(q('[data-testid="account-error"]')?.textContent).toBe(
      'Could not save that',
    )
  })

  it('draws none of them while the account cannot be reached (4g)', async () => {
    setAuthToken(token('google'))
    readMeMock.mockResolvedValue({ status: 'unreachable' })

    view = renderShell(() => <AccountScreen />)
    await settle()

    expect(row('account-name')).toBeNull()
    expect(row('two-step')).toBeNull()
    expect(row('devices')).toBeNull()
    expect(q('[data-testid="account-news"]')).toBeNull()
    expect(twofaMock).not.toHaveBeenCalled()
    expect(sessionsMock).not.toHaveBeenCalled()
    expect(q('[data-testid="account-sign-out"]')).not.toBeNull()
  })
})
