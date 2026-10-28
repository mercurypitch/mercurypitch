// ============================================================
// FirstNoteScreen: the ways out to the Karaoke room are the shell's
// ============================================================
//
// First note offers two ways to the Karaoke room (owner, 28 Oct 2026): sing
// a song on from where the singer came in, and, for a singer with no song
// of their own split yet, the room's songs, where Import is. Only the shell
// can change the tab, so the screen hands both to the room. The room is
// stood in for; what it does with them is its own suite's business.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FirstNoteRoomProps } from '@/features/first-note/FirstNoteRoom'
import { karaokeLibraryRequest, karaokeStagedSong, resetKaraokeRoomForTests, takeKaraokeSongRequest, } from '@/features/karaoke-room/karaoke-room-store'
import { resetLastExerciseForTests } from '@/features/premium-exercises/last-exercise'
import { TAB_KARAOKE } from '@/features/tabs/constants'
import { FirstNoteScreen } from './FirstNoteScreen'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'

const room = vi.hoisted(() => ({ props: null as FirstNoteRoomProps | null }))

vi.mock('@/features/first-note/FirstNoteRoom', () => ({
  FirstNoteRoom: (props: FirstNoteRoomProps) => {
    // eslint-disable-next-line solid/reactivity -- kept to call its handlers, not to read them reactively
    room.props = props
    const el = document.createElement('div')
    el.dataset.testid = 'first-note-room'
    return el
  },
}))

const navigation = vi.hoisted(() => ({ goToTab: vi.fn() }))
vi.mock('./shell-navigation', () => navigation)

let view: RenderedShell | undefined

beforeEach(() => {
  localStorage.clear()
  resetLastExerciseForTests()
  resetKaraokeRoomForTests()
  navigation.goToTab.mockClear()
  room.props = null
})

afterEach(() => {
  view?.unmount()
  view = undefined
})

describe('FirstNoteScreen', () => {
  it('records First note as the last exercise the moment it opens', () => {
    view = renderShell(() => <FirstNoteScreen />)
    expect(localStorage.getItem('mp_last_exercise')).toBe('first-note-stage')
  })

  it('sings a song on in the Karaoke room, from where the singer came in', () => {
    view = renderShell(() => <FirstNoteScreen />)

    room.props?.onSingOn?.('karaoke-night-demo:josephine', 9.4)

    expect(takeKaraokeSongRequest()).toEqual({
      sessionId: 'karaoke-night-demo:josephine',
      seekSec: 9.4,
    })
    expect(karaokeStagedSong()).toBe('karaoke-night-demo:josephine')
    expect(navigation.goToTab).toHaveBeenCalledWith(TAB_KARAOKE)
  })

  it("opens the Karaoke room's songs for a singer with none of their own", () => {
    view = renderShell(() => <FirstNoteScreen />)

    room.props?.onOwnSongs?.()

    expect(karaokeLibraryRequest()).toBe(true)
    expect(navigation.goToTab).toHaveBeenCalledWith(TAB_KARAOKE)
  })
})
