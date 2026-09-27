// ============================================================
// Storage's Imported songs row, in a build that imports them (plan S8 §9)
// ============================================================
//
// Mock 9c: between the models and the cached rooms, the singer's own songs
// with their count, their size and a Remove that asks first and says the
// originals are still in Files. The examples are part of the app, like its
// rooms' pictures, and are not counted here.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthService from '@/db/services/auth-service'
import type * as UserService from '@/db/services/user-service'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { confirmSettingsAlert, resetSettingsAlert } from './settings-alert'
import { SettingsAlert } from './SettingsAlert'
import type * as StorageFactsModule from './storage-facts'
import type { StorageFacts } from './storage-facts'
import { loadStorageFacts } from './storage-facts'
import { StorageScreen } from './StorageScreen'

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthService>()),
  needsSignIn: () => false,
}))
vi.mock('@/db/services/user-service', async (importOriginal) => ({
  ...(await importOriginal<typeof UserService>()),
  getAuthToken: () => null,
}))
vi.mock('@/db/services/voice-take-service', () => ({
  wipeVoiceTakes: vi.fn(),
}))
vi.mock('@/db/services/voiceprint-service', () => ({
  clearLocalVoiceprints: vi.fn(),
}))
vi.mock('./start-fresh', () => ({ startFresh: vi.fn() }))
vi.mock('./account-state', () => ({ accountSignedIn: () => false }))
vi.mock('./storage-facts', async (importOriginal) => ({
  ...(await importOriginal<typeof StorageFactsModule>()),
  loadStorageFacts: vi.fn(),
}))
const removal = vi.hoisted(() => ({ calls: 0, stuck: 0 }))
vi.mock('@/features/karaoke-room/karaoke-imported-songs', () => ({
  removeAllImportedSongs: vi.fn(async () => {
    removal.calls += 1
    return Promise.resolve(removal.stuck)
  }),
}))

const factsMock = vi.mocked(loadStorageFacts)

const FACTS: StorageFacts = {
  takes: { count: 23, bytes: 186_000_000 },
  voiceprints: { count: 3, bytes: 1_400_000 },
  models: { bytes: 12_812_345 },
  cachedRooms: { bytes: 0 },
  importedSongs: { count: 7, bytes: 71_200_000 },
  total: 271_412_345,
}

let view: RenderedShell | null = null

const row = (id: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-settings-row="${id}"]`)

const removeButton = (): HTMLButtonElement | null =>
  row('storage-imported-songs')?.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove imported songs"]',
  ) ?? null

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
  factsMock.mockReset()
  factsMock.mockResolvedValue(FACTS)
  removal.calls = 0
  removal.stuck = 0
  resetSettingsAlert()
})

afterEach(() => {
  view?.unmount()
  view = null
  resetSettingsAlert()
})

describe('Imported songs, on the Storage screen', () => {
  it('sit between the models and the cached rooms, with their count and size', async () => {
    await open()

    expect(
      [...document.querySelectorAll('[data-settings-row^="storage-"]')].map(
        (element) => element.getAttribute('data-settings-row'),
      ),
    ).toEqual([
      'storage-takes',
      'storage-voiceprints',
      'storage-models',
      'storage-imported-songs',
      'storage-rooms',
    ])
    expect(row('storage-imported-songs')?.textContent).toBe(
      'Imported songs7 songs. The originals are still in Files.71.2 MBRemove',
    )
    expect(
      document.querySelector('.mp-storage__bar')?.getAttribute('aria-label'),
    ).toContain('imported songs 71.2 MB')
    expect(document.querySelector('.mp-storage__bar i.is-songs')).not.toBeNull()
    expect(view?.container.textContent).toContain(
      "The example songs are not counted here: they are part of the app, like its rooms' pictures.",
    )
  })

  it('are removed after asking, and the phone is read again', async () => {
    await open()

    removeButton()?.click()
    const alert = document.querySelector('[role="alertdialog"]')
    expect(alert?.textContent).toContain('Remove 7 imported songs?')
    expect(alert?.textContent).toContain(
      'The originals are still in Files, and the example songs stay.',
    )
    expect(removal.calls).toBe(0)

    confirmSettingsAlert()
    await settle()

    expect(removal.calls).toBe(1)
    expect(factsMock).toHaveBeenCalledTimes(2)
    expect(document.querySelector('[data-testid="storage-error"]')).toBeNull()
  })

  it('say which could not be removed', async () => {
    removal.stuck = 1
    await open()

    removeButton()?.click()
    confirmSettingsAlert()
    await settle()

    expect(
      document.querySelector('[data-testid="storage-error"]')?.textContent,
    ).toBe('1 song could not be removed. It is still on this phone.')
  })

  it('offer no Remove with none, and say none', async () => {
    factsMock.mockResolvedValue({
      ...FACTS,
      importedSongs: { count: 0, bytes: 0 },
    })
    await open()

    expect(row('storage-imported-songs')?.textContent).toContain(
      'None on this phone',
    )
    expect(removeButton()?.disabled).toBe(true)
  })

  it('write no size they do not know', async () => {
    factsMock.mockResolvedValue({
      ...FACTS,
      importedSongs: { count: 2, bytes: null },
    })
    await open()

    expect(row('storage-imported-songs')?.textContent).toBe(
      'Imported songs2 songs. The originals are still in Files.Remove',
    )
    expect(
      document.querySelector('.mp-storage__bar')?.getAttribute('aria-label'),
    ).toContain('imported songs of a size not known')
  })
})
