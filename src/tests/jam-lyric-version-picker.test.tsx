// ============================================================
// The Original / Edited buttons belong to the song on screen
// ============================================================
//
// Owner report (2026-09-19): after switching songs, pressing Original put
// the PREVIOUS song's words on the one that was loaded, and the buttons
// came and went as songs were switched back and forth.
//
// The buttons were a list with no owner. It was fetched by session id,
// and a resource whose source goes null keeps the value it had -- so a
// song with no session id (every example) inherited the last song's
// buttons, and so did any song for as long as its own list took to load.
// Pressing one attached those lines to whatever was loaded.

import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JamLyricChoice } from '@/lib/jam/jam-session-songs'
import type { JamSong } from '@/lib/jam/jam-song'
import type { LyricsLineTiming } from '@/lib/jam/types'

type Attach = (songId: string, lines: LyricsLineTiming[]) => void

const room = vi.hoisted(() => ({
  host: true,
  attach: null as unknown as Attach,
  getSong: null as unknown as () => JamSong | null,
}))

vi.mock('@/stores/jam-store', () => ({
  attachJamSongLyrics: (songId: string, lines: LyricsLineTiming[]) =>
    room.attach(songId, lines),
  jamIsHost: () => room.host,
  jamSong: () => room.getSong(),
}))

const sessionLyricChoices =
  vi.fn<(sessionId: string) => Promise<JamLyricChoice[]>>()
vi.mock('@/lib/jam/jam-session-songs', () => ({
  sessionLyricChoices: (id: string) => sessionLyricChoices(id),
}))

const { JamLyricVersionPicker } =
  await import('@/components/jam/JamLyricVersionPicker')

const [song, setSong] = createSignal<JamSong | null>(null)

const lines = (...texts: string[]): LyricsLineTiming[] =>
  texts.map((text, i) => ({ text, startSec: 1 + i * 4 }))

const choice = (
  kind: JamLyricChoice['kind'],
  label: string,
  of: LyricsLineTiming[],
  active = false,
): JamLyricChoice => ({ kind, label, lines: of, active })

const roomSong = (id: string, of: LyricsLineTiming[]): JamSong => ({
  id,
  title: id,
  stems: { instrumental: 'blob:instrumental' },
  lines: of,
  notes: [],
  durationSec: 180,
  origin: 'local',
})

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

const A_ORIGINAL = lines('a original one', 'a original two')
const A_EDITED = lines('a edited one', 'a edited two')
const A_CHOICES = [
  choice('imported', 'Original', A_ORIGINAL),
  choice('edited', 'Edited', A_EDITED, true),
]
const B_ORIGINAL = lines('b original one', 'b original two')
const B_EDITED = lines('b edited one', 'b edited two')
const B_CHOICES = [
  choice('imported', 'Original', B_ORIGINAL),
  choice('edited', 'Edited', B_EDITED, true),
]

const attach = vi.fn<Attach>()

beforeEach(() => {
  room.host = true
  attach.mockReset()
  room.attach = attach
  room.getSong = song
  sessionLyricChoices.mockReset()
  setSong(null)
})

afterEach(() => cleanup())

describe('the words a room can choose between', () => {
  it('offers the loaded song its own versions, and says whose they are', async () => {
    sessionLyricChoices.mockResolvedValue(A_CHOICES)
    setSong(roomSong('session:a', A_EDITED))
    const { findByRole } = render(() => <JamLyricVersionPicker />)

    fireEvent.click(await findByRole('button', { name: 'Original' }))

    expect(sessionLyricChoices).toHaveBeenCalledWith('a')
    expect(attach).toHaveBeenCalledWith('session:a', A_ORIGINAL)
  })

  it('reads an example song by its own id, which is its session id', async () => {
    // An example the host has corrected in the mixer has an Edited version
    // like any other song, and lost its buttons when examples stopped being
    // loaded from their library rows.
    sessionLyricChoices.mockResolvedValue(B_CHOICES)
    setSong(roomSong('karaoke-night-demo:paper-boats', B_ORIGINAL))
    const { findByRole } = render(() => <JamLyricVersionPicker />)

    await findByRole('button', { name: 'Edited' })
    expect(sessionLyricChoices).toHaveBeenCalledWith(
      'karaoke-night-demo:paper-boats',
    )
  })

  it('takes the last song with it: nothing to choose means no buttons', async () => {
    sessionLyricChoices.mockImplementation(async (id) =>
      id === 'a' ? A_CHOICES : [],
    )
    setSong(roomSong('session:a', A_EDITED))
    const { findByRole, queryByRole } = render(() => <JamLyricVersionPicker />)
    await findByRole('button', { name: 'Original' })

    setSong(roomSong('karaoke-night-demo', B_ORIGINAL))

    await waitFor(() =>
      expect(sessionLyricChoices).toHaveBeenCalledWith('karaoke-night-demo'),
    )
    await waitFor(() =>
      expect(queryByRole('button', { name: 'Original' })).toBeNull(),
    )
    expect(attach).not.toHaveBeenCalled()
  })

  it('shows nothing while the next song is still reading its own', async () => {
    const forB = deferred<JamLyricChoice[]>()
    sessionLyricChoices.mockImplementation((id) =>
      id === 'a' ? Promise.resolve(A_CHOICES) : forB.promise,
    )
    setSong(roomSong('session:a', A_EDITED))
    const { findByRole, queryByRole } = render(() => <JamLyricVersionPicker />)
    await findByRole('button', { name: 'Original' })

    // The window the report fell into: B is loaded, A's list is still the
    // newest one there is.
    setSong(roomSong('session:b', B_EDITED))
    await waitFor(() => expect(sessionLyricChoices).toHaveBeenCalledWith('b'))
    expect(queryByRole('button', { name: 'Original' })).toBeNull()

    forB.resolve(B_CHOICES)
    fireEvent.click(await findByRole('button', { name: 'Original' }))
    expect(attach).toHaveBeenCalledTimes(1)
    expect(attach).toHaveBeenCalledWith('session:b', B_ORIGINAL)
  })

  it('goes away with the song', async () => {
    sessionLyricChoices.mockResolvedValue(A_CHOICES)
    setSong(roomSong('session:a', A_EDITED))
    const { findByRole, queryByRole } = render(() => <JamLyricVersionPicker />)
    await findByRole('button', { name: 'Original' })

    setSong(null)

    await waitFor(() =>
      expect(queryByRole('button', { name: 'Original' })).toBeNull(),
    )
  })

  it('lands on the right song after a quick there-and-back', async () => {
    const forB = deferred<JamLyricChoice[]>()
    sessionLyricChoices.mockImplementation((id) =>
      id === 'a' ? Promise.resolve(A_CHOICES) : forB.promise,
    )
    setSong(roomSong('session:a', A_EDITED))
    const { findByRole } = render(() => <JamLyricVersionPicker />)
    await findByRole('button', { name: 'Original' })

    setSong(roomSong('session:b', B_EDITED))
    await waitFor(() => expect(sessionLyricChoices).toHaveBeenCalledWith('b'))
    setSong(roomSong('session:a', A_EDITED))
    // B answers late, after the room has gone back to A.
    forB.resolve(B_CHOICES)

    fireEvent.click(await findByRole('button', { name: 'Original' }))
    expect(attach).toHaveBeenCalledWith('session:a', A_ORIGINAL)
  })

  it('is the host alone who chooses', async () => {
    room.host = false
    sessionLyricChoices.mockResolvedValue(A_CHOICES)
    setSong(roomSong('session:a', A_EDITED))
    const { queryByRole } = render(() => <JamLyricVersionPicker />)

    await waitFor(() => expect(sessionLyricChoices).toHaveBeenCalled())
    expect(queryByRole('button', { name: 'Original' })).toBeNull()
  })
})

describe('which button is lit', () => {
  const pressed = (button: HTMLElement) => button.getAttribute('aria-pressed')

  it('is the version on screen', async () => {
    sessionLyricChoices.mockResolvedValue(A_CHOICES)
    setSong(roomSong('session:a', A_EDITED))
    const { findByRole } = render(() => <JamLyricVersionPicker />)

    expect(pressed(await findByRole('button', { name: 'Edited' }))).toBe('true')
    expect(pressed(await findByRole('button', { name: 'Original' }))).toBe(
      'false',
    )
  })

  it('tells two versions apart when they open on the same line', async () => {
    // Most corrections leave the first line alone. Matching on it lit
    // Original whichever of the two was on screen.
    const original = lines('same opening', 'a original two')
    const edited = lines('same opening', 'a edited two')
    sessionLyricChoices.mockResolvedValue([
      choice('imported', 'Original', original),
      choice('edited', 'Edited', edited),
    ])
    setSong(roomSong('session:a', edited))
    const { findByRole } = render(() => <JamLyricVersionPicker />)

    expect(pressed(await findByRole('button', { name: 'Edited' }))).toBe('true')
    expect(pressed(await findByRole('button', { name: 'Original' }))).toBe(
      'false',
    )
  })

  it('tells a word-level correction apart without being told which was pressed', async () => {
    // Same lines, same line times -- only the words inside moved. The lines
    // carry their words now, so the one on screen can be recognised cold.
    const original = lines('one two', 'three four')
    const edited = original.map((line, i) => ({
      ...line,
      words: line.text.split(' '),
      wordStartsSec: [line.startSec, line.startSec + 0.4 + i],
    }))
    sessionLyricChoices.mockResolvedValue([
      choice('imported', 'Original', original),
      choice('edited', 'Edited', edited),
    ])
    setSong(roomSong('session:a', edited))
    const { findByRole } = render(() => <JamLyricVersionPicker />)

    expect(pressed(await findByRole('button', { name: 'Edited' }))).toBe('true')
    expect(pressed(await findByRole('button', { name: 'Original' }))).toBe(
      'false',
    )
  })

  it('follows the press when two versions read the same', async () => {
    // Two versions that differ only in where a word ENDS, say.
    const same = lines('one', 'two')
    sessionLyricChoices.mockResolvedValue([
      choice('imported', 'Original', same),
      choice('edited', 'Edited', same),
    ])
    attach.mockImplementation((_id, of) => setSong(roomSong('session:a', of)))
    setSong(roomSong('session:a', same))
    const { findByRole } = render(() => <JamLyricVersionPicker />)

    const edited = await findByRole('button', { name: 'Edited' })
    fireEvent.click(edited)

    await waitFor(() => expect(pressed(edited)).toBe('true'))
    expect(pressed(await findByRole('button', { name: 'Original' }))).toBe(
      'false',
    )
  })

  it('is neither when the words came from somewhere else', async () => {
    sessionLyricChoices.mockResolvedValue(A_CHOICES)
    setSong(roomSong('session:a', lines('pasted in the room')))
    const { findByRole } = render(() => <JamLyricVersionPicker />)

    expect(pressed(await findByRole('button', { name: 'Edited' }))).toBe(
      'false',
    )
    expect(pressed(await findByRole('button', { name: 'Original' }))).toBe(
      'false',
    )
  })
})
