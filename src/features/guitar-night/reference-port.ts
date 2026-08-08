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
import type { InstrumentTuning, StringedInstrument, } from '@/lib/guitar/instrument-tuning'
import { assignStringForMidi, DEFAULT_BASS_TUNING, DEFAULT_GUITAR_TUNING, fingeringMatchesTuning, liftIntoTuningRange, suggestInstrumentForMidi, } from '@/lib/guitar/instrument-tuning'
import type { MidiSongNote } from '@/lib/midi-song'
import { midiToNote } from '@/lib/scale-data'
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
  /** The instrument these notes were placed on — the rows the stage draws. */
  tuning: InstrumentTuning
  notes: readonly GuitarNote[]
  tracks: readonly GuitarNightReferenceTrack[]
  /** Notes this instrument's neck could not reach, so they were not drawn. */
  outOfRangeNotes: number
  /** Measured only: share of the stem that produced confident notes, 0–1. */
  coverage?: number
  /** Measured only: true when notes were raised into the instrument's range. */
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
    tuning?: InstrumentTuning,
  ): GuitarNightOpenReferenceResult
  /**
   * Which instrument a track reads as, and the track that answer describes.
   * Asked before opening so the stage draws the right rows on the first frame.
   */
  suggestInstrument(
    songId: string,
    trackId?: string,
  ): { trackId: string; instrument: StringedInstrument } | null
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

interface StageNoteInput {
  id: string
  midi: number
  startBeat: number
  duration: number
  stringIndex?: number
  fret?: number
}

/**
 * Place notes on the instrument the stage is actually showing. Authored
 * fingering is an index into *that track's own* tuning, so it is kept only when
 * it describes this instrument; otherwise the note is placed by pitch. A note
 * the neck cannot reach is dropped and counted rather than drawn somewhere it
 * could not be played.
 */
export function toStageNotes(
  inputs: readonly StageNoteInput[],
  tuning: InstrumentTuning,
): { notes: GuitarNote[]; outOfRange: number } {
  const notes: GuitarNote[] = []
  let outOfRange = 0

  for (const input of inputs) {
    const placement = fingeringMatchesTuning(
      input.midi,
      input.stringIndex,
      input.fret,
      tuning,
    )
      ? { stringIndex: input.stringIndex as number, fret: input.fret as number }
      : assignStringForMidi(input.midi, tuning)

    if (placement === null) {
      outOfRange += 1
      continue
    }
    const { name, octave } = midiToNote(input.midi)
    notes.push({
      id: input.id,
      midi: input.midi,
      noteName: `${name}${octave}`,
      stringIndex: placement.stringIndex,
      fret: placement.fret,
      startBeat: input.startBeat,
      duration: input.duration,
      targetFreq: 440 * Math.pow(2, (input.midi - 69) / 12),
    })
  }

  return { notes, outOfRange }
}

/** Adapt one saved score into stage notes. Beats stay in the source's terms. */
export function openGuitarNightReference(
  source: GuitarNightReferenceSource,
  requestedTrackId?: string,
  tuning: InstrumentTuning = DEFAULT_GUITAR_TUNING,
): GuitarNightOpenReferenceResult {
  const track = resolveReferenceTrack(source, requestedTrackId)
  if (track === null) return { ok: false, code: 'no-playable-notes' }

  const tempoBpm =
    Number.isFinite(source.bpm) && source.bpm > 0 ? source.bpm : 120
  const placed = toStageNotes(
    track.notes.map((note, index) => ({
      id: `${track.id}-${index}-${note.startBeat}`,
      midi: note.midi,
      startBeat: note.startBeat,
      duration: note.duration,
      stringIndex: note.stringIndex,
      fret: note.fret,
    })),
    tuning,
  )

  return {
    ok: true,
    reference: {
      kind: 'authored',
      songId: source.id,
      title: source.name,
      trackId: track.id,
      trackName: track.name,
      tempoBpm,
      tuning,
      notes: placed.notes,
      outOfRangeNotes: placed.outOfRange,
      tracks: referenceTrackSummaries(source),
    },
  }
}

/**
 * The instrument a track was most likely written for, from its own pitches, and
 * the track that answer is about — the same track `openGuitarNightReference`
 * would resolve, so the two never disagree.
 */
export function suggestReferenceInstrument(
  source: GuitarNightReferenceSource,
  trackId?: string,
): { trackId: string; instrument: StringedInstrument } | null {
  const track = resolveReferenceTrack(source, trackId)
  if (track === null) return null
  return {
    trackId: track.id,
    instrument: suggestInstrumentForMidi(track.notes.map((note) => note.midi)),
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

export interface MeasuredReferenceInput {
  sessionId: string
  stemKind: GuitarNightStemKind
  stemLabel: string
  transcription: StemTranscription
}

/**
 * Adapt one stem transcription into a stage reference. A bass line read on a
 * bass needs no help; read on a guitar it sits an octave below the lowest
 * string, so notes below range are raised and the surface says so rather than
 * dropping them silently.
 */
export function measuredReferenceFromTranscription(
  input: MeasuredReferenceInput,
  tuning: InstrumentTuning = DEFAULT_BASS_TUNING,
): GuitarNightReference {
  const lowestPlayable = tuning.openMidi[tuning.openMidi.length - 1] ?? 40
  const liftedOctaves = input.transcription.notes.some(
    (note) => note.midi < lowestPlayable,
  )
  const placed = toStageNotes(
    input.transcription.notes.map((note, index) => ({
      id: `measured-${index}-${note.startSeconds.toFixed(3)}`,
      // On a bass this changes nothing; on a guitar it lifts the line into a
      // range the six strings can actually play.
      midi: liftIntoTuningRange(note.midi, tuning),
      // One beat per second: the measured time base, unchanged.
      startBeat: note.startSeconds,
      duration: note.durationSeconds,
    })),
    tuning,
  )

  return {
    kind: 'measured',
    songId: `${input.sessionId}:${input.stemKind}`,
    title: `${input.stemLabel} line transcribed from this recording`,
    trackId: input.stemKind,
    trackName: input.stemLabel,
    tempoBpm: MEASURED_REFERENCE_TEMPO,
    tuning,
    coverage: input.transcription.coverage,
    liftedOctaves,
    notes: placed.notes,
    outOfRangeNotes: placed.outOfRange,
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
