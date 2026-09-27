// ============================================================
// Karaoke audio: what this phone can stream, in words
// ============================================================
//
// The facts the Developer screen's Karaoke audio section reads out, kept
// apart from the panel so each has a test of its own:
//
//   whether this phone has WebCodecs' AudioDecoder at all. Safari has had
//   one only since 26.0, so on iOS 16 to 18 every song takes the room's
//   fallback (stream-switches.ts has the sources);
//
//   whether AudioDecoder.isConfigSupported says yes to the codecs the room
//   streams: MP3 for an imported song (the separation handler writes MP3 for
//   a native build, src/lib/uvr-api.ts) and AAC for the examples;
//
//   and the same question about the last song's own codec, rate and
//   channels, read from its container (stem-load-path.ts).

import type { SongPathRecord } from '@/features/stem-mixer/stem-load-path'

export interface StreamedCodec {
  /** Stable name for tests: `data-karaoke-row`. */
  id: string
  label: string
  config: AudioDecoderConfig
}

/** The codecs the Karaoke room streams, as a decoder is asked about them. */
export const STREAMED_CODECS: readonly StreamedCodec[] = [
  {
    id: 'mp3',
    label: 'MP3 (an imported song)',
    config: { codec: 'mp3', sampleRate: 44_100, numberOfChannels: 2 },
  },
  {
    id: 'aac',
    label: 'AAC (the examples)',
    config: { codec: 'mp4a.40.2', sampleRate: 44_100, numberOfChannels: 2 },
  },
]

export function hasAudioDecoder(): boolean {
  return typeof AudioDecoder !== 'undefined'
}

/** The phone's own answer, and what the room is being told. */
export function decoderRow(forced: boolean): string {
  if (!hasAudioDecoder()) return 'absent: every song takes the fallback'
  return forced
    ? 'present, but the room is told it is absent'
    : 'present: the room streams'
}

/** AudioDecoder.isConfigSupported's answer, as words. */
export async function codecSupport(
  config: AudioDecoderConfig,
): Promise<string> {
  if (!hasAudioDecoder()) return 'no AudioDecoder to ask'
  try {
    const answer = await AudioDecoder.isConfigSupported(config)
    return answer.supported === true ? 'supported' : 'not supported'
  } catch (error) {
    const why =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    return `the check failed: ${why}`
  }
}

/** The last song's own codec, as a decoder would be configured for it. */
export function lastSongConfig(
  record: SongPathRecord | null,
): AudioDecoderConfig | null {
  if (
    record === null ||
    record.codec === null ||
    record.sampleRate === null ||
    record.channelCount === null
  ) {
    return null
  }
  return {
    codec: record.codec,
    sampleRate: record.sampleRate,
    numberOfChannels: record.channelCount,
  }
}

/** One line for a codec and the answer about it. */
export function configLine(config: AudioDecoderConfig, answer: string): string {
  return `${config.codec} · ${String(config.sampleRate)} Hz · ${String(config.numberOfChannels)} ch · ${answer}`
}
