// ============================================================
// The Storage screen: what is kept, a clear for each, Start fresh
// ============================================================
//
// S6 step 7 (6a to 6c, REQ-NAM-023). Each category with its count, its size
// and its own Clear, except the pitch model, which goes only with the app.
// Every clear asks first and says what it removes and what it leaves. The
// voiceprints' question says it truly in each state: signed in, the account
// keeps its copies; signed out, a phone that has held a session sent its
// voiceprints online with it; only a phone that never held one can say they
// cannot come back. Start fresh asks with the line that says the old
// identity cannot be reached again, and is offered only with no account
// signed in.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthService from '@/db/services/auth-service'
import type * as UserService from '@/db/services/user-service'
import { wipeVoiceTakes } from '@/db/services/voice-take-service'
import { clearLocalVoiceprints } from '@/db/services/voiceprint-service'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { STORAGE_COPY, takesLine } from './account-copy'
import { confirmSettingsAlert, resetSettingsAlert } from './settings-alert'
import { SettingsAlert } from './SettingsAlert'
import { startFresh } from './start-fresh'
import type * as StorageFactsModule from './storage-facts'
import type { StorageFacts } from './storage-facts'
import { loadStorageFacts } from './storage-facts'
import { StorageScreen } from './StorageScreen'

const stand = vi.hoisted(() => ({
  signedIn: false,
  token: null as string | null,
  signedOutHere: false,
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthService>()),
  needsSignIn: () => stand.signedOutHere,
}))
vi.mock('@/db/services/user-service', async (importOriginal) => ({
  ...(await importOriginal<typeof UserService>()),
  getAuthToken: () => stand.token,
}))
vi.mock('@/db/services/voice-take-service', () => ({
  wipeVoiceTakes: vi.fn(),
}))
vi.mock('@/db/services/voiceprint-service', () => ({
  clearLocalVoiceprints: vi.fn(),
}))
vi.mock('./start-fresh', () => ({ startFresh: vi.fn() }))
vi.mock('./account-state', () => ({
  accountSignedIn: () => stand.signedIn,
}))
vi.mock('./storage-facts', async (importOriginal) => ({
  ...(await importOriginal<typeof StorageFactsModule>()),
  loadStorageFacts: vi.fn(),
}))

const factsMock = vi.mocked(loadStorageFacts)
const wipeMock = vi.mocked(wipeVoiceTakes)
const clearPrintsMock = vi.mocked(clearLocalVoiceprints)
const freshMock = vi.mocked(startFresh)

const FACTS: StorageFacts = {
  takes: { count: 23, bytes: 186_000_000 },
  voiceprints: { count: 3, bytes: 1_400_000 },
  models: { bytes: 12_812_345 },
  cachedRooms: { bytes: 0 },
  total: 200_212_345,
}

let view: RenderedShell | null = null

function row(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-settings-row="${id}"]`)
}

function alertText(): string {
  return document.querySelector('[role="alertdialog"]')?.textContent ?? ''
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

async function open(): Promise<void> {
  view = renderShell(() => (
    <>
      <StorageScreen />
      <SettingsAlert />
    </>
  ))
  await settle()
}

beforeEach(() => {
  stand.signedIn = false
  stand.token = null
  stand.signedOutHere = false
  factsMock.mockReset()
  factsMock.mockResolvedValue(FACTS)
  wipeMock.mockReset()
  clearPrintsMock.mockReset()
  freshMock.mockReset()
  resetSettingsAlert()
})

afterEach(() => {
  view?.unmount()
  view = null
  resetSettingsAlert()
})

describe('what is kept', () => {
  it('shows each category with its count and size, and the total', async () => {
    await open()

    expect(view?.container.textContent).toContain('200 MB')
    expect(row('storage-takes')?.textContent).toContain(takesLine(23))
    expect(row('storage-takes')?.textContent).toContain('186 MB')
    expect(row('storage-voiceprints')?.textContent).toContain('3 voiceprints')
    expect(row('storage-models')?.textContent).toContain('12.8 MB')
    expect(row('storage-rooms')?.textContent).toContain('0 MB')
  })

  it('offers no Clear for the pitch model, which goes only with the app', async () => {
    await open()

    expect(row('storage-models')?.querySelector('button')).toBeNull()
    expect(row('storage-takes')?.querySelector('button')).not.toBeNull()
  })

  it('keeps the Clear for cached rooms off while nothing is cached', async () => {
    await open()

    expect(
      row('storage-rooms')?.querySelector<HTMLButtonElement>('button')
        ?.disabled,
    ).toBe(true)
  })

  it('names a takes store it could not read, with no size and no Clear', async () => {
    factsMock.mockResolvedValue({ ...FACTS, takes: null })

    await open()

    expect(row('storage-takes')?.textContent).toContain(
      'Could not read the takes just now',
    )
    expect(row('storage-takes')?.querySelector('button')).toBeNull()
  })
})

describe('clearing', () => {
  it('asks before clearing takes, in the words of 6b, then clears them', async () => {
    wipeMock.mockResolvedValue(true)
    await open()

    row('storage-takes')?.querySelector('button')?.click()
    const asked = alertText()
    confirmSettingsAlert()
    await settle()

    expect(asked).toContain('Clear 23 takes?')
    expect(asked).toContain(STORAGE_COPY.clearTakes)
    expect(wipeMock).toHaveBeenCalledTimes(1)
    expect(factsMock).toHaveBeenCalledTimes(2)
  })

  it('says a clear that failed, and keeps the takes', async () => {
    wipeMock.mockResolvedValue(false)
    await open()

    row('storage-takes')?.querySelector('button')?.click()
    confirmSettingsAlert()
    await settle()

    expect(
      document.querySelector('[data-testid="storage-error"]')?.textContent,
    ).toContain('Could not clear the takes.')
  })

  it("says, while signed in, that the account keeps its voiceprints' copies", async () => {
    stand.signedIn = true
    stand.token = 'account-token'
    await open()

    row('storage-voiceprints')?.querySelector('button')?.click()

    expect(alertText()).toContain('Clear 3 voiceprints?')
    expect(alertText()).toContain(STORAGE_COPY.clearVoiceprints.account)
  })

  it('says, signed out on a phone that held a session, that the online copies stay', async () => {
    stand.token = 'phone-session'
    await open()

    row('storage-voiceprints')?.querySelector('button')?.click()

    expect(alertText()).toContain(STORAGE_COPY.clearVoiceprints.online)
    expect(alertText()).not.toContain('cannot come back')
  })

  it('says the same after signing out of an account here', async () => {
    stand.signedOutHere = true
    await open()

    row('storage-voiceprints')?.querySelector('button')?.click()

    expect(alertText()).toContain(STORAGE_COPY.clearVoiceprints.online)
  })

  it('says, on a phone that never held a session, that they cannot come back, then clears them', async () => {
    await open()

    row('storage-voiceprints')?.querySelector('button')?.click()
    const asked = alertText()
    confirmSettingsAlert()
    await settle()

    expect(asked).toContain(STORAGE_COPY.clearVoiceprints.phoneOnly)
    expect(clearPrintsMock).toHaveBeenCalledTimes(1)
  })
})

describe('Start fresh', () => {
  it('asks with the line that the old identity cannot be reached again (REQ-NAM-023)', async () => {
    await open()

    row('start-fresh')?.click()
    const asked = alertText()
    confirmSettingsAlert()

    expect(asked).toContain('Start fresh on this phone?')
    expect(asked).toContain(
      'This phone gets a new identity. The history made under the old one cannot be reached from this phone again.',
    )
    expect(freshMock).toHaveBeenCalledTimes(1)
  })

  it('is offered only while no account is signed in', async () => {
    stand.signedIn = true

    await open()

    expect(row('start-fresh')).toBeNull()
  })
})
