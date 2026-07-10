// ============================================================
// Karaoke Playlist — export → import round-trip
// ============================================================
//
// Covers IMPORT-1/2/3 in docs/specs/karaoke-playlist.ears.md: a playlist is
// exported to a real ZIP blob and re-imported; sessions, group membership,
// singers, order, shuffle and play-mode must all be recreated with new ids.
// Audio/lyrics blobs are intentionally absent (the in-memory DB returns null),
// so this exercises the metadata round-trip without real stems.

import { describe, expect, it, vi } from 'vitest'
import { InMemoryAdapter } from './utils/in-memory-db'

const adapter = new InMemoryAdapter()
vi.mock('@/db', () => ({ getDb: async () => adapter }))

// jsdom's Blob has no arrayBuffer(); the import path reads the zip via it.
if (typeof Blob.prototype.arrayBuffer !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Blob.prototype as any).arrayBuffer = function (this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(this)
    })
  }
}

import { buildKaraokePlaylistZip, importSessionsFromZip, isZipFile, } from '@/db/services/session-export-service'
import type { UvrSession } from '@/stores/app-store'
import { addSessionToGroup, createGroup, getAllUvrSessions, getGroupsReactive, importUvrSession, } from '@/stores/app-store'
import { addItem, createPlaylist, getPlaylistsReactive, setPlaylistPlayMode, setPlaylistShuffleOrder, } from '@/stores/karaoke-playlist-store'

function makeSession(sessionId: string, name: string): UvrSession {
  return {
    sessionId,
    originalFile: { name, size: 1234, mimeType: 'audio/mpeg' },
    mode: 'local',
    status: 'completed',
    progress: 100,
    createdAt: Date.now(),
  } as unknown as UvrSession
}

describe('karaoke playlist export → import round-trip', () => {
  it('IMPORT-1/2/3: recreates sessions, groups, singers, order and play-mode with remapped ids', async () => {
    // Three sessions: s1 + s2 in a group, s3 standalone.
    importUvrSession(makeSession('s1', 'Song One'))
    importUvrSession(makeSession('s2', 'Song Two'))
    importUvrSession(makeSession('s3', 'Solo Track'))

    const group = await createGroup('The Band')
    await addSessionToGroup('s1', group.id)
    await addSessionToGroup('s2', group.id)

    const pl = await createPlaylist('Party Set')
    await addItem(pl.id, {
      kind: 'group',
      refId: group.id,
      singerName: 'Ann',
      shuffleWithinGroup: true,
    })
    await addItem(pl.id, { kind: 'session', refId: 's3', singerName: 'Bob' })
    await setPlaylistPlayMode(pl.id, 'roundRobin')
    await setPlaylistShuffleOrder(pl.id, true)

    // Snapshot ids to locate the freshly-imported entities afterwards.
    const beforePlaylistIds = new Set(getPlaylistsReactive().map((p) => p.id))
    const beforeGroupIds = new Set(getGroupsReactive().map((g) => g.id))
    const beforeSessionIds = new Set(
      getAllUvrSessions().map((s) => s.sessionId),
    )

    // Export → import.
    const blob = await buildKaraokePlaylistZip([pl.id])
    expect(blob).not.toBeNull()
    const count = await importSessionsFromZip(blob!)
    expect(count).toBe(3) // s1, s2 (via group) + s3 (standalone)

    // IMPORT-1: new sessions with the original titles.
    const newSessions = getAllUvrSessions().filter(
      (s) => !beforeSessionIds.has(s.sessionId),
    )
    expect(newSessions).toHaveLength(3)
    expect(new Set(newSessions.map((s) => s.originalFile?.name))).toEqual(
      new Set(['Song One', 'Song Two', 'Solo Track']),
    )

    // IMPORT-2: group recreated with the two remapped sessions.
    const newGroup = getGroupsReactive().find((g) => !beforeGroupIds.has(g.id))
    expect(newGroup).toBeDefined()
    expect(newGroup!.name).toBe('The Band')
    expect(newGroup!.sessionIds).toHaveLength(2)
    const groupSongNames = newGroup!.sessionIds.map(
      (sid) => newSessions.find((s) => s.sessionId === sid)?.originalFile?.name,
    )
    expect(new Set(groupSongNames)).toEqual(new Set(['Song One', 'Song Two']))

    // IMPORT-3: playlist recreated with order, singers, shuffle and play-mode.
    const newPl = getPlaylistsReactive().find(
      (p) => !beforePlaylistIds.has(p.id),
    )
    expect(newPl).toBeDefined()
    expect(newPl!.name).toBe('Party Set')
    expect(newPl!.playMode).toBe('roundRobin')
    expect(newPl!.shuffleOrder).toBe(true)
    expect(newPl!.items).toHaveLength(2)

    const groupItem = newPl!.items.find((it) => it.kind === 'group')
    expect(groupItem?.refId).toBe(newGroup!.id) // remapped to the new group
    expect(groupItem?.singerName).toBe('Ann')
    expect(groupItem?.shuffleWithinGroup).toBe(true)

    const sessionItem = newPl!.items.find((it) => it.kind === 'session')
    expect(sessionItem?.singerName).toBe('Bob')
    const soloSong = newSessions.find((s) => s.sessionId === sessionItem?.refId)
    expect(soloSong?.originalFile?.name).toBe('Solo Track')
  })
})

describe('isZipFile', () => {
  const make = (name: string, type: string) => new File([''], name, { type })

  it('detects ZIPs by extension regardless of MIME', () => {
    expect(isZipFile(make('MercuryPitch_Session_song.zip', ''))).toBe(true)
    expect(isZipFile(make('EXPORT.ZIP', 'application/octet-stream'))).toBe(true)
  })

  it('detects ZIPs by MIME variants when the extension is missing', () => {
    expect(isZipFile(make('archive', 'application/zip'))).toBe(true)
    expect(isZipFile(make('archive', 'application/x-zip-compressed'))).toBe(
      true,
    )
  })

  it('rejects audio and other files', () => {
    expect(isZipFile(make('song.mp3', 'audio/mpeg'))).toBe(false)
    expect(isZipFile(make('song.wav', 'audio/wav'))).toBe(false)
    expect(isZipFile(make('zip-tips.txt', 'text/plain'))).toBe(false)
  })
})
