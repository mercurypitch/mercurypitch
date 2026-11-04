// Practice timer and the microphone — a take on an input of its own counts as singing, as the shared microphone does, and stops counting once let go.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { releaseMicLock } from '@/lib/mic-lock'
import { micManager } from '@/lib/mic-manager'
import { phaseElapsedMs, PRACTICE_MIN_RANGE, resetPracticeTimer, setPracticeIntervalMin, setPracticeTimerEnabled, startPracticeTimer, } from '@/stores/practice-timer-store'

/** A browser that opens a stream on whichever input is asked for. */
function openEach(): void {
  ;(globalThis.navigator as unknown as { mediaDevices: unknown }).mediaDevices =
    {
      getUserMedia: vi.fn(async (constraints: MediaStreamConstraints) => {
        const asked = (constraints.audio as MediaTrackConstraints).deviceId
        const id = (asked as { exact?: string } | undefined)?.exact ?? 'default'
        const track = {
          stop: vi.fn(),
          addEventListener: vi.fn(),
          getSettings: () => ({ deviceId: id }),
        }
        return { getTracks: () => [track], getAudioTracks: () => [track] }
      }),
    }
}

describe('practice timer and the microphone', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setPracticeTimerEnabled(true)
    setPracticeIntervalMin(PRACTICE_MIN_RANGE.min)
    resetPracticeTimer()
  })

  afterEach(async () => {
    await micManager.forceReleaseAll()
    releaseMicLock()
    setPracticeTimerEnabled(false)
    vi.useRealTimers()
  })

  it('counts a Studio take on an input of its own as singing, until it lets go', async () => {
    openEach()
    startPracticeTimer()

    const held = await micManager.acquireFrom('studio-record', 'usb-1')
    await vi.advanceTimersByTimeAsync(3000)
    expect(phaseElapsedMs()).toBe(3000)

    held.release()
    await vi.advanceTimersByTimeAsync(2000)
    expect(phaseElapsedMs()).toBe(3000)
  })
})
