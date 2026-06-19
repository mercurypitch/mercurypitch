// ============================================================
// Karaoke Playlist Store — CRUD + playback transport
// ============================================================
//
// Covers the EARS requirements in docs/specs/karaoke-playlist.ears.md
// (CRUD-* and XPORT-*) against an in-memory database.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryAdapter } from './utils/in-memory-db'

const adapter = new InMemoryAdapter()
vi.mock('@/db', () => ({ getDb: async () => adapter }))

import type { KaraokeSongScore } from '@/stores/karaoke-playlist-store'
import { addItem, advance, beginCountdown, beginCurrentSong, createPlaylist, createPlaylistWithItems, currentIndex, currentSong, deletePlaylist, getPlaylist, getPlaylistsReactive, isPlaylistActive, nextSong, perSongScores, phase, prev, queue, removeItem, renamePlaylist, reorderItems, reportSongScore, restartPlaylist, setItemShuffleWithinGroup, setItemSinger, setPlaylistPlayMode, setPlaylistShuffleOrder, startPlaylist, stopPlaylist, } from '@/stores/karaoke-playlist-store'

const SCORE: KaraokeSongScore = {
  totalNotes: 10,
  matchedNotes: 8,
  accuracyPct: 80,
  avgCentsOff: 12,
  grade: 'B',
}

// Reset module-level transport + persisted playlists between tests.
beforeEach(async () => {
  stopPlaylist()
  for (const pl of getPlaylistsReactive().slice()) {
    await deletePlaylist(pl.id)
  }
})

/** Create a playlist of standalone sessions and start it. */
async function startedPlaylist(sessionIds: string[]) {
  const pl = await createPlaylist('Test')
  for (const sid of sessionIds) {
    await addItem(pl.id, { kind: 'session', refId: sid })
  }
  startPlaylist(pl.id)
  return pl
}

describe('playlist CRUD', () => {
  it('CRUD-1: creates a playlist with an empty item list', async () => {
    const pl = await createPlaylist('My set')
    expect(pl.name).toBe('My set')
    expect(pl.items).toEqual([])
    expect(getPlaylist(pl.id)).toBeDefined()
  })

  it('CRUD-2: renames a playlist', async () => {
    const pl = await createPlaylist('Old')
    await renamePlaylist(pl.id, 'New')
    expect(getPlaylist(pl.id)?.name).toBe('New')
  })

  it('CRUD-3: deletes a playlist', async () => {
    const pl = await createPlaylist('X')
    await deletePlaylist(pl.id)
    expect(getPlaylist(pl.id)).toBeUndefined()
  })

  it('CRUD-4: appends items with unique ids', async () => {
    const pl = await createPlaylist('X')
    await addItem(pl.id, { kind: 'session', refId: 's1' })
    await addItem(pl.id, { kind: 'group', refId: 'g1' })
    const items = getPlaylist(pl.id)!.items
    expect(items).toHaveLength(2)
    expect(items[0].id).toBeTruthy()
    expect(items[0].id).not.toBe(items[1].id)
    expect(items[1].kind).toBe('group')
  })

  it('CRUD-5: removes only the targeted item', async () => {
    const pl = await createPlaylist('X')
    await addItem(pl.id, { kind: 'session', refId: 's1' })
    await addItem(pl.id, { kind: 'session', refId: 's2' })
    const first = getPlaylist(pl.id)!.items[0]
    await removeItem(pl.id, first.id)
    const items = getPlaylist(pl.id)!.items
    expect(items).toHaveLength(1)
    expect(items[0].refId).toBe('s2')
  })

  it('CRUD-6: reorders an item to the target index', async () => {
    const pl = await createPlaylist('X')
    for (const sid of ['s1', 's2', 's3']) {
      await addItem(pl.id, { kind: 'session', refId: sid })
    }
    await reorderItems(pl.id, 0, 2)
    expect(getPlaylist(pl.id)!.items.map((it) => it.refId)).toEqual([
      's2',
      's3',
      's1',
    ])
  })

  it('CRUD-7: leaves order unchanged on an out-of-range reorder', async () => {
    const pl = await createPlaylist('X')
    for (const sid of ['s1', 's2', 's3']) {
      await addItem(pl.id, { kind: 'session', refId: sid })
    }
    await reorderItems(pl.id, 0, 5)
    expect(getPlaylist(pl.id)!.items.map((it) => it.refId)).toEqual([
      's1',
      's2',
      's3',
    ])
  })

  it('CRUD-8: trims a singer name and clears it when blank', async () => {
    const pl = await createPlaylist('X')
    await addItem(pl.id, { kind: 'session', refId: 's1' })
    const itemId = getPlaylist(pl.id)!.items[0].id
    await setItemSinger(pl.id, itemId, '  Bob  ')
    expect(getPlaylist(pl.id)!.items[0].singerName).toBe('Bob')
    await setItemSinger(pl.id, itemId, '   ')
    expect(getPlaylist(pl.id)!.items[0].singerName).toBeUndefined()
  })

  it('CRUD-9: persists shuffle-within-group on a group item', async () => {
    const pl = await createPlaylist('X')
    await addItem(pl.id, { kind: 'group', refId: 'g1' })
    const itemId = getPlaylist(pl.id)!.items[0].id
    await setItemShuffleWithinGroup(pl.id, itemId, true)
    expect(getPlaylist(pl.id)!.items[0].shuffleWithinGroup).toBe(true)
  })

  it('CRUD-10: persists the shuffle-order flag', async () => {
    const pl = await createPlaylist('X')
    await setPlaylistShuffleOrder(pl.id, true)
    expect(getPlaylist(pl.id)?.shuffleOrder).toBe(true)
  })

  it('CRUD-11: persists the play-mode', async () => {
    const pl = await createPlaylist('X')
    await setPlaylistPlayMode(pl.id, 'roundRobin')
    expect(getPlaylist(pl.id)?.playMode).toBe('roundRobin')
  })

  it('CRUD-12: creates a playlist from a full item set, retaining metadata', async () => {
    const pl = await createPlaylistWithItems(
      'Imported',
      [
        {
          kind: 'group',
          refId: 'g1',
          singerName: 'Ann',
          shuffleWithinGroup: true,
        },
        { kind: 'session', refId: 's1' },
      ],
      { shuffleOrder: true, playMode: 'roundRobin' },
    )
    expect(pl.items).toHaveLength(2)
    expect(pl.items[0].id).toBeTruthy()
    expect(pl.items[0].singerName).toBe('Ann')
    expect(pl.items[0].shuffleWithinGroup).toBe(true)
    expect(pl.shuffleOrder).toBe(true)
    expect(pl.playMode).toBe('roundRobin')
  })
})

describe('playback transport', () => {
  it('XPORT-1: starting builds the queue at index 0 in the ready state', async () => {
    await startedPlaylist(['s1', 's2', 's3'])
    expect(queue()).toHaveLength(3)
    expect(currentIndex()).toBe(0)
    expect(phase()).toBe('ready')
  })

  it('XPORT-2: a playlist with no playable songs stays idle', async () => {
    const pl = await createPlaylist('Empty')
    startPlaylist(pl.id)
    expect(phase()).toBe('idle')
    expect(isPlaylistActive()).toBe(false)
  })

  it('XPORT-3/4: countdown then play transitions', async () => {
    await startedPlaylist(['s1'])
    beginCountdown()
    expect(phase()).toBe('countdown')
    beginCurrentSong()
    expect(phase()).toBe('playing')
  })

  it('XPORT-5: advancing before the last song moves to the next, ready', async () => {
    await startedPlaylist(['s1', 's2', 's3'])
    advance()
    expect(currentIndex()).toBe(1)
    expect(phase()).toBe('ready')
  })

  it('XPORT-6: advancing on the last song enters the summary', async () => {
    await startedPlaylist(['s1'])
    advance()
    expect(phase()).toBe('summary')
  })

  it('XPORT-7: previous moves back one and re-arms ready', async () => {
    await startedPlaylist(['s1', 's2', 's3'])
    advance()
    prev()
    expect(currentIndex()).toBe(0)
    expect(phase()).toBe('ready')
  })

  it('XPORT-8: previous on the first song stays put', async () => {
    await startedPlaylist(['s1', 's2'])
    prev()
    expect(currentIndex()).toBe(0)
  })

  it('XPORT-9: a non-null score is recorded at the current index', async () => {
    await startedPlaylist(['s1', 's2'])
    reportSongScore(SCORE)
    expect(perSongScores()[0]).toEqual(SCORE)
    expect(phase()).toBe('scoring')
  })

  it('XPORT-10: a null score leaves the slot empty but still enters scoring', async () => {
    await startedPlaylist(['s1', 's2'])
    reportSongScore(null)
    expect(perSongScores()[0]).toBeNull()
    expect(phase()).toBe('scoring')
  })

  it('XPORT-11: restarting resets index, scores and state', async () => {
    await startedPlaylist(['s1', 's2', 's3'])
    reportSongScore(SCORE)
    advance()
    restartPlaylist()
    expect(currentIndex()).toBe(0)
    expect(phase()).toBe('ready')
    expect(perSongScores()).toHaveLength(3)
    expect(perSongScores().every((s) => s === null)).toBe(true)
  })

  it('XPORT-12: stopping clears the queue and returns to idle', async () => {
    await startedPlaylist(['s1', 's2'])
    stopPlaylist()
    expect(queue()).toEqual([])
    expect(phase()).toBe('idle')
    expect(isPlaylistActive()).toBe(false)
  })

  it('XPORT-13: active whenever not idle', async () => {
    expect(isPlaylistActive()).toBe(false)
    await startedPlaylist(['s1'])
    expect(isPlaylistActive()).toBe(true)
  })

  it('XPORT-14: exposes the current and next song', async () => {
    await startedPlaylist(['s1', 's2', 's3'])
    expect(currentSong()?.sessionId).toBe('s1')
    expect(nextSong()?.sessionId).toBe('s2')
    advance()
    expect(currentSong()?.sessionId).toBe('s2')
    expect(nextSong()?.sessionId).toBe('s3')
    advance()
    expect(nextSong()).toBeNull()
  })

  it('XPORT-15: deleting the active playlist stops playback', async () => {
    const pl = await startedPlaylist(['s1', 's2'])
    await deletePlaylist(pl.id)
    expect(phase()).toBe('idle')
    expect(isPlaylistActive()).toBe(false)
  })
})
