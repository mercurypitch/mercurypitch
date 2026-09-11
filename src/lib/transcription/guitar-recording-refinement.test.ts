// Refinement lifecycle tests keep cancelled/failed workers from returning stale partial results.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BASIC_PITCH } from './basic-pitch-inference'
import type { GuitarRefinementMessage } from './guitar-recording-refinement'
import { refineGuitarRecordingAudio } from './guitar-recording-refinement'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent<GuitarRefinementMessage>) => void) | null =
    null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: (() => void) | null = null
  terminate = vi.fn()
  postMessage = vi.fn()
  constructor() {
    FakeWorker.instances.push(this)
  }
  send(data: GuitarRefinementMessage) {
    this.onmessage?.({ data } as MessageEvent<GuitarRefinementMessage>)
  }
}
const result = {
  notes: [{ midi: 40, startSeconds: 0.1, endSeconds: 1, confidence: 0.8 }],
  duration: 2,
  processingMs: 55,
  decoderVersion: BASIC_PITCH.decoderVersion,
  modelSha256: BASIC_PITCH.modelSha256,
}

describe('explicit refinement worker ownership', () => {
  beforeEach(() => {
    FakeWorker.instances = []
    vi.stubGlobal('Worker', FakeWorker)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('starts nothing for an already aborted or oversized request', async () => {
    const abort = new AbortController()
    abort.abort()
    await expect(
      refineGuitarRecordingAudio(new Blob(), { signal: abort.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    await expect(
      refineGuitarRecordingAudio({ size: 256 * 1024 * 1024 + 1 } as Blob),
    ).rejects.toThrow('256 MiB')
    expect(FakeWorker.instances).toEqual([])
  })

  it.each(['loading', 'decoding', 'analysing'] as const)(
    'immediately terminates and settles cancellation during %s, ignoring a late result',
    async (stage) => {
      const abort = new AbortController()
      const progress = vi.fn()
      const promise = refineGuitarRecordingAudio(new Blob(), {
        signal: abort.signal,
        onProgress: progress,
      })
      const worker = FakeWorker.instances[0]
      worker.send({ type: 'progress', progress: { stage, fraction: 0.2 } })
      const queuedMessage = worker.onmessage
      abort.abort()
      queuedMessage?.({
        data: { type: 'result', result },
      } as MessageEvent<GuitarRefinementMessage>)
      await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
      expect(worker.terminate).toHaveBeenCalledTimes(1)
      expect(worker.onmessage).toBeNull()
      expect(progress).toHaveBeenCalledExactlyOnceWith({ stage, fraction: 0.2 })
    },
  )

  it('returns complete provenance/notes and releases listeners and worker on success', async () => {
    const abort = new AbortController()
    const remove = vi.spyOn(abort.signal, 'removeEventListener')
    const blob = new Blob(['audio'])
    const promise = refineGuitarRecordingAudio(blob, { signal: abort.signal })
    const worker = FakeWorker.instances[0]
    expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith({ blob })
    worker.send({ type: 'result', result })
    await expect(promise).resolves.toEqual(result)
    abort.abort()
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it.each(['error', 'messageerror', 'progress', 'model'] as const)(
    'settles %s failure without leaving a worker or a pending promise',
    async (kind) => {
      const promise = refineGuitarRecordingAudio(new Blob(), {
        onProgress: () => {
          throw new Error('Progress failed')
        },
      })
      const worker = FakeWorker.instances[0]
      if (kind === 'error')
        worker.onerror?.({
          message: 'WASM failed',
          preventDefault() {},
        } as ErrorEvent)
      else if (kind === 'messageerror') worker.onmessageerror?.()
      else if (kind === 'progress')
        worker.send({
          type: 'progress',
          progress: { stage: 'loading', fraction: 0 },
        })
      else worker.send({ type: 'error', message: 'Checksum mismatch' })
      await expect(promise).rejects.toBeInstanceOf(Error)
      expect(worker.terminate).toHaveBeenCalledTimes(1)
      expect(worker.onmessage).toBeNull()
      expect(worker.onerror).toBeNull()
      expect(worker.onmessageerror).toBeNull()
    },
  )

  it('does not cancel another caller when an older owner is disposed', async () => {
    const abort = new AbortController()
    const older = refineGuitarRecordingAudio(new Blob(), {
      signal: abort.signal,
    })
    const newer = refineGuitarRecordingAudio(new Blob())
    abort.abort()
    FakeWorker.instances[1].send({ type: 'result', result })
    await expect(older).rejects.toMatchObject({ name: 'AbortError' })
    await expect(newer).resolves.toEqual(result)
    expect(
      FakeWorker.instances.map((worker) => worker.terminate.mock.calls.length),
    ).toEqual([1, 1])
  })

  it('settles a blocked worker constructor without registering abort listeners', async () => {
    const abort = new AbortController()
    const add = vi.spyOn(abort.signal, 'addEventListener')
    vi.stubGlobal('Worker', function BlockedWorker() {
      throw new Error('Worker blocked by browser policy')
    })
    await expect(
      refineGuitarRecordingAudio(new Blob(), { signal: abort.signal }),
    ).rejects.toThrow('browser policy')
    expect(add).not.toHaveBeenCalled()
  })

  it('releases an allocated worker when sending the Blob fails', async () => {
    vi.stubGlobal(
      'Worker',
      class extends FakeWorker {
        postMessage = vi.fn(() => {
          throw new Error('Blob transfer failed')
        })
      },
    )
    const abort = new AbortController()
    const remove = vi.spyOn(abort.signal, 'removeEventListener')
    await expect(
      refineGuitarRecordingAudio(new Blob(), { signal: abort.signal }),
    ).rejects.toThrow('Blob transfer failed')
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
  })
})
