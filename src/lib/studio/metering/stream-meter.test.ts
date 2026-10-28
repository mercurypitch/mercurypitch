// Streaming meter tests cover calibrated energy, exact windows, reset, holds and bounded inputs.
import { describe, expect, it, vi } from 'vitest'
import { studioReservedMemoryBytes } from '../memory-budget'
import { createStudioLaneMeter, createStudioLiveMeter, prepareStudioLiveMeter, } from './live-meter'
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
    (name: string, constructor: typeof Processor) => {
      if (name === 'studio-meter') Processor = constructor
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

it("the lane worklet sends each lane's louder-channel peak about 30 times a second, from when its run is heard", async () => {
  const messages: (number[] | { kind: string })[] = []
  const port = {
    onmessage: null as ((event: { data: string }) => void) | null,
    postMessage: (value: { peaks: Float32Array } | { kind: string }) =>
      messages.push('peaks' in value ? [...value.peaks] : value),
  }
  let Lanes!: new (options: {
    numberOfInputs: number
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
    (name: string, constructor: typeof Lanes) => {
      if (name === 'studio-lane-meter') Lanes = constructor
    },
  )
  // One spike per channel in a 128-frame quantum.
  const quantum = (left: number, right = left) => [
    Float32Array.from({ length: 128 }, (_, index) => (index === 7 ? left : 0)),
    Float32Array.from({ length: 128 }, (_, index) => (index === 9 ? right : 0)),
  ]
  try {
    vi.resetModules()
    await import('./meter.worklet')
    // Heard from frame 480; a lane with nothing connected has no channels.
    const processor = new Lanes({
      numberOfInputs: 3,
      processorOptions: { startAtTime: 0.01 },
    })
    for (const frame of [0, 256]) {
      vi.stubGlobal('currentFrame', frame)
      processor.process([quantum(0.9), [], quantum(0.9)])
    }
    // The quantum from frame 384 holds the start: its spikes at 391 and
    // 393 come before it and are not counted.
    vi.stubGlobal('currentFrame', 384)
    processor.process([quantum(0.9), [], quantum(0.9)])
    // 32 frames heard so far: 1600 more make the first send.
    for (let frame = 512; frame < 512 + 13 * 128; frame += 128) {
      vi.stubGlobal('currentFrame', frame)
      expect(processor.process([quantum(0.25, -0.5), [], quantum(0.1)])).toBe(
        true,
      )
    }
    expect(messages).toHaveLength(1)
    const [peaks] = messages as number[][]
    expect(peaks[0]).toBe(0.5)
    expect(peaks[1]).toBe(0)
    expect(peaks[2]).toBeCloseTo(0.1, 6)
    // A second of audio brings 30 more.
    for (let frame = 2176; frame < 2176 + 48000; frame += 128) {
      vi.stubGlobal('currentFrame', frame)
      processor.process([quantum(0.25), [], quantum(0.1)])
    }
    expect(messages).toHaveLength(31)
    port.onmessage?.({ data: 'dispose' })
    expect(messages.at(-1)).toEqual({ kind: 'disposed' })
    expect(processor.process([quantum(1), [], quantum(1)])).toBe(false)
  } finally {
    vi.unstubAllGlobals()
  }
})

/** A lane meter's surroundings on a fake audio thread; `created` holds the worklet nodes made. */
function laneMeterRig() {
  const port = {
    onmessage: null as ((event: { data: unknown }) => void) | null,
    postMessage: vi.fn(),
    close: vi.fn(),
  }
  const created: { options: AudioWorkletNodeOptions }[] = []
  vi.stubGlobal(
    'AudioWorkletNode',
    class {
      port = port
      connect = vi.fn()
      disconnect = vi.fn()
      constructor(
        _context: unknown,
        _name: string,
        options: AudioWorkletNodeOptions,
      ) {
        created.push({ options })
      }
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
  const lane = () => ({ connect: vi.fn(), disconnect: vi.fn() })
  const [vocal, bass] = [lane(), lane()]
  const lanes = new Map([
    ['vocal', vocal as unknown as AudioNode],
    ['bass', bass as unknown as AudioNode],
  ])
  /** A message from the audio thread: each lane's peak, in `measurement`. */
  const send = (measurement: number, ...peaks: number[]) =>
    port.onmessage?.({ data: { measurement, peaks: Float32Array.from(peaks) } })
  return {
    port,
    created,
    context: clock as unknown as AudioContext,
    vocal,
    bass,
    lanes,
    send,
  }
}

it('taps every lane once into one meter node and reads the highest peak since the last read, or nothing when nothing new came', async () => {
  const { port, created, context, vocal, bass, lanes, send } = laneMeterRig()
  try {
    expect(createStudioLaneMeter(context, lanes, 0.5)).toBeNull()
    await prepareStudioLiveMeter(context)
    expect(createStudioLaneMeter(context, new Map(), 0.5)).toBeNull()
    const meter = createStudioLaneMeter(context, lanes, 0.5)!
    expect(created).toHaveLength(1)
    expect(created[0].options).toMatchObject({
      numberOfInputs: 2,
      channelCount: 2,
      channelCountMode: 'explicit',
      processorOptions: { startAtTime: 0.5, measurement: meter.measurement },
    })
    expect(vocal.connect).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      0,
      0,
    )
    expect(bass.connect).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      0,
      1,
    )
    send(meter.measurement, 0.25, 0.75)
    send(meter.measurement, 0.5, 0.125)
    expect(meter.read()).toEqual(
      new Map([
        ['vocal', 0.5],
        ['bass', 0.75],
      ]),
    )
    // Nothing new since the last read: no reading, rather than silence.
    expect(meter.read()).toBeNull()
    send(meter.measurement, 0, 0.25)
    expect(meter.read()).toEqual(
      new Map([
        ['vocal', 0],
        ['bass', 0.25],
      ]),
    )
    meter.dispose()
    expect(port.postMessage).toHaveBeenCalledWith('dispose')
    expect(vocal.disconnect).toHaveBeenCalledOnce()
    port.onmessage?.({ data: { kind: 'disposed' } })
    expect(port.close).toHaveBeenCalledOnce()
  } finally {
    vi.unstubAllGlobals()
  }
})

it("drops lane peaks the audio thread sent before it heard a seek, and starts a new measurement at each seek and in each run's meter", async () => {
  const { port, context, lanes, send } = laneMeterRig()
  try {
    await prepareStudioLiveMeter(context)
    const meter = createStudioLaneMeter(context, lanes, 0.5)!
    const before = meter.measurement
    send(before, 0.9, 0.9)
    meter.restart(1.25)
    const after = meter.measurement
    expect(after).not.toBe(before)
    expect(port.postMessage).toHaveBeenLastCalledWith({
      restartAt: 1.25,
      measurement: after,
    })
    // On its way when the seek was sent: the old place's peaks, not a reading.
    send(before, 0.8, 0.8)
    expect(meter.read()).toBeNull()
    send(after, 0.0625, 0.125)
    expect(meter.read()).toEqual(
      new Map([
        ['vocal', 0.0625],
        ['bass', 0.125],
      ]),
    )
    // A run built later measures under a number of its own.
    const later = createStudioLaneMeter(context, lanes, 2)!
    expect([before, after]).not.toContain(later.measurement)
    later.dispose()
    meter.dispose()
  } finally {
    vi.unstubAllGlobals()
  }
})
