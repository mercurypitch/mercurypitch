// ============================================================
// Settings, the root of the stack: grouped rows that push their own screens
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as AuthMeService from '@/db/services/auth-me-service'
import { readMe } from '@/db/services/auth-me-service'
import { setAuthToken } from '@/db/services/user-service'
import type * as VoiceTakeService from '@/db/services/voice-take-service'
import { getVoiceStorageSnapshot } from '@/db/services/voice-take-service'
import { setTheme, setThemeSource, stopThemeAutoWatch, } from '@/stores/theme-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { ACCOUNT_DELETED, ACCOUNT_ROW } from './account-copy'
import { dismissAccountDeletedNote, resumeAfterDeletion, } from './account-deletion'
import { refreshAccount, resetAccountState } from './account-state'
import { SettingsScreen } from './SettingsScreen'

vi.mock('@/db/services/auth-me-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthMeService>()),
  readMe: vi.fn(),
}))
vi.mock('@/db/services/voice-take-service', async (importOriginal) => ({
  ...(await importOriginal<typeof VoiceTakeService>()),
  getVoiceStorageSnapshot: vi.fn(),
}))

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

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

let view: RenderedShell | null = null

function row(id: string): HTMLElement | null {
  return (
    view?.container.querySelector<HTMLElement>(`[data-settings-row="${id}"]`) ??
    null
  )
}

afterEach(() => {
  view?.unmount()
  view = null
  stopThemeAutoWatch()
  setTheme('dark')
  setAuthToken(null)
  resetAccountState()
  vi.mocked(readMe).mockReset()
})

describe('Settings', () => {
  it('says the app follows the phone on the Appearance row, and pushes Appearance from it', () => {
    setThemeSource('system')
    const onPush = vi.fn()
    view = renderShell(() => <SettingsScreen onPush={onPush} />)

    const value = row('appearance')?.textContent ?? ''
    row('appearance')?.click()

    expect(value).toContain('Match the phone')
    expect(onPush).toHaveBeenCalledWith('appearance')
  })

  it('names a preset picked by hand on the Appearance row', () => {
    setTheme('light')

    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)

    expect(row('appearance')?.textContent).toContain('Light')
  })

  it('ends on the privacy line', () => {
    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)

    const screen = view.container.querySelector(
      '[data-testid="settings-screen"]',
    )

    expect(screen?.lastElementChild?.textContent?.trim()).toBe(
      'Only you can hear you.',
    )
  })

  it('offers sign-in on the Account row while nothing is signed in', () => {
    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)

    const account = row('account')?.textContent ?? ''

    expect(account).toContain(ACCOUNT_ROW.signedOutSub)
    expect(account).toContain(ACCOUNT_ROW.signedOutValue)
  })

  it('names the account and how it signs in on the Account row', async () => {
    setAuthToken(token('apple'))
    vi.mocked(readMe).mockResolvedValueOnce({
      status: 'ok',
      me: {
        user: {
          id: 'user-1',
          createdAt: '',
          updatedAt: '',
          authProvider: 'apple',
          email: 'singer@example.test',
          emailVerified: true,
          lastLoginAt: null,
          isTestAccount: false,
          testAccountExpiresAt: null,
        },
        profile: { displayName: 'Alex' },
      },
    })
    await refreshAccount()

    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)
    const account = row('account')?.textContent ?? ''

    expect(account).toContain('Alex')
    expect(account).toContain('Signed in with Apple')
    expect(account).not.toContain(ACCOUNT_ROW.signedOutValue)
  })

  it('says what the phone keeps on the Storage row, and pushes Storage from it', async () => {
    vi.mocked(getVoiceStorageSnapshot).mockResolvedValue({
      takeCount: 23,
      voiceBytes: 186_000_000,
      browserUsage: null,
      browserQuota: null,
      persistent: null,
    })
    const onPush = vi.fn()
    view = renderShell(() => <SettingsScreen onPush={onPush} />)
    await settle()

    row('storage')?.click()

    // 186 MB of takes and the 12.8 MB pitch model the app ships with.
    expect(row('storage')?.textContent).toContain('199 MB')
    expect(onPush).toHaveBeenCalledWith('storage')
  })

  it('pushes Account from its row', () => {
    const onPush = vi.fn()
    view = renderShell(() => <SettingsScreen onPush={onPush} />)

    row('account')?.click()

    expect(onPush).toHaveBeenCalledWith('account')
  })

  it('offers Delete account under the account, only while signed in (REQ-NAM-055)', async () => {
    const onPush = vi.fn()
    view = renderShell(() => <SettingsScreen onPush={onPush} />)
    const signedOut = row('delete-account')
    view.unmount()
    setAuthToken(token('google'))
    vi.mocked(readMe).mockResolvedValue({ status: 'unreachable' })

    view = renderShell(() => <SettingsScreen onPush={onPush} />)
    row('delete-account')?.click()

    expect(signedOut).toBeNull()
    expect(row('delete-account')?.textContent).toContain('Delete account')
    expect(onPush).toHaveBeenCalledWith('delete-account')
  })

  it('says once, after a deletion, that the account is gone and the practice stays (5d)', () => {
    sessionStorage.setItem('mp:account-deleted', '1')
    resumeAfterDeletion()

    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)
    const said = view.container.textContent ?? ''
    view.unmount()
    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)

    expect(said).toContain(ACCOUNT_DELETED)
    expect(view.container.textContent).not.toContain(ACCOUNT_DELETED)
    dismissAccountDeletedNote()
  })
})
