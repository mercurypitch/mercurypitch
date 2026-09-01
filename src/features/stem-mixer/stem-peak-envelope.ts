// ============================================================
// Peak envelope — the waveform's data, without the song's memory
// ============================================================
//
// `track.buffer` in the stem mixer serves two unrelated masters: playback
// wants a source node, and the waveform canvas wants `getChannelData(0)`,
// `buffer.duration` and a peak tree. Sharing one field is what forced a full
// 48 kHz stereo decode on a phone that only ever draws a 350-pixel lane.
//
// This builds the display half on its own: a mono envelope at a few kilohertz,
// accumulated a chunk at a time so nothing larger than a chunk is ever
// resident. Playback streams separately (see `streaming-stem-voice.ts`).
//
// Buckets alternate max, min, max, min… rather than storing absolute peaks,
// because the canvas draws a signed waveform from per-column minima and
// maxima; a rectified envelope would render as a one-sided smear. Alternating
// halves the effective peak rate, which is why the default is generous.

/** 4 kHz mono is ~4 MB for a four-minute song, against 90 MB decoded. */
export const DEFAULT_PEAK_ENVELOPE_RATE = 4000

export interface PeakEnvelope {
  readonly data: Float32Array
  readonly sampleRate: number
  readonly durationSeconds: number
}

export interface PeakEnvelopeBuilder {
  /** Appends one decoded chunk. Only channel 0's peaks are kept. */
  push(channels: readonly Float32Array[], inputSampleRate: number): void
  build(): PeakEnvelope
}

/**
 * Accumulates buckets across chunk boundaries: a chunk is ~21 ms and a bucket
 * at 4 kHz is 0.25 ms, but the last bucket of a chunk is usually a partial one
 * and has to survive into the next.
 */
export function createPeakEnvelopeBuilder(
  targetSampleRate: number = DEFAULT_PEAK_ENVELOPE_RATE,
): PeakEnvelopeBuilder {
  const rate = Math.max(1, Math.round(targetSampleRate))
  const blocks: Float32Array[] = []
  const BLOCK = 8192
  let block = new Float32Array(BLOCK)
  let inBlock = 0
  let emitted = 0

  let inputRate = 0
  let framesSeen = 0
  let bucketMin = Number.POSITIVE_INFINITY
  let bucketMax = Number.NEGATIVE_INFINITY
  let bucketHasSamples = false

  const emit = (value: number): void => {
    if (inBlock === BLOCK) {
      blocks.push(block)
      block = new Float32Array(BLOCK)
      inBlock = 0
    }
    block[inBlock++] = value
    emitted++
  }

  const closeBucket = (): void => {
    if (!bucketHasSamples) return
    // Even buckets carry the peak above the centre line, odd ones the peak
    // below it, so a column of the canvas always spans a real min and max.
    emit(emitted % 2 === 0 ? bucketMax : bucketMin)
    bucketMin = Number.POSITIVE_INFINITY
    bucketMax = Number.NEGATIVE_INFINITY
    bucketHasSamples = false
  }

  return {
    push(channels, chunkSampleRate) {
      if (channels.length === 0 || chunkSampleRate <= 0) return
      if (inputRate === 0) inputRate = chunkSampleRate
      const data = channels[0]
      // Bucket boundaries are computed from the absolute frame counter, not
      // per chunk, so rounding cannot drift over a four-minute song.
      const framesPerBucket = inputRate / rate
      for (let i = 0; i < data.length; i++) {
        const value = data[i]
        if (value < bucketMin) bucketMin = value
        if (value > bucketMax) bucketMax = value
        bucketHasSamples = true
        framesSeen++
        if (Math.floor(framesSeen / framesPerBucket) > emitted) closeBucket()
      }
    },

    build() {
      closeBucket()
      const data = new Float32Array(emitted)
      let offset = 0
      for (const filled of blocks) {
        data.set(filled, offset)
        offset += filled.length
      }
      data.set(block.subarray(0, inBlock), offset)
      return {
        data,
        sampleRate: rate,
        // The song's real length, from the frames actually decoded — not
        // `emitted / rate`, which is a rounded bucket count.
        durationSeconds: inputRate === 0 ? 0 : framesSeen / inputRate,
      }
    },
  }
}

/**
 * An envelope of the right length and no content yet.
 *
 * Filling it means decoding the song, and on iOS decoding a song up front is
 * exactly what kills the tab — not through what is kept, which is four
 * megabytes, but through the eleven thousand short-lived AudioBuffers the
 * decoder produces on the way there, which a phone does not reclaim fast
 * enough. Measured twice: Firefox iOS died during that pass, Safari survived
 * it, reported 13 MB resident, and died five seconds later anyway.
 *
 * So the lane starts flat and is written into as playback decodes windows it
 * needed regardless — see `fillPeakEnvelopeWindow`. Nothing is decoded for
 * the picture alone, and the surface where this matters most (Karaoke Night)
 * draws no waveform at all.
 */
export function silentPeakEnvelope(
  durationSeconds: number,
  targetSampleRate: number = DEFAULT_PEAK_ENVELOPE_RATE,
): PeakEnvelope {
  const rate = Math.max(1, Math.round(targetSampleRate))
  const buckets = Math.max(1, Math.round(Math.max(0, durationSeconds) * rate))
  return {
    data: new Float32Array(buckets),
    sampleRate: rate,
    durationSeconds: Math.max(0, durationSeconds),
  }
}

/**
 * Writes one decoded run of samples into an already-sized envelope buffer, at
 * the song position it belongs to. Same alternating max/min as the builder,
 * so a lane filled this way and one built in a single pass look identical.
 */
export function fillPeakEnvelopeWindow(
  envelope: Float32Array,
  envelopeRate: number,
  atSeconds: number,
  samples: Float32Array,
  inputRate: number,
): void {
  if (inputRate <= 0 || envelopeRate <= 0 || samples.length === 0) return
  const framesPerBucket = inputRate / envelopeRate
  const firstBucket = Math.round(atSeconds * envelopeRate)
  const buckets = Math.floor(samples.length / framesPerBucket)
  for (let b = 0; b < buckets; b++) {
    const target = firstBucket + b
    if (target < 0 || target >= envelope.length) continue
    const from = Math.floor(b * framesPerBucket)
    const to = Math.min(samples.length, Math.floor((b + 1) * framesPerBucket))
    let min = 0
    let max = 0
    for (let i = from; i < to; i++) {
      const value = samples[i]
      if (value < min) min = value
      if (value > max) max = value
    }
    envelope[target] = target % 2 === 0 ? max : min
  }
}

/**
 * The other half of the bargain above: the drawing consumers read
 * `track.buffer` and cannot tell an envelope from audio, which is the point —
 * but the *analysing* consumers must not be fooled. A pitch detector, an
 * onset detector and Whisper will all read a 4 kHz mono envelope without
 * complaint and return confident nonsense.
 *
 * So anything that wants samples asks through here and gets `null` when there
 * are none, rather than reaching for `.buffer` and hoping.
 */
export function analysableBuffer(
  track: Readonly<{ buffer: AudioBuffer | null; stream?: unknown }>,
): AudioBuffer | null {
  // A stream means playback comes from a decoder and `buffer` is the envelope.
  if (track.stream != null) return null
  return track.buffer
}

/**
 * Wraps an envelope as a mono AudioBuffer, which is what every existing
 * consumer of `track.buffer` already knows how to read.
 */
export function peakEnvelopeToAudioBuffer(
  context: BaseAudioContext,
  envelope: PeakEnvelope,
): AudioBuffer {
  const frames = Math.max(1, envelope.data.length)
  const buffer = context.createBuffer(1, frames, envelope.sampleRate)
  buffer.copyToChannel(envelope.data as Float32Array<ArrayBuffer>, 0)
  return buffer
}
