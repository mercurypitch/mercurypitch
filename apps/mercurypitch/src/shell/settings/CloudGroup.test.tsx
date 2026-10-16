// ============================================================
// Settings: Mercury Pitch Cloud, the standing row (plan S7b §5)
// ============================================================
//
// How the subscription stands and the songs left, as the server last said
// them; "See the plan" for a singer without it, which asks the store before
// it opens the offer; Manage where the store has a page for it; Restore
// purchase, which fails closed until the store is real.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Songs from '@/features/karaoke-room/karaoke-songs'
import type { KaraokeSongs } from '@/features/karaoke-room/karaoke-songs'

const server = vi.hoisted(() => ({
  next: null as KaraokeSongs | null,
  asked: [] as ({ identify?: boolean } | undefined)[],
  // The songs the server has after this many more asks, if it has not heard.
  heardAfter: 0,
}))
vi.mock('@/features/karaoke-room/karaoke-songs', async (importOriginal) => {
  const actual = await importOriginal<typeof Songs>()
  return {
    ...actual,
    refreshKaraokeSongs: vi.fn(async (options?: { identify?: boolean }) => {
      server.asked.push(options)
      if (server.heardAfter > 0) server.heardAfter -= 1
      else if (server.next !== null) {
        actual.resetKaraokeSongsForTests(server.next)
      }
      return Promise.resolve(actual.karaokeSongs())
    }),
    // The webhook's few seconds, without the test waiting them.
    awaitSubscription: async (
      refresh: () => Promise<KaraokeSongs>,
      options?: Parameters<typeof actual.awaitSubscription>[1],
    ) =>
      actual.awaitSubscription(refresh, {
        ...options,
        wait: async () => Promise.resolve(),
      }),
  }
})
vi.mock('@/db/services/singer-identity', () => ({
  ensureSingerIdentity: async () => Promise.resolve(true),
}))

import { cloudOffer, resetCloudOfferForTests, } from '@/features/karaoke-room/cloud-offer-store'
import { CloudOffer } from '@/features/karaoke-room/CloudOffer'
import { resetKaraokeSongsForTests } from '@/features/karaoke-room/karaoke-songs'
import type { KaraokeSubscriptionApi } from '@/stores/native-shell-store'
import { registerShellApi } from '@/stores/native-shell-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { CloudGroup } from './CloudGroup'

const subscriber: KaraokeSongs = {
  left: 18,
  subscribed: true,
  renewsAt: '2026-10-27T10:00:00.000Z',
  perPeriod: 20,
}

const noSongs: KaraokeSongs = {
  left: 0,
  subscribed: false,
  renewsAt: null,
  perPeriod: 20,
}

let view: RenderedShell | null = null
let unregister: () => void = () => undefined

beforeEach(() => {
  localStorage.clear()
  server.next = null
  server.asked = []
  server.heardAfter = 0
  resetKaraokeSongsForTests(subscriber)
  resetCloudOfferForTests()
})

afterEach(() => {
  view?.unmount()
  view = null
  unregister()
  unregister = () => undefined
  resetCloudOfferForTests()
})

function withStore(overrides: Partial<KaraokeSubscriptionApi> = {}): void {
  unregister = registerShellApi({
    pushSettings: vi.fn(),
    karaokeSubscription: {
      subscribe: async () => Promise.resolve('cancelled'),
      restore: async () => Promise.resolve('nothing'),
      offer: async () =>
        Promise.resolve({ priceText: '€4.99', title: 'Mercury Pitch Cloud' }),
      ...overrides,
    },
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
      <CloudGroup />
      <CloudOffer />
    </>
  ))
  await settle()
  return view.container
}

const row = (root: HTMLElement, id: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[data-settings-row="${id}"]`)

const said = (root: HTMLElement): string | null =>
  root.querySelector('[role="status"]')?.textContent ?? null

describe('Mercury Pitch Cloud in Settings', () => {
  it('says how the subscription stands, and the songs left', async () => {
    const root = await mount()

    expect(root.querySelector('section')?.getAttribute('aria-label')).toBe(
      'Mercury Pitch Cloud',
    )
    expect(row(root, 'cloud-status')?.textContent).toBe(
      'Subscribed, renews on 27 October20 songs a month',
    )
    expect(row(root, 'cloud-songs-left')?.textContent).toBe(
      'Songs this month18 of 20 left',
    )
    expect(row(root, 'cloud-plan')).toBeNull()
    expect(server.asked).toEqual([undefined])
  })

  it('says so when there is no subscription, the songs an account has, and offers the plan', async () => {
    resetKaraokeSongsForTests({ ...noSongs, left: 3 })
    const root = await mount()

    expect(row(root, 'cloud-status')?.textContent).toBe('Not subscribed')
    expect(row(root, 'cloud-songs-left')?.textContent).toBe('Songs3 left')
    expect(row(root, 'cloud-plan')?.textContent).toBe(
      'See the planSing your own songs',
    )
  })

  it('draws no count while the server has not said one', async () => {
    resetKaraokeSongsForTests({ ...noSongs, left: null })
    const root = await mount()

    expect(row(root, 'cloud-songs-left')).toBeNull()
    expect(row(root, 'cloud-plan')).not.toBeNull()
  })
})

describe('See the plan', () => {
  it('opens the offer once the store says it holds none', async () => {
    const storeSubscribed = vi.fn(async () => Promise.resolve(false))
    withStore({ storeSubscribed })
    resetKaraokeSongsForTests(noSongs)
    const root = await mount()

    row(root, 'cloud-plan')?.click()
    await settle()

    expect(storeSubscribed).toHaveBeenCalledTimes(1)
    expect(cloudOffer()).toEqual({ source: 'settings', view: 'offer' })
    expect(
      document.querySelector(
        '[role="dialog"][aria-label="Sing your own songs"]',
      ),
    ).not.toBeNull()
  })

  it('opens what follows a yes when the store holds the subscription already', async () => {
    withStore({ storeSubscribed: async () => Promise.resolve(true) })
    resetKaraokeSongsForTests(noSongs)
    const root = await mount()

    row(root, 'cloud-plan')?.click()
    await settle()

    expect(cloudOffer()?.view).toBe('subscribed')
    expect(
      document.querySelector(
        '[role="dialog"][aria-label="Sing your own songs"]',
      ),
    ).toBeNull()
  })

  it('opens nothing when the server, asked again, has the subscription', async () => {
    withStore({ storeSubscribed: async () => Promise.resolve(false) })
    resetKaraokeSongsForTests(noSongs)
    const root = await mount()
    server.next = subscriber

    row(root, 'cloud-plan')?.click()
    await settle()

    expect(cloudOffer()).toBeNull()
    expect(row(root, 'cloud-status')?.textContent).toContain(
      'Subscribed, renews on 27 October',
    )
    expect(row(root, 'cloud-plan')).toBeNull()
  })
})

describe('Restore purchase', () => {
  it('fails closed: not available yet without a store', async () => {
    const root = await mount()

    row(root, 'cloud-restore')?.click()
    await settle()

    expect(row(root, 'cloud-restore')?.textContent).toBe('Restore purchase')
    expect(said(root)).toBe('Purchases are not available yet.')
  })

  it('restores, and asks for the songs again', async () => {
    withStore({ restore: async () => Promise.resolve('restored') })
    resetKaraokeSongsForTests(noSongs)
    server.next = subscriber
    const root = await mount()
    server.asked = []

    row(root, 'cloud-restore')?.click()
    await settle()

    expect(said(root)).toBe(
      'Your Mercury Pitch Cloud subscription is restored.',
    )
    expect(server.asked).toEqual([{ identify: true }])
    expect(row(root, 'cloud-status')?.textContent).toContain(
      'Subscribed, renews on 27 October',
    )
  })

  it('keeps asking after a restore until the server has heard from the store', async () => {
    withStore({ restore: async () => Promise.resolve('restored') })
    resetKaraokeSongsForTests(noSongs)
    const root = await mount()
    server.asked = []
    server.next = subscriber
    server.heardAfter = 2

    row(root, 'cloud-restore')?.click()
    await settle()

    expect(said(root)).toBe(
      'Your Mercury Pitch Cloud subscription is restored.',
    )
    expect(server.asked).toEqual([
      { identify: true },
      { identify: true },
      { identify: true },
    ])
    expect(row(root, 'cloud-status')?.textContent).toContain(
      'Subscribed, renews on 27 October',
    )
  })
})

describe('Manage subscription', () => {
  it('opens the store page for a subscriber, where the store has one', async () => {
    const manage = vi.fn(async () => Promise.resolve('opened' as const))
    withStore({ manage })
    const root = await mount()

    row(root, 'cloud-manage')?.click()
    await settle()

    expect(manage).toHaveBeenCalledTimes(1)
    expect(said(root)).toBeNull()
  })

  it('says so when the store’s page could not be opened', async () => {
    withStore({ manage: async () => Promise.resolve('failed' as const) })
    const root = await mount()

    row(root, 'cloud-manage')?.click()
    await settle()

    expect(said(root)).toBe(
      'The subscription page could not be opened. Try again in a moment.',
    )
  })

  it('is not offered with no subscription, or no store page', async () => {
    withStore({ manage: vi.fn(async () => Promise.resolve('opened' as const)) })
    resetKaraokeSongsForTests({ ...subscriber, subscribed: false })
    const unsubscribed = await mount()
    expect(row(unsubscribed, 'cloud-manage')).toBeNull()
    view?.unmount()
    unregister()

    withStore()
    resetKaraokeSongsForTests(subscriber)
    const noPage = await mount()
    expect(row(noPage, 'cloud-manage')).toBeNull()
  })
})
