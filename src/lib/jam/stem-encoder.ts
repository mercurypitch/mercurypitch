// ── Stem encoding ────────────────────────────────────────────────────
// Turns a stored WAV stem into something small enough to send.
//
// Separation output lands as PCM WAV, which is 100-400 MB for a song --
// fine sitting in IndexedDB, impossible to hand to a peer. AAC at 128 kbps
// is roughly 3.8 MB for a four-minute stem, and the difference between a
// feature that feels instant and one that looks broken.
//
// Compression costs nothing musically here, which is worth being explicit
// about because it looks like a tradeoff: pitch detection runs on each
// singer's live microphone, never on the stem. The stem is a playback
// reference, and where the vocal line is already extracted to notes the
// audio does not enter scoring at all.
//
// See docs/plans/jam-song-p2p-transfer.md.

import { AudioBufferSource, BufferTarget, canEncodeAudio, Mp4OutputFormat, Output, } from 'mediabunny'
import { wavSampleRate } from '@/lib/wav-meta'

/**
 * The bitrate everything is sized around. Past transparent for a backing
 * track, and the number the transfer estimates in the plan assume.
 */
export const STEM_BITRATE = 128_000

/** AAC is happiest at these; anything else gets resampled on decode. */
const AAC_RATES = [48000, 44100, 32000, 24000, 22050, 16000]
const DEFAULT_RATE = 48000

/**
 * Whether AAC can be encoded here, loading the wasm fallback if it cannot
 * be done natively.
 *
 * WebCodecs AAC encoding is missing in Firefox on every platform, and in
 * every browser on desktop Linux -- an OS-level codec licensing matter, not
 * something a library argues with. `@mediabunny/aac-encoder` exists for
 * exactly that gap, and is imported dynamically so its weight only lands on
 * the machines that need it.
 *
 * Memoised because the answer cannot change within a session and the
 * fallback must never be registered twice.
 */
let encoderReady: Promise<boolean> | null = null

export function resetStemEncoderProbe(): void {
  encoderReady = null
}

export async function ensureAacEncoder(): Promise<boolean> {
  encoderReady ??= (async () => {
    try {
      if (await canEncodeAudio('aac', { sampleRate: DEFAULT_RATE })) return true
      const { registerAacEncoder } = await import('@mediabunny/aac-encoder')
      registerAacEncoder()
      return await canEncodeAudio('aac', { sampleRate: DEFAULT_RATE })
    } catch {
      // A browser too old for either path. The song stays local and says
      // so, which is the behaviour today anyway.
      return false
    }
  })()
  return encoderReady
}

/** The rate to decode at: the source's own, when AAC can carry it. */
export function encodeRateFor(sourceRate: number | undefined): number {
  return sourceRate !== undefined && AAC_RATES.includes(sourceRate)
    ? sourceRate
    : DEFAULT_RATE
}

export interface EncodeProgress {
  /** 0-1, by decoded audio duration. */
  ratio: number
}

/**
 * How much of the bar decoding is allowed to claim.
 *
 * `decodeAudioData` has no progress of its own and a separation stem is
 * hundreds of megabytes of PCM, so this stretch is genuinely slow and
 * genuinely unmeasurable. It gets an estimate rather than a bar that sits
 * at nothing -- see `creepTo`.
 */
const DECODE_SHARE = 0.2

/** Audio per encode call: small enough to move the bar, big enough to be cheap. */
const ENCODE_SLICE_SEC = 5

/**
 * An estimate that eases toward a ceiling it never reaches.
 *
 * Honest in the way that matters: it never claims to have finished, and it
 * keeps moving, so a long decode reads as working rather than as hung. The
 * real number takes over the moment there is one.
 */
function creepTo(cap: number, report: (ratio: number) => void): () => void {
  let at = 0
  const id = setInterval(() => {
    at += (cap - at) * 0.08
    report(at)
  }, 150)
  return () => clearInterval(id)
}

/** One slice of a decoded buffer, as its own AudioBuffer. */
function sliceBuffer(
  source: AudioBuffer,
  from: number,
  to: number,
): AudioBuffer {
  const slice = new AudioBuffer({
    length: to - from,
    numberOfChannels: source.numberOfChannels,
    sampleRate: source.sampleRate,
  })
  for (let ch = 0; ch < source.numberOfChannels; ch++) {
    slice.copyToChannel(source.getChannelData(ch).subarray(from, to), ch)
  }
  return slice
}

export class StemEncodeUnsupportedError extends Error {
  constructor() {
    super('This browser cannot encode audio, so the song cannot be shared.')
    this.name = 'StemEncodeUnsupportedError'
  }
}

/**
 * Encode one WAV stem to AAC-in-MP4.
 *
 * Decoded through an OfflineAudioContext at the source's own sample rate,
 * so a 44.1k stem is not silently resampled to 48k on the way past. Then
 * fed to mediabunny in slices, each await respecting encoder backpressure
 * -- which keeps a phone from holding the whole compressed output in
 * flight, and is what gives the caller a progress number to show.
 */
export async function encodeStemToAac(
  wav: ArrayBuffer,
  onProgress?: (p: EncodeProgress) => void,
): Promise<Uint8Array> {
  if (!(await ensureAacEncoder())) throw new StemEncodeUnsupportedError()

  const rate = encodeRateFor(wavSampleRate(wav.slice(0, 4096)))
  // Decoding says nothing about its own progress, so the bar is estimated
  // until there is a real number to show.
  const stopCreep = creepTo(DECODE_SHARE, (r) => onProgress?.({ ratio: r }))
  let decoded: AudioBuffer
  try {
    // A 1-frame context is only a decoder host; nothing is rendered through
    // it, so its length does not matter.
    decoded = await new OfflineAudioContext(1, 1, rate).decodeAudioData(
      // decodeAudioData detaches its input, and the caller may still want
      // the original bytes (the WAV is the master copy).
      wav.slice(0),
    )
  } finally {
    stopCreep()
  }
  onProgress?.({ ratio: DECODE_SHARE })

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  })
  const source = new AudioBufferSource({
    codec: 'aac',
    bitrate: STEM_BITRATE,
  })
  output.addAudioTrack(source)
  await output.start()

  // Fed in slices rather than in one go. Handing over the whole buffer was
  // one await that took as long as the encode: the bar showed 0, then 100,
  // for each stem in turn, which is a progress bar that reports only that
  // something happened. Successive buffers are concatenated by mediabunny
  // -- each one starts where the last ended -- so the output is identical.
  const step = Math.max(1, Math.floor(ENCODE_SLICE_SEC * decoded.sampleRate))
  const frames = decoded.length
  for (let from = 0; from < frames; from += step) {
    const to = Math.min(frames, from + step)
    await source.add(sliceBuffer(decoded, from, to))
    onProgress?.({
      ratio: DECODE_SHARE + (1 - DECODE_SHARE) * (to / frames),
    })
  }
  onProgress?.({ ratio: 1 })
  await output.finalize()

  const buffer = output.target.buffer
  if (buffer === null) throw new Error('Encoding produced no output.')
  return new Uint8Array(buffer)
}
