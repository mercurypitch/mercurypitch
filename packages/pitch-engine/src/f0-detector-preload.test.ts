// ============================================================
// The detector worker, started ahead of the stream that adopts it: kept
// until one stream takes it, never shared by two, dropped when its script
// failed, terminated when nobody came for it -- and no microphone or
// audio context asked for on the way.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() {
    FakeWorker.instances.push(this)
  }
}

class FakeWorkletNode {
  port = { onmessage: null as ((event: MessageEvent) => void) | null }
  connect = vi.fn()
  disconnect = vi.fn()
}

function fakeContext() {
  const analyser = {
    fftSize: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getFloatTimeDomainData: vi.fn(),
  }
  const ctx = {
    sampleRate: 48000,
    currentTime: 0,
    destination: {},
    createMediaStreamSource: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createGain: vi.fn(() => ({
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createAnalyser: vi.fn(() => analyser),
    audioWorklet: { addModule: vi.fn(async () => undefined) },
  }
  return ctx as unknown as AudioContext & {
    createAnalyser: ReturnType<typeof vi.fn>
  }
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

const configured = (w: FakeWorker): boolean =>
  w.postMessage.mock.calls.some(
    ([msg]) => (msg as { kind?: string }).kind === 'configure',
  )

beforeEach(() => {
  FakeWorker.instances = []
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('AudioWorkletNode', FakeWorkletNode)
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(async () => {
  const { releasePreloadedDetector } = await import('./f0-detector-preload')
  releasePreloadedDetector()
  vi.unstubAllGlobals()
})

describe('preloadF0Detector', () => {
  it('starts one worker and keeps it for a stream, not doubled', async () => {
    const { preloadF0Detector } = await import('./f0-detector-preload')
    expect(preloadF0Detector()).toBe(true)
    expect(preloadF0Detector()).toBe(true)
    expect(FakeWorker.instances).toHaveLength(1)
    expect(FakeWorker.instances[0].terminate).not.toHaveBeenCalled()
    // Unconfigured: the sample rate is the stream's to tell it.
    expect(FakeWorker.instances[0].postMessage).not.toHaveBeenCalled()
  })

  it('hands the spare to the next stream, and only to that one', async () => {
    const { preloadF0Detector } = await import('./f0-detector-preload')
    const { createF0Stream } = await import('./pitch-f0-stream')
    preloadF0Detector()
    const spare = FakeWorker.instances[0]

    const first = createF0Stream(fakeContext(), {} as MediaStream)
    await flush()
    expect(FakeWorker.instances).toHaveLength(1)
    expect(configured(spare)).toBe(true)

    // Taken once: the second stream spawns its own, because the first
    // terminates its worker on dispose.
    const second = createF0Stream(fakeContext(), {} as MediaStream)
    await flush()
    expect(FakeWorker.instances).toHaveLength(2)
    expect(configured(FakeWorker.instances[1])).toBe(true)

    first.dispose()
    expect(spare.terminate).toHaveBeenCalledTimes(1)
    expect(FakeWorker.instances[1].terminate).not.toHaveBeenCalled()
    second.dispose()
  })

  it('leaves an adopted spare that fails to its stream, which falls back', async () => {
    const { preloadF0Detector } = await import('./f0-detector-preload')
    const { createF0Stream } = await import('./pitch-f0-stream')
    preloadF0Detector()
    const ctx = fakeContext()
    const stream = createF0Stream(ctx, {} as MediaStream)
    await flush()
    const worker = FakeWorker.instances[0]

    worker.onerror?.(new Event('error') as ErrorEvent)
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    expect(ctx.createAnalyser).toHaveBeenCalledTimes(1)
    stream.dispose()
  })

  it('drops a spare whose script failed before any stream came', async () => {
    const { preloadF0Detector } = await import('./f0-detector-preload')
    const { createF0Stream } = await import('./pitch-f0-stream')
    preloadF0Detector()
    const dead = FakeWorker.instances[0]
    dead.onerror?.(new Event('error') as ErrorEvent)
    expect(dead.terminate).toHaveBeenCalledTimes(1)

    const ctx = fakeContext()
    const stream = createF0Stream(ctx, {} as MediaStream)
    await flush()
    expect(FakeWorker.instances).toHaveLength(2)
    expect(configured(dead)).toBe(false)
    expect(configured(FakeWorker.instances[1])).toBe(true)
    expect(ctx.createAnalyser).not.toHaveBeenCalled()
    stream.dispose()
  })

  it('terminates a spare nobody took', async () => {
    const { preloadF0Detector, releasePreloadedDetector } =
      await import('./f0-detector-preload')
    const { createF0Stream } = await import('./pitch-f0-stream')
    preloadF0Detector()
    releasePreloadedDetector()
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledTimes(1)
    releasePreloadedDetector()
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledTimes(1)

    const stream = createF0Stream(fakeContext(), {} as MediaStream)
    await flush()
    expect(FakeWorker.instances).toHaveLength(2)
    stream.dispose()
  })

  it('asks for no microphone and no audio context', async () => {
    const getUserMedia = vi.fn()
    const AudioContextSpy = vi.fn()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    vi.stubGlobal('AudioContext', AudioContextSpy)
    vi.stubGlobal('webkitAudioContext', AudioContextSpy)
    const { preloadF0Detector } = await import('./f0-detector-preload')
    preloadF0Detector()
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(AudioContextSpy).not.toHaveBeenCalled()
  })

  it('reports false, and throws nothing, where there are no workers', async () => {
    vi.stubGlobal('Worker', undefined)
    const { preloadF0Detector } = await import('./f0-detector-preload')
    expect(preloadF0Detector()).toBe(false)
  })

  it('reports false when the engine refuses to spawn one', async () => {
    vi.stubGlobal('Worker', function RefusedWorker() {
      throw new Error('SecurityError')
    })
    const { preloadF0Detector, takePreloadedDetector } =
      await import('./f0-detector-preload')
    expect(preloadF0Detector()).toBe(false)
    expect(takePreloadedDetector()).toBeNull()
  })
})
