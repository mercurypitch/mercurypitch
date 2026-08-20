// ============================================================
// An authored score, read on the recording's own clock
// ============================================================
//
// Phase 2 of `docs/plans/score-recording-sync.md`.
//
// Two things about the same song can already be attached to the room: a tab
// somebody wrote, counting musical beats, and a line measured from a separated
// stem, counting seconds of a recording. They are the same music and they have
// never been able to sit on the same page, because their clocks mean different
// things.
//
// The stem measurement is the bridge. It is a transcription of the recording,
// so it is already on the recording's clock, and the alignment matcher can say
// where each part of the written score lands against it. Put the written notes
// through that map and the tab is on the record: same page, same playhead, and
// the reader gets the part as it was written rather than as a pitch detector
// heard it.
//
// What comes back is an ordinary measured reference — one beat per second, the
// recording's time base — so every surface that can already draw a measured
// line draws this with no changes at all.

import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { createBeatClock } from '@/lib/midi-song'
import type { ScoreAlignment } from '@/lib/transcription/score-alignment'
import { alignmentDriftSeconds, alignmentFromWindowOffsets, createScoreToAudioClock, } from '@/lib/transcription/score-alignment'
import type { StemTranscription } from '@/lib/transcription/stem-transcription'
import type { ScorableNote } from '@/lib/transcription/transcription-score'
import { scoreAgainstTruth } from '@/lib/transcription/transcription-score'
import type { GuitarNightReference, GuitarNightReferenceSource, GuitarNightReferenceSourceTrack, } from './reference-port'
import { MEASURED_REFERENCE_TEMPO, placeReferenceTrack } from './reference-port'

/**
 * How close a written note and a heard note must land to count as the same
 * note while measuring the alignment.
 *
 * Generous on purpose. This tolerance is not judging the transcription — the
 * Lab does that with a tighter one — it is only deciding which offset lines
 * the two up, and a strummed chord's notes are spread across most of this
 * window before anything has gone wrong.
 */
export const ALIGNMENT_TOLERANCE_SECONDS = 0.12

/**
 * Below this share of the written notes finding a partner, the alignment is
 * not a measurement of anything.
 *
 * A tab of a different song, or of a different arrangement, still produces
 * offsets — the matcher always returns its best guess. Refusing outright is
 * the honest answer, because a confidently wrong alignment reads to a player
 * as their own timing being wrong.
 */
export const MIN_ALIGNMENT_MATCH_FRACTION = 0.25

export interface ScoreRecordingFit {
  alignment: ScoreAlignment
  /** Share of the written notes that found a partner in the recording, 0–1. */
  matchedFraction: number
  /** Seconds the two clocks drift apart from first anchor to last. */
  driftSeconds: number
}

export type AlignScoreResult =
  | { ok: true; fit: ScoreRecordingFit }
  | { ok: false; code: 'no-notes' | 'no-anchors' | 'no-agreement' }

/** The written track, in score seconds, which is what the matcher compares. */
export function scorableNotesFromTrack(
  source: GuitarNightReferenceSource,
  track: GuitarNightReferenceSourceTrack,
): ScorableNote[] {
  const beatToSeconds = createBeatClock({
    bpm: source.bpm,
    ...(source.tempoChanges === undefined
      ? {}
      : { tempoChanges: source.tempoChanges }),
  })
  return track.notes
    .filter(
      (note) => Number.isFinite(note.midi) && Number.isFinite(note.startBeat),
    )
    .map((note) => ({
      midi: note.midi,
      startSeconds: beatToSeconds(note.startBeat),
    }))
    .sort((left, right) => left.startSeconds - right.startSeconds)
}

/** What was heard, which is already on the recording's clock. */
export function scorableNotesFromTranscription(
  transcription: StemTranscription,
): ScorableNote[] {
  return transcription.notes
    .filter(
      (note) =>
        Number.isFinite(note.midi) && Number.isFinite(note.startSeconds),
    )
    .map((note) => ({ midi: note.midi, startSeconds: note.startSeconds }))
}

/**
 * Measure how a written track sits against a recording of it.
 *
 * The matcher does the work — this only feeds it the two note lists on
 * comparable clocks and reads the result as an alignment plus enough evidence
 * to refuse a bad one.
 */
export function alignScoreToRecording(
  source: GuitarNightReferenceSource,
  trackId: string,
  transcription: StemTranscription,
): AlignScoreResult {
  const track = source.tracks.find((candidate) => candidate.id === trackId)
  const truth = track === undefined ? [] : scorableNotesFromTrack(source, track)
  const heard = scorableNotesFromTranscription(transcription)
  if (truth.length === 0 || heard.length === 0)
    return { ok: false, code: 'no-notes' }

  const scored = scoreAgainstTruth(heard, truth, ALIGNMENT_TOLERANCE_SECONDS)
  const alignment = alignmentFromWindowOffsets(scored.windowOffsets)
  if (alignment.anchors.length === 0) return { ok: false, code: 'no-anchors' }

  // Recall against the written part, not precision against what was heard: a
  // stem holds notes the tab never claimed, and that is not the tab being
  // wrong. What matters is how much of the written part the recording confirms.
  // `truth` is non-empty by the guard above, so `truthCount` cannot be zero.
  const matchedFraction = 1 - scored.missed / scored.truthCount
  if (matchedFraction < MIN_ALIGNMENT_MATCH_FRACTION) {
    return { ok: false, code: 'no-agreement' }
  }

  return {
    ok: true,
    fit: {
      alignment,
      matchedFraction,
      driftSeconds: alignmentDriftSeconds(alignment),
    },
  }
}

export interface ScoreOnRecordingOptions {
  tuning?: InstrumentTuning
  /** Names the recording in the reference's identity, so takes stay separable. */
  backingSessionId?: string
  /** Shown as the reference title; the room says which recording this is. */
  recordingLabel?: string
}

/**
 * The written track, placed on the recording's clock.
 *
 * The result is an ordinary measured reference: one beat per second, no tempo
 * shown, because there is no musical tempo to claim once the notes are pinned
 * to a recording that speeds up and slows down. It keeps the score's own
 * fingering — this is the part as written, which is the whole point of reading
 * it instead of the transcription.
 */
export function scoreOnRecording(
  source: GuitarNightReferenceSource,
  trackId: string,
  alignment: ScoreAlignment,
  options: ScoreOnRecordingOptions = {},
): GuitarNightReference | null {
  const track = source.tracks.find((candidate) => candidate.id === trackId)
  if (track === undefined) return null

  const beatToSeconds = createBeatClock({
    bpm: source.bpm,
    ...(source.tempoChanges === undefined
      ? {}
      : { tempoChanges: source.tempoChanges }),
  })
  const toRecording = createScoreToAudioClock(alignment)

  // A note's length has to travel through the map as well as its start: the
  // recording runs at a different rate, so holding the written duration would
  // leave every note the wrong length by exactly the drift.
  const onRecording = track.notes
    .filter(
      (note) => Number.isFinite(note.midi) && Number.isFinite(note.startBeat),
    )
    .map((note, index) => {
      const startSeconds = toRecording(beatToSeconds(note.startBeat))
      const endSeconds = toRecording(
        beatToSeconds(note.startBeat + Math.max(0, note.duration)),
      )
      return {
        ...note,
        id: note.id ?? `on-recording-${index}`,
        startBeat: startSeconds,
        duration: Math.max(0, endSeconds - startSeconds),
      }
    })
    .filter((note) => Number.isFinite(note.startBeat) && note.startBeat >= 0)
    .sort((left, right) => left.startBeat - right.startBeat)

  const tuning = options.tuning ?? DEFAULT_GUITAR_TUNING
  const placed = placeReferenceTrack(
    { ...track, notes: onRecording },
    { tuning },
  )

  return {
    kind: 'measured',
    songId: `${source.id}:${trackId}:on-recording`,
    title:
      options.recordingLabel === undefined
        ? `${source.name} on this recording`
        : `${source.name} on ${options.recordingLabel}`,
    trackId,
    trackName: track.name,
    tempoBpm: MEASURED_REFERENCE_TEMPO,
    ...(options.backingSessionId === undefined
      ? {}
      : { backingSessionId: options.backingSessionId }),
    tuning: placed.tuning,
    notes: placed.notes,
    outOfRangeNotes: placed.outOfRangeNotes,
    ...(placed.sourceTuning === undefined
      ? {}
      : { sourceTuning: placed.sourceTuning }),
    tracks: source.tracks.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      noteCount: candidate.noteCount,
    })),
  }
}

// ── Placing the anchors by hand ──────────────────────────────
//
// Phase 3. The matcher needs a transcription of this recording, and there is
// not always one: a live version, a cover, a song whose stems were never
// separated. A reader can still hang the part themselves, and the data shape
// does not change — a marked moment is an anchor.
//
// Two marks rather than a scrub-and-drag surface, because two marks need no
// new interaction: play to the part's first note and say so, play to its last
// note and say so. That is the same gesture the room already uses to set a
// loop's A and B, and it is enough to fix both the offset and the rate.

/** Where a part's first and last notes fall on the score's own clock. */
export interface ScoreSpanSeconds {
  firstSeconds: number
  lastSeconds: number
}

/** Moments in the recording a reader has marked, either or both. */
export interface RecordingMarks {
  firstAudioSeconds?: number
  lastAudioSeconds?: number
}

/**
 * Two marks closer together than this cannot fix a rate.
 *
 * They can still fix an offset, so the near-coincident case falls back to the
 * first mark alone rather than being refused: a reader who taps twice by
 * accident gets the shift they asked for, not an error and not a tab stretched
 * across a rounding difference.
 */
const MIN_MARK_SPREAD_SECONDS = 1

export function scoreSpanSeconds(
  source: GuitarNightReferenceSource,
  trackId: string,
): ScoreSpanSeconds | null {
  const track = source.tracks.find((candidate) => candidate.id === trackId)
  if (track === undefined) return null
  const notes = scorableNotesFromTrack(source, track)
  const first = notes[0]
  const last = notes[notes.length - 1]
  if (first === undefined || last === undefined) return null
  return { firstSeconds: first.startSeconds, lastSeconds: last.startSeconds }
}

/**
 * An alignment from the moments a reader marked.
 *
 * One mark is a constant shift, which is all one point can claim. Two marks
 * far enough apart give a rate as well, which is what a tab that drifts needs
 * — and drift is the usual reason somebody is doing this by hand.
 */
export function alignmentFromMarks(
  span: ScoreSpanSeconds,
  marks: RecordingMarks,
): ScoreAlignment | null {
  const first = marks.firstAudioSeconds
  const last = marks.lastAudioSeconds
  const usableFirst = first !== undefined && Number.isFinite(first)
  const usableLast = last !== undefined && Number.isFinite(last)
  if (!usableFirst && !usableLast) return null

  // A lone end mark still pins the part, just from the other end.
  if (!usableFirst) {
    return {
      source: 'manual',
      anchors: [
        { audioSeconds: last as number, scoreSeconds: span.lastSeconds },
      ],
    }
  }
  const startAnchor = {
    audioSeconds: first as number,
    scoreSeconds: span.firstSeconds,
  }
  if (!usableLast) return { source: 'manual', anchors: [startAnchor] }

  const spreadInRecording = (last as number) - (first as number)
  const spreadInScore = span.lastSeconds - span.firstSeconds
  if (
    spreadInRecording < MIN_MARK_SPREAD_SECONDS ||
    spreadInScore < MIN_MARK_SPREAD_SECONDS
  ) {
    return { source: 'manual', anchors: [startAnchor] }
  }

  return {
    source: 'manual',
    anchors: [
      startAnchor,
      { audioSeconds: last as number, scoreSeconds: span.lastSeconds },
    ],
  }
}
