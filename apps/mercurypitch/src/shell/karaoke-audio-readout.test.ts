// The facts the Karaoke audio section reads out, one at a time. jsdom has no
// AudioDecoder, as a WKWebView before iOS 26 has none, so every case that
// wants one stubs it with the answer it needs.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as NativeBuild from '@/lib/native-build'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  IS_NATIVE_BUILD: true,
}))

import type { SongPathRecord } from '@/features/stem-mixer/stem-load-path'
import { DEFAULT_PROCESS_REQUEST } from '@/lib/uvr-api'
import { codecSupport, configLine, decoderRow, lastSongConfig, STREAMED_CODECS, } from './karaoke-audio-readout'

/** An AudioDecoder whose isConfigSupported answers with `answer`. */
function stubDecoder(answer: (config: AudioDecoderConfig) => boolean): void {
  vi.stubGlobal(
    'AudioDecoder',
    Object.assign(vi.fn(), {
      isConfigSupported: (config: AudioDecoderConfig) =>
        Promise.resolve({ supported: answer(config), config }),
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the AudioDecoder row', () => {
  it('says a phone without one takes the fallback for every song', () => {
    expect(decoderRow(false)).toBe('absent: every song takes the fallback')
    expect(decoderRow(true)).toBe('absent: every song takes the fallback')
  })

  it('tells a phone that streams from one the switch has forced', () => {
    stubDecoder(() => true)
    expect(decoderRow(false)).toBe('present: the room streams')
    expect(decoderRow(true)).toBe('present, but the room is told it is absent')
  })
})

describe('asking about a codec', () => {
  it('asks the phone, and says what it answered', async () => {
    stubDecoder((config) => config.codec === 'mp3')
    const [mp3, aac] = STREAMED_CODECS
    expect(await codecSupport(mp3.config)).toBe('supported')
    expect(await codecSupport(aac.config)).toBe('not supported')
  })

  it('has nothing to ask without AudioDecoder', async () => {
    expect(await codecSupport(STREAMED_CODECS[0].config)).toBe(
      'no AudioDecoder to ask',
    )
  })

  it('says so when the question itself fails', async () => {
    vi.stubGlobal(
      'AudioDecoder',
      Object.assign(vi.fn(), {
        isConfigSupported: () => Promise.reject(new TypeError('bad config')),
      }),
    )
    expect(await codecSupport(STREAMED_CODECS[0].config)).toBe(
      'the check failed: TypeError: bad config',
    )
  })

  it('asks about the codec a native build’s separations come back in', () => {
    // The request and the readout move together: a native build asks the
    // handler for MP3, so MP3 is the codec this section asks about first.
    expect(DEFAULT_PROCESS_REQUEST.output_format).toBe('MP3')
    expect(STREAMED_CODECS.map((codec) => codec.config.codec)).toEqual([
      'mp3',
      'mp4a.40.2',
    ])
  })
})

describe('the last song’s own codec', () => {
  const record: SongPathRecord = {
    path: 'stream',
    songBytes: 1,
    wholeDecodeBytes: 1,
    residentBytes: 1,
    codec: 'mp3',
    sampleRate: 44_100,
    channelCount: 2,
    pastGuard: false,
    stems: 2,
    state: 'done',
    startedAt: '2026-09-28T10:00:00.000Z',
  }

  it('is the config a decoder would be asked about', () => {
    expect(lastSongConfig(record)).toEqual({
      codec: 'mp3',
      sampleRate: 44_100,
      numberOfChannels: 2,
    })
    expect(configLine(lastSongConfig(record)!, 'supported')).toBe(
      'mp3 · 44100 Hz · 2 ch · supported',
    )
  })

  it('is nothing until a song was read', () => {
    expect(lastSongConfig(null)).toBeNull()
    expect(lastSongConfig({ ...record, codec: null })).toBeNull()
  })
})
