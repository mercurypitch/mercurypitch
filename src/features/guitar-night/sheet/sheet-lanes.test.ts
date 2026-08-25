import { describe, expect, it } from 'vitest'
import { DEFAULT_BASS_TUNING, instrumentTuningFromSource, } from '@/lib/guitar/instrument-tuning'
import type { GuitarNightReferenceSource } from '../reference-port'
import { playableSheetTracks, sheetLanesFromSource } from './sheet-lanes'

function source(
  overrides: Partial<GuitarNightReferenceSource> = {},
): GuitarNightReferenceSource {
  return {
    id: 'gsong-1',
    name: 'Velvet Riff',
    bpm: 96,
    scoreTrackId: 'track-lead',
    tracks: [
      {
        id: 'track-lead',
        name: 'Lead guitar',
        instrumentName: 'Electric guitar',
        noteCount: 2,
        notes: [
          { midi: 64, startBeat: 0, duration: 1 },
          { midi: 67, startBeat: 1, duration: 1 },
        ],
      },
      {
        id: 'track-bass',
        name: 'Bass',
        instrumentName: 'Electric bass',
        noteCount: 2,
        notes: [
          { midi: 40, startBeat: 0, duration: 2 },
          { midi: 45, startBeat: 2, duration: 2 },
        ],
      },
      {
        id: 'track-silent',
        name: 'Percussion cue',
        noteCount: 0,
        notes: [],
      },
    ],
    ...overrides,
  }
}

describe('playableSheetTracks', () => {
  it('leaves out tracks with nothing to draw', () => {
    expect(playableSheetTracks(source()).map((track) => track.id)).toEqual([
      'track-lead',
      'track-bass',
    ])
  })

  it('keeps authored percussion hits as readable sheet material', () => {
    const withDrums = source({
      tracks: [
        ...source().tracks,
        {
          id: 'track-drums',
          kind: 'percussion',
          name: 'Drum kit',
          instrumentName: 'General MIDI Drum Kit',
          noteCount: 1,
          notes: [],
          percussionHits: [{ gmKey: 49, startBeat: 4.5, velocity: 108 }],
        },
      ],
    })

    expect(playableSheetTracks(withDrums).map((track) => track.id)).toContain(
      'track-drums',
    )
  })
})

describe('sheetLanesFromSource', () => {
  it('draws every playable track when no choice was made', () => {
    const lanes = sheetLanesFromSource(source())
    expect(lanes.map((lane) => lane.trackId)).toEqual([
      'track-lead',
      'track-bass',
    ])
    expect(lanes.every((lane) => lane.kind === 'authored')).toBe(true)
  })

  it('keeps the written order, whichever part is scored', () => {
    const lanes = sheetLanesFromSource(source(), {
      scoredTrackId: 'track-bass',
    })
    expect(lanes.map((lane) => lane.trackId)).toEqual([
      'track-lead',
      'track-bass',
    ])
  })

  it('shows only the tracks the reader chose', () => {
    const lanes = sheetLanesFromSource(source(), {
      visibleTrackIds: ['track-bass'],
    })
    expect(lanes.map((lane) => lane.trackId)).toEqual(['track-bass'])
  })

  it('keeps the scored part on the page even when it was not chosen', () => {
    const lanes = sheetLanesFromSource(source(), {
      visibleTrackIds: ['track-bass'],
      scoredTrackId: 'track-lead',
    })
    expect(lanes.map((lane) => lane.trackId)).toEqual([
      'track-lead',
      'track-bass',
    ])
  })

  it('does not move a part when the reader scores it', () => {
    const before = sheetLanesFromSource(source(), {
      scoredTrackId: 'track-lead',
    }).map((lane) => lane.trackId)
    const after = sheetLanesFromSource(source(), {
      scoredTrackId: 'track-bass',
    }).map((lane) => lane.trackId)
    expect(after).toEqual(before)
  })

  it('reads as an empty sheet when nothing chosen is playable', () => {
    expect(
      sheetLanesFromSource(source(), { visibleTrackIds: ['track-silent'] }),
    ).toEqual([])
  })

  it('gives each lane the neck its own part is written for', () => {
    const lanes = sheetLanesFromSource(source())
    expect(lanes[0]?.instrument).toBe('guitar')
    expect(lanes[0]?.tuning.stringCount).toBe(6)
    expect(lanes[1]?.instrument).toBe('bass')
    expect(lanes[1]?.tuning.stringCount).toBe(4)
  })

  it('honours a tuning the source authored', () => {
    const dropD = source({
      tracks: [
        {
          id: 'track-lead',
          name: 'Lead guitar',
          instrumentName: 'Electric guitar',
          noteCount: 1,
          notes: [{ midi: 50, startBeat: 0, duration: 1 }],
          sourceTuning: [64, 59, 55, 50, 45, 38],
          sourceTuningName: 'Drop D',
        },
      ],
    })
    const lane = sheetLanesFromSource(dropD)[0]
    expect(lane?.tuning.name).toBe('Drop D')
    expect(lane?.tuning.openMidi[5]).toBe(38)
  })

  it('places the scored part on the neck the player picked', () => {
    const lanes = sheetLanesFromSource(source(), {
      scoredTrackId: 'track-lead',
      scoredTuning: DEFAULT_BASS_TUNING,
    })
    expect(lanes[0]?.trackId).toBe('track-lead')
    expect(lanes[0]?.tuning.stringCount).toBe(4)
    // Only the scored lane follows the player; the rest stay as written.
    expect(lanes[1]?.tuning.stringCount).toBe(4)
    expect(lanes[1]?.trackId).toBe('track-bass')
  })

  it('leaves other lanes alone when the player retunes the scored one', () => {
    const retuned = instrumentTuningFromSource(
      'guitar',
      [66, 61, 57, 52, 47, 42],
    )
    const lanes = sheetLanesFromSource(source(), {
      scoredTrackId: 'track-lead',
      ...(retuned === null ? {} : { scoredTuning: retuned }),
    })
    expect(lanes[0]?.tuning.openMidi[0]).toBe(66)
    expect(lanes[1]?.tuning.openMidi[0]).toBe(DEFAULT_BASS_TUNING.openMidi[0])
  })

  it('reports notes a lane could not reach instead of hiding them', () => {
    const tooLow = source({
      tracks: [
        {
          id: 'track-lead',
          name: 'Lead guitar',
          instrumentName: 'Electric guitar',
          noteCount: 2,
          notes: [
            { midi: 64, startBeat: 0, duration: 1 },
            { midi: 12, startBeat: 1, duration: 1 },
          ],
        },
      ],
    })
    const lane = sheetLanesFromSource(tooLow)[0]
    expect(lane?.notes).toHaveLength(1)
    expect(lane?.outOfRangeNotes).toBe(1)
  })

  it('preserves authored GM evidence in a non-scoreable percussion lane', () => {
    const hit = {
      id: 'gp-t2-b3-v0-n1',
      gmKey: 54,
      startBeat: 6.25,
      velocity: 87,
      writtenDuration: 0.5,
      source: {
        format: 'guitar-pro' as const,
        articulationIndex: 0,
        label: 'Tambourine',
        staffLine: 3,
      },
    }
    const withDrums = source({
      tracks: [
        ...source().tracks,
        {
          id: 'track-drums',
          kind: 'percussion',
          name: 'Drum kit',
          instrumentName: 'General MIDI Drum Kit',
          noteCount: 1,
          notes: [],
          percussionHits: [hit],
          droppedHitCount: 2,
        },
      ],
    })

    const drumLane = sheetLanesFromSource(withDrums, {
      visibleTrackIds: ['track-drums'],
      scoredTrackId: 'track-lead',
    }).find((lane) => lane.trackId === 'track-drums')

    expect(drumLane).toMatchObject({
      content: 'percussion',
      scoreable: false,
      notes: [],
      droppedPercussionHits: 2,
    })
    expect(drumLane?.percussionHits).toEqual([hit])
    expect(drumLane?.percussionHits?.[0]).toBe(hit)
  })
})
