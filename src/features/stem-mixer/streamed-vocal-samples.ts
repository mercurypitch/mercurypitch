// ============================================================
// A streamed vocal's samples, gathered for the pitch analysis
// ============================================================
//
// A phone streams the song (stem-stream-source.ts): what it holds is a few
// seconds of each stem, never the whole, which is what keeps iOS from killing
// the app. It also left the phone with nothing to find a song's notes in,
// because the pitch analysis reads one channel of the whole vocal. So on a
// phone that streams, an imported song never got its pitch guide: only the
// examples showed one, because they carry their notes (bundled-notes.ts)
// (owner, 2026-10-23, mp-v0.8.41 on an iPhone 13 Pro with iOS 27).
//
// The analysis does not need what a whole decode holds, both channels at the
// context's rate. It reads channel 0, at any rate. So this walks the vocal's
// own stream from the start, one decoded chunk at a time, and keeps channel 0
// alone: a quarter of decoding the song whole (one stem of two, one channel
// of two). A long song keeps the average of every second or fourth sample, so
// that what is held stays within STREAMED_ANALYSIS_MAX_BYTES, and the caller
// shrinks the detector's window by the same step so that it spans the same
// time. A song too long even then is refused, in words.
//
// The analysis saves what it finds (session-pitch-analysis-service), so a
// song is walked once, not each time it opens.
//
// Tests: streamed-vocal-samples.test.ts.

import { thisDeviceLower } from '@/lib/device-noun'
import { HOSTED_WHOLE_DECODE_MAX_BYTES } from './stem-memory'
import type { StemStreamChunk } from './streaming-stem-voice'

/**
 * The most a streamed analysis holds: 64 MiB of Float32 samples. That is
 * about six minutes of one channel at 44.1 kHz kept whole, twelve at every
 * second sample and twenty-four at every fourth. The whole decode that iOS
 * killed the app for held about 180 MiB (stem-memory.ts).
 */
export const STREAMED_ANALYSIS_MAX_BYTES = 64 * 1024 * 1024

/** The coarsest step: one kept sample for every four, 11 kHz from 44.1 kHz. */
export const STREAMED_ANALYSIS_MAX_STEP = 4

/** Web Audio's samples are 32-bit floats. */
const BYTES_PER_SAMPLE = 4

/** What a streamed vocal offers the analysis: a `StemStream`, in short. */
export interface StreamedVocalSource {
  readonly sampleRate: number
  readonly durationSeconds: number
  chunks(fromSeconds: number): AsyncIterable<StemStreamChunk>
}

export interface StreamedVocalSamples {
  /** Channel 0, one value per kept step, from the start of the song. */
  readonly samples: Float32Array
  /** The kept samples' rate: the stream's, divided by `step`. */
  readonly sampleRate: number
  /** How many of the stream's samples each kept one stands for: 1, 2 or 4. */
  readonly step: number
}

export interface StreamedVocalRun {
  /** How far through the song the walk is, from 0 to 1. */
  readonly onProgress?: (fraction: number) => void
  readonly signal?: AbortSignal
  /** The ceiling, for a test; STREAMED_ANALYSIS_MAX_BYTES otherwise. */
  readonly maxBytes?: number
}

/**
 * The step a song of this length is gathered at, or null when even the
 * coarsest step would hold more than STREAMED_ANALYSIS_MAX_BYTES, or the
 * stream cannot say how long it is.
 */
export function streamedAnalysisStep(
  durationSeconds: number,
  sampleRate: number,
  maxBytes: number = STREAMED_ANALYSIS_MAX_BYTES,
): number | null {
  if (!(durationSeconds > 0) || !(sampleRate > 0)) return null
  const frames = Math.ceil(durationSeconds * sampleRate)
  for (let step = 1; step <= STREAMED_ANALYSIS_MAX_STEP; step *= 2) {
    if (Math.ceil(frames / step) * BYTES_PER_SAMPLE <= maxBytes) return step
  }
  return null
}

/** Whether a streamed vocal can be gathered for an analysis at all. */
export function canGatherStreamedVocal(source: StreamedVocalSource): boolean {
  return (
    streamedAnalysisStep(source.durationSeconds, source.sampleRate) !== null
  )
}

/**
 * Whether a stem `seconds` long, `bytes` on the device, may be decoded whole
 * at `sampleRate` for a read where the device cannot stream it. A decode
 * holds every channel until it is let go, and cannot keep every second or
 * fourth sample as the walk does, so it is held to the walk's ceiling at its
 * finest step: about six minutes at 44.1 kHz, some 128 MiB for two channels
 * at the peak, under the ~180 MiB iOS killed the app for (stem-memory.ts). A
 * stem whose length the device cannot tell is held to the size the mixer
 * decodes whole.
 */
export function wholeDecodeFits(
  seconds: number | null,
  bytes: number,
  sampleRate: number,
): boolean {
  if (seconds === null) return bytes <= HOSTED_WHOLE_DECODE_MAX_BYTES
  return streamedAnalysisStep(seconds, sampleRate) === 1
}

/** What the analysis says for a song too long to gather. */
export function streamedTooLongMessage(): string {
  return `This song is too long for ${thisDeviceLower()} to find its notes. The music and the lyrics still play.`
}

/**
 * The detector's window for samples kept at `step`: the same span of time as
 * `bufferSize` samples at the stream's own rate, and never under 256.
 */
export function windowForStep(bufferSize: number, step: number): number {
  if (step <= 1) return bufferSize
  return Math.max(256, Math.round(bufferSize / step))
}

function abortError(): Error {
  const error = new Error('The analysis was stopped.')
  error.name = 'AbortError'
  return error
}

/**
 * Channel 0 of a streamed vocal, from its first sample to its last, gathered
 * one decoded chunk at a time. Each chunk is placed by its own timestamp, so
 * a gap the decoder leaves stays silent rather than pulling later audio
 * early, and a chunk that begins before the last one ended keeps what was
 * already there.
 *
 * Throws `streamedTooLongMessage()` for a song too long to hold, and an
 * AbortError when `signal` is aborted. A stream disposed under it (the song
 * changed) throws whatever the decoder throws.
 */
export async function gatherStreamedVocal(
  source: StreamedVocalSource,
  run: StreamedVocalRun = {},
): Promise<StreamedVocalSamples> {
  const step = streamedAnalysisStep(
    source.durationSeconds,
    source.sampleRate,
    run.maxBytes,
  )
  if (step === null) throw new Error(streamedTooLongMessage())
  const throwIfAborted = (): void => {
    if (run.signal !== undefined && run.signal.aborted) throw abortError()
  }
  throwIfAborted()

  const length = Math.ceil((source.durationSeconds * source.sampleRate) / step)
  const samples = new Float32Array(length)

  // The kept sample being built: the average of the stream's samples that
  // fall in it. Chunks arrive in order, so one running sum is enough, and the
  // last frame placed is what an overlapping chunk is measured against.
  let keptIndex = -1
  let sum = 0
  let count = 0
  let lastFrame = -1
  const keep = (): void => {
    if (keptIndex >= 0 && keptIndex < length && count > 0) {
      samples[keptIndex] = sum / count
    }
    sum = 0
    count = 0
  }

  for await (const chunk of source.chunks(0)) {
    throwIfAborted()
    const data = chunk.buffer.getChannelData(0)
    const chunkRate = chunk.buffer.sampleRate
    // Usually 1: the decoder answers at the stream's own rate.
    const ratio = source.sampleRate / chunkRate
    const firstFrame = Math.round(
      Math.max(0, chunk.timestamp) * source.sampleRate,
    )
    for (let i = 0; i < data.length; i += 1) {
      const frame = firstFrame + Math.floor(i * ratio)
      // Already placed: this chunk began before the last one ended.
      if (frame <= lastFrame) continue
      const index = Math.floor(frame / step)
      if (index >= length) break
      lastFrame = frame
      if (index !== keptIndex) {
        keep()
        keptIndex = index
      }
      sum += data[i]
      count += 1
    }
    const reached = Math.max(0, chunk.timestamp) + data.length / chunkRate
    run.onProgress?.(Math.min(1, reached / source.durationSeconds))
  }
  keep()
  throwIfAborted()
  run.onProgress?.(1)

  return { samples, sampleRate: source.sampleRate / step, step }
}
