// ============================================================
// First note's own songs: read once, kept, one at a time
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomSong } from '@/features/karaoke-room/karaoke-room-library'
import type { FirstNoteEntry } from './first-note-songs'
import type { OwnSongRead, OwnSongReadRun } from './own-song-read'

const library = vi.hoisted(() => ({
  songs: null as null | (() => RoomSong[]),
  setSongs: null as null | ((songs: RoomSong[]) => void),
  meta: {} as Record<
    string,
    Record<string, { size?: number; duration?: number }>
  >,
  /** Sessions removed from the phone: the session store no longer has them. */
  gone: new Set<string>(),
}))

vi.mock('@/features/karaoke-room/karaoke-room-library', () => ({
  roomLibrary: () => library.songs?.() ?? [],
  hydrateSong: vi.fn(async (song: RoomSong) => ({
    vocal: `blob:fresh-${song.sessionId}-vocal`,
    instrumental: `blob:fresh-${song.sessionId}-instrumental`,
  })),
}))

vi.mock('@/stores/uvr-store', () => ({
  getUvrSession: (sessionId: string) =>
    library.gone.has(sessionId)
      ? undefined
      : { sessionId, stemMeta: library.meta[sessionId] },
  isSessionStoreReady: () => true,
}))

const {
  FIRST_NOTE_OWN_ENTRIES_KEY,
  ownSongIds,
  ownSongs,
  playableSong,
  readLog,
  readOwnSongs,
  readOwnSongsAgain,
  readSummary,
  readyOwnSongs,
  resetOwnSongsForTests,
  setOwnSongReaderForTests,
  songsFrom,
  stopReadingOwnSongs,
  waitingOwnSongs,
} = await import('./first-note-own-songs')
const { FIRST_NOTE_SONGS } = await import('./first-note-songs')
const { ENTRY_RULES_VERSION } = await import('./entry-rules-version')

const own = (sessionId: string, title: string): RoomSong => ({
  sessionId,
  title,
  artist: null,
  durationSec: 200,
  credit: null,
  kind: 'yours',
  stems: { vocal: 'blob:dead-vocal', instrumental: 'blob:dead-band' },
})

const entry = (at: number, midi = 57): FirstNoteEntry => ({
  at,
  midi,
  from: Math.max(0, at - 8),
  until: at + 4,
  beats: [],
  words: `line at ${at}`,
})

/** A read the test settles by hand, one song at a time. */
interface PendingRead {
  sessionId: string
  run: OwnSongReadRun
  resolve: (read: OwnSongRead) => void
  reject: (error: Error) => void
}

let pending: PendingRead[] = []
let dispose: () => void = () => undefined

async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

const states = (): Record<string, string> =>
  Object.fromEntries(
    ownSongs().map((song) => [song.sessionId, song.state.kind]),
  )

beforeEach(() => {
  resetOwnSongsForTests()
  pending = []
  library.gone = new Set()
  library.meta = {
    a: { vocal: { size: 100, duration: 200 }, instrumental: { size: 90 } },
    b: { vocal: { size: 200, duration: 180 }, instrumental: { size: 80 } },
  }
  createRoot((done) => {
    dispose = done
    const [songs, setSongs] = createSignal<RoomSong[]>([
      own('a', 'Scarborough Fair'),
      own('b', 'Danny Boy'),
    ])
    library.songs = songs
    library.setSongs = setSongs
  })
  setOwnSongReaderForTests(
    (sessionId, run) =>
      new Promise((resolve, reject) => {
        pending.push({ sessionId, run, resolve, reject })
        run.signal?.addEventListener('abort', () => {
          const error = new Error('stopped')
          error.name = 'AbortError'
          reject(error)
        })
      }),
  )
})

afterEach(() => {
  stopReadingOwnSongs()
  setOwnSongReaderForTests(null)
  dispose()
})

describe("the singer's own songs", () => {
  it("are the Karaoke room's, each waiting to be read", () => {
    expect(ownSongs().map((song) => song.title)).toEqual([
      'Scarborough Fair',
      'Danny Boy',
    ])
    expect(states()).toEqual({ a: 'waiting', b: 'waiting' })
    expect(readyOwnSongs()).toEqual([])
  })

  it('are read one at a time, with progress, and kept', async () => {
    readOwnSongs()
    await settle()
    expect(pending.map((read) => read.sessionId)).toEqual(['a'])
    expect(states()).toEqual({ a: 'reading', b: 'waiting' })

    pending[0].run.onProgress?.(40)
    expect(ownSongs()[0].state).toEqual({ kind: 'reading', progress: 40 })

    pending[0].resolve({ entries: [entry(10), entry(20, 60)], dropped: [] })
    await settle()
    expect(states()).toEqual({ a: 'ready', b: 'reading' })
    expect(pending.map((read) => read.sessionId)).toEqual(['a', 'b'])

    // Kept on the phone, under the song and its stems.
    const kept = JSON.parse(
      localStorage.getItem(FIRST_NOTE_OWN_ENTRIES_KEY) ?? '{}',
    ) as Record<string, { stems: string; entries: unknown[] }>
    expect(kept.a.entries).toHaveLength(2)
    expect(kept.a.stems).toBe('100/200|90/-')

    const [song] = readyOwnSongs()
    expect(song).toMatchObject({
      slug: 'a',
      sessionId: 'a',
      kind: 'yours',
      title: 'Scarborough Fair',
      credit: '',
    })
    expect(song.entries.map((one) => one.at)).toEqual([10, 20])
  })

  it('leave out a song with too few clear entries, and say how many', async () => {
    readOwnSongs()
    await settle()
    pending[0].resolve({
      entries: [entry(10)],
      dropped: ['22.00 no steady note'],
    })
    await settle()

    expect(ownSongs()[0].state).toEqual({ kind: 'few', entries: 1 })
    expect(readyOwnSongs()).toEqual([])
  })

  it('say a read that failed, keep its cause for the log, and go on to the next song', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    readOwnSongs()
    await settle()
    const cause = new Error(
      'Failed to fetch dynamically imported module: own-song-read.js',
    )
    pending[0].reject(cause)
    await settle()

    // The singer is told the song could not be read; the cause is the log's.
    expect(ownSongs()[0].state).toEqual({ kind: 'failed', why: 'unreadable' })
    expect(warn).toHaveBeenCalledWith(expect.any(String), cause)
    expect(pending.map((read) => read.sessionId)).toEqual(['a', 'b'])
  })

  it('leave out a song too long to hold, or with no voice, and say why', async () => {
    readOwnSongs()
    await settle()
    pending[0].resolve({ entries: [], dropped: [], out: 'too-long' })
    await settle()
    pending[1].resolve({ entries: [], dropped: [], out: 'no-voice' })
    await settle()

    expect(ownSongs().map((song) => song.state)).toEqual([
      { kind: 'failed', why: 'too-long' },
      { kind: 'failed', why: 'no-voice' },
    ])
    // Neither is kept as read: each is looked at again at the next launch.
    expect(localStorage.getItem(FIRST_NOTE_OWN_ENTRIES_KEY)).toBeNull()
  })

  it("keep each song's object while it stays the same, so a read's progress moves one row", async () => {
    readOwnSongs()
    await settle()
    const [reading, waiting] = ownSongs()
    const ids = ownSongIds()

    pending[0].run.onProgress?.(40)
    const [nowReading, nowWaiting] = ownSongs()
    expect(nowReading).not.toBe(reading)
    expect(nowReading.state).toEqual({ kind: 'reading', progress: 40 })
    expect(nowWaiting).toBe(waiting)
    expect(ownSongIds()).toBe(ids)

    // The same percent again changes nothing at all.
    const list = ownSongs()
    pending[0].run.onProgress?.(40)
    expect(ownSongs()).toBe(list)
  })

  it('name the songs waiting to be read, changing only when one is taken up or turns up', async () => {
    expect(waitingOwnSongs()).toEqual(['a', 'b'])
    readOwnSongs()
    await settle()
    const waiting = waitingOwnSongs()
    expect(waiting).toEqual(['b'])

    pending[0].run.onProgress?.(55)
    expect(waitingOwnSongs()).toBe(waiting)

    library.meta.c = { vocal: { size: 5, duration: 60 } }
    library.setSongs?.([
      own('c', 'Wild Mountain Thyme'),
      own('a', 'Scarborough Fair'),
      own('b', 'Danny Boy'),
    ])
    expect(waitingOwnSongs()).toEqual(['c', 'b'])
  })

  it('keep the read of a song separating again, and let go of one gone from the phone', async () => {
    readOwnSongs()
    await settle()
    pending[0].resolve({ entries: [entry(10), entry(20)], dropped: [] })
    await settle()
    stopReadingOwnSongs()
    const kept = (): string[] =>
      Object.keys(
        JSON.parse(localStorage.getItem(FIRST_NOTE_OWN_ENTRIES_KEY) ?? '{}'),
      ).sort()

    // 'a' separates again: out of the library for now, still on the phone.
    library.setSongs?.([own('b', 'Danny Boy')])
    readOwnSongs()
    await settle()
    pending[pending.length - 1].resolve({
      entries: [entry(30), entry(40)],
      dropped: [],
    })
    await settle()
    expect(kept()).toEqual(['a', 'b'])

    // 'a' is removed from the phone: the next read kept lets its read go.
    stopReadingOwnSongs()
    library.gone.add('a')
    library.meta.c = { vocal: { size: 5, duration: 60 } }
    library.setSongs?.([own('c', 'Wild Mountain Thyme'), own('b', 'Danny Boy')])
    readOwnSongs()
    await settle()
    pending[pending.length - 1].resolve({
      entries: [entry(50), entry(60)],
      dropped: [],
    })
    await settle()
    expect(kept()).toEqual(['b', 'c'])
  })

  it('stop reading when the room lets go, and start that song again later', async () => {
    readOwnSongs()
    await settle()
    stopReadingOwnSongs()
    await settle()
    expect(states()).toEqual({ a: 'waiting', b: 'waiting' })

    readOwnSongs()
    await settle()
    expect(pending.map((read) => read.sessionId)).toEqual(['a', 'a'])
  })

  it('are read again when a stem changes', async () => {
    readOwnSongs()
    await settle()
    pending[0].resolve({ entries: [entry(10), entry(20)], dropped: [] })
    await settle()
    stopReadingOwnSongs()
    expect(states().a).toBe('ready')

    // The vocal replaced in the studio: a new size.
    library.meta.a = { ...library.meta.a, vocal: { size: 101, duration: 200 } }
    library.setSongs?.([own('a', 'Scarborough Fair'), own('b', 'Danny Boy')])
    expect(states().a).toBe('waiting')
  })

  it('are read again once the rules have moved on from their read', async () => {
    // Kept by the rules before the second (no version), for the stems of now.
    localStorage.setItem(
      FIRST_NOTE_OWN_ENTRIES_KEY,
      JSON.stringify({
        a: { stems: '100/200|90/-', entries: [entry(10), entry(20)] },
        b: {
          stems: '200/180|80/-',
          entries: [entry(10), entry(20)],
          rules: ENTRY_RULES_VERSION,
        },
      }),
    )
    expect(states()).toEqual({ a: 'waiting', b: 'ready' })
  })

  it("tell the console what each read found, for a test build's console", async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    readOwnSongs()
    await settle()
    pending[0].resolve({
      entries: [entry(10)],
      dropped: [
        '31.20 no steady note',
        '40.10 no steady note',
        '52.00 YIN A3, notes C4',
        '61.00 42 cents off A3',
      ],
      lines: 24,
      shift: -0.8,
      tuning: 35,
    })
    await settle()
    expect(info).toHaveBeenCalledWith(
      `[first-note] read "Scarborough Fair": 1 entries from 24 lines, lyrics moved -0.8 s, tuned +35 cents; left: 2 no steady note, 1 the room's notes name another, 1 out of tune`,
    )
    info.mockRestore()
  })

  it('tell the console where every line went, and how much of the song is voice', () => {
    const told = Array.from({ length: 14 }, (_, i) =>
      i % 2 === 0
        ? `${i * 10}.00 no breath before it (0.4 s)`
        : `${i * 10}.00 no steady note`,
    )
    const log = readLog('Shadow', {
      entries: [],
      dropped: told.filter((line) => line.includes('steady')),
      told,
      lines: 14,
      breathless: 7,
      voiced: { share: 0.712, seconds: 421.9 },
      shift: 0.26,
    })
    expect(log[0]).toBe(
      '[first-note] read "Shadow": 0 entries from 14 lines, lyrics moved 0.26 s; left: 7 no breath before them, 7 no steady note; voice on 71% of 422 s',
    )
    // Every line, a dozen to a console line.
    expect(log.slice(1)).toEqual([
      `[first-note]   "Shadow" lines 1-12 of 14: ${told.slice(0, 12).join(' | ')}`,
      `[first-note]   "Shadow" lines 13-14 of 14: ${told.slice(12).join(' | ')}`,
    ])
  })

  it('are read again, and told again, once the Developer screen lets their reads go', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    readOwnSongs()
    await settle()
    pending[0].resolve({ entries: [entry(10), entry(20)], dropped: [] })
    await settle()
    pending[1].resolve({ entries: [entry(10), entry(20)], dropped: [] })
    await settle()
    expect(states()).toEqual({ a: 'ready', b: 'ready' })
    expect(pending).toHaveLength(2)

    readOwnSongsAgain()
    await settle()
    // The room is asking, so the first is read again at once.
    expect(states()).toEqual({ a: 'reading', b: 'waiting' })
    expect(pending).toHaveLength(3)
    pending[2].resolve({ entries: [entry(30)], dropped: [] })
    await settle()
    expect(states().a).toBe('few')
    expect(info).toHaveBeenCalledWith(
      '[first-note] read "Scarborough Fair": 1 entries',
    )
    info.mockRestore()
  })

  it('keep a read in flight reading until it stops, then read it again', async () => {
    readOwnSongs()
    await settle()
    expect(states().a).toBe('reading')
    readOwnSongsAgain()
    // Not waiting while the stopped read unwinds.
    expect(states().a).toBe('reading')
    await settle()
    // Stopped, it is read again from the start.
    expect(pending).toHaveLength(2)
    expect(pending[1].sessionId).toBe('a')
    expect(states()).toEqual({ a: 'reading', b: 'waiting' })
  })

  it('tell the console lyrics no shift fits from a song with none', () => {
    const read = { entries: [], dropped: [], lines: 9, shift: null }
    expect(readSummary('Danny Boy', { ...read, lyricLines: 31 })).toBe(
      '[first-note] read "Danny Boy": 0 entries from 9 lines, its 31 synced lyric lines fit no shift (no words)',
    )
    expect(readSummary('Danny Boy', { ...read, lyricLines: 0 })).toBe(
      '[first-note] read "Danny Boy": 0 entries from 9 lines, no synced lyrics',
    )
  })

  it('read again a song left out, once it is split again', async () => {
    readOwnSongs()
    await settle()
    pending[0].resolve({ entries: [], dropped: [], out: 'no-voice' })
    await settle()
    stopReadingOwnSongs()
    expect(states().a).toBe('failed')

    // Split again: new stems, so what failed no longer stands.
    library.meta.a = { ...library.meta.a, vocal: { size: 101, duration: 200 } }
    library.setSongs?.([own('a', 'Scarborough Fair'), own('b', 'Danny Boy')])
    expect(states().a).toBe('waiting')
  })
})

describe('the songs a run plays', () => {
  it("come from the examples, the singer's own, or both", async () => {
    readOwnSongs()
    await settle()
    pending[0].resolve({ entries: [entry(10), entry(20)], dropped: [] })
    await settle()

    expect(songsFrom('examples')).toBe(FIRST_NOTE_SONGS)
    expect(songsFrom('yours').map((song) => song.slug)).toEqual(['a'])
    expect(songsFrom('mix').map((song) => song.slug)).toEqual([
      ...FIRST_NOTE_SONGS.map((song) => song.slug),
      'a',
    ])
  })

  it("play a song of the singer's own from stems minted now", async () => {
    readOwnSongs()
    await settle()
    pending[0].resolve({ entries: [entry(10), entry(20)], dropped: [] })
    await settle()

    const [song] = readyOwnSongs()
    expect(song.stems.vocal).toBe('blob:dead-vocal')
    const playable = await playableSong(song)
    expect(playable.stems).toEqual({
      vocal: 'blob:fresh-a-vocal',
      instrumental: 'blob:fresh-a-instrumental',
    })
    // An example plays from its files as it is.
    expect(await playableSong(FIRST_NOTE_SONGS[0])).toBe(FIRST_NOTE_SONGS[0])
  })
})
