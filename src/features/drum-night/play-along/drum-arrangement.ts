// ============================================================
// Drum arrangement — canonical percussion and pitched backing truth
// ============================================================
//
// Drum Night keeps the imported MidiSong intact. This projection names and
// counts the two audible roles without turning pitched notes into drum hits or
// pretending a synthesized guide is the source instrument itself.

import type { MidiSongNote, MidiSongPitchedTrack } from '@/lib/midi-song'
import type { DrumSessionDocument } from '../session/drum-session'
import type { DrumArrangementBackingVoice } from './drum-arrangement-player'

export type DrumArrangementBusId = 'backing' | 'drums'

export interface DrumArrangementBusTruth {
  readonly id: DrumArrangementBusId
  readonly label: 'Backing' | 'Drums'
  readonly trackCount: number
  readonly eventCount: number
  readonly available: boolean
}

export interface DrumArrangementBackingTrack {
  /** Stable canonical source-track identity. */
  readonly id: string
  /** Human-facing source label, with a deterministic fallback. */
  readonly label: string
  readonly sourceName: string
  readonly instrumentName: string
  readonly noteCount: number
  /**
   * Every pitched lane remains audible, but this first pass is explicitly a
   * plucked synth guide rather than a reproduction of the source instrument.
   */
  readonly playback: {
    readonly mode: 'synth-guide'
    readonly voice: DrumArrangementBackingVoice
    readonly label: string
    readonly approximatesSource: true
  }
  /** The canonical note objects are preserved rather than flattened. */
  readonly notes: readonly MidiSongNote[]
  readonly sourceTrack: MidiSongPitchedTrack
}

export interface DrumArrangement {
  readonly title: string
  readonly source: DrumSessionDocument
  readonly drums: DrumArrangementBusTruth
  readonly backing: DrumArrangementBusTruth
  readonly backingTracks: readonly DrumArrangementBackingTrack[]
  /** Longest written percussion hit or pitched note tail. */
  readonly durationBeats: number
}

function cleanLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function backingTrackLabel(track: MidiSongPitchedTrack, index: number): string {
  const name = cleanLabel(track.name)
  if (name.length > 0) return name
  const instrument = cleanLabel(track.instrumentName)
  if (instrument.length > 0) return instrument
  return `Backing part ${index + 1}`
}

function writtenBackingEnd(track: MidiSongPitchedTrack): number {
  let endBeat = 0
  for (const note of track.notes) {
    if (!Number.isFinite(note.startBeat) || note.startBeat < 0) continue
    const duration =
      Number.isFinite(note.duration) && note.duration > 0 ? note.duration : 0
    endBeat = Math.max(endBeat, note.startBeat + duration)
  }
  return endBeat
}

function guideVoiceForTrack(
  track: MidiSongPitchedTrack,
): DrumArrangementBackingVoice {
  const source = `${track.name} ${track.instrumentName}`.toLowerCase()
  if (source.includes('bass')) return 'bass'
  if (
    source.includes('acoustic') ||
    source.includes('nylon') ||
    source.includes('classical')
  ) {
    return 'acoustic'
  }
  return 'electric'
}

function guideLabel(voice: DrumArrangementBackingVoice): string {
  if (voice === 'bass') return 'Bass synth guide'
  if (voice === 'acoustic') return 'Acoustic pluck guide'
  return 'Electric pluck guide'
}

/** Split a ready Drum Night document without losing its canonical source. */
export function createDrumArrangement(
  document: DrumSessionDocument,
): DrumArrangement {
  const sourceTracks = document.canonicalSong.tracks.filter(
    (track): track is MidiSongPitchedTrack => track.kind === 'pitched',
  )
  const backingTracks = sourceTracks.map((track, index) => {
    const voice = guideVoiceForTrack(track)
    return Object.freeze({
      id: track.id,
      label: backingTrackLabel(track, index),
      sourceName: cleanLabel(track.name),
      instrumentName: cleanLabel(track.instrumentName),
      noteCount: track.notes.length,
      playback: Object.freeze({
        mode: 'synth-guide' as const,
        voice,
        label: guideLabel(voice),
        approximatesSource: true as const,
      }),
      notes: track.notes,
      sourceTrack: track,
    })
  })
  const backingNoteCount = backingTracks.reduce(
    (count, track) => count + track.noteCount,
    0,
  )
  const backingDuration = sourceTracks.reduce(
    (endBeat, track) => Math.max(endBeat, writtenBackingEnd(track)),
    0,
  )

  return Object.freeze({
    title: document.title,
    source: document,
    drums: Object.freeze({
      id: 'drums',
      label: 'Drums',
      trackCount: document.percussionTracks.length,
      eventCount: document.hitCount,
      available: document.hitCount > 0,
    }),
    backing: Object.freeze({
      id: 'backing',
      label: 'Backing',
      trackCount: backingTracks.length,
      eventCount: backingNoteCount,
      available: backingNoteCount > 0,
    }),
    backingTracks: Object.freeze(backingTracks),
    durationBeats: Math.max(document.durationBeats, backingDuration),
  })
}
