import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { destroyPipeline, runUvrPipeline } from '@/lib/uvr-processing-pipeline'

const persistenceMocks = vi.hoisted(() => ({
  ensurePersistentStorage: vi.fn(),
}))

vi.mock('@/db/persistent-storage', () => persistenceMocks)

class MockWorker {
  static instances: MockWorker[] = []

  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  readonly postMessage = vi.fn()
  readonly terminate = vi.fn()

  constructor() {
    MockWorker.instances.push(this)
  }

  emit(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent)
  }
}

beforeEach(() => {
  MockWorker.instances = []
  persistenceMocks.ensurePersistentStorage.mockReset()
  vi.stubGlobal('Worker', MockWorker)
})

afterEach(() => {
  destroyPipeline()
  vi.unstubAllGlobals()
})

describe('UVR pipeline cancellation during model preparation', () => {
  it('does not begin separation after an initializing queue item is cancelled', async () => {
    const controller = new AbortController()
    const run = runUvrPipeline(
      new File(['audio'], 'song.mp3', { type: 'audio/mpeg' }),
      'session-preparing',
      'local',
      {
        onProgress: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      },
      { signal: controller.signal },
    )

    const worker = MockWorker.instances[0]
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'init' }),
    )

    controller.abort()
    worker.emit({ type: 'ready', provider: 'wasm' })

    await expect(run).rejects.toMatchObject({ name: 'AbortError' })
    expect(
      worker.postMessage.mock.calls.some(
        ([message]) =>
          (message as { type?: string } | undefined)?.type === 'separate',
      ),
    ).toBe(false)
    expect(persistenceMocks.ensurePersistentStorage).not.toHaveBeenCalled()
  })
})
