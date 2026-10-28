// ============================================================
// First note's own songs — which the phone has read, and a run's songs
// ============================================================
//
// A song the singer imported and split in the Karaoke room is a song of
// their own here too (the room's library says which: karaoke-room-
// library.ts). Before First note can play one it needs its entries, which
// the phone reads once (own-song-read.ts) and keeps on this device, keyed by
// the song and its stems: a stem replaced in the studio is a new read.
//
// A song is, here:
//
//   waiting   not read yet
//   reading   being read, and how far
//   ready     read, with enough clean entries to sing
//   few       read, with fewer than OWN_SONG_MIN_ENTRIES: it sits out, and
//             the Songs sheet says so
//   failed    not read, and why: too long for this phone to hold, no voice
//             in it, or a read that did not finish (the cause goes to the
//             log, not to the singer); tried again at the next launch
//
// Songs are read one at a time, and only while the room asks: it asks at
// rest, with songs of the singer's own chosen, and lets go when a run
// starts, so a read never competes with the microphone. A read stopped
// part-way starts again from the beginning next time.
//
// The list is built once and kept up to date (`ownSongs`): a song keeps its
// object until what the phone knows of it changes, so a read's progress
// redraws its own row in the Songs sheet and nothing else.
//
// The kept reads live under `mp_first_note_own_entries` (the `mp_` prefix
// keeps them out of the settings sync: they are this phone's songs). A read
// is let go only with its song: when the session is gone from this phone,
// not while it is out of the library separating again.

import type { Accessor, Signal } from 'solid-js'
import { createMemo, createRoot, createSignal, untrack } from 'solid-js'
import type { RoomSong } from '@/features/karaoke-room/karaoke-room-library'
import { hydrateSong, roomLibrary, } from '@/features/karaoke-room/karaoke-room-library'
import { createPersistedSignal } from '@/lib/storage'
import { getUvrSession, isSessionStoreReady } from '@/stores/uvr-store'
import type { FirstNoteSource } from './first-note-choices'
import { OWN_SONG_MIN_ENTRIES } from './first-note-rules'
import type { FirstNoteEntry, FirstNoteSong } from './first-note-songs'
import { FIRST_NOTE_SONGS } from './first-note-songs'
import type { OwnSongOut, OwnSongRead, OwnSongReadRun } from './own-song-read'

export const FIRST_NOTE_OWN_ENTRIES_KEY = 'mp_first_note_own_entries'

/**
 * Why a song was not read: too long for this phone to hold, no voice in
 * it, or a read that did not finish.
 */
export type OwnSongFailure = OwnSongOut | 'unreadable'

/** What the phone knows of one song of the singer's own. */
export type OwnSongState =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'reading'; readonly progress: number }
  | { readonly kind: 'ready'; readonly entries: readonly FirstNoteEntry[] }
  | { readonly kind: 'few'; readonly entries: number }
  | { readonly kind: 'failed'; readonly why: OwnSongFailure }

export interface OwnSong {
  readonly sessionId: string
  readonly title: string
  readonly state: OwnSongState
}

/** A finished read, as kept. */
interface KeptRead {
  /** The stems it was read from (`stemsKey`). */
  readonly stems: string
  readonly entries: readonly FirstNoteEntry[]
}

type KeptReads = Readonly<Record<string, KeptRead>>

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

function isEntry(value: unknown): value is FirstNoteEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    isNumber(entry.at) &&
    isNumber(entry.midi) &&
    isNumber(entry.from) &&
    isNumber(entry.until) &&
    Array.isArray(entry.beats) &&
    entry.beats.every(isNumber) &&
    (entry.words === undefined || typeof entry.words === 'string')
  )
}

function isKeptReads(value: unknown): value is KeptReads {
  if (typeof value !== 'object' || value === null) return false
  return Object.values(value).every((kept: unknown) => {
    if (typeof kept !== 'object' || kept === null) return false
    const read = kept as Record<string, unknown>
    return (
      typeof read.stems === 'string' &&
      Array.isArray(read.entries) &&
      read.entries.every(isEntry)
    )
  })
}

let kept: Signal<KeptReads> | null = null

function keptSignal(): Signal<KeptReads> {
  kept ??= createPersistedSignal<KeptReads>(
    FIRST_NOTE_OWN_ENTRIES_KEY,
    {},
    {
      validator: isKeptReads,
    },
  )
  return kept
}

/** Songs being read, and songs whose read failed in this launch. */
const [live, setLive] = createSignal<
  Readonly<
    Record<
      string,
      { readonly reading: number } | { readonly failed: OwnSongFailure }
    >
  >
>({})

/**
 * The song's stems, as a key: their sizes and lengths, as the session row
 * keeps them. A stem replaced in the studio changes it.
 */
export function stemsKey(sessionId: string): string {
  const meta = getUvrSession(sessionId)?.stemMeta
  const part = (stem: string): string => {
    const one = meta?.[stem]
    return `${one?.size ?? '-'}/${one?.duration ?? '-'}`
  }
  return `${part('vocal')}|${part('instrumental')}`
}

/** The singer's own songs in the Karaoke room's library, newest first. */
function ownRoomSongs(): RoomSong[] {
  return roomLibrary().filter((song) => song.kind === 'yours')
}

function stateOf(song: RoomSong): OwnSongState {
  const now = live()[song.sessionId]
  if (now !== undefined) {
    return 'reading' in now
      ? { kind: 'reading', progress: now.reading }
      : { kind: 'failed', why: now.failed }
  }
  const read = keptSignal()[0]()[song.sessionId]
  if (read === undefined || read.stems !== stemsKey(song.sessionId)) {
    return { kind: 'waiting' }
  }
  return read.entries.length < OWN_SONG_MIN_ENTRIES
    ? { kind: 'few', entries: read.entries.length }
    : { kind: 'ready', entries: read.entries }
}

/** Whether two states of one song say the same. */
function sameState(a: OwnSongState, b: OwnSongState): boolean {
  switch (a.kind) {
    case 'reading':
      return b.kind === 'reading' && b.progress === a.progress
    case 'ready':
      return b.kind === 'ready' && b.entries === a.entries
    case 'few':
      return b.kind === 'few' && b.entries === a.entries
    case 'failed':
      return b.kind === 'failed' && b.why === a.why
    case 'waiting':
      return b.kind === 'waiting'
  }
}

/** The same items, in the same order. */
function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i])
}

interface Listed {
  readonly songs: Accessor<OwnSong[]>
  readonly ids: Accessor<string[]>
  readonly waiting: Accessor<string[]>
  readonly dispose: () => void
}

let listed: Listed | null = null

/**
 * The list, built on first read and kept up to date for the app's life. A
 * song keeps its object while what the phone knows of it stays the same,
 * and the list keeps its array while no song changed.
 */
function listing(): Listed {
  listed ??= createRoot((dispose) => {
    let known = new Map<string, OwnSong>()
    const songs = createMemo<OwnSong[]>(
      () => {
        const next = ownRoomSongs().map((room) => {
          const state = stateOf(room)
          const was = known.get(room.sessionId)
          return was !== undefined &&
            was.title === room.title &&
            sameState(was.state, state)
            ? was
            : { sessionId: room.sessionId, title: room.title, state }
        })
        known = new Map(next.map((song) => [song.sessionId, song]))
        return next
      },
      [],
      { equals: sameItems },
    )
    const ids = createMemo(() => songs().map((song) => song.sessionId), [], {
      equals: sameItems,
    })
    const waiting = createMemo(
      () =>
        songs()
          .filter((song) => song.state.kind === 'waiting')
          .map((song) => song.sessionId),
      [],
      { equals: sameItems },
    )
    return { songs, ids, waiting, dispose }
  })
  return listed
}

/** The singer's own songs, each with what the phone knows of it. Reactive. */
export function ownSongs(): OwnSong[] {
  return listing().songs()
}

/** The singer's own songs' session ids, newest first. Reactive. */
export function ownSongIds(): string[] {
  return listing().ids()
}

/** One song of the singer's own, by its session; undefined once it is gone. */
export function ownSong(sessionId: string): OwnSong | undefined {
  return ownSongs().find((song) => song.sessionId === sessionId)
}

/**
 * The songs not read yet, by session. Reactive, and it changes only when one
 * turns up or is read, not with a read's progress.
 */
export function waitingOwnSongs(): string[] {
  return listing().waiting()
}

/** The singer's own songs a run can play: read, with enough entries. */
export function readyOwnSongs(): FirstNoteSong[] {
  const songs: FirstNoteSong[] = []
  for (const song of ownRoomSongs()) {
    const state = stateOf(song)
    if (state.kind !== 'ready') continue
    songs.push({
      slug: song.sessionId,
      sessionId: song.sessionId,
      kind: 'yours',
      title: song.title,
      artist: song.artist ?? '',
      credit: '',
      stems: song.stems,
      entries: state.entries,
    })
  }
  return songs
}

/** The songs a run from `source` plays. Reactive. */
export function songsFrom(source: FirstNoteSource): readonly FirstNoteSong[] {
  if (source === 'examples') return FIRST_NOTE_SONGS
  const yours = readyOwnSongs()
  return source === 'yours' ? yours : [...FIRST_NOTE_SONGS, ...yours]
}

/**
 * The song with stems that play now. An example's are packaged files; a
 * song of the singer's own keeps its stems on the phone, and the URLs its
 * row carries die with the page that minted them (karaoke-room-library.ts
 * hydrateSong).
 */
export async function playableSong(
  song: FirstNoteSong,
): Promise<FirstNoteSong> {
  if (song.kind === 'example') return song
  const room = untrack(ownRoomSongs).find(
    (candidate) => candidate.sessionId === song.sessionId,
  )
  if (room === undefined) return song
  const stems = await hydrateSong(room)
  return { ...song, stems }
}

// ── Reading ─────────────────────────────────────────────────────

/** The read in flight, so the room can stop it. */
let inFlight: { sessionId: string; controller: AbortController } | null = null
/** The room wants songs read. */
let wanted = false

type SongReader = (
  sessionId: string,
  run: OwnSongReadRun,
) => Promise<OwnSongRead>

/**
 * The read itself (own-song-read.ts), loaded with the first read rather
 * than with the room: the pitch read is a large module, and a singer who
 * sings the examples never needs it.
 */
const realReader: SongReader = async (sessionId, run) => {
  const { readOwnSong } = await import('./own-song-read')
  return readOwnSong(sessionId, run)
}

let reader: SongReader = realReader

/** Tests only: read songs with `next`, or the real read for null. */
export function setOwnSongReaderForTests(next: SongReader | null): void {
  reader = next ?? realReader
}

function setLiveFor(
  sessionId: string,
  value: { reading: number } | { failed: OwnSongFailure } | null,
): void {
  setLive((now) => {
    const next = { ...now }
    if (value === null) delete next[sessionId]
    else next[sessionId] = value
    return next
  })
}

/**
 * Keep a finished read, and let go of the reads of songs gone from this
 * phone. Only gone: a song out of the library while it separates again is
 * still the singer's, and its read is good until its stems change.
 */
function keep(sessionId: string, stems: string, read: OwnSongRead): void {
  const storeRead = untrack(isSessionStoreReady)
  keptSignal()[1]((reads) => {
    const next: Record<string, KeptRead> = {}
    for (const [id, one] of Object.entries(reads)) {
      if (!storeRead || getUvrSession(id) !== undefined) next[id] = one
    }
    next[sessionId] = { stems, entries: read.entries }
    return next
  })
}

async function readNext(): Promise<void> {
  if (!wanted || inFlight !== null) return
  const next = untrack(ownSongs).find((song) => song.state.kind === 'waiting')
  if (next === undefined) return
  const { sessionId } = next
  const stems = stemsKey(sessionId)
  const controller = new AbortController()
  inFlight = { sessionId, controller }
  setLiveFor(sessionId, { reading: 0 })
  try {
    const read = await reader(sessionId, {
      signal: controller.signal,
      onProgress: (percent) => {
        if (inFlight?.controller === controller) {
          setLiveFor(sessionId, { reading: percent })
        }
      },
    })
    if (controller.signal.aborted) {
      setLiveFor(sessionId, null)
      return
    }
    if (read.out === undefined) {
      keep(sessionId, stems, read)
      setLiveFor(sessionId, null)
    } else {
      setLiveFor(sessionId, { failed: read.out })
    }
  } catch (error) {
    if (controller.signal.aborted) {
      setLiveFor(sessionId, null)
      return
    }
    // The cause is the developer's, not the singer's: the sheet says only
    // that the song could not be read.
    console.warn('[first-note] could not read a song:', error)
    setLiveFor(sessionId, { failed: 'unreadable' })
  } finally {
    if (inFlight?.controller === controller) inFlight = null
    void readNext()
  }
}

/**
 * Read the songs of the singer's own that are waiting, one at a time,
 * until the room lets go. Safe to call again: a read in flight goes on.
 */
export function readOwnSongs(): void {
  wanted = true
  void readNext()
}

/** Stop reading: the read in flight is dropped, and starts again next time. */
export function stopReadingOwnSongs(): void {
  wanted = false
  inFlight?.controller.abort()
}

/** Tests only: nothing read, nothing kept, nothing reading, no list built. */
export function resetOwnSongsForTests(): void {
  stopReadingOwnSongs()
  inFlight = null
  kept = null
  listed?.dispose()
  listed = null
  setLive({})
  try {
    localStorage.removeItem(FIRST_NOTE_OWN_ENTRIES_KEY)
  } catch {
    // Nothing persisted to clear.
  }
}
