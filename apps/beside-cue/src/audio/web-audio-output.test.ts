// ============================================================
// Web Audio output tests — graph, envelope, loop and cancellation
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AudioOutputPlayRequest } from './audio-session'
import { createWebAudioOutput } from './web-audio-output'

interface ParamEvent {
  readonly type: 'cancel' | 'hold' | 'set' | 'exponential' | 'target'
  readonly value?: number
  readonly time: number
  readonly constant?: number
}

class FakeAudioParam {
  value = 1
  readonly events: ParamEvent[] = []

  constructor(
    private readonly operations: string[],
    private readonly label: string,
  ) {}

  cancelScheduledValues(time: number): this {
    this.events.push({ type: 'cancel', time })
    return this
  }

  cancelAndHoldAtTime(time: number): this {
    this.events.push({ type: 'hold', time })
    return this
  }

  setValueAtTime(value: number, time: number): this {
    this.value = value
    this.events.push({ type: 'set', value, time })
    return this
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    this.value = value
    this.events.push({ type: 'exponential', value, time })
    this.operations.push(`${this.label}:exponential`)
    return this
  }

  setTargetAtTime(value: number, time: number, constant: number): this {
    this.value = value
    this.events.push({ type: 'target', value, time, constant })
    return this
  }
}

class FakeSource {
  buffer: AudioBuffer | null = null
  loop = false
  loopStart = 0
  loopEnd = 0
  onended: (() => void) | null = null
  readonly starts: number[] = []
  readonly stops: number[] = []
  disconnectCount = 0

  constructor(private readonly operations: string[]) {}

  connect(): void {}

  disconnect(): void {
    this.disconnectCount += 1
  }

  start(when: number): void {
    this.starts.push(when)
    this.operations.push('source:start')
  }

  stop(when: number): void {
    this.stops.push(when)
  }

  end(): void {
    this.onended?.()
  }
}

class FakeGain {
  readonly gain: FakeAudioParam
  disconnectCount = 0

  constructor(operations: string[], label: string) {
    this.gain = new FakeAudioParam(operations, label)
  }

  connect(): void {}

  disconnect(): void {
    this.disconnectCount += 1
  }
}

interface TestDeferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
}

function testDeferred<T>(): TestDeferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

function fakeBuffer(duration = 10): AudioBuffer {
  return {
    duration,
    length: duration * 48_000,
    numberOfChannels: 1,
  } as AudioBuffer
}

function createFakeContext(
  options: {
    readonly decode?: (bytes: ArrayBuffer) => Promise<AudioBuffer>
  } = {},
) {
  const sources: FakeSource[] = []
  const gains: FakeGain[] = []
  const operations: string[] = []
  let state: AudioContextState = 'suspended'
  let resumeCount = 0
  let closeCount = 0
  let decodeCount = 0
  const context = {
    currentTime: 10,
    destination: {},
    get state() {
      return state
    },
    async decodeAudioData(bytes: ArrayBuffer) {
      decodeCount += 1
      return options.decode?.(bytes) ?? fakeBuffer()
    },
    async resume() {
      resumeCount += 1
      state = 'running'
    },
    async close() {
      closeCount += 1
      state = 'closed'
    },
    createBufferSource() {
      const source = new FakeSource(operations)
      sources.push(source)
      return source as unknown as AudioBufferSourceNode
    },
    createGain() {
      const gain = new FakeGain(operations, `gain-${String(gains.length)}`)
      gains.push(gain)
      return gain as unknown as GainNode
    },
  } as unknown as AudioContext
  return {
    context,
    sources,
    gains,
    operations,
    suspend: () => {
      state = 'suspended'
    },
    resumeCount: () => resumeCount,
    closeCount: () => closeCount,
    decodeCount: () => decodeCount,
  }
}

let requestCounter = 0

afterEach(() => {
  vi.useRealTimers()
})

function request(
  playback: AudioOutputPlayRequest['playback'] = { kind: 'one-shot' },
  initialGain = 1,
): AudioOutputPlayRequest {
  requestCounter += 1
  return {
    source: {
      src: `audio/test/output-${String(requestCounter)}.m4a`,
      mimeType: 'audio/mp4',
      sha256: requestCounter.toString(16).padStart(64, '0'),
      byteLength: 8,
      durationMs: 10_000,
      sampleRateHz: 48_000,
      channels: 1,
    },
    playback,
    initialGain,
  }
}

describe('web audio output', () => {
  it('creates and unlocks one lazy context', async () => {
    const fake = createFakeContext()
    let createCount = 0
    const output = createWebAudioOutput({
      createContext: () => {
        createCount += 1
        return fake.context
      },
      supportsMimeType: () => true,
    })

    expect(createCount).toBe(0)
    expect(output.supportsMimeType('audio/mp4')).toBe(true)
    expect(createCount).toBe(0)
    await expect(output.unlock()).resolves.toBe(true)
    await expect(output.unlock()).resolves.toBe(true)
    expect(createCount).toBe(1)
    expect(fake.resumeCount()).toBe(2)
  })

  it('opens and releases a bounded loop with the mandatory envelopes', async () => {
    const fake = createFakeContext()
    const output = createWebAudioOutput({
      createContext: () => fake.context,
      fetchArrayBuffer: async () => new ArrayBuffer(8),
      supportsMimeType: () => true,
      resolveAssetUrl: (src) => src,
    })
    const playback = output.play(
      request({ kind: 'loop', loopStartMs: 250, loopEndMs: 8_250 }, 0.8),
    )

    await expect(playback.started).resolves.toBe('started')
    expect(fake.sources[0]?.starts).toEqual([0])
    expect(fake.sources[0]).toMatchObject({
      loop: true,
      loopStart: 0.25,
      loopEnd: 8.25,
    })
    expect(fake.gains[0]?.gain.events).toEqual([
      { type: 'cancel', time: 10 },
      { type: 'set', value: 0.0001, time: 10 },
      { type: 'exponential', value: 1, time: 10.09 },
    ])
    expect(fake.gains[1]?.gain.events).toEqual([
      { type: 'cancel', time: 10 },
      { type: 'set', value: 0.8, time: 10 },
    ])
    expect(fake.operations.indexOf('source:start')).toBeLessThan(
      fake.operations.indexOf('gain-0:exponential'),
    )

    playback.setGain(0.35)
    expect(fake.gains[1]?.gain.events.slice(-2)).toEqual([
      { type: 'hold', time: 10 },
      { type: 'target', value: 0.35, time: 10, constant: 0.018 },
    ])
    playback.stop()
    await expect(playback.finished).resolves.toBe('stopped')
    expect(fake.gains[0]?.gain.events.slice(-2)).toEqual([
      { type: 'hold', time: 10 },
      { type: 'target', value: 0, time: 10, constant: 0.036 },
    ])
    expect(fake.sources[0]?.stops).toEqual([10.24])
  })

  it('disconnects a suspended graph so a later unlock cannot revive it', async () => {
    const fake = createFakeContext()
    const output = createWebAudioOutput({
      createContext: () => fake.context,
      fetchArrayBuffer: async () => new ArrayBuffer(8),
      supportsMimeType: () => true,
    })
    const playback = output.play(request())
    await expect(playback.started).resolves.toBe('started')

    fake.suspend()
    playback.stop()
    await expect(playback.finished).resolves.toBe('stopped')

    expect(fake.sources[0]?.stops).toEqual([0])
    expect(fake.sources[0]?.disconnectCount).toBe(1)
    expect(fake.gains[0]?.disconnectCount).toBe(1)
    expect(fake.gains[1]?.disconnectCount).toBe(1)
    expect(fake.gains[0]?.gain.events).not.toContainEqual(
      expect.objectContaining({ type: 'target', value: 0 }),
    )

    await expect(output.unlock()).resolves.toBe(true)
    expect(fake.sources[0]?.disconnectCount).toBe(1)
  })

  it('never creates a source after a stopped pending decode resolves', async () => {
    const decoded = testDeferred<AudioBuffer>()
    const fake = createFakeContext({ decode: () => decoded.promise })
    const output = createWebAudioOutput({
      createContext: () => fake.context,
      fetchArrayBuffer: async () => new ArrayBuffer(8),
      supportsMimeType: () => true,
      resolveAssetUrl: (src) => src,
    })
    const playback = output.play(request())
    await Promise.resolve()
    await Promise.resolve()
    playback.stop()
    decoded.resolve(fakeBuffer())

    await expect(playback.started).resolves.toBe('stopped')
    await expect(playback.finished).resolves.toBe('stopped')
    await Promise.resolve()
    await Promise.resolve()
    expect(fake.sources).toHaveLength(0)
  })

  it('reports decode and invalid loop failures without starting sound', async () => {
    const failing = createFakeContext({
      decode: async () => {
        throw new DOMException('Bad bytes', 'EncodingError')
      },
    })
    const failedOutput = createWebAudioOutput({
      createContext: () => failing.context,
      fetchArrayBuffer: async () => new ArrayBuffer(8),
      supportsMimeType: () => true,
    })
    const failed = failedOutput.play(request())
    await expect(failed.started).resolves.toBe('failed')
    await expect(failed.finished).resolves.toBe('failed')
    expect(failing.sources).toHaveLength(0)

    const short = createFakeContext({ decode: async () => fakeBuffer(1) })
    const shortOutput = createWebAudioOutput({
      createContext: () => short.context,
      fetchArrayBuffer: async () => new ArrayBuffer(8),
      supportsMimeType: () => true,
    })
    const invalidLoop = shortOutput.play(
      request({ kind: 'loop', loopStartMs: 0, loopEndMs: 2_000 }),
    )
    await expect(invalidLoop.started).resolves.toBe('failed')
    await expect(invalidLoop.finished).resolves.toBe('failed')
    expect(short.sources).toHaveLength(0)
  })

  it('settles natural completion once and reuses the decoded cache', async () => {
    const fake = createFakeContext()
    let fetchCount = 0
    const output = createWebAudioOutput({
      createContext: () => fake.context,
      fetchArrayBuffer: async () => {
        fetchCount += 1
        return new ArrayBuffer(8)
      },
      supportsMimeType: () => true,
      resolveAssetUrl: (src) => src,
    })
    const shared = request()
    const first = output.play(shared)
    await first.started
    fake.sources[0]?.end()
    await expect(first.finished).resolves.toBe('ended')

    const second = output.play(shared)
    await second.started
    expect(fetchCount).toBe(1)
    expect(fake.decodeCount()).toBe(1)
    fake.sources[1]?.end()
    await expect(second.finished).resolves.toBe('ended')
  })

  it('fails quietly when context creation or resume is unavailable', async () => {
    const unavailable = createWebAudioOutput({
      createContext: () => undefined,
      supportsMimeType: () => true,
    })
    await expect(unavailable.unlock()).resolves.toBe(false)
    const playback = unavailable.play(request())
    await expect(playback.started).resolves.toBe('failed')
    await expect(playback.finished).resolves.toBe('failed')

    const fake = createFakeContext()
    Object.defineProperty(fake.context, 'resume', {
      value: async () => {
        throw new DOMException('Denied', 'NotAllowedError')
      },
    })
    const denied = createWebAudioOutput({
      createContext: () => fake.context,
      supportsMimeType: () => true,
    })
    await expect(denied.unlock()).resolves.toBe(false)
    const deniedPlayback = denied.play(request())
    await expect(deniedPlayback.started).resolves.toBe('failed')
    await expect(deniedPlayback.finished).resolves.toBe('failed')
  })

  it('disposes playback and closes the single context once after release', async () => {
    vi.useFakeTimers()
    const fake = createFakeContext()
    const output = createWebAudioOutput({
      createContext: () => fake.context,
      fetchArrayBuffer: async () => new ArrayBuffer(8),
      supportsMimeType: () => true,
    })
    const playback = output.play(request())
    await expect(playback.started).resolves.toBe('started')
    output.dispose()
    output.dispose()

    await expect(playback.finished).resolves.toBe('stopped')
    expect(fake.sources[0]?.stops).toEqual([10.24])
    expect(fake.closeCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(239)
    expect(fake.closeCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(fake.closeCount()).toBe(1)
    await expect(output.unlock()).resolves.toBe(false)
    await vi.runAllTimersAsync()
    expect(fake.closeCount()).toBe(1)
  })
})
