// Streaming meter tests cover calibrated energy, exact windows, reset, holds and bounded inputs.
import { describe, expect, it, vi } from 'vitest'
import { studioReservedMemoryBytes } from '../memory-budget'
import { createStudioLiveMeter, prepareStudioLiveMeter } from './live-meter'
import { meterTone } from './meter.test-fixtures'
import { createStudioMeter, studioMeterWorkingBytes } from './stream-meter'

describe('Studio streaming loudness', () => {
  it('matches whole input across irregular chunks at both live sample rates', () => {
    for (const sampleRate of [44100, 48000]) {
      const data = meterTone(sampleRate)
      const options = {
        sampleRate,
        channels: 2 as const,
        maxFrames: data.length,
      }
      const whole = createStudioMeter(options)
      whole.push([data, data])
      const chunked = createStudioMeter(options)
      for (let from = 0; from < data.length; from += 137)
        chunked.push([data, data], from, Math.min(from + 137, data.length))
      expect(chunked.finish()).toEqual(whole.finish())
      expect(whole.finish().integratedLufs).toBeCloseTo(-20, 1)
      expect(studioMeterWorkingBytes(options)).toBeLessThan(1_200_000)
    }
  })

  it('waits for complete windows and drops a stopped tone from each at its actual boundary', () => {
    const rate = 48000
    const meter = createStudioMeter({
      sampleRate: rate,
      channels: 1,
      dualMono: true,
    })
    const tone = meterTone(rate)
    meter.push([tone], 0, 19199)
    expect(meter.snapshot().momentaryLufs).toBeNull()
    meter.push([tone], 19199, 144000)
    expect(meter.snapshot().momentaryLufs).toBeCloseTo(-20, 1)
    expect(meter.snapshot().shortTermLufs).toBeCloseTo(-20, 1)
    meter.push([new Float32Array(19200)])
    expect(meter.snapshot().momentaryLufs).toBeLessThan(-45)
    expect(meter.snapshot().shortTermLufs).toBeGreaterThan(-22)
    meter.push([new Float32Array(144000)])
    expect(meter.snapshot().shortTermLufs).toBeLessThan(-100)
    meter.reset()
    expect(meter.snapshot().frames).toBe(0)
    expect(meter.snapshot().shortTermLufs).toBeNull()
  })

  it('captures between-read peaks, retains holds and rejects corrupt or over-budget input', () => {
    const meter = createStudioMeter({
      sampleRate: 48000,
      channels: 2,
      maxFrames: 10,
    })
    meter.push([new Float32Array([0, 1.2, 0]), new Float32Array([0, -0.5, 0])])
    expect(meter.snapshot(true)).toMatchObject({
      peakL: expect.closeTo(1.2),
      peakR: 0.5,
      clipL: true,
      clipR: false,
    })
    expect(meter.snapshot()).toMatchObject({
      peakL: 0,
      holdL: expect.closeTo(1.2),
      clipL: true,
    })
    meter.clearPeakHold()
    expect(meter.snapshot().clipL).toBe(false)
    expect(() =>
      meter.push([new Float32Array([NaN]), new Float32Array([0])]),
    ).toThrow('invalid samples')
    expect(() =>
      meter.push([new Float32Array(11), new Float32Array(11)]),
    ).toThrow('duration')
    expect(() =>
      meter.push([new Float32Array(1), new Float32Array(0)]),
    ).toThrow('inconsistent')
  })
})

it('the worklet observes every quantum after warmup and reports real window readiness', async () => {
  const messages: ReturnType<
    ReturnType<typeof createStudioMeter>['snapshot']
  >[] = []
  const port = {
    onmessage: null as ((event: { data: string }) => void) | null,
    postMessage: (value: (typeof messages)[number]) => messages.push(value),
  }
  let Processor!: new (options: {
    processorOptions: { startAtTime: number }
  }) => { process(inputs: Float32Array[][]): boolean }
  vi.stubGlobal('sampleRate', 48000)
  vi.stubGlobal('currentFrame', 0)
  vi.stubGlobal(
    'AudioWorkletProcessor',
    class {
      port = port
    },
  )
  vi.stubGlobal(
    'registerProcessor',
    (_name: string, constructor: typeof Processor) => {
      Processor = constructor
    },
  )
  try {
    await import('./meter.worklet')
    const processor = new Processor({ processorOptions: { startAtTime: 0.5 } })
    for (let frame = 0; frame < 48000 * 3.7; frame += 128) {
      vi.stubGlobal('currentFrame', frame)
      const channel = Float32Array.from(
        { length: 128 },
        (_, index) =>
          Math.sin(((frame + index) * 997 * Math.PI * 2) / 48000) * 0.1,
      )
      if (frame === 48000) channel[20] = 1.2
      expect(processor.process([[channel, channel]])).toBe(true)
      if (frame < 24000) expect(messages).toHaveLength(0)
    }
    expect(messages[0].momentaryLufs).toBeNull()
    expect(messages[0].shortTermLufs).toBeNull()
    expect(messages.some((message) => message.peakL > 1)).toBe(true)
    expect(messages.at(-1)?.clipL).toBe(true)
    expect(messages.at(-1)?.holdL).toBeCloseTo(1.2)
    expect(messages.at(-1)?.momentaryLufs).toBeCloseTo(-20, 1)
    expect(messages.at(-1)?.shortTermLufs).toBeCloseTo(-20, 1)
    port.onmessage?.({ data: 'clear-hold' })
    for (let quantum = 0; quantum < 15; quantum++)
      processor.process([[new Float32Array(128), new Float32Array(128)]])
    expect(messages.at(-1)?.clipL).toBe(false)
    expect(messages.at(-1)?.holdL).toBe(0)
    port.onmessage?.({ data: 'dispose' })
    expect(messages.at(-1)).toEqual({ kind: 'disposed' })
    expect(
      processor.process([[new Float32Array(128), new Float32Array(128)]]),
    ).toBe(false)
  } finally {
    vi.unstubAllGlobals()
  }
})

it('holds a disconnected worklet reservation until shutdown is acknowledged or its borrowed context closes', async () => {
  const port = {
    onmessage: null as ((event: { data: { kind: 'disposed' } }) => void) | null,
    postMessage: vi.fn(),
    close: vi.fn(),
  }
  vi.stubGlobal(
    'AudioWorkletNode',
    class {
      port = port
      connect = vi.fn()
      disconnect = vi.fn()
    },
  )
  const clock = Object.assign(new EventTarget(), {
    sampleRate: 48000,
    state: 'running',
    destination: {},
    audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
    createGain: () => ({
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
  })
  const context = clock as unknown as AudioContext
  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as AudioNode
  try {
    await prepareStudioLiveMeter(context)
    const meter = createStudioLiveMeter(context, source, 0)!
    const held = studioReservedMemoryBytes()
    expect(held).toBeGreaterThan(0)
    meter.dispose()
    expect(port.postMessage).toHaveBeenCalledWith('dispose')
    expect(port.close).not.toHaveBeenCalled()
    expect(studioReservedMemoryBytes()).toBe(held)
    port.onmessage?.({ data: { kind: 'disposed' } })
    expect(studioReservedMemoryBytes()).toBe(0)
    expect(port.close).toHaveBeenCalledOnce()
    meter.dispose()
    const next = createStudioLiveMeter(context, source, 0)!
    next.dispose()
    expect(studioReservedMemoryBytes()).toBe(held)
    clock.state = 'closed'
    clock.dispatchEvent(new Event('statechange'))
    expect(studioReservedMemoryBytes()).toBe(0)
  } finally {
    vi.unstubAllGlobals()
  }
})
