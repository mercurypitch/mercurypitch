// ============================================================
// When a stem cannot be streamed, it is still a stem
// ============================================================
//
// Streaming needs WebCodecs and a container mediabunny can walk. Neither is
// guaranteed, and the answer to "this one cannot be streamed" has to be a
// whole decode rather than a silent room — so every failure here returns
// null, which is the loader's signal to fall back.

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

function stemOf(seconds: number, chunkSeconds = 0.25): StemStream {
  return {
    sampleRate: RATE,
    channelCount: 2,
    chunks: async function* (from: number) {
      for (let t = from; t < seconds - 1e-9; t += chunkSeconds) {
        const length = Math.round(Math.min(chunkSeconds, seconds - t) * RATE)
        const channel = new Float32Array(length).fill(0.25)
        yield {
          buffer: {
            duration: length / RATE,
            length,
            numberOfChannels: 2,
            sampleRate: RATE,
            getChannelData: () => channel,
          } as unknown as AudioBuffer,
          timestamp: t,
        }
      }
    },
    dispose: vi.fn(),
  }
}

describe('loading a stem for streamed playback', () => {
  it('returns null when the platform will not stream it', async () => {
    const loaded = await loadStreamedStem({
      context: fakeContext(),
      blob: new Blob([new Uint8Array(4)]),
      open: async () => null,
    })

    expect(loaded).toBeNull()
  })

  it('returns null — and lets the stream go — when it decodes to nothing', async () => {
    const stream = stemOf(0)
    const loaded = await loadStreamedStem({
      context: fakeContext(),
      blob: new Blob([new Uint8Array(4)]),
      open: async () => stream,
    })

    expect(loaded).toBeNull()
    expect(stream.dispose).toHaveBeenCalled()
  })

  it('returns null — and lets the stream go — when the decode throws', async () => {
    const stream: StemStream = {
      sampleRate: RATE,
      channelCount: 2,
      // eslint-disable-next-line require-yield
      chunks: async function* () {
        throw new Error('decoder gave up')
      },
      dispose: vi.fn(),
    }
    const loaded = await loadStreamedStem({
      context: fakeContext(),
      blob: new Blob([new Uint8Array(4)]),
      open: async () => stream,
    })

    expect(loaded).toBeNull()
    expect(stream.dispose).toHaveBeenCalled()
  })

  it('builds the waveform and the exact length in one pass', async () => {
    const loaded = await loadStreamedStem({
      context: fakeContext(),
      blob: new Blob([new Uint8Array(4)]),
      open: async () => stemOf(12),
      peakSampleRate: 1000,
    })

    expect(loaded).not.toBeNull()
    expect(loaded!.durationSeconds).toBeCloseTo(12, 3)
    expect(loaded!.displayBuffer.numberOfChannels).toBe(1)
    expect(loaded!.displayBuffer.sampleRate).toBe(1000)
    // 12 s at 1 kHz, four bytes a bucket — against 4.6 MB decoded.
    expect(loaded!.displayBytes).toBeCloseTo(12 * 1000 * 4, -2)
    expect(loaded!.sampleRate).toBe(RATE)
    expect(loaded!.channelCount).toBe(2)
  })
})
