// ============================================================
// WhisperService — teardown contract
//
// Terminating a worker does not settle the promises waiting on
// it. These tests pin the part that is easy to regress: destroy()
// must fail everything in flight immediately, and leave no timer
// behind, so a caller learns its run is over instead of waiting
// out Whisper's 300s ceiling.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const workerMock = vi.hoisted(() => ({
  postMessage: vi.fn(),
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}))

vi.mock('@/workers/whisper-worker?worker', () => ({
  default: class FakeWorker {
    postMessage = workerMock.postMessage
    terminate = workerMock.terminate
    addEventListener = workerMock.addEventListener
    removeEventListener = workerMock.removeEventListener
  },
}))

const { WhisperService, WHISPER_SERVICE_DESTROYED_MESSAGE } =
  await import('@/lib/whisper-service')

describe('WhisperService teardown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects an in-flight transcription instead of leaving it pending', async () => {
    const service = new WhisperService()
    const pending = service.transcribe(new Float32Array(16), 'en')
    expect(vi.getTimerCount()).toBeGreaterThan(0) // the 300s ceiling

    service.destroy()

    await expect(pending).rejects.toThrow(WHISPER_SERVICE_DESTROYED_MESSAGE)
    expect(workerMock.terminate).toHaveBeenCalledTimes(1)
    // The timeout that would have fired five minutes from now is gone
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects an init still waiting on the model, and stops its watchdog', async () => {
    const service = new WhisperService()
    const pending = service.init()
    expect(vi.getTimerCount()).toBeGreaterThan(0) // the 1 Hz load watchdog

    service.destroy()

    await expect(pending).rejects.toThrow(WHISPER_SERVICE_DESTROYED_MESSAGE)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('refuses work asked of it after destroy rather than hanging', async () => {
    const service = new WhisperService()
    service.destroy()

    await expect(service.transcribe(new Float32Array(16))).rejects.toThrow(
      WHISPER_SERVICE_DESTROYED_MESSAGE,
    )
    await expect(service.init()).rejects.toThrow(
      WHISPER_SERVICE_DESTROYED_MESSAGE,
    )
    expect(workerMock.postMessage).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('is safe to destroy twice', () => {
    const service = new WhisperService()
    service.destroy()
    expect(() => service.destroy()).not.toThrow()
    expect(workerMock.terminate).toHaveBeenCalledTimes(2)
  })
})
