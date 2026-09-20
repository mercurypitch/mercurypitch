// ============================================================
// The song's timeline, outside the stage that plays it
// ============================================================
//
// The timeline moved out of JamSongStage onto the row of playback controls
// (owner request, 2026-09-20). It used to read the audio element directly
// for the file's real length and call the stage's own seek. Outside the
// stage it can do neither, so these pin the two seams it uses instead.

import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JamSong } from '@/lib/jam/jam-song'
import type { LyricsLineTiming } from '@/lib/jam/types'

const room = vi.hoisted(() => ({
  host: true,
  getSong: null as unknown as () => JamSong | null,
  getPosition: null as unknown as () => number,
  getMediaDuration: null as unknown as () => number | null,
  seek: null as unknown as (to: number) => void,
}))

vi.mock('@/stores/jam-store', () => ({
  jamIsHost: () => room.host,
  jamSong: () => room.getSong(),
  jamSongPositionSec: () => room.getPosition(),
  jamSongMediaDurationSec: () => room.getMediaDuration(),
  jamSongRunScore: () => null,
  jamSongSeek: (to: number) => room.seek(to),
}))

const layout = vi.hoisted(() => ({ phone: false }))
vi.mock('@/lib/jam/jam-phone-layout', () => ({
  jamPhoneLayout: () => layout.phone,
}))

vi.mock('@/components/jam/JamLyricVersionPicker', () => ({
  JamLyricVersionPicker: () => <div data-testid="version-picker" />,
}))

const { JamSongTimeline } = await import('@/components/jam/JamSongTimeline')

const [song, setSong] = createSignal<JamSong | null>(null)
const [position, setPosition] = createSignal(0)
const [mediaDuration, setMediaDuration] = createSignal<number | null>(null)
room.getSong = song
room.getPosition = position
room.getMediaDuration = mediaDuration

const LINES: LyricsLineTiming[] = [
  { text: 'one', startSec: 10, endSec: 14 },
  { text: 'two', startSec: 20, endSec: 24 },
]

const roomSong = (of: LyricsLineTiming[] = LINES): JamSong => ({
  id: 'a',
  title: 'A song',
  stems: { instrumental: 'blob:instrumental' },
  lines: of,
  notes: [],
  durationSec: 180,
  origin: 'local',
})

afterEach(() => {
  cleanup()
  setSong(null)
  setPosition(0)
  setMediaDuration(null)
  room.host = true
  layout.phone = false
})

const slider = (root: HTMLElement): HTMLElement => {
  const el = root.querySelector<HTMLElement>('[role="slider"]')
  if (el === null) throw new Error('no timeline slider')
  return el
}

describe('the jam song timeline', () => {
  it('is not there without a song', () => {
    const { queryByTestId } = render(() => <JamSongTimeline />)
    expect(queryByTestId('jam-song-timeline')).toBeNull()
  })

  it("runs to the song's stated length until the file says otherwise", () => {
    setSong(roomSong())
    const { container } = render(() => <JamSongTimeline />)
    expect(slider(container).getAttribute('aria-valuemax')).toBe('180')
  })

  it('runs to the length the FILE reports once it has', () => {
    // A stated length is what the catalogue says. The element knows what was
    // actually decoded, and a timeline drawn to the wrong one puts the
    // playhead in the wrong place for the whole song.
    setSong(roomSong())
    const { container } = render(() => <JamSongTimeline />)
    setMediaDuration(171.4)
    expect(slider(container).getAttribute('aria-valuemax')).toBe('171')
  })

  it('lets the host move the song and nobody else', () => {
    setSong(roomSong())
    const hosted = render(() => <JamSongTimeline />)
    expect(slider(hosted.container).getAttribute('aria-disabled')).not.toBe(
      'true',
    )
    hosted.unmount()

    room.host = false
    const guest = render(() => <JamSongTimeline />)
    expect(slider(guest.container).getAttribute('aria-disabled')).toBe('true')
  })

  it('says where in the words the song is', () => {
    setSong(roomSong())
    const { getByLabelText } = render(() => <JamSongTimeline />)
    const where = getByLabelText('Lyric position')
    expect(where.textContent).toBe('Intro · 2 lines')
    setPosition(11)
    expect(where.textContent).toBe('Line 1 / 2')
    setPosition(16)
    expect(where.textContent).toBe('Break · next 2 / 2')
    setPosition(30)
    expect(where.textContent).toBe('Outro · 2 lines')
  })

  it('leaves the choice of words to the bar above them, except on a phone', () => {
    // Beside the buttons the timeline gets what they leave -- 410px on a
    // tablet with the sidebar open -- and the Original / Edited buttons in
    // it left a timeline too short to drag. A phone's bar is two lines with
    // a half-empty first one, so there it stays.
    setSong(roomSong())
    const desk = render(() => <JamSongTimeline />)
    expect(desk.queryByTestId('version-picker')).toBeNull()
    desk.unmount()

    layout.phone = true
    const phone = render(() => <JamSongTimeline />)
    expect(phone.queryByTestId('version-picker')).not.toBeNull()
  })

  it('says nothing about lines for a song that has none', () => {
    setSong(roomSong([]))
    const { queryByLabelText } = render(() => <JamSongTimeline />)
    expect(queryByLabelText('Lyric position')).toBeNull()
  })
})
