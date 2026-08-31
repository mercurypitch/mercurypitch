// Saved MIDI-song tests keep authored timing intact across local persistence.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('saved MIDI songs', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('persists the complete tempo map with the score', async () => {
    const { saveMidiSong } = await import('@/stores/saved-midi-songs-store')
    const tempoChanges = [
      { beat: 0, usPerBeat: 500000 },
      { beat: 8, usPerBeat: 666667 },
    ]

    const saved = saveMidiSong(
      'Tempo study',
      {
        bpm: 120,
        tempoChanges,
        tracks: [
          {
            id: 'track-1',
            kind: 'pitched',
            name: 'Guitar',
            instrumentName: 'Electric Guitar',
            noteCount: 1,
            notes: [{ midi: 64, startBeat: 0, duration: 1 }],
          },
        ],
      },
      'track-1',
      [],
    )

    expect(saved.tempoChanges).toEqual(tempoChanges)
    expect(
      JSON.parse(localStorage.getItem('pitchperfect_guitar_songs') ?? '[]')[0]
        .tempoChanges,
    ).toEqual(tempoChanges)
  })

  it('normalizes a pre-percussion saved track as explicitly pitched', async () => {
    localStorage.setItem(
      'pitchperfect_guitar_songs',
      JSON.stringify([
        {
          id: 'legacy-song',
          name: 'Legacy song',
          bpm: 120,
          tracks: [
            {
              id: 'legacy-track',
              name: 'Guitar',
              instrumentName: 'Steel Guitar',
              noteCount: 1,
              notes: [{ midi: 64, startBeat: 0, duration: 1 }],
            },
          ],
          scoreTrackId: 'legacy-track',
          backingTrackIds: [],
          importedAt: 1,
        },
      ]),
    )

    const { savedMidiSongs } = await import('@/stores/saved-midi-songs-store')
    expect(savedMidiSongs()[0].tracks[0].kind).toBe('pitched')
    expect(savedMidiSongs()[0].scoreTrackId).toBe('legacy-track')
  })

  it('persists a percussion-only song without inventing a score track', async () => {
    const { saveMidiSong } = await import('@/stores/saved-midi-songs-store')
    const saved = saveMidiSong(
      'Drum study',
      {
        bpm: 104,
        tracks: [
          {
            id: 'drums',
            kind: 'percussion',
            name: 'Drums',
            instrumentName: 'General MIDI Drum Kit',
            noteCount: 1,
            notes: [],
            percussionHits: [{ gmKey: 38, startBeat: 0, velocity: 96 }],
            droppedHitCount: 0,
          },
        ],
      },
      null,
      [],
    )

    expect(saved.scoreTrackId).toBeNull()
    expect(saved.tracks[0]).toMatchObject({
      kind: 'percussion',
      noteCount: 1,
      percussionHits: [{ gmKey: 38, startBeat: 0, velocity: 96 }],
    })
    expect(
      JSON.parse(localStorage.getItem('pitchperfect_guitar_songs') ?? '[]')[0]
        .scoreTrackId,
    ).toBeNull()
  })
})
