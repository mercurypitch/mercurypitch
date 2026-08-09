// ============================================================
// Legacy MIDI migration tests — validation, identity and conversion
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { createLegacyMidiMigrationCandidates, hashLegacyMidiSong, LEGACY_MIDI_STORAGE_KEY, legacyMidiSongToProject, readLegacyMidiSongs, } from './legacy-midi-migration'

function legacySong(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gsong-random-a',
    name: 'Nocturne',
    bpm: 100,
    tracks: [
      {
        id: 't0c0',
        name: 'Piano',
        instrumentName: 'Acoustic Grand Piano',
        noteCount: 2,
        notes: [
          { midi: 60, startBeat: 0, duration: 1 },
          { midi: 64, startBeat: 1.5, duration: 0.5 },
        ],
      },
      {
        id: 't1c1',
        name: 'Strings',
        instrumentName: 'String Ensemble 1',
        noteCount: 1,
        notes: [{ midi: 48, startBeat: 0, duration: 2 }],
      },
      {
        id: 't2c2',
        name: 'Bass',
        instrumentName: 'Acoustic Bass',
        noteCount: 1,
        notes: [{ midi: 36, startBeat: 0, duration: 2 }],
      },
    ],
    scoreTrackId: 't0c0',
    backingTrackIds: ['t1c1', 't2c2'],
    importedAt: 1_750_000_000_000,
    ...overrides,
  }
}

function storageWith(raw: string | null): Storage {
  let value = raw
  return {
    get length() {
      return value === null ? 0 : 1
    },
    clear: vi.fn(() => {
      value = null
    }),
    getItem: vi.fn((key: string) =>
      key === LEGACY_MIDI_STORAGE_KEY ? value : null,
    ),
    key: vi.fn(() => (value === null ? null : LEGACY_MIDI_STORAGE_KEY)),
    removeItem: vi.fn(() => {
      value = null
    }),
    setItem: vi.fn((_key: string, next: string) => {
      value = next
    }),
  }
}

describe('legacy MIDI validation', () => {
  it('reads current storage without mutating the shared Guitar key', () => {
    const original = JSON.stringify([legacySong()])
    const storage = storageWith(original)

    const first = readLegacyMidiSongs(storage)
    expect(first.status).toBe('ready')
    expect(first.songs).toHaveLength(1)
    expect(storage.getItem(LEGACY_MIDI_STORAGE_KEY)).toBe(original)
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(storage.removeItem).not.toHaveBeenCalled()
    expect(storage.clear).not.toHaveBeenCalled()
  })

  it('reads afresh so songs added later remain discoverable', () => {
    let raw = JSON.stringify([legacySong()])
    const storage = storageWith(null)
    vi.mocked(storage.getItem).mockImplementation(() => raw)

    expect(readLegacyMidiSongs(storage).songs).toHaveLength(1)
    raw = JSON.stringify([
      legacySong(),
      legacySong({ id: 'new-id', name: 'Prelude' }),
    ])
    expect(readLegacyMidiSongs(storage).songs).toHaveLength(2)
  })

  it('skips invalid rows and reports malformed or blocked roots honestly', () => {
    const mixed = readLegacyMidiSongs(
      storageWith(JSON.stringify([legacySong(), { name: 'broken' }])),
    )
    expect(mixed).toMatchObject({
      status: 'ready',
      skippedRows: 1,
    })
    expect(mixed.songs).toHaveLength(1)

    expect(readLegacyMidiSongs(storageWith('{bad'))).toMatchObject({
      status: 'malformed',
      skippedRows: 1,
    })

    const blocked = storageWith(null)
    vi.mocked(blocked.getItem).mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(readLegacyMidiSongs(blocked)).toMatchObject({
      status: 'unavailable',
      skippedRows: 0,
    })
  })

  it('rejects inconsistent selection and oversized collections', () => {
    const rows = Array.from({ length: 31 }, (_, index) =>
      legacySong({ id: `song-${index}`, name: `Song ${index}` }),
    )
    const bounded = readLegacyMidiSongs(storageWith(JSON.stringify(rows)))
    expect(bounded.songs).toHaveLength(30)
    expect(bounded.skippedRows).toBe(1)

    const invalidSelection = readLegacyMidiSongs(
      storageWith(
        JSON.stringify([
          legacySong({
            scoreTrackId: 'missing',
            backingTrackIds: ['t0c0'],
          }),
        ]),
      ),
    )
    expect(invalidSelection.songs).toEqual([])
    expect(invalidSelection.skippedRows).toBe(1)

    const tickOverflow = legacySong()
    tickOverflow.tracks[0]!.notes[0] = {
      midi: 60,
      startBeat: 4_473_924,
      duration: 1,
    }
    const overflow = readLegacyMidiSongs(
      storageWith(JSON.stringify([tickOverflow])),
    )
    expect(overflow.songs).toEqual([])
    expect(overflow.skippedRows).toBe(1)
  })
})

describe('legacy MIDI identity and project mapping', () => {
  it('hashes normalized content independently of random id, time and backing order', async () => {
    const parsedA = readLegacyMidiSongs(
      storageWith(JSON.stringify([legacySong()])),
    ).songs[0]!
    const parsedB = readLegacyMidiSongs(
      storageWith(
        JSON.stringify([
          legacySong({
            id: 'gsong-random-b',
            importedAt: 1_760_000_000_000,
            backingTrackIds: ['t2c2', 't1c1'],
          }),
        ]),
      ),
    ).songs[0]!

    expect(await hashLegacyMidiSong(parsedA)).toBe(
      await hashLegacyMidiSong(parsedB),
    )
  })

  it('creates a truthful tick-native project with preserved selections', async () => {
    const song = readLegacyMidiSongs(
      storageWith(JSON.stringify([legacySong()])),
    ).songs[0]!
    const hash = await hashLegacyMidiSong(song)
    const project = legacyMidiSongToProject(song, hash)

    expect(project).toMatchObject({
      id: `piano-legacy-${hash}`,
      name: 'Nocturne',
      source: {
        kind: 'legacy-midi',
        storageKey: LEGACY_MIDI_STORAGE_KEY,
        sourceHash: hash,
        ticksPerQuarter: 480,
      },
      scoreTrackId: 't0c0',
      backingTrackIds: ['t1c1', 't2c2'],
      durationTicks: 960,
    })
    expect(project.tempoMap[0]!.microsecondsPerQuarter).toBe(600_000)
    expect(project.tracks[0]!.events).toEqual([
      expect.objectContaining({
        type: 'note-on',
        tick: 0,
        note: 60,
        velocity: 80,
      }),
      expect.objectContaining({
        type: 'note-off',
        tick: 480,
        note: 60,
        velocity: 0,
      }),
      expect.objectContaining({
        type: 'note-on',
        tick: 720,
        note: 64,
        velocity: 80,
      }),
      expect.objectContaining({
        type: 'note-off',
        tick: 960,
        note: 64,
        velocity: 0,
      }),
    ])

    song.tracks[0]!.id = 't0c9'
    song.scoreTrackId = 't0c9'
    expect(legacyMidiSongToProject(song, hash).tracks[0]).toMatchObject({
      channel: 9,
      isPercussion: true,
    })
  })

  it('de-duplicates equivalent rows into one migration candidate', async () => {
    const songs = readLegacyMidiSongs(
      storageWith(
        JSON.stringify([
          legacySong(),
          legacySong({ id: 'other', importedAt: 1_760_000_000_000 }),
        ]),
      ),
    ).songs
    const candidates = await createLegacyMidiMigrationCandidates(songs)
    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.migrationKey).toMatch(/^legacy-midi-v1:[a-f\d]{64}$/)
  })
})
