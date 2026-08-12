// ============================================================
// Piano sampled instrument tests — lazy I/O, cache bounds, voices, and pedals
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { createPianoSampledInstrument } from './piano-sampled-instrument'

const MIB = 1024 * 1024

interface ParameterEvent {
  kind: 'cancel' | 'exponential' | 'hold' | 'set' | 'target'
  value?: number
  at: number
}

class FakeAudioParam {
  value = 1
  readonly events: ParameterEvent[] = []

  cancelScheduledValues(at: number): void {
    this.events.push({ kind: 'cancel', at })
  }

  cancelAndHoldAtTime(at: number): void {
    this.events.push({ kind: 'hold', at })
  }

  setValueAtTime(value: number, at: number): this {
    this.value = value
    this.events.push({ kind: 'set', value, at })
    return this
  }

  setTargetAtTime(value: number, at: number): this {
    this.value = value
    this.events.push({ kind: 'target', value, at })
    return this
  }

  exponentialRampToValueAtTime(value: number, at: number): this {
    this.value = value
    this.events.push({ kind: 'exponential', value, at })
    return this
  }
}

class FakeAudioNode {
  readonly connect = vi.fn((destination: unknown) => destination)
  readonly disconnect = vi.fn()
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam()
}

class FakeBiquadFilterNode extends FakeAudioNode {
  type: BiquadFilterType = 'lowpass'
  readonly frequency = new FakeAudioParam()
  readonly Q = new FakeAudioParam()
}

class FakeDelayNode extends FakeAudioNode {
  readonly delayTime = new FakeAudioParam()
}

class FakeCompressorNode extends FakeAudioNode {
  readonly threshold = new FakeAudioParam()
  readonly knee = new FakeAudioParam()
  readonly ratio = new FakeAudioParam()
  readonly attack = new FakeAudioParam()
  readonly release = new FakeAudioParam()
}

class FakeBufferSourceNode extends FakeAudioNode {
  buffer: AudioBuffer | null = null
  readonly playbackRate = new FakeAudioParam()
  readonly starts: number[] = []
  readonly stops: number[] = []
  onended: (() => void) | null = null

  start(at = 0): void {
    this.starts.push(at)
  }

  stop(at = 0): void {
    this.stops.push(at)
  }
}

function decodedBuffer(length = 10): AudioBuffer {
  return {
    duration: length / 48_000,
    length,
    numberOfChannels: 2,
    sampleRate: 48_000,
  } as unknown as AudioBuffer
}

function realisticEncodedMarker(url: string): number {
  if (url.includes('piano-mp3-velocity')) return 1
  if (url.includes('pedalD')) return 3
  return 2
}

function realisticDecodedBuffer(encoded: ArrayBuffer): AudioBuffer {
  const marker = new Uint8Array(encoded)[0]
  const decodedBytes =
    marker === 1 ? 6 * MIB : marker === 3 ? 2.25 * MIB : 384 * 1024
  return decodedBuffer(decodedBytes / 8)
}

class FakeAudioContext {
  currentTime = 10
  sampleRate = 48_000
  state: AudioContextState = 'running'
  readonly destination = new FakeAudioNode()
  readonly gains: FakeGainNode[] = []
  readonly filters: FakeBiquadFilterNode[] = []
  readonly delays: FakeDelayNode[] = []
  readonly compressors: FakeCompressorNode[] = []
  readonly sources: FakeBufferSourceNode[] = []
  readonly decodeAudioData = vi.fn(async (_encoded: ArrayBuffer) =>
    decodedBuffer(),
  )

  createGain(): GainNode {
    const gain = new FakeGainNode()
    this.gains.push(gain)
    return gain as unknown as GainNode
  }

  createBiquadFilter(): BiquadFilterNode {
    const filter = new FakeBiquadFilterNode()
    this.filters.push(filter)
    return filter as unknown as BiquadFilterNode
  }

  createDelay(_maximumDelayTime?: number): DelayNode {
    const delay = new FakeDelayNode()
    this.delays.push(delay)
    return delay as unknown as DelayNode
  }

  createDynamicsCompressor(): DynamicsCompressorNode {
    const compressor = new FakeCompressorNode()
    this.compressors.push(compressor)
    return compressor as unknown as DynamicsCompressorNode
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeBufferSourceNode()
    this.sources.push(source)
    return source as unknown as AudioBufferSourceNode
  }
}

function harness(
  options: {
    context?: FakeAudioContext | null
    fetchArrayBuffer?: (
      url: string,
      signal: AbortSignal,
      maximumBytes: number,
    ) => Promise<ArrayBuffer>
    loadConcurrency?: number
    maxDecodedBytes?: number
    maxEncodedSampleBytes?: number
    maxVoices?: number
  } = {},
) {
  const context =
    options.context === undefined ? new FakeAudioContext() : options.context
  const getAudioContext = vi.fn(() => context as AudioContext | null)
  const requestedUrls: string[] = []
  let fetchFails = false
  const fetchArrayBuffer = vi.fn(
    async (url: string, signal: AbortSignal, maximumBytes: number) => {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
      requestedUrls.push(url)
      if (options.fetchArrayBuffer !== undefined) {
        return options.fetchArrayBuffer(url, signal, maximumBytes)
      }
      if (fetchFails) throw new TypeError('offline')
      return new Uint8Array([1]).buffer
    },
  )
  const instrument = createPianoSampledInstrument({
    getAudioContext,
    fetchArrayBuffer,
    ...(options.maxDecodedBytes === undefined
      ? {}
      : { maxDecodedBytes: options.maxDecodedBytes }),
    ...(options.maxEncodedSampleBytes === undefined
      ? {}
      : { maxEncodedSampleBytes: options.maxEncodedSampleBytes }),
    ...(options.maxVoices === undefined
      ? {}
      : { maxVoices: options.maxVoices }),
    ...(options.loadConcurrency === undefined
      ? {}
      : { loadConcurrency: options.loadConcurrency }),
  })
  return {
    context,
    getAudioContext,
    fetchArrayBuffer,
    requestedUrls,
    instrument,
    setFetchFails(value: boolean) {
      fetchFails = value
    },
  }
}

function lastTarget(parameter: FakeAudioParam): number | undefined {
  return parameter.events.findLast((event) => event.kind === 'target')?.value
}

describe('createPianoSampledInstrument', () => {
  it('does no audio or network work at module construction or while controls are staged', () => {
    const { context, fetchArrayBuffer, getAudioContext, instrument } = harness()

    instrument.setCharacter('soft')
    instrument.setAmbience('hall')

    expect(getAudioContext).not.toHaveBeenCalled()
    expect(fetchArrayBuffer).not.toHaveBeenCalled()
    expect(context?.gains).toHaveLength(0)
    expect(instrument.getLoadSnapshot()).toMatchObject({
      status: 'idle',
      loadedSamples: 0,
      preparedSamples: 0,
      plannedSamples: 0,
      decodedBytes: 0,
      error: null,
    })
  })

  it('loads only one coverage anchor lazily onto one shared graph', async () => {
    const { context, fetchArrayBuffer, getAudioContext, instrument } = harness()

    await instrument.load()

    expect(getAudioContext).toHaveBeenCalled()
    expect(fetchArrayBuffer).toHaveBeenCalledTimes(1)
    expect(context?.decodeAudioData).toHaveBeenCalledTimes(1)
    expect(context?.filters).toHaveLength(1)
    expect(context?.compressors).toHaveLength(1)
    expect(instrument.getLoadSnapshot()).toMatchObject({
      status: 'ready',
      loadedSamples: 1,
      preparedSamples: 1,
      plannedSamples: 1,
      totalSamples: 1,
      decodedBytes: 80,
      error: null,
    })
    expect(instrument.descriptor()).toMatchObject({
      kind: 'sampled',
      maximumVoices: 64,
    })

    await instrument.load()
    expect(fetchArrayBuffer).toHaveBeenCalledTimes(1)
    expect(context?.filters).toHaveLength(1)
  })

  it('rejects an oversized declared response before reading or decoding it', async () => {
    const context = new FakeAudioContext()
    const getReader = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': '5' }),
      body: { getReader },
    } as unknown as Response)
    const instrument = createPianoSampledInstrument({
      getAudioContext: () => context as unknown as AudioContext,
      maxEncodedSampleBytes: 4,
    })

    try {
      await expect(instrument.load()).rejects.toThrow()
      expect(fetchSpy).toHaveBeenCalledOnce()
      expect(getReader).not.toHaveBeenCalled()
      expect(context.decodeAudioData).not.toHaveBeenCalled()
    } finally {
      instrument.dispose()
      fetchSpy.mockRestore()
    }
  })

  it('caps a streamed response even when content-length is absent', async () => {
    const context = new FakeAudioContext()
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(new Uint8Array(6)))
    const instrument = createPianoSampledInstrument({
      getAudioContext: () => context as unknown as AudioContext,
      maxEncodedSampleBytes: 4,
    })

    try {
      await expect(instrument.load()).rejects.toThrow()
      expect(fetchSpy).toHaveBeenCalledOnce()
      expect(context.decodeAudioData).not.toHaveBeenCalled()
    } finally {
      instrument.dispose()
      fetchSpy.mockRestore()
    }
  })

  it('prewarms requested keys across velocity layers without duplicate downloads', async () => {
    const { fetchArrayBuffer, instrument, requestedUrls } = harness()
    await instrument.load()

    await instrument.prewarm([60, 61, 60])

    expect(fetchArrayBuffer).toHaveBeenCalledTimes(10)
    expect(
      requestedUrls.filter((url) => url.endsWith('/rel40.mp3')),
    ).toHaveLength(1)
    expect(
      requestedUrls.filter((url) => url.endsWith('/rel41.mp3')),
    ).toHaveLength(1)
    expect(instrument.getLoadSnapshot()).toMatchObject({
      status: 'ready',
      loadedSamples: 10,
    })
  })

  it('omits out-of-range pitches from prewarm instead of clamping them to edge samples', async () => {
    const { fetchArrayBuffer, instrument, requestedUrls } = harness()

    await instrument.prewarm([20, Number.NaN, 109])

    expect(fetchArrayBuffer).not.toHaveBeenCalled()
    expect(instrument.getLoadSnapshot()).toMatchObject({
      status: 'idle',
      loadedSamples: 0,
      preparedSamples: 0,
      plannedSamples: 0,
    })

    await instrument.prewarm([20, 60, 109])

    expect(requestedUrls.some((url) => url.includes('/A0v'))).toBe(false)
    expect(requestedUrls.some((url) => url.includes('/C8v'))).toBe(false)
    expect(requestedUrls.some((url) => url.includes('/C4v12.mp3'))).toBe(true)
  })

  it('returns false for out-of-range notes so the router can preserve their pitch in fallback', async () => {
    const { context, instrument } = harness()
    await instrument.prewarm([21, 108])

    expect(
      instrument.noteOn({ id: 'below-range', midi: 20, velocity: 0.8 }),
    ).toBe(false)
    expect(
      instrument.noteOn({ id: 'above-range', midi: 109, velocity: 0.8 }),
    ).toBe(false)
    expect(context?.sources).toHaveLength(0)

    expect(instrument.noteOn({ id: 'low-edge', midi: 21, velocity: 0.8 })).toBe(
      true,
    )
    expect(
      instrument.noteOn({ id: 'high-edge', midi: 108, velocity: 0.8 }),
    ).toBe(true)
    expect(context?.sources).toHaveLength(2)
  })

  it('budgets a realistic phrase before decoding while retaining all eight coverage roots', async () => {
    const context = new FakeAudioContext()
    context.decodeAudioData.mockImplementation(async (encoded: ArrayBuffer) =>
      realisticDecodedBuffer(encoded),
    )
    const { instrument, requestedUrls } = harness({
      context,
      fetchArrayBuffer: async (url) =>
        new Uint8Array([realisticEncodedMarker(url)]).buffer,
    })
    const roots = [21, 24, 27, 30, 33, 36, 39, 42]

    await instrument.prewarm([...roots, 45])

    expect(
      requestedUrls
        .slice(0, roots.length)
        .every((url) => url.endsWith('v12.mp3')),
    ).toBe(true)
    expect(requestedUrls.some((url) => url.endsWith('v4.mp3'))).toBe(true)
    expect(requestedUrls.some((url) => url.endsWith('v16.mp3'))).toBe(true)
    expect(requestedUrls.some((url) => url.endsWith('v8.mp3'))).toBe(false)
    expect(requestedUrls.some((url) => url.endsWith('/rel25.mp3'))).toBe(false)
    expect(
      requestedUrls.filter((url) => url.includes('piano-mp3-release')),
    ).toHaveLength(roots.length)
    expect(
      requestedUrls.filter((url) => url.includes('piano-mp3-pedals')),
    ).toHaveLength(4)
    expect(requestedUrls).toHaveLength(25)
    expect(new Set(requestedUrls).size).toBe(25)
    expect(context.decodeAudioData).toHaveBeenCalledTimes(25)
    expect(instrument.getLoadSnapshot()).toMatchObject({
      status: 'ready',
      loadedSamples: 25,
      preparedSamples: 25,
      plannedSamples: 25,
      totalSamples: 25,
      error: null,
    })
    expect(instrument.getLoadSnapshot().decodedBytes).toBeLessThanOrEqual(
      96 * MIB,
    )
    expect(instrument.getLoadSnapshot().loadedSamples).toBeGreaterThanOrEqual(
      roots.length,
    )
    for (const rootMidi of roots) {
      expect(
        instrument.noteOn({
          id: `coverage:${rootMidi}`,
          midi: rootMidi,
          velocity: 0.6,
        }),
      ).toBe(true)
    }
  })

  it('keeps current coverage pinned while a current-first lookahead plan adds new roots', async () => {
    const context = new FakeAudioContext()
    context.decodeAudioData.mockImplementation(async (encoded: ArrayBuffer) =>
      realisticDecodedBuffer(encoded),
    )
    const { instrument, requestedUrls } = harness({
      context,
      fetchArrayBuffer: async (url) =>
        new Uint8Array([realisticEncodedMarker(url)]).buffer,
    })
    const currentRoots = [60, 63, 66, 69]
    const lookaheadRoots = [72, 75, 78, 81]

    await instrument.prewarm(currentRoots)
    await instrument.prewarm([...currentRoots, ...lookaheadRoots])

    for (const rootMidi of [...currentRoots, ...lookaheadRoots]) {
      expect(
        instrument.noteOn({
          id: `lookahead:${rootMidi}`,
          midi: rootMidi,
          velocity: 0.6,
        }),
      ).toBe(true)
    }
    for (const rootMidi of currentRoots) {
      const noteName = ['C4', 'D%234', 'F%234', 'A4'][
        currentRoots.indexOf(rootMidi)
      ]
      expect(
        requestedUrls.filter((url) => url.endsWith(`/${noteName}v12.mp3`)),
      ).toHaveLength(1)
    }
    expect(instrument.getLoadSnapshot().decodedBytes).toBeLessThanOrEqual(
      96 * MIB,
    )
    expect(instrument.getLoadSnapshot().preparedSamples).toBe(
      instrument.getLoadSnapshot().plannedSamples,
    )
  })

  it('plays cached samples synchronously, pitch-shifts from the nearest root, and adds releases', async () => {
    const { context, instrument } = harness()
    expect(instrument.noteOn({ id: 'early', midi: 60, velocity: 0.8 })).toBe(
      false,
    )
    await instrument.prewarm([61])

    expect(instrument.noteOn({ id: 'live:61', midi: 61, velocity: 0.8 })).toBe(
      true,
    )
    const attack = context?.sources[0]
    expect(attack?.starts).toEqual([10])
    expect(attack?.playbackRate.events[0]).toMatchObject({
      kind: 'set',
      value: Math.pow(2, 1 / 12),
      at: 10,
    })

    expect(instrument.noteOff({ id: 'live:61', releaseVelocity: 0.9 })).toBe(
      true,
    )
    expect(attack?.stops.at(-1)).toBeCloseTo(10.17)
    expect(context?.sources).toHaveLength(2)
    expect(context?.sources[1].starts).toEqual([10])
  })

  it('releases on noteOff immediately because upstream owns pedal-held lifetimes', async () => {
    const { context, instrument } = harness()
    await instrument.prewarm([60])
    instrument.noteOn({ id: 'held', midi: 60, velocity: 0.7 })
    const attack = context?.sources[0]

    instrument.pedal({ pedal: 'sustain', value: 1 })
    expect(instrument.noteOff({ id: 'held' })).toBe(true)
    expect(attack?.stops.at(-1)).toBeCloseTo(10.17)
    expect(instrument.activeVoiceIds()).toEqual(['held'])

    instrument.pedal({ pedal: 'sustain', value: 0 })
    expect(attack?.stops).toHaveLength(1)
  })

  it('steals the oldest voice deterministically at the configured ceiling', async () => {
    const { context, instrument } = harness({ maxVoices: 2 })
    await instrument.prewarm([60, 63, 66])

    instrument.noteOn({ id: 'first', midi: 60, velocity: 0.8 })
    instrument.noteOn({ id: 'second', midi: 63, velocity: 0.8 })
    instrument.noteOn({ id: 'third', midi: 66, velocity: 0.8 })

    expect(instrument.activeVoiceIds()).toEqual(['second', 'third'])
    expect(context?.sources[0].stops.at(-1)).toBeCloseTo(10.03)
    expect(context?.sources[1].stops).toEqual([])
  })

  it('keeps decoded buffers within an LRU byte ceiling and refetches evicted zones', async () => {
    const { instrument, requestedUrls } = harness({ maxDecodedBytes: 320 })

    await instrument.prewarm([21])
    expect(instrument.getLoadSnapshot()).toMatchObject({
      status: 'ready',
      loadedSamples: 4,
      decodedBytes: 320,
    })
    await instrument.prewarm([60])
    await instrument.prewarm([21])

    expect(
      requestedUrls.filter((url) => url.endsWith('/A0v12.mp3')),
    ).toHaveLength(2)
    expect(instrument.getLoadSnapshot().decodedBytes).toBeLessThanOrEqual(320)
    expect(instrument.getLoadSnapshot().loadedSamples).toBeLessThanOrEqual(4)
  })

  it('keeps active voice buffers pinned and counted while a new range prepares', async () => {
    const { context, instrument, requestedUrls } = harness({
      maxDecodedBytes: 8 * MIB,
    })
    context!.decodeAudioData.mockResolvedValue(decodedBuffer((4 * MIB) / 8))

    await instrument.prewarm([60])
    expect(
      instrument.noteOn({ id: 'retained:C4', midi: 60, velocity: 0.6 }),
    ).toBe(true)

    await instrument.prewarm([63])

    expect(instrument.getLoadSnapshot()).toMatchObject({
      status: 'ready',
      loadedSamples: 2,
      decodedBytes: 8 * MIB,
      preparedSamples: 1,
      plannedSamples: 1,
      error: null,
    })
    expect(
      requestedUrls.filter((url) => url.endsWith('/C4v12.mp3')),
    ).toHaveLength(1)
    expect(
      instrument.noteOn({ id: 'retained:C4:again', midi: 60, velocity: 0.6 }),
    ).toBe(true)
    expect(
      instrument.noteOn({ id: 'coverage:D%234', midi: 63, velocity: 0.6 }),
    ).toBe(true)
  })

  it('surfaces a graceful load error and can retry when connectivity returns', async () => {
    const { instrument, setFetchFails } = harness()
    setFetchFails(true)

    await expect(instrument.load()).rejects.toThrow()
    expect(instrument.getLoadSnapshot()).toMatchObject({
      status: 'error',
      error:
        'The sampled piano could not finish loading. The fallback piano remains available.',
    })
    expect(instrument.noteOn({ id: 'fallback', midi: 60, velocity: 1 })).toBe(
      false,
    )

    setFetchFails(false)
    await instrument.load()
    expect(instrument.getLoadSnapshot()).toMatchObject({
      status: 'ready',
      error: null,
    })
  })

  it('honors cancellation before fetching and reports an unavailable context safely', async () => {
    const cancelled = harness()
    const abort = new AbortController()
    abort.abort()
    await expect(cancelled.instrument.load(abort.signal)).rejects.toMatchObject(
      {
        name: 'AbortError',
      },
    )
    expect(cancelled.fetchArrayBuffer).not.toHaveBeenCalled()

    const unavailable = harness({ context: null })
    await expect(unavailable.instrument.load()).rejects.toThrow(
      'active audio session',
    )
    expect(unavailable.instrument.getLoadSnapshot()).toMatchObject({
      status: 'error',
      error:
        'The sampled piano needs an active audio session. The fallback piano remains available.',
    })
    expect(
      unavailable.instrument.noteOn({ id: 'none', midi: 60, velocity: 1 }),
    ).toBe(false)
  })

  it('cancels an active preparation without turning a usable prior state into an error', async () => {
    let markStarted!: () => void
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    const { fetchArrayBuffer, instrument } = harness({
      fetchArrayBuffer: async (_url, signal) => {
        markStarted()
        return new Promise<ArrayBuffer>((_resolve, reject) => {
          const rejectAbort = () =>
            reject(new DOMException('Cancelled', 'AbortError'))
          signal.addEventListener('abort', rejectAbort, { once: true })
          if (signal.aborted) rejectAbort()
        })
      },
    })
    const abort = new AbortController()
    const loading = instrument.prewarm([60, 63], abort.signal)
    await started

    expect(fetchArrayBuffer).toHaveBeenCalledTimes(2)
    abort.abort()
    await expect(loading).rejects.toMatchObject({ name: 'AbortError' })
    expect(instrument.getLoadSnapshot()).toMatchObject({
      status: 'idle',
      preparedSamples: 0,
      plannedSamples: 0,
      error: null,
    })
  })

  it('aborts mid-flight work and clears retained state when disposed', async () => {
    let markStarted!: () => void
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    const { context, instrument } = harness({
      fetchArrayBuffer: async (_url, signal) => {
        markStarted()
        return new Promise<ArrayBuffer>((_resolve, reject) => {
          const rejectAbort = () =>
            reject(new DOMException('Disposed', 'AbortError'))
          signal.addEventListener('abort', rejectAbort, { once: true })
          if (signal.aborted) rejectAbort()
        })
      },
    })
    const listener = vi.fn()
    instrument.subscribe(listener)
    const loading = instrument.prewarm([60])
    await started

    instrument.dispose()

    await expect(loading).rejects.toMatchObject({ name: 'AbortError' })
    expect(context?.decodeAudioData).not.toHaveBeenCalled()
    expect(instrument.getLoadSnapshot()).toMatchObject({
      status: 'idle',
      loadedSamples: 0,
      preparedSamples: 0,
      plannedSamples: 0,
      decodedBytes: 0,
      error: null,
    })
    const callsAfterDispose = listener.mock.calls.length
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(callsAfterDispose)
  })

  it('applies character and ambience to the existing graph without rebuilding it', async () => {
    const { context, instrument } = harness()
    await instrument.load()
    const filter = context?.filters[0]
    const dry = context?.gains[1]

    instrument.setCharacter('soft')
    instrument.setAmbience('hall')

    expect(lastTarget(filter!.frequency)).toBe(5_800)
    expect(lastTarget(dry!.gain)).toBe(0.72)
    expect(context?.filters).toHaveLength(1)
  })

  it('resets soft-pedal expression on panic', async () => {
    const { context, instrument } = harness()
    await instrument.prewarm([60])
    instrument.pedal({ pedal: 'soft', value: 1 })

    instrument.panic()
    expect(
      instrument.noteOn({ id: 'after-panic', midi: 60, velocity: 0.8 }),
    ).toBe(true)

    const noteGain = context!.gains.at(-1)!.gain
    const peak = noteGain.events.find(
      (event) => event.kind === 'exponential',
    )?.value
    expect(peak).toBeCloseTo(0.16 + Math.pow(0.8, 0.78) * 0.7)
  })

  it('releases auxiliary sample pins on panic before preparing a full range', async () => {
    const { instrument } = harness({ maxDecodedBytes: 640 })
    await instrument.prewarm([60])
    instrument.pedal({ pedal: 'sustain', value: 1 })

    instrument.panic()
    const roots = [21, 24, 27, 30, 33, 36, 39, 42]
    await expect(instrument.prewarm(roots)).resolves.toBeUndefined()

    expect(instrument.getLoadSnapshot()).toMatchObject({
      status: 'ready',
      loadedSamples: 8,
      decodedBytes: 640,
    })
    for (const rootMidi of roots) {
      expect(
        instrument.noteOn({
          id: `after-panic:${rootMidi}`,
          midi: rootMidi,
          velocity: 0.6,
        }),
      ).toBe(true)
    }
  })

  it('disposes active voices and the shared graph idempotently', async () => {
    const { context, instrument } = harness()
    await instrument.prewarm([60])
    instrument.noteOn({ id: 'active', midi: 60, velocity: 0.8 })

    instrument.dispose()
    instrument.dispose()

    expect(context?.sources[0].stops).toEqual([10])
    expect(context?.filters[0].disconnect).toHaveBeenCalledOnce()
    expect(instrument.activeVoiceIds()).toEqual([])
    expect(instrument.noteOn({ id: 'late', midi: 60, velocity: 0.8 })).toBe(
      false,
    )
  })
})
