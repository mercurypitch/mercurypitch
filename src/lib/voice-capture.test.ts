// ============================================================
// Voice Capture tests — MediaRecorder transport behavior
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTakeRecorder, inspectVoiceTake } from './voice-capture'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

class MockMediaRecorder extends EventTarget {
  static isTypeSupported = vi.fn(() => true)
  state: RecordingState = 'inactive'
  ondataavailable: ((event: BlobEvent) => void) | null = null
  onstop: (() => void) | null = null

  start(): void {
    this.state = 'recording'
  }

  pause(): void {
    queueMicrotask(() => {
      this.state = 'paused'
      this.dispatchEvent(new Event('pause'))
    })
  }

  resume(): void {
    queueMicrotask(() => {
      this.state = 'recording'
      this.dispatchEvent(new Event('resume'))
    })
  }

  stop(): void {
    this.state = 'inactive'
    this.ondataavailable?.({
      data: new Blob(['voice'], { type: 'audio/webm' }),
    } as BlobEvent)
    this.dispatchEvent(new Event('stop'))
    this.onstop?.()
  }
}

describe('createTakeRecorder', () => {
  it('pauses and resumes one encoded take with the owning transport', async () => {
    vi.stubGlobal('MediaRecorder', MockMediaRecorder)

    const recorder = createTakeRecorder({} as MediaStream)
    expect(recorder).not.toBeNull()
    expect(recorder!.start()).toBe(true)
    await expect(recorder!.pause()).resolves.toBe(true)
    await expect(recorder!.resume()).resolves.toBe(true)

    const blob = await recorder!.stop()
    expect(blob?.size).toBeGreaterThan(0)
    expect(blob?.type).toBe('audio/webm;codecs=opus')
  })

  it('does not report a pause ready before MediaRecorder emits pause', async () => {
    vi.useFakeTimers()
    class DelayedMediaRecorder extends MockMediaRecorder {
      override pause(): void {
        setTimeout(() => {
          this.state = 'paused'
          this.dispatchEvent(new Event('pause'))
        }, 25)
      }
    }
    vi.stubGlobal('MediaRecorder', DelayedMediaRecorder)

    const recorder = createTakeRecorder({} as MediaStream)!
    recorder.start()
    let settled = false
    const pauseReady = recorder.pause().then((ready) => {
      settled = true
      return ready
    })

    await vi.advanceTimersByTimeAsync(24)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await expect(pauseReady).resolves.toBe(true)
  })

  it('returns false when a MediaRecorder transition errors', async () => {
    class ErrorMediaRecorder extends MockMediaRecorder {
      override pause(): void {
        queueMicrotask(() => this.dispatchEvent(new Event('error')))
      }
    }
    vi.stubGlobal('MediaRecorder', ErrorMediaRecorder)

    const recorder = createTakeRecorder({} as MediaStream)!
    recorder.start()

    await expect(recorder.pause()).resolves.toBe(false)
  })

  it('bounds a MediaRecorder transition that never becomes ready', async () => {
    vi.useFakeTimers()
    class StalledMediaRecorder extends MockMediaRecorder {
      override pause(): void {
        // Intentionally neither transition nor emit an event.
      }
    }
    vi.stubGlobal('MediaRecorder', StalledMediaRecorder)

    const recorder = createTakeRecorder({} as MediaStream)!
    recorder.start()
    const pauseReady = recorder.pause()

    await vi.advanceTimersByTimeAsync(1000)
    await expect(pauseReady).resolves.toBe(false)
  })
})

describe('inspectVoiceTake', () => {
  it('uses the capture clock when decoded media duration is not finite', async () => {
    const audioContext = {
      decodeAudioData: vi.fn(async () => ({
        duration: Number.POSITIVE_INFINITY,
        getChannelData: () => new Float32Array([0.1, -0.25, 0.2]),
      })),
    } as unknown as AudioContext
    const blob = {
      arrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
    } as unknown as Blob

    await expect(
      inspectVoiceTake(blob, audioContext, 2750),
    ).resolves.toMatchObject({ durationMs: 2750, peakAmplitude: 0.25 })
  })

  it('checks every decoded channel before declaring clipping absent', async () => {
    const channels = [
      new Float32Array([0.1, -0.2]),
      new Float32Array([0.4, -0.998]),
    ]
    const audioContext = {
      decodeAudioData: vi.fn(async () => ({
        duration: 1,
        numberOfChannels: channels.length,
        getChannelData: (channel: number) => channels[channel]!,
      })),
    } as unknown as AudioContext
    const blob = {
      arrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
    } as unknown as Blob

    const inspection = await inspectVoiceTake(blob, audioContext, 1000)

    expect(inspection.durationMs).toBe(1000)
    expect(inspection.peakAmplitude).toBeCloseTo(0.998)
  })
})
