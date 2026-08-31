// Drum arrangement tests — canonical partition and full written span.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { MidiSong, MidiSongPitchedTrack } from '@/lib/midi-song'
import { drumSongFixture, percussionTrackFixture, readyDocumentFixture, } from '../session/drum-session.test-fixtures'
import { createDrumArrangement } from './drum-arrangement'

function pitchedTrack(
  options: Partial<MidiSongPitchedTrack> = {},
): MidiSongPitchedTrack {
  const notes = options.notes ?? [
    { midi: 40, startBeat: 0, duration: 1 },
    { midi: 43, startBeat: 3, duration: 2 },
  ]
  return {
    id: options.id ?? 'bass',
    kind: 'pitched',
    name: options.name ?? 'Bass line',
    instrumentName: options.instrumentName ?? 'Fingered Bass',
    noteCount: notes.length,
    notes,
  }
}

describe('Drum arrangement projection', () => {
  it('preserves and truthfully partitions a mixed canonical song', () => {
    const bass = pitchedTrack()
    const keys = pitchedTrack({
      id: 'keys',
      name: '  ',
      instrumentName: 'Electric Piano',
      notes: [{ midi: 64, startBeat: 6, duration: 2 }],
    })
    const song: MidiSong = {
      ...drumSongFixture(),
      tracks: [
        bass,
        percussionTrackFixture({
          hits: [
            {
              gmKey: 36,
              startBeat: 0,
              velocity: 100,
              writtenDuration: 4,
            },
          ],
        }),
        keys,
      ],
    }
    const document = readyDocumentFixture({ song })
    const arrangement = createDrumArrangement(document)

    expect(arrangement.source).toBe(document)
    expect(arrangement.drums).toEqual({
      id: 'drums',
      label: 'Drums',
      trackCount: 1,
      eventCount: 1,
      available: true,
    })
    expect(arrangement.backing).toEqual({
      id: 'backing',
      label: 'Backing',
      trackCount: 2,
      eventCount: 3,
      available: true,
    })
    expect(
      arrangement.backingTracks.map((track) => [
        track.id,
        track.label,
        track.noteCount,
      ]),
    ).toEqual([
      ['bass', 'Bass line', 2],
      ['keys', 'Electric Piano', 1],
    ])
    expect(arrangement.backingTracks[0]?.sourceTrack).toBe(bass)
    expect(arrangement.backingTracks[0]?.notes).toBe(bass.notes)
    expect(arrangement.backingTracks[0]?.playback).toEqual({
      mode: 'synth-guide',
      voice: 'bass',
      label: 'Bass synth guide',
      approximatesSource: true,
    })
    expect(arrangement.backingTracks[1]?.playback).toEqual({
      mode: 'synth-guide',
      voice: 'electric',
      label: 'Electric pluck guide',
      approximatesSource: true,
    })
    expect(arrangement.durationBeats).toBe(8)
  })

  it('reports a percussion-only song without manufacturing backing', () => {
    const arrangement = createDrumArrangement(readyDocumentFixture())

    expect(arrangement.backing).toMatchObject({
      available: false,
      trackCount: 0,
      eventCount: 0,
    })
    expect(arrangement.backingTracks).toEqual([])
    expect(arrangement.durationBeats).toBe(2)
  })

  it('keeps a backing-only document truthful for future non-scoring sources', () => {
    const bass = pitchedTrack()
    const source = readyDocumentFixture()
    const arrangement = createDrumArrangement({
      ...source,
      canonicalSong: { ...source.canonicalSong, tracks: [bass] },
      percussionTracks: [],
      pitchedTrackCount: 1,
      hitCount: 0,
      droppedHitCount: 0,
      durationBeats: 0,
    })

    expect(arrangement.drums).toMatchObject({
      available: false,
      trackCount: 0,
      eventCount: 0,
    })
    expect(arrangement.backing).toMatchObject({
      available: true,
      trackCount: 1,
      eventCount: 2,
    })
    expect(arrangement.durationBeats).toBe(5)
  })
})
