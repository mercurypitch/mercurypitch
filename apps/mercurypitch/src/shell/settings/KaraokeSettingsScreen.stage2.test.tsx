// ============================================================
// Settings, Karaoke, where songs can be imported (plan S8 §9, Stage 2)
// ============================================================
//
// A build with Import adds two groups above the lyrics and playback: the
// subscription (how it stands, the songs left, Manage where the store has a
// page for it, Restore purchases) and the songs on this phone (how many, how
// much space, and Remove imported songs after asking). The examples are part
// of the app and stay. Restore fails closed until the store is real.
// KaraokeSettingsScreen.test.tsx pins the store build, which has neither.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImportedSongs } from '@/features/karaoke-room/karaoke-imported-songs'
import type * as Songs from '@/features/karaoke-room/karaoke-songs'
import type { KaraokeSongs } from '@/features/karaoke-room/karaoke-songs'
import type * as NativeBuild from '@/lib/native-build'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  IS_NATIVE_BUILD: true,
  KARAOKE_IMPORT: true,
}))

const server = vi.hoisted(() => ({
  next: null as KaraokeSongs | null,
  asked: [] as ({ identify?: boolean } | undefined)[],
}))
vi.mock('@/features/karaoke-room/karaoke-songs', async (importOriginal) => {
  const actual = await importOriginal<typeof Songs>()
  return {
    ...actual,
    refreshKaraokeSongs: vi.fn(async (options?: { identify?: boolean }) => {
      server.asked.push(options)
      if (server.next !== null) actual.resetKaraokeSongsForTests(server.next)
      return Promise.resolve(actual.karaokeSongs())
    }),
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

import { resetKaraokeSongsForTests } from '@/features/karaoke-room/karaoke-songs'
import type { KaraokeSubscriptionApi } from '@/stores/native-shell-store'
import { registerShellApi } from '@/stores/native-shell-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { KaraokeSettingsScreen } from './KaraokeSettingsScreen'
import { confirmSettingsAlert, resetSettingsAlert } from './settings-alert'
import { SettingsAlert } from './SettingsAlert'

const subscriber: KaraokeSongs = {
  left: 18,
  subscribed: true,
  renewsAt: '2026-10-27T10:00:00.000Z',
  perPeriod: 20,
}

let view: RenderedShell | null = null
let unregister: () => void = () => undefined

beforeEach(() => {
  localStorage.clear()
  server.next = null
  server.asked = []
  phone.removals = 0
  phone.stuck = 0
  phone.set?.({ count: 0, bytes: 0 })
  resetKaraokeSongsForTests(subscriber)
  resetSettingsAlert()
})

afterEach(() => {
  view?.unmount()
  view = null
  unregister()
  unregister = () => undefined
  resetSettingsAlert()
})

function withStore(api: KaraokeSubscriptionApi): void {
  unregister = registerShellApi({
    pushSettings: vi.fn(),
    karaokeSubscription: api,
  })
}

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
  it('puts the subscription and the songs on this phone above the lyrics and playback', async () => {
    const root = await mount()

    expect(groups(root)).toEqual([
      'Subscription',
      'Songs on this phone',
      'Lyrics',
      'Playback',
    ])
    expect(root.textContent).toContain(
      'The example songs are part of the app and stay.',
    )
  })

  it('says how the subscription stands, and the songs left', async () => {
    const root = await mount()

    expect(row(root, 'karaoke-subscription')?.textContent).toBe(
      'Subscribed, renews on 27 October20 songs a month',
    )
    expect(row(root, 'karaoke-songs-left')?.textContent).toBe(
      'Songs this month18 of 20 left',
    )
    expect(server.asked).toEqual([undefined])
  })

  it('says so when there is no subscription, and the songs an account has', async () => {
    resetKaraokeSongsForTests({
      left: 3,
      subscribed: false,
      renewsAt: null,
      perPeriod: 20,
    })
    const root = await mount()

    expect(row(root, 'karaoke-subscription')?.textContent).toBe(
      'Not subscribed',
    )
    expect(row(root, 'karaoke-songs-left')?.textContent).toBe('Songs3 left')
  })

  it('draws no count while the server has not said one', async () => {
    resetKaraokeSongsForTests({
      left: null,
      subscribed: false,
      renewsAt: null,
      perPeriod: 20,
    })
    const root = await mount()

    expect(row(root, 'karaoke-songs-left')).toBeNull()
  })

  it('fails closed: Restore purchases is not available yet without a store', async () => {
    const root = await mount()

    row(root, 'karaoke-restore')?.click()
    await settle()

    expect(root.querySelector('[role="status"]')?.textContent).toBe(
      'Purchases are not available yet.',
    )
  })

  it('restores, and asks for the songs again', async () => {
    withStore({
      subscribe: async () => Promise.resolve('cancelled'),
      restore: async () => Promise.resolve('restored'),
    })
    resetKaraokeSongsForTests({
      left: 0,
      subscribed: false,
      renewsAt: null,
      perPeriod: 20,
    })
    server.next = subscriber
    const root = await mount()
    server.asked = []

    row(root, 'karaoke-restore')?.click()
    await settle()

    expect(root.querySelector('[role="status"]')?.textContent).toBe(
      'Your Karaoke subscription is restored.',
    )
    expect(server.asked).toEqual([{ identify: true }])
    expect(row(root, 'karaoke-subscription')?.textContent).toContain(
      'Subscribed, renews on 27 October',
    )
  })

  it('offers Manage subscription to a subscriber, where the store has a page for it', async () => {
    const manage = vi.fn(async () => Promise.resolve())
    withStore({
      subscribe: async () => Promise.resolve('cancelled'),
      restore: async () => Promise.resolve('nothing'),
      manage,
    })
    const root = await mount()

    row(root, 'karaoke-manage')?.click()

    expect(manage).toHaveBeenCalledTimes(1)
  })

  it('offers no Manage subscription with no subscription, or no store page', async () => {
    withStore({
      subscribe: async () => Promise.resolve('cancelled'),
      restore: async () => Promise.resolve('nothing'),
      manage: vi.fn(async () => Promise.resolve()),
    })
    resetKaraokeSongsForTests({ ...subscriber, subscribed: false })
    const unsubscribed = await mount()
    expect(row(unsubscribed, 'karaoke-manage')).toBeNull()
    view?.unmount()
    unregister()

    withStore({
      subscribe: async () => Promise.resolve('cancelled'),
      restore: async () => Promise.resolve('nothing'),
    })
    resetKaraokeSongsForTests(subscriber)
    const noPage = await mount()
    expect(row(noPage, 'karaoke-manage')).toBeNull()
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
