// ============================================================
// Drum kit player tests — silent construction, fallback, cache, and envelopes
// ============================================================

import { createHash, webcrypto } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DrumKitPlayerPort } from '../runtime/drum-runtime-types'
import { velocityGain } from './drum-hit-dynamics'
import { DRUM_KIT_CATALOG, drumKitManifest, drumKitResourcesForHit, } from './drum-kit-manifest'
import opusCatalog from './drum-kit-opus.generated.json'
import { createDrumKitPlayer, drumKitPlaybackResources, fetchDrumKitSampleArrayBuffer, verifyDrumKitSampleResource, } from './drum-kit-player'

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
  readonly playbackRate = new FakeAudioParam()
  readonly starts: number[] = []
  readonly startOffsets: number[] = []
  readonly stops: number[] = []
  onended: (() => void) | null = null
  readonly endedListeners: Array<() => void> = []

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    if (type !== 'ended' || typeof listener !== 'function') return
    this.endedListeners.push(listener as () => void)
  }

  start(at = 0, offset = 0): void {
    if (this.throwOnStart) throw new Error('source start failed')
    this.starts.push(at)
    this.startOffsets.push(offset)
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
  readonly endedListeners: Array<() => void> = []

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    if (type !== 'ended' || typeof listener !== 'function') return
    this.endedListeners.push(listener as () => void)
  }

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

class FakeMediaStreamAudioDestinationNode extends FakeAudioNode {
  readonly track = { stop: vi.fn() }
  readonly stream = {
    id: 'live-kit-capture',
    getTracks: () => [this.track],
  } as unknown as MediaStream
}

function decodedBuffer(length: number): AudioBuffer {
  return {
    duration: length / 48_000,
    length,
    numberOfChannels: 2,
    sampleRate: 48_000,
    getChannelData: () => new Float32Array(length),
  } as unknown as AudioBuffer
}

/** Walk the per-voice chain: source -> optional brightness filter -> gain. */
function voiceChain(source: FakeBufferSourceNode): {
  filter: FakeBiquadFilterNode | null
  gain: FakeGainNode
} {
  const first = source.connections[0]
  if (first instanceof FakeBiquadFilterNode) {
    return { filter: first, gain: first.connections[0] as FakeGainNode }
  }
  return { filter: null, gain: first as FakeGainNode }
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
  readonly mediaStreamDestinations: FakeMediaStreamAudioDestinationNode[] = []
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

  createMediaStreamDestination(): MediaStreamAudioDestinationNode {
    const destination = new FakeMediaStreamAudioDestinationNode()
    this.mediaStreamDestinations.push(destination)
    return destination as unknown as MediaStreamAudioDestinationNode
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
  for (const resource of ALL_RESOURCES) {
    const encoding = Object.values(resource.formats).find(
      (candidate) => candidate !== undefined && url.endsWith(candidate.path),
    )
    if (encoding !== undefined) return { encoding, resource }
  }
  for (const [resourceId, projected] of Object.entries(opusCatalog.encodings)) {
    if (!url.endsWith(projected.path)) continue
    const resource = ALL_RESOURCES.find(
      (candidate) => candidate.id === resourceId,
    )
    if (resource === undefined) break
    return {
      encoding: {
        ...projected,
        mimeType: opusCatalog.mimeType,
      },
      resource,
    }
  }
  throw new Error(`Unknown test resource: ${url}`)
}

function harness(
  options: {
    decodedLength?: number
    failFetch?: boolean
    initialKitId?:
      | 'circuit'
      | 'classic-gm'
      | 'live'
      | 'mercury-synth'
      | 'studio'
    maxDecodedBytes?: number
    maxVoices?: number
    opusSupported?: boolean
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
    return new ArrayBuffer(resourceForUrl(url).encoding.encodedBytes)
  })
  const player = createDrumKitPlayer({
    getAudioContext,
    getOutput,
    fetchArrayBuffer,
    verifyResource: async () => true,
    probeOpusSupport: async () => options.opusSupported ?? false,
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

function baselinePlaybackResourceCount(
  kitId: 'classic-gm' | 'live' | 'studio',
): number {
  return new Set(
    [36, 38, 42, 44, 46].flatMap((gmKey) =>
      drumKitPlaybackResources(kitId, gmKey, 104).map(
        (resource) => resource.id,
      ),
    ),
  ).size
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

  it('routes the explicit Circuit model through live and authored lanes without sample I/O', async () => {
    const { context, fetchArrayBuffer, player } = harness({
      initialKitId: 'circuit',
    })
    await expect(player.activate()).resolves.toBe(true)

    expect(fetchArrayBuffer).not.toHaveBeenCalled()
    expect(player.snapshot()).toMatchObject({
      selectedKitId: 'circuit',
      selectedFormat: null,
      status: 'ready',
    })

    expect(player.trigger({ gmKey: 38, velocity: 104 })).toBe('synthesized')
    const liveCircuitGains = context.gains.slice(8, 10)
    expect(liveCircuitGains).toHaveLength(2)
    expect(
      liveCircuitGains.every((gain) =>
        gain.connections.includes(context.gains[1]),
      ),
    ).toBe(true)

    expect(player.trigger({ gmKey: 38, velocity: 104, lane: 'authored' })).toBe(
      'synthesized',
    )
    const authoredCircuitGains = context.gains.slice(10, 12)
    expect(
      authoredCircuitGains.every((gain) =>
        gain.connections.includes(context.gains[4]),
      ),
    ).toBe(true)

    player.panic('live')
    expect(liveCircuitGains[0].gain.events).toContainEqual({
      kind: 'target',
      value: 0.0001,
      at: 10,
    })
    expect(authoredCircuitGains[0].gain.events).not.toContainEqual({
      kind: 'target',
      value: 0.0001,
      at: 10,
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

  it('routes synth fallback through authored family gains without touching live input', async () => {
    const { context, player } = harness()
    player.setAuthoredFamilyVolume('snare', 0)
    await player.activate()

    const liveLane = context.gains[1]
    const authoredSnare = context.gains[4]
    expect(authoredSnare.gain.events).toContainEqual({
      kind: 'set',
      value: 0,
      at: 10,
    })

    expect(player.trigger({ gmKey: 38, velocity: 100, lane: 'authored' })).toBe(
      'synth-fallback',
    )
    expect(
      context.gains
        .slice(8)
        .some((gain) => gain.connections.includes(authoredSnare)),
    ).toBe(true)

    expect(player.trigger({ gmKey: 38, velocity: 100 })).toBe('synth-fallback')
    expect(
      context.gains
        .slice(8)
        .some((gain) => gain.connections.includes(liveLane)),
    ).toBe(true)
  })

  it('resumes a suspended route-owned context on repeated activation', async () => {
    const { context, player } = harness()
    await player.activate()
    context.state = 'suspended'

    await expect(player.activate()).resolves.toBe(true)
    expect(context.resume).toHaveBeenCalledOnce()
    expect(context.gains).toHaveLength(8)
  })

  it('shares one graph and sample cache across independent live and authored lanes', async () => {
    const {
      context,
      fetchArrayBuffer,
      getAudioContext,
      getOutput,
      output,
      player,
    } = harness()
    await player.activate()
    await player.selectKit('classic-gm')

    expect(player.trigger({ gmKey: 36, velocity: 112 })).toBe('sampled')
    expect(
      player.trigger({
        gmKey: 36,
        velocity: 112,
        lane: 'authored',
      }),
    ).toBe('sampled')

    const master = context.gains[0]
    const liveLane = context.gains[1]
    const authoredLane = context.gains[2]
    const authoredKick = context.gains[3]
    const liveVoice = voiceChain(context.sources[0]).gain
    const authoredVoice = voiceChain(context.sources[1]).gain
    expect(liveVoice.connections).toEqual([liveLane])
    expect(authoredVoice.connections).toEqual([authoredKick])
    expect(authoredKick.connections).toEqual([authoredLane])
    expect(liveLane.connections).toEqual([
      master,
      context.mediaStreamDestinations[0],
    ])
    expect(authoredLane.connections).toEqual([master])
    expect(master.connections).toEqual([output])
    expect(player.liveCaptureStream()).toBe(
      context.mediaStreamDestinations[0]?.stream,
    )

    player.setLaneVolume('authored', 0.25)
    expect(authoredLane.gain.events.slice(-2)).toEqual([
      { kind: 'hold', at: 10 },
      { kind: 'target', value: 0.25, at: 10 },
    ])
    expect(liveLane.gain.events).not.toContainEqual({
      kind: 'target',
      value: 0.25,
      at: 10,
    })

    player.setAuthoredFamilyVolume('kick', 0.4)
    expect(authoredKick.gain.events.slice(-2)).toEqual([
      { kind: 'hold', at: 10 },
      { kind: 'target', value: 0.4, at: 10 },
    ])
    expect(liveLane.gain.events).not.toContainEqual({
      kind: 'target',
      value: 0.4,
      at: 10,
    })

    expect(getAudioContext).toHaveBeenCalledOnce()
    expect(getOutput).toHaveBeenCalledOnce()
    expect(fetchArrayBuffer).toHaveBeenCalledTimes(5)
    expect(context.decodeAudioData).toHaveBeenCalledTimes(5)
  })

  it('releases an authored lane without killing a concurrent live voice', async () => {
    const { context, player } = harness()
    await player.activate()
    await player.selectKit('classic-gm')

    expect(player.trigger({ gmKey: 36, velocity: 112 })).toBe('sampled')
    expect(
      player.trigger({
        gmKey: 38,
        velocity: 112,
        lane: 'authored',
      }),
    ).toBe('sampled')
    const liveVoice = context.sources[0]
    const authoredVoice = context.sources[1]

    player.panic('authored')

    expect(liveVoice.stops).toEqual([])
    expect(authoredVoice.stops[0]).toBeCloseTo(10.15)
    expect(context.gains[1].gain.events).not.toContainEqual({
      kind: 'target',
      value: 0,
      at: 10,
    })
    expect(context.gains[2].gain.events).toContainEqual({
      kind: 'target',
      value: 0,
      at: 10,
    })

    expect(player.trigger({ gmKey: 42, velocity: 112 })).toBe('sampled')
    expect(context.sources[2].stops).toEqual([])
  })

  it('routes sampled and synth live hits into capture while excluding authored hits and disconnects on disposal', async () => {
    vi.useFakeTimers()
    const { context, player } = harness()
    await player.activate()

    const liveLane = context.gains[1]
    const authoredLane = context.gains[2]
    const captureDestination = context.mediaStreamDestinations[0]
    expect(captureDestination).toBeDefined()
    expect(liveLane.connections).toContain(captureDestination)
    expect(authoredLane.connections).not.toContain(captureDestination)

    expect(player.trigger({ gmKey: 38, velocity: 100 })).toBe('synth-fallback')
    expect(
      context.gains
        .slice(8)
        .some((gain) => gain.connections.includes(liveLane)),
    ).toBe(true)

    await player.selectKit('classic-gm')
    const sampleSourceStart = context.sources.length
    expect(player.trigger({ gmKey: 36, velocity: 112 })).toBe('sampled')
    expect(
      voiceChain(context.sources[sampleSourceStart]).gain.connections,
    ).toEqual([liveLane])
    expect(player.trigger({ gmKey: 36, velocity: 112, lane: 'authored' })).toBe(
      'sampled',
    )
    expect(
      voiceChain(context.sources[sampleSourceStart + 1]).gain.connections[0],
    ).not.toBe(liveLane)

    player.dispose()
    expect(captureDestination?.track.stop).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(liveLane.disconnect).toHaveBeenCalledOnce()
    expect(authoredLane.disconnect).toHaveBeenCalledOnce()
    expect(captureDestination?.track.stop).toHaveBeenCalledOnce()
    expect(player.liveCaptureStream()).toBeNull()
    vi.useRealTimers()
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
      probeOpusSupport: async () => false,
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
    const voiceGain = voiceChain(context.sources[0]).gain
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
    const nominalGain = resource.playbackGain * velocityGain('kick', 112)
    const rampGain = voiceGain.gain.events[1].value as number
    expect(rampGain).toBeGreaterThanOrEqual(nominalGain * 10 ** (-0.75 / 20))
    expect(rampGain).toBeLessThanOrEqual(nominalGain * 10 ** (0.75 / 20))
  })

  it('pins Opus for every resource when the gesture-owned decoder probe succeeds', async () => {
    const { fetchArrayBuffer, player } = harness({ opusSupported: true })
    await player.activate()
    await player.selectKit('classic-gm')

    expect(player.snapshot()).toMatchObject({
      selectedKitId: 'classic-gm',
      selectedFormat: 'opus',
      status: 'ready',
      preparedSamples: 5,
      plannedSamples: 5,
    })
    expect(fetchArrayBuffer).toHaveBeenCalledTimes(5)
    expect(
      fetchArrayBuffer.mock.calls.every(([url]) =>
        String(url).endsWith('.opus'),
      ),
    ).toBe(true)
  })

  it('discards a partial Opus cache and reaches ready with one complete MP3 plan', async () => {
    const context = new FakeAudioContext()
    const requestedUrls: string[] = []
    let opusRequest = 0
    const fetchArrayBuffer = vi.fn(async (url: string) => {
      requestedUrls.push(url)
      const { encoding } = resourceForUrl(url)
      if (url.endsWith('.opus')) {
        opusRequest += 1
        if (opusRequest === 2) throw new TypeError('Opus request failed')
      }
      return new ArrayBuffer(encoding.encodedBytes)
    })
    const player = createDrumKitPlayer({
      getAudioContext: () => context as unknown as AudioContext,
      getOutput: () => context.destination as unknown as AudioNode,
      fetchArrayBuffer,
      verifyResource: async () => true,
      probeOpusSupport: async () => true,
      loadConcurrency: 1,
    })
    await player.activate()
    await player.selectKit('classic-gm')

    expect(requestedUrls.filter((url) => url.endsWith('.opus'))).toHaveLength(5)
    expect(requestedUrls.filter((url) => url.endsWith('.mp3'))).toHaveLength(5)
    expect(player.snapshot()).toMatchObject({
      selectedKitId: 'classic-gm',
      selectedFormat: 'mp3',
      status: 'ready',
      loadedSamples: 5,
      preparedSamples: 5,
      plannedSamples: 5,
      error: null,
    })
    expect(player.trigger({ gmKey: 36, velocity: 112 })).toBe('sampled')
  })

  it('cleans a failed sample source before falling back to synth', async () => {
    const { context, player } = harness()
    await player.activate()
    await player.selectKit('classic-gm')
    context.failNextSourceStart = true

    expect(player.trigger({ gmKey: 36, velocity: 112 })).toBe('synth-fallback')
    expect(context.sources[0].disconnect).toHaveBeenCalledOnce()
    expect(
      voiceChain(context.sources[0]).gain.disconnect,
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
    const openHatGain = voiceChain(openHat).gain
    expect(openHatGain.gain.events).toContainEqual({
      kind: 'target',
      value: 0,
      at: 10,
    })
    expect(openHat.stops[0]).toBeCloseTo(10.075)

    player.panic()
    const closedHat = context.sources[1]
    const closedHatGain = voiceChain(closedHat).gain
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

  it('reports lane-safe GM cymbal release truth without overclaiming idle or fallback', async () => {
    const { context, player } = harness()
    await player.activate()
    await player.selectKit('classic-gm')
    await player.prewarm([{ gmKey: 49, velocity: 112 }])

    expect(player.trigger({ gmKey: 49, velocity: 112, lane: 'live' })).toBe(
      'sampled',
    )
    expect(player.trigger({ gmKey: 49, velocity: 112, lane: 'authored' })).toBe(
      'sampled',
    )
    const liveCrash = context.sources.at(-2)!
    const authoredCrash = context.sources.at(-1)!

    expect(
      player.choke({
        gmKey: 49,
        atContextTime: 11.11,
        lane: 'authored',
      }),
    ).toBe('choked')
    expect(liveCrash.stops).toEqual([])
    expect(authoredCrash.stops[0]).toBeCloseTo(11.185)
    expect(player.choke({ gmKey: 49, lane: 'authored' })).toBe('choked')
    expect(authoredCrash.stops[1]).toBeCloseTo(10.075)
    expect(player.choke({ gmKey: 49, lane: 'authored' })).toBe('idle')
    expect(player.choke({ gmKey: 38, lane: 'authored' })).toBe('unmapped')

    await player.selectKit('mercury-synth')
    expect(player.choke({ gmKey: 49, lane: 'authored' })).toBe('idle')
  })

  it('lets panic override a future sample choke before reopening the lane', async () => {
    const { context, player } = harness({ maxVoices: 1 })
    await player.activate()
    await player.selectKit('classic-gm')
    await player.prewarm([{ gmKey: 49, velocity: 112 }])

    expect(
      player.trigger({
        gmKey: 49,
        velocity: 112,
        atContextTime: 12,
        lane: 'authored',
      }),
    ).toBe('sampled')
    const staleCrash = context.sources.at(-1)!
    const staleGate = voiceChain(staleCrash).gain
    expect(
      player.choke({
        gmKey: 49,
        atContextTime: 12.11,
        lane: 'authored',
      }),
    ).toBe('choked')

    player.panic('authored')
    expect(player.trigger({ gmKey: 49, velocity: 112, lane: 'authored' })).toBe(
      'sampled',
    )

    expect(staleCrash.stops[1]).toBeCloseTo(10.15)
    expect(staleGate.gain.events).toContainEqual({ kind: 'hold', at: 10 })
    expect(staleGate.gain.events).toContainEqual({
      kind: 'target',
      value: 0,
      at: 10,
    })
    expect(context.sources.at(-1)?.starts).toEqual([10])
    expect(context.sources.at(-1)?.stops).toEqual([])
  })

  it('chokes tracked Mercury cymbals and same-time open hats in both fallback paths', async () => {
    vi.useFakeTimers()
    const { context, player } = harness()
    await player.activate()

    expect(
      player.trigger({
        gmKey: 49,
        velocity: 108,
        atContextTime: 12,
        lane: 'authored',
      }),
    ).toBe('synth-fallback')
    const mercuryCrashGate = context.gains[8]!
    expect(
      player.choke({
        gmKey: 49,
        atContextTime: 12.11,
        lane: 'authored',
      }),
    ).toBe('choked')
    expect(mercuryCrashGate.gain.events).toContainEqual({
      kind: 'target',
      value: 0,
      at: 12.11,
    })
    player.panic('authored')
    expect(mercuryCrashGate.gain.events).toContainEqual({
      kind: 'target',
      value: 0,
      at: 10,
    })
    expect(player.trigger({ gmKey: 49, velocity: 108, lane: 'authored' })).toBe(
      'synth-fallback',
    )
    vi.advanceTimersByTime(151)
    expect(mercuryCrashGate.disconnect).toHaveBeenCalledOnce()

    const openHatGainIndex = context.gains.length
    expect(
      player.trigger({
        gmKey: 46,
        velocity: 104,
        atContextTime: 12,
        lane: 'authored',
      }),
    ).toBe('synth-fallback')
    const mercuryOpenHatGate = context.gains[openHatGainIndex]!
    expect(
      player.trigger({
        gmKey: 42,
        velocity: 104,
        atContextTime: 12,
        lane: 'authored',
      }),
    ).toBe('synth-fallback')
    expect(mercuryOpenHatGate.gain.events).toContainEqual({
      kind: 'target',
      value: 0,
      at: 12,
    })

    await player.selectKit('classic-gm')
    expect(
      player.trigger({
        gmKey: 49,
        velocity: 108,
        atContextTime: 12,
        lane: 'authored',
      }),
    ).toBe('synth-fallback')
    expect(
      player.choke({
        gmKey: 49,
        atContextTime: 12.11,
        lane: 'authored',
      }),
    ).toBe('choked')

    player.dispose()
    vi.runAllTimers()
    vi.useRealTimers()
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
      sampledReady: false,
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
        return Promise.resolve(new ArrayBuffer(resource.encoding.encodedBytes))
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
      probeOpusSupport: async () => false,
    })
    await player.activate()

    const firstSelection = player.selectKit('studio')
    await vi.waitFor(() => expect(firstSelectionSignals).toHaveLength(2))
    holdFirstSelection = false
    await player.selectKit('mercury-synth')
    expect(firstSelectionSignals.every((signal) => signal.aborted)).toBe(true)

    const secondSelection = player.selectKit('studio')
    await Promise.all([firstSelection, secondSelection])
    const planned = baselinePlaybackResourceCount('studio')
    expect(drumKitPlaybackResources('studio', 42, 96)).toEqual([])
    expect(drumKitManifest('studio').sampleStatus).toBe('fallback')
    expect(fetchArrayBuffer).toHaveBeenCalledTimes(
      firstSelectionSignals.length + planned,
    )
    expect(player.snapshot()).toMatchObject({
      selectedKitId: 'studio',
      status: 'ready',
      sampleStatus: 'fallback',
      sampledReady: false,
      preparedSamples: planned,
      plannedSamples: planned,
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
      if (resource.resource.id !== target.id) {
        return Promise.resolve(new ArrayBuffer(resource.encoding.encodedBytes))
      }
      targetSignal = signal
      return new Promise<ArrayBuffer>((resolve) => {
        resolveTarget = () =>
          resolve(new ArrayBuffer(resource.encoding.encodedBytes))
      })
    })
    const player = createDrumKitPlayer({
      getAudioContext: () => context as unknown as AudioContext,
      getOutput: () => context.destination as unknown as AudioNode,
      fetchArrayBuffer,
      verifyResource: async () => true,
      probeOpusSupport: async () => false,
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
    const planned = baselinePlaybackResourceCount('studio')
    expect(player.snapshot()).toMatchObject({
      status: 'ready',
      sampledReady: false,
      preparedSamples: planned,
      plannedSamples: planned,
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
    expect(player.snapshot().preparedSamples).toBe(planned)
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

describe('playback intelligence', () => {
  it('darkens soft hits with a per-voice lowpass and bypasses it when loud', async () => {
    const { context, player } = harness()
    await player.activate()
    await player.selectKit('classic-gm')
    await player.prewarm([
      { gmKey: 38, velocity: 40 },
      { gmKey: 38, velocity: 127 },
    ])

    expect(player.trigger({ gmKey: 38, velocity: 40 })).toBe('sampled')
    const soft = voiceChain(context.sources[0])
    expect(soft.filter).not.toBeNull()
    expect(soft.filter?.type).toBe('lowpass')
    expect(soft.filter?.frequency.value).toBeGreaterThan(2000)
    expect(soft.filter?.frequency.value).toBeLessThan(3500)
    expect(soft.filter?.Q.value).toBeCloseTo(0.5)

    expect(player.trigger({ gmKey: 38, velocity: 127 })).toBe('sampled')
    expect(voiceChain(context.sources[1]).filter).toBeNull()
  })

  it('starts playback at the measured decoded onset plus bounded jitter', async () => {
    const { context, player } = harness()
    const samples = new Float32Array(48_000)
    const onsetIndex = Math.round(0.03 * 48_000)
    for (let index = onsetIndex; index < samples.length; index += 1) {
      samples[index] = 0.5
    }
    context.decodeAudioData.mockResolvedValue({
      duration: 1,
      length: 48_000,
      numberOfChannels: 2,
      sampleRate: 48_000,
      getChannelData: () => samples,
    } as unknown as AudioBuffer)
    await player.activate()
    await player.selectKit('classic-gm')

    expect(player.trigger({ gmKey: 36, velocity: 112 })).toBe('sampled')
    const offset = context.sources[0].startOffsets[0]
    expect(offset).toBeGreaterThanOrEqual(0.029)
    expect(offset).toBeLessThanOrEqual(0.029 + 0.0004 + 1e-9)
  })

  it('varies playback rate within articulation bounds, deterministically per seed', async () => {
    const first = harness()
    const second = harness()
    for (const { player } of [first, second]) {
      await player.activate()
      await player.selectKit('classic-gm')
      for (let index = 0; index < 6; index += 1) {
        expect(player.trigger({ gmKey: 36, velocity: 112 })).toBe('sampled')
      }
    }
    const rates = (sources: FakeBufferSourceNode[]) =>
      sources.map((source) => source.playbackRate.value)
    const firstRates = rates(first.context.sources)
    expect(firstRates).toEqual(rates(second.context.sources))
    for (const rate of firstRates) {
      expect(rate).toBeGreaterThanOrEqual(2 ** (-10 / 1200))
      expect(rate).toBeLessThanOrEqual(2 ** (10 / 1200))
    }
    expect(new Set(firstRates).size).toBeGreaterThan(1)
  })

  it('spreads repeated equal hits across the cached sample pool', async () => {
    const { context, player } = harness()
    await player.activate()
    await player.selectKit('live')

    const buffers = new Set<AudioBuffer | null>()
    for (let index = 0; index < 8; index += 1) {
      expect(player.trigger({ gmKey: 46, velocity: 104 })).toBe('sampled')
      buffers.add(context.sources[context.sources.length - 1].buffer)
    }
    expect(buffers.size).toBeGreaterThan(1)
  })

  it('prewarms and selects reduced low versus ready high velocity layers', async () => {
    const { fetchArrayBuffer, player } = harness()
    await player.activate()
    await player.selectKit('classic-gm')
    const low = drumKitPlaybackResources('classic-gm', 36, 40)
    const high = drumKitPlaybackResources('classic-gm', 36, 112)
    const all = drumKitManifest('classic-gm').resources.filter((resource) =>
      resource.gmKeys.includes(36),
    )
    expect(low.every((resource) => resource.readiness === 'reduced')).toBe(true)
    expect(high.every((resource) => resource.readiness === 'ready')).toBe(true)
    const ready = high[0]!
    const reduced = all.find((resource) => resource.readiness === 'reduced')!
    expect(
      fetchArrayBuffer.mock.calls.some(([url]) => url.endsWith(ready.path)),
    ).toBe(true)
    expect(
      fetchArrayBuffer.mock.calls.some(([url]) => url.endsWith(reduced.path)),
    ).toBe(false)

    await player.prewarm([{ gmKey: 36, velocity: 40 }])
    const fetchedUrls = fetchArrayBuffer.mock.calls.map(([url]) => url)

    expect(fetchedUrls.some((url) => url.endsWith(ready.path))).toBe(true)
    expect(fetchedUrls.some((url) => url.endsWith(reduced.path))).toBe(true)
    expect(player.trigger({ gmKey: 36, velocity: 40 })).toBe('sampled')
    expect(player.trigger({ gmKey: 36, velocity: 112 })).toBe('sampled')
  })
})
