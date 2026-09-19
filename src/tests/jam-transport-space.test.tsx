// ============================================================
// Space is play/pause in a jam room, whatever is loaded
// ============================================================
//
// Owner report (2026-09-19): Space started and paused a karaoke song and
// did nothing at all for a melody. The listener lived in the song stage,
// so the key worked or not depending on which engine was loaded. It now
// belongs to the room's one transport bar, through the app's shared rule.

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JamTransport } from '@/components/jam/JamTransport'

const room = vi.hoisted(() => ({
  host: true,
  song: false,
  melody: { name: 'C Major Scale' } as { name: string } | null,
  playing: false,
  paused: false,
  positionSec: 42.5,
}))
const calls = vi.hoisted(() => ({
  play: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
  songPlay: vi.fn(),
  songPause: vi.fn(),
  songStop: vi.fn(),
}))

vi.mock('@/stores/jam-store', () => ({
  clearJamExercise: vi.fn(),
  jamExerciseMelody: () => room.melody,
  jamExercisePaused: () => room.paused,
  jamExercisePlaying: () => room.playing,
  jamIsHost: () => room.host,
  jamIsSongRoom: () => room.song,
  jamPlaybackPause: calls.pause,
  jamPlaybackPlay: calls.play,
  jamPlaybackResume: calls.resume,
  jamPlaybackStop: calls.stop,
  jamSongPause: calls.songPause,
  jamSongPlay: calls.songPlay,
  jamSongPositionSec: () => room.positionSec,
  jamSongStop: calls.songStop,
}))

beforeEach(() => {
  room.host = true
  room.song = false
  room.melody = { name: 'C Major Scale' }
  room.playing = false
  room.paused = false
  for (const spy of Object.values(calls)) spy.mockClear()
})

const mount = () => render(() => <JamTransport onSelectExercise={() => {}} />)

/** Press Space on `target`; says whether the press was taken. */
function pressSpace(target: Element | Window = document.body): boolean {
  return !fireEvent.keyDown(target, { code: 'Space', key: ' ' })
}

describe('Space with a melody or a drill loaded', () => {
  it('starts it', () => {
    mount()
    expect(pressSpace()).toBe(true)
    expect(calls.play).toHaveBeenCalledTimes(1)
  })

  it('pauses it while it runs', () => {
    room.playing = true
    mount()
    pressSpace()
    expect(calls.pause).toHaveBeenCalledTimes(1)
    expect(calls.play).not.toHaveBeenCalled()
  })

  it('resumes a paused one rather than starting over', () => {
    room.playing = true
    room.paused = true
    mount()
    pressSpace()
    expect(calls.resume).toHaveBeenCalledTimes(1)
    expect(calls.play).not.toHaveBeenCalled()
  })
})

describe('Space with a song loaded', () => {
  beforeEach(() => {
    room.song = true
    room.melody = null
  })

  it('plays from where the song is', () => {
    mount()
    pressSpace()
    expect(calls.songPlay).toHaveBeenCalledWith(42.5)
    expect(calls.play).not.toHaveBeenCalled()
  })

  it('pauses where the song is', () => {
    room.playing = true
    mount()
    pressSpace()
    expect(calls.songPause).toHaveBeenCalledWith(42.5)
  })
})

describe('who the key belongs to', () => {
  it('is not stolen by a focused button', () => {
    room.playing = true
    mount()
    // The usual way to get here: click Stop's neighbour with a mouse, and
    // focus stays on a button. Space must still be the transport's, and
    // must not ALSO press the button.
    const stop = screen.getByRole('button', {
      name: 'Stop and go back to the top',
    })
    stop.focus()
    expect(pressSpace(stop)).toBe(true)
    expect(calls.pause).toHaveBeenCalledTimes(1)
    expect(calls.stop).not.toHaveBeenCalled()
  })

  it('stays a space in the chat box', () => {
    mount()
    const chat = document.createElement('input')
    document.body.append(chat)
    expect(pressSpace(chat)).toBe(false)
    expect(calls.play).not.toHaveBeenCalled()
    chat.remove()
  })

  it('stays with a dialog that has the focus', () => {
    mount()
    const sheet = document.createElement('div')
    sheet.setAttribute('role', 'dialog')
    const row = document.createElement('button')
    sheet.append(row)
    document.body.append(sheet)
    row.focus()
    // The phone's song sheet: Space on a row picks the row.
    expect(pressSpace(row)).toBe(false)
    expect(calls.play).not.toHaveBeenCalled()
    sheet.remove()
  })

  it("is not a guest's: the transport is the host's", () => {
    room.host = false
    mount()
    expect(pressSpace()).toBe(false)
    expect(calls.play).not.toHaveBeenCalled()
  })

  it('does nothing in a room with nothing loaded', () => {
    room.melody = null
    mount()
    expect(pressSpace()).toBe(false)
    expect(calls.play).not.toHaveBeenCalled()
  })

  it('ignores a held key and a modifier chord', () => {
    mount()
    fireEvent.keyDown(document.body, { code: 'Space', key: ' ', repeat: true })
    fireEvent.keyDown(document.body, { code: 'Space', key: ' ', ctrlKey: true })
    expect(calls.play).not.toHaveBeenCalled()
  })

  it('lets go of the key when the room is left', () => {
    const view = mount()
    view.unmount()
    expect(pressSpace()).toBe(false)
    expect(calls.play).not.toHaveBeenCalled()
  })

  it('says so on the buttons', () => {
    mount()
    expect(
      screen
        .getByRole('button', { name: 'Start playback for everyone here' })
        .getAttribute('aria-keyshortcuts'),
    ).toBe('Space')
  })
})
