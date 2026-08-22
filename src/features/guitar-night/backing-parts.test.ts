import { describe, expect, it } from 'vitest'
import { backingMelody, backingParts, scoredPartSoundsByDefault, } from './backing-parts'
import type { GuitarNightReferenceSource } from './reference-port'

function source(
  overrides: Partial<GuitarNightReferenceSource> = {},
): GuitarNightReferenceSource {
  return {
    id: 'song-1',
    name: 'Band Study',
    bpm: 120,
    scoreTrackId: 'track-lead',
    tracks: [
      {
        id: 'track-lead',
        name: 'Lead guitar',
        instrumentName: 'Electric guitar',
        noteCount: 2,
        notes: [
          { midi: 64, startBeat: 2, duration: 1 },
          { midi: 67, startBeat: 0, duration: 1 },
        ],
      },
      {
        id: 'track-bass',
        name: 'Bass',
        instrumentName: 'Electric bass',
        noteCount: 1,
        notes: [{ midi: 40, startBeat: 1, duration: 2 }],
      },
      {
        id: 'track-silent',
        name: 'Cue',
        noteCount: 0,
        notes: [],
      },
    ],
    ...overrides,
  }
}

describe('backingParts', () => {
  it('is every playable part except the one being scored', () => {
    expect(
      backingParts(source(), 'track-lead').map((part) => part.trackId),
    ).toEqual(['track-bass'])
  })

  it('names each part and the timbre it should sound with', () => {
    expect(backingParts(source(), 'track-lead')[0]).toMatchObject({
      name: 'Bass',
      variant: 'bass',
      noteCount: 1,
    })
    expect(backingParts(source(), 'track-bass')[0]).toMatchObject({
      name: 'Lead guitar',
      variant: 'electric',
    })
  })

  it('is empty for a file with one part', () => {
    expect(
      backingParts(source({ tracks: [source().tracks[0]!] }), 'track-lead'),
    ).toEqual([])
  })
})

describe('backingMelody', () => {
  it('plays every other part by default, in time order', () => {
    const notes = backingMelody(source(), { scoredTrackId: 'track-lead' })
    expect(notes.map((note) => note.midi)).toEqual([40])
    expect(notes[0]).toMatchObject({
      startBeat: 1,
      durationBeats: 2,
      variant: 'bass',
      channelId: 'track-bass',
    })
  })

  it('never sounds the part the player is being graded on', () => {
    const notes = backingMelody(source(), { scoredTrackId: 'track-bass' })
    expect(notes.every((note) => note.midi !== 40)).toBe(true)
    expect(notes).toHaveLength(2)
  })

  it('keeps each part on its own timbre', () => {
    const notes = backingMelody(source())
    expect(new Set(notes.map((note) => note.variant))).toEqual(
      new Set(['electric', 'bass']),
    )
  })

  it('sorts the merged parts by time', () => {
    expect(backingMelody(source()).map((note) => note.startBeat)).toEqual([
      0, 1, 2,
    ])
  })

  it('plays only the parts the player chose', () => {
    expect(
      backingMelody(source(), {
        scoredTrackId: 'track-lead',
        audibleTrackIds: [],
      }),
    ).toEqual([])
    expect(
      backingMelody(source(), {
        scoredTrackId: 'track-lead',
        audibleTrackIds: ['track-bass'],
      }),
    ).toHaveLength(1)
  })

  it('leaves out notes it cannot place', () => {
    const broken = source({
      tracks: [
        {
          id: 'track-bass',
          name: 'Bass',
          instrumentName: 'Electric bass',
          noteCount: 3,
          notes: [
            { midi: Number.NaN, startBeat: 0, duration: 1 },
            { midi: 40, startBeat: Number.NaN, duration: 1 },
            { midi: 41, startBeat: 0, duration: -4 },
          ],
        },
      ],
    })
    const notes = backingMelody(broken)
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({ midi: 41, durationBeats: 0 })
  })
})

describe('scoredPartSoundsByDefault', () => {
  it('keeps a one-part tab playing itself', () => {
    expect(
      scoredPartSoundsByDefault(
        source({ tracks: [source().tracks[0]!] }),
        'track-lead',
      ),
    ).toBe(true)
  })

  it('hands the scored part to the player when a band can cover it', () => {
    expect(scoredPartSoundsByDefault(source(), 'track-lead')).toBe(false)
  })

  it('says yes when there is no score at all', () => {
    expect(scoredPartSoundsByDefault(null)).toBe(true)
  })
})
