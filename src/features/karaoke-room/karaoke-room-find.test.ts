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
// sheet holds the mic. The words under a song it cannot find yet are
// checked here against every state the room's read can be in. The sheet
// over a stand-in engine is KaraokeFindSheet.test.tsx's; the room around
// it, KaraokeRoomStage's.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notifications, resetNotifications } from '@/stores/notifications-store'
import type { KaraokeNotesState } from './karaoke-notes-reader'
import { findOpenedOnce, KARAOKE_FIND_OPENED_KEY, reloadNotesWantedForTests, } from './karaoke-notes-wanted'
import type { ListeningNow } from './karaoke-room-find'
import { createRoomFind, notReadyWords, roomFindHost, TURN_NOTES_ON, } from './karaoke-room-find'
import type { RoomSong } from './karaoke-room-library'

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

describe('the words under a song it cannot find yet', () => {
  const quiet: ListeningNow = { fingerprinting: false, holdsMic: false }
  const singing: ListeningNow = { fingerprinting: false, holdsMic: true }
  const starting: ListeningNow = { fingerprinting: true, holdsMic: true }
  const said = (notes: KaraokeNotesState, now: ListeningNow): string =>
    notReadyWords(notes, now)

  it('say a song with notes being fingerprinted is getting ready, never to turn its notes on', () => {
    // Its notes are there (an example, or a song read before), and the
    // listening is still making its fingerprint.
    expect(said({ kind: 'idle' }, starting)).toBe('Getting ready to find')
    expect(said({ kind: 'waiting' }, starting)).toBe('Getting ready to find')
    expect(said({ kind: 'read' }, starting)).toBe('Getting ready to find')
  })

  it('say how far a read has got, whatever the listening is doing', () => {
    expect(said({ kind: 'reading', percent: 40 }, quiet)).toBe(
      'Getting ready to find, 40%',
    )
    expect(said({ kind: 'reading', percent: 7 }, starting)).toBe(
      'Getting ready to find, 7%',
    )
  })

  it('say a song waits for the singing to stop while the sheet listens', () => {
    expect(said({ kind: 'waiting' }, singing)).toBe(
      'Gets ready when you stop singing',
    )
    expect(said({ kind: 'waiting' }, quiet)).toBe('Getting ready to find')
  })

  it('say a song read while the sheet was quiet is found once it listens again', () => {
    expect(said({ kind: 'read' }, quiet)).toBe(
      'Ready to find when you listen again',
    )
  })

  it('say what keeps a song out', () => {
    expect(said({ kind: 'failed', why: 'too-long' }, quiet)).toBe(
      'Too long for this phone to find',
    )
    expect(said({ kind: 'failed', why: 'unreadable' }, starting)).toBe(
      'Could not be read',
    )
    // A stream the phone would not open: the mixer reads it on the stage.
    expect(said({ kind: 'failed', why: 'no-stream' }, quiet)).toBe(
      TURN_NOTES_ON,
    )
  })

  it('ask for the notes once only where nothing will read them', () => {
    expect(said({ kind: 'idle' }, quiet)).toBe(
      'Turn its notes on once to find it by singing',
    )
    expect(said({ kind: 'idle' }, singing)).toBe(TURN_NOTES_ON)
  })
})
