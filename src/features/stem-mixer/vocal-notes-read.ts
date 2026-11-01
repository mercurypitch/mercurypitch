// ============================================================
// A song's notes, read from its vocal with no mixer on the screen
// ============================================================
//
// The mixer reads a song's notes when the singer turns them or the mic on
// (useStemMixerPitchAnalysisController.ts). First note reads them with no
// mixer up, for a song of the singer's own it reads for its entries
// (first-note/own-song-read.ts), as the mixer reads them: channel 0 of the
// vocal at the mixer's settings, the detector's window kept to the same
// span of time at the rate the walk kept (`windowForStep`). It keeps them
// where the mixer keeps them, so the room shows those notes. The read lives
// here, beside the walk it uses, so that another reader can share it.
//
// THE VOCAL is walked from its own stream, a chunk at a time, as the mixer
// walks it (streamed-vocal-samples.ts). Where the phone cannot stream (no
// AudioDecoder: iOS 16 to 18), it is decoded whole where that fits
// (`readVocal`, `wholeDecodeFits`), with the singer at rest in front of it;
// `walkVocal` walks it and never decodes. A vocal too long for the walk to
// hold is refused before the walk begins.
//
// KEEPING. A read that heard no notes is never kept: it would read back as a
// song the room has read, and stop the room offering to (jam-pitch-
// provision-store.ts).

import { audioDurationSecs } from '@/lib/audio-duration'
import { DECODE_RATE, decodeAudioBytes } from '@/lib/decode-audio-to-mono'
import type { analyzeVocalSamples, VocalAnalysis } from '@/lib/pitch-pipeline'
import { VOCAL_ANALYSIS_DEFAULTS } from '@/lib/pitch-pipeline'
import { openStemStream } from './stem-stream-source'
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
