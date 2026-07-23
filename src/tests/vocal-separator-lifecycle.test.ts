import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VocalSeparator } from '@/lib/vocal-separator'

class MockWorker {
  static instances: MockWorker[] = []

  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  readonly postMessage = vi.fn()
  readonly terminate = vi.fn()

  constructor() {
    MockWorker.instances.push(this)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  MockWorker.instances = []
  vi.stubGlobal('Worker', MockWorker)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('VocalSeparator lifecycle', () => {
  it('requests graceful worker teardown before the termination fallback', () => {
    const separator = new VocalSeparator()
    const worker = MockWorker.instances[0]

    separator.destroy()

    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'destroy' })
    expect(worker.terminate).not.toHaveBeenCalled()
    expect(separator.status).toBe('idle')

    vi.advanceTimersByTime(1000)
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it('rejects initialization when destroyed before the worker is ready', async () => {
    const separator = new VocalSeparator()
    const initialization = separator.initialize('/models/vocals.onnx')

    separator.destroy()

    await expect(initialization).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('rejects an in-flight separation when destroyed', async () => {
    const separator = new VocalSeparator()
    const worker = MockWorker.instances[0]
    const initialization = separator.initialize('/models/vocals.onnx')

    worker.onmessage?.({
      data: { type: 'ready', provider: 'wasm' },
    } as MessageEvent)
    await initialization

    const separation = separator.separate(new Float32Array([0]), 44100)
    separator.destroy()

    await expect(separation).rejects.toMatchObject({ name: 'AbortError' })
  })
})
