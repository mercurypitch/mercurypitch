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

  it('reads the scored part first', () => {
    const lanes = sheetLanesFromSource(source(), {
      scoredTrackId: 'track-bass',
    })
    expect(lanes.map((lane) => lane.trackId)).toEqual([
      'track-bass',
      'track-lead',
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
})
