// ============================================================
// Drum Night session — one canonical percussion document
// ============================================================
//
// A session keeps the complete MidiSong for provenance, then exposes only its
// percussion tracks to Drum Night views. Pitched tracks from a mixed file stay
// preserved without ever becoming drum hits or score lanes.

import type { MidiSong, MidiSongPercussionTrack, MidiSongTrack, } from '@/lib/midi-song'
import { isPercussionMidiSongTrack } from '@/lib/midi-song'

export type DrumSessionSourceFormat = 'midi' | 'guitar-pro'

export interface DrumSessionDocument {
  readonly title: string
  readonly fileName: string
  readonly sourceFormat: DrumSessionSourceFormat
  readonly canonicalSong: MidiSong
  readonly percussionTracks: readonly MidiSongPercussionTrack[]
  readonly pitchedTrackCount: number
  readonly hitCount: number
  readonly droppedHitCount: number
  /** Last authored attack plus its written duration, in quarter-note beats. */
  readonly durationBeats: number
}

export type DrumSessionUnsupportedReason = 'file-type' | 'drum-mapping'

export type DrumSessionImportState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly fileName: string }
  | {
      readonly status: 'ready'
      readonly document: DrumSessionDocument
    }
  | { readonly status: 'empty'; readonly fileName: string }
  | {
      readonly status: 'too-large'
      readonly fileName: string
      readonly actualBytes: number
      readonly maximumBytes: number
    }
  | {
      readonly status: 'unsupported'
      readonly fileName: string
      readonly reason: DrumSessionUnsupportedReason
      readonly droppedHitCount: number
    }
  | {
      readonly status: 'no-drums'
      readonly fileName: string
      readonly pitchedTrackCount: number
    }
  | {
      readonly status: 'error'
      readonly fileName: string
      readonly message: string
    }

export const IDLE_DRUM_SESSION: DrumSessionImportState = Object.freeze({
  status: 'idle',
})

export function loadingDrumSession(fileName: string): DrumSessionImportState {
  return { status: 'loading', fileName }
}

function percussionTracks(
  tracks: readonly MidiSongTrack[],
): MidiSongPercussionTrack[] {
  return tracks.filter(isPercussionMidiSongTrack)
}

function sessionDurationBeats(
  tracks: readonly MidiSongPercussionTrack[],
): number {
  let endBeat = 0
  for (const track of tracks) {
    for (const hit of track.percussionHits) {
      const writtenDuration = Math.max(0, hit.writtenDuration ?? 0)
      endBeat = Math.max(
        hit.startBeat + writtenDuration,
        hit.startBeat,
        endBeat,
      )
    }
  }
  return endBeat
}

/** Project a canonical song into Drum Night without discarding mixed parts. */
export function drumSessionStateFromSong(options: {
  readonly song: MidiSong
  readonly title: string
  readonly fileName: string
  readonly sourceFormat: DrumSessionSourceFormat
}): DrumSessionImportState {
  const tracks = percussionTracks(options.song.tracks)
  const pitchedTrackCount = options.song.tracks.length - tracks.length

  if (options.song.tracks.length === 0) {
    return { status: 'empty', fileName: options.fileName }
  }
  if (tracks.length === 0) {
    return {
      status: 'no-drums',
      fileName: options.fileName,
      pitchedTrackCount,
    }
  }

  const hitCount = tracks.reduce(
    (total, track) => total + track.percussionHits.length,
    0,
  )
  const droppedHitCount = tracks.reduce(
    (total, track) => total + track.droppedHitCount,
    0,
  )
  if (hitCount === 0) {
    return {
      status: 'unsupported',
      fileName: options.fileName,
      reason: 'drum-mapping',
      droppedHitCount,
    }
  }

  return {
    status: 'ready',
    document: {
      title: options.title,
      fileName: options.fileName,
      sourceFormat: options.sourceFormat,
      canonicalSong: options.song,
      percussionTracks: tracks,
      pitchedTrackCount,
      hitCount,
      droppedHitCount,
      durationBeats: sessionDurationBeats(tracks),
    },
  }
}

export function readyDrumSessionDocument(
  state: DrumSessionImportState,
): DrumSessionDocument | null {
  return state.status === 'ready' ? state.document : null
}
