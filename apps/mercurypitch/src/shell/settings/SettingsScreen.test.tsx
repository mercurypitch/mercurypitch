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
import { ACCOUNT_DELETED, ACCOUNT_OFFER, ACCOUNT_ROW } from './account-copy'
import { dismissAccountDeletedNote, resumeAfterDeletion, } from './account-deletion'
import { declineOffer, forgetAccountOffer, resetAccountOffer, } from './account-offer'
import { refreshAccount, resetAccountState } from './account-state'
import type * as DeviceFactsModule from './device-facts'
import type * as LevelCheckModule from './level-check'
import { SettingsScreen } from './SettingsScreen'
import { resetSignIn, signInOpen } from './sign-in-state'

vi.mock('@/db/services/auth-me-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthMeService>()),
  readMe: vi.fn(),
}))
const heard = vi.hoisted(() => ({
  input: null as null | 'denied' | { label: string },
}))
const phone = vi.hoisted(() => ({
  facts: null as null | {
    model: string | null
    system: string | null
    version: string | null
  },
}))

vi.mock('./device-facts', async (importOriginal) => ({
  ...(await importOriginal<typeof DeviceFactsModule>()),
  deviceFacts: () => phone.facts,
  loadDeviceFacts: vi.fn(async () => phone.facts),
}))

vi.mock('./level-check', async (importOriginal) => ({
  ...(await importOriginal<typeof LevelCheckModule>()),
  knownInput: () => heard.input,
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

function card(): HTMLElement | null {
  return (
    view?.container.querySelector<HTMLElement>('[data-testid="offer-card"]') ??
    null
  )
}

afterEach(() => {
  view?.unmount()
  view = null
  forgetAccountOffer()
  resetSignIn()
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

  it('offers sign-in on the Account row while nothing is signed in, once the card is folded', () => {
    declineOffer()
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
    expect(card()).toBeNull()
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

  it('names the input on the Microphone row once it has been heard, and pushes Microphone', () => {
    const onPush = vi.fn()
    heard.input = null
    view = renderShell(() => <SettingsScreen onPush={onPush} />)
    const unheard = row('microphone')?.textContent ?? ''
    view.unmount()
    heard.input = { label: 'iPhone Microphone' }

    view = renderShell(() => <SettingsScreen onPush={onPush} />)
    row('microphone')?.click()

    expect(unheard).toBe('Microphone')
    expect(row('microphone')?.textContent).toContain('iPhone Microphone')
    expect(onPush).toHaveBeenCalledWith('microphone')
    heard.input = null
  })

  it('says the microphone is off on its row once it has been refused', () => {
    heard.input = 'denied'

    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)

    expect(row('microphone')?.textContent).toContain('Off')
    heard.input = null
  })

  it('lists This phone in the order 7a draws it: Microphone, then Storage', () => {
    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)

    const order = [
      ...(view.container.querySelectorAll('[data-settings-row]') ?? []),
    ].map((node) => node.getAttribute('data-settings-row'))

    expect(
      order.filter((id) =>
        [
          'microphone',
          'storage',
          'this-phone',
          'appearance',
          'rooms-sing',
          'rooms-karaoke',
          'about',
        ].includes(id ?? ''),
      ),
    ).toEqual([
      'microphone',
      'storage',
      'this-phone',
      'appearance',
      'rooms-sing',
      'rooms-karaoke',
      'about',
    ])
  })

  it('names the phone on its row and the version on About, and pushes each', () => {
    phone.facts = {
      model: 'iPhone17,3',
      system: 'iOS 26.0',
      version: '0.6.0 (380)',
    }
    const onPush = vi.fn()
    view = renderShell(() => <SettingsScreen onPush={onPush} />)

    row('this-phone')?.click()
    row('about')?.click()

    expect(row('this-phone')?.textContent).toContain('iPhone17,3')
    expect(row('about')?.textContent).toContain('0.6.0 (380)')
    expect(onPush).toHaveBeenCalledWith('this-phone')
    expect(onPush).toHaveBeenCalledWith('about')
    phone.facts = null
  })

  it("points to Sing's own options and holds Karaoke's place, pressing nothing (Rooms)", () => {
    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)

    const sing = row('rooms-sing')
    const karaoke = row('rooms-karaoke')

    expect(sing?.textContent).toContain(
      "Its options are behind the room's gear",
    )
    expect(karaoke?.textContent).toContain('Its settings arrive with the room')
    expect(karaoke?.textContent).toContain('Later')
    expect(sing?.tagName).not.toBe('BUTTON')
    expect(karaoke?.tagName).not.toBe('BUTTON')
    expect(sing?.closest('section')?.getAttribute('aria-label')).toBe('Rooms')
  })

  it('pushes Account from its row', () => {
    declineOffer()
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

  it("offers an account as a card at the top, in the Account row's place, while there is none (2b)", () => {
    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)

    const first =
      view.container.querySelector('.mp-set__col')?.firstElementChild

    expect(card()?.textContent).toContain(ACCOUNT_OFFER.title)
    expect(first).toBe(card())
    expect(row('account')).toBeNull()
  })

  it('folds the card into the Account row on Later, until the next launch', () => {
    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)

    card()?.querySelector<HTMLElement>('[data-testid="offer-later"]')?.click()
    const folded = row('account')?.textContent ?? ''
    const cardAfterLater = card()
    view.unmount()
    resetAccountOffer()
    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)

    expect(cardAfterLater).toBeNull()
    expect(folded).toContain(ACCOUNT_ROW.signedOutValue)
    expect(card()).not.toBeNull()
  })

  it('opens the sign-in sheet from the card', () => {
    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)

    card()?.querySelector<HTMLElement>('[data-testid="offer-sign-in"]')?.click()

    expect(signInOpen()).toBe(true)
  })

  it('holds the card back under the line after a deletion', () => {
    sessionStorage.setItem('mp:account-deleted', '1')
    resumeAfterDeletion()

    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)

    expect(card()).toBeNull()
    expect(row('account')).not.toBeNull()
    dismissAccountDeletedNote()
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
