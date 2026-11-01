// ============================================================
// The room's Find by singing: its sheet, and what a find does
// ============================================================
//
// createRoomFind on its own, with the room's parts as plain functions: the
// stage cleared before the sheet opens, a song found played where the
// singer has got to once the sheet has gone, a song gone from the room
// since played not at all and said, and Back told whether there was a
// sheet to close. Opening the sheet is remembered on the phone, so the
// room reads every song's notes from then on, and the room knows when the
// sheet holds the mic, and what each listening's fingerprinting found of a
// song it could not fingerprint. The words under a song it cannot find yet
// are checked here against every state the room's read can be in, every
// reason the room may be holding back, and what the listening found. The
// sheet over a stand-in engine is KaraokeFindSheet.test.tsx's; the room
// around it, KaraokeRoomStage's.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notifications, resetNotifications } from '@/stores/notifications-store'
import type { KaraokeNotesState } from './karaoke-notes-reader'
import { findOpenedOnce, KARAOKE_FIND_OPENED_KEY, reloadNotesWantedForTests, } from './karaoke-notes-wanted'
import type { ListeningNow } from './karaoke-room-find'
import { createRoomFind, NO_SINGING, notReadyWords, roomFindHost, TURN_NOTES_ON, } from './karaoke-room-find'
import type { RoomSong } from './karaoke-room-library'

/** The notes kept on the phone, by song: what a listening fingerprints. */
const stored = vi.hoisted(() => ({ notes: {} as Record<string, unknown[]> }))
vi.mock('@/db/services/session-pitch-analysis-service', () => ({
  loadPitchAnalysisFromDb: async (sessionId: string) => {
    const notes = stored.notes[sessionId]
    return Promise.resolve(
      notes === undefined
        ? null
        : { mergedNotes: notes, segmentedNotes: notes, pitchHistory: [] },
    )
  },
}))

const THREE_NOTES = [
  { midi: 60, noteName: 'C4', startSec: 10, endSec: 10.5 },
  { midi: 62, noteName: 'D4', startSec: 10.5, endSec: 11 },
  { midi: 64, noteName: 'E4', startSec: 11, endSec: 12 },
]

const song = (sessionId: string, title: string): RoomSong => ({
  sessionId,
  title,
  artist: null,
  durationSec: 200,
  credit: null,
  kind: 'yours',
  stems: { vocal: 'blob:v', instrumental: 'blob:i' },
})

const ALPHA = song('a', 'Alpha')
const BRAVO = song('b', 'Bravo')

/** The bundled examples, already in. */
const seeded = (): Promise<void> => Promise.resolve()

beforeEach(() => {
  stored.notes = {}
  resetNotifications()
  localStorage.removeItem(KARAOKE_FIND_OPENED_KEY)
  reloadNotesWantedForTests()
})

describe('Find by singing in the room', () => {
  it('clears the stage before the sheet opens', () => {
    const seen: boolean[] = []
    const find = createRoomFind({
      songs: () => [ALPHA, BRAVO],
      seeded,
      clearStage: () => {
        seen.push(find.isOpen())
      },
      play: () => undefined,
    })

    find.open()

    expect(seen).toEqual([false])
    expect(find.isOpen()).toBe(true)
  })

  it('closes the sheet, then plays a song found from where the singer has got to', () => {
    const played: [string, number, boolean][] = []
    const find = createRoomFind({
      songs: () => [ALPHA, BRAVO],
      seeded,
      clearStage: () => undefined,
      play: (row, startAtSec) => {
        played.push([row.sessionId, startAtSec, find.isOpen()])
      },
    })
    find.open()

    find.host.launch({ sessionId: 'b', name: 'Bravo' }, 63.5)

    expect(played).toEqual([['b', 63.5, false]])
    expect(notifications()).toEqual([])
  })

  it('plays nothing for a song gone from the room since, and says so', () => {
    const play = vi.fn()
    const find = createRoomFind({
      songs: () => [ALPHA],
      seeded,
      clearStage: () => undefined,
      play,
    })
    find.open()

    find.host.launch({ sessionId: 'b', name: 'Bravo' }, 63.5)

    expect(play).not.toHaveBeenCalled()
    expect(find.isOpen()).toBe(false)
    expect(notifications().map((note) => note.message)).toEqual([
      'That song is not in the room any more.',
    ])
  })

  it('tells Back whether there was a sheet to close', () => {
    const find = createRoomFind({
      songs: () => [ALPHA],
      seeded,
      clearStage: () => undefined,
      play: () => undefined,
    })
    expect(find.close()).toBe(false)

    find.open()

    expect(find.close()).toBe(true)
    expect(find.isOpen()).toBe(false)
    expect(find.close()).toBe(false)
  })
})

describe('the room knowing of the sheet', () => {
  it('remembers on the phone that the sheet was opened, so every song is read from then on', () => {
    const find = createRoomFind({
      songs: () => [ALPHA],
      seeded,
      clearStage: () => undefined,
      play: () => undefined,
    })
    expect(findOpenedOnce()).toBe(false)

    find.open()

    expect(findOpenedOnce()).toBe(true)
    // A launch reads it again from the phone.
    reloadNotesWantedForTests()
    expect(findOpenedOnce()).toBe(true)
  })

  it('holds the mic from its open until the listening lets it go, and again on the next', () => {
    const find = createRoomFind({
      songs: () => [ALPHA],
      seeded,
      clearStage: () => undefined,
      play: () => undefined,
    })
    expect(find.listening()).toBe(false)

    find.open()
    // Before the listening has loaded, it is about to open the mic.
    expect(find.listening()).toBe(true)
    find.heldMic(false)
    expect(find.listening()).toBe(false)
    // Listen again.
    find.heldMic(true)
    expect(find.listening()).toBe(true)
    find.heldMic(false)
    find.close()
    find.open()
    expect(find.listening()).toBe(true)
    find.close()
    expect(find.listening()).toBe(false)
  })

  it('lists no song before the examples are in, with their notes', async () => {
    let seed: () => void = () => undefined
    const host = roomFindHost({
      songs: () => [ALPHA, BRAVO],
      seeded: () =>
        new Promise<void>((resolve) => {
          seed = resolve
        }),
      cue: () => undefined,
    })
    let listed: readonly { sessionId: string }[] | null = null

    void host.songs().then((songs) => {
      listed = songs
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(listed).toBeNull()
    seed()

    await vi.waitFor(() => {
      expect(listed?.map((one) => one.sessionId)).toEqual(['a', 'b'])
    })
  })
})

describe('what a listening finds', () => {
  it('keeps what it found of each song it could not fingerprint, until the next listening', async () => {
    const find = createRoomFind({
      songs: () => [ALPHA, BRAVO],
      seeded,
      clearStage: () => undefined,
      play: () => undefined,
    })
    stored.notes = {
      // Too few notes to make a fingerprint of.
      b: [{ midi: 60, noteName: 'C4', startSec: 1, endSec: 2 }],
    }
    await find.host.songs()

    await find.host.fingerprint({ sessionId: 'a', name: 'Alpha' }, () => false)
    await find.host.fingerprint({ sessionId: 'b', name: 'Bravo' }, () => false)

    expect([find.missOf('a'), find.missOf('b')]).toEqual([
      'no-notes',
      'too-few',
    ])
    // The next listening has looked at nothing yet.
    await find.host.songs()
    expect([find.missOf('a'), find.missOf('b')]).toEqual([null, null])
  })

  it('lets go of a miss once the song can be fingerprinted', async () => {
    const find = createRoomFind({
      songs: () => [ALPHA],
      seeded,
      clearStage: () => undefined,
      play: () => undefined,
    })
    await find.host.fingerprint({ sessionId: 'a', name: 'Alpha' }, () => false)
    expect(find.missOf('a')).toBe('no-notes')
    stored.notes = { a: THREE_NOTES }

    const fp = await find.host.fingerprint(
      { sessionId: 'a', name: 'Alpha' },
      () => false,
    )

    expect(fp?.pitchSequence).toEqual([60, 62, 64])
    expect(find.missOf('a')).toBeNull()
  })
})

describe('the words under a song it cannot find yet', () => {
  const now = (over: Partial<ListeningNow> = {}): ListeningNow => ({
    fingerprinting: false,
    miss: null,
    hold: null,
    ...over,
  })
  const looking = now({ fingerprinting: true })
  const said = (notes: KaraokeNotesState, listening: ListeningNow): string =>
    notReadyWords(notes, listening)

  it('never ask for the notes of a song the listening has not looked at yet', () => {
    // Its notes may be there, an example's say: getting ready, or looking.
    expect(said({ kind: 'waiting' }, looking)).toBe('Getting ready to find')
    expect(said({ kind: 'noted' }, looking)).toBe('Getting ready to find')
    expect(said({ kind: 'read' }, looking)).toBe('Getting ready to find')
    // Nothing will read this one: no promise, only what is happening.
    expect(said({ kind: 'idle' }, looking)).toBe('Looking for its notes')
  })

  it('say how far a read has got, whatever the listening is doing', () => {
    expect(said({ kind: 'reading', percent: 40 }, now())).toBe(
      'Getting ready to find, 40%',
    )
    expect(said({ kind: 'reading', percent: 7 }, looking)).toBe(
      'Getting ready to find, 7%',
    )
  })

  it('say what a song the room will read waits for, by why the room holds back', () => {
    const waiting: KaraokeNotesState = { kind: 'waiting' }
    const found = { miss: 'no-notes' } as const
    expect(said(waiting, now({ ...found, hold: 'find' }))).toBe(
      'Gets ready when you stop singing',
    )
    expect(said(waiting, now({ ...found, hold: 'capture' }))).toBe(
      'Gets ready when the microphone is free',
    )
    expect(said(waiting, now({ ...found, hold: 'playing' }))).toBe(
      'Gets ready when the song is paused',
    )
    // Each other hold ends by itself, and the read follows.
    for (const hold of ['settling', 'loading', 'mixer', 'covered'] as const) {
      expect(said(waiting, now({ ...found, hold }))).toBe(
        'Getting ready to find',
      )
    }
    expect(said(waiting, now(found))).toBe('Getting ready to find')
  })

  it('say a song read, or given its notes, since the listening looked is found once it listens again', () => {
    const looked = now({ miss: 'no-notes' })
    expect(said({ kind: 'read' }, looked)).toBe(
      'Ready to find when you listen again',
    )
    expect(said({ kind: 'noted' }, looked)).toBe(
      'Ready to find when you listen again',
    )
  })

  it('say what keeps a song out', () => {
    expect(said({ kind: 'failed', why: 'too-long' }, now())).toBe(
      'Too long for this phone to find',
    )
    expect(said({ kind: 'failed', why: 'no-notes' }, looking)).toBe(
      'No singing found in it to find it by',
    )
    expect(said({ kind: 'failed', why: 'no-vocal' }, now())).toBe(
      'Could not be read',
    )
    expect(said({ kind: 'failed', why: 'unreadable' }, looking)).toBe(
      'Could not be read',
    )
    // A stream the phone would not open: the mixer reads it on the stage.
    expect(said({ kind: 'failed', why: 'no-stream' }, now())).toBe(
      TURN_NOTES_ON,
    )
  })

  it('say notes too thin to find a song by are that, and promise no read', () => {
    const thin = now({ miss: 'too-few', hold: 'find' })
    expect(said({ kind: 'noted' }, thin)).toBe(NO_SINGING)
    // Not looked at by the room's reader yet: it would pass over it.
    expect(said({ kind: 'waiting' }, thin)).toBe(NO_SINGING)
    expect(said({ kind: 'idle' }, { ...thin, fingerprinting: true })).toBe(
      NO_SINGING,
    )
  })

  it('ask for the notes once only where nothing will read them', () => {
    expect(said({ kind: 'idle' }, now({ miss: 'no-notes' }))).toBe(
      'Turn its notes on once to find it by singing',
    )
    expect(said({ kind: 'idle' }, now({ hold: 'find' }))).toBe(TURN_NOTES_ON)
  })
})
