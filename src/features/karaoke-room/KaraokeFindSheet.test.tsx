// ============================================================
// Find by singing in the Karaoke room
// ============================================================
//
// The sheet over a stand-in engine (the real one opens the mic), the
// Songs sheet's way in, and the room's host: songs fingerprinted from the
// notes they keep, a find cued where the singer has got to.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MercurySingCandidateView, MercurySingLibraryEntry, MercurySingStatus, } from '@/features/mercury-sing/mercury-sing-engine'
import type { MercurySingHost } from '@/features/mercury-sing/mercury-sing-host'
import type { RoomSong } from './karaoke-room-library'

const engine = vi.hoisted(() => ({
  made: [] as unknown[],
  picks: [] as string[],
  opened: [] as string[],
  disposed: 0,
  giveUp: null as (() => void) | null,
}))

const [status, setStatus] = createSignal<MercurySingStatus>('starting')
const [candidates, setCandidates] = createSignal<MercurySingCandidateView[]>([])
const [library, setLibrary] = createSignal<MercurySingLibraryEntry[]>([])

vi.mock('@/features/mercury-sing/mercury-sing-engine', () => ({
  createMercurySingEngine: (host: unknown, giveUp: () => void) => {
    engine.made.push(host)
    engine.giveUp = giveUp
    return {
      status,
      candidates,
      armed: () => ({ kind: 'listening', leaderId: null, armedFraction: 0 }),
      elapsedSec: () => 7,
      trail: () => [50, 52, Number.NaN, 55, 57],
      library,
      libraryCount: () => library().filter((s) => s.ready).length,
      fingerprinting: () => ({ done: 0, total: 0 }),
      frozen: () => false,
      pick: () => false,
      pickSession: (sessionId: string) => {
        engine.picks.push(sessionId)
        return true
      },
      openFromLibrary: (sessionId: string) => {
        engine.opened.push(sessionId)
        return true
      },
      dispose: () => {
        engine.disposed += 1
      },
    }
  },
}))

const notes = vi.hoisted(() => ({
  saved: new Map<string, { mergedNotes: unknown[] }>(),
}))
vi.mock('@/db/services/session-pitch-analysis-service', () => ({
  loadPitchAnalysisFromDb: (sessionId: string) =>
    Promise.resolve(notes.saved.get(sessionId) ?? null),
}))

const { KaraokeFindSheet } = await import('./KaraokeFindSheet')
const { KaraokeLibrarySheet } = await import('./KaraokeLibrarySheet')
const { FIND_STATUS, roomFindHost } = await import('./karaoke-room-find')

const HOST: MercurySingHost = {
  songs: () => Promise.resolve([]),
  fingerprint: () => Promise.resolve(null),
  launch: () => undefined,
}

const match = (
  sessionId: string,
  name: string,
  confidence: number,
): MercurySingCandidateView => ({
  sessionId,
  name,
  confidence,
  matchOffsetSec: 40,
  breakdown: { pitch: 0, interval: 0, chroma: 0, rhythm: 0 },
})

const song = (sessionId: string, title: string): RoomSong => ({
  sessionId,
  title,
  artist: null,
  durationSec: 200,
  credit: null,
  kind: 'yours',
  stems: { vocal: 'blob:v', instrumental: 'blob:i' },
})

beforeEach(() => {
  engine.made = []
  engine.picks = []
  engine.opened = []
  engine.disposed = 0
  setStatus('starting')
  setCandidates([])
  setLibrary([])
})

afterEach(() => {
  cleanup()
})

async function openSheet(isOpen = true) {
  const close = vi.fn()
  const [open, setOpen] = createSignal(isOpen)
  render(() => <KaraokeFindSheet isOpen={open()} close={close} host={HOST} />)
  // The listening is loaded when the sheet first opens.
  if (isOpen) await screen.findByTestId('karaoke-find-status')
  return { close, setOpen }
}

describe('the find sheet', () => {
  it('opens the mic only while it is open, and lets it go as it closes', async () => {
    const { setOpen } = await openSheet(false)
    expect(engine.made).toHaveLength(0)

    setOpen(true)
    await waitFor(() => expect(engine.made).toEqual([HOST]))

    setOpen(false)
    expect(engine.disposed).toBe(1)
  })

  it('says what it is doing, in words', async () => {
    await openSheet()
    const said = () => screen.getByTestId('karaoke-find-status').textContent

    expect(said()).toBe(FIND_STATUS.starting)
    setStatus('mic-denied')
    expect(said()).toBe('Merc needs the microphone to hear you.')
    setStatus('listening')
    expect(said()).toBe(FIND_STATUS.listening)
    expect(screen.getByTestId('karaoke-find-clock').textContent).toBe('0:07')
  })

  it('lists the songs it listens for until one matches, the findable ones first, a tap playing it from the top', async () => {
    await openSheet()
    setStatus('listening')
    setLibrary([
      { sessionId: 'b', name: 'Bravo', ready: false },
      { sessionId: 'a', name: 'Alpha', ready: true },
    ])

    const rows = screen.getAllByTestId('karaoke-find-song')
    expect(rows.map((r) => r.textContent)).toEqual([
      'Alpha',
      'BravoTurn its notes on once to find it by singing',
    ])
    fireEvent.click(rows[1])
    expect(engine.opened).toEqual(['b'])
  })

  it('lists the closest songs once they come, a tap opening the song the row shows', async () => {
    await openSheet()
    setStatus('listening')
    setLibrary([{ sessionId: 'a', name: 'Alpha', ready: true }])
    setCandidates([match('a', 'Alpha', 81), match('b', 'Bravo', 40)])

    expect(screen.queryAllByTestId('karaoke-find-song')).toHaveLength(0)
    fireEvent.click(screen.getAllByTestId('karaoke-find-match')[1])
    expect(engine.picks).toEqual(['b'])
  })

  it('keeps its rows while the ranking moves, so a press is not lost to a rebuilt row', async () => {
    await openSheet()
    setStatus('listening')
    setCandidates([match('a', 'Alpha', 50), match('b', 'Bravo', 40)])
    const [first, second] = screen.getAllByTestId('karaoke-find-match')

    // A tick later, new objects, and the order swapped.
    setCandidates([match('b', 'Bravo', 52), match('a', 'Alpha', 49)])

    const now = screen.getAllByTestId('karaoke-find-match')
    expect(now[0]).toBe(first)
    expect(now[1]).toBe(second)
    expect(now[0].textContent).toContain('Bravo')
    fireEvent.click(now[0])
    expect(engine.picks).toEqual(['b'])
  })

  it('opens the song a row showed when it was pressed, though the ranking moved before the click', async () => {
    await openSheet()
    setStatus('listening')
    setCandidates([match('a', 'Alpha', 50), match('b', 'Bravo', 40)])
    const [first] = screen.getAllByTestId('karaoke-find-match')

    fireEvent.pointerDown(first)
    // A tick lands mid-press: Bravo moves into the row under the finger.
    setCandidates([match('b', 'Bravo', 52), match('a', 'Alpha', 49)])
    expect(first.textContent).toContain('Bravo')
    // A pointer's click counts one click (`detail`), a keyboard's none.
    fireEvent.click(first, { detail: 1 })

    expect(engine.picks).toEqual(['a'])
  })

  it('opens the song a row shows when the keyboard presses it', async () => {
    await openSheet()
    setStatus('listening')
    setCandidates([match('a', 'Alpha', 50), match('b', 'Bravo', 40)])
    const [first] = screen.getAllByTestId('karaoke-find-match')
    // A press that came to nothing (the finger dragged off the row) leaves
    // nothing behind for the keyboard.
    fireEvent.pointerDown(first)
    setCandidates([match('b', 'Bravo', 52), match('a', 'Alpha', 49)])

    fireEvent.click(first)

    expect(engine.picks).toEqual(['b'])
  })

  it('keeps what it found when the singing stops, and listens again on a tap', async () => {
    const { close } = await openSheet()
    setStatus('listening')
    setCandidates([match('a', 'Alpha', 50)])

    // The engine lets the mic go after a silence: the sheet stays.
    engine.giveUp?.()
    setStatus('quiet')
    expect(close).not.toHaveBeenCalled()
    expect(screen.getByTestId('karaoke-find-status').textContent).toBe(
      FIND_STATUS.quiet,
    )
    expect(screen.getAllByTestId('karaoke-find-match')).toHaveLength(1)

    fireEvent.click(screen.getByTestId('karaoke-find-again'))
    await waitFor(() => expect(engine.made).toHaveLength(2))
    expect(engine.disposed).toBe(1)
  })

  it('closes on its Close', async () => {
    const { close } = await openSheet()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(close).toHaveBeenCalledTimes(1)
  })
})

describe('the Songs sheet', () => {
  it('starts with Find by singing where the room offers it', () => {
    const onFind = vi.fn()
    render(() => (
      <KaraokeLibrarySheet
        isOpen
        close={() => undefined}
        songs={() => [song('a', 'Alpha')]}
        currentId={() => null}
        onPick={() => undefined}
        onFind={onFind}
      />
    ))

    fireEvent.click(screen.getByTestId('karaoke-find-open'))
    expect(onFind).toHaveBeenCalledTimes(1)
  })

  it('has no such row without it', () => {
    render(() => (
      <KaraokeLibrarySheet
        isOpen
        close={() => undefined}
        songs={() => [song('a', 'Alpha')]}
        currentId={() => null}
        onPick={() => undefined}
      />
    ))

    expect(screen.queryByTestId('karaoke-find-open')).toBeNull()
  })
})

describe("the room's host", () => {
  const cue = vi.fn()
  const host = roomFindHost({
    songs: () => [song('a', 'Alpha'), song('b', 'Bravo')],
    cue,
  })

  it('listens for the room’s songs by their titles', async () => {
    expect(await host.songs()).toEqual([
      { sessionId: 'a', name: 'Alpha' },
      { sessionId: 'b', name: 'Bravo' },
    ])
    // The sheet says it in its own words; no toast over it.
    expect(host.heardNothing).toBeUndefined()
  })

  it('fingerprints a song from the notes it keeps, and none without notes', async () => {
    notes.saved.set('a', {
      mergedNotes: [
        { midi: 60, noteName: 'C4', startSec: 10, endSec: 10.5 },
        { midi: 62, noteName: 'D4', startSec: 10.5, endSec: 11 },
        { midi: 64, noteName: 'E4', startSec: 11, endSec: 12 },
      ],
    })

    const fp = await host.fingerprint(
      { sessionId: 'a', name: 'Alpha' },
      () => false,
    )
    expect(fp?.melodyId).toBe('stem:a')
    expect(fp?.pitchSequence).toEqual([60, 62, 64])
    expect(fp?.firstNoteStartSec).toBe(10)
    expect(
      await host.fingerprint({ sessionId: 'b', name: 'Bravo' }, () => false),
    ).toBeNull()
  })

  it('cues a find on the stage where the singer has got to', () => {
    host.launch({ sessionId: 'b', name: 'Bravo' }, 63.5)
    expect(cue).toHaveBeenCalledWith('b', 63.5)
  })
})
