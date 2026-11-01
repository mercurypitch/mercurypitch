// ============================================================
// The room's songs, read for their notes at rest: which, when, what is kept
// ============================================================
//
// The queue runs the real read (stem-mixer/vocal-notes-read.ts) over a
// store held in memory, through the real service the mixer reads its notes
// back from. The phone's edges are stood in for: each vocal's stream, the
// stems kept on the phone, an example's packaged vocal, the session store.
// The pitch read is held open by the test (`analyses`), so the test says
// when each read ends; First note's reader is the real one, over a read of
// its own that the test settles.

import { createRoot, createSignal } from 'solid-js'
import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MergedNote } from '@/lib/midi-generator'
import type { analyzeVocalSamples, VocalAnalysis } from '@/lib/pitch-pipeline'
import { InMemoryAdapter } from '@/tests/utils/in-memory-db'
import type { RoomSong } from './karaoke-room-library'

const store = vi.hoisted(() => ({ adapter: null as unknown }))
vi.mock('@/db', () => ({ getDb: async () => store.adapter }))

/** The phone: whether it streams, and what it was asked for. */
const phone = vi.hoisted(() => ({
  streams: true,
  /** The vocals opened as streams, by song; an example's by its size. */
  opened: [] as string[],
  /** Each vocal's length, s; two seconds unless said. */
  seconds: {} as Record<string, number>,
  /** The packaged vocals asked for, and the signal each was asked under. */
  fetched: [] as { url: string; signal: AbortSignal | undefined }[],
  /** A download that waits until it is stopped. */
  slowFetch: false,
  /** The songs with a vocal stem kept on the phone. */
  vocals: new Set<string>(),
  /** The songs whose stem the store will not answer for. */
  storeFails: new Set<string>(),
}))

vi.mock('@/features/stem-mixer/stem-stream-source', () => ({
  canStreamStems: () => phone.streams,
  openStemStream: async (blob: Blob & { song?: string }) => {
    // A turn of the event loop, as a phone's demuxer takes: a queue that
    // read the same song again and again would hold the test's clock.
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    if (!phone.streams) return null
    const song = blob.song ?? `${blob.size} bytes`
    phone.opened.push(song)
    const seconds = phone.seconds[song] ?? 2
    const rate = 8000
    const data = new Float32Array(rate)
    const buffer = {
      sampleRate: rate,
      length: rate,
      numberOfChannels: 1,
      duration: 1,
      getChannelData: () => data,
    }
    return {
      sampleRate: rate,
      durationSeconds: seconds,
      channelCount: 1,
      chunks: () =>
        (async function* () {
          for (let i = 0; i < Math.ceil(seconds); i++) {
            await Promise.resolve()
            yield { buffer, timestamp: i }
          }
        })(),
      dispose: () => undefined,
    }
  },
}))

vi.mock('@/db/services/uvr-service', () => ({
  getStemBlobStrict: async (sessionId: string, type: string) => {
    // A turn of the event loop, as the phone's store takes: a song read
    // again and again would show, not hold the test's clock.
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    if (phone.storeFails.has(sessionId)) {
      throw new Error('the store would not answer')
    }
    return type === 'vocal' && phone.vocals.has(sessionId)
      ? Object.assign(new Blob([new Uint8Array(2_500_000)]), {
          song: sessionId,
        })
      : null
  },
}))

vi.mock('@irchiinnuss/mobile-runtime/asset-fetch', () => ({
  fetchAssetBytes: async (url: string, init?: RequestInit) => {
    const signal = init?.signal ?? undefined
    phone.fetched.push({ url, signal })
    if (!phone.slowFetch) return new ArrayBuffer(777)
    return new Promise<ArrayBuffer>((_resolve, reject) => {
      signal?.addEventListener('abort', () => {
        reject(new DOMException('The download was stopped.', 'AbortError'))
      })
    })
  },
}))

/** The session store: each song's vocal as its row keeps it, and the gone. */
const sessions = vi.hoisted(() => ({
  gone: new Set<string>(),
  vocal: {} as Record<string, { size: number; duration: number }>,
}))
vi.mock('@/stores/uvr-store', () => ({
  getUvrSession: (sessionId: string) =>
    sessions.gone.has(sessionId)
      ? undefined
      : { sessionId, stemMeta: { vocal: sessions.vocal[sessionId] } },
  isSessionStoreReady: () => true,
}))

const library = vi.hoisted(() => ({
  songs: null as null | (() => RoomSong[]),
  set: null as null | ((songs: RoomSong[]) => void),
}))
vi.mock('./karaoke-room-library', () => ({
  roomLibrary: () => library.songs?.() ?? [],
  hydrateSong: async (song: RoomSong) => Promise.resolve(song.stems),
}))

const { loadPitchAnalysisFromDbStrict, savePitchAnalysisToDbStrict } =
  await import('@/db/services/session-pitch-analysis-service')
const { setVocalNotesSeams } =
  await import('@/features/stem-mixer/vocal-notes-read')
const { resetSongReadLockForTests } = await import('@/lib/song-read-lock')
const { setKaraokeAutoIndexShazam } =
  await import('@/stores/karaoke-settings-store')
const {
  ownSongs,
  readOwnSongs,
  resetOwnSongsForTests,
  setOwnSongReaderForTests,
  stopReadingOwnSongs,
} = await import('@/features/first-note/first-note-own-songs')
const {
  karaokeNotesHold,
  karaokeNotesState,
  karaokeNotesWaiting,
  readKaraokeNotes,
  resetKaraokeNotesForTests,
  stopReadingKaraokeNotes,
} = await import('./karaoke-notes-reader')
const {
  KARAOKE_NOTES_OUTCOMES_KEY,
  KARAOKE_NOTES_WANTED_KEY,
  markFindOpened,
  notesWanted,
  reloadNotesWantedForTests,
  wantNotesRead,
} = await import('./karaoke-notes-wanted')
const { resetKaraokeRoomForTests, setKaraokeStagedSong } =
  await import('./karaoke-room-store')

const NOTES: MergedNote[] = [
  { midi: 57, noteName: 'A3', startSec: 0.2, endSec: 0.6 },
  { midi: 60, noteName: 'C4', startSec: 0.8, endSec: 1.2 },
  { midi: 62, noteName: 'D4', startSec: 1.4, endSec: 1.9 },
]

const own = (sessionId: string, title: string): RoomSong => ({
  sessionId,
  title,
  artist: null,
  durationSec: 200,
  credit: null,
  kind: 'yours',
  stems: { vocal: '', instrumental: '' },
})

const example = (sessionId: string, title: string): RoomSong => ({
  sessionId,
  title,
  artist: 'Josh Woodward',
  durationSec: 246,
  credit: 'Josh Woodward · CC BY 4.0',
  kind: 'example',
  stems: {
    vocal: `/karaoke/examples/${sessionId}/vocal.m4a`,
    instrumental: `/karaoke/examples/${sessionId}/instrumental.m4a`,
  },
})

/** A pitch read the test ends: with its notes, or stopped by the read. */
interface Analysis {
  readonly finish: (notes: MergedNote[]) => void
  readonly signal: AbortSignal | undefined
}

let analyses: Analysis[] = []
/** The read's clock, ms: each pitch read takes twelve seconds of it. */
let clock = 0

const analyze = ((_samples, _rate, _options, run) =>
  new Promise<VocalAnalysis>((resolve, reject) => {
    clock += 12_000
    analyses.push({
      finish: (notes) => {
        resolve({
          algo: 'yin',
          rawDetections: [],
          contour: [],
          mergedNotes: notes,
          segmentedNotes: notes,
        })
      },
      signal: run?.signal,
    })
    run?.signal?.addEventListener('abort', () => {
      const error = new Error('stopped')
      error.name = 'AbortError'
      reject(error)
    })
  })) as typeof analyzeVocalSamples

const state = (sessionId: string): string => karaokeNotesState(sessionId).kind
const record = (sessionId: string) => loadPitchAnalysisFromDbStrict(sessionId)
/** Long enough for any read the test did not hold open to have ended. */
const aWhile = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 30)
  })
/** The fixed outcomes kept on the phone. */
const keptOnPhone = (): Record<string, unknown> =>
  JSON.parse(localStorage.getItem(KARAOKE_NOTES_OUTCOMES_KEY) ?? '{}')
/** A launch: what the phone keeps is read again, and nothing else is known. */
const relaunch = (): void => {
  reloadNotesWantedForTests()
  resetKaraokeNotesForTests()
}

let info: MockInstance<typeof console.info>
let disposeLibrary: () => void = () => undefined
const told = (): string[] =>
  info.mock.calls
    .map((call) => String(call[0]))
    .filter((line) => line.startsWith('[notes-read]'))

beforeEach(() => {
  store.adapter = new InMemoryAdapter()
  phone.streams = true
  phone.opened = []
  phone.seconds = {}
  phone.fetched = []
  phone.slowFetch = false
  phone.vocals = new Set(['a', 'b'])
  phone.storeFails = new Set()
  sessions.gone = new Set()
  sessions.vocal = {
    a: { size: 2_500_000, duration: 200 },
    b: { size: 2_400_000, duration: 180 },
  }
  analyses = []
  clock = 0
  localStorage.clear()
  relaunch()
  resetSongReadLockForTests()
  resetOwnSongsForTests()
  resetKaraokeRoomForTests()
  setKaraokeAutoIndexShazam(true)
  setVocalNotesSeams({ analyze, now: () => clock })
  createRoot((dispose) => {
    disposeLibrary = dispose
    const [songs, setSongs] = createSignal<RoomSong[]>([
      own('a', 'Alpha'),
      own('b', 'Bravo'),
    ])
    library.songs = songs
    library.set = setSongs
  })
  info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
})

afterEach(() => {
  stopReadingKaraokeNotes('closed')
  stopReadingOwnSongs()
  setOwnSongReaderForTests(null)
  setVocalNotesSeams(null)
  disposeLibrary()
  info.mockRestore()
})

describe('the songs just separated', () => {
  it('are read one at a time, and each one kept where the mixer looks', async () => {
    wantNotesRead('a')
    wantNotesRead('b')
    readKaraokeNotes()
    // The room asks again as the waiting songs change: one read goes on.
    readKaraokeNotes()
    await vi.waitFor(() => expect(analyses).toHaveLength(1))
    expect(phone.opened).toEqual(['a'])
    expect([state('a'), state('b')]).toEqual(['reading', 'waiting'])

    analyses[0].finish(NOTES)
    await vi.waitFor(() => expect(analyses).toHaveLength(2))
    expect((await record('a'))?.segmentedNotes).toEqual(NOTES)
    expect([state('a'), state('b')]).toEqual(['read', 'reading'])

    analyses[1].finish(NOTES)
    await vi.waitFor(() => expect(state('b')).toBe('read'))
    expect(phone.opened).toEqual(['a', 'b'])
    expect(notesWanted()).toEqual([])
    expect(told()).toEqual([
      '[notes-read] reading "Alpha"',
      '[notes-read] read "Alpha": 3 notes in 12.0 s',
      '[notes-read] reading "Bravo"',
      '[notes-read] read "Bravo": 3 notes in 12.0 s',
    ])
  })

  it('are kept on the phone through a launch, until they are read', () => {
    wantNotesRead('b')
    expect(
      JSON.parse(localStorage.getItem(KARAOKE_NOTES_WANTED_KEY) ?? '[]'),
    ).toEqual(['b'])

    relaunch()

    expect(notesWanted()).toEqual(['b'])
    expect(karaokeNotesWaiting()).toEqual(['b'])
    expect(state('a')).toBe('idle')
  })

  it('stop being read when they leave the room, and leave no record', async () => {
    wantNotesRead('a')
    wantNotesRead('b')
    readKaraokeNotes()
    await vi.waitFor(() => expect(analyses).toHaveLength(1))

    // Removed in the studio meanwhile: its walk and its pitch read stop.
    sessions.gone.add('a')
    library.set?.([own('b', 'Bravo')])

    expect(analyses[0].signal?.aborted).toBe(true)
    expect(told()).toContain(
      `[notes-read] stopped reading "Alpha": it left the room's songs. It is read again from the start at the next rest`,
    )
    await vi.waitFor(() => expect(analyses).toHaveLength(2))
    expect(await record('a')).toBeNull()
    // What was kept for it goes at the next rest.
    readKaraokeNotes()
    expect(notesWanted()).toEqual(['b'])
  })
})

describe('every song, once Find by singing has been opened', () => {
  it('reads a song listed with no session on the phone once, not again and again', async () => {
    // An example whose row did not land in the session store.
    library.set?.([example('spring', 'Goodbye to Spring')])
    sessions.gone.add('spring')
    markFindOpened()

    readKaraokeNotes()
    await vi.waitFor(() => expect(analyses).toHaveLength(1))
    analyses[0].finish(NOTES)
    await vi.waitFor(() => expect(state('spring')).toBe('idle'))
    await aWhile()

    expect(phone.opened).toEqual(['777 bytes'])
    expect(await record('spring')).toBeNull()
  })

  it('reads an example without notes from its packaged vocal, and passes over one with notes', async () => {
    library.set?.([
      own('a', 'Alpha'),
      example('spring', 'Goodbye to Spring'),
      example('josephine', 'Josephine'),
    ])
    // Its notes came with the app (bundled-notes.ts).
    await savePitchAnalysisToDbStrict('josephine', {
      mergedNotes: NOTES,
      segmentedNotes: NOTES,
      pitchHistory: [],
    })
    readKaraokeNotes()
    await aWhile()
    // Nothing is read but the songs just separated, and there are none.
    expect(phone.opened).toEqual([])
    expect(state('spring')).toBe('idle')

    markFindOpened()
    readKaraokeNotes()
    await vi.waitFor(() => expect(analyses).toHaveLength(1))
    analyses[0].finish(NOTES)
    await vi.waitFor(() => expect(analyses).toHaveLength(2))
    expect(phone.fetched.map((one) => one.url)).toEqual([
      '/karaoke/examples/spring/vocal.m4a',
    ])
    analyses[1].finish(NOTES)

    await vi.waitFor(() =>
      expect(told()).toContain(
        '[notes-read] skipped "Josephine": it has its notes',
      ),
    )
    expect((await record('spring'))?.segmentedNotes).toEqual(NOTES)
    expect(phone.opened).toEqual(['a', '777 bytes'])
    expect(analyses).toHaveLength(2)
    expect(state('josephine')).toBe('noted')
  })

  it("stops an example's download when its read is stopped, and goes on", async () => {
    library.set?.([example('spring', 'Goodbye to Spring'), own('a', 'Alpha')])
    phone.slowFetch = true
    markFindOpened()
    readKaraokeNotes()
    await vi.waitFor(() => expect(phone.fetched).toHaveLength(1))

    stopReadingKaraokeNotes('playing')
    readKaraokeNotes()

    expect(phone.fetched[0].signal?.aborted).toBe(true)
    // Its download let go of, the read in flight is over: the next starts.
    await vi.waitFor(() => expect(phone.fetched).toHaveLength(2))
  })
})

describe('reading at rest', () => {
  it('stops when the room holds back, keeps nothing, and reads that song again from the start', async () => {
    wantNotesRead('a')
    readKaraokeNotes()
    await vi.waitFor(() => expect(analyses).toHaveLength(1))

    stopReadingKaraokeNotes('playing')

    expect(karaokeNotesHold()).toBe('playing')
    await vi.waitFor(() => expect(state('a')).toBe('waiting'))
    expect(analyses[0].signal?.aborted).toBe(true)
    expect(await record('a')).toBeNull()
    expect(told()).toContain(
      '[notes-read] stopped reading "Alpha": a song is playing. It is read again from the start at the next rest',
    )

    readKaraokeNotes()
    expect(karaokeNotesHold()).toBeNull()
    await vi.waitFor(() => expect(analyses).toHaveLength(2))
    expect(phone.opened).toEqual(['a', 'a'])
  })

  it('keeps on the phone a vocal too long for it, and reads it again only once replaced', async () => {
    // Longer than the walk may hold, even at every fourth sample.
    phone.seconds.a = 4 * 60 * 60
    wantNotesRead('a')
    readKaraokeNotes()
    await vi.waitFor(() => expect(state('a')).toBe('failed'))
    expect(karaokeNotesState('a')).toEqual({ kind: 'failed', why: 'too-long' })
    expect(told()).toContain(
      '[notes-read] could not read "Alpha": its vocal (2.5 MB) is too long for this phone to hold',
    )

    relaunch()
    readKaraokeNotes()
    await aWhile()
    expect(phone.opened).toEqual(['a'])
    expect(karaokeNotesState('a')).toEqual({ kind: 'failed', why: 'too-long' })

    // Split again in the studio: a new vocal, read again.
    sessions.vocal.a = { size: 1_900_000, duration: 150 }
    phone.seconds.a = 2
    library.set?.([own('a', 'Alpha'), own('b', 'Bravo')])
    readKaraokeNotes()
    await vi.waitFor(() => expect(phone.opened).toEqual(['a', 'a']))
  })

  it('keeps a song with no singing in it as one, through a launch', async () => {
    wantNotesRead('a')
    readKaraokeNotes()
    await vi.waitFor(() => expect(analyses).toHaveLength(1))
    analyses[0].finish([])
    await vi.waitFor(() => expect(state('a')).toBe('failed'))

    relaunch()
    readKaraokeNotes()
    await aWhile()

    expect(karaokeNotesState('a')).toEqual({ kind: 'failed', why: 'no-notes' })
    expect(analyses).toHaveLength(1)
    expect(await record('a')).toBeNull()
    expect(keptOnPhone()).toEqual({
      a: { vocal: '2500000/200', outcome: 'no-notes' },
    })
  })

  it('tries a read that threw again at the next launch, not before', async () => {
    phone.storeFails.add('a')
    wantNotesRead('a')
    readKaraokeNotes()
    await vi.waitFor(() => expect(state('a')).toBe('failed'))
    expect(karaokeNotesState('a')).toEqual({
      kind: 'failed',
      why: 'unreadable',
    })
    expect(told()).toContain(
      '[notes-read] could not read "Alpha": the store would not answer',
    )
    expect(keptOnPhone()).toEqual({})

    readKaraokeNotes()
    await aWhile()
    expect(state('a')).toBe('failed')
    phone.storeFails.clear()

    relaunch()
    readKaraokeNotes()
    await vi.waitFor(() => expect(analyses).toHaveLength(1))
    expect(phone.opened).toEqual(['a'])
  })

  it('lets go of what it keeps for a song once it has left the phone', async () => {
    phone.vocals.delete('a')
    wantNotesRead('a')
    readKaraokeNotes()
    await vi.waitFor(() => expect(state('a')).toBe('failed'))
    expect(Object.keys(keptOnPhone())).toEqual(['a'])

    sessions.gone.add('a')
    library.set?.([own('b', 'Bravo')])
    readKaraokeNotes()

    expect(keptOnPhone()).toEqual({})
    expect(notesWanted()).toEqual([])
  })

  it('leaves the song on the stage to its mixer, and lets go of a song put on it mid-read', async () => {
    setKaraokeStagedSong('a')
    wantNotesRead('a')
    wantNotesRead('b')
    readKaraokeNotes()
    await vi.waitFor(() => expect(analyses).toHaveLength(1))
    expect(phone.opened).toEqual(['b'])
    expect(state('a')).toBe('idle')

    // Bravo goes on the stage while it is read, and Alpha comes off it.
    setKaraokeStagedSong('b')

    await vi.waitFor(() => expect(analyses).toHaveLength(2))
    expect(analyses[0].signal?.aborted).toBe(true)
    expect(phone.opened).toEqual(['b', 'a'])
    expect(await record('b')).toBeNull()
    expect(told()).toContain(
      '[notes-read] stopped reading "Bravo": it went on the stage, where its mixer reads it. It is read again from the start at the next rest',
    )
  })

  it('reads nothing for a singer who turned Index new songs off', async () => {
    setKaraokeAutoIndexShazam(false)
    wantNotesRead('a')
    markFindOpened()

    readKaraokeNotes()
    await aWhile()

    expect(phone.opened).toEqual([])
    expect(karaokeNotesWaiting()).toEqual([])
    expect(state('a')).toBe('idle')
    // Turned on again, both are to be read, the one just separated first.
    setKaraokeAutoIndexShazam(true)
    expect(karaokeNotesWaiting()).toEqual(['a', 'b'])
  })

  it('reads nothing on a phone that cannot stream', async () => {
    phone.streams = false
    wantNotesRead('a')

    readKaraokeNotes()
    await aWhile()

    expect(phone.opened).toEqual([])
    expect(state('a')).toBe('idle')
  })
})

describe("First note's read", () => {
  it('keeps the room from reading beside it, until it is done', async () => {
    library.set?.([own('a', 'Alpha')])
    let done: () => void = () => undefined
    setOwnSongReaderForTests(
      () =>
        new Promise((resolve) => {
          done = () => {
            resolve({ entries: [], dropped: [] })
          }
        }),
    )
    readOwnSongs()
    await aWhile()
    expect(ownSongs()[0].state.kind).toBe('reading')

    wantNotesRead('a')
    readKaraokeNotes()
    await aWhile()
    expect(phone.opened).toEqual([])
    expect(state('a')).toBe('waiting')

    done()
    await vi.waitFor(() => expect(analyses).toHaveLength(1))
    expect(phone.opened).toEqual(['a'])
  })

  it('waits while the room reads, and goes on once it is done', async () => {
    library.set?.([own('a', 'Alpha')])
    wantNotesRead('a')
    readKaraokeNotes()
    await vi.waitFor(() => expect(analyses).toHaveLength(1))
    const firstNote = vi.fn(async () =>
      Promise.resolve({ entries: [], dropped: [] }),
    )
    setOwnSongReaderForTests(firstNote)

    readOwnSongs()
    await aWhile()
    expect(firstNote).not.toHaveBeenCalled()
    expect(ownSongs()[0].state.kind).toBe('waiting')

    analyses[0].finish(NOTES)
    await vi.waitFor(() => expect(firstNote).toHaveBeenCalledTimes(1))
  })
})
