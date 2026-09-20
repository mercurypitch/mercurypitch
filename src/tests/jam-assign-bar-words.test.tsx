// ============================================================
// The choice of words lives in the host's bar above them
// ============================================================
//
// It was in the song's own bar. That bar moved onto the playback row
// (owner request, 2026-09-20) and has to be short to fit beside the
// buttons on a tablet, so Original / Edited moved to the other host-only
// bar in the room -- the one that already edits the sheet under it. A
// phone keeps it on the timeline, which is the only place there with room.
//
// One home at a time, never two with one hidden: that would be two
// fetches, and two sets of buttons for anything finding one by name.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

const room = vi.hoisted(() => ({ host: true, lines: 2, phone: false }))

vi.mock('@/stores/jam-store', () => ({
  jamAssignBrush: () => null,
  jamIsHost: () => room.host,
  jamPeerId: () => 'me',
  jamPeers: () => [{ id: 'ada', displayName: 'Ada' }],
  jamSong: () => ({
    id: 'a',
    lines: Array.from({ length: room.lines }, (_, i) => ({
      text: `line ${i}`,
      startSec: i,
    })),
  }),
  setJamAssignBrush: () => {},
  toggleJamAssignBrush: () => {},
}))

vi.mock('@/lib/jam/jam-phone-layout', () => ({
  jamPhoneLayout: () => room.phone,
}))

vi.mock('@/components/jam/JamLyricVersionPicker', () => ({
  JamLyricVersionPicker: () => <div data-testid="version-picker" />,
}))

const { JamAssignBar } = await import('@/components/jam/JamAssignBar')

afterEach(() => {
  cleanup()
  room.host = true
  room.lines = 2
  room.phone = false
})

describe('the choice of words in the host bar', () => {
  it('sits with the parts, above the words it changes', () => {
    const { getByTestId, getByText } = render(() => <JamAssignBar />)
    const picker = getByTestId('version-picker')
    expect(picker.parentElement?.parentElement).toBe(
      getByText('Parts').parentElement,
    )
  })

  it('is not here on a phone, where the timeline has it', () => {
    room.phone = true
    const { queryByTestId, getByText } = render(() => <JamAssignBar />)
    expect(getByText('Parts')).toBeTruthy()
    expect(queryByTestId('version-picker')).toBeNull()
  })

  it('is nobody else’s: a guest has neither', () => {
    room.host = false
    const { queryByTestId, queryByText } = render(() => <JamAssignBar />)
    expect(queryByText('Parts')).toBeNull()
    expect(queryByTestId('version-picker')).toBeNull()
  })
})
