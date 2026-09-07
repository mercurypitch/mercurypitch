// Guitar backing mix tests cover local song identity, hostile storage and bounded history.
// ============================================================

import { describe, expect, it } from 'vitest'
import { GUITAR_BACKING_MIX_MAX_SESSIONS, GUITAR_BACKING_MIX_STORAGE_KEY, readGuitarBackingMix, writeGuitarBackingMix, } from './guitar-backing-mix-storage'
import { createGuitarBackingTransport } from './guitar-backing-transport'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

describe('song-local backing mixes', () => {
  it('restores by stable session/track IDs without labels or Solo and drops missing stems', () => {
    const storage = memoryStorage()
    const transport = createGuitarBackingTransport({
      mixStorage: storage,
      contextFactory: () => {
        throw new Error('No audio during mix setup')
      },
    })
    const tracks = [
      {
        id: 'drums',
        label: 'Private song drums',
        url: 'blob:secret',
        sizeBytes: 64,
      },
      {
        id: 'guitar',
        label: 'Private song guitar',
        url: 'blob:secret',
        sizeBytes: 64,
        level: 0.1,
      },
    ]
    const song = { sessionId: 'session-a', title: 'Private title', tracks }
    transport.configure(song)
    transport.setTrackLevelDb('drums', 4)
    transport.setTrackMuted('guitar', true)
    transport.toggleTrackSolo('drums')
    transport.configure({ ...song, sessionId: 'session-b' })
    expect(transport.getTrackStates().map((track) => track.muted)).toEqual([
      false,
      false,
    ])
    expect(transport.getTrackStates()[0].levelDb).toBe(0)
    transport.configure({
      ...song,
      tracks: [...tracks]
        .reverse()
        .map((track) => ({ ...track, label: 'Renamed' })),
    })
    expect(transport.getSoloedTrackId()).toBeNull()
    expect(transport.getTrackStates()[0]).toMatchObject({
      id: 'guitar',
      muted: true,
      level: 0.1,
      levelDb: -40,
    })
    expect(transport.getTrackStates()[1]).toMatchObject({
      id: 'drums',
      levelDb: 4,
    })
    const raw = storage.getItem(GUITAR_BACKING_MIX_STORAGE_KEY)!
    expect(raw).not.toContain('Private')
    expect(raw).not.toContain('blob:')
    expect(raw).not.toContain('solo')
    transport.configure({
      ...song,
      tracks: [tracks[1], { ...tracks[0], id: 'new-drums' }],
    })
    expect(transport.getTrackStates()[1].levelDb).toBe(0)
  })

  it('retains silence through JSON and other songs writes, then resets only levels', () => {
    const storage = memoryStorage()
    writeGuitarBackingMix(
      'a',
      [{ id: 'drums', levelDb: Number.NEGATIVE_INFINITY, muted: false }],
      storage,
    )
    writeGuitarBackingMix(
      'b',
      [{ id: 'bass', levelDb: 4, muted: true }],
      storage,
    )
    expect(readGuitarBackingMix('a', storage).get('drums')?.levelDb).toBe(
      Number.NEGATIVE_INFINITY,
    )
    const transport = createGuitarBackingTransport({ mixStorage: storage })
    const song = {
      sessionId: 'a',
      title: 'A',
      tracks: [
        { id: 'drums', label: 'Drums', url: '', sizeBytes: 0, level: 0.4 },
      ],
    }
    transport.configure(song)
    expect(transport.getTrackStates()[0].level).toBe(0)
    transport.setTrackMuted('drums', true)
    transport.toggleTrackSolo('drums')
    transport.resetTrackLevels()
    expect(transport.getSoloedTrackId()).toBe('drums')
    expect(transport.getTrackStates()[0]).toMatchObject({
      level: 0.4,
      muted: true,
    })
    transport.configure(song)
    expect(transport.getTrackStates()[0].level).toBeCloseTo(0.4, 8)
  })

  it('bounds retained song history and rejects malformed storage without affecting playback setup', () => {
    const storage = memoryStorage()
    for (
      let index = 0;
      index < GUITAR_BACKING_MIX_MAX_SESSIONS + 3;
      index += 1
    ) {
      writeGuitarBackingMix(
        `s${index}`,
        [{ id: 'drums', levelDb: 2, muted: false }],
        storage,
      )
    }
    expect(readGuitarBackingMix('s0', storage).size).toBe(0)
    expect(
      JSON.parse(storage.getItem(GUITAR_BACKING_MIX_STORAGE_KEY)!).sessions,
    ).toHaveLength(GUITAR_BACKING_MIX_MAX_SESSIONS)
    for (const invalid of [
      '{',
      'null',
      '{"version":2,"sessions":[]}',
      '{"version":1,"sessions":[null,{}]}',
    ]) {
      storage.setItem(GUITAR_BACKING_MIX_STORAGE_KEY, invalid)
      expect(readGuitarBackingMix('a', storage).size).toBe(0)
    }
    storage.setItem(
      GUITAR_BACKING_MIX_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        sessions: [
          {
            sessionId: 'a',
            tracks: [
              null,
              { id: 'bad', muted: false, levelDb: 'loud' },
              { id: 'safe', muted: false, levelDb: 1000 },
            ],
          },
        ],
      }),
    )
    expect([...readGuitarBackingMix('a', storage).values()]).toEqual([
      { id: 'safe', muted: false, levelDb: 6 },
    ])
    const denied = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(readGuitarBackingMix('a', denied).size).toBe(0)
    expect(() =>
      writeGuitarBackingMix(
        'a',
        [{ id: 'drums', levelDb: 0, muted: true }],
        denied,
      ),
    ).not.toThrow()
  })
})
