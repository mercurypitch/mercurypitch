// ============================================================
// A song's notes, read from its vocal with no mixer on the screen
// ============================================================
//
// The mixer reads a song's notes when the singer turns them or the mic on
// (useStemMixerPitchAnalysisController.ts). Two readers do it with no mixer
// up: First note, for a song of the singer's own it reads for its entries
// (first-note/own-song-read.ts), and the Karaoke room at rest, so that Find
// by singing knows each song (karaoke-room/karaoke-notes-reader.ts). Both
// read as the mixer reads: channel 0 of the vocal at the mixer's settings,
// the detector's window kept to the same span of time at the rate the walk
// kept (`windowForStep`). Both keep what they read where the mixer keeps it,
// so the room shows those notes and Find by singing finds the song.
//
// THE VOCAL is walked from its own stream, a chunk at a time, as the mixer
// walks it (streamed-vocal-samples.ts). Where the phone cannot stream (no
// AudioDecoder: iOS 16 to 18), First note decodes it whole where that fits
// (`readVocal`, `wholeDecodeFits`), with the singer at rest in front of it.
// A read that nobody asked for never decodes whole (`walkVocal`): a whole
// decode is what iOS killed the app for (stem-memory.ts). It reads from a
// stream or not at all, and a vocal too long for the walk to hold is
// refused before the walk begins.
//
// KEEPING. A read that heard no notes is never kept: it would read back as a
// song the room has read, and stop the room offering to (jam-pitch-
// provision-store.ts). A read nobody asked for also looks again before it
// keeps anything. The save replaces the whole record (session-pitch-
// analysis-service.ts), so a record that appeared while it read is the
// mixer's or the singer's, edits and all, and is left as it is; and a song
// removed meanwhile must not have a record left behind it.
//
// Every wait honours the read's AbortSignal, and a read stopped keeps
// nothing.

import type { SessionPitchData } from '@/db/services/session-pitch-analysis-service'
import { hasPitchAnalysisInDbStrict, savePitchAnalysisToDbStrict, } from '@/db/services/session-pitch-analysis-service'
import { getStemBlob } from '@/db/services/uvr-service'
import { audioDurationSecs } from '@/lib/audio-duration'
import { DECODE_RATE, decodeAudioBytes } from '@/lib/decode-audio-to-mono'
import type { VocalAnalysis } from '@/lib/pitch-pipeline'
import { analyzeVocalSamples, pitchHistoryFromNotes, VOCAL_ANALYSIS_DEFAULTS, } from '@/lib/pitch-pipeline'
import { getUvrSession } from '@/stores/uvr-store'
import { canStreamStems, openStemStream } from './stem-stream-source'
import { canGatherStreamedVocal, gatherStreamedVocal, streamedAnalysisStep, wholeDecodeFits, windowForStep, } from './streamed-vocal-samples'

/** The vocal, mono: what `gatherStreamedVocal` gives, or a whole decode's. */
export interface VocalStem {
  readonly samples: Float32Array
  readonly sampleRate: number
  /** The stream's samples each kept one stands for (1 for a decode). */
  readonly step: number
}

/** Samples, and the rate they are at. */
export interface RatedSamples {
  readonly samples: Float32Array
  readonly rate: number
}

/** Why the vocal was not walked: too long to hold, or no stream to walk. */
export type VocalOut = 'too-long' | 'no-stream'

export interface VocalWalk {
  /** How far the walk or the decode is, from 0 to 1. */
  readonly onProgress: (fraction: number) => void
  readonly signal?: AbortSignal
}

/** The analysis, and the keeping of a read that heard notes. */
export interface NotesEdges<K> {
  readonly analyze: typeof analyzeVocalSamples
  /** Keep the read; called only for one with notes in it. */
  readonly keep: (sessionId: string, analysis: VocalAnalysis) => Promise<K>
}

export interface NotesRun {
  readonly signal?: AbortSignal
  /** How far the pitch read is, from 0 to 100. */
  readonly onProgress?: (percent: number) => void
}

/** What a read nobody asked for came to. */
export type SongNotesRead =
  /** Read and kept: how many notes, and how long the read took, s. */
  | { readonly kind: 'kept'; readonly notes: number; readonly seconds: number }
  /** A record of its notes was there already: nothing read. */
  | { readonly kind: 'had-notes' }
  /** A record of its notes appeared while it was read: nothing kept. */
  | { readonly kind: 'appeared' }
  /** The song left the phone while it was read: nothing kept. */
  | { readonly kind: 'gone' }
  /** No vocal to read. */
  | { readonly kind: 'no-vocal' }
  /** The vocal would not open as a stream, and nothing is decoded whole. */
  | { readonly kind: 'no-stream' }
  /** Too long for this phone to hold: the vocal's size, bytes. */
  | { readonly kind: 'too-long'; readonly bytes: number }
  /** Read, and no notes heard in it: nothing kept. How long it took, s. */
  | { readonly kind: 'no-notes'; readonly seconds: number }

export interface SongNotesRun {
  readonly signal?: AbortSignal
  /** How far the read is, 0 to 100, rounded, and only ever forward. */
  readonly onProgress?: (percent: number) => void
  /** The vocal; the stem kept on the phone when none is given. */
  readonly vocal?: () => Promise<Blob | null>
}

/** The read's impure edges, swappable for a test. */
export interface VocalNotesSeams {
  /** Whether a record of the song's notes is there; throws on a failed read. */
  readonly hasRecord: (sessionId: string) => Promise<boolean>
  /** Keep the notes where the mixer keeps them; throws when they were not. */
  readonly save: (sessionId: string, data: SessionPitchData) => Promise<void>
  /** Whether the song is still on the phone. */
  readonly exists: (sessionId: string) => boolean
  readonly analyze: typeof analyzeVocalSamples
  /** The time, ms. */
  readonly now: () => number
}

/** The share of a read's progress the walk takes: most of the wait. */
const WALK_SHARE = 35

function abortError(): Error {
  const error = new Error('The read was stopped.')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw abortError()
}

/**
 * `samples` at `rate` kept at about `target`: each kept sample the mean of
 * a whole number of them. First note reads the voice at VOCAL_RATE and the
 * band at BAND_RATE; a phone's stems are at 44.1 or 48 kHz.
 */
export function keepNear(
  samples: Float32Array,
  rate: number,
  target: number,
): RatedSamples {
  const step = Math.max(1, Math.round(rate / target))
  if (step === 1) return { samples, rate }
  const kept = new Float32Array(Math.floor(samples.length / step))
  for (let i = 0; i < kept.length; i++) {
    let sum = 0
    for (let j = 0; j < step; j++) sum += samples[i * step + j]
    kept[i] = sum / step
  }
  return { samples: kept, rate: rate / step }
}

/**
 * A stem decoded whole, where it fits as the walk's ceiling allows
 * (`wholeDecodeFits`): null where it does not.
 */
export async function decodeWhole(
  blob: Blob,
  signal: AbortSignal | undefined,
): Promise<AudioBuffer | null> {
  // A decode cannot be stopped once it starts, so a read let go while the
  // length is probed or the bytes load starts none.
  const seconds = await audioDurationSecs(blob, signal)
  throwIfAborted(signal)
  if (!wholeDecodeFits(seconds, blob.size, DECODE_RATE)) return null
  const bytes = await blob.arrayBuffer()
  throwIfAborted(signal)
  return await decodeAudioBytes(bytes)
}

/**
 * The vocal decoded whole, kept as the walk keeps it: channel 0, at the
 * walk's step for its length (`streamedAnalysisStep`). Null when too long.
 */
async function decodeVocal(
  blob: Blob,
  signal: AbortSignal | undefined,
): Promise<VocalStem | null> {
  const whole = await decodeWhole(blob, signal)
  if (whole === null) return null
  const step = streamedAnalysisStep(whole.duration, whole.sampleRate)
  if (step === null) return null
  const kept = keepNear(
    whole.getChannelData(0),
    whole.sampleRate,
    whole.sampleRate / step,
  )
  return { samples: kept.samples, sampleRate: kept.rate, step }
}

/**
 * The vocal, mono, walked from its own stream; else why not: a phone that
 * cannot open it as a stream, or a vocal too long for the walk to hold.
 * Nothing is decoded whole. Throws an AbortError when `run.signal` aborts.
 */
export async function walkVocal(
  blob: Blob,
  run: VocalWalk,
): Promise<VocalStem | VocalOut> {
  const stream = await openStemStream(blob)
  if (stream === null) return 'no-stream'
  try {
    // Refused before the walk: a song this long would be more than the walk
    // may hold, and the stream says how long it is without decoding it.
    if (!canGatherStreamedVocal(stream)) return 'too-long'
    return await gatherStreamedVocal(stream, {
      onProgress: run.onProgress,
      signal: run.signal,
    })
  } finally {
    stream.dispose()
  }
}

/**
 * The vocal, mono, for a reader the singer waits on: walked, or where this
 * phone cannot stream, decoded whole where that fits. Null when it is too
 * long for this phone to hold.
 */
export async function readVocal(
  blob: Blob,
  run: VocalWalk,
): Promise<VocalStem | null> {
  const walked = await walkVocal(blob, run)
  if (walked === 'no-stream') return await decodeVocal(blob, run.signal)
  return walked === 'too-long' ? null : walked
}

/**
 * The vocal read for its notes as the mixer reads it, and kept by
 * `edges.keep` when it heard any: an empty read is never kept, or it would
 * read back as a song the room has read and stop the room offering to read
 * it (jam-pitch-provision-store.ts). What `keep` said comes back with the
 * analysis: null for an empty read. Throws an AbortError when `run.signal`
 * aborts, keeping nothing.
 */
export async function notesOf<K>(
  sessionId: string,
  vocal: VocalStem,
  edges: NotesEdges<K>,
  run: NotesRun,
): Promise<{ readonly analysis: VocalAnalysis; readonly kept: K | null }> {
  const analysis = await edges.analyze(
    vocal.samples,
    vocal.sampleRate,
    // The same span of time at the rate the samples were kept at.
    {
      bufferSize: windowForStep(VOCAL_ANALYSIS_DEFAULTS.bufferSize, vocal.step),
    },
    { signal: run.signal, onProgress: run.onProgress },
  )
  throwIfAborted(run.signal)
  if (analysis.segmentedNotes.length === 0) return { analysis, kept: null }
  return { analysis, kept: await edges.keep(sessionId, analysis) }
}

const realSeams: VocalNotesSeams = {
  hasRecord: (sessionId) => hasPitchAnalysisInDbStrict(sessionId),
  save: (sessionId, data) => savePitchAnalysisToDbStrict(sessionId, data),
  exists: (sessionId) => getUvrSession(sessionId) !== undefined,
  analyze: analyzeVocalSamples,
  now: () => performance.now(),
}

let seams: VocalNotesSeams = realSeams

/** Swap the impure edges. Tests only; `null` puts the real ones back. */
export function setVocalNotesSeams(
  next: Partial<VocalNotesSeams> | null,
): void {
  seams = next === null ? realSeams : { ...realSeams, ...next }
}

/**
 * Whether this phone can read a song's notes with nobody asking: only where
 * it streams, since such a read never decodes a vocal whole.
 */
export function canReadNotesUnasked(): boolean {
  return canStreamStems()
}

/**
 * Keep `analysis` as the song's notes, unless a record of them appeared
 * while it was read (the mixer's or the singer's, kept as it is) or the
 * song left the phone meanwhile (no record left behind it).
 */
async function keepUnlessTaken(
  sessionId: string,
  analysis: VocalAnalysis,
  signal: AbortSignal | undefined,
): Promise<'kept' | 'appeared' | 'gone'> {
  if (await seams.hasRecord(sessionId)) return 'appeared'
  throwIfAborted(signal)
  // Asked after the look, which waits on the store: the song may have gone
  // while the pitch read ran, or in that wait.
  if (!seams.exists(sessionId)) return 'gone'
  await seams.save(sessionId, {
    mergedNotes: analysis.mergedNotes,
    segmentedNotes: analysis.segmentedNotes,
    pitchHistory: pitchHistoryFromNotes(analysis.segmentedNotes),
  })
  return 'kept'
}

/** Progress as a reader shows it: whole percents, only ever forward. */
function forwardOnly(
  onProgress: ((percent: number) => void) | undefined,
): (percent: number) => void {
  let shown = -1
  return (percent) => {
    const rounded = Math.max(0, Math.min(100, Math.round(percent)))
    if (rounded <= shown) return
    shown = rounded
    onProgress?.(rounded)
  }
}

/**
 * Read one song's notes with nobody asking, and keep them: the Karaoke
 * room's read at rest. A song with a record of its notes is not read; the
 * vocal is read from its stream only; nothing is kept from an empty read,
 * over a record that appeared meanwhile, or for a song that has gone. Throws
 * an AbortError when `run.signal` aborts, keeping nothing, and the cause
 * when the song cannot be read (a store that will not answer, a stream that
 * breaks).
 */
export async function readSongNotes(
  sessionId: string,
  run: SongNotesRun = {},
): Promise<SongNotesRead> {
  const { signal } = run
  const started = seams.now()
  const report = forwardOnly(run.onProgress)
  throwIfAborted(signal)
  if (await seams.hasRecord(sessionId)) return { kind: 'had-notes' }
  throwIfAborted(signal)
  const blob = await (run.vocal ?? (() => getStemBlob(sessionId, 'vocal')))()
  throwIfAborted(signal)
  if (blob === null) return { kind: 'no-vocal' }
  report(0)

  const vocal = await walkVocal(blob, {
    signal,
    onProgress: (fraction) => report(fraction * WALK_SHARE),
  })
  throwIfAborted(signal)
  if (vocal === 'no-stream') return { kind: 'no-stream' }
  if (vocal === 'too-long') return { kind: 'too-long', bytes: blob.size }

  const { analysis, kept } = await notesOf(
    sessionId,
    vocal,
    {
      analyze: seams.analyze,
      keep: (id, read) => keepUnlessTaken(id, read, signal),
    },
    {
      signal,
      onProgress: (percent) =>
        report(WALK_SHARE + (percent * (100 - WALK_SHARE)) / 100),
    },
  )
  const seconds = (seams.now() - started) / 1000
  if (kept === null) return { kind: 'no-notes', seconds }
  if (kept !== 'kept') return { kind: kept }
  report(100)
  return { kind: 'kept', notes: analysis.segmentedNotes.length, seconds }
}
