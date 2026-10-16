// ============================================================
// Settings, Karaoke, where songs can be imported (plan S8 §9, Stage 2)
// ============================================================
//
// A build with Import adds the songs on this phone above the lyrics and
// playback (how many, how much space, and Remove imported songs after
// asking), and on Android Play's review access. The examples are part of the
// app and stay. The subscription is Mercury Pitch Cloud's, in Settings
// itself (CloudGroup.test.tsx). KaraokeSettingsScreen.test.tsx pins the store
// build, which has none of it.

import type * as CapacitorCore from '@capacitor/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImportedSongs } from '@/features/karaoke-room/karaoke-imported-songs'
import type * as NativeBuild from '@/lib/native-build'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  IS_NATIVE_BUILD: true,
  KARAOKE_IMPORT: true,
}))

const device = vi.hoisted(() => ({ platform: 'web' }))
vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof CapacitorCore>()
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, getPlatform: () => device.platform },
  }
})

const phone = vi.hoisted(() => ({
  set: null as null | ((next: ImportedSongs) => void),
  read: null as null | (() => ImportedSongs),
  removals: 0,
  stuck: 0,
}))
vi.mock('@/features/karaoke-room/karaoke-imported-songs', async () => {
  const solid = await import('solid-js')
  const [songs, setSongs] = solid.createSignal<ImportedSongs>({
    count: 0,
    bytes: 0,
  })
  phone.read = songs
  phone.set = setSongs
  return {
    importedSongs: () => songs(),
    removeAllImportedSongs: vi.fn(async () => {
      phone.removals += 1
      setSongs({ count: phone.stuck, bytes: phone.stuck === 0 ? 0 : 9_000_000 })
      return Promise.resolve(phone.stuck)
    }),
  }
})

import { actAsIpad } from '@/tests/helpers/ipad-navigator'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { KaraokeSettingsScreen } from './KaraokeSettingsScreen'
import { confirmSettingsAlert, resetSettingsAlert } from './settings-alert'
import { SettingsAlert } from './SettingsAlert'

let view: RenderedShell | null = null

beforeEach(() => {
  localStorage.clear()
  device.platform = 'web'
  phone.removals = 0
  phone.stuck = 0
  phone.set?.({ count: 0, bytes: 0 })
  resetSettingsAlert()
})

afterEach(() => {
  view?.unmount()
  view = null
  resetSettingsAlert()
})

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

async function mount(): Promise<HTMLElement> {
  view = renderShell(() => (
    <>
      <KaraokeSettingsScreen />
      <SettingsAlert />
    </>
  ))
  await settle()
  return view.container
}

const row = (root: HTMLElement, id: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[data-settings-row="${id}"]`)

const groups = (root: HTMLElement): (string | null)[] =>
  [...root.querySelectorAll('section')].map((group) =>
    group.getAttribute('aria-label'),
  )

describe('Settings, Karaoke, in a build with Import', () => {
  it('puts the songs on this phone above the lyrics and playback, and no subscription', async () => {
    const root = await mount()

    expect(groups(root)).toEqual(['Songs on this phone', 'Lyrics', 'Playback'])
    expect(row(root, 'karaoke-subscription')).toBeNull()
    expect(row(root, 'karaoke-restore')).toBeNull()
    expect(root.textContent).toContain(
      'The example songs are part of the app and stay.',
    )
  })

  it('adds Play review access at the top on Android, and only there', async () => {
    device.platform = 'android'
    const android = await mount()
    expect(groups(android)).toEqual([
      'App review',
      'Songs on this phone',
      'Lyrics',
      'Playback',
    ])
    expect(row(android, 'karaoke-review-access')).not.toBeNull()
    view?.unmount()

    device.platform = 'ios'
    const ios = await mount()
    expect(row(ios, 'karaoke-review-access')).toBeNull()
  })

  it('counts the songs on this phone and the space they take', async () => {
    phone.set?.({ count: 7, bytes: 71_200_000 })
    const root = await mount()

    expect(row(root, 'karaoke-imported-songs')?.textContent).toBe(
      'Imported songs7 songs · 71.2 MB',
    )

    phone.set?.({ count: 1, bytes: null })
    expect(row(root, 'karaoke-imported-songs')?.textContent).toBe(
      'Imported songs1 song',
    )
  })

  it('removes them all after asking, and the examples stay', async () => {
    phone.set?.({ count: 7, bytes: 71_200_000 })
    const root = await mount()

    row(root, 'karaoke-remove-imported')?.click()
    const alert = document.querySelector('[role="alertdialog"]')
    expect(alert?.textContent).toContain('Remove 7 imported songs?')
    expect(alert?.textContent).toContain(
      'Their voice and music leave this phone. The originals are still in Files, and the example songs stay.',
    )
    expect(phone.removals).toBe(0)

    confirmSettingsAlert()
    await settle()

    expect(phone.removals).toBe(1)
    expect(row(root, 'karaoke-imported-songs')?.textContent).toBe(
      'Imported songsNone',
    )
    expect(row(root, 'karaoke-remove-imported')).toBeNull()
    expect(root.querySelector('[role="alert"]')).toBeNull()
  })

  it('says which could not be removed', async () => {
    phone.set?.({ count: 7, bytes: 71_200_000 })
    phone.stuck = 2
    const root = await mount()

    row(root, 'karaoke-remove-imported')?.click()
    confirmSettingsAlert()
    await settle()

    expect(root.querySelector('[role="alert"]')?.textContent).toBe(
      '2 songs could not be removed. They are still on this phone.',
    )
  })
})

describe('the songs, on an iPad', () => {
  it('groups them as the songs on this iPad, and says what removing leaves', async () => {
    const restore = actAsIpad()
    try {
      phone.set?.({ count: 7, bytes: 71_200_000 })
      phone.stuck = 2
      const root = await mount()
      const words = root.textContent ?? ''

      row(root, 'karaoke-remove-imported')?.click()
      const asked =
        document.querySelector('[role="alertdialog"]')?.textContent ?? ''
      confirmSettingsAlert()
      await settle()
      const stuck = root.querySelector('[role="alert"]')?.textContent ?? ''

      expect(words).toContain('Songs on this iPad')
      expect(asked).toContain(
        'Their voice and music leave this iPad. The originals are still in Files, and the example songs stay.',
      )
      expect(stuck).toBe(
        '2 songs could not be removed. They are still on this iPad.',
      )
      expect(words + asked + stuck).not.toMatch(/\bphones?\b/iu)
    } finally {
      restore()
    }
  })
})
