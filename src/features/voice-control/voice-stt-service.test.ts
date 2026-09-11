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

// ── The reason has to leave the worker ───────────────────────
//
// A worker's console reaches no device log, so everything an iPhone could
// report was "Voice model failed to load" — the sentence naming the actual
// ONNX Runtime failure died inside the worker, and a retest could not tell a
// missing GPU adapter from weights the runtime refused.

describe('VoiceSttService load failure detail', () => {
  it('carries the reason the worker saw into the rejection', async () => {
    const service = new VoiceSttService('test-model')
    const worker = FakeWorker.instances[0]
    const load = service.init()

    worker.emit({
      type: 'status',
      status: 'error',
      detail: 'webgpu: Failed to get GPU adapter | wasm: no available backend',
    })

    await expect(load).rejects.toThrow(/Failed to get GPU adapter/)
    await expect(load).rejects.toThrow(/no available backend/)

    // A retry posts a fresh load and reports whatever THAT attempt hit, not
    // a cached sentence from the last one.
    const retry = service.init()
    worker.emit({
      type: 'status',
      status: 'error',
      detail: 'wasm: out of memory',
    })
    await expect(retry).rejects.toThrow(/out of memory/)
  })

  it('still says something useful when the worker sends no reason', async () => {
    const service = new VoiceSttService('test-model')
    const worker = FakeWorker.instances[0]
    const load = service.init()

    worker.emit({ type: 'status', status: 'error' })

    await expect(load).rejects.toThrow('Voice model failed to load')
  })
})

// ── Killed is not the same as failed ─────────────────────────
//
// A model load that exhausts the device kills the content process: no error
// is ever sent, because there is nothing left to send it. The only way to
// see it in a device log is to say what is ABOUT to be attempted, so a log
// that stops right there names the model that did it.

describe('VoiceSttService load announcement', () => {
  it('names the model before the load, where a kill cannot erase it', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const service = new VoiceSttService('some-org/some-model')

    void service.init()

    expect(info).toHaveBeenCalledWith('[voice-stt] loading some-org/some-model')
    info.mockRestore()
  })
})
