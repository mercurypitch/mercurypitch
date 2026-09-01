// ============================================================
// Loading a stem for streamed playback
// ============================================================
//
// The buffered path is one call: `decodeAudioData` returns every sample and
// the same AudioBuffer serves playback and the waveform. The streamed path
// splits those two jobs, so loading it means doing two things instead:
//
//   1. open the compressed bytes as a stream (mediabunny, WebCodecs);
//   2. walk it once to build the waveform's peak envelope and learn the
//      song's exact length.
//
// Pass 2 decodes the whole stem, but never holds more than a packet: each
// chunk is folded into the envelope and dropped. It costs about what
// `decodeAudioData` cost in wall-clock and a thousandth of it in memory.
//
// Playback then opens its own iteration over the same stream, a few seconds
// at a time — see `streaming-stem-voice.ts`.

import type { PeakEnvelope } from './stem-peak-envelope'
import { createPeakEnvelopeBuilder, DEFAULT_PEAK_ENVELOPE_RATE, peakEnvelopeToAudioBuffer, } from './stem-peak-envelope'
import type { StemStream } from './stem-stream-source'
import { openStemStream } from './stem-stream-source'

export interface StreamedStem {
  readonly stream: StemStream
  /** Mono peak envelope, for every consumer that reads `track.buffer`. */
  readonly displayBuffer: AudioBuffer
  readonly durationSeconds: number
  readonly sampleRate: number
  readonly channelCount: number
  /** What the display half costs. Playback's cost is its window, not this. */
  readonly displayBytes: number
}

export interface LoadStreamedStemOptions {
  readonly context: BaseAudioContext
  /** The compressed file, already downloaded or read from the audio cache. */
  readonly blob: Blob
  readonly peakSampleRate?: number
  /** Injectable for the tests. */
  readonly open?: (blob: Blob) => Promise<StemStream | null>
}

/**
 * Returns null when this file or this platform cannot be streamed, which is
 * the caller's signal to fall back to `decodeAudioData`.
 */
export async function loadStreamedStem(
  options: LoadStreamedStemOptions,
): Promise<StreamedStem | null> {
  const open = options.open ?? openStemStream
  const stream = await open(options.blob)
  if (stream === null) return null

  try {
    const envelope = await buildEnvelope(
      stream,
      options.peakSampleRate ?? DEFAULT_PEAK_ENVELOPE_RATE,
    )
    if (envelope.durationSeconds <= 0) {
      // A stream that decoded to nothing is not a stream worth keeping; the
      // buffered path will produce a real error message for it.
      stream.dispose()
      return null
    }
    return {
      stream,
      displayBuffer: peakEnvelopeToAudioBuffer(options.context, envelope),
      durationSeconds: envelope.durationSeconds,
      sampleRate: stream.sampleRate,
      channelCount: stream.channelCount,
      displayBytes: envelope.data.length * 4,
    }
  } catch (error) {
    stream.dispose()
    console.warn('[stem-mixer] streamed load failed:', error)
    return null
  }
}

async function buildEnvelope(
  stream: StemStream,
  peakSampleRate: number,
): Promise<PeakEnvelope> {
  const builder = createPeakEnvelopeBuilder(peakSampleRate)
  for await (const chunk of stream.chunks(0)) {
    const { buffer } = chunk
    // Read straight out of the decoder's buffer: `push` consumes it before
    // the iterator advances, so nothing here needs a copy of its own.
    builder.push([buffer.getChannelData(0)], buffer.sampleRate)
  }
  return builder.build()
}
