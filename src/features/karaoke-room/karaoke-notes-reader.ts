// ============================================================
// The Karaoke room's songs, read for their notes while the room rests
// ============================================================
//
// Find by singing knows a song by the notes it keeps (karaoke-room-find.ts),
// and a song with none cannot be found: its row asked the singer to turn its
// notes on once. The examples ship with theirs (bundled-notes.ts); any other
// song has them once its vocal has been read, which waited for the singer
// to turn its notes or the mic on. So the room reads them itself while it
// rests: each song just separated, and once Find by singing has been opened,
// every song (karaoke-notes-wanted.ts). An example with its notes is passed
// over at a look; one whose notes did not land is read from its packaged
// vocal.
//
// HOW. By the read First note makes of a song with no notes (stem-mixer/
// vocal-notes-read.ts), with nobody asking: the vocal walked from its stream
// and never decoded whole, so a phone that cannot stream reads nothing
// here; a song with a record of its notes, or that gets one meanwhile,
// keeps it as it is; an empty read is never kept.
//
// WHEN. One song at a time, only while the room asks, and it asks at rest
// (useKaraokeNotesReading.ts): anything else stops the read, which starts
// again from the beginning at the next rest. Never beside First note's read
// (song-read-lock.ts). Never the song on the stage: its mixer has it loaded
// and reads its notes itself when they are turned on, and a record kept
// under a mounted mixer would not reach it until the song was cued again.
// Never for a singer who turned off "Index new songs" (Shazam & Sing, in
// the web's Settings, and synced): it is the same work, after separation.
//
// A song is, here: waiting, reading (how far), read (this launch), or
// failed and why: too long for this phone, no stream to read it from, or a
// read that did not come to notes. A failure is remembered for this launch
// only, and by the vocal it failed on: a song split again is tried again,
// and every failure is tried again at the next launch.
//
// The console hears of each read, "[notes-read]": its start, its end with
// how many notes in how many seconds, a song passed over, a read stopped
// and what stopped it, a failure and why. All console.info, which a test
// build's console shows with its routine logs off.

import { fetchAssetBytes } from '@irchiinnuss/mobile-runtime/asset-fetch'
import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createRoot, createSignal, untrack, } from 'solid-js'
import { getStemBlob } from '@/db/services/uvr-service'
import { canReadNotesUnasked, readSongNotes, } from '@/features/stem-mixer/vocal-notes-read'
import { takeSongReadLock } from '@/lib/song-read-lock'
import { karaokeAutoIndexShazam } from '@/stores/karaoke-settings-store'
import { getUvrSession, isSessionStoreReady } from '@/stores/uvr-store'
import { findOpenedOnce, forgetNotesWanted, notesWanted, } from './karaoke-notes-wanted'
import type { RoomSong } from './karaoke-room-library'
import { roomLibrary } from './karaoke-room-library'
import { karaokeStagedSong } from './karaoke-room-store'

/** What a read came to (vocal-notes-read.ts `SongNotesRead`). */
type NotesRead = Awaited<ReturnType<typeof readSongNotes>>

/** Why a song's notes were not read. */
export type NotesFailure = 'too-long' | 'no-stream' | 'unreadable'

/** What the room knows of one song's notes, for the find sheet's rows. */
export type KaraokeNotesState =
  /** Nothing to read here: it has its notes, or the room does not read it. */
  | { readonly kind: 'idle' }
  /** To be read at the room's next rest. */
  | { readonly kind: 'waiting' }
  | { readonly kind: 'reading'; readonly percent: number }
  /** Read and kept in this launch. */
  | { readonly kind: 'read' }
  | { readonly kind: 'failed'; readonly why: NotesFailure }

/** The lock's name for this reader (song-read-lock.ts). */
const LOCK_OWNER = 'karaoke-notes'

const IDLE: KaraokeNotesState = { kind: 'idle' }
const WAITING: KaraokeNotesState = { kind: 'waiting' }
const READ: KaraokeNotesState = { kind: 'read' }

/**
 * What this launch has learnt of a song: being read, read, nothing to read
 * for it (a record of its notes found, or no session of it on the phone),
 * or failed on the vocal it has (`vocalKey`). Whatever a read ends in is
 * learnt, so no song is read twice in a launch for the same answer.
 */
type LiveRead =
  | { readonly reading: number }
  | { readonly read: true }
  | { readonly done: true }
  | { readonly failed: NotesFailure; readonly vocal: string }

const [live, setLive] = createSignal<Readonly<Record<string, LiveRead>>>({})

function setLiveFor(sessionId: string, value: LiveRead | null): void {
  setLive((now) => {
    const next = { ...now }
    if (value === null) delete next[sessionId]
    else next[sessionId] = value
    return next
  })
}

/**
 * The vocal a read failed on, as a key: its size and length as the session
 * row keeps them. The notes come from the vocal alone, so a vocal replaced
 * (the song split again) is a new read, and the band changing is not.
 */
function vocalKey(sessionId: string): string {
  const vocal = getUvrSession(sessionId)?.stemMeta?.vocal
  return `${vocal?.size ?? '-'}/${vocal?.duration ?? '-'}`
}

/** What this launch has learnt of the song, or null for nothing yet. */
function learnt(sessionId: string): KaraokeNotesState | null {
  const now = live()[sessionId]
  if (now === undefined) return null
  if ('reading' in now) return { kind: 'reading', percent: now.reading }
  if ('read' in now) return READ
  if ('done' in now) return IDLE
  // A failure on a vocal the song no longer has is nothing learnt.
  return now.vocal === vocalKey(sessionId)
    ? { kind: 'failed', why: now.failed }
    : null
}

/**
 * The room reads songs' notes at all: the singer has not turned "Index new
 * songs" off, and this phone streams (nothing is decoded whole unasked).
 */
function readsAllowed(): boolean {
  return karaokeAutoIndexShazam() && canReadNotesUnasked()
}

/** The same items, in the same order. */
function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i])
}

/** The songs to read now, by session: the ones just separated first. */
function waitingNow(): string[] {
  if (!readsAllowed()) return []
  const wanted = notesWanted()
  const every = findOpenedOnce()
  const staged = karaokeStagedSong()
  const songs = roomLibrary().filter(
    (song) =>
      song.sessionId !== staged &&
      (every || wanted.includes(song.sessionId)) &&
      learnt(song.sessionId) === null,
  )
  const first = songs.filter((song) => wanted.includes(song.sessionId))
  const rest = songs.filter((song) => !wanted.includes(song.sessionId))
  return [...first, ...rest].map((song) => song.sessionId)
}

interface Listed {
  readonly waiting: Accessor<string[]>
  readonly dispose: () => void
}

let listed: Listed | null = null

/**
 * The songs waiting, kept up to date for the app's life, and the song on
 * the stage let go of if it is the one being read: its mixer has it.
 */
function listing(): Listed {
  listed ??= createRoot((dispose) => {
    const waiting = createMemo(waitingNow, [], { equals: sameItems })
    createEffect(() => {
      const staged = karaokeStagedSong()
      if (staged !== null && untrack(() => inFlight?.sessionId) === staged) {
        untrack(() => {
          stop('it went on the stage, where its mixer reads it')
        })
      }
    })
    return { waiting, dispose }
  })
  return listed
}

/**
 * The songs waiting to be read, by session. Reactive, and it changes only
 * when one turns up or is taken up, not with a read's progress.
 */
export function karaokeNotesWaiting(): string[] {
  return listing().waiting()
}

/** What the room knows of one song's notes. Reactive. */
export function karaokeNotesState(sessionId: string): KaraokeNotesState {
  const known = learnt(sessionId)
  if (known !== null) return known
  return listing().waiting().includes(sessionId) ? WAITING : IDLE
}

// ── Reading ─────────────────────────────────────────────────────

/** The read in flight, so the room can stop it, and the console name it. */
let inFlight: {
  readonly sessionId: string
  readonly title: string
  readonly controller: AbortController
} | null = null
/** The room is at rest and wants songs read. */
let asking = false

let reader: typeof readSongNotes = readSongNotes

/** Tests only: read songs with `next`, or the real read for null. */
export function setKaraokeNotesReaderForTests(
  next: typeof readSongNotes | null,
): void {
  reader = next ?? readSongNotes
}

/**
 * The vocal to read: the stem kept on the phone, which an example has only
 * where the singer replaced it; otherwise an example's own, packaged with
 * the app (or the server's, for an example the bundle lacks).
 */
async function vocalOf(song: RoomSong): Promise<Blob | null> {
  const kept = await getStemBlob(song.sessionId, 'vocal')
  if (kept !== null || song.kind !== 'example' || song.stems.vocal === '') {
    return kept
  }
  // A packaged file answers status 0 with its bytes on iOS: never `ok`.
  return new Blob([await fetchAssetBytes(song.stems.vocal)])
}

const megabytes = (bytes: number): string => (bytes / 1_000_000).toFixed(1)

/** Why a read came to nothing, for the console, and what the sheet says. */
function failureOf(
  read: Extract<
    NotesRead,
    { kind: 'too-long' | 'no-stream' | 'no-vocal' | 'no-notes' }
  >,
): { readonly why: NotesFailure; readonly said: string } {
  switch (read.kind) {
    case 'too-long':
      return {
        why: 'too-long',
        said: `its vocal (${megabytes(read.bytes)} MB) is too long for this phone to hold`,
      }
    case 'no-stream':
      return {
        why: 'no-stream',
        said: 'this phone would not open its vocal as a stream',
      }
    case 'no-vocal':
      return { why: 'unreadable', said: 'it has no vocal on this phone' }
    case 'no-notes':
      return {
        why: 'unreadable',
        said: `no notes heard in it, read in ${read.seconds.toFixed(1)} s`,
      }
  }
}

/** A read that came to an end: told to the console, and what it learnt. */
function settle(song: RoomSong, vocal: string, read: NotesRead): void {
  const { sessionId, title } = song
  switch (read.kind) {
    case 'kept':
      console.info(
        `[notes-read] read "${title}": ${read.notes} notes in ${read.seconds.toFixed(1)} s`,
      )
      forgetNotesWanted(sessionId)
      setLiveFor(sessionId, { read: true })
      return
    case 'had-notes':
      console.info(`[notes-read] skipped "${title}": it has its notes`)
      forgetNotesWanted(sessionId)
      setLiveFor(sessionId, { done: true })
      return
    case 'appeared':
      console.info(
        `[notes-read] kept nothing of "${title}": its notes were kept while it was read`,
      )
      forgetNotesWanted(sessionId)
      setLiveFor(sessionId, { done: true })
      return
    case 'gone':
      // Learnt as done too: an example listed with no session row of its
      // own would read as gone each time, and be read for ever.
      console.info(
        `[notes-read] kept nothing of "${title}": it left the phone while it was read`,
      )
      forgetNotesWanted(sessionId)
      setLiveFor(sessionId, { done: true })
      return
    default: {
      const failure = failureOf(read)
      console.info(`[notes-read] could not read "${title}": ${failure.said}`)
      setLiveFor(sessionId, { failed: failure.why, vocal })
    }
  }
}

/** The next song to read, as the library has it. */
function nextSong(): RoomSong | undefined {
  const sessionId = untrack(listing().waiting)[0]
  if (sessionId === undefined) return undefined
  return untrack(roomLibrary).find((song) => song.sessionId === sessionId)
}

/**
 * A read's progress on its song's row, and the read told to the console as
 * it gets under way: past the look for a record of its notes, so a song
 * passed over is told only as skipped.
 */
function progressOf(
  song: RoomSong,
  controller: AbortController,
): (percent: number) => void {
  let told = false
  return (percent) => {
    if (inFlight?.controller !== controller) return
    if (!told) {
      told = true
      console.info(`[notes-read] reading "${song.title}"`)
    }
    setLiveFor(song.sessionId, { reading: percent })
  }
}

/** One song read, and what it came to learnt; nothing when it is stopped. */
async function readOne(
  song: RoomSong,
  controller: AbortController,
): Promise<void> {
  const { sessionId, title } = song
  const { signal } = controller
  const vocal = vocalKey(sessionId)
  setLiveFor(sessionId, { reading: 0 })
  try {
    const read = await reader(sessionId, {
      signal,
      vocal: () => vocalOf(song),
      onProgress: progressOf(song, controller),
    })
    if (signal.aborted) setLiveFor(sessionId, null)
    else settle(song, vocal, read)
  } catch (error) {
    if (signal.aborted) {
      setLiveFor(sessionId, null)
      return
    }
    const cause = error instanceof Error ? error.message : String(error)
    console.info(`[notes-read] could not read "${title}": ${cause}`)
    setLiveFor(sessionId, { failed: 'unreadable', vocal })
  }
}

/** Asked again once First note's read lets the lock go. */
const readWhenFree = (): void => {
  void readNext()
}

async function readNext(): Promise<void> {
  if (!asking || inFlight !== null) return
  const song = nextSong()
  if (song === undefined) return
  const release = takeSongReadLock(LOCK_OWNER, readWhenFree)
  if (release === null) return
  const controller = new AbortController()
  // A read stopped lets the lock go at once, not once it has unwound.
  controller.signal.addEventListener('abort', release)
  inFlight = { sessionId: song.sessionId, title: song.title, controller }
  try {
    await readOne(song, controller)
  } finally {
    release()
    if (inFlight?.controller === controller) inFlight = null
    void readNext()
  }
}

/** The songs listed as just separated that have left the phone since. */
function letGoOfGone(): void {
  if (!untrack(isSessionStoreReady)) return
  for (const sessionId of untrack(notesWanted)) {
    if (getUvrSession(sessionId) === undefined) forgetNotesWanted(sessionId)
  }
}

/** The read in flight stopped, and why, for the console. */
function stop(why: string): void {
  const now = inFlight
  if (now === null || now.controller.signal.aborted) return
  console.info(
    `[notes-read] stopped reading "${now.title}": ${why}. It is read again from the start at the next rest`,
  )
  now.controller.abort()
}

/**
 * Read the songs that are waiting, one at a time, until the room lets go.
 * Safe to call again: a read in flight goes on.
 */
export function readKaraokeNotes(): void {
  asking = true
  letGoOfGone()
  void readNext()
}

/**
 * Stop reading, and say why for the console: the read in flight is let go,
 * and its song is read again from the start at the next rest.
 */
export function stopReadingKaraokeNotes(why: string): void {
  asking = false
  stop(why)
}

/** Tests only: nothing read, nothing reading, nothing learnt, no list. */
export function resetKaraokeNotesForTests(): void {
  asking = false
  inFlight?.controller.abort()
  inFlight = null
  listed?.dispose()
  listed = null
  setLive({})
}
