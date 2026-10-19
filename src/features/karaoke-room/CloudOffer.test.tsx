// ============================================================
// The Cloud offer: paywall B v2, "The path" (plan S7b §4)
// ============================================================
//
// What the sheet says, to whom, and what each of its buttons does. The
// store states the price; until it has, Subscribe stays off (App Store
// 3.1.2). Subscribe fails closed until the store products exist. Where the
// pieces sit on a phone is measured in a browser, not here: jsdom applies no
// stylesheet.

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Songs from './karaoke-songs'
import type { KaraokeSongs } from './karaoke-songs'

const server = vi.hoisted(() => ({
  next: null as KaraokeSongs | null,
  /** Holds the wait between two asks after a purchase, while set. */
  hold: null as Promise<void> | null,
}))
vi.mock('./karaoke-songs', async (importOriginal) => {
  const actual = await importOriginal<typeof Songs>()
  return {
    ...actual,
    refreshKaraokeSongs: vi.fn(async () => {
      if (server.next !== null) actual.resetKaraokeSongsForTests(server.next)
      return Promise.resolve(actual.karaokeSongs())
    }),
    awaitSubscription: async (
      refresh: () => Promise<KaraokeSongs>,
      options?: Parameters<typeof actual.awaitSubscription>[1],
    ) =>
      actual.awaitSubscription(refresh, {
        ...options,
        wait: async () => server.hold ?? Promise.resolve(),
      }),
  }
})

const auth = vi.hoisted(() => ({ account: false }))
vi.mock('@/db/services/auth-service', () => ({
  accountHeld: () => auth.account,
  hasUpgradedAccount: () => auth.account,
  hasValidToken: () => true,
  requireAuth: async () => Promise.resolve(true),
}))

/** What /api/auth/me says of the signed-in account, and how often asked. */
const account = vi.hoisted(() => ({
  read: { status: 'unreachable' } as
    | { status: 'unreachable' }
    | {
        status: 'ok'
        me: {
          user: {
            authProvider: string
            email: string | null
            emailVerified: boolean
          }
          profile: null
        }
      },
  reads: 0,
}))
vi.mock('@/db/services/auth-me-service', () => ({
  readMe: vi.fn(async () => {
    account.reads += 1
    return Promise.resolve(account.read)
  }),
}))

function accountSays(user: {
  authProvider?: string
  email?: string | null
  emailVerified: boolean
}): void {
  account.read = {
    status: 'ok',
    me: {
      user: {
        authProvider: 'password',
        email: 'singer@example.com',
        ...user,
      },
      profile: null,
    },
  }
}

import type { KaraokeSubscriptionApi } from '@/stores/native-shell-store'
import { registerShellApi } from '@/stores/native-shell-store'
import { actAsIpad } from '@/tests/helpers/ipad-navigator'
import { closeCloudOffer, cloudOffer, cloudOfferGuest, openCloudOffer, resetCloudOfferForTests, setCloudOfferGuest, unaskedRefusal, } from './cloud-offer-store'
import { CloudOffer } from './CloudOffer'
import { karaokeSongs, resetKaraokeSongsForTests, songsOnTheWay, } from './karaoke-songs'

/** The store's price for the month's plan, as the offer states it. */
const OFFER = { priceText: '€4.99', title: 'Mercury Pitch Cloud' }
const offered = async () => Promise.resolve(OFFER)

const noSongs: KaraokeSongs = {
  left: 0,
  subscribed: false,
  renewsAt: null,
  perPeriod: 20,
}

const subscriber: KaraokeSongs = {
  left: 20,
  subscribed: true,
  renewsAt: '2026-11-16T10:00:00.000Z',
  perPeriod: 20,
}

/** A store with the plan to sell; each call may be swapped per test. */
function store(
  overrides: Partial<KaraokeSubscriptionApi> = {},
): KaraokeSubscriptionApi {
  return {
    subscribe: async () => Promise.resolve('cancelled' as const),
    restore: async () => Promise.resolve('nothing' as const),
    offer: offered,
    ...overrides,
  }
}

let unregister: (() => void) | null = null

function withStore(
  api: KaraokeSubscriptionApi,
  extra: { openSignIn?: () => void } = {},
): void {
  unregister = registerShellApi({
    pushSettings: vi.fn(),
    karaokeSubscription: api,
    ...extra,
  })
}

beforeEach(() => {
  server.next = null
  server.hold = null
  auth.account = false
  account.read = { status: 'unreachable' }
  account.reads = 0
  resetKaraokeSongsForTests(noSongs)
  resetCloudOfferForTests()
})

afterEach(() => {
  cleanup()
  unregister?.()
  unregister = null
  resetCloudOfferForTests()
  vi.useRealTimers()
})

function open(
  props: {
    platform?: string
    onAccount?: () => void
    onSignIn?: () => void
  } = {},
): Promise<HTMLElement> {
  render(() => <CloudOffer {...props} />)
  openCloudOffer('import')
  return waitFor(() =>
    screen.getByRole('dialog', { name: 'Sing your own songs' }),
  )
}

function subscribeButton(offer: HTMLElement): HTMLButtonElement {
  return within(offer).getByRole('button', {
    name: 'Subscribe',
  }) as HTMLButtonElement
}

function statusLine(offer: HTMLElement): string {
  return within(offer).getByRole('status').textContent ?? ''
}

describe('the offer', () => {
  it('walks the path: pick, split, sing, then the plan and its terms', async () => {
    withStore(store())
    const offer = await open()

    expect(within(offer).getByText('Mercury Pitch Cloud')).toBeTruthy()
    expect(
      within(offer).getByRole('heading', { name: 'Sing your own songs' }),
    ).toBeTruthy()
    const steps = within(offer)
      .getAllByRole('listitem')
      .map((step) => step.textContent)
    expect(steps).toEqual([
      '1 Pick a song from Files MP3, M4A, WAV or FLAC, up to 12 minutes',
      '2 Our servers take the voice out Keep it as a quiet guide, or switch it off',
      '3 Sing it on this phone Saved here. Plays offline.',
    ])
    expect(offer.textContent).toContain('20 songs a month')
    expect(offer.textContent).toContain('Unused songs carry over, up to 50')
    expect(offer.textContent).toContain(
      'Renews every month until you cancel. Cancel any time in Settings.',
    )
    expect(
      within(offer).getByRole('link', { name: 'Terms' }).getAttribute('href'),
    ).toBe('https://about.mercurypitch.com/terms/')
    expect(
      within(offer).getByRole('link', { name: 'Privacy' }).getAttribute('href'),
    ).toBe('https://about.mercurypitch.com/privacy/')
    expect(
      within(offer).getByRole('button', { name: 'Restore purchase' }),
    ).toBeTruthy()
    expect(within(offer).getByRole('button', { name: 'Not now' })).toBeTruthy()
  })

  it("names Android's own place for a song", async () => {
    withStore(store())
    const offer = await open({ platform: 'android' })

    expect(within(offer).getByText('Pick a song from your phone')).toBeTruthy()
    expect(offer.textContent).not.toContain('Files')
  })

  it('names the iPad in hand, and no phone', async () => {
    const restore = actAsIpad()
    try {
      withStore(store())
      const offer = await open()

      expect(within(offer).getByText('Sing it on this iPad')).toBeTruthy()
      expect(offer.textContent).not.toMatch(/\bphones?\b/iu)
    } finally {
      restore()
    }
  })

  it('says nothing of urgency: no countdown, no struck-through price', async () => {
    withStore(store())
    const offer = await open()
    await waitFor(() => expect(offer.textContent).toContain('€4.99'))

    expect(offer.querySelector('s, del, strike')).toBeNull()
    expect(offer.textContent).not.toMatch(
      /hurry|limited time|last chance|today only|ends in|expires|countdown|discount|\bsale\b|\d+:\d\d/iu,
    )
    expect(offer.textContent).not.toMatch(/calm/iu)
  })
})

describe('the price', () => {
  it("states the store's own price, by the month, and lets Subscribe be tapped", async () => {
    withStore(store())
    const offer = await open()

    await waitFor(() => expect(subscribeButton(offer).disabled).toBe(false))
    const price = within(offer).getByTestId('cloud-price')
    expect(price.textContent).toBe('€4.99 a month')
    expect(statusLine(offer)).toBe('')
  })

  // Review of PR 880, finding 6 (App Store 3.1.2): Subscribe is there to
  // tap only with the store's price in view.
  it('keeps Subscribe off while the store is asked', async () => {
    let price = (_offer: typeof OFFER): void => undefined
    withStore(
      store({
        offer: async () =>
          new Promise((resolve) => {
            price = resolve
          }),
      }),
    )
    const offer = await open()

    expect(subscribeButton(offer).disabled).toBe(true)
    expect(
      within(offer).getByText('Asking the store for the price'),
    ).toBeTruthy()

    price({ priceText: '$4.99', title: 'Cloud Monthly' })

    await waitFor(() => expect(subscribeButton(offer).disabled).toBe(false))
    expect(within(offer).getByTestId('cloud-price').textContent).toBe(
      '$4.99 a month',
    )
  })

  it('fails closed with no store: no price of our own, Subscribe off, Restore says so', async () => {
    const offer = await open()

    await waitFor(() =>
      expect(statusLine(offer)).toBe('Subscriptions are not available yet.'),
    )
    expect(offer.textContent).not.toContain('€')
    expect(subscribeButton(offer).disabled).toBe(true)

    fireEvent.click(
      within(offer).getByRole('button', { name: 'Restore purchase' }),
    )
    await waitFor(() =>
      expect(statusLine(offer)).toBe('Purchases are not available yet.'),
    )
  })

  it('puts Retry in the price slot when the store cannot say, and asks again', async () => {
    const offer$ = vi
      .fn<() => Promise<typeof OFFER | null>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(OFFER)
    withStore(store({ offer: offer$ }))
    const offer = await open()

    await waitFor(() =>
      expect(statusLine(offer)).toBe(
        'The price could not be loaded. Check the connection and try again.',
      ),
    )
    const slot = within(offer).getByTestId('cloud-price')
    expect(subscribeButton(offer).disabled).toBe(true)

    fireEvent.click(within(slot).getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(subscribeButton(offer).disabled).toBe(false))
    expect(slot.textContent).toBe('€4.99 a month')
    expect(offer$).toHaveBeenCalledTimes(2)
    expect(statusLine(offer)).toBe('')
  })
})

describe('Subscribe', () => {
  it('says a pending purchase and a failed one on the status line, where Subscribe stays', async () => {
    const subscribe = vi
      .fn<KaraokeSubscriptionApi['subscribe']>()
      .mockResolvedValueOnce('pending')
      .mockResolvedValueOnce('failed')
    withStore(store({ subscribe }))
    const offer = await open()
    await waitFor(() => expect(subscribeButton(offer).disabled).toBe(false))

    fireEvent.click(subscribeButton(offer))
    await waitFor(() =>
      expect(statusLine(offer)).toBe(
        'The purchase is waiting for approval. The songs arrive once it is approved.',
      ),
    )
    fireEvent.click(subscribeButton(offer))
    await waitFor(() =>
      expect(statusLine(offer)).toBe(
        'The store could not complete the purchase. Try again in a moment.',
      ),
    )
    expect(subscribeButton(offer).disabled).toBe(false)
  })

  it('says the songs are on their way until the server has heard', async () => {
    let release = (): void => undefined
    server.hold = new Promise((resolve) => {
      release = resolve
    })
    withStore(store({ subscribe: async () => Promise.resolve('purchased') }))
    try {
      const offer = await open()
      await waitFor(() => expect(subscribeButton(offer).disabled).toBe(false))

      fireEvent.click(subscribeButton(offer))

      const bought = await waitFor(() =>
        screen.getByRole('dialog', { name: "You're subscribed" }),
      )
      expect(bought.textContent).toContain('Your songs are on their way.')
      expect(songsOnTheWay()).toBe(true)

      server.next = subscriber
      release()
      await waitFor(() =>
        expect(bought.textContent).toContain('20 songs a month are yours.'),
      )
    } finally {
      release()
    }
  })

  it('offers sign-in, not the account offer, right after a first purchase on a phone without one', async () => {
    const onAccount = vi.fn()
    const onSignIn = vi.fn()
    withStore(store({ subscribe: async () => Promise.resolve('purchased') }))
    const offer = await open({ onAccount, onSignIn })
    await waitFor(() => expect(subscribeButton(offer).disabled).toBe(false))
    // The webhook has granted the month by the time /me is asked again.
    server.next = subscriber

    fireEvent.click(subscribeButton(offer))

    const bought = await waitFor(() =>
      screen.getByRole('dialog', { name: "You're subscribed" }),
    )
    await waitFor(() =>
      expect(bought.textContent).toContain(
        '20 songs a month are yours. Keep them with an account, so your subscription and your songs follow you to a new phone.',
      ),
    )
    fireEvent.click(within(bought).getByRole('button', { name: 'Sign in' }))
    // The singer has paid: Sign in is the sign-in sheet, never another offer.
    expect(onSignIn).toHaveBeenCalledTimes(1)
    expect(onAccount).not.toHaveBeenCalled()
    expect(cloudOffer()).toBeNull()
  })

  it('opens the sign-in sheet after a purchase when the shell names no other', async () => {
    const openSignIn = vi.fn()
    withStore(store({ subscribe: async () => Promise.resolve('purchased') }), {
      openSignIn,
    })
    const offer = await open()
    await waitFor(() => expect(subscribeButton(offer).disabled).toBe(false))
    server.next = subscriber

    fireEvent.click(subscribeButton(offer))

    const bought = await waitFor(() =>
      screen.getByRole('dialog', { name: "You're subscribed" }),
    )
    fireEvent.click(within(bought).getByRole('button', { name: 'Sign in' }))
    expect(openSignIn).toHaveBeenCalledTimes(1)
  })

  it('offers an account so the songs follow the singer to a new iPad', async () => {
    const restore = actAsIpad()
    try {
      withStore(store({ subscribe: async () => Promise.resolve('purchased') }))
      const offer = await open()
      await waitFor(() => expect(subscribeButton(offer).disabled).toBe(false))
      server.next = subscriber

      fireEvent.click(subscribeButton(offer))

      const bought = await waitFor(() =>
        screen.getByRole('dialog', { name: "You're subscribed" }),
      )
      await waitFor(() =>
        expect(bought.textContent).toContain(
          'Keep them with an account, so your subscription and your songs follow you to a new iPad.',
        ),
      )
    } finally {
      restore()
    }
  })

  it('says Done, and offers no account, to a singer who has one', async () => {
    auth.account = true
    withStore(store({ subscribe: async () => Promise.resolve('purchased') }))
    const offer = await open()
    await waitFor(() => expect(subscribeButton(offer).disabled).toBe(false))
    server.next = subscriber

    fireEvent.click(subscribeButton(offer))

    const bought = await waitFor(() =>
      screen.getByRole('dialog', { name: "You're subscribed" }),
    )
    expect(within(bought).queryByRole('button', { name: 'Sign in' })).toBeNull()
    fireEvent.click(within(bought).getByRole('button', { name: 'Done' }))
    expect(cloudOffer()).toBeNull()
    // Closing what follows a yes is no Not now.
    expect(localStorage.getItem('mp:cloud-offer-not-now')).toBeNull()
  })

  // TestFlight build 919: bought signed out, signed in to an account that
  // already existed, then Subscribe. The store had the subscription for this
  // phone; Subscribe brings it to the account, and buys nothing.
  it("says what follows a yes once Subscribe brought this phone's own purchase to the account", async () => {
    auth.account = true
    withStore(store({ subscribe: async () => Promise.resolve('moved') }))
    const offer = await open()
    await waitFor(() => expect(subscribeButton(offer).disabled).toBe(false))
    server.next = subscriber

    fireEvent.click(subscribeButton(offer))

    const moved = await waitFor(() =>
      screen.getByRole('dialog', { name: "You're subscribed" }),
    )
    await waitFor(() =>
      expect(moved.textContent).toContain('20 songs a month are yours.'),
    )
  })

  // Owner rule D2: a phone can be shared, so a subscription another account
  // owns never moves by itself. Subscribe says so, and where to move it.
  it('says plainly that another account has the subscription, and names Restore purchase', async () => {
    auth.account = true
    withStore(
      store({ subscribe: async () => Promise.resolve('held-elsewhere') }),
    )
    const offer = await open()
    await waitFor(() => expect(subscribeButton(offer).disabled).toBe(false))

    fireEvent.click(subscribeButton(offer))

    await waitFor(() =>
      expect(statusLine(offer)).toBe(
        "You're already subscribed, on another account. Tap Restore purchase to move it here.",
      ),
    )
    expect(screen.queryByRole('dialog', { name: "You're subscribed" })).toBe(
      null,
    )
    expect(subscribeButton(offer).disabled).toBe(false)
    expect(
      within(offer).getByRole('button', { name: 'Restore purchase' }),
    ).toBeTruthy()
  })
})

describe('who is offered what', () => {
  it('offers a singer without an account the free song an account brings', async () => {
    const onAccount = vi.fn()
    const onSignIn = vi.fn()
    withStore(store())
    const offer = await open({ onAccount, onSignIn })

    fireEvent.click(
      within(offer).getByRole('button', {
        name: 'Sign up and confirm your email for 1 free song a month',
      }),
    )

    expect(onAccount).toHaveBeenCalledTimes(1)
    expect(onSignIn).not.toHaveBeenCalled()
    expect(cloudOffer()).toBeNull()
  })

  it('opens the sign-in sheet for the free account when the shell names no other', async () => {
    const openSignIn = vi.fn()
    withStore(store(), { openSignIn })
    const offer = await open()

    fireEvent.click(
      within(offer).getByRole('button', {
        name: 'Sign up and confirm your email for 1 free song a month',
      }),
    )

    expect(openSignIn).toHaveBeenCalledTimes(1)
  })

  it('tells a signed-in singer whose free song is used when the next one comes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'))
    auth.account = true
    withStore(store())
    const offer = await open()

    expect(offer.textContent).toContain(
      'Your next free song comes on 1 November.',
    )
    expect(
      within(offer).queryByRole('button', {
        name: 'Sign up and confirm your email for 1 free song a month',
      }),
    ).toBeNull()
  })

  it('tells a singer without an account of no next free song', async () => {
    withStore(store())
    const offer = await open()

    expect(offer.textContent).not.toContain('Your next free song')
  })

  it('tells a singer the server gives a free song each month when the next one comes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'))
    auth.account = true
    resetKaraokeSongsForTests({ ...noSongs, monthly: true })
    withStore(store())
    const offer = await open()

    expect(offer.textContent).toContain(
      'Your next free song comes on 1 November.',
    )
    expect(account.reads).toBe(0)
  })

  it('asks an account with its email unconfirmed to confirm it, and promises no next song', async () => {
    auth.account = true
    accountSays({ emailVerified: false })
    resetKaraokeSongsForTests({ ...noSongs, monthly: false })
    withStore(store())
    const offer = await open()

    await waitFor(() =>
      expect(offer.textContent).toContain(
        'Confirm your email for 1 free song a month.',
      ),
    )
    expect(offer.textContent).not.toContain('Your next free song')
  })

  it('says nothing of a free song to an account confirming would not help', async () => {
    auth.account = true
    accountSays({ emailVerified: true })
    resetKaraokeSongsForTests({ ...noSongs, monthly: false })
    withStore(store())
    const offer = await open()

    await waitFor(() => expect(account.reads).toBe(1))
    expect(offer.textContent).not.toContain('Your next free song')
    expect(offer.textContent).not.toContain('Confirm your email')
  })

  it('says nothing of a free song when the account cannot be read', async () => {
    auth.account = true
    resetKaraokeSongsForTests({ ...noSongs, monthly: false })
    withStore(store())
    const offer = await open()

    await waitFor(() => expect(account.reads).toBe(1))
    expect(offer.textContent).not.toContain('Your next free song')
    expect(offer.textContent).not.toContain('Confirm your email')
  })
})

describe('Merc by the art', () => {
  it('stands the guest the onboarding hands over by the art, hidden from a screen reader, and lets him go as the offer closes', async () => {
    withStore(store())
    const offer = await open()
    const merc = document.createElement('div')
    merc.dataset.testid = 'onboarding-merc'

    setCloudOfferGuest(merc)

    const slot = await waitFor(() => {
      const found = offer.querySelector('[data-testid="cloud-offer-guest"]')
      expect(found).not.toBeNull()
      return found
    })
    expect(slot?.contains(merc)).toBe(true)
    expect(slot?.closest('[aria-hidden="true"]')).not.toBeNull()
    closeCloudOffer('not-now')
    expect(cloudOfferGuest()).toBeNull()
    expect(merc.isConnected).toBe(false)
  })

  it('has nobody by the art on an offer nobody handed a guest to', async () => {
    withStore(store())
    const offer = await open()

    expect(offer.querySelector('[data-testid="cloud-offer-guest"]')).toBeNull()
  })
})

describe('Not now', () => {
  it('closes the offer and keeps offers nobody asked for away', async () => {
    withStore(store())
    const offer = await open()

    fireEvent.click(within(offer).getByRole('button', { name: 'Not now' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Sing your own songs' }),
      ).toBeNull(),
    )
    expect(unaskedRefusal()).toBe('not-now')
  })

  it('is what Escape says too', async () => {
    withStore(store())
    const offer = await open()

    fireEvent.keyDown(offer, { key: 'Escape' })

    await waitFor(() => expect(cloudOffer()).toBeNull())
    expect(unaskedRefusal()).toBe('not-now')
  })
})

describe('Restore purchase', () => {
  it('closes once the server has the subscription', async () => {
    withStore(store({ restore: async () => Promise.resolve('restored') }))
    const offer = await open()
    server.next = subscriber

    fireEvent.click(
      within(offer).getByRole('button', { name: 'Restore purchase' }),
    )

    await waitFor(() => expect(cloudOffer()).toBeNull())
    expect(karaokeSongs().left).toBe(20)
  })

  it('says a restore at once, and leaves an offer the singer closed closed', async () => {
    let release = (): void => undefined
    server.hold = new Promise((resolve) => {
      release = resolve
    })
    withStore(store({ restore: async () => Promise.resolve('restored') }))
    try {
      const offer = await open()

      fireEvent.click(
        within(offer).getByRole('button', { name: 'Restore purchase' }),
      )
      await waitFor(() =>
        expect(statusLine(offer)).toBe(
          'Your Mercury Pitch Cloud subscription is restored.',
        ),
      )
      fireEvent.click(within(offer).getByRole('button', { name: 'Not now' }))

      // The server never hears within the wait; nothing opens by itself.
      release()
      await waitFor(() => expect(songsOnTheWay()).toBe(false))
      expect(screen.queryByRole('dialog')).toBeNull()
    } finally {
      release()
    }
  })

  it('says a restore found nothing, where there was nothing', async () => {
    withStore(store())
    const offer = await open()

    fireEvent.click(
      within(offer).getByRole('button', { name: 'Restore purchase' }),
    )

    await waitFor(() =>
      expect(statusLine(offer)).toBe(
        'No Mercury Pitch Cloud subscription was found to restore.',
      ),
    )
  })
})
