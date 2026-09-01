// ============================================================
// Loading a stem for streamed playback
// ============================================================
//
// The buffered path is one call: `decodeAudioData` returns every sample and
// the same AudioBuffer serves playback and the waveform. The streamed path
// splits those two jobs, and loading it decodes nothing at all: it opens the
// container, reads the length out of the header, and hands back an empty
// waveform lane for playback to fill in as it goes.
//
// It did decode once, in a single pass that folded every chunk into a peak
// envelope and dropped it — four megabytes kept out of ninety. That still
// killed phones, and the logs say so plainly: Firefox iOS died inside the
// pass, and Safari finished it, reported 13 MB resident, and was killed five
// seconds later while idle. What is kept was never the problem. Decoding a
// whole song at full tilt produces about eleven thousand short-lived
// AudioBuffers per stem, and a phone does not reclaim them fast enough to
// matter.
//
// So nothing is decoded for a picture. Playback opens its own iteration over
// the stream a few seconds at a time — see `streaming-stem-voice.ts` — and
// the windows it decodes anyway are what fill the lane in.

import { DEFAULT_PEAK_ENVELOPE_RATE, peakEnvelopeToAudioBuffer, silentPeakEnvelope, } from './stem-peak-envelope'
import type { StemStream } from './stem-stream-source'
import { openStemStream } from './stem-stream-source'

export interface StreamedStem {
  readonly stream: StemStream
  /**
   * Mono peak envelope, for every consumer that reads `track.buffer`. Empty
   * at first; playback writes into it as it decodes.
   */
  readonly displayBuffer: AudioBuffer
  /** The envelope's own rate, for whoever fills it in. */
  readonly displaySampleRate: number
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
    if (!(stream.durationSeconds > 0)) {
      // No length means no container we can trust. The buffered path will
      // produce a real error message for it.
      stream.dispose()
      return null
    }
    const envelope = silentPeakEnvelope(
      stream.durationSeconds,
      options.peakSampleRate ?? DEFAULT_PEAK_ENVELOPE_RATE,
    )
    return {
      stream,
      displayBuffer: peakEnvelopeToAudioBuffer(options.context, envelope),
      displaySampleRate: envelope.sampleRate,
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
