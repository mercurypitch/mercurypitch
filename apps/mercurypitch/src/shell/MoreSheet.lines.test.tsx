// ============================================================
// The More sheet reads its lines from the stores, as it opens
// ============================================================
//
// The library, the import queue and the account are stood in for, so each
// test says what the stores hold and reads what the row says. The wording
// itself is more-lines.test.ts's; this is about the wiring, and the one dot.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const held = vi.hoisted(() => ({
  library: [] as { sessionId: string; kind: 'example' | 'yours' }[],
  newSongs: [] as string[],
  inFlight: 0,
  signedIn: false,
  name: '',
}))

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  KARAOKE_IMPORT: true,
}))

vi.mock('@/features/karaoke-room/karaoke-room-library', () => ({
  roomLibrary: () => held.library,
}))

vi.mock('@/features/karaoke-room/karaoke-import-queue', () => ({
  karaokeNewSongs: () => held.newSongs,
  importsInFlight: () => held.inFlight,
}))

vi.mock('./settings/account-state', () => ({
  accountSignedIn: () => held.signedIn,
  accountCard: () =>
    held.signedIn
      ? {
          id: 'u1',
          name: held.name,
          email: 'maya@example.test',
          provider: 'apple',
          newsletter: false,
        }
      : null,
  accountProviderLine: () => 'Signed in with Apple',
}))

import { setGameState, setSelectedSongName } from '@/stores/falling-notes-store'
import { MoreSheet } from './MoreSheet'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'

let view: RenderedShell | null = null

function openSheet(): void {
  view = renderShell(() => (
    <MoreSheet
      open={() => true}
      onClose={vi.fn()}
      onPushSettings={vi.fn()}
      onPushAccount={vi.fn()}
      onPushDeveloper={vi.fn()}
      onPushLeagues={vi.fn()}
    />
  ))
}

function line(id: string): string | null | undefined {
  return document.querySelector(`[data-more-item="${id}"] .mp-more-row__state`)
    ?.textContent
}

function dotted(id: string): boolean {
  return (
    document.querySelector(`[data-more-item="${id}"] [data-more-new]`) !== null
  )
}

const EXAMPLES = [
  { sessionId: 'demo-1', kind: 'example' as const },
  { sessionId: 'demo-2', kind: 'example' as const },
  { sessionId: 'demo-3', kind: 'example' as const },
]

beforeEach(() => {
  held.library = [...EXAMPLES]
  held.newSongs = []
  held.inFlight = 0
  held.signedIn = false
  held.name = ''
})

afterEach(() => {
  view?.unmount()
  view = null
  setGameState('idle')
  setSelectedSongName('')
})

describe('the Karaoke row', () => {
  it('counts the library: the three examples on a fresh install', () => {
    openSheet()

    expect(line('karaoke')).toBe('3 songs ready')
    expect(dotted('karaoke')).toBe(false)
  })

  it('puts a quiet dot on a song of the singer own, ready and not sung', () => {
    held.library = [{ sessionId: 'mine', kind: 'yours' }, ...EXAMPLES]
    held.newSongs = ['mine']
    openSheet()

    expect(line('karaoke')).toBe('1 new song to sing')
    expect(dotted('karaoke')).toBe(true)
    // A dot, never a number: what a screen reader hears is "New".
    expect(
      document.querySelector('[data-more-item="karaoke"] [data-more-new]')
        ?.textContent,
    ).toBe('New')
  })

  it('takes no dot from an id the library no longer has', () => {
    held.newSongs = ['deleted-elsewhere']
    openSheet()

    expect(dotted('karaoke')).toBe(false)
    expect(line('karaoke')).toBe('3 songs ready')
  })

  it('says a song is on its way while one is separating', () => {
    held.inFlight = 2
    openSheet()

    expect(line('karaoke')).toBe('2 songs on their way')
  })
})

describe('the Piano row', () => {
  it('names the song left paused', () => {
    setSelectedSongName('Clair de Lune')
    setGameState('paused')
    openSheet()

    expect(line('piano')).toBe('Paused: Clair de Lune')
  })
})

describe('the Account row', () => {
  it('names the account the phone holds, from the kept card', () => {
    held.signedIn = true
    held.name = 'Maya'
    openSheet()

    expect(line('account')).toBe('Signed in as Maya')
  })

  it('says how it is signed in when the card has no name yet', () => {
    held.signedIn = true
    openSheet()

    expect(line('account')).toBe('Signed in with Apple')
  })
})

describe('no row is new by default', () => {
  it('draws no dot anywhere on a fresh install', () => {
    openSheet()

    expect(document.querySelector('[data-more-new]')).toBeNull()
  })
})
