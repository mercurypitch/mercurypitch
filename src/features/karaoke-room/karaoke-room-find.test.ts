// ============================================================
// The room's Find by singing: its sheet, and what a find does
// ============================================================
//
// createRoomFind on its own, with the room's parts as plain functions: the
// stage cleared before the sheet opens, a song found played where the
// singer has got to once the sheet has gone, a song gone from the room
// since played not at all and said, and Back told whether there was a
// sheet to close. The sheet over a stand-in engine is
// KaraokeFindSheet.test.tsx's; the room around it, KaraokeRoomStage's.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notifications, resetNotifications } from '@/stores/notifications-store'
import { createRoomFind } from './karaoke-room-find'
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

beforeEach(() => {
  resetNotifications()
})

describe('Find by singing in the room', () => {
  it('clears the stage before the sheet opens', () => {
    const seen: boolean[] = []
    const find = createRoomFind({
      songs: () => [ALPHA, BRAVO],
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
