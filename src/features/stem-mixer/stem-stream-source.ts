// ============================================================
// Stem stream source — decoded chunks out of a compressed stem, on demand
// ============================================================
//
// `play-along/windowed-stem-voice.ts` already streams stems, but only from
// stored WAV, where a sample position is a byte position. Karaoke stems are
// m4a and mp3, which cannot be sliced that way: a decoder has to walk the
// container.
//
// mediabunny (already a dependency — `lib/portable/portable-audio.ts` uses it
// to export AAC) is that decoder. `AudioBufferSink.buffers(from, to)` demuxes
// and decodes in presentation order through WebCodecs, yielding a packet at a
// time and pre-decoding only a little ahead, so what is resident is whatever
// the consumer has not yet let go of.
//
// Everything here is behind a capability check rather than a user-agent
// guess: `track.canDecode()` is the platform answering for itself, and a
// `null` return means the caller falls back to `decodeAudioData`.
//
// The import is dynamic. mediabunny is a large module and the desktop path
// never needs it.

import { IS_NATIVE_BUILD } from '@/lib/native-build'
import { noStreamForced } from './stream-switches'
import type { StemStreamChunk } from './streaming-stem-voice'

export interface StemStream {
  readonly sampleRate: number
  readonly channelCount: number
  /**
   * Read from the container, never by decoding. `getDurationFromMetadata` is
   * a header read; `computeDuration` walks packet timestamps but decodes
   * none of them. Both are cheap, and neither is the thing that killed a
   * phone.
   */
  readonly durationSeconds: number
  /**
   * Decoded chunks in presentation order from `fromSeconds`. The first chunk
   * may begin slightly before it — the voice trims the difference.
   */
  chunks(fromSeconds: number): AsyncIterable<StemStreamChunk>
  dispose(): void
}

/**
 * WebCodecs is what does the decoding, so its absence settles the question
 * before a large module is fetched to ask it. Safari has had AudioDecoder
 * only since 26.0 ("WebKit Features in Safari 26.0"; MDN browser-compat-data,
 * api/AudioDecoder, with Safari on iOS and the iOS WebView mirroring it), so
 * on iOS 16 to 18, which this app supports, the answer is no and the caller
 * takes its fallback. Absent in jsdom too, which is why the unit tests take
 * the buffered path without having to say so.
 *
 * A native test build can be told to answer no on a phone that has one: the
 * Developer screen's "Force the no-streaming path" (stream-switches.ts).
 */
export function canStreamStems(): boolean {
  if (IS_NATIVE_BUILD && noStreamForced()) return false
  return typeof AudioDecoder !== 'undefined'
}

/** What a stem is, read from its container: nothing is decoded. */
export interface StemShape {
  readonly durationSeconds: number
  readonly sampleRate: number
  readonly channelCount: number
  /** The codec a decoder would be configured with: 'mp3', 'mp4a.40.2'. */
  readonly codec: string | null
}

/**
 * How long a stem is and how many channels it has, read from the container
 * alone, for what a whole decode of it would hold. Demuxing is JavaScript,
 * so this answers on a phone with no AudioDecoder, which is where the answer
 * is wanted: the Developer screen's estimate for a song the room refused or
 * decoded whole. Null when the file cannot be read.
 */
export async function readStemShape(blob: Blob): Promise<StemShape | null> {
  let input: { dispose: () => void } | null = null
  try {
    const { ALL_FORMATS, BlobSource, Input } = await import('mediabunny')
    const opened = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(blob, { maxCacheSize: 1024 * 1024 }),
    })
    input = opened
    const track = await opened.getPrimaryAudioTrack()
    if (track === null) return null
    const [sampleRate, channelCount, config] = await Promise.all([
      track.getSampleRate(),
      track.getNumberOfChannels(),
      track.getDecoderConfig(),
    ])
    const durationSeconds =
      (await opened.getDurationFromMetadata()) ??
      (await opened.computeDuration())
    return {
      durationSeconds,
      sampleRate,
      channelCount,
      codec: config?.codec ?? null,
    }
  } catch {
    return null
  } finally {
    input?.dispose()
  }
}

/**
 * A blob rather than a url on purpose: the bytes are already in hand from the
 * download or the audio cache, and re-fetching them over range requests would
 * pay for the same megabytes twice.
 *
 * Returns null when the file cannot be demuxed or this platform cannot decode
 * the codec, which is the caller's signal to decode it the old way.
 */
export async function openStemStream(blob: Blob): Promise<StemStream | null> {
  if (!canStreamStems()) return null
  let input: { dispose: () => void } | null = null
  try {
    const { ALL_FORMATS, AudioBufferSink, BlobSource, Input } =
      await import('mediabunny')
    const opened = new Input({
      formats: ALL_FORMATS,
      // The default is 8 MiB of container cache. A stem is about ten, and the
      // whole point of this path is that a phone holds very little.
      source: new BlobSource(blob, { maxCacheSize: 1024 * 1024 }),
    })
    input = opened

    const track = await opened.getPrimaryAudioTrack()
    if (track === null) {
      opened.dispose()
      return null
    }
    if (!(await track.canDecode())) {
      opened.dispose()
      return null
    }

    const [sampleRate, channelCount] = await Promise.all([
      track.getSampleRate(),
      track.getNumberOfChannels(),
    ])
    const durationSeconds =
      (await opened.getDurationFromMetadata()) ??
      (await opened.computeDuration())
    const sink = new AudioBufferSink(track)

    return {
      sampleRate,
      channelCount,
      durationSeconds,
      chunks(fromSeconds: number) {
        return sink.buffers(Math.max(0, fromSeconds))
      },
      dispose() {
        opened.dispose()
      },
    }
  } catch (error) {
    input?.dispose()
    console.warn('[stem-mixer] cannot stream this stem:', error)
    return null
  }
}
