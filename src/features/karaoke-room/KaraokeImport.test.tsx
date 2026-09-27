// ============================================================
// Import a song: the button, the picker, and the sheets (plan S8 §6)
// ============================================================
//
// The button asks the phone's own picker for songs, checks each one, and
// asks once before any is sent: what it uses, what is sent where, and how
// long to keep the app open. Nothing is sent without that yes. With no songs
// left it shows the gate instead of the picker: the paywall without a
// subscription, the date the songs come back with one. Subscribe fails
// closed until the store products exist.

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Songs from './karaoke-songs'
import type { KaraokeSongs } from './karaoke-songs'

const queue = vi.hoisted(() => ({
  enqueued: [] as File[][],
  gate: null as null | ((songs: KaraokeSongs) => void),
  duplicate: null as null | string,
  refuseAtQueue: false,
}))
vi.mock('./karaoke-import-queue', () => ({
  enqueueImports: vi.fn(async (files: File[]) => {
    queue.enqueued.push(files)
    return Promise.resolve({
      queued: queue.refuseAtQueue ? [] : files.map((_, i) => `s${i}`),
      refused: queue.refuseAtQueue
        ? files.map((file) => ({
            title: file.name,
            refusal: {
              title: 'Not enough space on this phone',
              body: 'Free up some space and try again. Nothing was used.',
            },
          }))
        : [],
    })
  }),
  duplicateOf: (file: File) =>
    queue.duplicate === file.name
      ? {
          title: 'Harbour Lights is already in your songs',
          body: 'Nothing was used.',
        }
      : null,
  setImportGateHandler: (handler: (songs: KaraokeSongs) => void) => {
    queue.gate = handler
    return () => {
      if (queue.gate === handler) queue.gate = null
    }
  },
}))

const checks = vi.hoisted(() => ({
  refusals: new Map<string, { title: string; body: string }>(),
}))
vi.mock('./karaoke-import-checks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkImport: vi.fn(async (file: File) =>
    Promise.resolve(checks.refusals.get(file.name) ?? null),
  ),
}))

const server = vi.hoisted(() => ({ next: null as KaraokeSongs | null }))
vi.mock('./karaoke-songs', async (importOriginal) => {
  const actual = await importOriginal<typeof Songs>()
  return {
    ...actual,
    refreshKaraokeSongs: vi.fn(async () => {
      if (server.next !== null) actual.resetKaraokeSongsForTests(server.next)
      return Promise.resolve(actual.karaokeSongs())
    }),
  }
})

const auth = vi.hoisted(() => ({ registered: false }))
vi.mock('@/db/services/auth-service', () => ({
  hasUpgradedAccount: () => auth.registered,
}))

import type { KaraokeSubscriptionApi } from '@/stores/native-shell-store'
import { registerShellApi } from '@/stores/native-shell-store'
import { IMPORT_ACCEPT } from './karaoke-import-checks'
import { karaokeSongs, resetKaraokeSongsForTests } from './karaoke-songs'
import { KaraokeImport } from './KaraokeImport'

const subscriber: KaraokeSongs = {
  left: 18,
  subscribed: true,
  renewsAt: '2026-10-27T10:00:00.000Z',
  perPeriod: 20,
}

function song(name: string): File {
  return new File([new Uint8Array(1024)], name, { type: 'audio/mpeg' })
}

let clicks: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  queue.enqueued = []
  queue.gate = null
  queue.duplicate = null
  queue.refuseAtQueue = false
  checks.refusals.clear()
  server.next = null
  auth.registered = false
  resetKaraokeSongsForTests(subscriber)
  clicks = vi
    .spyOn(HTMLInputElement.prototype, 'click')
    .mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  clicks.mockRestore()
})

function mount(): HTMLInputElement {
  render(() => <KaraokeImport />)
  const input = screen.getByTestId('karaoke-import-input')
  if (!(input instanceof HTMLInputElement)) throw new Error('no picker')
  return input
}

function pick(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  fireEvent.change(input)
}

async function sheet(name: string): Promise<HTMLElement> {
  return waitFor(() => screen.getByRole('dialog', { name }))
}

describe('the Import button', () => {
  it("says what can be imported and what is left, and asks the phone's picker", () => {
    const input = mount()

    expect(
      screen.getByText(
        'Songs from Files: MP3, M4A, WAV or FLAC, up to 12 minutes. 18 of 20 songs left this month.',
      ),
    ).toBeTruthy()
    expect(input.type).toBe('file')
    expect(input.multiple).toBe(true)
    expect(input.accept).toBe(IMPORT_ACCEPT)

    fireEvent.click(screen.getByRole('button', { name: 'Import a song' }))

    expect(clicks).toHaveBeenCalledTimes(1)
  })

  it('shows the paywall, not the picker, with no songs and no subscription', async () => {
    resetKaraokeSongsForTests({
      left: 0,
      subscribed: false,
      renewsAt: null,
      perPeriod: 20,
    })
    mount()

    fireEvent.click(screen.getByRole('button', { name: 'Import a song' }))

    const paywall = await sheet('Sing your own songs')
    expect(clicks).not.toHaveBeenCalled()
    expect(paywall.textContent).toContain('20 songs a month · €4.99')
    expect(paywall.textContent).toContain(
      'Renews every month until you cancel. Cancel any time in Settings.',
    )
    for (const line of [
      'Any song from Files on this phone',
      'Voice and music separated on our server',
      'Your songs stay on this phone and play offline',
    ]) {
      expect(within(paywall).getByText(line)).toBeTruthy()
    }
    expect(
      within(paywall)
        .getByRole('link', { name: 'Terms of Use' })
        .getAttribute('href'),
    ).toBe('https://about.mercurypitch.com/terms')
    expect(
      within(paywall)
        .getByRole('link', { name: 'Privacy Policy' })
        .getAttribute('href'),
    ).toBe('https://about.mercurypitch.com/privacy')
    expect(within(paywall).getByRole('button', { name: 'Later' })).toBeTruthy()
  })

  it('says when the songs come back, with none left this month', async () => {
    resetKaraokeSongsForTests({ ...subscriber, left: 0 })
    mount()

    fireEvent.click(screen.getByRole('button', { name: 'Import a song' }))

    const used = await sheet('No songs left this month')
    expect(clicks).not.toHaveBeenCalled()
    expect(used.textContent).toContain('Your 20 songs come back on 27 October.')
    expect(used.textContent).toContain(
      'The songs you imported stay on this phone and still play.',
    )
  })

  it('opens the gate when the queue meets a refusal', async () => {
    mount()

    queue.gate?.({ left: 0, subscribed: false, renewsAt: null, perPeriod: 20 })

    const paywall = await sheet('Sing your own songs')
    expect(paywall.textContent).toContain('20 songs a month · €4.99')
    expect(clicks).not.toHaveBeenCalled()
  })
})

describe('the confirm sheet', () => {
  it('asks once, says what it uses and what is sent, and sends on Separate', async () => {
    const input = mount()

    pick(input, [song('Harbour Lights.mp3')])

    const confirm = await sheet('Separate this song?')
    const text = confirm.textContent ?? ''
    expect(text).toContain('Harbour Lights')
    expect(text).toContain(
      'Uses 1 of your 20 songs this month. 17 left after this.',
    )
    expect(text).toContain(
      'Sends: this song to our server, which splits it into voice and music.',
    )
    expect(text).toContain(
      'Open Mercury Pitch within about a day to save it to this phone.',
    )
    expect(text).toContain('Keep Mercury Pitch open while it is sent')
    // Owner, 27 and 28 Sep: the copy promises no longer than the stems are
    // kept, never says credits, and never says nothing is uploaded.
    expect(text).not.toMatch(
      /48|hours|week|seven days|7 days|credit|nothing uploaded/iu,
    )
    expect(queue.enqueued).toEqual([])

    fireEvent.click(within(confirm).getByRole('button', { name: 'Separate' }))

    await waitFor(() => expect(queue.enqueued).toHaveLength(1))
    expect(queue.enqueued[0]?.map((file) => file.name)).toEqual([
      'Harbour Lights.mp3',
    ])
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Separate this song?' }),
      ).toBeNull(),
    )
  })

  it('names the count for several songs', async () => {
    const input = mount()

    pick(input, [song('A.mp3'), song('B.mp3'), song('C.mp3')])

    const confirm = await sheet('Separate 3 songs?')
    expect(confirm.textContent).toContain(
      'Uses 3 of your 20 songs this month. 15 left after this.',
    )
    expect(confirm.textContent).toContain(
      'Open Mercury Pitch within about a day to save them to this phone.',
    )
  })

  it('sends nothing on Cancel', async () => {
    const input = mount()
    pick(input, [song('Harbour Lights.mp3')])
    const confirm = await sheet('Separate this song?')

    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Separate this song?' }),
      ).toBeNull(),
    )
    expect(queue.enqueued).toEqual([])
  })

  it('leaves out, by name, the songs that fail a check', async () => {
    checks.refusals.set('Midnight Tram (live).wav', {
      title: 'This song is too long',
      body: 'Songs up to 12 minutes can be separated. Midnight Tram (live) is 14:05. Nothing was used.',
    })
    const input = mount()

    pick(input, [song('Harbour Lights.mp3'), song('Midnight Tram (live).wav')])

    const confirm = await sheet('Separate this song?')
    expect(confirm.textContent).toContain(
      'Left out: Midnight Tram (live). This song is too long.',
    )
    fireEvent.click(within(confirm).getByRole('button', { name: 'Separate' }))
    await waitFor(() => expect(queue.enqueued).toHaveLength(1))
    expect(queue.enqueued[0]?.map((file) => file.name)).toEqual([
      'Harbour Lights.mp3',
    ])
  })

  it('sends only as many songs as are left', async () => {
    resetKaraokeSongsForTests({ ...subscriber, left: 1 })
    const input = mount()

    pick(input, [song('A.mp3'), song('B.mp3')])

    const confirm = await sheet('Separate this song?')
    expect(confirm.textContent).toContain('Left out: B. No songs left for it.')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Separate' }))
    await waitFor(() => expect(queue.enqueued).toHaveLength(1))
    expect(queue.enqueued[0]?.map((file) => file.name)).toEqual(['A.mp3'])
  })

  it('asks the server what is left before it asks the singer', async () => {
    const input = mount()
    // The room last heard of 18; the month ran out since.
    server.next = { left: 0, subscribed: false, renewsAt: null, perPeriod: 20 }

    pick(input, [song('Harbour Lights.mp3')])

    await sheet('Sing your own songs')
    expect(
      screen.queryByRole('dialog', { name: 'Separate this song?' }),
    ).toBeNull()
  })
})

describe('a song refused before anything is sent', () => {
  it('says why, and nothing is queued', async () => {
    checks.refusals.set('Midnight Tram (live).wav', {
      title: 'This song is too long',
      body: 'Songs up to 12 minutes can be separated. Midnight Tram (live) is 14:05. Nothing was used.',
    })
    const input = mount()

    pick(input, [song('Midnight Tram (live).wav')])

    const refused = await sheet('This song is too long')
    expect(refused.textContent).toContain(
      'Songs up to 12 minutes can be separated. Midnight Tram (live) is 14:05. Nothing was used.',
    )
    fireEvent.click(within(refused).getByRole('button', { name: 'OK' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'This song is too long' }),
      ).toBeNull(),
    )
    expect(queue.enqueued).toEqual([])
  })

  it('is refused when it is already here', async () => {
    queue.duplicate = 'Harbour Lights.mp3'
    const input = mount()

    pick(input, [song('Harbour Lights.mp3')])

    const refused = await sheet('Harbour Lights is already in your songs')
    expect(refused.textContent).toContain('Nothing was used.')
    expect(
      screen.queryByRole('dialog', { name: 'Separate this song?' }),
    ).toBeNull()
    expect(queue.enqueued).toEqual([])
  })

  it('is refused when the phone cannot keep a copy of it', async () => {
    queue.refuseAtQueue = true
    const input = mount()
    pick(input, [song('Harbour Lights.mp3')])
    const confirm = await sheet('Separate this song?')

    fireEvent.click(within(confirm).getByRole('button', { name: 'Separate' }))

    const refused = await sheet('Not enough space on this phone')
    expect(refused.textContent).toContain(
      'Free up some space and try again. Nothing was used.',
    )
    expect(queue.enqueued).toHaveLength(1)
  })
})

describe('the paywall', () => {
  function openPaywall(): Promise<HTMLElement> {
    resetKaraokeSongsForTests({
      left: 0,
      subscribed: false,
      renewsAt: null,
      perPeriod: 20,
    })
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Import a song' }))
    return sheet('Sing your own songs')
  }

  it('fails closed: Subscribe and Restore say they are not available yet', async () => {
    const paywall = await openPaywall()

    fireEvent.click(within(paywall).getByRole('button', { name: 'Subscribe' }))
    await waitFor(() =>
      expect(paywall.textContent).toContain(
        'Subscriptions are not available yet.',
      ),
    )

    fireEvent.click(
      within(paywall).getByRole('button', { name: 'Restore purchases' }),
    )
    await waitFor(() =>
      expect(paywall.textContent).toContain('Purchases are not available yet.'),
    )
  })

  it('offers an account right after a first purchase on a phone without one', async () => {
    const openSignIn = vi.fn()
    const api: KaraokeSubscriptionApi = {
      subscribe: vi.fn(async () => Promise.resolve('purchased' as const)),
      restore: vi.fn(async () => Promise.resolve('nothing' as const)),
    }
    const unregister = registerShellApi({
      pushSettings: vi.fn(),
      openSignIn,
      karaokeSubscription: api,
    })
    try {
      const paywall = await openPaywall()
      // The webhook has granted the month by the time /me is asked again.
      server.next = subscriber

      fireEvent.click(
        within(paywall).getByRole('button', { name: 'Subscribe' }),
      )

      const offer = await sheet("You're subscribed")
      expect(offer.textContent).toContain(
        '20 songs a month are yours. Keep them with an account, so your subscription and your songs follow you to a new phone.',
      )
      fireEvent.click(within(offer).getByRole('button', { name: 'Sign in' }))
      expect(openSignIn).toHaveBeenCalledTimes(1)
    } finally {
      unregister()
    }
  })

  it('closes on a restore, with the songs asked for again', async () => {
    const unregister = registerShellApi({
      pushSettings: vi.fn(),
      karaokeSubscription: {
        subscribe: async () => Promise.resolve('cancelled' as const),
        restore: async () => Promise.resolve('restored' as const),
      },
    })
    try {
      const paywall = await openPaywall()
      server.next = subscriber

      fireEvent.click(
        within(paywall).getByRole('button', { name: 'Restore purchases' }),
      )

      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Sing your own songs' }),
        ).toBeNull(),
      )
      expect(karaokeSongs().left).toBe(18)
    } finally {
      unregister()
    }
  })

  it('says a restore found nothing, where there was nothing', async () => {
    const unregister = registerShellApi({
      pushSettings: vi.fn(),
      karaokeSubscription: {
        subscribe: async () => Promise.resolve('cancelled' as const),
        restore: async () => Promise.resolve('nothing' as const),
      },
    })
    try {
      const paywall = await openPaywall()

      fireEvent.click(
        within(paywall).getByRole('button', { name: 'Restore purchases' }),
      )

      await waitFor(() =>
        expect(paywall.textContent).toContain(
          'No Karaoke subscription was found to restore.',
        ),
      )
    } finally {
      unregister()
    }
  })
})
