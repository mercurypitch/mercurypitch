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
