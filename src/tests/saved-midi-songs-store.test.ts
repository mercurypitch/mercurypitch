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
})
