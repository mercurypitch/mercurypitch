// ============================================================
// useExerciseCapture: the detector warmed as the mic opens
// ============================================================
//
// The first voiced frame of a take used to compile the pitch detector's
// YIN pass in the middle of a screen frame (45-54 ms of script at 4x CPU,
// lib/pitch-detector-warmup.ts). The capture warms it as the mic opens,
// in the count-in, and stops warming when the mic is handed back.

import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mic = vi.hoisted(() => ({
  acquire: vi.fn<(owner: string) => Promise<MediaStream>>(),
  release: vi.fn<(owner: string) => void>(),
}))
vi.mock('@/lib/mic-manager', () => ({ micManager: mic }))

const pitch = vi.hoisted(() => ({ createF0Stream: vi.fn() }))
vi.mock('@/lib/pitch-f0-stream', () => pitch)

const warm = vi.hoisted(() => ({
  stop: vi.fn(),
  warmPitchDetector: vi.fn(),
}))
vi.mock('@/lib/pitch-detector-warmup', () => ({
  warmPitchDetector: warm.warmPitchDetector,
}))

vi.mock('@/lib/reference-tone', () => ({
  playReferenceTone: () => Promise.resolve(),
}))

const context = { state: 'running' } as AudioContext
vi.mock('@/stores/native-shell-store', () => ({
  nativeDeviceApi: () => ({
    acquireAudio: () => ({
      ensure: () => context,
      unlock: () => Promise.resolve(true),
      release: () => undefined,
    }),
  }),
}))

const { useExerciseCapture } = await import('./useExerciseCapture')

function mount() {
  return createRoot((dispose) => ({
    capture: useExerciseCapture('test-room', 'Test'),
    dispose,
  }))
}

describe('useExerciseCapture warms the pitch detector', () => {
  beforeEach(() => {
    mic.acquire.mockReset().mockResolvedValue({} as MediaStream)
    mic.release.mockReset()
    pitch.createF0Stream.mockReset().mockReturnValue({
      startTask: () => undefined,
      peekFrames: () => [],
      takeFrames: () => [],
      dispose: () => undefined,
    })
    warm.stop.mockReset()
    warm.warmPitchDetector.mockReset().mockReturnValue(warm.stop)
  })

  it('as the mic opens, after the pitch stream, before the first take', async () => {
    const { capture, dispose } = mount()
    expect(warm.warmPitchDetector).not.toHaveBeenCalled()

    await capture.acquire()

    expect(warm.warmPitchDetector).toHaveBeenCalledOnce()
    expect(warm.warmPitchDetector.mock.invocationCallOrder[0]).toBeGreaterThan(
      pitch.createF0Stream.mock.invocationCallOrder[0] ?? 0,
    )
    dispose()
  })

  it('and stops warming when the mic is handed back', async () => {
    const { capture, dispose } = mount()
    await capture.acquire()
    expect(warm.stop).not.toHaveBeenCalled()

    capture.release()

    expect(warm.stop).toHaveBeenCalledOnce()
    dispose()
  })

  it('not at all when the pitch stream cannot start', async () => {
    pitch.createF0Stream.mockImplementation(() => {
      throw new Error('no worklet')
    })
    const { capture, dispose } = mount()

    await expect(capture.acquire()).rejects.toMatchObject({
      failure: 'unavailable',
    })

    expect(warm.warmPitchDetector).not.toHaveBeenCalled()
    dispose()
  })
})
