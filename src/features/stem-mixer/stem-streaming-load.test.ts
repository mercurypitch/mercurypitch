// ============================================================
// Loading a streamed stem decodes nothing
// ============================================================
//
// This file used to assert that the load built a peak envelope in one pass.
// That pass killed phones — Firefox iOS inside it, Safari five seconds after
// finishing it and reporting 13 MB resident — because decoding a whole song
// at full tilt produces eleven thousand short-lived AudioBuffers per stem
// whatever you keep from them.
//
// So the load reads the length out of the container and stops. The strongest
// test here is the one that asserts a chunk is never pulled.
//
// The other half: streaming needs WebCodecs and a container mediabunny can
// walk, neither guaranteed, and the answer to "this one cannot be streamed"
// has to be a whole decode rather than a silent room — so every failure
// returns null, which is the loader's signal to fall back.

import { describe, expect, it, vi } from 'vitest'
import type { StemStream } from './stem-stream-source'
import { loadStreamedStem } from './stem-streaming-load'

const RATE = 48_000

function fakeContext(): BaseAudioContext {
  return {
    createBuffer: (channels: number, frames: number, sampleRate: number) => {
      const data = Array.from(
        { length: channels },
        () => new Float32Array(frames),
      )
      return {
        numberOfChannels: channels,
        length: frames,
        sampleRate,
        duration: frames / sampleRate,
        getChannelData: (c: number) => data[c],
        copyToChannel: (src: Float32Array, c: number, offset = 0) => {
          data[c].set(src, offset)
        },
      } as unknown as AudioBuffer
    },
  } as unknown as BaseAudioContext
}

/** Counts what the loader asks of the decoder, which should be nothing. */
function stemOf(seconds: number) {
  const state = { chunksOpened: 0 }
  const stream: StemStream = {
    sampleRate: RATE,
    channelCount: 2,
    durationSeconds: seconds,
    chunks: function () {
      state.chunksOpened++
      return {
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.reject(new Error('the load must not decode')),
        }),
      }
    } as StemStream['chunks'],
    dispose: vi.fn(),
  }
  return { stream, state }
}

describe('loading a stem for streamed playback', () => {
  it('never touches the decoder', async () => {
    const { stream, state } = stemOf(246.3)
    const loaded = await loadStreamedStem({
      context: fakeContext(),
      blob: new Blob([new Uint8Array(4)]),
      open: async () => stream,
    })

    expect(loaded).not.toBeNull()
    expect(state.chunksOpened).toBe(0)
  })

  it('sizes an empty lane from the container’s own length', async () => {
    const { stream } = stemOf(246.3)
    const loaded = await loadStreamedStem({
      context: fakeContext(),
      blob: new Blob([new Uint8Array(4)]),
      open: async () => stream,
      peakSampleRate: 1000,
    })

    expect(loaded!.durationSeconds).toBeCloseTo(246.3, 3)
    expect(loaded!.displayBuffer.numberOfChannels).toBe(1)
    expect(loaded!.displayBuffer.sampleRate).toBe(1000)
    expect(loaded!.displaySampleRate).toBe(1000)
    // Empty: playback fills it in from windows it decodes anyway.
    expect(loaded!.displayBuffer.getChannelData(0).every((v) => v === 0)).toBe(
      true,
    )
    // A lane, not a song: 246 s at 1 kHz is a megabyte, against 94 decoded.
    expect(loaded!.displayBytes).toBeCloseTo(246.3 * 1000 * 4, -3)
    expect(loaded!.sampleRate).toBe(RATE)
    expect(loaded!.channelCount).toBe(2)
  })

  it('returns null when the platform will not stream it', async () => {
    const loaded = await loadStreamedStem({
      context: fakeContext(),
      blob: new Blob([new Uint8Array(4)]),
      open: async () => null,
    })

    expect(loaded).toBeNull()
  })

  it('returns null — and lets the stream go — when it has no length', async () => {
    const { stream } = stemOf(0)
    const loaded = await loadStreamedStem({
      context: fakeContext(),
      blob: new Blob([new Uint8Array(4)]),
      open: async () => stream,
    })

    expect(loaded).toBeNull()
    expect(stream.dispose).toHaveBeenCalled()
  })
})
