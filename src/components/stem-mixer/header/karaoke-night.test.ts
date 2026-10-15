// When Open in Karaoke Night waits, and the words it waits with.

import { describe, expect, it } from 'vitest'
import { karaokeNightReason, KN_PLAYLIST_RUNNING, KN_SEPARATING, KN_TAKE_SAVING, } from './karaoke-night'

const idle = { playlistRunning: false, separating: false, takeSaving: false }

describe('karaokeNightReason', () => {
  it('lets the singer go when nothing would be lost or changed', () => {
    expect(karaokeNightReason(idle)).toBeNull()
  })

  it.each([
    ['a playlist runs', { playlistRunning: true }, KN_PLAYLIST_RUNNING],
    ['a song separates', { separating: true }, KN_SEPARATING],
    ['a take is being kept', { takeSaving: true }, KN_TAKE_SAVING],
  ])('waits while %s', (_label, state, reason) => {
    expect(karaokeNightReason({ ...idle, ...state })).toBe(reason)
  })

  it('names the work that would be lost before the playlist', () => {
    expect(
      karaokeNightReason({
        playlistRunning: true,
        separating: true,
        takeSaving: false,
      }),
    ).toBe(KN_SEPARATING)
    expect(
      karaokeNightReason({
        playlistRunning: true,
        separating: true,
        takeSaving: true,
      }),
    ).toBe(KN_TAKE_SAVING)
  })

  it('speaks plainly: no dashes standing in for full stops', () => {
    for (const reason of [KN_PLAYLIST_RUNNING, KN_SEPARATING, KN_TAKE_SAVING])
      expect(reason).not.toMatch(/[—–]/)
  })
})
