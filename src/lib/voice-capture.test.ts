// ============================================================
// Voice Capture tests — MediaRecorder transport behavior
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTakeRecorder } from './voice-capture'

afterEach(() => vi.unstubAllGlobals())

describe('createTakeRecorder', () => {
  it('pauses and resumes one encoded take with the owning transport', async () => {
    class MockMediaRecorder {
      static isTypeSupported = vi.fn(() => true)
      state: RecordingState = 'inactive'
      ondataavailable: ((event: BlobEvent) => void) | null = null
      onstop: (() => void) | null = null

      start(): void {
        this.state = 'recording'
      }

      pause(): void {
        this.state = 'paused'
      }

      resume(): void {
        this.state = 'recording'
      }

      stop(): void {
        this.state = 'inactive'
        this.ondataavailable?.({
          data: new Blob(['voice'], { type: 'audio/webm' }),
        } as BlobEvent)
        this.onstop?.()
      }
    }
    vi.stubGlobal('MediaRecorder', MockMediaRecorder)

    const recorder = createTakeRecorder({} as MediaStream)
    expect(recorder).not.toBeNull()
    expect(recorder!.start()).toBe(true)
    expect(recorder!.pause()).toBe(true)
    expect(recorder!.resume()).toBe(true)

    const blob = await recorder!.stop()
    expect(blob?.size).toBeGreaterThan(0)
    expect(blob?.type).toBe('audio/webm;codecs=opus')
  })
})
