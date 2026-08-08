// Guitar Night reference ports describe verified authored scores, never invented ones.
// ============================================================
//
// A reference is the score axis of a rehearsal: the authored notes the stage
// may display. It stays independent from the backing axis (separated stems),
// so either can be used alone. Only values the source really carries are
// exposed — tempo, tracks and authored fingering exist in the saved-song
// representation; meter, sections, tuning and capo do not, so this port does
// not pretend to know them.

import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { melodyToGuitarNotes } from '@/lib/guitar/guitar-synth'
import type { MidiSongNote } from '@/lib/midi-song'

/** The minimal saved-song shape a reference is read from. */
export interface GuitarNightReferenceSourceTrack {
  id: string
  name: string
  noteCount: number
  notes: readonly MidiSongNote[]
}

export interface GuitarNightReferenceSource {
  id: string
  name: string
  bpm: number
  tracks: readonly GuitarNightReferenceSourceTrack[]
  /** The track this source was last scored against. */
  scoreTrackId: string
}

export interface GuitarNightReferenceTrack {
  id: string
  name: string
  noteCount: number
}

export interface GuitarNightReferenceSummary {
  songId: string
  title: string
  trackCount: number
  importedAt: number
}

export interface GuitarNightReference {
  songId: string
  title: string
  trackId: string
  trackName: string
  tempoBpm: number
  notes: readonly GuitarNote[]
  tracks: readonly GuitarNightReferenceTrack[]
}

export type GuitarNightOpenReferenceResult =
  | { ok: true; reference: GuitarNightReference }
  | { ok: false; code: 'not-found' | 'no-playable-notes' }

export interface GuitarNightReferencePort {
  listReferences(): readonly GuitarNightReferenceSummary[]
  openReference(
    songId: string,
    trackId?: string,
  ): GuitarNightOpenReferenceResult
  /** Persist which track this source is scored against, for later opens. */
  rememberTrack(songId: string, trackId: string): void
  importReference(file: File): Promise<GuitarNightReferenceSummary>
}

/** Accepted score files: Guitar Pro tabs and standard MIDI. */
export const REFERENCE_FILE_ACCEPT = '.gp,.gp3,.gp4,.gp5,.gpx,.mid,.midi'

export function isMidiReferenceFile(fileName: string): boolean {
  return /\.midi?$/i.test(fileName)
}

export function isGuitarProReferenceFile(fileName: string): boolean {
  return /\.(gp|gp3|gp4|gp5|gpx)$/i.test(fileName)
}

/**
 * Choose the track to display: an explicit request wins, then the source's
 * remembered choice, then the densest track. A requested track that no longer
 * exists falls back visibly rather than silently showing a different part.
 */
export function resolveReferenceTrack(
  source: GuitarNightReferenceSource,
  requestedTrackId?: string,
): GuitarNightReferenceSourceTrack | null {
  const playable = source.tracks.filter((track) => track.notes.length > 0)
  if (playable.length === 0) return null

  const requested = playable.find((track) => track.id === requestedTrackId)
  if (requested !== undefined) return requested

  const remembered = playable.find((track) => track.id === source.scoreTrackId)
  if (remembered !== undefined) return remembered

  return playable.reduce((densest, track) =>
    track.notes.length > densest.notes.length ? track : densest,
  )
}

export function referenceTrackSummaries(
  source: GuitarNightReferenceSource,
): readonly GuitarNightReferenceTrack[] {
  return source.tracks
    .filter((track) => track.notes.length > 0)
    .map((track) => ({
      id: track.id,
      name: track.name,
      noteCount: track.notes.length,
    }))
}

/** Adapt one saved score into stage notes. Beats stay in the source's terms. */
export function openGuitarNightReference(
  source: GuitarNightReferenceSource,
  requestedTrackId?: string,
): GuitarNightOpenReferenceResult {
  const track = resolveReferenceTrack(source, requestedTrackId)
  if (track === null) return { ok: false, code: 'no-playable-notes' }

  const tempoBpm =
    Number.isFinite(source.bpm) && source.bpm > 0 ? source.bpm : 120

  return {
    ok: true,
    reference: {
      songId: source.id,
      title: source.name,
      trackId: track.id,
      trackName: track.name,
      tempoBpm,
      // Guitar Pro imports carry authored string/fret; MIDI notes are placed
      // by the shared helper instead of guessed here.
      notes: melodyToGuitarNotes(
        track.notes.map((note) => ({
          midi: note.midi,
          startBeat: note.startBeat,
          duration: note.duration,
          stringIndex: note.stringIndex,
          fret: note.fret,
        })),
      ),
      tracks: referenceTrackSummaries(source),
    },
  }
}
