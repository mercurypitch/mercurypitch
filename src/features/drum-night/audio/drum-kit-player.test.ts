// ============================================================
// Drum kit player tests — silent construction, fallback, cache, and envelopes
// ============================================================

import { createHash, webcrypto } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DrumKitPlayerPort } from '../runtime/drum-runtime-types'
import { DRUM_KIT_CATALOG, drumKitResourcesForHit } from './drum-kit-manifest'
import { createDrumKitPlayer, fetchDrumKitSampleArrayBuffer, verifyDrumKitSampleResource, } from './drum-kit-player'

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
  readonly connections: unknown[] = []
  readonly connect = vi.fn((destination: unknown) => {
    this.connections.push(destination)
    return destination
  })
  readonly disconnect = vi.fn()
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam()
}

class FakeBufferSourceNode extends FakeAudioNode {
  buffer: AudioBuffer | null = null
  throwOnStart = false
  readonly starts: number[] = []
  readonly stops: number[] = []
  onended: (() => void) | null = null

  start(at = 0): void {
    if (this.throwOnStart) throw new Error('source start failed')
    this.starts.push(at)
  }

  stop(at = 0): void {
    this.stops.push(at)
  }
}

class FakeOscillatorNode extends FakeAudioNode {
  type: OscillatorType = 'sine'
  readonly frequency = new FakeAudioParam()
  readonly starts: number[] = []
  readonly stops: number[] = []

  start(at = 0): void {
    this.starts.push(at)
  }

  stop(at = 0): void {
    this.stops.push(at)
  }
}

class FakeBiquadFilterNode extends FakeAudioNode {
  type: BiquadFilterType = 'lowpass'
  readonly frequency = new FakeAudioParam()
  readonly Q = new FakeAudioParam()
}

function decodedBuffer(length: number): AudioBuffer {
  return {
    duration: length / 48_000,
    length,
    numberOfChannels: 2,
    sampleRate: 48_000,
  } as unknown as AudioBuffer
}

class FakeAudioContext {
  currentTime = 10
  sampleRate = 48_000
  state: AudioContextState = 'running'
  readonly destination = new FakeAudioNode()
  readonly gains: FakeGainNode[] = []
  readonly sources: FakeBufferSourceNode[] = []
  readonly oscillators: FakeOscillatorNode[] = []
  readonly filters: FakeBiquadFilterNode[] = []
  readonly resume = vi.fn(async () => {
    this.state = 'running'
  })
  readonly decodeAudioData: ReturnType<typeof vi.fn>
  failNextSourceStart = false

  constructor(decodedLength = 480) {
    this.decodeAudioData = vi.fn(async () => decodedBuffer(decodedLength))
  }

  createGain(): GainNode {
    const gain = new FakeGainNode()
    this.gains.push(gain)
    return gain as unknown as GainNode
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeBufferSourceNode()
    source.throwOnStart = this.failNextSourceStart
    this.failNextSourceStart = false
    this.sources.push(source)
    return source as unknown as AudioBufferSourceNode
  }

  createOscillator(): OscillatorNode {
    const oscillator = new FakeOscillatorNode()
    this.oscillators.push(oscillator)
    return oscillator as unknown as OscillatorNode
  }

  createBiquadFilter(): BiquadFilterNode {
    const filter = new FakeBiquadFilterNode()
    this.filters.push(filter)
    return filter as unknown as BiquadFilterNode
  }

  createBuffer(
    numberOfChannels: number,
    length: number,
    sampleRate: number,
  ): AudioBuffer {
    const channels = Array.from(
      { length: numberOfChannels },
      () => new Float32Array(length),
    )
    return {
      duration: length / sampleRate,
      length,
      numberOfChannels,
      sampleRate,
      getChannelData: (channel: number) => channels[channel],
    } as unknown as AudioBuffer
  }
}

const ALL_RESOURCES = DRUM_KIT_CATALOG.flatMap((kit) => kit.resources)

function resourceForUrl(url: string) {
  const resource = ALL_RESOURCES.find((candidate) =>
    url.endsWith(candidate.path),
  )
  if (resource === undefined) throw new Error(`Unknown test resource: ${url}`)
  return resource
}

function harness(
  options: {
    decodedLength?: number
    failFetch?: boolean
    initialKitId?: 'classic-gm' | 'live' | 'mercury-synth' | 'studio'
    maxDecodedBytes?: number
    maxVoices?: number
    suspended?: boolean
  } = {},
) {
  const context = new FakeAudioContext(options.decodedLength)
  if (options.suspended === true) context.state = 'suspended'
  const output = new FakeAudioNode()
  const getAudioContext = vi.fn(() => context as unknown as AudioContext)
  const getOutput = vi.fn(() => output as unknown as AudioNode)
  let failFetch = options.failFetch ?? false
  const fetchArrayBuffer = vi.fn(async (url: string, signal: AbortSignal) => {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    if (failFetch) throw new TypeError('offline')
    return new ArrayBuffer(resourceForUrl(url).encodedBytes)
  })
  const player = createDrumKitPlayer({
    getAudioContext,
    getOutput,
    fetchArrayBuffer,
    verifyResource: async () => true,
    ...(options.initialKitId === undefined
      ? {}
      : { initialKitId: options.initialKitId }),
    ...(options.maxDecodedBytes === undefined
      ? {}
      : { maxDecodedBytes: options.maxDecodedBytes }),
    ...(options.maxVoices === undefined
      ? {}
      : { maxVoices: options.maxVoices }),
  })
  return {
    context,
    output,
    getAudioContext,
    getOutput,
    fetchArrayBuffer,
    player,
    setFailFetch(value: boolean) {
      failFetch = value
    },
  }
}

describe('createDrumKitPlayer', () => {
  it('is silent and network-inert until activate is gesture-owned', async () => {
    const { context, fetchArrayBuffer, getAudioContext, getOutput, player } =
      harness({ initialKitId: 'studio' })
    const listener = vi.fn()
    const unsubscribe = player.subscribe(listener)

    player.setVolume(0.4)
    await player.selectKit('live')

    expect(getAudioContext).not.toHaveBeenCalled()
    expect(getOutput).not.toHaveBeenCalled()
    expect(fetchArrayBuffer).not.toHaveBeenCalled()
    expect(context.gains).toHaveLength(0)
    expect(player.snapshot()).toMatchObject({
      selectedKitId: 'live',
      status: 'idle',
      fallbackReady: false,
      sampledReady: false,
      loadedSamples: 0,
      decodedBytes: 0,
      error: null,
    })
    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
  })

  it('satisfies the runtime port and activates synth without sample I/O', async () => {
    const { context, output, fetchArrayBuffer, player } = harness({
      suspended: true,
    })
    const runtimePort: DrumKitPlayerPort = player

    await expect(runtimePort.activate()).resolves.toBe(true)
    expect(context.resume).toHaveBeenCalledOnce()
    expect(fetchArrayBuffer).not.toHaveBeenCalled()
    expect(context.gains[0].connect).toHaveBeenCalledWith(output)
    expect(player.snapshot()).toMatchObject({
      selectedKitId: 'mercury-synth',
      status: 'ready',
      fallbackReady: true,
      sampledReady: false,
    })

    expect(
      player.trigger({ gmKey: 36, velocity: 100, atContextTime: 11 }),
    ).toBe('synth-fallback')
    expect(context.oscillators).toHaveLength(1)
    expect(context.oscillators[0].starts).toEqual([11])
    expect(context.gains[0].gain.events).toContainEqual({
      kind: 'exponential',
      value: 1,
      at: 11.004,
    })
  })

  it('keeps an explicit zero volume silent when the master opens', async () => {
    const { context, player } = harness()
    player.setVolume(0)
    await player.activate()

    expect(player.trigger({ gmKey: 36, velocity: 100 })).toBe('synth-fallback')
    expect(context.gains[0].gain.events).toContainEqual({
      kind: 'set',
      value: 0,
      at: 10,
    })
  })

  it('resumes a suspended route-owned context on repeated activation', async () => {
    const { context, player } = harness()
    await player.activate()
    context.state = 'suspended'

    await expect(player.activate()).resolves.toBe(true)
    expect(context.resume).toHaveBeenCalledOnce()
    expect(context.gains).toHaveLength(1)
  })

  it('falls back per hit while a selected sample is still downloading', async () => {
    const { context, player } = harness()
    await player.activate()
    const pendingFetches: Array<{
      reject(reason: unknown): void
      signal: AbortSignal
    }> = []
    const slowPlayer = createDrumKitPlayer({
      getAudioContext: () => context as unknown as AudioContext,
      getOutput: () => context.destination as unknown as AudioNode,
      fetchArrayBuffer: (_url, signal) =>
        new Promise<ArrayBuffer>((_resolve, reject) => {
          pendingFetches.push({ reject, signal })
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Cancelled', 'AbortError')),
            { once: true },
          )
        }),
      verifyResource: async () => true,
    })
    await slowPlayer.activate()
    const selection = slowPlayer.selectKit('studio')

    expect(
      slowPlayer.trigger({ gmKey: 36, velocity: 108, sourceId: 'pad-kick' }),
    ).toBe('synth-fallback')
    expect(context.oscillators.length).toBeGreaterThan(0)
    expect(slowPlayer.snapshot()).toMatchObject({
      selectedKitId: 'studio',
      status: 'loading',
      fallbackReady: true,
      sampledReady: false,
    })

    slowPlayer.dispose()
    await selection
    expect(pendingFetches.every((request) => request.signal.aborted)).toBe(true)
  })

  it('loads a sampled baseline and plays cached round robins synchronously', async () => {
    const { context, fetchArrayBuffer, player } = harness()
    await player.activate()

    await player.selectKit('classic-gm')

    expect(fetchArrayBuffer).toHaveBeenCalledTimes(5)
    expect(player.snapshot()).toMatchObject({
      selectedKitId: 'classic-gm',
      status: 'ready',
      sampledReady: true,
      preparedSamples: 5,
      plannedSamples: 5,
      error: null,
    })
    expect(player.trigger({ gmKey: 36, velocity: 112 })).toBe('sampled')
    expect(context.sources).toHaveLength(1)
    expect(context.sources[0].starts).toEqual([10])
    const voiceGain = context.sources[0].connections[0] as FakeGainNode
    expect(voiceGain.gain.events[0]).toEqual({
      kind: 'set',
      value: 0.0001,
      at: 10,
    })
    expect(voiceGain.gain.events[1]).toMatchObject({
      kind: 'exponential',
      at: 10.004,
    })
    const resource = drumKitResourcesForHit('classic-gm', 36, 112)[0]
    const expectedGain =
      resource.playbackGain * (0.12 + 0.88 * (112 / 127) ** 1.25)
    expect(voiceGain.gain.events[1].value).toBeCloseTo(expectedGain, 8)
  })

  it('cleans a failed sample source before falling back to synth', async () => {
    const { context, player } = harness()
    await player.activate()
    await player.selectKit('classic-gm')
    context.failNextSourceStart = true

    expect(player.trigger({ gmKey: 36, velocity: 112 })).toBe('synth-fallback')
    expect(context.sources[0].disconnect).toHaveBeenCalledOnce()
    expect(
      (context.sources[0].connections[0] as FakeGainNode).disconnect,
    ).toHaveBeenCalledOnce()
    expect(player.trigger({ gmKey: 36, velocity: 112 })).toBe('sampled')
  })

  it('chokes an open hat and releases every sample through panic envelopes', async () => {
    const { context, player } = harness()
    await player.activate()
    await player.selectKit('classic-gm')

    expect(player.trigger({ gmKey: 46, velocity: 112 })).toBe('sampled')
    expect(player.trigger({ gmKey: 42, velocity: 112 })).toBe('sampled')

    const openHat = context.sources[0]
    const openHatGain = openHat.connections[0] as FakeGainNode
    expect(openHatGain.gain.events).toContainEqual({
      kind: 'target',
      value: 0,
      at: 10,
    })
    expect(openHat.stops[0]).toBeCloseTo(10.075)

    player.panic()
    const closedHat = context.sources[1]
    const closedHatGain = closedHat.connections[0] as FakeGainNode
    expect(closedHatGain.gain.events).toContainEqual({
      kind: 'target',
      value: 0,
      at: 10,
    })
    expect(closedHat.stops[0]).toBeCloseTo(10.15)
    expect(context.gains[0].gain.events).toContainEqual({
      kind: 'target',
      value: 0,
      at: 10,
    })
  })

  it('steals the oldest live voice without allowing the active set past its cap', async () => {
    const { context, player } = harness({ maxVoices: 2 })
    await player.activate()
    await player.selectKit('classic-gm')

    for (let hit = 0; hit < 5; hit += 1) {
      expect(player.trigger({ gmKey: 36, velocity: 112 })).toBe('sampled')
    }

    expect(context.sources).toHaveLength(5)
    expect(context.sources.slice(0, 3).map((source) => source.stops)).toEqual([
      [10.075],
      [10.075],
      [10.075],
    ])
    expect(context.sources.slice(3).map((source) => source.stops)).toEqual([
      [],
      [],
    ])
  })

  it('reports retained readiness truthfully when a plan exceeds the cache', async () => {
    const { player } = harness({
      decodedLength: 100,
      maxDecodedBytes: 1_600,
    })
    await player.activate()
    await player.selectKit('classic-gm')

    expect(player.snapshot().decodedBytes).toBeLessThanOrEqual(1_600)
    expect(player.snapshot().loadedSamples).toBeLessThanOrEqual(2)
    expect(player.snapshot()).toMatchObject({
      status: 'error',
      preparedSamples: 2,
      plannedSamples: 5,
      fallbackReady: true,
      sampledReady: true,
      error: expect.stringContaining('Mercury Synth'),
    })
  })

  it('isolates an aborted A-to-synth load from a fresh return to A', async () => {
    const context = new FakeAudioContext()
    let holdFirstSelection = true
    const firstSelectionSignals: AbortSignal[] = []
    const fetchArrayBuffer = vi.fn((url: string, signal: AbortSignal) => {
      const resource = resourceForUrl(url)
      if (!holdFirstSelection) {
        return Promise.resolve(new ArrayBuffer(resource.encodedBytes))
      }
      firstSelectionSignals.push(signal)
      return new Promise<ArrayBuffer>((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('Cancelled', 'AbortError')),
          { once: true },
        )
      })
    })
    const player = createDrumKitPlayer({
      getAudioContext: () => context as unknown as AudioContext,
      getOutput: () => context.destination as unknown as AudioNode,
      fetchArrayBuffer,
      verifyResource: async () => true,
    })
    await player.activate()

    const firstSelection = player.selectKit('studio')
    await vi.waitFor(() => expect(firstSelectionSignals).toHaveLength(2))
    holdFirstSelection = false
    await player.selectKit('mercury-synth')
    expect(firstSelectionSignals.every((signal) => signal.aborted)).toBe(true)

    const secondSelection = player.selectKit('studio')
    await Promise.all([firstSelection, secondSelection])
    expect(fetchArrayBuffer).toHaveBeenCalledTimes(12)
    expect(player.snapshot()).toMatchObject({
      selectedKitId: 'studio',
      status: 'ready',
      sampledReady: true,
      preparedSamples: 10,
      plannedSamples: 10,
      error: null,
    })
  })

  it('lets one caller abort without cancelling a shared in-flight sample', async () => {
    const context = new FakeAudioContext()
    const target = drumKitResourcesForHit('classic-gm', 49, 100)[0]
    let targetSignal: AbortSignal | undefined
    let resolveTarget: (() => void) | undefined
    const fetchArrayBuffer = vi.fn((url: string, signal: AbortSignal) => {
      const resource = resourceForUrl(url)
      if (resource.id !== target.id) {
        return Promise.resolve(new ArrayBuffer(resource.encodedBytes))
      }
      targetSignal = signal
      return new Promise<ArrayBuffer>((resolve) => {
        resolveTarget = () => resolve(new ArrayBuffer(resource.encodedBytes))
      })
    })
    const player = createDrumKitPlayer({
      getAudioContext: () => context as unknown as AudioContext,
      getOutput: () => context.destination as unknown as AudioNode,
      fetchArrayBuffer,
      verifyResource: async () => true,
    })
    await player.activate()
    await player.selectKit('classic-gm')

    const firstAbort = new AbortController()
    const first = player.prewarm(
      [{ gmKey: 49, velocity: 100 }],
      firstAbort.signal,
    )
    await vi.waitFor(() => expect(resolveTarget).toBeTypeOf('function'))
    const second = player.prewarm([{ gmKey: 49, velocity: 100 }])
    firstAbort.abort()
    await first

    expect(targetSignal?.aborted).toBe(false)
    resolveTarget?.()
    await second
    expect(
      fetchArrayBuffer.mock.calls.filter(([url]) =>
        String(url).endsWith(target.path),
      ),
    ).toHaveLength(1)
    expect(player.snapshot()).toMatchObject({
      status: 'ready',
      preparedSamples: 1,
      plannedSamples: 1,
      error: null,
    })
  })

  it('reports load errors, keeps fallback playable, and retries explicitly', async () => {
    const { player, setFailFetch } = harness({ failFetch: true })
    await player.activate()
    await player.selectKit('studio')

    expect(player.snapshot()).toMatchObject({
      selectedKitId: 'studio',
      status: 'error',
      fallbackReady: true,
      sampledReady: false,
      preparedSamples: 0,
      error: expect.stringContaining('Mercury Synth'),
    })
    expect(player.trigger({ gmKey: 38, velocity: 90 })).toBe('synth-fallback')

    setFailFetch(false)
    await player.retry()
    expect(player.snapshot()).toMatchObject({
      status: 'ready',
      sampledReady: true,
      preparedSamples: 10,
      plannedSamples: 10,
      error: null,
    })

    await player.prewarm([
      { gmKey: 36, velocity: 104 },
      { gmKey: 38, velocity: 104 },
      { gmKey: 42, velocity: 104 },
      { gmKey: 44, velocity: 104 },
      { gmKey: 46, velocity: 104 },
    ])
    expect(player.snapshot().preparedSamples).toBe(
      player.snapshot().plannedSamples,
    )
    expect(player.snapshot().preparedSamples).toBe(10)
  })

  it('distinguishes unknown GM values from unsupported auxiliary percussion', async () => {
    const { player } = harness()
    expect(player.trigger({ gmKey: 34, velocity: 90 })).toBe('unmapped')
    await player.activate()
    expect(player.trigger({ gmKey: 54, velocity: 90 })).toBe('unmapped')
  })

  it('fails activation safely when the route provides no audio graph', async () => {
    const player = createDrumKitPlayer({
      getAudioContext: () => null,
      getOutput: () => null,
    })

    await expect(player.activate()).resolves.toBe(false)
    expect(player.snapshot()).toMatchObject({
      status: 'error',
      fallbackReady: false,
      error: expect.stringContaining('active audio session'),
    })
    expect(player.trigger({ gmKey: 36, velocity: 90 })).toBe('dropped')
  })
})

describe('default Drum Night sample transport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects an oversized Content-Length and cancels its body', async () => {
    const cancel = vi.fn(async () => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '11' }),
        body: { cancel },
      })),
    )

    await expect(
      fetchDrumKitSampleArrayBuffer(
        '/drum-night/kits/test.mp3',
        new AbortController().signal,
        10,
      ),
    ).rejects.toThrow('exceeds the response budget')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('cancels a stream as soon as accumulated chunks overrun the budget', async () => {
    const cancel = vi.fn(async () => undefined)
    const releaseLock = vi.fn()
    const read = vi
      .fn()
      .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
      .mockResolvedValueOnce({ done: false, value: new Uint8Array([4, 5, 6]) })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: { getReader: () => ({ read, cancel, releaseLock }) },
      })),
    )

    await expect(
      fetchDrumKitSampleArrayBuffer(
        '/drum-night/kits/test.mp3',
        new AbortController().signal,
        5,
      ),
    ).rejects.toThrow('exceeds the response budget')
    expect(cancel).toHaveBeenCalledOnce()
    expect(releaseLock).toHaveBeenCalledOnce()
  })

  it('cancels a pending stream read when its fetch owner aborts', async () => {
    let finishRead:
      | ((result: { done: true; value: undefined }) => void)
      | undefined
    const read = vi.fn(
      () =>
        new Promise<{ done: true; value: undefined }>((resolve) => {
          finishRead = resolve
        }),
    )
    const cancel = vi.fn(async () => {
      finishRead?.({ done: true, value: undefined })
    })
    const releaseLock = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: { getReader: () => ({ read, cancel, releaseLock }) },
      })),
    )
    const controller = new AbortController()

    const loading = fetchDrumKitSampleArrayBuffer(
      '/drum-night/kits/test.mp3',
      controller.signal,
      10,
    )
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce())
    controller.abort()

    await expect(loading).rejects.toMatchObject({ name: 'AbortError' })
    expect(cancel).toHaveBeenCalledOnce()
    expect(releaseLock).toHaveBeenCalledOnce()
  })

  it('accepts the expected SHA-256 and rejects a different digest', async () => {
    vi.stubGlobal('crypto', webcrypto)
    const encoded = new TextEncoder().encode('drum-night-integrity').buffer
    const expected = createHash('sha256')
      .update(new Uint8Array(encoded))
      .digest('hex')

    await expect(verifyDrumKitSampleResource(encoded, expected)).resolves.toBe(
      true,
    )
    await expect(
      verifyDrumKitSampleResource(encoded, '0'.repeat(64)),
    ).resolves.toBe(false)
  })

  it('fails closed when SubtleCrypto is unavailable', async () => {
    vi.stubGlobal('crypto', undefined)

    await expect(
      verifyDrumKitSampleResource(new ArrayBuffer(1), '0'.repeat(64)),
    ).resolves.toBe(false)
  })
})
