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
