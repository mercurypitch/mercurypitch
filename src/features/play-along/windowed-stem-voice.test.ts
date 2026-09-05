// ============================================================
// Windowed stem voice tests — chain scheduling on a fake clock
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { WavBlobFormat } from '@/lib/wav-blob-window'
import type { WindowedStemVoiceOptions } from './windowed-stem-voice'
import { createWindowedStemVoice } from './windowed-stem-voice'

class FakeParam {
  value = 1
}

class FakeGain {
  readonly gain = new FakeParam()
  readonly connect = vi.fn()
  readonly disconnect = vi.fn()
}

class FakeSource {
  buffer: { length: number; sampleRate: number } | null = null
  onended: (() => void) | null = null
  readonly playbackRate = new FakeParam()
  readonly connect = vi.fn()
  readonly disconnect = vi.fn()
  readonly startCalls: [number, number?, number?][] = []
  readonly stopCalls: number[] = []
  start(when: number, offset?: number, duration?: number): void {
    this.startCalls.push([when, offset, duration])
  }
  stop(when?: number): void {
    this.stopCalls.push(when ?? 0)
  }
  end(): void {
    this.onended?.()
  }
}

class FakeContext {
  currentTime = 100
  readonly sources: FakeSource[] = []
  readonly gains: FakeGain[] = []
  readonly buffers: { channels: number; frames: number; rate: number }[] = []

  createGain(): GainNode {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain as unknown as GainNode
  }
  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeSource()
    this.sources.push(source)
    return source as unknown as AudioBufferSourceNode
  }
  createBuffer(channels: number, frames: number, rate: number): AudioBuffer {
    this.buffers.push({ channels, frames, rate })
    return {
      length: frames,
      numberOfChannels: channels,
      sampleRate: rate,
      duration: frames / rate,
      copyToChannel: vi.fn(),
    } as unknown as AudioBuffer
  }
}

/** 25 frames at 10 Hz: 2.5 s of audio, windowSeconds 1 → windows 10/10/5. */
function format(frameCount = 25, sampleRate = 10): WavBlobFormat {
  return {
    formatTag: 1,
    channelCount: 1,
    sampleRate,
    bitsPerSample: 16,
    bytesPerFrame: 2,
    dataByteOffset: 44,
    dataByteLength: frameCount * 2,
    frameCount,
    durationSeconds: frameCount / sampleRate,
  }
}

function voice(
  context: FakeContext,
  overrides: Partial<WindowedStemVoiceOptions> = {},
) {
  const readCalls: [number, number][] = []
  const readWindow = vi.fn(
    async (_blob: Blob, wav: WavBlobFormat, start: number, frames: number) => {
      readCalls.push([start, frames])
      return Array.from(
        { length: wav.channelCount },
        () => new Float32Array(frames),
      )
    },
  )
  const onEnded = vi.fn()
  const destination = context.createGain()
  const handle = createWindowedStemVoice({
    context: context as unknown as BaseAudioContext,
    destination: destination as unknown as AudioNode,
    blob: new Blob(['unused']),
    format: format(),
    atContextTime: 100,
    sourceOffsetSeconds: 0,
    playbackRate: 1,
    windowSeconds: 1,
    lookaheadWindows: 2,
    readWindow,
    onEnded,
    ...overrides,
  })
  return { handle, readCalls, readWindow, onEnded, destination }
}

async function settled(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

describe('createWindowedStemVoice', () => {
  it('schedules the lookahead, then tops up as windows end', async () => {
    const context = new FakeContext()
    const { handle, readCalls, onEnded } = voice(context)
    await settled()

    // Two windows in flight, back to back on the clock.
    expect(readCalls).toEqual([
      [0, 10],
      [10, 10],
    ])
    expect(context.sources.map((source) => source.startCalls[0]?.[0])).toEqual([
      100, 101,
    ])

    context.sources[0].end()
    await settled()
    expect(readCalls).toEqual([
      [0, 10],
      [10, 10],
      [20, 5],
    ])
    expect(context.sources[2].startCalls[0]?.[0]).toBe(102)

    context.sources[1].end()
    await settled()
    context.sources[2].end()
    await settled()
    expect(onEnded).toHaveBeenCalledOnce()
    expect(handle.ended).toBe(true)
  })

  it('divides the clock cadence by the playback rate', async () => {
    const context = new FakeContext()
    voice(context, { playbackRate: 2 })
    await settled()

    expect(context.sources.map((source) => source.startCalls[0]?.[0])).toEqual([
      100, 100.5,
    ])
    expect(context.sources[0].playbackRate.value).toBe(2)
  })

  it('starts mid-song from the requested source offset', async () => {
    const context = new FakeContext()
    const { readCalls } = voice(context, { sourceOffsetSeconds: 0.5 })
    await settled()

    expect(readCalls).toEqual([
      [5, 10],
      [15, 10],
    ])
  })

  it('caps the chain at maxDurationSeconds for subtraction pairs', async () => {
    const context = new FakeContext()
    const { readCalls } = voice(context, { maxDurationSeconds: 1.2 })
    await settled()

    // 12 frames total: one full window and one 2-frame tail.
    expect(readCalls).toEqual([
      [0, 10],
      [10, 2],
    ])
  })

  it('stop() halts scheduling and stops live sources at the given time', async () => {
    const context = new FakeContext()
    const { handle, readCalls, onEnded } = voice(context)
    await settled()

    handle.stop(101.5)
    context.sources[0].end()
    await settled()

    expect(readCalls).toHaveLength(2)
    expect(context.sources[0].stopCalls).toEqual([101.5])
    expect(context.sources[1].stopCalls).toEqual([101.5])
    // The engine's release is still sounding on the envelope until the
    // last live window reaches its stop time; ending the voice at stop()
    // let the engine tear the envelope down under it.
    expect(handle.ended).toBe(false)
    expect(onEnded).not.toHaveBeenCalled()

    context.sources[1].end()
    expect(handle.ended).toBe(true)
    expect(onEnded).toHaveBeenCalledOnce()
  })

  it('a second stop() only ever pulls the stop forward', async () => {
    const context = new FakeContext()
    const { handle } = voice(context)
    await settled()

    handle.stop(101.5)
    handle.stop(102)
    handle.stop(101.2)
    expect(context.sources[0].stopCalls).toEqual([101.5, 101.2])
    expect(handle.ended).toBe(false)
  })

  it('does not wait on a window that was never started', async () => {
    const context = new FakeContext()
    const { handle, onEnded } = voice(context)
    await settled()

    // A source refuses stop() until start() has been called on it.
    context.sources[1].stop = () => {
      throw new DOMException('not started', 'InvalidStateError')
    }
    handle.stop(101.5)
    expect(context.sources[1].disconnect).toHaveBeenCalled()
    expect(handle.ended).toBe(false)

    context.sources[0].end()
    expect(handle.ended).toBe(true)
    expect(onEnded).toHaveBeenCalledOnce()
  })

  it('starts a late window immediately, skipping what the clock passed', async () => {
    const context = new FakeContext()
    const { handle } = voice(context)
    await settled()

    // Simulate a slow read: the clock is already 0.4 s into window 2's slot
    // by the time it schedules.
    context.currentTime = 102.4
    context.sources[0].end()
    await settled()

    const late = context.sources[2]
    expect(late.startCalls[0]?.[0]).toBe(102.4)
    expect(late.startCalls[0]?.[1]).toBeCloseTo(0.4)
    expect(handle.ended).toBe(false)
  })

  it('ends immediately when the offset is past the audio', async () => {
    const context = new FakeContext()
    const { readCalls, onEnded, handle } = voice(context, {
      sourceOffsetSeconds: 10,
    })
    await settled()

    expect(readCalls).toHaveLength(0)
    expect(onEnded).toHaveBeenCalledOnce()
    expect(handle.ended).toBe(true)
  })

  it('dispose() severs the graph and stops everything', async () => {
    const context = new FakeContext()
    const { handle } = voice(context)
    await settled()

    handle.dispose()
    expect(context.sources[0].stopCalls).toHaveLength(1)
    expect(context.gains[1].disconnect).toHaveBeenCalled()
    expect(handle.ended).toBe(true)
  })
})
