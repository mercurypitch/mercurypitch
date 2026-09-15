// ============================================================
// createF0Stream's two analysis paths: the worklet + worker path
// when the engine offers it, and the frame-loop fallback -- also
// when the detector worker's script fails to load after the
// worklet is already up, which used to leave pitch null for good
// while the level meter kept moving.
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

function fakeContext(withWorklet: boolean) {
  const analyser = {
    fftSize: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getFloatTimeDomainData: vi.fn(),
  }
  const source = { connect: vi.fn(), disconnect: vi.fn() }
  const ctx = {
    sampleRate: 48000,
    currentTime: 0,
    destination: {},
    createMediaStreamSource: vi.fn(() => source),
    createGain: vi.fn(() => ({
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createAnalyser: vi.fn(() => analyser),
    audioWorklet: withWorklet
      ? { addModule: vi.fn(async () => undefined) }
      : undefined,
  }
  return { ctx: ctx as unknown as AudioContext, source, analyser }
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

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

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createF0Stream', () => {
  it('publishes raw capture identity and audio time independently of renderer polling', async () => {
    const { createF0Stream } = await import('./pitch-f0-stream')
    const { ctx } = fakeContext(true)
    Object.defineProperty(ctx, 'currentTime', { value: 10, writable: true })
    const stream = createF0Stream(ctx, {} as MediaStream)
    await flush()
    stream.startTask()
    const listener = vi.fn()
    const unsubscribe = stream.subscribeCaptured(listener)
    const worker = FakeWorker.instances[0]
    const deliver = (seconds: number, f0: number): void => {
      worker.onmessage?.(
        new MessageEvent('message', {
          data: {
            atFrame: seconds * 48000,
            rms: f0 === 0 ? 0 : 0.1,
            f0,
            conf: f0 === 0 ? 0 : 0.9,
          },
        }),
      )
    }
    // These queued worker results arrive 500 ms after capture, without an rAF.
    Object.defineProperty(ctx, 'currentTime', { value: 10.6, writable: true })
    deliver(10.1, 220)
    deliver(10.125, 220)
    deliver(10.15, 0)
    expect(listener).toHaveBeenCalledTimes(3)
    expect(listener.mock.calls[0][0]).toMatchObject({
      sequence: 1,
      capturedAudioSeconds: 10.1,
      frame: { f0: 220 },
    })
    expect(listener.mock.calls[2][0]).toMatchObject({
      sequence: 3,
      capturedAudioSeconds: 10.15,
      frame: { f0: 0, conf: 0 },
    })
    const latest = stream.latestCaptured()
    for (let n = 0; n < 30; n++) expect(stream.latestCaptured()).toBe(latest)
    expect(listener).toHaveBeenCalledTimes(3)
    unsubscribe()
    deliver(10.175, 220)
    expect(listener).toHaveBeenCalledTimes(3)
    stream.subscribeCaptured(listener)
    stream.dispose()
    deliver(10.2, 220)
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('counts every accepted worker result, including equal levels and silence', async () => {
    const { createF0Stream } = await import('./pitch-f0-stream')
    const { ctx } = fakeContext(true)
    const stream = createF0Stream(ctx, {} as MediaStream)
    await flush()
    const worker = FakeWorker.instances[0]
    const deliver = (atFrame: number, rms = 0.1): void => {
      worker.onmessage?.(
        new MessageEvent('message', {
          data: {
            atFrame,
            rms,
            f0: rms === 0 ? 0 : 220,
            conf: rms === 0 ? 0 : 1,
          },
        }),
      )
    }
    deliver(0)
    expect(stream.frameCount()).toBe(0)
    stream.startTask()
    // All fifty have identical RMS and can arrive between renderer polls.
    for (let n = 1; n <= 50; n++) deliver(n * 1024)
    expect(stream.frameCount()).toBe(50)
    for (let n = 0; n < 100; n++) {
      stream.latest()
      stream.latestSmoothed()
      stream.latestLevel()
    }
    expect(stream.frameCount()).toBe(50)
    deliver(51 * 1024, 0)
    expect(stream.frameCount()).toBe(51)
    expect(stream.takeFrames()).toHaveLength(51)
    deliver(52 * 1024)
    expect(stream.frameCount()).toBe(51)

    // Taking another recording does not rewind lifetime telemetry.
    stream.startTask()
    deliver(53 * 1024)
    expect(stream.frameCount()).toBe(52)
    stream.dispose()
    deliver(54 * 1024)
    expect(stream.frameCount()).toBe(52)
  })

  it('counts fallback analyses only while recording, even for digital silence', async () => {
    const { createF0Stream } = await import('./pitch-f0-stream')
    const { ctx, analyser } = fakeContext(false)
    const stream = createF0Stream(ctx, {} as MediaStream)
    await flush()
    const tick = (at: number): void => {
      vi.mocked(requestAnimationFrame).mock.calls.at(-1)![0](at)
    }
    tick(0)
    expect(stream.frameCount()).toBe(0)
    stream.startTask()
    tick(16)
    tick(32)
    expect(analyser.getFloatTimeDomainData).toHaveBeenCalledTimes(3)
    expect(stream.frameCount()).toBe(2)
    expect(stream.latest()).toMatchObject({ f0: 0, rms: 0 })
    expect(stream.takeFrames()).toHaveLength(2)
    tick(48)
    expect(stream.frameCount()).toBe(2)
    stream.dispose()
    tick(64)
    expect(stream.frameCount()).toBe(2)
  })

  it('takes the worklet path when the engine offers it', async () => {
    const { createF0Stream } = await import('./pitch-f0-stream')
    const { ctx, source } = fakeContext(true)
    const stream = createF0Stream(ctx, {} as MediaStream)
    await flush()
    expect(FakeWorker.instances).toHaveLength(1)
    expect(FakeWorker.instances[0].postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'configure', sampleRate: 48000 }),
    )
    expect(source.connect).toHaveBeenCalledTimes(1)
    expect(ctx.createAnalyser).not.toHaveBeenCalled()
    stream.dispose()
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledTimes(1)
  })

  it('falls back to the frame loop without a worklet', async () => {
    const { createF0Stream } = await import('./pitch-f0-stream')
    const { ctx } = fakeContext(false)
    const stream = createF0Stream(ctx, {} as MediaStream)
    await flush()
    expect(FakeWorker.instances).toHaveLength(0)
    expect(ctx.createAnalyser).toHaveBeenCalledTimes(1)
    expect(requestAnimationFrame).toHaveBeenCalled()
    stream.dispose()
  })

  it('hands over to the frame loop when the detector worker fails to load', async () => {
    const { createF0Stream } = await import('./pitch-f0-stream')
    const { ctx, source } = fakeContext(true)
    const stream = createF0Stream(ctx, {} as MediaStream)
    await flush()
    const worker = FakeWorker.instances[0]
    expect(ctx.createAnalyser).not.toHaveBeenCalled()

    // A stale index.html after a redeploy, a CSP without worker-src: the
    // script 404s and the worker reports it asynchronously.
    worker.onerror?.(new Event('error') as ErrorEvent)
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    // The worklet is taken off the source and the analyser goes on.
    expect(source.disconnect).toHaveBeenCalled()
    expect(ctx.createAnalyser).toHaveBeenCalledTimes(1)
    expect(requestAnimationFrame).toHaveBeenCalled()

    // A second report changes nothing, and dispose does not double up.
    worker.onerror?.(new Event('error') as ErrorEvent)
    expect(ctx.createAnalyser).toHaveBeenCalledTimes(1)
    stream.dispose()
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
})
