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
 * so a 44.1k stem is not silently resampled to 48k on the way past. The
 * whole buffer is handed to mediabunny in one go and the returned promise
 * respects encoder backpressure, which is what keeps a phone from holding
 * the entire compressed output in flight at once.
 */
export async function encodeStemToAac(
  wav: ArrayBuffer,
  onProgress?: (p: EncodeProgress) => void,
): Promise<Uint8Array> {
  if (!(await ensureAacEncoder())) throw new StemEncodeUnsupportedError()

  const rate = encodeRateFor(wavSampleRate(wav.slice(0, 4096)))
  // A 1-frame context is only a decoder host; nothing is rendered through
  // it, so its length does not matter.
  const decoded = await new OfflineAudioContext(1, 1, rate).decodeAudioData(
    // decodeAudioData detaches its input, and the caller may still want the
    // original bytes (the WAV is the master copy).
    wav.slice(0),
  )

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
  onProgress?.({ ratio: 0 })
  await source.add(decoded)
  onProgress?.({ ratio: 1 })
  await output.finalize()

  const buffer = output.target.buffer
  if (buffer === null) throw new Error('Encoding produced no output.')
  return new Uint8Array(buffer)
}
