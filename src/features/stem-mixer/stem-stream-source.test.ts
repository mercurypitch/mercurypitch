// ============================================================
// The stream source: the switch that closes it, and the container read
// ============================================================
//
// mediabunny stands in for the demuxer, so these cases say what the source
// asks of it: nothing at all while the Developer screen says this phone has
// no AudioDecoder, and a header read with no decoding when the room wants to
// know what a whole decode of a stem would hold.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as NativeBuild from '@/lib/native-build'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  IS_NATIVE_BUILD: true,
}))

interface FakeTrack {
  getSampleRate: () => Promise<number>
  getNumberOfChannels: () => Promise<number>
  getDecoderConfig: () => Promise<AudioDecoderConfig | null>
  canDecode: () => Promise<boolean>
}

const demux = vi.hoisted(() => ({
  inputs: 0,
  disposed: 0,
  track: null as FakeTrack | null,
  metadataSeconds: null as number | null,
  computedSeconds: 0,
  fail: false,
}))

vi.mock('mediabunny', () => ({
  ALL_FORMATS: [],
  AudioBufferSink: class {
    readonly sink = true
  },
  BlobSource: class {
    readonly source = true
  },
  Input: class {
    constructor() {
      demux.inputs++
      if (demux.fail) throw new Error('not a container')
    }
    getPrimaryAudioTrack() {
      return Promise.resolve(demux.track)
    }
    getDurationFromMetadata() {
      return Promise.resolve(demux.metadataSeconds)
    }
    computeDuration() {
      return Promise.resolve(demux.computedSeconds)
    }
    dispose() {
      demux.disposed++
    }
  },
}))

import { openStemStream, readStemShape } from './stem-stream-source'
import { reloadStreamSwitchesForTests, setNoStreamForced, } from './stream-switches'

const MP3_TRACK: FakeTrack = {
  getSampleRate: () => Promise.resolve(44_100),
  getNumberOfChannels: () => Promise.resolve(2),
  getDecoderConfig: () =>
    Promise.resolve({ codec: 'mp3', sampleRate: 44_100, numberOfChannels: 2 }),
  canDecode: () => Promise.resolve(false),
}

const stem = () => new Blob([new Uint8Array(16)])

/** Any AudioDecoder at all: canStreamStems() asks only whether there is one. */
class AudioDecoderStub {
  readonly configure = vi.fn()
}

beforeEach(() => {
  demux.inputs = 0
  demux.disposed = 0
  demux.track = MP3_TRACK
  demux.metadataSeconds = 246.3
  demux.computedSeconds = 0
  demux.fail = false
  localStorage.clear()
  reloadStreamSwitchesForTests()
  vi.stubEnv('VITE_PORTABLE_CONSOLE', 'true')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  localStorage.clear()
  reloadStreamSwitchesForTests()
})

describe('opening a stem to stream', () => {
  it('opens nothing while the switch says this phone has no AudioDecoder', async () => {
    vi.stubGlobal('AudioDecoder', AudioDecoderStub)
    setNoStreamForced(true)

    expect(await openStemStream(stem())).toBeNull()
    // Not so much as a container read: exactly a phone without one.
    expect(demux.inputs).toBe(0)

    setNoStreamForced(false)
    await openStemStream(stem())
    expect(demux.inputs).toBe(1)
  })
})

describe('reading what a stem is', () => {
  it('reads length, rate, channels and codec from the container', async () => {
    expect(await readStemShape(stem())).toEqual({
      durationSeconds: 246.3,
      sampleRate: 44_100,
      channelCount: 2,
      codec: 'mp3',
    })
    expect(demux.disposed).toBe(1)
  })

  it('answers on a phone with no AudioDecoder, where it is wanted', async () => {
    expect(typeof AudioDecoder).toBe('undefined')
    expect(await readStemShape(stem())).not.toBeNull()
  })

  it('walks the packets when the header has no length', async () => {
    demux.metadataSeconds = null
    demux.computedSeconds = 200
    expect((await readStemShape(stem()))?.durationSeconds).toBe(200)
  })

  it('is null for a file with no audio, or none it can read', async () => {
    demux.track = null
    expect(await readStemShape(stem())).toBeNull()
    expect(demux.disposed).toBe(1)

    demux.fail = true
    expect(await readStemShape(stem())).toBeNull()
  })
})
