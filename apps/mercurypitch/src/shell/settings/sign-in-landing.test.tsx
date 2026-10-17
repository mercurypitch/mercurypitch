// ============================================================
// After a sign-in: the subscription this phone bought, and what Settings says
// ============================================================
//
// Every way in ends in afterSignIn (Keep, the sign-in sheet, the offer's
// Sign in after a purchase, the onboarding's). A purchase this phone made
// signed out goes to the account with no Restore tap, the server hears of it
// the way it hears of every move (RevenueCat's TRANSFER), and Settings shows
// the account as it now is without a restart. A subscription another account
// owns stays where it is.
//
// The store is a fake RevenueCat with one store account
// (fake-revenuecat.test-fixtures.ts); the server is a fake that follows its
// webhook events and answers /api/billing/me for whoever is signed in.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as NativeBuild from '@/lib/native-build'
import type * as Notifications from '@/stores/notifications-store'

/** The fake server: who holds the songs, and who is signed in to ask. */
const server = vi.hoisted(() => ({
  entitled: new Set<string>(),
  signedInAs: null as string | null,
  asks: 0,
}))

vi.mock('@/db/services/billing-service', () => ({
  fetchBillingMe: vi.fn(async () => {
    server.asks += 1
    const subscribed =
      server.signedInAs !== null && server.entitled.has(server.signedInAs)
    return Promise.resolve({
      creditBalance: 0,
      entitlements: [],
      stripeConfigured: false,
      songs: {
        left: subscribed ? 20 : 0,
        subscribed,
        renewsAt: null,
        perPeriod: 20,
        cap: 50,
      },
    })
  }),
}))
vi.mock('@/db/services/singer-identity', () => ({
  ensureSingerIdentity: async () => Promise.resolve(true),
}))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  KARAOKE_IMPORT: true,
}))
const said = vi.hoisted(() => ({ lines: [] as string[] }))
vi.mock('@/stores/notifications-store', async (importOriginal) => ({
  ...(await importOriginal<typeof Notifications>()),
  showNotification: vi.fn((line: string) => {
    said.lines.push(line)
  }),
}))
vi.mock('@/db/services/voiceprint-service', () => ({
  adoptDeviceVoiceprints: vi.fn(async () => Promise.resolve(0)),
}))
vi.mock('./account-fill', () => ({ markAccountFillDue: vi.fn() }))
vi.mock('./voiceprint-ask', () => ({ askAfterSignIn: vi.fn() }))
vi.mock('./account-state', () => ({
  refreshAccount: vi.fn(async () => Promise.resolve()),
}))

import type { AuthResponse } from '@/db/services/auth-service'
import { resetCloudOfferForTests } from '@/features/karaoke-room/cloud-offer-store'
import { karaokeSongs, resetKaraokeSongsForTests, } from '@/features/karaoke-room/karaoke-songs'
import { registerShellApi } from '@/stores/native-shell-store'
import type { FakeRevenueCatOptions } from '../fake-revenuecat.test-fixtures'
import { fakeRevenueCat } from '../fake-revenuecat.test-fixtures'
import { createKaraokeSubscription } from '../karaoke-subscription'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { CloudGroup } from './CloudGroup'
import { afterSignIn } from './sign-in-landing'

/** This phone's anonymous identity: its device id, and the server's id. */
const PHONE = '0a0a0a0a-0000-4000-8000-00000000000a'
/** An account that already existed. */
const ACCOUNT = '0b0b0b0b-0000-4000-8000-00000000000b'
/** Somebody else's account. */
const OTHER = '0c0c0c0c-0000-4000-8000-00000000000c'

let unregister: () => void = () => undefined
let view: RenderedShell | null = null

/** A phone signed out on its anonymous identity, its store and the server. */
function phone(options: FakeRevenueCatOptions = {}) {
  let session: { id: string; account: boolean } | null = {
    id: PHONE,
    account: false,
  }
  server.signedInAs = PHONE
  const store = fakeRevenueCat({
    ...options,
    // RevenueCat's webhook, as revenuecat.ts takes it: a purchase grants,
    // a transfer moves the entitlement to the account it names.
    onEvent: (event) => {
      if (event.type === 'INITIAL_PURCHASE')
        server.entitled.add(event.appUserId)
      else {
        server.entitled.delete(event.from)
        server.entitled.add(event.to)
      }
    },
  })
  if (options.owner != null) server.entitled.add(options.owner)
  let kept: string | null = null
  const subscription = createKaraokeSubscription(
    store,
    async () => Promise.resolve(session?.id ?? null),
    {
      phone: {
        accountHeld: () => session?.account === true,
        accountId: () => (session?.account === true ? session.id : null),
        anonymousId: () => PHONE,
      },
      note: {
        read: () => kept,
        write: (id) => {
          kept = id
        },
        clear: () => {
          kept = null
        },
      },
    },
  )
  unregister = registerShellApi({
    pushSettings: vi.fn(),
    karaokeSubscription: subscription,
  })
  return {
    store,
    subscription,
    /** A session lands: the account from now on, and afterSignIn. */
    signIn(id: string, isNew = false) {
      session = { id, account: true }
      server.signedInAs = id
      afterSignIn({ token: 't', userId: id, isNew, user: {} } as AuthResponse)
    },
  }
}

const noSongs = {
  left: 0,
  subscribed: false,
  renewsAt: null,
  perPeriod: 20,
} as const

beforeEach(() => {
  localStorage.clear()
  server.entitled = new Set()
  server.signedInAs = null
  server.asks = 0
  said.lines = []
  resetKaraokeSongsForTests(noSongs)
  resetCloudOfferForTests()
})

afterEach(() => {
  view?.unmount()
  view = null
  unregister()
  unregister = () => undefined
})

describe('a sign-in after a purchase made signed out', () => {
  it('gives the account the subscription, with no Restore tap', async () => {
    const singer = phone()
    await expect(singer.subscription.subscribe()).resolves.toBe('purchased')
    expect(server.entitled.has(PHONE)).toBe(true)

    singer.signIn(ACCOUNT)

    await vi.waitFor(() => {
      expect(server.entitled.has(ACCOUNT)).toBe(true)
    })
    expect(singer.store.owner()).toBe(ACCOUNT)
    await vi.waitFor(() => {
      expect(karaokeSongs().subscribed).toBe(true)
    })
    expect(said.lines).toContain(
      'Your Mercury Pitch Cloud subscription is on this account now.',
    )
  })

  it('leaves a new account made of this phone subscribed, Settings included', async () => {
    const singer = phone()
    await singer.subscription.subscribe()

    // Made in place: the account has this phone's id, and already the
    // subscription. Settings follows without a restart.
    singer.signIn(PHONE, true)

    await vi.waitFor(() => {
      expect(karaokeSongs().subscribed).toBe(true)
    })
    expect(singer.store.owner()).toBe(PHONE)
  })
})

describe('a sign-in, whatever this phone bought', () => {
  it('leaves a subscription another account owns where it is', async () => {
    const singer = phone({ owner: OTHER })

    singer.signIn(ACCOUNT)

    await vi.waitFor(() => {
      expect(server.asks).toBeGreaterThan(0)
    })
    expect(singer.store.owner()).toBe(OTHER)
    expect(server.entitled.has(ACCOUNT)).toBe(false)
    expect(karaokeSongs().subscribed).toBe(false)
  })

  it('shows the account as it is in Settings, without a restart', async () => {
    // The account subscribed on another phone; this one bought nothing.
    const singer = phone()
    server.entitled.add(ACCOUNT)
    view = renderShell(() => <CloudGroup />)
    await vi.waitFor(() => {
      expect(view?.container.textContent).toContain('Not subscribed')
    })

    singer.signIn(ACCOUNT)

    await vi.waitFor(() => {
      expect(view?.container.textContent).toContain('Subscribed')
      expect(view?.container.textContent).not.toContain('Not subscribed')
    })
  })
})
