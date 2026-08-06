// ============================================================
// Guitar backing transport tests protect one-clock playback, safe replacement, and bounded decoding
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { GuitarBackingSession, GuitarBackingTrack, } from './guitar-backing-transport'
import { createGuitarBackingTransport, estimateGuitarBackingPcmBytes, } from './guitar-backing-transport'

interface ParameterOperation {
  kind: 'cancel' | 'linear' | 'set' | 'target'
  value?: number
  when: number
  timeConstant?: number
}

class FakeAudioParameter {
  value = 1
  readonly operations: ParameterOperation[] = []

  cancelScheduledValues(when: number): void {
    this.operations.push({ kind: 'cancel', when })
  }

  setValueAtTime(value: number, when: number): void {
    this.value = value
    this.operations.push({ kind: 'set', value, when })
  }

  linearRampToValueAtTime(value: number, when: number): void {
    this.value = value
    this.operations.push({ kind: 'linear', value, when })
  }

  setTargetAtTime(value: number, when: number, timeConstant: number): void {
    this.value = value
    this.operations.push({ kind: 'target', value, when, timeConstant })
  }
}

class FakeGainNode {
  readonly gain = new FakeAudioParameter()
  readonly connect = vi.fn((destination: unknown) => destination)
  readonly disconnect = vi.fn()
}

class FakeBufferSourceNode {
  buffer: AudioBuffer | null = null
  onended: (() => void) | null = null
  readonly connect = vi.fn((destination: unknown) => destination)
  readonly disconnect = vi.fn()
  readonly start = vi.fn((_when?: number, _offset?: number) => undefined)
  readonly stop = vi.fn((_when?: number) => undefined)
}

function decodedBuffer(duration = 12): AudioBuffer {
  return {
    duration,
    numberOfChannels: 2,
    sampleRate: 48_000,
  } as unknown as AudioBuffer
}

class FakeAudioContext {
  sampleRate = 48_000
  currentTime = 10
  state: AudioContextState = 'suspended'
  readonly destination = {} as AudioDestinationNode
  readonly gains: FakeGainNode[] = []
  readonly sources: FakeBufferSourceNode[] = []
  readonly resume = vi.fn(async () => {
    this.state = 'running'
  })
  readonly close = vi.fn(async () => {
    this.state = 'closed'
  })
  decodeImpl: (encoded: ArrayBuffer) => Promise<AudioBuffer> = async () =>
    decodedBuffer()
  readonly decodeAudioData = vi.fn((encoded: ArrayBuffer) =>
    this.decodeImpl(encoded),
  )

  createGain(): GainNode {
    const node = new FakeGainNode()
    this.gains.push(node)
    return node as unknown as GainNode
  }

  createDynamicsCompressor(): DynamicsCompressorNode {
    return {
      threshold: new FakeAudioParameter(),
      knee: new FakeAudioParameter(),
      ratio: new FakeAudioParameter(),
      attack: new FakeAudioParameter(),
      release: new FakeAudioParameter(),
      connect: vi.fn((destination: unknown) => destination),
      disconnect: vi.fn(),
    } as unknown as DynamicsCompressorNode
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeBufferSourceNode()
    this.sources.push(source)
    return source as unknown as AudioBufferSourceNode
  }
}

function deferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function track(
  id: string,
  overrides: Partial<GuitarBackingTrack> = {},
): GuitarBackingTrack {
  return {
    id,
    label: id === 'guitar' ? 'Guitar' : 'Drums',
    url: `blob:${id}`,
    sizeBytes: 64,
    durationSeconds: 12,
    channelCount: 2,
    ...overrides,
  }
}

function session(
  sessionId: string,
  tracks: readonly GuitarBackingTrack[] = [track('drums')],
): GuitarBackingSession {
  return {
    sessionId,
    title: `Room ${sessionId}`,
    tracks,
  }
}

function audioHarness(options: { fadeSeconds?: number } = {}) {
  const context = new FakeAudioContext()
  const contextFactory = vi.fn(() => context as unknown as AudioContext)
  const activateContext = vi.fn(async (audioContext: AudioContext) => {
    await audioContext.resume()
  })
  const fetchArrayBuffer = vi.fn(
    async (_url: string, _signal: AbortSignal) => new ArrayBuffer(8),
  )
  const transport = createGuitarBackingTransport({
    contextFactory,
    activateContext,
    fetchArrayBuffer,
    fadeSeconds: options.fadeSeconds ?? 0,
    scheduleLeadSeconds: 0.012,
  })
  return {
    activateContext,
    context,
    contextFactory,
    fetchArrayBuffer,
    transport,
  }
}

describe('createGuitarBackingTransport', () => {
  it('arms and exposes a mix without creating or activating audio', () => {
    const harness = audioHarness()
    const onChange = vi.fn()
    const unsubscribe = harness.transport.subscribe(onChange)

    harness.transport.configure(
      session('quiet-entry', [
        track('drums'),
        track('guitar', { muted: true, level: 0.4 }),
      ]),
    )

    expect(harness.contextFactory).not.toHaveBeenCalled()
    expect(harness.activateContext).not.toHaveBeenCalled()
    expect(harness.fetchArrayBuffer).not.toHaveBeenCalled()
    expect(harness.transport.getStatus()).toBe('armed')
    expect(harness.transport.getDuration()).toBe(12)
    expect(harness.transport.getTrackStates()).toEqual([
      {
        id: 'drums',
        label: 'Drums',
        muted: false,
        level: 1,
        available: true,
      },
      {
        id: 'guitar',
        label: 'Guitar',
        muted: true,
        level: 0.4,
        available: true,
      },
    ])
    expect(onChange).toHaveBeenCalledOnce()

    harness.transport.configure(null)
    expect(harness.transport.getStatus()).toBe('idle')
    expect(harness.contextFactory).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('creates and resumes one context, then sample-aligns every stem', async () => {
    const harness = audioHarness()
    const durations = [12, 10]
    harness.context.decodeImpl = async () =>
      decodedBuffer(durations.shift() ?? 1)
    harness.transport.configure(
      session('aligned', [track('drums'), track('guitar')]),
    )

    await expect(harness.transport.play()).resolves.toBe(true)

    expect(harness.contextFactory).toHaveBeenCalledOnce()
    expect(harness.activateContext).toHaveBeenCalledOnce()
    expect(harness.context.resume).toHaveBeenCalledOnce()
    expect(harness.fetchArrayBuffer).toHaveBeenCalledTimes(2)
    expect(harness.context.decodeAudioData).toHaveBeenCalledTimes(2)
    expect(harness.context.sources).toHaveLength(2)
    const starts = harness.context.sources.map(
      (source) => source.start.mock.calls[0],
    )
    expect(starts[0][0]).toBe(starts[1][0])
    expect(starts[0][1]).toBe(0)
    expect(starts[1][1]).toBe(0)
    expect(harness.transport.getStatus()).toBe('playing')
    expect(harness.transport.getDuration()).toBe(12)
  })

  it('starts a guitar channel muted and ramps it in without rebuilding the graph', async () => {
    const harness = audioHarness({ fadeSeconds: 0.05 })
    harness.transport.configure(
      session('guitar-muted', [
        track('drums'),
        track('guitar', { muted: true, level: 0.4 }),
      ]),
    )
    await harness.transport.play()
    const contextCreationCount = harness.contextFactory.mock.calls.length
    const guitarGain = harness.context.sources[1].connect.mock
      .calls[0][0] as FakeGainNode

    expect(guitarGain.gain.value).toBe(0)
    expect(harness.transport.getTrackStates()[1].muted).toBe(true)
    guitarGain.gain.operations.length = 0
    harness.context.currentTime = 12

    harness.transport.setTrackMuted('guitar', false)

    expect(harness.transport.getTrackStates()[1].muted).toBe(false)
    expect(guitarGain.gain.operations).toEqual([
      { kind: 'cancel', when: 12 },
      { kind: 'set', value: 0, when: 12 },
      expect.objectContaining({
        kind: 'linear',
        when: 12.05,
      }),
    ])
    expect(guitarGain.gain.operations.at(-1)?.value).toBeGreaterThan(0)
    expect(harness.contextFactory).toHaveBeenCalledTimes(contextCreationCount)
  })

  it('parks one common offset on pause and resumes every stem from it', async () => {
    const harness = audioHarness()
    harness.transport.configure(
      session('resume', [track('drums'), track('guitar')]),
    )
    await harness.transport.play()
    const firstStartTime = harness.context.sources[0].start.mock.calls[0][0]!
    harness.context.currentTime = firstStartTime + 3.5

    harness.transport.pause()

    expect(harness.transport.getStatus()).toBe('paused')
    expect(harness.transport.getCurrentTime()).toBeCloseTo(3.5)
    await expect(harness.transport.play()).resolves.toBe(true)

    const resumedSources = harness.context.sources.slice(-2)
    const resumedStarts = resumedSources.map(
      (source) => source.start.mock.calls[0],
    )
    expect(resumedStarts[0][0]).toBe(resumedStarts[1][0])
    expect(resumedStarts[0][1]).toBeCloseTo(3.5)
    expect(resumedStarts[1][1]).toBeCloseTo(3.5)
    expect(harness.contextFactory).toHaveBeenCalledOnce()
    expect(harness.fetchArrayBuffer).toHaveBeenCalledTimes(2)
    expect(harness.context.decodeAudioData).toHaveBeenCalledTimes(2)
  })

  it('restarts all active stems at the same target when seeking', async () => {
    const harness = audioHarness()
    harness.transport.configure(
      session('seek', [track('drums'), track('guitar')]),
    )
    await harness.transport.play()

    harness.context.currentTime = 15
    harness.transport.seek(7.25)

    const soughtSources = harness.context.sources.slice(-2)
    const soughtStarts = soughtSources.map(
      (source) => source.start.mock.calls[0],
    )
    expect(soughtStarts[0][0]).toBe(soughtStarts[1][0])
    expect(soughtStarts[0][1]).toBe(7.25)
    expect(soughtStarts[1][1]).toBe(7.25)
    expect(harness.transport.getCurrentTime()).toBeCloseTo(7.25)
    expect(harness.transport.getStatus()).toBe('playing')
  })

  it('rejects an unsafe decoded-size estimate before fetching or decoding', async () => {
    const oversizedTrack = track('drums', {
      durationSeconds: 10,
      channelCount: 2,
      sizeBytes: 1,
    })
    const estimatedBytes = estimateGuitarBackingPcmBytes(
      [oversizedTrack],
      48_000,
    )
    expect(estimatedBytes).toBe(3_840_000)
    const harness = audioHarness()
    const transport = createGuitarBackingTransport({
      contextFactory: harness.contextFactory,
      activateContext: harness.activateContext,
      fetchArrayBuffer: harness.fetchArrayBuffer,
      memoryBudgetBytes: estimatedBytes - 1,
    })
    transport.configure(session('too-large', [oversizedTrack]))

    await expect(transport.play()).resolves.toBe(false)

    expect(harness.fetchArrayBuffer).not.toHaveBeenCalled()
    expect(harness.context.decodeAudioData).not.toHaveBeenCalled()
    expect(transport.getStatus()).toBe('error')
    expect(transport.getError()).toMatch(/too large|memory|safely/i)
  })

  it('rejects a mix whose decoded buffers exceed the gate despite sparse metadata', async () => {
    const harness = audioHarness()
    const transport = createGuitarBackingTransport({
      contextFactory: harness.contextFactory,
      activateContext: harness.activateContext,
      fetchArrayBuffer: harness.fetchArrayBuffer,
      memoryBudgetBytes: 1_024,
    })
    transport.configure(
      session('decoded-too-large', [
        track('drums', { durationSeconds: undefined, sizeBytes: 1 }),
      ]),
    )

    await expect(transport.play()).resolves.toBe(false)

    expect(harness.fetchArrayBuffer).toHaveBeenCalledOnce()
    expect(harness.context.decodeAudioData).toHaveBeenCalledOnce()
    expect(harness.context.sources).toHaveLength(0)
    expect(transport.getStatus()).toBe('error')
    expect(transport.getError()).toMatch(/too large|safely/i)
  })

  it('cannot install or play a decode that resolves after session replacement', async () => {
    const harness = audioHarness()
    const oldDecode = deferred<AudioBuffer>()
    harness.context.decodeImpl = () => oldDecode.promise
    harness.transport.configure(session('old', [track('drums')]))

    const oldPlay = harness.transport.play()
    await vi.waitFor(() =>
      expect(harness.context.decodeAudioData).toHaveBeenCalledOnce(),
    )
    const oldSignal = harness.fetchArrayBuffer.mock.calls[0][1]

    harness.transport.configure(
      session('new', [track('guitar', { durationSeconds: 6 })]),
    )
    expect(oldSignal.aborted).toBe(true)
    oldDecode.resolve(decodedBuffer(12))

    await expect(oldPlay).resolves.toBe(false)
    expect(harness.context.sources).toHaveLength(0)
    expect(harness.transport.getStatus()).toBe('armed')
    expect(harness.transport.getDuration()).toBe(6)
    expect(harness.transport.getTrackStates()).toEqual([
      expect.objectContaining({ id: 'guitar' }),
    ])
  })

  it('cancels a pending start when paused during loading and can retry safely', async () => {
    const harness = audioHarness()
    const firstDecode = deferred<AudioBuffer>()
    harness.context.decodeImpl = vi
      .fn()
      .mockImplementationOnce(() => firstDecode.promise)
      .mockResolvedValue(decodedBuffer())
    harness.transport.configure(session('cancel-pending'))

    const pendingPlay = harness.transport.play()
    await vi.waitFor(() =>
      expect(harness.context.decodeAudioData).toHaveBeenCalledOnce(),
    )
    expect(harness.transport.getStatus()).toBe('loading')

    harness.transport.pause()
    firstDecode.resolve(decodedBuffer())

    await expect(pendingPlay).resolves.toBe(false)
    expect(harness.context.sources).toHaveLength(0)
    expect(harness.transport.getStatus()).toBe('armed')

    await expect(harness.transport.play()).resolves.toBe(true)
    expect(harness.context.sources).toHaveLength(1)
    expect(harness.transport.getStatus()).toBe('playing')
  })

  it('stops active sources and closes its owned context exactly once', async () => {
    const harness = audioHarness()
    harness.transport.configure(session('dispose'))
    await harness.transport.play()
    const source = harness.context.sources[0]

    await harness.transport.dispose()
    await harness.transport.dispose()

    expect(source.stop).toHaveBeenCalledOnce()
    expect(source.disconnect).toHaveBeenCalledOnce()
    expect(harness.context.close).toHaveBeenCalledOnce()
  })
})
