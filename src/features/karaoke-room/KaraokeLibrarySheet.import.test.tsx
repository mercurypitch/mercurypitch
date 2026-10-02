// ============================================================
// The library sheet where songs can be imported (plan S8 §3, §6.4, §6.6)
// ============================================================
//
// Stage 2 (a dev-target build): Import heads the sheet, the queue's rows sit
// at the top of your songs with what each is waiting for, a new song carries
// a dot until it is first sung, and each imported song has one menu item,
// Remove from this phone. KaraokeLibrarySheet.test.tsx pins the store build,
// which has none of it.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as NativeBuild from '@/lib/native-build'
import type { ImportRow } from './karaoke-import-queue'
import type { RoomSong } from './karaoke-room-library'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  IS_NATIVE_BUILD: true,
  KARAOKE_IMPORT: true,
}))

const queue = vi.hoisted(() => ({
  rows: [] as ImportRow[],
  sending: null as string | null,
  fresh: [] as string[],
  retried: [] as string[],
  removed: [] as string[],
  removedSongs: [] as string[],
  gates: 0,
}))
vi.mock('./karaoke-import-queue', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  importRows: () => queue.rows,
  sendingTitle: () => queue.sending,
  karaokeNewSongs: () => queue.fresh,
  retryImport: (id: string) => queue.retried.push(id),
  removeImport: async (id: string) => {
    queue.removed.push(id)
    return Promise.resolve()
  },
  removeImportedSong: async (id: string) => {
    queue.removedSongs.push(id)
    return Promise.resolve()
  },
  showImportGate: () => {
    queue.gates += 1
  },
}))
vi.mock('./KaraokeImport', () => ({
  KaraokeImport: () => <div data-testid="karaoke-import">Import a song</div>,
}))

import { actAsIpad } from '@/tests/helpers/ipad-navigator'
import { KaraokeLibrarySheet } from './KaraokeLibrarySheet'

const GOODBYE: RoomSong = {
  sessionId: 'karaoke-night-demo',
  title: 'Goodbye to Spring',
  artist: 'Josh Woodward',
  durationSec: 246,
  credit: 'Josh Woodward · CC BY 4.0',
  kind: 'example',
  stems: { vocal: '/v.m4a', instrumental: '/i.m4a' },
}
const PAPER: RoomSong = {
  sessionId: 'paper',
  title: 'Paper Moon Waltz',
  artist: null,
  durationSec: 271,
  credit: null,
  kind: 'yours',
  stems: { vocal: 'blob:v', instrumental: 'blob:i' },
}

beforeEach(() => {
  queue.rows = []
  queue.sending = null
  queue.fresh = []
  queue.retried = []
  queue.removed = []
  queue.removedSongs = []
  queue.gates = 0
})

afterEach(() => {
  cleanup()
})

function open(songs: RoomSong[]) {
  const onPick = vi.fn()
  render(() => (
    <KaraokeLibrarySheet
      isOpen
      close={vi.fn()}
      songs={() => songs}
      currentId={() => null}
      onPick={onPick}
    />
  ))
  return { onPick, sheet: screen.getByTestId('karaoke-library') }
}

const row = (title: string): HTMLElement => {
  const found = screen
    .getAllByTestId('karaoke-queue-row')
    .find((candidate) => candidate.textContent?.startsWith(title) === true)
  if (found === undefined) throw new Error(`no queue row for ${title}`)
  return found
}

describe('the library, where songs can be imported', () => {
  it('opens on Import, and says where imported songs go while there are none', () => {
    const { sheet } = open([GOODBYE])

    const first = sheet.querySelector('[data-testid="karaoke-import"], section')
    expect(first?.getAttribute('data-testid')).toBe('karaoke-import')
    expect(within(sheet).getByText('Your songs')).toBeTruthy()
    expect(
      within(sheet).getByText('Songs you import appear here.'),
    ).toBeTruthy()
  })

  it('lists the queue above your songs, each row saying what it waits for', () => {
    queue.rows = [
      {
        sessionId: 'harbour',
        title: 'Harbour Lights',
        state: { kind: 'sending', share: 0.45, again: null },
      },
      { sessionId: 'salt', title: 'Salt and Honey', state: { kind: 'queued' } },
      {
        sessionId: 'long',
        title: 'Long Road North',
        state: { kind: 'separating', percent: 62 },
      },
      {
        sessionId: 'lanterns',
        title: 'Lanterns on the Water',
        state: { kind: 'saving' },
      },
    ]
    queue.sending = 'Harbour Lights'
    const { sheet } = open([PAPER, GOODBYE])

    expect(
      within(sheet)
        .getAllByTestId(/karaoke-(queue|library)-row/u)
        .map((element) => element.textContent),
    ).toEqual([
      expect.stringContaining('Harbour LightsSending · 45%'),
      expect.stringContaining('Salt and HoneyWaiting for a studio slot'),
      expect.stringContaining('Long Road NorthSeparating · 62%'),
      expect.stringContaining('Lanterns on the WaterSaving to this phone'),
      expect.stringContaining('Paper Moon Waltz'),
      expect.stringContaining('Goodbye to Spring'),
    ])
    expect(
      within(sheet).getByText(
        'Keep Mercury Pitch open until Harbour Lights is sent.',
      ),
    ).toBeTruthy()
    // A bar for the two that move.
    expect(
      row('Harbour Lights')
        .querySelector('[role="progressbar"]')
        ?.getAttribute('aria-valuenow'),
    ).toBe('45')
    expect(
      row('Long Road North')
        .querySelector('[role="progressbar"]')
        ?.getAttribute('aria-valuenow'),
    ).toBe('62')
    expect(
      row('Salt and Honey').querySelector('[role="progressbar"]'),
    ).toBeNull()
    expect(
      within(sheet).queryByText('Songs you import appear here.'),
    ).toBeNull()
  })

  it('offers Try again and Remove on a song that failed', () => {
    queue.rows = [
      {
        sessionId: 'long',
        title: 'Long Road North',
        state: { kind: 'failed', reason: 'separation' },
      },
    ]
    const { sheet } = open([])

    const failed = row('Long Road North')
    expect(failed.textContent).toContain(
      'This song could not be separated. It was given back.',
    )
    // A row in the queue is a song on its way: the list is not empty.
    expect(
      within(sheet).queryByText('Songs you import appear here.'),
    ).toBeNull()
    fireEvent.click(within(failed).getByRole('button', { name: 'Try again' }))
    fireEvent.click(within(failed).getByRole('button', { name: 'Remove' }))

    expect(queue.retried).toEqual(['long'])
    expect(queue.removed).toEqual(['long'])
  })

  it('offers Separate again and support, never free, on a song that expired', () => {
    queue.rows = [
      {
        sessionId: 'lanterns',
        title: 'Lanterns on the Water',
        state: { kind: 'failed', reason: 'expired' },
      },
    ]
    open([])

    const expired = row('Lanterns on the Water')
    expect(expired.textContent).not.toMatch(/free/iu)
    expect(expired.textContent).toContain('Separating it again uses a song.')
    const support = within(expired).getByRole('link', { name: 'Ask support' })
    expect(support.getAttribute('href')).toContain('/contact/')
    fireEvent.click(
      within(expired).getByRole('button', { name: 'Separate again' }),
    )
    expect(queue.retried).toEqual(['lanterns'])
  })

  it('offers only Remove on a song whose copy is gone', () => {
    queue.rows = [
      {
        sessionId: 'gone',
        title: 'Harbour Lights',
        state: { kind: 'failed', reason: 'missing' },
      },
    ]
    open([])

    expect(
      within(row('Harbour Lights'))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Remove'])
  })

  it('lets a song waiting to be sent be removed, and one waiting for songs ask for them', () => {
    queue.rows = [
      {
        sessionId: 'salt',
        title: 'Salt and Honey',
        state: { kind: 'blocked', subscribed: false },
      },
      {
        sessionId: 'harbour',
        title: 'Harbour Lights',
        state: { kind: 'waiting-network' },
      },
    ]
    open([])

    fireEvent.click(
      within(row('Salt and Honey')).getByRole('button', { name: 'Subscribe' }),
    )
    fireEvent.click(
      within(row('Harbour Lights')).getByRole('button', { name: 'Remove' }),
    )

    expect(queue.gates).toBe(1)
    expect(queue.removed).toEqual(['harbour'])
  })

  it('has nothing to press on a song on its way', () => {
    queue.rows = [
      { sessionId: 'salt', title: 'Salt and Honey', state: { kind: 'queued' } },
    ]
    open([])

    expect(within(row('Salt and Honey')).queryAllByRole('button')).toEqual([])
  })

  it('marks a new song until it is first sung', () => {
    queue.fresh = ['paper']
    open([PAPER, GOODBYE])

    const paper = screen.getByRole('button', { name: /^Paper Moon Waltz/u })
    expect(paper.textContent).toContain('New')
    expect(
      screen.getByRole('button', { name: /^Goodbye to Spring/u }).textContent,
    ).not.toContain('New')
  })

  it('gives an imported song one menu item, and an example none', () => {
    open([PAPER, GOODBYE])

    expect(
      screen.queryByRole('button', { name: 'More for Goodbye to Spring' }),
    ).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'More for Paper Moon Waltz' }),
    )
    const menu = screen.getByRole('menu', { name: 'Paper Moon Waltz' })
    const items = within(menu).getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Remove from this phone',
    ])

    fireEvent.click(items[0] as HTMLElement)

    expect(queue.removedSongs).toEqual(['paper'])
  })
})

describe('the library, on an iPad', () => {
  it('removes a song from this iPad, and asks support about the iPad', () => {
    const restore = actAsIpad()
    try {
      queue.rows = [
        {
          sessionId: 'lanterns',
          title: 'Lanterns on the Water',
          state: { kind: 'failed', reason: 'expired' },
        },
      ]
      open([PAPER, GOODBYE])
      const support = within(row('Lanterns on the Water')).getByRole('link', {
        name: 'Ask support',
      })
      fireEvent.click(
        screen.getByRole('button', { name: 'More for Paper Moon Waltz' }),
      )
      const menu = screen.getByRole('menu', { name: 'Paper Moon Waltz' })

      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map((item) => item.textContent),
      ).toEqual(['Remove from this iPad'])
      expect(
        decodeURIComponent(support.getAttribute('href') ?? '').replace(
          /\+/gu,
          ' ',
        ),
      ).toContain('before it reached my iPad.')
    } finally {
      restore()
    }
  })
})
