// ============================================================
// Import a song: the button, the gate, the picker and the sheets
// ============================================================
//
// Plan S8 §6 and S7b §4.3. The button asks before it opens Files: songs to
// use open the picker at once, with a chip that says how many; a subscriber
// with none left is told when the next ones come; anyone else meets the
// Cloud offer (CloudOffer.test.tsx says what the offer itself does). What is
// picked is checked, and the singer is asked once before any of it is sent.

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

// The app's counts (S7b §7), heard on their way to the funnel.
const counts = vi.hoisted(() => ({ sent: [] as string[] }))
vi.mock('@/lib/analytics', () => ({
  trackEvent: (event: string) => counts.sent.push(event),
}))

const auth = vi.hoisted(() => ({ registered: false, token: true }))
vi.mock('@/db/services/auth-service', () => ({
  accountHeld: () => auth.registered,
  hasUpgradedAccount: () => auth.registered,
  hasValidToken: () => auth.token,
  requireAuth: async () => Promise.resolve(true),
}))

import { registerShellApi } from '@/stores/native-shell-store'
import { actAsIpad } from '@/tests/helpers/ipad-navigator'
import { resetCloudOfferForTests } from './cloud-offer-store'
import { CloudOffer } from './CloudOffer'
import { IMPORT_ACCEPT } from './karaoke-import-checks'
import { resetKaraokeSongsForTests } from './karaoke-songs'
import { KaraokeImport } from './KaraokeImport'

/** The store's price for the month's plan, as the offer states it. */
const OFFER = { priceText: '€4.99', title: 'Mercury Pitch Cloud' }
const offered = async () => Promise.resolve(OFFER)

const subscriber: KaraokeSongs = {
  left: 18,
  subscribed: true,
  renewsAt: '2026-10-27T10:00:00.000Z',
  perPeriod: 20,
}

/** Not subscribed, and nothing left to use. */
const noSongs: KaraokeSongs = {
  left: 0,
  subscribed: false,
  renewsAt: null,
  perPeriod: 20,
}

function song(name: string): File {
  return new File([new Uint8Array(1024)], name, { type: 'audio/mpeg' })
}

let clicks: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  counts.sent = []
  queue.enqueued = []
  queue.gate = null
  queue.duplicate = null
  queue.refuseAtQueue = false
  checks.refusals.clear()
  server.next = null
  server.hold = null
  auth.registered = false
  auth.token = true
  resetKaraokeSongsForTests(subscriber)
  resetCloudOfferForTests()
  clicks = vi
    .spyOn(HTMLInputElement.prototype, 'click')
    .mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  clicks.mockRestore()
  resetCloudOfferForTests()
  vi.useRealTimers()
})

/** The room's import row, and the offer the shell draws once. */
function mount(): HTMLInputElement {
  render(() => (
    <>
      <KaraokeImport />
      <CloudOffer />
    </>
  ))
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

function importButton(): HTMLElement {
  return screen.getByRole('button', { name: /^Import a song/u })
}

describe('the Import button', () => {
  it("says what can be imported and how many songs are left, and asks the phone's picker", () => {
    const input = mount()

    expect(
      screen.getByText(
        'Songs from Files: MP3, M4A, WAV or FLAC, up to 12 minutes.',
      ),
    ).toBeTruthy()
    expect(screen.getByTestId('karaoke-import-chip').textContent).toBe(
      '18 of 20 songs left',
    )
    expect(input.type).toBe('file')
    expect(input.multiple).toBe(true)
    expect(input.accept).toBe(IMPORT_ACCEPT)

    fireEvent.click(importButton())

    expect(clicks).toHaveBeenCalledTimes(1)
  })

  it("opens Files for a signed-in singer's free song, and says it is that", () => {
    auth.registered = true
    resetKaraokeSongsForTests({ ...noSongs, left: 1, free: 1 })
    mount()

    expect(screen.getByTestId('karaoke-import-chip').textContent).toBe(
      'Your free song this month',
    )
    fireEvent.click(importButton())

    expect(clicks).toHaveBeenCalledTimes(1)
  })

  it('opens the offer, not the picker, with no songs and no account', async () => {
    resetKaraokeSongsForTests(noSongs)
    mount()

    expect(screen.queryByTestId('karaoke-import-chip')).toBeNull()
    fireEvent.click(importButton())

    const offer = await sheet('Sing your own songs')
    expect(clicks).not.toHaveBeenCalled()
    expect(
      within(offer).getByRole('button', {
        name: 'Sign up and confirm your email for 1 free song a month',
      }),
    ).toBeTruthy()
  })

  it('opens the offer on a fresh install, where nothing is known yet', async () => {
    auth.token = false
    resetKaraokeSongsForTests({ ...noSongs, left: null })
    mount()

    fireEvent.click(importButton())

    await sheet('Sing your own songs')
    expect(clicks).not.toHaveBeenCalled()
  })

  it("offers a signed-in singer whose free song is used the plan, and the next song's date", async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'))
    auth.registered = true
    resetKaraokeSongsForTests({ ...noSongs, free: 0 })
    mount()

    fireEvent.click(importButton())

    const offer = await sheet('Sing your own songs')
    expect(offer.textContent).toContain(
      'Your next free song comes on 1 November.',
    )
    expect(clicks).not.toHaveBeenCalled()
  })

  it('tells a subscriber with none left when the next songs come, and offers nothing', async () => {
    resetKaraokeSongsForTests({ ...subscriber, left: 0 })
    mount()

    fireEvent.click(importButton())

    const used = await sheet('No songs left this month')
    expect(clicks).not.toHaveBeenCalled()
    expect(used.textContent).toContain(
      "You've used all your songs this month. 20 more on 27 October.",
    )
    expect(used.textContent).toContain(
      'The songs you imported stay on this phone and still play.',
    )
    expect(
      screen.queryByRole('dialog', { name: 'Sing your own songs' }),
    ).toBeNull()
  })

  it('opens Files after all when the server, asked again, has songs to use', async () => {
    resetKaraokeSongsForTests(noSongs)
    mount()
    // Review access, say: songs the server gives a singer without Cloud.
    server.next = { ...noSongs, left: 3 }

    fireEvent.click(importButton())

    await waitFor(() => expect(clicks).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the gate when the queue meets a refusal', async () => {
    mount()
    server.next = noSongs

    queue.gate?.(noSongs)

    const offer = await sheet('Sing your own songs')
    expect(offer.textContent).toContain('20 songs a month')
    expect(clicks).not.toHaveBeenCalled()
  })
})

describe('a refusal at the server', () => {
  it('opens no picker by itself when songs turn up: the queue sends the song again', async () => {
    resetKaraokeSongsForTests(noSongs)
    mount()
    server.next = { ...noSongs, left: 3 }

    queue.gate?.(noSongs)

    await waitFor(() =>
      expect(importButton().getAttribute('aria-busy')).toBeNull(),
    )
    expect(clicks).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('before the offer opens', () => {
  // Review of PR 880, finding 5: a store subscriber whose songs the server
  // has not heard of yet (the webhook slow, or failed) is never offered the
  // subscription again. S7 §3.9: the more generous of server and store.
  it('shows a subscriber the store knows the songs on their way, not the offer', async () => {
    const storeSubscribed = vi.fn(async () => Promise.resolve(true))
    const unregister = registerShellApi({
      pushSettings: vi.fn(),
      karaokeSubscription: {
        subscribe: vi.fn(async () => Promise.resolve('purchased' as const)),
        restore: async () => Promise.resolve('nothing' as const),
        offer: offered,
        storeSubscribed,
      },
    })
    let release = (): void => undefined
    server.hold = new Promise((resolve) => {
      release = resolve
    })
    try {
      resetKaraokeSongsForTests(noSongs)
      mount()
      fireEvent.click(importButton())

      const coming = await sheet("You're subscribed")
      expect(coming.textContent).toContain('Your songs are on their way.')
      expect(
        screen.queryByRole('dialog', { name: 'Sing your own songs' }),
      ).toBeNull()
      expect(storeSubscribed).toHaveBeenCalledTimes(1)

      // Import again before the webhook: not the offer a second time, and
      // the store is not asked again.
      fireEvent.click(within(coming).getByRole('button', { name: 'Close' }))
      fireEvent.click(importButton())
      const again = await sheet("You're subscribed")
      expect(storeSubscribed).toHaveBeenCalledTimes(1)

      server.next = { ...subscriber, left: 20 }
      release()
      await waitFor(() =>
        expect(again.textContent).toContain('20 songs a month are yours.'),
      )
    } finally {
      release()
      unregister()
    }
  })

  it('offers the subscription anyway when the store does not answer in time', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const unregister = registerShellApi({
      pushSettings: vi.fn(),
      karaokeSubscription: {
        subscribe: async () => Promise.resolve('cancelled' as const),
        restore: async () => Promise.resolve('nothing' as const),
        offer: offered,
        storeSubscribed: async () => new Promise<boolean>(() => undefined),
      },
    })
    try {
      resetKaraokeSongsForTests(noSongs)
      mount()
      fireEvent.click(importButton())
      await vi.advanceTimersByTimeAsync(2_900)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(importButton().getAttribute('aria-busy')).toBe('true')

      await vi.advanceTimersByTimeAsync(200)
      vi.useRealTimers()

      await sheet('Sing your own songs')
    } finally {
      vi.useRealTimers()
      unregister()
    }
  })

  it('offers the subscription where the store holds none either', async () => {
    const storeSubscribed = vi.fn(async () => Promise.resolve(false))
    const unregister = registerShellApi({
      pushSettings: vi.fn(),
      karaokeSubscription: {
        subscribe: async () => Promise.resolve('cancelled' as const),
        restore: async () => Promise.resolve('nothing' as const),
        offer: offered,
        storeSubscribed,
      },
    })
    try {
      resetKaraokeSongsForTests(noSongs)
      mount()
      fireEvent.click(importButton())

      await sheet('Sing your own songs')
      expect(storeSubscribed).toHaveBeenCalledTimes(1)
    } finally {
      unregister()
    }
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
    // The room last heard of 18; the subscription ended since.
    server.next = noSongs

    pick(input, [song('Harbour Lights.mp3')])

    await sheet('Sing your own songs')
    expect(
      screen.queryByRole('dialog', { name: 'Separate this song?' }),
    ).toBeNull()
  })
})

describe('counted (S7b §7)', () => {
  it('counts Import by the gate the singer was in, and the songs sent', async () => {
    const input = mount()
    fireEvent.click(importButton())
    pick(input, [song('Harbour Lights.mp3')])
    const confirm = await sheet('Separate this song?')

    fireEvent.click(within(confirm).getByRole('button', { name: 'Separate' }))

    await waitFor(() =>
      expect(counts.sent).toEqual(['import_tap_songs_left', 'import_sent']),
    )
  })

  it('counts the tap that opens the offer, and the offer by where it opened', async () => {
    resetKaraokeSongsForTests(noSongs)
    mount()

    fireEvent.click(importButton())

    await sheet('Sing your own songs')
    expect(counts.sent).toEqual(['import_tap_no_account', 'cloud_view_import'])
  })

  it('counts nothing sent when the queue turns every song away', async () => {
    queue.refuseAtQueue = true
    const input = mount()
    pick(input, [song('Harbour Lights.mp3')])
    const confirm = await sheet('Separate this song?')

    fireEvent.click(within(confirm).getByRole('button', { name: 'Separate' }))

    await waitFor(() => expect(queue.enqueued).toHaveLength(1))
    expect(counts.sent).toEqual([])
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

describe('on an iPad', () => {
  it('says the songs imported stay on this iPad', async () => {
    const restore = actAsIpad()
    try {
      resetKaraokeSongsForTests({ ...subscriber, left: 0 })
      mount()
      fireEvent.click(importButton())

      const used = await sheet('No songs left this month')
      expect(used.textContent).toContain(
        'The songs you imported stay on this iPad and still play.',
      )
      expect(used.textContent).not.toMatch(/\bphones?\b/iu)
    } finally {
      restore()
    }
  })
})
