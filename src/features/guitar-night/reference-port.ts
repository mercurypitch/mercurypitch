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
import type { StemTranscription } from '@/lib/transcription/stem-transcription'
import type { GuitarNightStemKind } from './song-port'

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

/**
 * `authored` notes were written in a file and carry a real musical tempo.
 * `measured` notes were heard in a separated stem: they are evidence about the
 * recording, already on its timeline, and are never presented as a tab.
 */
export type GuitarNightReferenceKind = 'authored' | 'measured'

export interface GuitarNightReference {
  kind: GuitarNightReferenceKind
  songId: string
  title: string
  trackId: string
  trackName: string
  tempoBpm: number
  notes: readonly GuitarNote[]
  tracks: readonly GuitarNightReferenceTrack[]
  /** Measured only: share of the stem that produced confident notes, 0–1. */
  coverage?: number
  /** Measured only: true when notes were raised into the six-string range. */
  liftedOctaves?: boolean
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

/** Standard six-string open pitches, high to low, matching the stage's rows. */
const STANDARD_GUITAR_OPEN_MIDI = [64, 59, 55, 50, 45, 40] as const

/**
 * Authored fingering is an index into *that track's own* tuning, so a bass,
 * seven-string or dropped-tuning track numbers its strings differently from the
 * six-string stage. Trust the fingering only when it genuinely describes a
 * standard-tuned guitar; otherwise the note is placed by pitch instead of drawn
 * on the wrong string.
 */
export function describesStandardGuitarFingering(
  midi: number,
  stringIndex: number | undefined,
  fret: number | undefined,
): boolean {
  if (stringIndex === undefined || fret === undefined) return false
  if (stringIndex < 0 || stringIndex >= STANDARD_GUITAR_OPEN_MIDI.length) {
    return false
  }
  if (fret < 0) return false
  return STANDARD_GUITAR_OPEN_MIDI[stringIndex] + fret === midi
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
      kind: 'authored',
      songId: source.id,
      title: source.name,
      trackId: track.id,
      trackName: track.name,
      tempoBpm,
      // Guitar Pro imports carry authored string/fret, but only for their own
      // instrument's tuning. Keep it when it describes this stage's six
      // strings; otherwise let the shared helper place the note by pitch.
      notes: melodyToGuitarNotes(
        track.notes.map((note) => {
          const authored = describesStandardGuitarFingering(
            note.midi,
            note.stringIndex,
            note.fret,
          )
          return {
            midi: note.midi,
            startBeat: note.startBeat,
            duration: note.duration,
            stringIndex: authored ? note.stringIndex : undefined,
            fret: authored ? note.fret : undefined,
          }
        }),
      ),
      tracks: referenceTrackSummaries(source),
    },
  }
}

// ── Measured references ─────────────────────────────────────

/**
 * Measured notes are timed in seconds. The shared stage counts beats, so a
 * measured reference declares one beat per second and the room's existing
 * `secondsToBeat(position, tempo)` maps the audio clock straight onto it. This
 * is a display scale, not a musical claim — no tempo is ever shown for it.
 */
export const MEASURED_REFERENCE_TEMPO = 60

/** Lowest note the six-string stage can show: the guitar's open low E. */
export const GUITAR_LOW_E_MIDI = 40

/** Raise a note by whole octaves until the stage can place it, keeping pitch class. */
export function liftIntoGuitarRange(midi: number): number {
  let lifted = midi
  while (lifted < GUITAR_LOW_E_MIDI) lifted += 12
  return lifted
}

export interface MeasuredReferenceInput {
  sessionId: string
  stemKind: GuitarNightStemKind
  stemLabel: string
  transcription: StemTranscription
}

/**
 * Adapt one stem transcription into a stage reference. Bass sits an octave
 * below the six-string stage, so notes below its low E are raised into range
 * and the surface says so rather than dropping them silently.
 */
export function measuredReferenceFromTranscription(
  input: MeasuredReferenceInput,
): GuitarNightReference {
  const liftedOctaves = input.transcription.notes.some(
    (note) => note.midi < GUITAR_LOW_E_MIDI,
  )

  return {
    kind: 'measured',
    songId: `${input.sessionId}:${input.stemKind}`,
    title: `${input.stemLabel} heard in this recording`,
    trackId: input.stemKind,
    trackName: input.stemLabel,
    tempoBpm: MEASURED_REFERENCE_TEMPO,
    coverage: input.transcription.coverage,
    liftedOctaves,
    notes: melodyToGuitarNotes(
      input.transcription.notes.map((note, index) => ({
        id: `measured-${index}-${note.startSeconds.toFixed(3)}`,
        midi: liftIntoGuitarRange(note.midi),
        // One beat per second: the measured time base, unchanged.
        startBeat: note.startSeconds,
        duration: note.durationSeconds,
      })),
    ),
    tracks: [
      {
        id: input.stemKind,
        name: input.stemLabel,
        noteCount: input.transcription.notes.length,
      },
    ],
  }
}

export interface GuitarNightTranscriptionPort {
  transcribeStem(
    stemUrl: string,
    options: { signal: AbortSignal; onProgress(fraction: number): void },
  ): Promise<StemTranscription>
}
