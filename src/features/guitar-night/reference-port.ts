// Guitar Night reference ports describe verified authored scores, never invented ones.
// ============================================================
//
// A reference is the score axis of a rehearsal: the authored notes the stage
// may display. It stays independent from the backing axis (separated stems),
// so either can be used alone. Only values the source really carries are
// exposed — tempo, tracks, authored fingering, notation and source setup flow
// through when an import carried them; plain MIDI and measured audio remain
// deliberately silent about details they cannot prove.

import type { GuitarNoteNotation } from '@/lib/guitar/guitar-notation'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import type { InstrumentTuning, StringedInstrument, } from '@/lib/guitar/instrument-tuning'
import { assignStringForMidi, DEFAULT_BASS_TUNING, DEFAULT_GUITAR_TUNING, fingeringMatchesTuning, instrumentTuningFromSource, liftIntoTuningRange, MAX_PLAYABLE_FRET, suggestInstrumentForMidi, } from '@/lib/guitar/instrument-tuning'
import type { MidiSongNote, MidiTempoChange } from '@/lib/midi-song'
import { midiToNote } from '@/lib/scale-data'
import type { StemTranscription } from '@/lib/transcription/stem-transcription'
import type { GuitarNightStemKind } from './song-port'

/** The minimal saved-song shape a reference is read from. */
export interface GuitarNightReferenceSourceTrack {
  id: string
  name: string
  instrumentName?: string
  noteCount: number
  notes: readonly MidiSongNote[]
  sourceTuning?: readonly number[]
  sourceTuningName?: string
  sourceCapo?: number
}

export interface GuitarNightReferenceSource {
  id: string
  name: string
  bpm: number
  /** Every authored tempo event, when the imported source retained a map. */
  tempoChanges?: readonly MidiTempoChange[]
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
  /** Authored only: tempo events in the score's beat time. */
  tempoChanges?: readonly MidiTempoChange[]
  /** Measured only: the backing session whose stem produced these notes. */
  backingSessionId?: string
  /** The instrument these notes were placed on — the rows the stage draws. */
  tuning: InstrumentTuning
  /** The source-authored setup, even when the player chose different rows. */
  sourceTuning?: InstrumentTuning
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
  ): {
    trackId: string
    instrument: StringedInstrument
    sourceTuning?: InstrumentTuning
  } | null
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
  authoredFingering?: boolean
  notation?: GuitarNoteNotation
}

function sameTuning(left: InstrumentTuning, right: InstrumentTuning): boolean {
  return (
    left.instrument === right.instrument &&
    (left.capo ?? 0) === (right.capo ?? 0) &&
    left.openMidi.length === right.openMidi.length &&
    left.openMidi.every((midi, index) => midi === right.openMidi[index])
  )
}

function authoredFingeringFitsRows(
  input: StageNoteInput,
  tuning: InstrumentTuning,
): input is StageNoteInput & { stringIndex: number; fret: number } {
  return (
    input.stringIndex !== undefined &&
    input.fret !== undefined &&
    input.stringIndex >= 0 &&
    input.stringIndex < tuning.openMidi.length &&
    input.fret >= 0 &&
    input.fret <= MAX_PLAYABLE_FRET
  )
}

function notationWithLegacyLetRing(
  note: MidiSongNote,
): GuitarNoteNotation | undefined {
  if (note.letRing !== true) return note.notation
  const techniques = note.notation?.techniques ?? []
  if (techniques.some((technique) => technique.kind === 'let-ring')) {
    return note.notation
  }
  return {
    ...note.notation,
    techniques: [...techniques, { kind: 'let-ring' }],
  }
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
  trustAuthoredFingering = false,
): { notes: GuitarNote[]; outOfRange: number } {
  const notes: GuitarNote[] = []
  let outOfRange = 0

  for (const input of inputs) {
    const placement =
      trustAuthoredFingering &&
      input.authoredFingering === true &&
      authoredFingeringFitsRows(input, tuning)
        ? { stringIndex: input.stringIndex, fret: input.fret }
        : fingeringMatchesTuning(
              input.midi,
              input.stringIndex,
              input.fret,
              tuning,
            )
          ? {
              stringIndex: input.stringIndex as number,
              fret: input.fret as number,
            }
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
      ...(input.notation === undefined ? {} : { notation: input.notation }),
    })
  }

  return { notes, outOfRange }
}

/** Adapt one saved score into stage notes. Beats stay in the source's terms. */
export function openGuitarNightReference(
  source: GuitarNightReferenceSource,
  requestedTrackId?: string,
  tuning?: InstrumentTuning,
): GuitarNightOpenReferenceResult {
  const track = resolveReferenceTrack(source, requestedTrackId)
  if (track === null) return { ok: false, code: 'no-playable-notes' }

  const instrument = sourceTrackInstrument(track)
  const sourceTuning = sourceTuningForTrack(track, instrument)
  const stageTuning = tuning ?? sourceTuning ?? DEFAULT_GUITAR_TUNING

  const tempoBpm =
    Number.isFinite(source.bpm) && source.bpm > 0 ? source.bpm : 120
  const placed = toStageNotes(
    track.notes.map((note, index) => ({
      id: note.id ?? `${track.id}-${index}-${note.startBeat}`,
      midi: note.midi,
      startBeat: note.startBeat,
      duration: note.duration,
      stringIndex: note.stringIndex,
      fret: note.fret,
      authoredFingering: note.authoredFingering,
      notation: notationWithLegacyLetRing(note),
    })),
    stageTuning,
    sourceTuning !== undefined && sameTuning(sourceTuning, stageTuning),
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
      tempoChanges: source.tempoChanges,
      tuning: stageTuning,
      ...(sourceTuning === undefined ? {} : { sourceTuning }),
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
): {
  trackId: string
  instrument: StringedInstrument
  sourceTuning?: InstrumentTuning
} | null {
  const track = resolveReferenceTrack(source, trackId)
  if (track === null) return null
  const instrument = sourceTrackInstrument(track)
  const sourceTuning = sourceTuningForTrack(track, instrument)
  return {
    trackId: track.id,
    instrument,
    ...(sourceTuning === undefined ? {} : { sourceTuning }),
  }
}

function sourceTrackInstrument(
  track: GuitarNightReferenceSourceTrack,
): StringedInstrument {
  const instrumentName = track.instrumentName?.toLowerCase() ?? ''
  if (instrumentName.includes('bass')) return 'bass'
  if (instrumentName.includes('guitar')) return 'guitar'
  if (track.sourceTuning !== undefined && track.sourceTuning.length > 0) {
    // Extended guitars and extended basses can share the same string count;
    // their highest open string is the reliable distinction in source setup.
    const highestOpen = Math.max(...track.sourceTuning)
    if (highestOpen >= 57) return 'guitar'
    if (highestOpen <= 55) return 'bass'
  }
  return suggestInstrumentForMidi(track.notes.map((note) => note.midi))
}

function sourceTuningForTrack(
  track: GuitarNightReferenceSourceTrack,
  instrument: StringedInstrument,
): InstrumentTuning | undefined {
  if (track.sourceTuning === undefined) return undefined
  return (
    instrumentTuningFromSource(instrument, track.sourceTuning, {
      name: track.sourceTuningName,
      capo: track.sourceCapo,
    }) ?? undefined
  )
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
  const lowestPlayable =
    (tuning.openMidi[tuning.openMidi.length - 1] ?? 40) + (tuning.capo ?? 0)
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
    backingSessionId: input.sessionId,
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

/** Return measured evidence only when it belongs to the recording in the room. */
export function measuredReferenceForBacking(
  reference: GuitarNightReference | null,
  sessionId: string | null,
): GuitarNightReference | null {
  if (
    reference === null ||
    reference.kind !== 'measured' ||
    sessionId === null ||
    reference.backingSessionId !== sessionId
  ) {
    return null
  }
  return reference
}

export interface GuitarNightTranscriptionPort {
  transcribeStem(
    stemUrl: string,
    options: { signal: AbortSignal; onProgress(fraction: number): void },
  ): Promise<StemTranscription>
}
