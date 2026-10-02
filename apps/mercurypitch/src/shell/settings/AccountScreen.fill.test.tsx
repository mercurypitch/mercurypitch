// ============================================================
// The Account screen's one-time note after signing in
// ============================================================
//
// S6 step 5 (4b). The first visit after signing in to an account that
// already existed says what arrived, with the real counts, and what did not:
// takes stay on the device that kept them (REQ-NAM-044). It goes once read.
// When the account's history cannot be read, the note says so, says what
// the phone kept is still here, and offers to try again (REQ-NAM-045).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthMeService from '@/db/services/auth-me-service'
import { readMe } from '@/db/services/auth-me-service'
import { setAuthToken } from '@/db/services/user-service'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { FILL_NOTE } from './account-copy'
import type * as AccountFillModule from './account-fill'
import type { AccountFill } from './account-fill'
import { accountFillDue, loadAccountFill, markAccountFillDue, } from './account-fill'
import { resetAccountState } from './account-state'
import { AccountScreen } from './AccountScreen'

vi.mock('@/db/services/auth-me-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthMeService>()),
  readMe: vi.fn(),
}))
vi.mock('@/db/services/auth-mfa-service', () => ({
  fetchTwofaStatus: vi.fn(async () => ({
    enabled: false,
    recoveryCodesLeft: 0,
    available: false,
  })),
}))
vi.mock('@/db/services/auth-sessions-service', () => ({
  fetchSessions: vi.fn(async () => []),
}))
vi.mock('./account-fill', async (importOriginal) => ({
  ...(await importOriginal<typeof AccountFillModule>()),
  loadAccountFill: vi.fn(),
}))

const readMeMock = vi.mocked(readMe)
const fillMock = vi.mocked(loadAccountFill)

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

const ARRIVED: AccountFill = { status: 'ok', runs: 38, voiceprints: 2 }

let view: RenderedShell | null = null

function note(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="account-fill"]')
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

async function visit(): Promise<void> {
  view?.unmount()
  view = renderShell(() => <AccountScreen />)
  await settle()
}

beforeEach(() => {
  localStorage.clear()
  resetAccountState()
  readMeMock.mockReset()
  readMeMock.mockResolvedValue(ALEX)
  fillMock.mockReset()
  setAuthToken(token())
})

afterEach(() => {
  view?.unmount()
  view = null
  setAuthToken(null)
  resetAccountState()
})

describe('the note after signing in', () => {
  it('says what arrived, with the counts, and that takes stay (4b)', async () => {
    fillMock.mockResolvedValue(ARRIVED)
    markAccountFillDue('user-1')

    await visit()

    const said = note()?.textContent ?? ''
    expect(said).toContain(FILL_NOTE.lead)
    expect(said).toContain('38 runs and 2 voiceprints.')
    expect(said).toContain(FILL_NOTE.takes)
  })

  it('goes once read', async () => {
    fillMock.mockResolvedValue(ARRIVED)
    markAccountFillDue('user-1')
    await visit()

    await visit()

    expect(note()).toBeNull()
    expect(accountFillDue()).toBe(false)
    expect(fillMock).toHaveBeenCalledTimes(1)
  })

  it('is not there when nothing signed in since the last visit', async () => {
    await visit()

    expect(note()).toBeNull()
    expect(fillMock).not.toHaveBeenCalled()
  })

  it("keeps the phone's own records and offers a retry when the history cannot be read (REQ-NAM-045)", async () => {
    fillMock.mockResolvedValueOnce({ status: 'failed' })
    fillMock.mockResolvedValueOnce(ARRIVED)
    markAccountFillDue('user-1')
    await visit()
    const failed = note()?.textContent ?? ''

    document
      .querySelector<HTMLButtonElement>('[data-testid="account-fill-retry"]')
      ?.click()
    await settle()

    expect(failed).toContain(FILL_NOTE.failedTitle)
    expect(failed).toContain(FILL_NOTE.failedBody)
    expect(note()?.textContent).toContain('38 runs and 2 voiceprints.')
  })

  it('stays due after a failed read, for the next visit to try again', async () => {
    fillMock.mockResolvedValue({ status: 'failed' })
    markAccountFillDue('user-1')

    await visit()
    view?.unmount()
    view = null

    expect(accountFillDue()).toBe(true)
  })
})
