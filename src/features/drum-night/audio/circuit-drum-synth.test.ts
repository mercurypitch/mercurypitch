// ============================================================
// Circuit drum synth tests — explicit model, bounded movement, routed tails
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { CIRCUIT_DRUM_SYNTH_MODEL, circuitHitVariation, circuitMetallicExcitation, circuitVelocityAmplitude, createCircuitDrumEngine, createCircuitDrumSynth, } from './circuit-drum-synth'

interface ParameterEvent {
  readonly kind: 'cancel' | 'exponential' | 'hold' | 'set' | 'target'
  readonly at: number
  readonly value?: number
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
    this.events.push({ kind: 'set', at, value })
    return this
  }

  setTargetAtTime(value: number, at: number): this {
    this.value = value
    this.events.push({ kind: 'target', at, value })
    return this
  }

  exponentialRampToValueAtTime(value: number, at: number): this {
    this.value = value
    this.events.push({ kind: 'exponential', at, value })
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

class FakeScheduledSource extends FakeAudioNode {
  readonly starts: number[] = []
  readonly stops: number[] = []
  private readonly endedListeners: Array<() => void> = []

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

  finish(): void {
    for (const listener of this.endedListeners) listener()
  }
}

class FakeBufferSourceNode extends FakeScheduledSource {
  buffer: AudioBuffer | null = null
  readonly playbackRate = new FakeAudioParam()

  start(at = 0, _offset = 0, _duration?: number): void {
    super.start(at)
  }
}

class FakeOscillatorNode extends FakeScheduledSource {
  type: OscillatorType = 'sine'
  readonly frequency = new FakeAudioParam()
}

class FakeBiquadFilterNode extends FakeAudioNode {
  type: BiquadFilterType = 'lowpass'
  readonly frequency = new FakeAudioParam()
  readonly Q = new FakeAudioParam()
}

class FakeAudioContext {
  currentTime = 10
  readonly sampleRate = 8_000
  readonly buffers: AudioBuffer[] = []
  readonly gains: FakeGainNode[] = []
  readonly bufferSources: FakeBufferSourceNode[] = []
  readonly oscillators: FakeOscillatorNode[] = []
  readonly filters: FakeBiquadFilterNode[] = []

  createBuffer(
    numberOfChannels: number,
    length: number,
    sampleRate: number,
  ): AudioBuffer {
    const channels = Array.from(
      { length: numberOfChannels },
      () => new Float32Array(length),
    )
    const buffer = {
      duration: length / sampleRate,
      length,
      numberOfChannels,
      sampleRate,
      getChannelData: (channel: number) => channels[channel],
    } as unknown as AudioBuffer
    this.buffers.push(buffer)
    return buffer
  }

  createGain(): GainNode {
    const gain = new FakeGainNode()
    this.gains.push(gain)
    return gain as unknown as GainNode
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeBufferSourceNode()
    this.bufferSources.push(source)
    return source as unknown as AudioBufferSourceNode
  }

  createOscillator(): OscillatorNode {
    const source = new FakeOscillatorNode()
    this.oscillators.push(source)
    return source as unknown as OscillatorNode
  }

  createBiquadFilter(): BiquadFilterNode {
    const filter = new FakeBiquadFilterNode()
    this.filters.push(filter)
    return filter as unknown as BiquadFilterNode
  }
}

describe('Circuit drum model', () => {
  it('is an explicit zero-byte model that sampled failures cannot select', () => {
    expect(CIRCUIT_DRUM_SYNTH_MODEL).toMatchObject({
      engine: 'synth-model',
      modelId: 'circuit',
      publishedEncodedBytes: 0,
      eligibleAsSampleFallback: false,
      sampleFailureFallbackModelId: 'mercury-synth',
    })
  })

  it('moves every hit deterministically inside its documented bounds', () => {
    const first = circuitHitVariation(73, 4, 38, 'snare-4')
    const repeat = circuitHitVariation(73, 4, 38, 'snare-4')
    const next = circuitHitVariation(73, 5, 38, 'snare-4')

    expect(repeat).toEqual(first)
    expect(next).not.toEqual(first)
    expect(first.pitchRatio).toBeGreaterThanOrEqual(0.97)
    expect(first.pitchRatio).toBeLessThanOrEqual(1.03)
    expect(first.decayRatio).toBeGreaterThanOrEqual(0.9)
    expect(first.decayRatio).toBeLessThanOrEqual(1.1)
    expect(first.toneRatio).toBeGreaterThanOrEqual(0.92)
    expect(first.toneRatio).toBeLessThanOrEqual(1.08)
    expect(first.gainRatio).toBeGreaterThanOrEqual(0.96)
    expect(first.gainRatio).toBeLessThanOrEqual(1.04)
  })

  it('preserves Circuit velocity response independently from sampled-kit curation', () => {
    expect(circuitVelocityAmplitude(1)).toBeCloseTo((1 / 127) ** 0.72, 10)
    expect(circuitVelocityAmplitude(80)).toBeCloseTo((80 / 127) ** 0.72, 10)
    expect(circuitVelocityAmplitude(127)).toBe(1)
  })

  it('caches one dense finite metallic excitation per AudioContext', () => {
    const firstContext = new FakeAudioContext()
    const secondContext = new FakeAudioContext()

    const first = circuitMetallicExcitation(
      firstContext as unknown as BaseAudioContext,
    )
    const repeat = circuitMetallicExcitation(
      firstContext as unknown as BaseAudioContext,
    )
    const second = circuitMetallicExcitation(
      secondContext as unknown as BaseAudioContext,
    )

    expect(repeat).toBe(first)
    expect(second).not.toBe(first)
    expect(firstContext.buffers).toHaveLength(1)
    expect(secondContext.buffers).toHaveLength(1)
    const samples = first.getChannelData(0)
    expect(samples.some((sample) => sample !== 0)).toBe(true)
    expect(samples.every(Number.isFinite)).toBe(true)
    expect(samples.every((sample) => Math.abs(sample) <= 1)).toBe(true)
  })
})

describe('createCircuitDrumEngine', () => {
  it('uses the host destination and clamps late attacks to context time', () => {
    const context = new FakeAudioContext()
    const destination = new FakeAudioNode()
    const engine = createCircuitDrumEngine({ variationSeed: 12 })

    expect(
      engine.trigger(
        context as unknown as BaseAudioContext,
        destination as unknown as AudioNode,
        { gmKey: 36, velocity: 99, atContextTime: 4 },
      ),
    ).toBe('synthesized')

    expect(context.oscillators[0]?.starts).toEqual([10])
    expect(context.gains[0]?.connections).toContain(destination)
    expect(
      engine.trigger(
        context as unknown as BaseAudioContext,
        destination as unknown as AudioNode,
        { gmKey: 12, velocity: 100 },
      ),
    ).toBe('unmapped')
  })

  it('chokes only open hats in the struck lane and scopes panic by lane', () => {
    const context = new FakeAudioContext()
    const destination = new FakeAudioNode()
    const engine = createCircuitDrumEngine()
    const hostContext = context as unknown as BaseAudioContext
    const hostDestination = destination as unknown as AudioNode

    engine.trigger(hostContext, hostDestination, {
      gmKey: 46,
      velocity: 100,
      atContextTime: 11,
      lane: 'live',
    })
    engine.trigger(hostContext, hostDestination, {
      gmKey: 46,
      velocity: 100,
      atContextTime: 11,
      lane: 'authored',
    })
    const liveOpenHat = context.bufferSources[0]
    const authoredOpenHat = context.bufferSources[1]

    engine.trigger(hostContext, hostDestination, {
      gmKey: 42,
      velocity: 100,
      atContextTime: 12,
      lane: 'authored',
    })

    expect(liveOpenHat?.stops).toHaveLength(1)
    expect(authoredOpenHat?.stops).toHaveLength(2)
    expect(authoredOpenHat?.stops[1]).toBeCloseTo(12.07, 6)
    expect(context.gains[0]?.gain.events).not.toContainEqual({
      kind: 'hold',
      at: 12,
    })
    expect(context.gains[1]?.gain.events).toContainEqual({
      kind: 'hold',
      at: 12,
    })

    engine.panic('live')
    expect(liveOpenHat?.stops).toHaveLength(2)
    expect(authoredOpenHat?.stops).toHaveLength(2)
  })

  it('releases an explicit GM cymbal target only in the requested lane', () => {
    const context = new FakeAudioContext()
    const destination = new FakeAudioNode()
    const engine = createCircuitDrumEngine()
    const hostContext = context as unknown as BaseAudioContext
    const hostDestination = destination as unknown as AudioNode

    engine.trigger(hostContext, hostDestination, {
      gmKey: 49,
      velocity: 108,
      atContextTime: 11,
      lane: 'live',
    })
    engine.trigger(hostContext, hostDestination, {
      gmKey: 49,
      velocity: 108,
      atContextTime: 11,
      lane: 'authored',
    })

    expect(engine.choke('cymbal:49', 11.11, 'authored')).toBe(1)
    expect(engine.choke('cymbal:49', 11.12, 'authored')).toBe(0)
    expect(engine.choke('cymbal:49', 11.13, 'live')).toBe(1)
  })

  it('lets panic override a future choke before reopening the lane', () => {
    const context = new FakeAudioContext()
    const destination = new FakeAudioNode()
    const engine = createCircuitDrumEngine()
    const hostContext = context as unknown as BaseAudioContext
    const hostDestination = destination as unknown as AudioNode

    engine.trigger(hostContext, hostDestination, {
      gmKey: 49,
      velocity: 108,
      atContextTime: 12,
      lane: 'authored',
    })
    const staleCrash = context.bufferSources[0]!
    const staleGate = context.gains[0]!

    expect(engine.choke('cymbal:49', 12.11, 'authored')).toBe(1)
    engine.panic('authored')
    engine.trigger(hostContext, hostDestination, {
      gmKey: 49,
      velocity: 108,
      lane: 'authored',
    })

    expect(staleCrash.stops).toContain(10.105)
    expect(staleGate.gain.events).toContainEqual({
      kind: 'hold',
      at: 10,
    })
    expect(staleGate.gain.events).toContainEqual({
      kind: 'target',
      at: 10,
      value: 0.0001,
    })
    expect(context.bufferSources[1]?.starts).toEqual([10])
  })

  it('tears down active sources and rejects hits after disposal', () => {
    const context = new FakeAudioContext()
    const destination = new FakeAudioNode()
    const engine = createCircuitDrumEngine()

    engine.trigger(
      context as unknown as BaseAudioContext,
      destination as unknown as AudioNode,
      { gmKey: 38, velocity: 120 },
    )
    engine.dispose()

    expect(
      [...context.bufferSources, ...context.oscillators].every(
        (source) => source.stops.length >= 2,
      ),
    ).toBe(true)
    expect(
      engine.trigger(
        context as unknown as BaseAudioContext,
        destination as unknown as AudioNode,
        { gmKey: 36, velocity: 120 },
      ),
    ).toBe('dropped')
  })
})

describe('createCircuitDrumSynth', () => {
  it('keeps the standalone port inert until a context and output exist', () => {
    let context: AudioContext | null = null
    let output: AudioNode | null = null
    const player = createCircuitDrumSynth({
      getAudioContext: () => context,
      getOutput: () => output,
    })

    expect(player.activate()).toBe(false)
    expect(player.trigger({ gmKey: 36, velocity: 100 })).toBe('dropped')

    const fakeContext = new FakeAudioContext()
    const fakeOutput = new FakeAudioNode()
    context = fakeContext as unknown as AudioContext
    output = fakeOutput as unknown as AudioNode
    expect(player.activate()).toBe(true)
    expect(player.trigger({ gmKey: 36, velocity: 100 })).toBe('synthesized')
  })

  it('reports choked, idle, and unmapped GM-target release truth', () => {
    const context = new FakeAudioContext()
    const output = new FakeAudioNode()
    const player = createCircuitDrumSynth({
      getAudioContext: () => context as unknown as AudioContext,
      getOutput: () => output as unknown as AudioNode,
    })

    player.trigger({
      gmKey: 49,
      velocity: 110,
      lane: 'authored',
    })

    expect(player.choke?.({ gmKey: 49, lane: 'authored' })).toBe('choked')
    expect(player.choke?.({ gmKey: 49, lane: 'authored' })).toBe('idle')
    expect(player.choke?.({ gmKey: 38, lane: 'authored' })).toBe('unmapped')
  })
})
