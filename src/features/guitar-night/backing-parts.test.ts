import { describe, expect, it } from 'vitest'
import { backingMelody, backingParts, backingPercussion, scoredPartSoundsByDefault, } from './backing-parts'
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
        sourceProgram: 30,
        instrumentFamily: 'electric-guitar',
        noteCount: 2,
        notes: [
          { midi: 64, startBeat: 2, duration: 1, velocity: 91 },
          { midi: 67, startBeat: 0, duration: 1, velocity: 88 },
        ],
      },
      {
        id: 'track-bass',
        name: 'Bass',
        instrumentName: 'Electric bass',
        sourceProgram: 33,
        instrumentFamily: 'bass',
        noteCount: 1,
        notes: [{ midi: 40, startBeat: 1, duration: 2, velocity: 73 }],
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

function mixedSource(): GuitarNightReferenceSource {
  return source({
    tracks: [
      ...source().tracks,
      {
        id: 'track-midi-drums',
        kind: 'percussion',
        name: 'MIDI drums',
        noteCount: 1,
        notes: [],
        percussionHits: [
          {
            id: 'midi-t3-e8',
            gmKey: 36,
            startBeat: 1.5,
            velocity: 64,
            source: { format: 'midi', channel: 9, midiKey: 36 },
          },
        ],
      },
      {
        id: 'track-gp-drums',
        kind: 'percussion',
        name: 'Guitar Pro drums',
        noteCount: 1,
        notes: [],
        percussionHits: [
          {
            id: 'gp-t4-b2-v0-n1',
            gmKey: 49,
            startBeat: 0.5,
            velocity: 111,
            articulation: 'choke',
            source: {
              format: 'guitar-pro',
              articulationId: 97,
              articulationIndex: 0,
            },
          },
        ],
      },
    ],
  })
}

function unsupportedDrumsSource(): GuitarNightReferenceSource {
  return source({
    tracks: [
      source().tracks[0]!,
      {
        id: 'track-unsupported-drums',
        kind: 'percussion',
        name: 'Aux percussion',
        noteCount: 1,
        notes: [],
        percussionHits: [{ gmKey: 54, startBeat: 1, velocity: 90 }],
        droppedHitCount: 2,
      },
    ],
  })
}

describe('backingParts', () => {
  it('is every playable part except the one being scored', () => {
    expect(
      backingParts(source(), 'track-lead').map((part) => part.trackId),
    ).toEqual(['track-bass'])
  })

  it('names each part and the honest instrument family it should sound with', () => {
    expect(backingParts(source(), 'track-lead')[0]).toMatchObject({
      name: 'Bass',
      instrumentFamily: 'bass',
      noteCount: 1,
    })
    expect(backingParts(source(), 'track-bass')[0]).toMatchObject({
      name: 'Lead guitar',
      instrumentFamily: 'electric-guitar',
    })
  })

  it('uses explicit GM programs to separate guitars, bass, and neutral parts', () => {
    const tracks = [
      { id: 'clean', name: 'Clean guitar', program: 27, midi: 64 },
      { id: 'distorted', name: 'Distorted guitar', program: 30, midi: 67 },
      { id: 'acoustic', name: 'Steel guitar', program: 25, midi: 60 },
      { id: 'bass', name: 'Bass', program: 33, midi: 40 },
      { id: 'strings', name: 'Lead guitar', program: 48, midi: 69 },
      { id: 'voice', name: 'Voice Oohs', program: 53, midi: 72 },
      { id: 'synth', name: 'Synth lead', program: 80, midi: 76 },
    ] as const
    const classified = backingParts(
      source({
        tracks: tracks.map((track) => ({
          id: track.id,
          name: track.name,
          instrumentName: track.name,
          sourceProgram: track.program,
          noteCount: 1,
          notes: [{ midi: track.midi, startBeat: 0, duration: 1 }],
        })),
      }),
      'not-a-track',
    )

    expect(
      classified.map((part) =>
        part.kind === 'pitched'
          ? [part.trackId, part.instrumentFamily]
          : [part.trackId, part.kind],
      ),
    ).toEqual([
      ['clean', 'electric-guitar'],
      ['distorted', 'electric-guitar'],
      ['acoustic', 'acoustic-guitar'],
      ['bass', 'bass'],
      ['strings', 'neutral'],
      ['voice', 'neutral'],
      ['synth', 'neutral'],
    ])
  })

  it('is empty for a file with one part', () => {
    expect(
      backingParts(source({ tracks: [source().tracks[0]!] }), 'track-lead'),
    ).toEqual([])
  })

  it('lists retained MIDI and Guitar Pro drums as non-pitched backing parts', () => {
    expect(backingParts(mixedSource(), 'track-lead').slice(-2)).toEqual([
      {
        trackId: 'track-midi-drums',
        name: 'MIDI drums',
        kind: 'percussion',
        hitCount: 1,
        supportedHitCount: 1,
        droppedHitCount: 0,
      },
      {
        trackId: 'track-gp-drums',
        name: 'Guitar Pro drums',
        kind: 'percussion',
        hitCount: 1,
        supportedHitCount: 1,
        droppedHitCount: 0,
      },
    ])
  })

  it('lists unsupported and dropped drum evidence without calling it audible', () => {
    expect(backingParts(unsupportedDrumsSource(), 'track-lead')).toEqual([
      {
        trackId: 'track-unsupported-drums',
        name: 'Aux percussion',
        kind: 'percussion',
        hitCount: 1,
        supportedHitCount: 0,
        droppedHitCount: 2,
      },
    ])
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
      instrumentFamily: 'bass',
      velocity: 73,
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

  it('keeps neutral authored parts off guitar variants while preserving velocity', () => {
    const neutral = source({
      tracks: [
        {
          id: 'voice',
          name: 'Lead guitar',
          instrumentName: 'Voice Oohs',
          sourceProgram: 53,
          instrumentFamily: 'electric-guitar',
          noteCount: 1,
          notes: [{ midi: 72, startBeat: 0, duration: 1, velocity: 86 }],
        },
      ],
    })

    const [note] = backingMelody(neutral)
    expect(note).toMatchObject({
      channelId: 'voice',
      instrumentFamily: 'neutral',
      velocity: 86,
    })
    expect(note.variant).toBeUndefined()
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

describe('backingPercussion', () => {
  it('projects mixed MIDI and Guitar Pro drums without making pitched notes', () => {
    expect(backingMelody(mixedSource())).toHaveLength(
      backingMelody(source()).length,
    )
    expect(
      backingPercussion(mixedSource(), { scoredTrackId: 'track-lead' }),
    ).toEqual([
      {
        trackId: 'track-gp-drums',
        sourceId: 'gp-t4-b2-v0-n1',
        gmKey: 49,
        startBeat: 0.5,
        velocity: 111,
        articulation: 'choke',
      },
      {
        trackId: 'track-midi-drums',
        sourceId: 'midi-t3-e8',
        gmKey: 36,
        startBeat: 1.5,
        velocity: 64,
      },
    ])
  })

  it('keeps muted drum tracks out of the scheduler stream', () => {
    expect(
      backingPercussion(mixedSource(), {
        scoredTrackId: 'track-lead',
        audibleTrackIds: [],
      }),
    ).toEqual([])
    expect(
      backingPercussion(mixedSource(), {
        scoredTrackId: 'track-lead',
        audibleTrackIds: ['track-gp-drums'],
      }),
    ).toEqual([
      {
        trackId: 'track-gp-drums',
        sourceId: 'gp-t4-b2-v0-n1',
        gmKey: 49,
        startBeat: 0.5,
        velocity: 111,
        articulation: 'choke',
      },
    ])
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

  it('keeps the scored part sounding when the only drum row is silent', () => {
    expect(
      scoredPartSoundsByDefault(unsupportedDrumsSource(), 'track-lead'),
    ).toBe(true)
  })
})
