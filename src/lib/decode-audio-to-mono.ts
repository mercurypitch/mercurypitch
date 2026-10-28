// ============================================================
// Audio decode to mono — one browser decode path for offline analysis
// ============================================================
//
// Vocal Analysis and Hear Yourself both need real samples before running the
// take-analysis worker. Keeping fetch, decode, and channel folding here avoids
// small differences in how the same recording is measured across surfaces.
// The Jam room's pitch read and First note's read of a song of the singer's
// own take one channel of the same decode (decodeAudioBytes).

export interface DecodedMonoAudio {
  samples: Float32Array
  sampleRate: number
}

/** The rate every decode here is read at: decodeAudioData resamples to it. */
export const DECODE_RATE = 44_100

/**
 * Browser-supported audio bytes, decoded: every channel, at DECODE_RATE.
 *
 * An OfflineAudioContext rather than a live one: decoding needs no output
 * device and no user gesture, and a phone should not open a second hardware
 * context to read a file. Its length and channels are irrelevant:
 * decodeAudioData allocates its own buffer and only borrows the rate.
 */
export async function decodeAudioBytes(
  bytes: ArrayBuffer,
): Promise<AudioBuffer> {
  if (typeof OfflineAudioContext === 'undefined') {
    throw new Error('Offline audio decoding is unavailable in this browser.')
  }
  return await new OfflineAudioContext(1, 2, DECODE_RATE).decodeAudioData(bytes)
}

/** Fold any decoded channel layout into an equal-weight mono signal. */
export function mixAudioChannelsToMono(
  channels: readonly Float32Array[],
): Float32Array {
  if (channels.length === 0) return new Float32Array()
  if (channels.length === 1) return new Float32Array(channels[0])

  const length = Math.min(...channels.map((channel) => channel.length))
  const mono = new Float32Array(length)
  for (let index = 0; index < length; index += 1) {
    let sum = 0
    for (const channel of channels) sum += channel[index] ?? 0
    mono[index] = sum / channels.length
  }
  return mono
}

/** Decode browser-supported audio bytes and return a stable mono copy. */
export async function decodeAudioBytesToMono(
  bytes: ArrayBuffer,
): Promise<DecodedMonoAudio> {
  const buffer = await decodeAudioBytes(bytes)
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  )
  return {
    samples: mixAudioChannelsToMono(channels),
    sampleRate: buffer.sampleRate,
  }
}

export async function decodeAudioBlobToMono(
  blob: Blob,
): Promise<DecodedMonoAudio> {
  return await decodeAudioBytesToMono(await blob.arrayBuffer())
}

export async function fetchAudioToMono(url: string): Promise<DecodedMonoAudio> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Audio request failed with status ${response.status}.`)
  }
  return await decodeAudioBytesToMono(await response.arrayBuffer())
}
