import { beforeEach, describe, expect, it, vi } from 'vitest'

// The service talks to its worker purely through postMessage/status events,
// so a fake worker capturing posts and emitting statuses exercises the whole
// load protocol — including the failure-then-retry path that once poisoned
// the page-lifetime instance.
const { FakeWorker } = vi.hoisted(() => {
  type Listener = (e: MessageEvent) => void
  class FakeWorker {
    static instances: FakeWorker[] = []
    listeners = new Set<Listener>()
    posted: Array<Record<string, unknown>> = []
    constructor() {
      FakeWorker.instances.push(this)
    }
    addEventListener(_type: string, listener: Listener): void {
      this.listeners.add(listener)
    }
    removeEventListener(_type: string, listener: Listener): void {
      this.listeners.delete(listener)
    }
    postMessage(message: Record<string, unknown>): void {
      this.posted.push(message)
    }
    terminate(): void {
      this.listeners.clear()
    }
    emit(data: Record<string, unknown>): void {
      for (const listener of [...this.listeners]) {
        listener({ data } as MessageEvent)
      }
    }
    loadPosts(): number {
      return this.posted.filter((m) => m.type === 'load').length
    }
  }
  return { FakeWorker }
})

vi.mock('@/workers/voice-stt-worker?worker', () => ({ default: FakeWorker }))

import { VoiceSttService } from './voice-stt-service'

beforeEach(() => {
  FakeWorker.instances.length = 0
})

describe('VoiceSttService load protocol', () => {
  it('posts one load and resolves on ready; a ready re-init is free', async () => {
    const service = new VoiceSttService('test-model')
    const worker = FakeWorker.instances[0]
    const first = service.init()
    expect(worker.loadPosts()).toBe(1)
    expect(worker.posted[0]).toEqual({ type: 'load', modelId: 'test-model' })
    worker.emit({ type: 'status', status: 'ready' })
    await expect(first).resolves.toBeUndefined()
    await expect(service.init()).resolves.toBeUndefined()
    expect(worker.loadPosts()).toBe(1)
  })

  it('a failed load is not sticky: the next init retries the download', async () => {
    const service = new VoiceSttService('test-model')
    const worker = FakeWorker.instances[0]

    const first = service.init()
    worker.emit({ type: 'status', status: 'loading' })
    worker.emit({ type: 'status', status: 'error' })
    await expect(first).rejects.toThrow('Voice model failed to load')

    // The regression this pins: after a failure the retry used to post
    // nothing and hang on a status that could never arrive.
    const second = service.init()
    expect(worker.loadPosts()).toBe(2)
    worker.emit({ type: 'status', status: 'loading' })
    worker.emit({ type: 'status', status: 'ready' })
    await expect(second).resolves.toBeUndefined()
    expect(service.status).toBe('ready')
  })

  it('concurrent inits share one in-flight load', async () => {
    const service = new VoiceSttService('test-model')
    const worker = FakeWorker.instances[0]
    const a = service.init()
    const b = service.init()
    expect(worker.loadPosts()).toBe(1)
    worker.emit({ type: 'status', status: 'ready' })
    await expect(a).resolves.toBeUndefined()
    await expect(b).resolves.toBeUndefined()
  })

  it('rejects init after destroy', async () => {
    const service = new VoiceSttService('test-model')
    service.destroy()
    await expect(service.init()).rejects.toThrow('Voice STT service destroyed')
  })
})
