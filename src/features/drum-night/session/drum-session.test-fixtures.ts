// Drum Night session test fixtures — compact mixed and percussion-only songs.

import type { MidiSong, MidiSongPercussionHit, MidiSongPercussionTrack, } from '@/lib/midi-song'
import type { DrumSessionDocument, DrumSessionImportState, } from './drum-session'
import { drumSessionStateFromSong } from './drum-session'

export function percussionTrackFixture(
  options: {
    readonly id?: string
    readonly name?: string
    readonly hits?: readonly MidiSongPercussionHit[]
    readonly droppedHitCount?: number
  } = {},
): MidiSongPercussionTrack {
  const hits = [
    ...(options.hits ?? [
      { id: 'kick-1', gmKey: 36, startBeat: 0, velocity: 96 },
      { id: 'snare-1', gmKey: 38, startBeat: 1, velocity: 108 },
      { id: 'hat-1', gmKey: 42, startBeat: 1.5, velocity: 72 },
      { id: 'snare-2', gmKey: 38, startBeat: 2, velocity: 104 },
    ]),
  ]
  return {
    id: options.id ?? 'drums',
    kind: 'percussion',
    name: options.name ?? 'Drum kit',
    instrumentName: 'General MIDI Drum Kit',
    noteCount: hits.length,
    notes: [],
    percussionHits: hits,
    droppedHitCount: options.droppedHitCount ?? 0,
  }
}

export function drumSongFixture(
  options: {
    readonly percussionTracks?: readonly MidiSongPercussionTrack[]
    readonly includePitched?: boolean
    readonly bpm?: number
  } = {},
): MidiSong {
  return {
    bpm: options.bpm ?? 120,
    tempoChanges: [{ beat: 0, usPerBeat: 500000 }],
    timeSignatures: [{ beat: 0, numerator: 4, denominator: 4 }],
    tracks: [
      ...(options.includePitched === true
        ? [
            {
              id: 'bass',
              kind: 'pitched' as const,
              name: 'Bass',
              instrumentName: 'Fingered Bass',
              noteCount: 1,
              notes: [{ midi: 40, startBeat: 0, duration: 1 }],
            },
          ]
        : []),
      ...(options.percussionTracks ?? [percussionTrackFixture()]),
    ],
  }
}

export function readySessionFixture(
  options: {
    readonly song?: MidiSong
    readonly title?: string
  } = {},
): Extract<DrumSessionImportState, { status: 'ready' }> {
  const state = drumSessionStateFromSong({
    song: options.song ?? drumSongFixture(),
    title: options.title ?? 'Midnight Pocket',
    fileName: 'midnight-pocket.mid',
    sourceFormat: 'midi',
  })
  if (state.status !== 'ready') throw new Error('Expected a ready drum fixture')
  return state
}

export function readyDocumentFixture(
  options: {
    readonly song?: MidiSong
    readonly title?: string
  } = {},
): DrumSessionDocument {
  return readySessionFixture(options).document
}
